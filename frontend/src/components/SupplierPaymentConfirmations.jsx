import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiClock, FiDollarSign, FiCalendar, FiFileText, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { supabase } from '../services/supabase';

const SupplierPaymentConfirmations = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const formatUGX = (amount) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount || 0);

  const methodIcon = (m) => ({ cash: '💵', mobile_money: '📱', bank_transfer: '🏦', check: '📝', credit: '💳' }[m] || '💰');
  const methodLabel = (m) => ({ cash: 'Cash', mobile_money: 'Mobile Money', bank_transfer: 'Bank Transfer', check: 'Cheque', credit: 'Credit' }[m] || m || 'Payment');

  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setLoading(false); return; }

      // Step 1: find all purchase_orders for this supplier (auth UUID)
      const { data: orders, error: ordErr } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, status, ordered_at')
        .eq('supplier_id', user.id);

      if (ordErr) throw ordErr;
      if (!orders?.length) { setPayments([]); setLoading(false); return; }

      const orderIds = orders.map(o => o.id);
      const orderMap = Object.fromEntries(orders.map(o => [o.id, o]));

      // Step 2: fetch unconfirmed payments from payment_transactions
      const { data: txns, error: txErr } = await supabase
        .from('payment_transactions')
        .select('*')
        .in('purchase_order_id', orderIds)
        .eq('confirmed_by_supplier', false)
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;

      // Enrich with order data
      const enriched = (txns || []).map(t => ({
        ...t,
        order: orderMap[t.purchase_order_id] || {},
        daysPending: Math.floor((Date.now() - new Date(t.created_at)) / 86400000)
      }));

      setPayments(enriched);
    } catch (err) {
      console.error('Error loading payments:', err);
      setError(err?.message || 'Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (txnId) => {
    try {
      const { error } = await supabase
        .from('payment_transactions')
        .update({
          confirmed_by_supplier: true,
          confirmation_date: new Date().toISOString(),
          confirmation_notes: confirmNotes.trim() || null,
          payment_status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', txnId);

      if (error) throw error;

      setSuccessMsg('✅ Payment confirmed successfully!');
      setConfirmingId(null);
      setConfirmNotes('');
      loadPayments();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error confirming payment:', err);
      alert(`Failed to confirm payment: ${err?.message || 'Unknown error'}`);
    }
  };

  useEffect(() => { loadPayments(); }, []);

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
              <p className="text-gray-600 mt-1">Review and confirm payments received from managers</p>
            </div>
            <button
              onClick={loadPayments}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="bg-green-100 border-2 border-green-400 text-green-800 px-6 py-4 rounded-lg mb-6 flex items-center gap-3">
            <FiCheckCircle className="text-2xl" />
            <p className="font-semibold">{successMsg}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-800 px-6 py-4 rounded-lg mb-6 flex items-center gap-3">
            <FiAlertCircle className="text-2xl" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading payments...</p>
          </div>
        )}

        {!loading && payments.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FiCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">All Caught Up! 🎉</h2>
            <p className="text-gray-600">No pending payment confirmations at this time.</p>
          </div>
        )}

        {!loading && payments.length > 0 && (
          <div className="space-y-4">
            <div className="bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-6 py-4 rounded-lg flex items-center gap-3">
              <FiAlertCircle className="text-2xl" />
              <p className="font-semibold">
                {payments.length} payment{payments.length > 1 ? 's' : ''} awaiting your confirmation
              </p>
            </div>

            {payments.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-yellow-300">

                {/* Card Header */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 px-6 py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        PO #{p.order?.po_number || p.purchase_order_id?.slice(-8)}
                      </h3>
                      <p className="text-yellow-100 text-sm">
                        Order Total: {formatUGX(p.order?.total_amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-white">{formatUGX(p.amount_ugx)}</p>
                      <p className="text-yellow-100 text-sm">Payment Amount</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                    {/* Payment Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FiDollarSign /> Payment Details
                      </h4>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Method</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {methodIcon(p.payment_method)} {methodLabel(p.payment_method)}
                        </p>
                      </div>

                      {p.payment_reference && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-600">Reference</p>
                          <p className="text-lg font-semibold text-gray-800">{p.payment_reference}</p>
                        </div>
                      )}

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Payment Date</p>
                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                          <FiCalendar />
                          {new Date(p.payment_date || p.created_at).toLocaleDateString('en-UG', {
                            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                          })}
                        </p>
                      </div>

                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                        <p className="text-sm text-gray-600">Days Pending</p>
                        <p className="text-lg font-semibold text-orange-600 flex items-center gap-2">
                          <FiClock />
                          {p.daysPending} day{p.daysPending !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Order Info */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FiFileText /> Order Information
                      </h4>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Order Status</p>
                        <p className="text-lg font-semibold text-gray-800 capitalize">
                          {p.order?.status?.replace(/_/g, ' ') || 'N/A'}
                        </p>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Order Date</p>
                        <p className="font-semibold text-gray-800">
                          {p.order?.ordered_at ? new Date(p.order.ordered_at).toLocaleDateString('en-UG') : 'N/A'}
                        </p>
                      </div>

                      {p.notes && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-600 font-semibold mb-1">Manager Notes:</p>
                          <p className="text-gray-700 text-sm">{p.notes}</p>
                        </div>
                      )}

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Recorded At</p>
                        <p className="font-semibold text-gray-800">{new Date(p.created_at).toLocaleString('en-UG')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Section */}
                  {confirmingId === p.id ? (
                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                      <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                        <FiCheckCircle className="text-2xl" />
                        Confirm Payment Receipt
                      </h4>
                      <textarea
                        value={confirmNotes}
                        onChange={(e) => setConfirmNotes(e.target.value)}
                        placeholder="Optional notes about this payment..."
                        rows="3"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none mb-4"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleConfirm(p.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <FiCheckCircle className="text-xl" />
                          Confirm Payment Received
                        </button>
                        <button
                          onClick={() => { setConfirmingId(null); setConfirmNotes(''); }}
                          className="px-6 py-3 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(p.id)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
                    >
                      <FiCheckCircle className="text-xl" />
                      Confirm Payment
                    </button>
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
