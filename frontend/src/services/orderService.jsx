import { apiService } from './apiService';
import { supabase, handleSupabaseError } from './supabaseClient';

export const orderService = {
  // Create a new customer order
  createOrder: async (orderData) => {
    try {
      // Start a transaction-like operation
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: orderData.customer_id,
          order_number: orderData.order_number || `ORD-${Date.now()}`,
          order_date: new Date().toISOString(),
          status: 'pending',
          source: orderData.source || 'online',
          total_amount: orderData.total_amount,
          subtotal: orderData.subtotal,
          tax_amount: orderData.tax_amount,
          discount_amount: orderData.discount_amount || 0,
          shipping_amount: orderData.shipping_amount || 0,
          delivery_address: orderData.delivery_address,
          delivery_instructions: orderData.delivery_instructions,
          expected_delivery_date: orderData.expected_delivery_date,
          notes: orderData.notes
        })
        .select()
        .single();

      if (orderError) throw handleSupabaseError(orderError);

      // Create order items
      if (orderData.items && orderData.items.length > 0) {
        const orderItems = orderData.items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw handleSupabaseError(itemsError);
      }

      return order;
    } catch (error) {
      throw error;
    }
  },

  // Get order by ID
  getOrder: async (id) => {
    try {
      const order = await apiService.getById('orders', id, {
        select: `
          *,
          customers (
            id,
            full_name,
            phone,
            email
          ),
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products (
              id,
              name,
              sku
            )
          ),
          order_payments (
            id,
            payment_method,
            amount,
            status,
            transaction_id,
            payment_date
          ),
          order_status_history (
            id,
            status,
            changed_at,
            notes
          )
        `
      });

      return order;
    } catch (error) {
      throw error;
    }
  },

  // Update order status
  updateOrderStatus: async (id, status, notes = null) => {
    try {
      // Update the order
      const order = await apiService.put('orders', id, { 
        status: status,
        updated_at: new Date().toISOString()
      });

      // Add status history entry
      await apiService.post('order_status_history', {
        order_id: id,
        status: status,
        changed_at: new Date().toISOString(),
        notes: notes
      });

      return order;
    } catch (error) {
      throw error;
    }
  },

  // Process payment for order
  processPayment: async (orderId, paymentData) => {
    try {
      // Create payment record
      const payment = await apiService.post('order_payments', {
        order_id: orderId,
        payment_method: paymentData.payment_method,
        amount: paymentData.amount,
        status: 'completed', // In real implementation, this would be based on payment gateway response
        transaction_id: paymentData.transaction_id || `TXN-${Date.now()}`,
        payment_date: new Date().toISOString(),
        payment_details: paymentData.payment_details || {}
      });

      // Update order status to paid
      await this.updateOrderStatus(orderId, 'confirmed', 'Payment processed successfully');

      return payment;
    } catch (error) {
      throw error;
    }
  },

  // Get customer orders
  getCustomerOrders: async (customerId) => {
    try {
      const orders = await apiService.get('orders', {
        filters: { customer_id: customerId },
        select: `
          *,
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products (
              id,
              name,
              sku,
              product_images (
                image_url,
                is_primary
              )
            )
          )
        `,
        orderBy: { column: 'created_at', ascending: false }
      });

      return orders.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Cancel order
  cancelOrder: async (id, reason) => {
    try {
      const order = await this.updateOrderStatus(id, 'cancelled', `Cancelled: ${reason}`);
      return order;
    } catch (error) {
      throw error;
    }
  },

  // Estimate delivery time
  estimateDelivery: async (address) => {
    try {
      // This would integrate with shipping providers in a real implementation
      // For now, we'll provide a simple estimation based on address
      const baseDeliveryDays = 2;
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + baseDeliveryDays);

      return {
        estimated_date: estimatedDate.toISOString().split('T')[0],
        estimated_days: baseDeliveryDays,
        shipping_cost: 5000, // UGX
        shipping_methods: [
          {
            name: 'Standard Delivery',
            cost: 5000,
            days: 2
          },
          {
            name: 'Express Delivery',
            cost: 10000,
            days: 1
          }
        ]
      };
    } catch (error) {
      throw error;
    }
  },

  // Track order
  trackOrder: async (trackingNumber) => {
    try {
      const order = await apiService.get('orders', {
        filters: { tracking_number: trackingNumber },
        select: `
          *,
          order_status_history (
            status,
            changed_at,
            notes
          )
        `,
        limit: 1
      });

      if (!order.data || order.data.length === 0) {
        throw { message: 'Order not found', code: 404 };
      }

      return order.data[0];
    } catch (error) {
      throw error;
    }
  },

  // Generate order PDF
  generateOrderPDF: async (orderData) => {
    try {
      // In a real implementation, this would call a PDF generation service
      // For now, we'll simulate PDF generation
      const pdfData = {
        orderNumber: orderData.order_number,
        date: new Date().toLocaleDateString(),
        items: orderData.order_items,
        total: orderData.total_amount,
        customerInfo: orderData.customers,
        deliveryAddress: orderData.delivery_address
      };
      
      // Simulate PDF generation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        pdfUrl: `data:application/pdf;base64,${btoa(JSON.stringify(pdfData))}`,
        filename: `order-${orderData.order_number}.pdf`
      };
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error('Failed to generate PDF');
    }
  },

  // Send order via SMS
  sendOrderViaSMS: async (orderData, phoneNumber) => {
    try {
      // In a real implementation, this would integrate with SMS service like Twilio
      // For now, we'll simulate SMS sending
      const message = `Your order ${orderData.order_number} has been placed successfully. Total: UGX ${orderData.total_amount}. Thank you for shopping with FAREDEAL!`;
      
      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: 'SMS sent successfully',
        messageId: `SMS-${Date.now()}`
      };
    } catch (error) {
      console.error('SMS sending error:', error);
      throw new Error('Failed to send SMS');
    }
  },

  // Send order via Email
  sendOrderViaEmail: async (orderData, emailAddress) => {
    try {
      // In a real implementation, this would integrate with email service like SendGrid
      // For now, we'll simulate email sending
      const emailContent = {
        to: emailAddress,
        subject: `Order Confirmation - ${orderData.order_number}`,
        body: `Thank you for your order! Order Number: ${orderData.order_number}, Total: UGX ${orderData.total_amount}`
      };
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: 'Email sent successfully',
        messageId: `EMAIL-${Date.now()}`
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Failed to send email');
    }
  },

  // Get order analytics
  getOrderAnalytics: async (dateRange = 'last_30_days') => {
    try {
      let startDate = new Date();
      let endDate = new Date();

      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last_7_days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last_30_days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'last_90_days':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      const analytics = await apiService.get('sales_analytics', {
        filters: {
          date_gte: startDate.toISOString().split('T')[0],
          date_lte: endDate.toISOString().split('T')[0]
        },
        orderBy: { column: 'date', ascending: true }
      });

      return analytics.data || [];
    } catch (error) {
      throw error;
    }
  }
};

export default orderService;