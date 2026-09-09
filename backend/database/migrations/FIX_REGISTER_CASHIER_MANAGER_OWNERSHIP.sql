-- ============================================================================
-- FIX REGISTER_CASHIER: MANAGER-OWNED CASHIER INVITATION
-- Replaces the old username/password-based version, which referenced
-- columns (username, password, shift, profile_completed) that do not exist
-- on the live public.users table and produced rows that could never log in
-- (this app authenticates exclusively via Supabase Auth).
--
-- New behavior: a manager "registers" a cashier as a pending invite row
-- (is_active = FALSE, auth_id = NULL, manager_id/supermarket_id set from
-- the calling manager's own profile). The cashier completes their own
-- Supabase Auth signup at /employee-auth using this exact email, which
-- attaches auth_id to this same row instead of creating a duplicate.
-- Requires ADD_MANAGER_ID_TO_USERS.sql to have been run first.
-- ============================================================================

DROP FUNCTION IF EXISTS public.register_cashier(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.register_cashier(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.register_cashier(TEXT, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.register_cashier(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_manager_id UUID;
  v_manager_supermarket_id UUID;
  v_new_user_id UUID;
BEGIN
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Full name is required');
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Email is required');
  END IF;

  -- Resolve the calling manager from their own session — never trust a
  -- client-supplied manager/supermarket id.
  SELECT id, supermarket_id INTO v_manager_id, v_manager_supermarket_id
  FROM public.users
  WHERE (id = auth.uid() OR auth_id = auth.uid())
    AND role = 'manager'
    AND is_active = TRUE;

  IF v_manager_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only an active manager can register a cashier');
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'A user with this email already exists');
  END IF;

  INSERT INTO public.users (
    email, full_name, phone, role, supermarket_id, manager_id,
    is_active, email_verified
  ) VALUES (
    p_email, p_full_name, p_phone, 'employee', v_manager_supermarket_id, v_manager_id,
    FALSE, FALSE
  )
  RETURNING id INTO v_new_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Cashier invited. They must sign up with this exact email to activate their login.',
    'user_id', v_new_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', 'Registration failed: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_cashier(TEXT, TEXT, TEXT) TO authenticated;
