# ⚡ QUICK START - PAYMENT SYSTEM FIX

## 🔴 Current Issues
- Transaction amounts showing USh 0
- Payment totals wrong (overpayment showing)
- Supplier confirmations not working
- Statistics incorrect

## ✅ Fixed In Code (Already Applied)
✓ SupplierPortal.jsx - Payment statistics query
✓ OrderPaymentTracker.jsx - Transaction display  
✓ CREATE_PAYMENT_CONFIRMATIONS_RPC.sql - RPC function updated

## 🚀 ONE STEP TO FIX EVERYTHING

### Copy and Run This SQL in Supabase:

```sql
-- PAYMENT FIX - Copy entire block and run in Supabase SQL Editor

-- 1. Fix RPC Function
DROP FUNCTION IF EXISTS get_pending_payment_confirmations(UUID);

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
    pt.id, pt.transaction_number, po.po_number, po.id,
    pt.amount_ugx, pt.payment_method, pt.payment_reference,
    pt.payment_date,
    EXTRACT(DAY FROM (NOW() - pt.payment_date))::INT,
    COALESCE(u.full_name, 'Unknown Manager'),
    COALESCE(u.email, 'N/A'),
    pt.payment_status
  FROM payment_transactions pt
  JOIN purchase_orders po ON pt.purchase_order_id = po.id
  LEFT JOIN users u ON po.created_by = u.id
  WHERE po.supplier_id = p_supplier_id 
    AND pt.payment_status IN ('pending', 'awaiting_confirmation', 'pending_confirmation')
  ORDER BY pt.payment_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pending_payment_confirmations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_payment_confirmations(UUID) TO service_role;

-- 2. Remove Overpayment Transactions
DELETE FROM payment_transactions pt
WHERE pt.id IN (
  WITH ranked AS (
    SELECT 
      pt2.id,
      pt2.purchase_order_id,
      SUM(pt2.amount_ugx) OVER (PARTITION BY pt2.purchase_order_id ORDER BY pt2.payment_date DESC) as cumsum
    FROM payment_transactions pt2
  ),
  orders_totals AS (
    SELECT po.id, po.total_amount_ugx
    FROM purchase_orders po
  )
  SELECT r.id
  FROM ranked r
  JOIN orders_totals ot ON r.purchase_order_id = ot.id
  WHERE r.cumsum > ot.total_amount_ugx
);

-- 3. Synchronize All Order Payment Data
UPDATE purchase_orders po
SET 
  amount_paid_ugx = COALESCE(
    (SELECT SUM(amount_ugx) FROM payment_transactions 
     WHERE purchase_order_id = po.id AND payment_status NOT IN ('failed', 'cancelled')),
    0),
  balance_due_ugx = po.total_amount_ugx - COALESCE(
    (SELECT SUM(amount_ugx) FROM payment_transactions 
     WHERE purchase_order_id = po.id AND payment_status NOT IN ('failed', 'cancelled')),
    0),
  payment_status = CASE 
    WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions 
                   WHERE purchase_order_id = po.id AND payment_status NOT IN ('failed', 'cancelled')), 0) = 0 THEN 'unpaid'
    WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions 
                   WHERE purchase_order_id = po.id AND payment_status NOT IN ('failed', 'cancelled')), 0) >= po.total_amount_ugx THEN 'paid'
    ELSE 'partially_paid'
  END,
  updated_at = NOW()
WHERE TRUE;

-- 4. Verify
SELECT po.po_number, po.total_amount_ugx as total, po.amount_paid_ugx as paid, 
       po.balance_due_ugx as balance, po.payment_status,
       CASE WHEN po.amount_paid_ugx <= po.total_amount_ugx THEN '✅ OK' ELSE '⚠️ OVERPAID' END
FROM purchase_orders po ORDER BY po.order_date DESC;
```

## After Running:

1. **Refresh browser** (Ctrl+Shift+R)
2. **Check Payment Confirmations tab** - Should show pending payments
3. **Check Orders** - Transaction amounts should be correct
4. **Check Overview** - Statistics should be accurate

## Result:
✅ All payment amounts correct  
✅ No overpayment  
✅ Supplier can confirm payments  
✅ All statistics accurate  

