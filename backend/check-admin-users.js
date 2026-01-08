import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkAdminUsers() {
  console.log('\n🔍 CHECKING ADMIN USERS IN DATABASE\n');
  
  try {
    // Get all users with their roles
    const { data: users, error } = await supabase
      .from('users')
      .select('id, auth_id, email, full_name, role, is_active, profile_completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ No users found in database');
      return;
    }

    console.log(`📊 Total users in database: ${users.length}\n`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Group by role
    const byRole = {};
    users.forEach(user => {
      if (!byRole[user.role]) {
        byRole[user.role] = [];
      }
      byRole[user.role].push(user);
    });

    // Display users grouped by role
    Object.entries(byRole).forEach(([role, roleUsers]) => {
      console.log(`\n👤 ${role.toUpperCase()} (${roleUsers.length}):`);
      console.log('─────────────────────────────────────────────────────────────');
      
      roleUsers.forEach(user => {
        console.log(`  ID: ${user.id}`);
        console.log(`  Auth ID: ${user.auth_id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.full_name || 'N/A'}`);
        console.log(`  Active: ${user.is_active ? '✅ Yes' : '❌ No'}`);
        console.log(`  Profile Complete: ${user.profile_completed ? '✅ Yes' : '❌ No'}`);
        console.log('');
      });
    });

    // Check for admins
    const admins = byRole['admin'] || [];
    console.log('═══════════════════════════════════════════════════════════════');
    if (admins.length > 0) {
      console.log(`\n✅ Found ${admins.length} admin(s) in database`);
    } else {
      console.log('\n⚠️ No admins found in database!');
      console.log('📝 You need to create an admin user.');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

checkAdminUsers().catch(console.error);
