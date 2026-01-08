/**
 * Admin Service - Frontend Integration
 * Comprehensive admin portal backend integration
 * Created: October 8, 2025
 * Version: 2.0.0
 */

import { supabase } from './supabase';

class AdminService {
  constructor() {
    if (import.meta.env.PROD) {
      this.baseURL = import.meta.env.VITE_API_URL || 'https://api.faredeal.vercel.app/api';
    } else {
      this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    }
    this.supabase = supabase;
  }

  // =============================================================================
  // AUTHENTICATION & SESSION MANAGEMENT
  // =============================================================================

  /**
   * Verify admin access
   */
  async verifyAdminAccess() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error || !user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Get user details from database
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id, email, role, status, first_name, last_name')
        .eq('auth_id', user.id)
        .single();

      if (userError || !userData) {
        return { success: false, error: 'User not found' };
      }

      // Check if user is admin
      if (userData.role !== 'admin' && userData.role !== 'super_admin') {
        return { success: false, error: 'Insufficient permissions' };
      }

      return {
        success: true,
        user: userData,
        isAdmin: true
      };
    } catch (error) {
      console.error('Admin access verification failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log admin activity
   */
  async logActivity(action, entityType, entityId = null, details = {}) {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      
      if (!user) return;

      const { error } = await this.supabase
        .from('admin_activity_log')
        .insert({
          admin_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
          session_id: this.getSessionId()
        });

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      console.error('Activity logging error:', error);
    }
  }

  // =============================================================================
  // DASHBOARD METRICS
  // =============================================================================

  /**
   * Get dashboard overview metrics
   */
  async getDashboardMetrics() {
    try {
      const { data, error } = await this.supabase
        .from('admin_dashboard_overview')
        .select('*')
        .single();

      if (error) throw error;

      return {
        success: true,
        metrics: data
      };
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
      return {
        success: false,
        error: error.message,
        metrics: this.getDefaultMetrics()
      };
    }
  }

  /**
   * Get historical dashboard metrics
   */
  async getHistoricalMetrics(dateFrom, dateTo) {
    try {
      const { data, error } = await this.supabase
        .from('admin_dashboard_metrics')
        .select('*')
        .gte('metric_date', dateFrom)
        .lte('metric_date', dateTo)
        .order('metric_date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Failed to fetch historical metrics:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Update dashboard metrics manually
   */
  async refreshDashboardMetrics() {
    try {
      const { data, error } = await this.supabase.rpc('update_admin_dashboard_metrics');

      if (error) throw error;

      await this.logActivity('REFRESH_METRICS', 'dashboard');

      return { success: true, message: 'Metrics updated successfully' };
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // EMPLOYEE MANAGEMENT
  // =============================================================================

  /**
   * Get all employees with access status
   */
  async getEmployees(filters = {}) {
    try {
      let query = this.supabase
        .from('admin_employee_performance')
        .select('*');

      if (filters.role) {
        query = query.eq('role', filters.role);
      }

      if (filters.department) {
        query = query.eq('department', filters.department);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('full_name', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        employees: data || []
      };
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      return { success: false, error: error.message, employees: [] };
    }
  }

  /**
   * Update employee access status
   */
  async updateEmployeeAccess(employeeId, accessEnabled, reason = '') {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      // Update or insert access record
      const { data, error } = await this.supabase
        .from('admin_employee_access')
        .upsert({
          employee_id: employeeId,
          access_enabled: accessEnabled,
          access_reason: reason,
          modified_by: user.id,
          modified_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Log the access change
      await this.supabase
        .from('admin_employee_access_audit')
        .insert({
          employee_id: employeeId,
          action: accessEnabled ? 'enabled' : 'disabled',
          new_status: accessEnabled ? 'active' : 'disabled',
          reason,
          performed_by: user.id
        });

      await this.logActivity('UPDATE_EMPLOYEE_ACCESS', 'employee', employeeId, {
        access_enabled: accessEnabled,
        reason
      });

      return {
        success: true,
        message: `Employee access ${accessEnabled ? 'enabled' : 'disabled'} successfully`,
        data
      };
    } catch (error) {
      console.error('Failed to update employee access:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk update employee access
   */
  async bulkUpdateEmployeeAccess(employeeIds, operation, reason = '') {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      const accessEnabled = operation === 'enable';

      // Create bulk operation record
      const { data: bulkOp, error: bulkError } = await this.supabase
        .from('admin_bulk_access_operations')
        .insert({
          operation_type: operation,
          employee_ids: employeeIds,
          total_affected: employeeIds.length,
          reason,
          performed_by: user.id
        })
        .select()
        .single();

      if (bulkError) throw bulkError;

      // Update each employee
      const promises = employeeIds.map(employeeId =>
        this.updateEmployeeAccess(employeeId, accessEnabled, reason)
      );

      await Promise.all(promises);

      await this.logActivity('BULK_UPDATE_ACCESS', 'employees', null, {
        operation,
        count: employeeIds.length,
        reason
      });

      return {
        success: true,
        message: `Successfully ${operation}d ${employeeIds.length} employees`,
        bulkOperationId: bulkOp.id
      };
    } catch (error) {
      console.error('Bulk update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get employee access audit log
   */
  async getEmployeeAccessAudit(employeeId = null, limit = 50) {
    try {
      let query = this.supabase
        .from('admin_employee_access_audit')
        .select(`
          *,
          employee:users!admin_employee_access_audit_employee_id_fkey(email, first_name, last_name),
          performed_by_user:users!admin_employee_access_audit_performed_by_fkey(email, first_name, last_name)
        `)
        .order('performed_at', { ascending: false })
        .limit(limit);

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        auditLog: data || []
      };
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
      return { success: false, error: error.message, auditLog: [] };
    }
  }

  // =============================================================================
  // NOTIFICATIONS
  // =============================================================================

  /**
   * Get admin notifications
   */
  async getNotifications(options = {}) {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      
      let query = this.supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.unreadOnly) {
        query = query.eq('is_read', false);
      }

      if (options.category) {
        query = query.eq('category', options.category);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        notifications: data || [],
        unreadCount: data?.filter(n => !n.is_read).length || 0
      };
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return { success: false, error: error.message, notifications: [], unreadCount: 0 };
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId) {
    try {
      const { error } = await this.supabase
        .from('admin_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      const { error } = await this.supabase
        .from('admin_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('admin_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create notification
   */
  async createNotification(notification) {
    try {
      const { error } = await this.supabase
        .from('admin_notifications')
        .insert(notification);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Failed to create notification:', error);
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // SYSTEM CONFIGURATION
  // =============================================================================

  /**
   * Get system configuration
   */
  async getSystemConfig(category = null) {
    try {
      let query = this.supabase
        .from('admin_system_config')
        .select('*')
        .order('category', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convert to key-value object
      const config = {};
      data?.forEach(item => {
        config[item.config_key] = {
          value: this.parseConfigValue(item.config_value, item.value_type),
          type: item.value_type,
          category: item.category,
          description: item.description
        };
      });

      return {
        success: true,
        config
      };
    } catch (error) {
      console.error('Failed to fetch system config:', error);
      return { success: false, error: error.message, config: {} };
    }
  }

  /**
   * Update system configuration
   */
  async updateSystemConfig(configKey, configValue, reason = '') {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      const { error } = await this.supabase
        .from('admin_system_config')
        .update({
          config_value: String(configValue),
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('config_key', configKey);

      if (error) throw error;

      await this.logActivity('UPDATE_CONFIG', 'system_config', null, {
        config_key: configKey,
        new_value: configValue,
        reason
      });

      return {
        success: true,
        message: 'Configuration updated successfully'
      };
    } catch (error) {
      console.error('Failed to update config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get configuration history
   */
  async getConfigHistory(configKey = null, limit = 50) {
    try {
      let query = this.supabase
        .from('admin_config_history')
        .select(`
          *,
          changed_by_user:users(email, first_name, last_name)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (configKey) {
        query = query.eq('config_key', configKey);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        history: data || []
      };
    } catch (error) {
      console.error('Failed to fetch config history:', error);
      return { success: false, error: error.message, history: [] };
    }
  }

  // =============================================================================
  // PORTAL CONFIGURATION
  // =============================================================================

  /**
   * Get portal configurations
   */
  async getPortalConfigs() {
    try {
      const { data, error } = await this.supabase
        .from('admin_portal_config')
        .select('*')
        .order('portal_name', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        portals: data || []
      };
    } catch (error) {
      console.error('Failed to fetch portal configs:', error);
      return { success: false, error: error.message, portals: [] };
    }
  }

  /**
   * Update portal configuration
   */
  async updatePortalConfig(portalName, updates) {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      const { error } = await this.supabase
        .from('admin_portal_config')
        .update({
          ...updates,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('portal_name', portalName);

      if (error) throw error;

      await this.logActivity('UPDATE_PORTAL_CONFIG', 'portal_config', null, {
        portal_name: portalName,
        updates
      });

      return {
        success: true,
        message: 'Portal configuration updated successfully'
      };
    } catch (error) {
      console.error('Failed to update portal config:', error);
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // PAYMENT MANAGEMENT
  // =============================================================================

  /**
   * Get payment summary
   */
  async getPaymentSummary(filters = {}) {
    try {
      let query = this.supabase
        .from('admin_payment_summary')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        payments: data || []
      };
    } catch (error) {
      console.error('Failed to fetch payment summary:', error);
      return { success: false, error: error.message, payments: [] };
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(dateFrom, dateTo) {
    try {
      const { data, error } = await this.supabase
        .from('admin_payment_statistics')
        .select('*')
        .gte('stat_date', dateFrom)
        .lte('stat_date', dateTo)
        .order('stat_date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        statistics: data || []
      };
    } catch (error) {
      console.error('Failed to fetch payment statistics:', error);
      return { success: false, error: error.message, statistics: [] };
    }
  }

  // =============================================================================
  // SYSTEM MONITORING
  // =============================================================================

  /**
   * Get system health status
   */
  async getSystemHealth(limit = 24) {
    try {
      const { data, error } = await this.supabase
        .from('admin_system_health')
        .select('*')
        .order('check_timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const latest = data?.[0];
      const isHealthy = latest?.database_status === 'healthy' && 
                       latest?.api_status === 'healthy';

      return {
        success: true,
        currentHealth: latest || {},
        history: data || [],
        isHealthy
      };
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      return {
        success: false,
        error: error.message,
        currentHealth: {},
        history: [],
        isHealthy: false
      };
    }
  }

  /**
   * Get API usage statistics
   */
  async getAPIUsage(hours = 24) {
    try {
      const sinceDate = new Date();
      sinceDate.setHours(sinceDate.getHours() - hours);

      const { data, error } = await this.supabase
        .from('admin_api_usage')
        .select('*')
        .gte('timestamp', sinceDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Calculate statistics
      const stats = {
        totalRequests: data?.length || 0,
        successfulRequests: data?.filter(r => r.response_status < 400).length || 0,
        failedRequests: data?.filter(r => r.response_status >= 400).length || 0,
        avgResponseTime: data?.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / (data?.length || 1),
        slowestEndpoint: this.findSlowestEndpoint(data || []),
        mostUsedEndpoint: this.findMostUsedEndpoint(data || [])
      };

      return {
        success: true,
        stats,
        data: data || []
      };
    } catch (error) {
      console.error('Failed to fetch API usage:', error);
      return { success: false, error: error.message, stats: {}, data: [] };
    }
  }

  /**
   * Get error logs
   */
  async getErrorLogs(options = {}) {
    try {
      let query = this.supabase
        .from('admin_error_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (options.level) {
        query = query.eq('error_level', options.level);
      }

      if (options.resolved !== undefined) {
        query = query.eq('resolved', options.resolved);
      }

      if (options.source) {
        query = query.eq('source', options.source);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        errors: data || [],
        unresolvedCount: data?.filter(e => !e.resolved).length || 0
      };
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
      return { success: false, error: error.message, errors: [], unresolvedCount: 0 };
    }
  }

  /**
   * Resolve error
   */
  async resolveError(errorId, resolutionNotes) {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      const { error } = await this.supabase
        .from('admin_error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolutionNotes
        })
        .eq('id', errorId);

      if (error) throw error;

      await this.logActivity('RESOLVE_ERROR', 'error_log', errorId, {
        resolution_notes: resolutionNotes
      });

      return {
        success: true,
        message: 'Error resolved successfully'
      };
    } catch (error) {
      console.error('Failed to resolve error:', error);
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // REPORTS
  // =============================================================================

  /**
   * Generate admin report
   */
  async generateReport(reportType, parameters = {}) {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      const { data, error } = await this.supabase
        .from('admin_reports')
        .insert({
          report_name: `${reportType}_${new Date().getTime()}`,
          report_type: reportType,
          report_format: parameters.format || 'pdf',
          parameters,
          generated_by: user.id,
          date_from: parameters.dateFrom,
          date_to: parameters.dateTo,
          status: 'processing'
        })
        .select()
        .single();

      if (error) throw error;

      await this.logActivity('GENERATE_REPORT', 'report', data.id, {
        report_type: reportType,
        parameters
      });

      return {
        success: true,
        reportId: data.id,
        message: 'Report generation started'
      };
    } catch (error) {
      console.error('Failed to generate report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get reports
   */
  async getReports(reportType = null, limit = 50) {
    try {
      let query = this.supabase
        .from('admin_reports')
        .select(`
          *,
          generated_by_user:users(email, first_name, last_name)
        `)
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        reports: data || []
      };
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      return { success: false, error: error.message, reports: [] };
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  parseConfigValue(value, type) {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === true;
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  findSlowestEndpoint(apiData) {
    if (!apiData.length) return null;
    return apiData.reduce((slowest, current) => 
      (current.response_time_ms || 0) > (slowest.response_time_ms || 0) ? current : slowest
    ).endpoint;
  }

  findMostUsedEndpoint(apiData) {
    if (!apiData.length) return null;
    const endpointCounts = {};
    apiData.forEach(item => {
      endpointCounts[item.endpoint] = (endpointCounts[item.endpoint] || 0) + 1;
    });
    return Object.keys(endpointCounts).reduce((a, b) => 
      endpointCounts[a] > endpointCounts[b] ? a : b
    );
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('admin_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('admin_session_id', sessionId);
    }
    return sessionId;
  }

  async getClientIP() {
    // In a real app, this would be fetched from the server
    return '0.0.0.0';
  }

  getDefaultMetrics() {
    return {
      today_sales: 0,
      today_orders: 0,
      total_employees: 0,
      active_employees: 0,
      total_products: 0,
      low_stock_products: 0,
      total_customers: 0,
      new_customers_today: 0,
      today_revenue: 0,
      month_revenue: 0,
      unresolved_errors_today: 0,
      unread_notifications: 0
    };
  }
}

// Export singleton instance
const adminService = new AdminService();

export { adminService, AdminService };
export default adminService;
