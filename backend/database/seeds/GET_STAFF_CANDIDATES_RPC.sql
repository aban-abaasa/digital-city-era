-- ============================================================================
-- ADD: get_staff_candidates_for_admin() — the safe replacement for what
-- get_auth_users_for_admin() used to loosely provide for staff recruitment.
-- ============================================================================
-- "Assign Manager or Cashier" needs to see ANY signed-up person (a customer
-- of some other store, or someone with no supermarket_id yet) so the admin
-- can recruit them — RLS alone can't do this, since "Users can read same
-- supermarket users" only grants visibility within one's own supermarket.
--
-- This bypasses RLS deliberately (SECURITY DEFINER) but enforces the real
-- rule in code instead of trusting the client:
--   - caller must be an admin with a supermarket
--   - admin accounts are never returned as candidates
--   - anyone who is ALREADY manager/cashier/staff at a DIFFERENT supermarket
--     is excluded — you can't see or poach another admin's staff this way
--   - customers / unassigned signups are always visible, regardless of
--     whatever supermarket_id they happen to carry
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_staff_candidates_for_admin()
RETURNS TABLE (
  id             UUID,
  auth_id        UUID,
  email          TEXT,
  phone          TEXT,
  full_name      TEXT,
  role           TEXT,
  is_active      BOOLEAN,
  supermarket_id UUID,
  created_at     TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  caller RECORD;
BEGIN
  SELECT u.role, u.supermarket_id INTO caller
  FROM public.users u WHERE u.auth_id = auth.uid();

  IF caller IS NULL OR caller.role <> 'admin' OR caller.supermarket_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pu.id, pu.auth_id, pu.email, pu.phone, pu.full_name, pu.role,
         pu.is_active, pu.supermarket_id, pu.created_at
  FROM public.users pu
  WHERE pu.role <> 'admin'
    AND NOT (
      pu.role IN ('manager', 'cashier', 'staff')
      AND pu.supermarket_id IS DISTINCT FROM caller.supermarket_id
    )
  ORDER BY pu.created_at DESC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_candidates_for_admin() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ get_staff_candidates_for_admin() ready — admins can see every customer/unassigned signup as a recruitment candidate, but never other admins or other supermarkets'' existing staff.';
END $$;
