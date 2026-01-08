/**
 * Employee Access Control Service
 * Comprehensive employee login and access management system
 * 
 * Features:
 * - Employee access enable/disable
 * - Individual employee control
 * - Bulk operations
 * - Access audit logging
 * - Real-time notifications
 * - Permission management
 */

class EmployeeAccessService {
    constructor() {
        this.storageKey = 'employee_access_control';
        this.auditLogKey = 'employee_access_audit';
        this.subscribers = [];
        this.init();
    }

    // Initialize service with default settings
    init() {
        if (!localStorage.getItem(this.storageKey)) {
            const defaultSettings = {
                globalEmployeeAccess: true,
                individualControls: {},
                bulkOperations: [],
                lastUpdated: new Date().toISOString(),
                version: 1
            };
            localStorage.setItem(this.storageKey, JSON.stringify(defaultSettings));
        }

        if (!localStorage.getItem(this.auditLogKey)) {
            localStorage.setItem(this.auditLogKey, JSON.stringify([]));
        }
    }

    // Get current access control settings
    getAccessSettings() {
        try {
            const settings = localStorage.getItem(this.storageKey);
            return settings ? JSON.parse(settings) : this.getDefaultSettings();
        } catch (error) {
            console.error('Error loading access settings:', error);
            return this.getDefaultSettings();
        }
    }

    // Get default settings
    getDefaultSettings() {
        return {
            globalEmployeeAccess: true,
            individualControls: {},
            bulkOperations: [],
            lastUpdated: new Date().toISOString(),
            version: 1
        };
    }

    // Toggle global employee access
    async toggleGlobalEmployeeAccess() {
        try {
            const settings = this.getAccessSettings();
            const newStatus = !settings.globalEmployeeAccess;
            
            const updatedSettings = {
                ...settings,
                globalEmployeeAccess: newStatus,
                lastUpdated: new Date().toISOString(),
                version: settings.version + 1
            };

            localStorage.setItem(this.storageKey, JSON.stringify(updatedSettings));
            
            // Log the action
            await this.logAuditEvent('GLOBAL_ACCESS_TOGGLE', {
                status: newStatus ? 'enabled' : 'disabled',
                affectedUsers: 'all_employees'
            });

            // Notify subscribers
            this.notifySubscribers({
                type: 'GLOBAL_ACCESS_CHANGED',
                enabled: newStatus,
                settings: updatedSettings
            });

            return updatedSettings;
        } catch (error) {
            console.error('Error toggling global employee access:', error);
            throw error;
        }
    }

    // Get mock employee list for demonstration
    getEmployeeList() {
        return [
            { id: 'emp001', name: 'John Doe', email: 'john.doe@faredeal.com', department: 'Sales', status: 'active', lastLogin: '2024-10-07T10:30:00Z' },
            { id: 'emp002', name: 'Jane Smith', email: 'jane.smith@faredeal.com', department: 'Inventory', status: 'active', lastLogin: '2024-10-07T09:15:00Z' },
            { id: 'emp003', name: 'Mike Johnson', email: 'mike.johnson@faredeal.com', department: 'Customer Service', status: 'disabled', lastLogin: '2024-10-06T16:45:00Z' },
            { id: 'emp004', name: 'Sarah Wilson', email: 'sarah.wilson@faredeal.com', department: 'Sales', status: 'active', lastLogin: '2024-10-07T08:20:00Z' },
            { id: 'emp005', name: 'David Brown', email: 'david.brown@faredeal.com', department: 'Warehouse', status: 'pending', lastLogin: null },
            { id: 'emp006', name: 'Lisa Garcia', email: 'lisa.garcia@faredeal.com', department: 'Inventory', status: 'active', lastLogin: '2024-10-07T11:10:00Z' },
            { id: 'emp007', name: 'Robert Lee', email: 'robert.lee@faredeal.com', department: 'Security', status: 'active', lastLogin: '2024-10-07T07:30:00Z' },
            { id: 'emp008', name: 'Emily Davis', email: 'emily.davis@faredeal.com', department: 'HR', status: 'disabled', lastLogin: '2024-10-05T14:20:00Z' }
        ];
    }

    // Toggle individual employee access
    async toggleEmployeeAccess(employeeId, newStatus) {
        try {
            const settings = this.getAccessSettings();
            
            settings.individualControls[employeeId] = {
                status: newStatus,
                updatedAt: new Date().toISOString(),
                updatedBy: 'admin' // In real implementation, get from auth context
            };

            settings.lastUpdated = new Date().toISOString();
            settings.version += 1;

            localStorage.setItem(this.storageKey, JSON.stringify(settings));

            // Log the action
            await this.logAuditEvent('INDIVIDUAL_ACCESS_TOGGLE', {
                employeeId,
                status: newStatus,
                previousStatus: settings.individualControls[employeeId]?.status || 'active'
            });

            // Notify subscribers
            this.notifySubscribers({
                type: 'INDIVIDUAL_ACCESS_CHANGED',
                employeeId,
                status: newStatus,
                settings
            });

            return settings;
        } catch (error) {
            console.error('Error toggling employee access:', error);
            throw error;
        }
    }

