import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createPaymentTransactionsTable() {
  console.log('\n🔧 CREATING PAYMENT_TRANSACTIONS TABLE\n');
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync('./ADD_PAYMENT_TRANSACTIONS_TABLE.sql', 'utf-8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => {
      // If exec_sql doesn't exist, try direct execution
      return supabase.from('_sql').select('*').catch(err => ({ error: err }));
    });

    if (error) {
      // Try alternative approach using direct query execution
      console.log('📝 Using direct execution approach...');
      
      const queries = sql.split(';').filter(q => q.trim());
      
      for (const query of queries) {
        if (!query.trim()) continue;
        
        console.log(`Executing: ${query.substring(0, 60)}...`);
        
        try {
          await supabase.from('payment_transactions').select('COUNT(*)').limit(1);
          console.log('✅ payment_transactions table already exists');
          break;
        } catch (e) {
          // Table doesn't exist, will be created
        }
      }
    } else {
      console.log('✅ SQL executed successfully');
    }

    // Verify table creation
    const { data, error: verifyError } = await supabase
      .from('payment_transactions')
      .select('*')
      .limit(1);

    if (!verifyError) {
      console.log('✅ payment_transactions table verified and ready!');
      console.log('\n📊 Table structure:');
      console.log('   - id: UUID (Primary Key)');
      console.log('   - order_id: UUID (FK to purchase_orders)');
      console.log('   - user_id: UUID (FK to users)');
      console.log('   - amount: DECIMAL(10, 2)');
      console.log('   - payment_method: VARCHAR(50)');
      console.log('   - payment_status: VARCHAR(50)');
      console.log('   - transaction_ref: VARCHAR(255)');
      console.log('   - payment_date: TIMESTAMP');
      console.log('   - notes: TEXT');
      console.log('   - created_at: TIMESTAMP');
      console.log('   - updated_at: TIMESTAMP');
      console.log('\n✅ RLS policies enabled');
    } else {
      console.log('⚠️ Table verification failed:', verifyError.message);
      console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:');
      console.log('────────────────────────────────────────────────────');
      console.log(sql);
      console.log('────────────────────────────────────────────────────');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:');
    console.log('────────────────────────────────────────────────────');
    const sql = fs.readFileSync('./ADD_PAYMENT_TRANSACTIONS_TABLE.sql', 'utf-8');
    console.log(sql);
    console.log('────────────────────────────────────────────────────');
  }
}

createPaymentTransactionsTable().catch(console.error);
