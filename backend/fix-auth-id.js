import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fix() {
  console.log('\n=== FIXING AUTH_ID ===\n');
  
  try {
    // 1. Update NULL auth_id to id
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_auth_id_from_id');
    
    if (updateError) {
      console.log('✗ RPC update failed:', updateError.message);
      console.log('  Trying direct SQL approach...');
    } else {
      console.log('✓ Updated auth_id via RPC:', updateResult);
    }
    
    // 2. Check if users have auth_id now
    const { data: sample } = await supabase
      .from('users')
      .select('id, username, role, auth_id, profile_completed')
      .limit(5);
    
    console.log('\n✓ Users After Fix:');
    sample?.forEach(u => {
      const authStatus = u.auth_id ? '✓' : '✗';
      console.log(`  - id=${u.id}, username=${u.username}, auth_id=${authStatus}, profile_completed=${u.profile_completed}`);
    });
    
    // 3. Check all RPC functions exist
    console.log('\n=== CHECKING RPC FUNCTIONS ===\n');
    const { data: functions, error: funcError } = await supabase
      .rpc('get_all_functions');
    
    if (funcError) {
      console.log('✗ Could not list functions:', funcError.message);
    } else if (functions) {
      const registerFuncs = functions.filter(f => f.includes('register_'));
      console.log(`✓ Registration functions found: ${registerFuncs.length}`);
      registerFuncs.forEach(f => console.log(`  - ${f}`));
    }
    
  } catch (err) {
    console.error('✗ Error:', err.message);
  }
}

fix();
