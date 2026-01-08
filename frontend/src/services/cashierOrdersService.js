// ===================================================
// 🛒 CASHIER ORDERS SERVICE
// Handle till supply orders, approvals, and payments
// ===================================================

import { supabase } from './supabase';

class CashierOrdersService {
  
  // ===================================================
  // CREATE NEW ORDER
  // ===================================================
  async createOrder(orderData) {
    try {
      const {
        cashierId,
        cashierName,
        registerNumber,
        location,
        items,
        orderType = 'till_supplies',
        priority = 'normal',
        notes
      } = orderData;

      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      // Calculate totals
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const estimatedCost = items.reduce((sum, item) => 
        sum + (item.quantity * (item.unitCost || 0)), 0
      );

      // Create order record
      const orderRecord = {
        order_number: orderNumber,
        cashier_id: cashierId,
        cashier_name: cashierName,
        register_number: registerNumber,
        store_location: location,
        order_type: orderType,
        priority,
        items_requested: items,
        total_items: totalItems,
        estimated_cost: estimatedCost,
        request_notes: notes,
        status: 'pending',
        payment_status: 'unpaid'
      };

      const { data: order, error: orderError } = await supabase
        .from('cashier_orders')
        .insert(orderRecord)
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        supply_id: item.supplyId,
        item_name: item.name,
        item_category: item.category,
        quantity_requested: item.quantity,
        unit_cost: item.unitCost || 0,
        line_total: item.quantity * (item.unitCost || 0)
      }));

      const { error: itemsError } = await supabase
        .from('cashier_order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error inserting order items:', itemsError);
      }

      return {
        success: true,
        order,
        orderNumber
      };

    } catch (error) {
      console.error('Error creating order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // GENERATE ORDER NUMBER
  // ===================================================
  async generateOrderNumber() {
    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      
      const { count, error } = await supabase
        .from('cashier_orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().setHours(0, 0, 0, 0))
        .lte('created_at', new Date().setHours(23, 59, 59, 999));

      if (error) console.error('Error counting orders:', error);

      const counter = (count || 0) + 1;
      return `ORD-${today}-${String(counter).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating order number:', error);
      return `ORD-${Date.now()}`;
    }
  }

  // ===================================================
  // GET CASHIER ORDERS
  // ===================================================
  async getCashierOrders(cashierId, status = null) {
    try {
      let query = supabase
        .from('cashier_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (cashierId) {
        query = query.eq('cashier_id', cashierId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get counts by status
      const pending = data.filter(o => o.status === 'pending').length;
      const approved = data.filter(o => o.status === 'approved').length;
      const fulfilled = data.filter(o => o.status === 'fulfilled').length;
      const rejected = data.filter(o => o.status === 'rejected').length;

      // Get payment stats
      const totalPaid = data
        .filter(o => o.payment_status === 'paid')
        .reduce((sum, o) => sum + parseFloat(o.amount_paid || 0), 0);

      const pendingPayments = data
        .filter(o => o.payment_status === 'unpaid' && o.status === 'approved')
        .reduce((sum, o) => sum + parseFloat(o.estimated_cost || 0), 0);

      return {
        success: true,
        orders: data,
        stats: {
          total: data.length,
          pending,
          approved,
          fulfilled,
          rejected,
          totalPaid,
          pendingPayments
        }
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      return {
        success: false,
        error: error.message,
        orders: [],
        stats: {}
      };
    }
  }

  // ===================================================
  // GET TILL SUPPLIES INVENTORY
  // ===================================================
  async getTillSupplies() {
    try {
      const { data, error } = await supabase
        .from('till_supplies_inventory')
        .select('*')
        .eq('is_available', true)
        .order('item_name', { ascending: true });

      if (error) throw error;

      // Categorize supplies
      const categories = {};
      data.forEach(item => {
        const cat = item.item_category || 'other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
      });

      // Get low stock items
      const lowStock = data.filter(item => 
        item.current_stock <= item.minimum_stock
      );

      return {
        success: true,
        supplies: data,
        categories,
        lowStock,
        totalItems: data.length
      };
    } catch (error) {
      console.error('Error fetching supplies:', error);
      return {
        success: false,
        error: error.message,
        supplies: [],
        categories: {},
        lowStock: []
      };
    }
  }

  // ===================================================
  // GET CASHIER DAILY STATS
  // ===================================================
  async getCashierDailyStats(cashierId, date = new Date()) {
    try {
      const statDate = new Date(date).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('cashier_daily_stats')
        .select('*')
        .eq('cashier_id', cashierId)
        .eq('stat_date', statDate)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Generate stats for today
        return await this.generateDailyStats(cashierId, date);
      }

      return {
        success: true,
        stats: data
      };
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // GENERATE DAILY STATS
  // ===================================================
  async generateDailyStats(cashierId, date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get orders for the day
      const { data: orders, error: ordersError } = await supabase
        .from('cashier_orders')
        .select('*')
        .eq('cashier_id', cashierId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      if (ordersError) throw ordersError;

      const stats = {
        cashier_id: cashierId,
        stat_date: new Date(date).toISOString().split('T')[0],
        orders_submitted: orders.length,
        orders_approved: orders.filter(o => o.status === 'approved').length,
        orders_rejected: orders.filter(o => o.status === 'rejected').length,
        orders_fulfilled: orders.filter(o => o.status === 'fulfilled').length,
        payments_made: orders.filter(o => o.payment_status === 'paid').length,
        total_payments_ugx: orders
          .filter(o => o.payment_status === 'paid')
          .reduce((sum, o) => sum + parseFloat(o.amount_paid || 0), 0),
        pending_payments_ugx: orders
          .filter(o => o.payment_status === 'unpaid')
          .reduce((sum, o) => sum + parseFloat(o.estimated_cost || 0), 0)
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Error generating daily stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // UPDATE ORDER STATUS
  // ===================================================
  async updateOrderStatus(orderId, status, notes = null, userId = null, userName = null) {
    try {
      const updates = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'approved') {
        updates.approved_by = userId;
        updates.approved_by_name = userName;
        updates.approved_at = new Date().toISOString();
        updates.approval_notes = notes;
      } else if (status === 'rejected') {
        updates.rejection_reason = notes;
      } else if (status === 'fulfilled') {
        updates.fulfilled_at = new Date().toISOString();
        updates.fulfilled_by = userId;
        updates.fulfilled_by_name = userName;
        updates.delivery_notes = notes;
      }

      const { data, error } = await supabase
        .from('cashier_orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        order: data
      };
    } catch (error) {
      console.error('Error updating order status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // UPDATE PAYMENT STATUS
  // ===================================================
  async updatePaymentStatus(orderId, paymentData) {
    try {
      const {
        paymentStatus,
        paymentMethod,
        paymentReference,
        amountPaid
      } = paymentData;

      const updates = {
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        amount_paid: amountPaid,
        payment_date: paymentStatus === 'paid' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('cashier_orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        order: data
      };
    } catch (error) {
      console.error('Error updating payment status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new CashierOrdersService();
