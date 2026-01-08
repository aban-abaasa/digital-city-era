import { supabase, handleSupabaseError } from './supabaseClient';
import { apiService } from './apiService';
import { notificationService } from './notificationService';

export const supplierService = {
  // Supplier login
  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw handleSupabaseError(error);

      // Get supplier details
      const supplier = await apiService.getById('suppliers', data.user.id);

      if (!supplier) {
        throw { message: 'Supplier record not found', code: 404 };
      }

      return {
        user: data.user,
        supplier: supplier,
        session: data.session
      };
    } catch (error) {
      throw error;
    }
  },

  // Register new supplier (requires manager approval)
  register: async (supplierData) => {
    try {
      // First create auth user (but not confirmed yet)
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: supplierData.email,
        password: supplierData.password,
        options: {
          data: {
            company_name: supplierData.company_name,
            contact_person: supplierData.contact_person
          }
        }
      });

      if (authError) throw handleSupabaseError(authError);

      // Create supplier record with pending status
      const supplierRecord = {
        id: authUser.user.id,
        supplier_code: supplierData.supplier_code,
        company_name: supplierData.company_name,
        contact_person: supplierData.contact_person,
        email: supplierData.email,
        phone: supplierData.phone,
        address: supplierData.address,
        city: supplierData.city,
        country: supplierData.country,
        tax_id: supplierData.tax_id,
        bank_account: supplierData.bank_account,
        payment_terms: supplierData.payment_terms || 'Net 30',
        status: 'pending_approval', // Requires manager approval
        is_active: false, // Not active until approved
        registration_date: new Date().toISOString(),
        approved_by: null,
        approved_at: null
      };

      const supplier = await apiService.post('suppliers', supplierRecord);

      // Create verification request for manager
      const verificationRequest = {
        user_id: authUser.user.id,
        user_type: 'supplier',
        user_data: supplierRecord,
        status: 'pending',
        requested_at: new Date().toISOString(),
        requested_by: authUser.user.id
      };

      await apiService.post('verification_requests', verificationRequest);

      return {
        user: authUser.user,
        supplier: supplier,
        session: authUser.session,
        requiresApproval: true
      };
    } catch (error) {
      throw error;
    }
  },

  // Get supplier by ID
  getById: async (supplierId) => {
    try {
      const supplier = await apiService.getById('suppliers', supplierId);
      return supplier;
    } catch (error) {
      throw error;
    }
  },

  // Get supplier by email
  getByEmail: async (email) => {
    try {
      const result = await apiService.get('suppliers', {
        filters: { email: email },
        limit: 1
      });

      if (!result.data || result.data.length === 0) {
        throw { message: 'Supplier not found', code: 404 };
      }

      return result.data[0];
    } catch (error) {
      throw error;
    }
  },

  // Update supplier profile
  updateProfile: async (supplierId, data) => {
    try {
      const supplier = await apiService.put('suppliers', supplierId, data);
      return supplier;
    } catch (error) {
      throw error;
    }
  },

  // Get supplier's products
  getProducts: async (supplierId) => {
    try {
      const products = await apiService.get('products', {
        filters: { supplier_id: supplierId },
        orderBy: { column: 'name', ascending: true }
      });

      return products.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Add new product
  addProduct: async (supplierId, productData) => {
    try {
      const product = {
        ...productData,
        supplier_id: supplierId,
        created_at: new Date().toISOString(),
        status: 'pending_approval'
      };

      const result = await apiService.post('products', product);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Update product
  updateProduct: async (productId, productData) => {
    try {
      const product = await apiService.put('products', productId, productData);
      return product;
    } catch (error) {
      throw error;
    }
  },

  // Get supplier's orders/purchase orders
  getOrders: async (supplierId, filters = {}) => {
    try {
      const orders = await apiService.get('purchase_orders', {
        filters: { 
          supplier_id: supplierId,
          ...filters
        },
        orderBy: { column: 'order_date', ascending: false }
      });

      return orders.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Update order status
  updateOrderStatus: async (orderId, status, notes = '') => {
    try {
      const updateData = {
        status: status,
        updated_at: new Date().toISOString()
      };

      if (status === 'shipped') {
        updateData.shipped_date = new Date().toISOString();
      } else if (status === 'delivered') {
        updateData.delivered_date = new Date().toISOString();
      }

      if (notes) {
        updateData.notes = notes;
      }

      const order = await apiService.put('purchase_orders', orderId, updateData);
      return order;
    } catch (error) {
      throw error;
    }
  },

  // Get supplier's invoices
  getInvoices: async (supplierId, filters = {}) => {
    try {
      const invoices = await apiService.get('supplier_invoices', {
        filters: {
          supplier_id: supplierId,
          ...filters
        },
        orderBy: { column: 'invoice_date', ascending: false }
      });

      return invoices.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Create invoice
  createInvoice: async (supplierId, invoiceData) => {
    try {
      const invoice = {
        ...invoiceData,
        supplier_id: supplierId,
        invoice_date: new Date().toISOString(),
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const result = await apiService.post('supplier_invoices', invoice);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Get supplier performance metrics
  getPerformanceMetrics: async (supplierId, startDate, endDate) => {
    try {
      // Get orders in date range
      const filters = { supplier_id: supplierId };
      if (startDate) filters.order_date_gte = startDate;
      if (endDate) filters.order_date_lte = endDate;

      const orders = await this.getOrders(supplierId, filters);

      // Calculate metrics
      const totalOrders = orders.length;
      const completedOrders = orders.filter(order => order.status === 'delivered').length;
      const onTimeDeliveries = orders.filter(order => {
        if (order.status === 'delivered' && order.expected_delivery_date && order.delivered_date) {
          return new Date(order.delivered_date) <= new Date(order.expected_delivery_date);
        }
        return false;
      }).length;

      const totalValue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

      return {
        total_orders: totalOrders,
        completed_orders: completedOrders,
        completion_rate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
        on_time_deliveries: onTimeDeliveries,
        on_time_rate: completedOrders > 0 ? (onTimeDeliveries / completedOrders) * 100 : 0,
        total_value: totalValue,
        average_order_value: averageOrderValue
      };
    } catch (error) {
      throw error;
    }
  },

  // Get supplier catalog/products for customers
  getCatalog: async (supplierId, category = null) => {
    try {
      const filters = {
        supplier_id: supplierId,
        status: 'approved',
        is_active: true
      };

      if (category) {
        filters.category = category;
      }

      const products = await apiService.get('products', {
        filters,
        orderBy: { column: 'name', ascending: true }
      });

      return products.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Update inventory levels
  updateInventory: async (productId, quantityChange, type = 'adjustment') => {
    try {
      const inventoryRecord = {
        product_id: productId,
        quantity_change: quantityChange,
        type: type, // 'adjustment', 'restock', 'sale'
        date: new Date().toISOString(),
        notes: `Supplier inventory ${type}`
      };

      const result = await apiService.post('inventory_movements', inventoryRecord);
      
      // Update product stock
      const product = await apiService.getById('products', productId);
      const newStock = Math.max(0, (product.stock_quantity || 0) + quantityChange);
      
      await apiService.put('products', productId, {
        stock_quantity: newStock,
        last_updated: new Date().toISOString()
      });

      return result;
    } catch (error) {
      throw error;
    }
  },

  // Verification Management (Manager functions)
  
  // Get pending supplier verification requests
  getPendingVerifications: async () => {
    try {
      const requests = await apiService.get('verification_requests', {
        filters: {
          user_type: 'supplier',
          status: 'pending'
        },
        orderBy: { column: 'requested_at', ascending: false }
      });

      return requests.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Approve supplier registration
  approveSupplier: async (supplierId, managerId, notes = '') => {
    try {
      // Get manager details for notification
      const manager = await apiService.getById('employees', managerId);
      
      // Update supplier status
      const updatedSupplier = await apiService.put('suppliers', supplierId, {
        status: 'approved',
        is_active: true,
        approved_by: managerId,
        approved_at: new Date().toISOString()
      });

      // Update verification request
      const verificationRequest = await apiService.get('verification_requests', {
        filters: {
          user_id: supplierId,
          user_type: 'supplier'
        },
        limit: 1
      });

      if (verificationRequest.data && verificationRequest.data.length > 0) {
        await apiService.put('verification_requests', verificationRequest.data[0].id, {
          status: 'approved',
          approved_by: managerId,
          approved_at: new Date().toISOString(),
          notes: notes
        });
      }

      // Send approval notification to supplier
      try {
        await notificationService.sendVerificationApproval(
          supplierId, 
          'supplier', 
          manager.full_name
        );
      } catch (notificationError) {
        console.error('Failed to send approval notification:', notificationError);
        // Don't fail the approval process if notification fails
      }
      
      return updatedSupplier;
    } catch (error) {
      throw error;
    }
  },

  // Reject supplier registration
  rejectSupplier: async (supplierId, managerId, reason = '') => {
    try {
      // Get manager details for notification
      const manager = await apiService.getById('employees', managerId);
      
      // Update supplier status
      const updatedSupplier = await apiService.put('suppliers', supplierId, {
        status: 'rejected',
        is_active: false,
        rejected_by: managerId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      });

      // Update verification request
      const verificationRequest = await apiService.get('verification_requests', {
        filters: {
          user_id: supplierId,
          user_type: 'supplier'
        },
        limit: 1
      });

      if (verificationRequest.data && verificationRequest.data.length > 0) {
        await apiService.put('verification_requests', verificationRequest.data[0].id, {
          status: 'rejected',
          rejected_by: managerId,
          rejected_at: new Date().toISOString(),
          notes: reason
        });
      }

      // Send rejection notification to supplier
      try {
        await notificationService.sendVerificationRejection(
          supplierId, 
          'supplier', 
          reason,
          manager.full_name
        );
      } catch (notificationError) {
        console.error('Failed to send rejection notification:', notificationError);
        // Don't fail the rejection process if notification fails
      }
      
      return updatedSupplier;
    } catch (error) {
      throw error;
    }
  },

  // Check supplier verification status
  getVerificationStatus: async (supplierId) => {
    try {
      const supplier = await this.getById(supplierId);
      return {
        status: supplier.status,
        is_active: supplier.is_active,
        approved_by: supplier.approved_by,
        approved_at: supplier.approved_at,
        rejected_by: supplier.rejected_by,
        rejected_at: supplier.rejected_at,
        rejection_reason: supplier.rejection_reason
      };
    } catch (error) {
      throw error;
    }
  }
};

export default supplierService;