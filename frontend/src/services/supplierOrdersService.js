import { supabase } from './supabase';
import { sendICAN } from './icanWalletService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getManagerId = () => {
  try {
    const stored = localStorage.getItem('supermarket_user');
    return stored ? JSON.parse(stored).id : null;
  } catch {
    return null;
  }
};

// purchase_orders.supplier_id was historically written as either the supplier's
// auth UUID or their internal users.id row (see FIX_CURRENT_USER_HELPERS_ID_FALLBACK.sql
// for the same auth_id/id split elsewhere). Resolve both so orders stored under
// either id are still found. Use this (instead of a bare .eq('supplier_id', authId))
// in every supplier-facing query against purchase_orders.
export const getSupplierOrderMatchIds = async (authId) => {
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .or(`auth_id.eq.${authId},id.eq.${authId}`)
    .eq('role', 'supplier')
    .maybeSingle();

  return [...new Set([authId, userRow?.id].filter(Boolean))];
};

// ---------------------------------------------------------------------------
// Suppliers — read from approved supplier_applications
// purchase_orders.supplier_id references users(id) = supplier_applications.supplier_user_id
// ---------------------------------------------------------------------------

export const getActiveSuppliers = async () => {
  try {
    const { data: apps, error } = await supabase
      .from('supplier_applications')
      .select('id, supplier_user_id, business_name, contact_name, contact_email, contact_phone')
      .eq('status', 'approved');

    if (error) throw error;

    console.log('✅ Approved supplier applications:', apps?.length, apps);

    const seen = new Set();
    const suppliers = (apps || [])
      .filter(a => {
        if (!a.supplier_user_id || seen.has(a.supplier_user_id)) return false;
        seen.add(a.supplier_user_id);
        return true;
      })
      .map(a => ({
        id: a.supplier_user_id,
        application_id: a.id,
        company_name:  a.business_name || a.contact_name || 'Supplier',
        business_name: a.business_name || a.contact_name || 'Supplier',
        contact_email: a.contact_email || '',
        contact_phone: a.contact_phone || '',
        supplier_code: `SUP-${(a.supplier_user_id || '').toString().slice(-6)}`
      }));

    return { success: true, suppliers };
  } catch (error) {
    console.error('Error fetching active suppliers:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Purchase Orders — CRUD
// Actual DB columns: manager_id, ordered_at, total_amount, subtotal, tax_amount
// ---------------------------------------------------------------------------

export const getAllPurchaseOrders = async ({ status = null } = {}) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: orders, error } = await query;
    if (error) throw error;

    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return { success: false, error: error.message };
  }
};

export const getOrderHistory = async ({ status = null } = {}) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .in('status', ['received', 'completed', 'cancelled'])
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: orders, error } = await query;
    if (error) throw error;

    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Error fetching order history:', error);
    return { success: false, error: error.message };
  }
};

export const getOrdersByPaymentStatus = async (paymentStatus) => {
  try {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Error fetching orders by payment status:', error);
    return { success: false, error: error.message };
  }
};

export const createPurchaseOrder = async (orderData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const managerId = user?.id || getManagerId();

    const subtotal = (orderData.items || []).reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
      0
    );
    const taxAmount = subtotal * 0.18;
    const totalAmount = subtotal + taxAmount;

    const poNumber = `PO-${Date.now().toString().slice(-8)}`;

    // Accept either camelCase (as sent by SupplierOrderManagement's CreateOrderModal)
    // or snake_case keys — a prior mismatch here (orderData.supplier_id vs the
    // supplierId actually sent) meant every order was inserted with a NULL
    // supplier_id, so suppliers never saw orders managers had submitted.
    const supplierId = orderData.supplierId ?? orderData.supplier_id;
    const expectedDeliveryDate = orderData.expectedDeliveryDate ?? orderData.expected_delivery_date ?? null;
    const deliveryAddress = orderData.deliveryAddress ?? orderData.delivery_address ?? null;
    const deliveryInstructions = orderData.deliveryInstructions ?? orderData.delivery_instructions ?? null;

    const insertPayload = {
      po_number:             poNumber,
      supplier_id:           supplierId,
      manager_id:            managerId,
      items:                 orderData.items || [],
      notes:                 orderData.notes || '',
      expected_delivery_date: expectedDeliveryDate,
      delivery_address:      deliveryAddress,
      delivery_instructions: deliveryInstructions,
      priority:              orderData.priority || 'normal',
      status:                'pending_approval',
      subtotal:              subtotal,
      tax_amount:            taxAmount,
      total_amount:          totalAmount,
      // Initialize payment tracking so the balance is correct from the start —
      // otherwise balance_due_ugx stays NULL/0 and the "Add Payment" UI never appears.
      payment_status:        'unpaid',
      balance_due_ugx:       totalAmount,
      ordered_at:            new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return { success: true, order: data };
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return { success: false, error: error.message };
  }
};

