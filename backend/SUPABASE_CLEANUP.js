#!/usr/bin/env node

/**
 * ============================================================================
 * SUPABASE_CLEANUP.js
 * ============================================================================
 * Clean all data from Supabase directly via API
 * Usage: node SUPABASE_CLEANUP.js
 *
 * Prerequisites:
 * 1. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env
 * 2. Or set them as environment variables
 * 3. Install: npm install @supabase/supabase-js
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
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

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Ask user for confirmation
 */
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase());
    });
  });
}

/**
 * Clean all data from Supabase
 */
async function cleanupSupabase() {
  console.log('\n🧹 SUPABASE DATA CLEANUP TOOL\n');
  console.log('⚠️  WARNING: This will DELETE all data from your Supabase database!');
  console.log('⚠️  This action CANNOT be undone!\n');

  // Confirm deletion
  const confirmDelete = await askQuestion('Are you absolutely sure? Type "YES I WANT TO DELETE EVERYTHING" to continue: ');
  
  if (confirmDelete !== 'yes i want to delete everything') {
    console.log('\n❌ Cleanup cancelled.\n');
    rl.close();
    process.exit(0);
  }

  console.log('\n🚀 Starting cleanup...\n');

  try {
    // 1. Delete orders and transactions
    console.log('📦 Deleting orders...');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Orders deleted');

    console.log('📝 Deleting order items...');
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Order items deleted');

    console.log('💳 Deleting sales transactions...');
    await supabase.from('sales_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Sales transactions deleted');

    // 2. Delete inventory
    console.log('📊 Deleting inventory...');
    await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Inventory deleted');

    console.log('📈 Deleting stock movements...');
    await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Stock movements deleted');

    // 3. Delete users
    console.log('👥 Deleting users...');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Users deleted');

    console.log('\n✅ ALL DATA CLEANUP COMPLETE!\n');
    console.log('Database is now clean:');
    console.log('  ✅ Schema preserved (columns, functions, triggers)');
    console.log('  ✅ All user data deleted');
    console.log('  ✅ All orders deleted');
    console.log('  ✅ All inventory deleted');
    console.log('  ✅ All transactions deleted');
    console.log('\n🎯 Ready for fresh start!\n');

  } catch (error) {
    console.error('\n❌ ERROR during cleanup:');
    console.error(error.message);
    console.log('\nMake sure you have:');
    console.log('  1. Set SUPABASE_URL in .env');
    console.log('  2. Set SUPABASE_ANON_KEY in .env');
    console.log('  3. Run: npm install @supabase/supabase-js\n');
  } finally {
    rl.close();
  }
}

// Run cleanup
cleanupSupabase();
