// =====================================================================
// ORDER PAYMENT TRACKER COMPONENT - Interactive Payment Management
// =====================================================================
// Shows payment progress with ability to add payments
// Used in both Manager and Supplier portals
// =====================================================================

import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiPlus, FiCheck, FiClock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import supplierOrdersService, { getBusinessWalletBalance } from '../services/supplierOrdersService';
import { ugxToICAN, formatICAN } from '../services/icanWalletService';
import { useBackLayer } from '../hooks/useBackLayer';
import '../styles/order-payment-tracker.css';

const OrderPaymentTracker = ({ order, businessProfileId = null, onPaymentAdded, showAddPayment = false, userRole = 'viewer' }) => {
  const quotePaymentOnly = Boolean(order?.supplier_quote_status && order.supplier_quote_status !== 'not_requested');
  const quoteAccepted = order?.supplier_quote_status === 'accepted';
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  useBackLayer(showPaymentModal, () => setShowPaymentModal(false));
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: quotePaymentOnly ? 'ican_wallet' : 'cash',
    reference: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [icanBalance, setIcanBalance] = useState(null);
  const [icanBalanceLoading, setIcanBalanceLoading] = useState(false);

  // Load the current user's ICAN balance when they switch to the ICAN Wallet method
  useEffect(() => {
    if (paymentData.method !== 'ican_wallet' || icanBalance !== null || icanBalanceLoading) return;

    setIcanBalanceLoading(true);
    supabase.auth.getUser()
      .then(() => businessProfileId ? getBusinessWalletBalance(businessProfileId) : null)
      .then((bal) => setIcanBalance(bal))
      .catch(() => setIcanBalance(null))
      .finally(() => setIcanBalanceLoading(false));
  }, [paymentData.method, icanBalance, icanBalanceLoading, businessProfileId]);

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

  // purchase_orders stores the total as `total_amount`; older views use
  // `total_amount_ugx`, and supplier list rows expose the value as `amount`.
  const orderTotal = Math.max(0, Number(order?.total_amount_ugx) || Number(order?.total_amount) || Number(order?.amount) || 0);
  const reportedPaidAmount = Math.max(0, Number(order?.amount_paid_ugx) || Number(order?.amount_paid) || 0);
  const totalPaidAmount = Math.min(orderTotal, order?.payment_status === 'paid'
    ? orderTotal
    : Math.max(reportedPaidAmount, calculateTotalPaid()));
  const balanceDue = Math.max(0, orderTotal - totalPaidAmount);
  const paymentPercentage = orderTotal > 0
    ? Math.min(100, totalPaidAmount / orderTotal * 100)
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
    if (!['pending_approval', 'approved', 'sent_to_supplier', 'confirmed', 'received'].includes(order.status)) {
      alert('This purchase order is not available for payment in its current status.');
      setShowPaymentModal(false);
      return;
    }

    if (quotePaymentOnly && !quoteAccepted) {
      alert('The manager must approve the supplier proposal before payment can be requested.');
      return;
    }
    if (quotePaymentOnly && paymentData.method !== 'ican_wallet') {
      alert('Quote-based supply orders must use the business-wallet admin approval flow.');
      return;
    }

    if (order.status === 'pending_approval' && paymentData.method !== 'ican_wallet') {
      alert('A pending purchase order can only be submitted as an ICAN business-wallet approval request. Select ICANera Wallet to notify the authorized administrator.');
      return;
    }

    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const amount = parseFloat(paymentData.amount);
    if (amount > balanceDue) {
      alert(`Payment amount cannot exceed balance due: ${formatUGX(balanceDue)}`);
      return;
    }

    const orderId = order?.orderId || order?.order_uuid || order?.id;

    setLoading(true);
    try {
      if (paymentData.method === 'ican_wallet') {
        const icanNeeded = ugxToICAN(amount);
        if (!icanBalance || icanBalance.ican < icanNeeded) {
          alert(
            `Insufficient ICAN balance.\n\n` +
            `Needed: ${formatICAN(icanNeeded)} ICAN\n` +
            `Available: ${formatICAN(icanBalance?.ican || 0)} ICAN`
          );
          setLoading(false);
          return;
        }

        const payResult = await supplierOrdersService.payOrderWithICAN({
          orderId,
          supplierUserId: order.supplier_id,
          supplierBusinessProfileId: order.supplier_business_profile_id,
          icanAmount:     icanNeeded,
          ugxAmount:      amount,
          businessProfileId,
          notes:          paymentData.notes || null,
        });

        if (!payResult.success) {
          if (payResult.requires_order_approval) {
            alert('This purchase order cannot be submitted for wallet approval in its current status.');
            return;
          }
          throw new Error(payResult.error);
        }

        alert(payResult.wallet_approval_required
          ? `🔔 ICAN payment request submitted.\n\nAmount: ${formatUGX(amount)}\n\nAn authorized wallet administrator must approve it with the business-wallet PIN.`
          : `✅ Paid ${formatICAN(icanNeeded)} ICAN from the store business wallet!\n\nAmount: ${formatUGX(amount)}\n\nThe supplier's business wallet has been credited.`);
      } else {
        // Get the internal user ID from users table (not auth_id)
        const { data: { user } } = await supabase.auth.getUser();
        let internalUserId = null;
        if (user?.id) {
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

          internalUserId = userData?.id;
        }

        const payResult = await supplierOrdersService.recordPayment({
          orderId:          orderId,
          amountPaid:       amount,
          paymentMethod:    paymentData.method,
          paymentReference: paymentData.reference || null,
          notes:            paymentData.notes || null,
          paidBy:           internalUserId
        });

        if (!payResult.success) throw new Error(payResult.error);

        alert(
          `✅ Payment Submitted for Supplier Confirmation!\n\n` +
          `Amount: ${formatUGX(amount)}\n` +
          `Method: ${paymentData.method.toUpperCase()}\n\n` +
          `⏳ This payment is PENDING supplier confirmation.\n` +
          `The order balance will update once the supplier confirms receipt.`
        );
      }

      // Reset form
      setPaymentData({
        amount: '',
        method: quotePaymentOnly ? 'ican_wallet' : 'cash',
        reference: '',
        notes: ''
      });
      setIcanBalance(null);
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
    <div className="opt">
      {/* Header */}
      <div className="opt-header">
        <h3>
          <FiDollarSign aria-hidden="true" />
          Payment Progress
        </h3>
        {showAddPayment && (!quotePaymentOnly || quoteAccepted) && balanceDue > 0 && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="opt-add"
          >
            <FiPlus aria-hidden="true" /> Add Payment
          </button>
        )}
      </div>

      {/* Payment Stats Grid - Responsive Stack */}
      <dl className="opt-money">
        <div>
          <dt>Total amount</dt>
          <dd>{formatUGX(orderTotal)}</dd>
        </div>
        <div className="is-paid">
          <dt>Paid</dt>
          <dd>{formatUGX(totalPaidAmount)}</dd>
        </div>
        <div className="is-due">
          <dt>Remaining</dt>
          <dd>{formatUGX(balanceDue)}</dd>
        </div>
      </dl>

      {/* Progress Bar */}
      <div className="opt-progress">
        <div className="opt-progress-label">
          <span>Payment progress</span>
          <span className={getStatusColor()}>
            {paymentPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="opt-progress-track">
          <div
            className={getProgressColor()}
            style={{ width: `${Math.min(paymentPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Payment Status Badge */}
      <div className="opt-status">
        {paymentPercentage >= 100 ? (
          <span className="is-paid"><FiCheck aria-hidden="true" /> Fully paid</span>
        ) : paymentPercentage > 0 ? (
          <span className="is-pending"><FiClock aria-hidden="true" /> Partially paid</span>
        ) : (
          <span className="is-due"><FiAlertCircle aria-hidden="true" /> Unpaid</span>
        )}
        
        {/* Payment Method */}
        {order.payment_method && (
          <div className="opt-method">
            💳 {order.payment_method.toUpperCase()}
          </div>
        )}
      </div>

      {/* Confirmation Status Indicator */}
      {paymentTransactions.length > 0 && (
        <div className="opt-confirmations">
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
                Balance Due: {formatUGX(balanceDue)}
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
                max={balanceDue}
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
                disabled={quotePaymentOnly}
                className="w-full px-4 py-3 sm:py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base sm:text-sm bg-white"
              >
                <option value="cash">💵 Cash</option>
                <option value="ican_wallet">🪙 IcanEra Wallet</option>
              </select>
              {quotePaymentOnly && <p className="mt-2 text-xs text-indigo-700">Admin approval with the business-wallet PIN is required for these orders.</p>}
            </div>

            {/* ICAN Wallet Balance — shown only when paying with ICAN */}
            {paymentData.method === 'ican_wallet' && (
              <div className="mb-4 p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-300">
                <div className="text-xs sm:text-sm text-gray-600 mb-1">Your IcanEra Balance</div>
                {icanBalanceLoading ? (
                  <div className="text-sm text-gray-500">Loading balance...</div>
                ) : (
                  <>
                    <div className="text-lg sm:text-xl font-bold text-purple-700">
                      {formatICAN(icanBalance?.ican || 0)} ICAN
                    </div>
                    {parseFloat(paymentData.amount) > 0 && (
                      <div className="text-xs sm:text-sm text-gray-600 mt-1">
                        This payment needs ≈ {formatICAN(ugxToICAN(parseFloat(paymentData.amount)))} ICAN
                        {icanBalance && icanBalance.ican < ugxToICAN(parseFloat(paymentData.amount)) && (
                          <span className="text-red-600 font-semibold"> — insufficient balance</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Payment Reference — not applicable to ICAN Wallet, the on-chain tx is the reference */}
            {paymentData.method !== 'ican_wallet' && (
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
            )}

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
                disabled={loading || (
                  paymentData.method === 'ican_wallet' &&
                  parseFloat(paymentData.amount) > 0 &&
                  icanBalance &&
                  icanBalance.ican < ugxToICAN(parseFloat(paymentData.amount))
                )}
                className="flex-1 px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 font-semibold text-base sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? 'Recording...' : paymentData.method === 'ican_wallet' ? 'Pay with ICAN' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderPaymentTracker;
