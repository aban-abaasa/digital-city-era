-- ============================================================================
-- IcanEra Mobile / Card — let a POS customer WITHOUT an IcanEra account pay a
-- supermarket sale with Mobile Money or a card (Flutterwave) and have the
-- money credited straight into the store's IcanEra wallet. The cashier can
-- also REQUEST the payment (a Mobile Money prompt to a typed phone number, or
-- an in-app request to the customer's IcanEra wallet number), so scanning is
-- optional and the customer does not have to be at the till.
-- ============================================================================
-- Needs (already in the shared project): ADD_PUBLIC_TRANSACTION_QR.sql from the
-- ICAN repo (public_tx_ican_price_ugx, public_tx_fee_pct, the wallet-inbox qr_*
-- allowance), ICAN_BUY_SELL_COINS_ADDENDUM.sql + CLOSE_BUY_ICAN_DIRECT_CALL_HOLE.sql
-- (buy_ican_coins, service_role only), the 12-parameter transfer_ican, and the
-- supermarkets table. Safe to run twice.
--
-- Same shape as the card-QR / guest-checkout payments, so the same safety rules hold:
--
--   imc_pay_create(store, amount, ...)     cashier (signed in) -> fixes amount + fee, stores a pending charge
--   imc_pay_info(tx_ref)                   anyone with the link -> what the customer's pay page shows
--   imc_pay_status(tx_ref)                 the cashier -> full state, polled by the till
--   (browser)  Flutterwave inline checkout with that charge's tx_ref (the till OR the customer's own phone)
--   (cashier)  Edge Function icanera-mobile-card-pay { action: request_momo } -> Mobile Money prompt to a phone
--   imc_pay_request_wallet(tx_ref, user)   cashier -> in-app request in the customer's IcanEra wallet inbox
--   imc_pay_wallet(tx_ref)                 the customer (signed in) -> pays from their wallet, no fee
--   imc_pay_my_requests()                  the customer (signed in) -> the store requests still waiting on THEM, so
--                                          they can pay from home inside Digital City Era
--   Edge Function icanera-mobile-card-pay  -> asks Flutterwave itself whether it was paid, then
--   imc_pay_fulfil(tx_ref, ...)            service_role ONLY -> credits the store wallet, or the function refunds
--   imc_pay_cancel(tx_ref)                 cashier -> voids a charge nobody has paid yet
--
-- Where the money lands: the store owner's IcanEra wallet — exactly where the wallet-QR
-- payment (CashierReceiveIcanModal -> transfer_ican to supermarkets.owner_user_id) lands —
-- priced at the LIVE icaneracoin value, so the store receives the FULL sale amount. A customer
-- paying by Mobile Money / card adds the gateway fee, shown openly (same maths as the card QR);
-- paying from an IcanEra wallet costs nothing extra.
--
-- The browser never sends an amount to credit, a recipient or a fee to the payment step:
-- only the sale amount when the cashier opens the charge (a payer can only ever fund a
-- wallet with money Flutterwave actually received, so a hostile caller gains nothing).
-- The link put in a customer's inbox is built here from guest_checkout_config 'pos_pay_base_url',
-- never taken from the caller, so nobody can plant a phishing link in someone's wallet inbox.
-- ============================================================================

SET lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.public_tx_ican_price_ugx()') IS NULL
     OR to_regprocedure('public.public_tx_fee_pct()') IS NULL THEN
    RAISE EXCEPTION 'Run ADD_PUBLIC_TRANSACTION_QR.sql (ICAN repo, backend/) first — it provides the live icaneracoin price and the gateway fee helpers.';
  END IF;
  IF to_regclass('public.supermarkets') IS NULL THEN
    RAISE EXCEPTION 'public.supermarkets does not exist — this migration belongs in the SupermartKera / digital-city-era project.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'buy_ican_coins') THEN
    RAISE EXCEPTION 'public.buy_ican_coins does not exist — run ICAN_BUY_SELL_COINS_ADDENDUM.sql (ICAN repo) first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'transfer_ican') THEN
    RAISE EXCEPTION 'public.transfer_ican does not exist — run ICAN_TRANSACTION_CONTEXT_MIGRATION.sql (ICAN repo) first.';
  END IF;
END $$;

