-- ============================================================================
-- IcanEra Digital Card at the till — a customer who comes with the digital card
-- from their IcanEra wallet (ICAN app → Wallet → Cards) pays a POS sale with it.
-- ============================================================================
-- The cashier scans the card's QR (or pastes its link), the customer types their wallet
-- transaction PIN on the till, and the sale is paid straight from their IcanEra wallet to the
-- store's IcanEra wallet: priced at the LIVE icaneracoin value, no fee, the store receives the
-- full sale amount. It is the same hand-over as the card terminals the card QR already acts
-- like (ICAN repo: card-pay-with-pin), except the amount, the store and the recipient are the
-- ones the sale fixed up front — the till can only ever pay THIS sale, never an amount or a
-- destination of its own choosing.
--
-- It rides on the charge that IcanEra Mobile / Card already opens for a sale
-- (icanera_mobile_card_payments), so the till's polling, cancel/void, receipt, stock and the
-- "Payment received" push all work exactly as they do for a customer who pays from their wallet
-- at home. A card payment is booked as an IcanEra Wallet sale.
--
--   imc_card_begin(tx_ref, cashier, payer)   service_role ONLY -> the gate the Edge Function calls first: only the
--                                            cashier who opened the sale (or the store owner) may use it, only while
--                                            the sale is open, never the store paying itself, and at most 5 tries
--                                            per sale so a till cannot be used to hammer a customer's PIN
--   imc_pay_with_card(tx_ref, payer, last4)  service_role ONLY -> after the Edge Function checked the card holder's
--                                            PIN: payer -> store wallet in one atomic step, no fee. Any failure rolls
--                                            the whole transfer back.
--   Edge Function icanera-card-pos-pay       (ICAN repo) -> verifies the cashier's session, the card QR and the PIN
--                                            (same 3-wrong-tries / 30-minute lock the wallet uses everywhere), then
--                                            calls the two functions above.
--
-- Needs (already in the shared project): ADD_ICAN_MOBILE_CARD_PAYMENTS.sql (this repo) and
-- ICAN_DIGITAL_CARD_QR.sql (ICAN repo, backend/). Safe to run twice.
-- ============================================================================

SET lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.icanera_mobile_card_payments') IS NULL
     OR to_regprocedure('public._imc_pay_notify(public.icanera_mobile_card_payments)') IS NULL THEN
    RAISE EXCEPTION 'Run ADD_ICAN_MOBILE_CARD_PAYMENTS.sql first — a card payment settles the same charge a Mobile / Card sale opens.';
  END IF;
  IF to_regclass('public.ican_digital_cards') IS NULL THEN
    RAISE EXCEPTION 'public.ican_digital_cards does not exist — run ICAN_DIGITAL_CARD_QR.sql (ICAN repo, backend/) first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'transfer_ican') THEN
    RAISE EXCEPTION 'public.transfer_ican does not exist — run ICAN_TRANSACTION_CONTEXT_MIGRATION.sql (ICAN repo) first.';
  END IF;
END $$;

-- How many times a card was tried on this sale, and which card (last 4 digits) finally paid it.
ALTER TABLE public.icanera_mobile_card_payments ADD COLUMN IF NOT EXISTS card_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE public.icanera_mobile_card_payments ADD COLUMN IF NOT EXISTS card_last4    TEXT;

