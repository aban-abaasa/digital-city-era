-- ============================================================================
-- DEV PANEL ACCESS — Run ONCE in Supabase SQL Editor
-- ============================================================================
-- Creates SECURITY DEFINER functions so the hidden developer panel can read
-- all tables without being blocked by RLS (the dev user has no Supabase auth
-- session since credentials are intercepted before Supabase is called).
--
-- Token: dev_Sup3rmarktera_KV25
-- Must match DEV_TOKEN constant in DevPanel.jsx
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GET ALL USERS (admins, managers, cashiers, suppliers, customers)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_users(dev_token TEXT)
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
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT u.id, u.auth_id, u.email, u.full_name, u.phone,
           u.role, u.supermarket_id, u.is_active, u.created_at
    FROM public.users u
    ORDER BY u.role, u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_get_users(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GET ALL SUPERMARKETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_supermarkets(dev_token TEXT)
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
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT s.id, s.name, s.location, s.phone, s.address, s.is_active, s.created_at
    FROM public.supermarkets s
    ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_get_supermarkets(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. GET ALL SUPPLIERS (from the suppliers table, not just users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_suppliers(dev_token TEXT)
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
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
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

GRANT EXECUTE ON FUNCTION public.dev_get_suppliers(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GET ALL ICAN WALLETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_wallets(dev_token TEXT)
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
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT w.user_id, w.ican_balance, w.total_earned, w.total_spent, w.total_tithe_paid
    FROM public.ican_user_wallets w;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_get_wallets(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GET LIFETIME EARNED PER USER (aggregated transaction totals)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_tx_totals(dev_token TEXT)
RETURNS TABLE (
  recipient_user_id UUID,
  total_received    NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT t.recipient_user_id, SUM(t.ican_amount) AS total_received
    FROM public.ican_coin_transactions t
    WHERE t.recipient_user_id IS NOT NULL
    GROUP BY t.recipient_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_get_tx_totals(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. GRANT ICAN BONUS TO A USER (bypasses auth, auto-deducts 10% tithe)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_grant_ican_bonus(
  dev_token      TEXT,
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
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  tithe := ROUND(bonus_amount * 0.1, 6);
  net   := bonus_amount - tithe;

  -- Upsert wallet
  INSERT INTO public.ican_user_wallets (user_id, ican_balance, total_earned, total_tithe_paid)
  VALUES (target_user_id, net, bonus_amount, tithe)
  ON CONFLICT (user_id) DO UPDATE SET
    ican_balance     = ican_user_wallets.ican_balance     + net,
    total_earned     = ican_user_wallets.total_earned     + bonus_amount,
    total_tithe_paid = ican_user_wallets.total_tithe_paid + tithe;

  -- Log the transaction
  INSERT INTO public.ican_coin_transactions (recipient_user_id, ican_amount)
  VALUES (target_user_id, net);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_grant_ican_bonus(TEXT, UUID, NUMERIC) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SUBSCRIPTIONS TABLE (skip if already created from the in-app SQL banner)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supermart_subscriptions (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  supermarket_id UUID         REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  user_id        UUID         REFERENCES public.users(id)        ON DELETE CASCADE,
  plan           VARCHAR(20)  DEFAULT 'basic'
                              CHECK (plan IN ('basic', 'pro', 'enterprise')),
  target_type    VARCHAR(20)  DEFAULT 'supermart'
                              CHECK (target_type IN ('supermart', 'supplier', 'customer')),
  active         BOOLEAN      DEFAULT true,
  expires_at     TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.supermart_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_manage_subscriptions" ON public.supermart_subscriptions;

CREATE POLICY "dev_manage_subscriptions"
  ON public.supermart_subscriptions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.supermart_subscriptions TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. GET SUPERMARKET STAFF ASSIGNMENTS (from supermarket_staff join table)
--    Managers and cashiers are linked here, NOT via users.supermarket_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_staff(dev_token TEXT)
RETURNS TABLE (supermarket_id UUID, user_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT ss.supermarket_id, ss.user_id
    FROM public.supermarket_staff ss;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_get_staff(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. GET ALL MEMBERS PER SUPERMARKET — single server-side join
--    Combines users.supermarket_id  AND  supermarket_staff join table
--    so admins, managers, cashiers, suppliers all appear under their supermarket
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_supermarket_members(dev_token TEXT)
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
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
    -- Source A: users whose supermarket_id column is set
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

    -- Source B: users linked via supermarket_staff (managers, cashiers)
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

GRANT EXECUTE ON FUNCTION public.dev_get_supermarket_members(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SYSTEM-WIDE WALLET TOTALS (for the System tracking tab)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dev_get_system_totals(dev_token TEXT)
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
  IF dev_token != 'dev_Sup3rmarktera_KV25' THEN
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

GRANT EXECUTE ON FUNCTION public.dev_get_system_totals(TEXT) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- DONE — verify by running:
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public' AND routine_name LIKE 'dev_%';
-- ─────────────────────────────────────────────────────────────────────────────
