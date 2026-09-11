-- ============================================================================
-- Let a customer pay a POS invoice's outstanding balance with their ICAN
-- wallet (from the IcanEra Wallet's Pay-tab scanner, or the public
-- /invoice/:id page's own "Pay with ICAN" button — see payInvoiceWithIcan()
-- in icanPaymentRequestService.js) and have it actually settle the real
-- sale, not just move coins in an isolated wallet ledger.
--
-- collect_invoice_payment() (ADD_PUBLIC_INVOICE_QR_ACCESS.sql) is
-- deliberately gated to the sale's cashier/admin/manager — a paying
-- customer is neither, so it can't be reused here. Authorization instead
-- comes from proof that a real, completed ICAN transfer to this store's own
-- wallet already happened: the function looks the transfer up itself in
-- ican_coin_transactions (never trusts a client-declared amount) and applies
-- whatever it actually recorded as received, capped at what's still owed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.settle_invoice_via_ican_transfer(p_transaction_id UUID, p_ican_tx_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_txn RECORD;
  v_store_owner UUID;
  v_transfer RECORD;
  v_current_balance NUMERIC;
  v_applied NUMERIC;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
  v_new_status TEXT;
  v_updated public.transactions;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required to pay this invoice');
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  SELECT owner_user_id INTO v_store_owner FROM public.supermarkets WHERE id = v_txn.supermarket_id;
  IF v_store_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not resolve this store''s wallet');
  END IF;

  -- The transfer must be real, completed, sent by the caller themselves, and
  -- landed in this exact store's wallet — never taken on the client's word.
  SELECT * INTO v_transfer FROM public.ican_coin_transactions
   WHERE id = p_ican_tx_id
     AND sender_user_id = v_auth_id
     AND recipient_user_id = v_store_owner
     AND transaction_type = 'transfer_out'
     AND status = 'completed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No matching ICAN payment to this store was found');
  END IF;

  v_current_balance := COALESCE(v_txn.balance_due_ugx, GREATEST(v_txn.total_amount - COALESCE(v_txn.amount_paid_ugx, 0), 0));
  IF v_current_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invoice is already fully paid');
  END IF;

  v_applied := LEAST(COALESCE(v_transfer.local_amount, 0), v_current_balance);
  IF v_applied <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'This ICAN payment has no recorded value to apply');
  END IF;

  v_new_paid := COALESCE(v_txn.amount_paid_ugx, 0) + v_applied;
  v_new_balance := GREATEST(v_txn.total_amount - v_new_paid, 0);
  v_new_status := CASE WHEN v_new_balance <= 0 THEN 'paid' ELSE 'partial' END;

  UPDATE public.transactions
  SET amount_paid_ugx = v_new_paid,
      balance_due_ugx = v_new_balance,
      payment_status = v_new_status,
      payment_method = 'ican_wallet',
      payment_reference = p_ican_tx_id::TEXT
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

GRANT EXECUTE ON FUNCTION public.settle_invoice_via_ican_transfer(UUID, UUID) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ settle_invoice_via_ican_transfer() ready — ICAN payments now settle the real POS transaction.';
END $$;
