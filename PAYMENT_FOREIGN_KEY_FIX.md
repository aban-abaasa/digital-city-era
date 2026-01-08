# Deploy Foreign Key Fix

## Error
```
Error recording payment: insert or update on table "payment_transactions" 
violates foreign key constraint "fk_payment_user"
```

## Root Cause
The function was generating a fake UUID for `user_id` when `p_paid_by` wasn't provided, violating the foreign key that references the `users` table.

## Deploy (2 Steps)

### Step 1: Make user_id Nullable
**File:** `backend/FIX_PAYMENT_TRANSACTIONS_USER_ID.sql`

1. Copy entire file
2. Supabase > SQL Editor > New Query
3. Paste and Run

### Step 2: Update Function
**File:** `backend/CREATE_RECORD_PAYMENT_RPC.sql` (Already updated)

1. Copy entire file
2. Supabase > SQL Editor > New Query  
3. Paste and Run

### Step 3: Test
Create an order with payment - should work now! ✅

## What Changed
- Made `user_id` column nullable in `payment_transactions` table
- Updated function to use `p_paid_by` directly (or NULL if not provided)
- Removed fake UUID generation

---

**Time:** 2 minutes  
**Risk:** Very Low
