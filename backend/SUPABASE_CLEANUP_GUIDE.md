# 🧹 SUPABASE CLEANUP VIA NODE.JS

## Quick Start

### Option 1: Direct Terminal Cleanup (Easiest)

```bash
cd c:\Users\MACROS\Desktop\fare\SupermartKera-main\backend
node SUPABASE_CLEANUP.js
```

### Option 2: Via npm script

Add to `package.json`:
```json
{
  "scripts": {
    "cleanup:supabase": "node SUPABASE_CLEANUP.js",
    "cleanup:supabase:safe": "node SUPABASE_CLEANUP.js --safe"
  }
}
```

Then run:
```bash
npm run cleanup:supabase
```

---

## Setup Steps

### 1. Install Supabase Client (One time)
```bash
cd backend
npm install @supabase/supabase-js
```

### 2. Create `.env` file in backend folder

**File:** `backend/.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**
1. Go to: https://app.supabase.com
2. Select your **SupermartKera** project
3. Go to: **Settings** → **API**
4. Copy:
   - `Project URL` → SUPABASE_URL
   - `anon public` → SUPABASE_ANON_KEY

### 3. Run the cleanup
```bash
node SUPABASE_CLEANUP.js
```

---

## What It Does

✅ Deletes all orders
✅ Deletes all order items
✅ Deletes all sales transactions
✅ Deletes all inventory records
✅ Deletes all stock movements
✅ Deletes all user records

**KEEPS INTACT:**
- ✅ Database schema (columns)
- ✅ All functions (RPC functions)
- ✅ All triggers
- ✅ All indices

---

## Safety Features

✅ Asks for confirmation
✅ Requires explicit approval: "YES I WANT TO DELETE EVERYTHING"
✅ Cannot accidentally delete (typo prevention)
✅ Shows what's being deleted
✅ Reports errors clearly

---

## Example Run

```
🧹 SUPABASE DATA CLEANUP TOOL

⚠️  WARNING: This will DELETE all data from your Supabase database!
⚠️  This action CANNOT be undone!

Are you absolutely sure? Type "YES I WANT TO DELETE EVERYTHING" to continue: YES I WANT TO DELETE EVERYTHING

🚀 Starting cleanup...

📦 Deleting orders...
✅ Orders deleted

📝 Deleting order items...
✅ Order items deleted

💳 Deleting sales transactions...
✅ Sales transactions deleted

📊 Deleting inventory...
✅ Inventory deleted

📈 Deleting stock movements...
✅ Stock movements deleted

👥 Deleting users...
✅ Users deleted

✅ ALL DATA CLEANUP COMPLETE!

Database is now clean:
  ✅ Schema preserved (columns, functions, triggers)
  ✅ All user data deleted
  ✅ All orders deleted
  ✅ All inventory deleted
  ✅ All transactions deleted

🎯 Ready for fresh start!
```

---

## If You Get Errors

### Error: "Cannot find module '@supabase/supabase-js'"
**Fix:** Run `npm install @supabase/supabase-js` in backend folder

### Error: "SUPABASE_URL is not set"
**Fix:** Create `.env` file with your credentials

### Error: "Invalid API key"
**Fix:** Check your SUPABASE_ANON_KEY in .env file

---

## Alternative: Direct SQL in Supabase

If you prefer SQL in Supabase dashboard:

1. Go to: https://app.supabase.com
2. Select your project
3. Go to: **SQL Editor**
4. Click: **New Query**
5. Open: `backend/database/SUPABASE_DATA_CLEANUP.sql`
6. Copy entire file
7. Paste in SQL Editor
8. Click **RUN**

---

## ✅ Verification

After cleanup, verify in Supabase:

```sql
-- Check all tables are empty
SELECT 'users' as table_name, COUNT(*) FROM public.users
UNION ALL
SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL
SELECT 'inventory', COUNT(*) FROM public.inventory;

-- Should return 0 for all
```

---

**Last Updated:** December 21, 2025
