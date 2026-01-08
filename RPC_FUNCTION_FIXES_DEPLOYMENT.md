# 🔧 RPC FUNCTION FIXES - COMPLETE DEPLOYMENT GUIDE

## Overview

The application had **function overloading issues** in PostgreSQL where multiple RPC functions with similar parameter signatures were causing ambiguity errors. This guide provides the complete fix.

---

## Issues Fixed

### 1. ❌ Manager Registration Error
**Error**: "Could not choose the best candidate function between..."
**File**: `ManagerAuth.jsx` line 460
**Cause**: Two versions of `register_manager()` with overlapping signatures

### 2. ❌ Cashier Registration (Same Issue)
**File**: `CashierAuth.jsx` line 376
**Cause**: Same function overloading issue in `register_cashier()`

### 3. ❌ Manager Profile Update (May have similar issues)
**File**: `ManagerAuth.jsx` line 253
**Function**: `update_manager_profile_on_submission()`

---

## Files Created

Three SQL migration files have been created:

1. **`FIX_REGISTER_MANAGER_FUNCTION.sql`** ← PRIMARY FIX
   - Resolves manager signup error
   - Creates single `register_manager()` function
   
2. **`FIX_REGISTER_CASHIER_FUNCTION.sql`** ← PREVENTIVE FIX
   - Prevents cashier signup from having same issue
   - Creates single `register_cashier()` function

3. **`FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql`** ← SUPPORTING FIX
   - Ensures profile update works correctly
   - Creates `update_manager_profile_on_submission()` function

**Location**: `backend/database/migrations/`

---

## Deployment Steps

### Step 1: Apply First Fix (Manager Registration)

**Most Important** - This fixes the immediate error

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy from: `backend/database/migrations/FIX_REGISTER_MANAGER_FUNCTION.sql`
4. Paste into editor
5. Click **RUN**
6. Wait for: ✅ "Query executed successfully"

### Step 2: Apply Second Fix (Cashier Registration)

1. Click "New Query"
2. Copy from: `backend/database/migrations/FIX_REGISTER_CASHIER_FUNCTION.sql`
3. Paste into editor
4. Click **RUN**
5. Wait for: ✅ "Query executed successfully"

### Step 3: Apply Third Fix (Manager Profile Update)

1. Click "New Query"
2. Copy from: `backend/database/migrations/FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql`
3. Paste into editor
4. Click **RUN**
5. Wait for: ✅ "Query executed successfully"

---

## Testing the Fix

### Test Manager Signup

```bash
# 1. Start the frontend dev server
cd frontend
npm run dev

# 2. Navigate to signup page
# Go to: http://localhost:5173/manager-auth
```

**Test Data**:
- Username: `testmgr2024`
- Password: `Test@123456`
- Full Name: `John Manager Test`
- Phone: `+256700123456`
- Department: `Operations`

**Expected Result**:
```
✅ Application submitted! 
Your manager account is pending admin approval.
```

Then you should be redirected to login with your username pre-filled.

### Test Cashier Signup

```
# Navigate to: http://localhost:5173/cashier-auth

Username: `testcash2024`
Password: `Test@123456`
Full Name: `Jane Cashier`
Phone: `+256700654321`
Shift: `Morning`

Expected: ✅ Application submitted!
```

### Verify Functions Exist

Run in Supabase SQL Editor:

```sql
-- Check if functions exist and their signatures
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname IN ('register_manager', 'register_cashier', 'update_manager_profile_on_submission')
ORDER BY p.proname;
```

**Expected Output**: 3 functions listed with their complete definitions

---

## What Each Function Does

### 1. register_manager()

```javascript
// Called from: ManagerAuth.jsx line 460
await supabase.rpc('register_manager', {
  p_username: 'username',           // ← Required
  p_password: 'password',           // ← Required
  p_full_name: 'Full Name',        // ← Required
  p_phone: '+256700000000',        // ← Required
  p_department: 'Operations'        // ← Required
  // p_assigned_supplier_id: null  // ← Optional (not used by frontend)
});
```

**What it does**:
1. Validates all inputs
2. Checks if username already exists
3. Hashes password using bcrypt (pgcrypto)
4. Creates user record in database with role='manager'
5. Returns JSON response

**Returns**:
```json
{
  "success": true,
  "message": "Manager registered successfully",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "testmgr2024"
}
```

### 2. register_cashier()

Same pattern as `register_manager()` but:
- Sets role='cashier'
- Stores `shift` instead of `department`

### 3. update_manager_profile_on_submission()

