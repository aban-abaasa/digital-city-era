# 🚀 COMPLETE RPC FUNCTION FIXES - ALL ROLES DEPLOYMENT GUIDE

## Overview

All authentication role registrations have been fixed to resolve PostgreSQL function overloading issues. This guide provides step-by-step deployment instructions for all roles.

---

## 📋 Files Created (7 SQL Migration Files)

### Registration Functions (4 files)
1. ✅ **FIX_REGISTER_MANAGER_FUNCTION.sql** - Manager signup fix
2. ✅ **FIX_REGISTER_CASHIER_FUNCTION.sql** - Cashier signup fix
3. ✅ **FIX_REGISTER_SUPPLIER_FUNCTION.sql** - Supplier signup fix (if using traditional auth)
4. ✅ **FIX_REGISTER_EMPLOYEE_FUNCTION.sql** - Employee signup fix (if using traditional auth)

### Profile Update Functions (3 files)
5. ✅ **FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql** - Manager profile completion
6. ✅ **FIX_UPDATE_CASHIER_PROFILE_FUNCTION.sql** - Cashier profile completion
7. ✅ **FIX_UPDATE_SUPPLIER_PROFILE_FUNCTION.sql** - Supplier profile completion
8. ✅ **FIX_UPDATE_EMPLOYEE_PROFILE_FUNCTION.sql** - Employee profile completion

**Location**: `backend/database/migrations/`

---

## 🔧 Deployment Process

### Phase 1: Critical Fixes (MUST RUN FIRST)

These fix the immediate registration errors:

#### Step 1️⃣ Manager Registration Fix
```sql
-- Run: FIX_REGISTER_MANAGER_FUNCTION.sql
```

This fixes the main error you encountered. It:
- ✅ Resolves function overloading issue
- ✅ Creates single `register_manager()` function
- ✅ Enables manager signup via `/manager-auth`

**Test**: http://localhost:5173/manager-auth

---

#### Step 2️⃣ Cashier Registration Fix
```sql
-- Run: FIX_REGISTER_CASHIER_FUNCTION.sql
```

Prevents same issue for cashiers:
- ✅ Creates single `register_cashier()` function
- ✅ Enables cashier signup via `/cashier-auth`

**Test**: http://localhost:5173/cashier-auth

---

### Phase 2: Profile Update Functions (SUPPORTING)

These enable profile completion for OAuth flows:

#### Step 3️⃣ Manager Profile Update
```sql
-- Run: FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql
```

Allows managers to complete profiles after Google OAuth

---

#### Step 4️⃣ Cashier Profile Update
```sql
-- Run: FIX_UPDATE_CASHIER_PROFILE_FUNCTION.sql
```

Allows cashiers to complete profiles after Google OAuth

---

#### Step 5️⃣ Supplier Registration Fix
```sql
-- Run: FIX_REGISTER_SUPPLIER_FUNCTION.sql
```

If suppliers use traditional (non-OAuth) signup

---

#### Step 6️⃣ Supplier Profile Update
```sql
-- Run: FIX_UPDATE_SUPPLIER_PROFILE_FUNCTION.sql
```

Allows suppliers to complete profiles after OAuth

---

#### Step 7️⃣ Employee Registration Fix
```sql
-- Run: FIX_REGISTER_EMPLOYEE_FUNCTION.sql
```

If employees use traditional (non-OAuth) signup

---

#### Step 8️⃣ Employee Profile Update
```sql
-- Run: FIX_UPDATE_EMPLOYEE_PROFILE_FUNCTION.sql
```

Allows employees to complete profiles after OAuth

---

## 📱 How to Apply via Supabase Dashboard

### For Each SQL File:

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select your project

2. **Go to SQL Editor**
   - Click: **SQL Editor** (left sidebar)
   - Click: **New Query**

3. **Copy & Paste SQL**
   - Open the migration file
   - Copy ALL contents
   - Paste into the SQL Editor

4. **Execute**
   - Click: **Run** button
   - Wait for: ✅ "Query executed successfully"

5. **Check for Errors**
   - If error appears, note it and skip to next file
   - Most errors mean the function doesn't exist yet (which is fine)

---

## 📝 Recommended Deployment Order

