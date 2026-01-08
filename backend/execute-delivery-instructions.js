import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function executeSQL() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     EXECUTING SQL: ADD delivery_instructions COLUMN        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // The SQL to execute
  const sql = `
    -- Add missing delivery_instructions column if it doesn't exist
    ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;
    
    -- Verify the column was added
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'delivery_instructions';
  `;
  
  try {
    console.log('⏳ Attempting to execute SQL...\n');
    
    // Try method 1: Using query directly
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_text: sql 
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    
  } catch (e) {
    console.log('❌ Direct execution failed:', e.message);
    console.log('\n📌 IMPORTANT: The migration files need to be executed manually in Supabase SQL Editor');
    console.log('   Go to: https://app.supabase.com/project/zwmupgbixextqlexknnu/sql/new');
    console.log('\n   Then paste this SQL:\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(sql);
    console.log('\n═══════════════════════════════════════════════════════════\n');
  }
}

executeSQL().catch(console.error);
