// =====================================================================
// SUPPLIER ORDERS SERVICE - FAREDEAL UGANDA
// =====================================================================
// Manages supplier orders, purchase orders, and deliveries
// Integrates with Supabase for real-time supplier management
// =====================================================================

import { supabase } from './supabase';

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Notify supplier about order events
 * NOTE: notifications table doesn't exist in Supabase
 * Silently skip for now - can be implemented via email or push notifications later
 */
const notifySupplier = async (supplierId, notification) => {
  try {
    console.log('📧 Notification event:', {
      supplier_id: supplierId,
      type: notification.type || 'order_update',
      title: notification.title,
      message: notification.message
    });

    // TODO: Implement notification system:
    // Option 1: Send email notification
    // Option 2: Use push notifications service
    // Option 3: Create notifications table in Supabase

    return { success: true, message: 'Notification logged (table not yet implemented)' };
  } catch (error) {
    console.warn('⚠️ Failed to process notification:', error.message);
    return { success: false, error: error.message };
  }
};

// =====================================================================
// SUPPLIER MANAGEMENT
// =====================================================================

/**
 * Get all supplier profiles with statistics
 */
export const getAllSuppliers = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        purchase_orders(count),
        supplier_invoices(
          balance_due_ugx,
          payment_status
        )
      `)
      .eq('role', 'supplier')
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
    console.log('🔍 Fetching active suppliers from users table...');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'supplier')
      .eq('is_active', true)
      .order('company_name', { ascending: true });

    if (error) throw error;

    console.log('✅ Fetched suppliers:', data);

    // Map to expected format with business_name and supplier_code
    const mappedSuppliers = data.map(supplier => ({
      ...supplier,
      business_name: supplier.company_name || supplier.full_name || supplier.username,
      supplier_code: `SUP-${supplier.id.toString().slice(-6)}` // Generate code from ID
    }));

    return {
      success: true,
      suppliers: mappedSuppliers
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
    // Map status to is_active field
    const isActive = status === 'active';
    
    const { data, error } = await supabase
      .from('users')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierId)
      .eq('role', 'supplier')
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
 * Get all purchase orders with supplier details and payment info
 */
export const getAllPurchaseOrders = async (filters = {}) => {
  try {
    // Get current user to filter by manager
    const { data: { user } } = await supabase.auth.getUser();
    let shouldFilterByManager = false;
    let currentAuthId = null;
    
    if (user) {
      currentAuthId = user.id;
      // Check user's role
      const { data: managerData } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single();
      
      // Only filter by created_by if user is a manager (not admin)
      if (managerData && managerData.role === 'manager') {
        shouldFilterByManager = true;
      }
    }
    
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .order('order_date', { ascending: false });

    // Filter by current manager's internal user ID if they're a manager (not admin)
    if (shouldFilterByManager && user) {
      // Get internal user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();
      
      if (userData?.id) {
        console.log('🔍 Filtering orders by manager ID:', userData.id);
        query = query.eq('ordered_by', userData.id);
      }
    }

    // Apply filters
    if (filters.status) {
      console.log('🔍 Filtering by status:', filters.status);
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }
    if (filters.paymentStatus) {
      query = query.eq('payment_status', filters.paymentStatus);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    console.log(`📦 Fetched ${orders?.length || 0} purchase orders`);

    // Fetch supplier details separately from users table
    const supplierIds = [...new Set(orders.map(o => o.supplier_id).filter(Boolean))];
    
    console.log(`🔍 Looking up ${supplierIds.length} unique suppliers:`, supplierIds);
    
    let suppliers = [];
    if (supplierIds.length > 0) {
      const { data: suppliersData, error: supplierError } = await supabase
        .from('users')
        .select('id, company_name, full_name, username, email, phone, category')
        .eq('role', 'supplier')
        .in('id', supplierIds);
      
      if (supplierError) {
        console.error('❌ Error fetching suppliers:', supplierError);
      } else {
        suppliers = suppliersData || [];
        console.log(`✅ Found ${suppliers.length} suppliers in users table`);
        
        // Log any missing suppliers
        const foundIds = suppliers.map(s => s.id);
        const missingIds = supplierIds.filter(id => !foundIds.includes(id));
        if (missingIds.length > 0) {
          console.warn(`⚠️ Missing supplier data for IDs:`, missingIds);
          console.warn('These orders will show "Unknown Supplier"');
        }
      }
    }

    // Fetch payment metrics for each order (table doesn't exist yet - skip)
    const orderIds = orders.map(o => o.id);
    let metrics = [];
    // if (orderIds.length > 0) {
    //   const { data: metricsData } = await supabase
    //     .from('payment_metrics')
    //     .select('*')
    //     .in('purchase_order_id', orderIds);
    //   metrics = metricsData || [];
    // }

    // Fetch payment installments (table doesn't exist yet - skip)
    let installments = [];
    // if (orderIds.length > 0) {
    //   const { data: installmentsData } = await supabase
    //     .from('payment_installments')
    //     .select('*')
    //     .in('purchase_order_id', orderIds)
    //     .order('installment_number');
    //   installments = installmentsData || [];
    // }

    // Create lookups
    const supplierMap = {};
    suppliers.forEach(s => {
      supplierMap[s.id] = {
        id: s.id,
        name: s.company_name || s.full_name || s.username || `Supplier ${s.id.slice(0, 8)}`,
        company_name: s.company_name,
        full_name: s.full_name,
        email: s.email,
        phone: s.phone,
        // avatar_url: s.avatar_url, // Column doesn't exist in users table
        category: s.category
      };
    });
    
    console.log(`📋 Created supplier map with ${Object.keys(supplierMap).length} entries`);

    const metricsMap = {};
    metrics.forEach(m => {
      metricsMap[m.purchase_order_id] = m;
    });

    const installmentsMap = {};
    installments.forEach(inst => {
      if (!installmentsMap[inst.purchase_order_id]) {
        installmentsMap[inst.purchase_order_id] = [];
      }
      installmentsMap[inst.purchase_order_id].push(inst);
    });

    // Format the data with payment status and metrics
    const formattedOrders = orders.map(order => {
      const supplier = supplierMap[order.supplier_id];
      const metric = metricsMap[order.id];
      // Log if supplier is missing
      if (!supplier && order.supplier_id) {
        console.warn(`⚠️ Order ${order.po_number} references missing supplier:`, order.supplier_id);
      }
      
      return {
        ...order,
        // Supplier info
        supplierName: supplier?.name || (order.supplier_id ? `Supplier ${order.supplier_id.slice(0, 8)}...` : 'No Supplier'),
        supplierCompany: supplier?.company_name,
        supplierEmail: supplier?.email,
        supplierPhone: supplier?.phone,
        // supplierAvatar: supplier?.avatar_url, // Column doesn't exist
        supplierCategory: supplier?.category,
        
        // Payment metrics
        paymentMetrics: metric ? {
          paymentPercentage: metric.payment_percentage || 0,
          totalInstallments: metric.total_installments || 1,
          paidInstallments: metric.paid_installments || 0,
          overdueInstallments: metric.overdue_installments || 0,
          nextPaymentDue: metric.next_payment_due,
          daysUntilNext: metric.days_until_next_payment,
          daysOverdue: metric.days_overdue || 0,
          paymentVelocity: metric.payment_velocity,
          estimatedCompletion: metric.estimated_completion_date
        } : null,
        
        // Installments for this specific order
        installments: installmentsMap[order.id] || [],
        
        // Legacy fields for backward compatibility
        orderedBy: 'Manager',
        approvedBy: order.approved_by ? 'Approved' : null,
        amount_paid: order.amount_paid_ugx || 0,
        balance_due: order.balance_due_ugx || order.total_amount_ugx
      };
    });

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
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .in('status', ['pending_approval', 'approved', 'sent_to_supplier'])
      .order('order_date', { ascending: false });

    if (error) throw error;

    // Fetch supplier details separately
    const supplierIds = [...new Set(orders.map(o => o.supplier_id))];
    const { data: suppliers } = await supabase
      .from('supplier_profiles')
      .select('id, business_name, contact_person_name')
      .in('id', supplierIds);

    // Create supplier lookup
    const supplierMap = {};
    suppliers?.forEach(s => {
      supplierMap[s.id] = s;
    });

    const formattedOrders = orders.map(order => ({
      ...order,
      supplierName: supplierMap[order.supplier_id]?.business_name || 'Unknown Supplier',
      orderedBy: 'Manager',
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
 * Generate unique PO number
 */
const generatePONumber = async () => {
  try {
    // Get count of existing orders to generate sequential number
    const { count, error } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error counting orders:', error);
      // Fallback to timestamp-based number
      return `PO-${Date.now()}`;
    }

    // Generate PO number: PO-YYYYMMDD-XXXX
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const sequence = String((count || 0) + 1).padStart(4, '0');
    
    return `PO-${dateStr}-${sequence}`;
  } catch (err) {
    console.error('Error generating PO number:', err);
    return `PO-${Date.now()}`;
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

    // Generate PO number
    const poNumber = await generatePONumber();

    // Calculate totals - handle both camelCase and snake_case field names
    const subtotal = items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price || item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
    
    const taxRate = 18.0; // 18% VAT for Uganda
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    console.log('📦 Creating Order - Totals:', { subtotal, taxAmount, totalAmount, items });
    console.log('📝 Order Data:', { poNumber, supplierId, orderedBy, priority, status: 'pending_approval' });
    console.log('🔍 Creating order with supplier_id:', supplierId, 'ordered_by:', orderedBy);

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        supplier_id: supplierId,
        order_date: new Date().toISOString(),
        expected_delivery_date: expectedDeliveryDate,
        ordered_by: orderedBy,
        items: items,
        subtotal_ugx: subtotal,
        tax_ugx: taxAmount,
        tax_rate: taxRate,
        total_amount_ugx: totalAmount,
        // Initialize payment fields for new order
        amount_paid_ugx: 0,
        balance_due_ugx: totalAmount,
        payment_status: 'unpaid',
        delivery_address: deliveryAddress,
        delivery_instructions: deliveryInstructions,
        priority: priority || 'normal',
        status: 'pending_approval',
        notes
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error creating purchase order:', error);
      throw error;
    }

    console.log('✅ Purchase order created successfully:', data.po_number);
    console.log('📊 Created order details:', {
      id: data.id,
      po_number: data.po_number,
      supplier_id: data.supplier_id,
      ordered_by: data.ordered_by,
      status: data.status,
      total: data.total_amount_ugx
    });

    // Update inventory to reflect order (deduct from stock if it's a POS order)
    try {
      for (const item of items) {
        const orderedQty = parseFloat(item.quantity) || 0;
        
        if (orderedQty > 0) {
          console.log(`🔄 Processing inventory for product_id ${item.product_id}, qty: ${orderedQty}`);
          
          // Try to find existing inventory record (don't require .single() to succeed)
          const { data: invList, error: listError } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', item.product_id)
            .eq('is_active', true);

          let existingInv = invList && invList.length > 0 ? invList[0] : null;

          if (existingInv) {
            // Deduct ordered quantity from existing stock
            const newQuantity = (existingInv.quantity || 0) - orderedQty;
            const { error: updateError } = await supabase
              .from('inventory')
              .update({
                quantity: newQuantity,
                last_updated: new Date().toISOString()
              })
              .eq('id', existingInv.id);
            
            if (updateError) {
              console.error('❌ Error updating inventory:', updateError);
            } else {
              console.log(`📉 Inventory deducted for product ${item.product_id}: ${existingInv.quantity} → ${newQuantity} units (Order: ${data.po_number})`);
            }
          } else {
            // No inventory record exists - create one with deducted balance
            // This happens for newly added POS products
            const { data: product } = await supabase
              .from('products')
              .select('id, name')
              .eq('id', item.product_id)
              .single();
            
            if (product) {
              const { data: newInv, error: insertError } = await supabase
                .from('inventory')
                .insert({
                  product_id: item.product_id,
                  quantity: -orderedQty, // Negative quantity to reflect backorder
                  minimum_stock: 10,
                  reorder_point: 20,
                  is_active: true,
                  last_updated: new Date().toISOString()
                })
                .select('id');
              
              if (insertError) {
                console.error('❌ Error creating inventory record:', insertError);
              } else {
                console.log(`📝 ✅ New inventory record created for product "${product.name}" (ID: ${product.id}), quantity: -${orderedQty} units (Order: ${data.po_number})`);
              }
            }
          }
        }
      }
    } catch (invError) {
      console.error('❌ Error processing inventory:', invError);
      // Don't fail order creation if inventory update fails
    }

    // Notify the supplier about new order (don't block on this)
    try {
      await notifySupplier(supplierId, {
        type: 'new_order',
        title: '📦 New Purchase Order',
        message: `You have a new purchase order ${data.po_number} pending approval`,
        orderId: data.id,
        poNumber: data.po_number
      });
    } catch (notifyError) {
      console.warn('⚠️ Failed to notify supplier:', notifyError);
      // Don't fail the order creation if notification fails
    }

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

    console.log('✅ Purchase order approved:', data.po_number);

    // Notify the supplier about approval
    try {
      await notifySupplier(data.supplier_id, {
        type: 'order_approved',
        title: '✅ Order Approved',
        message: `Purchase order ${data.po_number} has been approved`,
        orderId: data.id,
        poNumber: data.po_number
      });
    } catch (notifyError) {
      console.warn('⚠️ Failed to notify supplier about approval:', notifyError);
    }

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
      .select('*')
      .single();

    if (error) throw error;

    // Get supplier info
    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('business_name')
      .eq('id', data.supplier_id)
      .single();

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
      message: `Order sent to ${supplier?.business_name || 'supplier'}`
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
      .select('*')
      .order('delivery_date', { ascending: false });

    if (filters.status) {
      query = query.eq('delivery_status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      success: true,
      deliveries: data || []
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

    // Update inventory for each delivered item
    try {
      for (const item of items) {
        const acceptedQty = item.acceptedQty || 0;
        
        if (acceptedQty > 0) {
          // Try to update existing inventory record
          const { data: existingInv, error: existingError } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', item.product_id || item.productId)
            .eq('is_active', true)
            .single();

          if (existingInv) {
            // Update existing inventory
            const newQuantity = (existingInv.quantity || 0) + acceptedQty;
            await supabase
              .from('inventory')
              .update({
                quantity: newQuantity,
                last_updated: new Date().toISOString()
              })
              .eq('id', existingInv.id);
            
            console.log(`✅ Updated inventory for product ${item.product_id}: +${acceptedQty} units`);
          } else {
            // Create new inventory record if not exists
            await supabase
              .from('inventory')
              .insert({
                product_id: item.product_id || item.productId,
                quantity: acceptedQty,
                minimum_stock: 10,
                reorder_point: 20,
                is_active: true,
                last_updated: new Date().toISOString()
              });
            
            console.log(`✅ Created new inventory record for product ${item.product_id}: ${acceptedQty} units`);
          }
        }
      }
    } catch (invError) {
      console.warn('⚠️ Warning: Inventory update failed (table may not exist):', invError.message);
      // Don't fail the delivery if inventory update fails
    }

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
 * Get supplier order statistics including payment info
 */
export const getSupplierOrderStats = async () => {
  try {
    // Get counts by status
    const { data: orderStats, error: orderError } = await supabase
      .from('purchase_orders')
      .select('status, total_amount_ugx');

    if (orderError) throw orderError;

    // Get supplier counts (removed status field - column doesn't exist)
    const { data: supplierData, error: supplierError } = await supabase
      .from('supplier_profiles')
      .select('id');

    if (supplierError) {
      console.error('⚠️ Error fetching supplier stats (table may not exist):', supplierError);
      // Continue with empty supplier data - don't redeclare
      // supplierData is already declared from const above
    }

    // Get delivery stats
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('supplier_deliveries')
      .select('delivery_status, quality_check_status');

    if (deliveryError) throw deliveryError;

    // Get payment/invoice stats
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('supplier_invoices')
      .select('payment_status, balance_due_ugx, amount_paid_ugx');

    if (invoiceError) throw invoiceError;

    // Calculate statistics
    const stats = {
      totalOrders: orderStats?.length || 0,
      pendingOrders: orderStats?.filter(o => o.status === 'pending_approval').length || 0,
      approvedOrders: orderStats?.filter(o => o.status === 'approved').length || 0,
      sentOrders: orderStats?.filter(o => o.status === 'sent_to_supplier').length || 0,
      confirmedOrders: orderStats?.filter(o => o.status === 'confirmed').length || 0,
      receivedOrders: orderStats?.filter(o => o.status === 'received').length || 0,
      completedOrders: orderStats?.filter(o => o.status === 'completed').length || 0,
      totalValue: orderStats?.reduce((sum, o) => sum + parseFloat(o.total_amount_ugx || 0), 0) || 0,
      
      totalSuppliers: supplierData?.length || 0,
      // activeSuppliers: supplierData?.filter(s => s.status === 'active').length || 0, // status column doesn't exist
      // pendingSuppliers: supplierData?.filter(s => s.status === 'pending_approval').length || 0, // status column doesn't exist
      
      totalDeliveries: deliveryData?.length || 0,
      pendingDeliveries: deliveryData?.filter(d => d.delivery_status === 'pending').length || 0,
      completedDeliveries: deliveryData?.filter(d => d.delivery_status === 'delivered').length || 0,
      qualityIssues: deliveryData?.filter(d => d.quality_check_status === 'failed').length || 0,

      // Payment statistics
      paidOrders: invoiceData?.filter(i => i.payment_status === 'paid').length || 0,
      unpaidOrders: invoiceData?.filter(i => i.payment_status === 'unpaid').length || 0,
      partiallyPaidOrders: invoiceData?.filter(i => i.payment_status === 'partially_paid').length || 0,
      overdueOrders: invoiceData?.filter(i => i.payment_status === 'overdue').length || 0,
      totalPaidAmount: invoiceData?.reduce((sum, i) => sum + parseFloat(i.amount_paid_ugx || 0), 0) || 0,
      totalOutstanding: invoiceData?.reduce((sum, i) => sum + parseFloat(i.balance_due_ugx || 0), 0) || 0
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
        activeSuppliers: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        partiallyPaidOrders: 0
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

// =====================================================================
// ORDER HISTORY MANAGEMENT
// =====================================================================

/**
 * Get order history (completed and cancelled orders)
 */
export const getOrderHistory = async (filters = {}) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .in('status', ['completed', 'cancelled', 'received'])
      .order('order_date', { ascending: false });

    // Apply filters
    if (filters.startDate) {
      query = query.gte('order_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('order_date', filters.endDate);
    }
    if (filters.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    // Fetch supplier details
    const supplierIds = [...new Set(orders.map(o => o.supplier_id))];
    const { data: suppliers } = await supabase
      .from('supplier_profiles')
      .select('id, business_name')
      .in('id', supplierIds);

    // Fetch invoice details
    const orderIds = orders.map(o => o.id);
    const { data: invoices } = await supabase
      .from('supplier_invoices')
      .select('purchase_order_id, payment_status, balance_due_ugx, amount_paid_ugx')
      .in('purchase_order_id', orderIds);

    // Create lookups
    const supplierMap = {};
    suppliers?.forEach(s => {
      supplierMap[s.id] = s;
    });

    const invoiceMap = {};
    invoices?.forEach(inv => {
      invoiceMap[inv.purchase_order_id] = inv;
    });

    // Format the data
    const formattedOrders = orders.map(order => {
      const invoice = invoiceMap[order.id];
      return {
        ...order,
        supplierName: supplierMap[order.supplier_id]?.business_name || 'Unknown Supplier',
        payment_status: invoice?.payment_status || 'unpaid',
        amount_paid: invoice?.amount_paid_ugx || 0,
        balance_due: invoice?.balance_due_ugx || order.total_amount_ugx
      };
    });

    return {
      success: true,
      orders: formattedOrders
    };
  } catch (error) {
    console.error('Error fetching order history:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =====================================================================
// PAYMENT MANAGEMENT
// =====================================================================

/**
 * Get orders by payment status
 */
export const getOrdersByPaymentStatus = async (paymentStatus) => {
  try {
    // Get current user to filter by manager
    const { data: { user } } = await supabase.auth.getUser();
    let shouldFilterByManager = false;
    let currentAuthId = null;
    
    if (user) {
      currentAuthId = user.id;
      // Check user's role
      const { data: managerData } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single();
      
      // Only filter by created_by if user is a manager (not admin)
      if (managerData && managerData.role === 'manager') {
        shouldFilterByManager = true;
      }
    }
    
    // Query purchase_orders directly with payment_status
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .eq('payment_status', paymentStatus)
      .order('order_date', { ascending: false });
    
    // Filter by current manager's internal user ID if they're a manager (not admin)
    if (shouldFilterByManager && user) {
      // Get internal user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();
      
      if (userData?.id) {
        query = query.eq('ordered_by', userData.id);
      }
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      return { success: true, orders: [] };
    }

    // Get supplier details
    const supplierIds = [...new Set(orders.map(o => o.supplier_id).filter(Boolean))];
    let suppliers = [];
    
    if (supplierIds.length > 0) {
      const { data: suppliersData } = await supabase
        .from('users')
        .select('id, company_name, full_name, username')
        .eq('role', 'supplier')
        .in('id', supplierIds);
      suppliers = suppliersData || [];
    }

    // Create lookups
    const supplierMap = {};
    suppliers.forEach(s => {
      supplierMap[s.id] = {
        name: s.company_name || s.full_name || s.username || 'Unknown Supplier'
      };
    });

    // Format the data
    const formattedOrders = orders.map(order => {
      return {
        ...order,
        supplierName: supplierMap[order.supplier_id]?.name || 'Unknown Supplier',
        payment_status: order.payment_status || 'unpaid',
        amount_paid: order.amount_paid_ugx || 0,
        balance_due: order.balance_due_ugx || order.total_amount_ugx
      };
    });

    return {
      success: true,
      orders: formattedOrders
    };
  } catch (error) {
    console.error('Error fetching orders by payment status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Record payment for an order
 */
export const recordOrderPayment = async (orderId, paymentData) => {
  try {
    const {
      amountPaid,
      paymentMethod,
      paymentReference,
      paymentNotes,
      paidBy
    } = paymentData;

    // Get the purchase order
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('id, total_amount_ugx, supplier_id')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    // Get or create invoice
    let { data: invoice, error: invoiceError } = await supabase
      .from('supplier_invoices')
      .select('*')
      .eq('purchase_order_id', orderId)
      .maybeSingle();

    if (invoiceError) throw invoiceError;

    if (!invoice) {
      // Create new invoice if it doesn't exist
      const { data: newInvoice, error: createError } = await supabase
        .from('supplier_invoices')
        .insert({
          supplier_id: order.supplier_id,
          purchase_order_id: orderId,
          invoice_number: `INV-${Date.now()}`,
          invoice_date: new Date().toISOString().split('T')[0],
          total_amount_ugx: order.total_amount_ugx,
          balance_due_ugx: order.total_amount_ugx,
          payment_status: 'unpaid'
        })
        .select()
        .single();

      if (createError) throw createError;
      invoice = newInvoice;
    }

    // Calculate new payment status
    const currentPaid = parseFloat(invoice.amount_paid_ugx || 0);
    const newTotalPaid = currentPaid + parseFloat(amountPaid);
    const totalAmount = parseFloat(invoice.total_amount_ugx);
    const newBalance = totalAmount - newTotalPaid;

    let newPaymentStatus;
    if (newBalance <= 0) {
      newPaymentStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newPaymentStatus = 'partially_paid';
    } else {
      newPaymentStatus = 'unpaid';
    }

    // Update invoice
    const { error: updateError } = await supabase
      .from('supplier_invoices')
      .update({
        amount_paid_ugx: newTotalPaid,
        balance_due_ugx: newBalance > 0 ? newBalance : 0,
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoice.id);

    if (updateError) throw updateError;

    // Record payment transaction
    const { error: paymentError } = await supabase
      .from('supplier_payments')
      .insert({
        supplier_id: order.supplier_id,
        invoice_id: invoice.id,
        payment_date: new Date().toISOString().split('T')[0],
        amount_paid_ugx: amountPaid,
        payment_method: paymentMethod || 'bank_transfer',
        payment_reference: paymentReference,
        notes: paymentNotes,
        paid_by: paidBy,
        status: 'approved'
      });

    if (paymentError) throw paymentError;

    return {
      success: true,
      message: `Payment recorded successfully. Status: ${newPaymentStatus}`,
      paymentStatus: newPaymentStatus,
      amountPaid: newTotalPaid,
      balanceDue: newBalance > 0 ? newBalance : 0
    };
  } catch (error) {
    console.error('Error recording payment:', error);
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
  getRecentSupplierActivity,
  getOrderHistory,
  getOrdersByPaymentStatus,
  recordOrderPayment
};
