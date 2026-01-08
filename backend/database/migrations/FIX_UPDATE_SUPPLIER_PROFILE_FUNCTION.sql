-- =========================================
-- SUPPLIER PROFILE UPDATE RPC FUNCTION
-- Handles profile completion after OAuth signup
-- =========================================

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.update_supplier_profile_on_submission(
  p_auth_id UUID,
  p_full_name TEXT,
  p_company_name TEXT,
  p_phone TEXT,
  p_address TEXT
) CASCADE;

-- Create the function to update supplier profile on submission
CREATE OR REPLACE FUNCTION public.update_supplier_profile_on_submission(
  p_auth_id UUID,
  p_full_name TEXT,
  p_company_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_business_license TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_admin_id UUID;
  v_admin_email TEXT;
  v_admin_available BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_auth_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Authentication ID is required'
    );
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Full name is required'
    );
  END IF;

  IF p_company_name IS NULL OR p_company_name = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Company name is required'
    );
  END IF;

  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Phone number is required'
    );
  END IF;

  IF p_address IS NULL OR p_address = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Address is required'
    );
  END IF;

  -- Find the user by auth_id
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = p_auth_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User not found. Please try signing up again.'
    );
  END IF;

  -- Get an available admin to assign (just get the first admin)
  SELECT u.id, u.email INTO v_admin_id, v_admin_email
  FROM public.users u
  WHERE u.role = 'admin'
  AND u.is_active = TRUE
  LIMIT 1;

  -- Check if admin is available
  v_admin_available := (v_admin_id IS NOT NULL);

  -- Update user profile
  UPDATE public.users
  SET
    full_name = p_full_name,
    company_name = p_company_name,
    phone = p_phone,
    address = p_address,
    business_license = COALESCE(p_business_license, business_license),
    category = COALESCE(p_category, category),
    role = 'supplier',
    profile_completed = TRUE,
    is_active = FALSE,  -- Pending admin approval
    submitted_at = NOW()
  WHERE id = v_user_id;

  -- Return success with admin assignment info
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Supplier profile submitted successfully',
    'user_id', v_user_id,
    'company_name', p_company_name,
    'assigned_admin_id', v_admin_id,
    'assigned_admin_email', v_admin_email,
    'admin_available', v_admin_available,
    'profile_completed', TRUE,
    'is_active', FALSE,
    'pending_approval', TRUE
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Profile update failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_supplier_profile_on_submission(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;
