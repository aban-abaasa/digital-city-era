# Google OAuth Supermarket Selection Flow

## Updated Authentication Flow

### ✅ NEW FLOW (After Recent Updates)

```
1. User navigates to /manager-auth (or other portal)
                ↓
2. User clicks "Sign in with Google"
   (NO supermarket selection required here)
                ↓
3. Google OAuth redirects back to the auth page
                ↓
4. System checks if user account exists in database
                ↓
   IF NEW USER (first-time OAuth):
   - Show Profile Completion Form (3-step form)
   - Step 1: Personal Info + SUPERMARKET SELECTION + Other details
   - User selects supermarket from dropdown
   - User fills all personal information
   - Submit form with supermarket_id
   - User record created with supermarket_id
   - User shows in admin's pending approvals
   - Redirect to login page
                ↓
   IF EXISTING USER & PROFILE COMPLETE:
   - Show "Already approved" message
   - Redirect to portal
                ↓
   IF EXISTING USER & PROFILE INCOMPLETE:
   - Show profile completion form again
```

---

## Code Changes Made

### 1. **ManagerAuth.jsx** - UPDATED ✅

**State Management:**
- `supermarkets` - List of active supermarkets
- `selectedSupermarket` - Selected supermarket ID
- `loadingSupermarkets` - Loading state

**Key Functions:**

- `fetchSupermarkets()` - Fetches active supermarkets from database
  - Query: `select('id, name, location').eq('is_active', true)`
  - Auto-selects first supermarket

- `handleGoogleSignIn()` - SIMPLIFIED
  - No longer validates supermarket (moved to profile form)
  - Just initiates OAuth flow
  - Profile form appears after login

- `checkAuth()` - ENHANCED
  - Detects if user is Google OAuth user
  - If NEW Google user → Shows profile completion form
  - User fills form including supermarket selection
  - RPC function called with `p_supermarket_id` parameter

- `handleCompleteProfile()` - UPDATED
  - Includes `p_supermarket_id` in RPC parameters
  - Creates user record with supermarket_id linked

**UI Changes:**
- ✅ Removed supermarket dropdown from login section
- ✅ Removed supermarket dropdown from signup form
- ✅ Added supermarket dropdown to Step 1 of profile form
- ✅ Supermarket selection now REQUIRED in profile form (validated)

### 2. **CashierAuth.jsx** - UPDATED ✅

Same changes as ManagerAuth:
- Added state for supermarket management
- Added `fetchSupermarkets()` function
- Updated `checkAuth()` for Google OAuth with supermarket
- Added supermarket to profile form Step 1
- Updated `handleCompleteProfile()` with supermarket_id

### 3. **EmployeeAuth.jsx** - UPDATED ✅

Same pattern applied:
- State management added
- `fetchSupermarkets()` function
- Profile form includes supermarket selector
- Google OAuth flow creates users with supermarket_id

### 4. **SupplierAuth.jsx** - UPDATED ✅

Google-only authentication with supermarket selection:
- Added state for supermarkets
- Added `fetchSupermarkets()` in useEffect
- Shows supermarket selector BEFORE Google sign-in button
- When user completes OAuth, user record created with supermarket_id

---

## Database Requirements

### Supermarket Table Structure
```sql
CREATE TABLE supermarkets (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    ...
);
```

### Users Table - Required Column
```sql
ALTER TABLE users ADD COLUMN supermarket_id UUID REFERENCES supermarkets(id);
```

---

## RPC Function Updates Required

All RPC functions that handle user creation/registration need `p_supermarket_id` parameter:

### `register_manager` - NEEDS UPDATE
```sql
CREATE OR REPLACE FUNCTION public.register_manager(
    p_username TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_phone TEXT,
    p_department TEXT,
    p_supermarket_id UUID  -- ← ADD THIS
)
```

### `register_cashier` - NEEDS UPDATE
```sql
CREATE OR REPLACE FUNCTION public.register_cashier(
    p_username TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_phone TEXT,
    p_shift TEXT,
    p_supermarket_id UUID  -- ← ADD THIS
)
```

