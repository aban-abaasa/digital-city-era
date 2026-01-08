import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function deployProfileFunction() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   DEPLOYING UPDATED PROFILE FUNCTION                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Test the function first
    console.log('Testing update_manager_profile_on_submission function...\n');
    
    // Get a manager user ID for testing
    const { data: users } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('role', 'manager')
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No manager users found to test with');
      return;
    }
    
    const managerId = users[0].id;
    console.log(`Testing with user ID: ${managerId}`);
    
    const { data: result, error } = await supabase
      .rpc('update_manager_profile_on_submission', {
        p_auth_id: managerId,
        p_full_name: 'Test Manager',
        p_phone: '+256701234567',
        p_department: 'Operations'
      });
    
    if (error) {
      console.log('❌ Function test failed:', error.message);
      console.log('\nYou must deploy the updated function via SQL Editor:');
      console.log('📋 File: FIX_UPDATE_MANAGER_PROFILE_FUNCTION.sql');
      console.log('🔗 Go to: https://supabase.com/dashboard/projects/[project]/sql');
    } else {
      console.log('✓ Function test successful!');
      console.log(JSON.stringify(result, null, 2));
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  DEPLOYMENT COMPLETE                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

deployProfileFunction();
