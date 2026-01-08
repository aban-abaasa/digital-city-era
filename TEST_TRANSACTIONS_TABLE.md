# Transaction System Diagnostic Test

## Step 1: Verify Transactions Table Exists

Run this in Supabase SQL Editor:

```sql
-- Check if transactions table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'transactions';
```

**Expected Result**: Should return one row with `transactions` as the table_name

## Step 2: Check Table Structure

```sql
-- View all columns in transactions table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions'
ORDER BY ordinal_position;
```

**Expected Columns**:
- id (UUID)
- transaction_id (VARCHAR)
- receipt_number (VARCHAR)
- cashier_id (UUID, nullable)
- cashier_name (VARCHAR)
- subtotal (DECIMAL)
- tax_amount (DECIMAL)
- total_amount (DECIMAL)
- payment_method (VARCHAR)
- payment_provider (VARCHAR)
- items_count (INTEGER)
- customer_name (VARCHAR)
- status (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## Step 3: Check RLS Policies

```sql
-- View RLS policies on transactions table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'transactions';
```

**Expected**: Should show at least 2 policies for SELECT and INSERT

## Step 4: Count Existing Transactions

```sql
-- Count all transactions
SELECT COUNT(*) as total_transactions, 
       SUM(total_amount) as total_sales,
       MAX(created_at) as latest_transaction
FROM public.transactions;
```

**If result shows 0 transactions**: The table exists but is empty (need to process payments in Cashier Portal)

## Step 5: Test INSERT Permission

```sql
-- Test insert with a sample transaction (replace UUIDs as needed)
INSERT INTO public.transactions (
  transaction_id,
  receipt_number,
  cashier_id,
  cashier_name,
  subtotal,
  tax_amount,
  total_amount,
  payment_method,
  payment_provider,
  items_count,
  customer_name,
  status
) VALUES (
  'TEST_TXN_' || now()::text,
  'TEST_RCP_' || to_char(now(), 'YYYYMMDD-HH24MISS'),
  NULL,
  'Test Cashier',
  10000.00,
  1800.00,
  11800.00,
  'cash',
  'Cash',
  1,
  'Test Customer',
  'completed'
);
```

**Expected**: Should insert successfully

## Step 6: Verify Test Transaction

```sql
-- Query the test transaction we just inserted
SELECT transaction_id, receipt_number, total_amount, created_at
FROM public.transactions
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**: Should show the test transaction we just inserted

## Step 7: Check Indexes

```sql
-- View all indexes on transactions table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transactions';
```

**Expected**: Should show at least 6 indexes for query performance

## What to Do If Tests Fail

### If table doesn't exist:
1. Go to Supabase Dashboard → SQL Editor → New Query
2. Copy entire contents of: `backend/database/migrations/CREATE_TRANSACTIONS_TABLE.sql`
3. Paste and click Run
4. Wait for success message
5. Rerun test

### If RLS policies are missing:
The policies might not have been created. Check if the CREATE_TRANSACTIONS_TABLE.sql has the full policy creation code and rerun it.

### If you can't insert:
Check RLS policies. Might need to run:

```sql
-- Allow inserts for authenticated users
CREATE POLICY "Allow users to insert transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

## Next Steps After Verifying Table

1. **Test Data Entry**: Go to Cashier Portal and process a real payment
2. **Check Browser Console**: Should see "✅ Transaction saved: RCP-XXXXX"
3. **Check Supabase**: Query should show the new transaction
4. **Reload TransactionHistory**: Should display the transaction with real data

---

## Quick Verification Checklist

- [ ] Transactions table exists in Supabase
- [ ] Table has all 30+ columns
- [ ] RLS policies are configured
- [ ] Test insert succeeds
- [ ] Indexes are created
- [ ] Can query transactions successfully
- [ ] TransactionHistory component loads without errors
