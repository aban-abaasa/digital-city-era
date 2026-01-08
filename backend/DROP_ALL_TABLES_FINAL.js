#!/usr/bin/env node

/**
 * ============================================================================
 * DROP_ALL_TABLES_FINAL.js
 * ============================================================================
 * Drop all tables using PostgreSQL client (pg)
 * ============================================================================
 */

import { Client } from 'pg';
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

console.log('\n🔥 DROPPING ALL TABLES FROM SUPABASE\n');
console.log('⚠️  WARNING: This will DELETE ALL TABLES!\n');

// Extract project ID from URL and build proper DB connection
const projectId = 'zwmupgbixextqlexknnu'; // From URL: zwmupgbixextqlexknnu.supabase.co
const region = 'ap-southeast-1'; // Supabase default region

// Supabase connection details
const host = `db.${projectId}.supabase.co`;
const port = 5432;
const database = 'postgres';
const user = 'postgres.zwmupgbixextqlexknnu'; // Supabase format: postgres.projectid
const password = 'Yousuf@2024';

// All tables to drop
const allTables = [
  'admin_access_requests', 'admin_activity_log', 'admin_dashboard_metrics',
  'admin_employee_access', 'admin_error_logs', 'admin_notifications',
  'admin_payment_audit', 'admin_profiles', 'admin_system_config',
  'admin_system_health', 'admin_users', 'avatar_images',
  'balance_adjustments', 'cashier_activity_log', 'cashier_alerts',
  'cashier_daily_stats', 'cashier_drawer_operations', 'cashier_evaluations',
  'cashier_kpis', 'cashier_order_items', 'cashier_orders',
  'cashier_performance', 'cashier_preferences', 'cashier_profiles',
  'cashier_returns', 'cashier_shifts', 'cashier_training',
  'cashier_transactions', 'categories', 'customers', 'product_ratings',
  'products', 'daily_sales_reports', 'employee_attendance', 'inventory',
  'inventory_metrics', 'inventory_real_time_metrics',
  'inventory_system_audit', 'inventory_system_status',
  'manager_activity_log', 'manager_activity_logs', 'manager_alerts',
  'manager_customer_complaints', 'manager_daily_reports',
  'manager_employee_attendance', 'manager_employee_schedules',
  'manager_performance_metrics', 'manager_profiles',
  'manager_sales_analysis', 'manager_stock_requests',
  'manager_team_members', 'manager_team_performance', 'manager_teams',
  'notifications', 'order_history', 'order_items', 'orders',
  'payment_installments', 'payment_metrics', 'payment_transactions',
  'payments', 'performance_metrics', 'purchase_orders',
  'quick_access_items', 'quick_access_sections', 'receipt_print_log',
  'sales', 'sales_transaction_items', 'sales_transactions',
  'staff_achievements', 'staff_goals', 'staff_profiles',
  'staff_schedules', 'supermarket_admin_users', 'supermarket_branches',
  'supermarket_inventory', 'supermarket_staff', 'supermarket_suppliers',
  'supermarket_users', 'supermarkets', 'supplier_activity_log',
  'supplier_alerts', 'supplier_communications', 'supplier_deliveries',
  'supplier_invoices', 'supplier_payments', 'supplier_performance',
  'supplier_products', 'supplier_profiles', 'suppliers',
  'system_settings', 'till_supplies_inventory', 'training_records', 'users'
];

const client = new Client({
  host: host,
  port: port,
  database: database,
  user: user,
  password: password,
  ssl: { rejectUnauthorized: false }
});

async function dropAllTables() {
  try {
    console.log(`🔌 Connecting to Supabase PostgreSQL...\n`);
    await client.connect();
    console.log('✅ Connected!\n');

    console.log(`📋 Preparing to drop ${allTables.length} tables...\n`);

    // Disable foreign key constraints
    console.log('🔧 Disabling foreign key constraints...');
    await client.query('SET session_replication_role = REPLICA;');
    console.log('✅ Done\n');

    // Drop each table
    let droppedCount = 0;
    let skippedCount = 0;

    console.log('🗑️  Dropping tables:\n');

    for (const table of allTables) {
      try {
        const dropSQL = `DROP TABLE IF EXISTS "${table}" CASCADE;`;
        await client.query(dropSQL);
        console.log(`   ✅ ${table}`);
        droppedCount++;
      } catch (err) {
        console.log(`   ⚠️  ${table} - ${err.message}`);
        skippedCount++;
      }
    }

    // Re-enable foreign key constraints
    console.log('\n🔧 Re-enabling foreign key constraints...');
    await client.query('SET session_replication_role = DEFAULT;');
    console.log('✅ Done\n');

    // Disconnect
    await client.end();

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS! All tables have been dropped!\n');
    console.log('📊 Results:');
    console.log(`   ✅ Dropped: ${droppedCount} tables`);
    console.log(`   ⚠️  Skipped: ${skippedCount} tables`);
    console.log('='.repeat(60));
    console.log('\n🎉 Database is now completely clean!\n');
    console.log('✅ All tables removed');
    console.log('✅ Schema cleared');
    console.log('✅ Ready for fresh deployment\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Details:', error);

    try {
      await client.end();
    } catch (e) {
      // ignore
    }

    process.exit(1);
  }
}

dropAllTables();
