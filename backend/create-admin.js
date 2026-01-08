// =====================================================================
// CREATE ADMIN ACCOUNT FOR FAREDEAL
// =====================================================================
// This script creates a new admin account in Supabase
// Run: node create-admin.js
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

// Admin credentials
const ADMIN_DATA = {
  email: 'heradmin@faredeal.ug',
  password: 'Administrator',
  full_name: 'Administrator',
  role: 'admin',
  department: 'administration'
};

async function createAdminAccount() {
  try {
    console.log('🔐 Creating Admin Account...');
    console.log('📧 Email:', ADMIN_DATA.email);
    console.log('');

    // Step 1: Create auth user
    console.log('Step 1: Creating authentication user...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_DATA.email,
      password: ADMIN_DATA.password,
      email_confirm: true,
      user_metadata: {
        full_name: ADMIN_DATA.full_name,
        role: ADMIN_DATA.role,
        department: ADMIN_DATA.department
      }
    });

    if (authError) {
      console.error('❌ Auth Error:', authError.message);
      throw authError;
    }

    console.log('✅ Auth user created successfully');
    console.log('   User ID:', authData.user.id);
    console.log('');

    // Step 2: Create admin profile in database
    console.log('Step 2: Creating admin profile in database...');
    
    // First, check if users table exists, if not, create admin record directly
    const adminRecord = {
      id: authData.user.id,
      email: ADMIN_DATA.email,
      full_name: ADMIN_DATA.full_name,
      role: 'super_admin',
      department: ADMIN_DATA.department,
      is_active: true,
      permissions: ['all'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Try to insert into admins table
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .insert(adminRecord)
      .select()
      .single();

    if (adminError) {
      // If admins table doesn't exist, try users table
      console.log('⚠️  Admins table not found, trying users table...');
      
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: ADMIN_DATA.email,
          full_name: ADMIN_DATA.full_name,
          role: 'admin',
          user_type: 'admin',
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        console.error('❌ Database Error:', userError.message);
        console.log('');
        console.log('⚠️  Note: You may need to create the admin tables first.');
        console.log('   The auth account was created successfully, but database record failed.');
      } else {
        console.log('✅ Admin record created in users table');
      }
    } else {
      console.log('✅ Admin profile created successfully');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🎉 ADMIN ACCOUNT CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('📝 Login Credentials:');
    console.log('   Email:    ', ADMIN_DATA.email);
    console.log('   Password: ', ADMIN_DATA.password);
    console.log('   Role:     ', 'Administrator (Super Admin)');
    console.log('');
    console.log('🌐 Login URL: http://localhost:5173/login');
    console.log('');
    console.log('⚠️  IMPORTANT: Please change your password after first login!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════');
    console.error('❌ ERROR CREATING ADMIN ACCOUNT');
    console.error('═══════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.message?.includes('already registered')) {
      console.log('💡 This email is already registered.');
      console.log('   You can login with:');
      console.log('   Email:    ', ADMIN_DATA.email);
      console.log('   Password: ', ADMIN_DATA.password);
      console.log('');
    }
    
    process.exit(1);
  }
}

// Run the script
createAdminAccount();
