#!/usr/bin/env node

/**
 * ============================================================================
 * EXECUTE_DROP_TABLES.js
 * ============================================================================
 * Execute DROP ALL TABLES directly via Supabase REST API
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

console.log('\n🔥 DROPPING ALL TABLES FROM SUPABASE\n');
console.log('⚠️  WARNING: This will DELETE ALL TABLES!\n');

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function dropAllTables() {
  try {
    console.log('🚀 Starting table cleanup...\n');

    // The SQL to execute
    const sqlCommands = [
      'SET session_replication_role = REPLICA',
      'DROP TABLE IF EXISTS admin_access_requests CASCADE',
      'DROP TABLE IF EXISTS admin_activity_log CASCADE',
      'DROP TABLE IF EXISTS admin_dashboard_metrics CASCADE',
      'DROP TABLE IF EXISTS admin_employee_access CASCADE',
      'DROP TABLE IF EXISTS admin_error_logs CASCADE',
      'DROP TABLE IF EXISTS admin_notifications CASCADE',
      'DROP TABLE IF EXISTS admin_payment_audit CASCADE',
      'DROP TABLE IF EXISTS admin_profiles CASCADE',
      'DROP TABLE IF EXISTS admin_system_config CASCADE',
      'DROP TABLE IF EXISTS admin_system_health CASCADE',
      'DROP TABLE IF EXISTS admin_users CASCADE',
      'DROP TABLE IF EXISTS avatar_images CASCADE',
      'DROP TABLE IF EXISTS balance_adjustments CASCADE',
      'DROP TABLE IF EXISTS cashier_activity_log CASCADE',
      'DROP TABLE IF EXISTS cashier_alerts CASCADE',
      'DROP TABLE IF EXISTS cashier_daily_stats CASCADE',
      'DROP TABLE IF EXISTS cashier_drawer_operations CASCADE',
      'DROP TABLE IF EXISTS cashier_evaluations CASCADE',
      'DROP TABLE IF EXISTS cashier_kpis CASCADE',
      'DROP TABLE IF EXISTS cashier_order_items CASCADE',
      'DROP TABLE IF EXISTS cashier_orders CASCADE',
      'DROP TABLE IF EXISTS cashier_performance CASCADE',
      'DROP TABLE IF EXISTS cashier_preferences CASCADE',
      'DROP TABLE IF EXISTS cashier_profiles CASCADE',
      'DROP TABLE IF EXISTS cashier_returns CASCADE',
      'DROP TABLE IF EXISTS cashier_shifts CASCADE',
      'DROP TABLE IF EXISTS cashier_training CASCADE',
      'DROP TABLE IF EXISTS cashier_transactions CASCADE',
      'DROP TABLE IF EXISTS categories CASCADE',
      'DROP TABLE IF EXISTS customers CASCADE',
      'DROP TABLE IF EXISTS product_ratings CASCADE',
      'DROP TABLE IF EXISTS products CASCADE',
      'DROP TABLE IF EXISTS daily_sales_reports CASCADE',
      'DROP TABLE IF EXISTS employee_attendance CASCADE',
      'DROP TABLE IF EXISTS inventory CASCADE',
      'DROP TABLE IF EXISTS inventory_metrics CASCADE',
      'DROP TABLE IF EXISTS inventory_real_time_metrics CASCADE',
      'DROP TABLE IF EXISTS inventory_system_audit CASCADE',
      'DROP TABLE IF EXISTS inventory_system_status CASCADE',
      'DROP TABLE IF EXISTS manager_activity_log CASCADE',
      'DROP TABLE IF EXISTS manager_activity_logs CASCADE',
      'DROP TABLE IF EXISTS manager_alerts CASCADE',
      'DROP TABLE IF EXISTS manager_customer_complaints CASCADE',
      'DROP TABLE IF EXISTS manager_daily_reports CASCADE',
      'DROP TABLE IF EXISTS manager_employee_attendance CASCADE',
      'DROP TABLE IF EXISTS manager_employee_schedules CASCADE',
      'DROP TABLE IF EXISTS manager_performance_metrics CASCADE',
      'DROP TABLE IF EXISTS manager_profiles CASCADE',
      'DROP TABLE IF EXISTS manager_sales_analysis CASCADE',
      'DROP TABLE IF EXISTS manager_stock_requests CASCADE',
      'DROP TABLE IF EXISTS manager_team_members CASCADE',
      'DROP TABLE IF EXISTS manager_team_performance CASCADE',
      'DROP TABLE IF EXISTS manager_teams CASCADE',
      'DROP TABLE IF EXISTS notifications CASCADE',
      'DROP TABLE IF EXISTS order_history CASCADE',
      'DROP TABLE IF EXISTS order_items CASCADE',
      'DROP TABLE IF EXISTS orders CASCADE',
      'DROP TABLE IF EXISTS payment_installments CASCADE',
      'DROP TABLE IF EXISTS payment_metrics CASCADE',
      'DROP TABLE IF EXISTS payment_transactions CASCADE',
      'DROP TABLE IF EXISTS payments CASCADE',
      'DROP TABLE IF EXISTS performance_metrics CASCADE',
      'DROP TABLE IF EXISTS purchase_orders CASCADE',
      'DROP TABLE IF EXISTS quick_access_items CASCADE',
      'DROP TABLE IF EXISTS quick_access_sections CASCADE',
      'DROP TABLE IF EXISTS receipt_print_log CASCADE',
      'DROP TABLE IF EXISTS sales CASCADE',
      'DROP TABLE IF EXISTS sales_transaction_items CASCADE',
      'DROP TABLE IF EXISTS sales_transactions CASCADE',
      'DROP TABLE IF EXISTS staff_achievements CASCADE',
      'DROP TABLE IF EXISTS staff_goals CASCADE',
      'DROP TABLE IF EXISTS staff_profiles CASCADE',
      'DROP TABLE IF EXISTS staff_schedules CASCADE',
      'DROP TABLE IF EXISTS supermarket_admin_users CASCADE',
      'DROP TABLE IF EXISTS supermarket_branches CASCADE',
      'DROP TABLE IF EXISTS supermarket_inventory CASCADE',
      'DROP TABLE IF EXISTS supermarket_staff CASCADE',
      'DROP TABLE IF EXISTS supermarket_suppliers CASCADE',
      'DROP TABLE IF EXISTS supermarket_users CASCADE',
      'DROP TABLE IF EXISTS supermarkets CASCADE',
      'DROP TABLE IF EXISTS supplier_activity_log CASCADE',
      'DROP TABLE IF EXISTS supplier_alerts CASCADE',
      'DROP TABLE IF EXISTS supplier_communications CASCADE',
      'DROP TABLE IF EXISTS supplier_deliveries CASCADE',
      'DROP TABLE IF EXISTS supplier_invoices CASCADE',
      'DROP TABLE IF EXISTS supplier_payments CASCADE',
      'DROP TABLE IF EXISTS supplier_performance CASCADE',
      'DROP TABLE IF EXISTS supplier_products CASCADE',
      'DROP TABLE IF EXISTS supplier_profiles CASCADE',
      'DROP TABLE IF EXISTS suppliers CASCADE',
      'DROP TABLE IF EXISTS system_settings CASCADE',
      'DROP TABLE IF EXISTS till_supplies_inventory CASCADE',
      'DROP TABLE IF EXISTS training_records CASCADE',
      'DROP TABLE IF EXISTS users CASCADE',
      'SET session_replication_role = DEFAULT'
    ];

    // Execute SQL via HTTP request to Supabase REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        sql_string: sqlCommands.join(';\n') + ';'
      }),
    }).then(res => res.json()).catch(err => {
      throw new Error(`HTTP request failed: ${err.message}`);
    });

    if (response.error) {
      throw new Error(response.error.message || JSON.stringify(response.error));
    }

    console.log('✅ All tables dropped successfully!\n');
    console.log('='.repeat(50));
    console.log('🎯 Database is now completely clean!');
    console.log('   Tables: DELETED ✅');
    console.log('   Data: DELETED ✅');
    console.log('   Schema: CLEARED ✅\n');
    console.log('Ready for fresh deployment!\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\n💡 Trying alternative approach...\n');
    
    // Try dropping tables one by one
    dropTablesOneByOne();
  }
}

async function dropTablesOneByOne() {
  const tables = [
    'admin_access_requests', 'admin_activity_log', 'admin_dashboard_metrics',
    'admin_employee_access', 'admin_error_logs', 'admin_notifications',
    'admin_payment_audit', 'admin_profiles', 'admin_system_config',
    'admin_system_health', 'admin_users', 'avatar_images', 'balance_adjustments',
    'cashier_activity_log', 'cashier_alerts', 'cashier_daily_stats',
    'cashier_drawer_operations', 'cashier_evaluations', 'cashier_kpis',
    'cashier_order_items', 'cashier_orders', 'cashier_performance',
    'cashier_preferences', 'cashier_profiles', 'cashier_returns', 'cashier_shifts',
    'cashier_training', 'cashier_transactions', 'categories', 'customers',
    'product_ratings', 'products', 'daily_sales_reports', 'employee_attendance',
    'inventory', 'inventory_metrics', 'inventory_real_time_metrics',
    'inventory_system_audit', 'inventory_system_status', 'manager_activity_log',
    'manager_activity_logs', 'manager_alerts', 'manager_customer_complaints',
    'manager_daily_reports', 'manager_employee_attendance', 'manager_employee_schedules',
    'manager_performance_metrics', 'manager_profiles', 'manager_sales_analysis',
    'manager_stock_requests', 'manager_team_members', 'manager_team_performance',
    'manager_teams', 'notifications', 'order_history', 'order_items', 'orders',
    'payment_installments', 'payment_metrics', 'payment_transactions', 'payments',
    'performance_metrics', 'purchase_orders', 'quick_access_items',
    'quick_access_sections', 'receipt_print_log', 'sales', 'sales_transaction_items',
    'sales_transactions', 'staff_achievements', 'staff_goals', 'staff_profiles',
    'staff_schedules', 'supermarket_admin_users', 'supermarket_branches',
    'supermarket_inventory', 'supermarket_staff', 'supermarket_suppliers',
    'supermarket_users', 'supermarkets', 'supplier_activity_log', 'supplier_alerts',
    'supplier_communications', 'supplier_deliveries', 'supplier_invoices',
    'supplier_payments', 'supplier_performance', 'supplier_products',
    'supplier_profiles', 'suppliers', 'system_settings', 'till_supplies_inventory',
    'training_records', 'users'
  ];

  let droppedCount = 0;
  let failedCount = 0;

  console.log('📋 Attempting to drop tables one by one...\n');

  for (const table of tables) {
    try {
      console.log(`🗑️  Dropping ${table}...`);
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql_string: `DROP TABLE IF EXISTS ${table} CASCADE;`
        }),
      }).then(res => res.json());

      if (response.error && !response.error.message.includes('does not exist')) {
        console.log(`   ⚠️  ${response.error.message}`);
        failedCount++;
      } else {
        console.log(`   ✅ Dropped`);
        droppedCount++;
      }
    } catch (err) {
      console.log(`   ❌ ${err.message}`);
      failedCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ CLEANUP ATTEMPT COMPLETE!\n');
  console.log(`📊 Results:`);
  console.log(`   ✅ Dropped: ${droppedCount} tables`);
  console.log(`   ⚠️  Failed: ${failedCount} tables`);
  console.log('\n🎯 Database cleanup finished!\n');
  
  process.exit(0);
}

dropAllTables();
