-- Store business identity and supplier operations.
--
-- A Supermarketa store is a distinct business even when its owner already has
-- another Pichin business profile. Pichin's business-profile trigger creates a
-- dedicated ican_business_wallets row for each new profile. A store may instead
-- explicitly link to an existing profile through the merge option below.

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS supports_supply_orders BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_receive_supplier_orders BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_dispatch_supplier_orders BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.supermarkets
SET supports_supply_orders = TRUE,
    can_receive_supplier_orders = TRUE,
    can_dispatch_supplier_orders = TRUE
WHERE business_type IN ('wholesale', 'hardware', 'factory');

ALTER TABLE public.business_profiles
  DROP CONSTRAINT IF EXISTS business_profiles_user_id_key,
  ADD COLUMN IF NOT EXISTS legal_structure TEXT NOT NULL DEFAULT 'sole_proprietorship',
  ADD COLUMN IF NOT EXISTS source_app TEXT NOT NULL DEFAULT 'pichin',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_into_business_profile_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL;

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.business_profiles'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(user_id)%'
  LOOP
    EXECUTE format('ALTER TABLE public.business_profiles DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_business_profiles_supermarket
  ON public.business_profiles(supermarket_id);

CREATE INDEX IF NOT EXISTS idx_business_profiles_merged_into
  ON public.business_profiles(merged_into_business_profile_id);

-- Register a store's Pichin business identity. The default is a new profile;
-- p_merge_existing = true deliberately opts into sharing an existing profile
-- and therefore its existing business wallet.
CREATE OR REPLACE FUNCTION public.create_store_business_account(
  p_supermarket_id UUID,
  p_business_name TEXT,
  p_business_type TEXT DEFAULT 'supermarket',
  p_existing_business_profile_id UUID DEFAULT NULL,
  p_merge_existing BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
    INSERT INTO public.business_profiles (
      user_id, business_name, sector, legal_structure, source_app,
      supermarket_id, status, metadata
    ) VALUES (
      v_auth_id, v_profile_name,
      COALESCE(NULLIF(trim(p_business_type), ''), 'supermarket'),
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

  IF to_regclass('public.business_app_links') IS NOT NULL AND NOT p_merge_existing THEN
    INSERT INTO public.business_app_links (
      business_profile_id, app_key, source_entity_id, linked_by, status, metadata
    ) VALUES (
      v_profile_id, 'supermarketa', p_supermarket_id, v_auth_id, 'active',
      jsonb_build_object('mode', CASE WHEN p_merge_existing THEN 'merged' ELSE 'new_store_account' END)
    )
    ON CONFLICT (business_profile_id, app_key) DO UPDATE SET
      source_entity_id = EXCLUDED.source_entity_id,
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

REVOKE ALL ON FUNCTION public.create_store_business_account(UUID, TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_business_account(UUID, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;
