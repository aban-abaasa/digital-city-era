// =====================================================================
// ORDER PAYMENT TRACKER COMPONENT - Interactive Payment Management
// =====================================================================
// Shows payment progress with ability to add payments
// Used in both Manager and Supplier portals
// =====================================================================

import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiPlus, FiCheck, FiClock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../services/supabase';

const OrderPaymentTracker = ({ order, onPaymentAdded, showAddPayment = false, userRole = 'viewer' }) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  // Fetch payment transactions for this order
  useEffect(() => {
    // Use orderId (UUID) if available, otherwise try order_uuid, otherwise use id
    const orderId = order?.orderId || order?.order_uuid || order?.id;
    
    // Only fetch if we have a valid UUID (36 characters)
    if (orderId && typeof orderId === 'string' && orderId.length === 36) {
      fetchPaymentTransactions(orderId);
    }
  }, [order?.orderId, order?.order_uuid, order?.id]);

  const fetchPaymentTransactions = async (orderId) => {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('purchase_order_id', orderId)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      setPaymentTransactions(data || []);
      setUnconfirmedCount(data?.filter(t => !t.confirmed_by_supplier).length || 0);
    } catch (error) {
      console.error('Error fetching payment transactions:', error);
    }
  };

  // Calculate total paid from confirmed transactions
  const calculateTotalPaid = () => {
    return paymentTransactions
      .filter(t => t.confirmed_by_supplier || t.payment_status === 'confirmed')
      .reduce((sum, t) => sum + (parseFloat(t.amount_ugx) || 0), 0);
  };

  // Calculate payment percentage
  const totalPaidAmount = calculateTotalPaid();
  const paymentPercentage = order.total_amount_ugx > 0
    ? (totalPaidAmount / order.total_amount_ugx * 100)
    : 0;

  // Get status color
  const getStatusColor = () => {
    if (paymentPercentage >= 100) return 'text-green-600';
    if (paymentPercentage >= 50) return 'text-blue-600';
    if (paymentPercentage > 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get progress bar color
  const getProgressColor = () => {
    if (paymentPercentage >= 100) return 'bg-green-500';
    if (paymentPercentage >= 50) return 'bg-blue-500';
    if (paymentPercentage > 0) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Format currency
  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Handle payment submission
  const handleAddPayment = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const amount = parseFloat(paymentData.amount);
    if (amount > order.balance_due_ugx) {
      alert(`Payment amount cannot exceed balance due: ${formatUGX(order.balance_due_ugx)}`);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the internal user ID from users table (not auth_id)
      let internalUserId = null;
      if (user?.id) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single();
        
        internalUserId = userData?.id;
      }
      
      // Call the record_payment_with_tracking function
      const orderId = order?.orderId || order?.order_uuid || order?.id;
      const { data, error } = await supabase.rpc('record_payment_with_tracking', {
        p_order_id: orderId,
        p_amount_paid: amount,
        p_payment_method: paymentData.method,
        p_payment_reference: paymentData.reference || null,
        p_payment_date: new Date().toISOString(),
        p_notes: paymentData.notes || null,
        p_paid_by: internalUserId
      });

      if (error) throw error;

      alert(
        `✅ Payment Submitted for Supplier Confirmation!\n\n` +
        `Transaction Number: ${data}\n` +
        `Amount: ${formatUGX(amount)}\n` +
        `Method: ${paymentData.method.toUpperCase()}\n\n` +
        `⏳ This payment is PENDING supplier confirmation.\n` +
        `The order balance will update once the supplier confirms receipt.`
      );

      // Reset form
      setPaymentData({
        amount: '',
        method: 'cash',
        reference: '',
        notes: ''
      });
      setShowPaymentModal(false);

      // Refresh transactions
      await fetchPaymentTransactions();

      // Notify parent
      if (onPaymentAdded) {
        onPaymentAdded();
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Error recording payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 sm:p-4 rounded-lg border border-blue-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
          <FiDollarSign className="text-blue-600 text-lg sm:text-xl" />
          Payment Progress
        </h3>
        {showAddPayment && order.balance_due_ugx > 0 && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 sm:px-3 sm:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors text-sm sm:text-xs font-semibold shadow-md w-full sm:w-auto"
          >
            <FiPlus className="text-lg sm:text-base" /> Add Payment
          </button>
        )}
      </div>

      {/* Payment Stats Grid - Responsive Stack */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Total Amount */}
        <div className="bg-white p-4 sm:p-3 rounded-lg border-2 border-blue-300 shadow-sm">
          <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Total Amount</div>
          <div className="text-2xl sm:text-xl font-bold text-blue-600 break-words">
            {formatUGX(order.total_amount_ugx)}
          </div>
        </div>

        {/* Amount Paid */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 sm:p-3 rounded-lg border-2 border-green-400 shadow-md">
          <div className="text-xs text-green-700 mb-2 font-semibold uppercase tracking-wide flex items-center gap-1">
            <FiCheck className="text-green-600 text-base" /> Paid
          </div>
          <div className="text-2xl sm:text-xl font-extrabold text-green-700 break-words">
            {formatUGX(totalPaidAmount)}
          </div>
        </div>

        {/* Balance Due */}
        <div className="bg-gradient-to-br from-red-50 to-orange-50 p-4 sm:p-3 rounded-lg border-2 border-red-400 shadow-md">
          <div className="text-xs text-red-700 mb-2 font-semibold uppercase tracking-wide flex items-center gap-1">
            <FiAlertCircle className="text-red-600 text-base" /> Balance
          </div>
          <div className="text-2xl sm:text-xl font-extrabold text-red-700 break-words">
            {formatUGX(order.total_amount_ugx - totalPaidAmount)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 bg-white p-4 sm:p-3 rounded-lg border-2 border-gray-300 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <span className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">Payment Progress</span>
          <span className={`text-2xl sm:text-xl font-extrabold ${getStatusColor()}`}>
            {paymentPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-8 sm:h-6 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-500 flex items-center justify-end pr-2 shadow-md`}
            style={{ width: `${Math.min(paymentPercentage, 100)}%` }}
          >
            {paymentPercentage > 5 && (
              <FiCheck className="text-white text-base sm:text-sm animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Payment Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {paymentPercentage >= 100 ? (
          <div className="flex items-center justify-center gap-2 text-base sm:text-sm font-bold text-green-700 bg-green-100 px-3 py-3 sm:py-2 rounded-lg border-2 border-green-500 shadow-md flex-1 touch-active:bg-green-200">
            <FiCheck className="text-2xl sm:text-xl" /> FULLY PAID
          </div>
        ) : paymentPercentage > 0 ? (
          <div className="flex items-center justify-center gap-2 text-base sm:text-sm font-bold text-yellow-700 bg-yellow-100 px-3 py-3 sm:py-2 rounded-lg border-2 border-yellow-500 shadow-md flex-1 touch-active:bg-yellow-200">
            <FiClock className="text-2xl sm:text-xl" /> PARTIALLY PAID
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-base sm:text-sm font-bold text-red-700 bg-red-100 px-3 py-3 sm:py-2 rounded-lg border-2 border-red-500 shadow-md flex-1 touch-active:bg-red-200">
            <FiAlertCircle className="text-2xl sm:text-xl" /> UNPAID
          </div>
        )}
        
        {/* Payment Method */}
        {order.payment_method && (
          <div className="text-xs sm:text-sm font-semibold text-gray-700 bg-white px-3 py-3 sm:py-2 rounded-lg border-2 border-gray-300 shadow-sm flex-1 sm:flex-initial text-center">
            💳 {order.payment_method.toUpperCase()}
          </div>
        )}
      </div>

      {/* Confirmation Status Indicator */}
      {paymentTransactions.length > 0 && (
        <div className="mt-4 p-3 sm:p-4 bg-white rounded-lg border-2 border-gray-300 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <FiCheckCircle className={unconfirmedCount === 0 ? 'text-green-500 text-xl sm:text-lg' : 'text-yellow-500 text-xl sm:text-lg'} />
              <span className="font-bold text-xs sm:text-sm text-gray-700">
                {unconfirmedCount === 0 ? 'All Payments Confirmed' : 'Confirmation Status'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm">
              <div>
                <span className="font-bold text-green-600">{paymentTransactions.filter(t => t.confirmed_by_supplier).length}</span>
                <span className="text-gray-500"> Confirmed</span>
              </div>
              {unconfirmedCount > 0 && (
                <div>
                  <span className="font-bold text-yellow-600">{unconfirmedCount}</span>
                  <span className="text-gray-500"> Pending</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Show recent transactions */}
          {paymentTransactions.length > 0 && (
            <div className="mt-3 space-y-2">
              {paymentTransactions.slice(0, 3).map((transaction) => (
                <div 
                  key={transaction.id} 
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 rounded-md text-xs ${
                    transaction.confirmed_by_supplier 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {transaction.confirmed_by_supplier ? (
                      <FiCheck className="text-green-600 text-base" />
                    ) : (
                      <FiClock className="text-yellow-600 text-base" />
                    )}
                    <span className="font-mono font-bold text-gray-700 break-all">
                      {transaction.transaction_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">
                      {formatUGX(transaction.amount_ugx)}
                    </span>
                    {transaction.confirmed_by_supplier && transaction.confirmation_date && (
                      <span className="text-gray-500 whitespace-nowrap">
                        ✓ {new Date(transaction.confirmation_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {paymentTransactions.length > 3 && (
                <div className="text-center text-xs text-gray-500 pt-1">
                  +{paymentTransactions.length - 3} more transactions
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Payment Modal - Mobile Optimized */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4 sm:p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between mb-4 sm:mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                <FiDollarSign className="text-green-600 text-xl sm:text-2xl" />
                Add Payment
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {/* Order Info */}
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4 border border-blue-200">
              <div className="text-xs sm:text-sm text-gray-600 mb-2">PO: {order.po_number}</div>
              <div className="text-lg sm:text-xl font-bold text-gray-800 break-words">
                Balance Due: {formatUGX(order.balance_due_ugx)}
              </div>
            </div>

            {/* Payment Amount */}
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Payment Amount (UGX) *
              </label>
              <input
                type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                className="w-full px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base sm:text-sm"
                placeholder="Enter amount"
                max={order.balance_due_ugx}
              />
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Payment Method *
              </label>
              <select
                value={paymentData.method}
                onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                className="w-full px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base sm:text-sm bg-white"
              >
                <option value="cash">💵 Cash</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="mobile_money">📱 Mobile Money</option>
                <option value="cheque">📄 Cheque</option>
              </select>
            </div>

            {/* Payment Reference */}
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                className="w-full px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base sm:text-sm"
                placeholder="Transaction reference"
              />
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                className="w-full px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-base sm:text-sm"
                rows="3"
                placeholder="Additional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-3 sm:py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 font-semibold text-base sm:text-sm"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPayment}
                disabled={loading}
                className="flex-1 px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 font-semibold text-base sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderPaymentTracker;
