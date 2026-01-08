// Test Admin Profile Integration
// Run this in browser console to test profile functionality

console.log('🧪 Testing Admin Profile Integration...\n');

// Test 1: Check if Supabase is loaded
async function testSupabase() {
  try {
    const { data, error } = await window.supabase.auth.getUser();
    if (error) throw error;
    console.log('✅ Test 1: Supabase Connection');
    console.log('   User ID:', data.user?.id);
    console.log('   Email:', data.user?.email);
    return true;
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
    return false;
  }
}

// Test 2: Check localStorage
function testLocalStorage() {
  try {
    const profileData = localStorage.getItem('admin_profile_data');
    const avatar = localStorage.getItem('admin_avatar');
    
    console.log('\n✅ Test 2: LocalStorage');
    console.log('   Profile Data:', profileData ? 'Found' : 'Not Found');
    console.log('   Avatar:', avatar ? 'Found' : 'Not Found');
    
    if (profileData) {
      const parsed = JSON.parse(profileData);
      console.log('   Full Name:', parsed.full_name);
      console.log('   Email:', parsed.email);
    }
    return true;
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
    return false;
  }
}

// Test 3: Check Activity Logs
async function testActivityLogs() {
  try {
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) throw new Error('No user found');
    
    const { data, error } = await window.supabase
      .from('admin_activity_log')
      .select('*')
      .eq('admin_id', user.id)
      .limit(5);
    
    if (error) throw error;
    
    console.log('\n✅ Test 3: Activity Logs');
    console.log('   Activities Found:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('   Latest Activity:', data[0].activity_type);
    }
    return true;
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
    return false;
  }
}

// Test 4: Check Statistics
async function testStatistics() {
  try {
    // Test supplier count
    const { data: suppliers, error: suppError } = await window.supabase
      .from('supplier_profiles')
      .select('id', { count: 'exact', head: true });
    
    // Test shifts count
    const { data: shifts, error: shiftError } = await window.supabase
      .from('cashier_shifts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');
    
    console.log('\n✅ Test 4: Statistics');
    console.log('   Suppliers:', suppliers?.length || 0);
    console.log('   Active Shifts:', shifts?.length || 0);
    return true;
  } catch (error) {
    console.error('❌ Test 4 Failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('🧪 ADMIN PROFILE INTEGRATION TESTS');
  console.log('═══════════════════════════════════════════════\n');
  
  await testSupabase();
  testLocalStorage();
  await testActivityLogs();
  await testStatistics();
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ All Tests Complete!');
  console.log('═══════════════════════════════════════════════\n');
  
  console.log('📝 Next Steps:');
  console.log('1. Navigate to: http://localhost:5173/admin-profile');
  console.log('2. Try uploading a profile photo');
  console.log('3. Edit your profile information');
  console.log('4. Change your password');
  console.log('5. Toggle notification settings');
  console.log('6. Export your account data');
}

// Auto-run tests
runAllTests();
