import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function diagnose() {
  console.log('\n=== DATABASE DIAGNOSTICS ===\n');
  
  try {
    // 1. Count total users
    const { count: total } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✓ Total users: ${total}`);
    
    // 2. Sample users with key columns
    const { data: sample, error } = await supabase
      .from('users')
      .select('id, username, role, auth_id, profile_completed, is_active')
      .limit(5);
    
    if (error) {
      console.log('✗ Error fetching users:', error.message);
    } else {
      console.log('\n✓ Sample Users:');
      sample?.forEach(u => {
        const authStatus = u.auth_id ? '✓' : '✗';
        console.log(`  - ${u.username} (${u.role}): auth_id=${authStatus}, profile_completed=${u.profile_completed}`);
      });
    }
    
    // 3. Check auth_id population status via raw query
    const { data: nullCount } = await supabase
      .rpc('get_null_auth_id_count');
    
    if (nullCount !== undefined) {
      console.log(`\n✓ Users with NULL auth_id: ${nullCount}`);
    }
    
  } catch (err) {
    console.error('✗ Error:', err.message);
  }
}

diagnose();
