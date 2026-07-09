-- =========================================
-- FIX AUTO-SIGNUP TRIGGER FOR SHARED SUPABASE
-- Version 2 - Simplified and Fixed
-- =========================================

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_update() CASCADE;

-- =========================================
-- CREATE AUTO-SIGNUP FUNCTION
-- =========================================
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
BEGIN
  -- Extract name from metadata or email
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_first_name := split_part(v_full_name, ' ', 1);
  v_last_name := NULLIF(regexp_replace(v_full_name, '^[^ ]+ ', ''), '');
  
  -- Extract or default role
  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'customer';
  END;
  
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
  
  -- Insert role if not exists (handle UNIQUE constraint properly)
  BEGIN
    INSERT INTO public.user_roles (
      user_id,
      role,
      supermarket_id,
      permissions
    )
    VALUES (
      NEW.id,
      v_role,
      NULL,
      '{}'::jsonb
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Role already exists, do nothing
      NULL;
  END;
  
  RAISE NOTICE 'Auto-created/updated user: % with role: %', NEW.email, v_role;
  
  RETURN NEW;
END;
$$;

-- =========================================
-- CREATE UPDATE FUNCTION
-- =========================================
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

-- =========================================
-- CREATE TRIGGERS
-- =========================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_update();

-- =========================================
-- BACKFILL EXISTING AUTH USERS
-- =========================================
DO $$
DECLARE
  auth_user RECORD;
  v_first_name VARCHAR(100);
  v_last_name VARCHAR(100);
  v_full_name TEXT;
  v_role user_role;
  users_created INTEGER := 0;
  roles_created INTEGER := 0;
BEGIN
  FOR auth_user IN SELECT * FROM auth.users LOOP
    -- Check if user already exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth_user.id) THEN
      -- Extract name
      v_full_name := COALESCE(auth_user.raw_user_meta_data->>'full_name', split_part(auth_user.email, '@', 1));
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name := NULLIF(regexp_replace(v_full_name, '^[^ ]+ ', ''), '');
      
      -- Insert user
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
        auth_user.id,
        auth_user.email,
        v_first_name,
        v_last_name,
        'active',
        auth_user.email_confirmed_at IS NOT NULL,
        'digital_city',
        auth_user.created_at,
        NOW()
      );
      
      users_created := users_created + 1;
    END IF;
    
    -- Check if user has a role
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth_user.id) THEN
      -- Extract role
      BEGIN
        v_role := (auth_user.raw_user_meta_data->>'role')::user_role;
      EXCEPTION WHEN OTHERS THEN
        v_role := 'customer';
      END;
      
      -- Insert role
      BEGIN
        INSERT INTO public.user_roles (
          user_id,
          role,
          supermarket_id,
          permissions
        )
        VALUES (
          auth_user.id,
          v_role,
          NULL,
          '{}'::jsonb
        );
        
        roles_created := roles_created + 1;
      EXCEPTION
        WHEN unique_violation THEN
          -- Already exists, skip
          NULL;
      END;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ AUTO-SIGNUP TRIGGERS CREATED!';
  RAISE NOTICE '✅ Created % new user records', users_created;
  RAISE NOTICE '✅ Created % new role assignments', roles_created;
  RAISE NOTICE '✅ Total users in system: %', (SELECT COUNT(*) FROM public.users);
  RAISE NOTICE '✅ Default role for new users: customer';
  RAISE NOTICE '✅ This application can now share Supabase with other applications';
END $$;
