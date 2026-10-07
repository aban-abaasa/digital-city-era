-- ===========================================================================
-- FIX: creating a store fails.
--
-- 1) onboard_supermarket() and create_store_business_account() write
--    business_app_links with ON CONFLICT (business_profile_id, app_key), but
--    the table only has unique indexes on (app_key, source_entity_id) and
--    (business_profile_id, app_key, source_entity_id). Postgres rejects the
--    statement ("there is no unique or exclusion constraint matching the ON
--    CONFLICT specification"), so the whole store setup rolls back for anyone
--    who already has a Pichin business profile. A store is one
--    (app_key, source_entity_id) row, so that is the correct conflict target.
-- 2) create_store_business_account() inserts a business_profiles.sector column
--    that does not exist here; it now writes business_type instead.
-- 3) onboard_supermarket() existed as 7-, 8- and 10-argument overloads. The
--    API (PostgREST) calls functions by parameter NAME, and every call shape
--    matches more than one overload through defaults, so it answers "Could not
--    choose the best candidate function". The 7- and 8-argument versions were
--    only wrappers; they are dropped, and the one 10-argument function (all
--    extra parameters default) serves every caller.
--
-- This blocked store setup for admins whose store was deleted but who still
-- own a Pichin profile, and left them on "Your account is not linked to a
-- store yet" in the Supermarketa admin portal.
--
-- Only the conflict target changes; everything else is the live definition.
-- Safe to re-run. No Edge Function or frontend redeploy needed for this file.
-- ===========================================================================

DROP FUNCTION IF EXISTS public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.onboard_supermarket(
  p_name          TEXT,
  p_description   TEXT    DEFAULT NULL,
  p_phone         TEXT    DEFAULT NULL,
  p_email         TEXT    DEFAULT NULL,
  p_address       TEXT    DEFAULT NULL,
  p_city          TEXT    DEFAULT NULL,
  p_country       TEXT    DEFAULT NULL,
  p_business_type TEXT    DEFAULT 'supermarket',
  p_latitude      NUMERIC DEFAULT NULL,
  p_longitude     NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    ON CONFLICT (app_key, source_entity_id) DO UPDATE
      SET business_profile_id = EXCLUDED.business_profile_id,
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

CREATE OR REPLACE FUNCTION public.create_store_business_account(
  p_supermarket_id               UUID,
  p_business_name                TEXT,
  p_business_type                TEXT    DEFAULT 'supermarket',
  p_existing_business_profile_id UUID    DEFAULT NULL,
  p_merge_existing               BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_store public.supermarkets;
  v_profile_id UUID;
  v_profile_name TEXT := COALESCE(NULLIF(trim(p_business_name), ''), 'Supermarketa store');
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_store
  FROM public.supermarkets
  WHERE id = p_supermarket_id
    AND owner_user_id = v_auth_id
  FOR UPDATE;

  IF v_store.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not own this store');
  END IF;

  IF p_merge_existing THEN
    IF p_existing_business_profile_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Choose a business profile to merge');
    END IF;

    SELECT id INTO v_profile_id
    FROM public.business_profiles
    WHERE id = p_existing_business_profile_id
      AND (user_id = v_auth_id OR user_id IN (
        SELECT id FROM public.users WHERE auth_id = v_auth_id
      ));

    IF v_profile_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'The selected business profile is not owned by you');
    END IF;
  ELSE
    -- business_profiles has no "sector" column here; business_type holds the
    -- legal-structure label (same value separate_supermarketa_pichin_business
    -- uses). The store's own type stays in metadata.
    INSERT INTO public.business_profiles (
      user_id, business_name, business_type, legal_structure, source_app,
      supermarket_id, status, metadata
    ) VALUES (
      v_auth_id, v_profile_name, 'Sole Proprietorship',
      'sole_proprietorship', 'supermarketa', p_supermarket_id,
      'active', jsonb_build_object('created_for_store', p_supermarket_id,
                                   'business_type', p_business_type)
    )
    RETURNING id INTO v_profile_id;
  END IF;

  UPDATE public.supermarkets
  SET pichin_business_profile_id = v_profile_id,
      supports_supply_orders = supports_supply_orders OR p_business_type IN ('wholesale', 'hardware', 'factory'),
      can_receive_supplier_orders = can_receive_supplier_orders OR p_business_type IN ('wholesale', 'hardware', 'factory'),
      can_dispatch_supplier_orders = can_dispatch_supplier_orders OR p_business_type IN ('wholesale', 'hardware', 'factory'),
      updated_at = now()
  WHERE id = p_supermarket_id;

  IF to_regclass('public.business_co_owners') IS NOT NULL THEN
    INSERT INTO public.business_co_owners (
      business_profile_id, owner_name, owner_email, user_id,
      ownership_share, role, status, verification_status
    )
    SELECT v_profile_id,
           COALESCE(auth.jwt() ->> 'email', 'Store owner'),
           auth.jwt() ->> 'email', v_auth_id, 100, 'owner', 'active', 'verified'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.business_co_owners
      WHERE business_profile_id = v_profile_id AND user_id = v_auth_id
    );
  END IF;

  -- A store has exactly one link row, so a new store account replaces whatever
  -- profile onboard_supermarket() attached first.
  IF to_regclass('public.business_app_links') IS NOT NULL AND NOT p_merge_existing THEN
    INSERT INTO public.business_app_links (
      business_profile_id, app_key, source_entity_id, linked_by, status, metadata
    ) VALUES (
      v_profile_id, 'supermarketa', p_supermarket_id, v_auth_id, 'active',
      jsonb_build_object('mode', CASE WHEN p_merge_existing THEN 'merged' ELSE 'new_store_account' END)
    )
    ON CONFLICT (app_key, source_entity_id) DO UPDATE SET
      business_profile_id = EXCLUDED.business_profile_id,
      status = 'active', metadata = EXCLUDED.metadata, updated_at = now();
  END IF;

  -- Pichin's AFTER INSERT trigger creates this automatically for a new profile.
  -- The RPC fallback keeps deployments that have not installed that trigger
  -- functional without ever touching the owner's personal wallet.
  IF NOT p_merge_existing AND to_regclass('public.ican_business_wallets') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.ican_business_wallets (business_profile_id, created_by)
             VALUES ($1, $2) ON CONFLICT (business_profile_id) DO NOTHING'
      USING v_profile_id, v_auth_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'supermarket_id', p_supermarket_id,
    'business_profile_id', v_profile_id,
    'merged', p_merge_existing,
    'legal_structure', CASE WHEN p_merge_existing THEN NULL ELSE 'sole_proprietorship' END,
    'wallet_scope', 'business_profile'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_business_account(UUID, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
