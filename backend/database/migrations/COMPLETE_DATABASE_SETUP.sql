-- =========================================
-- COMPLETE DATABASE MIGRATION
-- Add ALL missing columns for ALL portal types
-- Run this in your Supabase SQL Editor
-- =========================================

-- Enable UUID extension first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- First, ensure the users table exists with proper UUID generation
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drop ALL foreign key constraints that might exist
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'users' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
    END LOOP;
END $$;

-- =========================================
-- CORE AUTHENTICATION COLUMNS
-- =========================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE,
ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS password VARCHAR(255),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- =========================================
-- BASIC USER INFO COLUMNS
-- =========================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS id_number VARCHAR(50);

-- =========================================
-- EMERGENCY CONTACT COLUMNS
-- =========================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(50);

-- =========================================
-- EMPLOYEE-SPECIFIC COLUMNS
-- =========================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS position VARCHAR(100),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS availability VARCHAR(50),
ADD COLUMN IF NOT EXISTS education_level VARCHAR(100),
ADD COLUMN IF NOT EXISTS previous_experience TEXT,
ADD COLUMN IF NOT EXISTS skills TEXT;

-- =========================================
-- MANAGER-SPECIFIC COLUMNS
-- =========================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS experience_years INTEGER,
ADD COLUMN IF NOT EXISTS certifications TEXT,
ADD COLUMN IF NOT EXISTS previous_employer VARCHAR(255),
ADD COLUMN IF NOT EXISTS employee_count INTEGER;

-- =========================================
-- SUPPLIER-SPECIFIC COLUMNS
-- =========================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS business_license VARCHAR(100),
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);

-- =========================================
-- CASHIER-SPECIFIC COLUMNS
-- =========================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS shift VARCHAR(50),
ADD COLUMN IF NOT EXISTS till_experience INTEGER,
ADD COLUMN IF NOT EXISTS cash_handling_certified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS professional_references TEXT;

-- =========================================
-- INDEXES for Performance
-- =========================================
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_company_name ON users(company_name);
CREATE INDEX IF NOT EXISTS idx_users_category ON users(category);

-- =========================================
-- COLUMN COMMENTS for Documentation
-- =========================================

-- Core Auth
COMMENT ON COLUMN users.auth_id IS 'Supabase Auth user ID (for OAuth users)';
COMMENT ON COLUMN users.username IS 'Username for login (unique)';
COMMENT ON COLUMN users.password IS 'Hashed password';
COMMENT ON COLUMN users.email IS 'User email address';
COMMENT ON COLUMN users.role IS 'User role: employee, manager, supplier, cashier, admin';
COMMENT ON COLUMN users.is_active IS 'Whether user is approved and can access the system';
COMMENT ON COLUMN users.profile_completed IS 'Whether user has completed their profile';
COMMENT ON COLUMN users.submitted_at IS 'When user submitted their application';
COMMENT ON COLUMN users.approved_at IS 'When admin approved the user';
COMMENT ON COLUMN users.approved_by IS 'Admin who approved this user';

-- Basic Info
COMMENT ON COLUMN users.full_name IS 'User full name';
COMMENT ON COLUMN users.phone IS 'Phone number';
COMMENT ON COLUMN users.date_of_birth IS 'Date of birth';
COMMENT ON COLUMN users.gender IS 'Gender (male, female, other)';
COMMENT ON COLUMN users.address IS 'Physical address';
COMMENT ON COLUMN users.city IS 'City of residence';
COMMENT ON COLUMN users.id_number IS 'National ID or identification number';

-- Emergency
COMMENT ON COLUMN users.emergency_contact IS 'Emergency contact name';
COMMENT ON COLUMN users.emergency_phone IS 'Emergency contact phone';

-- Employee
COMMENT ON COLUMN users.employee_id IS 'Unique employee identifier (EMP-XXXXXX)';
COMMENT ON COLUMN users.position IS 'Job position/title';
COMMENT ON COLUMN users.department IS 'Department (for employees/managers)';
COMMENT ON COLUMN users.availability IS 'Availability (full-time, part-time, weekend)';
COMMENT ON COLUMN users.education_level IS 'Highest education level';
COMMENT ON COLUMN users.previous_experience IS 'Previous work experience';
COMMENT ON COLUMN users.skills IS 'Skills and competencies';

-- Manager
COMMENT ON COLUMN users.experience_years IS 'Years of management experience';
COMMENT ON COLUMN users.certifications IS 'Professional certifications';
COMMENT ON COLUMN users.previous_employer IS 'Previous employer name';
COMMENT ON COLUMN users.employee_count IS 'Size of team managed';