### `update_manager_profile_on_submission` - NEEDS UPDATE
```sql
CREATE OR REPLACE FUNCTION public.update_manager_profile_on_submission(
    p_auth_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_department TEXT,
    p_supermarket_id UUID  -- ← ADD THIS
)
```

---

## Flow Diagram

```
┌─────────────────────────────────────────────┐
│  User at /manager-auth                      │
│                                             │
│  ┌─ Login Form          ┌─ Signup Form     │
│  │                      │                  │
│  │  Username ────────→  Full Name          │
│  │  Password            Email              │
│  │  [Login Button]      Password            │
│  │  [Google Sign-In] ─┐ [Signup Button]    │
│  │                   │ [Google Sign-In] ─┐ │
└───────────────────────┼──────────────────┼─┘
                        │                  │
                        ↓                  ↓
                 OAuth with Google
                        │
                        ↓
            Session created, redirected back
                        │
                        ↓
            System checks if user exists
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ↓               ↓               ↓
    NEW USER     EXISTING USER    EXISTING USER
    No profile   Profile Complete Profile Incomplete
        │         Ready to portal │
        │         Redirect        │
        ↓                         ↓
    
    ┌─────────────────────────────┐
    │  Profile Completion Form    │
    │                             │
    │  Step 1: Personal Info      │
    │  🏪 Supermarket *           │
    │    [Dropdown ▼]             │
    │  Full Name                  │
    │  Date of Birth              │
    │  Gender                     │
    │  Phone                      │
    │  Address                    │
    │  City                       │
    │  [Next Button]              │
    │                             │
    │  Step 2: Professional Info  │
    │  Department                 │
    │  Experience                 │
    │  Education                  │
    │  [Back] [Next]              │
    │                             │
    │  Step 3: Emergency Contact  │
    │  Contact Name               │
    │  Contact Phone              │
    │  [Back] [Submit]            │
    └─────────────────────────────┘
                │
                ↓
        Create user with:
        - auth_id (from OAuth)
        - supermarket_id (from form)
        - role = 'manager'
        - is_active = false (pending approval)
                │
                ↓
        ✅ Success message
        Redirect to login page
        "Your application is pending admin approval"
```

---

## Testing Checklist

- [ ] User can sign in with Google without selecting supermarket first
- [ ] After Google OAuth, profile form appears
- [ ] Profile form Step 1 shows supermarket dropdown
- [ ] Supermarket dropdown loads all active supermarkets
- [ ] Cannot proceed without selecting supermarket (validation)
- [ ] User record created with correct supermarket_id
- [ ] New user appears in admin's pending approvals
- [ ] User can see supermarket name in dashboard
- [ ] Email/password signup still works with supermarket
- [ ] Existing users skip profile form
- [ ] RPC functions receive supermarket_id parameter

---

## Database Schema Verification

Run this to check supermarket setup:
```sql
-- Check supermarkets exist
SELECT id, name, location, is_active FROM public.supermarkets;

-- Check users have supermarket_id
SELECT id, email, role, supermarket_id FROM public.users;

-- Check foreign key exists
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE table_name='users' AND constraint_type='FOREIGN KEY';
```

---

## Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| ManagerAuth.jsx | ✅ DONE | Profile form Step 1 has supermarket selector |
| CashierAuth.jsx | ✅ DONE | Profile form Step 1 has supermarket selector |
| EmployeeAuth.jsx | ✅ DONE | Google OAuth flow updated |
| SupplierAuth.jsx | ✅ DONE | Shows supermarket before Google sign-in |
| RPC Functions | ⏳ PENDING | Need to add p_supermarket_id parameter |
| Database Schema | ✅ VERIFIED | supermarket_id column exists |

---

## Next Steps

1. **Update RPC Functions** - Add `p_supermarket_id` parameter to:
   - `register_manager`
   - `register_cashier`
   - `register_employee`
   - `update_manager_profile_on_submission`
   - Other profile submission functions

2. **Test Complete Flow** - Sign in with Google and fill profile form

3. **Verify Admin Portal** - Check that new pending users show supermarket info
