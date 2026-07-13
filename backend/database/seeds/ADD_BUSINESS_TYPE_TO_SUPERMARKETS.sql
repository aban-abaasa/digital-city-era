-- ============================================================================
-- ADD BUSINESS TYPE: supermarkets is the one shared "store" table used by
-- every admin (supermarket, and now hotel / boutique / restaurant-café).
-- This adds a business_type column so admin setup, staff dashboards, and the
-- BodaGo/supermarkera shared shopping UI can all tell what kind of store
-- they're looking at — without touching any existing table name, RPC name,
-- or supermarket_id-keyed plumbing (POS, staff assignment, delivery_mode,
-- RLS policies all keep working unchanged for existing rows).
-- ============================================================================

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS business_type VARCHAR(20) NOT NULL DEFAULT 'supermarket';

-- Re-runnable: drop and recreate the CHECK so this file can be re-applied
-- safely if the allowed set of types ever changes.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'supermarkets' AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%business_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.supermarkets DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.supermarkets
  ADD CONSTRAINT supermarkets_business_type_check
  CHECK (business_type IN ('supermarket', 'hotel', 'boutique', 'restaurant_cafe'));

CREATE INDEX IF NOT EXISTS idx_supermarkets_business_type
  ON public.supermarkets(business_type);

-- ============================================================================
-- Replace onboard_supermarket to accept p_business_type. Same
-- drop-every-overload-then-recreate approach as FIX_ONBOARD_SUPERMARKET_RPC.sql
-- so exactly one, known-correct signature is ever callable.
-- ============================================================================

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
  p_country TEXT DEFAULT NULL,
  p_business_type TEXT DEFAULT 'supermarket'
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

  IF p_business_type IS NULL OR p_business_type NOT IN ('supermarket', 'hotel', 'boutique', 'restaurant_cafe') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid business type');
  END IF;

  -- Idempotent by caller only: if THIS user already owns a store, hand back
  -- that one instead of creating a duplicate. Never matches on name, email,
  -- or anything else that could resolve to a different admin's store.
  SELECT id INTO v_existing_id FROM public.supermarkets WHERE owner_user_id = v_auth_id LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'supermarket_id', v_existing_id, 'already_existed', true);
  END IF;

  v_token := gen_random_uuid();

  INSERT INTO public.supermarkets (
    name, description, phone, email, address, city, country,
    owner_user_id, onboarding_token, is_active, business_type, created_at, updated_at
  )
  VALUES (
    trim(p_name), p_description, p_phone, p_email, p_address, p_city, p_country,
    v_auth_id, v_token, true, p_business_type, NOW(), NOW()
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

  RETURN jsonb_build_object('success', true, 'supermarket_id', v_new_id, 'onboarding_token', v_token, 'business_type', p_business_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ supermarkets.business_type ready (supermarket/hotel/boutique/restaurant_cafe) — onboard_supermarket now accepts p_business_type.';
END $$;
