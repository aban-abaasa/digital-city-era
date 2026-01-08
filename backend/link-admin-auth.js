import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function findAndLinkAdminAuth() {
  console.log('\n🔍 FINDING AUTH USERS AND LINKING ADMIN\n');
  
  try {
    // Get all auth users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    console.log(`📊 Total auth users: ${authUsers.length}\n`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Display all auth users
    authUsers.forEach(authUser => {
      console.log(`\n👤 Auth User:`);
      console.log(`   ID: ${authUser.id}`);
      console.log(`   Email: ${authUser.email || 'No email'}`);
      console.log(`   Created: ${new Date(authUser.created_at).toLocaleString()}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════');

    // Find auth user matching admin email
    const adminEmail = 'aronnykevin@gmail.com';
    const matchingAuthUser = authUsers.find(u => u.email === adminEmail);

    if (matchingAuthUser) {
      console.log(`\n✅ Found matching auth user for ${adminEmail}`);
      console.log(`   Auth ID: ${matchingAuthUser.id}`);
      
      // Now update the users table
      console.log('\n📝 Updating admin user record...');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_id: matchingAuthUser.id })
        .eq('role', 'admin')
        .eq('email', adminEmail);

      if (updateError) {
        console.error('❌ Error updating admin user:', updateError);
      } else {
        console.log('✅ Admin user successfully linked to auth user!');
        console.log(`\n🎉 Admin can now log in with email: ${adminEmail}`);
      }
    } else {
      console.log(`\n⚠️ No auth user found with email: ${adminEmail}`);
      console.log('\n📋 ACTION REQUIRED:');
      console.log('────────────────────────────────────────────────────────────');
      console.log('The admin needs to sign up/log in first:');
      console.log('1. Go to the admin login page');
      console.log('2. Enter email: aronnykevin@gmail.com');
      console.log('3. Complete the auth process');
      console.log('4. Then run this script again to link them');
      console.log('────────────────────────────────────────────────────────────');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

findAndLinkAdminAuth().catch(console.error);
