# 📋 PORTAL AUTH UPDATE GUIDE - Add Supermarket Selection & Google Sign-In

## Overview
Update all portal auth pages (Manager, Cashier, Employee, Supplier) to:
1. ✅ Fetch list of supermarkets from database
2. ✅ Show supermarket selection dropdown
3. ✅ Link user to selected supermarket on signup/signin
4. ✅ Support Google OAuth with supermarket selection

---

## Implementation Pattern

### Step 1: Add Supermarket Selection State
Add to each Auth component (`ManagerAuth.jsx`, `CashierAuth.jsx`, `EmployeeAuth.jsx`, `SupplierAuth.jsx`):

```jsx
const [supermarkets, setSupermarkets] = useState([]);
const [selectedSupermarket, setSelectedSupermarket] = useState('');
const [loadingSupermarkets, setLoadingSupermarkets] = useState(true);
```

### Step 2: Fetch Supermarkets on Mount
Add `useEffect` to fetch from database:

```jsx
useEffect(() => {
  fetchSupermarkets();
}, []);

const fetchSupermarkets = async () => {
  try {
    console.log('🏪 Fetching supermarkets...');
    const { data, error } = await supabase
      .from('supermarkets')
      .select('id, name, location')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Error fetching supermarkets:', error);
      notificationService.show('Failed to load supermarkets', 'error');
      return;
    }

    console.log('✅ Loaded supermarkets:', data);
    setSupermarkets(data || []);
    
    // Auto-select first supermarket
    if (data && data.length > 0) {
      setSelectedSupermarket(data[0].id);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLoadingSupermarkets(false);
  }
};
```

### Step 3: Add Supermarket Selection UI
Add to form before signup/login buttons:

```jsx
<div className="mb-6">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    🏪 Select Your Supermarket *
  </label>
  {loadingSupermarkets ? (
    <div className="w-full p-3 bg-gray-100 rounded-lg text-gray-600">
      Loading supermarkets...
    </div>
  ) : supermarkets.length === 0 ? (
    <div className="w-full p-3 bg-yellow-50 rounded-lg text-yellow-700">
      ⚠️ No supermarkets available. Contact an admin to create one.
    </div>
  ) : (
    <select
      value={selectedSupermarket}
      onChange={(e) => setSelectedSupermarket(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      required
    >
      <option value="">Choose a supermarket...</option>
      {supermarkets.map(market => (
        <option key={market.id} value={market.id}>
          {market.name} - {market.location}
        </option>
      ))}
    </select>
  )}
</div>
```

### Step 4: Update Signup to Save Supermarket
Modify the signup function:

```jsx
// Before: Create user in auth
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: formData.email,
  password: formData.password,
  options: {
    data: {
      full_name: formData.fullName,
      supermarket_id: selectedSupermarket  // Add this
    }
  }
});

// After: Create user record in database with supermarket_id
const { error: dbError } = await supabase
  .from('users')
  .insert([{
    auth_id: authData.user.id,
    email: formData.email,
    full_name: formData.fullName,
    phone: formData.phone,
    role: 'manager', // or 'cashier', 'employee', 'supplier'
    supermarket_id: selectedSupermarket,  // Add this
    is_active: false, // Admin needs to approve
    email_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]);

if (dbError) {
  console.error('Failed to create user record:', dbError);
  throw dbError;
}
```

### Step 5: Update Google Sign-In for Supermarket
Update `handleGoogleSignIn` function:

