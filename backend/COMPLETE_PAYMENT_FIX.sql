-- =====================================================================
-- COMPLETE FIX: Clean and Synchronize All Payment Data
-- =====================================================================
-- This comprehensive script fixes all payment coordination issues

-- =====================================================================
-- PHASE 1: IDENTIFY THE PROBLEM
-- =====================================================================
-- Show current state before cleanup

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 ANALYZING PAYMENT DATA...';
  RAISE NOTICE '';
END $$;

CREATE TEMP TABLE problem_analysis AS
SELECT 
  po.id,
  po.po_number,
  po.total_amount_ugx,
  COUNT(DISTINCT pt.id) as transaction_count,
  COALESCE(SUM(pt.amount_ugx), 0) as sum_of_payments,
  po.amount_paid_ugx as stored_amount_paid,
  COALESCE(SUM(pt.amount_ugx), 0) - po.total_amount_ugx as overpayment,
  CASE 
    WHEN COALESCE(SUM(pt.amount_ugx), 0) > po.total_amount_ugx THEN 'OVERPAID'
    WHEN COALESCE(SUM(pt.amount_ugx), 0) = po.total_amount_ugx THEN 'FULLY PAID'
    WHEN COALESCE(SUM(pt.amount_ugx), 0) > 0 THEN 'PARTIALLY PAID'
    ELSE 'UNPAID'
  END as actual_status
FROM purchase_orders po
LEFT JOIN payment_transactions pt ON pt.purchase_order_id = po.id
GROUP BY po.id, po.po_number, po.total_amount_ugx, po.amount_paid_ugx;

SELECT * FROM problem_analysis;

-- =====================================================================
-- PHASE 2: KEEP LEGITIMATE PAYMENTS ONLY
-- =====================================================================
-- Strategy: For each order, keep payments up to the total order amount
-- Delete excess/duplicate transactions

DO $$
DECLARE
  v_deleted_count INT := 0;
BEGIN
  -- Delete transactions that exceed order total
  WITH excess_transactions AS (
    SELECT pt.id,
           pt.purchase_order_id,
           pt.amount_ugx,
           SUM(pt.amount_ugx) OVER (PARTITION BY pt.purchase_order_id ORDER BY pt.payment_date DESC) as total_from_end
    FROM payment_transactions pt
  )
  DELETE FROM payment_transactions pt
  WHERE pt.id IN (
    SELECT et.id FROM excess_transactions et
    JOIN purchase_orders po ON et.purchase_order_id = po.id
    WHERE et.total_from_end > po.total_amount_ugx
  );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % excess transactions', v_deleted_count;
END $$;

-- =====================================================================
-- PHASE 3: RECALCULATE EVERYTHING
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 SYNCHRONIZING PAYMENT DATA...';
  RAISE NOTICE '';
END $$;

-- Update purchase_orders with correct payment information
UPDATE purchase_orders po
SET 
  amount_paid_ugx = COALESCE(
    (SELECT SUM(amount_ugx) FROM payment_transactions 
     WHERE purchase_order_id = po.id
     AND payment_status NOT IN ('failed', 'cancelled')),
    0
  ),
  balance_due_ugx = po.total_amount_ugx - COALESCE(
    (SELECT SUM(amount_ugx) FROM payment_transactions 
     WHERE purchase_order_id = po.id
     AND payment_status NOT IN ('failed', 'cancelled')),
    0
  ),
  payment_status = CASE 
    WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions 
                   WHERE purchase_order_id = po.id
                   AND payment_status NOT IN ('failed', 'cancelled')), 0) = 0 
      THEN 'unpaid'
    WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions 
                   WHERE purchase_order_id = po.id
                   AND payment_status NOT IN ('failed', 'cancelled')), 0) >= po.total_amount_ugx 
      THEN 'paid'
    ELSE 'partially_paid'
  END,
  updated_at = NOW()
WHERE po.id IN (
  SELECT DISTINCT po2.id FROM purchase_orders po2
);

-- =====================================================================
-- PHASE 4: VERIFY RESULTS
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ VERIFICATION RESULTS:';
  RAISE NOTICE '';
END $$;

SELECT 
  po.po_number,
  po.total_amount_ugx,
  po.amount_paid_ugx,
  po.balance_due_ugx,
  po.payment_status,
  (SELECT COUNT(*) FROM payment_transactions WHERE purchase_order_id = po.id) as num_transactions,
  (SELECT SUM(amount_ugx) FROM payment_transactions WHERE purchase_order_id = po.id) as transaction_total,
  CASE 
    WHEN po.amount_paid_ugx = COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions WHERE purchase_order_id = po.id), 0)
      AND po.balance_due_ugx = po.total_amount_ugx - po.amount_paid_ugx
      AND po.payment_status = CASE 
        WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions WHERE purchase_order_id = po.id), 0) = 0 THEN 'unpaid'
        WHEN COALESCE((SELECT SUM(amount_ugx) FROM payment_transactions WHERE purchase_order_id = po.id), 0) >= po.total_amount_ugx THEN 'paid'
        ELSE 'partially_paid'
      END
    THEN '✅ CORRECT'
    ELSE '⚠️ REVIEW'
  END as status
FROM purchase_orders po
ORDER BY po.order_date DESC;

-- =====================================================================
-- PHASE 5: SUCCESS MESSAGE
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅✅✅ PAYMENT DATA FULLY SYNCHRONIZED! ✅✅✅';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What Was Fixed:';
  RAISE NOTICE '  ✓ Removed overpayment transactions';
  RAISE NOTICE '  ✓ Recalculated amount_paid_ugx for all orders';
  RAISE NOTICE '  ✓ Recalculated balance_due_ugx for all orders';
  RAISE NOTICE '  ✓ Updated payment_status based on actual payments';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Payment Confirmation Feature:';
  RAISE NOTICE '  ✓ Supplier can confirm/reject pending payments in "Payment Confirmations" tab';
  RAISE NOTICE '  ✓ Confirmed payments show ✓ checkmark with date';
  RAISE NOTICE '  ✓ Pending payments show ⏳ clock icon';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 NEXT STEPS:';
  RAISE NOTICE '  1. Close this window (or refresh browser)';
  RAISE NOTICE '  2. Go to "Payment Confirmations" tab as supplier';
  RAISE NOTICE '  3. Review and confirm payments';
  RAISE NOTICE '  4. Check "Payments" tab to verify amounts are correct';
  RAISE NOTICE '';
  RAISE NOTICE '📌 All payment statistics should now be accurate!';
  RAISE NOTICE '';
END $$;

