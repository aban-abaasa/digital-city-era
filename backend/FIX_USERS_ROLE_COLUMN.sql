-- =============================================================================
-- FIX_USERS_ROLE_COLUMN.sql  (digital-city-era app only)
-- Run once in Supabase SQL Editor
-- =============================================================================

-- 1. Show current users table columns so we can verify before/after
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Add missing columns (idempotent)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id  UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role     TEXT DEFAULT 'customer';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supermarket_id UUID;

-- 3. Seed auth_id from id where auth_id is still null.
--    In this project users.id stores the Supabase auth UUID directly.
UPDATE public.users
SET auth_id = id
WHERE auth_id IS NULL;

-- 4. Unique index on auth_id (skip if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON public.users(auth_id);

-- 5. Backfill role = 'admin' for anyone who owns a supermarket
UPDATE public.users u
SET role = 'admin'
FROM public.supermarkets sm
WHERE sm.owner_user_id = u.auth_id
  AND (u.role IS NULL OR u.role != 'admin');

-- 6. Backfill supermarket_id for those owners
UPDATE public.users u
SET supermarket_id = sm.id
FROM public.supermarkets sm
WHERE sm.owner_user_id = u.auth_id
  AND u.supermarket_id IS NULL;

-- 7. Confirm result
SELECT id, auth_id, role, supermarket_id
FROM public.users
ORDER BY created_at DESC
LIMIT 20;
