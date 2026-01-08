import { supabase, handleSupabaseError, retryAuthOperation } from './supabaseClient';
import { apiService } from './apiService';
import { notificationService } from './notificationService';

export const managerService = {
  // Manager registration (immediate approval for development)
  register: async (managerData) => {
    try {
      // For development: Create account immediately without approval queue
      
      // Create manager record in employees table with active status
      const managerRecord = {
        id: `temp-${Date.now()}`, // Temporary ID, will be replaced after auth
        employee_id: managerData.employee_id || `MGR-${Date.now()}`,
        full_name: managerData.full_name,
        email: managerData.email,
        phone: managerData.phone,
        role: 'manager',
        department: managerData.department || 'management',
        hire_date: managerData.hire_date || new Date().toISOString().split('T')[0],
        salary: managerData.salary || 0,
        status: 'approved', // Immediate approval for development
        is_active: true, // Active immediately
        registration_date: new Date().toISOString(),
        approved_by: 'system', // System approval for development
        approved_at: new Date().toISOString(),
        manager_level: managerData.manager_level || 'store_manager',
        access_level: managerData.access_level || 'standard'
      };

      // Create employee record first
      const manager = await apiService.post('employees', managerRecord);

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Then create auth user with retry mechanism to handle rate limiting
      const authResult = await retryAuthOperation(async () => {
        return await supabase.auth.signUp({
          email: managerData.email,
          password: managerData.password,
          options: {
            data: {
              full_name: managerData.full_name,
              role: 'manager',
              employee_id: manager.id
            },
            emailRedirectTo: window.location.origin
          }
        });
      });

      const { data: authUser, error: authError } = authResult;

      if (authError) {
        // If auth creation fails, clean up the employee record
        await apiService.delete(`employees/${manager.id}`);
        throw handleSupabaseError(authError);
      }

      // Update the employee record with the auth user ID
      await apiService.put(`employees/${manager.id}`, {
        ...managerRecord,
        id: authUser.user.id
      });

      notificationService.show('Manager account created successfully! You can now log in.', 'success');

      return {
        success: true,
        message: 'Manager account created successfully',
        user: authUser.user,
        manager: manager
      };

    } catch (error) {
      console.error('Manager registration error:', error);
      notificationService.show('Failed to create manager account', 'error');
      throw error;
    }
  },

  // Manager login (uses employee service since managers are in employees table)
  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw handleSupabaseError(error);

      // Get manager details from employees table
      const manager = await apiService.getById('employees', data.user.id);

      if (!manager) {
        throw { message: 'Manager record not found', code: 404 };
      }

      if (manager.role !== 'manager') {
        throw { message: 'Not authorized as manager', code: 403 };
      }

      return {
        user: data.user,
        manager: manager,
        session: data.session
      };
    } catch (error) {
      throw error;
    }
  },

  // Get manager by ID
  getById: async (managerId) => {
    try {
      const manager = await apiService.getById('employees', managerId);
      if (manager.role !== 'manager') {
        throw { message: 'Not a manager account', code: 403 };
      }
      return manager;
    } catch (error) {
      throw error;
    }
  },

  // Get manager by email
  getByEmail: async (email) => {
    try {
      const result = await apiService.get('employees', {
        filters: { 
          email: email,
          role: 'manager'
        },
        limit: 1
      });

      if (!result.data || result.data.length === 0) {
        throw { message: 'Manager not found', code: 404 };
      }

      return result.data[0];
    } catch (error) {
      throw error;
    }
  },

  // Get all super admins (for notifications)
  getSuperAdmins: async () => {
    try {
      const result = await apiService.get('employees', {
        filters: { 
          role: 'super_admin',
          is_active: true
        }
      });

      return result.data || [];
    } catch (error) {
      console.error('Error fetching super admins:', error);
      return [];
    }
  },

  // Get manager permissions based on access level
  getPermissions: async (managerId) => {
    try {
      const manager = await this.getById(managerId);
      
      // Define permissions based on access level
      const accessLevelPermissions = {
        standard: [
          'view_dashboard',
          'manage_employees',
          'manage_inventory',
          'view_reports',
          'manage_suppliers',
          'manage_customers',
          'pos_access',
          'manage_products',
          'approve_employees',
          'approve_suppliers'
        ],
        advanced: [
          'view_dashboard',
          'manage_employees',
          'manage_inventory',
          'view_reports',
          'manage_suppliers',
          'manage_customers',
          'pos_access',
          'manage_products',
          'approve_employees',
          'approve_suppliers',
          'manage_pricing',
          'view_financial_reports',
          'manage_promotions'
        ],
        full: [
          'view_dashboard',
          'manage_employees',
          'manage_inventory',
          'view_reports',
          'manage_suppliers',
          'manage_customers',
          'pos_access',
          'manage_products',
          'approve_employees',
          'approve_suppliers',
          'manage_pricing',
          'view_financial_reports',
          'manage_promotions',
          'system_administration',
          'user_management',
          'approve_managers'
        ]
      };

      return {
        manager: manager,
        permissions: accessLevelPermissions[manager.access_level] || accessLevelPermissions.standard
      };
    } catch (error) {
      throw error;
    }
  },

  // Update manager profile
  updateProfile: async (managerId, data) => {
    try {
      const manager = await apiService.put('employees', managerId, data);
      return manager;
    } catch (error) {
      throw error;
    }
  },

  // Manager-specific verification functions
  
  // Get pending manager verification requests (for super admins)
  getPendingManagerVerifications: async () => {
    try {
      const requests = await apiService.get('verification_requests', {
        filters: {
          user_type: 'manager',
          status: 'pending'
        },
        orderBy: { column: 'requested_at', ascending: false }
      });

      return requests.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Approve manager registration (super admin function)
  approveManager: async (managerId, superAdminId, notes = '') => {
    try {
      // Get super admin details for notification
      const superAdmin = await apiService.getById('employees', superAdminId);
      
      // Update manager status
      const updatedManager = await apiService.put('employees', managerId, {
        status: 'active',
        is_active: true,
        approved_by: superAdminId,
        approved_at: new Date().toISOString()
      });

      // Update verification request
      const verificationRequest = await apiService.get('verification_requests', {
        filters: {
          user_id: managerId,
          user_type: 'manager'
        },
        limit: 1
      });

      if (verificationRequest.data && verificationRequest.data.length > 0) {
        await apiService.put('verification_requests', verificationRequest.data[0].id, {
          status: 'approved',
          approved_by: superAdminId,
          approved_at: new Date().toISOString(),
          notes: notes
        });
      }

      // Send approval notification to manager
      try {
        await notificationService.sendVerificationApproval(
          managerId, 
          'manager', 
          superAdmin.full_name
        );
      } catch (notificationError) {
        console.error('Failed to send approval notification:', notificationError);
      }
      
      return updatedManager;
    } catch (error) {
      throw error;
    }
  },

  // Reject manager registration (super admin function)
  rejectManager: async (managerId, superAdminId, reason = '') => {
    try {
      // Get super admin details for notification
      const superAdmin = await apiService.getById('employees', superAdminId);
      
      // Update manager status
      const updatedManager = await apiService.put('employees', managerId, {
        status: 'rejected',
        is_active: false,
        rejected_by: superAdminId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      });

      // Update verification request
      const verificationRequest = await apiService.get('verification_requests', {
        filters: {
          user_id: managerId,
          user_type: 'manager'
        },
        limit: 1
      });

      if (verificationRequest.data && verificationRequest.data.length > 0) {
        await apiService.put('verification_requests', verificationRequest.data[0].id, {
          status: 'rejected',
          rejected_by: superAdminId,
          rejected_at: new Date().toISOString(),
          notes: reason
        });
      }

      // Send rejection notification to manager
      try {
        await notificationService.sendVerificationRejection(
          managerId, 
          'manager', 
          reason,
          superAdmin.full_name
        );
      } catch (notificationError) {
        console.error('Failed to send rejection notification:', notificationError);
      }
      
      return updatedManager;
    } catch (error) {
      throw error;
    }
  },

  // Check manager verification status
  getVerificationStatus: async (managerId) => {
    try {
      const manager = await this.getById(managerId);
      return {
        status: manager.status,
        is_active: manager.is_active,
        approved_by: manager.approved_by,
        approved_at: manager.approved_at,
        rejected_by: manager.rejected_by,
        rejected_at: manager.rejected_at,
        rejection_reason: manager.rejection_reason
      };
    } catch (error) {
      throw error;
    }
  },

  // Get manager dashboard data
  getDashboardData: async (managerId) => {
    try {
      const [
        pendingEmployees,
        pendingSuppliers,
        pendingManagers,
        recentActivity
      ] = await Promise.all([
        apiService.get('verification_requests', {
          filters: { user_type: 'employee', status: 'pending' },
          count: true
        }),
        apiService.get('verification_requests', {
          filters: { user_type: 'supplier', status: 'pending' },
          count: true
        }),
        apiService.get('verification_requests', {
          filters: { user_type: 'manager', status: 'pending' },
          count: true
        }),
        apiService.get('verification_requests', {
          orderBy: { column: 'requested_at', ascending: false },
          limit: 10
        })
      ]);

      return {
        pending_employees: pendingEmployees.count || 0,
        pending_suppliers: pendingSuppliers.count || 0,
        pending_managers: pendingManagers.count || 0,
        recent_activity: recentActivity.data || []
      };
    } catch (error) {
      console.error('Error fetching manager dashboard data:', error);
      return {
        pending_employees: 0,
        pending_suppliers: 0,
        pending_managers: 0,
        recent_activity: []
      };
    }
  }
};

export default managerService;