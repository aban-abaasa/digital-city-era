-- ============================================================================
-- FIX: AdminPortal / CashierPortal / ManagerPortal / SupplierPortal all
-- select/update public.users.avatar_url directly (profile picture storage),
-- but avatar_url was never added to the live public.users table even though
-- it's part of the original schema design (frontend/src/database/schema.sql).
-- This causes "column users.avatar_url does not exist" 400s on every
-- portal's profile load. Same pattern as ADD_MISSING_USERS_COLUMNS.sql.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

DO $$
BEGIN
  RAISE NOTICE '✅ public.users.avatar_url ready.';
END $$;
