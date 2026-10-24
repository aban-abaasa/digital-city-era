-- ============================================================================
-- Give every admin a store — including admins promoted after signup
-- ----------------------------------------------------------------------------
-- trigger_create_supermarket_for_admin only fires BEFORE INSERT on public.users,
-- so an account whose role was changed to 'admin' later never got a store.
-- Those admins have no store name, no store website and no team to manage.
--
-- 1. Backfill: link or create a store for every admin that has none.
-- 2. Trigger: do the same whenever a user is promoted to admin from now on.
-- Safe to run more than once.
-- ============================================================================

-- Returns the store an admin should be attached to: an existing, valid link;
-- else a store they already own; else a brand-new one.
CREATE OR REPLACE FUNCTION public.ensure_store_for_admin(p_user public.users)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  IF p_user.supermarket_id IS NOT NULL THEN
    SELECT id INTO v_store_id FROM public.supermarkets WHERE id = p_user.supermarket_id;
    IF v_store_id IS NOT NULL THEN
      RETURN v_store_id;
    END IF;
  END IF;

  IF p_user.auth_id IS NOT NULL THEN
    SELECT id INTO v_store_id
    FROM public.supermarkets
    WHERE owner_user_id = p_user.auth_id
    ORDER BY created_at
    LIMIT 1;
    IF v_store_id IS NOT NULL THEN
      RETURN v_store_id;
    END IF;
  END IF;

  INSERT INTO public.supermarkets (
    name, location, phone, address, is_active, owner_user_id, created_at, updated_at
  )
  VALUES (
    COALESCE(NULLIF(p_user.full_name, ''), SPLIT_PART(p_user.email, '@', 1)) || '''s Supermarket',
    'Location pending',
    p_user.phone,
    'Address pending',
    true,
    p_user.auth_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_store_id;

  RETURN v_store_id;
END;
$$;

-- 1. Backfill every admin whose link is missing or points at a deleted store.
DO $$
DECLARE
  adm public.users;
  v_store_id UUID;
BEGIN
  FOR adm IN
    SELECT u.*
    FROM public.users u
    WHERE u.role = 'admin'
      AND (
        u.supermarket_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.supermarkets s WHERE s.id = u.supermarket_id)
      )
  LOOP
    v_store_id := public.ensure_store_for_admin(adm);

    UPDATE public.users SET supermarket_id = v_store_id WHERE id = adm.id;
    UPDATE public.unified_profiles SET supermarket_id = v_store_id WHERE user_id = adm.id;
  END LOOP;
END $$;

-- 2. Promotion to admin (role changed on an existing user) gets a store too.
CREATE OR REPLACE FUNCTION public.attach_store_on_admin_promotion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.supermarket_id := public.ensure_store_for_admin(NEW);

  UPDATE public.unified_profiles
  SET supermarket_id = NEW.supermarket_id,
      updated_at = NOW()
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_attach_store_on_admin_promotion ON public.users;

CREATE TRIGGER trigger_attach_store_on_admin_promotion
  BEFORE UPDATE OF role ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'admin' AND OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.attach_store_on_admin_promotion();
