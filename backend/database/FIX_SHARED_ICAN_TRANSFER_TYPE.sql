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
  v_legacy_balance DECIMAL := 0;
  v_country_code TEXT := 'UG';
  v_currency TEXT := 'UGX';
  v_price_local DECIMAL := 5000;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT ican_balance INTO v_from_balance
  FROM public.ican_user_wallets
  WHERE user_id = p_from_user
  FOR UPDATE;

  -- Older ICAN screens stored balances in user_accounts.ican_coin_balance.
  -- Move that balance into the shared wallet once when the shared wallet is
  -- empty, so users can spend coins earned or bought in either app generation.
  IF COALESCE(v_from_balance, 0) = 0 THEN
    BEGIN
      SELECT COALESCE(ican_coin_balance, 0) INTO v_legacy_balance
      FROM public.user_accounts
      WHERE user_id = p_from_user
      FOR UPDATE;
      IF v_legacy_balance > 0 THEN
        UPDATE public.ican_user_wallets
        SET ican_balance = v_legacy_balance,
            updated_at = NOW()
        WHERE user_id = p_from_user;
        UPDATE public.user_accounts
        SET ican_coin_balance = 0
        WHERE user_id = p_from_user;
        v_from_balance := v_legacy_balance;
      END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      v_legacy_balance := 0;
    END;
  END IF;

  IF v_from_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient ICAN balance');
  END IF;

  -- Resolve the payer's registered country and current local ICAN price.
  -- The ICAN amount remains the settlement amount; local_amount is reporting
  -- metadata in the payer's selected currency.
  BEGIN
    SELECT country_code, currency_code, price_local
    INTO v_country_code, v_currency, v_price_local
    FROM public.ican_get_user_wallet_display(p_from_user)
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_country_code := 'UG';
    v_currency := 'UGX';
    v_price_local := 5000;
  END;

  v_country_code := COALESCE(NULLIF(v_country_code, ''), 'UG');
  v_currency := COALESCE(NULLIF(v_currency, ''), 'UGX');
  v_price_local := COALESCE(v_price_local, 5000);

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
    (user_id, sender_user_id, recipient_user_id, ican_amount, local_amount, country_code, currency, type, transaction_type, source_app, reference_id, note, status)
  VALUES
    (p_from_user, p_from_user, p_to_user, p_amount, p_amount * v_price_local, v_country_code, v_currency, 'transfer_out', 'transfer_out', p_source_app, p_reference_id, p_note, 'completed')
  RETURNING id INTO v_out_tx_id;

  INSERT INTO public.ican_coin_transactions
    (user_id, sender_user_id, recipient_user_id, ican_amount, local_amount, country_code, currency, type, transaction_type, source_app, reference_id, note, status)
  VALUES
    (p_to_user, p_from_user, p_to_user, p_amount, p_amount * v_price_local, v_country_code, v_currency, 'transfer_in', 'transfer_in', p_source_app, p_reference_id, p_note, 'completed')
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
