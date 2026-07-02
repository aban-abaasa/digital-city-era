-- ============================================================================
-- FIX: assign_staff_with_blockchain / revoke_staff_with_blockchain trusted
-- client-supplied p_admin_id / p_supermarket_id with NO server-side check
-- that the caller actually is the admin of that supermarket. Any
-- authenticated user (customer, cashier, another admin) could call these
-- directly and reassign or wipe any user's role in any supermarket —
-- including turning strangers into staff of a store they don't own, or
-- resetting another admin's role to 'customer'. This is very likely a
-- contributor to the admin-account cross-contamination already fixed by
-- SPLIT_SHARED_ADMIN_SUPERMARKETS.sql.
--
-- Both are rewritten to derive the caller's identity from auth.uid() and
-- verify supermarket ownership server-side before doing anything, and to
-- refuse to touch an admin account.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_staff_with_blockchain(
  p_supermarket_id  UUID,
  p_admin_id        UUID,
  p_target_auth_id  UUID,
  p_role            TEXT
) RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_caller      RECORD;
  v_prev_hash   TEXT;
  v_block_hash  TEXT;
  v_payload     JSONB;
  v_pub_id      UUID;
  v_target_role TEXT;
BEGIN
  SELECT id, role, supermarket_id INTO v_caller
  FROM public.users WHERE auth_id = auth.uid();

  IF v_caller IS NULL OR v_caller.role <> 'admin' OR v_caller.supermarket_id IS DISTINCT FROM p_supermarket_id THEN
    RAISE EXCEPTION 'Not authorized to assign staff for this supermarket';
  END IF;

  IF p_role NOT IN ('manager', 'cashier', 'customer', 'supplier') THEN
    RAISE EXCEPTION 'Invalid role for staff assignment: %', p_role;
  END IF;

  SELECT id, role INTO v_pub_id, v_target_role
  FROM public.users
  WHERE auth_id = p_target_auth_id OR id = p_target_auth_id
  LIMIT 1;

  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot reassign an admin account via staff assignment';
  END IF;

  IF v_pub_id IS NULL THEN
    INSERT INTO public.users (id, auth_id, role, is_active, supermarket_id)
    VALUES (p_target_auth_id, p_target_auth_id, p_role, TRUE, p_supermarket_id)
    ON CONFLICT DO NOTHING;
    v_pub_id := p_target_auth_id;
  END IF;

  UPDATE public.users
  SET role = p_role, is_active = TRUE, supermarket_id = p_supermarket_id, updated_at = now()
  WHERE id = v_pub_id;

  IF p_role IN ('manager', 'cashier', 'staff') THEN
    INSERT INTO public.supermarket_staff (supermarket_id, user_id, role, status, assigned_by)
    VALUES (p_supermarket_id, v_pub_id, p_role, 'active', v_caller.id)
    ON CONFLICT (supermarket_id, user_id)
    DO UPDATE SET role = p_role, status = 'active', assigned_by = v_caller.id, updated_at = now();
  ELSE
    DELETE FROM public.supermarket_staff
    WHERE supermarket_id = p_supermarket_id AND user_id = v_pub_id;
  END IF;

  SELECT block_hash INTO v_prev_hash
  FROM public.staff_access_ledger
  ORDER BY block_number DESC LIMIT 1;

  v_payload := jsonb_build_object(
    'supermarket_id', p_supermarket_id,
    'admin_id',       v_caller.id,
    'user_id',        v_pub_id,
    'role',           p_role,
    'ts',             now()
  );

  v_block_hash := encode(
    extensions.digest(
      (COALESCE(v_prev_hash, 'genesis') || v_payload::TEXT)::bytea,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.staff_access_ledger
    (supermarket_id, admin_id, target_user_id, action, previous_hash, block_hash, payload)
  VALUES
    (p_supermarket_id, v_caller.id, v_pub_id, 'assign_' || p_role, v_prev_hash, v_block_hash, v_payload);

  RETURN v_block_hash;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assign_staff_with_blockchain(UUID, UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_staff_with_blockchain(
  p_supermarket_id  UUID,
  p_admin_id        UUID,
  p_target_auth_id  UUID
) RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_caller     RECORD;
  v_prev_hash  TEXT;
  v_block_hash TEXT;
  v_payload    JSONB;
  v_pub_id     UUID;
  v_old_role   TEXT;
BEGIN
  SELECT id, role, supermarket_id INTO v_caller
  FROM public.users WHERE auth_id = auth.uid();

  IF v_caller IS NULL OR v_caller.role <> 'admin' OR v_caller.supermarket_id IS DISTINCT FROM p_supermarket_id THEN
    RAISE EXCEPTION 'Not authorized to revoke staff for this supermarket';
  END IF;

  SELECT id, role INTO v_pub_id, v_old_role
  FROM public.users
  WHERE auth_id = p_target_auth_id OR id = p_target_auth_id
  LIMIT 1;

  IF v_pub_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_old_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot revoke an admin account via staff revocation';
  END IF;

  -- Only touch users who actually belong to the caller's own supermarket
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = v_pub_id AND supermarket_id = p_supermarket_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this supermarket';
  END IF;

  UPDATE public.users
  SET role = 'customer', updated_at = now()
  WHERE id = v_pub_id;

  DELETE FROM public.supermarket_staff
  WHERE supermarket_id = p_supermarket_id AND user_id = v_pub_id;

  SELECT block_hash INTO v_prev_hash
  FROM public.staff_access_ledger
  ORDER BY block_number DESC LIMIT 1;

  v_payload := jsonb_build_object(
    'supermarket_id', p_supermarket_id,
    'admin_id',       v_caller.id,
    'user_id',        v_pub_id,
    'revoked_role',   COALESCE(v_old_role, 'unknown'),
    'ts',             now()
  );

  v_block_hash := encode(
    extensions.digest(
      (COALESCE(v_prev_hash, 'genesis') || v_payload::TEXT)::bytea,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.staff_access_ledger
    (supermarket_id, admin_id, target_user_id, action, previous_hash, block_hash, payload)
  VALUES
    (p_supermarket_id, v_caller.id, v_pub_id, 'revoke_' || COALESCE(v_old_role, 'role'), v_prev_hash, v_block_hash, v_payload);

  RETURN v_block_hash;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_staff_with_blockchain(UUID, UUID, UUID) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ assign_staff_with_blockchain / revoke_staff_with_blockchain now verify the caller actually owns the supermarket before touching any user, and refuse to touch admin accounts.';
END $$;
