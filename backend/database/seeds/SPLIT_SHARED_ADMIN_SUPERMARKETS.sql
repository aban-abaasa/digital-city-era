-- ============================================================================
-- SPLIT SHARED ADMIN SUPERMARKETS (one-time data fix)
-- ============================================================================
-- Existing admin accounts created before the onboard_supermarket fix are
-- still sharing a single supermarket. This gives every admin their own,
-- separate, independent supermarket:
--   - If several admins share one supermarket, the earliest-created admin
--     keeps it; every other admin in that group gets a brand-new one.
--   - Any admin with no supermarket at all gets a brand-new one too.
-- Nothing is deleted. Only public.users.supermarket_id and
-- public.unified_profiles.supermarket_id are reassigned for admins whose
-- accounts get split off — managers/cashiers/customers are untouched.
-- Safe to re-run (a second run finds nothing left to split).
-- ============================================================================

DO $$
DECLARE
  admin_rec RECORD;
  new_supermarket_id UUID;
  new_name TEXT;
BEGIN
  -- Split every admin except the earliest one out of each shared supermarket
  FOR admin_rec IN
    SELECT u.id AS user_id, u.auth_id, u.email, u.full_name,
           ROW_NUMBER() OVER (PARTITION BY u.supermarket_id ORDER BY u.created_at ASC) AS rn
    FROM public.users u
    WHERE u.role = 'admin' AND u.supermarket_id IS NOT NULL
  LOOP
    IF admin_rec.rn = 1 THEN
      CONTINUE;
    END IF;

    new_name := COALESCE(NULLIF(admin_rec.full_name, ''), split_part(admin_rec.email, '@', 1)) || '''s Supermarket';

    INSERT INTO public.supermarkets (name, location, address, is_active, owner_user_id, created_at, updated_at)
    VALUES (new_name, 'Location pending', 'Address pending', true, admin_rec.auth_id, NOW(), NOW())
    RETURNING id INTO new_supermarket_id;

    UPDATE public.users
    SET supermarket_id = new_supermarket_id, updated_at = NOW()
    WHERE id = admin_rec.user_id;

    UPDATE public.unified_profiles
    SET supermarket_id = new_supermarket_id, business_name = new_name, updated_at = NOW()
    WHERE user_id = admin_rec.user_id;

    RAISE NOTICE 'Split admin % into new supermarket % (%)', admin_rec.email, new_supermarket_id, new_name;
  END LOOP;

  -- Admins with no supermarket at all yet
  FOR admin_rec IN
    SELECT id AS user_id, auth_id, email, full_name
    FROM public.users
    WHERE role = 'admin' AND supermarket_id IS NULL
  LOOP
    new_name := COALESCE(NULLIF(admin_rec.full_name, ''), split_part(admin_rec.email, '@', 1)) || '''s Supermarket';

    INSERT INTO public.supermarkets (name, location, address, is_active, owner_user_id, created_at, updated_at)
    VALUES (new_name, 'Location pending', 'Address pending', true, admin_rec.auth_id, NOW(), NOW())
    RETURNING id INTO new_supermarket_id;

    UPDATE public.users
    SET supermarket_id = new_supermarket_id, updated_at = NOW()
    WHERE id = admin_rec.user_id;

    UPDATE public.unified_profiles
    SET supermarket_id = new_supermarket_id, business_name = new_name, updated_at = NOW()
    WHERE user_id = admin_rec.user_id;

    RAISE NOTICE 'Created supermarket % (%) for admin % who had none', new_supermarket_id, new_name, admin_rec.email;
  END LOOP;

  -- Backfill owner_user_id on the supermarkets each remaining/kept admin
  -- owns, if it isn't set yet — every supermarket now has exactly one admin
  -- attached via users.supermarket_id, so this can't collide.
  UPDATE public.supermarkets s
  SET owner_user_id = u.auth_id, updated_at = NOW()
  FROM public.users u
  WHERE u.role = 'admin' AND u.supermarket_id = s.id AND s.owner_user_id IS NULL;
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Every admin now has their own separate supermarket.';
  RAISE NOTICE '📋 Verify with: SELECT u.email, u.supermarket_id, s.name FROM public.users u JOIN public.supermarkets s ON s.id = u.supermarket_id WHERE u.role = ''admin'' ORDER BY u.created_at;';
END $$;
