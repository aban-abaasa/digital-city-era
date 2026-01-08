// =====================================================================
// SUPPLIER PAYMENT CONFIRMATIONS COMPONENT - FAREDEAL UGANDA 🇺🇬
// =====================================================================
// Allows suppliers to view and confirm payments made by managers
// Real-time Supabase integration with payment_transactions table
// =====================================================================

import React, { useState, useEffect } from 'react';
import { 
  FiCheckCircle, FiClock, FiDollarSign, FiCalendar, 
  FiFileText, FiAlertCircle, FiRefreshCw 
} from 'react-icons/fi';
import { supabase } from '../services/supabase';

const SupplierPaymentConfirmations = () => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(null);
  const [confirmationNotes, setConfirmationNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * Get current supplier ID from users table (internal ID, not auth_id)
   */
  const getSupplierId = async () => {
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('❌ No authenticated user');
        return null;
      }

      console.log('🔍 Looking up supplier with auth_id:', user.id);

      // Get internal user ID from users table
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, role, email, full_name')
        .eq('auth_id', user.id)
        .eq('role', 'supplier')
        .single();

      if (error) {
        console.error('❌ Error fetching supplier user ID:', error);
        console.log('Error code:', error.code, 'Details:', error.details);
        return null;
      }

      if (!userData) {
        console.error('❌ No supplier user found for auth_id:', user.id);
        return null;
      }

      console.log('✅ Found supplier:', userData.email, 'Internal ID:', userData.id);
      return userData?.id;
    } catch (err) {
      console.error('❌ Error in getSupplierId:', err);
      return null;
    }
  };

  /**
   * Load pending payment confirmations for the supplier
   */
  const loadPendingPayments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📋 Loading pending payments...');
      const supplierId = await getSupplierId();
      
      if (!supplierId) {
        console.error('❌ Could not get supplier ID');
        setError('Unable to identify supplier. Please ensure you are logged in as a supplier.');
        setLoading(false);
        return;
      }

      console.log('🔍 Fetching pending payments for supplier ID:', supplierId);

      // Create timeout promise (5 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Payment loading timeout')), 5000)
      );

      // Try to call the RPC function
      const rpcPromise = supabase.rpc(
        'get_pending_payment_confirmations',
        { p_supplier_id: supplierId }
      );

      let data, rpcError;
      try {
        const result = await Promise.race([rpcPromise, timeoutPromise]);
        data = result.data;
        rpcError = result.error;
      } catch (timeoutErr) {
        console.warn('⚠️ RPC timeout or function does not exist:', timeoutErr.message);
        // RPC function doesn't exist - just use empty array
        data = [];
        rpcError = null;
      }

      if (rpcError) {
        console.warn('⚠️ Error fetching pending payments (will show empty list):', rpcError);
        // Don't block - just show empty list
        setPendingPayments([]);
      } else {
        console.log('✅ Loaded', data?.length || 0, 'pending payments');
        setPendingPayments(data || []);
      }
    } catch (err) {
      console.error('❌ Error loading pending payments:', err);
      setError(err.message);
      setPendingPayments([]); // Show empty list instead of error
    } finally {
      setLoading(false);
    }
  };

  /**
   * Confirm a payment
   */
  const handleConfirmPayment = async (transactionId) => {
    try {
      const supplierId = await getSupplierId();
      
      if (!supplierId) {
        alert('Unable to identify supplier. Please log in again.');
        return;
      }

      // Call the RPC function to confirm payment
      const { data, error: rpcError } = await supabase.rpc(
        'supplier_confirm_payment',
        {
          p_transaction_id: transactionId,
          p_supplier_id: supplierId,
          p_confirmation_notes: confirmationNotes.trim() || null
        }
      );

      if (rpcError) {
        console.error('Error confirming payment:', rpcError);
        alert(`Failed to confirm payment: ${rpcError.message}`);
      } else {
        setSuccessMessage(`✅ Payment confirmed successfully! Transaction: ${data.transaction_number}`);
        setConfirmingPayment(null);
        setConfirmationNotes('');
        
        // Reload pending payments
        loadPendingPayments();
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error confirming payment:', err);
      alert(`Failed to confirm payment: ${err.message}`);
    }
  };

  /**
   * Format currency in UGX
   */
  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  /**
   * Get payment method icon
   */
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash': return '💵';
      case 'mobile_money': return '📱';
      case 'bank_transfer': return '🏦';
      case 'check': return '📝';
      case 'credit': return '💳';
      default: return '💰';
    }
  };

  /**
   * Get payment method label
   */
  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'mobile_money': return 'Mobile Money';
      case 'bank_transfer': return 'Bank Transfer';
      case 'check': return 'Cheque';
      case 'credit': return 'Credit';
      default: return method;
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadPendingPayments();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <FiClock className="text-yellow-500" />
                Payment Confirmations
              </h1>
              <p className="text-gray-600 mt-2">
                Review and confirm payments received from managers
              </p>
            </div>
            <button
              onClick={loadPendingPayments}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border-2 border-green-400 text-green-800 px-6 py-4 rounded-lg mb-6 flex items-center gap-3">
            <FiCheckCircle className="text-2xl" />
            <p className="font-semibold">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-800 px-6 py-4 rounded-lg mb-6 flex items-center gap-3">
            <FiAlertCircle className="text-2xl" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading pending payments...</p>
          </div>
        )}

        {/* No Pending Payments */}
        {!loading && pendingPayments.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FiCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">All Caught Up! 🎉</h2>
            <p className="text-gray-600">You have no pending payment confirmations at this time.</p>
          </div>
        )}

        {/* Pending Payments List */}
        {!loading && pendingPayments.length > 0 && (
          <div className="space-y-4">
            <div className="bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-6 py-4 rounded-lg flex items-center gap-3">
              <FiAlertCircle className="text-2xl" />
              <p className="font-semibold">
                You have {pendingPayments.length} payment{pendingPayments.length > 1 ? 's' : ''} awaiting confirmation
              </p>
            </div>

            {pendingPayments.map((payment) => (
              <div
                key={payment.transaction_id}
                className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-yellow-300"
              >
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 px-6 py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Transaction #{payment.transaction_number}
                      </h3>
                      <p className="text-yellow-100 text-sm">
                        PO #{payment.po_number} - Order ID: {payment.order_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-white">
                        {formatUGX(payment.amount_paid)}
                      </p>
                      <p className="text-yellow-100 text-sm">Payment Amount</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Payment Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FiFileText /> Payment Details
                      </h4>
                      
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Payment Method</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {getPaymentMethodIcon(payment.payment_method)} {getPaymentMethodLabel(payment.payment_method)}
                        </p>
                      </div>

                      {payment.payment_reference && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-600">Reference Number</p>
                          <p className="text-lg font-semibold text-gray-800">{payment.payment_reference}</p>
                        </div>
                      )}

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Payment Date</p>
                        <p className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <FiCalendar />
                          {new Date(payment.payment_date).toLocaleDateString('en-UG', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Days Pending</p>
                        <p className="text-lg font-semibold text-orange-600 flex items-center gap-2">
                          <FiClock />
                          {payment.days_pending} day{payment.days_pending !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Payment Notes */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FiFileText /> Additional Information
                      </h4>

                      {payment.notes && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-600 font-semibold mb-1">Manager's Notes:</p>
                          <p className="text-gray-700">{payment.notes}</p>
                        </div>
                      )}

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Paid By</p>
                        <p className="text-lg font-semibold text-gray-800">{payment.paid_by_name || 'Manager'}</p>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Recorded At</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {new Date(payment.created_at).toLocaleString('en-UG')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Section */}
                  {confirmingPayment === payment.transaction_id ? (
                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                      <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                        <FiCheckCircle className="text-2xl" />
                        Confirm Payment Receipt
                      </h4>

                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Confirmation Notes (Optional)
                        </label>
                        <textarea
                          value={confirmationNotes}
                          onChange={(e) => setConfirmationNotes(e.target.value)}
                          placeholder="Add any notes about this payment confirmation..."
                          rows="3"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          You can add notes about the payment condition, any issues, or confirmation details.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleConfirmPayment(payment.transaction_id)}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <FiCheckCircle className="text-xl" />
                          Confirm Payment Received
                        </button>
                        <button
                          onClick={() => {
                            setConfirmingPayment(null);
                            setConfirmationNotes('');
                          }}
                          className="px-6 py-3 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmingPayment(payment.transaction_id)}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
                      >
                        <FiCheckCircle className="text-xl" />
                        Confirm Payment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierPaymentConfirmations;
