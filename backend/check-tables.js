import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkTables() {
  console.log('\n📊 CHECKING DATABASE SCHEMA\n');
  
  // List of critical tables
  const criticalTables = [
    'users',
    'sales_transactions', 
    'transactions',
    'products_inventory',
    'products',
    'suppliers',
    'purchase_orders'
  ];
  
  console.log('Checking for required tables:\n');
  
  for (const table of criticalTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        console.log(`✓ ${table.padEnd(25)} EXISTS`);
      } else if (error && error.code === 'PGRST205') {
        console.log(`✗ ${table.padEnd(25)} MISSING (404)`);
      } else if (error) {
        console.log(`⚠ ${table.padEnd(25)} ERROR: ${error.message}`);
      } else {
        console.log(`✓ ${table.padEnd(25)} EXISTS (${count} rows)`);
      }
    } catch (e) {
      console.log(`⚠ ${table.padEnd(25)} ERROR: ${e.message}`);
    }
  }
  
  console.log('\n\n👤 CHECKING USERS:\n');
  
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, username, role, profile_completed');
  
  if (usersError) {
    console.log('❌ Error fetching users:', usersError.message);
  } else {
    console.log(`Found ${users.length} users:\n`);
    users.forEach(u => {
      console.log(`  ID: ${u.id.substring(0, 8)}...`);
      console.log(`  Username: ${u.username}`);
      console.log(`  Role: ${u.role}`);
      console.log(`  Profile Complete: ${u.profile_completed}\n`);
    });
  }
}

checkTables().catch(e => console.error('Fatal error:', e.message));
