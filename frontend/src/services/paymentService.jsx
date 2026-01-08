import { apiService } from './apiService';
import { supabase, handleSupabaseError } from './supabaseClient';

// Enhanced Payment Service with Supabase integration
export const paymentService = {
  // Process different types of payments with enhanced error handling
  processPayment: async (paymentData) => {
    try {
      // Enhanced pre-processing validation
      const validation = await paymentService.validatePaymentRequest(paymentData);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.error,
          errorCode: validation.errorCode
        };
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      // Run fraud detection
      const fraudCheck = await paymentService.fraudDetection(paymentData);
      if (fraudCheck.riskLevel === 'high') {
        return {
          success: false,
          message: 'Transaction flagged for manual review due to high risk score',
          errorCode: 'FRAUD_DETECTED',
          requiresManualReview: true
        };
      }

      // Process the payment based on method
      let result;
      switch (paymentData.method) {
        case 'card':
          result = await paymentService.processCardTransaction(paymentData);
          break;
        case 'digital_wallet':
          result = await paymentService.processWalletTransaction(paymentData);
          break;
        case 'crypto':
          result = await paymentService.processCryptoTransaction(paymentData);
          break;
        case 'bnpl':
          result = await paymentService.processBnplTransaction(paymentData);
          break;
        case 'bank_transfer':
          result = await paymentService.processBankTransaction(paymentData);
          break;
        case 'gift_card':
          result = await paymentService.processGiftCardTransaction(paymentData);
          break;
        case 'cash':
          result = await paymentService.processCashTransaction(paymentData);
          break;
        default:
          result = await paymentService.processGenericTransaction(paymentData);
      }

      if (result.success) {
        // Store payment record in database
        await paymentService.storePaymentRecord(paymentData, result.data);
        
        // Add payment analytics tracking
        await paymentService.trackPaymentMetrics(paymentData, result.data);
        
        // Handle post-payment actions
        await paymentService.handlePostPaymentActions(result.data);
      }
      
      return result;
    } catch (error) {
      // Enhanced error handling
      await paymentService.handlePaymentError(error, paymentData);
      return {
        success: false,
        message: error.message || 'Payment processing failed',
        errorCode: error.code || 'UNKNOWN_ERROR'
      };
    }
  },

  // Store payment record in database
  storePaymentRecord: async (paymentData, transactionData) => {
    try {
      const paymentRecord = {
        order_id: paymentData.order_id,
        payment_method: paymentData.method,
        amount: paymentData.amount,
        status: 'completed',
        transaction_id: transactionData.transactionId,
        payment_date: new Date().toISOString(),
        payment_details: {
          auth_code: transactionData.authCode,
          response_code: transactionData.responseCode,
          processing_time: transactionData.processingTime,
          fraud_score: transactionData.fraudScore,
          card_last_four: transactionData.cardLastFour,
          card_brand: transactionData.cardBrand
        }
      };

      const payment = await apiService.post('order_payments', paymentRecord);
      return payment;
    } catch (error) {
      console.error('Failed to store payment record:', error);
      throw error;
    }
  },

  // Get payment methods from database
  getPaymentMethods: async () => {
    try {
      const methods = await apiService.get('payment_methods', {
        filters: { is_active: true },
        orderBy: { column: 'sort_order', ascending: true }
      });

      return methods.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Get payment gateways configuration
  getPaymentGateways: async () => {
    try {
      const gateways = await apiService.get('payment_gateways', {
        filters: { is_active: true },
        orderBy: { column: 'sort_order', ascending: true }
      });

      return gateways.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Get order payments
  getOrderPayments: async (orderId) => {
    try {
      const payments = await apiService.get('order_payments', {
        filters: { order_id: orderId },
        orderBy: { column: 'payment_date', ascending: false }
      });

      return payments.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Process refund
  processRefund: async (paymentId, refundData) => {
    try {
      // Get original payment
      const originalPayment = await apiService.getById('order_payments', paymentId);
      if (!originalPayment) {
        throw { message: 'Payment not found', code: 404 };
      }

      // Create refund record
      const refund = {
        order_id: originalPayment.order_id,
        payment_method: 'refund',
        amount: -Math.abs(refundData.amount), // Negative amount for refund
        status: 'completed',
        transaction_id: `REF-${Date.now()}`,
        payment_date: new Date().toISOString(),
        payment_details: {
          original_payment_id: paymentId,
          refund_reason: refundData.reason,
          refund_type: refundData.type || 'full'
        }
      };

      const refundPayment = await apiService.post('order_payments', refund);

      // Update original payment status if full refund
      if (Math.abs(refundData.amount) >= originalPayment.amount) {
        await apiService.put('order_payments', paymentId, {
          status: 'refunded'
        });
      }

      return refundPayment;
    } catch (error) {
      throw error;
    }
  },

  // Validate payment request
  validatePaymentRequest: async (paymentData) => {
    const errors = [];

    if (!paymentData.method) {
      errors.push('Payment method is required');
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.push('Valid payment amount is required');
    }

    if (paymentData.amount > 10000000) { // 10M UGX limit
      errors.push('Payment amount exceeds maximum limit');
    }

    // Method-specific validation
    switch (paymentData.method) {
      case 'card':
        if (!paymentData.token && !paymentData.cardNumber) {
          errors.push('Card information is required');
        }
        break;
      case 'crypto':
        if (!paymentData.cryptoCurrency) {
          errors.push('Cryptocurrency type is required');
        }
        if (!paymentData.walletAddress) {
          errors.push('Wallet address is required');
        }
        break;
      case 'bank_transfer':
        if (!paymentData.routingNumber || !paymentData.accountNumber) {
          errors.push('Bank account information is required');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      error: errors.join(', '),
      errorCode: errors.length > 0 ? 'VALIDATION_ERROR' : null
    };
  },

  // Process card transaction
  processCardTransaction: async (paymentData) => {
    // Simulate real card processing responses
    const cardNumber = paymentData.cardNumber || paymentData.token;
    
    // Test card numbers for different scenarios
    if (cardNumber && cardNumber.includes('0000')) {
      return {
        success: false,
        message: 'Card declined - Insufficient funds',
        errorCode: 'INSUFFICIENT_FUNDS',
        declineReason: 'insufficient_funds'
      };
    }
    
    if (cardNumber && cardNumber.includes('1111')) {
      return {
        success: false,
        message: 'Card declined - Invalid card number',
        errorCode: 'INVALID_CARD',
        declineReason: 'invalid_card_number'
      };
    }
    
    if (cardNumber && cardNumber.includes('2222')) {
      return {
        success: false,
        message: 'Card declined - Expired card',
        errorCode: 'EXPIRED_CARD',
        declineReason: 'expired_card'
      };
    }

    if (cardNumber && cardNumber.includes('3333')) {
      return {
        success: false,
        message: 'Card declined - Do not honor',
        errorCode: 'DO_NOT_HONOR',
        declineReason: 'generic_decline'
      };
    }

    // Simulate successful processing
    return {
      success: true,
      data: {
        transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
        responseCode: '00',
        responseMessage: 'Approved',
        processingTime: Math.random() * 3000 + 1000,
        cardLastFour: cardNumber ? cardNumber.slice(-4) : '****',
        cardBrand: paymentService.detectCardBrand(cardNumber || ''),
        acquirer: 'DFCU Bank',
        merchantId: 'FAREDEAL_UG_001'
      }
    };
  },

  // Process wallet transaction
  processWalletTransaction: async (paymentData) => {
    // Simulate wallet-specific processing
    const supportedWallets = ['apple_pay', 'google_pay', 'samsung_pay', 'paypal', 'mtn_momo', 'airtel_money'];
    
    if (!supportedWallets.includes(paymentData.walletType)) {
      return {
        success: false,
        message: `Unsupported wallet type: ${paymentData.walletType}`,
        errorCode: 'UNSUPPORTED_WALLET'
      };
    }

    // Simulate wallet authentication failure
    if (Math.random() < 0.05) { // 5% chance of auth failure
      return {
        success: false,
        message: 'Wallet authentication failed. Please try again.',
        errorCode: 'WALLET_AUTH_FAILED'
      };
    }

    return {
      success: true,
      data: {
        transactionId: `WALLET_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
        walletTransactionId: `${paymentData.walletType}_${Date.now()}`,
        biometricVerified: true,
        processingTime: Math.random() * 2000 + 500
      }
    };
  },

  // Process crypto transaction
  processCryptoTransaction: async (paymentData) => {
    const supportedCrypto = ['bitcoin', 'ethereum', 'usdc', 'usdt'];
    
    if (!supportedCrypto.includes(paymentData.cryptoCurrency)) {
      return {
        success: false,
        message: `Unsupported cryptocurrency: ${paymentData.cryptoCurrency}`,
        errorCode: 'UNSUPPORTED_CRYPTO'
      };
    }

    // Simulate network congestion
    if (Math.random() < 0.1) { // 10% chance
      return {
        success: false,
        message: 'Network congestion detected. Please try again later.',
        errorCode: 'NETWORK_CONGESTION'
      };
    }

    // Simulate successful crypto processing
    const networkFee = paymentData.amount * 0.001; // 0.1% network fee
    
    return {
      success: true,
      data: {
        transactionId: `CRYPTO_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        blockchainHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        networkFee,
        confirmations: 1,
        expectedConfirmations: paymentData.cryptoCurrency === 'bitcoin' ? 6 : 12,
        processingTime: Math.random() * 10000 + 5000
      }
    };
  },

  // Process BNPL transaction
  processBnplTransaction: async (paymentData) => {
    const providers = ['klarna', 'afterpay', 'affirm', 'sezzle'];
    
    if (!providers.includes(paymentData.provider)) {
      return {
        success: false,
        message: `Unsupported BNPL provider: ${paymentData.provider}`,
        errorCode: 'UNSUPPORTED_BNPL_PROVIDER'
      };
    }

    // Simulate credit check failure
    if (Math.random() < 0.15) { // 15% chance
      return {
        success: false,
        message: 'Credit check failed. Please try a different payment method.',
        errorCode: 'CREDIT_CHECK_FAILED'
      };
    }

    const installmentPlan = paymentService.calculateInstallments(
      paymentData.amount, 
      paymentData.installments || 4
    );

    return {
      success: true,
      data: {
        transactionId: `BNPL_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
        installmentPlan,
        creditScore: Math.floor(Math.random() * 200) + 650, // 650-850
        processingTime: Math.random() * 5000 + 3000
      }
    };
  },

  // Process bank transfer transaction
  processBankTransaction: async (paymentData) => {
    // Uganda specific bank validation
    const ugandanBanks = ['centenary', 'stanbic', 'dfcu', 'equity', 'kcb', 'ncba', 'boa'];
    
    if (paymentData.bankCode && !ugandanBanks.includes(paymentData.bankCode)) {
      return {
        success: false,
        message: `Bank ${paymentData.bankCode} not supported`,
        errorCode: 'UNSUPPORTED_BANK'
      };
    }

    // Simulate bank verification failure
    if (Math.random() < 0.08) { // 8% chance
      return {
        success: false,
        message: 'Bank account verification failed',
        errorCode: 'ACCOUNT_VERIFICATION_FAILED'
      };
    }

    return {
      success: true,
      data: {
        transactionId: `BANK_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        bankReference: Math.random().toString().substr(2, 15),
        settlementDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        processingTime: Math.random() * 3000 + 2000,
        status: 'pending'
      }
    };
  },

  // Process gift card transaction
  processGiftCardTransaction: async (paymentData) => {
    // Enhanced gift card validation
    const giftCard = await paymentService.validateGiftCard(
      paymentData.cardNumber, 
      paymentData.pin
    );
    
    if (!giftCard.isValid) {
      return {
        success: false,
        message: 'Invalid gift card or PIN',
        errorCode: 'INVALID_GIFT_CARD'
      };
    }

    if (giftCard.balance < paymentData.amount) {
      return {
        success: false,
        message: `Insufficient gift card balance. Available: UGX ${giftCard.balance.toLocaleString()}`,
        errorCode: 'INSUFFICIENT_GIFT_CARD_BALANCE',
        availableBalance: giftCard.balance
      };
    }

    const newBalance = giftCard.balance - paymentData.amount;

    return {
      success: true,
      data: {
        transactionId: `GIFT_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
        previousBalance: giftCard.balance,
        newBalance,
        processingTime: Math.random() * 1500 + 500
      }
    };
  },

  // Process cash transaction
  processCashTransaction: async (paymentData) => {
    const totalAmount = paymentData.amount;
    const cashReceived = paymentData.cashReceived || totalAmount;

    if (cashReceived < totalAmount) {
      return {
        success: false,
        message: `Insufficient cash. Required: UGX ${totalAmount.toLocaleString()}, Received: UGX ${cashReceived.toLocaleString()}`,
        errorCode: 'INSUFFICIENT_CASH'
      };
    }

    const changeAmount = cashReceived - totalAmount;

    return {
      success: true,
      data: {
        transactionId: `CASH_${Date.now()}`,
        cashReceived: cashReceived,
        changeGiven: changeAmount,
        processingTime: Math.random() * 3000 + 1000
      }
    };
  },

  // Process generic transaction
  processGenericTransaction: async (paymentData) => {
    return {
      success: true,
      data: {
        transactionId: `GEN_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
        processingTime: Math.random() * 3000 + 1000
      }
    };
  },

  // Fraud detection system
  fraudDetection: async (paymentData) => {
    let riskScore = 0;
    let riskFactors = [];

    // Amount-based risk assessment
    if (paymentData.amount > 1000000) { // 1M UGX
      riskScore += 2;
      riskFactors.push('high_amount');
    }

    if (paymentData.amount > 5000000) { // 5M UGX
      riskScore += 5;
      riskFactors.push('very_high_amount');
    }

    // Time-based risk (late night transactions)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      riskScore += 1;
      riskFactors.push('unusual_time');
    }

    // Payment method risk
    if (paymentData.method === 'crypto') {
      riskScore += 1;
      riskFactors.push('crypto_payment');
    }

    let riskLevel = 'low';
    if (riskScore >= 8) {
      riskLevel = 'high';
    } else if (riskScore >= 4) {
      riskLevel = 'medium';
    }

    return {
      riskScore,
      riskLevel,
      riskFactors,
      requiresReview: riskLevel === 'high'
    };
  },

  // Detect card brand
  detectCardBrand: (cardNumber) => {
    const patterns = {
      visa: /^4/,
      mastercard: /^5[1-5]/,
      amex: /^3[47]/,
      discover: /^6(?:011|5)/,
      diners: /^3[0689]/,
      jcb: /^35/
    };
    
    for (const [brand, pattern] of Object.entries(patterns)) {
      if (pattern.test(cardNumber)) {
        return brand;
      }
    }
    
    return 'unknown';
  },

  // Calculate installment plans
  calculateInstallments: (totalAmount, numberOfInstallments = 4) => {
    const installmentAmount = Math.ceil((totalAmount / numberOfInstallments) * 100) / 100;
    const lastInstallmentAmount = totalAmount - (installmentAmount * (numberOfInstallments - 1));
    
    const payments = [];
    for (let i = 0; i < numberOfInstallments; i++) {
      const isLast = i === numberOfInstallments - 1;
      payments.push({
        installmentNumber: i + 1,
        amount: isLast ? lastInstallmentAmount : installmentAmount,
        dueDate: new Date(Date.now() + (i * 14 * 24 * 60 * 60 * 1000)).toISOString(), // Every 2 weeks
        status: i === 0 ? 'due' : 'pending'
      });
    }
    
    return {
      totalAmount,
      numberOfInstallments,
      firstPayment: payments[0],
      remainingPayments: payments.slice(1),
      allPayments: payments
    };
  },

  // Validate gift card
  validateGiftCard: async (cardNumber, pin) => {
    // Mock gift card validation - in production, this would query the database
    const mockGiftCards = {
      '1111222233334444': { balance: 50000, isActive: true }, // 50K UGX
      '5555666677778888': { balance: 100000, isActive: true }, // 100K UGX
      '9999000011112222': { balance: 25500, isActive: true } // 25.5K UGX
    };
    
    const card = mockGiftCards[cardNumber];
    
    return {
      isValid: !!card?.isActive,
      balance: card?.balance || 0,
      cardNumber: cardNumber.slice(-4)
    };
  },

  // Payment Analytics Tracking
  trackPaymentMetrics: async (paymentData, result) => {
    try {
      const metrics = {
        payment_method: paymentData.method,
        amount: paymentData.amount,
        currency: 'UGX',
        processing_time: result.processingTime || 0,
        success: result.success || true,
        transaction_date: new Date().toISOString(),
        device_type: paymentData.deviceInfo?.type,
        location: paymentData.location,
        card_brand: result.cardBrand,
        customer_segment: paymentData.customerInfo?.segment
      };
      
      // Store metrics in local storage for now
      // In production, this would be sent to analytics service or stored in database
      const existingMetrics = JSON.parse(localStorage.getItem('paymentMetrics') || '[]');
      existingMetrics.push(metrics);
      localStorage.setItem('paymentMetrics', JSON.stringify(existingMetrics.slice(-100)));
      
      return metrics;
    } catch (error) {
      console.error('Failed to track payment metrics:', error);
    }
  },

  // Handle post-payment actions
  handlePostPaymentActions: async (paymentResult) => {
    try {
      // Update loyalty points if customer is a member
      if (paymentResult.customerInfo?.loyaltyMember) {
        await paymentService.updateLoyaltyPoints(paymentResult);
      }
      
      // Generate receipt
      await paymentService.generateReceipt(paymentResult);
      
    } catch (error) {
      console.error('Post-payment action failed:', error);
    }
  },

  // Handle payment errors
  handlePaymentError: async (error, paymentData) => {
    try {
      // Log error for monitoring
      console.error('Payment error:', error, paymentData);
      
      // Track failed payment metrics
      await paymentService.trackPaymentMetrics(paymentData, {
        success: false,
        error: error.message,
        errorCode: error.code
      });
      
    } catch (trackingError) {
      console.error('Failed to handle payment error:', trackingError);
    }
  },

  // Update loyalty points
  updateLoyaltyPoints: async (paymentResult) => {
    try {
      const pointsEarned = Math.floor(paymentResult.amount / 1000); // 1 point per 1000 UGX
      console.log('Loyalty points earned:', pointsEarned);
      return { pointsEarned };
    } catch (error) {
      console.error('Failed to update loyalty points:', error);
    }
  },

  // Generate receipt
  generateReceipt: async (paymentResult) => {
    try {
      console.log('Receipt generated for payment:', paymentResult.transactionId);
      return { 
        receiptId: `rcpt_${Date.now()}`,
        receiptUrl: `/receipts/${paymentResult.transactionId}`
      };
    } catch (error) {
      console.error('Failed to generate receipt:', error);
    }
  },

  // Get payment analytics
  getPaymentAnalytics: async (dateRange = 'last_30_days') => {
    try {
      let startDate = new Date();
      let endDate = new Date();

      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last_7_days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last_30_days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'last_90_days':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      // This would query payment analytics from the database
      // For now, return mock data
      return {
        totalTransactions: 0,
        totalAmount: 0,
        successRate: 100,
        averageTransactionTime: 2.5,
        paymentMethodBreakdown: {},
        dateRange: { startDate, endDate }
      };
    } catch (error) {
      throw error;
    }
  }
};

export default paymentService;