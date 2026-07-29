-- Add the POS payment provider field required by transactionService.saveTransaction.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(100) DEFAULT 'Cash';

-- Refresh PostgREST's schema cache immediately after the column is added.
NOTIFY pgrst, 'reload schema';

SELECT 'transactions.payment_provider is ready' AS status;
