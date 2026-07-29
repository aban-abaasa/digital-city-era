-- Securely finalize an ICAN payment request after the payer's wallet transfer.
-- The old direct UPDATE was blocked by RLS because the request belongs to the
-- cashier/request owner. This also repairs already-paid stuck requests.
CREATE OR REPLACE FUNCTION public.complete_ican_payment_request(
  p_payment_code TEXT,
  p_payer_user_id UUID,
  p_ican_tx_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.payment_requests%ROWTYPE;
  v_tx_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_payer_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payer authentication mismatch');
  END IF;
  SELECT * INTO v_request FROM public.payment_requests
    WHERE payment_code = p_payment_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Payment request not found'); END IF;
  IF v_request.user_id = p_payer_user_id THEN RETURN jsonb_build_object('success', false, 'error', 'You cannot pay your own request'); END IF;
  IF v_request.status <> 'pending' THEN RETURN jsonb_build_object('success', true, 'status', v_request.status, 'already_completed', true); END IF;
  IF v_request.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'This payment request has expired'); END IF;

  SELECT id INTO v_tx_id FROM public.ican_coin_transactions
    WHERE reference_id = v_request.id::TEXT AND sender_user_id = p_payer_user_id
      AND transaction_type = 'transfer_out'
    ORDER BY created_at DESC LIMIT 1;
  IF v_tx_id IS NULL AND p_ican_tx_id IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.ican_coin_transactions
      WHERE id = p_ican_tx_id AND reference_id = v_request.id::TEXT
        AND sender_user_id = p_payer_user_id AND transaction_type = 'transfer_out';
  END IF;
  IF v_tx_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Payment transfer not found'); END IF;

  UPDATE public.payment_requests SET status = 'completed', payer_user_id = p_payer_user_id,
    ican_tx_id = v_tx_id, completed_at = COALESCE(completed_at, now()), updated_at = now()
    WHERE id = v_request.id;
  RETURN jsonb_build_object('success', true, 'status', 'completed', 'ican_tx_id', v_tx_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_ican_payment_request(TEXT, UUID, UUID) TO authenticated;
