-- ============================================================================
-- FIX: get_auth_users_for_admin() was reading auth.users (every account on
-- the entire platform, every supermarket) and was GRANTed to `authenticated`
-- — meaning ANY signed-in user (customer, cashier, any admin) could call it
-- directly and dump every other supermarket's users, including admins.
-- This is very likely how these admin accounts ended up cross-contaminated
-- in the first place, and why "User Management" kept showing all 3 admins
-- even after the AdminPortal.jsx query itself was fixed to filter by
-- supermarket_id — a direct RPC call bypasses that filter entirely.
--
-- Replaced with a version that only an admin can call, and that only
-- returns users from the CALLER's own supermarket.
-- ============================================================================

-- The existing function's return row type differs from the one below, and
-- Postgres won't let CREATE OR REPLACE change a function's return type —
-- drop it first (this also covers any other stray overload).
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_auth_users_for_admin'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.get_auth_users_for_admin(%s)', fn.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_auth_users_for_admin()
RETURNS TABLE (
  id               UUID,
  email            TEXT,
  phone            TEXT,
  full_name        TEXT,
  role             TEXT,
  is_active        BOOLEAN,
  supermarket_id   UUID,
  created_at       TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  caller RECORD;
BEGIN
  SELECT u.role, u.supermarket_id INTO caller
  FROM public.users u
  WHERE u.auth_id = auth.uid();

  IF caller IS NULL OR caller.role <> 'admin' OR caller.supermarket_id IS NULL THEN
    RETURN; -- empty result for non-admins / admins with no supermarket
  END IF;

  RETURN QUERY
  SELECT pu.id, pu.email, pu.phone, pu.full_name, pu.role, pu.is_active,
         pu.supermarket_id, pu.created_at
  FROM public.users pu
  WHERE pu.supermarket_id = caller.supermarket_id
  ORDER BY pu.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_users_for_admin() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ get_auth_users_for_admin() now admin-only and scoped to the caller''s own supermarket — no more cross-tenant leak.';
END $$;
