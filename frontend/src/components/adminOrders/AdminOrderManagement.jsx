import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiCalendar, FiChevronRight, FiClock, FiDollarSign, FiDownload, FiInbox, FiPackage,
  FiRefreshCw, FiSearch, FiShoppingBag, FiShoppingCart, FiTruck, FiX
} from 'react-icons/fi';
import useAdminOrders, { statusInfo } from './useAdminOrders';
import './AdminOrderManagement.css';

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const money = (n) => `UGX ${Math.round(n || 0).toLocaleString('en-UG')}`;
const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-UG'));
const plural = (n, one, many) => (n === 1 ? one : many);

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
};
const prettify = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const ago = (date, now) => {
  if (!date) return '';
  const mins = Math.floor((now - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return date.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
};

const PERIODS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' }
];
const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'sale', label: 'Sales' },
  { id: 'purchase', label: 'Purchases' }
];
const STATUSES = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' }
];

const periodStart = (period) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'today') return d.getTime();
  if (period === '7d') return d.getTime() - 6 * DAY_MS;
  if (period === '30d') return d.getTime() - 29 * DAY_MS;
  return 0;
};

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportCsv = (rows) => {
  const head = ['Order', 'Type', 'Status', 'Date', 'Time', 'Customer / Supplier', 'Phone', 'Items', 'Products', 'Payment', 'Amount (UGX)'];
  const lines = rows.map((o) => [
    o.number,
    o.kind === 'sale' ? 'Sale' : 'Purchase',
    statusInfo(o).label,
    fmtDate(o.createdAt),
    fmtTime(o.createdAt),
    o.party,
    o.phone,
    o.itemCount,
    o.lines.map((l) => `${l.name} x${l.qty}`).join('; '),
    prettify(o.method),
    Math.round(o.amount)
  ]);
  const csv = [head, ...lines].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const productSummary = (o) => {
  if (!o.lines.length) return o.itemCount ? `${o.itemCount} ${plural(o.itemCount, 'item', 'items')}` : 'No products recorded';
  const first = o.lines.slice(0, 2).map((l) => `${l.name} ×${l.qty}`).join(', ');
  const more = o.lines.length - 2;
  return more > 0 ? `${first} +${more} more` : first;
};

const StatusBadge = ({ order }) => {
  const s = statusInfo(order);
  return <span className={`aom-badge aom-badge-${s.tone}`}>{s.label}</span>;
};

const KindTag = ({ kind }) => (
  <span className={`aom-kind aom-kind-${kind}`}>
    {kind === 'sale' ? <FiShoppingCart aria-hidden="true" /> : <FiTruck aria-hidden="true" />}
    {kind === 'sale' ? 'Sale' : 'Purchase'}
  </span>
);

const Tile = ({ icon, label, value, sub, loading }) => {
  const Icon = icon;
  return (
  <div className="aom-tile">
    <span className="aom-tile-icon"><Icon aria-hidden="true" /></span>
    <div className="aom-tile-body">
      <p className="aom-tile-label">{label}</p>
      <p className={`aom-tile-value${loading ? ' aom-skel' : ''}`}>{loading ? '\u00a0' : value}</p>
      <p className="aom-tile-sub">{sub}</p>
    </div>
  </div>
  );
};

const Row = ({ label, children }) => (
  children ? (
    <div className="aom-meta-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  ) : null
);

const OrderSheet = ({ order, onClose }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const isSale = order.kind === 'sale';
  const showBreakdown = order.subtotal !== null && order.tax !== null && order.tax > 0;

  return createPortal(
    <div className="aom aom-portal">
      <div className="aom-backdrop" onClick={onClose} role="presentation">
        <div
          className="aom-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={`Order ${order.number}`}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="aom-sheet-head">
            <div className="aom-sheet-title">
              <KindTag kind={order.kind} />
              <h3>{order.number}</h3>
            </div>
            <StatusBadge order={order} />
            <button type="button" ref={closeRef} className="aom-icon-btn" onClick={onClose} aria-label="Close order details">
              <FiX aria-hidden="true" />
            </button>
          </header>

          <div className="aom-sheet-body">
            <p className="aom-sheet-total">{money(order.amount)}</p>

            <dl className="aom-meta">
              <Row label="Placed">{`${fmtDate(order.createdAt)} · ${fmtTime(order.createdAt)}`}</Row>
              <Row label={isSale ? 'Customer' : 'Supplier'}>{order.party}</Row>
              <Row label="Phone">{order.phone}</Row>
              <Row label="Served by">{order.cashier}</Row>
              <Row label="Expected delivery">{order.expectedAt ? fmtDate(order.expectedAt) : ''}</Row>
              <Row label="Payment">{[prettify(order.method), order.paymentStatus && prettify(order.paymentStatus)].filter(Boolean).join(' · ')}</Row>
              <Row label="Balance due">{order.balanceDue > 0 ? money(order.balanceDue) : ''}</Row>
            </dl>

            <h4 className="aom-sheet-sub">{isSale ? 'Products sold' : 'Products ordered'}</h4>
            {order.lines.length ? (
              <div className="aom-lines">
                <div className="aom-line aom-line-head" aria-hidden="true">
                  <span>Product</span><span>Qty</span><span>Price</span><span>Total</span>
                </div>
                {order.lines.map((l, i) => (
                  <div className="aom-line" key={`${l.name}-${i}`}>
                    <span className="aom-line-name">{l.name}</span>
                    <span><b className="aom-only-sm">Qty </b>{l.qty}</span>
                    <span>{Math.round(l.unit).toLocaleString('en-UG')}</span>
                    <span className="aom-line-total">{Math.round(l.total).toLocaleString('en-UG')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="aom-muted">No itemised products were recorded for this order.</p>
            )}

            <div className="aom-totals">
              {showBreakdown && (
                <>
                  <div><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                  <div><span>Tax</span><span>{money(order.tax)}</span></div>
                </>
              )}
              <div className="aom-totals-grand"><span>Total</span><span>{money(order.amount)}</span></div>
            </div>

            {order.notes && (
              <>
                <h4 className="aom-sheet-sub">Notes</h4>
                <p className="aom-notes">{order.notes}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const AdminOrderManagement = ({ supermarketId, storeName }) => {
  const {
    orders, stats, truncated, failed, loading, refreshing, updatedAt, refresh, loadOlder, canLoadOlder, limit
  } = useAdminOrders({ supermarketId });

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Keeps the "Updated 2 min ago" label honest between refreshes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setVisible(PAGE_SIZE); }, [query, kind, status, period]);

  // Everything except the status chip, so each chip can show how many orders it would list.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = periodStart(period);
    return orders.filter((o) => {
      if (kind !== 'all' && o.kind !== kind) return false;
      if (from && new Date(o.createdAt).getTime() < from) return false;
      if (!q) return true;
      return [o.number, o.party, o.phone, o.cashier, o.id, ...o.lines.map((l) => l.name)]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [orders, query, kind, period]);

  const statusCounts = useMemo(() => {
    const c = { all: base.length, pending: 0, completed: 0, cancelled: 0 };
    base.forEach((o) => { c[statusInfo(o).group] += 1; });
    return c;
  }, [base]);

  const filtered = useMemo(
    () => (status === 'all' ? base : base.filter((o) => statusInfo(o).group === status)),
    [base, status]
  );

  const shown = filtered.slice(0, visible);
  const filtersActive = Boolean(query.trim()) || kind !== 'all' || status !== 'all' || period !== 'all';
  const clearFilters = () => { setQuery(''); setKind('all'); setStatus('all'); setPeriod('all'); };

  if (!supermarketId) {
    return (
      <div className="aom">
        <p className="aom-note">Your admin account isn’t linked to a supermarket yet, so there are no orders to show.</p>
      </div>
    );
  }

  const failedNames = failed.map((f) => ({
    sales: 'sales',
    purchases: 'purchase orders',
    today: 'today’s figures',
    'transactions-pending': 'pending sales',
    'purchase_orders-pending': 'pending purchase orders'
  }[f] || f));

  return (
    <div className="aom">
      <header className="aom-head">
        <div className="aom-head-text">
          <p className="aom-eyebrow">Orders</p>
          <h2>Order management</h2>
          <p className="aom-sub">
            Every sale and supplier order for {storeName || 'your store'}
            {updatedAt && <> · <span className="aom-updated">Updated {ago(updatedAt, now)}</span></>}
          </p>
        </div>
        <div className="aom-head-actions">
          <button
            type="button"
            className="aom-btn"
            onClick={() => exportCsv(filtered)}
            disabled={!filtered.length}
          >
            <FiDownload aria-hidden="true" /><span>Export</span>
          </button>
          <button
            type="button"
            className="aom-btn aom-btn-primary"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh orders"
          >
            <FiRefreshCw aria-hidden="true" className={refreshing ? 'aom-spin' : ''} /><span>Refresh</span>
          </button>
        </div>
      </header>

      {failedNames.length > 0 && (
        <p className="aom-note" role="status">
          Couldn’t load {failedNames.join(', ')} right now. The figures that depend on {failedNames.length === 1 ? 'it' : 'them'} show “—” instead of a guess.
        </p>
      )}

      <section className="aom-tiles" aria-label="Order summary">
        <Tile icon={FiShoppingBag} label="Total orders" value={num(stats.total)} sub="Sales and purchases" loading={loading} />
        <Tile icon={FiCalendar} label="Today" value={num(stats.today)} sub="Placed since midnight" loading={loading} />
        <Tile icon={FiClock} label="Pending" value={num(stats.pending)} sub="Not yet completed" loading={loading} />
        <Tile
          icon={FiDollarSign}
          label="Revenue today"
          value={stats.revenueToday === null ? '—' : money(stats.revenueToday)}
          sub="Sales, excl. cancelled"
          loading={loading}
        />
      </section>

      <section className="aom-panel">
        <div className="aom-toolbar">
          <div className="aom-search">
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order no., customer, supplier or product"
              aria-label="Search orders"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className="aom-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <FiX aria-hidden="true" />
              </button>
            )}
          </div>
          <select
            className="aom-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Time period"
          >
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        <div className="aom-filters">
          <div className="aom-seg" role="group" aria-label="Order type">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={kind === k.id ? 'is-on' : ''}
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
              >{k.label}</button>
            ))}
          </div>
          <div className="aom-chips" role="group" aria-label="Order status">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={status === s.id ? 'is-on' : ''}
                aria-pressed={status === s.id}
                onClick={() => setStatus(s.id)}
              >
                {s.label}<b>{statusCounts[s.id]}</b>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="aom-state" role="status">
            <FiRefreshCw className="aom-spin" aria-hidden="true" />
            <p>Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="aom-state">
            <FiInbox aria-hidden="true" />
            {filtersActive ? (
              <>
                <p>No orders match these filters.</p>
                <button type="button" className="aom-btn" onClick={clearFilters}>Clear filters</button>
              </>
            ) : (
              <>
                <p>No orders yet.</p>
                <span className="aom-muted">Sales made at the till and supplier orders will appear here.</span>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Web: table */}
            <div className="aom-table-wrap">
              <table className="aom-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer / Supplier</th>
                    <th scope="col" className="aom-num">Items</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="aom-num">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="aom-sr">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o) => (
                    <tr key={o.key} onClick={() => setSelected(o)}>
                      <td>
                        <button type="button" className="aom-link" onClick={() => setSelected(o)}>{o.number}</button>
                        <KindTag kind={o.kind} />
                      </td>
                      <td>
                        <span className="aom-party">{o.party}</span>
                        <span className="aom-products" title={o.lines.map((l) => `${l.name} ×${l.qty}`).join(', ')}>{productSummary(o)}</span>
                      </td>
                      <td className="aom-num">{o.itemCount}</td>
                      <td>
                        <span className="aom-party">{fmtDate(o.createdAt)}</span>
                        <span className="aom-products">{fmtTime(o.createdAt)}</span>
                      </td>
                      <td className="aom-num aom-amount">{money(o.amount)}</td>
                      <td><StatusBadge order={o} /></td>
                      <td className="aom-go"><FiChevronRight aria-hidden="true" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: cards */}
            <ul className="aom-cards">
              {shown.map((o) => (
                <li key={o.key}>
                  <button type="button" className="aom-card" onClick={() => setSelected(o)}>
                    <span className="aom-card-top">
                      <span className="aom-card-no">{o.number}</span>
                      <StatusBadge order={o} />
                    </span>
                    <span className="aom-card-party">{o.party}</span>
                    <span className="aom-products">{productSummary(o)}</span>
                    <span className="aom-card-bottom">
                      <span className="aom-card-date">
                        <KindTag kind={o.kind} /> {fmtDate(o.createdAt)} · {fmtTime(o.createdAt)}
                      </span>
                      <span className="aom-amount">{money(o.amount)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <footer className="aom-foot">
              <p>
                Showing {shown.length} of {filtered.length} {plural(filtered.length, 'order', 'orders')}
                {truncated && ' (newest loaded)'}
              </p>
              {filtered.length > shown.length ? (
                <button type="button" className="aom-btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  <FiPackage aria-hidden="true" /><span>Show {Math.min(PAGE_SIZE, filtered.length - shown.length)} more</span>
                </button>
              ) : truncated && canLoadOlder && (
                <button type="button" className="aom-btn" onClick={loadOlder} disabled={refreshing}>
                  <FiClock aria-hidden="true" /><span>{refreshing ? 'Loading…' : 'Load older orders'}</span>
                </button>
              )}
            </footer>
            {truncated && (
              <p className="aom-muted aom-trunc">
                The list holds the newest {limit} sales and {limit} purchase orders. The totals above count every order.
              </p>
            )}
          </>
        )}
      </section>

      {selected && <OrderSheet order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default memo(AdminOrderManagement);
