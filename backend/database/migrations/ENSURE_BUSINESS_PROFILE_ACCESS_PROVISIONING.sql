-- Keep access to a business profile in sync with profile creation.
--
-- Business profiles can be created by Supermarketa, CMMS, or the supplier
-- marketplace.  Previously, only some UI paths created the membership rows
-- that the other applications use to authorize their administrators.  That
-- left newly created profiles linked to a store, but inaccessible from CMMS
-- and the shared business-management area.

CREATE OR REPLACE FUNCTION public.provision_business_profile_owner_access(
  p_business_profile_id UUID,
  p_auth_user_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_user_email TEXT;
  v_user_name TEXT;
  v_member_auth_user_id UUID := p_auth_user_id;
BEGIN
  IF p_business_profile_id IS NULL OR p_auth_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT email, COALESCE(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
  INTO v_email, v_name
  FROM auth.users
  WHERE id = p_auth_user_id;

  -- `username` is not present in every deployed users schema. `full_name`
  -- and `email` are the stable profile fields, and the final name fallback
  -- below covers accounts that have neither.
  SELECT email, full_name
  INTO v_user_email, v_user_name
  FROM public.users
  WHERE auth_id = p_auth_user_id OR id = p_auth_user_id
  ORDER BY CASE WHEN auth_id = p_auth_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT COALESCE(auth_id, id)
  INTO v_member_auth_user_id
  FROM public.users
  WHERE auth_id = p_auth_user_id OR id = p_auth_user_id
  ORDER BY CASE WHEN auth_id = p_auth_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  v_member_auth_user_id := COALESCE(v_member_auth_user_id, p_auth_user_id);

  v_email := COALESCE(v_email, v_user_email);
  v_name := COALESCE(v_name, v_user_name);

  v_name := COALESCE(NULLIF(trim(v_name), ''), NULLIF(split_part(COALESCE(v_email, ''), '@', 1), ''), 'Business administrator');

  -- This is the authority row used by CMMS and wallet administration.
  IF to_regclass('public.business_co_owners') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        INSERT INTO public.business_co_owners
          (business_profile_id, owner_name, owner_email, user_id, ownership_share, role, status, verification_status)
        SELECT $1, $2, $3, $4, 100, ''owner'', ''active'', ''verified''
        WHERE NOT EXISTS (
          SELECT 1 FROM public.business_co_owners
          WHERE business_profile_id = $1 AND user_id = $4
        )'
      USING p_business_profile_id, v_name, v_email, v_member_auth_user_id;
    EXCEPTION WHEN undefined_column OR not_null_violation THEN
      -- Older shared-database deployments can have a narrower co-owner table.
      -- Their existing profile owner is still preserved; the next migration can
      -- add the optional metadata columns without blocking signup.
      NULL;
    END;
  END IF;

  -- This is the shared business-management membership read by Supermarketa.
  IF to_regclass('public.business_account_members') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        INSERT INTO public.business_account_members
          (business_profile_id, auth_user_id, employment_status, job_title, permissions, invited_by, joined_at)
        SELECT $1, $2, ''active'', ''Administrator'',
               ''{"manage_business": true, "manage_payroll": true, "manage_transport": true}'',
               $2, now()
        WHERE NOT EXISTS (
          SELECT 1 FROM public.business_account_members
          WHERE business_profile_id = $1 AND auth_user_id = $2
        )'
      USING p_business_profile_id, v_member_auth_user_id;
    EXCEPTION WHEN undefined_column OR not_null_violation THEN
      NULL;
    END;
  END IF;

  -- Supplier and CMMS screens commonly resolve profiles through active team
  -- membership.  Add it when that optional shared table is installed.
  IF to_regclass('public.business_team_members') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        INSERT INTO public.business_team_members (business_profile_id, user_id, role, status)
        SELECT $1, $2, ''admin'', ''active''
        WHERE NOT EXISTS (
          SELECT 1 FROM public.business_team_members
          WHERE business_profile_id = $1 AND user_id = $2
        )'
      USING p_business_profile_id, v_member_auth_user_id;
    EXCEPTION WHEN undefined_column OR not_null_violation THEN
      NULL;
    END;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_business_profile_owner_access(UUID, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.on_business_profile_created_grant_access()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.provision_business_profile_owner_access(NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_profile_owner_access_trigger ON public.business_profiles;
CREATE TRIGGER business_profile_owner_access_trigger
AFTER INSERT ON public.business_profiles
FOR EACH ROW EXECUTE FUNCTION public.on_business_profile_created_grant_access();

-- Backfill profiles made before this migration. The function is idempotent,
-- so it is also safe to re-run during deployments.
DO $$
DECLARE
  profile RECORD;
BEGIN
  FOR profile IN SELECT id, user_id FROM public.business_profiles WHERE user_id IS NOT NULL LOOP
    PERFORM public.provision_business_profile_owner_access(profile.id, profile.user_id);
  END LOOP;
END;
$$;
