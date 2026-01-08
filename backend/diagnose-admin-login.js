import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function diagnoseAdminLogin() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       ADMIN LOGIN DIAGNOSTIC REPORT                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Check admin user in database
    console.log('📋 STEP 1: Checking Admin User in Database\n');
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin')
      .maybeSingle();

    if (adminError) {
      console.log('❌ Database query error:', adminError.message);
      return;
    }

    if (!adminUser) {
      console.log('❌ NO ADMIN USER FOUND IN DATABASE');
      console.log('   → Admin must sign up first at /admin-auth\n');
      return;
    }

    console.log('✅ Admin user found:');
    console.log('   Email:', adminUser.email);
    console.log('   ID:', adminUser.id);
    console.log('   Role:', adminUser.role);
    console.log('   Auth ID:', adminUser.auth_id || '⚠️ NOT SET (CRITICAL)');
    console.log('   Is Active:', adminUser.is_active);
    console.log('   Email Verified:', adminUser.email_verified || 'unknown');
    console.log();

    // 2. Check auth user in Supabase Auth
    console.log('🔐 STEP 2: Checking Auth User in Supabase Auth\n');
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.log('❌ Could not fetch auth users:', authError.message);
      return;
    }

    const authUser = authUsers.find(u => u.email === adminUser.email);
    if (!authUser) {
      console.log('❌ NO AUTH USER FOUND for email:', adminUser.email);
      console.log('   → Admin needs to sign up/login first\n');
      return;
    }

    console.log('✅ Auth user found:');
    console.log('   Email:', authUser.email);
    console.log('   Auth ID:', authUser.id);
    console.log('   Email Confirmed:', authUser.email_confirmed_at ? '✅ Yes' : '❌ No');
    console.log('   Created At:', new Date(authUser.created_at).toLocaleString());
    console.log('   Last Sign In:', authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Never');
    console.log();

    // 3. Check if auth_id matches
    console.log('🔗 STEP 3: Checking Auth ID Link\n');
    if (adminUser.auth_id === authUser.id) {
      console.log('✅ Auth ID correctly linked');
    } else if (!adminUser.auth_id) {
      console.log('❌ Admin auth_id is NULL - CRITICAL ISSUE');
      console.log('   Expected:', authUser.id);
      console.log('   → RUN THIS SQL COMMAND IN SUPABASE:\n');
      console.log(`   UPDATE users SET auth_id = '${authUser.id}' WHERE id = '${adminUser.id}';`);
      console.log();
    } else {
      console.log('❌ Auth ID mismatch!');
      console.log('   Database has:', adminUser.auth_id);
      console.log('   Auth has:', authUser.id);
      console.log('   → Need to update database\n');
    }

    // 4. Check email confirmation status
    console.log('📧 STEP 4: Checking Email Confirmation\n');
    if (!authUser.email_confirmed_at) {
      console.log('⚠️  EMAIL NOT CONFIRMED - This may prevent login');
      console.log('   → Admin needs to verify email via confirmation link\n');
    } else {
      console.log('✅ Email is confirmed\n');
    }

    // 5. Check for any auth sessions
    console.log('💾 STEP 5: Checking Recent Auth Events\n');
    console.log(`   Last Sign In: ${authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleString() : 'Never'}`);
    console.log(`   Created: ${new Date(authUser.created_at).toLocaleString()}`);
    console.log();

    // 6. Summary and recommendations
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    RECOMMENDATIONS                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const issues = [];

    if (!adminUser.auth_id) {
      issues.push('Auth ID not linked');
    }
    if (!authUser.email_confirmed_at) {
      issues.push('Email not confirmed');
    }
    if (!adminUser.is_active) {
      issues.push('Admin user is not active');
    }

    if (issues.length === 0) {
      console.log('✅ ALL CHECKS PASSED - Admin login should work!');
      console.log('\nIf you\'re still having issues:');
      console.log('1. Try logging in with email: ' + adminUser.email);
      console.log('2. Check browser console for error messages');
      console.log('3. Verify Supabase credentials in .env file');
    } else {
      console.log('⚠️  ISSUES FOUND:\n');
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
      console.log('\nTo fix:');
      if (issues.includes('Auth ID not linked')) {
        console.log(`- Run: UPDATE users SET auth_id = '${authUser.id}' WHERE id = '${adminUser.id}';`);
      }
      if (issues.includes('Email not confirmed')) {
        console.log('- Send confirmation email or manually set: UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = \'' + authUser.id + '\';');
      }
      if (issues.includes('Admin user is not active')) {
        console.log('- Run: UPDATE users SET is_active = true WHERE id = \'' + adminUser.id + '\';');
      }
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
  }
}

diagnoseAdminLogin();
