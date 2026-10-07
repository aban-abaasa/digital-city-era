import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import '../styles/supplier-classic.css';
import { confirmPayment, getSupplierOrderMatchIds, getSupplierBusinessProfileMatchIds } from '../services/supplierOrdersService';

const SupplierPaymentConfirmations = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const formatUGX = (amount) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount || 0);

  const methodLabel = (m) => ({ cash: 'Cash', mobile_money: 'Mobile Money', bank_transfer: 'Bank Transfer', check: 'Cheque', credit: 'Credit' }[m] || m || 'Payment');

  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not logged in'); setLoading(false); return; }

      // Step 1: find all purchase_orders for this supplier — supplier_id may be
      // stored as either the auth UUID or the internal users.id row
      const matchIds = await getSupplierOrderMatchIds(user.id);
      const businessProfileIds = await getSupplierBusinessProfileMatchIds(user.id);
      let ordersQuery = supabase
        .from('purchase_orders')
        .select('id, po_number, total_amount, status, ordered_at')
      const identityFilters = [`supplier_id.in.(${matchIds.join(',')})`];
      if (businessProfileIds.length) {
        identityFilters.push(`supplier_business_profile_id.in.(${businessProfileIds.join(',')})`);
      }
      ordersQuery = ordersQuery.or(identityFilters.join(','));
      const { data: orders, error: ordErr } = await ordersQuery;

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
    setSavingId(txnId);
    try {
      // Confirms the payment_transactions row AND rolls the confirmed total
      // up onto purchase_orders.amount_paid_ugx/balance_due_ugx/payment_status —
      // updating only the transaction row (as before) left the order's
      // tracked balance stuck at "unpaid" even after confirmation.
      const result = await confirmPayment(txnId, confirmNotes);
      if (!result.success) throw new Error(result.error);

      setSuccessMsg('Payment confirmed. Your order balance has been updated.');
      setActionError('');
      setConfirmingId(null);
      setConfirmNotes('');
      loadPayments();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error confirming payment:', err);
      setActionError(`Could not confirm the payment: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => { loadPayments(); }, []);

  return (
    <div className="spc">
      <section className="spc-hero">
        <p className="spc-eyebrow">Payment confirmations</p>
        <h2>Confirm what you received</h2>
        <p>A store has recorded a payment to you. Confirm it once the money has reached you, and the order balance updates.</p>
      </section>

      {successMsg && <p className="spc-note ok" role="status">{successMsg}</p>}
      {error && <p className="spc-note bad">{error}</p>}
      {actionError && <p className="spc-note bad">{actionError}</p>}

      <section className="spc-card" aria-label="Payments awaiting confirmation">
        <div className="spc-card-head">
          <div>
            <p className="spc-eyebrow">Awaiting you</p>
            <h3 className="spc-title">{loading ? 'Loading payments…' : `${payments.length} payment${payments.length === 1 ? '' : 's'} to confirm`}</h3>
          </div>
          <button type="button" className="spc-icon-btn" onClick={loadPayments} disabled={loading} title="Refresh" aria-label="Refresh payments">
            <RefreshCw size={18} className={loading ? 'spc-spin' : ''} />
          </button>
        </div>

        {!loading && payments.length === 0 && !error && (
          <div className="spc-empty"><b>All caught up</b><span>No payments are waiting for your confirmation.</span></div>
        )}

        <div className="spc-list">
          {payments.map((p) => (
            <div key={p.id} className="spc-item">
              <div className="spc-item-head" style={{ cursor: 'default' }}>
                <div className="spc-item-main">
                  <p className="spc-item-title">PO #{p.order?.po_number || p.purchase_order_id?.slice(-8)}</p>
                  <p className="spc-item-meta">Order total {formatUGX(p.order?.total_amount)}</p>
                </div>
                <div className="spc-item-side">
                  <span className="spc-amount">{formatUGX(p.amount_ugx)}</span>
                  <span className={`spc-badge ${p.daysPending > 3 ? 'warn' : 'info'}`}>{p.daysPending} day{p.daysPending !== 1 ? 's' : ''} pending</span>
                </div>
              </div>

              <div className="spc-item-body">
                <div className="spc-kv">
                  <div><p className="k">Method</p><p className="v">{methodLabel(p.payment_method)}</p></div>
                  <div><p className="k">Payment date</p><p className="v">{new Date(p.payment_date || p.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                  {p.payment_reference && <div><p className="k">Reference</p><p className="v">{p.payment_reference}</p></div>}
                  <div><p className="k">Order status</p><p className="v" style={{ textTransform: 'capitalize' }}>{p.order?.status?.replace(/_/g, ' ') || 'N/A'}</p></div>
                  <div><p className="k">Order date</p><p className="v">{p.order?.ordered_at ? new Date(p.order.ordered_at).toLocaleDateString('en-UG') : 'N/A'}</p></div>
                  <div><p className="k">Recorded</p><p className="v">{new Date(p.created_at).toLocaleString('en-UG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
                  {p.notes && <div className="wide"><p className="k">Manager notes</p><p className="v">{p.notes}</p></div>}
                </div>

                {confirmingId === p.id ? (
                  <>
                    <label className="spc-field">
                      <span>Note (optional)</span>
                      <textarea className="spc-input" rows={2} value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder="Anything to record about this payment" />
                    </label>
                    <div className="spc-actions">
                      <button type="button" className="spc-btn ghost" onClick={() => { setConfirmingId(null); setConfirmNotes(''); }}>Cancel</button>
                      <button type="button" className="spc-btn ok" disabled={savingId === p.id} onClick={() => handleConfirm(p.id)}>
                        {savingId === p.id ? 'Confirming…' : 'Yes, I received it'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="spc-actions">
                    <button type="button" className="spc-btn ok" onClick={() => { setConfirmingId(p.id); setActionError(''); }}>Confirm payment</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SupplierPaymentConfirmations;
