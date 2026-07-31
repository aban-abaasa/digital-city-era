// ===================================================
// 💎 ICANERA WALLET PAYMENT INTEGRATION SERVICE
// Complete transaction recording with currency, merchant, and classification
// ===================================================

import { supabase } from './supabase';
import transactionService from './transactionService';

/**
 * Get current ICAN exchange rate for a currency
 */
export const getICANExchangeRate = async (currencyCode = 'UGX') => {
  try {
    // Try to get from ican_currency_rates table
    const { data, error } = await supabase
      .rpc('ican_get_price_in_currency', { p_currency_code: currencyCode });
    
    if (!error && data && data.length > 0) {
      const rate = data[0].price_local;
      return parseFloat(rate) || 1000; // Default 1000 UGX per ICAN
    }
    
    // Fallback rates
    const fallbackRates = {
      'UGX': 1000,
      'KES': 130,
      'TZS': 2500,
      'USD': 1,
      'EUR': 0.92,
      'GBP': 0.79
    };
    
    return fallbackRates[currencyCode] || 1000;
  } catch (error) {
    console.error('Error getting exchange rate:', error);
    return 1000; // Default fallback
  }
};

/**
 * Get user's wallet address
 */
export const getUserWalletAddress = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('ican_user_wallets')
      .select('wallet_address')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching wallet address:', error);
      return null;
    }
    
    return data?.wallet_address || null;
  } catch (error) {
    console.error('Error getting user wallet address:', error);
    return null;
  }
};

/**
 * Get user's country and currency
 */
export const getUserCurrency = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('ican_user_profiles')
      .select('country_code, currency')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.log('Could not fetch user currency, using default');
      return { countryCode: 'UG', currencyCode: 'UGX' };
    }
    
    return {
      countryCode: data?.country_code || 'UG',
      currencyCode: data?.currency || 'UGX'
    };
  } catch (error) {
    console.error('Error getting user currency:', error);
    return { countryCode: 'UG', currencyCode: 'UGX' };
  }
};

/**
 * Record a complete wallet payment transaction
 * Captures: amount, currency, merchant, classification, wallet details
 */
