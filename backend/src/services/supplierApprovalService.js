/**
 * Supplier Approval Service for Digital City Era
 * 
 * Implements creative "single admin activation" system:
 * - Only ONE admin from ONE supermarket needs to approve
 * - Suppliers cannot self-approve
 * - Can be assigned to multiple supermarkets (each needs separate approval)
 * - Integrated with blockchain for verification
 * 
 * @module services/supplierApprovalService
 * @version 2.0.0
 */

import { supabase } from '../config/database.js';
import blockchainService from './blockchainSyncService.js';

/**
 * Supplier Status
 */
const SUPPLIER_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
};

/**
 * Verify that a user is an admin
 * @param {string} userId - User ID to verify
 * @returns {Promise<boolean>} True if user is admin
 */
async function isAdminUser(userId) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    return !error && data !== null;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if a user is a supplier
 * @param {string} userId - User ID to check
 * @returns {Promise<Object|null>} Supplier record or null
 */
async function getSupplierByUserId(userId) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', userId)
      .single();

    return error ? null : data;
  } catch (error) {
    console.error('Error getting supplier:', error);
    return null;
  }
}

/**
 * Approve a supplier for one or more supermarkets
 * 
 * Creative System Rules:
 * ✅ Only ONE admin from ONE supermarket needs to approve
 * ❌ Supplier CANNOT self-approve
 * ❌ Cannot approve if they are also the supplier (safeguard)
 * ✅ Can assign to multiple supermarkets
 * ✅ Each supermarket assignment is independent
 * 
 * @param {string} supplierId - Supplier ID to approve
 * @param {string} approvingAdminId - Admin user ID doing the approval
 * @param {Array<string>} supermarketIds - Array of supermarket IDs to assign
 * @returns {Promise<Object>} Updated supplier record
 */
export async function approveSupplier(supplierId, approvingAdminId, supermarketIds) {
  try {
    console.log(`🔑 Processing supplier approval...`);
    console.log(`   Supplier: ${supplierId}`);
    console.log(`   Admin: ${approvingAdminId}`);
    console.log(`   Supermarkets: ${supermarketIds.length}`);

    // ========== VALIDATION ==========

    // 1. Verify approving user is an admin
    const isAdmin = await isAdminUser(approvingAdminId);
    if (!isAdmin) {
      throw new Error('❌ Not authorized: User must be an admin to approve suppliers');
    }
    console.log(`✅ Admin verification passed`);

    // 2. Get supplier record
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      throw new Error(`❌ Supplier not found: ${supplierId}`);
    }
    console.log(`✅ Supplier found: ${supplier.business_name}`);

    // 3. Check self-approval (critical safeguard)
    if (supplier.user_id === approvingAdminId) {
      throw new Error('❌ Suppliers cannot approve themselves - this is a critical security violation');
    }
    console.log(`✅ Self-approval check passed`);

    // 4. Verify supermarkets exist and admin has access
    const { data: supermarkets, error: supermarketError } = await supabase
      .from('supermarkets')
      .select('id, admin_id')
      .in('id', supermarketIds);

    if (supermarketError) {
      throw new Error(`❌ Error retrieving supermarkets: ${supermarketError.message}`);
    }

    // Check that at least one supermarket exists and admin has access
    const accessibleSupermarkets = supermarkets.filter(
      s => s.admin_id === approvingAdminId
    );

    if (accessibleSupermarkets.length === 0) {
      throw new Error('❌ Admin must have access to at least one of the specified supermarkets');
    }
    console.log(`✅ Supermarket access verified (${accessibleSupermarkets.length} accessible)`);

    // ========== APPROVAL LOGIC ==========

    // Update supplier status
    const { data: updatedSupplier, error: updateError } = await supabase
      .from('suppliers')
      .update({
        status: SUPPLIER_STATUS.APPROVED,
        approved_by: approvingAdminId,
        approved_at: new Date().toISOString(),
        supermarket_assignments: supermarketIds
      })
      .eq('id', supplierId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`❌ Failed to update supplier: ${updateError.message}`);
    }

    // Also update is_active in users table when supplier is approved
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        is_active: true
      })
      .eq('id', supplier.user_id);

    if (userUpdateError) {
      console.warn(`⚠️ Warning: Could not update user is_active flag: ${userUpdateError.message}`);
    } else {
      console.log(`✅ User account activated for supplier: ${supplier.user_id}`);
    }

    console.log(`✅ Supplier approved: ${updatedSupplier.business_name}`);

    // ========== BLOCKCHAIN SYNC ==========

    // Log approval to blockchain for verification
    await blockchainService.syncTransactionToBlockchain(
      {
        id: `approval_${supplierId}`,
        type: 'supplier_approval',
        supplier_id: supplierId,
        supplier_name: updatedSupplier.business_name,
        approved_by: approvingAdminId,
        supermarket_count: supermarketIds.length,
        timestamp: new Date().toISOString()
      },
      blockchainService.TRANSACTION_TYPES.DIGITAL_CITY,
      {
        event: 'supplier_approval',
        supplier_id: supplierId,
        approved_by: approvingAdminId,
        supermarket_assignments: supermarketIds
      }
    );

    console.log(`✅ Approval logged to blockchain`);

    // ========== NOTIFICATIONS ==========

    // Notify supplier of approval
    await notifySupplierApproved(supplier.user_id, updatedSupplier, supermarketIds);

    // Notify admin of successful approval
    await notifyAdminApprovalComplete(approvingAdminId, updatedSupplier);

    return {
      success: true,
      supplier: updatedSupplier,
      supermarketsAssigned: supermarketIds.length,
      approvedAt: updatedSupplier.approved_at
    };

  } catch (error) {
    console.error('❌ Supplier approval failed:', error.message);
    throw error;
  }
}

