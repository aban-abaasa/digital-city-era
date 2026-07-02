-- ============================================================================
-- CONSOLIDATE PROFILES: retire admin_profiles / manager_profiles / cashier_profiles
-- ============================================================================
-- unified_profiles is now the ONLY profile table for admin, manager, cashier
-- (customer stays on unified_profiles too, as the base tier of the hierarchy).
--
-- Run this AFTER CREATE_UNIFIED_PROFILE_SYSTEM.sql has been applied.
-- Safe to re-run.
-- ============================================================================

-- ============================================================================
-- STEP 0: Create a unified_profiles (and onboarding_progress) row for any
-- user who predates the auto-create trigger, or whom it otherwise missed.
-- Without this, their profile page 406s on .single() forever.
-- ============================================================================

INSERT INTO public.unified_profiles (user_id, full_name, email, phone, role, supermarket_id, status, created_at, updated_at)
SELECT u.id, COALESCE(u.full_name, 'User'), u.email, u.phone, u.role, u.supermarket_id, 'active', u.created_at, NOW()
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.unified_profiles up WHERE up.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.onboarding_progress (user_id, role, current_step, total_steps, created_at)
SELECT u.id, u.role, 0,
  CASE WHEN u.role = 'admin' THEN 6 WHEN u.role IN ('manager', 'cashier') THEN 5 WHEN u.role = 'customer' THEN 4 ELSE 3 END,
  NOW()
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_progress op WHERE op.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- STEP 1: Backfill unified_profiles with anything only the legacy tables have
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_profiles') THEN
    UPDATE public.unified_profiles up
    SET
      business_name = COALESCE(up.business_name, ap.business_name),
      business_license = COALESCE(up.business_license, ap.business_license),
      tax_number = COALESCE(up.tax_number, ap.tax_number),
      location = COALESCE(up.location, ap.location),
      avatar = COALESCE(up.avatar, ap.avatar),
      avatar_url = COALESCE(up.avatar_url, ap.avatar_url),
      bio = COALESCE(up.bio, ap.bio)
    FROM public.admin_profiles ap
    WHERE ap.admin_id = up.user_id;
    RAISE NOTICE 'Backfilled unified_profiles from admin_profiles';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manager_profiles') THEN
    UPDATE public.unified_profiles up
    SET
      department = COALESCE(up.department, mp.department),
      location = COALESCE(up.location, mp.location),
      avatar = COALESCE(up.avatar, mp.avatar),
      avatar_url = COALESCE(up.avatar_url, mp.avatar_url),
      employee_id = COALESCE(up.employee_id, mp.employee_id),
      bio = COALESCE(up.bio, mp.bio)
    FROM public.manager_profiles mp
    WHERE mp.manager_id = up.user_id;
    RAISE NOTICE 'Backfilled unified_profiles from manager_profiles';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cashier_profiles') THEN
    UPDATE public.unified_profiles up
    SET
      shift = COALESCE(up.shift, cp.shift),
      location = COALESCE(up.location, cp.location),
      avatar = COALESCE(up.avatar, cp.avatar),
      avatar_url = COALESCE(up.avatar_url, cp.avatar_url),
      employee_id = COALESCE(up.employee_id, cp.employee_id),
      manager_id = COALESCE(up.manager_id, cp.manager_id)
    FROM public.cashier_profiles cp
    WHERE cp.cashier_id = up.user_id;
    RAISE NOTICE 'Backfilled unified_profiles from cashier_profiles';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Remove the trigger that used to auto-create admin_profiles rows
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_create_admin_profile ON public.users;
DROP FUNCTION IF EXISTS public.create_admin_profile();

-- ============================================================================
-- STEP 3: Drop objects that depend on the legacy per-role tables, then the
-- tables themselves
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    EXECUTE 'DROP VIEW IF EXISTS public.user_profiles';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE 'DROP TABLE IF EXISTS public.user_profiles CASCADE';
  END IF;
END $$;

DROP TABLE IF EXISTS public.admin_profiles CASCADE;
DROP TABLE IF EXISTS public.manager_profiles CASCADE;
DROP TABLE IF EXISTS public.cashier_profiles CASCADE;

