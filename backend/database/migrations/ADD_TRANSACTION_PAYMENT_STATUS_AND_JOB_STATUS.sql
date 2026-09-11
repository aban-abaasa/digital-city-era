-- Add payment-status (invoice vs. receipt) and job-status (service ticket
-- progress) tracking to customer POS sales.
-- Run after CREATE_TRANSACTIONS_TABLE.sql / ADD_PHARMACY_FLEXIBLE_INVENTORY.sql.
--
-- payment_status/amount_paid_ugx/balance_due_ugx mirror the existing
-- purchase_orders columns (see ADD_PURCHASE_ORDERS_COLUMNS.sql) so the
-- vocabulary is consistent across supplier-side and customer-side billing.
--
-- These fields are orthogonal to the existing `status` column:
--   status         -> record lifecycle (pending/completed/voided/refunded)
--   payment_status -> money collected (paid/partial/unpaid)
--   job_status     -> service fulfillment (pending/in_progress/ready_for_collection/collected)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS amount_paid_ugx NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS balance_due_ugx NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS job_status TEXT;

-- Backfill: every historical row predates this feature and was fully paid.
UPDATE public.transactions
SET amount_paid_ugx = total_amount, balance_due_ugx = 0
WHERE amount_paid_ugx IS NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_status_check
  CHECK (payment_status IN ('paid', 'partial', 'unpaid'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_job_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_job_status_check
  CHECK (job_status IS NULL OR job_status IN ('pending', 'in_progress', 'ready_for_collection', 'collected'));

CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_job_status ON public.transactions(job_status);

COMMENT ON COLUMN public.transactions.payment_status IS 'paid = full receipt; partial/unpaid = invoice with balance_due_ugx owed';
COMMENT ON COLUMN public.transactions.job_status IS 'Service-ticket progress for service_item sales (e.g. laundry). NULL for ordinary product sales.';
