import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiPackage, FiRefreshCw, FiSearch, FiTrendingUp, FiTruck } from 'react-icons/fi';
import { supabase } from '../services/supabase';

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatCount = (value) => number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
const formatCurrency = (value) => `UGX ${number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const SupplierStoreInventory = ({ compact = false, onViewAll = null }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_supplier_store_inventory_v1');
      if (rpcError) throw rpcError;
      setResult(data || { enabled: false, products: [] });
    } catch (loadError) {
      console.error('[SupplierStoreInventory] Could not load store stock:', loadError);
      setError(loadError.message || 'Could not load store stock.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = Array.isArray(result?.products) ? result.products : [];
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((item) => `${item.product_name || ''} ${item.sku || ''} ${item.store_name || ''}`.toLowerCase().includes(query));
  }, [products, search]);
  const lowStockCount = products.filter((item) => number(item.available_stock) <= number(item.reorder_point)).length;
  const reduced30d = products.reduce((sum, item) => sum + number(item.units_reduced_30d), 0);
  const deliveryItems = products.filter((item) => number(item.suggested_delivery_quantity) > 0);

  if (loading && !result) {
    if (compact) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm"><FiRefreshCw className="mr-2 inline animate-spin" /> Loading supplied inventory activity…</div>;
    return <div className="flex min-h-64 items-center justify-center gap-3 text-slate-600"><FiRefreshCw className="animate-spin" /> Loading store stock…</div>;
  }

  if (error) {
    if (compact) return <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Supplied inventory tracking</h2><p className="mt-2 text-sm text-rose-700">{error}</p><button type="button" onClick={load} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><FiRefreshCw /> Retry</button></div>;
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Store stock and sales</h2>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
        <p className="mt-1 text-sm text-slate-600">Ask the platform administrator to apply the supplier store inventory migration, then refresh.</p>
        <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><FiRefreshCw /> Retry</button>
      </div>
    );
  }

  if (!result?.enabled) {
    if (compact) return <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Supplied inventory tracking</h2><p className="mt-2 text-sm text-slate-600">A store admin must enable stock sharing before store movement and sales appear here.</p></div>;
    return (
      <div className="rounded-2xl border border-indigo-100 bg-white p-8 text-center shadow-sm">
        <FiPackage className="mx-auto h-10 w-10 text-indigo-500" />
        <h2 className="mt-3 text-xl font-bold text-slate-900">Store stock and sales</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Store stock sharing is not available for your linked products yet. A store admin can enable it so you can see stock levels and sales activity and prepare deliveries.</p>
        <button type="button" onClick={load} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FiRefreshCw /> Refresh</button>
      </div>
    );
  }

  if (compact) {
    const trackedProducts = [...products].sort((first, second) => (
      number(second.suggested_delivery_quantity) - number(first.suggested_delivery_quantity)
      || number(second.units_reduced_30d) - number(first.units_reduced_30d)
    ));
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-bold text-slate-900">Supplied inventory movement</h2>
            <p className="mt-1 text-sm text-slate-600">Stock reductions and sales for your linked products, within each store’s sharing limit.</p>
          </div>
          {onViewAll && <button type="button" onClick={onViewAll} className="self-start rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Open Supply tracker</button>}
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-slate-100 p-4 sm:gap-3">
          <MiniMetric label="Products tracked" value={formatCount(products.length)} />
          <MiniMetric label="Units reduced · 30d" value={formatCount(reduced30d)} />
          <MiniMetric label="Restock suggestions" value={formatCount(deliveryItems.length)} />
        </div>
        {trackedProducts.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No linked products have a visible stock reduction yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {trackedProducts.slice(0, 6).map((item) => (
              <div key={`${item.supermarket_id}-${item.product_id}`} className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[minmax(0,1.3fr)_0.8fr_0.8fr_0.8fr] sm:items-center">
                <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{item.product_name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.store_name}{item.sku ? ` · SKU ${item.sku}` : ''}</p></div>
                <p className="text-sm text-slate-700">Available <b>{formatCount(item.available_stock)}</b><span className="block text-xs text-slate-500">On hand {formatCount(item.current_stock)}</span></p>
                <p className="text-sm text-slate-700">Reduced <b>{formatCount(item.units_reduced_30d)}</b><span className="block text-xs text-slate-500">Sold {formatCount(item.units_sold_7d)} / {formatCount(item.units_sold_30d)} · 7d / 30d</span></p>
                <p className={number(item.suggested_delivery_quantity) > 0 ? 'text-sm font-semibold text-amber-800' : 'text-sm text-emerald-700'}>{number(item.suggested_delivery_quantity) > 0 ? `Prepare ${formatCount(item.suggested_delivery_quantity)}` : 'Stock sufficient'}<span className="block text-xs font-normal text-slate-500">Restock at {formatCount(item.reorder_point)}</span></p>
              </div>
            ))}
          </div>
        )}
        {trackedProducts.length > 6 && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Showing 6 of {trackedProducts.length} tracked product/store rows.</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-semibold text-indigo-100">Delivery planning</p>
          <h2 className="mt-1 text-2xl font-bold">Store stock and sales</h2>
          <p className="mt-1 text-sm text-indigo-100">Live stock for your linked products, shared by each store’s admin.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25 disabled:opacity-60 sm:self-auto"><FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric icon={FiPackage} label="Products reduced · 30 days" value={formatCount(products.length)} />
        <Metric icon={FiAlertTriangle} label="Need restocking" value={formatCount(lowStockCount)} tone={lowStockCount ? 'amber' : 'green'} />
        <Metric icon={FiTrendingUp} label="Units reduced · 30 days" value={formatCount(reduced30d)} />
      </div>

      {deliveryItems.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-bold text-amber-950"><FiTruck /> Prepare these deliveries</h3>
          <p className="mt-1 text-sm text-amber-900">These products are at or below their store reorder point. Suggested quantities are planning estimates.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {deliveryItems.slice(0, 8).map((item) => (
              <span key={`${item.supermarket_id}-${item.product_id}`} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800">
                <b>{item.product_name}</b> · {item.store_name}: prepare {formatCount(item.suggested_delivery_quantity)}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h3 className="font-bold text-slate-900">Your products in stores</h3>
            <p className="mt-1 text-sm text-slate-500">Only your linked products with a recent stock reduction and allowed by each store’s visibility setting appear here.</p>
          </div>
          <label className="relative block sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or stores" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </label>
        </div>
        {visibleProducts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{products.length ? 'No products match your search.' : 'No products currently meet your linked product, recent stock reduction, and store visibility settings.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product / store</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Reduced · 30d</th><th className="px-4 py-3">Sold · 7d / 30d</th><th className="px-4 py-3">Sales · 30d</th><th className="px-4 py-3">Stock cover</th><th className="px-4 py-3">Delivery plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleProducts.map((item) => {
                  const low = number(item.available_stock) <= number(item.reorder_point);
                  return (
                    <tr key={`${item.supermarket_id}-${item.product_id}`} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.product_name}</div><div className="mt-1 text-xs text-slate-500">{item.store_name}{item.sku ? ` · SKU ${item.sku}` : ''}</div><div className="mt-1 text-xs text-indigo-700">{item.visibility_mode === 'limited' ? `Limited view · up to ${formatCount(item.visibility_limit)} units` : 'Full stock view'}</div></td>
                      <td className="px-4 py-3 text-slate-700">{formatCount(item.current_stock)}</td>
                      <td className="px-4 py-3"><span className={low ? 'font-semibold text-amber-700' : 'text-slate-700'}>{formatCount(item.available_stock)}</span><div className="mt-1 text-xs text-slate-500">Reorder at {formatCount(item.reorder_point)}</div></td>
                      <td className="px-4 py-3 text-slate-700">{formatCount(item.units_reduced_30d)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCount(item.units_sold_7d)} / {formatCount(item.units_sold_30d)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(item.sales_30d_ugx)}</td>
                      <td className="px-4 py-3 text-slate-700">{item.estimated_days_remaining == null ? 'No recent sales' : `${formatCount(item.estimated_days_remaining)} days`}</td>
                      <td className="px-4 py-3">{number(item.suggested_delivery_quantity) > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Prepare {formatCount(item.suggested_delivery_quantity)}</span> : <span className="text-xs text-emerald-700">Stock sufficient</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, tone = 'indigo' }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700'
  };
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}><Icon /></span><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900">{value}</p></div></div>;
};

const MiniMetric = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-2 text-center sm:p-3">
    <p className="text-lg font-extrabold text-indigo-700 sm:text-xl">{value}</p>
    <p className="text-[10px] font-medium text-slate-600 sm:text-xs">{label}</p>
  </div>
);

export default SupplierStoreInventory;
