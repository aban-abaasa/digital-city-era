-- ============================================================================
-- SECURE DEV PANEL ACCESS — Run ONCE in Supabase SQL Editor
-- ============================================================================
-- Replaces the plaintext dev_token bearer-secret pattern from
-- DEV_PANEL_ACCESS.sql. That token ('dev_Sup3rmarktera_KV25') was checked
-- entirely client-side before ever calling Supabase, then forwarded as a
-- literal string argument to these RPCs — which means it shipped in
-- plaintext inside the public frontend JS bundle. Anyone who opened
-- devtools could read it and call dev_get_users / dev_grant_ican_bonus /
-- etc. directly via the public REST API, with no login at all (the RPCs
-- were GRANTed to `anon`).
--
-- This migration switches every digital-city-era-only dev RPC to require a
-- real authenticated Supabase session whose email is on the dev_operators
-- allowlist (checked server-side, never shipped to the client) instead of
-- a shared secret string. Run this AFTER DEV_PANEL_ACCESS.sql.
--
-- landing_messages_is_dev() is shared with FARM-AGENT and ICAN's own dev
-- panels (see ADD_LANDING_MESSAGE_REPLIES.sql) — this migration only
-- removes digital-city-era's token from that check and adds the new
-- session-based path; the other two apps' tokens are left untouched since
-- fixing those requires the same migration run against their own
-- DevPanel.jsx, which is out of scope here.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Allowlist of real Supabase accounts allowed to use the dev panel.
--    No grants to anon/authenticated — only readable from inside the
--    SECURITY DEFINER functions below, which run as the table owner.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dev_operators (
  email    TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.dev_operators (email) VALUES
  ('agrobone0@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Revokes access for anyone a prior run of this migration already seeded
-- that isn't in the INSERT above.
DELETE FROM public.dev_operators WHERE email <> 'agrobone0@gmail.com';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. is_dev_operator — true only for a real, currently-signed-in session
--    whose email is on the allowlist above.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_dev_operator()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dev_operators WHERE email = auth.email()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_dev_operator() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. landing_messages_is_dev — add the session-based path, drop this app's
--    token from the literal list. FARM-AGENT's and ICAN's tokens stay valid.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.landing_messages_is_dev(dev_token TEXT DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_dev_operator() THEN
    RETURN true;
  END IF;

  IF dev_token IN ('dev_Farm_Ag3nt_KV25', 'dev_ICAN_Pr0_KV25') THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mbg_users
    WHERE id = auth.uid() AND role_type = 'developer'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Re-point every digital-city-era-only dev RPC at is_dev_operator() and
--    drop the dev_token parameter entirely — CREATE OR REPLACE can't change
--    a function's signature, so each one is dropped first.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.dev_get_users(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_users();
CREATE FUNCTION public.dev_get_users()
RETURNS TABLE (
  id             UUID,
  auth_id        UUID,
  email          TEXT,
  full_name      TEXT,
  phone          TEXT,
  role           TEXT,
  supermarket_id UUID,
  is_active      BOOLEAN,
  created_at     TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT u.id, u.auth_id, u.email, u.full_name, u.phone,
           u.role, u.supermarket_id, u.is_active, u.created_at
    FROM public.users u
    ORDER BY u.role, u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_users() TO authenticated;


DROP FUNCTION IF EXISTS public.dev_get_supermarkets(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_supermarkets();
CREATE FUNCTION public.dev_get_supermarkets()
RETURNS TABLE (
  id         UUID,
  name       TEXT,
  location   TEXT,
  phone      TEXT,
  address    TEXT,
  is_active  BOOLEAN,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT s.id, s.name, s.location, s.phone, s.address, s.is_active, s.created_at
    FROM public.supermarkets s
    ORDER BY s.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_supermarkets() TO authenticated;


DROP FUNCTION IF EXISTS public.dev_get_suppliers(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_suppliers();
CREATE FUNCTION public.dev_get_suppliers()
RETURNS TABLE (
  id             UUID,
  user_id        UUID,
  company_name   TEXT,
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  supermarket_id UUID,
  is_approved    BOOLEAN,
  created_at     TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT s.id, s.user_id, s.company_name, s.contact_person,
           s.email, s.phone, s.address, s.supermarket_id,
           s.is_approved, s.created_at
    FROM public.suppliers s
    ORDER BY s.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_suppliers() TO authenticated;


DROP FUNCTION IF EXISTS public.dev_get_wallets(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_wallets();
CREATE FUNCTION public.dev_get_wallets()
RETURNS TABLE (
  user_id          UUID,
  ican_balance     NUMERIC,
  total_earned     NUMERIC,
  total_spent      NUMERIC,
  total_tithe_paid NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT w.user_id, w.ican_balance, w.total_earned, w.total_spent, w.total_tithe_paid
    FROM public.ican_user_wallets w;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_wallets() TO authenticated;


DROP FUNCTION IF EXISTS public.dev_get_tx_totals(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_tx_totals();
CREATE FUNCTION public.dev_get_tx_totals()
RETURNS TABLE (
  recipient_user_id UUID,
  total_received    NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT t.recipient_user_id, SUM(t.ican_amount) AS total_received
    FROM public.ican_coin_transactions t
    WHERE t.recipient_user_id IS NOT NULL
    GROUP BY t.recipient_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_tx_totals() TO authenticated;


DROP FUNCTION IF EXISTS public.dev_grant_ican_bonus(TEXT, UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.dev_grant_ican_bonus(UUID, NUMERIC);
CREATE FUNCTION public.dev_grant_ican_bonus(
  target_user_id UUID,
  bonus_amount   NUMERIC
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  tithe NUMERIC;
  net   NUMERIC;
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  tithe := ROUND(bonus_amount * 0.1, 6);
  net   := bonus_amount - tithe;

  INSERT INTO public.ican_user_wallets (user_id, ican_balance, total_earned, total_tithe_paid)
  VALUES (target_user_id, net, bonus_amount, tithe)
  ON CONFLICT (user_id) DO UPDATE SET
    ican_balance     = ican_user_wallets.ican_balance     + net,
    total_earned     = ican_user_wallets.total_earned     + bonus_amount,
    total_tithe_paid = ican_user_wallets.total_tithe_paid + tithe;

  INSERT INTO public.ican_coin_transactions (recipient_user_id, ican_amount)
  VALUES (target_user_id, net);
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_grant_ican_bonus(UUID, NUMERIC) TO authenticated;


DROP FUNCTION IF EXISTS public.dev_get_staff(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_staff();
CREATE FUNCTION public.dev_get_staff()
RETURNS TABLE (supermarket_id UUID, user_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT ss.supermarket_id, ss.user_id
    FROM public.supermarket_staff ss;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_staff() TO authenticated;


DROP FUNCTION IF EXISTS public.dev_get_supermarket_members(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_supermarket_members();
CREATE FUNCTION public.dev_get_supermarket_members()
RETURNS TABLE (
  supermarket_id UUID,
  user_id        UUID,
  full_name      TEXT,
  email          TEXT,
  phone          TEXT,
  role           TEXT,
  is_active      BOOLEAN,
  ican_balance   NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
    SELECT
      u.supermarket_id,
      u.id                           AS user_id,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      u.is_active,
      COALESCE(w.ican_balance, 0)    AS ican_balance
    FROM public.users u
    LEFT JOIN public.ican_user_wallets w ON w.user_id = u.id
    WHERE u.supermarket_id IS NOT NULL

    UNION

    SELECT
      ss.supermarket_id,
      u.id                           AS user_id,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      u.is_active,
      COALESCE(w.ican_balance, 0)    AS ican_balance
    FROM public.supermarket_staff ss
    JOIN  public.users u              ON u.id = ss.user_id
    LEFT JOIN public.ican_user_wallets w ON w.user_id = u.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_supermarket_members() TO authenticated;


DROP FUNCTION IF EXISTS public.dev_get_system_totals(TEXT);
DROP FUNCTION IF EXISTS public.dev_get_system_totals();
CREATE FUNCTION public.dev_get_system_totals()
RETURNS TABLE (
  role              TEXT,
  user_count        BIGINT,
  total_balance     NUMERIC,
  total_earned      NUMERIC,
  total_spent       NUMERIC,
  total_tithe       NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_dev_operator() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
    SELECT
      u.role,
      COUNT(u.id)                        AS user_count,
      COALESCE(SUM(w.ican_balance), 0)   AS total_balance,
      COALESCE(SUM(w.total_earned), 0)   AS total_earned,
      COALESCE(SUM(w.total_spent), 0)    AS total_spent,
      COALESCE(SUM(w.total_tithe_paid), 0) AS total_tithe
    FROM public.users u
    LEFT JOIN public.ican_user_wallets w ON w.user_id = u.id
    GROUP BY u.role
    ORDER BY total_balance DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dev_get_system_totals() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE — verify with:
--   SELECT public.is_dev_operator();  -- run this while logged in as a
--   dev_operators account in the Supabase SQL editor's "impersonate" mode,
--   or from the app after signing in normally as that account.
-- ─────────────────────────────────────────────────────────────────────────────
