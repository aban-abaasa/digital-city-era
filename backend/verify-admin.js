// =====================================================================
// VERIFY AND UPDATE ADMIN ACCOUNT
// =====================================================================
// This script verifies existing admin account and can reset password
// Run: node verify-admin.js
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

// Create admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ADMIN_EMAIL = 'heradmin@supermartkera.ug';
const ADMIN_PASSWORD = 'Administrator';

async function verifyAndUpdateAdmin() {
  try {
    console.log('🔍 Verifying Admin Account...');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('');

    // Step 1: List all users to find our admin
    console.log('Step 1: Searching for admin user...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      throw listError;
    }

    const adminUser = users.users.find(user => user.email === ADMIN_EMAIL);

    if (!adminUser) {
      console.log('❌ Admin user not found!');
      console.log('   Please run create-admin.js first');
      process.exit(1);
    }

    console.log('✅ Admin user found in authentication system');
    console.log('   User ID:', adminUser.id);
    console.log('   Email:', adminUser.email);
    console.log('   Created:', new Date(adminUser.created_at).toLocaleString());
    console.log('');

    // Step 2: Update password
    console.log('Step 2: Updating password...');
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      adminUser.id,
      {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Administrator',
          role: 'admin',
          department: 'administration'
        }
      }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError.message);
    } else {
      console.log('✅ Password updated successfully');
    }
    console.log('');

    // Step 3: Check database records
    console.log('Step 3: Checking database records...');
    
    // Try admins table
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (adminError && adminError.code === 'PGRST116') {
      console.log('⚠️  No admin record found in admins table');
      console.log('   Creating admin record...');
      
      const { data: newAdmin, error: insertError } = await supabaseAdmin
        .from('admins')
        .insert({
          id: adminUser.id,
          email: ADMIN_EMAIL,
          full_name: 'Administrator',
          role: 'super_admin',
          department: 'administration',
          is_active: true,
          permissions: ['all'],
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.log('⚠️  Could not create admin record:', insertError.message);
        console.log('   The auth account exists, but database record may be missing');
      } else {
        console.log('✅ Admin record created in database');
      }
    } else if (!adminError) {
      console.log('✅ Admin record found in database');
      console.log('   Role:', adminData.role);
      console.log('   Status:', adminData.is_active ? 'Active' : 'Inactive');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🎉 ADMIN ACCOUNT VERIFIED!');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('📝 Login Credentials:');
    console.log('   Email:    ', ADMIN_EMAIL);
    console.log('   Password: ', ADMIN_PASSWORD);
    console.log('   Role:     ', 'Administrator (Super Admin)');
    console.log('');
    console.log('🌐 Login URL: http://localhost:5173/login');
    console.log('');
    console.log('✅ You can now login to the admin portal!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════');
    console.error('❌ ERROR VERIFYING ADMIN ACCOUNT');
    console.error('═══════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run the script
verifyAndUpdateAdmin();
