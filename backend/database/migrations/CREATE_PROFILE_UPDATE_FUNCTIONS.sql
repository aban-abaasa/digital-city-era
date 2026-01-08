-- =========================================
-- RPC FUNCTION FOR MANAGER PROFILE UPDATES
-- Handles profile completion and synchronization
-- =========================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.update_manager_profile_complete(
  p_manager_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_department TEXT,
  p_location TEXT,
  p_languages TEXT,
  p_avatar TEXT
) CASCADE;

-- Create the function to update manager profile
CREATE OR REPLACE FUNCTION public.update_manager_profile_complete(
  p_manager_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_department TEXT,
  p_location TEXT DEFAULT NULL,
  p_languages TEXT DEFAULT NULL,
  p_avatar TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_profile_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_manager_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Manager ID is required'
    );
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Full name is required'
    );
  END IF;

  -- Update users table
  UPDATE public.users
  SET 
    full_name = p_full_name,
    phone = p_phone,
    department = p_department,
    updated_at = NOW()
  WHERE id = p_manager_id AND role = 'manager';

  -- Check if manager profile exists
  SELECT EXISTS (
    SELECT 1 FROM public.manager_profiles 
    WHERE manager_id = p_manager_id
  ) INTO v_profile_exists;

  -- If profile exists, update it; otherwise insert new one
  IF v_profile_exists THEN
    UPDATE public.manager_profiles
    SET 
      full_name = p_full_name,
      phone = p_phone,
      department = p_department,
      location = COALESCE(p_location, location),
      languages = COALESCE(p_languages, languages),
      avatar = COALESCE(p_avatar, avatar),
      updated_at = NOW()
    WHERE manager_id = p_manager_id;
  ELSE
    INSERT INTO public.manager_profiles (
      manager_id,
      full_name,
      phone,
      department,
      location,
      languages,
      avatar,
      employee_id,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_manager_id,
      p_full_name,
      p_phone,
      p_department,
      COALESCE(p_location, 'Kampala, Uganda'),
      COALESCE(p_languages, 'English'),
      COALESCE(p_avatar, '👨‍💼'),
      'MGR-' || SUBSTRING(p_manager_id::TEXT, 1, 8),
      'active',
      NOW(),
      NOW()
    );
  END IF;

  v_result := jsonb_build_object(
    'success', TRUE,
    'message', 'Profile updated successfully',
    'manager_id', p_manager_id,
    'profile_exists', v_profile_exists
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Profile update failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_manager_profile_complete(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

-- =========================================
-- RPC FUNCTION FOR CASHIER PROFILE UPDATES
-- =========================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.update_cashier_profile_complete(
  p_cashier_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_shift TEXT,
  p_location TEXT,
  p_languages TEXT,
  p_avatar TEXT
) CASCADE;

-- Create the function to update cashier profile
CREATE OR REPLACE FUNCTION public.update_cashier_profile_complete(
  p_cashier_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_shift TEXT,
  p_location TEXT DEFAULT NULL,
  p_languages TEXT DEFAULT NULL,
  p_avatar TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_profile_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_cashier_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Cashier ID is required'
    );
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Full name is required'
    );
  END IF;

  -- Update users table
  UPDATE public.users
  SET 
    full_name = p_full_name,
    phone = p_phone,
    updated_at = NOW()
  WHERE id = p_cashier_id AND role = 'cashier';

  -- Check if cashier profile exists
  SELECT EXISTS (
    SELECT 1 FROM public.cashier_profiles 
    WHERE cashier_id = p_cashier_id
  ) INTO v_profile_exists;

  -- If profile exists, update it; otherwise insert new one
  IF v_profile_exists THEN
    UPDATE public.cashier_profiles
    SET 
      full_name = p_full_name,
      phone = p_phone,
      shift = p_shift,
      location = COALESCE(p_location, location),
      languages = COALESCE(p_languages, languages),
      avatar = COALESCE(p_avatar, avatar),
      updated_at = NOW()
    WHERE cashier_id = p_cashier_id;
  ELSE
    INSERT INTO public.cashier_profiles (
      cashier_id,
      full_name,
      phone,
      shift,
      location,
      languages,
      avatar,
      employee_id,
      department,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_cashier_id,
      p_full_name,
      p_phone,
      p_shift,
      COALESCE(p_location, 'Kampala, Uganda'),
      COALESCE(p_languages, 'English'),
      COALESCE(p_avatar, '🛒'),
      'CSH-' || SUBSTRING(p_cashier_id::TEXT, 1, 8),
      'Front End Operations',
      'active',
      NOW(),
      NOW()
    );
  END IF;

  v_result := jsonb_build_object(
    'success', TRUE,
    'message', 'Profile updated successfully',
    'cashier_id', p_cashier_id,
    'profile_exists', v_profile_exists
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Profile update failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_cashier_profile_complete(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

-- =========================================
-- RPC FUNCTION FOR SUPPLIER PROFILE UPDATES
-- =========================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.update_supplier_profile_complete(
  p_supplier_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_company_name TEXT,
  p_location TEXT,
  p_languages TEXT,
  p_avatar TEXT
) CASCADE;

-- Create the function to update supplier profile
CREATE OR REPLACE FUNCTION public.update_supplier_profile_complete(
  p_supplier_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_company_name TEXT,
  p_location TEXT DEFAULT NULL,
  p_languages TEXT DEFAULT NULL,
  p_avatar TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_profile_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_supplier_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Supplier ID is required'
    );
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Full name is required'
    );
  END IF;

  -- Update users table
  UPDATE public.users
  SET 
    full_name = p_full_name,
    phone = p_phone,
    company_name = p_company_name,
    updated_at = NOW()
  WHERE id = p_supplier_id AND role = 'supplier';

  -- Check if supplier profile exists
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_profiles 
    WHERE supplier_id = p_supplier_id
  ) INTO v_profile_exists;

  -- If profile exists, update it; otherwise insert new one
  IF v_profile_exists THEN
    UPDATE public.supplier_profiles
    SET 
      full_name = p_full_name,
      phone = p_phone,
      company_name = p_company_name,
      location = COALESCE(p_location, location),
      languages = COALESCE(p_languages, languages),
      avatar = COALESCE(p_avatar, avatar),
      updated_at = NOW()
    WHERE supplier_id = p_supplier_id;
  ELSE
    INSERT INTO public.supplier_profiles (
      supplier_id,
      full_name,
      phone,
      company_name,
      location,
      languages,
      avatar,
      employee_id,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_supplier_id,
      p_full_name,
      p_phone,
      p_company_name,
      COALESCE(p_location, 'Kampala, Uganda'),
      COALESCE(p_languages, 'English'),
      COALESCE(p_avatar, '🏪'),
      'SUP-' || SUBSTRING(p_supplier_id::TEXT, 1, 8),
      'active',
      NOW(),
      NOW()
    );
  END IF;

  v_result := jsonb_build_object(
    'success', TRUE,
    'message', 'Profile updated successfully',
    'supplier_id', p_supplier_id,
    'profile_exists', v_profile_exists
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Profile update failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_supplier_profile_complete(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

COMMIT;
