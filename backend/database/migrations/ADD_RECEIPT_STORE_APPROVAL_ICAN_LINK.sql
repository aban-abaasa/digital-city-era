-- ============================================================================
-- Customer shop receipts: store name, staff approval by QR, and ICAN link.
--
-- What this adds (purely additive - customer_self_checkout() and
-- transfer_ican() are NOT modified, so no money logic changes):
--
--  1. receipts: supermarket_id, store_name, approval_token, approval_status,
--     approved_by / approved_by_name / approved_at, ican_tx_ids.
--  2. ican_coin_transactions.receipt_details (JSONB): the full receipt
--     (store, products, totals, approval) so the ICAN app can show exactly
--     what a payment bought. Written for the customer's own transfer rows.
--  3. RPCs
--       register_receipt_approval()  customer, right after paying a store:
--                                    stamps store name, issues the QR token,
--                                    copies the receipt onto the ICAN rows.
--       get_receipt_for_approval()   staff opens the QR link and sees it.
--       approve_receipt()            store staff approves; their NAME is
--                                    saved and mirrored onto the ICAN rows.
--       get_my_receipt_approvals()   customer's receipt polls for approval.
--
-- Who may approve: the store owner, active supermarket_staff of that store, or
-- a manager / cashier / employee / admin whose users.supermarket_id is that
-- store. Never the customer who made the purchase.
-- ============================================================================

-- 1. receipts ----------------------------------------------------------------
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS supermarket_id    UUID,
  ADD COLUMN IF NOT EXISTS store_name        TEXT,
  ADD COLUMN IF NOT EXISTS approval_token    TEXT,
  ADD COLUMN IF NOT EXISTS approval_status   TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by       UUID,
  ADD COLUMN IF NOT EXISTS approved_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ican_tx_ids       UUID[];

CREATE UNIQUE INDEX IF NOT EXISTS receipts_approval_token_uniq
  ON public.receipts (approval_token) WHERE approval_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS receipts_supermarket_idx
  ON public.receipts (supermarket_id);

-- 2. ICAN transactions carry the receipt -------------------------------------
ALTER TABLE public.ican_coin_transactions
  ADD COLUMN IF NOT EXISTS receipt_details JSONB;

-- Helpers --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dce_is_store_staff(p_supermarket_id UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_supermarket_id IS NULL OR p_user IS NULL THEN RETURN FALSE; END IF;

  IF EXISTS (SELECT 1 FROM public.supermarkets
              WHERE id = p_supermarket_id AND owner_user_id = p_user) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.supermarket_staff
              WHERE supermarket_id = p_supermarket_id
                AND user_id = p_user
                AND COALESCE(status, 'active') IN ('active', 'accepted')) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users
              WHERE id = p_user
                AND supermarket_id = p_supermarket_id
                AND role IN ('admin', 'manager', 'cashier', 'employee')) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- The receipt as stored on ICAN transactions and returned to the app.
