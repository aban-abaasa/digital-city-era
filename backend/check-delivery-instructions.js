import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkColumn() {
  console.log('\n🔍 CHECKING purchase_orders COLUMNS\n');
  
  try {
    // Get all columns from purchase_orders table
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'purchase_orders',
      schema_name: 'public'
    });
    
    if (error) {
      console.log('RPC method not available, trying alternative...\n');
      
      // Alternative: Try to insert and see what columns exist
      const { data: result, error: insertError } = await supabase
        .from('purchase_orders')
        .select('*')
        .limit(1);
        
      if (insertError) {
        console.log('❌ Error accessing table:', insertError);
      } else {
        console.log('✓ Table access successful');
        if (result && result.length > 0) {
          const columns = Object.keys(result[0]);
          console.log('\nExisting columns:');
          columns.forEach(col => {
            if (col.includes('delivery') || col.includes('instruction')) {
              console.log(`  ✓ ${col}`);
            }
          });
          
          // Check specifically for delivery_instructions
          if (columns.includes('delivery_instructions')) {
            console.log('\n✅ delivery_instructions column EXISTS!');
          } else {
            console.log('\n❌ delivery_instructions column NOT FOUND');
            console.log('\nAll columns:', columns);
          }
        }
      }
    } else {
      console.log('Columns found:');
      data.forEach(col => {
        if (col.includes('delivery') || col.includes('instruction')) {
          console.log(`  ✓ ${col}`);
        }
      });
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
  
  // Also try a direct SQL query via Supabase
  console.log('\n📊 Running SQL check...\n');
  try {
    const { data: columns, error } = await supabase.rpc('get_table_info', {
      table_name: 'purchase_orders'
    });
    
    if (error) {
      console.log('Cannot use RPC, checking via table structure...');
      // Try to query information_schema
      const { data, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'purchase_orders')
        .eq('table_schema', 'public');
        
      if (!schemaError && data) {
        console.log('\nTable columns:');
        data.forEach(row => {
          console.log(`  - ${row.column_name}`);
          if (row.column_name === 'delivery_instructions') {
            console.log('    ✅ delivery_instructions FOUND!');
          }
        });
      }
    }
  } catch (e) {
    console.log('Schema query not available via RPC');
  }
}

checkColumn().catch(console.error);
