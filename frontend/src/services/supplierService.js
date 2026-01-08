/**
 * FAREDEAL Supplier Portal Service
 * Frontend service layer for supplier management operations
 * Version: 1.0.0
 * Created: October 8, 2025
 */

const API_BASE_URL = import.meta.env.PROD
    ? (import.meta.env.VITE_API_URL || 'https://api.faredeal.vercel.app/api')
    : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

class SupplierService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Helper method to make API requests
   */
  async apiRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Cache management
   */
  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // ===================================================================
  // DASHBOARD & OVERVIEW
  // ===================================================================

  /**
   * Get suppliers dashboard overview
   */
  async getDashboardOverview() {
    const cacheKey = 'suppliers_dashboard';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const data = await this.apiRequest('/suppliers/dashboard');
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get supplier statistics
   */
  async getStatistics(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/statistics?${query}`);
  }

  // ===================================================================
  // SUPPLIER MANAGEMENT
  // ===================================================================

  /**
   * Get all suppliers
   */
  async getSuppliers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers?${query}`);
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(supplierId) {
    const cacheKey = `supplier_${supplierId}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const data = await this.apiRequest(`/suppliers/${supplierId}`);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Create new supplier
   */
  async createSupplier(supplierData) {
    const result = await this.apiRequest('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData),
    });
    this.clearCache('suppliers');
    await this.logActivity('supplier_created', `Created supplier ${result.data.business_name}`, { supplier_id: result.data.id });
    return result;
  }

  /**
   * Update supplier
   */
  async updateSupplier(supplierId, supplierData) {
    const result = await this.apiRequest(`/suppliers/${supplierId}`, {
      method: 'PUT',
      body: JSON.stringify(supplierData),
    });
    this.clearCache(`supplier_${supplierId}`);
    await this.logActivity('supplier_updated', `Updated supplier ${supplierId}`, { supplier_id: supplierId });
    return result;
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(supplierId) {
    const result = await this.apiRequest(`/suppliers/${supplierId}`, {
      method: 'DELETE',
    });
    this.clearCache();
    await this.logActivity('supplier_deleted', `Deleted supplier ${supplierId}`, { supplier_id: supplierId });
    return result;
  }

  /**
   * Activate/Deactivate supplier
   */
  async toggleSupplierStatus(supplierId, status) {
    const result = await this.apiRequest(`/suppliers/${supplierId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    this.clearCache(`supplier_${supplierId}`);
    return result;
  }

  /**
   * Get supplier performance
   */
  async getSupplierPerformance(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/performance?${query}`);
  }

  // ===================================================================
  // SUPPLIER PRODUCTS CATALOG
  // ===================================================================

  /**
   * Get supplier products
   */
  async getSupplierProducts(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/products?${query}`);
  }

  /**
   * Add product to supplier catalog
   */
  async addSupplierProduct(supplierId, productData) {
    const result = await this.apiRequest(`/suppliers/${supplierId}/products`, {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    this.clearCache(`supplier_products_${supplierId}`);
    return result;
  }

  /**
   * Update supplier product
   */
  async updateSupplierProduct(supplierId, productId, productData) {
    const result = await this.apiRequest(`/suppliers/${supplierId}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
    this.clearCache(`supplier_products_${supplierId}`);
    return result;
  }

  /**
   * Delete supplier product
   */
  async deleteSupplierProduct(supplierId, productId) {
    return await this.apiRequest(`/suppliers/${supplierId}/products/${productId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Bulk update supplier products
   */
  async bulkUpdateProducts(supplierId, productsData) {
    return await this.apiRequest(`/suppliers/${supplierId}/products/bulk`, {
      method: 'PUT',
      body: JSON.stringify(productsData),
    });
  }

  // ===================================================================
  // PURCHASE ORDERS
  // ===================================================================

  /**
   * Get all purchase orders
   */
  async getPurchaseOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/purchase-orders?${query}`);
  }

  /**
   * Get purchase order by ID
   */
  async getPurchaseOrderById(poId) {
    return await this.apiRequest(`/purchase-orders/${poId}`);
  }

  /**
   * Create purchase order
   */
  async createPurchaseOrder(poData) {
    const result = await this.apiRequest('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(poData),
    });
    this.clearCache('purchase_orders');
    await this.logActivity('po_created', `Created PO ${result.data.po_number}`, { po_id: result.data.id });
    return result;
  }

  /**
   * Update purchase order
   */
  async updatePurchaseOrder(poId, poData) {
    const result = await this.apiRequest(`/purchase-orders/${poId}`, {
      method: 'PUT',
      body: JSON.stringify(poData),
    });
    this.clearCache();
    await this.logActivity('po_updated', `Updated PO ${poId}`, { po_id: poId });
    return result;
  }

  /**
   * Approve purchase order
   */
  async approvePurchaseOrder(poId, approvalData) {
    const result = await this.apiRequest(`/purchase-orders/${poId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
    this.clearCache();
    await this.logActivity('po_approved', `Approved PO ${poId}`, { po_id: poId });
    return result;
  }

  /**
   * Send purchase order to supplier
   */
  async sendPurchaseOrder(poId, sendData) {
    return await this.apiRequest(`/purchase-orders/${poId}/send`, {
      method: 'POST',
      body: JSON.stringify(sendData),
    });
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(poId, cancellationData) {
    const result = await this.apiRequest(`/purchase-orders/${poId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify(cancellationData),
    });
    this.clearCache();
    await this.logActivity('po_cancelled', `Cancelled PO ${poId}`, { po_id: poId });
    return result;
  }

  /**
   * Get purchase order by supplier
   */
  async getPurchaseOrdersBySupplier(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/purchase-orders?${query}`);
  }

  // ===================================================================
  // DELIVERIES
  // ===================================================================

  /**
   * Get all deliveries
   */
  async getDeliveries(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/deliveries?${query}`);
  }

  /**
   * Get delivery by ID
   */
  async getDeliveryById(deliveryId) {
    return await this.apiRequest(`/deliveries/${deliveryId}`);
  }

  /**
   * Record delivery
   */
  async recordDelivery(deliveryData) {
    const result = await this.apiRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify(deliveryData),
    });
    this.clearCache('deliveries');
    await this.logActivity('delivery_recorded', `Recorded delivery ${result.data.delivery_number}`, { delivery_id: result.data.id });
    return result;
  }

  /**
   * Update delivery
   */
  async updateDelivery(deliveryId, deliveryData) {
    const result = await this.apiRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify(deliveryData),
    });
    this.clearCache();
    return result;
  }

  /**
   * Approve delivery (quality check)
   */
  async approveDelivery(deliveryId, approvalData) {
    const result = await this.apiRequest(`/deliveries/${deliveryId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
    await this.logActivity('delivery_approved', `Approved delivery ${deliveryId}`, { delivery_id: deliveryId });
    return result;
  }

  /**
   * Reject delivery items
   */
  async rejectDeliveryItems(deliveryId, rejectionData) {
    const result = await this.apiRequest(`/deliveries/${deliveryId}/reject`, {
      method: 'PUT',
      body: JSON.stringify(rejectionData),
    });
    await this.logActivity('delivery_rejected', `Rejected items in delivery ${deliveryId}`, { delivery_id: deliveryId });
    return result;
  }

  /**
   * Get deliveries by supplier
   */
  async getDeliveriesBySupplier(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/deliveries?${query}`);
  }

  // ===================================================================
  // INVOICES
  // ===================================================================

  /**
   * Get all invoices
   */
  async getInvoices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/supplier-invoices?${query}`);
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId) {
    return await this.apiRequest(`/supplier-invoices/${invoiceId}`);
  }

  /**
   * Create invoice
   */
  async createInvoice(invoiceData) {
    const result = await this.apiRequest('/supplier-invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
    this.clearCache('invoices');
    await this.logActivity('invoice_created', `Created invoice ${result.data.invoice_number}`, { invoice_id: result.data.id });
    return result;
  }

  /**
   * Update invoice
   */
  async updateInvoice(invoiceId, invoiceData) {
    const result = await this.apiRequest(`/supplier-invoices/${invoiceId}`, {
      method: 'PUT',
      body: JSON.stringify(invoiceData),
    });
    this.clearCache();
    return result;
  }

  /**
   * Approve invoice
   */
  async approveInvoice(invoiceId, approvalData) {
    const result = await this.apiRequest(`/supplier-invoices/${invoiceId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
    await this.logActivity('invoice_approved', `Approved invoice ${invoiceId}`, { invoice_id: invoiceId });
    return result;
  }

  /**
   * Dispute invoice
   */
  async disputeInvoice(invoiceId, disputeData) {
    const result = await this.apiRequest(`/supplier-invoices/${invoiceId}/dispute`, {
      method: 'PUT',
      body: JSON.stringify(disputeData),
    });
    await this.logActivity('invoice_disputed', `Disputed invoice ${invoiceId}`, { invoice_id: invoiceId });
    return result;
  }

  /**
   * Get outstanding invoices
   */
  async getOutstandingInvoices(supplierId = null) {
    const endpoint = supplierId 
      ? `/suppliers/${supplierId}/invoices/outstanding`
      : '/supplier-invoices/outstanding';
    return await this.apiRequest(endpoint);
  }

  /**
   * Get invoices by supplier
   */
  async getInvoicesBySupplier(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/invoices?${query}`);
  }

  // ===================================================================
  // PAYMENTS
  // ===================================================================

  /**
   * Get all payments
   */
  async getPayments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/supplier-payments?${query}`);
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId) {
    return await this.apiRequest(`/supplier-payments/${paymentId}`);
  }

  /**
   * Create payment
   */
  async createPayment(paymentData) {
    const result = await this.apiRequest('/supplier-payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    this.clearCache();
    await this.logActivity('payment_created', `Created payment ${result.data.payment_number}`, { payment_id: result.data.id });
    return result;
  }

  /**
   * Approve payment
   */
  async approvePayment(paymentId, approvalData) {
    const result = await this.apiRequest(`/supplier-payments/${paymentId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
    await this.logActivity('payment_approved', `Approved payment ${paymentId}`, { payment_id: paymentId });
    return result;
  }

  /**
   * Record payment completion
   */
  async completePayment(paymentId, completionData) {
    const result = await this.apiRequest(`/supplier-payments/${paymentId}/complete`, {
      method: 'PUT',
      body: JSON.stringify(completionData),
    });
    await this.logActivity('payment_completed', `Completed payment ${paymentId}`, { payment_id: paymentId });
    return result;
  }

  /**
   * Get payments by supplier
   */
  async getPaymentsBySupplier(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/payments?${query}`);
  }

  /**
   * Get payment summary
   */
  async getPaymentSummary(supplierId = null, params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = supplierId 
      ? `/suppliers/${supplierId}/payments/summary?${query}`
      : `/supplier-payments/summary?${query}`;
    return await this.apiRequest(endpoint);
  }

  // ===================================================================
  // CONTRACTS
  // ===================================================================

  /**
   * Get all contracts
   */
  async getContracts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/supplier-contracts?${query}`);
  }

  /**
   * Get contract by ID
   */
  async getContractById(contractId) {
    return await this.apiRequest(`/supplier-contracts/${contractId}`);
  }

  /**
   * Create contract
   */
  async createContract(contractData) {
    const result = await this.apiRequest('/supplier-contracts', {
      method: 'POST',
      body: JSON.stringify(contractData),
    });
    await this.logActivity('contract_created', `Created contract ${result.data.contract_number}`, { contract_id: result.data.id });
    return result;
  }

  /**
   * Update contract
   */
  async updateContract(contractId, contractData) {
    return await this.apiRequest(`/supplier-contracts/${contractId}`, {
      method: 'PUT',
      body: JSON.stringify(contractData),
    });
  }

  /**
   * Activate contract
   */
  async activateContract(contractId) {
    return await this.apiRequest(`/supplier-contracts/${contractId}/activate`, {
      method: 'PUT',
    });
  }

  /**
   * Terminate contract
   */
  async terminateContract(contractId, terminationData) {
    const result = await this.apiRequest(`/supplier-contracts/${contractId}/terminate`, {
      method: 'PUT',
      body: JSON.stringify(terminationData),
    });
    await this.logActivity('contract_terminated', `Terminated contract ${contractId}`, { contract_id: contractId });
    return result;
  }

  /**
   * Get contracts by supplier
   */
  async getContractsBySupplier(supplierId) {
    return await this.apiRequest(`/suppliers/${supplierId}/contracts`);
  }

  /**
   * Get expiring contracts
   */
  async getExpiringContracts(days = 30) {
    return await this.apiRequest(`/supplier-contracts/expiring?days=${days}`);
  }

  // ===================================================================
  // COMMUNICATIONS
  // ===================================================================

  /**
   * Get communications log
   */
  async getCommunications(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/communications?${query}`);
  }

  /**
   * Log communication
   */
  async logCommunication(supplierId, communicationData) {
    return await this.apiRequest(`/suppliers/${supplierId}/communications`, {
      method: 'POST',
      body: JSON.stringify(communicationData),
    });
  }

  /**
   * Update communication
   */
  async updateCommunication(communicationId, updateData) {
    return await this.apiRequest(`/supplier-communications/${communicationId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * Get pending follow-ups
   */
  async getPendingFollowUps() {
    return await this.apiRequest('/supplier-communications/follow-ups/pending');
  }

  // ===================================================================
  // SUPPLIER ALERTS
  // ===================================================================

  /**
   * Get supplier alerts
   */
  async getAlerts(supplierId = null, filter = 'unread') {
    const endpoint = supplierId 
      ? `/suppliers/${supplierId}/alerts?filter=${filter}`
      : `/supplier-alerts?filter=${filter}`;
    return await this.apiRequest(endpoint);
  }

  /**
   * Mark alert as read
   */
  async markAlertRead(alertId) {
    return await this.apiRequest(`/supplier-alerts/${alertId}/read`, {
      method: 'PUT',
    });
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId, resolutionData) {
    return await this.apiRequest(`/supplier-alerts/${alertId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify(resolutionData),
    });
  }

  // ===================================================================
  // DOCUMENTS
  // ===================================================================

  /**
   * Get supplier documents
   */
  async getDocuments(supplierId) {
    return await this.apiRequest(`/suppliers/${supplierId}/documents`);
  }

  /**
   * Upload document
   */
  async uploadDocument(supplierId, documentData) {
    return await this.apiRequest(`/suppliers/${supplierId}/documents`, {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  }

  /**
   * Verify document
   */
  async verifyDocument(documentId, verificationData) {
    return await this.apiRequest(`/supplier-documents/${documentId}/verify`, {
      method: 'PUT',
      body: JSON.stringify(verificationData),
    });
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId) {
    return await this.apiRequest(`/supplier-documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  // ===================================================================
  // REPORTS & ANALYTICS
  // ===================================================================

  /**
   * Get supplier performance report
   */
  async getPerformanceReport(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/reports/performance?${query}`);
  }

  /**
   * Get procurement summary
   */
  async getProcurementSummary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/reports/procurement-summary?${query}`);
  }

  /**
   * Get spend analysis
   */
  async getSpendAnalysis(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/reports/spend-analysis?${query}`);
  }

  /**
   * Get top suppliers
   */
  async getTopSuppliers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/reports/top-suppliers?${query}`);
  }

  // ===================================================================
  // ACTIVITY LOG
  // ===================================================================

  /**
   * Log activity
   */
  async logActivity(activityType, description, metadata = {}) {
    try {
      await this.apiRequest('/supplier/activity/log', {
        method: 'POST',
        body: JSON.stringify({
          activity_type: activityType,
          activity_description: description,
          metadata,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to prevent blocking main operations
    }
  }

  /**
   * Get activity log
   */
  async getActivityLog(supplierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/suppliers/${supplierId}/activity?${query}`);
  }

  // ===================================================================
  // UTILITY METHODS
  // ===================================================================

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Calculate payment due days
   */
  calculateDueDays(dueDate) {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get payment urgency status
   */
  getPaymentUrgency(dueDate) {
    const days = this.calculateDueDays(dueDate);
    if (days < 0) return { status: 'overdue', severity: 'critical', days: Math.abs(days) };
    if (days === 0) return { status: 'due_today', severity: 'urgent', days: 0 };
    if (days <= 7) return { status: 'due_soon', severity: 'warning', days };
    return { status: 'on_track', severity: 'info', days };
  }

  /**
   * Calculate delivery performance
   */
  calculateDeliveryPerformance(orders) {
    const completed = orders.filter(o => o.status === 'completed');
    const onTime = completed.filter(o => 
      new Date(o.actual_delivery_date) <= new Date(o.expected_delivery_date)
    );
    return {
      total: orders.length,
      completed: completed.length,
      onTime: onTime.length,
      onTimeRate: completed.length > 0 ? (onTime.length / completed.length * 100).toFixed(2) : 0,
    };
  }

  /**
   * Validate supplier data
   */
  validateSupplierData(data) {
    const errors = [];
    
    if (!data.business_name || data.business_name.trim().length === 0) {
      errors.push('Business name is required');
    }
    
    if (!data.contact_person_name || data.contact_person_name.trim().length === 0) {
      errors.push('Contact person name is required');
    }
    
    if (!data.contact_person_phone || !/^(\+256|0)[0-9]{9}$/.test(data.contact_person_phone)) {
      errors.push('Valid Ugandan phone number is required');
    }
    
    if (!data.contact_person_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_person_email)) {
      errors.push('Valid email is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
const supplierService = new SupplierService();
export default supplierService;
