import { supabase } from './supabase';

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

    const insertPayload = {
      po_number:             poNumber,
      supplier_id:           orderData.supplier_id,
      manager_id:            managerId,
      items:                 orderData.items || [],
      notes:                 orderData.notes || '',
      expected_delivery_date: orderData.expected_delivery_date || null,
      status:                'pending_approval',
      subtotal:              subtotal,
      tax_amount:            taxAmount,
      total_amount:          totalAmount,
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
};

export default supplierOrdersService;
