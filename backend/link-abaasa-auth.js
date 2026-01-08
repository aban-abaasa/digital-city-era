import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function linkAbaasaAuth() {
  console.log('\n🔍 FINDING AUTH USER FOR ABAASA ABAN\n');
  
  try {
    // Get all auth users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    console.log(`📊 Total auth users: ${authUsers.length}\n`);

    // Find auth user matching Abaasa's email
    const abaasaEmail = 'abanabaasa2@gmail.com';
    const matchingAuthUser = authUsers.find(u => u.email === abaasaEmail);

    if (matchingAuthUser) {
      console.log(`✅ Found matching auth user:`);
      console.log(`   Email: ${abaasaEmail}`);
      console.log(`   Auth ID: ${matchingAuthUser.id}`);
      
      // Update the admin user record with auth_id
      console.log('\n📝 Linking admin user to auth...');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_id: matchingAuthUser.id })
        .eq('email', abaasaEmail)
        .eq('role', 'admin');

      if (updateError) {
        console.error('❌ Error updating admin user:', updateError);
      } else {
        console.log('✅ Admin user successfully linked to auth user!');
        console.log(`\n🎉 Admin Abaasa Aban can now log in with email: ${abaasaEmail}`);
      }
    } else {
      console.log(`⚠️ No auth user found with email: ${abaasaEmail}`);
      console.log('\nAvailable auth users:');
      authUsers.forEach(u => {
        console.log(`   - ${u.email || 'No email'} (ID: ${u.id})`);
      });
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

linkAbaasaAuth().catch(console.error);
