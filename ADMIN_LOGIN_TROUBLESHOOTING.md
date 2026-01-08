# 🔐 ADMIN LOGIN TROUBLESHOOTING GUIDE

## Diagnostic Status ✅
**All authentication checks passed!**

The admin account is properly configured:
- ✅ Admin user exists: `abanabaasa2@gmail.com`
- ✅ Auth ID is linked
- ✅ Email is confirmed
- ✅ User is active

---

## Common Admin Login Issues & Fixes

### Issue 1: "Invalid email or password" Error
**Symptoms:** Can't login with correct credentials

**Solutions:**
1. **Verify email is confirmed**
   - Check Supabase > Authentication > Users
   - Look for "Email Confirmed" status
   - If not confirmed, user needs to click confirmation link in email

2. **Check Supabase credentials**
   - Frontend `.env` should have `VITE_SUPABASE_ANON_KEY`
   - Backend `.env` should have `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
   - Verify keys match your Supabase project

3. **Clear browser cache**
   - Press `Ctrl+Shift+Del` (Windows) or `Cmd+Shift+Del` (Mac)
   - Clear cookies and cached data for `localhost:5173`
   - Try logging in again

### Issue 2: Login redirects to /admin-auth instead of /admin-portal
**Symptoms:** After login, page doesn't navigate to admin portal

**Solutions:**
1. **Check browser console errors**
   - Open DevTools (F12)
   - Check Console tab for error messages
   - Look for Supabase connection errors

2. **Verify admin-portal page exists**
   - Check that `frontend/src/pages/AdminPortal.jsx` exists
   - Verify route is configured in `frontend/src/App.jsx` or routing file

3. **Check localStorage permissions**
   - Admin login sets `localStorage.adminKey = 'true'`
   - Verify localStorage is enabled
   - Try incognito/private window (test localStorage isolation)

### Issue 3: Google OAuth Sign-in Not Working
**Symptoms:** Click "Sign in with Google" button but nothing happens

**Solutions:**
1. **Verify Google OAuth is configured**
   - Go to Supabase > Authentication > Providers
   - Enable Google provider
   - Add Client ID and Client Secret

2. **Check redirect URLs**
   - Supabase Google settings should include: `http://localhost:5173`
   - For production: `https://your-domain.com`

3. **Check browser console**
   - Look for CORS errors
   - Check for authentication errors from Supabase

### Issue 4: Account Created But Can't Login
**Symptoms:** Signup succeeds but then can't login

**Solutions:**
1. **Check if user record was created**
   ```sql
   SELECT * FROM users WHERE email = 'your-email@example.com';
   ```

2. **Verify auth_id link**
   - If auth_id is NULL, update it:
   ```sql
   UPDATE users 
   SET auth_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
   WHERE email = 'your-email@example.com';
   ```

3. **Verify email confirmation**
   ```sql
   SELECT email, email_confirmed_at FROM auth.users WHERE email = 'your-email@example.com';
   ```

---

## How Admin Login Works

### Step-by-Step Flow:

1. **User visits** `/admin-auth`
2. **Enters credentials** (email + password)
3. **Frontend calls** `supabase.auth.signInWithPassword()`
4. **Auth succeeds** - JWT token issued
5. **Frontend creates user record** in `users` table (if not exists)
6. **Sets localStorage flags:**
   - `adminKey = 'true'`
   - `supermarket_user` JSON object
7. **Navigates** to `/admin-portal`
8. **Admin portal checks**:
   - Supabase session exists
   - User role = 'admin'
   - Shows dashboard

---

## Testing Admin Login

### Quick Test (Browser Console)
1. Open DevTools (F12)
2. Go to Console tab
3. Run these commands:

```javascript
// Test 1: Check Supabase connection
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.email);

// Test 2: Check admin session
const adminSession = localStorage.getItem('adminKey');
console.log('Admin session:', adminSession);

// Test 3: Check user record
const { data: adminRecord } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'admin')
  .single();
console.log('Admin record:', adminRecord);
```

### Backend Diagnostic
Run this script to check all admin settings:

```bash
cd backend
node diagnose-admin-login.js
```

---

## Fix Applied: Duplicate Redirect Bug

**Issue Found:** In `AdminAuth.jsx` handleLogin function, there was duplicate redirect logic:
```javascript
// BEFORE (Bug)
setTimeout(() => {
  navigate('/admin-portal');
}, 500);

// DUPLICATE - unnecessary
setTimeout(() => {
  navigate('/admin-portal');
}, 500);
```

**Fixed:** Removed duplicate, now single redirect only.

---

## Still Having Issues?

### Step-by-Step Debugging:

1. **Check browser console** for specific error messages
   - Note exact error text
   - Take screenshot if needed

2. **Run diagnostic script**
   ```bash
   node backend/diagnose-admin-login.js
   ```

3. **Clear everything and retry**
   - Clear browser cache
   - Clear localStorage: `localStorage.clear()`
   - Refresh page
   - Try login again

4. **Test with magic link**
   - Instead of password, use "Sign with Magic Link"
   - Check email for sign-in link
   - Click link to login

5. **Check Supabase directly**
   - Go to Supabase > Users > Authentication
   - Verify user exists
   - Check email_confirmed_at status
   - Verify user metadata

---

## Related Files

- Frontend auth: `frontend/src/pages/AdminAuth.jsx` (1032 lines)
- Admin portal: `frontend/src/pages/AdminPortal.jsx`
- Supabase config: `frontend/src/services/supabase.js`
- Diagnostic: `backend/diagnose-admin-login.js`

---

## Support

If you continue to experience issues:
1. Share the exact error message
2. Run: `node backend/diagnose-admin-login.js` and share output
3. Open browser DevTools > Console and share any errors
