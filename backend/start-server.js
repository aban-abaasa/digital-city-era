/**
 * FAREDEAL Backend Server Launcher
 * Enhanced startup script with pre-flight checks
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

console.log('\x1b[36m%s\x1b[0m', '🚀 FAREDEAL Backend Server Launcher');
console.log('=' .repeat(70));
console.log('Starting pre-flight checks...\n');

// Pre-flight checks
const checks = {
  environment: false,
  database: false,
  configuration: false
};

// Check 1: Environment Variables
console.log('📋 Checking environment variables...');
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'PORT',
  'JWT_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length === 0) {
  console.log('   ✅ All required environment variables present');
  checks.environment = true;
} else {
  console.log('   ❌ Missing environment variables:', missingVars.join(', '));
  console.log('   💡 Please configure these in your .env file');
}

// Check 2: Database Connection
console.log('\n🗄️  Testing database connection...');
try {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .limit(1);

  if (error) {
    console.log('   ⚠️  Database connection issue:', error.message);
    console.log('   💡 Server will start but some features may not work');
  } else {
    console.log('   ✅ Database connection successful');
    checks.database = true;
  }
} catch (error) {
  console.log('   ❌ Database connection failed:', error.message);
  console.log('   💡 Check your Supabase credentials in .env');
}

// Check 3: Configuration
console.log('\n⚙️  Checking configuration...');
const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  businessName: process.env.BUSINESS_NAME || 'FAREDEAL',
  currency: process.env.BUSINESS_CURRENCY || 'UGX',
  taxRate: process.env.BUSINESS_TAX_RATE || 18
};

console.log('   ✅ Configuration loaded:');
console.log(`      - Port: ${config.port}`);
console.log(`      - Environment: ${config.nodeEnv}`);
console.log(`      - Business: ${config.businessName}`);
console.log(`      - Currency: ${config.currency}`);
console.log(`      - Tax Rate: ${config.taxRate}%`);
checks.configuration = true;

// Summary
console.log('\n' + '=' .repeat(70));
console.log('📊 Pre-flight Check Summary:');
console.log(`   Environment Variables: ${checks.environment ? '✅' : '❌'}`);
console.log(`   Database Connection:   ${checks.database ? '✅' : '⚠️'}`);
console.log(`   Configuration:         ${checks.configuration ? '✅' : '❌'}`);

const allChecksPassed = checks.environment && checks.database && checks.configuration;

if (allChecksPassed) {
  console.log('\n✨ All checks passed! Starting server...\n');
  console.log('=' .repeat(70));
  
  // Import and start the server
  import('./src/index.js');
} else {
  console.log('\n⚠️  Some checks failed. Server will start but may have issues.');
  console.log('💡 Please review the errors above and fix them for full functionality.\n');
  console.log('=' .repeat(70));
  console.log('\nStarting server anyway in 3 seconds...\n');
  
  setTimeout(() => {
    import('./src/index.js');
  }, 3000);
}
