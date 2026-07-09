# Shared Supabase Authentication Fix - UPDATED

## Problem
Users authenticated in Supabase (from other applications using the same Supabase project) were unable to access this application because:

1. User had a valid `auth.users` session (Supabase authentication)
2. But no corresponding record in `public.users` table (application database)
3. The database schema uses `first_name`/`last_name` instead of `full_name`
4. Roles are stored in a separate `user_roles` table, not directly in `users`

**Error Logs:**
```
[ROLE-GUARD] auth_id= e7102092-6ee8-406e-b6e2-3ef15217d0a7 userRow= null userError= null
[ROLE-GUARD] isAuthenticated= true resolvedRole= null minLevel= 0 exactRoles= undefined isAllowed= undefined
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    status user_status DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    portal portal_type DEFAULT 'digital_city',
    ...
)
```

### User Roles Table
```sql
CREATE TABLE user_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    role user_role NOT NULL,
    supermarket_id UUID,  -- NULL for global roles
    permissions JSONB,
    UNIQUE(user_id, role, supermarket_id)
)
```

## Solution

### 1. Fixed RoleProtectedRoute Component
**File:** `frontend/src/components/RoleProtectedRoute.jsx`

**Changes:**
- Query users with JOIN to `user_roles` table
- Auto-create user record if missing
- Auto-create default `customer` role in `user_roles`
- Extract role from nested `user_roles` array

**Key Logic:**
```javascript
// Query with role relationship
let { data: userRow } = await supabase
  .from('users')
  .select(`
    id, email, first_name, last_name, email_verified,
    user_roles (role)
  `)
  .eq('id', session.user.id)
  .maybeSingle();

// Auto-create if missing
if (!userRow) {
  // Create user
  await supabase.from('users').insert({
    id: session.user.id,
    email: session.user.email,
    first_name: firstName,
    last_name: lastName,
    status: 'active',
    email_verified: !!session.user.email_confirmed_at,
    portal: 'digital_city',
  });
  
  // Create role
  await supabase.from('user_roles').insert({
    user_id: session.user.id,
    role: 'customer',
    supermarket_id: null,
    permissions: {},
  });
}

// Extract role
const role = userRow?.user_roles?.[0]?.role?.toLowerCase() || null;
```

### 2. Updated Mock Service Login
**File:** `frontend/src/services/mockData.jsx`

**Changes:**
- Query users with `user_roles` relationship
- Auto-create both user and role records if missing
- Convert multi-table structure to flat user object
- Extract primary role from `user_roles` array

**Benefits:**
- Seamless integration with actual database schema
- Works with users from other applications
- Maintains backward compatibility with demo users
- Supports multiple roles per user

### 3. Database Migration (RECOMMENDED)
**File:** `backend/database/migrations/FIX_AUTO_SIGNUP_TRIGGER_V2.sql`

**Changes:**
- Trigger creates user in `users` table
- Trigger creates role in `user_roles` table
- Handles name splitting properly (first/last)
- Proper error handling for UNIQUE constraints
- Backfills ALL existing `auth.users`

**Run This Migration:**
```bash
# Via psql
psql -h your-db-url -U postgres -d postgres < backend/database/migrations/FIX_AUTO_SIGNUP_TRIGGER_V2.sql

# Or via Supabase Dashboard SQL Editor
# Copy and paste the contents of FIX_AUTO_SIGNUP_TRIGGER_V2.sql
```

## How It Works Now

### For New Users
1. User signs up via Supabase Auth (any application)
2. Trigger `on_auth_user_created` fires
3. Creates record in `public.users` table
4. Creates `customer` role in `public.user_roles` table
5. User can immediately access the application

### For Existing Users (Already in auth.users)
1. User authenticates with existing Supabase credentials
2. `RoleProtectedRoute` queries users with user_roles JOIN
3. If not found, auto-creates user + role records
4. User granted immediate access with `customer` role

### Fallback Mechanism
Three layers of protection:
1. **Database Trigger**: Auto-creates on signup (recommended)
2. **RoleProtectedRoute**: Auto-creates on first page load
3. **MockService**: Auto-creates during login process

## Testing

### Step 1: Run the Database Migration
```bash
# Connect to Supabase and run:
psql -h db.xxx.supabase.co -U postgres -d postgres \
  < backend/database/migrations/FIX_AUTO_SIGNUP_TRIGGER_V2.sql
```

