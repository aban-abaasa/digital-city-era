-- Add manager-specific profile fields to users table
-- Run this in your Supabase SQL Editor

-- Add personal and professional columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS experience_years INTEGER,
ADD COLUMN IF NOT EXISTS education_level VARCHAR(50),
ADD COLUMN IF NOT EXISTS certifications TEXT,
ADD COLUMN IF NOT EXISTS previous_employer VARCHAR(255),
ADD COLUMN IF NOT EXISTS employee_count INTEGER,
ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_experience ON users(experience_years);

-- Update existing manager records to have profile_completed = true if they have department
UPDATE users 
SET profile_completed = true 
WHERE role = 'manager' 
  AND department IS NOT NULL 
  AND profile_completed = false;

COMMENT ON COLUMN users.date_of_birth IS 'Manager date of birth';
COMMENT ON COLUMN users.gender IS 'Manager gender';
COMMENT ON COLUMN users.address IS 'Manager residential address';
COMMENT ON COLUMN users.city IS 'Manager city';
COMMENT ON COLUMN users.department IS 'Manager department (Sales, Operations, etc)';
COMMENT ON COLUMN users.experience_years IS 'Years of management experience';
COMMENT ON COLUMN users.education_level IS 'Highest education level achieved';
COMMENT ON COLUMN users.certifications IS 'Professional certifications (PMP, MBA, etc)';
COMMENT ON COLUMN users.previous_employer IS 'Previous company worked for';
COMMENT ON COLUMN users.employee_count IS 'Number of employees managed';
COMMENT ON COLUMN users.emergency_contact IS 'Emergency contact name';
COMMENT ON COLUMN users.emergency_phone IS 'Emergency contact phone';
COMMENT ON COLUMN users.profile_completed IS 'Whether manager has completed their profile';
COMMENT ON COLUMN users.submitted_at IS 'When the manager submitted their profile';
COMMENT ON COLUMN users.approved_at IS 'When the manager was approved by admin';
COMMENT ON COLUMN users.approved_by IS 'Admin user who approved the manager';