```jsx
const handleGoogleSignIn = async () => {
  // Validate supermarket selection
  if (!selectedSupermarket) {
    notificationService.show('Please select a supermarket first', 'warning');
    return;
  }

  try {
    setLoading(true);
    
    // Store selected supermarket in localStorage temporarily
    localStorage.setItem('selected_supermarket', selectedSupermarket);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/manager-auth`  // or /cashier-auth, etc.
      }
    });

    if (error) throw error;

    notificationService.show('🔄 Redirecting to Google...', 'info');
  } catch (error) {
    console.error('Google sign-in error:', error);
    notificationService.show(error.message || 'Failed to sign in with Google', 'error');
    setLoading(false);
  }
};
```

### Step 6: Handle Google OAuth Callback
Update the auth state change handler:

```jsx
useEffect(() => {
  const handleAuthStateChange = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!user) return;

    // Check if this is a Google OAuth user
    const isGoogleUser = user.identities?.some(id => id.provider === 'google');
    
    if (isGoogleUser) {
      const supermarketId = localStorage.getItem('selected_supermarket');
      
      if (!supermarketId) {
        console.error('No supermarket selected for Google OAuth');
        return;
      }

      console.log('👤 Creating user record for Google OAuth user...');
      
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0];
      
      // Create user record in database
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          auth_id: user.id,
          email: user.email,
          full_name: fullName,
          phone: user.user_metadata?.phone || null,
          role: 'manager',  // or appropriate role
          supermarket_id: supermarketId,
          is_active: false,  // Admin approval needed
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError && insertError.code !== '23505') {
        console.error('Failed to create user:', insertError);
      } else {
        console.log('✅ User created via Google OAuth');
        notificationService.show(
          '✅ Account created! Waiting for admin approval...',
          'success'
        );
        localStorage.removeItem('selected_supermarket');
        setTimeout(() => navigate('/'), 2000);
      }
    }
  };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN') {
        await handleAuthStateChange();
      }
    }
  );

  return () => subscription?.unsubscribe();
}, [navigate]);
```

---

## Files to Update

### 1. **ManagerAuth.jsx**
- Add supermarket state
- Add fetchSupermarkets()
- Add supermarket UI dropdown
- Update signup to include supermarket_id
- Update Google sign-in to handle supermarket

### 2. **CashierAuth.jsx**
- Same steps as ManagerAuth
- Change role to 'cashier'

### 3. **EmployeeAuth.jsx**
- Same steps as ManagerAuth
- Change role to 'employee'

### 4. **SupplierAuth.jsx**
- Same steps as ManagerAuth
- Change role to 'supplier'
- Note: Supplier records should also create a suppliers table entry

---

## Flow Diagram

```
User navigates to /manager-auth
         ↓
Load supermarkets list
         ↓
User selects supermarket
         ↓
User either:
  A) Signs up with email/password → Create user with supermarket_id
  B) Signs in with Google → Store supermarket_id → Redirect to Google → Return → Create user with supermarket_id
         ↓
User record created in database:
  - auth_id: (from Supabase Auth)
  - supermarket_id: (selected by user)
  - role: 'manager' / 'cashier' / 'employee' / 'supplier'
  - is_active: false (waiting for admin approval)
         ↓
Admin sees pending user in AdminPortal
         ↓
Admin clicks "Approve" → is_active = true
         ↓
User can now login and access their supermarket
```

---

## Key Points

✅ **Supermarket Selection Required** - All signup/signin requests must include a supermarket
✅ **Active Supermarkets Only** - Filter to show only is_active = true supermarkets
✅ **Admin Approval Needed** - All new users start with is_active = false
✅ **Google OAuth Flow** - Use localStorage to pass supermarket through OAuth redirect
✅ **Consistent Across Portals** - Apply same pattern to all 4 auth pages

---

## Testing Checklist

- [ ] Load supermarkets dropdown shows all active supermarkets
- [ ] Can't submit form without selecting supermarket
- [ ] Email/password signup creates user with supermarket_id
- [ ] Google sign-in creates user with supermarket_id
- [ ] New users appear in AdminPortal pending approvals
- [ ] After approval, users can login
- [ ] Users only see their supermarket's data

---

## Database Schema Check

Verify these tables exist in Supabase:
- `supermarkets` - with is_active column
- `users` - with supermarket_id foreign key, is_active flag

Run this SQL to verify:
```sql
SELECT * FROM information_schema.columns 
WHERE table_name='supermarkets' OR table_name='users';
```
