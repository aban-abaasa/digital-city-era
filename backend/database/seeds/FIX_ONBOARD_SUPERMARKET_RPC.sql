-- ============================================================================
-- FIX: onboard_supermarket must ALWAYS create a brand-new, independent
-- supermarket for a new admin — never attach them to one that already exists.
-- ============================================================================
-- This function is called from AdminAuth.jsx during admin signup. Its
-- definition was never checked into this repo (created directly in Supabase
-- at some point), so its current live behavior is unknown. Symptom reported:
-- a new admin signing up lands inside an existing system with a role already
-- assigned — i.e. it's reusing/matching an existing supermarket instead of
-- creating a new one. This replaces it with a version that is keyed strictly
-- on the calling user's own auth id, so it can never resolve to someone
-- else's store.
-- ============================================================================

-- ============================================================================
-- STEP 1: Make sure supermarkets has the columns onboard_supermarket needs
-- ============================================================================

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS onboarding_token UUID DEFAULT gen_random_uuid();

-- Some supermarkets already have duplicate owner_user_id values (fallout
-- from the previous buggy onboarding logic creating more than one store per
-- admin). Keep one canonical row per owner — prefer whichever one the
-- owner's users.supermarket_id actually points to today (the one really in
-- use), otherwise the oldest — and clear owner_user_id on the rest so they
-- stop claiming ownership. Nothing is deleted.
DO $$
DECLARE
  dup RECORD;
  keeper_id UUID;
BEGIN
  FOR dup IN
    SELECT owner_user_id
    FROM public.supermarkets
    WHERE owner_user_id IS NOT NULL
    GROUP BY owner_user_id
    HAVING COUNT(*) > 1
  LOOP
    keeper_id := NULL;

    SELECT s.id INTO keeper_id
    FROM public.supermarkets s
    JOIN public.users u ON u.supermarket_id = s.id
    WHERE s.owner_user_id = dup.owner_user_id AND u.auth_id = dup.owner_user_id
    LIMIT 1;

    IF keeper_id IS NULL THEN
      SELECT id INTO keeper_id
      FROM public.supermarkets
      WHERE owner_user_id = dup.owner_user_id
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    UPDATE public.supermarkets
    SET owner_user_id = NULL
    WHERE owner_user_id = dup.owner_user_id AND id <> keeper_id;

    RAISE NOTICE 'Deduplicated owner_user_id % — kept supermarket %, cleared ownership on the rest', dup.owner_user_id, keeper_id;
  END LOOP;
END $$;

-- One supermarket per owner, enforced at the DB level — belt and suspenders
-- alongside the idempotency check inside the function below.
CREATE UNIQUE INDEX IF NOT EXISTS idx_supermarkets_owner_user_id
  ON public.supermarkets(owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Different admins legitimately might pick the same store name (e.g. two
-- unrelated "City Mart" stores) — a UNIQUE constraint on name would force
-- onboarding logic to either fail or (worse) silently attach to the existing
-- row. Drop it if present.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'supermarkets' AND c.contype = 'u'
      AND c.conkey = (
        SELECT array_agg(attnum) FROM pg_attribute
        WHERE attrelid = rel.oid AND attname = 'name'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.supermarkets DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'Dropped unique constraint % on supermarkets.name — different admins can share a store name', con.conname;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Replace onboard_supermarket with a safe, unambiguous version
-- ============================================================================

-- There's more than one overload of onboard_supermarket already in the
-- database (different signature than the one below), which makes plain
-- "GRANT ... ON FUNCTION public.onboard_supermarket" ambiguous — and worse,
-- leaves an old, unverified version callable. Drop every existing overload
-- so exactly one, known-correct version exists afterward.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'onboard_supermarket'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.onboard_supermarket(%s)', fn.args);
    RAISE NOTICE 'Dropped existing onboard_supermarket(%) overload', fn.args;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.onboard_supermarket(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_existing_id UUID;
  v_new_id UUID;
  v_token UUID;
  v_internal_user_id UUID;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Store name is required');
  END IF;

  -- Idempotent by caller only: if THIS user already owns a supermarket, hand
  -- back that one instead of creating a duplicate. Never matches on name,
  -- email, or anything else that could resolve to a different admin's store.
  SELECT id INTO v_existing_id FROM public.supermarkets WHERE owner_user_id = v_auth_id LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'supermarket_id', v_existing_id, 'already_existed', true);
  END IF;

  v_token := gen_random_uuid();

  INSERT INTO public.supermarkets (
    name, description, phone, email, address, city, country,
    owner_user_id, onboarding_token, is_active, created_at, updated_at
  )
  VALUES (
    trim(p_name), p_description, p_phone, p_email, p_address, p_city, p_country,
    v_auth_id, v_token, true, NOW(), NOW()
  )
  RETURNING id INTO v_new_id;

  -- Keep public.users in sync — the rest of the app (RLS, portals, the
  -- unified profile system) keys off users.supermarket_id, not
  -- supermarkets.owner_user_id.
  SELECT id INTO v_internal_user_id FROM public.users WHERE auth_id = v_auth_id LIMIT 1;
  IF v_internal_user_id IS NOT NULL THEN
    UPDATE public.users
    SET role = 'admin', supermarket_id = v_new_id, updated_at = NOW()
    WHERE id = v_internal_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'supermarket_id', v_new_id, 'onboarding_token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ onboard_supermarket replaced — every new admin now gets a guaranteed-new, independent supermarket, keyed only on their own auth id.';
END $$;