Or via **Supabase Dashboard**:
1. Go to **SQL Editor**
2. Open `FIX_AUTO_SIGNUP_TRIGGER_V2.sql`
3. Copy all contents
4. Paste and click **RUN**

### Step 2: Test Scenarios

**Scenario 1: Existing Supabase User from Another App**
1. User logs in with Google/email (already in `auth.users`)
2. Check console: `[ROLE-GUARD] User auto-created successfully`
3. User lands on `/customer-dashboard`
4. Check database: User appears in both `users` and `user_roles`

**Scenario 2: Brand New Signup**
1. New user signs up via OAuth
2. Trigger creates records automatically
3. User redirected to customer dashboard
4. No errors in console

**Scenario 3: Demo Mode Still Works**
1. Visit login without Supabase session
2. Type `customer`, `admin`, `supplier`
3. Works as before for testing

## Verification Commands

```sql
-- See all users with their roles
SELECT 
  u.id, 
  u.email, 
  u.first_name, 
  u.last_name,
  ur.role,
  u.email_verified, 
  u.created_at 
FROM public.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
ORDER BY u.created_at DESC;

-- Find users without roles (should be empty after migration)
SELECT u.* 
FROM public.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.id IS NULL;

-- Find auth users not in public.users (should be empty)
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;

-- Count users by role
SELECT ur.role, COUNT(*) 
FROM user_roles ur 
GROUP BY ur.role;
```

## Configuration

### Change Default Role
To give new users a different role by default:

**In RoleProtectedRoute.jsx (line ~95):**
```javascript
role: 'employee',  // Change from 'customer'
```

**In FIX_AUTO_SIGNUP_TRIGGER_V2.sql (line ~31):**
```sql
v_role := 'manager';  -- Change from 'customer'
```

**In mockData.jsx (line ~247):**
```javascript
role: 'cashier',  // Change from 'customer'
```

## Multi-Application Support

This fix enables multiple applications to share the same Supabase:

✅ Each app has its own `public.users` table  
✅ All apps share `auth.users` (Supabase Auth)  
✅ Users authenticate once via Supabase  
✅ Each app auto-creates its own user record  
✅ Roles can differ per application  
✅ No interference between applications  

**Example:**
- App 1 (Digital City): User is `customer`
- App 2 (ICAN): Same user is `supplier`
- Shared Supabase: One `auth.users` entry
- Separate user tables: Different roles per app

## Troubleshooting

### Issue: "column user_roles does not exist"
**Solution:** The query uses Supabase's relationship syntax. Make sure:
1. Foreign key exists: `user_roles.user_id → users.id`
2. Using `.select()` with nested syntax: `user_roles (role)`

### Issue: "duplicate key value violates unique constraint"
**Solution:** The UNIQUE constraint `(user_id, role, supermarket_id)` prevents duplicates.
- The code handles this with try/catch or ON CONFLICT
- Check if user already has the role before inserting

### Issue: User created but role is NULL
**Solution:** 
1. Check `user_roles` table: `SELECT * FROM user_roles WHERE user_id = 'xxx'`
2. If empty, manually insert: 
```sql
INSERT INTO user_roles (user_id, role, supermarket_id, permissions)
VALUES ('user-id-here', 'customer', NULL, '{}');
```

## Files Changed

1. ✅ `frontend/src/components/RoleProtectedRoute.jsx`
2. ✅ `frontend/src/services/mockData.jsx`  
3. ✅ `backend/database/migrations/FIX_AUTO_SIGNUP_TRIGGER_V2.sql` (NEW - RUN THIS!)

## Summary

✅ **Fixed**: Schema mismatch (full_name → first_name/last_name)  
✅ **Fixed**: Role storage (users.role → user_roles table)  
✅ **Added**: Auto-creation with proper schema (3 layers)  
✅ **Improved**: Database triggers with backfill  
✅ **Maintained**: Backward compatibility with demo users  
✅ **Enabled**: Multi-application Supabase sharing  
✅ **Default**: New users get `customer` role  

**Next Step:** Run `FIX_AUTO_SIGNUP_TRIGGER_V2.sql` in your Supabase database!

Users from any application using the same Supabase project can now access this application seamlessly with the correct database schema!
