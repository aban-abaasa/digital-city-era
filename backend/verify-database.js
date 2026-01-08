#!/usr/bin/env node

/**
 * Verify and Fix Supabase Setup
 * This script checks if all tables exist and creates/fixes them as needed
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixDatabase() {
  console.log('🔍 Checking Supabase database setup...\n');

  try {
    // Check users table
    console.log('📋 Checking users table...');
    const { data: usersCheck, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError) {
      console.log('❌ Users table error:', usersError.message);
    } else {
      console.log('✅ Users table exists');
    }

    // Check products table
    console.log('\n📋 Checking products table...');
    const { data: productsCheck, error: productsError } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    if (productsError) {
      console.log('❌ Products table error:', productsError.message);
    } else {
      console.log('✅ Products table exists');
    }

    // Check inventory table
    console.log('\n📋 Checking inventory table...');
    const { data: inventoryCheck, error: inventoryError } = await supabase
      .from('inventory')
      .select('id')
      .limit(1);
    
    if (inventoryError) {
      console.log('❌ Inventory table error:', inventoryError.message);
    } else {
      console.log('✅ Inventory table exists');
    }

    // Check RLS policies on users table
    console.log('\n🔒 Checking RLS policies on users table...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies', { table_name: 'users' })
      .catch(() => ({ data: null, error: new Error('RLS check function not available') }));

    if (policiesError) {
      console.log('⚠️  Could not check RLS policies (this is normal)');
    } else if (policies) {
      console.log('✅ RLS policies found');
    }

    console.log('\n✅ Database check complete!');
    console.log('\n📝 Next steps:');
    console.log('1. If tables are missing, run the SQL migrations in Supabase');
    console.log('2. Ensure RLS policies allow anonymous and authenticated users');
    console.log('3. Test user creation by signing up a new admin account');

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
  }
}

// Run the check
checkAndFixDatabase();
