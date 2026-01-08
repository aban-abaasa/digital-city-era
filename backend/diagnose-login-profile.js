import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function diagnose() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         DIAGNOSING LOGIN & PROFILE ISSUES                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // 1. Check if login_user function exists
    console.log('1️⃣  Testing login_user function...\n');
    const { data: loginTest, error: loginError } = await supabase
      .rpc('login_user', {
        p_username: 'Aban123',
        p_password: 'test'  // Will fail but function exists
      });
    
    if (loginError?.message?.includes('does not exist')) {
      console.log('❌ login_user function NOT deployed yet!');
      console.log('   You must run the SQL in Supabase SQL Editor first');
    } else {
      console.log('✓ login_user function exists');
      console.log(`  Response: ${JSON.stringify(loginTest)}\n`);
    }
    
    // 2. Check all users in database
    console.log('2️⃣  Users in database:\n');
    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, role, is_active, profile_completed')
      .not('username', 'is', null)
      .order('created_at', { ascending: false });
    
    if (users?.length === 0) {
      console.log('❌ No users with username found!');
    } else {
      users?.forEach(u => {
        const active = u.is_active ? '✓' : '✗';
        const profile = u.profile_completed ? '✓' : '✗';
        console.log(`  - ${u.username} (${u.role}): active=${active}, profile=${profile}`);
        console.log(`    ID: ${u.id}`);
        console.log(`    Full Name: ${u.full_name}\n`);
      });
    }
    
    // 3. Test query used by ManagerPortal
    console.log('3️⃣  Testing ManagerPortal profile query:\n');
    
    if (users && users.length > 0) {
      const managerId = users.find(u => u.role === 'manager')?.id;
      
      if (managerId) {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', managerId)
          .single();
        
        if (profileError) {
          console.log(`❌ Profile query failed: ${profileError.message}`);
        } else {
          console.log(`✓ Profile loaded successfully`);
          console.log(`  Username: ${profile.username}`);
          console.log(`  Full Name: ${profile.full_name}`);
          console.log(`  Role: ${profile.role}\n`);
        }
      }
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  DIAGNOSIS COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

diagnose();
