-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_pending_payment_confirmations(UUID);

-- Create RPC function to get pending payment confirmations for suppliers
CREATE OR REPLACE FUNCTION get_pending_payment_confirmations(p_supplier_id UUID)
RETURNS TABLE(
  transaction_id UUID,
  transaction_number VARCHAR,
  po_number VARCHAR,
  order_id UUID,
  amount_paid DECIMAL,
  payment_method VARCHAR,
  payment_reference VARCHAR,
  payment_date TIMESTAMP WITH TIME ZONE,
  days_pending INT,
  manager_name VARCHAR,
  manager_email VARCHAR,
  confirmation_status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.id as transaction_id,
    pt.transaction_number,
    po.po_number,
    po.id as order_id,
    pt.amount_ugx as amount_paid,
    pt.payment_method,
    pt.payment_reference,
    pt.payment_date,
    EXTRACT(DAY FROM (NOW() - pt.payment_date))::INT as days_pending,
    COALESCE(u.full_name, 'Unknown Manager') as manager_name,
    COALESCE(u.email, 'N/A') as manager_email,
    pt.payment_status as confirmation_status
  FROM payment_transactions pt
  JOIN purchase_orders po ON pt.purchase_order_id = po.id
  LEFT JOIN users u ON po.created_by = u.id
  WHERE po.supplier_id = p_supplier_id 
    AND pt.payment_status IN ('pending', 'awaiting_confirmation', 'pending_confirmation')
  ORDER BY pt.payment_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pending_payment_confirmations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_payment_confirmations(UUID) TO service_role;
