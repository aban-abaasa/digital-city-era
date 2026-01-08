-- =====================================================================
-- CLEAN UP: Remove Duplicate/Test Payment Transactions
-- =====================================================================
-- Identify and remove problematic test data

-- Step 1: Show all transactions grouped by order
SELECT 
  po.po_number,
  po.total_amount_ugx,
  COUNT(*) as transaction_count,
  SUM(pt.amount_ugx) as total_paid,
  STRING_AGG(pt.amount_ugx::TEXT, ', ' ORDER BY pt.payment_date) as amounts,
  STRING_AGG(pt.id::TEXT, ', ' ORDER BY pt.payment_date) as transaction_ids
FROM payment_transactions pt
JOIN purchase_orders po ON pt.purchase_order_id = po.id
GROUP BY po.id, po.po_number, po.total_amount_ugx
ORDER BY po.order_date DESC;

-- Step 2: Find transactions to keep (most recent valid ones for each order)
-- Keep the earliest transaction per order that doesn't exceed the order total
WITH ranked_transactions AS (
  SELECT 
    pt.id,
    pt.purchase_order_id,
    pt.amount_ugx,
    pt.payment_date,
    po.total_amount_ugx,
    ROW_NUMBER() OVER (PARTITION BY pt.purchase_order_id ORDER BY pt.payment_date ASC) as rn,
    SUM(pt.amount_ugx) OVER (PARTITION BY pt.purchase_order_id ORDER BY pt.payment_date ASC) as running_total
  FROM payment_transactions pt
  JOIN purchase_orders po ON pt.purchase_order_id = po.id
)
SELECT 
  id,
  purchase_order_id,
  amount_ugx,
  payment_date,
  total_amount_ugx,
  rn,
  running_total,
  CASE 
    WHEN running_total <= total_amount_ugx THEN 'KEEP'
    ELSE 'DELETE - OVERPAYMENT'
  END as action
FROM ranked_transactions
ORDER BY purchase_order_id, payment_date;

-- Step 3: Delete duplicate transactions (keep only essential ones)
-- For each order, delete all but the distinct legitimate payments
DELETE FROM payment_transactions pt
WHERE pt.id IN (
  WITH duplicates AS (
    SELECT 
      pt.id,
      ROW_NUMBER() OVER (PARTITION BY pt.purchase_order_id, pt.amount_ugx, DATE(pt.payment_date) ORDER BY pt.created_at DESC) as rn
    FROM payment_transactions pt
  )
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 4: Remove any overpayment transactions
DELETE FROM payment_transactions pt
WHERE pt.purchase_order_id IN (
  SELECT po.id 
  FROM purchase_orders po
  WHERE (SELECT COALESCE(SUM(amount_ugx), 0) FROM payment_transactions WHERE purchase_order_id = po.id) > po.total_amount_ugx
)
AND pt.id IN (
  SELECT pt2.id
  FROM payment_transactions pt2
  WHERE pt2.purchase_order_id = pt.purchase_order_id
  ORDER BY pt2.payment_date DESC, pt2.created_at DESC
  LIMIT 1
);

-- Step 5: Verify cleanup
SELECT 
  po.po_number,
  po.total_amount_ugx,
  COUNT(pt.id) as transactions,
  COALESCE(SUM(pt.amount_ugx), 0) as total_paid
FROM purchase_orders po
LEFT JOIN payment_transactions pt ON pt.purchase_order_id = po.id
GROUP BY po.id, po.po_number, po.total_amount_ugx
ORDER BY po.order_date DESC;

-- =====================================================================
-- SUCCESS MESSAGE
-- =====================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ PAYMENT DATA CLEANED UP!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What Was Fixed:';
  RAISE NOTICE '  ✓ Removed duplicate transactions';
  RAISE NOTICE '  ✓ Removed overpayment transactions';
  RAISE NOTICE '  ✓ Kept essential payment records';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Run FIX_PAYMENT_DATA_SYNC.sql to update order fields';
  RAISE NOTICE '  2. Refresh your browser';
  RAISE NOTICE '  3. Payments should now be correct!';
  RAISE NOTICE '';
END $$;

