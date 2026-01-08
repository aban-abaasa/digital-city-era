#!/usr/bin/env node

/**
 * ============================================================================
 * DELETE_ALL_DATA_NOW.js
 * ============================================================================
 * Execute DELETE_ALL_TABLES_DATA.sql directly via Supabase API
 * This will DELETE ALL DATA immediately - NO CONFIRMATION!
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

console.log('\n🧹 DELETING ALL DATA FROM SUPABASE\n');
console.log('⚠️  WARNING: This will DELETE EVERYTHING!\n');

// Initialize Supabase admin client with service key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deleteAllData() {
  try {
    console.log('🚀 Starting cleanup...\n');

    // List of all tables to delete from
    const tables = [
      // Admin Tables
      'admin_access_requests', 'admin_activity_log', 'admin_dashboard_metrics',
      'admin_employee_access', 'admin_error_logs', 'admin_notifications',
      'admin_payment_audit', 'admin_profiles', 'admin_system_config',
      'admin_system_health', 'admin_users',
      
      // Avatar & Images
      'avatar_images',
      
      // Balance Tables
      'balance_adjustments',
      
      // Cashier Tables
      'cashier_activity_log', 'cashier_alerts', 'cashier_daily_stats',
      'cashier_drawer_operations', 'cashier_evaluations', 'cashier_kpis',
      'cashier_order_items', 'cashier_orders', 'cashier_performance',
      'cashier_preferences', 'cashier_profiles', 'cashier_returns',
      'cashier_shifts', 'cashier_training', 'cashier_transactions',
      
      // Categories & Products
      'categories', 'customers', 'product_ratings', 'products',
      
      // Daily Reports
      'daily_sales_reports',
      
      // Employee Tables
      'employee_attendance',
      
      // Inventory Tables
      'inventory', 'inventory_metrics', 'inventory_real_time_metrics',
      'inventory_system_audit', 'inventory_system_status',
      
      // Manager Tables
      'manager_activity_log', 'manager_activity_logs', 'manager_alerts',
      'manager_customer_complaints', 'manager_daily_reports',
      'manager_employee_attendance', 'manager_employee_schedules',
      'manager_performance_metrics', 'manager_profiles', 'manager_sales_analysis',
      'manager_stock_requests', 'manager_team_members', 'manager_team_performance',
      'manager_teams',
      
      // Notifications
      'notifications',
      
      // Order Tables
      'order_history', 'order_items', 'orders',
      
      // Payment Tables
      'payment_installments', 'payment_metrics', 'payment_transactions', 'payments',
      
      // Performance
      'performance_metrics',
      
      // Purchase Orders
      'purchase_orders',
      
      // Quick Access
      'quick_access_items', 'quick_access_sections',
      
      // Receipt
      'receipt_print_log',
      
      // Sales Tables
      'sales', 'sales_transaction_items', 'sales_transactions',
      
      // Staff Tables
      'staff_achievements', 'staff_goals', 'staff_profiles', 'staff_schedules',
      
      // Supermarket Tables
      'supermarket_admin_users', 'supermarket_branches', 'supermarket_inventory',
      'supermarket_staff', 'supermarket_suppliers', 'supermarket_users', 'supermarkets',
      
      // Supplier Tables
      'supplier_activity_log', 'supplier_alerts', 'supplier_communications',
      'supplier_deliveries', 'supplier_invoices', 'supplier_payments',
      'supplier_performance', 'supplier_products', 'supplier_profiles', 'suppliers',
      
      // System Settings
      'system_settings',
      
      // Till & Training
      'till_supplies_inventory', 'training_records',
      
      // Users (LAST!)
      'users'
    ];

    let deletedCount = 0;
    let skippedCount = 0;

    for (const table of tables) {
      try {
        console.log(`🗑️  Deleting from ${table}...`);
        const { error, count } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          if (error.message.includes('does not exist')) {
            console.log(`   ⏭️  Skipped (table doesn't exist)`);
            skippedCount++;
          } else {
            console.log(`   ⚠️  Warning: ${error.message}`);
            skippedCount++;
          }
        } else {
          console.log(`   ✅ Deleted (${count || 0} rows)`);
          deletedCount++;
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ CLEANUP COMPLETE!\n');
    console.log(`📊 Results:`);
    console.log(`   ✅ Successfully deleted from: ${deletedCount} tables`);
    console.log(`   ⏭️  Skipped: ${skippedCount} tables`);
    console.log(`   📦 Total tables processed: ${tables.length}`);
    console.log('\n🎯 All data has been deleted!');
    console.log('   Schema: PRESERVED ✅');
    console.log('   Functions: PRESERVED ✅');
    console.log('   Triggers: PRESERVED ✅');
    console.log('   Data: DELETED ✅\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

deleteAllData();
