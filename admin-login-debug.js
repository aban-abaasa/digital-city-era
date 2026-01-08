// 🔍 ADMIN LOGIN DEBUG SCRIPT
// Paste this into browser console while on /admin-auth page
// This will help diagnose WHY login is hanging

console.log('\n🔍 ADMIN LOGIN DEBUG\n');

// Test 1: Check Supabase is loaded
console.log('1️⃣ Checking Supabase...');
if (typeof supabase !== 'undefined') {
  console.log('   ✅ Supabase client loaded');
} else {
  console.log('   ❌ Supabase NOT available!');
}

// Test 2: Manual login attempt with detailed logging
console.log('\n2️⃣ Test Login Function (paste email/password):\n');
console.log(`
async function testLogin(email, password) {
  console.log('🔐 Testing login with:', email);
  
  try {
    // Step 1: Auth
    console.log('  → Step 1: Signing in...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      console.log('  ❌ Auth failed:', error.message);
      return;
    }
    console.log('  ✅ Auth succeeded:', data.user.email);
    
    // Step 2: Check user in database
    console.log('  → Step 2: Checking user record...');
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', data.user.id)
      .maybeSingle();
    
    console.log('  Query result:', { existingUser, checkError });
    
    if (!existingUser) {
      console.log('  → Step 3a: Creating user record...');
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || 'Admin',
          phone: null,
          role: 'admin',
          is_active: true
        });
      
      if (insertError) {
        console.log('  ⚠️ Insert error:', insertError.message);
      } else {
        console.log('  ✅ User created');
      }
    } else {
      console.log('  ✅ User exists:', existingUser);
    }
    
    // Step 3: Set localStorage
    console.log('  → Step 4: Setting localStorage...');
    localStorage.setItem('adminKey', 'true');
    console.log('  ✅ localStorage set');
    
    console.log('\\n✅ LOGIN TEST COMPLETE - All steps passed!');
    
  } catch (error) {
    console.log('  ❌ Unexpected error:', error.message);
    console.error(error);
  }
}

// Run test:
await testLogin('abanabaasa2@gmail.com', 'YOUR_PASSWORD');
`);

// Test 3: Check for errors in page
console.log('\n3️⃣ Check page errors:');
console.log('   Look at the "Console" tab above for any red error messages');

// Test 4: Check localStorage
console.log('\n4️⃣ Check localStorage:');
console.log('   adminKey:', localStorage.getItem('adminKey'));
console.log('   supermarket_user:', localStorage.getItem('supermarket_user'));

console.log('\n5️⃣ NEXT STEPS:');
console.log('   a) Copy the testLogin function above');
console.log('   b) Paste: await testLogin("abanabaasa2@gmail.com", "YOUR_PASSWORD")');
console.log('   c) Report which step fails\n');
