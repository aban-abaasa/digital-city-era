import React, { memo, useMemo, useRef, useState } from 'react';
import {
  FiActivity, FiAlertTriangle, FiArrowUpRight, FiBell, FiBriefcase, FiCalendar, FiChevronDown, FiChevronLeft,
  FiChevronRight, FiClipboard, FiDollarSign, FiFileText, FiPackage, FiRefreshCw,
  FiSettings, FiShoppingBag, FiShoppingCart, FiTrendingUp, FiTruck, FiUser, FiUserCheck,
  FiUsers, FiInbox, FiCheckCircle
} from 'react-icons/fi';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useAdminDashboardData from './useAdminDashboardData';
import './AdminDashboardHome.css';

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
  { id: 'people', label: 'People' },
  { id: 'ops', label: 'Operations' }
];

const FAILED_LABELS = {
  sales: 'sales', products: 'products', inventory: 'stock levels', managers: 'team', cashiers: 'team',
  customers: 'customers', suppliers: 'suppliers', purchaseOrders: 'purchase orders', bookings: 'bookings', wallet: 'wallet'
};

const RANGES = [
  { id: '1d', label: '1D' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' }
];

function AdminDashboardHome({ adminName, storeName, supermarketId, businessProfileId, pendingApprovals = 0, onOpen }) {
  const { data, loading, failed, updatedAt, refresh } = useAdminDashboardData({ supermarketId, businessProfileId });
  const [group, setGroup] = useState('all');
  const [range, setRange] = useState('7d');
  const [salesOpen, setSalesOpen] = useState(false);
  const railRef = useRef(null);

  const failedNames = [...new Set(failed.map((k) => FAILED_LABELS[k] || k))];
  const daily = data.dailySeries || [];
  const spark = (key, n = 14) => daily.slice(-n).map((d) => d[key]);

  const cards = useMemo(() => {
    const salesUnavailable = data.sales === null;
    const v = (fn) => (salesUnavailable ? '—' : fn());
    return [
      {
        id: 'rev-today', group: 'sales', icon: FiDollarSign, tone: 'emerald', label: "Today's revenue",
        value: v(() => moneyShort(data.today.revenue)), title: moneyFull(data.today.revenue),
        delta: salesUnavailable ? undefined : pct(data.today.revenue, data.yesterday.revenue), deltaLabel: 'vs yesterday',
        spark: spark('revenue'), open: ['transactions'], hint: 'Open transactions'
      },
      {
        id: 'orders-today', group: 'sales', icon: FiShoppingCart, tone: 'indigo', label: "Today's orders",
        value: v(() => num(data.today.orders)),
        delta: salesUnavailable ? undefined : pct(data.today.orders, data.yesterday.orders), deltaLabel: 'vs yesterday',
        spark: spark('orders'), open: ['orders'], hint: 'Open orders'
      },
      {
        id: 'rev-week', group: 'sales', icon: FiTrendingUp, tone: 'gold', label: 'Last 7 days',
        value: v(() => moneyShort(data.week.revenue)), title: moneyFull(data.week.revenue),
        delta: salesUnavailable ? undefined : pct(data.week.revenue, data.prevWeek.revenue), deltaLabel: 'vs prior week',
        spark: spark('revenue', 7), open: ['transactions'], hint: 'Open transactions'
      },
      {
        id: 'rev-month', group: 'sales', icon: FiActivity, tone: 'teal', label: 'Last 30 days',
        value: v(() => moneyShort(data.month.revenue)), title: moneyFull(data.month.revenue),
        sub: salesUnavailable ? null : `${num(data.month.orders)} orders`,
        spark: spark('revenue', 30), open: ['transactions'], hint: 'Open transactions'
      },
      {
        id: 'basket', group: 'sales', icon: FiShoppingBag, tone: 'plum', label: 'Average basket',
        value: v(() => moneyShort(data.avgBasket)), title: moneyFull(data.avgBasket),
        sub: 'per sale · 30 days', open: ['transactions'], hint: 'Open transactions'
      },
      {
        id: 'products', group: 'stock', icon: FiPackage, tone: 'indigo', label: 'Active products',
        value: num(data.products), sub: 'on your shelves & listings', open: ['inventory-pos'], hint: 'Open POS inventory'
      },
      {
        id: 'low', group: 'stock', icon: FiAlertTriangle, tone: data.lowStock > 0 ? 'amber' : 'emerald', label: 'Low stock',
        value: num(data.lowStock), sub: data.lowStock > 0 ? 'at or below minimum' : 'all above minimum',
        open: ['inventory-pos'], hint: 'Open POS inventory'
      },
      {
        id: 'out', group: 'stock', icon: FiInbox, tone: data.outOfStock > 0 ? 'rose' : 'emerald', label: 'Out of stock',
        value: num(data.outOfStock), sub: data.outOfStock > 0 ? 'restock to keep selling' : 'nothing sold out',
        open: ['inventory-pos'], hint: 'Open POS inventory'
      },
      {
        id: 'team', group: 'people', icon: FiUserCheck, tone: 'teal', label: 'Your team',
        value: data.team.managers === null && data.team.cashiers === null ? '—' : num((data.team.managers || 0) + (data.team.cashiers || 0)),
        sub: `${num(data.team.managers)} managers · ${num(data.team.cashiers)} cashiers`, open: ['users', 'staff'], hint: 'Manage staff & roles'
      },
      {
        id: 'customers', group: 'people', icon: FiUsers, tone: 'plum', label: 'Customers',
        value: num(data.customers), sub: 'registered with your store', open: ['users', 'all'], hint: 'Open user management'
      },
      {
        id: 'suppliers', group: 'people', icon: FiTruck, tone: 'gold', label: 'Approved suppliers',
        value: num(data.suppliers), sub: 'partnered with you', open: ['users', 'applications'], hint: 'Open applications'
      },
      {
        id: 'approvals', group: 'people', icon: FiBell, tone: pendingApprovals > 0 ? 'amber' : 'emerald', label: 'Pending approvals',
        value: num(pendingApprovals), sub: pendingApprovals > 0 ? 'waiting for you' : 'nobody waiting', open: ['approvals'], hint: 'Review approvals'
      },
      {
        id: 'po', group: 'ops', icon: FiClipboard, tone: 'indigo', label: 'Purchase orders open',
        value: num(data.po.pending), sub: `${moneyShort(data.po.spend30d)} ordered · 30 days`, open: ['orders'], hint: 'Open orders'
      },
      {
        id: 'bookings', group: 'ops', icon: FiCalendar, tone: 'teal', label: 'Upcoming bookings',
        value: num(data.bookings.upcoming), sub: `${num(data.bookings.awaiting)} awaiting confirmation`, open: ['bookings'], hint: 'Open bookings'
      },
      {
        id: 'wallet', group: 'ops', icon: FiDollarSign, tone: 'gold', label: 'Business ICAN wallet',
        value: data.wallet ? `${data.wallet.ican.toLocaleString('en-UG', { maximumFractionDigits: 2 })} ICAN` : '—',
        sub: data.wallet ? 'live balance' : 'link a business profile', open: ['ican-wallet'], hint: 'Open wallet'
      }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pendingApprovals]);

  const visibleCards = group === 'all' ? cards : cards.filter((c) => c.group === group);

  const scrollRail = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const changeGroup = (id) => {
    setGroup(id);
    railRef.current?.scrollTo({ left: 0 });
  };

  // Revenue trend for the selected range, bucketed from the same live sales rows
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

  const attention = [
    { id: 'appr', count: pendingApprovals, text: plural(pendingApprovals, 'person waiting for approval', 'people waiting for approval'), icon: FiBell, tone: 'amber', open: ['approvals'] },
    { id: 'out', count: data.outOfStock, text: plural(data.outOfStock, 'product out of stock', 'products out of stock'), icon: FiInbox, tone: 'rose', open: ['inventory-pos'] },
    { id: 'low', count: data.lowStock, text: plural(data.lowStock, 'product running low', 'products running low'), icon: FiAlertTriangle, tone: 'amber', open: ['inventory-pos'] },
    { id: 'po', count: data.po.pending, text: plural(data.po.pending, 'purchase order in progress', 'purchase orders in progress'), icon: FiClipboard, tone: 'indigo', open: ['orders'] },
    { id: 'bk', count: data.bookings.awaiting, text: plural(data.bookings.awaiting, 'booking awaiting confirmation', 'bookings awaiting confirmation'), icon: FiCalendar, tone: 'teal', open: ['bookings'] }
  ].filter((a) => a.count > 0);

  const controls = [
    {
      title: 'Sell & operate',
      items: [
        { label: 'POS Inventory', hint: 'Sell and stock at the till', icon: FiShoppingBag, open: ['inventory-pos'] },
        { label: 'Transactions', hint: 'Every sale, with receipts', icon: FiFileText, open: ['transactions'] },
        { label: 'Orders', hint: 'Sales & purchase orders', icon: FiShoppingCart, open: ['orders'] },
        { label: 'Bookings', hint: 'Service appointments', icon: FiCalendar, open: ['bookings'] }
        // Hidden from the dashboard for now:
        // { label: 'Inventory control', hint: 'Prices, stock & bulk edits', icon: FiPackage, open: ['inventory'] }
      ]
    },
    // Hidden from the dashboard for now:
    // {
    //   title: 'People',
    //   items: [
    //     { label: 'All users', hint: 'Search, activate, view', icon: FiUsers, open: ['users', 'all'] },
    //     { label: 'Staff & roles', hint: 'Assign managers & cashiers', icon: FiUserCheck, open: ['users', 'staff'] },
    //     { label: 'Applications', hint: 'Suppliers & partners', icon: FiInbox, open: ['users', 'applications'] },
    //     { label: 'Riders', hint: 'Delivery partners', icon: FiTruck, open: ['users', 'riders'] },
    //     { label: 'Approvals', hint: 'New sign-ups', icon: FiBell, open: ['approvals'], badge: pendingApprovals }
    //   ]
    // },
    {
      title: 'Business',
      items: [
        { label: 'Payroll & Transport', hint: 'Employees and pay', icon: FiBriefcase, open: ['business-operations'] },
        { label: 'Business profile', hint: 'Your shared business identity', icon: FiUser, open: ['business-profile'] },
        { label: 'IcanEra Wallet', hint: 'Balance & payments', icon: FiDollarSign, open: ['ican-wallet'] },
        { label: 'Settings', hint: 'Store & portal settings', icon: FiSettings, open: ['settings'] }
      ]
    }
  ];

  const go = (open) => onOpen?.(open[0], open[1]);

  const statusClass = (s) => {
    const x = String(s || '').toLowerCase();
    if (x === 'completed' || x === 'paid' || x === 'success') return 'adh-pill-ok';
    if (x === 'pending' || x === 'processing') return 'adh-pill-wait';
    return 'adh-pill-flat';
  };

  return (
    <div className="adh">
      {/* Hero */}
      <section className="adh-hero">
        <div className="adh-hero-main">
          <p className="adh-eyebrow">Admin dashboard</p>
          <h2 className="adh-hero-title">{greeting()}, {adminName?.split(' ')[0] || 'Admin'}</h2>
          <p className="adh-hero-sub">{storeName ? `${storeName} — ` : ''}every part of your business, one tap away.</p>
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
        <a className="adh-ican" href={ICANERA_URL} target="_blank" rel="noopener noreferrer" aria-label="Best analysis on IcanEra, opens in a new tab">
          <span className="adh-ican-icon"><FiTrendingUp /></span>
          <span className="adh-ican-text">
            <strong>Best analysis on IcanEra</strong>
            <small>Deep reports for your business <FiArrowUpRight /></small>
          </span>
        </a>
      </section>

      {failed.length > 0 && (
        <p className="adh-note" role="status">
          Couldn’t load {failedNames.join(', ')}. Those show “—”, not zero — tap refresh to retry.
        </p>
      )}

      {/* Slide cards */}
      <section className="adh-section" aria-label="Business at a glance">
        <div className="adh-section-head">
          <h3>Business at a glance</h3>
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
              onClick={() => changeGroup(g.id)}
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

      {/* Trend + attention */}
      <div className="adh-grid">
        <section className="adh-panel">
          <div className="adh-section-head">
            <div>
              <h3>Sales trend</h3>
              <p className="adh-panel-sub" title={moneyFull(trendTotal)}>{moneyShort(trendTotal)} · {num(trendOrders)} orders</p>
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
                    <linearGradient id="adhRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4338ca" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#4338ca" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="rgba(196,160,82,0.35)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(x) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${Math.round(x / 1e3)}K` : x)} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid rgba(196,160,82,0.5)', borderRadius: 12, boxShadow: '0 8px 24px -12px rgba(30,27,75,.35)', color: '#1e1b4b' }}
                    formatter={(value, name, item) => (name === 'revenue' ? [moneyFull(value), `Revenue · ${item.payload.orders} orders`] : [value, name])}
                  />
                  <Area type="monotone" dataKey="revenue" isAnimationActive={false} stroke="#4338ca" strokeWidth={2.2} fill="url(#adhRev)" activeDot={{ r: 5, fill: '#c4a052', stroke: '#fff', strokeWidth: 2 }} />
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
                <button key={`${p.name}-${i}`} type="button" onClick={() => go(['inventory-pos'])}>
                  <span>{p.name}</span>
                  <em className={p.stock <= 0 ? 'is-out' : ''}>{p.stock <= 0 ? 'Out' : `${p.stock} left`}</em>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Control center */}
      <section className="adh-section" aria-label="Control center">
        <div className="adh-section-head"><h3>Control center</h3><p className="adh-panel-sub">Open any part of your business</p></div>
        <div className="adh-controls">
          {controls.map((g) => (
            <div key={g.title} className="adh-control-group">
              <p className="adh-eyebrow">{g.title}</p>
              <div className="adh-tiles">
                {g.items.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.label} type="button" className="adh-tile" onClick={() => go(t.open)}>
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

      {/* Recent sales — collapsed until the admin opens it */}
      <section className={`adh-panel adh-collapse ${salesOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="adh-collapse-head"
          onClick={() => setSalesOpen((open) => !open)}
          aria-expanded={salesOpen}
          aria-controls="adh-recent-sales"
        >
          <h3>Recent sales</h3>
          <span className="adh-collapse-cta">{salesOpen ? 'Hide' : 'View all'} <FiChevronDown className="adh-collapse-chev" /></span>
        </button>
        {salesOpen && (
          <div id="adh-recent-sales">
            {data.recentSales.length === 0 ? (
              <div className="adh-empty adh-empty-sm">{data.sales === null ? 'Sales could not be loaded.' : 'No sales in the last 30 days.'}</div>
            ) : (
              <>
                <ul className="adh-sales">
                  {data.recentSales.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => go(['transactions'])}>
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
                <button type="button" className="adh-link adh-link-block" onClick={() => go(['transactions'])}>
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

export default memo(AdminDashboardHome);