```
1. FIX_REGISTER_MANAGER_FUNCTION.sql        ← PRIORITY 1 (Most Important)
2. FIX_REGISTER_CASHIER_FUNCTION.sql        ← PRIORITY 2 
3. FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql  ← PRIORITY 3
4. FIX_UPDATE_CASHIER_PROFILE_FUNCTION.sql  ← PRIORITY 4
5. FIX_REGISTER_SUPPLIER_FUNCTION.sql       ← Optional (if used)
6. FIX_UPDATE_SUPPLIER_PROFILE_FUNCTION.sql ← Optional (if used)
7. FIX_REGISTER_EMPLOYEE_FUNCTION.sql       ← Optional (if used)
8. FIX_UPDATE_EMPLOYEE_PROFILE_FUNCTION.sql ← Optional (if used)
```

---

## 🧪 Testing Each Function

### Test Manager Signup

**URL**: http://localhost:5173/manager-auth

**Test Data**:
```
Username:     testmgr001
Password:     Test@12345
Full Name:    John Manager
Phone:        +256700000001
Department:   Operations
```

**Expected**: ✅ "Application submitted!"

---

### Test Cashier Signup

**URL**: http://localhost:5173/cashier-auth

**Test Data**:
```
Username:     testcash001
Password:     Test@12345
Full Name:    Jane Cashier
Phone:        +256700000002
Shift:        Morning
```

**Expected**: ✅ "Application submitted!"

---

### Test Supplier (if applicable)

**URL**: http://localhost:5173/supplier-auth (OAuth)

**Steps**:
1. Click "Sign in with Google"
2. Complete profile form
3. Click "Submit"

**Expected**: ✅ "Profile submitted successfully"

---

### Test Employee (if applicable)

**URL**: http://localhost:5173/employee-auth (OAuth)

**Steps**:
1. Click "Sign in with Google"
2. Complete profile form
3. Click "Submit"

**Expected**: ✅ "Profile submitted successfully"

---

## 🔍 Verification Queries

Run these in Supabase SQL Editor to verify functions exist:

```sql
-- Check if functions exist
SELECT 
  p.proname as function_name,
  p.pronargs as param_count,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
WHERE p.proname LIKE 'register_%' 
   OR p.proname LIKE 'update_%profile%'
ORDER BY p.proname;

-- Check specific function
SELECT COUNT(*) FROM pg_proc 
WHERE proname = 'register_manager';

-- Check function signature
\df public.register_manager
```

---

## 📊 What Each Function Does

### Registration Functions

#### register_manager(username, password, fullname, phone, department, [supplier_id])
- Creates manager user account
- Hashes password with bcrypt
- Checks for duplicate usernames
- Returns JSON response with user_id

#### register_cashier(username, password, fullname, phone, shift, [supermarket_id])
- Creates cashier user account
- Hashes password with bcrypt
- Stores shift information
- Returns JSON response with user_id

#### register_supplier(username, password, fullname, phone, company_name, [license], [category])
- Creates supplier user account
- Hashes password with bcrypt
- Stores company details
- Returns JSON response with user_id

#### register_employee(username, password, fullname, phone, position, [department])
- Creates employee user account
- Hashes password with bcrypt
- Stores position/department
- Returns JSON response with user_id

### Profile Update Functions

#### update_manager_profile_on_submission(auth_id, fullname, phone, department)
- Used by OAuth managers to complete profile
- Auto-assigns admin
- Sets profile_completed=true
- Sets is_active=false (pending approval)

#### update_cashier_profile_on_submission(auth_id, fullname, phone, shift)
- Used by OAuth cashiers to complete profile
- Auto-assigns admin
- Sets profile_completed=true
- Sets is_active=false (pending approval)

#### update_supplier_profile_on_submission(auth_id, fullname, company_name, phone, address, [license], [category])
- Used by OAuth suppliers to complete profile
- Auto-assigns admin
- Sets profile_completed=true
- Sets is_active=false (pending approval)

#### update_employee_profile_on_submission(auth_id, fullname, phone, position, [department], [address], [city])
- Used by OAuth employees to complete profile
- Auto-assigns admin
- Sets profile_completed=true
- Sets is_active=false (pending approval)

---

## ⚠️ Common Issues & Solutions

### Issue: "Function already exists"
**Cause**: Function was already created by previous migration
**Solution**: That's OK! The `DROP IF EXISTS` handles it. Continue to next file.

