# ❌ MANAGER REGISTRATION ERROR - FIX GUIDE

## The Problem

When managers try to sign up via `ManagerAuth.jsx`, they get this error:

```
Error: Could not choose the best candidate function between:
- public.register_manager(p_username => text, p_password => text, p_full_name => text, p_phone => text, p_department => text)
- public.register_manager(p_username => text, p_password => text, p_full_name => text, p_phone => text, p_department => text, p_assigned_supplier_id => uuid)
```

### Root Cause

PostgreSQL has **two function definitions** with similar signatures:
- One that takes 5 parameters (the one the frontend is calling)
- One that takes 6 parameters (with an additional `p_assigned_supplier_id`)

When the frontend calls with 5 parameters, PostgreSQL can't determine which function to use, causing the error.

---

## The Solution

We've created a **single, unambiguous function** that:
1. Accepts 5 required parameters + 1 optional parameter
2. Drops the old conflicting function versions
3. Creates one function that handles both cases

### File Created

**Location**: `backend/database/migrations/FIX_REGISTER_MANAGER_FUNCTION.sql`

This file:
- ✅ Enables the `pgcrypto` extension (for password hashing)
- ✅ Drops ambiguous function overloads
- ✅ Creates a single, clear function definition
- ✅ Handles the 5-parameter case (standard signup)
- ✅ Handles the 6-parameter case (with supplier assignment)
- ✅ Returns proper JSON responses
- ✅ Includes error handling

---

## How to Apply the Fix

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → Your Project
2. Open **SQL Editor**
3. Create a **New Query**
4. Copy the contents of `FIX_REGISTER_MANAGER_FUNCTION.sql`
5. Paste into the SQL Editor
6. Click **Run**
7. Wait for success message

### Option 2: Using Supabase CLI

```bash
# From your project root
cd backend

# If you have Supabase CLI installed
supabase db push

# This will apply all pending migrations
```

### Option 3: Direct PowerShell Execution (If you have psql)

```powershell
# Set your database URL
$dbUrl = "postgresql://user:password@host:port/database"

# Run the migration
cat .\database\migrations\FIX_REGISTER_MANAGER_FUNCTION.sql | psql $dbUrl
```

---

## Verification

After applying the fix, test the manager signup:

1. Go to http://localhost:5173/manager-auth
2. Fill in the signup form:
   - Username: `testmanager`
   - Password: `Test@1234`
   - Full Name: `John Manager`
   - Phone: `+256700000000`
   - Department: `Operations`
3. Click **Sign Up**
4. You should see: ✅ "Application submitted!"

If you still get an error:
- Check that the migration ran successfully (no error messages)
- Verify the function exists: `SELECT * FROM pg_catalog.pg_proc WHERE proname = 'register_manager';`
- Check user permissions in Supabase

---

## What the Function Does

```sql
register_manager(
  p_username TEXT,              -- Username for login
  p_password TEXT,              -- Raw password (gets hashed)
  p_full_name TEXT,             -- Manager's full name
  p_phone TEXT,                 -- Phone number
  p_department TEXT,            -- Department name
  p_assigned_supplier_id UUID   -- OPTIONAL: Supplier ID (can be NULL)
)
```

### Returns

```json
{
  "success": true,
  "message": "Manager registered successfully",
  "user_id": "uuid-here",
  "username": "testmanager"
}
```

Or on error:

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Frontend Code (No Changes Needed)

The frontend code in `ManagerAuth.jsx` is already correct:

```javascript
const { data, error } = await supabase.rpc('register_manager', {
  p_username: formData.username,
  p_password: formData.password,
  p_full_name: formData.fullName,
  p_phone: formData.phone,
  p_department: formData.department
});
```

This will now work with the new function definition ✅

---

## Safety Notes

- ✅ The function uses `SECURITY DEFINER` - runs with database owner privileges
- ✅ Passwords are hashed using bcrypt (`crypt()` function)
- ✅ Usernames are checked for uniqueness before insertion
- ✅ All inputs are validated
- ✅ Proper error handling with JSONB responses

---

## Troubleshooting

### Error: "Extension pgcrypto not found"
- The `pgcrypto` extension is not available in your Supabase project
- **Solution**: Use the Supabase CLI to enable it, or contact support

### Error: "Permission denied for function register_manager"
- The RPC doesn't have proper permissions
- **Solution**: Run the `GRANT EXECUTE` line again or check Supabase role settings

### Function still shows old definition
- The old function wasn't properly dropped
- **Solution**: 
  1. Drop manually: `DROP FUNCTION IF EXISTS public.register_manager CASCADE;`
  2. Run the migration again

---

## Next Steps

After the fix:
1. ✅ Test manager signup
2. ✅ Test all other auth flows (ensure they still work)
3. ✅ Check if other RPC functions need similar fixes
4. ✅ Deploy to production when ready

**Created**: December 22, 2025
**Status**: Ready to apply
