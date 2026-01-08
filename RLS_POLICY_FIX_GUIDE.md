# RLS Policy Fix: Purchase Orders

## Problem
When manager tries to create a purchase order, this error appears:
```
❌ Error: new row violates row-level security policy for table 'purchase_orders'
```

## Root Cause
The `purchase_orders` table either:
1. **Has RLS enabled but NO policies defined** → All INSERT operations blocked
2. **Has RLS with incorrect policies** → Manager role doesn't match the policy conditions
3. **Policy references the wrong column or auth method** → auth_id lookup fails

## Solution: Apply RLS Policies

### Step 1: Go to Supabase SQL Editor
1. Open Supabase Dashboard → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query** button

### Step 2: Copy the Fix SQL
Open this file: [backend/FIX_PURCHASE_ORDERS_RLS.sql](../backend/FIX_PURCHASE_ORDERS_RLS.sql)

Copy the ENTIRE contents.

### Step 3: Paste and Run
1. Paste the SQL into the Supabase SQL Editor
2. Click the **RUN** button
3. Wait for success message (scroll to bottom of results)

### Expected Output
You should see:
```
✅ PURCHASE_ORDERS RLS POLICIES CONFIGURED!

📋 RLS Policies Created:
  1️⃣  Managers can CREATE purchase orders
  2️⃣  Managers can VIEW all purchase orders
  3️⃣  Managers can UPDATE purchase orders
  4️⃣  Suppliers can VIEW their own orders
  5️⃣  Admins have FULL access
```

## What the Fix Does

### RLS Policies Created:
1. **Managers can CREATE** - Allows managers to insert new purchase orders
2. **Managers can VIEW** - Managers see all orders (own and others)
3. **Managers can UPDATE** - Managers can update order status and payments
4. **Suppliers can VIEW** - Suppliers only see orders assigned to them
5. **Admins have FULL** - Admins can do everything

### Security Benefits:
- ✅ Managers can create and manage orders (your main need)
- ✅ Suppliers only see their own orders (data isolation)
- ✅ Admins have full access (administration)
- ✅ Prevents unauthorized access (RLS protection)

## Testing the Fix

### Test 1: Manager Creates Order
1. Go to Manager Portal
2. Create a new purchase order
3. Should succeed now (no RLS error)
4. Order appears in order list

### Test 2: Supplier Views Order
1. Switch to Supplier Portal
2. Check "Orders" tab
3. Should see only orders assigned to this supplier
4. Cannot see other suppliers' orders (security works!)

### Test 3: Payment Recording
1. Manager creates order with initial cash payment
2. Payment should be recorded without error
3. Payment appears in payment tracker

## If Still Getting Error

### Check 1: Verify Table Exists
In SQL Editor, run:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'purchase_orders'
);
```
Should return: `true`

### Check 2: Verify Manager User Exists
In SQL Editor, run:
```sql
SELECT COUNT(*) as manager_count 
FROM public.users 
WHERE role = 'manager';
```
Should return: `1` or higher

### Check 3: Verify Manager's auth_id is Set
In SQL Editor, run:
```sql
SELECT id, username, role, auth_id 
FROM public.users 
WHERE role = 'manager' 
LIMIT 1;
```
The `auth_id` should NOT be NULL

### Check 4: Review RLS Policies
In SQL Editor, run:
```sql
SELECT policyname, qual 
FROM pg_policies 
WHERE tablename = 'purchase_orders' 
AND schemaname = 'public';
```
Should show the 5 policies we just created

## Common Issues & Solutions

### Issue: "Manager user not found"
**Solution:** Manager must be registered in the system first
- Go to Manager Portal login
- Complete manager registration if not done
- Verify user appears in users table with role='manager'

### Issue: "auth_id is NULL in users table"
**Solution:** Manager's auth_id hasn't been linked
- This happens when manual signup bypasses Supabase Auth
- Run this SQL to link them:
```sql
UPDATE public.users 
SET auth_id = auth.uid()
WHERE role = 'manager' 
AND auth_id IS NULL;
```

### Issue: Still getting RLS error after applying fix
**Solution:** Disable RLS temporarily for testing
```sql
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;
```
If this works, the issue is with RLS policy syntax. Contact Supabase support with the policy details.

## Rollback Instructions

If you need to revert this change:
```sql
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;
```

This disables ALL RLS, allowing everyone full access (not recommended for production).

## Files Modified
- `backend/FIX_PURCHASE_ORDERS_RLS.sql` - The fix SQL script

## Related Issues Fixed
- ✅ Manager can now create purchase orders
- ✅ RLS properly isolates supplier data
- ✅ Admin oversight maintained
- ✅ Payment recording workflows supported

## Next Steps
1. Apply the SQL fix from `FIX_PURCHASE_ORDERS_RLS.sql`
2. Test creating a purchase order
3. Verify payment recording works
4. Check supplier can see their orders
