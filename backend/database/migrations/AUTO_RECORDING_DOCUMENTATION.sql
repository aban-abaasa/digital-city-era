-- =========================================
-- AUTO-RECORDING USER VERIFICATION GUIDE
-- =========================================
-- This documents how users are automatically recorded in both signup and login flows

-- =========================================
-- 1. EMAIL/PASSWORD SIGNUP FLOW
-- =========================================
-- Location: frontend/src/pages/AdminAuth.jsx → handleSignup()
-- Trigger: User clicks "Create Admin Account" button
-- Steps:
--   1. User submits email + password via form
--   2. Supabase auth.signUp() creates account in auth.users
--   3. INSERT into public.users with:
--      - id: auth user ID
--      - email, full_name, phone
--      - role: 'admin'
--      - is_active: true
--      - email_verified: true
--      - timestamps
--   4. If INSERT fails (user exists), UPDATE instead
--   5. Send welcome email via SendGrid
--   6. Redirect to admin dashboard
-- Result: User recorded in users table ✅

-- =========================================
-- 2. GOOGLE OAUTH SIGNIN FLOW
-- =========================================
-- Location: frontend/src/pages/AdminAuth.jsx → useEffect() (lines 85-150)
-- Trigger: User completes Google auth callback
-- Steps:
--   1. useEffect detects user.provider === 'google'
--   2. Extract email + full_name from Google metadata
--   3. INSERT into public.users with:
--      - id: auth user ID
--      - email, full_name, phone
--      - role: 'admin'
--      - is_active: true
--      - email_verified: true
--      - timestamps
--   4. If INSERT fails (user exists), UPDATE instead
--   5. Store admin session in localStorage
--   6. Redirect to admin dashboard
-- Result: User recorded in users table ✅

-- =========================================
-- 3. EMAIL/PASSWORD LOGIN FLOW
-- =========================================
-- Location: frontend/src/pages/AdminAuth.jsx → handleLogin()
-- Trigger: User logs in with email + password
-- Steps:
--   1. User submits credentials
--   2. Supabase auth.signInWithPassword() authenticates user
--   3. Check if user exists in public.users table
--   4. If NOT exists: INSERT user record with admin role
--   5. If exists but role != 'admin': UPDATE role to 'admin'
--   6. Store admin session in localStorage
--   7. Redirect to admin dashboard
-- Result: Ensures user is in users table with admin role ✅

-- =========================================
-- TESTING CHECKLIST
-- =========================================
-- Test 1: Email/Password Signup
--   ☐ Sign up with new email + password
--   ☐ Check public.users table - record should exist
--   ☐ Check role = 'admin'
--   ☐ Check email_verified = true
--   ☐ Verify welcome email sent from SendGrid
--   ☐ Admin dashboard accessible

-- Test 2: Google OAuth Signup
--   ☐ Click "Sign in with Google"
--   ☐ Complete Google OAuth flow
--   ☐ Check public.users table - record should exist
--   ☐ Check role = 'admin'
--   ☐ Check email_verified = true
--   ☐ Admin dashboard accessible

-- Test 3: Returning User Login
--   ☐ Sign out
--   ☐ Sign in with email + password
--   ☐ Check public.users table - existing record updated
--   ☐ Check role still = 'admin'
--   ☐ Admin dashboard accessible

-- =========================================
-- DATABASE SCHEMA
-- =========================================
-- All users are recorded in: public.users
-- Required columns that are auto-populated:
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,                    -- From auth.users
  email VARCHAR(255) UNIQUE NOT NULL,     -- From auth or form
  full_name VARCHAR(255),                 -- From auth metadata or form
  phone VARCHAR(50),                      -- From form or auth metadata
  role VARCHAR(50) DEFAULT 'user',        -- Set to 'admin' on signup
  is_active BOOLEAN DEFAULT TRUE,         -- Always true for new admins
  email_verified BOOLEAN DEFAULT FALSE,   -- Set to true (no confirmation needed)
  created_at TIMESTAMP WITH TIME ZONE,    -- Set to NOW()
  updated_at TIMESTAMP WITH TIME ZONE     -- Set to NOW()
);

-- =========================================
-- TROUBLESHOOTING
-- =========================================
-- Issue: User signs up but doesn't appear in public.users
-- Solution: Check browser console for error messages
--   - Look for "Could not insert user record" warnings
--   - Check Supabase RLS policies are correct
--   - Verify email is unique (no duplicate records)

-- Issue: User gets "email_verified: false" after signup
-- Solution: Already fixed - all new signups set email_verified: true

-- Issue: Google OAuth users don't get role: 'admin'
-- Solution: Already fixed - INSERT/UPDATE sets role to 'admin' automatically

-- =========================================
-- KEY IMPROVEMENTS IMPLEMENTED
-- =========================================
-- ✅ Email/Password signup auto-records users
-- ✅ Google OAuth signup auto-records users
-- ✅ Login ensures users exist in database
-- ✅ All new admins get role: 'admin'
-- ✅ Email verification set to true (no confirmation blocking)
-- ✅ Welcome emails sent via SendGrid on signup
-- ✅ User records sync to database immediately
-- ✅ Duplicate handling via INSERT OR UPDATE fallback
-- ✅ Full timestamps tracked (created_at, updated_at)
-- ✅ Phone number captured from form and auth metadata