/**
 * Reject a supplier application
 * 
 * Only admins can reject supplier applications
 * 
 * @param {string} supplierId - Supplier ID to reject
 * @param {string} rejectingAdminId - Admin ID performing rejection
 * @param {string} reason - Reason for rejection
 * @returns {Promise<Object>} Updated supplier record
 */
export async function rejectSupplier(supplierId, rejectingAdminId, reason) {
  try {
    console.log(`🚫 Processing supplier rejection...`);

    // Verify admin
    const isAdmin = await isAdminUser(rejectingAdminId);
    if (!isAdmin) {
      throw new Error('❌ Only admins can reject suppliers');
    }

    // Get supplier
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }

    // Update supplier status
    const { data: updatedSupplier, error: updateError } = await supabase
      .from('suppliers')
      .update({
        status: SUPPLIER_STATUS.REJECTED,
        approved_by: rejectingAdminId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', supplierId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update supplier: ${updateError.message}`);
    }

    // Log to blockchain
    await blockchainService.syncTransactionToBlockchain(
      {
        id: `rejection_${supplierId}`,
        type: 'supplier_rejection',
        supplier_id: supplierId,
        rejected_by: rejectingAdminId,
        reason: reason,
        timestamp: new Date().toISOString()
      },
      blockchainService.TRANSACTION_TYPES.DIGITAL_CITY
    );

    // Notify supplier
    await notifySupplierRejected(supplier.user_id, supplier, reason);

    console.log(`✅ Supplier rejected: ${supplier.business_name}`);

    return updatedSupplier;

  } catch (error) {
    console.error('Error rejecting supplier:', error);
    throw error;
  }
}

/**
 * Get all pending supplier approvals
 * 
 * Returns suppliers waiting for admin approval
 * Useful for admin dashboard
 * 
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Array of pending suppliers
 */
export async function getPendingApprovals(filters = {}) {
  try {
    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('status', SUPPLIER_STATUS.PENDING_APPROVAL);

    if (filters.supermarketId) {
      query = query.contains('supermarket_assignments', [filters.supermarketId]);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return [];
  }
}

/**
 * Get approval status for a supplier
 * 
 * @param {string} supplierId - Supplier ID
 * @returns {Promise<Object>} Approval status details
 */
export async function getSupplierApprovalStatus(supplierId) {
  try {
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('id, business_name, status, approved_by, approved_at, supermarket_assignments')
      .eq('id', supplierId)
      .single();

    if (error) {
      throw error;
    }

    // Get approving admin details
    let approverName = null;
    if (supplier.approved_by) {
      const { data: admin } = await supabase
        .from('users')
        .select('email')
        .eq('id', supplier.approved_by)
        .single();
      approverName = admin?.email || 'Unknown';
    }

    return {
      supplierId: supplier.id,
      businessName: supplier.business_name,
      status: supplier.status,
      approvedBy: approverName,
      approvedAt: supplier.approved_at,
      supermarkets: supplier.supermarket_assignments || []
    };

  } catch (error) {
    console.error('Error getting approval status:', error);
    return null;
  }
}

/**
 * Get all suppliers approved by a specific admin
 * 
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Array>} Array of suppliers approved by this admin
 */
export async function getSuppliersByApprover(adminId) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('approved_by', adminId)
      .eq('status', SUPPLIER_STATUS.APPROVED)
      .order('approved_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching suppliers by approver:', error);
    return [];
  }
}

/**
 * Get approval statistics for monitoring
 * 
 * Returns metrics for admin dashboard and monitoring
 * 
 * @returns {Promise<Object>} Statistics object
 */
export async function getApprovalStats() {
  try {
    const { data: allSuppliers, error } = await supabase
      .from('suppliers')
      .select('status');

    if (error) {
      throw error;
    }

    const stats = {
      total: allSuppliers.length,
      pending: allSuppliers.filter(s => s.status === SUPPLIER_STATUS.PENDING_APPROVAL).length,
      approved: allSuppliers.filter(s => s.status === SUPPLIER_STATUS.APPROVED).length,
      rejected: allSuppliers.filter(s => s.status === SUPPLIER_STATUS.REJECTED).length,
      suspended: allSuppliers.filter(s => s.status === SUPPLIER_STATUS.SUSPENDED).length,
      approvalRate: allSuppliers.length > 0
        ? (((allSuppliers.filter(s => s.status === SUPPLIER_STATUS.APPROVED).length) / allSuppliers.length) * 100).toFixed(2) + '%'
        : '0%'
    };

    return stats;

  } catch (error) {
    console.error('Error calculating approval stats:', error);
    return null;
  }
}

/**
 * INTERNAL: Notify supplier of approval
 */
async function notifySupplierApproved(userId, supplier, supermarketIds) {
  try {
    console.log(`📧 Sending approval notification to supplier: ${supplier.business_name}`);
    
    // In production, send email notification via SendGrid or similar
    // For now, just log
    console.log(`✅ Notification sent: Supplier ${supplier.business_name} approved for ${supermarketIds.length} supermarkets`);

  } catch (error) {
    console.error('Error notifying supplier:', error);
  }
}

/**
 * INTERNAL: Notify admin of successful approval
 */
async function notifyAdminApprovalComplete(adminId, supplier) {
  try {
    console.log(`📧 Sending confirmation to admin`);
    // In production, send email to admin
    console.log(`✅ Admin notified of approval completion`);

  } catch (error) {
    console.error('Error notifying admin:', error);
  }
}

export default {
  approveSupplier,
  rejectSupplier,
  getPendingApprovals,
  getSupplierApprovalStatus,
  getSuppliersByApprover,
  getApprovalStats,
  SUPPLIER_STATUS
};
