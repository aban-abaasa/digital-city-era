import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

// Use service key for admin operations
const supabase = createClient(supabaseUrl, serviceKey);

async function fixDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           DATABASE FIX: AUTH_ID POPULATION                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // 1. Check current status
    console.log('📊 CURRENT STATUS:');
    const { data: before, error: beforeError } = await supabase
      .from('users')
      .select('id, username, auth_id, role, profile_completed')
      .order('created_at', { ascending: true });
    
    if (beforeError) {
      console.error('✗ Cannot fetch users:', beforeError.message);
      return;
    }
    
    console.log(`Total users: ${before?.length || 0}`);
    before?.forEach(u => {
      const authStatus = u.auth_id ? '✓' : '✗';
      console.log(`  - ID: ${u.id.substring(0, 8)}... | username: ${u.username || 'NULL'} | auth_id: ${authStatus}`);
    });
    
    // 2. Fix auth_id for NULL records
    const nullCount = before?.filter(u => !u.auth_id)?.length || 0;
    if (nullCount > 0) {
      console.log(`\n🔧 FIXING: ${nullCount} users with NULL auth_id...\n`);
      
      // Update each user individually using RPC
      let fixed = 0;
      for (const user of before || []) {
        if (!user.auth_id) {
          const { error: updateError } = await supabase
            .from('users')
            .update({ auth_id: user.id })
            .eq('id', user.id);
          
          if (updateError) {
            console.log(`✗ Failed to update ${user.id}: ${updateError.message}`);
          } else {
            console.log(`✓ Updated user ${user.id.substring(0, 8)}...`);
            fixed++;
          }
        }
      }
      
      console.log(`\n✓ Fixed ${fixed} users`);
    } else {
      console.log('\n✓ All users already have auth_id');
    }
    
    // 3. Verify fix
    console.log('\n📊 AFTER FIX:');
    const { data: after } = await supabase
      .from('users')
      .select('id, username, auth_id, role, profile_completed')
      .order('created_at', { ascending: true });
    
    after?.forEach(u => {
      const authStatus = u.auth_id ? '✓' : '✗';
      console.log(`  - ID: ${u.id.substring(0, 8)}... | username: ${u.username || 'NULL'} | auth_id: ${authStatus}`);
    });
    
    // 4. Test registration functions
    console.log('\n🧪 TESTING RPC FUNCTIONS:\n');
    const testFunctions = [
      'register_manager',
      'register_cashier',
      'register_supplier',
      'register_employee'
    ];
    
    for (const funcName of testFunctions) {
      try {
        const { error: testError } = await supabase.rpc(funcName, {
          p_username: 'test',
          p_password: 'test'
        });
        
        if (testError?.message?.includes('does not exist')) {
          console.log(`✗ ${funcName}: NOT FOUND`);
        } else if (testError?.message?.includes('required')) {
          console.log(`✓ ${funcName}: EXISTS (validation error as expected)`);
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
    console.log('║                     FIX COMPLETED ✓                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (err) {
    console.error('✗ Fatal error:', err.message);
  }
}

fixDatabase();
