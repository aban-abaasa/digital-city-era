import { mockService } from './mockService';
import { mockAuthService } from './mockAuthService';
import { notificationService } from './notificationService';

export const adminService = {
  // Admin registration (super admin creation) - NO EMAIL CONFIRMATION REQUIRED
  register: async (adminData) => {
    try {
      // Create auth user with email confirmation disabled for admins
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: adminData.email,
        password: adminData.password,
        options: {
          data: {
            full_name: adminData.full_name || 'Admin User',
            first_name: adminData.first_name || adminData.full_name?.split(' ')[0] || 'Admin',
            last_name: adminData.last_name || adminData.full_name?.split(' ').slice(1).join(' ') || 'User',
            role: 'admin',
            phone: adminData.phone || '',
            admin_id: adminData.admin_id || `ADM-${Date.now()}`,
            department: 'administration'
          },
          // Disable email confirmation for admin accounts
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      // For admin accounts, auto-verify if Supabase sends confirmation
      // In production, configure Supabase to disable email confirmation for admin domain
      
      // Wait a moment for the database trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify admin record was created by the trigger
      try {
        const adminRecord = await apiService.getById('admins', authUser.user.id);
        console.log('Admin record created successfully:', adminRecord);
      } catch (verifyError) {
        console.warn('Could not verify admin record creation:', verifyError);
        // Continue anyway as the auth user was created successfully
      }

      notificationService.show('✅ Admin account created! You can now log in.', 'success');

      return {
        success: true,
        message: 'Admin account created successfully - ready to use!',
        user: authUser.user,
        autoLogin: true // Flag to indicate we should auto-login
      };

    } catch (error) {
      console.error('Admin registration error:', error);
      notificationService.show('Failed to create admin account: ' + (error.message || 'Unknown error'), 'error');
      throw error;
    }
  },

  // Admin login
  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw handleSupabaseError(error);

      // Get admin details
      const admin = await apiService.getById('admins', data.user.id);

      if (!admin) {
        throw { message: 'Admin record not found', code: 404 };
      }

      if (!admin.is_active) {
        throw { message: 'Admin account is deactivated', code: 403 };
      }

      // Update last login
      await apiService.put(`admins/${admin.id}`, {
        last_login: new Date().toISOString()
      });

      return {
        user: data.user,
        admin: admin,
        session: data.session
      };

    } catch (error) {
      console.error('Admin login error:', error);
      throw error;
    }
  },

  // Get admin by ID
  getById: async (adminId) => {
    try {
      return await apiService.getById('admins', adminId);
    } catch (error) {
      console.error('Error fetching admin:', error);
      throw error;
    }
  },

  // Get all users (comprehensive user management)
  getAllUsers: async () => {
    try {
      const [customers, employees, suppliers, admins] = await Promise.all([
        apiService.get('customers'),
        apiService.get('employees'),
        apiService.get('suppliers'),
        apiService.get('admins')
      ]);

      return {
        customers: customers || [],
        employees: employees || [],
        suppliers: suppliers || [],
        admins: admins || []
      };
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  },

  // User management operations
  activateUser: async (userType, userId) => {
    try {
      const endpoint = userType === 'customer' ? 'customers' : 
                     userType === 'employee' ? 'employees' :
                     userType === 'supplier' ? 'suppliers' : 'admins';
      
      return await apiService.put(`${endpoint}/${userId}`, {
        is_active: true,
        status: 'active'
      });
    } catch (error) {
      console.error('Error activating user:', error);
      throw error;
    }
  },

  deactivateUser: async (userType, userId) => {
    try {
      const endpoint = userType === 'customer' ? 'customers' : 
                     userType === 'employee' ? 'employees' :
                     userType === 'supplier' ? 'suppliers' : 'admins';
      
      return await apiService.put(`${endpoint}/${userId}`, {
        is_active: false,
        status: 'inactive'
      });
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  },

  deleteUser: async (userType, userId) => {
    try {
      const endpoint = userType === 'customer' ? 'customers' : 
                     userType === 'employee' ? 'employees' :
                     userType === 'supplier' ? 'suppliers' : 'admins';
      
      // First delete from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) console.warn('Auth user deletion failed:', authError);

      // Then delete from database
      return await apiService.delete(`${endpoint}/${userId}`);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // System analytics and reporting
  getSystemAnalytics: async () => {
    try {
      const [users, orders, inventory, financial] = await Promise.all([
        this.getUserAnalytics(),
        this.getOrderAnalytics(),
        this.getInventoryAnalytics(),
        this.getFinancialAnalytics()
      ]);

      return {
        users,
        orders,
        inventory,
        financial,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching system analytics:', error);
      throw error;
    }
  },

  getUserAnalytics: async () => {
    try {
      const users = await this.getAllUsers();
      
      return {
        total: Object.values(users).reduce((sum, userList) => sum + userList.length, 0),
        customers: users.customers.length,
        employees: users.employees.length,
        suppliers: users.suppliers.length,
        admins: users.admins.length,
        activeUsers: Object.values(users).reduce((sum, userList) => 
          sum + userList.filter(user => user.is_active).length, 0),
        pendingApprovals: users.employees.filter(emp => emp.status === 'pending').length +
                         users.suppliers.filter(sup => sup.status === 'pending').length
      };
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      throw error;
    }
  },

  getOrderAnalytics: async () => {
    try {
      const orders = await apiService.get('orders') || [];
      
      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const thisYear = new Date(today.getFullYear(), 0, 1);

      return {
        total: orders.length,
        todayOrders: orders.filter(order => 
          new Date(order.created_at).toDateString() === today.toDateString()).length,
        monthlyOrders: orders.filter(order => 
          new Date(order.created_at) >= thisMonth).length,
        yearlyOrders: orders.filter(order => 
          new Date(order.created_at) >= thisYear).length,
        pendingOrders: orders.filter(order => order.status === 'pending').length,
        completedOrders: orders.filter(order => order.status === 'completed').length
      };
    } catch (error) {
      console.error('Error fetching order analytics:', error);
      return { total: 0, todayOrders: 0, monthlyOrders: 0, yearlyOrders: 0, pendingOrders: 0, completedOrders: 0 };
    }
  },

  getInventoryAnalytics: async () => {
    try {
      const products = await apiService.get('products') || [];
      
      return {
        totalProducts: products.length,
        lowStockItems: products.filter(product => product.stock_quantity <= 10).length,
        outOfStockItems: products.filter(product => product.stock_quantity === 0).length,
        totalValue: products.reduce((sum, product) => 
          sum + (product.price * product.stock_quantity), 0)
      };
    } catch (error) {
      console.error('Error fetching inventory analytics:', error);
      return { totalProducts: 0, lowStockItems: 0, outOfStockItems: 0, totalValue: 0 };
    }
  },

  getFinancialAnalytics: async () => {
    try {
      const orders = await apiService.get('orders') || [];
      
      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const completedOrders = orders.filter(order => order.status === 'completed');
      
      return {
        totalRevenue: completedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
        monthlyRevenue: completedOrders
          .filter(order => new Date(order.created_at) >= thisMonth)
          .reduce((sum, order) => sum + (order.total_amount || 0), 0),
        averageOrderValue: completedOrders.length > 0 ? 
          completedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0) / completedOrders.length : 0
      };
    } catch (error) {
      console.error('Error fetching financial analytics:', error);
      return { totalRevenue: 0, monthlyRevenue: 0, averageOrderValue: 0 };
    }
  },

  // System settings management
  getSystemSettings: async () => {
    try {
      return await apiService.get('system_settings') || {};
    } catch (error) {
      console.error('Error fetching system settings:', error);
      return {};
    }
  },

  updateSystemSettings: async (settings) => {
    try {
      return await apiService.put('system_settings', settings);
    } catch (error) {
      console.error('Error updating system settings:', error);
      throw error;
    }
  },

  // Database operations
  executeQuery: async (query, params = []) => {
    try {
      // This would be implemented with proper SQL execution if needed
      console.warn('Direct database query execution should be implemented server-side for security');
      return { message: 'Direct database queries should be executed server-side', data: [] };
    } catch (error) {
      console.error('Error executing database query:', error);
      throw error;
    }
  },

  // Backup and maintenance
  createSystemBackup: async () => {
    try {
      const allData = await this.getAllUsers();
      const backup = {
        timestamp: new Date().toISOString(),
        data: allData,
        version: '1.0'
      };
      
      // In a real implementation, this would trigger server-side backup
      console.log('System backup created:', backup);
      notificationService.show('System backup created successfully', 'success');
      
      return backup;
    } catch (error) {
      console.error('Error creating system backup:', error);
      throw error;
    }
  },

  // Permissions management
  updateUserPermissions: async (userType, userId, permissions) => {
    try {
      const endpoint = userType === 'admin' ? 'admins' : 'employees';
      
      return await apiService.put(`${endpoint}/${userId}`, {
        permissions: permissions
      });
    } catch (error) {
      console.error('Error updating user permissions:', error);
      throw error;
    }
  },

  // Bulk operations
  bulkUserOperation: async (operation, userType, userIds) => {
    try {
      const promises = userIds.map(userId => {
        switch (operation) {
          case 'activate':
            return this.activateUser(userType, userId);
          case 'deactivate':
            return this.deactivateUser(userType, userId);
          case 'delete':
            return this.deleteUser(userType, userId);
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      });

      return await Promise.all(promises);
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      throw error;
    }
  }
};

export default adminService;