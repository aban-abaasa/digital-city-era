/*
╔════════════════════════════════════════════════════════════╗
║  FIX EMAIL UNIQUE CONSTRAINT - RUN IN SUPABASE SQL EDITOR  ║
╚════════════════════════════════════════════════════════════╝
*/

-- STEP 1: Drop the UNIQUE constraint on email column
-- This allows multiple users to have the same email (or empty/NULL)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- STEP 2: Verify constraint is removed
-- SELECT constraint_name 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'users' AND constraint_type = 'UNIQUE';
-- Result should NOT show users_email_key
