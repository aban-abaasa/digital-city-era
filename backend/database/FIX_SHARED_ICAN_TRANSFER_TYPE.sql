-- Shared Supabase compatibility fix for legacy ican_coin_transactions tables.
-- Some deployments have the required column named `type`; newer migrations use
-- `transaction_type`. The deployed error proves the shared database still has
-- the legacy NOT NULL `type` column, so every transfer insert must populate it.

CREATE OR REPLACE FUNCTION public.transfer_ican(
  p_from_user    UUID,
  p_to_user      UUID,
  p_amount       DECIMAL,
  p_note         TEXT DEFAULT '',
  p_source_app   TEXT DEFAULT 'ican',
  p_reference_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_from_balance DECIMAL;
  v_out_tx_id UUID;
  v_in_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT ican_balance INTO v_from_balance
  FROM public.ican_user_wallets
  WHERE user_id = p_from_user
  FOR UPDATE;

  IF v_from_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient ICAN balance');
  END IF;

  UPDATE public.ican_user_wallets
  SET ican_balance = ican_balance - p_amount,
      total_spent = COALESCE(total_spent, 0) + p_amount
  WHERE user_id = p_from_user;

  PERFORM public.get_or_create_ican_wallet(p_to_user);
  UPDATE public.ican_user_wallets
  SET ican_balance = ican_balance + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount
  WHERE user_id = p_to_user;

  INSERT INTO public.ican_coin_transactions
    (user_id, sender_user_id, recipient_user_id, ican_amount, type, notes, status)
  VALUES
    (p_from_user, p_from_user, p_to_user, p_amount, 'transfer_out', COALESCE(p_note, ''), 'completed')
  RETURNING id INTO v_out_tx_id;

  INSERT INTO public.ican_coin_transactions
    (user_id, sender_user_id, recipient_user_id, ican_amount, type, notes, status)
  VALUES
    (p_to_user, p_from_user, p_to_user, p_amount, 'transfer_in', COALESCE(p_note, ''), 'completed')
  RETURNING id INTO v_in_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'out_tx_id', v_out_tx_id,
    'in_tx_id', v_in_tx_id,
    'amount_sent', p_amount,
    'recipient_received', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_ican(UUID, UUID, DECIMAL, TEXT, TEXT, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
