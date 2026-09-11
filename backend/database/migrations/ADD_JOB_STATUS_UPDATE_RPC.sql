-- ============================================================================
-- Let the public /invoice/:id page (see ADD_PUBLIC_INVOICE_QR_ACCESS.sql)
-- also advance a service job's status, not just collect payment.
--
-- A service sale (e.g. laundry) can be paid in full up front while the job
-- itself is still 'pending' — the receipt's QR code needs to be useful to
-- the cashier later regardless of payment status, so they can scan it when
-- the customer drops by and mark the job in_progress / ready_for_collection
-- / collected. Same auto-approved-for-staff-only rule as
-- collect_invoice_payment(): the sale's own cashier, or that store's
-- admin/manager — nobody else.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_job_status(p_transaction_id UUID, p_new_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_txn RECORD;
  v_authorized BOOLEAN;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required to update job status');
  END IF;

  IF p_new_status NOT IN ('pending', 'in_progress', 'ready_for_collection', 'collected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid job status');
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_txn.job_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This sale has no service job to track');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = v_auth_id OR u.auth_id = v_auth_id)
      AND (
        u.id = v_txn.cashier_id
        OR (lower(COALESCE(u.role, '')) IN ('admin', 'manager') AND u.supermarket_id = v_txn.supermarket_id)
      )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only this store''s cashier, manager, or admin can update this job');
  END IF;

  UPDATE public.transactions
  SET job_status = p_new_status
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object('success', true, 'jobStatus', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_job_status(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ update_job_status() ready for the public invoice/QR page.';
END $$;

-- Force PostgREST to pick up the new function immediately — without this,
-- calls can fail with "Could not find the function ... in the schema
-- cache" until the cache refreshes on its own.
NOTIFY pgrst, 'reload schema';