-- Supplier
COMMENT ON COLUMN users.company_name IS 'Supplier company name';
COMMENT ON COLUMN users.business_license IS 'Business license number';
COMMENT ON COLUMN users.tax_number IS 'Tax identification number';
COMMENT ON COLUMN users.category IS 'Business category (food, electronics, etc)';
COMMENT ON COLUMN users.description IS 'Business description';
COMMENT ON COLUMN users.bank_account IS 'Bank account number';
COMMENT ON COLUMN users.bank_name IS 'Bank name';

-- Cashier
COMMENT ON COLUMN users.shift IS 'Preferred work shift (morning, afternoon, evening, night)';
COMMENT ON COLUMN users.till_experience IS 'Years of cashier/till experience';
COMMENT ON COLUMN users.cash_handling_certified IS 'Whether certified in cash handling';
COMMENT ON COLUMN users.professional_references IS 'Professional references';

-- =========================================
-- PASSWORD HASHING FUNCTION & TRIGGER
-- =========================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to hash password on insert/update
CREATE OR REPLACE FUNCTION hash_user_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Set ID if not provided (shouldn't be needed but just in case)
  IF NEW.id IS NULL THEN
    NEW.id := uuid_generate_v4();
  END IF;
  
  -- Set created_at if not provided
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  
  -- Only hash if password is provided and not already hashed
  IF NEW.password IS NOT NULL AND LENGTH(NEW.password) < 60 THEN
    NEW.password := crypt(NEW.password, gen_salt('bf'));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_hash_password ON users;

-- Create trigger
CREATE TRIGGER trigger_hash_password
BEFORE INSERT OR UPDATE OF password ON users
FOR EACH ROW
EXECUTE FUNCTION hash_user_password();

-- =========================================
-- UPDATE EXISTING RECORDS
-- =========================================

-- Mark existing users with data as profile_completed
UPDATE users 
SET profile_completed = true 
WHERE role = 'employee' 
  AND (position IS NOT NULL OR department IS NOT NULL)
  AND profile_completed = false;

UPDATE users 
SET profile_completed = true 
WHERE role = 'supplier' 
  AND company_name IS NOT NULL 
  AND profile_completed = false;

UPDATE users 
SET profile_completed = true 
WHERE role = 'manager' 
  AND department IS NOT NULL 
  AND profile_completed = false;

UPDATE users 
SET profile_completed = true 
WHERE role = 'cashier' 
  AND shift IS NOT NULL 
  AND profile_completed = false;

-- =========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================

-- IMPORTANT: For development/testing, you can disable RLS entirely
-- Just comment out the line below and uncomment the DISABLE line
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;  -- Use this for testing

-- Drop all existing policies first
DROP POLICY IF EXISTS "Allow public signups" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Enable insert for anon" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON users;
DROP POLICY IF EXISTS "Enable read for all" ON users;
DROP POLICY IF EXISTS "Enable update for users" ON users;

-- Policy 1: Allow anonymous users to sign up (INSERT)
CREATE POLICY "Enable insert for anon"
ON users FOR INSERT
TO anon
WITH CHECK (true);

-- Policy 2: Allow authenticated users to sign up (INSERT)
CREATE POLICY "Enable insert for authenticated"
ON users FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: Allow everyone to read all users (for now - simplify)
-- In production, you'd want more restrictive policies
CREATE POLICY "Enable read for all"
ON users FOR SELECT
TO anon, authenticated
USING (true);

-- Policy 4: Allow users to update their own data
CREATE POLICY "Enable update for users"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- Policy 5: Allow service role full access (bypass RLS for backend)
-- This is automatically handled by Supabase service_role key

-- =========================================
-- PASSWORD VERIFICATION FUNCTION FOR LOGIN
-- =========================================

-- Function to verify password during login
CREATE OR REPLACE FUNCTION verify_password(p_username VARCHAR, p_password VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  stored_password VARCHAR;
BEGIN
  -- Get the hashed password for the username
  SELECT password INTO stored_password
  FROM users
  WHERE username = p_username
  LIMIT 1;
  
  -- If user not found, return false
  IF stored_password IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Compare the provided password with stored hash
  RETURN (stored_password = crypt(p_password, stored_password));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- VERIFICATION QUERIES
-- =========================================

-- Check all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY column_name;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users'
ORDER BY indexname;

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'users';

-- =========================================
-- SUCCESS MESSAGE
-- =========================================
DO $$
BEGIN
  RAISE NOTICE '✅ MIGRATION COMPLETE!';
  RAISE NOTICE '✅ All columns added successfully';
  RAISE NOTICE '✅ All indexes created';
  RAISE NOTICE '✅ Password hashing trigger active';
  RAISE NOTICE '✅ RLS policies configured';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Your database is now ready!';
  RAISE NOTICE '📋 Run the verification queries above to confirm';
END $$;
