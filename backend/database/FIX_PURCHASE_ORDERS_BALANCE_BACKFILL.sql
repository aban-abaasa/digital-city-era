-- ============================================================
-- FIX: Backfill balance_due_ugx / amount_paid_ugx / payment_status
-- for purchase_orders created before the code fix that now sets
-- these correctly at creation time and syncs them on payment
-- confirmation.
--
-- Safe to re-run. Run once in Supabase SQL editor.
--
-- What was wrong (code-side, already fixed):
--   1. createPurchaseOrder() in supplierOrdersService.js read
--      orderData.supplier_id, but the manager's "New Order" form
--      (SupplierOrderManagement.jsx) sent supplierId (camelCase).
--      Every order was inserted with supplier_id = NULL, so it
--      never matched the supplier's queries (supplier_id = auth
--      uuid). Fixed to accept both key spellings.
--   2. createPurchaseOrder() never set balance_due_ugx at insert,
--      so new orders had balance_due_ugx = NULL/0 and the
--      "Add Payment" UI (gated on balance_due_ugx > 0) never
--      showed up for the manager.
--   3. Confirming a payment (SupplierPaymentConfirmations.jsx)
--      only updated the payment_transactions row — nothing rolled
--      the confirmed total back onto purchase_orders.amount_paid_ugx/
--      balance_due_ugx/payment_status, so tracked balances never
--      moved even after a payment was confirmed. Fixed by adding
--      confirmPayment()/syncOrderPaymentTotals() which updates both
--      tables together.
--
-- This script only repairs data for orders that already exist.
-- ============================================================

-- 0) This DB never got amount_paid_ugx added (this script errored with
--    "column amount_paid_ugx does not exist" before this line was added).
--    balance_due_ugx/payment_status are included defensively too, in case
--    they're also missing here despite existing in other environments —
--    this repo has several overlapping, non-idempotent-across-envs
--    migration files for purchase_orders. Safe no-op if already present.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS amount_paid_ugx DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due_ugx DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';

-- 1) Orders with no supplier assigned (NULL supplier_id) from the
--    createPurchaseOrder bug are NOT recoverable here — the intended
--    supplier was never persisted anywhere. Lists them so you can decide
--    whether to manually re-assign or recreate them.
SELECT id, po_number, manager_id, status, total_amount, ordered_at
FROM public.purchase_orders
WHERE supplier_id IS NULL
ORDER BY ordered_at DESC;

-- 2) Backfill amount_paid_ugx / balance_due_ugx / payment_status from
--    actual confirmed payment_transactions, for every order.
UPDATE public.purchase_orders po
SET
  amount_paid_ugx = COALESCE((
    SELECT SUM(pt.amount_ugx) FROM public.payment_transactions pt
    WHERE pt.purchase_order_id = po.id AND pt.confirmed_by_supplier = true
  ), 0),
  balance_due_ugx = GREATEST(
    COALESCE(po.total_amount, 0) - COALESCE((
      SELECT SUM(pt.amount_ugx) FROM public.payment_transactions pt
      WHERE pt.purchase_order_id = po.id AND pt.confirmed_by_supplier = true
    ), 0),
    0
  ),
  payment_status = CASE
    WHEN COALESCE((
      SELECT SUM(pt.amount_ugx) FROM public.payment_transactions pt
      WHERE pt.purchase_order_id = po.id AND pt.confirmed_by_supplier = true
    ), 0) <= 0 THEN 'unpaid'
    WHEN COALESCE((
      SELECT SUM(pt.amount_ugx) FROM public.payment_transactions pt
      WHERE pt.purchase_order_id = po.id AND pt.confirmed_by_supplier = true
    ), 0) >= COALESCE(po.total_amount, 0) THEN 'paid'
    ELSE 'partially_paid'
  END,
  updated_at = now();

SELECT 'Backfilled balance_due_ugx/amount_paid_ugx/payment_status for existing purchase_orders. See the SELECT above for orders with no supplier_id that need manual re-assignment.' AS status;
