import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabase';
import { getBusinessWalletBalance } from '../../services/icanWalletService';

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 60000; // Free-plan friendly: one refresh a minute, paused while the tab is hidden
const NOT_A_SALE = ['failed', 'cancelled', 'canceled', 'refunded', 'voided', 'void'];
const PENDING_PO = ['pending_approval', 'sent_to_supplier'];

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
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

const sumBetween = (sales, from, to) => {
  let revenue = 0;
  let orders = 0;
  sales.forEach((s) => {
    if (s.at >= from && s.at < to) {
      revenue += s.amount;
      orders += 1;
    }
  });
  return { revenue, orders };
};

const EMPTY = {
  sales: [],
  recentSales: [],
  today: { revenue: 0, orders: 0 },
  yesterday: { revenue: 0, orders: 0 },
  week: { revenue: 0, orders: 0 },
  prevWeek: { revenue: 0, orders: 0 },
  month: { revenue: 0, orders: 0 },
  avgBasket: 0,
  dailySeries: [],
  products: null,
  lowStock: null,
  outOfStock: null,
  lowStockItems: [],
  team: { managers: null, cashiers: null },
  customers: null,
  suppliers: null,
  po: { pending: null, spend30d: 0 },
  bookings: { awaiting: null, upcoming: null },
  wallet: null
};

/**
 * Live numbers for the admin dashboard, all scoped to the admin's supermarket.
 * Each source is fetched independently (allSettled) so a missing table or an RLS
 * refusal blanks only its own cards — those show "—" instead of a made-up zero.
 */
export default function useAdminDashboardData({ supermarketId, businessProfileId }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!supermarketId || inFlight.current) return;
    inFlight.current = true;
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const since = new Date(todayStart.getTime() - 29 * DAY_MS);
      const todayISO = todayStart.toISOString().slice(0, 10);

      const headCount = (table, apply) => {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        q = apply(q);
        return q.then(({ count, error }) => {
          if (error) throw error;
          return count ?? 0;
        });
      };

      const jobs = {
        sales: fetchAllRows(() => supabase
          .from('transactions')
          .select('id, total_amount, created_at, status')
          .eq('supermarket_id', supermarketId)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })),
        products: headCount('products', (q) => q.eq('supermarket_id', supermarketId).eq('is_active', true)),
        inventory: fetchAllRows(() => supabase
          .from('inventory')
          .select('id, current_stock, minimum_stock, product:products(name)')
          .eq('supermarket_id', supermarketId)
          .order('id')),
        managers: headCount('users', (q) => q.eq('supermarket_id', supermarketId).eq('role', 'manager')),
        cashiers: headCount('users', (q) => q.eq('supermarket_id', supermarketId).eq('role', 'cashier')),
        customers: headCount('users', (q) => q.eq('supermarket_id', supermarketId).eq('role', 'customer')),
        suppliers: headCount('supplier_applications', (q) => q.eq('supermarket_id', supermarketId).eq('status', 'approved')),
        purchaseOrders: fetchAllRows(() => supabase
          .from('purchase_orders')
          .select('id, status, total_amount, created_at')
          .eq('supermarket_id', supermarketId)
          .gte('created_at', since.toISOString())
          .order('id')),
        bookings: fetchAllRows(() => supabase
          .from('service_bookings')
          .select('id, status, booking_date')
          .eq('supermarket_id', supermarketId)
          .in('status', ['requested', 'confirmed'])
          .gte('booking_date', todayISO)
          .order('id')),
        wallet: businessProfileId ? getBusinessWalletBalance(businessProfileId) : Promise.resolve(null)
      };

      const keys = Object.keys(jobs);
      const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
      const out = {};
      const errors = [];
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled') out[keys[i]] = r.value;
        else {
          out[keys[i]] = undefined;
          errors.push(keys[i]);
          console.warn(`Admin dashboard: ${keys[i]} unavailable —`, r.reason?.message || r.reason);
        }
      });

      const next = { ...EMPTY };

      // Sales
      if (out.sales) {
        const sales = out.sales
          .filter((t) => !NOT_A_SALE.includes(String(t.status || '').toLowerCase()))
          .map((t) => ({
            id: t.id,
            amount: parseFloat(t.total_amount) || 0,
            at: new Date(t.created_at).getTime(),
            status: t.status || 'completed'
          }));
        const t0 = todayStart.getTime();
        next.sales = sales;
        next.recentSales = sales.slice(0, 6);
        next.today = sumBetween(sales, t0, t0 + DAY_MS);
        // Same elapsed time yesterday, so a half-finished day isn't compared against a whole one
        next.yesterday = sumBetween(sales, t0 - DAY_MS, now.getTime() - DAY_MS);
        next.week = sumBetween(sales, t0 - 6 * DAY_MS, t0 + DAY_MS);
        next.prevWeek = sumBetween(sales, t0 - 13 * DAY_MS, t0 - 6 * DAY_MS);
        next.month = sumBetween(sales, t0 - 29 * DAY_MS, t0 + DAY_MS);
        next.avgBasket = next.month.orders ? next.month.revenue / next.month.orders : 0;
        next.dailySeries = Array.from({ length: 30 }, (_, i) => {
          const from = t0 - (29 - i) * DAY_MS;
          return { at: from, ...sumBetween(sales, from, from + DAY_MS) };
        });
      } else {
        next.sales = null;
      }

      // Stock
      if (out.products !== undefined) next.products = out.products;
      if (out.inventory) {
        const rows = out.inventory.map((r) => ({
          name: r.product?.name || 'Unnamed product',
          stock: Number(r.current_stock) || 0,
          min: Number(r.minimum_stock) || 0
        }));
        const out0 = rows.filter((r) => r.stock <= 0);
        const low = rows.filter((r) => r.stock > 0 && r.stock <= r.min);
        next.outOfStock = out0.length;
        next.lowStock = low.length;
        next.lowStockItems = [...out0, ...low]
          .sort((a, b) => (a.stock / (a.min || 1)) - (b.stock / (b.min || 1)))
          .slice(0, 5);
      }

      // People & partners
      next.team = {
        managers: out.managers ?? null,
        cashiers: out.cashiers ?? null
      };
      next.customers = out.customers ?? null;
      next.suppliers = out.suppliers ?? null;

      // Operations
      if (out.purchaseOrders) {
        next.po = {
          pending: out.purchaseOrders.filter((p) => PENDING_PO.includes(p.status)).length,
          spend30d: out.purchaseOrders.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
        };
      }
      if (out.bookings) {
        next.bookings = {
          awaiting: out.bookings.filter((b) => b.status === 'requested').length,
          upcoming: out.bookings.length
        };
      }
      next.wallet = out.wallet ? { ican: Number(out.wallet.ican) || 0 } : null;

      setData(next);
      setFailed(errors);
      setUpdatedAt(new Date());
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [supermarketId, businessProfileId]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { data, loading, failed, updatedAt, refresh: load };
}
