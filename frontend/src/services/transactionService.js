// ===================================================
// 🧾 TRANSACTION SERVICE
// Handle sales transactions, receipts, and reports
// ===================================================

import { supabase } from './supabase';

class TransactionService {
  
  // ===================================================
  // SAVE TRANSACTION
  // ===================================================
  async saveTransaction(transactionData) {
    try {
      const {
        items,
        subtotal,
        tax,
        total,
        paymentMethod,
        paymentReference,
        paymentFee,
        amountPaid,
        changeGiven,
        customer,
        cashier,
        register,
        location
      } = transactionData;

      // Generate transaction ID and receipt number
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;
      const receiptNumber = await this.generateReceiptNumber();

      // Get current user ID (cashier)
      const { data: { user } } = await supabase.auth.getUser();
      const cashierId = user?.id || cashier?.id || null;

      // Prepare transaction record
      const transactionRecord = {
        transaction_id: transactionId,
        receipt_number: receiptNumber,
        
        // Cashier info
        cashier_id: cashierId,
        cashier_name: cashier?.name || 'Cashier',
        register_number: register || 'POS-001',
        store_location: location || 'Kampala Main Branch',
        
        // Financial
        subtotal: parseFloat(subtotal),
        tax_amount: parseFloat(tax),
        tax_rate: 18.00, // Uganda VAT
        total_amount: parseFloat(total),
        
        // Payment
        payment_method: paymentMethod?.id || 'cash',
        payment_provider: paymentMethod?.name || 'Cash',
        payment_reference: paymentReference || transactionId,
        change_given: parseFloat(changeGiven || 0),
        payment_fee: parseFloat(paymentFee || 0),
        
        // Customer
        customer_name: customer?.name || 'Walk-in Customer',
        customer_phone: customer?.phone || null,
        
        // Items
        items_count: items.length,
        items: items, // Store items as JSON for reference
        
        // Status
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      // Insert transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert(transactionRecord)
        .select()
        .single();

      if (transactionError) {
        // Handle duplicate receipt number
        if (transactionError.message?.includes('duplicate') && transactionError.message?.includes('receipt_number')) {
          console.warn('⚠️ Duplicate receipt number detected, retrying with new number...');
          // Retry with a new unique receipt number
          transactionRecord.receipt_number = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
          
          const { data: retryTransaction, error: retryError } = await supabase
            .from('transactions')
            .insert(transactionRecord)
            .select()
            .single();
          
          if (retryError) {
            console.error('❌ Transaction insert error (retry failed):', retryError);
            throw new Error(`Failed to save transaction: ${retryError.message}`);
          }
          
          return await this.handleSuccessfulTransaction(retryTransaction, items);
        }
        
        console.error('❌ Transaction insert error:', transactionError);
        throw new Error(transactionError.message || 'Failed to save transaction');
      }

      console.log('✅ Transaction saved:', transaction);

      // Insert transaction items
      const transactionItems = items.map(item => ({
        transaction_id: transaction.id,
        product_id: item.id,
        product_name: item.name,
        product_sku: item.sku || null,
        product_barcode: item.barcode || null,
        category_name: item.categoryName || item.category || 'General',
        unit_price: parseFloat(item.selling_price || item.price),
        quantity: parseInt(item.quantity),
        line_total: parseFloat(item.selling_price || item.price) * parseInt(item.quantity),
        tax_included: true,
        tax_amount: (parseFloat(item.selling_price || item.price) * parseInt(item.quantity)) * 0.18
      }));

      const { error: itemsError } = await supabase
        .from('sales_transaction_items')
        .insert(transactionItems);

      if (itemsError) {
        console.error('❌ Transaction items insert error:', itemsError);
        // Don't throw - transaction is saved, items can be manually added
      } else {
        console.log('✅ Transaction items saved:', transactionItems.length);
      }

      return {
        success: true,
        transaction,
        receiptNumber: transaction.receipt_number || receiptNumber,
        transactionId: transaction.transaction_id || transactionId
      };

    } catch (error) {
      console.error('❌ Error saving transaction:', error);
      return {
        success: false,
        error: error.message,
        receiptNumber: null,
        transactionId: null
      };
    }
  }

  // ===================================================
  // GENERATE RECEIPT NUMBER
  // ===================================================
  async generateReceiptNumber() {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get today's transaction count using proper ISO format
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString());

      if (error) {
        console.warn('⚠️ Error counting transactions, using timestamp fallback:', error);
        // Use timestamp-based fallback
        return `RCP-${dateStr}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}-${Date.now().toString(36).toUpperCase()}`;
      }

      const counter = (count || 0) + 1;
      const receiptNumber = `RCP-${dateStr}-${String(counter).padStart(4, '0')}`;
      
      console.log(`✅ Generated receipt number: ${receiptNumber} (${counter} today)`);
      return receiptNumber;
    } catch (error) {
      console.error('❌ Error generating receipt number:', error);
      // Fallback to timestamp-based - guaranteed unique
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      return `RCP-${timestamp}-${random}`;
    }
  }

  // ===================================================
  // GET TRANSACTION BY ID
  // ===================================================
  async getTransaction(transactionId) {
    try {
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (transactionError) throw transactionError;

      const { data: items, error: itemsError } = await supabase
        .from('sales_transaction_items')
        .select('*')
        .eq('transaction_id', transactionId);

      if (itemsError) throw itemsError;

      return {
        success: true,
        transaction: {
          ...transaction,
          items
        }
      };
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // GET TRANSACTION BY RECEIPT NUMBER
  // ===================================================
  async getTransactionByReceipt(receiptNumber) {
    try {
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('receipt_number', receiptNumber)
        .single();

      if (transactionError) throw transactionError;

      const { data: items, error: itemsError } = await supabase
        .from('sales_transaction_items')
        .select('*')
        .eq('transaction_id', transaction.id);

      if (itemsError) throw itemsError;

      return {
        success: true,
        transaction: {
          ...transaction,
          items
        }
      };
    } catch (error) {
      console.error('Error fetching transaction by receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // GET TODAY'S TRANSACTIONS
  // ===================================================
  async getTodaysTransactions(cashierId = null) {
    try {
      // Load all recent transactions (not just today, to match CashierPortal behavior)
      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      // Only filter by cashier if specifically provided
      if (cashierId) {
        query = query.eq('cashier_id', cashierId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching transactions:', error);
        return {
          success: false,
          transactions: [],
          count: 0,
          totalSales: 0,
          error: error.message
        };
      }

      const transactions = data || [];
      const totalSales = transactions.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);

      return {
        success: true,
        transactions: transactions,
        count: transactions.length,
        totalSales: totalSales
      };
    } catch (error) {
      console.error('Error fetching today\'s transactions:', error);
      return {
        success: false,
        transactions: [],
        count: 0,
        totalSales: 0,
        error: error.message
      };
    }
  }

  // ===================================================
  // GET TRANSACTIONS BY DATE RANGE
  // ===================================================
  async getTransactionsByDateRange(startDate, endDate, cashierId = null) {
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (cashierId) {
        query = query.eq('cashier_id', cashierId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        transactions: data,
        count: data.length,
        totalSales: data.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0),
        totalTax: data.reduce((sum, t) => sum + parseFloat(t.tax_amount || 0), 0)
      };
    } catch (error) {
      console.error('Error fetching transactions by date range:', error);
      return {
        success: false,
        error: error.message,
        transactions: [],
        count: 0,
        totalSales: 0
      };
    }
  }

  // ===================================================
  // GET DAILY REPORT
  // ===================================================
  async getDailyReport(date = new Date()) {
    try {
      // NOTE: daily_sales_reports table doesn't exist
      // Generate report on-the-fly from transactions
      return await this.generateDailyReport(date);
    } catch (error) {
      console.error('Error generating daily report:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // GENERATE DAILY REPORT
  // ===================================================
  async generateDailyReport(date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all transactions for the day
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .eq('status', 'completed');

      if (transError) throw transError;

      // Calculate report metrics
      const report = {
        report_date: new Date(date).toISOString().split('T')[0],
        total_transactions: transactions.length,
        total_sales_ugx: transactions.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0),
        total_tax_collected: transactions.reduce((sum, t) => sum + parseFloat(t.tax_amount || 0), 0),
        total_discounts_given: transactions.reduce((sum, t) => sum + parseFloat(t.discount_amount || 0), 0),
        
        // Payment methods - Fixed: using payment_provider instead of payment_method
        cash_transactions: transactions.filter(t => t.payment_provider?.toLowerCase() === 'cash').length,
        cash_amount: transactions.filter(t => t.payment_provider?.toLowerCase() === 'cash').reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0),
        momo_transactions: transactions.filter(t => t.payment_provider?.toLowerCase().includes('mtn') || t.payment_provider?.toLowerCase().includes('momo')).length,
        momo_amount: transactions.filter(t => t.payment_provider?.toLowerCase().includes('mtn') || t.payment_provider?.toLowerCase().includes('momo')).reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0),
        airtel_transactions: transactions.filter(t => t.payment_provider?.toLowerCase().includes('airtel')).length,
        airtel_amount: transactions.filter(t => t.payment_provider?.toLowerCase().includes('airtel')).reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0),
        card_transactions: transactions.filter(t => t.payment_provider?.toLowerCase().includes('card') || t.payment_provider?.toLowerCase().includes('visa') || t.payment_provider?.toLowerCase().includes('mastercard')).length,
        card_amount: transactions.filter(t => t.payment_provider?.toLowerCase().includes('card') || t.payment_provider?.toLowerCase().includes('visa') || t.payment_provider?.toLowerCase().includes('mastercard')).reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0),
        
        // Performance
        average_basket_size: transactions.length > 0 ? transactions.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0) / transactions.length : 0,
        largest_transaction: Math.max(...transactions.map(t => parseFloat(t.total_amount || 0)), 0),
        smallest_transaction: transactions.length > 0 ? Math.min(...transactions.filter(t => parseFloat(t.total_amount || 0) > 0).map(t => parseFloat(t.total_amount || 0))) : 0,
        total_items_sold: transactions.reduce((sum, t) => sum + parseInt(t.items_count || 0), 0),
      };

      return {
        success: true,
        report
      };
    } catch (error) {
      console.error('Error generating daily report:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // LOG RECEIPT PRINT
  // ===================================================
  async logReceiptPrint(transactionId, receiptNumber, printType = 'original', format = 'thermal') {
    try {
      const { data, error } = await supabase
        .from('receipt_print_log')
        .insert({
          transaction_id: transactionId,
          receipt_number: receiptNumber,
          print_type: printType,
          print_format: format
        });

      if (error) throw error;

      // Update transaction
      await supabase
        .from('transactions')
        .update({ receipt_printed: true })
        .eq('id', transactionId);

      return { success: true };
    } catch (error) {
      console.error('Error logging receipt print:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================================================
  // SEARCH TRANSACTIONS
  // ===================================================
  async searchTransactions(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`receipt_number.ilike.%${searchTerm}%,transaction_id.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        success: true,
        transactions: data,
        count: data.length
      };
    } catch (error) {
      console.error('Error searching transactions:', error);
      return {
        success: false,
        error: error.message,
        transactions: [],
        count: 0
      };
    }
  }

  // ===================================================
  // VOID TRANSACTION
  // ===================================================
  async voidTransaction(transactionId, reason, voidedBy) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'voided',
          voided_at: new Date().toISOString(),
          voided_by: voidedBy,
          void_reason: reason
        })
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        transaction: data
      };
    } catch (error) {
      console.error('Error voiding transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new TransactionService();
