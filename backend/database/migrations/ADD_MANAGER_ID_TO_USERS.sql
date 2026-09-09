-- ============================================================================
-- ADD MANAGER_ID TO USERS — manager-owned cashier assignment
-- Each cashier/employee can be assigned to exactly one managing manager.
-- Run in Supabase SQL editor. Safe/idempotent to re-run.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_manager_id ON public.users(manager_id);

-- Guard: manager_id may only point at a user who is actually role='manager'
-- and in the same supermarket as the person being assigned.
CREATE OR REPLACE FUNCTION public.enforce_manager_id_validity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.manager_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users m
      WHERE m.id = NEW.manager_id
        AND m.role = 'manager'
        AND m.supermarket_id = NEW.supermarket_id
    ) THEN
      RAISE EXCEPTION 'manager_id must reference an active manager in the same supermarket';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_manager_id_validity ON public.users;
CREATE TRIGGER trg_enforce_manager_id_validity
  BEFORE INSERT OR UPDATE OF manager_id, supermarket_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_manager_id_validity();