```javascript
// Called from: ManagerAuth.jsx line 253
await supabase.rpc('update_manager_profile_on_submission', {
  p_auth_id: currentUser.id,        // ← Auth ID from Supabase Auth
  p_full_name: 'John Doe',
  p_phone: '+256700000000',
  p_department: 'Operations'
});
```

**What it does**:
1. Finds user by auth_id (for OAuth users)
2. Updates profile with provided data
3. Marks profile as completed
4. Sets is_active=false (pending approval)
5. Auto-assigns an available admin
6. Returns assignment details

**Returns**:
```json
{
  "success": true,
  "message": "Profile submitted successfully",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "assigned_admin_id": "650e8400-e29b-41d4-a716-446655440000",
  "assigned_admin_email": "admin@faredeal.ug",
  "admin_available": true,
  "profile_completed": true,
  "is_active": false,
  "pending_approval": true
}
```

---

## Technical Details

### Why Function Overloading Failed

PostgreSQL allows **function overloading** when parameter types are different:
```sql
-- ✅ Valid overloads - different parameter types
CREATE FUNCTION foo(int, text)
CREATE FUNCTION foo(int, int)

-- ❌ Invalid overloads - same types, ambiguous
CREATE FUNCTION foo(text, text, text, text, text)
CREATE FUNCTION foo(text, text, text, text, text, uuid)
-- When calling with 5 params, both functions match!
```

### Our Solution

By making the 6th parameter **optional with a DEFAULT value**:

```sql
CREATE FUNCTION register_manager(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_department TEXT,
  p_assigned_supplier_id UUID DEFAULT NULL  -- ← Optional
)
```

Now there's only ONE function signature, and PostgreSQL always knows which one to call.

### Security Features

- ✅ `SECURITY DEFINER` - Runs with elevated privileges (only for setup)
- ✅ `pgcrypto` - Bcrypt password hashing
- ✅ `GRANT EXECUTE` - Controlled access (anon + authenticated)
- ✅ Input validation - All parameters checked
- ✅ Error handling - Try/catch with user-friendly messages

---

## Verification Checklist

- [ ] Step 1: Manager registration function deployed
- [ ] Step 2: Cashier registration function deployed  
- [ ] Step 3: Manager profile update function deployed
- [ ] Test manager signup works
- [ ] Test cashier signup works
- [ ] Verify functions exist in Supabase
- [ ] Check browser console for no "RPC error" messages
- [ ] Confirm users appear in database

---

## Rollback Instructions (If Needed)

If something goes wrong, you can revert:

```sql
-- Drop the new functions
DROP FUNCTION IF EXISTS public.register_manager(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.register_cashier(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_manager_profile_on_submission(UUID, TEXT, TEXT, TEXT) CASCADE;

-- The old functions will need to be recreated if you have backups
```

---

## Common Issues & Solutions

### Issue: "Function register_manager doesn't exist"
**Cause**: Migration wasn't applied
**Solution**: 
1. Go to Supabase SQL Editor
2. Run Step 1 deployment again
3. Verify with: `SELECT * FROM pg_proc WHERE proname = 'register_manager';`

### Issue: "Permission denied" when calling RPC
**Cause**: GRANT EXECUTE didn't work
**Solution**:
```sql
-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.register_manager(TEXT, TEXT, TEXT, TEXT, TEXT, UUID) 
TO anon, authenticated;
```

### Issue: "Password crypt function not found"
**Cause**: pgcrypto extension not enabled
**Solution**:
```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Issue: Function still shows old signature
**Cause**: Old function wasn't fully dropped
**Solution**:
```sql
-- Force drop with CASCADE
DROP FUNCTION IF EXISTS public.register_manager CASCADE;
-- Then rerun Step 1
```

---

## Production Deployment

When ready for production:

1. ✅ Test all fixes locally first
2. ✅ Backup production database
3. ✅ Apply migrations in correct order (1→2→3)
4. ✅ Run tests again in production
5. ✅ Monitor for errors for 24 hours
6. ✅ Document in changelog

---

## Files Reference

| File | Purpose | Priority |
|------|---------|----------|
| `FIX_REGISTER_MANAGER_FUNCTION.sql` | Fix manager signup error | 🔴 CRITICAL |
| `FIX_REGISTER_CASHIER_FUNCTION.sql` | Fix cashier signup error | 🟠 HIGH |
| `FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql` | Fix profile completion | 🟠 HIGH |

---

## Support

If you encounter issues:

1. Check Supabase Activity Log for error details
2. Verify function exists: `\df register_manager`
3. Check user permissions: `\du` in psql
4. Review frontend console for error messages
5. Check email logs if email notifications are involved

---

**Created**: December 22, 2025
**Status**: Ready for Deployment ✅
**Next**: Apply these fixes in order, then test
