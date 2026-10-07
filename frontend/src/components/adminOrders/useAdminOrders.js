import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabase';

const REFRESH_MS = 120000; // Free-plan friendly: one refresh every 2 minutes, paused while the tab is hidden
const DEFAULT_LIMIT = 60; // newest rows loaded per source; true totals come from the exact count
const LIMIT_STEP = 100; // "Load older orders" widens the window by this much
const MAX_LIMIT = 1000; // PostgREST returns at most 1000 rows per request
// Only the columns the page shows — a sales row carries dozens of wallet/accounting fields it never reads.
// If a deployment lacks one of them the query falls back to '*' (see fetchWindow).
const SALE_COLUMNS = 'id, created_at, status, receipt_number, total_amount, amount, subtotal, tax_amount, customer_name, customer_phone, cashier_name, items, items_count, payment_method, payment_provider, payment_status, balance_due_ugx, notes';
const PURCHASE_COLUMNS = 'id, created_at, ordered_at, status, po_number, supplier_name, items, subtotal, tax_amount, total_amount, payment_method, payment_status, balance_due_ugx, expected_delivery_date, notes';
const NOT_A_SALE = ['failed', 'cancelled', 'canceled', 'refunded', 'voided', 'void', 'rejected'];
export const CLOSED_STATUSES = ['completed', 'delivered', 'received', ...NOT_A_SALE];
// Anything that is neither finished nor dead is still waiting on someone.
const CLOSED_FILTER = `(${CLOSED_STATUSES.join(',')})`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const shortId = (id) => String(id || '').slice(0, 8).toUpperCase();

// Product lines are stored as JSON by the POS and by the purchase-order screens
// ([{name, quantity, price}] vs [{name, qty, unit_price}]), so read both shapes.
export const normaliseLines = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((l) => {
    const qty = num(l.quantity ?? l.qty ?? 1) || 1;
    const unit = num(l.unit_price ?? l.price ?? l.unitPrice ?? l.selling_price);
    const total = l.total ?? l.total_price ?? l.line_total;
    return {
      name: l.name || l.product_name || l.title || 'Product',
      qty,
      unit,
      total: total !== undefined && total !== null ? num(total) : unit * qty
    };
  });
};

export const statusInfo = (order) => {
  const s = String(order.status || (order.kind === 'sale' ? 'completed' : 'pending_approval')).toLowerCase();
  const label = {
    completed: 'Completed',
    pending: 'Pending',
    processing: 'Processing',
    pending_approval: 'Awaiting approval',
    sent_to_supplier: 'With supplier',
    approved: 'Approved',
    confirmed: 'Confirmed',
    received: 'Received',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    rejected: 'Rejected',
    failed: 'Failed',
    refunded: 'Refunded',
    voided: 'Voided',
    void: 'Voided'
  }[s] || s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  if (['completed', 'delivered', 'received'].includes(s)) return { group: 'completed', label, tone: 'ok' };
  if (NOT_A_SALE.includes(s)) return { group: 'cancelled', label, tone: 'bad' };
  return { group: 'pending', label, tone: 'warn' };
};

const fromSale = (t) => {
  const lines = normaliseLines(t.items);
  return {
    key: `sale-${t.id}`,
    id: t.id,
    kind: 'sale',
    number: t.receipt_number || `SALE-${shortId(t.id)}`,
    status: t.status || 'completed',
    amount: num(t.total_amount) || num(t.amount),
    subtotal: t.subtotal !== null && t.subtotal !== undefined ? num(t.subtotal) : null,
    tax: t.tax_amount !== null && t.tax_amount !== undefined ? num(t.tax_amount) : null,
    createdAt: t.created_at,
    lines,
    itemCount: lines.length || num(t.items_count),
    party: t.customer_name || 'Walk-in customer',
    phone: t.customer_phone || '',
    cashier: t.cashier_name || '',
    method: t.payment_provider || t.payment_method || '',
    paymentStatus: t.payment_status || '',
    balanceDue: num(t.balance_due_ugx),
    notes: t.notes || ''
  };
};

