-- =========================================
-- AUTO-CREATE USERS ON SIGNUP TRIGGER
-- =========================================
-- This trigger automatically creates a user record in the users table
-- whenever a new user signs up via Supabase Auth

-- Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    true,
    NEW.email_confirmed_at IS NOT NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- AUTO-UPDATE USER ON AUTH CHANGES
-- =========================================
-- Update user record when email verification status changes
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Create the trigger for updates
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_update();

-- =========================================
-- AUTO-LOG SIGNUP ACTIVITY
-- =========================================
-- Automatically create activity log when user signs up
CREATE OR REPLACE FUNCTION public.log_user_signup()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.admin_activity_log (
    id,
    admin_id,
    activity_type,
    activity_description,
    status,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    'signup',
    'Admin account created: ' || COALESCE(NEW.full_name, NEW.email),
    'success',
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_user_signup ON public.users;

-- Create the trigger for signup logging
CREATE TRIGGER on_user_signup
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION public.log_user_signup();

-- =========================================
-- SUCCESS MESSAGE
-- =========================================
DO $$
BEGIN
  RAISE NOTICE '✅ AUTO-SIGNUP TRIGGERS CREATED!';
  RAISE NOTICE '✅ Users will be auto-created when they sign up via Supabase Auth';
  RAISE NOTICE '✅ Activity logs will be auto-created for admin signups';
  RAISE NOTICE '✅ Email verification status will be synced automatically';
END $$;
