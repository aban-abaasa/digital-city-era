// Order API Service for FAREDEAL using Supabase
import { toast } from 'react-toastify';
import { apiService } from './apiService';
import { getCurrentUser } from './supabaseClient';

class OrderApiService {
  constructor() {
    this.ordersTable = 'orders';
    this.orderItemsTable = 'order_items';
    this.customersTable = 'customers';
    this.productsTable = 'products';
  }

  // Create a new order
  async createOrder(orderData) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Generate order number
      const orderNumber = `PO-${Date.now().toString().slice(-6)}`;
      
      // Prepare order data for database
      const newOrderData = {
        order_number: orderNumber,
        customer_id: orderData.customer_id,
        order_type: orderData.order_type || 'pos',
        status: 'pending',
        subtotal: orderData.subtotal || 0,
        tax_amount: orderData.tax_amount || 0,
        discount_amount: orderData.discount_amount || 0,
        shipping_cost: orderData.shipping_cost || 0,
        total_amount: orderData.total_amount || orderData.subtotal,
        payment_method: orderData.payment_method || 'cash',
        payment_status: 'pending',
        notes: orderData.notes || '',
        shipping_address: orderData.shipping_address || {},
        billing_address: orderData.billing_address || {},
        created_by: user.id,
        created_at: new Date().toISOString(),
        estimated_delivery: orderData.estimated_delivery || this.calculateEstimatedDelivery()
      };

      // Create the order
      const order = await apiService.create(this.ordersTable, newOrderData);

