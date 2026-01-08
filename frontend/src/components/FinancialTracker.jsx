import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FiDollarSign, FiTrendingUp, FiCalendar, FiCheck, FiAlertCircle, FiClock } from 'react-icons/fi';

const FinancialTracker = ({ orderId, order }) => {
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      loadPaymentHistory();
    }
  }, [orderId]);

  const loadPaymentHistory = async () => {
    try {
      const { data, error } = await supabase.rpc('get_order_history', {
        p_order_id: orderId
      });

      if (error) throw error;
      
      // Filter only payment-related actions
      const paymentRecords = data?.filter(record => 
        ['approved', 'payment_updated', 'balance_adjusted'].includes(record.action)
      ) || [];
      
      setPaymentHistory(paymentRecords);
    } catch (error) {
      console.error('Error loading payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalPaid = () => {
    return paymentHistory.reduce((sum, record) => {
      return sum + (parseFloat(record.amount_paid_ugx) || 0);
    }, 0);
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      'paid': 'bg-green-100 text-green-800 border-green-300',
      'partially_paid': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'unpaid': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading financial data...</p>
      </div>
    );
  }

  const totalAmount = order?.total_amount_ugx || 0;
  const totalPaid = order?.amount_paid_ugx || 0;
  const balanceDue = order?.balance_due_ugx || (totalAmount - totalPaid);
  const paymentPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Amount */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FiDollarSign className="h-8 w-8 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Total</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totalAmount)}</p>
          <p className="text-sm opacity-80 mt-1">Order Amount</p>
        </div>

        {/* Amount Paid */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FiCheck className="h-8 w-8 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Paid</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totalPaid)}</p>
          <p className="text-sm opacity-80 mt-1">{paymentPercentage.toFixed(1)}% Paid</p>
        </div>

        {/* Balance Due */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FiAlertCircle className="h-8 w-8 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Balance</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(balanceDue)}</p>
          <p className="text-sm opacity-80 mt-1">Outstanding</p>
        </div>

        {/* Payment Status */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FiTrendingUp className="h-8 w-8 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Status</span>
          </div>
          <p className="text-2xl font-bold capitalize">
            {order?.payment_status?.replace('_', ' ') || 'Unpaid'}
          </p>
          <p className="text-sm opacity-80 mt-1">{paymentHistory.length} Transactions</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800">Payment Progress</h3>
          <span className="text-2xl font-bold text-blue-600">{paymentPercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
          <div 
            className="h-6 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-2"
            style={{width: `${Math.min(paymentPercentage, 100)}%`}}
          >
            {paymentPercentage > 10 && (
              <span className="text-white text-xs font-bold">{paymentPercentage.toFixed(0)}%</span>
            )}
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mt-2">
          <span>Paid: {formatCurrency(totalPaid)}</span>
          <span>Remaining: {formatCurrency(balanceDue)}</span>
        </div>
      </div>

      {/* Next Payment Due */}
      {order?.next_payment_date && balanceDue > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex items-center space-x-4">
          <div className="bg-yellow-500 rounded-full p-3">
            <FiClock className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-yellow-900">Next Payment Due</p>
            <p className="text-yellow-700">
              {formatDate(order.next_payment_date)} - Balance: {formatCurrency(balanceDue)}
            </p>
          </div>
        </div>
      )}

      {/* Payment History Timeline */}
      <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <FiCalendar className="mr-2" />
          Payment History & Timeline
        </h3>

        {paymentHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiAlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No payment records yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentHistory.map((record, index) => {
              const isPayment = record.amount_paid_ugx > 0;
              const metadata = record.metadata || {};
              
              return (
                <div 
                  key={record.id} 
                  className="relative pl-8 pb-6 border-l-4 border-blue-300 last:border-transparent"
                >
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-0 transform -translate-x-1/2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isPayment ? 'bg-green-500' : 'bg-blue-500'
                    }`}>
                      {isPayment ? (
                        <FiCheck className="h-4 w-4 text-white" />
                      ) : (
                        <FiDollarSign className="h-4 w-4 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Record content */}
                  <div className="bg-gray-50 rounded-lg p-4 ml-4 border-2 border-gray-200 hover:border-blue-300 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-800 capitalize">
                          {record.action.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-600">{formatDate(record.changed_at)}</p>
                      </div>
                      {isPayment && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(record.amount_paid_ugx)}
                          </p>
                          <p className="text-xs text-gray-600">{record.payment_method}</p>
                        </div>
                      )}
                    </div>

                    {/* Payment Status Change */}
                    {record.old_payment_status !== record.new_payment_status && (
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${getPaymentStatusColor(record.old_payment_status)}`}>
                          {record.old_payment_status || 'unpaid'}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${getPaymentStatusColor(record.new_payment_status)}`}>
                          {record.new_payment_status}
                        </span>
                      </div>
                    )}

                    {/* Metadata Details */}
                    {metadata.total_paid !== undefined && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-gray-600 text-xs">Total Paid</p>
                          <p className="font-bold text-green-600">{formatCurrency(metadata.total_paid)}</p>
                        </div>
                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-gray-600 text-xs">Balance</p>
                          <p className="font-bold text-red-600">{formatCurrency(metadata.balance_due)}</p>
                        </div>
                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-gray-600 text-xs">Order Total</p>
                          <p className="font-bold text-blue-600">{formatCurrency(metadata.total_amount)}</p>
                        </div>
                      </div>
                    )}

                    {/* Balance Adjustment */}
                    {record.action === 'balance_adjusted' && metadata.old_total && (
                      <div className="mt-3 bg-purple-50 rounded p-3 border border-purple-200">
                        <p className="text-sm font-bold text-purple-900 mb-1">Order Total Adjusted</p>
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-gray-600">{formatCurrency(metadata.old_total)}</span>
                          <span className="text-purple-600">→</span>
                          <span className="text-purple-900 font-bold">{formatCurrency(metadata.new_total)}</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            metadata.adjustment_type === 'discount' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {metadata.adjustment_type === 'discount' ? '-' : '+'}{formatCurrency(Math.abs(metadata.adjustment_amount))}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {record.notes && (
                      <div className="mt-2 text-sm text-gray-700 bg-blue-50 rounded p-2 border border-blue-200">
                        <strong>Note:</strong> {record.notes}
                      </div>
                    )}

                    {/* Changed By */}
                    <p className="text-xs text-gray-500 mt-2">
                      By: {record.changed_by_name || record.changed_by_email || 'System'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Financial Summary Footer */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 text-white">
        <h4 className="text-lg font-bold mb-4">Financial Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm opacity-80">Total Transactions</p>
            <p className="text-2xl font-bold">{paymentHistory.length}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">Average Payment</p>
            <p className="text-2xl font-bold">
              {formatCurrency(paymentHistory.length > 0 ? totalPaid / paymentHistory.length : 0)}
            </p>
          </div>
          <div>
            <p className="text-sm opacity-80">Payment Method</p>
            <p className="text-lg font-bold capitalize">{order?.payment_method || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">Last Payment</p>
            <p className="text-lg font-bold">
              {order?.last_payment_date ? formatDate(order.last_payment_date).split(',')[0] : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialTracker;
