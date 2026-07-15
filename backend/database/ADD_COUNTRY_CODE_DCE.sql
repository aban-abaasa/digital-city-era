-- ============================================================================
-- ADD: country_code column on public.users, populated from signup metadata
-- ============================================================================
-- All 5 signup flows in frontend/src/pages/Register.jsx (customer, employee,
-- manager, admin, supplier) now collect a required "country" field and pass
-- it as `options.data.country` to supabase.auth.signUp(). This extends the
-- app's own namespaced trigger (handle_new_user_dce, see
-- FIX_AUTO_SIGNUP_TRIGGER_NAMESPACE_DCE.sql) to copy that value into
-- public.users.country_code, so every account created for this app carries
-- the country regardless of which Register.jsx tab was used.
--
-- Run this in digital-city-era's Supabase SQL editor, after
-- FIX_AUTO_SIGNUP_TRIGGER_NAMESPACE_DCE.sql has already been applied.
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country_code TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user_dce()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_full_name TEXT;
  v_country_code TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_country_code := COALESCE(NEW.raw_user_meta_data->>'country', NULL);

  INSERT INTO public.users (
    id, auth_id, email, full_name, role, is_active, country_code, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.id, NEW.email, v_full_name, 'customer', true, v_country_code, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    auth_id = COALESCE(public.users.auth_id, EXCLUDED.auth_id),
    country_code = COALESCE(public.users.country_code, EXCLUDED.country_code),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let a bug here block the user's account creation (or any other
    -- app's signup trigger firing on the same auth.users insert).
    RAISE LOG 'handle_new_user_dce error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Trigger itself is unchanged (still on_auth_user_created_dce -> this
-- function), just re-asserting it here since CREATE OR REPLACE FUNCTION
-- above doesn't require re-creating the trigger, but this keeps the file
-- runnable standalone.
DROP TRIGGER IF EXISTS on_auth_user_created_dce ON auth.users;
CREATE TRIGGER on_auth_user_created_dce
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_dce();

DO $$
BEGIN
  RAISE NOTICE '✅ public.users.country_code added and handle_new_user_dce now populates it from signup metadata.';
END $$;
