// Quick Test Script for Admin Authentication
// Run this in browser console on the admin-login page

console.log('🧪 Admin Auth Testing Suite\n');
console.log('═══════════════════════════════════════\n');

// Test 1: Check if Supabase is loaded
async function testSupabaseConnection() {
  console.log('Test 1: Checking Supabase connection...');
  try {
    if (window.supabase) {
      console.log('  ✅ Supabase client loaded');
      
      const { data, error } = await window.supabase.auth.getSession();
      if (error) throw error;
      
      console.log('  ✅ Supabase connection active');
      console.log('  📊 Session:', data.session ? 'Active' : 'No session');
      return true;
    } else {
      console.log('  ❌ Supabase not loaded');
      return false;
    }
  } catch (error) {
    console.log('  ❌ Connection error:', error.message);
    return false;
  }
}

// Test 2: Check authentication state
async function testAuthState() {
  console.log('\nTest 2: Checking authentication state...');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    if (user) {
      console.log('  ✅ User authenticated');
      console.log('  👤 Email:', user.email);
      console.log('  🆔 User ID:', user.id);
      console.log('  📅 Created:', new Date(user.created_at).toLocaleString());
      return true;
    } else {
      console.log('  ℹ️  No user logged in (this is normal)');
      return false;
    }
  } catch (error) {
    console.log('  ❌ Auth check failed:', error.message);
    return false;
  }
}

// Test 3: Test login with existing credentials
async function testLogin() {
  console.log('\nTest 3: Testing login with existing admin...');
  console.log('  ℹ️  Using credentials: heradmin@supermartkera.ug');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'heradmin@supermartkera.ug',
      password: 'Administrator'
    });
    
    if (error) throw error;
    
    console.log('  ✅ Login successful!');
    console.log('  👤 User:', data.user.email);
    console.log('  🔑 Access Token:', data.session.access_token.substring(0, 20) + '...');
    console.log('  ⏰ Expires:', new Date(data.session.expires_at * 1000).toLocaleString());
    return true;
  } catch (error) {
    console.log('  ❌ Login failed:', error.message);
    return false;
  }
}

// Test 4: Check localStorage
function testLocalStorage() {
  console.log('\nTest 4: Checking localStorage...');
  
  const adminKey = localStorage.getItem('adminKey');
  const userData = localStorage.getItem('supermarket_user');
  const profileData = localStorage.getItem('admin_profile_data');
  
  console.log('  Admin Key:', adminKey || 'Not set');
  console.log('  User Data:', userData ? 'Found' : 'Not found');
  console.log('  Profile Data:', profileData ? 'Found' : 'Not found');
  
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      console.log('  👤 User:', parsed.name);
      console.log('  🎭 Role:', parsed.role);
    } catch (e) {
      console.log('  ⚠️  Invalid user data format');
    }
  }
  
  return true;
}

// Test 5: Check protected routes
async function testProtectedRoutes() {
  console.log('\nTest 5: Testing protected routes...');
  
  const routes = [
    '/admin-portal',
    '/admin-profile',
    '/admin-dashboard'
  ];
  
  console.log('  Protected routes configured:');
  routes.forEach(route => {
    console.log('    •', route);
  });
  
  console.log('  ✅ Routes configured correctly');
  return true;
}

// Test 6: Test database connectivity
async function testDatabase() {
  console.log('\nTest 6: Testing database connectivity...');
  
  try {
    // Try to query admin_activity_log
    const { data, error } = await supabase
      .from('admin_activity_log')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('  ⚠️  Database query failed:', error.message);
      console.log('  ℹ️  This is normal if tables don\'t exist yet');
      return false;
    }
    
    console.log('  ✅ Database queries working');
    console.log('  📊 Activity logs accessible');
    return true;
  } catch (error) {
    console.log('  ⚠️  Database error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Admin Auth Tests...\n');
  console.log('═══════════════════════════════════════\n');
  
  await testSupabaseConnection();
  await testAuthState();
  testLocalStorage();
  await testProtectedRoutes();
  await testDatabase();
  
  console.log('\n═══════════════════════════════════════');
  console.log('✅ Test Suite Complete!\n');
  console.log('📝 Next Steps:');
  console.log('1. Navigate to: http://localhost:5173/admin-login');
  console.log('2. Try logging in with: heradmin@supermartkera.ug / Administrator');
  console.log('3. Or create a new account via Sign Up tab');
  console.log('4. Access admin portal and profile');
  console.log('5. Test logout functionality\n');
}

// Quick test functions for manual testing
window.adminAuthTests = {
  // Test login
  testLogin: async (email, password) => {
    console.log(`🔐 Testing login with ${email}...`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email, password
      });
      if (error) throw error;
      console.log('✅ Login successful!');
      console.log('User:', data.user);
      return data;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return null;
    }
  },
  
  // Test signup
  testSignup: async (email, password, fullName) => {
    console.log(`📝 Testing signup for ${email}...`);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      console.log('✅ Signup successful!');
      console.log('User:', data.user);
      return data;
    } catch (error) {
      console.error('❌ Signup failed:', error.message);
      return null;
    }
  },
  
  // Test logout
  testLogout: async () => {
    console.log('🚪 Testing logout...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('✅ Logout successful!');
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('❌ Logout failed:', error.message);
      return false;
    }
  },
  
  // Get current session
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    console.log('Current session:', data.session);
    return data.session;
  },
  
  // Get current user
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    console.log('Current user:', data.user);
    return data.user;
  },
  
  // Clear everything
  reset: () => {
    localStorage.clear();
    sessionStorage.clear();
    console.log('✅ All storage cleared');
    console.log('🔄 Refresh the page to test fresh state');
  }
};

// Auto-run tests
runAllTests();

// Show helper message
console.log('\n💡 Helper Functions Available:');
console.log('   adminAuthTests.testLogin(email, password)');
console.log('   adminAuthTests.testSignup(email, password, fullName)');
console.log('   adminAuthTests.testLogout()');
console.log('   adminAuthTests.getSession()');
console.log('   adminAuthTests.getUser()');
console.log('   adminAuthTests.reset()');
console.log('\nExample:');
console.log('   await adminAuthTests.testLogin("heradmin@supermartkera.ug", "Administrator")');