-- ============================================================================
-- STEP 4: Role hierarchy helper — customer(0) < cashier(1) < manager(2) < admin(3)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.role_level(p_role TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'admin' THEN 3
    WHEN 'manager' THEN 2
    WHEN 'cashier' THEN 1
    WHEN 'customer' THEN 0
    ELSE -1
  END;
$$;

-- Returns true if the calling user outranks (or matches) target_role and
-- shares a supermarket with them — this is what gives admin visibility/
-- control over manager, cashier and customer, manager over cashier and
-- customer, etc.
CREATE OR REPLACE FUNCTION public.has_role_authority(p_target_user_id UUID, p_target_role TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  caller RECORD;
BEGIN
  SELECT id, role, supermarket_id INTO caller
  FROM public.users
  WHERE auth_id = auth.uid();

  IF caller IS NULL THEN
    RETURN FALSE;
  END IF;

  IF caller.id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  RETURN public.role_level(caller.role) > public.role_level(p_target_role)
    AND EXISTS (
      SELECT 1 FROM public.users target
      WHERE target.id = p_target_user_id
      AND target.supermarket_id = caller.supermarket_id
    );
END;
$$;

-- ============================================================================
-- STEP 5: Replace unified_profiles RLS with hierarchy-aware policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own unified profile" ON public.unified_profiles;
DROP POLICY IF EXISTS "Users can update own unified profile" ON public.unified_profiles;
DROP POLICY IF EXISTS "Users can insert own unified profile" ON public.unified_profiles;
DROP POLICY IF EXISTS "Admins can read all supermarket profiles" ON public.unified_profiles;
DROP POLICY IF EXISTS "Managers can read team profiles" ON public.unified_profiles;
DROP POLICY IF EXISTS "Higher roles can read subordinate profiles" ON public.unified_profiles;
DROP POLICY IF EXISTS "Higher roles can update subordinate profiles" ON public.unified_profiles;

CREATE POLICY "Users can read own unified profile" ON public.unified_profiles
  FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own unified profile" ON public.unified_profiles
  FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own unified profile" ON public.unified_profiles
  FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- admin sees/manages manager+cashier+customer, manager sees/manages
-- cashier+customer, cashier sees customer, all scoped to their own supermarket
CREATE POLICY "Higher roles can read subordinate profiles" ON public.unified_profiles
  FOR SELECT
  USING (public.has_role_authority(user_id, role));

CREATE POLICY "Higher roles can update subordinate profiles" ON public.unified_profiles
  FOR UPDATE
  USING (public.has_role_authority(user_id, role));

-- ============================================================================
-- STEP 6: Let admins re-assign role for their own supermarket's staff
-- (unified_profiles.role and users.role must move together)
--
-- IMPORTANT: policies on public.users must NOT subquery public.users directly
-- (e.g. "EXISTS (SELECT 1 FROM public.users ...)") — evaluating that subquery
-- re-triggers RLS on users, which re-evaluates the same policy, forever:
-- "infinite recursion detected in policy for relation users" (Postgres 42P17).
-- Route the self-lookup through a SECURITY DEFINER function instead, which
-- bypasses RLS internally and breaks the cycle.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_row()
RETURNS TABLE (id UUID, role TEXT, supermarket_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT id, role, supermarket_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "Admins can update supermarket users" ON public.users;
CREATE POLICY "Admins can update supermarket users" ON public.users
  FOR UPDATE
  USING (
    auth.uid() = auth_id
    OR EXISTS (
      SELECT 1 FROM public.current_user_row() me
      WHERE me.role = 'admin' AND me.supermarket_id = users.supermarket_id
    )
  )
  WITH CHECK (
    auth.uid() = auth_id
    OR EXISTS (
      SELECT 1 FROM public.current_user_row() me
      WHERE me.role = 'admin' AND me.supermarket_id = users.supermarket_id
    )
  );

-- Fix the same recursion hazard in the pre-existing read policy from
-- FIX_SUPERMARKET_ISOLATION_V2.sql, which self-joined public.users directly.
DROP POLICY IF EXISTS "Users can read same supermarket users" ON public.users;
CREATE POLICY "Users can read same supermarket users" ON public.users
  FOR SELECT
  USING (
    auth.uid() = auth_id
    OR EXISTS (
      SELECT 1 FROM public.current_user_row() me
      WHERE me.supermarket_id = users.supermarket_id AND me.supermarket_id IS NOT NULL
    )
  );

GRANT EXECUTE ON FUNCTION public.current_user_row TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.role_level TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role_authority TO authenticated, anon;

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ admin_profiles / manager_profiles / cashier_profiles dropped';
  RAISE NOTICE '✅ unified_profiles is now the single profile table for admin, manager, cashier, customer';
  RAISE NOTICE '✅ Role hierarchy active: customer(0) < cashier(1) < manager(2) < admin(3)';
  RAISE NOTICE '✅ Admin can read/update manager, cashier and customer profiles in their own supermarket';
END $$;
