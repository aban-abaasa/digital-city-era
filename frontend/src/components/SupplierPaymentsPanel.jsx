import React, { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import OrderPaymentTracker from './OrderPaymentTracker';
import '../styles/supplier-classic.css';

const formatUgx = (value) => `UGX ${Math.round(Number(value) || 0).toLocaleString()}`;

const PAYMENT_META = {
  paid: { label: 'Paid', tone: 'ok' },
  partially_paid: { label: 'Partial', tone: 'warn' },
  unpaid: { label: 'Unpaid', tone: 'bad' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partially_paid', label: 'Partial' },
  { id: 'paid', label: 'Paid' },
];

const paymentOf = (order) => (order.payment_status === 'paid' || order.payment_status === 'partially_paid' ? order.payment_status : 'unpaid');
const totalOf = (order) => Number(order.total_amount ?? order.amount) || 0;
const paidOf = (order) => {
  if (paymentOf(order) === 'paid') return totalOf(order);
  return Number(order.amount_paid_ugx ?? order.amount_paid) || 0;
};

/**
 * Supplier "Payments" tab. Every figure comes from the purchase orders the
 * supplier actually received (payment roll-up kept current when a payment is
 * confirmed). Orders are cards on every screen width; tap one for its payment
 * history.
 *
 * orders: pending orders first, then history. An order can be in both lists
 * (received / completed), so they are de-duplicated by order id here.
 */
export default function SupplierPaymentsPanel({ orders, loading, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const list = useMemo(() => {
    const seen = new Set();
    return (orders || []).filter((order) => {
      const key = order.orderId || order.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [orders]);

  const stats = useMemo(() => {
    const count = { paid: 0, partially_paid: 0, unpaid: 0 };
    let received = 0;
    let outstanding = 0;
    list.forEach((order) => {
      const state = paymentOf(order);
      count[state] += 1;
      received += paidOf(order);
      outstanding += Math.max(0, totalOf(order) - paidOf(order));
    });
    return { count, received, outstanding };
  }, [list]);

  const visible = list.filter((order) => filter === 'all' || paymentOf(order) === filter);

  return (
    <div className="spc">
      <section className="spc-hero">
        <p className="spc-eyebrow">Payments</p>
        <h2>What you have been paid</h2>
        <p>Payments recorded against your orders. Confirm each one you receive from Payment Confirmations so your balance stays correct.</p>
      </section>

      <div className="spc-stats">
        <div className="spc-stat is-ok">
          <p className="spc-stat-label">Received</p>
          <p className="spc-stat-value">{formatUgx(stats.received)}</p>
          <p className="spc-stat-note">{stats.count.paid} fully paid</p>
        </div>
        <div className="spc-stat is-bad">
          <p className="spc-stat-label">Outstanding</p>
          <p className="spc-stat-value">{formatUgx(stats.outstanding)}</p>
          <p className="spc-stat-note">{stats.count.unpaid + stats.count.partially_paid} orders open</p>
        </div>
        <div className="spc-stat is-warn">
          <p className="spc-stat-label">Part paid</p>
          <p className="spc-stat-value">{stats.count.partially_paid}</p>
          <p className="spc-stat-note">in progress</p>
        </div>
        <div className="spc-stat">
          <p className="spc-stat-label">Orders</p>
          <p className="spc-stat-value">{list.length}</p>
          <p className="spc-stat-note">{list.length ? `${Math.round((stats.count.paid / list.length) * 100)}% paid in full` : 'none yet'}</p>
        </div>
      </div>

      <section className="spc-card" aria-label="Payment details by order">
        <div className="spc-card-head">
          <div>
            <p className="spc-eyebrow">By order</p>
            <h3 className="spc-title">Payment details</h3>
          </div>
          <button type="button" className="spc-icon-btn" onClick={onRefresh} disabled={loading} title="Refresh" aria-label="Refresh payments">
            <RefreshCw size={18} className={loading ? 'spc-spin' : ''} />
          </button>
        </div>

        <div className="spc-seg" role="tablist" style={{ marginBottom: 12 }}>
          {FILTERS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'on' : ''} onClick={() => setFilter(item.id)}>
              {item.label}
              <b>{item.id === 'all' ? list.length : stats.count[item.id]}</b>
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="spc-empty"><b>No orders yet</b><span>Payment information appears here once a store orders from you.</span></div>
        ) : visible.length === 0 ? (
          <div className="spc-empty"><b>Nothing in this view</b><span>Pick a different filter above.</span></div>
        ) : (
          <div className="spc-list">
            {visible.map((order) => {
              const key = order.orderId || order.id;
              const open = expandedId === key;
              const state = paymentOf(order);
              const meta = PAYMENT_META[state];
              const total = totalOf(order);
              const paid = paidOf(order);
              const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
              return (
                <div key={key} className="spc-item">
                  <button type="button" className="spc-item-head" onClick={() => setExpandedId(open ? null : key)} aria-expanded={open}>
                    <div className="spc-item-main">
                      <p className="spc-item-title">{order.id}</p>
                      <p className="spc-item-meta">
                        {order.storeName ? `${order.storeName} · ` : ''}{order.date}
                      </p>
                    </div>
                    <div className="spc-item-side">
                      <span className="spc-amount">{formatUgx(total)}</span>
                      <span className={`spc-badge ${meta.tone}`}>{meta.label}</span>
                    </div>
                    <ChevronDown size={18} className={`spc-chev ${open ? 'open' : ''}`} />
                  </button>

                  {open && (
                    <div className="spc-item-body">
                      <div className="spc-bar" aria-label={`${pct}% paid`}><i style={{ width: `${pct}%` }} /></div>
                      <div className="spc-kv">
                        <div><p className="k">Order total</p><p className="v">{formatUgx(total)}</p></div>
                        <div><p className="k">Received</p><p className="v">{formatUgx(paid)}</p></div>
                        <div><p className="k">Balance</p><p className="v">{formatUgx(Math.max(0, total - paid))}</p></div>
                        <div><p className="k">Order status</p><p className="v" style={{ textTransform: 'capitalize' }}>{String(order.status || 'pending').replace(/_/g, ' ')}</p></div>
                        {order.products && <div className="wide"><p className="k">Products</p><p className="v">{order.products}</p></div>}
                      </div>
                      {(order.status === 'confirmed' || order.payment_status) && order.orderId && (
                        <div>
                          <p className="spc-sub-h" style={{ marginBottom: 6 }}>Payment history</p>
                          <OrderPaymentTracker order={order} showAddPayment={false} userRole="supplier" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
