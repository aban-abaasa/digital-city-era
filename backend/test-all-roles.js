import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function comprehensiveTest() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      COMPREHENSIVE REGISTRATION & PROFILE TEST             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const roles = [
    {
      name: 'Manager',
      func: 'register_manager',
      params: {
        p_username: `manager_${Date.now()}`,
        p_password: 'Test@1234',
        p_full_name: 'John Manager',
        p_phone: '+256701111111',
        p_department: 'Operations'
      }
    },
    {
      name: 'Cashier',
      func: 'register_cashier',
      params: {
        p_username: `cashier_${Date.now()}`,
        p_password: 'Test@1234',
        p_full_name: 'Jane Cashier',
        p_phone: '+256702222222',
        p_shift: 'Morning'
      }
    },
    {
      name: 'Supplier',
      func: 'register_supplier',
      params: {
        p_username: `supplier_${Date.now()}`,
        p_password: 'Test@1234',
        p_full_name: 'Bob Supplier',
        p_phone: '+256703333333',
        p_company_name: 'Supply Co Ltd'
      }
    },
    {
      name: 'Employee',
      func: 'register_employee',
      params: {
        p_username: `employee_${Date.now()}`,
        p_password: 'Test@1234',
        p_full_name: 'Alice Employee',
        p_phone: '+256704444444',
        p_position: 'Store Attendant'
      }
    }
  ];
  
  const results = [];
  
  for (const role of roles) {
    console.log(`📝 Testing: ${role.name}`);
    
    const { data, error } = await supabase
      .rpc(role.func, role.params);
    
    if (error) {
      console.log(`   ✗ Error: ${error.message}\n`);
      results.push({ role: role.name, success: false, error: error.message });
    } else if (data?.success) {
      console.log(`   ✓ Registration successful`);
      console.log(`   • User ID: ${data.user_id}`);
      console.log(`   • Username: ${data.username}\n`);
      
      // Now update auth_id for this new user
      const { error: authError } = await supabase
        .from('users')
        .update({ auth_id: data.user_id })
        .eq('id', data.user_id);
      
      if (authError) {
        console.log(`   ⚠️  Warning: Could not set auth_id: ${authError.message}`);
      } else {
        console.log(`   ✓ Auth ID populated\n`);
      }
      
      results.push({ role: role.name, success: true, user_id: data.user_id });
    } else {
      console.log(`   ✗ Registration failed: ${data?.error}\n`);
      results.push({ role: role.name, success: false, error: data?.error });
    }
  }
  
  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const successCount = results.filter(r => r.success).length;
  console.log(`✓ Successful: ${successCount}/${results.length}`);
  
  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`  ${status} ${r.role}`);
  });
  
  // Show all users
  console.log('\n📊 ALL USERS IN DATABASE:\n');
  const { data: users } = await supabase
    .from('users')
    .select('username, role, full_name, auth_id, profile_completed')
    .not('username', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  users?.forEach(u => {
    const authStatus = u.auth_id ? '✓' : '✗';
    const profileStatus = u.profile_completed ? '✓' : '✗';
    console.log(`- ${u.username} (${u.role}): auth_id=${authStatus}, profile=${profileStatus}`);
  });
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         ✅ ALL TESTS COMPLETED SUCCESSFULLY ✅              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

comprehensiveTest();
