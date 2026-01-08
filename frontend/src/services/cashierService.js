/**
 * FAREDEAL Cashier Portal Service
 * Frontend service layer for cashier operations
 * Version: 1.0.0
 * Created: October 8, 2025
 */

const API_BASE_URL = import.meta.env.PROD
    ? (import.meta.env.VITE_API_URL || 'https://api.faredeal.vercel.app/api')
    : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

class CashierService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
   * Get cashier dashboard overview
   */
  async getDashboardOverview(cashierId) {
    const cacheKey = `dashboard_${cashierId}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const data = await this.apiRequest(`/cashier/${cashierId}/dashboard`);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get cashier profile
   */
  async getProfile(cashierId) {
    return await this.apiRequest(`/cashier/${cashierId}/profile`);
  }

  /**
   * Update cashier profile
   */
  async updateProfile(cashierId, profileData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    this.clearCache(`profile_${cashierId}`);
    return result;
  }

  // ===================================================================
  // SHIFT MANAGEMENT
  // ===================================================================

  /**
   * Get current active shift
   */
  async getCurrentShift(cashierId) {
    return await this.apiRequest(`/cashier/${cashierId}/shift/current`);
  }

  /**
   * Open a new shift
   */
  async openShift(cashierId, shiftData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/shift/open`, {
      method: 'POST',
      body: JSON.stringify(shiftData),
    });
    this.clearCache(`shift_${cashierId}`);
    await this.logActivity(cashierId, 'shift_opened', `Opened shift ${result.data.shift_number}`);
    return result;
  }

  /**
   * Close current shift
   */
  async closeShift(cashierId, shiftId, closingData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/shift/${shiftId}/close`, {
      method: 'PUT',
      body: JSON.stringify(closingData),
    });
    this.clearCache(`shift_${cashierId}`);
    await this.logActivity(cashierId, 'shift_closed', `Closed shift ${shiftId}`);
    return result;
  }

  /**
   * Get shift history
   */
  async getShiftHistory(cashierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/cashier/${cashierId}/shifts?${query}`);
  }

  /**
   * Get shift details
   */
  async getShiftDetails(shiftId) {
    return await this.apiRequest(`/cashier/shift/${shiftId}`);
  }

  // ===================================================================
  // CASH DRAWER OPERATIONS
  // ===================================================================

  /**
   * Get drawer status
   */
  async getDrawerStatus(cashierId) {
    return await this.apiRequest(`/cashier/${cashierId}/drawer/status`);
  }

  /**
   * Cash in operation
   */
  async cashIn(cashierId, cashInData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/drawer/cash-in`, {
      method: 'POST',
      body: JSON.stringify(cashInData),
    });
    await this.logActivity(cashierId, 'cash_in', `Cash in: UGX ${cashInData.amount_ugx}`);
    return result;
  }

  /**
   * Cash out operation
   */
  async cashOut(cashierId, cashOutData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/drawer/cash-out`, {
      method: 'POST',
      body: JSON.stringify(cashOutData),
    });
    await this.logActivity(cashierId, 'cash_out', `Cash out: UGX ${cashOutData.amount_ugx}`);
    return result;
  }

  /**
   * Cash drop operation
   */
  async cashDrop(cashierId, dropData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/drawer/drop`, {
      method: 'POST',
      body: JSON.stringify(dropData),
    });
    await this.logActivity(cashierId, 'cash_drop', `Cash drop: UGX ${dropData.amount_ugx}`);
    return result;
  }

  /**
   * Reconcile drawer
   */
  async reconcileDrawer(cashierId, reconciliationData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/drawer/reconcile`, {
      method: 'POST',
      body: JSON.stringify(reconciliationData),
    });
    await this.logActivity(cashierId, 'drawer_reconciliation', 'Reconciled cash drawer');
    return result;
  }

  // ===================================================================
  // TRANSACTIONS & POS
  // ===================================================================

  /**
   * Process new transaction/sale
   */
  async processTransaction(cashierId, transactionData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/transaction`, {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
    this.clearCache(`transactions_${cashierId}`);
    await this.logActivity(cashierId, 'transaction_processed', `Processed transaction ${result.data.transaction_number}`);
    return result;
  }

  /**
   * Get transaction history
   */
  async getTransactions(cashierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/cashier/${cashierId}/transactions?${query}`);
  }

  /**
   * Get transaction details
   */
  async getTransactionDetails(transactionId) {
    return await this.apiRequest(`/cashier/transaction/${transactionId}`);
  }

  /**
   * Void transaction
   */
  async voidTransaction(cashierId, transactionId, voidData) {
    const result = await this.apiRequest(`/cashier/transaction/${transactionId}/void`, {
      method: 'PUT',
      body: JSON.stringify(voidData),
    });
    this.clearCache(`transactions_${cashierId}`);
    await this.logActivity(cashierId, 'transaction_voided', `Voided transaction ${transactionId}`);
    return result;
  }

  /**
   * Print receipt
   */
  async printReceipt(transactionId) {
    return await this.apiRequest(`/cashier/transaction/${transactionId}/receipt`);
  }

  /**
   * Resend digital receipt
   */
  async resendReceipt(transactionId, email) {
    return await this.apiRequest(`/cashier/transaction/${transactionId}/receipt/send`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // ===================================================================
  // RETURNS & REFUNDS
  // ===================================================================

  /**
   * Process return
   */
  async processReturn(cashierId, returnData) {
    const result = await this.apiRequest(`/cashier/${cashierId}/return`, {
      method: 'POST',
      body: JSON.stringify(returnData),
    });
    await this.logActivity(cashierId, 'return_processed', `Processed return ${result.data.return_number}`);
    return result;
  }

  /**
   * Get returns history
   */
  async getReturns(cashierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/cashier/${cashierId}/returns?${query}`);
  }

  /**
   * Get return details
   */
  async getReturnDetails(returnId) {
    return await this.apiRequest(`/cashier/return/${returnId}`);
  }

  /**
   * Approve return
   */
  async approveReturn(returnId, approvalData) {
    return await this.apiRequest(`/cashier/return/${returnId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
  }

  /**
   * Process refund
   */
  async processRefund(returnId, refundData) {
    const result = await this.apiRequest(`/cashier/return/${returnId}/refund`, {
      method: 'POST',
      body: JSON.stringify(refundData),
    });
    return result;
  }

  // ===================================================================
  // CUSTOMER INTERACTIONS
  // ===================================================================

  /**
   * Log customer interaction
   */
  async logInteraction(cashierId, interactionData) {
    return await this.apiRequest(`/cashier/${cashierId}/interaction`, {
      method: 'POST',
      body: JSON.stringify(interactionData),
    });
  }

  /**
   * Get customer interactions
   */
  async getInteractions(cashierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/cashier/${cashierId}/interactions?${query}`);
  }

  /**
   * Update interaction status
   */
  async updateInteraction(interactionId, updateData) {
    return await this.apiRequest(`/cashier/interaction/${interactionId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * Lookup customer
   */
  async lookupCustomer(searchTerm) {
    return await this.apiRequest(`/cashier/customer/lookup?q=${encodeURIComponent(searchTerm)}`);
  }

  /**
   * Get customer transaction history
   */
  async getCustomerHistory(customerId) {
    return await this.apiRequest(`/cashier/customer/${customerId}/history`);
  }

  // ===================================================================
  // PERFORMANCE & REPORTING
  // ===================================================================

  /**
   * Get daily report
   */
  async getDailyReport(cashierId, date) {
    const cacheKey = `daily_report_${cashierId}_${date}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const data = await this.apiRequest(`/cashier/${cashierId}/report/daily?date=${date}`);
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Submit daily report
   */
  async submitDailyReport(cashierId, reportData) {
    return await this.apiRequest(`/cashier/${cashierId}/report/daily`, {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(cashierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/cashier/${cashierId}/performance?${query}`);
  }

  /**
   * Get sales summary
   */
  async getSalesSummary(cashierId, period = 'today') {
    return await this.apiRequest(`/cashier/${cashierId}/sales/summary?period=${period}`);
  }

  /**
   * Get payment methods breakdown
   */
  async getPaymentMethodsBreakdown(cashierId, date) {
    return await this.apiRequest(`/cashier/${cashierId}/payments/breakdown?date=${date}`);
  }

  // ===================================================================
  // ALERTS & NOTIFICATIONS
  // ===================================================================

  /**
   * Get cashier alerts
   */
  async getAlerts(cashierId, filter = 'unread') {
    return await this.apiRequest(`/cashier/${cashierId}/alerts?filter=${filter}`);
  }

  /**
   * Mark alert as read
   */
  async markAlertRead(alertId) {
    return await this.apiRequest(`/cashier/alert/${alertId}/read`, {
      method: 'PUT',
    });
  }

  /**
   * Mark all alerts as read
   */
  async markAllAlertsRead(cashierId) {
    const result = await this.apiRequest(`/cashier/${cashierId}/alerts/read-all`, {
      method: 'PUT',
    });
    this.clearCache(`alerts_${cashierId}`);
    return result;
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(alertId) {
    return await this.apiRequest(`/cashier/alert/${alertId}/dismiss`, {
      method: 'DELETE',
    });
  }

  // ===================================================================
  // TRAINING & HELP
  // ===================================================================

  /**
   * Get training records
   */
  async getTrainingRecords(cashierId) {
    return await this.apiRequest(`/cashier/${cashierId}/training`);
  }

  /**
   * Get help articles
   */
  async getHelpArticles(category = null) {
    const query = category ? `?category=${category}` : '';
    return await this.apiRequest(`/cashier/help${query}`);
  }

  /**
   * Search help
   */
  async searchHelp(searchTerm) {
    return await this.apiRequest(`/cashier/help/search?q=${encodeURIComponent(searchTerm)}`);
  }

  // ===================================================================
  // ACTIVITY LOG
  // ===================================================================

  /**
   * Log activity
   */
  async logActivity(cashierId, activityType, description, metadata = {}) {
    try {
      await this.apiRequest('/cashier/activity/log', {
        method: 'POST',
        body: JSON.stringify({
          cashier_id: cashierId,
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
  async getActivityLog(cashierId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.apiRequest(`/cashier/${cashierId}/activity?${query}`);
  }

  // ===================================================================
  // PRODUCT LOOKUP & PRICING
  // ===================================================================

  /**
   * Search products
   */
  async searchProducts(searchTerm) {
    return await this.apiRequest(`/cashier/products/search?q=${encodeURIComponent(searchTerm)}`);
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode) {
    return await this.apiRequest(`/cashier/products/barcode/${barcode}`);
  }

  /**
   * Get product details
   */
  async getProductDetails(productId) {
    return await this.apiRequest(`/cashier/products/${productId}`);
  }

  /**
   * Check product availability
   */
  async checkProductAvailability(productId) {
    return await this.apiRequest(`/cashier/products/${productId}/availability`);
  }

  /**
   * Get price for product
   */
  async getProductPrice(productId, quantity = 1) {
    return await this.apiRequest(`/cashier/products/${productId}/price?quantity=${quantity}`);
  }

  /**
   * Apply discount
   */
  async applyDiscount(cashierId, discountData) {
    return await this.apiRequest(`/cashier/${cashierId}/discount/apply`, {
      method: 'POST',
      body: JSON.stringify(discountData),
    });
  }

  /**
   * Validate discount code
   */
  async validateDiscountCode(code) {
    return await this.apiRequest(`/cashier/discount/validate?code=${code}`);
  }

  // ===================================================================
  // PAYMENT PROCESSING
  // ===================================================================

  /**
   * Process payment
   */
  async processPayment(cashierId, paymentData) {
    return await this.apiRequest(`/cashier/${cashierId}/payment/process`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  /**
   * Verify mobile money payment
   */
  async verifyMobileMoneyPayment(transactionRef) {
    return await this.apiRequest(`/cashier/payment/mobile-money/verify`, {
      method: 'POST',
      body: JSON.stringify({ transaction_ref: transactionRef }),
    });
  }

  /**
   * Process card payment
   */
  async processCardPayment(cashierId, cardData) {
    return await this.apiRequest(`/cashier/${cashierId}/payment/card`, {
      method: 'POST',
      body: JSON.stringify(cardData),
    });
  }

  /**
   * Split payment (multiple payment methods)
   */
  async processSplitPayment(cashierId, splitPaymentData) {
    return await this.apiRequest(`/cashier/${cashierId}/payment/split`, {
      method: 'POST',
      body: JSON.stringify(splitPaymentData),
    });
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
   * Calculate change
   */
  calculateChange(totalAmount, amountPaid) {
    return Math.max(0, amountPaid - totalAmount);
  }

  /**
   * Calculate tax
   */
  calculateTax(amount, taxRate = 18) {
    return amount * (taxRate / 100);
  }

  /**
   * Calculate discount
   */
  calculateDiscount(amount, discountPercentage) {
    return amount * (discountPercentage / 100);
  }

  /**
   * Generate receipt data
   */
  generateReceiptData(transaction) {
    return {
      transaction_number: transaction.transaction_number,
      receipt_number: transaction.receipt_number,
      date: new Date(transaction.created_at).toLocaleString('en-UG'),
      cashier: transaction.cashier_name,
      items: transaction.items,
      subtotal: this.formatCurrency(transaction.subtotal_ugx),
      discount: this.formatCurrency(transaction.discount_ugx),
      tax: this.formatCurrency(transaction.tax_ugx),
      total: this.formatCurrency(transaction.total_amount_ugx),
      payment_method: transaction.payment_method,
      amount_paid: this.formatCurrency(transaction.amount_paid_ugx),
      change: this.formatCurrency(transaction.change_given_ugx),
    };
  }
}

// Export singleton instance
const cashierService = new CashierService();
export default cashierService;
