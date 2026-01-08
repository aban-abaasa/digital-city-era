-- =========================================
-- MANAGER REGISTRATION RPC FUNCTION
-- Fixes function overloading issue
-- =========================================

-- Ensure pgcrypto extension is enabled (for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop both old function versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.register_manager(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_department TEXT
);

DROP FUNCTION IF EXISTS public.register_manager(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_department TEXT,
  p_assigned_supplier_id UUID
);

-- Create SINGLE unambiguous function that handles both cases
CREATE OR REPLACE FUNCTION public.register_manager(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_department TEXT,
  p_assigned_supplier_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_hashed_password TEXT;
  v_username_exists BOOLEAN;
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

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Full name is required'
    );
  END IF;

  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Phone number is required'
    );
  END IF;

  IF p_department IS NULL OR p_department = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Department is required'
    );
  END IF;

  -- Check if username already exists
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE username = p_username
  ) INTO v_username_exists;

  IF v_username_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Username already taken'
    );
  END IF;

  -- Hash password using bcrypt
  v_hashed_password := crypt(p_password, gen_salt('bf'));

  -- Create the user record
  INSERT INTO public.users (
    username,
    password,
    full_name,
    phone,
    department,
    role,
    is_active,
    profile_completed,
    submitted_at
  ) VALUES (
    p_username,
    v_hashed_password,
    p_full_name,
    p_phone,
    p_department,
    'manager',
    FALSE,
    FALSE,
    NOW()
  )
  RETURNING id INTO v_user_id;

  -- Return success response
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Manager registered successfully',
    'user_id', v_user_id,
    'username', p_username
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Registration failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users (for signup)
GRANT EXECUTE ON FUNCTION public.register_manager(
  TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) TO anon, authenticated;
