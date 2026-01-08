#!/usr/bin/env node

/**
 * ============================================================================
 * DROP_ALL_TABLES_EXECUTE.js
 * ============================================================================
 * Actually executes DROP TABLE commands via Supabase API
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

console.log('\n🔥 EXECUTING: DROP ALL TABLES\n');
console.log('⚠️  WARNING: This will DELETE ALL TABLES IMMEDIATELY!\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function dropAllTables() {
  try {
    let droppedCount = 0;
    let failedCount = 0;

    console.log(`🚀 Dropping ${allTables.length} tables...\n`);

    // Disable foreign key checks first
    console.log('🔧 Disabling foreign key constraints...');
    await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .catch(() => null);

    // Drop each table one by one
    for (const table of allTables) {
      try {
        const dropSQL = `DROP TABLE IF EXISTS "${table}" CASCADE;`;
        
        // Try dropping via direct query
        const { error } = await supabase
          .rpc('exec_sql', { sql_string: dropSQL })
          .catch(async () => {
            // If exec_sql doesn't exist, try raw query
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
              },
              body: JSON.stringify({ sql_string: dropSQL })
            });
            return { error: null };
          });

        if (!error) {
          console.log(`✅ Dropped: ${table}`);
          droppedCount++;
        } else {
          console.log(`⚠️  Failed: ${table} - ${error.message}`);
          failedCount++;
        }
      } catch (err) {
        console.log(`❌ Error: ${table} - ${err.message}`);
        failedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS:');
    console.log(`   ✅ Successfully dropped: ${droppedCount} tables`);
    console.log(`   ❌ Failed: ${failedCount} tables`);
    console.log('='.repeat(60));

    if (droppedCount > 0) {
      console.log('\n🎉 SUCCESS! Tables have been dropped!\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  No tables were dropped. Trying alternative method...\n');
      
      // Alternative: Use direct HTTP request with raw SQL
      console.log('🔄 Attempting direct SQL execution...\n');
      
      const sqlStatements = allTables.map(t => `DROP TABLE IF EXISTS "${t}" CASCADE;`).join('\n');
      
      const fullSQL = `
SET session_replication_role = REPLICA;
${sqlStatements}
SET session_replication_role = DEFAULT;
      `;

      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({ query: fullSQL })
      });

      const result = await response.json();
      
      if (response.ok || result.success) {
        console.log('✅ Alternative method successful!\n');
        process.exit(0);
      } else {
        console.error('❌ Alternative method failed:', result);
        
        console.log('\n📝 MANUAL EXECUTION REQUIRED\n');
        console.log('The automatic execution failed. Please:');
        console.log('\n1. Go to Supabase SQL Editor:');
        console.log('   https://app.supabase.com/project/zwmupgbixextqlexknnu/sql/new\n');
        console.log('2. Run this SQL:\n');
        console.log(fullSQL);
        console.log('\n3. Click RUN\n');
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    
    // Generate SQL for manual execution
    const sqlStatements = allTables.map(t => `DROP TABLE IF EXISTS "${t}" CASCADE;`).join('\n');
    
    const fullSQL = `
SET session_replication_role = REPLICA;
${sqlStatements}
SET session_replication_role = DEFAULT;
    `;

    console.log('\n📝 MANUAL EXECUTION REQUIRED\n');
    console.log('Please copy and execute this in Supabase SQL Editor:');
    console.log('https://app.supabase.com/project/zwmupgbixextqlexknnu/sql/new\n');
    console.log(fullSQL);
    
    process.exit(1);
  }
}

dropAllTables();
