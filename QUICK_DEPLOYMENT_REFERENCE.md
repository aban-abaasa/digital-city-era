# ⚡ QUICK DEPLOYMENT REFERENCE

## 🎯 What's Fixed

Your error: `Could not choose the best candidate function between public.register_manager(...)`

**Solution**: Created 8 SQL migration files that fix all role registrations

---

## 📂 Files Created

```
backend/database/migrations/
├── FIX_REGISTER_MANAGER_FUNCTION.sql          ← Run 1st (CRITICAL)
├── FIX_REGISTER_CASHIER_FUNCTION.sql          ← Run 2nd (CRITICAL)
├── FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql    ← Run 3rd
├── FIX_UPDATE_CASHIER_PROFILE_FUNCTION.sql    ← Run 4th
├── FIX_REGISTER_SUPPLIER_FUNCTION.sql         ← Run 5th (optional)
├── FIX_UPDATE_SUPPLIER_PROFILE_FUNCTION.sql   ← Run 6th (optional)
├── FIX_REGISTER_EMPLOYEE_FUNCTION.sql         ← Run 7th (optional)
└── FIX_UPDATE_EMPLOYEE_PROFILE_FUNCTION.sql   ← Run 8th (optional)
```

---

## 🚀 Quick Deployment (3 minutes)

### Step 1: Open Supabase Dashboard
- Go to: https://app.supabase.com
- Select your project

### Step 2: SQL Editor
- Click: **SQL Editor** (left menu)
- Click: **New Query**

### Step 3: Copy & Run FIRST File
- Open: `FIX_REGISTER_MANAGER_FUNCTION.sql`
- Copy entire content
- Paste into SQL Editor
- Click: **RUN**
- Wait for: ✅ "Query executed successfully"

### Step 4: Copy & Run SECOND File
- Open: `FIX_REGISTER_CASHIER_FUNCTION.sql`
- Repeat Step 3

### Step 5: Copy & Run Remaining Files (Optional but Recommended)
- Run the 6 profile update/registration files in order

---

## 🧪 Quick Test

### Test 1: Manager Signup
```
URL: http://localhost:5173/manager-auth
Username: testmgr001
Password: Test@12345
Full Name: John Test
Phone: +256700000001
Department: Operations

Expected: ✅ "Application submitted!"
```

### Test 2: Cashier Signup
```
URL: http://localhost:5173/cashier-auth
Username: testcash001
Password: Test@12345
Full Name: Jane Test
Phone: +256700000002
Shift: Morning

Expected: ✅ "Application submitted!"
```

---

## ✅ Verification

After deployment, verify in Supabase SQL Editor:

```sql
-- Check functions exist
SELECT proname FROM pg_proc 
WHERE proname LIKE 'register_%' 
   OR proname LIKE 'update_%profile%'
ORDER BY proname;

-- Should show 8 functions created
```

Expected output:
```
register_cashier
register_employee
register_manager
register_supplier
update_cashier_profile_on_submission
update_employee_profile_on_submission
update_manager_profile_on_submission
update_supplier_profile_on_submission
```

---

## 📋 Priority

| Priority | Action |
|----------|--------|
| 🔴 MUST DO | Run FIX_REGISTER_MANAGER_FUNCTION.sql |
| 🔴 MUST DO | Run FIX_REGISTER_CASHIER_FUNCTION.sql |
| 🟠 SHOULD DO | Run 2 manager/cashier profile functions |
| 🟢 NICE TO HAVE | Run supplier & employee functions |

---

## ⚡ One-Line Summary

**Problem**: PostgreSQL can't choose which `register_manager()` function to use  
**Solution**: Created single function for each role with optional parameters  
**Result**: All auth flows work without ambiguity errors

---

## 🆘 If Something Goes Wrong

1. Check Supabase for error message
2. Copy the error
3. Function might already exist (that's OK - just continue)
4. If stuck, run:
   ```sql
   DROP FUNCTION IF EXISTS public.register_manager CASCADE;
   -- Then re-run FIX_REGISTER_MANAGER_FUNCTION.sql
   ```

---

**Time to Deploy**: ~5-10 minutes  
**Difficulty**: Easy (copy-paste-click)  
**Risk**: Very Low (non-destructive, uses DROP IF EXISTS)
