-- =========================================
-- CUSTOM LOGIN RPC FUNCTION
-- Validates username/password without Supabase Auth
-- =========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop old version if exists
DROP FUNCTION IF EXISTS public.login_user(TEXT, TEXT) CASCADE;

-- Create single function for all roles
CREATE OR REPLACE FUNCTION public.login_user(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_is_active BOOLEAN;
  v_profile_completed BOOLEAN;
  v_stored_password TEXT;
  v_full_name TEXT;
  v_password_match BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_username IS NULL OR p_username = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Username is required'
    );
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Password is required'
    );
  END IF;

  -- Get user by username
  SELECT id, password, role, is_active, profile_completed, full_name
  INTO v_user_id, v_stored_password, v_user_role, v_is_active, v_profile_completed, v_full_name
  FROM public.users
  WHERE username = p_username
  LIMIT 1;

  -- Check if user exists
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid username or password'
    );
  END IF;

  -- Verify password using bcrypt
  v_password_match := (v_stored_password = crypt(p_password, v_stored_password));

  IF NOT v_password_match THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid username or password'
    );
  END IF;

  -- Check if user is active
  IF NOT v_is_active THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Account is pending admin approval',
      'pending_approval', TRUE
    );
  END IF;

  -- Return success with user details
  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', v_user_id,
    'username', p_username,
    'full_name', v_full_name,
    'role', v_user_role,
    'is_active', v_is_active,
    'profile_completed', v_profile_completed
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Login failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to all users
GRANT EXECUTE ON FUNCTION public.login_user(TEXT, TEXT) TO anon, authenticated;
