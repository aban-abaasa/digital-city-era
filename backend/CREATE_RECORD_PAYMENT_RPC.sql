-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS record_payment_with_tracking(UUID, NUMERIC, VARCHAR, VARCHAR, TIMESTAMP, TEXT, UUID);
DROP FUNCTION IF EXISTS record_payment_with_tracking(UUID, NUMERIC, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, UUID);
DROP FUNCTION IF EXISTS record_payment_with_tracking(UUID, DECIMAL, VARCHAR, VARCHAR, TIMESTAMP WITH TIME ZONE, TEXT, UUID);
DROP FUNCTION IF EXISTS record_payment_with_tracking(p_order_id UUID, p_amount_paid NUMERIC, p_payment_method TEXT, p_payment_reference TEXT, p_notes TEXT, p_paid_by UUID);
DROP FUNCTION IF EXISTS record_payment_with_tracking(UUID, NUMERIC, TEXT, TEXT, TEXT, UUID);

-- Create RPC function to record payment with tracking
-- IMPORTANT: Parameters must match ALL frontend calls
-- Some calls include p_payment_date, some don't - make it optional
CREATE OR REPLACE FUNCTION record_payment_with_tracking(
  p_order_id UUID,
  p_amount_paid NUMERIC,
  p_payment_method TEXT,
  p_payment_reference TEXT,
  p_payment_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_paid_by UUID DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  transaction_id UUID,
  transaction_number VARCHAR,
  amount_paid NUMERIC,
  balance_due NUMERIC,
  order_total NUMERIC,
  payment_status VARCHAR,
  payment_percentage NUMERIC,
  message VARCHAR
) AS $$
DECLARE
  v_transaction_number VARCHAR;
  v_transaction_id UUID;
  v_order_total NUMERIC;
  v_current_paid NUMERIC;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
  v_payment_status VARCHAR;
  v_payment_percentage NUMERIC;
BEGIN
  -- Get order total and current paid amount
  SELECT 
    total_amount_ugx,
    COALESCE(amount_paid_ugx, 0)
  INTO 
    v_order_total,
    v_current_paid
  FROM purchase_orders
  WHERE id = p_order_id;
  
  IF v_order_total IS NULL THEN
    RETURN QUERY SELECT 
      false,
      NULL::UUID,
      NULL::VARCHAR,
      NULL::NUMERIC,
      NULL::NUMERIC,
      NULL::NUMERIC,
      'error'::VARCHAR,
      NULL::NUMERIC,
      'Order not found'::VARCHAR;
    RETURN;
  END IF;
  
  -- Calculate new payment totals
  v_new_paid := v_current_paid + p_amount_paid;
  v_new_balance := GREATEST(v_order_total - v_new_paid, 0);
  v_payment_percentage := ROUND((v_new_paid / NULLIF(v_order_total, 0)) * 100, 2);
  
  -- Determine payment status
  IF v_new_paid >= v_order_total THEN
    v_payment_status := 'paid';
  ELSIF v_new_paid > 0 THEN
    v_payment_status := 'partially_paid';
  ELSE
    v_payment_status := 'unpaid';
  END IF;
  
  -- Generate a unique transaction number
  v_transaction_number := 'TXN-' || TO_CHAR(COALESCE(p_payment_date, NOW()), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
  
  -- Insert the payment transaction
  INSERT INTO payment_transactions (
    purchase_order_id,
    user_id,
    amount_ugx,
    payment_method,
    payment_status,
    transaction_number,
    payment_reference,
    recorded_by,
    notes,
    payment_date,
    created_at,
    updated_at
  ) VALUES (
    p_order_id,
    p_paid_by,
    p_amount_paid,
    COALESCE(p_payment_method, 'cash'),
    'pending_confirmation',
    v_transaction_number,
    p_payment_reference,
    p_paid_by,
    p_notes,
    COALESCE(p_payment_date, NOW()),
    NOW(),
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update order with new payment totals and status
  UPDATE purchase_orders
  SET 
    amount_paid_ugx = v_new_paid,
    balance_due_ugx = v_new_balance,
    payment_status = v_payment_status,
    last_payment_date = COALESCE(p_payment_date, NOW()),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Return success with payment details
  RETURN QUERY SELECT 
    true,
    v_transaction_id,
    v_transaction_number,
    p_amount_paid,
    v_new_balance,
    v_order_total,
    v_payment_status::VARCHAR,
    v_payment_percentage,
    'Payment recorded successfully'::VARCHAR;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION record_payment_with_tracking(UUID, NUMERIC, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment_with_tracking(UUID, NUMERIC, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, UUID) TO service_role;
