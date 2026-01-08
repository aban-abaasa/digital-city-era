#!/usr/bin/env node

/**
 * ============================================================================
 * DEPLOY_FRESH_SCHEMA.js
 * ============================================================================
 * Deploy the fresh users table and all RPC functions for OAuth flow
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n📋 DEPLOYING FRESH SCHEMA\n');

// Read the SQL files
const sqlDir = path.join(__dirname, 'database');

let sqlContent = '';

// Read STEP_0 first
const step0Path = path.join(sqlDir, 'STEP_0_ADD_ASSIGNED_ADMIN_COLUMN.sql');
if (fs.existsSync(step0Path)) {
  console.log('📖 Reading STEP_0_ADD_ASSIGNED_ADMIN_COLUMN.sql...');
  sqlContent += fs.readFileSync(step0Path, 'utf-8') + '\n\n';
}

// Read FIX_GOOGLE_OAUTH next
const fixPath = path.join(sqlDir, 'FIX_GOOGLE_OAUTH_AUTO_RECORD.sql');
if (fs.existsSync(fixPath)) {
  console.log('📖 Reading FIX_GOOGLE_OAUTH_AUTO_RECORD.sql...');
  sqlContent += fs.readFileSync(fixPath, 'utf-8') + '\n\n';
}

if (sqlContent.length === 0) {
  console.error('❌ Could not find SQL files!');
  process.exit(1);
}

// Write combined SQL to a file for easy copy-paste
const outputPath = path.join(__dirname, 'DEPLOY_COMPLETE_SCHEMA.sql');
fs.writeFileSync(outputPath, sqlContent);

console.log('\n' + '='.repeat(70));
console.log('📝 COMPLETE DEPLOYMENT SQL GENERATED');
console.log('='.repeat(70));
console.log('\n✅ File created: DEPLOY_COMPLETE_SCHEMA.sql\n');
console.log('🔗 Go to: https://app.supabase.com/project/zwmupgbixextqlexknnu/sql/new');
console.log('📋 Copy and paste the content below');
console.log('▶️  Click RUN button\n');
console.log('='.repeat(70));
console.log(sqlContent);
console.log('='.repeat(70));
console.log('\n✅ After running this SQL:');
console.log('   1. users table will be created');
console.log('   2. 6 RPC functions will be deployed');
console.log('   3. Trigger will be set up for auto-user creation');
console.log('   4. Ready for Google OAuth testing!\n');

