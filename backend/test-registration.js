import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testRegistration() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           TESTING REGISTRATION FUNCTIONS                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Test manager registration
    console.log('📝 TESTING: register_manager function\n');
    
    const testUsername = `testmanager_${Date.now()}`;
    const { data: managerResult, error: managerError } = await supabase
      .rpc('register_manager', {
        p_username: testUsername,
        p_password: 'TestPassword123!',
        p_full_name: 'John Manager',
        p_phone: '+256701234567',
        p_department: 'Operations'
      });
    
    if (managerError) {
      console.log('✗ Error:', managerError.message);
    } else {
      console.log('✓ Registration response:');
      console.log(JSON.stringify(managerResult, null, 2));
    }
    
    // Check if user was created
    console.log('\n📊 CHECKING USERS TABLE:\n');
    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, auth_id, role, profile_completed')
      .order('created_at', { ascending: false })
      .limit(3);
    
    users?.forEach(u => {
      console.log(`- ${u.username || 'NULL'} (${u.role}): full_name=${u.full_name}, auth_id=${u.auth_id ? '✓' : '✗'}`);
    });
    
    // Test profile update functions
    console.log('\n🧪 TESTING: Profile update functions\n');
    const profileFunctions = [
      'update_manager_profile',
      'update_cashier_profile',
      'update_supplier_profile',
      'update_employee_profile'
    ];
    
    for (const funcName of profileFunctions) {
      try {
        const { error: testError } = await supabase.rpc(funcName, {
          p_user_id: 'test-id',
          p_full_name: 'Test'
        });
        
        if (testError?.message?.includes('does not exist')) {
          console.log(`✗ ${funcName}: NOT FOUND`);
        } else {
          console.log(`✓ ${funcName}: EXISTS`);
        }
      } catch (e) {
        if (e.message?.includes('Could not find')) {
          console.log(`✗ ${funcName}: NOT FOUND`);
        } else {
          console.log(`✓ ${funcName}: EXISTS`);
        }
      }
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  TEST COMPLETED ✓                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testRegistration();
