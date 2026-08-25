-- Pitchin business profiles are the shared authority for CMMS, Supermarketa
-- and Supplier. Reuse an existing profile an authenticated administrator can
-- manage before creating a supplier-specific duplicate.
--
-- Run after PICHIN_CROSS_APP_BUSINESS_AUTHORITY_SYNC.sql and
-- SUPPLIER_PICHIN_AUTHORITY_AND_CMMS_LINK.sql.

DROP FUNCTION IF EXISTS public.supplier_create_business_account(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.supplier_create_business_account(
  p_business_name TEXT,
  p_business_type TEXT,
  p_registration_number TEXT DEFAULT NULL,
  p_existing_business_profile_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_business_id UUID;
  v_type TEXT := lower(trim(COALESCE(p_business_type, '')));
  v_email TEXT := lower(COALESCE(auth.jwt()->>'email', ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'User is not authenticated'; END IF;
  IF NULLIF(trim(p_business_name), '') IS NULL THEN RAISE EXCEPTION 'Business name is required'; END IF;
  IF p_existing_business_profile_id IS NULL AND v_type NOT IN ('sole proprietorship', 'sole proprietor', 'sole',
                    'limited company', 'limited', 'llc', 'private limited company') THEN
    RAISE EXCEPTION 'Supplier business type must be Sole Proprietorship or Limited Company';
  END IF;

  -- An explicit setup choice always wins. Verify the same Pichin business
  -- administrator authority CMMS uses before reusing it.
  IF p_existing_business_profile_id IS NOT NULL THEN
    SELECT bp.id INTO v_business_id
      FROM public.business_profiles bp
     WHERE bp.id = p_existing_business_profile_id
       AND COALESCE(bp.status, 'active') = 'active'
       AND public.ican_business_admin(bp.id);
    IF v_business_id IS NULL THEN
      RAISE EXCEPTION 'The selected business profile is unavailable or you cannot administer it';
    END IF;
  END IF;

  -- Otherwise prefer the Pichin profile the user already administers. This includes
  -- profiles created in Pitchin, CMMS, or Supermarketa and prevents Supplier
  -- from creating a parallel identity and wallet for the same business.
  IF v_business_id IS NULL THEN
    SELECT bp.id INTO v_business_id
      FROM public.business_profiles bp
     WHERE COALESCE(bp.status, 'active') = 'active'
       AND public.ican_business_admin(bp.id)
     ORDER BY CASE WHEN lower(COALESCE(bp.metadata->>'source', '')) = 'supermarketa_supplier' THEN 0 ELSE 1 END,
              bp.created_at ASC
     LIMIT 1;
  END IF;

  IF v_business_id IS NULL THEN
    INSERT INTO public.business_profiles
      (user_id, business_name, business_type, registration_number, status, metadata)
    VALUES
      (auth.uid(), trim(p_business_name),
       CASE WHEN v_type IN ('limited company', 'limited', 'llc', 'private limited company')
            THEN 'Limited Company' ELSE 'Sole Proprietorship' END,
       NULLIF(trim(p_registration_number), ''), 'active',
       jsonb_build_object('source', 'supermarketa_supplier'))
    RETURNING id INTO v_business_id;
  END IF;

  PERFORM public.provision_business_profile_owner_access(v_business_id, auth.uid());

  RETURN v_business_id;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_create_business_account(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_create_business_account(TEXT, TEXT, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
