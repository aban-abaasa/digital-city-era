import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function findAndFixMissingUser() {
  console.log('\n🔍 FINDING AUTH USER WITH ID: 8bb38779-2aaf-4510-b6b6-65d1efa69af7\n');
  
  try {
    // Get all auth users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    // Find the specific auth user
    const authId = '8bb38779-2aaf-4510-b6b6-65d1efa69af7';
    const authUser = authUsers.find(u => u.id === authId);

    if (authUser) {
      console.log(`✅ Found auth user:`);
      console.log(`   ID: ${authUser.id}`);
      console.log(`   Email: ${authUser.email}`);
      console.log(`   Created: ${new Date(authUser.created_at).toLocaleString()}`);

      // Check if user exists in database
      const { data: existingUser, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

      if (queryError) {
        console.error('❌ Error checking database:', queryError);
        return;
      }

      if (existingUser) {
        console.log(`\n✅ User already exists in database`);
        console.log(`   ID: ${existingUser.id}`);
        console.log(`   Email: ${existingUser.email}`);
        console.log(`   Role: ${existingUser.role}`);
      } else {
        console.log(`\n⚠️ User NOT found in database`);
        console.log(`\n📝 Creating user record for ${authUser.email}...`);

        // Create a new admin user record
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{
            auth_id: authId,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
            phone: authUser.user_metadata?.phone || null,
            role: 'admin',
            is_active: true,
            profile_completed: false
          }])
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating user:', insertError);
        } else {
          console.log('✅ User successfully created!');
          console.log(`   ID: ${newUser.id}`);
          console.log(`   Email: ${newUser.email}`);
          console.log(`   Role: ${newUser.role}`);
          console.log(`\n🎉 User can now access the admin portal!`);
        }
      }
    } else {
      console.log(`⚠️ No auth user found with ID: ${authId}`);
      console.log(`\nAll auth users in system:`);
      authUsers.forEach(u => {
        console.log(`   - ${u.email} (ID: ${u.id})`);
      });
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

findAndFixMissingUser().catch(console.error);
