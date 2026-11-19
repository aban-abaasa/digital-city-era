-- Upgrade an existing local server so the first Admin can set the store name
-- and every local receipt can read it without contacting the cloud.

CREATE OR REPLACE FUNCTION public.business_local_bootstrap_owner(
  p_business_id UUID,
  p_username TEXT,
  p_display_name TEXT,
  p_pin TEXT,
  p_store_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_staff public.business_local_staff%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner setup is unavailable.');
  END IF;
  IF p_business_id IS NULL
     OR COALESCE(trim(p_username), '') !~ '^[A-Za-z0-9._-]{3,64}$'
     OR length(trim(COALESCE(p_display_name, ''))) NOT BETWEEN 1 AND 120
     OR length(trim(COALESCE(p_store_name, ''))) NOT BETWEEN 1 AND 120
     OR COALESCE(p_pin, '') !~ '^[0-9]{6,12}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a store name, valid username, display name, and 6 to 12 digit PIN.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('business-local-owner:' || p_business_id::TEXT, 0));
  IF EXISTS (
    SELECT 1 FROM public.business_local_staff
    WHERE business_id = p_business_id AND is_owner
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This local server already has its Admin account.');
  END IF;

  INSERT INTO public.business_local_staff (
    business_id, username, display_name, role, is_owner, pin_hash
  ) VALUES (
    p_business_id, lower(trim(p_username)), trim(p_display_name), 'admin', true,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
  ) RETURNING * INTO v_staff;

  INSERT INTO public.business_local_sync_meta (key, value, updated_at)
  VALUES ('store_name', trim(p_store_name), now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('success', true, 'staff', jsonb_build_object(
    'id', v_staff.id, 'businessId', v_staff.business_id,
    'username', v_staff.username, 'displayName', v_staff.display_name,
    'role', v_staff.role, 'isOwner', v_staff.is_owner
  ));
END;
$$;

DROP FUNCTION IF EXISTS public.business_local_bootstrap_owner(UUID, TEXT, TEXT, TEXT);
REVOKE ALL ON FUNCTION public.business_local_bootstrap_owner(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_local_bootstrap_owner(UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.business_local_get_store_profile()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt()->'app_metadata'->>'local_role';
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
  v_store_name TEXT;
BEGIN
  IF auth.uid() IS NULL OR v_business_id IS NULL OR v_role NOT IN ('owner', 'admin', 'cashier') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in to this local server to load its store name.');
  END IF;

  SELECT value INTO v_store_name
  FROM public.business_local_sync_meta
  WHERE key = 'store_name';

  RETURN jsonb_build_object('success', true, 'storeName', COALESCE(NULLIF(trim(v_store_name), ''), 'Your Store'));
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_get_store_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_local_get_store_profile() TO authenticated;

INSERT INTO public.business_local_sync_meta (key, value, updated_at)
VALUES ('store_name', 'Your Store', now())
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
