-- =====================================================================
-- FIX: Synchronize purchase_orders payment fields with payment_transactions
-- =====================================================================
-- This script recalculates amount_paid_ugx, balance_due_ugx, and payment_status
-- based on actual payment_transactions records

-- Step 1: Update all purchase_orders with correct payment totals
UPDATE purchase_orders po
SET 
  amount_paid_ugx = COALESCE(
    (SELECT SUM(amount_ugx) FROM payment_transactions 
     WHERE purchase_order_id = po.id),
    0
  ),
  balance_due_ugx = po.total_amount_ugx - COALESCE(
    (SELECT SUM(amount_ugx) FROM payment_transactions 
     WHERE purchase_order_id = po.id),
    0
  ),
  payment_status = CASE 
    WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions 
                   WHERE purchase_order_id = po.id), 0) = 0 THEN 'unpaid'
    WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions 
                   WHERE purchase_order_id = po.id), 0) >= po.total_amount_ugx THEN 'paid'
    ELSE 'partially_paid'
  END,
  updated_at = NOW()
WHERE po.id IN (
  SELECT DISTINCT po2.id FROM purchase_orders po2
  LEFT JOIN payment_transactions pt ON pt.purchase_order_id = po2.id
  GROUP BY po2.id
);

-- Step 2: Verify the update
SELECT 
  po.po_number,
  po.total_amount_ugx,
  po.amount_paid_ugx,
  po.balance_due_ugx,
  po.payment_status,
  (SELECT COALESCE(SUM(amount_ugx), 0) 
   FROM payment_transactions 
   WHERE purchase_order_id = po.id) as "payment_sum",
  CASE 
    WHEN po.amount_paid_ugx = (SELECT COALESCE(SUM(amount_ugx), 0) 
                               FROM payment_transactions 
                               WHERE purchase_order_id = po.id) THEN '✅ CORRECT'
    ELSE '❌ MISMATCH'
  END as "verification"
FROM purchase_orders po
ORDER BY po.order_date DESC;

-- =====================================================================
-- SUCCESS MESSAGE
-- =====================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ PAYMENT DATA SYNCHRONIZED!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What Was Fixed:';
  RAISE NOTICE '  ✓ amount_paid_ugx recalculated from payment_transactions sum';
  RAISE NOTICE '  ✓ balance_due_ugx recalculated as total - amount_paid';
  RAISE NOTICE '  ✓ payment_status updated based on payment amount';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Results:';
  RAISE NOTICE '  • All orders now show correct payment amounts';
  RAISE NOTICE '  • Balance due calculations are accurate';
  RAISE NOTICE '  • Payment percentages will display correctly';
  RAISE NOTICE '';
  RAISE NOTICE '📌 NEXT STEP:';
  RAISE NOTICE '  Refresh your browser to see the updated payment information!';
  RAISE NOTICE '';
END $$;

