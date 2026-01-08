// ===================================================
// 🧾 RECEIPT SERVICE
// Handle receipt storage, retrieval, and sync
// ===================================================

import { supabase } from './supabase';

class ReceiptService {
  
  // ===================================================
  // SAVE RECEIPT TO SUPABASE
  // ===================================================
  async saveReceipt(receiptData) {
    try {
      const {
        receiptNumber,
        transactionId,
        cashierId,
        cashierName,
        customerName,
        totalAmount,
        subtotal,
        taxAmount,
        amountPaid,
        changeGiven,
        paymentMethod,
        paymentReference,
        itemsJson,
        registerNumber,
        storeLocation,
        notes
      } = receiptData;

      // Prepare receipt record
      const receiptRecord = {
        receipt_number: receiptNumber,
        transaction_id: transactionId,
        cashier_id: cashierId,
        cashier_name: cashierName,
        customer_name: customerName,
        total_amount: parseFloat(totalAmount),
        subtotal: parseFloat(subtotal),
        tax_amount: parseFloat(taxAmount),
        amount_paid: parseFloat(amountPaid),
        change_given: parseFloat(changeGiven),
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        items_json: itemsJson || [],
        status: 'completed',
        register_id: registerNumber,
        store_location: storeLocation,
        notes: notes,
        created_at: new Date().toISOString()
      };

      // Insert receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert(receiptRecord)
        .select()
        .single();

      if (receiptError) {
        console.error('❌ Receipt insert error:', receiptError);
        throw new Error(`Failed to save receipt: ${receiptError.message}`);
      }

      console.log('✅ Receipt saved to Supabase:', receipt);

      return {
        success: true,
        receipt,
        receiptId: receipt.id,
        receiptNumber: receipt.receipt_number
      };

    } catch (error) {
      console.error('❌ Error saving receipt:', error);
      return {
        success: false,
        error: error.message,
        receiptId: null
      };
    }
  }

  // ===================================================
  // GET RECEIPTS FOR CASHIER
  // ===================================================
  async getCashierReceipts(cashierId, limit = 50) {
    try {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('cashier_id', cashierId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching receipts:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Retrieved ${receipts.length} receipts for cashier`);
      return {
        success: true,
        receipts,
        count: receipts.length
      };

    } catch (error) {
      console.error('❌ Error in getCashierReceipts:', error);
      return {
        success: false,
        error: error.message,
        receipts: [],
        count: 0
      };
    }
  }

  // ===================================================
  // GET RECEIPT BY NUMBER
  // ===================================================
  async getReceiptByNumber(receiptNumber) {
    try {
      const { data: receipt, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('receipt_number', receiptNumber)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error fetching receipt:', error);
        throw new Error(error.message);
      }

      if (!receipt) {
        return {
          success: false,
          error: 'Receipt not found',
          receipt: null
        };
      }

      console.log('✅ Receipt retrieved:', receipt);
      return {
        success: true,
        receipt
      };

    } catch (error) {
      console.error('❌ Error in getReceiptByNumber:', error);
      return {
        success: false,
        error: error.message,
        receipt: null
      };
    }
  }

  // ===================================================
  // UPDATE RECEIPT
  // ===================================================
  async updateReceipt(receiptId, updates) {
    try {
      const { data: receipt, error } = await supabase
        .from('receipts')
        .update(updates)
        .eq('id', receiptId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating receipt:', error);
        throw new Error(error.message);
      }

      console.log('✅ Receipt updated:', receipt);
      return {
        success: true,
        receipt
      };

    } catch (error) {
      console.error('❌ Error in updateReceipt:', error);
      return {
        success: false,
        error: error.message,
        receipt: null
      };
    }
  }

  // ===================================================
  // MARK RECEIPT AS PRINTED
  // ===================================================
  async markReceiptAsPrinted(receiptId) {
    try {
      const { data: receipt, error } = await supabase
        .from('receipts')
        .update({
          printed_at: new Date().toISOString()
        })
        .eq('id', receiptId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error marking receipt as printed:', error);
        throw new Error(error.message);
      }

      console.log('✅ Receipt marked as printed:', receipt);
      return {
        success: true,
        receipt
      };

    } catch (error) {
      console.error('❌ Error in markReceiptAsPrinted:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // GET RECEIPTS BY DATE RANGE
  // ===================================================
  async getReceiptsByDateRange(startDate, endDate, cashierId = null) {
    try {
      let query = supabase
        .from('receipts')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (cashierId) {
        query = query.eq('cashier_id', cashierId);
      }

      const { data: receipts, error } = await query
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching receipts by date range:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Retrieved ${receipts.length} receipts for date range`);
      return {
        success: true,
        receipts,
        count: receipts.length
      };

    } catch (error) {
      console.error('❌ Error in getReceiptsByDateRange:', error);
      return {
        success: false,
        error: error.message,
        receipts: [],
        count: 0
      };
    }
  }

