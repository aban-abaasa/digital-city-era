/**
 * Manager Service
 * Comprehensive service for manager portal operations
 * Connects frontend with backend manager APIs
 * 
 * Features:
 * - Team Management
 * - Inventory Control
 * - Sales Tracking
 * - Performance Metrics
 * - Customer Service
 * - Employee Scheduling
 * - Real-time Alerts
 */

class ManagerService {
    constructor() {
        if (import.meta.env.PROD) {
            this.baseURL = import.meta.env.VITE_API_URL || 'https://api.faredeal.vercel.app/api';
        } else {
            this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        }
        this.token = localStorage.getItem('auth_token');
        this.managerId = this.getCurrentManagerId();
    }

    /**
     * Get current manager ID from auth
     */
    getCurrentManagerId() {
        const userProfile = localStorage.getItem('user_profile');
        if (userProfile) {
            try {
                const profile = JSON.parse(userProfile);
                return profile.id;
            } catch (error) {
                console.error('Error parsing user profile:', error);
            }
        }
        return null;
    }

    /**
     * Generic API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { Authorization: `Bearer ${this.token}` }),
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Manager API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // =============================================================================
    // DASHBOARD & OVERVIEW
    // =============================================================================

    /**
     * Get manager dashboard overview
     */
    async getDashboardOverview() {
        try {
            const response = await this.request('/manager/dashboard');
            
            // Cache for offline access
            localStorage.setItem('manager_dashboard', JSON.stringify(response.data));
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            // Return cached data if available
            const cached = localStorage.getItem('manager_dashboard');
            if (cached) {
                return {
                    success: true,
                    data: JSON.parse(cached),
                    cached: true
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get manager performance metrics
     */
    async getPerformanceMetrics(period = 'monthly') {
        try {
            const response = await this.request(`/manager/performance?period=${period}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Submit daily report
     */
    async submitDailyReport(reportData) {
        try {
            const response = await this.request('/manager/daily-report', {
                method: 'POST',
                body: JSON.stringify(reportData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Daily report submitted successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // TEAM MANAGEMENT
    // =============================================================================

    /**
     * Get manager's team
     */
    async getTeam() {
        try {
            const response = await this.request('/manager/team');
            
            localStorage.setItem('manager_team', JSON.stringify(response.data));
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            const cached = localStorage.getItem('manager_team');
            if (cached) {
                return {
                    success: true,
                    data: JSON.parse(cached),
                    cached: true
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get team performance
     */
    async getTeamPerformance() {
        try {
            const response = await this.request('/manager/team/performance');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Add team member
     */
    async addTeamMember(memberData) {
        try {
            const response = await this.request('/manager/team/members', {
                method: 'POST',
                body: JSON.stringify(memberData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Team member added successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Remove team member
     */
    async removeTeamMember(memberId) {
        try {
            const response = await this.request(`/manager/team/members/${memberId}`, {
                method: 'DELETE'
            });
            
            return {
                success: true,
                message: 'Team member removed successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // EMPLOYEE SCHEDULING & ATTENDANCE
    // =============================================================================

    /**
     * Get employee schedules
     */
    async getSchedules(dateFrom, dateTo) {
        try {
            const params = new URLSearchParams({
                dateFrom: dateFrom || new Date().toISOString().split('T')[0],
                dateTo: dateTo || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });
            
            const response = await this.request(`/manager/schedules?${params}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create employee schedule
     */
    async createSchedule(scheduleData) {
        try {
            const response = await this.request('/manager/schedules', {
                method: 'POST',
                body: JSON.stringify(scheduleData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Schedule created successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get employee attendance
     */
    async getAttendance(date) {
        try {
            const response = await this.request(`/manager/attendance?date=${date || new Date().toISOString().split('T')[0]}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Mark attendance
     */
    async markAttendance(attendanceData) {
        try {
            const response = await this.request('/manager/attendance', {
                method: 'POST',
                body: JSON.stringify(attendanceData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Attendance marked successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // INVENTORY MANAGEMENT
    // =============================================================================

    /**
     * Get inventory status
     */
    async getInventoryStatus() {
        try {
            const response = await this.request('/manager/inventory/status');
            
            localStorage.setItem('manager_inventory_status', JSON.stringify(response.data));
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            const cached = localStorage.getItem('manager_inventory_status');
            if (cached) {
                return {
                    success: true,
                    data: JSON.parse(cached),
                    cached: true
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create stock request
     */
    async createStockRequest(requestData) {
        try {
            const response = await this.request('/manager/stock-requests', {
                method: 'POST',
                body: JSON.stringify(requestData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Stock request created successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get stock requests
     */
    async getStockRequests(status = 'all') {
        try {
            const response = await this.request(`/manager/stock-requests?status=${status}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create inventory audit
     */
    async createInventoryAudit(auditData) {
        try {
            const response = await this.request('/manager/inventory/audits', {
                method: 'POST',
                body: JSON.stringify(auditData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Inventory audit created successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get inventory audits
     */
    async getInventoryAudits(status = 'all') {
        try {
            const response = await this.request(`/manager/inventory/audits?status=${status}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // SALES & PERFORMANCE
    // =============================================================================

    /**
     * Get sales analysis
     */
    async getSalesAnalysis(period = 'today') {
        try {
            const response = await this.request(`/manager/sales/analysis?period=${period}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get sales targets
     */
    async getSalesTargets() {
        try {
            const response = await this.request('/manager/sales/targets');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update sales target
     */
    async updateSalesTarget(targetId, targetData) {
        try {
            const response = await this.request(`/manager/sales/targets/${targetId}`, {
                method: 'PUT',
                body: JSON.stringify(targetData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Sales target updated successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // CUSTOMER SERVICE
    // =============================================================================

    /**
     * Get customer complaints
     */
    async getCustomerComplaints(status = 'all') {
        try {
            const response = await this.request(`/manager/complaints?status=${status}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create customer complaint
     */
    async createComplaint(complaintData) {
        try {
            const response = await this.request('/manager/complaints', {
                method: 'POST',
                body: JSON.stringify(complaintData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Complaint logged successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update complaint status
     */
    async updateComplaintStatus(complaintId, statusData) {
        try {
            const response = await this.request(`/manager/complaints/${complaintId}/status`, {
                method: 'PUT',
                body: JSON.stringify(statusData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Complaint updated successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get refunds and returns
     */
    async getRefundsReturns(status = 'all') {
        try {
            const response = await this.request(`/manager/refunds?status=${status}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process refund
     */
    async processRefund(refundData) {
        try {
            const response = await this.request('/manager/refunds', {
                method: 'POST',
                body: JSON.stringify(refundData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Refund processed successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Approve refund
     */
    async approveRefund(refundId, approvalData) {
        try {
            const response = await this.request(`/manager/refunds/${refundId}/approve`, {
                method: 'PUT',
                body: JSON.stringify(approvalData)
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Refund approved successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // REPORTS & ANALYTICS
    // =============================================================================

    /**
     * Generate report
     */
    async generateReport(reportType, parameters) {
        try {
            const response = await this.request('/manager/reports/generate', {
                method: 'POST',
                body: JSON.stringify({
                    reportType,
                    parameters
                })
            });
            
            return {
                success: true,
                data: response.data,
                message: 'Report generated successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get saved reports
     */
    async getSavedReports() {
        try {
            const response = await this.request('/manager/reports');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Download report
     */
    async downloadReport(reportId) {
        try {
            const response = await fetch(`${this.baseURL}/manager/reports/${reportId}/download`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to download report');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            return {
                success: true,
                message: 'Report downloaded successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // ALERTS & NOTIFICATIONS
    // =============================================================================

    /**
     * Get manager alerts
     */
    async getAlerts(filter = 'unread') {
        try {
            const response = await this.request(`/manager/alerts?filter=${filter}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Mark alert as read
     */
    async markAlertRead(alertId) {
        try {
            const response = await this.request(`/manager/alerts/${alertId}/read`, {
                method: 'PUT'
            });
            
            return {
                success: true,
                message: 'Alert marked as read'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Mark all alerts as read
     */
    async markAllAlertsRead() {
        try {
            const response = await this.request('/manager/alerts/read-all', {
                method: 'PUT'
            });
            
            return {
                success: true,
                message: 'All alerts marked as read'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // ACTIVITY LOGGING
    // =============================================================================

    /**
     * Log manager activity
     */
    async logActivity(activityData) {
        try {
            const response = await this.request('/manager/activity/log', {
                method: 'POST',
                body: JSON.stringify({
                    ...activityData,
                    managerId: this.managerId,
                    timestamp: new Date().toISOString()
                })
            });
            
            return {
                success: true
            };
        } catch (error) {
            // Activity logging is not critical, so just log the error
            console.warn('Failed to log activity:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get activity log
     */
    async getActivityLog(limit = 50) {
        try {
            const response = await this.request(`/manager/activity/log?limit=${limit}`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Sync all manager data
     */
    async syncAllData() {
        console.log('🔄 Syncing all manager data...');
        
        try {
            const [dashboard, team, inventory, alerts] = await Promise.allSettled([
                this.getDashboardOverview(),
                this.getTeam(),
                this.getInventoryStatus(),
                this.getAlerts()
            ]);

            const results = {
                dashboard: dashboard.status === 'fulfilled' ? dashboard.value : null,
                team: team.status === 'fulfilled' ? team.value : null,
                inventory: inventory.status === 'fulfilled' ? inventory.value : null,
                alerts: alerts.status === 'fulfilled' ? alerts.value : null
            };

            console.log('✅ Manager data sync completed');
            return results;
            
        } catch (error) {
            console.error('❌ Manager data sync failed:', error);
            throw error;
        }
    }

    /**
     * Clear cached data
     */
    clearCache() {
        localStorage.removeItem('manager_dashboard');
        localStorage.removeItem('manager_team');
        localStorage.removeItem('manager_inventory_status');
        console.log('🗑️ Manager cache cleared');
    }

    /**
     * Check connection status
     */
    async checkConnection() {
        try {
            await this.request('/health');
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Create and export singleton instance
const managerService = new ManagerService();

export { managerService, ManagerService };
export default managerService;
