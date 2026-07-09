-- =========================================
-- FIX AUTO-SIGNUP TRIGGER FOR SHARED SUPABASE
-- =========================================
-- This ensures users from any application using the same Supabase
-- are automatically created in the users table when they authenticate

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_first_name VARCHAR(100);
  v_last_name VARCHAR(100);
  v_full_name TEXT;
  v_role user_role;
  v_user_id UUID;
BEGIN
  -- Extract name from metadata or email
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_first_name := split_part(v_full_name, ' ', 1);
  v_last_name := NULLIF(substring(v_full_name from position(' ' in v_full_name) + 1), '');
  
  -- Extract or default role
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer');
  
  -- Insert or update user record
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status,
    email_verified,
    portal,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    'active',
    NEW.email_confirmed_at IS NOT NULL,
    'digital_city',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();
  
  -- Insert role in user_roles table if not exists
  INSERT INTO public.user_roles (
    id,
    user_id,
    role,
    supermarket_id,
    permissions
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    v_role,
    NULL,  -- Global role
    '{}'::jsonb
  )
  ON CONFLICT (user_id, role, COALESCE(supermarket_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
  DO NOTHING;
  
  RAISE NOTICE 'Auto-created/updated user: % with role: %', NEW.email, v_role;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates (email verification changes)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_update();

CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    email_verified = NEW.email_confirmed_at IS NOT NULL,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_update();

-- =========================================
-- BACKFILL EXISTING AUTH USERS
-- =========================================
-- This ensures any existing auth users are added to the users table
INSERT INTO public.users (
  id,
  email,
  first_name,
  last_name,
  status,
  email_verified,
  portal,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  split_part(COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)), ' ', 1),
  NULLIF(substring(COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) from position(' ' in COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1))) + 1), ''),
  'active',
  au.email_confirmed_at IS NOT NULL,
  'digital_city',
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  email_verified = EXCLUDED.email_verified,
  updated_at = NOW();

-- Backfill roles for existing users
INSERT INTO public.user_roles (
  id,
  user_id,
  role,
  supermarket_id,
  permissions
)
SELECT
  gen_random_uuid(),
  au.id,
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'customer'),
  NULL,
  '{}'::jsonb
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id
)
ON CONFLICT (user_id, role, COALESCE(supermarket_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
DO NOTHING;

-- =========================================
-- SUCCESS MESSAGE
-- =========================================
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count FROM public.users;
  
  RAISE NOTICE '✅ AUTO-SIGNUP TRIGGERS UPDATED!';
  RAISE NOTICE '✅ Users will be auto-created when they sign up via Supabase Auth';
  RAISE NOTICE '✅ Existing auth users have been backfilled';
  RAISE NOTICE '✅ Total users in system: %', backfilled_count;
  RAISE NOTICE '✅ Default role for new users: customer';
  RAISE NOTICE '✅ This application can now share Supabase with other applications';
END $$;
