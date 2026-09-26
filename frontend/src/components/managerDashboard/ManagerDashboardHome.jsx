import React, { memo, useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle, FiArrowUpRight, FiBarChart2, FiBell, FiBriefcase, FiCalendar, FiCheckCircle,
  FiChevronDown, FiChevronLeft, FiChevronRight, FiClipboard, FiDollarSign, FiFileText, FiInbox, FiLayers,
  FiNavigation, FiPackage, FiPlus, FiRefreshCw, FiSend, FiShoppingBag, FiShoppingCart, FiTrendingUp,
  FiTruck, FiUserCheck, FiUserPlus, FiUsers
} from 'react-icons/fi';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useAdminDashboardData from '../adminDashboard/useAdminDashboardData';
import '../adminDashboard/AdminDashboardHome.css';
import './ManagerDashboardHome.css';

const ICANERA_URL = import.meta.env.VITE_ICANERA_URL || 'https://icanera.space/';

const moneyFull = (n) => `UGX ${Math.round(n || 0).toLocaleString('en-UG')}`;
const moneyShort = (n) => {
  const v = Math.abs(n || 0);
  const sign = n < 0 ? '-' : '';
  if (v >= 1e9) return `${sign}UGX ${(v / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (v >= 1e6) return `${sign}UGX ${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e3) return `${sign}UGX ${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${sign}UGX ${Math.round(v).toLocaleString('en-UG')}`;
};
const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-UG'));
const plural = (n, one, many) => (n === 1 ? one : many);
const pct = (now, before) => {
  if (!before) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 1000) / 10;
};
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const Sparkline = ({ values }) => {
  if (!values || values.length < 2 || Math.max(...values) === 0) return <div className="adh-spark adh-spark-empty" />;
  const w = 120;
  const h = 34;
  const max = Math.max(...values);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`);
  return (
    <svg className="adh-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} className="adh-spark-fill" />
      <polyline points={pts.join(' ')} className="adh-spark-line" />
    </svg>
  );
};

const Delta = ({ value, label }) => {
  if (value === undefined) return null;
  if (value === null) return <span className="adh-delta adh-delta-flat">New · {label}</span>;
  const cls = value > 0 ? 'adh-delta-up' : value < 0 ? 'adh-delta-down' : 'adh-delta-flat';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '●';
  return <span className={`adh-delta ${cls}`}>{arrow} {Math.abs(value)}% · {label}</span>;
};

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'sales', label: 'Sales' },
  { id: 'stock', label: 'Stock' },
  { id: 'buying', label: 'Buying' },
  { id: 'people', label: 'People' }
];

const RANGES = [
  { id: '1d', label: '1D' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' }
];

const FAILED_LABELS = {
  sales: 'sales', products: 'products', inventory: 'stock levels', managers: 'team', cashiers: 'team',
  customers: 'customers', suppliers: 'suppliers', purchaseOrders: 'purchase orders', bookings: 'bookings', wallet: 'wallet'
};

// The purchase-order journey, left to right. Each stop opens the Orders page.
const PIPELINE = [
  { id: 'pending_approval', label: 'Awaiting approval', short: 'Approval', icon: FiClipboard, also: ['pending', 'draft'] },
  { id: 'approved', label: 'Approved', short: 'Approved', icon: FiCheckCircle },
  { id: 'sent_to_supplier', label: 'With supplier', short: 'Sent', icon: FiSend, also: ['ordered'] },
  { id: 'confirmed', label: 'Confirmed', short: 'Confirmed', icon: FiTruck },
  { id: 'received', label: 'Received', short: 'Received', icon: FiPackage, also: ['partially_received'] },
  { id: 'completed', label: 'Completed', short: 'Done', icon: FiLayers }
];

/**
 * Manager dashboard home — the admin dashboard's classic ivory / indigo / gold
 * layout, re-cut for a store manager: every manager tool one tap away, the
 * purchase-order pipeline at a glance, and live numbers scoped to the store.
 *
 * onOpen(target) receives a manager tab id ('orders', 'pos', 'team', …) or one
 * of the actions 'new-order', 'add-cashier', 'inventory-modal'.
 */
function ManagerDashboardHome({ managerName, storeName, supermarketId, businessProfileId, alertCount = 0, onOpen }) {
  const { data, loading, failed, updatedAt, refresh } = useAdminDashboardData({ supermarketId, businessProfileId });
  const [group, setGroup] = useState('all');
  const [range, setRange] = useState('7d');
  const [salesOpen, setSalesOpen] = useState(false);
  const railRef = useRef(null);

  const go = (target) => onOpen?.(target);
  const failedNames = [...new Set(failed.map((k) => FAILED_LABELS[k] || k))];
  const daily = data.dailySeries || [];
  const spark = (key, n = 14) => daily.slice(-n).map((d) => d[key]);
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const cards = useMemo(() => {
    const salesUnavailable = data.sales === null;
    const v = (fn) => (salesUnavailable ? '—' : fn());
    return [
      {
        id: 'rev-today', group: 'sales', icon: FiDollarSign, tone: 'emerald', label: "Today's takings",
        value: v(() => moneyShort(data.today.revenue)), title: moneyFull(data.today.revenue),
        delta: salesUnavailable ? undefined : pct(data.today.revenue, data.yesterday.revenue), deltaLabel: 'vs yesterday',
        spark: spark('revenue'), open: 'transactions', hint: 'Transactions'
      },
      {
        id: 'sales-today', group: 'sales', icon: FiShoppingCart, tone: 'indigo', label: "Today's sales",
        value: v(() => num(data.today.orders)),
        delta: salesUnavailable ? undefined : pct(data.today.orders, data.yesterday.orders), deltaLabel: 'vs yesterday',
        spark: spark('orders'), open: 'transactions', hint: 'Transactions'
      },
      {
        id: 'rev-week', group: 'sales', icon: FiTrendingUp, tone: 'gold', label: 'Last 7 days',
        value: v(() => moneyShort(data.week.revenue)), title: moneyFull(data.week.revenue),
        delta: salesUnavailable ? undefined : pct(data.week.revenue, data.prevWeek.revenue), deltaLabel: 'vs prior week',
        spark: spark('revenue', 7), open: 'reports', hint: 'Reports'
      },
      {
        id: 'basket', group: 'sales', icon: FiShoppingBag, tone: 'plum', label: 'Average basket',
        value: v(() => moneyShort(data.avgBasket)), title: moneyFull(data.avgBasket),
        sub: 'per sale · 30 days', open: 'reports', hint: 'Reports'
      },
      {
        id: 'products', group: 'stock', icon: FiPackage, tone: 'indigo', label: 'Products on sale',
        value: num(data.products), sub: 'active in your POS', open: 'pos', hint: 'POS inventory'
      },
      {
        id: 'low', group: 'stock', icon: FiAlertTriangle, tone: data.lowStock > 0 ? 'amber' : 'emerald', label: 'Running low',
        value: num(data.lowStock), sub: data.lowStock > 0 ? 'at or below minimum' : 'all above minimum', open: 'pos', hint: 'Restock'
      },
      {
        id: 'out', group: 'stock', icon: FiInbox, tone: data.outOfStock > 0 ? 'rose' : 'emerald', label: 'Out of stock',
        value: num(data.outOfStock), sub: data.outOfStock > 0 ? 'order more to keep selling' : 'nothing sold out', open: 'new-order', hint: 'Order stock'
      },
      {
        id: 'po-open', group: 'buying', icon: FiClipboard, tone: 'indigo', label: 'Orders in progress',
        value: num(data.po.pending), sub: `${moneyShort(data.po.spend30d)} ordered · 30 days`, open: 'orders', hint: 'Orders'
      },
      {
        id: 'suppliers', group: 'buying', icon: FiTruck, tone: 'gold', label: 'Approved suppliers',
        value: num(data.suppliers), sub: 'you can buy from', open: 'suppliers', hint: 'Suppliers'
      },
      {
        id: 'wallet', group: 'buying', icon: FiDollarSign, tone: 'teal', label: 'Business ICAN wallet',
        value: data.wallet ? `${data.wallet.ican.toLocaleString('en-UG', { maximumFractionDigits: 2 })} ICAN` : '—',
        sub: data.wallet ? 'pays suppliers' : 'link a business profile', open: 'ican-wallet', hint: 'Wallet'
      },
      {
        id: 'team', group: 'people', icon: FiUserCheck, tone: 'teal', label: 'Your team',
        value: data.team.cashiers === null ? '—' : num(data.team.cashiers),
        sub: `${num(data.team.cashiers)} ${plural(data.team.cashiers, 'cashier', 'cashiers')} on the tills`, open: 'team', hint: 'Team'
      },
      {
        id: 'customers', group: 'people', icon: FiUsers, tone: 'plum', label: 'Customers',
        value: num(data.customers), sub: 'registered with your store', open: 'reports', hint: 'Reports'
      }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const visibleCards = group === 'all' ? cards : cards.filter((c) => c.group === group);

  const scrollRail = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const trend = useMemo(() => {
    if (!data.sales) return [];
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const t0 = startToday.getTime();
    if (range === '1d') {
      return Array.from({ length: 24 }, (_, h) => {
        const from = t0 + h * 3600000;
        let revenue = 0;
        let orders = 0;
        data.sales.forEach((s) => {
          if (s.at >= from && s.at < from + 3600000) { revenue += s.amount; orders += 1; }
        });
        return { label: `${String(h).padStart(2, '0')}:00`, revenue, orders };
      });
    }
    const days = range === '7d' ? 7 : 30;
    return daily.slice(-days).map((d) => ({
      label: new Date(d.at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      revenue: d.revenue,
      orders: d.orders
    }));
  }, [data.sales, daily, range]);

  const trendTotal = trend.reduce((s, d) => s + d.revenue, 0);
  const trendOrders = trend.reduce((s, d) => s + d.orders, 0);

  // Purchase-order pipeline, counted from the last 30 days of orders
  const byStatus = data.po.byStatus;
  const pipeline = PIPELINE.map((stage) => ({
    ...stage,
    count: byStatus ? [stage.id, ...(stage.also || [])].reduce((s, k) => s + (byStatus[k] || 0), 0) : null
  }));
  const pipelineTotal = pipeline.reduce((s, p) => s + (p.count || 0), 0);
  const cancelled = byStatus ? (byStatus.cancelled || 0) + (byStatus.rejected || 0) : null;
  const awaitingApproval = pipeline[0].count || 0;
  const toReceive = (pipeline[2].count || 0) + (pipeline[3].count || 0);

  const attention = [
    { id: 'appr', count: awaitingApproval, text: plural(awaitingApproval, 'purchase order waiting for approval', 'purchase orders waiting for approval'), icon: FiClipboard, tone: 'amber', open: 'orders' },
    { id: 'recv', count: toReceive, text: plural(toReceive, 'delivery to receive and check in', 'deliveries to receive and check in'), icon: FiTruck, tone: 'indigo', open: 'orders' },
    { id: 'out', count: data.outOfStock, text: plural(data.outOfStock, 'product out of stock', 'products out of stock'), icon: FiInbox, tone: 'rose', open: 'pos' },
    { id: 'low', count: data.lowStock, text: plural(data.lowStock, 'product running low', 'products running low'), icon: FiAlertTriangle, tone: 'amber', open: 'pos' },
    { id: 'alerts', count: alertCount, text: plural(alertCount, 'unread alert', 'unread alerts'), icon: FiBell, tone: 'plum', open: 'alerts' }
  ].filter((a) => a.count > 0);

  // Every manager function, grouped the way a shift actually runs
  const controls = [
    {
      title: 'Sell & stock',
      items: [
        { label: 'POS inventory', hint: 'Products, prices & stock at the till', icon: FiShoppingBag, open: 'pos' },
        { label: 'Stock manager', hint: 'Adjust quantities & minimums', icon: FiPackage, open: 'inventory-modal' },
        { label: 'Till supplies', hint: 'Bags, paper rolls & till needs', icon: FiLayers, open: 'tillsupplies' },
        { label: 'Transactions', hint: 'Every sale, with receipts', icon: FiFileText, open: 'transactions' }
      ]
    },
    {
      title: 'Buy from suppliers',
      items: [
        { label: 'New purchase order', hint: 'Order stock from a supplier', icon: FiPlus, open: 'new-order', accent: true },
        { label: 'Orders', hint: 'Approve, send, receive & pay', icon: FiShoppingCart, open: 'orders', badge: awaitingApproval },
        { label: 'Suppliers', hint: 'Supplier network & deliveries', icon: FiTruck, open: 'suppliers' },
        { label: 'IcanEra Wallet', hint: 'Balance & supplier payments', icon: FiDollarSign, open: 'ican-wallet' }
      ]
    },
    {
      title: 'People',
      items: [
        { label: 'Team', hint: 'Cashiers, shifts & performance', icon: FiUsers, open: 'team' },
        { label: 'Add cashier', hint: 'Give someone a till login', icon: FiUserPlus, open: 'add-cashier' },
        { label: 'Alerts', hint: 'Store notifications', icon: FiBell, open: 'alerts', badge: alertCount },
        { label: 'Payroll & Transport', hint: 'Employees and pay', icon: FiBriefcase, open: 'business-operations' }
      ]
    },
    {
      title: 'Oversight',
      items: [
        { label: 'Reports', hint: 'Sales, stock & staff reports', icon: FiBarChart2, open: 'reports' },
        { label: 'Portal control', hint: 'Live status of every portal', icon: FiNavigation, open: 'portal-control' }
      ]
    }
  ];

  const statusClass = (s) => {
    const x = String(s || '').toLowerCase();
    if (x === 'completed' || x === 'paid' || x === 'success') return 'adh-pill-ok';
    if (x === 'pending' || x === 'processing') return 'adh-pill-wait';
    return 'adh-pill-flat';
  };

  return (
    <div className="adh mdh">
      {/* Hero — the manager's desk */}
      <section className="adh-hero mdh-hero">
        <div className="adh-hero-main">
          <p className="adh-eyebrow">Manager’s desk · {today}</p>
          <h2 className="adh-hero-title">{greeting()}, {managerName?.split(' ')[0] || 'Manager'}</h2>
          <p className="adh-hero-sub">{storeName ? `${storeName} — ` : ''}run the floor, the tills and the stockroom from here.</p>
          <div className="adh-hero-meta">
            <span className="adh-live"><i /> Live</span>
            <span className="adh-updated">
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
            </span>
            <button type="button" className="adh-refresh" onClick={refresh} aria-label="Refresh dashboard">
              <FiRefreshCw className={loading ? 'adh-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="mdh-hero-actions">
          <button type="button" className="mdh-hero-btn is-gold" onClick={() => go('new-order')}>
            <FiPlus /> New purchase order
          </button>
          <button type="button" className="mdh-hero-btn" onClick={() => go('pos')}>
            <FiShoppingBag /> POS inventory
          </button>
          <button type="button" className="mdh-hero-btn" onClick={() => go('add-cashier')}>
            <FiUserPlus /> Add cashier
          </button>
        </div>
      </section>

      {failed.length > 0 && (
        <p className="adh-note" role="status">
          Couldn’t load {failedNames.join(', ')}. Those show “—”, not zero — tap refresh to retry.
        </p>
      )}

      {/* Today's ledger — sliding cards */}
      <section className="adh-section" aria-label="Store at a glance">
        <div className="adh-section-head">
          <h3>Store at a glance</h3>
          <div className="adh-arrows">
            <button type="button" onClick={() => scrollRail(-1)} aria-label="Previous cards"><FiChevronLeft /></button>
            <button type="button" onClick={() => scrollRail(1)} aria-label="Next cards"><FiChevronRight /></button>
          </div>
        </div>
        <div className="adh-chips" role="tablist" aria-label="Card groups">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={group === g.id}
              className={`adh-chip ${group === g.id ? 'is-on' : ''}`}
              onClick={() => { setGroup(g.id); railRef.current?.scrollTo({ left: 0 }); }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="adh-rail" ref={railRef}>
          {visibleCards.map((c) => {
            const Icon = c.icon;
            return (
              <button key={c.id} type="button" className={`adh-card tone-${c.tone}`} onClick={() => go(c.open)} title={c.title}>
                <span className="adh-card-top">
                  <span className="adh-card-icon"><Icon /></span>
                  <span className="adh-card-go">{c.hint} <FiArrowUpRight /></span>
                </span>
                <span className="adh-card-label">{c.label}</span>
                <span className={`adh-card-value ${loading && !updatedAt ? 'is-loading' : ''}`}>{loading && !updatedAt ? '…' : c.value}</span>
                {c.delta !== undefined && <Delta value={c.delta} label={c.deltaLabel} />}
                {c.sub && <span className="adh-card-sub">{c.sub}</span>}
                {c.spark && <Sparkline values={c.spark} />}
              </button>
            );
          })}
          <a className="adh-card adh-card-ican" href={ICANERA_URL} target="_blank" rel="noopener noreferrer">
            <span className="adh-card-top"><span className="adh-card-icon"><FiTrendingUp /></span></span>
            <span className="adh-card-label">Go deeper</span>
            <span className="adh-card-value adh-card-value-sm">Best analysis on IcanEra</span>
            <span className="adh-card-sub">Profit, cash-flow and growth reports <FiArrowUpRight /></span>
          </a>
        </div>
      </section>

      {/* Purchase-order pipeline */}
      <section className="adh-panel mdh-pipe" aria-label="Purchase order pipeline">
        <div className="adh-section-head">
          <div>
            <h3>Order pipeline</h3>
            <p className="adh-panel-sub">
              {byStatus === null
                ? 'Purchase orders could not be loaded.'
                : `${num(pipelineTotal)} purchase ${plural(pipelineTotal, 'order', 'orders')} in the last 30 days${cancelled ? ` · ${num(cancelled)} cancelled` : ''}`}
            </p>
          </div>
          <button type="button" className="adh-link" onClick={() => go('orders')}>Open orders <FiChevronRight /></button>
        </div>
        <ol className="mdh-stages">
          {pipeline.map((stage, i) => {
            const Icon = stage.icon;
            const hot = i === 0 && stage.count > 0;
            return (
              <li key={stage.id} className={`${stage.count > 0 ? 'has' : ''} ${hot ? 'is-hot' : ''}`}>
                <button type="button" onClick={() => go('orders')} title={`${stage.label}: ${num(stage.count)}`}>
                  <span className="mdh-stage-dot"><Icon /></span>
                  <span className="mdh-stage-count">{loading && !updatedAt ? '…' : num(stage.count)}</span>
                  <span className="mdh-stage-label">{stage.label}</span>
                  <span className="mdh-stage-short">{stage.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Trend + attention */}
      <div className="adh-grid">
        <section className="adh-panel">
          <div className="adh-section-head">
            <div>
              <h3>Sales trend</h3>
              <p className="adh-panel-sub" title={moneyFull(trendTotal)}>{moneyShort(trendTotal)} · {num(trendOrders)} sales</p>
            </div>
            <div className="adh-seg" role="tablist" aria-label="Trend range">
              {RANGES.map((r) => (
                <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className={range === r.id ? 'is-on' : ''} onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="adh-chart">
            {data.sales === null ? (
              <div className="adh-empty">Sales could not be loaded.</div>
            ) : trendTotal === 0 ? (
              <div className="adh-empty">No sales in this period yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mdhRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#047857" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="rgba(196,160,82,0.35)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(x) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${Math.round(x / 1e3)}K` : x)} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid rgba(196,160,82,0.5)', borderRadius: 12, boxShadow: '0 8px 24px -12px rgba(30,27,75,.35)', color: '#1e1b4b' }}
                    formatter={(value, name, item) => (name === 'revenue' ? [moneyFull(value), `Takings · ${item.payload.orders} sales`] : [value, name])}
                  />
                  <Area type="monotone" dataKey="revenue" isAnimationActive={false} stroke="#047857" strokeWidth={2.2} fill="url(#mdhRev)" activeDot={{ r: 5, fill: '#c4a052', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="adh-panel">
          <div className="adh-section-head"><h3>Needs your attention</h3></div>
          {attention.length === 0 ? (
            <div className="adh-clear"><FiCheckCircle /> All clear — nothing is waiting on you.</div>
          ) : (
            <ul className="adh-attn">
              {attention.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.id}>
                    <button type="button" className={`tone-${a.tone}`} onClick={() => go(a.open)}>
                      <span className="adh-attn-icon"><Icon /></span>
                      <span className="adh-attn-text"><b>{num(a.count)}</b> {a.text}</span>
                      <FiChevronRight />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {data.lowStockItems.length > 0 && (
            <div className="adh-lowlist">
              <p className="adh-eyebrow">Restock first</p>
              {data.lowStockItems.map((p, i) => (
                <button key={`${p.name}-${i}`} type="button" onClick={() => go('new-order')} title="Create a purchase order">
                  <span>{p.name}</span>
                  <em className={p.stock <= 0 ? 'is-out' : ''}>{p.stock <= 0 ? 'Out' : `${p.stock} left`}</em>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Control center — every manager function */}
      <section className="adh-section" aria-label="Manager tools">
        <div className="adh-section-head"><h3>Manager tools</h3><p className="adh-panel-sub">Every part of your store, one tap away</p></div>
        <div className="adh-controls">
          {controls.map((g) => (
            <div key={g.title} className="adh-control-group">
              <p className="adh-eyebrow">{g.title}</p>
              <div className="adh-tiles mdh-tiles">
                {g.items.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.label} type="button" className={`adh-tile ${t.accent ? 'mdh-tile-accent' : ''}`} onClick={() => go(t.open)}>
                      <span className="adh-tile-icon"><Icon /></span>
                      <span className="adh-tile-text"><b>{t.label}</b><small>{t.hint}</small></span>
                      {t.badge > 0 && <span className="adh-badge">{t.badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <a className="adh-tile adh-tile-ican" href={ICANERA_URL} target="_blank" rel="noopener noreferrer">
            <span className="adh-tile-icon"><FiTrendingUp /></span>
            <span className="adh-tile-text"><b>Best analysis on IcanEra</b><small>Open your full business intelligence</small></span>
            <FiArrowUpRight />
          </a>
        </div>
      </section>

      {/* Recent sales — collapsed until opened */}
      <section className={`adh-panel adh-collapse ${salesOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="adh-collapse-head"
          onClick={() => setSalesOpen((open) => !open)}
          aria-expanded={salesOpen}
          aria-controls="mdh-recent-sales"
        >
          <h3>Recent sales</h3>
          <span className="adh-collapse-cta">{salesOpen ? 'Hide' : 'View all'} <FiChevronDown className="adh-collapse-chev" /></span>
        </button>
        {salesOpen && (
          <div id="mdh-recent-sales">
            {data.recentSales.length === 0 ? (
              <div className="adh-empty adh-empty-sm">{data.sales === null ? 'Sales could not be loaded.' : 'No sales in the last 30 days.'}</div>
            ) : (
              <>
                <ul className="adh-sales">
                  {data.recentSales.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => go('transactions')}>
                        <span className="adh-sale-icon"><FiShoppingBag /></span>
                        <span className="adh-sale-main">
                          <b>{moneyFull(s.amount)}</b>
                          <small>{new Date(s.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                        </span>
                        <span className={`adh-pill ${statusClass(s.status)}`}>{s.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="adh-link adh-link-block" onClick={() => go('transactions')}>
                  Open all transactions <FiChevronRight />
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default memo(ManagerDashboardHome);
