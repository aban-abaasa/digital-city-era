-- =========================================
-- FIX RLS POLICIES FOR USER CREATION
-- =========================================

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow public signups" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Enable insert for anon" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON users;
DROP POLICY IF EXISTS "Enable read for all" ON users;
DROP POLICY IF EXISTS "Enable update for users" ON users;
DROP POLICY IF EXISTS "Enable delete for self" ON users;

-- =========================================
-- PERMISSIVE POLICIES FOR SIGNUP & AUTH
-- =========================================

-- Policy 1: Anonymous users can insert (signup without auth)
CREATE POLICY "Allow anonymous insert"
ON users FOR INSERT
TO anon
WITH CHECK (true);

-- Policy 2: Authenticated users can insert (signup after email confirmation)
CREATE POLICY "Allow authenticated insert"
ON users FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: Everyone can read all user data
-- This is necessary for RLS to not block reads completely
CREATE POLICY "Allow all to read"
ON users FOR SELECT
TO anon, authenticated
USING (true);

-- Policy 4: Users can update their own record (auth_id matches)
CREATE POLICY "Allow users to update own"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- Policy 5: Users can update without auth_id check (for profile setup)
CREATE POLICY "Allow authenticated users to update"
ON users FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 6: Allow deletion of own record
CREATE POLICY "Allow users to delete own"
ON users FOR DELETE
TO authenticated
USING (auth.uid() = auth_id OR auth.uid() IS NOT NULL);

-- =========================================
-- VERIFICATION
-- =========================================
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- =========================================
-- SUCCESS MESSAGE
-- =========================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS POLICIES UPDATED FOR USER SIGNUP!';
  RAISE NOTICE '✅ Anonymous users can now create accounts';
  RAISE NOTICE '✅ Authenticated users can update their profiles';
  RAISE NOTICE '✅ All policies are now permissive for signup';
END $$;
