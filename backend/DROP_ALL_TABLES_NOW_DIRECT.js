#!/usr/bin/env node

/**
 * ============================================================================
 * DROP_ALL_TABLES_NOW_DIRECT.js
 * ============================================================================
 * Directly execute DROP TABLE commands via Supabase using raw SQL API
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

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

// Parse URL
const urlObj = new URL(SUPABASE_URL);
const hostname = urlObj.hostname;

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

function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      port: 443,
      path: '/rest/v1/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Accept': 'application/json'
      }
    };

    const payload = JSON.stringify({
      query: sql
    });

    options.headers['Content-Length'] = Buffer.byteLength(payload);

    console.log('🚀 Sending DROP TABLE commands to Supabase...\n');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data });
        } else {
          reject({
            statusCode: res.statusCode,
            message: data
          });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function dropAllTables() {
  try {
    // Build SQL statement
    let sql = 'SET session_replication_role = REPLICA;\n\n';
    
    allTables.forEach(table => {
      sql += `DROP TABLE IF EXISTS "${table}" CASCADE;\n`;
    });
    
    sql += '\nSET session_replication_role = DEFAULT;';

    console.log(`📋 Preparing to drop ${allTables.length} tables...\n`);

    // Execute the SQL
    const result = await executeSQL(sql);

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS! All tables have been dropped!\n');
    console.log('📊 Results:');
    console.log(`   📦 Tables dropped: ${allTables.length}`);
    console.log(`   ✅ Status: Complete`);
    console.log('='.repeat(60));
    console.log('\n🎉 Database is now completely clean!\n');
    console.log('Next steps:');
    console.log('1. Deploy STEP_0_ADD_ASSIGNED_ADMIN_COLUMN.sql');
    console.log('2. Deploy FIX_GOOGLE_OAUTH_AUTO_RECORD.sql');
    console.log('3. Create initial admin user');
    console.log('4. Test Google OAuth flow\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR executing DROP TABLE commands:\n');
    console.error('Status:', error.statusCode);
    console.error('Message:', error.message);
    
    console.log('\n📝 Manual execution required\n');
    console.log('Please go to Supabase SQL Editor:');
    console.log('https://app.supabase.com/project/zwmupgbixextqlexknnu/sql/new\n');
    console.log('And copy this SQL:\n');

    let sql = 'SET session_replication_role = REPLICA;\n\n';
    allTables.forEach(table => {
      sql += `DROP TABLE IF EXISTS "${table}" CASCADE;\n`;
    });
    sql += '\nSET session_replication_role = DEFAULT;';

    console.log(sql);
    console.log('\nThen click RUN\n');

    process.exit(1);
  }
}

dropAllTables();
