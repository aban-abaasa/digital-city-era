-- Add supplier-specific profile fields to users table
-- Run this in your Supabase SQL Editor

-- Add company and business columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS business_license VARCHAR(100),
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed);
CREATE INDEX IF NOT EXISTS idx_users_company_name ON users(company_name);
CREATE INDEX IF NOT EXISTS idx_users_category ON users(category);

-- Update existing supplier records to have profile_completed = true if they have company_name
UPDATE users 
SET profile_completed = true 
WHERE role = 'supplier' 
  AND company_name IS NOT NULL 
  AND profile_completed = false;

COMMENT ON COLUMN users.company_name IS 'Supplier company name';
COMMENT ON COLUMN users.business_license IS 'Business license number';
COMMENT ON COLUMN users.tax_number IS 'Tax identification number';
COMMENT ON COLUMN users.category IS 'Business category (food, electronics, etc)';
COMMENT ON COLUMN users.description IS 'Business description';
COMMENT ON COLUMN users.bank_account IS 'Bank account number';
COMMENT ON COLUMN users.bank_name IS 'Bank name';
COMMENT ON COLUMN users.profile_completed IS 'Whether supplier has completed their profile';
COMMENT ON COLUMN users.submitted_at IS 'When the supplier submitted their profile';
COMMENT ON COLUMN users.approved_at IS 'When the supplier was approved by admin';
COMMENT ON COLUMN users.approved_by IS 'Admin user who approved the supplier';
