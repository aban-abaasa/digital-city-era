-- ========================================
-- FIX ADMIN PERMISSIONS - GRANT ADMIN ROLE
-- ========================================
-- Problem: Users can't access admin portal because role is not set to 'admin'
-- The system checks for role = 'admin' in the users table
-- Solution: Set the correct role for admin users

-- ========================================
-- STEP 1: Update your user to have 'admin' role
-- ========================================
-- Replace 'your-email@example.com' with your actual email address
UPDATE public.users
SET role = 'admin',
    is_active = true,
    email_verified = true,
    updated_at = NOW()
WHERE email = 'aronnykevin@gmail.com';

-- Verify the update worked
SELECT id, email, role, is_active, email_verified 
FROM public.users 
WHERE email = 'aronnykevin@gmail.com';

-- ========================================
-- STEP 2: Ensure any super_admin users also have admin access
-- ========================================
UPDATE public.users
SET role = 'admin'
WHERE role IN ('super_admin', 'Super Admin');

-- ========================================
-- STEP 3: View all admin users
-- ========================================
SELECT id, email, full_name, role, is_active, created_at
FROM public.users
WHERE role = 'admin'
ORDER BY created_at DESC;

-- ========================================
-- STEP 4: Check your auth status
-- ========================================
-- This just shows your auth user ID for reference
-- Make sure your email matches an entry above
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'aronnykevin@gmail.com';

-- ========================================
-- VERIFICATION NOTES
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Admin permissions fixed!';
  RAISE NOTICE '✅ Admin users now have role = ''admin''';
  RAISE NOTICE '✅ Clear browser cache (Ctrl+Shift+Delete) and reload the app';
  RAISE NOTICE '✅ If still blocked, check the SELECT results above to verify role is set correctly';
END $$;
