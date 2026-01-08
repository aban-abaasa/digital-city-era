# 🔧 FIX: Google OAuth Redirecting to FARM-AGENT

## Problem
When signing in with Google in Digital City Era, it redirects to FARM-AGENT instead of Digital City portals.

## Root Cause
The Supabase Auth configuration has **FARM-AGENT URLs** in the redirect URLs instead of Digital City URLs.

---

## ✅ SOLUTION: Update Supabase Dashboard Settings

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard/project/hswxazpxcgtqbxeqcxxw
2. Click on **Authentication** → **URL Configuration**

### Step 2: Update Site URL
Replace:
```
http://10.70.0.31:5000
```

With:
```
http://10.70.0.31:7779
```

### Step 3: Update Redirect URLs
**REMOVE these FARM-AGENT URLs:**
```
http://10.70.0.31:5000/**
http://localhost:5000/**
```

**ADD these Digital City URLs:**
```
http://10.70.0.31:7779/**
http://localhost:7779/**
http://localhost:7779/
http://10.70.0.31:7779/admin-auth
http://10.70.0.31:7779/manager-auth
http://10.70.0.31:7779/cashier-auth
http://10.70.0.31:7779/employee-auth
http://10.70.0.31:7779/supplier-auth
http://localhost:7779/admin-auth
http://localhost:7779/manager-auth
http://localhost:7779/cashier-auth
http://localhost:7779/employee-auth
http://localhost:7779/supplier-auth
```

### Step 4: Keep ICAN URLs (if sharing Supabase)
If ICAN is using the same Supabase instance, also keep:
```
http://10.70.0.31:3000/**
http://localhost:3000/**
```

### Step 5: Save Configuration
Click **Save** at the bottom of the page.

---

## 🧪 Test After Configuration

### Test 1: Admin Portal Google Sign-In
1. Navigate to: `http://10.70.0.31:7779/admin-auth`
2. Click "Sign in with Google"
3. Should redirect BACK to: `http://10.70.0.31:7779/admin-auth`
4. NOT to FARM-AGENT

### Test 2: Manager Portal Google Sign-In
1. Navigate to: `http://10.70.0.31:7779/manager-auth`
2. Click "Sign in with Google"
3. Should redirect BACK to: `http://10.70.0.31:7779/manager-auth`

### Test 3: Supplier Portal Google Sign-In
1. Navigate to: `http://10.70.0.31:7779/supplier-auth`
2. Click "Sign in with Google"
3. Should redirect BACK to: `http://10.70.0.31:7779/supplier-auth`

### Test 4: Employee Portal Google Sign-In
1. Navigate to: `http://10.70.0.31:7779/employee-auth`
2. Click "Sign in with Google"
3. Should redirect BACK to: `http://10.70.0.31:7779/employee-auth`

### Test 5: Cashier Portal Google Sign-In
1. Navigate to: `http://10.70.0.31:7779/cashier-auth`
2. Click "Sign in with Google"
3. Should redirect BACK to: `http://10.70.0.31:7779/cashier-auth`

---

## 📋 Redirect URLs Configuration Summary

### What Should Be in Supabase Dashboard:

**Site URL:**
```
http://10.70.0.31:7779
```

**Redirect URLs (one per line):**
```
http://10.70.0.31:7779/**
http://localhost:7779/**
http://localhost:7779/
http://10.70.0.31:7779/admin-auth
http://10.70.0.31:7779/manager-auth
http://10.70.0.31:7779/cashier-auth
http://10.70.0.31:7779/employee-auth
http://10.70.0.31:7779/supplier-auth
http://localhost:7779/admin-auth
http://localhost:7779/manager-auth
http://localhost:7779/cashier-auth
http://localhost:7779/employee-auth
http://localhost:7779/supplier-auth
http://10.70.0.31:3000/**
http://localhost:3000/**
```

---

## 🔍 Why This Happens

1. **Shared Supabase**: Digital City and FARM-AGENT were using the same Supabase instance
2. **FARM-AGENT URLs First**: FARM-AGENT URLs were configured first in Supabase
3. **Supabase Chooses First Match**: When Google OAuth returns, Supabase redirects to the first matching URL
4. **Need Specific URLs**: Add Digital City URLs to Supabase configuration

---

## ⚠️ Important Notes

- **Multiple Apps, One Supabase**: When sharing Supabase between multiple apps (ICAN, Digital City, FARM-AGENT), ALL app redirect URLs must be configured
- **Wildcards Work**: Use `http://10.70.0.31:7779/**` to allow all paths under that domain
- **Localhost + IP**: Add BOTH localhost and IP address versions for development
- **Save Changes**: Always click Save in Supabase dashboard after changes

---

## 🚀 After Fix

Once configured, Google OAuth will:
1. ✅ Redirect to correct Digital City portal
2. ✅ Create user profile in shared Supabase database
3. ✅ Work across all 5 portals (Admin, Manager, Cashier, Employee, Supplier)
4. ✅ Not interfere with ICAN or FARM-AGENT auth flows

---

## Alternative: Environment Variable Override

If you want to force a specific redirect URL in the code, add to `.env`:

```env
VITE_AUTH_REDIRECT_URL=http://10.70.0.31:7779
```

Then update the auth files to use it:
```javascript
const redirectBase = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;

const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${redirectBase}/admin-auth`  // or manager-auth, etc.
  }
});
```

But the **Supabase Dashboard configuration is the primary fix needed**.
