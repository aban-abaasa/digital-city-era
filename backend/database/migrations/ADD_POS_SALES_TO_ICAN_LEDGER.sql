-- ============================================================================
-- FIX: cash (and mobile money, card, etc.) POS sales were never recorded in
-- ican_coin_transactions — only sales actually paid through the ICAN wallet
-- got a ledger row (from transfer_ican()/transfer_ican_to_business(), type
-- 'purchase'/'transfer_out'). Any report built on ican_coin_transactions
-- (business revenue views, cross-app dashboards) was silently missing every
-- cash sale, which is most of a typical store's volume.
--
-- This adds an AFTER INSERT trigger on public.transactions that logs every
-- completed sale as a 'sale' row in ican_coin_transactions, regardless of
-- payment method — a record-only ledger entry with NO wallet balance
-- movement (cash was already collected physically; crediting an ICAN
-- balance for it would mint coins from nothing). 'sale' is already a
-- distinct transaction_type in the schema precisely for this: revenue
-- recognition decoupled from actual coin transfers.
--
-- Sales paid via the real ICAN wallet are skipped here — they already have
-- their own transfer_ican() ledger row, and logging a second 'sale' row for
-- the same money would double the store's reported revenue.
--
-- A second trigger on status transitioning to voided/refunded logs a
-- matching 'refund' row, so a void doesn't silently overstate revenue in
-- perpetuity in anything reading this ledger.
--
-- Revenue is attributed to the store's Pichin business profile when one is
-- linked (business_profile_id, recipient_user_id left NULL — same
-- convention ICAN_BUSINESS_WALLET_TRANSFERS.sql uses for business-wallet
-- receipts, so this never lands in the owner's personal trading wallet),
-- falling back to the owner's personal identity (recipient_user_id) only
-- when the store has no linked business profile yet.
--
-- Ledger logging is deliberately best-effort: any failure here is caught
-- and only raises a WARNING, so it can never block or roll back a real POS
-- sale.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_sale_in_ican_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id UUID;
  v_business_profile_id UUID;
  v_ican_amount NUMERIC;
  v_type TEXT;
  v_note TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'completed' THEN
      RETURN NEW;
    END IF;
    -- Already has its own real transfer_ican() ledger row — don't double it.
    IF NEW.payment_method IN ('icanera_wallet', 'ican_wallet') THEN
      RETURN NEW;
    END IF;
    v_type := 'sale';
    v_note := 'POS sale ' || COALESCE(NEW.receipt_number, NEW.transaction_id);
  ELSE -- UPDATE: status just transitioned into voided/refunded
    IF NEW.status NOT IN ('voided', 'refunded') OR OLD.status = NEW.status THEN
      RETURN NEW;
    END IF;
    IF NEW.payment_method IN ('icanera_wallet', 'ican_wallet') THEN
      RETURN NEW;
    END IF;
    v_type := 'refund';
    v_note := 'POS ' || NEW.status || ' ' || COALESCE(NEW.receipt_number, NEW.transaction_id);
  END IF;

  IF COALESCE(NEW.total_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id, pichin_business_profile_id
    INTO v_owner_user_id, v_business_profile_id
    FROM public.supermarkets
   WHERE id = NEW.supermarket_id;

  IF v_owner_user_id IS NULL AND v_business_profile_id IS NULL THEN
    RETURN NEW; -- nothing to attribute this sale's ledger entry to
  END IF;

  v_ican_amount := round(NEW.total_amount / 5000.0, 8);
  IF v_ican_amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Deliberately not setting the legacy "type" column: it's nullable, no
  -- current query reads it (see FIX_ICAN_COIN_TRANSACTIONS_LEGACY_TYPE_NOT_NULL.sql
  -- in the ICAN repo), and its original CHECK constraint (a narrower, older
  -- list) never included 'refund' — only transaction_type's constraint has
  -- been kept current.
  INSERT INTO public.ican_coin_transactions
    (recipient_user_id, ican_amount, transaction_type, status,
     local_amount, local_currency, source_app, reference_id, note, business_profile_id)
  VALUES
    (CASE WHEN v_business_profile_id IS NULL THEN v_owner_user_id ELSE NULL END,
     v_ican_amount, v_type, 'completed',
     NEW.total_amount, 'UGX', 'digital-city-era',
     NEW.transaction_id, v_note, v_business_profile_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let ledger logging block or roll back the real sale.
  RAISE WARNING 'record_sale_in_ican_ledger failed for transaction %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_sale_in_ican_ledger_insert_trigger ON public.transactions;
CREATE TRIGGER record_sale_in_ican_ledger_insert_trigger
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.record_sale_in_ican_ledger();

DROP TRIGGER IF EXISTS record_sale_in_ican_ledger_void_trigger ON public.transactions;
CREATE TRIGGER record_sale_in_ican_ledger_void_trigger
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.record_sale_in_ican_ledger();

DO $$
BEGIN
  RAISE NOTICE '✅ Every completed POS sale (cash included) now gets a ''sale'' row in ican_coin_transactions; voids/refunds get a matching ''refund'' row.';
END $$;

NOTIFY pgrst, 'reload schema';
