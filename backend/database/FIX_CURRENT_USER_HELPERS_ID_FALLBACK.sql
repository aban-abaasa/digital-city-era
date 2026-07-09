-- ============================================================================
-- FIX: current_user_supermarket_id()/current_user_role() only checked
-- users.auth_id, but rows created by the newer shared-Supabase signup
-- trigger (FIX_AUTO_SIGNUP_TRIGGER_V2.sql) set users.id = auth.users.id
-- directly and leave auth_id NULL. For those users the functions returned
-- NULL, silently failing every RLS check that depends on them (e.g. the
-- "own supermarket inventory" INSERT policy).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_supermarket_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT supermarket_id FROM public.users
  WHERE auth_id = auth.uid() OR id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users
  WHERE auth_id = auth.uid() OR id = auth.uid()
  LIMIT 1;
$$;

-- Same gap on the users table's own SELECT policy — a user whose row only
-- has id = auth.uid() (no auth_id) couldn't read their own row.
DROP POLICY IF EXISTS "Users can read same supermarket users" ON public.users;
CREATE POLICY "Users can read same supermarket users" ON public.users
  FOR SELECT
  USING (
    auth.uid() = auth_id
    OR auth.uid() = id
    OR (
      public.current_user_supermarket_id() IS NOT NULL
      AND supermarket_id = public.current_user_supermarket_id()
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✅ current_user_supermarket_id()/current_user_role() now match auth_id OR id.';
  RAISE NOTICE '✅ users SELECT policy now also allows auth.uid() = id.';
END $$;
