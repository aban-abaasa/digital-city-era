# Quick Fix: Payment Tracking RPC Function

## Problem
```
⚠️ Warning: Order created but payment tracking failed: 
Could not find the function
public.record_payment_with_tracking(p_amount_paid, p_notes, p_order_id, p_paid_by, p_payment_method, p_payment_reference)
in the schema cache
```

## Solution: Update the RPC Function

### Step 1: Go to Supabase SQL Editor
1. Open Supabase Dashboard
2. Click **SQL Editor** 
3. Click **New Query**

### Step 2: Copy the Fix
File: `backend/CREATE_RECORD_PAYMENT_RPC.sql`

Copy the entire content.

### Step 3: Paste and Run
1. Paste into SQL Editor
2. Click **RUN** button
3. Should complete without errors

### What the Fix Does

✅ Drops old function versions (different signatures)  
✅ Creates new function with correct parameters:
   - `p_order_id` - Purchase order ID
   - `p_amount_paid` - Amount being paid
   - `p_payment_method` - "cash", "bank_transfer", etc.
   - `p_payment_reference` - Reference number (if any)
   - `p_notes` - Payment notes
   - `p_paid_by` - Manager ID recording payment

✅ Returns all details needed by frontend:
   - `transaction_id` - UUID
   - `transaction_number` - "TXN-20251223-1a2b3c4d"
   - `amount_paid` - What was paid
   - `balance_due` - Remaining balance
   - `order_total` - Total order amount
   - `payment_status` - "unpaid" / "partially_paid" / "paid"
   - `message` - Success/error message

### Step 4: Test

1. Go to Manager Portal
2. Create a purchase order with cash payment
3. Should now show:
   - ✅ "Purchase order created successfully!"
   - 💵 Cash paid amount
   - 🔖 Transaction number
   - 📊 Balance remaining
4. Done! ✅

## If Error Still Occurs

### Check if payment_transactions table exists:
```sql
SELECT tablename FROM pg_tables 
WHERE tablename = 'payment_transactions';
```
Should return: `payment_transactions`

### Check if function was created:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'record_payment_with_tracking';
```
Should return: `record_payment_with_tracking`

### If function still not found:
```sql
-- Check all function signatures
SELECT 
  routine_name,
  routine_type,
  string_agg(parameter_name || ' ' || parameter_type, ', ')
FROM information_schema.parameters
WHERE routine_schema = 'public'
GROUP BY routine_name, routine_type
ORDER BY routine_name;
```

## Files Modified
- `backend/CREATE_RECORD_PAYMENT_RPC.sql` - Updated function signature and return type

## Expected Success
After applying the fix, you should see in the Manager Portal:
```
✅ Purchase order created successfully!

💵 CASH PAID: USh 1,000,000
🔖 Transaction #: TXN-20251223-1a2b3c4d
⏳ Awaiting supplier confirmation
📊 Balance: USh 9,000,000
```

---

**Time to fix:** 2 minutes  
**Risk:** Very Low (just updating function)  
**Blocks:** Payment recording on order creation  
