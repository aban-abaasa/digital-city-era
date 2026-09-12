-- ============================================================================
-- Supermarkets have carried latitude/longitude columns since MULTI_TENANT_
-- PLATFORM.sql, but nothing in either app ever wrote to them — onboard_
-- supermarket() (ADD_PHARMACY_FLEXIBLE_INVENTORY.sql) never accepted GPS
-- coordinates, and SupermarketOnboarding.jsx only ever collected a free-text
-- street address / city / country. Result: EVERY supermarket row in
-- production has latitude/longitude = NULL.
--
-- That silently breaks ICAN's dropship rider booking (ICAN/backend/
-- ADD_DROPSHIP_RIDER_BOOKING_AND_ESCROW.sql): get_dropship_storefront()
-- reads store_lat/store_lng straight off this same supermarkets row so the
-- storefront can call mbg_find_available_riders() and render a picker — with
-- it NULL, the picker never fires and the page always shows "No riders
-- nearby right now" even when riders are online nearby. dropship_checkout()
-- then hard-fails checkout outright ('This store has no delivery location
-- configured yet') rather than silently auto-assigning as that placeholder
-- text implies.
--
-- Same GPS-capture pattern BodaGoera's own rider side already uses for this
-- exact problem (mybodaguy/frontend/src/mybodaguy/components/
-- RiderLocationManager.tsx: getCurrentPosition -> save lat/lng, no separate
-- RPC needed since RLS already scopes the write to the row's owner) — see
-- SupermarketOnboarding.jsx and SupermarketHub.jsx changes alongside this
-- migration.
--
-- Additive only: existing supermarket rows, RLS policies and every existing
-- onboard_supermarket() caller keep working unchanged.
-- ============================================================================

-- Replace every existing onboard_supermarket() overload with versions that
-- also accept p_latitude/p_longitude, same "drop every overload by name
-- first" technique the pharmacy migration already used (CREATE OR REPLACE
-- alone creates a new overload rather than replacing one when the parameter
-- list changes).
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
  p_business_type TEXT DEFAULT 'supermarket',
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL
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
  v_pichin_business_id UUID;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Store name is required');
  END IF;

  IF COALESCE(p_business_type, '') NOT IN
    ('supermarket', 'pharmacy', 'hotel', 'boutique', 'restaurant_cafe', 'wholesale', 'hardware', 'factory', 'laundry') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid business type');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.supermarkets
  WHERE owner_user_id = v_auth_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'supermarket_id', v_existing_id,
      'already_existed', true
    );
  END IF;

  v_token := gen_random_uuid();

  SELECT id INTO v_pichin_business_id
  FROM public.business_profiles
  WHERE user_id = v_auth_id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.supermarkets (
    name, description, phone, email, address, city, country,
    owner_user_id, onboarding_token, is_active, business_type,
    pichin_business_profile_id, latitude, longitude,
    created_at, updated_at
  )
  VALUES (
    trim(p_name), p_description, p_phone, p_email, p_address, p_city,
    p_country, v_auth_id, v_token, true, COALESCE(p_business_type, 'supermarket'),
    v_pichin_business_id, p_latitude, p_longitude,
    NOW(), NOW()
  )
  RETURNING id INTO v_new_id;

  SELECT id INTO v_internal_user_id
  FROM public.users
  WHERE auth_id = v_auth_id OR id = v_auth_id
  LIMIT 1;

  IF v_internal_user_id IS NOT NULL THEN
    UPDATE public.users
    SET role = 'admin', supermarket_id = v_new_id, updated_at = NOW()
    WHERE id = v_internal_user_id;
  END IF;

  IF v_pichin_business_id IS NOT NULL
     AND to_regclass('public.business_app_links') IS NOT NULL THEN
    INSERT INTO public.business_app_links (
      business_profile_id, app_key, source_entity_id, linked_by, metadata
    ) VALUES (
      v_pichin_business_id, 'supermarketa', v_new_id, v_auth_id,
      jsonb_build_object('business_type', COALESCE(p_business_type, 'supermarket'))
    )
    ON CONFLICT (business_profile_id, app_key) DO UPDATE
      SET source_entity_id = EXCLUDED.source_entity_id,
          status = 'active',
          metadata = EXCLUDED.metadata,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'supermarket_id', v_new_id,
    'onboarding_token', v_token,
    'business_type', COALESCE(p_business_type, 'supermarket'),
    'pichin_business_profile_id', v_pichin_business_id
  );
END;
$$;

-- Backward-compatible wrappers for existing callers that don't send GPS
-- coordinates (or a business type) — same pattern the pharmacy migration
-- already established for the 7-arg signature.
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
BEGIN
  RETURN public.onboard_supermarket(
    p_name, p_description, p_phone, p_email, p_address, p_city,
    p_country, p_business_type, NULL, NULL
  );
END;
$$;

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
BEGIN
  RETURN public.onboard_supermarket(
    p_name, p_description, p_phone, p_email, p_address, p_city,
    p_country, 'supermarket', NULL, NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ onboard_supermarket now accepts p_latitude/p_longitude, and SupermarketHub.jsx can update them directly on existing stores (RLS: supermarket_owner_all already permits owner_user_id = auth.uid() writes) — dropship rider matching and mbg_find_available_riders() finally get a real pickup point instead of NULL.';
END $$;
