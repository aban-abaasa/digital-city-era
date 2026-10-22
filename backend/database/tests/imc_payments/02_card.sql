-- Behaviour tests for ADD_ICAN_CARD_POS_PAYMENTS.sql. Run through run.sh (needs 00_stub.sql, 00b_card_stub.sql and both
-- migrations applied). Uses its own people and store so it does not depend on what 01_imc.sql left behind.
\set ON_ERROR_STOP on

-- ── cast ────────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'owner@card.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'cashier@card.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'holder@card.test'),
  ('00000000-0000-0000-0000-0000000000c4', 'othercashier@card.test'),
  ('00000000-0000-0000-0000-0000000000c5', 'broke@card.test');
INSERT INTO public.supermarkets (id, name, owner_user_id) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'Card Corner', '00000000-0000-0000-0000-0000000000c1');
INSERT INTO public.user_accounts (user_id, account_number, phone_number, account_holder_name) VALUES
  ('00000000-0000-0000-0000-0000000000c3', '9999999999999999', '0782000111', 'Mary Nakato');
INSERT INTO public.ican_user_wallets (user_id, ican_balance) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 0),
  ('00000000-0000-0000-0000-0000000000c3', 10),
  ('00000000-0000-0000-0000-0000000000c5', 0.5);
UPDATE public.stub_price SET ugx = 5000;
DELETE FROM public.ican_wallet_inbox_notifications;

CREATE FUNCTION t.card_charge(p_amount NUMERIC DEFAULT 10000) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000c2');
  r := public.imc_pay_create('00000000-0000-0000-0000-0000000000d1', p_amount, 'Basket');
  RETURN r ->> 'tx_ref';
END $$;

CREATE FUNCTION t.bal(p_user UUID) RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT COALESCE((SELECT ican_balance FROM public.ican_user_wallets WHERE user_id = p_user), 0) $$;

-- ── 1. who may call what ────────────────────────────────────────────────────
DO $$
DECLARE ref TEXT := t.card_charge(); denied BOOLEAN;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3'); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('card grants: anon cannot call the gate', denied);
  BEGIN PERFORM public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '1234'); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('card grants: anon cannot take a card payment', denied);

  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3'); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('card grants: a signed-in user cannot call the gate (it skips the PIN check)', denied);
  BEGIN PERFORM public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '1234'); denied := FALSE;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  PERFORM t.check('card grants: a signed-in user cannot take a card payment (it skips the PIN check)', denied);
  RESET ROLE;

  SET LOCAL ROLE service_role;
  PERFORM public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('card grants: the service role can', TRUE);
  RESET ROLE;
END $$;

