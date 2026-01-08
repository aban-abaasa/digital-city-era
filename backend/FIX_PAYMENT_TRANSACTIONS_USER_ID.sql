-- Fix foreign key constraint for payment_transactions
-- Make user_id nullable so we can handle cases where p_paid_by is not provided

ALTER TABLE payment_transactions
ALTER COLUMN user_id DROP NOT NULL;

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_transactions'
AND column_name = 'user_id';
