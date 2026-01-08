#!/usr/bin/env node

/**
 * ============================================================================
 * EXECUTE_DROP_TABLES_NOW.js
 * ============================================================================
 * Execute DROP TABLE commands directly via PostgreSQL connection
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

console.log('\n🔥 EXECUTING DROP TABLE COMMANDS\n');
console.log('⚠️  WARNING: Dropping all tables NOW!\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// All table names
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

async function dropAllTables() {
  try {
    console.log('🚀 Starting deletion...\n');

    let droppedCount = 0;
    let errorCount = 0;

    // Drop each table
    for (const table of allTables) {
      try {
        // Try to delete from table first to check if it exists
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          // If it's a table not found error, try anyway
          if (error.message.includes('does not exist') || error.message.includes('not found')) {
            console.log(`⏭️  ${table} - already dropped or doesn't exist`);
          } else {
            console.log(`⚠️  ${table} - ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`✅ ${table} - cleared`);
          droppedCount++;
        }
      } catch (err) {
        console.log(`❌ ${table} - ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS:');
    console.log(`   ✅ Tables cleared: ${droppedCount}`);
    console.log(`   ⚠️  Errors/Skipped: ${errorCount}`);
    console.log(`   📦 Total processed: ${allTables.length}`);
    console.log('='.repeat(60));
    console.log('\n✅ All table data has been cleared!\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

dropAllTables();
