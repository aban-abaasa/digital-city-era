-- ============================================================================
-- FIX: New signups failing with "Database error saving new user" (500)
-- ============================================================================
-- ROOT CAUSE #1: auth.users is a single shared table across 4 apps (ICAN,
-- digital-city-era, FARM-AGENT, mybodaguy) on one Supabase project.
-- digital-city-era's own migrations (CREATE_AUTO_SIGNUP_TRIGGERS.sql,
-- FIX_AUTO_SIGNUP_TRIGGER.sql, FIX_AUTO_SIGNUP_TRIGGER_V2.sql) — and ICAN's
-- and FARM-AGENT's — all installed a trigger under the SAME generic name
-- (on_auth_user_created -> public.handle_new_user()). Each app's migration
-- does `DROP TRIGGER IF EXISTS on_auth_user_created` then recreates it, so
-- whichever app's SQL was run most recently in the Supabase SQL editor
-- silently overwrites the other two apps' signup logic.
--
-- ROOT CAUSE #2: the first version of this fix (this file) assumed
-- FIX_AUTO_SIGNUP_TRIGGER_V2.sql's schema for public.users
-- (first_name/last_name/status/portal, id = auth.users.id directly). That
-- schema was never actually the live one — it errored with "column
-- first_name does not exist". The REAL live shape, confirmed by three
-- independent already-applied migrations (ADD_MISSING_USERS_COLUMNS.sql,
-- and the two ALTER TABLE public.users blocks in
-- CREATE_PRODUCTS_INVENTORY_TABLES.sql) plus the already-working
-- current_user_role()/current_user_supermarket_id() RLS helpers (which
-- read `role` straight off public.users, not from a separate table), is:
--   id UUID PRIMARY KEY, auth_id UUID UNIQUE, email TEXT, full_name TEXT,
--   phone TEXT, role TEXT DEFAULT 'customer', supermarket_id UUID,
--   is_active BOOLEAN DEFAULT TRUE, department, employee_id,
--   last_sign_in_at
-- This version only touches those confirmed columns.
--
-- FIX: give this app's trigger a unique name so it can never collide with
-- or be overwritten by another app's migration again — the same pattern
-- mybodaguy already correctly uses (on_auth_user_created_mbg). Also wraps
-- the body in an exception handler so a bug here can never again block
-- account creation for this app or any other app sharing this table.
--
-- Run this in digital-city-era's Supabase SQL editor. Also run the
-- matching FIX_AUTO_SIGNUP_TRIGGER_NAMESPACE_ICAN.sql (ICAN) and
-- FIX_AUTO_SIGNUP_TRIGGER_NAMESPACE_FARMAGENT.sql (FARM-AGENT) so all
-- three end up as independent, non-colliding triggers.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_dce()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.users (
    id, auth_id, email, full_name, role, is_active, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.id, NEW.email, v_full_name, 'customer', true, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    auth_id = COALESCE(public.users.auth_id, EXCLUDED.auth_id),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let a bug here block the user's account creation (or any other
    -- app's signup trigger firing on the same auth.users insert).
    RAISE LOG 'handle_new_user_dce error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_dce ON auth.users;
CREATE TRIGGER on_auth_user_created_dce
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_dce();

-- Backfill any users who signed up while the generic trigger belonged to a
-- different app and therefore never got a public.users row.
INSERT INTO public.users (id, auth_id, email, full_name, role, is_active, created_at, updated_at)
SELECT
  u.id, u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'customer', true, u.created_at, NOW()
FROM auth.users u
LEFT JOIN public.users pu ON pu.id = u.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- NOTE: deliberately NOT dropping the old generic `on_auth_user_created`
-- trigger here — until ICAN's and FARM-AGENT's own namespaced fixes have
-- also been run, that generic trigger may currently be the only thing
-- keeping one of those other apps' signups working. Drop it only once all
-- three apps have their own on_auth_user_created_* trigger in place (see
-- ICAN/backend/CLEANUP_GENERIC_SIGNUP_TRIGGER.sql).

DO $$
BEGIN
  RAISE NOTICE '✅ digital-city-era signup trigger renamed to on_auth_user_created_dce, matched to the real public.users schema — can no longer be overwritten by another app''s migration, and can no longer block signup on its own error.';
END $$;
