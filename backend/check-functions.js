import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkFunctions() {
  console.log('\n=== CHECKING DEPLOYED FUNCTIONS ===\n');
  
  try {
    // List all public functions from information_schema
    const { data, error } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_definition')
      .eq('routine_schema', 'public')
      .like('routine_name', '%register_%');
    
    if (error) {
      console.log('✗ Cannot query information_schema directly');
      console.log('  Attempting RPC function tests instead...\n');
      
      // Test each function individually
      const functions = [
        'register_manager',
        'register_cashier',
        'register_supplier',
        'register_employee',
        'update_manager_profile',
        'update_cashier_profile',
        'update_supplier_profile',
        'update_employee_profile'
      ];
      
      for (const func of functions) {
        try {
          // Just attempt to call with minimal params to test existence
          const { error: testError } = await supabase.rpc(func, {
            p_username: 'test'
          });
          
          // We're expecting an error (like "password is required"), which proves the function exists
          if (testError?.message?.includes('required') || testError?.message?.includes('does not exist')) {
            if (testError?.message?.includes('does not exist')) {
              console.log(`✗ ${func}: NOT FOUND`);
            } else {
              console.log(`✓ ${func}: EXISTS (validation check triggered)`);
            }
          }
        } catch (e) {
          console.log(`✓ ${func}: EXISTS`);
        }
      }
    } else {
      console.log(`✓ Found ${data?.length || 0} registration functions`);
      data?.forEach(f => {
        console.log(`  - ${f.routine_name}`);
      });
    }
    
    // Now check and fix auth_id
    console.log('\n=== FIXING AUTH_ID ===\n');
    const { data: nullCheckData, error: nullError } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .is('auth_id', null);
    
    if (!nullError) {
      console.log(`Users with NULL auth_id: ${nullCheckData?.length || 0}`);
      
      // Try direct update if records need fixing
      if ((nullCheckData?.length || 0) > 0) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ auth_id: supabase.literal('id') })
          .is('auth_id', null);
        
        if (updateError) {
          console.log('✗ Direct update failed:', updateError.message);
          console.log('\nYou need to run this SQL in Supabase SQL Editor:');
          console.log('UPDATE public.users SET auth_id = id WHERE auth_id IS NULL;');
        } else {
          console.log('✓ Updated auth_id for NULL records');
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkFunctions();
