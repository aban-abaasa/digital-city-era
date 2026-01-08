-- =========================================
-- DELETE ALL USERS - COMPLETE CLEANUP
-- =========================================
-- WARNING: This will permanently delete all users from the database
-- Use only for development/testing environments

-- =========================================
-- STEP 1: Delete from public.users table
-- =========================================
DELETE FROM public.users;

-- Verify deletion
SELECT COUNT(*) as remaining_users FROM public.users;

-- =========================================
-- STEP 2: Reset sequence (if applicable)
-- =========================================
-- This resets the auto-increment counter if using serial IDs
-- For UUID columns, this is not needed
ALTER SEQUENCE IF EXISTS public.users_id_seq RESTART WITH 1;

-- =========================================
-- STEP 3: Truncate for faster deletion (alternative)
-- =========================================
-- Uncomment below if DELETE doesn't work or for faster cleanup
-- TRUNCATE TABLE public.users CASCADE;

-- =========================================
-- NOTE: Deleting from auth.users requires special access
-- Supabase Auth users can only be deleted via Supabase Dashboard
-- Go to: Authentication → Users → Select user → Delete
-- Or use Supabase CLI: supabase auth users delete <user_id>
-- =========================================
