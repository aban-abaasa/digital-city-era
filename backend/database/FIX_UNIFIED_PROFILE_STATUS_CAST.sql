-- ============================================================================
-- FIX: "new row for relation unified_profiles violates check constraint
-- unified_profiles_status_check" (Postgres error 23514)
-- ============================================================================
-- CAUSE: create_unified_profile() — a trigger that fires after every INSERT
-- into public.users — casts the boolean is_active column straight to text
-- (NEW.is_active::TEXT), producing the literal string 'true'/'false'. But
-- unified_profiles.status has CHECK (status IN ('active', 'inactive',
-- 'suspended', 'pending')), which 'true'/'false' never satisfy. Any insert
-- into users with is_active set (which is a perfectly normal thing to set)
-- fails here.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_unified_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.unified_profiles (
    user_id,
    full_name,
    email,
    phone,
    role,
    supermarket_id,
    status,
    onboarding_step,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.full_name,
    NEW.email,
    NEW.phone,
    NEW.role,
    NEW.supermarket_id,
    CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    supermarket_id = EXCLUDED.supermarket_id,
    updated_at = NOW();

  -- Create onboarding progress record
  INSERT INTO public.onboarding_progress (
    user_id,
    role,
    current_step,
    total_steps,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.role,
    0,
    CASE
      WHEN NEW.role = 'admin' THEN 6
      WHEN NEW.role IN ('manager', 'cashier') THEN 5
      WHEN NEW.role = 'customer' THEN 4
      ELSE 3
    END,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE '✅ Unified profile created for user: %', NEW.email;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ create_unified_profile() now maps is_active to a valid status string.';
END $$;
