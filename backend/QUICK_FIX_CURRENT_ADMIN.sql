-- ============================================================================
-- QUICK FIX: Assign Supermarket to Current Admin
-- ============================================================================
-- This is a quick fix for the specific admin that's currently getting blocked
-- Run this to immediately fix the issue
-- ============================================================================

-- ============================================================================
-- OPTION 1: Find and show the admin without supermarket_id
-- ============================================================================
SELECT 
  id,
  auth_id,
  email,
  full_name,
  role,
  supermarket_id,
  created_at
FROM public.users
WHERE role = 'admin' 
  AND supermarket_id IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- OPTION 2: Create a supermarket for this admin
-- ============================================================================
-- Replace 'admin@example.com' with the actual admin's email
DO $$
DECLARE
  v_admin_id UUID;
  v_admin_auth_id UUID;
  v_admin_email TEXT;
  v_admin_name TEXT;
  v_supermarket_id UUID;
  v_supermarket_name TEXT;
BEGIN
  -- Get the first admin without supermarket_id
  SELECT id, auth_id, email, full_name
  INTO v_admin_id, v_admin_auth_id, v_admin_email, v_admin_name
  FROM public.users
  WHERE role = 'admin' AND supermarket_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE NOTICE '✅ No admins found without supermarket_id';
    RETURN;
  END IF;
  
  -- Generate supermarket name
  v_supermarket_name := COALESCE(
    NULLIF(v_admin_name, ''),
    split_part(v_admin_email, '@', 1)
  ) || '''s Supermarket';
  
  -- Create the supermarket
  INSERT INTO public.supermarkets (name, location, is_active, owner_user_id, created_at, updated_at)
  VALUES (
    v_supermarket_name,
    'Location to be updated',
    TRUE,
    v_admin_auth_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_supermarket_id;
  
  -- Assign the supermarket to the admin
  UPDATE public.users
  SET supermarket_id = v_supermarket_id,
      updated_at = NOW()
  WHERE id = v_admin_id;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SUCCESS!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin: %', v_admin_email;
  RAISE NOTICE 'Supermarket created: % (ID: %)', v_supermarket_name, v_supermarket_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'The admin can now access the Manager Portal!';
  RAISE NOTICE 'They should refresh their browser to reload user data.';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- OPTION 3: Assign admin to an EXISTING supermarket
-- ============================================================================
-- If you want to assign the admin to a supermarket that already exists
-- Uncomment and modify this:

/*
UPDATE public.users
SET supermarket_id = 'YOUR-SUPERMARKET-UUID-HERE',
    updated_at = NOW()
WHERE email = 'admin@example.com'  -- Replace with actual admin email
  AND role = 'admin';
*/

-- ============================================================================
-- VERIFY THE FIX
-- ============================================================================
SELECT 
  u.email,
  u.full_name,
  u.role,
  s.id AS supermarket_id,
  s.name AS supermarket_name,
  s.location AS supermarket_location
FROM public.users u
LEFT JOIN public.supermarkets s ON s.id = u.supermarket_id
WHERE u.role = 'admin'
  AND u.supermarket_id IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================================================
-- INSTRUCTIONS FOR THE ADMIN:
-- ============================================================================
-- After running this script:
-- 1. Tell the admin to LOG OUT completely
-- 2. Clear browser cache or use Ctrl+Shift+R (hard refresh)
-- 3. LOG IN again
-- 4. The supermarket_id will now be in their session
-- 5. They can switch to Manager Portal and create orders successfully!
-- ============================================================================
