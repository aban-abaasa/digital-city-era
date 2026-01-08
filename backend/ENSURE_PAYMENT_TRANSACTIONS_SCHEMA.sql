-- Ensure payment_transactions table has all required columns
-- Add missing columns if they don't exist

ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Also ensure RLS policies exist and are permissive (since this is custom auth)
DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Users can create payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Admins can update payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Allow view payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Allow create payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Allow update payment transactions" ON payment_transactions;

-- Create permissive policies for custom auth
CREATE POLICY "Allow view payment transactions"
ON payment_transactions FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Allow create payment transactions"
ON payment_transactions FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Allow update payment transactions"
ON payment_transactions FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Verify table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_transactions'
AND table_schema = 'public'
ORDER BY ordinal_position;
