import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debugPaymentConfirmations() {
  console.log('\n🔍 DEBUGGING PAYMENT CONFIRMATIONS\n');
  
  try {
    // Get the payment we just created
    const { data: payments, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (paymentError) {
      console.error('❌ Error fetching payment:', paymentError);
      return;
    }

    const payment = payments?.[0];
    if (!payment) {
      console.log('⚠️ No payment found');
      return;
    }

    console.log('💳 Payment Found:');
    console.log(`   ID: ${payment.id}`);
    console.log(`   Purchase Order ID: ${payment.purchase_order_id}`);
    console.log(`   Amount: ${payment.amount_ugx} UGX`);
    console.log(`   Status: ${payment.payment_status}`);

    // Get the purchase order
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('id, po_number, supplier_id, created_by')
      .eq('id', payment.purchase_order_id)
      .single();

    if (orderError) {
      console.error('❌ Error fetching order:', orderError);
      return;
    }

    console.log('\n📦 Purchase Order:');
    console.log(`   PO #: ${order.po_number}`);
    console.log(`   Supplier ID: ${order.supplier_id}`);
    console.log(`   Created By (Manager): ${order.created_by}`);

    // Get the supplier user record
    const { data: supplier, error: supplierError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', order.supplier_id)
      .single();

    if (supplierError) {
      console.error('❌ Error fetching supplier:', supplierError);
      return;
    }

    console.log('\n👤 Supplier User:');
    console.log(`   ID: ${supplier.id}`);
    console.log(`   Email: ${supplier.email}`);
    console.log(`   Name: ${supplier.full_name}`);
    console.log(`   Role: ${supplier.role}`);

    // Get the manager user record
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', order.created_by)
      .single();

    if (managerError) {
      console.error('❌ Error fetching manager:', managerError);
      return;
    }

    console.log('\n👔 Manager User:');
    console.log(`   ID: ${manager.id}`);
    console.log(`   Email: ${manager.email}`);
    console.log(`   Name: ${manager.full_name}`);
    console.log(`   Role: ${manager.role}`);

    // Test the RPC function
    console.log('\n\n🧪 Testing RPC Function: get_pending_payment_confirmations\n');
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_pending_payment_confirmations', {
      p_supplier_id: order.supplier_id
    });

    if (rpcError) {
      console.error('❌ RPC Error:', rpcError);
    } else {
      console.log(`✅ RPC Returned: ${rpcResult?.length || 0} payment confirmations`);
      if (rpcResult && rpcResult.length > 0) {
        rpcResult.forEach((p, i) => {
          console.log(`\n  ${i + 1}. Transaction #${p.transaction_number}`);
          console.log(`     PO: ${p.po_number}`);
          console.log(`     Amount: ${p.amount_paid} UGX`);
          console.log(`     Status: ${p.confirmation_status}`);
          console.log(`     Manager: ${p.manager_name}`);
        });
      } else {
        console.log('⚠️ No results returned from RPC');
      }
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

debugPaymentConfirmations().catch(console.error);