-- Where the customer's pay page lives (used for links in wallet-inbox requests). Change it with:
--   UPDATE public.guest_checkout_config SET value = 'https://your-store-domain' WHERE key = 'pos_pay_base_url';
DO $$
BEGIN
  IF to_regclass('public.guest_checkout_config') IS NOT NULL THEN
    INSERT INTO public.guest_checkout_config (key, value, note) VALUES
      ('pos_pay_base_url', 'https://supermartkera.icanera.space',
       'Public origin of the SupermartKera app. IcanEra Mobile / Card requests in a customer''s wallet inbox link to <this>/mobile-pay/<ref>.')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Charges (no foreign keys: deleting a store or user must never erase the record of real money)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.icanera_mobile_card_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_ref              TEXT NOT NULL UNIQUE,
  supermarket_id      UUID NOT NULL,
  recipient_user_id   UUID NOT NULL,
  merchant_name       TEXT,
  description         TEXT,
  created_by          UUID,
  customer_name       TEXT,
  customer_phone      TEXT,
  amount_ugx          NUMERIC NOT NULL CHECK (amount_ugx >= 500 AND amount_ugx <= 5000000),
  processing_fee_ugx  NUMERIC NOT NULL DEFAULT 0,
  charge_ugx          NUMERIC NOT NULL,
  ican_amount         NUMERIC(18, 8),
  status              TEXT NOT NULL DEFAULT 'awaiting_payment'
                      CHECK (status IN ('awaiting_payment', 'paid', 'failed', 'refunded', 'cancelled')),
  channel             TEXT,
  payer_name          TEXT,
  payer_phone         TEXT,
  payer_user_id       UUID,
  flw_transaction_id  TEXT,
  paid_ugx            NUMERIC,
  ican_tx_id          UUID,
  momo_requests       INT NOT NULL DEFAULT 0,
  wallet_requests     INT NOT NULL DEFAULT 0,
  error               TEXT,
  refund_note         TEXT,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS imc_payments_store_idx   ON public.icanera_mobile_card_payments (supermarket_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS imc_payments_creator_idx ON public.icanera_mobile_card_payments (created_by, status, created_at DESC);
ALTER TABLE public.icanera_mobile_card_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.icanera_mobile_card_payments FROM PUBLIC, anon, authenticated;

-- The details of a settled charge, in one shape for every path (Flutterwave, wallet, polling).
CREATE OR REPLACE FUNCTION public._imc_pay_json(p public.icanera_mobile_card_payments)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'tx_ref', p.tx_ref, 'merchant_name', p.merchant_name, 'amount_ugx', p.amount_ugx,
    'processing_fee_ugx', p.processing_fee_ugx, 'charged_ugx', p.paid_ugx,
    'ican_amount', p.ican_amount, 'ican_tx_id', p.ican_tx_id, 'channel', p.channel,
    'payer_name', p.payer_name, 'payer_phone', p.payer_phone);
$$;
REVOKE ALL ON FUNCTION public._imc_pay_json(public.icanera_mobile_card_payments) FROM PUBLIC, anon, authenticated;

-- "Payment received" as a real, PUSHED notification: a row in the wallet inbox, which the ican_wallet_push_webhook trigger
-- hands to the wallet-push relay, which delivers it to the recipient's phone / PC. The cashier who rang the sale up (they
-- may be busy with the next customer) and the store owner each get one. This is the ONLY notification a paid sale causes —
-- the till shows no pop-up. It must never block a payment, so any failure here is swallowed.
CREATE OR REPLACE FUNCTION public._imc_pay_notify(p public.icanera_mobile_card_payments)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_who UUID;
  v_how TEXT := CASE lower(COALESCE(p.channel, ''))
                  WHEN 'wallet' THEN 'their IcanEra wallet'
                  WHEN 'card' THEN 'card'
                  WHEN 'mobilemoneyuganda' THEN 'Mobile Money'
                  ELSE 'Mobile Money / card' END;
  v_title TEXT := 'Payment received: UGX ' || to_char(p.amount_ugx, 'FM999,999,999,990');
  v_msg TEXT := COALESCE(NULLIF(btrim(p.payer_name), ''), NULLIF(btrim(p.customer_phone), ''), 'A customer')
                || ' paid UGX ' || to_char(p.amount_ugx, 'FM999,999,999,990') || ' by ' || v_how
                || ' at ' || COALESCE(p.merchant_name, 'the store') || '. Reference ' || p.tx_ref;