export const rejectPurchaseOrder = async (orderId, reason, managerId) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled', notes: reason || 'Rejected by manager' })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, order: data };
  } catch (error) {
    console.error('Error rejecting purchase order:', error);
    return { success: false, error: error.message };
  }
};

export const sendOrderToSupplier = async (orderId, managerId) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'sent_to_supplier' })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, order: data };
  } catch (error) {
    console.error('Error sending order to supplier:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getSupplierOrderStats = async () => {
  try {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*');

    if (error) throw error;

    const stats = {
      total:       orders?.length || 0,
      pending:     orders?.filter(o => o.status === 'pending_approval').length || 0,
      approved:    orders?.filter(o => o.status === 'approved').length || 0,
      sent:        orders?.filter(o => o.status === 'sent_to_supplier').length || 0,
      confirmed:   orders?.filter(o => o.status === 'confirmed').length || 0,
      received:    orders?.filter(o => o.status === 'received').length || 0,
      cancelled:   orders?.filter(o => o.status === 'cancelled').length || 0,
      totalValue:  orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
    };

    return { success: true, stats };
  } catch (error) {
    console.error('Error fetching order stats:', error);
    return { success: false, stats: {} };
  }
};

// ---------------------------------------------------------------------------
// Deliveries — mark purchase_order as received
// ---------------------------------------------------------------------------

export const getAllDeliveries = async () => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('status', 'received')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, deliveries: data || [] };
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return { success: false, error: error.message };
  }
};

export const createDelivery = async (orderId, deliveryData = {}) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        updated_at: new Date().toISOString(),
        notes: deliveryData.notes || 'Delivery recorded'
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, delivery: data };
  } catch (error) {
    console.error('Error recording delivery:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Payment tracking — replaces the missing record_payment_with_tracking RPC
// ---------------------------------------------------------------------------

export const recordPayment = async ({ orderId, amountPaid, paymentMethod, paymentReference, notes, paidBy }) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || paidBy;

    if (!userId) throw new Error('No authenticated user for payment recording');

    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        purchase_order_id: orderId,
        user_id:           userId,
        recorded_by:       userId,
        amount_ugx:        amountPaid,
        payment_method:    paymentMethod || 'cash',
        payment_reference: paymentReference || null,
        payment_status:    'confirmed',
        payment_date:      new Date().toISOString(),
        notes:             notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, payment: data };
  } catch (error) {
    const msg = error?.message || error?.details || JSON.stringify(error) || 'Unknown error';
    console.error('Error recording payment:', msg);
    return { success: false, error: msg };
  }
};

// Pay a supplier order straight from the manager's ICAN wallet. Unlike cash/
// mobile money/bank transfer, the transfer itself is provable and instant —
// sendICAN() already validates the manager's balance and moves the coins —
// so this records the payment as confirmed immediately instead of waiting
// on a separate supplier confirmation step.
// Note: like every ICAN transfer platform-wide, there is no fee on sends
// (see transfer_ican) — the supplier receives the full ICAN amount sent.
export const payOrderWithICAN = async ({ orderId, supplierUserId, icanAmount, ugxAmount, notes }) => {
  try {
    if (!supplierUserId) throw new Error('This order has no supplier assigned — cannot pay with ICAN.');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user for ICAN payment');

    const transfer = await sendICAN({
      fromUserId: user.id,
      toUserId: supplierUserId,
      amount: icanAmount,
      note: notes || `Purchase order payment (${orderId})`,
      referenceId: orderId,
    });

    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        purchase_order_id: orderId,
        user_id: user.id,
        recorded_by: user.id,
        amount_ugx: ugxAmount,
        payment_method: 'ican_wallet',
        payment_reference: transfer?.out_tx_id || null,
        payment_status: 'confirmed',
        payment_date: new Date().toISOString(),
        confirmed_by_supplier: true,
        confirmation_date: new Date().toISOString(),
        confirmation_notes: 'Auto-confirmed — ICAN wallet transfer completed instantly',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    const totals = await syncOrderPaymentTotals(orderId);
    return { success: true, payment: data, transfer, ...totals };
  } catch (error) {
    const msg = error?.message || 'Unknown error';
    console.error('Error paying order with ICAN:', msg);
    return { success: false, error: msg };
  }
};

