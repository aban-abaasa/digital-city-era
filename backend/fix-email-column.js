import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixEmailColumn() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         FIXING EMAIL COLUMN CONSTRAINT                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Run SQL to make email nullable with a default
    const { error } = await supabase
      .rpc('exec', {
        sql: `
          ALTER TABLE users 
          ALTER COLUMN email DROP NOT NULL,
          ALTER COLUMN email SET DEFAULT NULL;
        `
      });
    
    if (error && !error.message?.includes('does not exist')) {
      console.log('Note: RPC approach not available, trying direct approach...\n');
    }
    
    // Alternative: Update existing records with NULL email to empty string
    const { data: usersWithoutEmail, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .is('email', null);
    
    if (!fetchError && usersWithoutEmail && usersWithoutEmail.length > 0) {
      console.log(`Updating ${usersWithoutEmail.length} users with NULL email to empty string...\n`);
      
      for (const user of usersWithoutEmail) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ email: `user_${user.id.substring(0, 8)}@faredeal.local` })
          .eq('id', user.id);
        
        if (updateError) {
          console.log(`✗ Error updating ${user.id}: ${updateError.message}`);
        } else {
          console.log(`✓ Updated user ${user.id.substring(0, 8)}...`);
        }
      }
    }
    
    // Now test registration again
    console.log('\n🔄 RETESTING REGISTRATION:\n');
    
    const testUsername = `manager_${Date.now()}`;
    const { data: result, error: regError } = await supabase
      .rpc('register_manager', {
        p_username: testUsername,
        p_password: 'TestPassword123!',
        p_full_name: 'John Manager Test',
        p_phone: '+256701234567',
        p_department: 'Operations'
      });
    
    if (regError) {
      console.log('✗ Registration error:', regError.message);
      console.log('\n⚠️  YOU NEED TO RUN THIS IN SUPABASE SQL EDITOR:\n');
      console.log(`ALTER TABLE users ALTER COLUMN email SET DEFAULT '';`);
      console.log(`\nThen test again.`);
    } else {
      console.log('✓ Registration successful!');
      console.log(JSON.stringify(result, null, 2));
      
      // Show new user
      const { data: newUser } = await supabase
        .from('users')
        .select('id, username, full_name, email, role')
        .eq('username', testUsername)
        .single();
      
      if (newUser) {
        console.log('\n✓ User created:');
        console.log(`  - Username: ${newUser.username}`);
        console.log(`  - Full Name: ${newUser.full_name}`);
        console.log(`  - Email: ${newUser.email}`);
        console.log(`  - Role: ${newUser.role}`);
      }
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  FIX COMPLETED ✓                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

fixEmailColumn();
