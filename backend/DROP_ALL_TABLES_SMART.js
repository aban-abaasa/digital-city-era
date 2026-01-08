#!/usr/bin/env node

/**
 * ============================================================================
 * DROP_ALL_TABLES_SMART.js
 * ============================================================================
 * Dynamically discovers and drops ALL tables from Supabase
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

console.log('\n🔥 DISCOVERING AND DROPPING ALL TABLES\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getAllTables() {
  try {
    console.log('🔍 Scanning Supabase for all tables...\n');

    // Query information_schema to get all tables
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .neq('table_type', 'VIEW');

    if (error) {
      console.log('⚠️  Could not query information_schema directly');
      console.log('   Falling back to manual table list...\n');
      return null;
    }

    if (data && data.length > 0) {
      const tableNames = data.map(row => row.table_name);
      console.log(`✅ Found ${tableNames.length} tables:\n`);
      tableNames.forEach(name => console.log(`   - ${name}`));
      return tableNames;
    }

    return null;
  } catch (error) {
    console.log('⚠️  Error querying tables:', error.message);
    return null;
  }
}

async function generateDropSQL(tableNames) {
  let sql = `-- Disable foreign key checks
SET session_replication_role = REPLICA;

-- Drop all tables in public schema
`;

  if (tableNames && tableNames.length > 0) {
    // Use discovered tables
    tableNames.forEach(name => {
      sql += `DROP TABLE IF EXISTS "${name}" CASCADE;\n`;
    });
    console.log(`\n📋 Generated DROP statements for ${tableNames.length} tables\n`);
  } else {
    // Use comprehensive list as fallback
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

    allTables.forEach(name => {
      sql += `DROP TABLE IF EXISTS "${name}" CASCADE;\n`;
    });
    console.log(`📋 Using comprehensive table list (${allTables.length} tables)\n`);
  }

  sql += `\n-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;`;

  return sql;
}

async function main() {
  try {
    // Step 1: Discover tables
    const discoveredTables = await getAllTables();

    // Step 2: Generate SQL
    const sql = await generateDropSQL(discoveredTables);

    // Step 3: Display SQL and instructions
    console.log('\n' + '='.repeat(60));
    console.log('📝 SQL TO EXECUTE IN SUPABASE:\n');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
    console.log('\n✅ COPY THE SQL ABOVE\n');
    console.log('🔗 Go to: https://app.supabase.com/project/zwmupgbixextqlexknnu/sql/new');
    console.log('📌 Paste the SQL');
    console.log('▶️  Click RUN button\n');
    console.log('All tables will be DROPPED immediately!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

main();