CREATE OR REPLACE FUNCTION public.dce_build_receipt_details(p_receipt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.receipts%ROWTYPE;
  s RECORD;
BEGIN
  SELECT * INTO r FROM public.receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT name, location, price_currency INTO s
    FROM public.supermarkets WHERE id = r.supermarket_id;

  RETURN jsonb_build_object(
    'receipt_id',       r.id,
    'receipt_number',   r.receipt_number,
    'store_id',         r.supermarket_id,
    'store_name',       COALESCE(r.store_name, s.name),
    'store_location',   COALESCE(s.location, r.store_location),
    'currency',         UPPER(COALESCE(s.price_currency, 'UGX')),
    'customer_name',    r.customer_name,
    'items',            COALESCE(r.items_json, '[]'::jsonb),
    'subtotal',         r.subtotal,
    'tax',              r.tax_amount,
    'total',            r.total_amount,
    'payment_method',   r.payment_method,
    'purchased_at',     r.created_at,
    'approval_status',  COALESCE(r.approval_status, 'pending'),
    'approved_by_name', r.approved_by_name,
    'approved_at',      r.approved_at
  );
END;
$$;

-- Push the current receipt snapshot onto its ICAN transaction rows.
-- Best effort: never lets a ledger problem undo a payment or an approval.
CREATE OR REPLACE FUNCTION public.dce_sync_receipt_to_ican(p_receipt_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids UUID[];
BEGIN
  SELECT ican_tx_ids INTO v_ids FROM public.receipts WHERE id = p_receipt_id;
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN RETURN; END IF;
  UPDATE public.ican_coin_transactions
     SET receipt_details = public.dce_build_receipt_details(p_receipt_id)
   WHERE id = ANY (v_ids);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dce_sync_receipt_to_ican failed for receipt %: %', p_receipt_id, SQLERRM;
END;
$$;

-- 3a. Customer: stamp store, issue QR token, link ICAN rows -------------------
CREATE OR REPLACE FUNCTION public.register_receipt_approval(
  p_receipt_id     UUID,
  p_supermarket_id UUID,
  p_ican_tx_ids    UUID[] DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  r        public.receipts%ROWTYPE;
  v_store  RECORD;
  v_token  TEXT;
  v_ids    UUID[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Self-checkout stores the customer as cashier_id, so this is "my receipt".
  SELECT * INTO r FROM public.receipts WHERE id = p_receipt_id AND cashier_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receipt not found');
  END IF;

  SELECT id, name INTO v_store FROM public.supermarkets WHERE id = p_supermarket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Store not found');
  END IF;

  -- The products on the receipt must really belong to that store.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(COALESCE(r.items_json, '[]'::jsonb)) it
      JOIN public.products p ON p.id = (it->>'product_id')::UUID
     WHERE p.supermarket_id IS DISTINCT FROM p_supermarket_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receipt items do not belong to this store');
  END IF;

  v_token := COALESCE(
    r.approval_token,
    replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '')
  );

  -- Only link ICAN rows the caller is actually a party to.
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids
    FROM public.ican_coin_transactions
   WHERE id = ANY (COALESCE(p_ican_tx_ids, '{}'))
     AND (sender_user_id = v_uid OR recipient_user_id = v_uid);

  UPDATE public.receipts
     SET supermarket_id  = v_store.id,
         store_name      = v_store.name,
         approval_token  = v_token,
         approval_status = COALESCE(approval_status, 'pending'),
         ican_tx_ids     = v_ids,
         updated_at      = now()
   WHERE id = r.id;

  PERFORM public.dce_sync_receipt_to_ican(r.id);

  RETURN jsonb_build_object(
    'success',         true,
    'receipt_id',      r.id,
    'store_name',      v_store.name,
    'approval_token',  v_token,
    'approval_status', COALESCE(r.approval_status, 'pending')
  );
END;
$$;

-- 3b. Staff: look a receipt up from its QR token ------------------------------
CREATE OR REPLACE FUNCTION public.get_receipt_for_approval(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  r     public.receipts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please sign in');
  END IF;
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid receipt code');
  END IF;

  SELECT * INTO r FROM public.receipts WHERE approval_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receipt not found');
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'receipt',     public.dce_build_receipt_details(r.id),
    'can_approve', public.dce_is_store_staff(r.supermarket_id, v_uid)
                   AND r.cashier_id IS DISTINCT FROM v_uid
  );
END;
$$;

-- 3c. Staff: approve (saves the staff member's name) --------------------------
CREATE OR REPLACE FUNCTION public.approve_receipt(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  r      public.receipts%ROWTYPE;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please sign in');
  END IF;

  SELECT * INTO r FROM public.receipts WHERE approval_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receipt not found');
  END IF;

  IF r.cashier_id IS NOT DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot approve your own purchase');
  END IF;
  IF NOT public.dce_is_store_staff(r.supermarket_id, v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only staff of this store can approve its receipts');
  END IF;

  IF r.approval_status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', true, 'already_approved', true,
      'approved_by_name', r.approved_by_name, 'approved_at', r.approved_at
    );
  END IF;

  SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Staff')
    INTO v_name FROM public.users WHERE id = v_uid;

  UPDATE public.receipts
     SET approval_status  = 'approved',
         approved_by      = v_uid,
         approved_by_name = COALESCE(v_name, 'Staff'),
         approved_at      = now(),
         updated_at       = now()
   WHERE id = r.id;

  PERFORM public.dce_sync_receipt_to_ican(r.id);

  RETURN jsonb_build_object(
    'success', true,
    'approved_by_name', COALESCE(v_name, 'Staff'),
    'approved_at', now()
  );
END;
$$;

-- 3d. Customer: has staff approved my receipts yet? ---------------------------
CREATE OR REPLACE FUNCTION public.get_my_receipt_approvals(p_receipt_ids UUID[])
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'receipt_id',       id,
           'approval_status',  COALESCE(approval_status, 'pending'),
           'approved_by_name', approved_by_name,
           'approved_at',      approved_at
         )), '[]'::jsonb)
    FROM public.receipts
   WHERE id = ANY (p_receipt_ids) AND cashier_id = auth.uid();
$$;

-- Grants: signed-in users only ------------------------------------------------
REVOKE ALL ON FUNCTION public.register_receipt_approval(UUID, UUID, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_receipt_for_approval(TEXT)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_receipt(TEXT)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_receipt_approvals(UUID[])             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_receipt_approval(UUID, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_receipt_for_approval(TEXT)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_receipt(TEXT)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_receipt_approvals(UUID[])             TO authenticated;

NOTIFY pgrst, 'reload schema';
