-- ============================================================================
-- FIX: get_pending_users() / approve_user() / reject_user() had NO caller
-- verification at all, and this schema has a blanket
-- "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated" — so
-- any signed-in user (a customer, a cashier, anyone) could:
--   - see every pending applicant across every supermarket on the platform
--   - approve_user(any_id, 'admin')  → grant themselves or anyone admin
--   - reject_user(any_id)            → delete ANY user account outright
-- This is the most severe hole found in this pass. Fixed so all three only
-- work for an admin, and only ever touch pending users in THAT admin's own
-- supermarket.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE (
  id         UUID,
  auth_id    UUID,
  email      TEXT,
  full_name  TEXT,
  phone      TEXT,
  role       TEXT,
  is_active  BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SELECT u.id, u.auth_id, u.email, u.full_name, u.phone, u.role, u.is_active, u.created_at
  FROM public.users u
  WHERE u.is_active = false AND u.supermarket_id = caller.supermarket_id
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_user(p_user_id UUID, p_role TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller RECORD;
  target RECORD;
BEGIN
  SELECT u.role, u.supermarket_id INTO caller
  FROM public.users u WHERE u.auth_id = auth.uid();

  IF caller IS NULL OR caller.role <> 'admin' OR caller.supermarket_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to approve users';
  END IF;

  SELECT id, supermarket_id INTO target FROM public.users WHERE id = p_user_id;

  IF target IS NULL OR target.supermarket_id IS DISTINCT FROM caller.supermarket_id THEN
    RAISE EXCEPTION 'User does not belong to your supermarket';
  END IF;

  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot grant admin role through approval';
  END IF;

  UPDATE public.users
  SET is_active = true,
      role = COALESCE(p_role, role),
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller RECORD;
  target RECORD;
BEGIN
  SELECT u.role, u.supermarket_id INTO caller
  FROM public.users u WHERE u.auth_id = auth.uid();

  IF caller IS NULL OR caller.role <> 'admin' OR caller.supermarket_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to reject users';
  END IF;

  SELECT id, supermarket_id, role INTO target FROM public.users WHERE id = p_user_id;

  IF target IS NULL OR target.supermarket_id IS DISTINCT FROM caller.supermarket_id THEN
    RAISE EXCEPTION 'User does not belong to your supermarket';
  END IF;

  IF target.role = 'admin' THEN
    RAISE EXCEPTION 'Cannot reject an admin account';
  END IF;

  DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user(UUID) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ get_pending_users / approve_user / reject_user are now admin-only and scoped to the caller''s own supermarket.';
END $$;
