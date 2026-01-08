/*
==============================================================================
PURCHASE ORDER & PRODUCT AUTOMATION SERVICE - COMMENTED OUT
==============================================================================

THIS FEATURE HAS BEEN DISABLED:
- Auto-approval workflow for trusted suppliers
- Automatic product creation upon approval
- Purchase order management system

To re-enable: Remove comment markers and restart the application

/**
 * Purchase Order & Product Automation Service
 * 
 * This service handles:
 * - Creating purchase orders from suppliers
 * - Auto-approval workflow for trusted suppliers
 * - Automatic product creation upon approval
 * - Stock updates after delivery
 * - Order tracking and notifications
 */

import { supabase } from './supabase';
import inventoryService from './inventorySupabaseService';
import { toast } from 'react-toastify';

class PurchaseOrderService {
  constructor() {
    this.autoApprovalThreshold = 1000000; // UGX - orders below this auto-approve
    this.trustedSupplierRating = 4.5; // Suppliers above this rating get auto-approval
  }

  /**
   * Create a purchase order with optional auto-approval
   * @param {Object} orderData - Purchase order details
   * @returns {Promise<Object>} Created order with approval status
   */
  async createPurchaseOrder(orderData) {
    try {
      const {
        supplier_id,
        items, // Array of { product_name, quantity, unit_price, product_data }
        notes,
        expected_delivery_date
      } = orderData;

      // Calculate total
      const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // Check if supplier is trusted for auto-approval
      const { data: supplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('company_name, rating, is_verified, auto_approve_orders')
        .eq('id', supplier_id)
        .single();

      if (supplierError) throw supplierError;

      // Determine approval status
      const shouldAutoApprove = this.shouldAutoApprove(supplier, total_amount);
      const approval_status = shouldAutoApprove ? 'approved' : 'pending';

      // Create purchase order
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id,
          order_date: new Date().toISOString(),
          expected_delivery_date,
          total_amount,
          status: approval_status === 'approved' ? 'processing' : 'pending',
          approval_status,
          approved_by: approval_status === 'approved' ? 'auto_approval_system' : null,
          approved_at: approval_status === 'approved' ? new Date().toISOString() : null,
          notes: notes || `Order from ${supplier.company_name}`,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        purchase_order_id: order.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        product_data: item.product_data || null // Store product details for later creation
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // If auto-approved, trigger product creation
      if (shouldAutoApprove) {
        await this.processApprovedOrder(order.id, items);
        toast.success(`✅ Order auto-approved! Products will be created automatically.`);
      } else {
        toast.info(`📋 Purchase order created. Awaiting manager approval.`);
      }

      return {
        ...order,
        items: orderItems,
        supplier: supplier.company_name,
        auto_approved: shouldAutoApprove
      };

    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error('Failed to create purchase order: ' + error.message);
      throw error;
    }
  }

  /**
   * Determine if order should be auto-approved
   * @param {Object} supplier - Supplier data
   * @param {number} totalAmount - Order total amount
   * @returns {boolean} Should auto-approve
   */
  shouldAutoApprove(supplier, totalAmount) {
    // Auto-approve if:
    // 1. Supplier has auto-approve flag enabled
    if (supplier.auto_approve_orders === true) return true;

    // 2. Supplier is verified AND highly rated AND order is below threshold
    if (
      supplier.is_verified &&
      supplier.rating >= this.trustedSupplierRating &&
      totalAmount <= this.autoApprovalThreshold
    ) {
      return true;
    }

    return false;
  }

  /**
   * Process approved order - create products if they don't exist
   * @param {string} orderId - Purchase order ID
   * @param {Array} items - Order items with product data
   */
  async processApprovedOrder(orderId, items) {
    try {
      console.log(`🔄 Processing approved order ${orderId}...`);

      for (const item of items) {
        if (item.product_data) {
          // Check if product already exists
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id, name')
            .eq('sku', item.product_data.sku)
            .single();

          if (!existingProduct) {
            // Create new product automatically
            console.log(`📦 Auto-creating product: ${item.product_name}`);
            await inventoryService.createProduct({
              ...item.product_data,
              initial_stock: 0 // Stock will be added on delivery
            });
            console.log(`✅ Product "${item.product_name}" created automatically`);
          } else {
            console.log(`ℹ️ Product "${item.product_name}" already exists, will update stock on delivery`);
          }
        }
      }

      // Update order status
      await supabase
        .from('purchase_orders')
        .update({ 
          status: 'processing',
          notes: 'Auto-approved and products created/verified'
        })
        .eq('id', orderId);

      return true;

    } catch (error) {
      console.error('Error processing approved order:', error);
      throw error;
    }
  }

  /**
   * Manually approve a pending purchase order
   * @param {string} orderId - Purchase order ID
   * @param {string} approvedBy - User who approved
   */
  async approvePurchaseOrder(orderId, approvedBy = 'manager') {
    try {
      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_items (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      if (order.approval_status === 'approved') {
        toast.info('Order is already approved');
        return order;
      }

      // Update order status
      const { data: updatedOrder, error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          approval_status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          status: 'processing'
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Process the order (create products)
      await this.processApprovedOrder(orderId, order.purchase_order_items);

      toast.success(`✅ Purchase order approved! Products will be created.`);
      return updatedOrder;

    } catch (error) {
      console.error('Error approving purchase order:', error);
      toast.error('Failed to approve order: ' + error.message);
      throw error;
    }
  }
*/

  /**
   * Mark order as delivered and update stock
   * @param {string} orderId - Purchase order ID
   * @param {Array} deliveredItems - Items with actual delivered quantities
   */
  async markOrderDelivered(orderId, deliveredItems) {
    try {
      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_items (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Update each product's stock
      for (const deliveredItem of deliveredItems) {
        const orderItem = order.purchase_order_items.find(
          item => item.id === deliveredItem.order_item_id
        );

        if (!orderItem) continue;

        // Find product by name or SKU
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .or(`name.eq.${orderItem.product_name},sku.eq.${orderItem.product_data?.sku}`)
          .single();

        if (product) {
          // Add stock using inventory service
          await inventoryService.updateStock(
            product.id,
            deliveredItem.delivered_quantity,
            `Delivery from PO #${orderId.substring(0, 8)}`
          );

          console.log(`✅ Added ${deliveredItem.delivered_quantity} units to ${orderItem.product_name}`);
        }
      }

      // Update order status
      const { data: updatedOrder, error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'completed',
          delivery_date: new Date().toISOString(),
          notes: order.notes + ' | Delivered and stock updated'
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) throw updateError;

      toast.success(`✅ Order marked as delivered! Stock has been updated.`);
      return updatedOrder;

    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast.error('Failed to mark order as delivered: ' + error.message);
      throw error;
    }
  }

  /**
   * Get all purchase orders with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Purchase orders
   */
  // DISABLED: getPurchaseOrders - Feature commented out
  // async getPurchaseOrders(filters = {}) { ... }

  /**
   * Get pending purchase orders awaiting approval
   * @returns {Promise<Array>} Pending orders
   */
  // DISABLED: getPendingOrders - Feature commented out
  // async getPendingOrders() { ... }

  /**
   * Subscribe to purchase order changes
   * @param {Function} callback - Callback when orders change
   * @returns {Function} Unsubscribe function
   */
  // DISABLED: subscribeToPurchaseOrders - Feature commented out
  // subscribeToPurchaseOrders(callback) { ... }
}

// Export stub instance - Service Disabled
const purchaseOrderService = {
  createPurchaseOrder: () => console.warn('⚠️ Purchase Order Service is disabled'),
  approvePurchaseOrder: () => console.warn('⚠️ Purchase Order Service is disabled'),
  markOrderDelivered: () => console.warn('⚠️ Purchase Order Service is disabled'),
  getPurchaseOrders: () => [],
  getPendingOrders: () => [],
  subscribeToPurchaseOrders: () => () => {}
};

export default purchaseOrderService;