-- ----------------------------------------------------------------------------
-- 1. The gate — called ONLY by the Edge Function, with the user id it took from the caller's verified session and
--    the card holder it resolved from the card QR. Counting the try here (before the PIN is looked at) caps the
--    PIN guesses a single sale can ever cause.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_card_begin(p_tx_ref TEXT, p_user_id UUID, p_payer_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.icanera_mobile_card_payments%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref FOR UPDATE;
  IF NOT FOUND OR p_user_id IS NULL
     OR (p.created_by IS DISTINCT FROM p_user_id AND p.recipient_user_id IS DISTINCT FROM p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Payment not found');
  END IF;
  IF p.status = 'paid' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale has already been paid');
  END IF;
  IF p.status <> 'awaiting_payment' OR p.expires_at <= now() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale is no longer open for payment — start it again');
  END IF;
  IF p_payer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This card cannot be used');
  END IF;
  IF p_payer_user_id = p.recipient_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This is the store''s own card — it cannot pay the store''s own sale');
  END IF;
  IF p.card_attempts >= 5 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Too many card tries for this sale — start the sale again or use another way to pay');
  END IF;
  UPDATE public.icanera_mobile_card_payments
     SET card_attempts = card_attempts + 1, updated_at = now() WHERE id = p.id;
  RETURN jsonb_build_object('success', TRUE, 'amount_ugx', p.amount_ugx, 'merchant_name', p.merchant_name);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Pay the sale from the card holder's wallet — called ONLY by the Edge Function, after it checked the card
--    holder's PIN. Same maths and same atomic transfer as imc_pay_wallet (a customer paying from their wallet
--    at home), with the payer given instead of read from a session.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_with_card(p_tx_ref TEXT, p_payer_user_id UUID, p_card_last4 TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        public.icanera_mobile_card_payments%ROWTYPE;
  v_price  NUMERIC;
  v_ican   NUMERIC;
  v_res    JSONB;
  v_name   TEXT;
  v_last4  TEXT := NULLIF(right(regexp_replace(COALESCE(p_card_last4, ''), '[^0-9]', '', 'g'), 4), '');
BEGIN
  IF p_payer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This card cannot be used');
  END IF;
  IF p_tx_ref IS NULL OR p_tx_ref !~ '^IMC-[A-Z0-9]{20}$' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This payment is not valid');
  END IF;
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This payment is not valid');
  END IF;
  IF p.status = 'paid' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale has already been paid');
  END IF;
  IF p.status <> 'awaiting_payment' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale was cancelled — start it again');
  END IF;
  IF p.expires_at <= now() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale has expired — start it again');
  END IF;
  IF p_payer_user_id = p.recipient_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This is the store''s own card — it cannot pay the store''s own sale');
  END IF;

  BEGIN
    v_price := public.public_tx_ican_price_ugx();
    -- Round UP to 8 decimals: the store always receives at least the sale's value.
    v_ican  := GREATEST(CEIL((p.amount_ugx / v_price) * 100000000) / 100000000, 0.00000001);

    v_res := public.transfer_ican(
      p_payer_user_id, p.recipient_user_id, v_ican,
      format('Purchase at %s | UGX %s | digital card%s | ref %s', COALESCE(p.merchant_name, 'store'),
             to_char(p.amount_ugx, 'FM999,999,999,990'), COALESCE(' ' || v_last4, ''), p.tx_ref),
      'digital-city-era', 'IMC-W-' || p.tx_ref,
      p.amount_ugx, 'UGX', p.merchant_name, 'business', 'personal_expense', NULL);
    IF NOT COALESCE((v_res ->> 'success')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION '%', COALESCE(v_res ->> 'error', 'The wallet payment could not be completed');
    END IF;

    BEGIN
      SELECT COALESCE(NULLIF(btrim(ua.account_holder_name), ''), NULL) INTO v_name
        FROM public.user_accounts ua WHERE ua.user_id = p_payer_user_id;
    EXCEPTION WHEN OTHERS THEN
      v_name := NULL;
    END;

    UPDATE public.icanera_mobile_card_payments
       SET status = 'paid', channel = 'wallet', payer_user_id = p_payer_user_id,
           payer_name = COALESCE(v_name, p.customer_name), card_last4 = v_last4,
           ican_amount = v_ican, ican_tx_id = NULLIF(v_res ->> 'out_tx_id', '')::UUID,
           paid_ugx = p.amount_ugx, processing_fee_ugx = 0, charge_ugx = p.amount_ugx,
           error = NULL, paid_at = now(), updated_at = now()
     WHERE id = p.id
     RETURNING * INTO p;
    PERFORM public._imc_pay_notify(p);

    -- The card holder is not holding a phone at the till: tell them, in their wallet inbox (and, through the push
    -- relay, on their phone), exactly what was taken, so a card used without them is noticed at once.
    -- It must never block a payment, so any failure here is swallowed.
    BEGIN
      INSERT INTO public.ican_wallet_inbox_notifications
        (recipient_user_id, source_app, notification_type, title, message, reference_id, metadata)
      VALUES
        (p_payer_user_id, 'ican', 'qr_pos_card_payment',
         left('Card payment: UGX ' || to_char(p.amount_ugx, 'FM999,999,999,990'), 200),
         left('You paid UGX ' || to_char(p.amount_ugx, 'FM999,999,999,990') || ' at ' || COALESCE(p.merchant_name, 'a store')
              || ' with your IcanEra digital card' || COALESCE(' ending ' || v_last4, '') || ' (' || to_char(v_ican, 'FM999,999,990.00000000')
              || ' ICAN). Reference ' || p.tx_ref || '. Not you? Turn the card QR off in Wallet → Cards.', 500),
         p.tx_ref,
         jsonb_build_object('tx_ref', p.tx_ref, 'amount_ugx', p.amount_ugx, 'merchant_name', p.merchant_name));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  EXCEPTION WHEN OTHERS THEN
    -- the whole block rolls back: no half-moved money
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object('success', TRUE, 'status', 'paid') || public._imc_pay_json(p);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Who may call what: neither is for the browser — only the Edge Function (service role) after it has checked the
--    cashier's session, the card QR and the card holder's PIN.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.imc_card_begin(TEXT, UUID, UUID)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.imc_pay_with_card(TEXT, UUID, TEXT)       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.imc_card_begin(TEXT, UUID, UUID)       TO service_role;
GRANT EXECUTE ON FUNCTION public.imc_pay_with_card(TEXT, UUID, TEXT)    TO service_role;

RESET lock_timeout;

-- Force PostgREST to pick up the new functions immediately.
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ IcanEra Digital Card payments are ready in the database. Last step: deploy the icanera-card-pos-pay Edge Function (ICAN repo, backend/components/supabase/functions).';
END $$;
