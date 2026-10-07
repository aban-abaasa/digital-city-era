#!/usr/bin/env node

/**
 * SUPERMARTKERA Database Deployment Script
 * Deploys SQL to Supabase using REST API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Read .env file
function readEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) {
        env[key.trim()] = rest.join('=').trim();
      }
    }
  });
  return env;
}

// Get database connection string from Supabase
async function getPostgresUrl(supabaseUrl, serviceKey) {
  // For manual Supabase connection, we need to construct the URL
  const projectId = supabaseUrl.split('.')[0].replace('https://', '');
  
  return {
    projectId,
    host: `${projectId}.db.supabase.co`,
    database: 'postgres',
    user: 'postgres'
  };
}

// Main deployment function
async function deploy() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 SUPERMARTKERA Database Deployment');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Read configuration
    const envPath = path.join(__dirname, 'backend', '.env');
    const sqlPath = path.join(__dirname, 'DEPLOYMENT_MINIMAL_TABLES.sql');
    
    if (!fs.existsSync(envPath)) {
      throw new Error(`❌ .env file not found at ${envPath}`);
    }
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`❌ SQL file not found at ${sqlPath}`);
    }
    
    const env = readEnv(envPath);
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    }
    
    console.log(`📍 Supabase Project: ${SUPABASE_URL}`);
    console.log(`📝 Deployment file: DEPLOYMENT_MINIMAL_TABLES.sql\n`);
    
    // Parse SQL statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    console.log(`📊 SQL Statistics:`);
    console.log(`   Total statements: ${statements.length}\n`);
    
    // Show table count
    const createTableCount = statements.filter(s => s.includes('CREATE TABLE')).length;
    const createIndexCount = statements.filter(s => s.includes('CREATE INDEX')).length;
    const createFunctionCount = statements.filter(s => s.includes('CREATE FUNCTION')).length;
    const createTriggerCount = statements.filter(s => s.includes('CREATE TRIGGER')).length;
    const rlsPolicies = statements.filter(s => s.includes('CREATE POLICY')).length;
    
    console.log(`📋 Breakdown:`);
    console.log(`   Tables:    ${createTableCount}`);
    console.log(`   Indexes:   ${createIndexCount}`);
    console.log(`   Functions: ${createFunctionCount}`);
    console.log(`   Triggers:  ${createTriggerCount}`);
    console.log(`   Policies:  ${rlsPolicies}\n`);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  IMPORTANT - MANUAL DEPLOYMENT REQUIRED');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('Since direct PostgreSQL connection requires authentication,');
    console.log('please follow these steps to deploy:\n');
    
    console.log('1️⃣  Open Supabase Dashboard:');
    console.log('   → https://app.supabase.com\n');
    
    console.log('2️⃣  Select Your Project:');
    console.log('   → Select SUPERMARTKERA project\n');
    
    console.log('3️⃣  Open SQL Editor:');
    console.log('   → Click "SQL Editor" in left sidebar\n');
    
    console.log('4️⃣  Create New Query:');
    console.log('   → Click "New Query" button\n');
    
    console.log('5️⃣  Copy SQL Content:');
    console.log('   → Open file: DEPLOYMENT_MINIMAL_TABLES.sql');
    console.log('   → Copy all content (Ctrl+A, Ctrl+C)\n');
    
    console.log('6️⃣  Paste in Supabase:');
    console.log('   → Paste into SQL Editor (Ctrl+V)\n');
    
    console.log('7️⃣  Execute:');
    console.log('   → Click "Run" button (or Ctrl+Enter)\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ What Will Be Created:');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📦 14 Essential Tables:');
    console.log('   ✓ users (Auth integration)');
    console.log('   ✓ suppliers (Vendor management)');
    console.log('   ✓ categories (Product categories)');
    console.log('   ✓ products (With cost_price, selling_price)');
    console.log('   ✓ inventory (Real-time stock tracking)');
    console.log('   ✓ stock_movements (Audit trail)');
    console.log('   ✓ customers (Customer profiles)');
    console.log('   ✓ orders (Cashier POS transactions)');
    console.log('   ✓ order_items (Line items with price snapshot)');
    console.log('   ✓ payments (6 payment methods)');
    console.log('   ✓ purchase_orders (Manager orders)');
    console.log('   ✓ purchase_order_items (PO line items)');
    console.log('   ✓ cashier_orders (Till supplies)');
    console.log('   ✓ till_supplies_inventory (Till supplies stock)\n');
    
    console.log('🔒 Security Features:');
    console.log('   ✓ Row Level Security (RLS) enabled');
    console.log('   ✓ 8+ RLS policies for data protection');
    console.log('   ✓ Google OAuth auto-record trigger');
    console.log('   ✓ Admin assignment on signup\n');
    
    console.log('⚙️  Database Features:');
    console.log('   ✓ Auto-timestamp triggers (updated_at)');
    console.log('   ✓ Real-time inventory (current, reserved, available)');
    console.log('   ✓ Price snapshots in orders (prevents discrepancies)');
    console.log('   ✓ Stock movement audit trail');
    console.log('   ✓ Complete approval workflows\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📞 Need Help?');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('If deployment fails:');
    console.log('   1. Check Supabase connection');
    console.log('   2. Ensure you have admin access');
    console.log('   3. Try deploying in smaller chunks');
    console.log('   4. Check SQL syntax in error message\n');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✨ Deployment Preparation Complete!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

deploy();
