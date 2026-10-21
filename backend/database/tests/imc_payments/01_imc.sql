-- Behaviour tests for ADD_ICAN_MOBILE_CARD_PAYMENTS.sql. Run through run.sh (needs 00_stub.sql and the migration applied).
\set ON_ERROR_STOP on

-- ── cast ────────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'owner@store.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'cashier@store.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'customer@x.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'other@x.test');
INSERT INTO public.supermarkets (id, name, owner_user_id) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'Kampala Fresh', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', 'No Wallet Store', NULL);
INSERT INTO public.user_accounts (user_id, account_number, phone_number, account_holder_name) VALUES
  ('00000000-0000-0000-0000-0000000000a3', '1234567890123456', '0772123456', 'Jane Kato');
SELECT public.get_or_create_ican_wallet('00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.ican_user_wallets (user_id, ican_balance) VALUES ('00000000-0000-0000-0000-0000000000a3', 10);

CREATE FUNCTION t.charge(p_amount NUMERIC DEFAULT 10000) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', p_amount, 'Basket');
  RETURN r ->> 'tx_ref';
END $$;

-- ── 1. creating a charge ────────────────────────────────────────────────────
DO $$
DECLARE r JSONB; ref TEXT;
BEGIN
  PERFORM t.as_user(NULL);
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 10000);
  PERFORM t.check('create: refuses a caller who is not signed in', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 499);
  PERFORM t.check('create: refuses under UGX 500', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 5000001);
  PERFORM t.check('create: refuses over UGX 5,000,000', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000f9', 10000);
  PERFORM t.check('create: refuses an unknown store', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b2', 10000);
  PERFORM t.check('create: refuses a store with no wallet owner', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 10000.4, 'Basket of 3');
  PERFORM t.check('create: succeeds', (r ->> 'success')::BOOLEAN, r::TEXT);
  PERFORM t.check('create: reference looks like IMC-<20 chars>', (r ->> 'tx_ref') ~ '^IMC-[A-Z0-9]{20}$', r ->> 'tx_ref');
  PERFORM t.check('create: amount rounds up to a whole shilling', (r ->> 'amount_ugx')::NUMERIC = 10001, r::TEXT);
  -- 10001 / (1 - 0.035) = 10363.7 -> rounded UP to the next 100 = 10400
  PERFORM t.check('create: charge adds the fee, rounded up to 100', (r ->> 'charge_ugx')::NUMERIC = 10400, r::TEXT);
  PERFORM t.check('create: fee is charge minus amount', (r ->> 'processing_fee_ugx')::NUMERIC = 399, r::TEXT);
  PERFORM t.check('create: recipient is the store OWNER, not the cashier',
    (SELECT recipient_user_id FROM public.icanera_mobile_card_payments WHERE tx_ref = r ->> 'tx_ref') = '00000000-0000-0000-0000-0000000000a1', NULL);
END $$;

-- ── 2. who may call what ────────────────────────────────────────────────────
DO $$
DECLARE ref TEXT := t.charge(); denied BOOLEAN; r JSONB;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 10000); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('grants: anon cannot open a charge', denied);
  BEGIN PERFORM public.imc_pay_wallet(ref); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('grants: anon cannot pay from a wallet', denied);
  BEGIN PERFORM public.imc_pay_status(ref); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('grants: anon cannot read the till status', denied);
  r := public.imc_pay_info(ref);
  PERFORM t.check('grants: anon CAN read the pay page info', (r ->> 'found')::BOOLEAN AND (r ->> 'payable')::BOOLEAN, r::TEXT);
  PERFORM t.check('info: shows store, amount and charge, never who opened it',
    r ->> 'merchant_name' = 'Kampala Fresh' AND (r ->> 'charge_ugx')::NUMERIC = 10400 AND NOT (r ? 'created_by') AND NOT (r ? 'recipient_user_id'), r::TEXT);

  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.imc_pay_fulfil(ref, 'x', 10400); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('grants: a signed-in user cannot fulfil a charge', denied);
  BEGIN PERFORM public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a2'); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('grants: a signed-in user cannot call the Mobile Money gate directly', denied);
  BEGIN PERFORM public.imc_pay_mark_refunded(ref); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('grants: a signed-in user cannot mark a refund', denied);
  BEGIN PERFORM * FROM public.icanera_mobile_card_payments LIMIT 1; denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('grants: the table itself is closed to the browser', denied);
  RESET ROLE;
END $$;

-- ── 3. Flutterwave fulfilment credits the store exactly once ────────────────
DO $$
DECLARE ref TEXT := t.charge(10000); r JSONB; bal NUMERIC; n INT; note TEXT;
BEGIN
  r := public.imc_pay_fulfil(ref, 'FLW1', 9000, 'card');
  PERFORM t.check('fulfil: refuses an underpayment', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  SELECT ican_balance INTO bal FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
  PERFORM t.check('fulfil: underpayment credits nothing', bal = 0, bal::TEXT);

  r := public.imc_pay_fulfil(ref, 'FLW1', 10400, 'mobilemoneyuganda', 'Jane Kato', '256772123456');
  PERFORM t.check('fulfil: succeeds', (r ->> 'success')::BOOLEAN AND r ->> 'status' = 'paid', r::TEXT);
  SELECT ican_balance INTO bal FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
  PERFORM t.check('fulfil: store wallet gets the FULL sale (10,000 / 5,000 = 2 ICAN), not the fee', bal = 2, bal::TEXT);
  PERFORM t.check('fulfil: payload carries payer, channel, ICAN and ledger id',
    r ->> 'payer_name' = 'Jane Kato' AND r ->> 'channel' = 'mobilemoneyuganda' AND (r ->> 'ican_amount')::NUMERIC = 2 AND (r ->> 'ican_tx_id') IS NOT NULL, r::TEXT);
  SELECT c.note INTO note FROM public.ican_coin_transactions c WHERE c.id = (r ->> 'ican_tx_id')::UUID;
  PERFORM t.check('fulfil: wallet history reads like a sale, not "Bought X ICAN"',
    note LIKE 'Sale at Kampala Fresh — paid by Jane Kato via Mobile Money%', note);

  r := public.imc_pay_fulfil(ref, 'FLW1', 10400, 'mobilemoneyuganda');
  PERFORM t.check('fulfil: a second call is a harmless repeat', (r ->> 'success')::BOOLEAN AND (r ->> 'already_processed')::BOOLEAN, r::TEXT);
  SELECT ican_balance INTO bal FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
  SELECT count(*) INTO n FROM public.ican_coin_transactions WHERE reference_id = 'IMC-' || ref;
  PERFORM t.check('fulfil: never credits twice', bal = 2 AND n = 1, format('bal=%s rows=%s', bal, n));

  -- the live price moves: the store still receives the sale's VALUE
  UPDATE public.stub_price SET ugx = 6250;
  ref := t.charge(12500);
  r := public.imc_pay_fulfil(ref, 'FLW2', 13000, 'card');
  PERFORM t.check('fulfil: priced at the LIVE value (12,500 / 6,250 = 2 ICAN)', (r ->> 'ican_amount')::NUMERIC = 2, r::TEXT);
  UPDATE public.stub_price SET ugx = 5000;
END $$;

-- ── 4. a payment that can't be applied is refunded, with nothing credited ───
DO $$
DECLARE ref TEXT; r JSONB; bal_before NUMERIC; bal_after NUMERIC;
BEGIN
  SELECT ican_balance INTO bal_before FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a1';

  ref := t.charge();
  PERFORM public.imc_pay_cancel(ref);
  r := public.imc_pay_fulfil(ref, 'FLW3', 10400, 'card');
  PERFORM t.check('cancelled: a late payment is marked for refund', NOT (r ->> 'success')::BOOLEAN AND (r ->> 'refund_required')::BOOLEAN, r::TEXT);
  PERFORM t.check('cancelled: and the charge shows failed until refunded',
    (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'failed', NULL);
  PERFORM public.imc_pay_mark_refunded(ref, 'refund requested');
  PERFORM t.check('cancelled: mark_refunded closes it', (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'refunded', NULL);
  r := public.imc_pay_fulfil(ref, 'FLW3', 10400, 'card');
  PERFORM t.check('cancelled: a refunded charge never pays out afterwards', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  ref := t.charge();
  UPDATE public.icanera_mobile_card_payments SET expires_at = now() - INTERVAL '2 hours' WHERE tx_ref = ref;
  r := public.imc_pay_fulfil(ref, 'FLW4', 10400, 'card');
  PERFORM t.check('expired long ago: payment is refunded, not credited', NOT (r ->> 'success')::BOOLEAN AND (r ->> 'refund_required')::BOOLEAN, r::TEXT);

  ref := t.charge();
  UPDATE public.icanera_mobile_card_payments SET expires_at = now() - INTERVAL '5 minutes' WHERE tx_ref = ref;
  r := public.imc_pay_fulfil(ref, 'FLW5', 10400, 'card');
  PERFORM t.check('just expired (mobile money approved a moment late): still honoured', (r ->> 'success')::BOOLEAN, r::TEXT);
  -- keep the books easy to read below
  SELECT ican_balance INTO bal_after FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
  PERFORM t.check('refunded payments credited nothing; only the honoured one did', bal_after - bal_before = 2, format('%s -> %s', bal_before, bal_after));
END $$;

-- ── 5. the till's view ──────────────────────────────────────────────────────
DO $$
DECLARE ref TEXT := t.charge(); r JSONB;
BEGIN
  r := public.imc_pay_status(ref);
  PERFORM t.check('status: the cashier sees it waiting', (r ->> 'found')::BOOLEAN AND r ->> 'status' = 'awaiting_payment', r::TEXT);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a4');
  r := public.imc_pay_status(ref);
  PERFORM t.check('status: a stranger sees nothing', NOT (r ->> 'found')::BOOLEAN, r::TEXT);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a1');
  r := public.imc_pay_status(ref);
  PERFORM t.check('status: the store owner can see it', (r ->> 'found')::BOOLEAN, r::TEXT);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  PERFORM public.imc_pay_fulfil(ref, 'FLW6', 10400, 'card', 'Jane Kato');
  r := public.imc_pay_status(ref);
  PERFORM t.check('status: once paid it carries the receipt details', r ->> 'status' = 'paid' AND r ->> 'payer_name' = 'Jane Kato' AND (r ->> 'ican_tx_id') IS NOT NULL, r::TEXT);
  UPDATE public.icanera_mobile_card_payments SET expires_at = now() - INTERVAL '1 minute' WHERE tx_ref = t.charge();
END $$;

-- ── 6. the customer pays from their IcanEra wallet ──────────────────────────
DO $$
DECLARE ref TEXT := t.charge(10000); r JSONB; store_before NUMERIC; store_after NUMERIC; payer_after NUMERIC;
BEGIN
  SELECT ican_balance INTO store_before FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a1';

  PERFORM t.as_user(NULL);
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('wallet: needs a signed-in payer', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a1');
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('wallet: the store cannot pay itself', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_wallet('IMC-NOTAREALREFERENCE00');
  PERFORM t.check('wallet: refuses a malformed reference', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a4');           -- has no wallet at all
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('wallet: a payer with no wallet is refused and the sale stays open',
    NOT (r ->> 'success')::BOOLEAN AND (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'awaiting_payment', r::TEXT);

  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a3');
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('wallet: succeeds for a customer with funds', (r ->> 'success')::BOOLEAN AND r ->> 'status' = 'paid', r::TEXT);
  SELECT ican_balance INTO store_after FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a1';
  SELECT ican_balance INTO payer_after FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a3';
  PERFORM t.check('wallet: the store receives exactly 2 ICAN, with no fee taken', store_after - store_before = 2, format('%s -> %s', store_before, store_after));
  PERFORM t.check('wallet: the customer is debited exactly that', payer_after = 8, payer_after::TEXT);
  PERFORM t.check('wallet: the sale records channel, payer and zero fee',
    r ->> 'channel' = 'wallet' AND r ->> 'payer_name' = 'Jane Kato' AND (r ->> 'processing_fee_ugx')::NUMERIC = 0 AND (r ->> 'charged_ugx')::NUMERIC = 10000, r::TEXT);
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('wallet: paying twice is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  SELECT ican_balance INTO payer_after FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a3';
  PERFORM t.check('wallet: and the customer was not charged twice', payer_after = 8, payer_after::TEXT);
  r := public.imc_pay_fulfil(ref, 'FLW7', 10400, 'card');
  PERFORM t.check('wallet: a card payment arriving for an already wallet-paid sale is a repeat, never a double credit',
    (r ->> 'success')::BOOLEAN AND (r ->> 'already_processed')::BOOLEAN, r::TEXT);

  -- insufficient funds leaves everything untouched
  ref := t.charge(100000);                                             -- 20 ICAN > the customer's 8
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a3');
  r := public.imc_pay_wallet(ref);
  SELECT ican_balance INTO payer_after FROM public.ican_user_wallets WHERE user_id = '00000000-0000-0000-0000-0000000000a3';
  PERFORM t.check('wallet: insufficient funds is refused with the reason, nothing moves',
    NOT (r ->> 'success')::BOOLEAN AND r ->> 'error' ILIKE 'Insufficient%' AND payer_after = 8
    AND (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'awaiting_payment', r::TEXT);

  -- a cancelled or expired sale cannot be paid
  ref := t.charge();
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  PERFORM public.imc_pay_cancel(ref);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a3');
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('wallet: a cancelled sale cannot be paid', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  ref := t.charge();
  UPDATE public.icanera_mobile_card_payments SET expires_at = now() - INTERVAL '1 minute' WHERE tx_ref = ref;
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a3');
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('wallet: an expired sale cannot be paid', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
END $$;

-- ── 7. asking a customer who is away (wallet inbox) ─────────────────────────
DO $$
DECLARE ref TEXT := t.charge(); r JSONB; n INT; m JSONB;
BEGIN
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a4');
  r := public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a3');
  PERFORM t.check('request: a stranger cannot send requests for someone else''s sale', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a1');
  PERFORM t.check('request: cannot be sent to the store''s own wallet', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000f9');
  PERFORM t.check('request: cannot be sent to a user with no IcanEra account', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  r := public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a3');
  PERFORM t.check('request: reaches the customer''s inbox', (r ->> 'success')::BOOLEAN, r::TEXT);
  SELECT metadata INTO m FROM public.ican_wallet_inbox_notifications
   WHERE recipient_user_id = '00000000-0000-0000-0000-0000000000a3' AND notification_type = 'qr_pos_payment_request';
  PERFORM t.check('request: the inbox link is built from CONFIG, not from the caller',
    m ->> 'pay_url' = 'https://supermartkera.icanera.space/mobile-pay/' || ref, m::TEXT);
  PERFORM t.check('request: the inbox message names the store and the amount',
    (SELECT message FROM public.ican_wallet_inbox_notifications WHERE notification_type = 'qr_pos_payment_request' LIMIT 1) LIKE 'Kampala Fresh is asking for UGX 10,000%', NULL);

  PERFORM public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a3');
  PERFORM public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a3');
  r := public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a3');
  PERFORM t.check('request: capped at 3 per sale so a customer cannot be spammed', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  SELECT count(*) INTO n FROM public.ican_wallet_inbox_notifications WHERE notification_type = 'qr_pos_payment_request';
  PERFORM t.check('request: exactly 3 messages were delivered', n = 3, n::TEXT);

  -- a configured base that is not a plain https origin is never used (no path/query tricks)
  UPDATE public.guest_checkout_config SET value = 'https://evil.example/phish?x=' WHERE key = 'pos_pay_base_url';
  ref := t.charge();
  r := public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a3');
  SELECT metadata INTO m FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref;
  PERFORM t.check('request: a malformed configured origin yields NO link rather than a bad one', (r ->> 'success')::BOOLEAN AND m ->> 'pay_url' IS NULL, m::TEXT);
  UPDATE public.guest_checkout_config SET value = 'https://supermartkera.icanera.space' WHERE key = 'pos_pay_base_url';

  -- a sale that is no longer open cannot be requested
  ref := t.charge();
  PERFORM public.imc_pay_cancel(ref);
  r := public.imc_pay_request_wallet(ref, '00000000-0000-0000-0000-0000000000a3');
  PERFORM t.check('request: a cancelled sale cannot be requested', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
END $$;

-- ── 8. the Mobile Money prompt gate ─────────────────────────────────────────
DO $$
DECLARE ref TEXT := t.charge(); r JSONB; i INT;
BEGIN
  r := public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a4');
  PERFORM t.check('momo gate: a stranger cannot send a prompt', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_begin_momo(ref, NULL);
  PERFORM t.check('momo gate: needs a verified user id', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a2');
  PERFORM t.check('momo gate: the cashier who opened the sale may', (r ->> 'success')::BOOLEAN AND (r ->> 'charge_ugx')::NUMERIC = 10400, r::TEXT);
  r := public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a1');
  PERFORM t.check('momo gate: so may the store owner', (r ->> 'success')::BOOLEAN, r::TEXT);
  PERFORM public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a2');
  PERFORM public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a2');
  r := public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a2');
  PERFORM t.check('momo gate: capped at 4 prompts per sale', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  ref := t.charge();
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  PERFORM public.imc_pay_cancel(ref);
  r := public.imc_pay_begin_momo(ref, '00000000-0000-0000-0000-0000000000a2');
  PERFORM t.check('momo gate: no prompt for a cancelled sale', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
END $$;

-- ── 9. cancel ───────────────────────────────────────────────────────────────
DO $$
DECLARE ref TEXT := t.charge(); r JSONB;
BEGIN
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a4');
  r := public.imc_pay_cancel(ref);
  PERFORM t.check('cancel: a stranger cannot cancel', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  r := public.imc_pay_cancel(ref);
  PERFORM t.check('cancel: the cashier can', (r ->> 'success')::BOOLEAN AND r ->> 'status' = 'cancelled', r::TEXT);
  PERFORM public.imc_pay_fulfil(ref, 'x', 10400);
  ref := t.charge();
  PERFORM public.imc_pay_fulfil(ref, 'FLW8', 10400, 'card');
  r := public.imc_pay_cancel(ref);
  PERFORM t.check('cancel: a paid sale is left paid', r ->> 'status' = 'paid', r::TEXT);
  r := public.imc_pay_info(ref);
  PERFORM t.check('info: shows a paid sale as paid and not payable', r ->> 'status' = 'paid' AND NOT (r ->> 'payable')::BOOLEAN, r::TEXT);
  r := public.imc_pay_info('IMC-DOESNOTEXIST000000');
  PERFORM t.check('info: an unknown link is simply not found', NOT (r ->> 'found')::BOOLEAN, r::TEXT);
END $$;

-- ── 10. per-cashier cap ─────────────────────────────────────────────────────
DO $$
DECLARE r JSONB; i INT;
BEGIN
  DELETE FROM public.icanera_mobile_card_payments WHERE status = 'awaiting_payment';
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a2');
  FOR i IN 1..20 LOOP PERFORM public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 1000); END LOOP;
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 1000);
  PERFORM t.check('cap: the 21st open sale in an hour by one cashier is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a4');
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 1000);
  PERFORM t.check('cap: one cashier''s cap does not lock the store for others', (r ->> 'success')::BOOLEAN, r::TEXT);
END $$;

-- ── 11. a paid sale is announced by ONE pushed notification, never by anything else ─────────────────
DO $$
DECLARE ref TEXT; r JSONB; n INT; m JSONB; ttl TEXT; msg TEXT;
BEGIN
  DELETE FROM public.ican_wallet_inbox_notifications;
  DELETE FROM public.icanera_mobile_card_payments WHERE status = 'awaiting_payment'; -- the cap section above filled a2's quota

  ref := t.charge(10000);
  PERFORM public.imc_pay_fulfil(ref, 'FLWN1', 10400, 'mobilemoneyuganda', 'Jane Kato', '0772123456');
  SELECT count(*) INTO n FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref AND notification_type = 'qr_pos_payment_received';
  PERFORM t.check('push: a paid sale writes one inbox row (the push relay delivers it) for the cashier AND the store owner', n = 2, n::TEXT);
  SELECT title, message, metadata INTO ttl, msg, m FROM public.ican_wallet_inbox_notifications
   WHERE reference_id = ref AND recipient_user_id = '00000000-0000-0000-0000-0000000000a2';
  PERFORM t.check('push: the cashier is told who paid, how much, how and where', ttl = 'Payment received: UGX 10,000' AND msg LIKE 'Jane Kato paid UGX 10,000 by Mobile Money at Kampala Fresh.%' AND msg LIKE '%' || ref, ttl || ' | ' || msg);
  PERFORM t.check('push: tapping the cashier''s push opens the till, not the admin page', m ->> 'push_path' = '/cashier-portal', m::TEXT);
  SELECT metadata INTO m FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref AND recipient_user_id = '00000000-0000-0000-0000-0000000000a1';
  PERFORM t.check('push: the owner''s push has no path override (the relay''s default applies)', NOT (m ? 'push_path'), m::TEXT);
  PERFORM t.check('push: the row is deliverable as a push (type qr_*, satisfies the inbox constraint)',
    (SELECT count(*) FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref AND notification_type LIKE 'qr\_%') = 2);

  PERFORM public.imc_pay_fulfil(ref, 'FLWN1', 10400, 'mobilemoneyuganda');
  SELECT count(*) INTO n FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref;
  PERFORM t.check('push: a repeated confirmation does not push again', n = 2, n::TEXT);

  -- a wallet payment announces itself the same way
  ref := t.charge(10000);
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a3');
  r := public.imc_pay_wallet(ref);
  PERFORM t.check('push: (the wallet payment itself still works)', (r ->> 'success')::BOOLEAN, r::TEXT);
  SELECT message INTO msg FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref AND recipient_user_id = '00000000-0000-0000-0000-0000000000a2';
  PERFORM t.check('push: a wallet payment is announced as paid from the wallet', msg LIKE 'Jane Kato paid UGX 10,000 by their IcanEra wallet at Kampala Fresh.%', msg);

  -- the owner ringing up their own sale gets exactly one, and it opens the till
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000a1');
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000b1', 5000, 'Owner sale');
  ref := r ->> 'tx_ref';
  PERFORM public.imc_pay_fulfil(ref, 'FLWN2', 5200, 'card', 'Walk In');
  SELECT count(*) INTO n FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref;
  SELECT metadata INTO m FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref;
  PERFORM t.check('push: when the owner is also the cashier there is one push, to the till', n = 1 AND m ->> 'push_path' = '/cashier-portal', n || ' ' || m::TEXT);

  -- nothing is pushed for a payment that was refused or refunded
  DELETE FROM public.ican_wallet_inbox_notifications;
  ref := t.charge(10000);
  PERFORM public.imc_pay_fulfil(ref, 'FLWN3', 9000, 'card');
  PERFORM public.imc_pay_cancel(ref);
  PERFORM public.imc_pay_fulfil(ref, 'FLWN3', 10400, 'card');
  SELECT count(*) INTO n FROM public.ican_wallet_inbox_notifications;
  PERFORM t.check('push: no announcement for an underpayment or a refunded payment', n = 0, n::TEXT);

  -- the inbox being unavailable must never block money
  ALTER TABLE public.ican_wallet_inbox_notifications RENAME TO ican_wallet_inbox_notifications_off;
  ref := t.charge(10000);
  r := public.imc_pay_fulfil(ref, 'FLWN4', 10400, 'card', 'Jane Kato');
  PERFORM t.check('push: with the inbox missing, the payment is still credited', (r ->> 'success')::BOOLEAN AND (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'paid', r::TEXT);
  ALTER TABLE public.ican_wallet_inbox_notifications_off RENAME TO ican_wallet_inbox_notifications;
END $$;
