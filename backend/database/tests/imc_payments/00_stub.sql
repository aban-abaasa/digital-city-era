-- Test stub for ADD_ICAN_MOBILE_CARD_PAYMENTS.sql. Not a migration: never run this against a real database.
--
-- Recreates just enough of Supabase (roles, auth.users, auth.uid()) and of the ICAN objects the migration builds on
-- (wallets, coin ledger, wallet inbox, the live price / fee helpers, buy_ican_coins, transfer_ican) with the same
-- names, argument lists, return shapes and constraints the live database has. The IcanEra Mobile / Card migration's own
-- money handling is what is under test.
\set ON_ERROR_STOP on

DO $$ BEGIN CREATE ROLE anon NOLOGIN;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE);
-- Same lookup order as Supabase's auth.uid().
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                  (NULLIF(current_setting('request.jwt.claims', true), '')::JSONB ->> 'sub'))::UUID $$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
-- Supabase grants EXECUTE on new functions to everyone by default; the migration must revoke what it does not want public.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.supermarkets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID
);

CREATE TABLE public.user_accounts (
  user_id UUID PRIMARY KEY,
  account_number TEXT,
  phone_number TEXT,
  email TEXT,
  account_holder_name TEXT
);

CREATE TABLE public.ican_user_wallets (
  user_id UUID PRIMARY KEY,
  ican_balance NUMERIC(18, 8) NOT NULL DEFAULT 0 CHECK (ican_balance >= 0),
  total_earned NUMERIC(18, 8) NOT NULL DEFAULT 0,
  total_spent  NUMERIC(18, 8) NOT NULL DEFAULT 0
);
CREATE FUNCTION public.get_or_create_ican_wallet(p_user_id UUID) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO public.ican_user_wallets (user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING $$;

CREATE TABLE public.ican_coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID,
  recipient_user_id UUID,
  ican_amount NUMERIC(18, 8) NOT NULL,
  transaction_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  source_app TEXT,
  reference_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Same guard as CLOSE_BUY_ICAN_DIRECT_CALL_HOLE.sql: one 'buy' per reference.
CREATE UNIQUE INDEX ican_coin_tx_buy_ref_unique ON public.ican_coin_transactions (reference_id)
  WHERE transaction_type = 'buy' AND reference_id IS NOT NULL;

CREATE TABLE public.ican_wallet_inbox_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL,
  source_app TEXT NOT NULL DEFAULT 'ican',
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  amount_ican NUMERIC(18, 8),
  coin_transaction_id UUID,
  business_wallet_transaction_id UUID,
  business_profile_id UUID,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- as relaxed by ADD_PUBLIC_TRANSACTION_QR.sql
  CONSTRAINT ican_wallet_inbox_has_source_or_qr
    CHECK (coin_transaction_id IS NOT NULL OR business_wallet_transaction_id IS NOT NULL
           OR notification_type LIKE 'qr\_%' OR notification_type LIKE 'franchise\_%')
);

CREATE TABLE public.guest_checkout_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, note TEXT);
INSERT INTO public.guest_checkout_config (key, value, note) VALUES ('gateway_fee_pct', '3.5', 'fee');

-- Live price (UGX per icaneracoin) and fee: the tests move the price through this one row.
CREATE TABLE public.stub_price (id INT PRIMARY KEY DEFAULT 1, ugx NUMERIC NOT NULL);
INSERT INTO public.stub_price (ugx) VALUES (5000);
CREATE FUNCTION public.public_tx_ican_price_ugx() RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE v NUMERIC;
BEGIN
  SELECT ugx INTO v FROM public.stub_price;
  IF v IS NULL OR v <= 0 THEN RAISE EXCEPTION 'The live icaneracoin price is not available right now — please try again in a moment'; END IF;
  RETURN v;
END $$;
CREATE FUNCTION public.public_tx_fee_pct() RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT NULLIF(value, '')::NUMERIC FROM public.guest_checkout_config WHERE key = 'gateway_fee_pct'), 3.5) $$;

