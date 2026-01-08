-- =====================================================================
-- AUDIT: Check Payment Data Integrity
-- =====================================================================
-- This script identifies overpayments and data issues

-- Step 1: Show all orders with their payment summaries
SELECT 
  po.id,
  po.po_number,
  po.total_amount_ugx,
  po.amount_paid_ugx as "stored_amount_paid",
  po.payment_status,
  po.supplier_id,
  (SELECT COALESCE(SUM(amount_ugx), 0) 
   FROM payment_transactions 
   WHERE purchase_order_id = po.id) as "sum_of_transactions",
  po.total_amount_ugx - po.amount_paid_ugx as "stored_balance"
FROM purchase_orders po
ORDER BY po.order_date DESC;

-- Step 2: Show all payment transactions
SELECT 
  pt.id,
  pt.transaction_number,
  pt.purchase_order_id,
  pt.amount_ugx,
  pt.payment_method,
  pt.payment_status,
  pt.confirmed_by_supplier,
  pt.payment_date,
  po.po_number,
  po.total_amount_ugx
FROM payment_transactions pt
LEFT JOIN purchase_orders po ON pt.purchase_order_id = po.id
ORDER BY pt.payment_date DESC;

-- Step 3: Identify orders with overpayment (sum of payments > total amount)
SELECT 
  po.id,
  po.po_number,
  po.total_amount_ugx,
  (SELECT COALESCE(SUM(amount_ugx), 0) 
   FROM payment_transactions 
   WHERE purchase_order_id = po.id) as "total_payments",
  (SELECT COALESCE(SUM(amount_ugx), 0) 
   FROM payment_transactions 
   WHERE purchase_order_id = po.id) - po.total_amount_ugx as "overpayment"
FROM purchase_orders po
HAVING (SELECT COALESCE(SUM(amount_ugx), 0) 
        FROM payment_transactions 
        WHERE purchase_order_id = po.id) > po.total_amount_ugx
ORDER BY "overpayment" DESC;

-- Step 4: Show mismatch between stored amount_paid_ugx and actual transaction sum
SELECT 
  po.id,
  po.po_number,
  po.amount_paid_ugx as "stored_paid",
  (SELECT COALESCE(SUM(amount_ugx), 0) 
   FROM payment_transactions 
   WHERE purchase_order_id = po.id) as "actual_sum",
  po.amount_paid_ugx - (SELECT COALESCE(SUM(amount_ugx), 0) 
                        FROM payment_transactions 
                        WHERE purchase_order_id = po.id) as "difference"
FROM purchase_orders po
WHERE po.amount_paid_ugx != (SELECT COALESCE(SUM(amount_ugx), 0) 
                             FROM payment_transactions 
                             WHERE purchase_order_id = po.id)
ORDER BY po.order_date DESC;

