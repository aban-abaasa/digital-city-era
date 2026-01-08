-- =====================================================================
-- COMPLETE FIX: Add all missing columns to purchase_orders table
-- and create the supplier_confirm_payment RPC function
-- =====================================================================
-- Copy this ENTIRE file and paste into Supabase SQL Editor, then click RUN
-- =====================================================================

-- STEP 1: Add missing columns to payment_transactions table
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS confirmation_notes TEXT;

-- STEP 2: Add missing columns to purchase_orders table
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- STEP 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_last_payment ON purchase_orders(last_payment_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_next_payment ON purchase_orders(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_method ON purchase_orders(payment_method);

-- STEP 4: Create the supplier_confirm_payment RPC function
DROP FUNCTION IF EXISTS supplier_confirm_payment(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION supplier_confirm_payment(
  p_transaction_id UUID,
  p_supplier_id UUID,
  p_confirmation_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  transaction_id UUID,
  transaction_number VARCHAR,
  confirmation_status VARCHAR,
  confirmation_date TIMESTAMP WITH TIME ZONE,
  message VARCHAR
) AS $$
DECLARE
  v_po_id UUID;
  v_supplier_check UUID;
  v_current_status VARCHAR;
BEGIN
  -- Verify transaction exists
  SELECT purchase_order_id, payment_status
  INTO v_po_id, v_current_status
  FROM payment_transactions
  WHERE id = p_transaction_id;

  IF v_po_id IS NULL THEN
    RETURN QUERY SELECT 
      p_transaction_id,
      NULL::VARCHAR,
      'error'::VARCHAR,
      NULL::TIMESTAMP WITH TIME ZONE,
      'Transaction not found'::VARCHAR;
    RETURN;
  END IF;

  -- Verify supplier owns this purchase order
  SELECT supplier_id
  INTO v_supplier_check
  FROM purchase_orders
  WHERE id = v_po_id;

  IF v_supplier_check != p_supplier_id THEN
    RETURN QUERY SELECT 
      p_transaction_id,
      NULL::VARCHAR,
      'error'::VARCHAR,
      NULL::TIMESTAMP WITH TIME ZONE,
      'You do not have permission to confirm this payment'::VARCHAR;
    RETURN;
  END IF;

  -- Update payment transaction with confirmation
  UPDATE payment_transactions
  SET 
    confirmed_by_supplier = TRUE,
    confirmation_date = NOW(),
    confirmation_notes = p_confirmation_notes,
    payment_status = 'confirmed',
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- Update purchase order payment status to paid when supplier confirms
  UPDATE purchase_orders
  SET 
    payment_status = 'paid',
    updated_at = NOW()
  WHERE id = v_po_id;

  -- Return success response with updated data
  RETURN QUERY
  SELECT 
    pt.id as transaction_id,
    pt.transaction_number,
    pt.payment_status as confirmation_status,
    pt.confirmation_date,
    'Payment confirmed successfully'::VARCHAR as message
  FROM payment_transactions pt
  WHERE pt.id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION supplier_confirm_payment(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION supplier_confirm_payment(UUID, UUID, TEXT) TO service_role;

-- STEP 5: Create the record_payment_with_tracking RPC function
DROP FUNCTION IF EXISTS record_payment_with_tracking(NUMERIC, TEXT, UUID, TIMESTAMP WITH TIME ZONE, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION record_payment_with_tracking(
  p_amount_paid NUMERIC,
  p_notes TEXT,
  p_order_id UUID,
  p_payment_date TIMESTAMP WITH TIME ZONE,
  p_payment_method VARCHAR,
  p_payment_reference VARCHAR
)
RETURNS TABLE(
  transaction_id UUID,
  transaction_number VARCHAR,
  order_id UUID,
  payment_status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  message VARCHAR
) AS $$
DECLARE
  v_transaction_id UUID;
  v_transaction_number VARCHAR;
  v_order_exists BOOLEAN;
  v_current_paid NUMERIC;
  v_order_total NUMERIC;
BEGIN
  -- Verify order exists
  SELECT EXISTS(SELECT 1 FROM purchase_orders WHERE id = p_order_id)
  INTO v_order_exists;
  
  IF NOT v_order_exists THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::VARCHAR,
      p_order_id,
      'error'::VARCHAR,
      NULL::TIMESTAMP WITH TIME ZONE,
      'Purchase order not found'::VARCHAR;
    RETURN;
  END IF;

  -- Generate a transaction number
  v_transaction_number := 'TXN-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || substr(p_order_id::text, 1, 8);

  -- Create payment transaction record
  INSERT INTO payment_transactions (
    purchase_order_id,
    user_id,
    amount_ugx,
    payment_date,
    payment_method,
    payment_reference,
    transaction_number,
    notes,
    payment_status,
    created_at,
    updated_at
  )
  VALUES (
    p_order_id,
    auth.uid(),
    p_amount_paid,
    COALESCE(p_payment_date, NOW()),
    p_payment_method,
    p_payment_reference,
    v_transaction_number,
    p_notes,
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id
  INTO v_transaction_id;

  -- Update purchase order with payment info
  UPDATE purchase_orders
  SET 
    last_payment_date = COALESCE(p_payment_date, NOW()),
    payment_method = p_payment_method,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return success response
  RETURN QUERY
  SELECT 
    v_transaction_id,
    v_transaction_number,
    p_order_id,
    'pending'::VARCHAR,
    NOW(),
    'Payment recorded successfully'::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION record_payment_with_tracking(NUMERIC, TEXT, UUID, TIMESTAMP WITH TIME ZONE, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment_with_tracking(NUMERIC, TEXT, UUID, TIMESTAMP WITH TIME ZONE, VARCHAR, VARCHAR) TO service_role;

-- =====================================================================
-- DEPLOYMENT COMPLETE
-- =====================================================================
-- All missing columns have been added and RPC functions are ready:
-- 1. supplier_confirm_payment() - for suppliers to confirm payments
-- 2. record_payment_with_tracking() - for recording payments with tracking
-- The payment confirmation feature should now work without errors
-- =====================================================================
