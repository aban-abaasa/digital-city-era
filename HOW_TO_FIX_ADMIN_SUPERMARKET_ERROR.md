# How to Fix: "No supermarket_id found" Error

## Problem
When an admin switches to the Manager Portal, they see this error:
```
❌ No supermarket_id found! User must be assigned to a store.
```

## Why This Happens
The admin user in the database doesn't have a `supermarket_id` set. This is a security feature - without it, they would see ALL products from ALL stores (a data breach).

## Solution: Assign a Supermarket to the Admin

### Quick Fix (Recommended)

1. **Connect to your Supabase database**
   - Go to your Supabase project
   - Click on "SQL Editor" in the left sidebar

2. **Run the Quick Fix Script**
   - Copy the contents of `backend/QUICK_FIX_CURRENT_ADMIN.sql`
   - Paste it into the SQL Editor
   - Click "Run"

3. **Check the Output**
   You should see:
   ```
   ✅ SUCCESS!
   Admin: admin@example.com
   Supermarket created: Admin's Supermarket (ID: xxx-xxx-xxx)
   The admin can now access the Manager Portal!
   ```

4. **Have the Admin Refresh**
   - **LOG OUT** completely from the application
   - **Clear browser cache** or press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - **LOG IN** again
   - The `supermarket_id` will now be loaded into their session
   - They can now switch to Manager Portal successfully! ✅

### Alternative: Assign to Existing Supermarket

If you want to assign the admin to a supermarket that already exists:

```sql
-- Step 1: Find available supermarkets
SELECT id, name, location FROM public.supermarkets;

-- Step 2: Assign admin to one of them
UPDATE public.users
SET supermarket_id = 'YOUR-SUPERMARKET-UUID-HERE',
    updated_at = NOW()
WHERE email = 'admin@example.com'  -- Replace with actual admin email
  AND role = 'admin';
```

### Full Fix (For All Admins)

If you have multiple admins with this issue:

1. Run `backend/FIX_ADMIN_NULL_SUPERMARKET_ID.sql`
2. This will:
   - Find ALL admins without `supermarket_id`
   - Create a dedicated supermarket for each
   - Link each admin to their new supermarket

## Verification

After running the fix, verify it worked:

```sql
-- This should return 0 rows
SELECT email, role, supermarket_id
FROM public.users
WHERE role = 'admin' AND supermarket_id IS NULL;

-- This should show all admins with their supermarkets
SELECT 
  u.email,
  u.role,
  s.name AS supermarket_name
FROM public.users u
JOIN public.supermarkets s ON s.id = u.supermarket_id
WHERE u.role = 'admin';
```

## What Happens Now

### Before Fix:
- Admin logs in → `supermarket_id = NULL`
- Switches to Manager Portal
- Tries to create order
- 🚨 Error: "No supermarket_id found"
- **Would have seen ALL stores' products** (security breach prevented!)

### After Fix:
- Admin logs in → `supermarket_id = [their store's ID]`
- Switches to Manager Portal
- Tries to create order
- ✅ Sees only THEIR store's products
- Can create orders successfully

## Important Notes

1. **This is a security feature, not a bug!**
   - It prevents admins from seeing all stores' data
   - Each admin should only see their own store

2. **Admin must log out and back in**
   - The `supermarket_id` is loaded during login
   - It's cached in `localStorage` as `'supermarket_user'`
   - Logging out clears the cache
   - Logging back in loads the new `supermarket_id`

3. **Each admin gets their own store**
   - Unless you specifically assign them to an existing store
   - This ensures data isolation between stores

4. **Managers also need supermarket_id**
   - The same fix applies to managers
   - Typically assigned when the admin hires them

## Troubleshooting

### "Still seeing the error after running the script"
- Did you log out completely?
- Did you clear browser cache?
- Did you log back in?
- Check if the database update worked (run verification query)

### "Multiple admins affected"
- Run `FIX_ADMIN_NULL_SUPERMARKET_ID.sql` instead
- This fixes all admins at once

### "Want to assign admin to specific existing store"
- Use the Alternative method above
- Get the supermarket ID from the database first
- Update the admin's record with that ID

## Files Reference

- `backend/QUICK_FIX_CURRENT_ADMIN.sql` - Fix one admin quickly
- `backend/FIX_ADMIN_NULL_SUPERMARKET_ID.sql` - Fix all admins
- `backend/VERIFY_MANAGER_SUPERMARKET_ID.sql` - Diagnostic queries
- `frontend/src/components/OrderItemsSelector.jsx` - Where the check happens