  // ===================================================
  // SYNC LOCAL RECEIPTS TO SUPABASE
  // ===================================================
  async syncLocalReceipts(localReceipts, cashierId) {
    try {
      const results = {
        synced: [],
        failed: [],
        skipped: []
      };

      for (const receipt of localReceipts) {
        try {
          // Check if receipt already exists in Supabase
          const { data: existingReceipt } = await supabase
            .from('receipts')
            .select('id')
            .eq('receipt_number', receipt.receiptNumber)
            .single();

          if (existingReceipt) {
            console.log(`⏭️ Receipt ${receipt.receiptNumber} already synced, skipping...`);
            results.skipped.push(receipt.receiptNumber);
            continue;
          }

          // Save receipt to Supabase
          const saveResult = await this.saveReceipt({
            receiptNumber: receipt.receiptNumber,
            transactionId: receipt.transactionId,
            cashierId: cashierId,
            cashierName: receipt.cashier,
            customerName: receipt.customerName || 'Walk-in Customer',
            totalAmount: receipt.total,
            subtotal: receipt.subtotal,
            taxAmount: receipt.tax,
            amountPaid: receipt.amountPaid,
            changeGiven: receipt.changeGiven,
            paymentMethod: receipt.paymentMethod,
            itemsJson: receipt.items,
            notes: `Synced from local storage on ${new Date().toLocaleString()}`
          });

          if (saveResult.success) {
            results.synced.push(receipt.receiptNumber);
          } else {
            results.failed.push({
              receiptNumber: receipt.receiptNumber,
              error: saveResult.error
            });
          }
        } catch (error) {
          console.error(`❌ Error syncing receipt ${receipt.receiptNumber}:`, error);
          results.failed.push({
            receiptNumber: receipt.receiptNumber,
            error: error.message
          });
        }
      }

      console.log('📊 Sync Results:', results);
      return {
        success: true,
        results,
        totalProcessed: localReceipts.length,
        totalSynced: results.synced.length,
        totalFailed: results.failed.length,
        totalSkipped: results.skipped.length
      };

    } catch (error) {
      console.error('❌ Error in syncLocalReceipts:', error);
      return {
        success: false,
        error: error.message,
        results: {
          synced: [],
          failed: [],
          skipped: []
        }
      };
    }
  }

  // ===================================================
  // DELETE RECEIPT
  // ===================================================
  async deleteReceipt(receiptId) {
    try {
      const { error } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      if (error) {
        console.error('❌ Error deleting receipt:', error);
        throw new Error(error.message);
      }

      console.log('✅ Receipt deleted:', receiptId);
      return {
        success: true
      };

    } catch (error) {
      console.error('❌ Error in deleteReceipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ===================================================
  // GET RECEIPT STATISTICS
  // ===================================================
  async getReceiptStatistics(cashierId, startDate, endDate) {
    try {
      let query = supabase
        .from('receipts')
        .select('total_amount, tax_amount, payment_method');

      if (cashierId) {
        query = query.eq('cashier_id', cashierId);
      }

      if (startDate && endDate) {
        query = query
          .gte('created_at', startDate)
          .lte('created_at', endDate);
      }

      const { data: receipts, error } = await query;

      if (error) {
        console.error('❌ Error fetching statistics:', error);
        throw new Error(error.message);
      }

      // Calculate statistics
      const stats = {
        totalReceipts: receipts.length,
        totalAmount: receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0),
        totalTax: receipts.reduce((sum, r) => sum + (r.tax_amount || 0), 0),
        averageTransaction: receipts.length > 0 
          ? receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0) / receipts.length 
          : 0,
        paymentMethodBreakdown: this.getPaymentMethodBreakdown(receipts)
      };

      return {
        success: true,
        statistics: stats
      };

    } catch (error) {
      console.error('❌ Error in getReceiptStatistics:', error);
      return {
        success: false,
        error: error.message,
        statistics: null
      };
    }
  }

  // Helper function to get payment method breakdown
  getPaymentMethodBreakdown(receipts) {
    const breakdown = {};
    receipts.forEach(receipt => {
      const method = receipt.payment_method || 'Unknown';
      if (!breakdown[method]) {
        breakdown[method] = 0;
      }
      breakdown[method] += receipt.total_amount || 0;
    });
    return breakdown;
  }
}

// Export as singleton
export const receiptService = new ReceiptService();
export default ReceiptService;
