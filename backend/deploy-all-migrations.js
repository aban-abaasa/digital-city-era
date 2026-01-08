import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function deployMigrations() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         DEPLOYING DATABASE MIGRATIONS                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const migrations = [
    { name: 'CREATE_MISSING_TABLES', file: 'CREATE_MISSING_TABLES.sql' },
    { name: 'ADD_PRODUCTS_COLUMNS', file: 'ADD_PRODUCTS_COLUMNS.sql' },
    { name: 'ADD_SUPPLIERS_COLUMNS', file: 'ADD_SUPPLIERS_COLUMNS.sql' },
    { name: 'ADD_PURCHASE_ORDERS_COLUMNS', file: 'ADD_PURCHASE_ORDERS_COLUMNS.sql' }
  ];
  
  const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
  
  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${migration.name}: File not found at ${filePath}`);
      continue;
    }
    
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`📝 Deploying: ${migration.name}`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).catch(() => {
        // Fallback: If exec_sql doesn't exist, we need to run via SQL Editor
        throw new Error('RPC function not available - must run manually in Supabase SQL Editor');
      });
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        console.log(`   📋 Please run manually in Supabase SQL Editor`);
      } else {
        console.log(`   ✓ Success`);
      }
    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
      console.log(`   📋 Please run manually in Supabase SQL Editor`);
    }
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                  INSTRUCTIONS                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('To deploy these migrations manually:\n');
  console.log('1. Go to: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to SQL Editor');
  console.log('4. Create a new query for each file and run:\n');
  
  for (const migration of migrations) {
    console.log(`   📄 ${migration.file}`);
  }
  
  console.log('\nFiles location:');
  console.log(`📁 ${migrationsDir}\n`);
}

deployMigrations().catch(e => console.error('Error:', e.message));
