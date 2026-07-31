# 🔧 Cashier Portal Database Fix

## Problem Summary

The cashier portal is failing to save transactions and receipts due to missing database columns and tables:

1. **Missing columns in `transactions` table:**
   - `payment_fee`
   - `register_number`
   - `store_location`
   - `change_given`
   - `payment_provider`
   - `payment_reference`
   - `items` (JSONB)
   - `items_count`
   - `receipt_printed`
   - `cashier_name`
   - `customer_name`
   - `customer_phone`

2. **Missing `receipts` table** - The entire table doesn't exist in Supabase

## 🚀 Quick Fix (RECOMMENDED)

### Single Script Solution

Run this ONE script in Supabase SQL Editor:

📁 **File:** `FIX_ALL_CASHIER_PORTAL_TABLES.sql`

This comprehensive script will:
- ✅ Add all missing columns to the `transactions` table
- ✅ Create the `receipts` table if it doesn't exist
- ✅ Verify all changes were applied successfully

### Steps:

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the content from `FIX_ALL_CASHIER_PORTAL_TABLES.sql`
4. Click **Run**
5. Check the output for success messages

---

## 📋 Alternative: Step-by-Step Fix

If you prefer to run fixes separately:

### Step 1: Check Current Schema

Run: `CHECK_TRANSACTIONS_SCHEMA.sql`

This will show you what columns currently exist.

### Step 2: Fix Transactions Table

Run: `database/migrations/FIX_TRANSACTIONS_PAYMENT_FEE_COLUMN.sql`

This adds all missing columns to the transactions table.

### Step 3: Create Receipts Table

Run: `database/migrations/CREATE_RECEIPTS_TABLE.sql`

This creates the complete receipts table with all necessary columns.

---

## 🔍 Verification

After running the fix script, verify the changes:

```sql
-- Check transactions table
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions'
ORDER BY ordinal_position;

-- Check receipts table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'receipts';
```

---

## ⚠️ Important Notes

1. **Backup First**: If you have important data in the `transactions` table, consider backing it up first
2. **RLS Policies**: The scripts include Row Level Security (RLS) policies - verify they match your security requirements
3. **Schema Cache**: After running the scripts, Supabase's schema cache will automatically refresh (may take 1-2 seconds)
4. **Existing Data**: All existing transactions will remain intact - we're only adding new columns with default values

---

## 🧪 Testing

After applying the fix:

1. Refresh your frontend application
2. Try to complete a transaction in the cashier portal
3. Check browser console - there should be no more "column not found" errors
4. Verify the transaction appears in your Supabase dashboard

---

## 📁 File Locations

- **Comprehensive Fix**: `FIX_ALL_CASHIER_PORTAL_TABLES.sql` (in backend folder)
- **Schema Check**: `CHECK_TRANSACTIONS_SCHEMA.sql` (in backend folder)
- **Transactions Fix**: `backend/database/migrations/FIX_TRANSACTIONS_PAYMENT_FEE_COLUMN.sql`
- **Receipts Creation**: `backend/database/migrations/CREATE_RECEIPTS_TABLE.sql`
- **Original Transactions Schema**: `backend/database/migrations/CREATE_TRANSACTIONS_TABLE.sql`

---

## 🆘 Still Having Issues?

If you still get errors after running the fix:

1. Check the Supabase SQL Editor output for any error messages
2. Verify your user has permission to ALTER tables
3. Try refreshing the Supabase schema cache manually (Dashboard → Settings → API → "Refresh schema")
4. Check if you're connected to the correct Supabase project

---

## ✅ Success Indicators

You'll know the fix worked when:

- ✅ No more "Could not find the 'XXX' column" errors in console
- ✅ Transactions save successfully in the cashier portal
- ✅ Receipts are generated and stored
- ✅ You can see transaction data in Supabase dashboard

---

**Need Help?** Check the error messages in your browser console or Supabase logs for specific issues.