BEGIN
  FOR v_who IN SELECT DISTINCT u FROM unnest(ARRAY[p.created_by, p.recipient_user_id]) AS u WHERE u IS NOT NULL LOOP
    BEGIN
      INSERT INTO public.ican_wallet_inbox_notifications
        (recipient_user_id, source_app, notification_type, title, message, reference_id, metadata)
      VALUES
        (v_who, 'ican', 'qr_pos_payment_received', left(v_title, 200), left(v_msg, 500), p.tx_ref,
         -- push_path: where tapping the push opens in the SupermartKera app (the cashier's till, not the admin page)
         jsonb_build_object('tx_ref', p.tx_ref, 'amount_ugx', p.amount_ugx, 'merchant_name', p.merchant_name)
         || CASE WHEN v_who = p.created_by THEN jsonb_build_object('push_path', '/cashier-portal') ELSE '{}'::JSONB END);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._imc_pay_notify(public.icanera_mobile_card_payments) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Open a charge (cashier, signed in)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_create(
  p_supermarket_id UUID,
  p_amount_ugx     NUMERIC,
  p_description    TEXT DEFAULT NULL,
  p_customer_name  TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  s        RECORD;
  v_amount NUMERIC;
  v_pct    NUMERIC;
  v_charge NUMERIC;
  v_ref    TEXT;
  v_expiry TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Please sign in');
  END IF;
  IF p_supermarket_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No store selected for this sale');
  END IF;
  IF p_amount_ugx IS NULL OR p_amount_ugx < 500 OR p_amount_ugx > 5000000 THEN
    RETURN jsonb_build_object('success', FALSE,
      'error', 'Mobile Money / card works for sales between UGX 500 and UGX 5,000,000');
  END IF;
  v_amount := CEIL(p_amount_ugx);

  SELECT sm.owner_user_id, sm.name INTO s FROM public.supermarkets sm WHERE sm.id = p_supermarket_id;
  IF NOT FOUND OR s.owner_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Could not find this store''s IcanEra wallet');
  END IF;

  -- Refuse up front (before anyone is charged) if the live coin price can't be read.
  BEGIN
    PERFORM public.public_tx_ican_price_ugx();
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
  END;

  -- Housekeeping + a per-cashier cap, so one account cannot clutter (or lock) a store.
  DELETE FROM public.icanera_mobile_card_payments
   WHERE status = 'awaiting_payment' AND created_at < now() - INTERVAL '7 days';
  IF (SELECT count(*) FROM public.icanera_mobile_card_payments
       WHERE created_by = v_uid AND status = 'awaiting_payment'
         AND created_at > now() - INTERVAL '1 hour') >= 20 THEN
    RETURN jsonb_build_object('success', FALSE,
      'error', 'Too many open Mobile Money / card sales — please wait a few minutes and try again');
  END IF;

  v_pct    := public.public_tx_fee_pct();
  v_charge := CEIL((v_amount / (1 - v_pct / 100)) / 100) * 100;
  v_ref    := 'IMC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
  v_expiry := now() + INTERVAL '30 minutes';

  INSERT INTO public.icanera_mobile_card_payments (
    tx_ref, supermarket_id, recipient_user_id, merchant_name, description, created_by,
    customer_name, customer_phone, amount_ugx, processing_fee_ugx, charge_ugx, expires_at
  ) VALUES (
    v_ref, p_supermarket_id, s.owner_user_id, s.name,
    left(NULLIF(btrim(COALESCE(p_description, '')), ''), 200), v_uid,
    left(NULLIF(btrim(COALESCE(p_customer_name, '')), ''), 80),
    left(regexp_replace(COALESCE(p_customer_phone, ''), '[^0-9+]', '', 'g'), 16),
    v_amount, v_charge - v_amount, v_charge, v_expiry);

  RETURN jsonb_build_object(
    'success', TRUE, 'tx_ref', v_ref, 'merchant_name', s.name,
    'amount_ugx', v_amount, 'processing_fee_pct', v_pct,
    'processing_fee_ugx', v_charge - v_amount, 'charge_ugx', v_charge, 'expires_at', v_expiry);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. What the customer's pay page shows (anyone holding the unguessable link)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_info(p_tx_ref TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.icanera_mobile_card_payments%ROWTYPE;
  v_status TEXT;
BEGIN
  IF p_tx_ref IS NULL OR p_tx_ref !~ '^IMC-[A-Z0-9]{20}$' THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;
  v_status := CASE WHEN p.status = 'awaiting_payment' AND p.expires_at <= now() THEN 'expired' ELSE p.status END;
  RETURN jsonb_build_object(
    'found', TRUE,
    'tx_ref', p.tx_ref,
    'merchant_name', p.merchant_name,
    'description', p.description,
    'amount_ugx', p.amount_ugx,
    'processing_fee_ugx', p.processing_fee_ugx,
    'charge_ugx', p.charge_ugx,
    'status', v_status,
    'payable', v_status = 'awaiting_payment',
    'expires_at', p.expires_at);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. The till's view of the charge (cashier who opened it, or the store owner) — polled every few seconds,
--    so it also catches a customer paying from their wallet, which never touches Flutterwave.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_status(p_tx_ref TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  p     public.icanera_mobile_card_payments%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref;
  IF NOT FOUND OR (p.created_by IS DISTINCT FROM v_uid AND p.recipient_user_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;
  v_status := CASE WHEN p.status = 'awaiting_payment' AND p.expires_at <= now() THEN 'expired' ELSE p.status END;
  RETURN jsonb_build_object('found', TRUE, 'status', v_status, 'error', p.error)
         || CASE WHEN p.status = 'paid' THEN public._imc_pay_json(p) ELSE '{}'::JSONB END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Void a charge nobody has paid (cashier closed the screen / changed the sale)
--    A payment that still lands on a cancelled charge is refunded by the Edge Function.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_cancel(p_tx_ref TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  p     public.icanera_mobile_card_payments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Please sign in');
  END IF;
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref FOR UPDATE;
  IF NOT FOUND OR (p.created_by IS DISTINCT FROM v_uid AND p.recipient_user_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Payment not found');
  END IF;
  IF p.status = 'awaiting_payment' THEN
    UPDATE public.icanera_mobile_card_payments SET status = 'cancelled', updated_at = now() WHERE id = p.id;
    RETURN jsonb_build_object('success', TRUE, 'status', 'cancelled');
  END IF;
  -- Already paid / failed / refunded / cancelled: report it as it is, change nothing.
  RETURN jsonb_build_object('success', TRUE, 'status', p.status);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Ask a customer who is NOT at the till: an in-app request in their IcanEra wallet inbox
--    (the cashier found them by wallet number / phone / email). They open the link, sign in and pay
--    from their wallet with no fee — or pay by Mobile Money / card on the same page.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_request_wallet(p_tx_ref TEXT, p_recipient_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  p      public.icanera_mobile_card_payments%ROWTYPE;
  v_base TEXT;
  v_url  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Please sign in');
  END IF;
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref FOR UPDATE;
  IF NOT FOUND OR (p.created_by IS DISTINCT FROM v_uid AND p.recipient_user_id IS DISTINCT FROM v_uid) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Payment not found');
  END IF;
  IF p.status <> 'awaiting_payment' OR p.expires_at <= now() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale is no longer open for payment');
  END IF;
  IF p_recipient_user_id IS NULL OR p_recipient_user_id = p.recipient_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Choose the customer''s own IcanEra account');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_accounts ua WHERE ua.user_id = p_recipient_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No IcanEra account found for that customer');
  END IF;
  IF p.wallet_requests >= 3 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This payment was already requested 3 times — ask the customer to check their IcanEra inbox');
  END IF;

  BEGIN
    EXECUTE $q$SELECT NULLIF(btrim(value), '') FROM public.guest_checkout_config WHERE key = 'pos_pay_base_url'$q$ INTO v_base;
  EXCEPTION WHEN OTHERS THEN
    v_base := NULL;
  END;
  v_url := CASE WHEN v_base ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'
                THEN v_base || '/mobile-pay/' || p.tx_ref END;

  BEGIN
    INSERT INTO public.ican_wallet_inbox_notifications
      (recipient_user_id, source_app, notification_type, title, message, reference_id, metadata)
    VALUES
      (p_recipient_user_id, 'ican', 'qr_pos_payment_request',
       left('Payment request from ' || COALESCE(p.merchant_name, 'a store'), 200),
       left(COALESCE(p.merchant_name, 'A store') || ' is asking for UGX ' || to_char(p.amount_ugx, 'FM999,999,999,990')
            || '. Pay from your IcanEra wallet with no fee, or with Mobile Money / card.'
            || COALESCE(' ' || v_url, ' Reference ' || p.tx_ref), 500),
       p.tx_ref,
       -- push_path: tapping the phone alert on a Digital City Era device opens this sale's pay page there (where a
       -- signed-in customer pays from their wallet), not the admin page the relay would otherwise default to
       jsonb_build_object('tx_ref', p.tx_ref, 'pay_url', v_url, 'amount_ugx', p.amount_ugx,
                          'merchant_name', p.merchant_name, 'push_path', '/mobile-pay/' || p.tx_ref));
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'The customer''s IcanEra inbox is not available right now');
  END;

  UPDATE public.icanera_mobile_card_payments
     SET wallet_requests = wallet_requests + 1, updated_at = now() WHERE id = p.id;
  RETURN jsonb_build_object('success', TRUE, 'requested', TRUE);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. The customer pays from their IcanEra wallet (signed in): payer -> store wallet, in one atomic step,
--    priced at the live icaneracoin value, no fee. Any failure rolls the whole transfer back.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_wallet(p_tx_ref TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  p       public.icanera_mobile_card_payments%ROWTYPE;
  v_price NUMERIC;
  v_ican  NUMERIC;
  v_res   JSONB;
  v_name  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Sign in to pay from your IcanEra wallet');
  END IF;
  IF p_tx_ref IS NULL OR p_tx_ref !~ '^IMC-[A-Z0-9]{20}$' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This payment link is not valid');
  END IF;
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This payment link is not valid');
  END IF;
  IF p.status = 'paid' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale has already been paid');
  END IF;
  IF p.status <> 'awaiting_payment' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale was cancelled — ask the cashier to start it again');
  END IF;
  IF p.expires_at <= now() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This payment request has expired — ask the cashier to start it again');
  END IF;
  IF v_uid = p.recipient_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'You cannot pay your own store''s sale from its own wallet');
  END IF;

  BEGIN
    v_price := public.public_tx_ican_price_ugx();
    -- Round UP to 8 decimals: the store always receives at least the sale's value.
    v_ican  := GREATEST(CEIL((p.amount_ugx / v_price) * 100000000) / 100000000, 0.00000001);

    v_res := public.transfer_ican(
      v_uid, p.recipient_user_id, v_ican,
      format('Purchase at %s | UGX %s | ref %s', COALESCE(p.merchant_name, 'store'),
             to_char(p.amount_ugx, 'FM999,999,999,990'), p.tx_ref),
      'digital-city-era', 'IMC-W-' || p.tx_ref,
      p.amount_ugx, 'UGX', p.merchant_name, 'business', 'personal_expense', NULL);
    IF NOT COALESCE((v_res ->> 'success')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION '%', COALESCE(v_res ->> 'error', 'The wallet payment could not be completed');
    END IF;

    BEGIN
      SELECT COALESCE(NULLIF(btrim(ua.account_holder_name), ''), NULL) INTO v_name
        FROM public.user_accounts ua WHERE ua.user_id = v_uid;
    EXCEPTION WHEN OTHERS THEN
      v_name := NULL;
    END;

    UPDATE public.icanera_mobile_card_payments
       SET status = 'paid', channel = 'wallet', payer_user_id = v_uid, payer_name = COALESCE(v_name, p.customer_name),
           ican_amount = v_ican, ican_tx_id = NULLIF(v_res ->> 'out_tx_id', '')::UUID,
           paid_ugx = p.amount_ugx, processing_fee_ugx = 0, charge_ugx = p.amount_ugx,
           error = NULL, paid_at = now(), updated_at = now()
     WHERE id = p.id
     RETURNING * INTO p;
    PERFORM public._imc_pay_notify(p);
  EXCEPTION WHEN OTHERS THEN
    -- the whole block rolls back: no half-moved money
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object('success', TRUE, 'status', 'paid') || public._imc_pay_json(p);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7b. What is waiting on the signed-in customer: the store requests the cashier put in THEIR inbox that are still
--     open (not paid, cancelled or expired), newest first. This is what lets a customer who sent someone to the
--     shop pay from home inside Digital City Era. Only the caller's own inbox rows are ever looked at, and a request
--     they deleted from the inbox is not listed. Only what the pay page already shows is returned.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_my_requests()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'tx_ref', q.tx_ref,
           'merchant_name', q.merchant_name,
           'description', q.description,
           'amount_ugx', q.amount_ugx,
           'requested_at', q.requested_at,
           'expires_at', q.expires_at) ORDER BY q.requested_at DESC), '[]'::JSONB)
    INTO v_rows
    FROM (
      SELECT p.tx_ref, p.merchant_name, p.description, p.amount_ugx, p.expires_at, max(n.created_at) AS requested_at
        FROM public.ican_wallet_inbox_notifications n
        JOIN public.icanera_mobile_card_payments p ON p.tx_ref = n.reference_id
       WHERE n.recipient_user_id = v_uid
         AND n.notification_type = 'qr_pos_payment_request'
         AND p.status = 'awaiting_payment'
         AND p.expires_at > now()
       GROUP BY p.tx_ref, p.merchant_name, p.description, p.amount_ugx, p.expires_at
       ORDER BY max(n.created_at) DESC
       LIMIT 10
    ) q;
  RETURN v_rows;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Fulfil — called ONLY by the icanera-mobile-card-pay Edge Function, after Flutterwave itself
--    confirmed the money. Everything in the inner block rolls back on failure and the function
--    then refunds the payer in full.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_fulfil(
  p_tx_ref              TEXT,
  p_flw_transaction_id  TEXT,
  p_paid_ugx            NUMERIC,
  p_channel             TEXT DEFAULT NULL,
  p_payer_name          TEXT DEFAULT NULL,
  p_payer_phone         TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        public.icanera_mobile_card_payments%ROWTYPE;
  v_price  NUMERIC;
  v_ican   NUMERIC;
  v_res    JSONB;
  v_coin   UUID;
  v_err    TEXT;
  v_name   TEXT := left(NULLIF(btrim(COALESCE(p_payer_name, '')), ''), 80);
  v_phone  TEXT := left(NULLIF(btrim(COALESCE(p_payer_phone, '')), ''), 20);
  v_note   TEXT;
BEGIN
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Payment not found');
  END IF;

  IF p.status = 'paid' THEN
    RETURN jsonb_build_object('success', TRUE, 'already_processed', TRUE, 'status', 'paid') || public._imc_pay_json(p);
  END IF;
  IF p.status IN ('failed', 'refunded') THEN
    RETURN jsonb_build_object('success', FALSE, 'status', p.status,
      'error', COALESCE(p.error, 'This payment could not be completed'));
  END IF;
  IF p_paid_ugx IS NULL OR p_paid_ugx < p.charge_ugx - 1 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'The amount paid is less than the amount due');
  END IF;

  BEGIN
    IF p.status = 'cancelled' THEN
      RAISE EXCEPTION 'The cashier cancelled this sale before the payment arrived';
    END IF;
    -- Long after the screen closed nobody is there to hand over the goods: give the money back.
    IF p.expires_at + INTERVAL '30 minutes' < now() THEN
      RAISE EXCEPTION 'This sale expired before the payment arrived';
    END IF;

    v_price := public.public_tx_ican_price_ugx();
    v_ican  := GREATEST(ROUND(p.amount_ugx / v_price, 8), 0.00000001);

    -- Credit the store wallet. buy_ican_coins is service_role-only and its per-reference unique
    -- index (IMC-<tx_ref>) makes a double credit impossible.
    v_res := public.buy_ican_coins(p.recipient_user_id, v_ican, 'digital-city-era', 'IMC-' || p.tx_ref);
    IF NOT COALESCE((v_res ->> 'success')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION '%', COALESCE(v_res ->> 'error', 'Could not credit the store wallet');
    END IF;
    v_coin := NULLIF(v_res ->> 'tx_id', '')::UUID;

    -- A readable line in the store's wallet history instead of the generic "Bought X ICAN".
    IF v_coin IS NOT NULL THEN
      v_note := format('Sale at %s — paid by %s via %s | UGX %s | ref %s',
        COALESCE(p.merchant_name, 'the store'), COALESCE(v_name, p.customer_name, 'a customer'),
        CASE lower(COALESCE(p_channel, ''))
          WHEN 'card' THEN 'card'
          WHEN 'mobilemoneyuganda' THEN 'Mobile Money'
          ELSE 'Flutterwave' END,
        to_char(p.amount_ugx, 'FM999,999,999,990'), p.tx_ref);
      BEGIN
        UPDATE public.ican_coin_transactions SET note = left(v_note, 500) WHERE id = v_coin;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- the label is cosmetic: never block a verified payment over it
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    UPDATE public.icanera_mobile_card_payments
       SET status = 'failed', error = v_err, flw_transaction_id = p_flw_transaction_id,
           paid_ugx = p_paid_ugx, updated_at = now()
     WHERE id = p.id;
    RETURN jsonb_build_object('success', FALSE, 'status', 'failed', 'error', v_err, 'refund_required', TRUE);
  END;

  UPDATE public.icanera_mobile_card_payments
     SET status = 'paid', flw_transaction_id = p_flw_transaction_id, paid_ugx = p_paid_ugx,
         ican_amount = v_ican, ican_tx_id = v_coin, channel = left(NULLIF(btrim(COALESCE(p_channel, '')), ''), 40),
         payer_name = COALESCE(v_name, p.customer_name), payer_phone = COALESCE(v_phone, p.customer_phone),
         error = NULL, paid_at = now(), updated_at = now()
   WHERE id = p.id
   RETURNING * INTO p;

  PERFORM public._imc_pay_notify(p);

  RETURN jsonb_build_object('success', TRUE, 'status', 'paid') || public._imc_pay_json(p);
END;
$$;

CREATE OR REPLACE FUNCTION public.imc_pay_mark_refunded(p_tx_ref TEXT, p_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.icanera_mobile_card_payments
     SET status = 'refunded', refund_note = p_note, updated_at = now()
   WHERE tx_ref = p_tx_ref AND status IN ('failed', 'awaiting_payment', 'cancelled');
$$;

-- ----------------------------------------------------------------------------
-- 9. Gate for the Mobile Money prompt — called ONLY by the Edge Function, with the user id it took from the
--    caller's verified session. Only the cashier who opened the charge (or the store owner) may send a
--    prompt, only while the sale is open, and only a few times per sale, so this cannot be used to spam a phone.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.imc_pay_begin_momo(p_tx_ref TEXT, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.icanera_mobile_card_payments%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.icanera_mobile_card_payments WHERE tx_ref = p_tx_ref FOR UPDATE;
  IF NOT FOUND OR p_user_id IS NULL
     OR (p.created_by IS DISTINCT FROM p_user_id AND p.recipient_user_id IS DISTINCT FROM p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Payment not found');
  END IF;
  IF p.status <> 'awaiting_payment' OR p.expires_at <= now() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'This sale is no longer open for payment');
  END IF;
  IF p.momo_requests >= 4 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'The Mobile Money prompt was already sent 4 times for this sale — start the sale again or use another way to pay');
  END IF;
  UPDATE public.icanera_mobile_card_payments
     SET momo_requests = momo_requests + 1, updated_at = now() WHERE id = p.id;
  RETURN jsonb_build_object('success', TRUE, 'charge_ugx', p.charge_ugx, 'merchant_name', p.merchant_name);
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Who may call what
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.imc_pay_create(UUID, NUMERIC, TEXT, TEXT, TEXT)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.imc_pay_info(TEXT)                                              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.imc_pay_status(TEXT)                                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.imc_pay_cancel(TEXT)                                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.imc_pay_request_wallet(TEXT, UUID)                              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.imc_pay_wallet(TEXT)                                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.imc_pay_my_requests()                                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.imc_pay_fulfil(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.imc_pay_mark_refunded(TEXT, TEXT)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.imc_pay_begin_momo(TEXT, UUID)                                  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.imc_pay_create(UUID, NUMERIC, TEXT, TEXT, TEXT)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.imc_pay_info(TEXT)                                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.imc_pay_status(TEXT)                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.imc_pay_cancel(TEXT)                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.imc_pay_request_wallet(TEXT, UUID)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.imc_pay_wallet(TEXT)                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.imc_pay_my_requests()                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.imc_pay_fulfil(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT)        TO service_role;
GRANT EXECUTE ON FUNCTION public.imc_pay_mark_refunded(TEXT, TEXT)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.imc_pay_begin_momo(TEXT, UUID)                               TO service_role;

RESET lock_timeout;

-- Force PostgREST to pick up the new functions immediately.
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ IcanEra Mobile / Card payments are ready in the database. Last step: deploy the icanera-mobile-card-pay Edge Function (ICAN repo, backend/components/supabase/functions).';
END $$;