// Recompute amount_paid_ugx / balance_due_ugx / payment_status on the order
// from its confirmed payment_transactions rows. Must run after every
// confirmation — nothing else keeps these columns in sync (the RPC these
// were designed around, record_payment_with_tracking, was never created).
export const syncOrderPaymentTotals = async (orderId) => {
  const { data: order, error: orderErr } = await supabase
    .from('purchase_orders')
    .select('total_amount')
    .eq('id', orderId)
    .single();

  if (orderErr) throw orderErr;

  const { data: txns, error: txErr } = await supabase
    .from('payment_transactions')
    .select('amount_ugx')
    .eq('purchase_order_id', orderId)
    .eq('confirmed_by_supplier', true);

  if (txErr) throw txErr;

  const totalAmount = parseFloat(order?.total_amount) || 0;
  const amountPaid = (txns || []).reduce((sum, t) => sum + (parseFloat(t.amount_ugx) || 0), 0);
  const balanceDue = Math.max(totalAmount - amountPaid, 0);
  const paymentStatus = amountPaid <= 0 ? 'unpaid' : balanceDue <= 0 ? 'paid' : 'partially_paid';

  const { error: updateErr } = await supabase
    .from('purchase_orders')
    .update({
      amount_paid_ugx: amountPaid,
      balance_due_ugx: balanceDue,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateErr) throw updateErr;

  return { amountPaid, balanceDue, paymentStatus };
};

// Confirm a payment transaction (supplier side) and roll the totals up onto
// the order — the two must happen together or the order's tracked balance
// silently stops matching the actual confirmed payments.
export const confirmPayment = async (txnId, confirmationNotes = '') => {
  try {
    const { data: txn, error: fetchErr } = await supabase
      .from('payment_transactions')
      .select('purchase_order_id')
      .eq('id', txnId)
      .single();

    if (fetchErr) throw fetchErr;

    const { error: confirmErr } = await supabase
      .from('payment_transactions')
      .update({
        confirmed_by_supplier: true,
        confirmation_date: new Date().toISOString(),
        confirmation_notes: confirmationNotes.trim() || null,
        payment_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', txnId);

    if (confirmErr) throw confirmErr;

    const totals = await syncOrderPaymentTotals(txn.purchase_order_id);
    return { success: true, ...totals };
  } catch (error) {
    console.error('Error confirming payment:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Approve supplier (status management in users table)
// ---------------------------------------------------------------------------

export const updateSupplierStatus = async (supplierId, status) => {
  try {
    const isActive = status === 'active';
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', supplierId)
      .eq('role', 'supplier')
      .select()
      .single();

    if (error) throw error;
    return { success: true, supplier: data };
  } catch (error) {
    console.error('Error updating supplier status:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Default export object (component uses `import supplierOrdersService from ...`)
// ---------------------------------------------------------------------------

const supplierOrdersService = {
  getActiveSuppliers,
  getAllPurchaseOrders,
  getOrderHistory,
  getOrdersByPaymentStatus,
  createPurchaseOrder,
  rejectPurchaseOrder,
  sendOrderToSupplier,
  getSupplierOrderStats,
  getAllDeliveries,
  createDelivery,
  updateSupplierStatus,
  recordPayment,
  payOrderWithICAN,
  confirmPayment,
  syncOrderPaymentTotals,
  getSupplierOrderMatchIds,
};

export default supplierOrdersService;
