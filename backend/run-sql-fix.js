import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runSqlFile() {
  try {
    console.log('📖 Reading SQL file...');
    const sqlContent = readFileSync(
      join(__dirname, 'sql', 'fix-order-history-constraint.sql'),
      'utf8'
    );

    console.log('🔧 Executing SQL fix...');
    
    // Split by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip comment blocks
      if (statement.includes('===')) continue;
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });

        if (error) {
          // Try direct query if RPC doesn't work
          const { error: directError } = await supabase
            .from('_sql_exec')
            .select('*')
            .eq('query', statement);
          
          if (directError) {
            console.error(`❌ Error in statement ${i + 1}:`, directError.message);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n📊 Results:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n✅ All fixes applied successfully!');
      console.log('You can now try creating the purchase order again.');
    } else {
      console.log('\n⚠️ Some errors occurred. You may need to run the SQL manually in Supabase dashboard.');
      console.log('Go to: Supabase Dashboard → SQL Editor → New Query');
      console.log('Then paste the content from: backend/sql/fix-order-history-constraint.sql');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Manual fix instructions:');
    console.log('1. Go to your Supabase Dashboard: https://app.supabase.com');
    console.log('2. Select your project');
    console.log('3. Click on "SQL Editor" in the left sidebar');
    console.log('4. Click "New Query"');
    console.log('5. Copy and paste the content from: backend/sql/fix-order-history-constraint.sql');
    console.log('6. Click "Run" to execute the SQL');
    process.exit(1);
  }
}

runSqlFile();
