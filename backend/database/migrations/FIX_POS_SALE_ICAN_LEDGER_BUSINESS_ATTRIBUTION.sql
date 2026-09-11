-- ============================================================================
-- FIX: ADD_POS_SALES_TO_ICAN_LEDGER.sql only attributed a sale to a store's
-- business profile via supermarkets.pichin_business_profile_id directly —
-- but plenty of stores don't have that column populated even though a real
-- Pichin business profile exists for them (the same gap
-- resolveBusinessProfileId() in supplierOrdersService.js already works
-- around via business_app_links / business_profiles.user_id). For those
-- stores every sale fell back to recipient_user_id = owner, which
-- get_ican_record_every_transaction_feed()'s 'business' scope never
-- includes (it strictly requires business_profile_id IS NOT NULL) — so the
-- sale showed up as the owner's PERSONAL wallet activity in the ICAN app
-- instead of the store's Business ledger. Real example: a SupermartKera
-- cash sale (RCP-20260911-0007) landed under "1 Personal" / "0 Business".
--
-- This teaches record_sale_in_ican_ledger() the same fallback chain
-- resolveBusinessProfileId() already uses, and backfills every already-
-- inserted sale/refund ledger row that fell back to the owner's personal
-- identity, re-attributing it to the store's business profile wherever one
-- can now be resolved.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_store_business_profile_id(p_supermarket_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_profile_id UUID;
  v_owner_user_id UUID;
BEGIN
  SELECT pichin_business_profile_id, owner_user_id
    INTO v_business_profile_id, v_owner_user_id
    FROM public.supermarkets
   WHERE id = p_supermarket_id;

  IF v_business_profile_id IS NOT NULL THEN
    RETURN v_business_profile_id;
  END IF;

  SELECT business_profile_id INTO v_business_profile_id
    FROM public.business_app_links
   WHERE app_key = 'supermarketa'
     AND source_entity_id = p_supermarket_id
     AND status = 'active'
   LIMIT 1;
  IF v_business_profile_id IS NOT NULL THEN
    RETURN v_business_profile_id;
  END IF;

  IF v_owner_user_id IS NOT NULL THEN
    SELECT id INTO v_business_profile_id
      FROM public.business_profiles
     WHERE user_id = v_owner_user_id
       AND COALESCE(status, 'active') = 'active'
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;

  RETURN v_business_profile_id;
END;
$$;

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
    IF NEW.payment_method IN ('icanera_wallet', 'ican_wallet') THEN
      RETURN NEW;
    END IF;
    v_type := 'sale';
    v_note := 'POS sale ' || COALESCE(NEW.receipt_number, NEW.transaction_id);
  ELSE
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

  SELECT owner_user_id INTO v_owner_user_id FROM public.supermarkets WHERE id = NEW.supermarket_id;
  v_business_profile_id := public.resolve_store_business_profile_id(NEW.supermarket_id);

  IF v_owner_user_id IS NULL AND v_business_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ican_amount := round(NEW.total_amount / 5000.0, 8);
  IF v_ican_amount <= 0 THEN
    RETURN NEW;
  END IF;

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
  RAISE WARNING 'record_sale_in_ican_ledger failed for transaction %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Backfill: re-attribute already-inserted sale/refund ledger rows that fell
-- back to the owner's personal identity, wherever a business profile can
-- now be resolved for the store that sale belongs to.
UPDATE public.ican_coin_transactions t
SET business_profile_id = resolved.bpid,
    recipient_user_id = NULL
FROM (
  SELECT t2.id AS tx_id, public.resolve_store_business_profile_id(tr.supermarket_id) AS bpid
    FROM public.ican_coin_transactions t2
    JOIN public.transactions tr ON tr.transaction_id = t2.reference_id
   WHERE t2.source_app = 'digital-city-era'
     AND t2.transaction_type IN ('sale', 'refund')
     AND t2.business_profile_id IS NULL
) resolved
WHERE t.id = resolved.tx_id AND resolved.bpid IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ POS sale ledger rows now resolve a store''s business profile the same way resolveBusinessProfileId() does, and existing mis-attributed rows were backfilled.';
END $$;

NOTIFY pgrst, 'reload schema';
