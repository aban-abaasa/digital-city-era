/*
╔════════════════════════════════════════════════════════════╗
║  REQUIRED SQL FIXES - RUN IN SUPABASE SQL EDITOR           ║
║  https://supabase.com/dashboard/project/[your-project]    ║
╚════════════════════════════════════════════════════════════╝
*/

-- STEP 1: Make email column nullable (CRITICAL FIX)
-- This allows registration without email
ALTER TABLE users 
ALTER COLUMN email DROP NOT NULL;

-- STEP 2: Add default value for email
ALTER TABLE users
ALTER COLUMN email SET DEFAULT '';

-- STEP 3: Update existing NULL emails to empty string
UPDATE users 
SET email = '' 
WHERE email IS NULL;

-- STEP 4: Verify the fix worked
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) as users_without_email,
  SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as users_with_email
FROM users;

-- STEP 5: Test registration after fix is applied
-- This will be run from PowerShell after you apply the SQL:
-- node test-registration.js