### Issue: "Extension pgcrypto not found"
**Cause**: pgcrypto extension not available
**Solution**: 
```sql
-- Run this first
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Issue: "Permission denied"
**Cause**: RPC doesn't have execute permissions
**Solution**: The `GRANT EXECUTE` lines in each SQL file handle this.

### Issue: "Function ... does not exist" when calling RPC
**Cause**: SQL migration didn't run successfully
**Solution**: 
1. Check Supabase SQL Editor for error messages
2. Check that function exists: `\df public.register_manager`
3. Re-run the SQL file if needed

### Issue: Still getting "Could not choose the best candidate function"
**Cause**: Old functions still exist
**Solution**:
```sql
-- Force drop old functions
DROP FUNCTION IF EXISTS public.register_manager CASCADE;
DROP FUNCTION IF EXISTS public.register_cashier CASCADE;

-- Then re-run the SQL files
```

---

## 🔐 Security Features

All functions include:
- ✅ **Input validation** - All fields checked
- ✅ **Password hashing** - bcrypt via pgcrypto
- ✅ **Duplicate prevention** - Username uniqueness checked
- ✅ **Error handling** - User-friendly error messages
- ✅ **SECURITY DEFINER** - Runs with appropriate privileges
- ✅ **Permissions** - GRANT to anon & authenticated users

---

## 📋 Deployment Checklist

Before running SQL:
- [ ] Backup database (recommended)
- [ ] Have all 8 SQL files ready
- [ ] Access to Supabase Dashboard

Phase 1 - Critical (Required):
- [ ] Run FIX_REGISTER_MANAGER_FUNCTION.sql
- [ ] Run FIX_REGISTER_CASHIER_FUNCTION.sql
- [ ] Test manager signup
- [ ] Test cashier signup

Phase 2 - Supporting (Recommended):
- [ ] Run FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql
- [ ] Run FIX_UPDATE_CASHIER_PROFILE_FUNCTION.sql
- [ ] Run FIX_REGISTER_SUPPLIER_FUNCTION.sql (if used)
- [ ] Run FIX_UPDATE_SUPPLIER_PROFILE_FUNCTION.sql (if used)
- [ ] Run FIX_REGISTER_EMPLOYEE_FUNCTION.sql (if used)
- [ ] Run FIX_UPDATE_EMPLOYEE_PROFILE_FUNCTION.sql (if used)

Verification:
- [ ] All functions created successfully
- [ ] All auth flows work correctly
- [ ] No RPC errors in browser console
- [ ] Users appear in database with correct roles
- [ ] Profile completion works for OAuth flows

---

## 🚀 Next Steps

1. **Deploy Phase 1** (Manager + Cashier registration)
2. **Test signing up** as manager and cashier
3. **Deploy Phase 2** (All profile updates)
4. **Test OAuth flows** if applicable
5. **Monitor logs** for 24 hours
6. **Deploy to production** when ready

---

## 📞 Support

If you encounter issues:

1. Check Supabase Activity Log
2. Verify function exists: `SELECT * FROM pg_proc WHERE proname LIKE 'register_%'`
3. Check permissions: `SELECT * FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`
4. Review browser console for error messages
5. Check database for created users

---

## 📚 Files Reference

| File | Role | Status | Order |
|------|------|--------|-------|
| FIX_REGISTER_MANAGER_FUNCTION.sql | Manager Signup | 🔴 CRITICAL | 1st |
| FIX_REGISTER_CASHIER_FUNCTION.sql | Cashier Signup | 🟠 HIGH | 2nd |
| FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql | Manager Profile | 🟡 MEDIUM | 3rd |
| FIX_UPDATE_CASHIER_PROFILE_FUNCTION.sql | Cashier Profile | 🟡 MEDIUM | 4th |
| FIX_REGISTER_SUPPLIER_FUNCTION.sql | Supplier Signup | 🟢 OPTIONAL | 5th |
| FIX_UPDATE_SUPPLIER_PROFILE_FUNCTION.sql | Supplier Profile | 🟢 OPTIONAL | 6th |
| FIX_REGISTER_EMPLOYEE_FUNCTION.sql | Employee Signup | 🟢 OPTIONAL | 7th |
| FIX_UPDATE_EMPLOYEE_PROFILE_FUNCTION.sql | Employee Profile | 🟢 OPTIONAL | 8th |

---

**Created**: December 22, 2025  
**Status**: ✅ All files ready for deployment  
**Next Action**: Run SQL files in order (Phase 1 first, then Phase 2)
