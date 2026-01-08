import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function findAndCreateUser() {
  console.log('\n🔍 FINDING UNLINKED AUTH USER\n');
  
  try {
    const targetAuthId = '8bb38779-2aaf-4510-b6b6-65d1efa69af7';
    
    // Get all auth users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    console.log(`📊 Total auth users: ${authUsers.length}\n`);

    // Find the target auth user
    const authUser = authUsers.find(u => u.id === targetAuthId);

    if (authUser) {
      console.log(`✅ Found auth user:`);
      console.log(`   ID: ${authUser.id}`);
      console.log(`   Email: ${authUser.email || 'No email set'}`);
      console.log(`   Created: ${new Date(authUser.created_at).toLocaleString()}`);

      // Check if user exists in database
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', targetAuthId)
        .maybeSingle();

      if (dbUser) {
        console.log('\n✅ User already exists in database');
        console.log(`   Email: ${dbUser.email}`);
      } else {
        console.log('\n⚠️  User NOT in database - creating...\n');
        
        if (!authUser.email) {
          console.error('❌ Cannot create user - auth user has no email');
          return;
        }

        // Create user record
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            auth_id: authUser.id,
            email: authUser.email,
            role: 'admin',  // Default to admin for this case
            full_name: authUser.user_metadata?.full_name || 'New Admin',
            active: true
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating user:', insertError);
        } else {
          console.log('✅ User successfully created in database!');
          console.log(`   Email: ${newUser.email}`);
          console.log(`   Role: ${newUser.role}`);
          console.log(`   Auth ID: ${newUser.auth_id}`);
          console.log('\n🎉 User can now access the admin portal!');
        }
      }
    } else {
      console.log(`⚠️ Auth user not found: ${targetAuthId}`);
      console.log('\nAvailable auth users:');
      authUsers.forEach(u => {
        console.log(`   - ${u.email || 'No email'} (ID: ${u.id})`);
      });
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

findAndCreateUser().catch(console.error);
