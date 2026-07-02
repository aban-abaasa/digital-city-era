-- ============================================================================
-- SYNC: reconcile public.users.supermarket_id with public.supermarket_staff
-- ============================================================================
-- The old assignStaffRole() fallback path (used whenever
-- assign_staff_with_blockchain errored) set users.role and is_active but
-- never users.supermarket_id. Result: a staff member can show up correctly
-- in "Current Staff" (read from supermarket_staff) while being invisible to
-- every other supermarket-scoped query in AdminPortal — User Management
-- counts, the assign-candidates list, everything keyed off
-- users.supermarket_id — because that column was left null/stale.
--
-- This makes users.supermarket_id match supermarket_staff for every active
-- staff record. Safe to re-run.
-- ============================================================================

UPDATE public.users u
SET supermarket_id = ss.supermarket_id, updated_at = NOW()
FROM public.supermarket_staff ss
WHERE ss.user_id = u.id
  AND ss.status = 'active'
  AND u.supermarket_id IS DISTINCT FROM ss.supermarket_id
  AND u.role <> 'admin';

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '✅ Synced supermarket_id for % staff record(s) that were out of sync with supermarket_staff.', v_count;
END $$;
