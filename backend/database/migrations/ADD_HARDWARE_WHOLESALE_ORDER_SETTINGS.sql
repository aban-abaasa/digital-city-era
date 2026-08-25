-- Add Hardware business mode and wholesale ordering controls.
-- Run after ADD_WHOLESALE_BUSINESS_MODE.sql.

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS wholesale_categories TEXT[] NOT NULL DEFAULT ARRAY['Products']::TEXT[],
  ADD COLUMN IF NOT EXISTS wholesale_pricing_mode TEXT NOT NULL DEFAULT 'supplier_price';

ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.supermarkets DROP CONSTRAINT IF EXISTS supermarkets_business_type_check;
ALTER TABLE public.supermarkets
  ADD CONSTRAINT supermarkets_business_type_check CHECK (business_type IN
    ('supermarket', 'pharmacy', 'hotel', 'boutique', 'restaurant_cafe', 'wholesale', 'hardware', 'factory'));

ALTER TABLE public.supermarkets DROP CONSTRAINT IF EXISTS supermarkets_wholesale_pricing_mode_check;
ALTER TABLE public.supermarkets
  ADD CONSTRAINT supermarkets_wholesale_pricing_mode_check CHECK (wholesale_pricing_mode IN ('admin_price', 'supplier_price'));

CREATE OR REPLACE FUNCTION public.onboard_supermarket(
  p_name TEXT, p_description TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL, p_address TEXT DEFAULT NULL, p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL, p_business_type TEXT DEFAULT 'supermarket'
)
RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE
  v_auth_id UUID := auth.uid(); v_existing_id UUID; v_new_id UUID; v_token UUID;
  v_internal_user_id UUID; v_pichin_business_id UUID;
BEGIN
  IF v_auth_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NULLIF(trim(p_name), '') IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Store name is required'); END IF;
  IF COALESCE(p_business_type, '') NOT IN ('supermarket', 'pharmacy', 'hotel', 'boutique', 'restaurant_cafe', 'wholesale', 'hardware', 'factory') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid business type');
  END IF;
  SELECT id INTO v_existing_id FROM public.supermarkets WHERE owner_user_id = v_auth_id LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN jsonb_build_object('success', true, 'supermarket_id', v_existing_id, 'already_existed', true); END IF;
  v_token := gen_random_uuid();
  SELECT id INTO v_pichin_business_id FROM public.business_profiles WHERE user_id = v_auth_id ORDER BY created_at ASC LIMIT 1;
  INSERT INTO public.supermarkets
    (name, description, phone, email, address, city, country, owner_user_id, onboarding_token, is_active,
     business_type, pichin_business_profile_id, created_at, updated_at)
  VALUES (trim(p_name), p_description, p_phone, p_email, p_address, p_city, p_country, v_auth_id, v_token, true,
    COALESCE(p_business_type, 'supermarket'), v_pichin_business_id, now(), now()) RETURNING id INTO v_new_id;
  SELECT id INTO v_internal_user_id FROM public.users WHERE auth_id = v_auth_id OR id = v_auth_id LIMIT 1;
  IF v_internal_user_id IS NOT NULL THEN
    UPDATE public.users SET role = 'admin', supermarket_id = v_new_id, updated_at = now() WHERE id = v_internal_user_id;
  END IF;
  IF v_pichin_business_id IS NOT NULL AND to_regclass('public.business_app_links') IS NOT NULL THEN
    INSERT INTO public.business_app_links (business_profile_id, app_key, source_entity_id, linked_by, metadata)
    VALUES (v_pichin_business_id, 'supermarketa', v_new_id, v_auth_id, jsonb_build_object('business_type', COALESCE(p_business_type, 'supermarket')))
    ON CONFLICT (app_key, source_entity_id) DO UPDATE SET
      business_profile_id = excluded.business_profile_id,
      status = 'active', metadata = public.business_app_links.metadata || excluded.metadata, updated_at = now();
  END IF;
  RETURN jsonb_build_object('success', true, 'supermarket_id', v_new_id, 'onboarding_token', v_token,
    'business_type', COALESCE(p_business_type, 'supermarket'), 'pichin_business_profile_id', v_pichin_business_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