-- ── 2. the gate ─────────────────────────────────────────────────────────────
DO $$
DECLARE ref TEXT := t.card_charge(10000); r JSONB; i INT;
BEGIN
  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: the cashier who opened the sale may start a card payment', (r ->> 'success')::BOOLEAN, r::TEXT);
  PERFORM t.check('gate: it hands back the sale, not anything the caller sent',
    (r ->> 'amount_ugx')::NUMERIC = 10000 AND r ->> 'merchant_name' = 'Card Corner', r::TEXT);

  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: the store owner may too', (r ->> 'success')::BOOLEAN, r::TEXT);

  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: another cashier cannot touch this sale', NOT (r ->> 'success')::BOOLEAN AND r ->> 'error' = 'Payment not found', r::TEXT);
  r := public.imc_card_begin(ref, NULL, '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: no caller, no go', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_card_begin('IMC-DOESNOTEXIST000000', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: an unknown sale is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1');
  PERFORM t.check('gate: the store''s own card cannot pay its own sale', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', NULL);
  PERFORM t.check('gate: a card with no holder is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  -- 2 tries so far (cashier + owner); three more are allowed, then the sale is shut to cards
  FOR i IN 1..3 LOOP
    r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
    PERFORM t.check('gate: try ' || (i + 2) || ' of 5 is allowed', (r ->> 'success')::BOOLEAN, r::TEXT);
  END LOOP;
  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: the 6th try on one sale is refused (caps PIN guessing)', NOT (r ->> 'success')::BOOLEAN AND r ->> 'error' LIKE 'Too many card tries%', r::TEXT);
  PERFORM t.check('gate: and the count is kept on the sale',
    (SELECT card_attempts FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 5, NULL);

  -- closed sales
  ref := t.card_charge();
  PERFORM public.imc_pay_cancel(ref);
  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: a cancelled sale is closed', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  ref := t.card_charge();
  UPDATE public.icanera_mobile_card_payments SET expires_at = now() - INTERVAL '1 minute' WHERE tx_ref = ref;
  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('gate: an expired sale is closed', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
END $$;

-- ── 3. paying with the card ─────────────────────────────────────────────────
DO $$
DECLARE
  ref TEXT := t.card_charge(10000); r JSONB;
  store_before NUMERIC := t.bal('00000000-0000-0000-0000-0000000000c1');
  payer_before NUMERIC := t.bal('00000000-0000-0000-0000-0000000000c3');
  row_ public.icanera_mobile_card_payments%ROWTYPE; n INT; st JSONB;
BEGIN
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('pay: succeeds for a holder with funds', (r ->> 'success')::BOOLEAN AND r ->> 'status' = 'paid', r::TEXT);
  PERFORM t.check('pay: the store gets exactly 2 ICAN (10,000 / 5,000), no fee',
    t.bal('00000000-0000-0000-0000-0000000000c1') - store_before = 2, (t.bal('00000000-0000-0000-0000-0000000000c1') - store_before)::TEXT);
  PERFORM t.check('pay: the holder is debited exactly that', payer_before - t.bal('00000000-0000-0000-0000-0000000000c3') = 2, NULL);

  SELECT * INTO row_ FROM public.icanera_mobile_card_payments WHERE tx_ref = ref;
  PERFORM t.check('pay: booked as a wallet payment with zero fee',
    row_.status = 'paid' AND row_.channel = 'wallet' AND row_.processing_fee_ugx = 0 AND row_.charge_ugx = 10000 AND row_.paid_ugx = 10000, row_::TEXT);
  PERFORM t.check('pay: remembers the payer, the card and the coins',
    row_.payer_user_id = '00000000-0000-0000-0000-0000000000c3' AND row_.payer_name = 'Mary Nakato'
    AND row_.card_last4 = '4321' AND row_.ican_amount = 2 AND row_.ican_tx_id IS NOT NULL, row_::TEXT);
  PERFORM t.check('pay: the result carries what the till needs',
    r ->> 'channel' = 'wallet' AND r ->> 'payer_name' = 'Mary Nakato' AND (r ->> 'amount_ugx')::NUMERIC = 10000 AND r ->> 'ican_tx_id' IS NOT NULL, r::TEXT);
  PERFORM t.check('pay: the coin ledger line says it was a digital card sale',
    (SELECT note FROM public.ican_coin_transactions WHERE id = row_.ican_tx_id) LIKE '%Card Corner%digital card 4321%' , (SELECT note FROM public.ican_coin_transactions WHERE id = row_.ican_tx_id));

  -- the till sees it through the same status call every other payment uses
  PERFORM t.as_user('00000000-0000-0000-0000-0000000000c2');
  st := public.imc_pay_status(ref);
  PERFORM t.check('pay: the till''s polling sees the sale as paid', (st ->> 'found')::BOOLEAN AND st ->> 'status' = 'paid' AND st ->> 'channel' = 'wallet', st::TEXT);

  -- notifications: cashier + owner as for any paid sale, and the holder is told what was taken
  SELECT count(*) INTO n FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref AND notification_type = 'qr_pos_payment_received';
  PERFORM t.check('pay: the cashier and the store owner each get the payment push', n = 2, n::TEXT);
  PERFORM t.check('pay: the cashier''s push opens the till',
    (SELECT metadata ->> 'push_path' FROM public.ican_wallet_inbox_notifications
      WHERE reference_id = ref AND recipient_user_id = '00000000-0000-0000-0000-0000000000c2') = '/cashier-portal', NULL);
  PERFORM t.check('pay: the card holder is told what was taken and from which card',
    (SELECT message FROM public.ican_wallet_inbox_notifications
      WHERE reference_id = ref AND recipient_user_id = '00000000-0000-0000-0000-0000000000c3' AND notification_type = 'qr_pos_card_payment')
    LIKE 'You paid UGX 10,000 at Card Corner with your IcanEra digital card ending 4321%', NULL);

  -- once is enough
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('pay: paying a paid sale again is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  PERFORM t.check('pay: and the holder was not charged twice', payer_before - t.bal('00000000-0000-0000-0000-0000000000c3') = 2, NULL);
  PERFORM t.check('pay: nor the store credited twice', t.bal('00000000-0000-0000-0000-0000000000c1') - store_before = 2, NULL);
  r := public.imc_card_begin(ref, '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  PERFORM t.check('pay: a paid sale is closed to another card try', NOT (r ->> 'success')::BOOLEAN AND r ->> 'error' = 'This sale has already been paid', r::TEXT);
END $$;

DO $$
DECLARE
  ref TEXT; r JSONB;
  store_before NUMERIC := t.bal('00000000-0000-0000-0000-0000000000c1');
  holder_before NUMERIC := t.bal('00000000-0000-0000-0000-0000000000c3');
BEGIN
  -- not enough coins: refused with the reason, the sale stays open for another way to pay, nothing moves
  ref := t.card_charge(10000);
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c5', '1111');
  PERFORM t.check('pay: not enough coins is refused with the reason', NOT (r ->> 'success')::BOOLEAN AND r ->> 'error' LIKE 'Insufficient%', r::TEXT);
  PERFORM t.check('pay: the sale stays open and unpaid', (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'awaiting_payment', NULL);
  PERFORM t.check('pay: nothing moved', t.bal('00000000-0000-0000-0000-0000000000c5') = 0.5 AND t.bal('00000000-0000-0000-0000-0000000000c1') = store_before, NULL);
  PERFORM t.check('pay: no payment push for a refused card',
    (SELECT count(*) FROM public.ican_wallet_inbox_notifications WHERE reference_id = ref) = 0, NULL);
  -- ... and the same sale can still be paid by a card that has the money
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('pay: the same sale can then be paid by another card', (r ->> 'success')::BOOLEAN, r::TEXT);

  -- a holder with no wallet row at all
  ref := t.card_charge(10000);
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c4', '2222');
  PERFORM t.check('pay: a holder with no wallet is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  -- cancelled / expired / malformed / the store itself / nobody
  ref := t.card_charge();
  PERFORM public.imc_pay_cancel(ref);
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('pay: a cancelled sale cannot be paid', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  ref := t.card_charge();
  UPDATE public.icanera_mobile_card_payments SET expires_at = now() - INTERVAL '1 second' WHERE tx_ref = ref;
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('pay: an expired sale cannot be paid', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_with_card('IMC-NOTAREALREFERENCE00', '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('pay: a malformed reference is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_with_card(NULL, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('pay: no reference is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  ref := t.card_charge();
  r := public.imc_pay_with_card(ref, NULL, '4321');
  PERFORM t.check('pay: no holder is refused', NOT (r ->> 'success')::BOOLEAN, r::TEXT);
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c1', '4321');
  PERFORM t.check('pay: the store''s own wallet cannot pay its own sale', NOT (r ->> 'success')::BOOLEAN, r::TEXT);

  -- the live price rounds UP, so the store never gets less than the sale is worth
  UPDATE public.stub_price SET ugx = 7000;
  ref := t.card_charge(10001);
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('price: 10,001 at UGX 7,000/ICAN costs 1.42871429 ICAN (rounded up to 8 places)',
    (r ->> 'success')::BOOLEAN AND (r ->> 'ican_amount')::NUMERIC = 1.42871429, r::TEXT);

  -- no live price: refused, nothing moves
  ref := t.card_charge(10000);
  UPDATE public.stub_price SET ugx = 0;
  holder_before := t.bal('00000000-0000-0000-0000-0000000000c3');
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('price: with no live price the payment is refused and nothing moves',
    NOT (r ->> 'success')::BOOLEAN AND t.bal('00000000-0000-0000-0000-0000000000c3') = holder_before
    AND (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'awaiting_payment', r::TEXT);
  UPDATE public.stub_price SET ugx = 5000;

  -- the holder's inbox being unavailable must never block money
  ALTER TABLE public.ican_wallet_inbox_notifications RENAME TO ican_wallet_inbox_notifications_off;
  ref := t.card_charge(10000);
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', '4321');
  PERFORM t.check('push: with the inbox missing, the card payment still goes through',
    (r ->> 'success')::BOOLEAN AND (SELECT status FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) = 'paid', r::TEXT);
  ALTER TABLE public.ican_wallet_inbox_notifications_off RENAME TO ican_wallet_inbox_notifications;

  -- a last4 that is not digits is not stored as one
  ref := t.card_charge(10000);
  r := public.imc_pay_with_card(ref, '00000000-0000-0000-0000-0000000000c3', 'abc');
  PERFORM t.check('pay: a card hint with no digits is simply left out',
    (r ->> 'success')::BOOLEAN AND (SELECT card_last4 FROM public.icanera_mobile_card_payments WHERE tx_ref = ref) IS NULL, r::TEXT);
END $$;