const fromPurchase = (po) => {
  const lines = normaliseLines(po.items);
  return {
    key: `po-${po.id}`,
    id: po.id,
    kind: 'purchase',
    number: po.po_number || `PO-${shortId(po.id)}`,
    status: po.status || 'pending_approval',
    amount: num(po.total_amount ?? po.total_amount_ugx),
    subtotal: po.subtotal !== null && po.subtotal !== undefined ? num(po.subtotal) : null,
    tax: po.tax_amount !== null && po.tax_amount !== undefined ? num(po.tax_amount) : null,
    createdAt: po.ordered_at || po.order_date || po.created_at,
    expectedAt: po.expected_delivery_date || '',
    lines,
    itemCount: lines.length,
    party: po.supplier_name || 'Supplier',
    phone: '',
    cashier: '',
    method: po.payment_method || '',
    paymentStatus: po.payment_status || '',
    balanceDue: num(po.balance_due_ugx),
    notes: po.notes || ''
  };
};

// PostgREST caps a request at 1000 rows, so page through a stable ordering.
const fetchAllRows = async (buildQuery, pageSize = 1000, maxPages = 5) => {
  const rows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

const headCount = (query) => query.then(({ count, error }) => {
  if (error) throw error;
  return count ?? 0;
});

const EMPTY_STATS = { total: null, today: null, pending: null, revenueToday: null };

/**
 * Live order data for the admin Orders page, scoped to the admin's own supermarket.
 *
 * Sales are the POS product receipts (wallet ledger rows, payment requests and empty
 * placeholders carry no product lines and are left out). Purchase orders are what the
 * store has bought from suppliers. Each source is fetched independently so a missing
 * table or an RLS refusal blanks only its own numbers instead of showing a made-up zero.
 */
export default function useAdminOrders({ supermarketId }) {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [truncated, setTruncated] = useState(false);
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const inFlight = useRef(false);
  const lastLoad = useRef(0);
  const needsStar = useRef({}); // table -> true once its column list was refused

  // Newest rows plus the exact total, in one request.
  const fetchWindow = useCallback(async (table, columns, scope) => {
    const run = (cols) => scope(supabase.from(table).select(cols, { count: 'exact' }))
      .order('created_at', { ascending: false }).limit(limit);
    let res = await run(needsStar.current[table] ? '*' : columns);
    if (res.error && !needsStar.current[table] && (res.error.code === '42703' || /column/i.test(res.error.message || ''))) {
      needsStar.current[table] = true;
      res = await run('*');
    }
    if (res.error) throw res.error;
    return { rows: res.data || [], count: res.count ?? (res.data || []).length };
  }, [limit]);

  const load = useCallback(async () => {
    if (!supermarketId || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const todayStart = startOfToday();
      const todayISO = todayStart.toISOString();

      const jobs = {
        sales: fetchWindow('transactions', SALE_COLUMNS, (q) => q.eq('supermarket_id', supermarketId).gt('items_count', 0)),
        purchases: fetchWindow('purchase_orders', PURCHASE_COLUMNS, (q) => q.eq('supermarket_id', supermarketId))
      };

      const keys = Object.keys(jobs);
      const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
      const out = {};
      const errors = [];
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled') out[keys[i]] = r.value;
        else {
          errors.push(keys[i]);
          console.warn(`Admin orders: ${keys[i]} unavailable —`, r.reason?.message || r.reason);
        }
      });

      // Today's sales: the loaded window already holds them unless today alone outgrew it.
      let todaySales = null;
      if (out.sales) {
        const { rows, count } = out.sales;
        const oldest = rows.length ? new Date(rows[rows.length - 1].created_at) : null;
        const windowHoldsToday = rows.length >= count || (oldest && oldest < todayStart);
        if (windowHoldsToday) {
          todaySales = rows.filter((t) => new Date(t.created_at) >= todayStart);
        } else {
          try {
            todaySales = await fetchAllRows(() => supabase.from('transactions')
              .select('id, total_amount, amount, status, created_at')
              .eq('supermarket_id', supermarketId).gt('items_count', 0)
              .gte('created_at', todayISO).order('id'));
          } catch (e) {
            errors.push('today');
            console.warn('Admin orders: today unavailable —', e?.message || e);
          }
        }
      }

      let todayPurchases = null;
      if (out.purchases) {
        const { rows, count } = out.purchases;
        const placed = (p) => new Date(p.ordered_at || p.order_date || p.created_at);
        const oldest = rows.length ? placed(rows[rows.length - 1]) : null;
        if (rows.length >= count || (oldest && oldest < todayStart)) {
          todayPurchases = rows.filter((p) => placed(p) >= todayStart).length;
        } else {
          try {
            todayPurchases = await headCount(supabase.from('purchase_orders').select('id', { count: 'exact', head: true })
              .eq('supermarket_id', supermarketId).gte('created_at', todayISO));
          } catch (e) {
            errors.push('today');
            console.warn('Admin orders: today’s purchase orders unavailable —', e?.message || e);
          }
        }
      }

      const salesRows = out.sales ? out.sales.rows.map(fromSale) : [];
      const purchaseRows = out.purchases ? out.purchases.rows.map(fromPurchase) : [];

      // Still-open orders: counted from the loaded rows when they are the whole table,
      // otherwise asked of the database so the number never depends on the window size.
      const pendingFor = async (src, rows, table, scoped) => {
        if (!src) return null;
        if (src.rows.length >= src.count) return rows.filter((o) => statusInfo(o).group === 'pending').length;
        try {
          return await headCount(scoped(supabase.from(table).select('id', { count: 'exact', head: true })
            .eq('supermarket_id', supermarketId)).not('status', 'in', CLOSED_FILTER));
        } catch (e) {
          errors.push(`${table}-pending`);
          console.warn(`Admin orders: ${table} pending count unavailable —`, e?.message || e);
          return null;
        }
      };
      const [pendingSales, pendingPurchases] = await Promise.all([
        pendingFor(out.sales, salesRows, 'transactions', (q) => q.gt('items_count', 0)),
        pendingFor(out.purchases, purchaseRows, 'purchase_orders', (q) => q)
      ]);

      const sum = (a, b) => (a === null || b === null ? null : a + b);
      const next = { ...EMPTY_STATS };
      next.total = sum(out.sales ? out.sales.count : null, out.purchases ? out.purchases.count : null);
      next.today = todaySales ? sum(todaySales.length, todayPurchases) : null;
      next.pending = sum(pendingSales, pendingPurchases);
      next.revenueToday = todaySales
        ? todaySales
          .filter((t) => !NOT_A_SALE.includes(String(t.status || '').toLowerCase()))
          .reduce((s, t) => s + (num(t.total_amount) || num(t.amount)), 0)
        : null;

      const merged = [...salesRows, ...purchaseRows]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setOrders(merged);
      setStats(next);
      setTruncated(Boolean(
        (out.sales && out.sales.count > out.sales.rows.length) ||
        (out.purchases && out.purchases.count > out.purchases.rows.length)
      ));
      setFailed(errors);
      setUpdatedAt(new Date());
      lastLoad.current = Date.now();
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [supermarketId, fetchWindow]);

  // Widening the window re-runs the load (via `load` changing) without bringing the skeleton back.
  const loadOlder = useCallback(() => setLimit((l) => Math.min(l + LIMIT_STEP, MAX_LIMIT)), []);
  const canLoadOlder = limit < MAX_LIMIT;

  useEffect(() => {
    if (!supermarketId) return undefined;
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    // Coming back to the tab after a while shows fresh numbers straight away.
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastLoad.current > REFRESH_MS / 2) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supermarketId, load]);

  return { orders, stats, truncated, failed, loading, refreshing, updatedAt, refresh: load, loadOlder, canLoadOlder, limit };
}