    // Perform bulk operations
    async performBulkOperation(operation, employeeIds) {
        try {
            const settings = this.getAccessSettings();
            const timestamp = new Date().toISOString();
            
            employeeIds.forEach(employeeId => {
                settings.individualControls[employeeId] = {
                    status: operation === 'enable' ? 'active' : 'disabled',
                    updatedAt: timestamp,
                    updatedBy: 'admin'
                };
            });

            settings.lastUpdated = timestamp;
            settings.version += 1;

            // Record bulk operation
            const bulkOp = {
                id: `bulk_${Date.now()}`,
                operation,
                employeeIds,
                timestamp,
                performedBy: 'admin'
            };

            settings.bulkOperations.push(bulkOp);

            localStorage.setItem(this.storageKey, JSON.stringify(settings));

            // Log the action
            await this.logAuditEvent('BULK_OPERATION', {
                operation,
                affectedEmployees: employeeIds.length,
                employeeIds
            });

            // Notify subscribers
            this.notifySubscribers({
                type: 'BULK_OPERATION_COMPLETED',
                operation,
                affectedCount: employeeIds.length,
                settings
            });

            return {
                success: true,
                affectedCount: employeeIds.length,
                operation: bulkOp
            };
        } catch (error) {
            console.error('Error performing bulk operation:', error);
            throw error;
        }
    }

    // Get employee access status
    getEmployeeAccessStatus(employeeId) {
        const settings = this.getAccessSettings();
        
        // Check global setting first
        if (!settings.globalEmployeeAccess) {
            return 'disabled_globally';
        }

        // Check individual setting
        const individualSetting = settings.individualControls[employeeId];
        return individualSetting ? individualSetting.status : 'active';
    }

    // Log audit events
    async logAuditEvent(action, details) {
        try {
            const auditLog = JSON.parse(localStorage.getItem(this.auditLogKey) || '[]');
            
            const logEntry = {
                id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                action,
                details,
                performedBy: 'admin', // In real implementation, get from auth context
                ip: '192.168.1.1', // Mock IP
                userAgent: navigator.userAgent
            };

            auditLog.unshift(logEntry);

            // Keep only last 1000 entries
            if (auditLog.length > 1000) {
                auditLog.splice(1000);
            }

            localStorage.setItem(this.auditLogKey, JSON.stringify(auditLog));
            return logEntry;
        } catch (error) {
            console.error('Error logging audit event:', error);
        }
    }

    // Get audit log
    getAuditLog(limit = 50) {
        try {
            const auditLog = JSON.parse(localStorage.getItem(this.auditLogKey) || '[]');
            return auditLog.slice(0, limit);
        } catch (error) {
            console.error('Error retrieving audit log:', error);
            return [];
        }
    }

    // Subscribe to access control changes
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    // Notify all subscribers
    notifySubscribers(update) {
        this.subscribers.forEach(callback => {
            try {
                callback(update);
            } catch (error) {
                console.error('Error notifying subscriber:', error);
            }
        });
    }

    // Get access control statistics
    getAccessControlStats() {
        const settings = this.getAccessSettings();
        const employees = this.getEmployeeList();
        
        const stats = {
            totalEmployees: employees.length,
            activeEmployees: 0,
            disabledEmployees: 0,
            pendingEmployees: 0,
            globalAccessEnabled: settings.globalEmployeeAccess,
            recentActions: this.getAuditLog(10).length,
            lastUpdate: settings.lastUpdated
        };

        employees.forEach(employee => {
            const status = this.getEmployeeAccessStatus(employee.id);
            if (status === 'active') stats.activeEmployees++;
            else if (status === 'disabled' || status === 'disabled_globally') stats.disabledEmployees++;
            else if (status === 'pending') stats.pendingEmployees++;
        });

        return stats;
    }

    // Simulate real-time data updates
    simulateRealTimeUpdate() {
        setInterval(() => {
            // Simulate random employee activity
            const randomUpdate = {
                type: 'ACTIVITY_UPDATE',
                timestamp: new Date().toISOString(),
                data: {
                    activeUsers: Math.floor(Math.random() * 20) + 10,
                    failedLoginAttempts: Math.floor(Math.random() * 5),
                    newLoginAttempts: Math.floor(Math.random() * 3)
                }
            };

            this.notifySubscribers(randomUpdate);
        }, 30000); // Update every 30 seconds
    }

    // Test API connection (mock implementation)
    async testConnection() {
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
                connected: true,
                latency: Math.floor(Math.random() * 50) + 10,
                version: '2.1.0'
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    // Export access control configuration
    exportConfiguration() {
        const settings = this.getAccessSettings();
        const auditLog = this.getAuditLog();
        
        return {
            settings,
            auditLog: auditLog.slice(0, 100), // Export last 100 audit entries
            exportedAt: new Date().toISOString(),
            version: '2.1.0'
        };
    }

    // Import access control configuration
    async importConfiguration(configData) {
        try {
            if (!configData.settings || !configData.version) {
                throw new Error('Invalid configuration data');
            }

            localStorage.setItem(this.storageKey, JSON.stringify(configData.settings));
            
            if (configData.auditLog) {
                localStorage.setItem(this.auditLogKey, JSON.stringify(configData.auditLog));
            }

            await this.logAuditEvent('CONFIGURATION_IMPORT', {
                importedAt: new Date().toISOString(),
                sourceVersion: configData.version
            });

            this.notifySubscribers({
                type: 'CONFIGURATION_IMPORTED',
                settings: configData.settings
            });

            return { success: true };
        } catch (error) {
            console.error('Error importing configuration:', error);
            throw error;
        }
    }
}

// Export singleton instance
const employeeAccessService = new EmployeeAccessService();

// Initialize real-time simulation
employeeAccessService.simulateRealTimeUpdate();

export { employeeAccessService, EmployeeAccessService };