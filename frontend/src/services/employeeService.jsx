import { supabase, handleSupabaseError } from './supabaseClient';
import { apiService } from './apiService';
import { notificationService } from './notificationService';

export const employeeService = {
  // Employee login
  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw handleSupabaseError(error);

      // Get employee details
      const employee = await apiService.getById('employees', data.user.id);

      if (!employee) {
        throw { message: 'Employee record not found', code: 404 };
      }

      return {
        user: data.user,
        employee: employee,
        session: data.session
      };
    } catch (error) {
      throw error;
    }
  },

  // Register new employee (requires manager approval)
  register: async (employeeData) => {
    try {
      // First create auth user (but not confirmed yet)
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: employeeData.email,
        password: employeeData.password,
        options: {
          data: {
            full_name: employeeData.full_name,
            role: employeeData.role
          }
        }
      });

      if (authError) throw handleSupabaseError(authError);

      // Create employee record with pending status
      const employeeRecord = {
        id: authUser.user.id,
        employee_id: employeeData.employee_id,
        full_name: employeeData.full_name,
        email: employeeData.email,
        phone: employeeData.phone,
        role: employeeData.role,
        department: employeeData.department,
        hire_date: employeeData.hire_date || new Date().toISOString().split('T')[0],
        salary: employeeData.salary || 0,
        status: 'pending_approval', // Requires manager approval
        is_active: false, // Not active until approved
        registration_date: new Date().toISOString(),
        approved_by: null,
        approved_at: null
      };

      const employee = await apiService.post('employees', employeeRecord);

      // Create verification request for manager
      const verificationRequest = {
        user_id: authUser.user.id,
        user_type: 'employee',
        user_data: employeeRecord,
        status: 'pending',
        requested_at: new Date().toISOString(),
        requested_by: authUser.user.id
      };

      await apiService.post('verification_requests', verificationRequest);

      return {
        user: authUser.user,
        employee: employee,
        session: authUser.session,
        requiresApproval: true
      };
    } catch (error) {
      throw error;
    }
  },

  // Get employee by ID
  getById: async (employeeId) => {
    try {
      const employee = await apiService.getById('employees', employeeId);
      return employee;
    } catch (error) {
      throw error;
    }
  },

  // Get employee by email
  getByEmail: async (email) => {
    try {
      const result = await apiService.get('employees', {
        filters: { email: email },
        limit: 1
      });

      if (!result.data || result.data.length === 0) {
        throw { message: 'Employee not found', code: 404 };
      }

      return result.data[0];
    } catch (error) {
      throw error;
    }
  },

  // Update employee profile
  updateProfile: async (employeeId, data) => {
    try {
      const employee = await apiService.put('employees', employeeId, data);
      return employee;
    } catch (error) {
      throw error;
    }
  },

  // Get employee permissions based on role
  getPermissions: async (employeeId) => {
    try {
      const employee = await this.getById(employeeId);
      
      // Define permissions based on role
      const rolePermissions = {
        manager: [
          'view_dashboard',
          'manage_employees',
          'manage_inventory',
          'view_reports',
          'manage_suppliers',
          'manage_customers',
          'pos_access',
          'manage_products'
        ],
        cashier: [
          'pos_access',
          'view_products',
          'process_sales',
          'handle_payments'
        ],
        inventory_manager: [
          'manage_inventory',
          'view_products',
          'manage_suppliers',
          'view_reports'
        ],
        sales_associate: [
          'view_products',
          'manage_customers',
          'process_sales',
          'view_dashboard'
        ]
      };

      return {
        employee: employee,
        permissions: rolePermissions[employee.role] || rolePermissions.sales_associate
      };
    } catch (error) {
      throw error;
    }
  },

  // Clock in/out functionality
  clockIn: async (employeeId) => {
    try {
      const attendance = {
        employee_id: employeeId,
        clock_in: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        status: 'present'
      };

      // Check if already clocked in today
      const existingAttendance = await apiService.get('employee_attendance', {
        filters: {
          employee_id: employeeId,
          date: attendance.date
        },
        limit: 1
      });

      if (existingAttendance.data && existingAttendance.data.length > 0) {
        throw { message: 'Already clocked in today', code: 400 };
      }

      const result = await apiService.post('employee_attendance', attendance);
      return result;
    } catch (error) {
      throw error;
    }
  },

  clockOut: async (employeeId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Find today's attendance record
      const attendance = await apiService.get('employee_attendance', {
        filters: {
          employee_id: employeeId,
          date: today
        },
        limit: 1
      });

      if (!attendance.data || attendance.data.length === 0) {
        throw { message: 'No clock-in record found for today', code: 404 };
      }

      const attendanceRecord = attendance.data[0];
      
      if (attendanceRecord.clock_out) {
        throw { message: 'Already clocked out today', code: 400 };
      }

      // Update with clock out time
      const clockOutTime = new Date().toISOString();
      const clockInTime = new Date(attendanceRecord.clock_in);
      const hoursWorked = (new Date(clockOutTime) - clockInTime) / (1000 * 60 * 60);

      const result = await apiService.put('employee_attendance', attendanceRecord.id, {
        clock_out: clockOutTime,
        hours_worked: Math.round(hoursWorked * 100) / 100
      });

      return result;
    } catch (error) {
      throw error;
    }
  },

  // Get employee attendance
  getAttendance: async (employeeId, startDate, endDate) => {
    try {
      const filters = { employee_id: employeeId };
      
      if (startDate) filters.date_gte = startDate;
      if (endDate) filters.date_lte = endDate;

      const attendance = await apiService.get('employee_attendance', {
        filters,
        orderBy: { column: 'date', ascending: false }
      });

      return attendance.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Verification Management (Manager functions)
  
  // Get pending employee verification requests
  getPendingVerifications: async () => {
    try {
      const requests = await apiService.get('verification_requests', {
        filters: {
          user_type: 'employee',
          status: 'pending'
        },
        orderBy: { column: 'requested_at', ascending: false }
      });

      return requests.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Approve employee registration
  approveEmployee: async (employeeId, managerId, notes = '') => {
    try {
      // Get manager details for notification
      const manager = await apiService.getById('employees', managerId);
      
      // Update employee status
      const updatedEmployee = await apiService.put('employees', employeeId, {
        status: 'active',
        is_active: true,
        approved_by: managerId,
        approved_at: new Date().toISOString()
      });

      // Update verification request
      const verificationRequest = await apiService.get('verification_requests', {
        filters: {
          user_id: employeeId,
          user_type: 'employee'
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

      // Send approval notification to employee
      try {
        await notificationService.sendVerificationApproval(
          employeeId, 
          'employee', 
          manager.full_name
        );
      } catch (notificationError) {
        console.error('Failed to send approval notification:', notificationError);
        // Don't fail the approval process if notification fails
      }
      
      return updatedEmployee;
    } catch (error) {
      throw error;
    }
  },

  // Reject employee registration
  rejectEmployee: async (employeeId, managerId, reason = '') => {
    try {
      // Get manager details for notification
      const manager = await apiService.getById('employees', managerId);
      
      // Update employee status
      const updatedEmployee = await apiService.put('employees', employeeId, {
        status: 'rejected',
        is_active: false,
        rejected_by: managerId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      });

      // Update verification request
      const verificationRequest = await apiService.get('verification_requests', {
        filters: {
          user_id: employeeId,
          user_type: 'employee'
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

      // Send rejection notification to employee
      try {
        await notificationService.sendVerificationRejection(
          employeeId, 
          'employee', 
          reason,
          manager.full_name
        );
      } catch (notificationError) {
        console.error('Failed to send rejection notification:', notificationError);
        // Don't fail the rejection process if notification fails
      }
      
      return updatedEmployee;
    } catch (error) {
      throw error;
    }
  },

  // Check employee verification status
  getVerificationStatus: async (employeeId) => {
    try {
      const employee = await this.getById(employeeId);
      return {
        status: employee.status,
        is_active: employee.is_active,
        approved_by: employee.approved_by,
        approved_at: employee.approved_at,
        rejected_by: employee.rejected_by,
        rejected_at: employee.rejected_at,
        rejection_reason: employee.rejection_reason
      };
    } catch (error) {
      throw error;
    }
  }
};

export default employeeService;