-- buy_ican_coins: credits the buyer, one 'buy' ledger row per reference (service_role only in production).
CREATE FUNCTION public.buy_ican_coins(p_user_id UUID, p_ican_amount DECIMAL, p_source_app TEXT DEFAULT 'ican', p_payment_ref TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_tx UUID;
BEGIN
  IF p_ican_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;
  IF p_source_app NOT IN ('ican','digital-city-era','farm-agent','mybodaguy') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid source_app');
  END IF;
  PERFORM public.get_or_create_ican_wallet(p_user_id);
  UPDATE public.ican_user_wallets SET ican_balance = ican_balance + p_ican_amount, total_earned = total_earned + p_ican_amount
   WHERE user_id = p_user_id;
  INSERT INTO public.ican_coin_transactions (recipient_user_id, ican_amount, transaction_type, source_app, reference_id, note)
  VALUES (p_user_id, p_ican_amount, 'buy', p_source_app, p_payment_ref, format('Bought %s ICAN (ref: %s)', p_ican_amount, p_payment_ref))
  RETURNING id INTO v_tx;
  RETURN jsonb_build_object('success', true, 'tx_id', v_tx, 'ican_bought', p_ican_amount);
END $$;
REVOKE ALL ON FUNCTION public.buy_ican_coins(UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_ican_coins(UUID, DECIMAL, TEXT, TEXT) TO service_role;

-- transfer_ican (12-parameter version): insufficient balance is a soft failure, success returns out_tx_id.
CREATE FUNCTION public.transfer_ican(
  p_from_user UUID, p_to_user UUID, p_amount DECIMAL, p_note TEXT DEFAULT '', p_source_app TEXT DEFAULT 'ican',
  p_reference_id TEXT DEFAULT NULL, p_local_amount DECIMAL DEFAULT NULL, p_local_currency TEXT DEFAULT 'UGX',
  p_merchant_name TEXT DEFAULT NULL, p_counterparty_type TEXT DEFAULT NULL, p_expense_classification TEXT DEFAULT NULL,
  p_business_profile_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_bal DECIMAL; v_out UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;
  SELECT ican_balance INTO v_bal FROM public.ican_user_wallets WHERE user_id = p_from_user FOR UPDATE;
  IF v_bal IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sender wallet not found'); END IF;
  IF v_bal < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', format('Insufficient ICAN balance. Have: %s, Need: %s', v_bal, p_amount));
  END IF;
  UPDATE public.ican_user_wallets SET ican_balance = ican_balance - p_amount, total_spent = total_spent + p_amount WHERE user_id = p_from_user;
  PERFORM public.get_or_create_ican_wallet(p_to_user);
  UPDATE public.ican_user_wallets SET ican_balance = ican_balance + p_amount, total_earned = total_earned + p_amount WHERE user_id = p_to_user;
  INSERT INTO public.ican_coin_transactions (sender_user_id, recipient_user_id, ican_amount, transaction_type, source_app, reference_id, note)
  VALUES (p_from_user, p_to_user, p_amount, 'transfer_out', p_source_app, p_reference_id, p_note) RETURNING id INTO v_out;
  RETURN jsonb_build_object('success', true, 'out_tx_id', v_out);
END $$;

-- Test bookkeeping.
CREATE SCHEMA t;
CREATE TABLE t.results (n SERIAL, name TEXT, ok BOOLEAN, info TEXT);
-- The grant tests run as anon / authenticated and still need to record their result.
GRANT USAGE ON SCHEMA t TO PUBLIC;
GRANT ALL ON t.results TO PUBLIC;
GRANT USAGE ON SEQUENCE t.results_n_seq TO PUBLIC;
CREATE FUNCTION t.check(p_name TEXT, p_ok BOOLEAN, p_info TEXT DEFAULT NULL) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO t.results (name, ok, info) VALUES (p_name, COALESCE(p_ok, FALSE), p_info) $$;
-- Act as a signed-in user (or nobody) the way PostgREST does.
CREATE FUNCTION t.as_user(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user::TEXT, ''), FALSE);
END $$;
