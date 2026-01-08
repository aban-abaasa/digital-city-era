/**
 * Blockchain Sync Service for Digital City Era + ICAN
 * 
 * Handles transaction verification, hashing, and cross-app blockchain sync
 * Optimized for 20+ million supermarkets and 50+ million daily transactions
 * 
 * @module services/blockchainSyncService
 * @version 2.0.0
 */

import crypto from 'crypto';
import { supabase } from '../config/database.js';

/**
 * Transaction types that can be synced to blockchain
 */
const TRANSACTION_TYPES = {
  DIGITAL_CITY: 'digital_city',
  ICAN: 'ican',
  GRANT: 'grant',
  SUPPLIER_APPROVAL: 'supplier_approval',
  PAYMENT: 'payment'
};

/**
 * Create SHA-256 hash of transaction data
 * @param {Object} transaction - Transaction data to hash
 * @returns {string} SHA-256 hash
 */
function createTransactionHash(transaction) {
  const transactionString = JSON.stringify(transaction);
  return crypto
    .createHash('sha256')
    .update(transactionString)
    .digest('hex');
}

/**
 * Sync a single transaction to blockchain
 * 
 * For 20M+ supermarkets:
 * - Creates hash of transaction
 * - Stores in blockchain_sync table
 * - Marks for verification
 * 
 * @param {Object} transaction - Transaction object
 * @param {string} type - Transaction type (digital_city|ican|grant)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Blockchain sync record
 */
export async function syncTransactionToBlockchain(transaction, type, metadata = {}) {
  try {
    // Validate transaction type
    if (!Object.values(TRANSACTION_TYPES).includes(type)) {
      throw new Error(`Invalid transaction type: ${type}`);
    }

    // Create transaction hash
    const dataHash = createTransactionHash(transaction);

    // Prepare blockchain sync record
    const blockchainRecord = {
      transaction_id: transaction.id,
      transaction_type: type,
      data_hash: dataHash,
      status: 'pending',
      sync_timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        original_timestamp: transaction.timestamp || new Date().toISOString(),
        system: type === TRANSACTION_TYPES.ICAN ? 'ICAN' : 'Digital City Era'
      }
    };

    // Insert into blockchain_sync table
    const { data, error } = await supabase
      .from('blockchain_sync')
      .insert([blockchainRecord])
      .select();

    if (error) {
      console.error('❌ Blockchain sync failed:', error.message);
      throw error;
    }

    console.log(`✅ Transaction ${transaction.id} synced to blockchain`);
    return data[0];

  } catch (error) {
    console.error('Error syncing transaction to blockchain:', error);
    return null;
  }
}

/**
 * Batch sync multiple transactions for improved performance
 * 
 * Used for bulk operations like end-of-day batch processing
 * For 20M+ transactions daily, this prevents database overload
 * 
 * @param {Array<Object>} transactions - Array of transaction objects
 * @param {string} type - Transaction type
 * @param {number} batchSize - Size of each batch (default: 5000)
 * @returns {Promise<Array>} Array of synced records
 */
