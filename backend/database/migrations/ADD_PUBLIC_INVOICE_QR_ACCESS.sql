-- ============================================================================
-- Public invoice page + QR-scan payment collection.
--
-- Scanning an invoice's QR code opens /invoice/:transactionId, a page
-- reachable without being logged into the POS. That page needs to:
--   1. Show the receipt/invoice to anyone who opens the link (the customer
--      it was shared with, in particular) — but only the safe, printable
--      fields, never the whole transactions row.
--   2. Let the transaction's own cashier, or that store's admin/manager,
--      collect the outstanding balance from the same page — without a
--      separate approval step, but strictly server-enforced, since a public
--      URL is not something client-side role checks alone can protect.
--
-- transactions currently has no working UPDATE RLS policy at all (only
-- SELECT/INSERT — see FIX_TRANSACTIONS_MANAGER_ISOLATION_RLS.sql), so a
-- direct client-side .update() would already be silently rejected. Both
-- problems are solved the same way Supabase apps normally solve
-- "some fields public, some actions role-gated": SECURITY DEFINER RPCs that
-- bypass RLS internally but enforce their own explicit rules.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_public(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn RECORD;
  v_store_name TEXT;
BEGIN
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  SELECT name INTO v_store_name FROM public.supermarkets WHERE id = v_txn.supermarket_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_txn.id,
    'receiptNumber', v_txn.receipt_number,
    'transactionId', v_txn.transaction_id,
    'createdAt', v_txn.created_at,
    'items', v_txn.items,
    'subtotal', v_txn.subtotal,
    'tax', v_txn.tax_amount,
    'total', v_txn.total_amount,
    'paymentMethod', v_txn.payment_provider,
    'paymentStatus', COALESCE(v_txn.payment_status, 'paid'),
    'amountPaid', COALESCE(v_txn.amount_paid_ugx, v_txn.total_amount),
    'balanceDue', COALESCE(v_txn.balance_due_ugx, 0),
    'dueDate', v_txn.due_date,
    'jobStatus', v_txn.job_status,
    'customerName', v_txn.customer_name,
    'cashierName', v_txn.cashier_name,
    'storeName', COALESCE(v_store_name, v_txn.merchant_name, v_txn.store_location)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_public(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.collect_invoice_payment(p_transaction_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_txn RECORD;
  v_authorized BOOLEAN;
  v_current_balance NUMERIC;
  v_applied NUMERIC;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
  v_new_status TEXT;
  v_updated public.transactions;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required to collect payment');
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter an amount greater than zero');
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  -- Auto-approved for exactly: the cashier who rang up this sale, or the
  -- admin/manager of the store it belongs to. Nobody else — no separate
  -- approval workflow needed for those roles, but everyone else is refused.
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = v_auth_id OR u.auth_id = v_auth_id)
      AND (
        u.id = v_txn.cashier_id
        OR (lower(COALESCE(u.role, '')) IN ('admin', 'manager') AND u.supermarket_id = v_txn.supermarket_id)
      )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only this store''s cashier, manager, or admin can collect this payment');
  END IF;

  v_current_balance := COALESCE(v_txn.balance_due_ugx, GREATEST(v_txn.total_amount - COALESCE(v_txn.amount_paid_ugx, 0), 0));
  IF v_current_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invoice is already fully paid');
  END IF;

  v_applied := LEAST(p_amount, v_current_balance);
  v_new_paid := COALESCE(v_txn.amount_paid_ugx, 0) + v_applied;
  v_new_balance := GREATEST(v_txn.total_amount - v_new_paid, 0);
  v_new_status := CASE WHEN v_new_balance <= 0 THEN 'paid' ELSE 'partial' END;

  UPDATE public.transactions
  SET amount_paid_ugx = v_new_paid,
      balance_due_ugx = v_new_balance,
      payment_status = v_new_status
  WHERE id = p_transaction_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'success', true,
    'amountApplied', v_applied,
    'paymentStatus', v_updated.payment_status,
    'balanceDue', v_updated.balance_due_ugx
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.collect_invoice_payment(UUID, NUMERIC) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ get_invoice_public() and collect_invoice_payment() ready for the public invoice/QR page.';
END $$;