export const recordWalletPayment = async (paymentData) => {
  try {
    const {
      items,
      subtotal,
      tax,
      total,
      cashier,
      customer,
      register,
      location,
      supermarket_id,
      walletTransactionId,  // From ican_transactions
      customerUserId  // Customer's user ID for wallet lookup
    } = paymentData;

    // Get customer wallet address
    let customerWalletAddress = null;
    if (customerUserId) {
      customerWalletAddress = await getUserWalletAddress(customerUserId);
    }

    // Get customer's currency settings
    const { currencyCode } = customerUserId 
      ? await getUserCurrency(customerUserId)
      : { currencyCode: 'UGX' };

    // Get current exchange rate
    const exchangeRate = await getICANExchangeRate(currencyCode);
    
    // Calculate ICAN amount
    const icanAmount = parseFloat(total) / exchangeRate;

    // Get merchant name from supermarket
    let merchantName = location || 'Supermarket';
    if (supermarket_id) {
      const { data: supermarket } = await supabase
        .from('supermarkets')
        .select('name, business_type')
        .eq('id', supermarket_id)
        .single();
      
      if (supermarket) {
        merchantName = supermarket.name;
      }
    }

    // Prepare enhanced transaction data
    const transactionData = {
      items,
      subtotal,
      tax,
      total,
      cashier,
      customer,
      register,
      location,
      supermarket_id,
      
      // Payment method - IcanEra Wallet
      paymentMethod: {
        id: 'icanera_wallet',
        name: 'IcanEra Wallet'
      },
      paymentReference: walletTransactionId || `ICAN_${Date.now()}`,
      paymentFee: 0, // No fee for wallet payments
      
      // Currency & Exchange
      currencyCode: currencyCode,
      icanAmount: icanAmount,
      exchangeRate: exchangeRate,
      
      // Merchant details
      merchantName: merchantName,
      merchantType: 'supermarket',
      
      // Wallet integration
      walletTransactionId: walletTransactionId,
      customerWalletAddress: customerWalletAddress,
      
      // Let transaction service auto-classify expenditure type
      // based on items and amount
    };

    // Save transaction using enhanced transaction service
    const result = await transactionService.saveTransaction(transactionData);

    if (result.success) {
      console.log('✅ Wallet payment recorded:', {
        receiptNumber: result.receiptNumber,
        amount: total,
        currency: currencyCode,
        icanAmount: icanAmount,
        merchant: merchantName,
        walletAddress: customerWalletAddress
      });
    }

    return result;

  } catch (error) {
    console.error('❌ Error recording wallet payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get wallet transaction history with full details
 */
export const getWalletTransactionHistory = async (userId, options = {}) => {
  try {
    const {
      limit = 50,
      startDate = null,
      endDate = null,
      expenditureType = null  // 'business' or 'personal'
    } = options;

    let query = supabase
      .from('wallet_transaction_summary')
      .select('*')
      .eq('cashier_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    if (expenditureType) {
      query = query.eq('expenditure_type', expenditureType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching wallet transaction history:', error);
      return {
        success: false,
        transactions: [],
        error: error.message
      };
    }

    return {
      success: true,
      transactions: data || []
    };

  } catch (error) {
    console.error('Error getting wallet transaction history:', error);
    return {
      success: false,
      transactions: [],
      error: error.message
    };
  }
};

/**
 * Get spending analytics by category and type
 */
export const getWalletSpendingAnalytics = async (userId, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('cashier_id', userId)
      .eq('payment_method', 'icanera_wallet')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const transactions = data || [];

    // Calculate analytics
    const analytics = {
      totalSpent: 0,
      totalTransactions: transactions.length,
      byType: {
        business: { count: 0, amount: 0 },
        personal: { count: 0, amount: 0 }
      },
      byCategory: {},
      byMerchant: {},
      byCurrency: {}
    };

    transactions.forEach(txn => {
      const amount = parseFloat(txn.amount_in_local_currency || txn.total_amount || 0);
      analytics.totalSpent += amount;

      // By type
      const type = txn.expenditure_type || 'personal';
      analytics.byType[type].count += 1;
      analytics.byType[type].amount += amount;

      // By category
      const category = txn.expenditure_category || 'uncategorized';
      if (!analytics.byCategory[category]) {
        analytics.byCategory[category] = { count: 0, amount: 0 };
      }
      analytics.byCategory[category].count += 1;
      analytics.byCategory[category].amount += amount;

      // By merchant
      const merchant = txn.merchant_name || 'Unknown';
      if (!analytics.byMerchant[merchant]) {
        analytics.byMerchant[merchant] = { count: 0, amount: 0 };
      }
      analytics.byMerchant[merchant].count += 1;
      analytics.byMerchant[merchant].amount += amount;

      // By currency
      const currency = txn.currency_code || 'UGX';
      if (!analytics.byCurrency[currency]) {
        analytics.byCurrency[currency] = { count: 0, amount: 0 };
      }
      analytics.byCurrency[currency].count += 1;
      analytics.byCurrency[currency].amount += amount;
    });

    return {
      success: true,
      analytics
    };

  } catch (error) {
    console.error('Error getting spending analytics:', error);
    return {
      success: false,
      analytics: null,
      error: error.message
    };
  }
};

/**
 * Export transaction data for accounting
 */
export const exportWalletTransactions = async (userId, format = 'csv', options = {}) => {
  try {
    const { transactions } = await getWalletTransactionHistory(userId, options);

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date', 'Receipt Number', 'Merchant', 'Amount', 'Currency', 
        'ICAN Amount', 'Type', 'Category', 'Customer', 'Items'
      ];

      const rows = transactions.map(txn => [
        new Date(txn.created_at).toLocaleString(),
        txn.receipt_number,
        txn.merchant_name,
        txn.amount_in_local_currency,
        txn.currency_code,
        txn.ican_amount,
        txn.expenditure_type,
        txn.expenditure_category,
        txn.customer_name,
        txn.items_count
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      return {
        success: true,
        data: csv,
        format: 'csv'
      };
    }

    // JSON format
    return {
      success: true,
      data: JSON.stringify(transactions, null, 2),
      format: 'json'
    };

  } catch (error) {
    console.error('Error exporting transactions:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  recordWalletPayment,
  getWalletTransactionHistory,
  getWalletSpendingAnalytics,
  exportWalletTransactions,
  getICANExchangeRate,
  getUserWalletAddress,
  getUserCurrency
};