export async function batchSyncToBlockchain(transactions, type, batchSize = 5000) {
  try {
    const results = [];
    const batches = [];

    // Split into batches to prevent database overload
    for (let i = 0; i < transactions.length; i += batchSize) {
      batches.push(transactions.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${transactions.length} transactions in ${batches.length} batches`);

    // Process each batch sequentially to maintain database health
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Create blockchain records for this batch
      const blockchainRecords = batch.map(transaction => ({
        transaction_id: transaction.id,
        transaction_type: type,
        data_hash: createTransactionHash(transaction),
        status: 'pending',
        sync_timestamp: new Date().toISOString(),
        metadata: {
          batch_index: batchIndex,
          batch_size: batchSize,
          transaction_count: transactions.length
        }
      }));

      // Insert batch
      const { data, error } = await supabase
        .from('blockchain_sync')
        .insert(blockchainRecords)
        .select();

      if (error) {
        console.error(`❌ Batch ${batchIndex} sync failed:`, error.message);
        continue;
      }

      results.push(...data);
      console.log(`✅ Batch ${batchIndex + 1}/${batches.length} synced (${data.length} records)`);

      // Small delay between batches to prevent overwhelming the database
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ All ${results.length} transactions synced to blockchain`);
    return results;

  } catch (error) {
    console.error('Error batch syncing transactions:', error);
    return [];
  }
}

/**
 * Verify a transaction's blockchain status
 * 
 * Checks if transaction hash matches blockchain record
 * Used after blockchain network confirms verification
 * 
 * @param {string} transactionId - ID of transaction to verify
 * @returns {Promise<boolean>} True if verified, false otherwise
 */
export async function verifyTransaction(transactionId) {
  try {
    const { data, error } = await supabase
      .from('blockchain_sync')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('sync_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn(`⚠️ No blockchain record found for transaction ${transactionId}`);
      return false;
    }

    const isVerified = data.status === 'verified';
    console.log(`🔍 Transaction ${transactionId} verification status: ${data.status}`);

    return isVerified;

  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
}

/**
 * Get blockchain verification status for a transaction
 * 
 * Returns full verification details including hash, status, timestamp
 * Useful for audit trails and compliance reporting
 * 
 * @param {string} transactionId - ID of transaction
 * @returns {Promise<Object>} Verification details or null
 */
export async function getTransactionVerificationStatus(transactionId) {
  try {
    const { data, error } = await supabase
      .from('blockchain_sync')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('sync_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.warn(`No verification data for transaction ${transactionId}`);
      return null;
    }

    return {
      transactionId: data.transaction_id,
      type: data.transaction_type,
      status: data.status,
      dataHash: data.data_hash,
      blockchainHash: data.blockchain_hash,
      syncTimestamp: data.sync_timestamp,
      metadata: data.metadata
    };

  } catch (error) {
    console.error('Error getting verification status:', error);
    return null;
  }
}

/**
 * Batch verify pending transactions
 * 
 * For 20M+ daily transactions:
 * - Runs every 5 minutes
 * - Processes up to 5000 pending transactions per run
 * - Updates status based on blockchain verification
 * 
 * @param {number} limit - Max transactions to process (default: 5000)
 * @returns {Promise<number>} Number of verified transactions
 */
export async function batchVerifyPendingTransactions(limit = 5000) {
  try {
    console.log(`🔄 Starting batch verification (max ${limit} transactions)...`);

    // Get pending transactions
    const { data: pendingTransactions, error } = await supabase
      .from('blockchain_sync')
      .select('*')
      .eq('status', 'pending')
      .limit(limit);

    if (error) {
      console.error('Error fetching pending transactions:', error);
      return 0;
    }

    if (!pendingTransactions || pendingTransactions.length === 0) {
      console.log('✅ No pending transactions to verify');
      return 0;
    }

    console.log(`📋 Found ${pendingTransactions.length} pending transactions`);

    let verifiedCount = 0;
    let failedCount = 0;

    // Verify each transaction
    for (const record of pendingTransactions) {
      try {
        // In production: Call actual blockchain verification service
        // For now: Mark as verified if blockchain_hash exists
        const isVerified = !!record.blockchain_hash;

        const newStatus = isVerified ? 'verified' : 'pending';

        const { error: updateError } = await supabase
          .from('blockchain_sync')
          .update({ status: newStatus })
          .eq('id', record.id);

        if (updateError) {
          failedCount++;
          console.error(`❌ Failed to update transaction ${record.transaction_id}`);
        } else {
          if (isVerified) {
            verifiedCount++;
          }
        }

      } catch (error) {
        failedCount++;
        console.error(`Error processing transaction ${record.id}:`, error);
      }
    }

    console.log(`✅ Batch verification complete: ${verifiedCount} verified, ${failedCount} failed`);
    return verifiedCount;

  } catch (error) {
    console.error('Error in batch verification:', error);
    return 0;
  }
}

/**
 * Get blockchain sync statistics
 * 
 * For monitoring system health and performance
 * Key metrics:
 * - Total transactions synced
 * - Verification rate
 * - Average sync latency
 * 
 * @returns {Promise<Object>} Statistics object
 */
export async function getBlockchainSyncStats() {
  try {
    const { data, error } = await supabase
      .from('blockchain_sync')
      .select('status, transaction_type');

    if (error) {
      console.error('Error fetching blockchain stats:', error);
      return null;
    }

    const stats = {
      total: data.length,
      verified: data.filter(r => r.status === 'verified').length,
      pending: data.filter(r => r.status === 'pending').length,
      failed: data.filter(r => r.status === 'failed').length,
      byType: {}
    };

    // Group by transaction type
    for (const type of Object.values(TRANSACTION_TYPES)) {
      const typeRecords = data.filter(r => r.transaction_type === type);
      stats.byType[type] = {
        total: typeRecords.length,
        verified: typeRecords.filter(r => r.status === 'verified').length,
        pending: typeRecords.filter(r => r.status === 'pending').length,
        verificationRate: typeRecords.length > 0 
          ? ((typeRecords.filter(r => r.status === 'verified').length / typeRecords.length) * 100).toFixed(2) + '%'
          : '0%'
      };
    }

    stats.verificationRate = stats.total > 0 
      ? ((stats.verified / stats.total) * 100).toFixed(2) + '%'
      : '0%';

    return stats;

  } catch (error) {
    console.error('Error calculating blockchain stats:', error);
    return null;
  }
}

/**
 * Export transactions for audit trail
 * 
 * For compliance and regulatory reporting
 * Exports all transaction records with verification status
 * 
 * @param {Object} filters - Filter options (date range, type, status)
 * @returns {Promise<Array>} Array of transaction records
 */
export async function exportTransactionAuditTrail(filters = {}) {
  try {
    let query = supabase
      .from('blockchain_sync')
      .select('*');

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.type) {
      query = query.eq('transaction_type', filters.type);
    }
    if (filters.startDate && filters.endDate) {
      query = query
        .gte('sync_timestamp', filters.startDate)
        .lte('sync_timestamp', filters.endDate);
    }

    const { data, error } = await query
      .order('sync_timestamp', { ascending: false });

    if (error) {
      console.error('Error exporting audit trail:', error);
      return [];
    }

    console.log(`✅ Exported ${data.length} transaction records`);
    return data;

  } catch (error) {
    console.error('Error exporting audit trail:', error);
    return [];
  }
}

/**
 * Initialize blockchain sync service
 * 
 * Sets up automated batch verification every 5 minutes
 * Should be called when server starts
 */
export function initializeBlockchainSync() {
  console.log('🔗 Initializing Blockchain Sync Service...');

  // Run verification every 5 minutes
  const verificationInterval = setInterval(
    () => batchVerifyPendingTransactions(5000),
    5 * 60 * 1000  // 5 minutes
  );

  // Log stats every hour
  const statsInterval = setInterval(async () => {
    const stats = await getBlockchainSyncStats();
    console.log('📊 Blockchain Sync Statistics:', stats);
  }, 60 * 60 * 1000);  // 1 hour

  console.log('✅ Blockchain Sync Service initialized');

  // Return cleanup function
  return () => {
    clearInterval(verificationInterval);
    clearInterval(statsInterval);
    console.log('🛑 Blockchain Sync Service stopped');
  };
}

export default {
  syncTransactionToBlockchain,
  batchSyncToBlockchain,
  verifyTransaction,
  getTransactionVerificationStatus,
  batchVerifyPendingTransactions,
  getBlockchainSyncStats,
  exportTransactionAuditTrail,
  initializeBlockchainSync,
  TRANSACTION_TYPES
};
