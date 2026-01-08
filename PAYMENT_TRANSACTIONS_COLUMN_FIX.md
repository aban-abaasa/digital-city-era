# Deploy Payment Transactions Fix

## Error
```
Error recording payment: column "amount_paid" of relation "payment_transactions" does not exist
```

## Root Cause
The table schema uses `amount_ugx`, not `amount_paid`. Also needs `user_id` and proper RLS policies.

## Deploy (2 Steps)

### Step 1: Fix Table Schema
**File:** `backend/ENSURE_PAYMENT_TRANSACTIONS_SCHEMA.sql`

1. Copy entire file
2. Supabase > SQL Editor > New Query
3. Paste and Run

This adds missing columns and fixes RLS policies.

### Step 2: Deploy Updated Function
**File:** `backend/CREATE_RECORD_PAYMENT_RPC.sql`

1. Copy entire file
2. Supabase > SQL Editor > New Query
3. Paste and Run

This updates the function to use correct column names.

### Step 3: Test
Create an order with payment - should work now! ✅

## What Changed
- Changed `amount_paid` → `amount_ugx` (matches table schema)
- Added `user_id` field (required by table)
- Updated column name from `payment_notes` → `notes`
- Fixed RLS policies to be permissive (custom auth)

---

**Time:** 3 minutes  
**Risk:** Very Low
