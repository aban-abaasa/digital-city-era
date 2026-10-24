-- ============================================================================
-- Keep unified_profiles.role in step with users.role
-- ----------------------------------------------------------------------------
-- create_unified_profile() only runs AFTER INSERT on public.users, so an
-- account whose users.role changes later (e.g. a customer promoted to admin)
-- kept its old role in unified_profiles. The profile page keys its tabs off
-- that role, so those admins got the customer page and no "Admin Settings".
-- ============================================================================

-- 1. One-off backfill: repair every profile that has already drifted.
UPDATE public.unified_profiles up
SET role = u.role,
    updated_at = NOW()
FROM public.users u
WHERE up.user_id = u.id
  AND u.role IS NOT NULL
  AND up.role IS DISTINCT FROM u.role;

-- 2. From now on, propagate role changes automatically.
CREATE OR REPLACE FUNCTION public.sync_unified_profile_role()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.unified_profiles
  SET role = NEW.role,
      updated_at = NOW()
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_unified_profile_role ON public.users;

CREATE TRIGGER trigger_sync_unified_profile_role
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.sync_unified_profile_role();
