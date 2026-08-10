-- Re-open ICAN order payments that were previously auto-confirmed.
-- Run once after deploying the frontend change so suppliers can review them.
UPDATE public.payment_transactions
   SET confirmed_by_supplier = FALSE,
       payment_status = 'pending',
       confirmation_date = NULL,
       confirmation_notes = NULL,
       updated_at = now()
 WHERE payment_method = 'ican_wallet'
   AND confirmed_by_supplier = TRUE
   AND confirmation_notes ILIKE '%Auto-confirmed%';

NOTIFY pgrst, 'reload schema';
