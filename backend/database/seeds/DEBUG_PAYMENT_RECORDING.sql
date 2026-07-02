-- =====================================================================
-- DEBUG: Check what's happening with payment recording
-- =====================================================================
-- Run these queries in Supabase SQL Editor to see the issue

-- 1. Check if payment_transactions table exists and has data
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename = 'payment_transactions'
AND schemaname = 'public';

-- 2. Count records in payment_transactions
SELECT COUNT(*) as total_payments FROM payment_transactions;

-- 3. Check recent purchase orders
SELECT 
  id,
  po_number,
  supplier_id,
  total_amount_ugx,
  amount_paid_ugx,
  balance_due_ugx,
  payment_status,
  created_at
FROM purchase_orders
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check recent payment transactions
SELECT 
  id,
  purchase_order_id,
  amount_ugx,
  payment_method,
  payment_status,
  transaction_number,
  created_at
FROM payment_transactions
ORDER BY created_at DESC
LIMIT 5;

-- 5. Test the RPC function manually
-- Replace order_id with an actual order ID from above
SELECT * FROM record_payment_with_tracking(
  '12345678-1234-1234-1234-123456789012'::UUID,
  100000,
  'cash',
  'TEST-REF',
  NOW(),
  'Test payment',
  NULL::UUID
);
