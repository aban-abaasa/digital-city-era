import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkPaymentData() {
  console.log('\n🔍 CHECKING PAYMENT TRANSACTIONS DATA\n');
  
  try {
    // Get all payment transactions
    const { data: payments, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (paymentError) {
      console.error('❌ Error fetching payments:', paymentError);
      return;
    }

    console.log(`📊 Total payments found: ${payments?.length || 0}\n`);

    if (payments && payments.length > 0) {
      payments.forEach((p, i) => {
        console.log(`\n💳 Payment ${i + 1}:`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Order ID: ${p.purchase_order_id}`);
        console.log(`   User ID: ${p.user_id}`);
        console.log(`   Amount: ${p.amount_ugx} UGX`);
        console.log(`   Method: ${p.payment_method}`);
        console.log(`   Status: ${p.payment_status}`);
        console.log(`   Transaction #: ${p.transaction_number}`);
        console.log(`   Created: ${new Date(p.created_at).toLocaleString()}`);
      });
    } else {
      console.log('⚠️ No payments found in database');
    }

    // Check if manager_id exists in purchase_orders
    console.log('\n\n🔍 CHECKING PURCHASE_ORDERS TABLE\n');
    
    const { data: orders, error: orderError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, manager_id, supplier_id')
      .limit(5);

    if (orderError) {
      console.error('❌ Error fetching orders:', orderError);
      return;
    }

    console.log(`📊 Sample orders:\n`);
    if (orders && orders.length > 0) {
      orders.forEach((o, i) => {
        console.log(`${i + 1}. PO: ${o.po_number}`);
        console.log(`   ID: ${o.id}`);
        console.log(`   Manager ID: ${o.manager_id}`);
        console.log(`   Supplier ID: ${o.supplier_id}`);
      });
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

checkPaymentData().catch(console.error);
