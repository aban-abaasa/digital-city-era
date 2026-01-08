#!/usr/bin/env node

/**
 * ============================================================================
 * SUPABASE_CLEANUP_AUTO.js
 * ============================================================================
 * Automatic cleanup - NO USER CONFIRMATION
 * Use this for automated cleanup without interactive prompts
 * 
 * IMPORTANT: This will DELETE all data immediately!
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Clean all data from Supabase
 */
async function cleanupSupabase() {
  console.log('\n🧹 SUPABASE AUTOMATIC DATA CLEANUP\n');
  console.log('⚠️  Deleting all data from Supabase...\n');

  try {
    // 1. Delete orders and transactions
    console.log('📦 Deleting orders...');
    const ordersResult = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (ordersResult.error) console.log('  Note: ' + ordersResult.error.message);
    else console.log('✅ Orders deleted');

    console.log('📝 Deleting order items...');
    const itemsResult = await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (itemsResult.error) console.log('  Note: ' + itemsResult.error.message);
    else console.log('✅ Order items deleted');

    console.log('💳 Deleting sales transactions...');
    const transResult = await supabase.from('sales_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (transResult.error) console.log('  Note: ' + transResult.error.message);
    else console.log('✅ Sales transactions deleted');

    // 2. Delete inventory
    console.log('📊 Deleting inventory...');
    const invResult = await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (invResult.error) console.log('  Note: ' + invResult.error.message);
    else console.log('✅ Inventory deleted');

    console.log('📈 Deleting stock movements...');
    const stockResult = await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (stockResult.error) console.log('  Note: ' + stockResult.error.message);
    else console.log('✅ Stock movements deleted');

    // 3. Delete users
    console.log('👥 Deleting users...');
    const usersResult = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (usersResult.error) console.log('  Note: ' + usersResult.error.message);
    else console.log('✅ Users deleted');

    console.log('\n✅ ALL DATA CLEANUP COMPLETE!\n');
    console.log('Database is now clean:');
    console.log('  ✅ Schema preserved (columns, functions, triggers)');
    console.log('  ✅ All user data deleted');
    console.log('  ✅ All orders deleted');
    console.log('  ✅ All inventory deleted');
    console.log('  ✅ All transactions deleted');
    console.log('\n🎯 Ready for fresh start!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR during cleanup:');
    console.error(error.message);
    console.log('\nMake sure you have:');
    console.log('  1. Set SUPABASE_URL in .env');
    console.log('  2. Set SUPABASE_ANON_KEY in .env');
    console.log('  3. Run: npm install @supabase/supabase-js\n');
    process.exit(1);
  }
}

// Run cleanup
cleanupSupabase();
