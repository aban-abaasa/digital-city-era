// =====================================================================
// SUPPLIER ORDERS SERVICE - FAREDEAL UGANDA
// =====================================================================
// Manages supplier orders, purchase orders, and deliveries
// Integrates with Supabase for real-time supplier management
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================================
// SUPPLIER MANAGEMENT
// =====================================================================

/**
 * Get all supplier profiles with statistics
 */
export const getAllSuppliers = async () => {
  try {
    const { data, error } = await supabase
      .from('supplier_profiles')
      .select(`
        *,
        purchase_orders(count),
        supplier_invoices(
          balance_due_ugx,
          payment_status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate additional stats for each supplier
    const suppliersWithStats = data.map(supplier => {
      const pendingInvoices = supplier.supplier_invoices?.filter(
        inv => inv.payment_status === 'unpaid' || inv.payment_status === 'partially_paid'
      ).length || 0;

      const totalOutstanding = supplier.supplier_invoices?.reduce(
        (sum, inv) => sum + (parseFloat(inv.balance_due_ugx) || 0), 0
      ) || 0;

      return {
        ...supplier,
        pendingOrders: supplier.purchase_orders?.[0]?.count || 0,
        pendingInvoices,
        totalOutstanding
      };
    });

    return {
      success: true,
      suppliers: suppliersWithStats
    };
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get active suppliers only
 */
export const getActiveSuppliers = async () => {
  try {
    const { data, error } = await supabase
      .from('supplier_profiles')
      .select('*')
      .eq('status', 'active')
      .order('business_name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      suppliers: data
    };
  } catch (error) {
    console.error('Error fetching active suppliers:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Approve or reject supplier
 */
export const updateSupplierStatus = async (supplierId, status, notes = '') => {
  try {
    const { data, error } = await supabase
      .from('supplier_profiles')
      .update({
        status,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierId)
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    await supabase.from('supplier_activity_log').insert({
      supplier_id: supplierId,
      activity_type: 'status_change',
      activity_description: `Supplier status changed to ${status}`,
      metadata: { new_status: status, notes }
    });

    return {
      success: true,
      supplier: data
    };
  } catch (error) {
    console.error('Error updating supplier status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =====================================================================
// PURCHASE ORDERS MANAGEMENT
// =====================================================================

/**
 * Get all purchase orders with supplier details
 */
export const getAllPurchaseOrders = async (filters = {}) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:supplier_profiles(
          id,
          supplier_code,
          business_name,
          contact_person_name,
          contact_person_phone,
          contact_person_email
        ),
        ordered_by_user:users!purchase_orders_ordered_by_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        approved_by_user:users!purchase_orders_approved_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .order('order_date', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Format the data
    const formattedOrders = data.map(order => ({
      ...order,
      supplierName: order.supplier?.business_name || 'Unknown',
      orderedBy: order.ordered_by_user 
        ? `${order.ordered_by_user.first_name} ${order.ordered_by_user.last_name}`
        : 'Unknown',
      approvedBy: order.approved_by_user
        ? `${order.approved_by_user.first_name} ${order.approved_by_user.last_name}`
        : null
    }));

    return {
      success: true,
      orders: formattedOrders
    };
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get pending purchase orders (awaiting approval or supplier confirmation)
 */
export const getPendingPurchaseOrders = async () => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:supplier_profiles(
          id,
          supplier_code,
          business_name,
          contact_person_name,
          contact_person_phone,
          contact_person_email
        ),
        ordered_by_user:users!purchase_orders_ordered_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .in('status', ['pending_approval', 'approved', 'sent_to_supplier'])
      .order('order_date', { ascending: false });

    if (error) throw error;

    const formattedOrders = data.map(order => ({
      ...order,
      supplierName: order.supplier?.business_name || 'Unknown',
      orderedBy: order.ordered_by_user
        ? `${order.ordered_by_user.first_name} ${order.ordered_by_user.last_name}`
        : 'Unknown',
      items: order.items || []
    }));

    return {
      success: true,
      orders: formattedOrders
    };
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create new purchase order
 */
export const createPurchaseOrder = async (orderData) => {
  try {
    const {
      supplierId,
      items,
      expectedDeliveryDate,
      deliveryAddress,
      deliveryInstructions,
      priority,
      notes,
      orderedBy
    } = orderData;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxRate = 18.0; // 18% VAT for Uganda
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: supplierId,
        order_date: new Date().toISOString(),
        expected_delivery_date: expectedDeliveryDate,
        ordered_by: orderedBy,
        items: items,
        subtotal_ugx: subtotal,
        tax_ugx: taxAmount,
        tax_rate: taxRate,
        total_amount_ugx: totalAmount,
        delivery_address: deliveryAddress,
        delivery_instructions: deliveryInstructions,
        priority: priority || 'normal',
        status: 'pending_approval',
        notes
      })
      .select(`
        *,
        supplier:supplier_profiles(
          business_name,
          contact_person_name
        )
      `)
      .single();

    if (error) throw error;

    return {
      success: true,
      order: data,
      message: 'Purchase order created successfully'
    };
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Approve purchase order
 */
export const approvePurchaseOrder = async (orderId, approvedBy) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      order: data,
      message: 'Purchase order approved successfully'
    };
  } catch (error) {
    console.error('Error approving purchase order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Reject purchase order
 */
export const rejectPurchaseOrder = async (orderId, reason, rejectedBy) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: rejectedBy,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      order: data,
      message: 'Purchase order rejected'
    };
  } catch (error) {
    console.error('Error rejecting purchase order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send order to supplier (update status)
 */
export const sendOrderToSupplier = async (orderId, managerId) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'sent_to_supplier',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select(`
        *,
        supplier:supplier_profiles(
          business_name,
          contact_person_email,
          contact_person_phone
        )
      `)
      .single();

    if (error) throw error;

    // Log communication
    await supabase.from('supplier_communications').insert({
      supplier_id: data.supplier_id,
      communication_type: 'email',
      subject: `Purchase Order ${data.po_number}`,
      description: `Purchase order sent to supplier`,
      initiated_by: 'company',
      company_representative: managerId,
      related_po_id: orderId
    });

    return {
      success: true,
      order: data,
      message: `Order sent to ${data.supplier?.business_name}`
    };
  } catch (error) {
    console.error('Error sending order to supplier:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Mark order as confirmed by supplier
 */
export const confirmOrderBySupplier = async (orderId) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      order: data,
      message: 'Order confirmed by supplier'
    };
  } catch (error) {
    console.error('Error confirming order:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =====================================================================
// DELIVERIES MANAGEMENT
// =====================================================================

/**
 * Get all deliveries
 */
export const getAllDeliveries = async (filters = {}) => {
  try {
    let query = supabase
      .from('supplier_deliveries')
      .select(`
        *,
        purchase_order:purchase_orders(
          po_number,
          total_amount_ugx
        ),
        supplier:supplier_profiles(
          business_name,
          contact_person_name
        ),
        received_by_user:users(
          first_name,
          last_name
        )
      `)
      .order('delivery_date', { ascending: false });

    if (filters.status) {
      query = query.eq('delivery_status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      deliveries: data
    };
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Record new delivery
 */
export const recordDelivery = async (deliveryData) => {
  try {
    const {
      purchaseOrderId,
      supplierId,
      deliveryDate,
      deliveryTime,
      deliveredBySupplier,
      deliveryVehicleNumber,
      receivedBy,
      items,
      qualityCheckStatus,
      qualityCheckNotes,
      conditionOnArrival,
      packagingCondition
    } = deliveryData;

    // Calculate item counts
    const totalOrdered = items.reduce((sum, item) => sum + item.orderedQty, 0);
    const totalDelivered = items.reduce((sum, item) => sum + item.deliveredQty, 0);
    const totalAccepted = items.reduce((sum, item) => sum + item.acceptedQty, 0);
    const totalRejected = items.reduce((sum, item) => sum + item.rejectedQty, 0);

    const { data, error } = await supabase
      .from('supplier_deliveries')
      .insert({
        purchase_order_id: purchaseOrderId,
        supplier_id: supplierId,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime,
        delivered_by_supplier: deliveredBySupplier,
        delivery_vehicle_number: deliveryVehicleNumber,
        received_by: receivedBy,
        items,
        total_items_ordered: totalOrdered,
        total_items_delivered: totalDelivered,
        total_items_accepted: totalAccepted,
        total_items_rejected: totalRejected,
        delivery_status: totalRejected > 0 ? 'partially_delivered' : 'delivered',
        quality_check_status: qualityCheckStatus,
        quality_check_notes: qualityCheckNotes,
        condition_on_arrival: conditionOnArrival,
        packaging_condition: packagingCondition,
        documentation_complete: true
      })
      .select()
      .single();

    if (error) throw error;

    // Update purchase order status
    const newPOStatus = totalDelivered >= totalOrdered ? 'received' : 'partially_received';
    await supabase
      .from('purchase_orders')
      .update({
        status: newPOStatus,
        actual_delivery_date: deliveryDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', purchaseOrderId);

    return {
      success: true,
      delivery: data,
      message: 'Delivery recorded successfully'
    };
  } catch (error) {
    console.error('Error recording delivery:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =====================================================================
// STATISTICS AND ANALYTICS
// =====================================================================

/**
 * Get supplier order statistics
 */
export const getSupplierOrderStats = async () => {
  try {
    // Get counts by status
    const { data: orderStats, error: orderError } = await supabase
      .from('purchase_orders')
      .select('status, total_amount_ugx');

    if (orderError) throw orderError;

    // Get supplier counts
    const { data: supplierData, error: supplierError } = await supabase
      .from('supplier_profiles')
      .select('status');

    if (supplierError) throw supplierError;

    // Get delivery stats
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('supplier_deliveries')
      .select('delivery_status, quality_check_status');

    if (deliveryError) throw deliveryError;

    // Calculate statistics
    const stats = {
      totalOrders: orderStats?.length || 0,
      pendingOrders: orderStats?.filter(o => o.status === 'pending_approval').length || 0,
      approvedOrders: orderStats?.filter(o => o.status === 'approved').length || 0,
      sentOrders: orderStats?.filter(o => o.status === 'sent_to_supplier').length || 0,
      confirmedOrders: orderStats?.filter(o => o.status === 'confirmed').length || 0,
      receivedOrders: orderStats?.filter(o => o.status === 'received').length || 0,
      totalValue: orderStats?.reduce((sum, o) => sum + parseFloat(o.total_amount_ugx || 0), 0) || 0,
      
      totalSuppliers: supplierData?.length || 0,
      activeSuppliers: supplierData?.filter(s => s.status === 'active').length || 0,
      pendingSuppliers: supplierData?.filter(s => s.status === 'pending_approval').length || 0,
      
      totalDeliveries: deliveryData?.length || 0,
      pendingDeliveries: deliveryData?.filter(d => d.delivery_status === 'pending').length || 0,
      completedDeliveries: deliveryData?.filter(d => d.delivery_status === 'delivered').length || 0,
      qualityIssues: deliveryData?.filter(d => d.quality_check_status === 'failed').length || 0
    };

    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('Error fetching supplier stats:', error);
    return {
      success: false,
      error: error.message,
      stats: {
        totalOrders: 0,
        pendingOrders: 0,
        approvedOrders: 0,
        totalValue: 0,
        totalSuppliers: 0,
        activeSuppliers: 0
      }
    };
  }
};

/**
 * Get recent supplier activity
 */
export const getRecentSupplierActivity = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('supplier_activity_log')
      .select(`
        *,
        supplier:supplier_profiles(business_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      success: true,
      activities: data
    };
  } catch (error) {
    console.error('Error fetching supplier activity:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  getAllSuppliers,
  getActiveSuppliers,
  updateSupplierStatus,
  getAllPurchaseOrders,
  getPendingPurchaseOrders,
  createPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  sendOrderToSupplier,
  confirmOrderBySupplier,
  getAllDeliveries,
  recordDelivery,
  getSupplierOrderStats,
  getRecentSupplierActivity
};
