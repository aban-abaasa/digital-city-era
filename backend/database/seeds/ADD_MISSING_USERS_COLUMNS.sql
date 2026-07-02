-- ============================================================================
-- FIX: cashier portal's "ensure profile exists" flow does
-- UPDATE public.users SET department = ..., employee_id = ..., phone = ...
-- but department/employee_id were never added to public.users (they only
-- exist on unified_profiles), causing a 400 (column does not exist) on
-- every cashier login.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);

DO $$
BEGIN
  RAISE NOTICE '✅ public.users.department / employee_id ready.';
END $$;
