// =====================================================================
// EXPIRING STOCK · REDUCED PRICES — admin panel inside Order Inventory
// =====================================================================
// Lists stock that is expired or close to its expiry date and lets the
// store admin publish a reduced price on it. Publishing writes the live
// selling price (see ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql), so the
// till, cashier portal and customer checkout all charge it immediately.
// Styled with the page's own oi-* classes (defined in OrderInventoryPOSControl).
// =====================================================================

import React, { useMemo, useState } from 'react';
import { FiClock, FiTag, FiAlertTriangle, FiChevronDown, FiChevronRight, FiLock, FiXCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import {
  getExpiryStatus,
  formatExpiryDate,
  suggestedDiscountPercent,
  isOnClearance,
  clearanceDiscountPercent,
  priceAfterDiscount
} from '../utils/productExpiry';

const WINDOWS = [7, 14, 30, 60, 90];

const pillClass = (key) => ({
  expired: 'oi-pill-out',
  critical: 'oi-pill-crit',
  soon: 'oi-pill-low',
  ok: 'oi-pill-ok',
  none: 'oi-pill-ok'
}[key]);

const stockOf = (product) => Number(product.current_stock) || 0;

const ExpiryClearancePanel = ({ products, isAdmin, ready, formatCurrency, onChanged }) => {
  const [windowDays, setWindowDays] = useState(30);
  const [drafts, setDrafts] = useState({}); // productId -> { mode: 'percent' | 'price', value: string }
  const [busyId, setBusyId] = useState(null);

  // Everything that still has something to sell (or is already on offer).
  const sellable = useMemo(
    () => (products || []).filter((p) => p.expiry_date && (stockOf(p) > 0 || isOnClearance(p))),
    [products]
  );

  const counts = useMemo(() => {
    const tally = { expired: 0, critical: 0, soon: 0, offers: 0 };
    sellable.forEach((p) => {
      const { key } = getExpiryStatus(p.expiry_date);
      if (key === 'expired') tally.expired += 1;
      else if (key === 'critical') tally.critical += 1;
      else if (key === 'soon') tally.soon += 1;
      if (isOnClearance(p)) tally.offers += 1;
    });
    return tally;
  }, [sellable]);

  const rows = useMemo(
    () => sellable
      .map((p) => ({ product: p, status: getExpiryStatus(p.expiry_date) }))
      .filter(({ status }) => status.days <= windowDays)
      .sort((a, b) => a.status.days - b.status.days),
    [sellable, windowDays]
  );

  const attention = counts.expired + counts.critical + counts.soon;
  // Start open when something needs attention, or when setup is missing and
  // the admin must be told (otherwise the notice would sit behind a closed header).
  const [open, setOpen] = useState(() => !ready || attention > 0 || counts.offers > 0);

  const draftFor = (product, status) => {
    if (drafts[product.id]) return drafts[product.id];
    const percent = isOnClearance(product) ? clearanceDiscountPercent(product) : suggestedDiscountPercent(status.days);
    return { mode: 'percent', value: String(percent) };
  };

  const setDraft = (productId, patch, current) =>
    setDrafts((previous) => ({ ...previous, [productId]: { ...current, ...patch } }));

  // What the draft would charge, and whether it is publishable.
  const evaluate = (product, draft) => {
    const base = Number(product.clearance_original_price ?? product.selling_price) || 0;
    const entered = Number(draft.value);
    let nextPrice = null;
    let valid = false;
    if (draft.value !== '' && Number.isFinite(entered)) {
      if (draft.mode === 'percent') {
        valid = Number.isInteger(entered) && entered >= 1 && entered <= 90;
        nextPrice = valid ? priceAfterDiscount(base, entered) : null;
      } else {
        nextPrice = Math.round(entered);
        valid = nextPrice >= 0 && nextPrice < base;
      }
    }
    const percent = valid && base > 0 ? Math.round((1 - nextPrice / base) * 100) : null;
    const belowCost = valid && Number(product.cost_price) > 0 && nextPrice < Number(product.cost_price);
    return { base, nextPrice, percent, valid, belowCost };
  };

  const rpcFailure = (error, fallback) => {
    const missing = error?.code === 'PGRST202' || error?.code === '42883';
    toast.error(missing
      ? 'Reduced pricing is not set up yet — run ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql in Supabase.'
      : (error?.message || fallback));
  };

  const publish = async (product, draft, result) => {
    if (!isAdmin) {
      toast.error('❌ Only Admins can publish reduced prices');
      return;
    }
    if (!result.valid) return;
    if (result.belowCost && !window.confirm(
      `${formatCurrency(result.nextPrice)} is below your cost price (${formatCurrency(product.cost_price)}) for ${product.name}. Publish anyway?`
    )) return;

    setBusyId(product.id);
    const args = draft.mode === 'percent'
      ? { p_product_id: product.id, p_discount_percent: Number(draft.value) }
      : { p_product_id: product.id, p_clearance_price: Number(draft.value) };
    const { error } = await supabase.rpc('publish_clearance_price', args);
    setBusyId(null);

    if (error) {
      rpcFailure(error, 'Could not publish the reduced price');
      return;
    }
    toast.success(`🏷️ ${product.name} is now ${formatCurrency(result.nextPrice)} (−${result.percent}%) — live at the till and for customers`);
    setDrafts((previous) => { const next = { ...previous }; delete next[product.id]; return next; });
    onChanged(product.id);
  };

  const endOffer = async (product) => {
    if (!isAdmin) {
      toast.error('❌ Only Admins can end a reduced price');
      return;
    }
    setBusyId(product.id);
    const { error } = await supabase.rpc('end_clearance_price', { p_product_id: product.id });
    setBusyId(null);

    if (error) {
      rpcFailure(error, 'Could not end the reduced price');
      return;
    }
    toast.success(`↩️ ${product.name} is back to ${formatCurrency(product.clearance_original_price)}`);
    setDrafts((previous) => { const next = { ...previous }; delete next[product.id]; return next; });
    onChanged(product.id);
  };

  return (
    <div className="oi-panel">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 text-left"
      >
        {open ? <FiChevronDown className="h-4 w-4 flex-shrink-0" /> : <FiChevronRight className="h-4 w-4 flex-shrink-0" />}
        <FiClock className="h-4 w-4 flex-shrink-0 text-[#b8912f]" />
        <span className="font-bold oi-name text-sm sm:text-base">Expiring stock · Reduced prices</span>
        <span className="ml-auto flex flex-wrap justify-end gap-1.5">
          {counts.expired > 0 && <span className="oi-pill-out px-2 py-0.5 rounded-full text-[11px] font-bold">{counts.expired} expired</span>}
          {counts.critical > 0 && <span className="oi-pill-crit px-2 py-0.5 rounded-full text-[11px] font-bold">{counts.critical} within 7d</span>}
          {counts.soon > 0 && <span className="oi-pill-low px-2 py-0.5 rounded-full text-[11px] font-bold">{counts.soon} within 30d</span>}
          {counts.offers > 0 && <span className="oi-pill-offer px-2 py-0.5 rounded-full text-[11px] font-bold">{counts.offers} on offer</span>}
        </span>
      </button>

      {open && (
        <div className="px-3 sm:px-4 pb-3 space-y-2.5 border-t border-[#e7dfcc]">
          {!ready ? (
            <div className="mt-3 flex gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <FiAlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Expiry dates and reduced prices need a one-time database update. Run
                {' '}<code className="font-mono text-xs">backend/database/migrations/ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql</code>{' '}
                in the Supabase SQL editor, then refresh.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 pt-2.5 text-xs text-gray-600">
                <label htmlFor="oi-expiry-window" className="font-semibold">Show stock expiring within</label>
                <select
                  id="oi-expiry-window"
                  value={windowDays}
                  onChange={(event) => setWindowDays(Number(event.target.value))}
                  className="px-2 py-1 text-sm oi-input rounded"
                >
                  {WINDOWS.map((days) => <option key={days} value={days}>{days} days</option>)}
                </select>
                <span className="sm:ml-auto flex items-center gap-1">
                  {isAdmin ? <FiTag className="h-3.5 w-3.5" /> : <FiLock className="h-3.5 w-3.5" />}
                  {isAdmin
                    ? 'A published price is live at the till and in customer checkout straight away.'
                    : 'Only Admins can publish reduced prices.'}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="py-5 text-center text-sm text-gray-500">
                  {sellable.length === 0
                    ? 'No stocked products have an expiry date yet. Add one with Edit on a product.'
                    : `Nothing in stock expires within ${windowDays} days.`}
                </p>
              ) : (
                <ul className="divide-y divide-[#e7dfcc] oi-list !shadow-none">
                  {rows.map(({ product, status }) => {
                    const expired = status.key === 'expired';
                    const onOffer = isOnClearance(product);
                    const draft = draftFor(product, status);
                    const result = evaluate(product, draft);
                    const busy = busyId === product.id;

                    return (
                      <li key={product.id} className="flex flex-col lg:flex-row lg:items-center gap-2.5 lg:gap-4 px-3 py-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold oi-name text-sm truncate">{product.name}</p>
                            <p className="text-xs text-gray-600 truncate">
                              SKU: {product.sku || 'N/A'} · Stock {stockOf(product)}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className={`${pillClass(status.key)} px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap`}>
                                {status.label}
                              </span>
                              <span className="text-[11px] text-gray-500">{formatExpiryDate(product.expiry_date)}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {onOffer ? (
                              <>
                                <p className="text-[11px] text-gray-400 line-through">{formatCurrency(product.clearance_original_price)}</p>
                                <p className="text-sm font-bold text-green-700">{formatCurrency(product.selling_price)}</p>
                                <span className="oi-pill-offer px-1.5 py-0.5 rounded-full text-[10px] font-bold">−{clearanceDiscountPercent(product)}%</span>
                              </>
                            ) : (
                              <p className="text-sm font-bold text-green-700">{formatCurrency(product.selling_price)}</p>
                            )}
                          </div>
                        </div>

                        {expired ? (
                          <p className="flex items-center gap-1.5 text-xs font-semibold lg:w-80 text-[#7a1f2b]">
                            <FiXCircle className="h-4 w-4 flex-shrink-0" />
                            Expired — it can no longer be sold. Pull it from the shelf.
                          </p>
                        ) : isAdmin ? (
                          <div className="lg:w-80 flex-shrink-0 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="inline-flex rounded border border-[#d8cfb8] overflow-hidden text-xs font-semibold" role="group" aria-label="Reduce by">
                                {[['percent', '% off'], ['price', 'UGX']].map(([mode, label]) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    aria-pressed={draft.mode === mode}
                                    onClick={() => setDraft(product.id, {
                                      mode,
                                      value: mode === 'percent'
                                        ? String(result.percent ?? suggestedDiscountPercent(status.days))
                                        : String(result.nextPrice ?? '')
                                    }, draft)}
                                    className={`px-2 py-1.5 ${draft.mode === mode ? 'oi-btn-on' : 'bg-white text-gray-600'}`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={draft.mode === 'percent' ? 1 : 0}
                                max={draft.mode === 'percent' ? 90 : undefined}
                                step="1"
                                value={draft.value}
                                onChange={(event) => setDraft(product.id, { value: event.target.value }, draft)}
                                aria-label={draft.mode === 'percent' ? `Percent off ${product.name}` : `Reduced price for ${product.name}`}
                                className="w-24 px-2 py-1.5 text-sm oi-input rounded"
                              />
                              <button
                                type="button"
                                onClick={() => publish(product, draft, result)}
                                disabled={busy || !result.valid}
                                className="flex-1 px-2.5 py-1.5 rounded border text-xs sm:text-sm font-semibold oi-btn oi-btn-primary disabled:opacity-50"
                              >
                                {busy ? 'Saving…' : onOffer ? 'Update' : 'Publish'}
                              </button>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] min-h-[1rem]">
                              {result.valid ? (
                                <span className={result.belowCost ? 'text-[#b45f06] font-semibold' : 'text-gray-600'}>
                                  {formatCurrency(result.base)} → <b>{formatCurrency(result.nextPrice)}</b> (−{result.percent}%)
                                  {result.belowCost && ' · below cost'}
                                </span>
                              ) : (
                                <span className="text-[#7a1f2b]">
                                  {draft.mode === 'percent' ? 'Enter a whole number from 1 to 90' : `Enter a price below ${formatCurrency(result.base)}`}
                                </span>
                              )}
                              {onOffer && (
                                <button
                                  type="button"
                                  onClick={() => endOffer(product)}
                                  disabled={busy}
                                  className="font-semibold underline text-gray-600 hover:text-gray-900 disabled:opacity-50"
                                >
                                  End offer
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpiryClearancePanel;