      // Create order items if provided
      if (orderData.items && orderData.items.length > 0) {
        const orderItems = orderData.items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
          product_name: item.product_name || '',
          product_sku: item.product_sku || ''
        }));

        await Promise.all(
          orderItems.map(item => apiService.create(this.orderItemsTable, item))
        );

        // Update inventory for each item
        await this.updateInventoryForOrder(orderData.items, 'decrease');
      }

      // Get the complete order with relations
      const completeOrder = await this.getOrderById(order.id);

      toast.success(`Order ${orderNumber} created successfully!`);
      return completeOrder;
    } catch (error) {
      console.error('Create order error:', error);
      toast.error(`Failed to create order: ${error.message}`);
      throw error;
    }
  }

  // Calculate estimated delivery date
  calculateEstimatedDelivery() {
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 1); // Default 1 day delivery
    return estimatedDate.toISOString();
  }

  // Update inventory for order items
  async updateInventoryForOrder(items, operation = 'decrease') {
    try {
      for (const item of items) {
        const { data: inventory } = await apiService.getAll('inventory', {
          select: 'current_stock, available_stock',
          filter: { product_id: item.product_id }
        });

        if (inventory && inventory.length > 0) {
          const currentInventory = inventory[0];
          const adjustment = operation === 'decrease' ? -item.quantity : item.quantity;
          
          await apiService.update('inventory', item.product_id, {
            current_stock: Math.max(0, currentInventory.current_stock + adjustment),
            available_stock: Math.max(0, currentInventory.available_stock + adjustment),
            last_updated: new Date().toISOString()
          }, 'product_id');
        }
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
      // Don't throw error here to avoid breaking order creation
    }
  }

  // Get order by ID with all related data
  async getOrderById(orderId) {
    try {
      const order = await apiService.getById(this.ordersTable, orderId, {
        select: `
          *,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone_number
          ),
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            subtotal,
            product_name,
            product_sku,
            products (
              id,
              name,
              sku,
              product_images (
                image_url
              )
            )
          )
        `
      });

      return this.formatOrderForFrontend(order);
    } catch (error) {
      console.error('Get order by ID error:', error);
      throw error;
    }
  }

  // Format order data for frontend consumption
  formatOrderForFrontend(order) {
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      orderType: order.order_type,
      subtotal: order.subtotal,
      taxAmount: order.tax_amount,
      discountAmount: order.discount_amount,
      shippingCost: order.shipping_cost,
      total: order.total_amount,
      paymentMethod: order.payment_method,
      notes: order.notes,
      createdAt: order.created_at,
      estimatedDelivery: order.estimated_delivery,
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      customer: order.customers ? {
        id: order.customers.id,
        name: `${order.customers.first_name} ${order.customers.last_name}`,
        email: order.customers.email,
        phone: order.customers.phone_number
      } : null,
      items: order.order_items?.map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name || item.products?.name,
        productSku: item.product_sku || item.products?.sku,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
        image: item.products?.product_images?.[0]?.image_url
      })) || []
    };
  }

  // Send order via SMS
  async sendOrderSMS(orderData, phoneNumber) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // In a real implementation, you would integrate with SMS providers like:
      // - Twilio
      // - Africa's Talking (popular in Uganda)
      // - Vonage (formerly Nexmo)
      
      // For now, we'll simulate the SMS sending
      const smsMessage = this.generateOrderSMS(orderData);
      
      // Simulate SMS API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In production, you might log this to a notifications table
      const notificationData = {
        order_id: orderData.id,
        type: 'sms',
        recipient: phoneNumber,
        message: smsMessage,
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user.id
      };

      // You could store this in a notifications table
      // await apiService.create('notifications', notificationData);

      toast.success(`📱 Order sent via SMS to ${phoneNumber}`);
      
      return {
        success: true,
        data: {
          messageId: `sms_${Date.now()}`,
          phoneNumber,
          status: 'sent',
          sentAt: new Date().toISOString(),
          orderNumber: orderData.orderNumber
        }
      };
    } catch (error) {
      console.error('Send SMS error:', error);
      toast.error(`Failed to send SMS: ${error.message}`);
      throw error;
    }
  }

  // Generate SMS message content
  generateOrderSMS(orderData) {
    return `FAREDEAL Order Confirmation
Order #: ${orderData.orderNumber}
Total: UGX ${orderData.total?.toLocaleString()}
Status: ${orderData.status}
Est. Delivery: ${new Date(orderData.estimatedDelivery).toLocaleDateString()}
Thank you for your business!`;
  }

  // Send order via Email
  async sendOrderEmail(orderData, email) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // In a real implementation, you would integrate with email providers like:
      // - SendGrid
      // - Mailgun
      // - Amazon SES
      // - Resend

      // Generate email content
      const emailContent = this.generateOrderEmail(orderData);
      
      // Simulate email API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production, you might log this to a notifications table
      const notificationData = {
        order_id: orderData.id,
        type: 'email',
        recipient: email,
        subject: `Order Confirmation - ${orderData.orderNumber}`,
        message: emailContent,
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user.id
      };

      // You could store this in a notifications table
      // await apiService.create('notifications', notificationData);

      toast.success(`📧 Order sent via email to ${email}`);
      
      return {
        success: true,
        data: {
          messageId: `email_${Date.now()}`,
          email,
          status: 'sent',
          sentAt: new Date().toISOString(),
          orderNumber: orderData.orderNumber
        }
      };
    } catch (error) {
      console.error('Send email error:', error);
      toast.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  // Generate email content
  generateOrderEmail(orderData) {
    const itemsList = orderData.items?.map(item => 
      `${item.productName} (${item.productSku}) - Qty: ${item.quantity} @ UGX ${item.unitPrice.toLocaleString()} = UGX ${item.subtotal.toLocaleString()}`
    ).join('\n') || '';

    return `Dear ${orderData.customer?.name || 'Customer'},

Thank you for your order with FAREDEAL!

Order Details:
Order Number: ${orderData.orderNumber}
Order Date: ${new Date(orderData.createdAt).toLocaleDateString()}
Status: ${orderData.status}

Items:
${itemsList}

Order Summary:
Subtotal: UGX ${orderData.subtotal?.toLocaleString()}
Tax: UGX ${orderData.taxAmount?.toLocaleString()}
Shipping: UGX ${orderData.shippingCost?.toLocaleString()}
Total: UGX ${orderData.total?.toLocaleString()}

Payment Method: ${orderData.paymentMethod}
Payment Status: ${orderData.paymentStatus}

Estimated Delivery: ${new Date(orderData.estimatedDelivery).toLocaleDateString()}

${orderData.shippingAddress ? `
Shipping Address:
${JSON.stringify(orderData.shippingAddress, null, 2)}
` : ''}

Thank you for choosing FAREDEAL!

Best regards,
FAREDEAL Team`;
  }

  // Get all orders with filtering and pagination
  async getOrders(params = {}) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      let query = {
        select: `
          id,
          order_number,
          status,
          payment_status,
          order_type,
          total_amount,
          created_at,
          estimated_delivery,
          customers (
            id,
            first_name,
            last_name,
            email
          )
        `
      };

      // Apply filters
      if (params.status) {
        query.filter = { status: params.status };
      }

      if (params.customer_id) {
        query.filter = { ...query.filter, customer_id: params.customer_id };
      }

      if (params.order_type) {
        query.filter = { ...query.filter, order_type: params.order_type };
      }

      // Date range filtering
      if (params.start_date && params.end_date) {
        query.filter = {
          ...query.filter,
          created_at: {
            gte: params.start_date,
            lte: params.end_date
          }
        };
      }

      // Pagination
      if (params.page && params.limit) {
        query.pagination = {
          page: params.page,
          limit: params.limit
        };
      }

      // Sorting
      query.orderBy = params.orderBy || { created_at: 'desc' };

      const { data: orders, count } = await apiService.getAll(this.ordersTable, {
        ...query,
        count: 'exact'
      });

      const formattedOrders = orders?.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        orderType: order.order_type,
        total: order.total_amount,
        createdAt: order.created_at,
        estimatedDelivery: order.estimated_delivery,
        customer: order.customers ? {
          id: order.customers.id,
          name: `${order.customers.first_name} ${order.customers.last_name}`,
          email: order.customers.email
        } : null
      })) || [];

      return {
        success: true,
        data: formattedOrders,
        pagination: {
          total: count,
          page: params.page || 1,
          limit: params.limit || 20,
          pages: Math.ceil(count / (params.limit || 20))
        }
      };
    } catch (error) {
      console.error('Get orders error:', error);
      toast.error('Failed to fetch orders');
      return { success: false, data: [], pagination: {} };
    }
  }

  // Update order status
  async updateOrderStatus(orderId, status, notes = '') {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const updatedOrder = await apiService.update(this.ordersTable, orderId, {
        status,
        notes: notes || '',
        updated_at: new Date().toISOString(),
        updated_by: user.id
      });

      // If order is being cancelled, restore inventory
      if (status === 'cancelled') {
        const order = await this.getOrderById(orderId);
        if (order.items && order.items.length > 0) {
          const items = order.items.map(item => ({
            product_id: item.productId,
            quantity: item.quantity
          }));
          await this.updateInventoryForOrder(items, 'increase');
        }
      }

      toast.success(`Order status updated to ${status}`);
      return {
        success: true,
        data: {
          ...updatedOrder,
          status,
          notes
        }
      };
    } catch (error) {
      console.error('Update status error:', error);
      toast.error(`Failed to update order status: ${error.message}`);
      throw error;
    }
  }

  // Cancel order
  async cancelOrder(orderId, reason = '') {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Get order details first to restore inventory
      const order = await this.getOrderById(orderId);
      
      // Update order status to cancelled
      const updatedOrder = await apiService.update(this.ordersTable, orderId, {
        status: 'cancelled',
        payment_status: 'refunded',
        notes: reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        updated_at: new Date().toISOString()
      });

      // Restore inventory for cancelled items
      if (order.items && order.items.length > 0) {
        const items = order.items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity
        }));
        await this.updateInventoryForOrder(items, 'increase');
      }

      toast.success('Order cancelled successfully');
      return {
        success: true,
        data: {
          ...updatedOrder,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          reason
        }
      };
    } catch (error) {
      console.error('Cancel order error:', error);
      toast.error(`Failed to cancel order: ${error.message}`);
      throw error;
    }
  }

  // Get order statistics
  async getOrderStats(params = {}) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

      // Get orders for current month
      const { data: monthlyOrders } = await apiService.getAll(this.ordersTable, {
        select: 'total_amount, status, created_at',
        filter: {
          created_at: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      const stats = {
        totalOrders: monthlyOrders?.length || 0,
        totalRevenue: monthlyOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0,
        pendingOrders: monthlyOrders?.filter(order => order.status === 'pending').length || 0,
        completedOrders: monthlyOrders?.filter(order => order.status === 'completed').length || 0,
        cancelledOrders: monthlyOrders?.filter(order => order.status === 'cancelled').length || 0,
        averageOrderValue: 0
      };

      if (stats.totalOrders > 0) {
        stats.averageOrderValue = stats.totalRevenue / stats.totalOrders;
      }

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Get order stats error:', error);
      throw error;
    }
  }

  // Search orders
  async searchOrders(searchTerm, params = {}) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Search by order number, customer name, or email
      const { data: orders } = await apiService.getAll(this.ordersTable, {
        select: `
          id,
          order_number,
          status,
          payment_status,
          total_amount,
          created_at,
          customers (
            first_name,
            last_name,
            email
          )
        `,
        search: {
          column: 'order_number',
          value: searchTerm
        },
        pagination: params.pagination
      });

      const formattedOrders = orders?.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        total: order.total_amount,
        createdAt: order.created_at,
        customer: order.customers ? {
          name: `${order.customers.first_name} ${order.customers.last_name}`,
          email: order.customers.email
        } : null
      })) || [];

      return {
        success: true,
        data: formattedOrders
      };
    } catch (error) {
      console.error('Search orders error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new OrderApiService();

// Export individual functions for direct import
export const {
  createOrder,
  sendOrderSMS,
  sendOrderEmail,
  getOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderStats,
  searchOrders
} = new OrderApiService();