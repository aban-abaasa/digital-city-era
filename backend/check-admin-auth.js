import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixAdminAuthLink() {
  console.log('\n🔧 CHECKING ADMIN AUTH LINKS\n');
  
  try {
    // Get the admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, email, auth_id, role')
      .eq('role', 'admin')
      .maybeSingle();

    if (adminError || !adminUser) {
      console.error('❌ Could not find admin user');
      return;
    }

    console.log(`📝 Admin user found: ${adminUser.email}`);
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Current Auth ID: ${adminUser.auth_id || 'NOT SET'}`);

    if (!adminUser.auth_id) {
      console.log('\n⚠️ Admin auth_id is NULL - This is why admin can\'t log in!');
      console.log('\n📋 SOLUTION:');
      console.log('─────────────────────────────────────────────────────');
      console.log('The admin user needs to:');
      console.log('1. Go to: https://your-app.com/admin-login');
      console.log('2. Sign up/login with email: aronnykevin@gmail.com');
      console.log('3. This will automatically create the auth_id link');
      console.log('\nOR manually run the query in Supabase SQL Editor:');
      console.log(`UPDATE users SET auth_id = '<auth_user_id>' WHERE id = '${adminUser.id}';`);
      console.log('\nTo find the auth user ID, check Supabase > Authentication > Users');
      console.log('─────────────────────────────────────────────────────');
    } else {
      console.log('\n✅ Admin auth_id is properly set');
      
      // Check if the auth user exists
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.warn('Could not verify auth user:', authError.message);
      } else {
        const authUserExists = authUsers.find(u => u.id === adminUser.auth_id);
        if (authUserExists) {
          console.log(`✅ Linked auth user found: ${authUserExists.email}`);
        } else {
          console.log(`❌ Auth user with ID ${adminUser.auth_id} not found!`);
        }
      }
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

fixAdminAuthLink().catch(console.error);
