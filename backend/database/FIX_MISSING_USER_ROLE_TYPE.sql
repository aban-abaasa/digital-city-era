-- ============================================================================
-- FIX: "type user_role does not exist" (Postgres error 42704)
-- ============================================================================
-- CAUSE: The auto-signup trigger (FIX_AUTO_SIGNUP_TRIGGER_V2.sql) casts the
-- role from signup metadata with `::user_role`, and inserts into
-- public.user_roles.role — but the `user_role` enum type itself (defined in
-- DEPLOYMENT_READY_20M_SUPERMARKETS.sql, the shared Digital City Era + ICAN
-- schema) was apparently never created. Every new signup — including a user
-- who already exists in this shared Supabase project from another app —
-- hits this trigger and fails.
--
-- This creates the enum only if missing (safe to run even if it partially
-- exists already), matching the canonical definition.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM (
      'admin',           -- Supermarket admin
      'manager',         -- Supermarket manager
      'cashier',         -- POS operator
      'supplier',        -- Product supplier
      'customer',        -- End customer
      'entrepreneur',    -- ICAN business owner
      'grant_reviewer'   -- ICAN grant reviewer
    );
    RAISE NOTICE '✅ Created missing type: user_role';
  ELSE
    RAISE NOTICE '✓ user_role type already exists';
  END IF;
END $$;

-- The same trigger/schema also expect these — create them too if missing,
-- so a fresh signup doesn't immediately hit the same class of error again.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE public.user_status AS ENUM (
      'active', 'inactive', 'suspended', 'pending_verification',
      'pending_admin_activation', 'blocked'
    );
    RAISE NOTICE '✅ Created missing type: user_status';
  ELSE
    RAISE NOTICE '✓ user_status type already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_type') THEN
    CREATE TYPE public.portal_type AS ENUM ('digital_city', 'ican', 'both');
    RAISE NOTICE '✅ Created missing type: portal_type';
  ELSE
    RAISE NOTICE '✓ portal_type type already exists';
  END IF;
END $$;
