/**
 * Stable price — the admin's tab for keeping product prices on ICEC-S, the stable coin.
 *
 *  - Put products on the stable coin at their CURRENT shilling price (nothing changes on the
 *    shelf today). From then on the shilling price follows ICEC-S.
 *  - Every time that moves a shilling price, the admin is told here — what it was, what it is
 *    now, and why — until they acknowledge it. Moves made by the scheduled repricer while
 *    nobody was logged in are in the same list.
 *
 * Styled with the Order Inventory screen's own `oi-*` classes so it follows its light and dark themes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  getStableQuote, repriceStableItems, listStorePricing, applyStablePricing, removeStablePricing,
  getPriceChanges, markPriceChangesSeen,
} from '../services/stablePricingService';
import { isOnOffer, netChangesByProduct, describeChanges } from '../utils/stablePricing';

const ugx = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;
const signedPct = (p) => (p === null || !Number.isFinite(p) ? '' : `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`);
const when = (t) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'stable', label: 'On stable coin' },
  { id: 'local', label: 'In shillings' },
];

const PREVIEW_ROWS = 5;

export default function StablePricePanel({ supermarketId, onChanged, onUnseenChange, onClose }) {
  const [quote, setQuote] = useState(null);
  const [rows, setRows] = useState([]);
  const [stableReady, setStableReady] = useState(true);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'all' | null
  const [showAllNew, setShowAllNew] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);

  // The parent usually passes inline callbacks; keep them out of load()'s dependencies so a re-render never re-triggers a load.
  const callbacks = useRef({ onChanged, onUnseenChange });
  callbacks.current = { onChanged, onUnseenChange };

  const load = useCallback(async () => {
    if (!supermarketId) return;
    setLoading(true);
    setError('');
    try {
      const q = await getStableQuote({ force: true });
      setQuote(q);
      // Bring this store's stable-priced items up to today's value first, so what's listed is current
      // and any move is in the notice below.
      let repriced = null;
      if (q.status === 'ok') repriced = await repriceStableItems('product', supermarketId, { quote: q }).catch(() => null);
      const [list, log] = await Promise.all([listStorePricing(supermarketId), getPriceChanges(supermarketId)]);
      setRows(list.rows);
      setStableReady(list.stableReady);
      setChanges(log.rows);
      callbacks.current.onUnseenChange?.(log.rows.filter((c) => !c.seen_at).length);
      if (repriced?.updated) callbacks.current.onChanged?.();
    } catch (e) {
      console.error('Stable price panel failed to load:', e);
      setError(e.message || 'Could not load your products');
    } finally {
      setLoading(false);
    }
  }, [supermarketId]);

  useEffect(() => { load(); }, [load]);

  const quoteOk = quote?.status === 'ok';
  const isStable = (r) => r.price_unit === 'ICEC_S' && Number(r.stable_price) > 0;

  const stableCount = rows.filter(isStable).length;
  const eligibleLocal = rows.filter((r) => !isStable(r) && !isOnOffer(r) && Number(r.selling_price) > 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'stable' && !(r.price_unit === 'ICEC_S' && Number(r.stable_price) > 0)) return false;
      if (filter === 'local' && r.price_unit === 'ICEC_S' && Number(r.stable_price) > 0) return false;
      return !q || String(r.name || '').toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  // ── what the admin hasn't acknowledged ──
  const unseen = useMemo(() => changes.filter((c) => !c.seen_at), [changes]);
  const earlier = useMemo(() => changes.filter((c) => c.seen_at), [changes]);
  const unseenNet = useMemo(() => netChangesByProduct(unseen), [unseen]);
  const sentence = describeChanges(unseen, quoteOk ? quote.rate : null);
  const shownNet = showAllNew ? unseenNet : unseenNet.slice(0, PREVIEW_ROWS);

  const acknowledge = async () => {
    try {
      await markPriceChangesSeen(supermarketId);
      setChanges((prev) => prev.map((c) => (c.seen_at ? c : { ...c, seen_at: new Date().toISOString() })));
      callbacks.current.onUnseenChange?.(0);
    } catch (e) {
      toast.error(`Could not mark as seen: ${e.message || 'unknown error'}`);
    }
  };

  // ── choosing products ──
  const selectable = (r) => isStable(r) || (!isOnOffer(r) && Number(r.selling_price) > 0);
  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allVisibleSelected = visible.filter(selectable).length > 0 && visible.filter(selectable).every((r) => selected.has(r.id));
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    const ids = visible.filter(selectable).map((r) => r.id);
    if (allVisibleSelected) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id));
    return next;
  });

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedLocal = selectedRows.filter((r) => !isStable(r));
  const selectedStable = selectedRows.filter(isStable);

  const reportApplied = (res) => {
    const skipped = [];
    if (res.skippedOffer) skipped.push(`${res.skippedOffer} on an expiry offer`);
    if (res.skippedNoPrice) skipped.push(`${res.skippedNoPrice} with no price`);
    toast.success(
      `${res.applied} product${res.applied === 1 ? '' : 's'} now follow${res.applied === 1 ? 's' : ''} ICEC-S at today's price — nothing changes on the shelf today.${skipped.length ? ` Skipped: ${skipped.join(', ')}.` : ''}`,
      { autoClose: 7000 },
    );
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      setSelected(new Set());
      setConfirm(null);
      await load();
      callbacks.current.onChanged?.();
    } catch (e) {
      toast.error(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const putOnStable = (products) => run(async () => reportApplied(await applyStablePricing(supermarketId, products, { quote })));
  const returnToShillings = (products) => run(async () => {
    const { removed } = await removeStablePricing(supermarketId, products.map((p) => p.id));
    toast.success(`${removed} product${removed === 1 ? '' : 's'} back in shillings, at their current price.`);
  });

  return (
    <div className="oi-expanded rounded p-3 sm:p-4 space-y-4" data-testid="stable-price-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold oi-name">🪙 Stable price (ICEC-S)</h3>
          <p className="mt-1 text-sm text-gray-600">
            Keep a product&apos;s price on the stable coin — worth one US dollar, never below its inflation-protected value — so inflation
            can&apos;t eat it. When the shilling weakens, the UGX price rises with ICEC-S, and you are told here every time.
          </p>
        </div>
        <button type="button" onClick={onClose} className="oi-btn oi-btn-ghost shrink-0 rounded border px-2.5 py-1 text-sm" aria-label="Close stable price">✕</button>
      </div>

      {/* what 1 ICEC-S is worth */}
      {quote && (
        quoteOk ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-sm text-gray-700">1 ICEC-S = <b className="oi-name">{ugx(quote.rate)}</b></p>
            {quote.stale && <p className="text-xs text-amber-700">Exchange rates are a few hours old; prices won&apos;t move until they refresh.</p>}
            {stableReady && <p className="text-sm text-gray-600"><b className="oi-name">{stableCount}</b> of {rows.length} products on the stable coin</p>}
          </div>
        ) : (
          <p className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-800" role="status">
            {quote.status === 'missing'
              ? 'ICEC-S is not installed on this system yet, so products cannot be moved onto the stable coin.'
              : 'ICEC-S has no live price right now, so products cannot be moved onto the stable coin. Try again shortly.'}
          </p>
        )
      )}

      {!stableReady && !loading && (
        <p className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-800" role="status">
          Stable pricing needs <b>ADD_STABLECOIN_PRICING.sql</b> to be run first. Until then products can&apos;t be saved on the stable coin.
        </p>
      )}

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      {/* ── always: what changed in the local-currency value ── */}
      {unseen.length > 0 && (
        <section className="rounded border border-amber-400 p-3" aria-label="Price changes" role="status" data-testid="price-changes-notice">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800">⚠️ {sentence || `${unseen.length} price change${unseen.length === 1 ? '' : 's'} to review.`}</p>
            <button type="button" onClick={acknowledge} className="oi-btn oi-btn-primary rounded border px-3 py-1 text-sm font-semibold">Got it</button>
          </div>
          {shownNet.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-200/40 text-sm">
              {shownNet.map((c) => (
                <li key={c.product_id ?? c.product_name} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate text-gray-800">{c.product_name}</span>
                  <span className="shrink-0 tabular-nums text-gray-700">
                    {ugx(c.old_price)} → <b className="oi-name">{ugx(c.new_price)}</b>{' '}
                    <span className={c.new_price >= c.old_price ? 'text-amber-700' : 'text-emerald-700'}>{signedPct(c.pct)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {unseenNet.length > PREVIEW_ROWS && (
            <button type="button" onClick={() => setShowAllNew((v) => !v)} className="mt-1 text-xs font-medium text-gray-700 underline">
              {showAllNew ? 'Show fewer' : `Show all ${unseenNet.length}`}
            </button>
          )}
        </section>
      )}

      {/* ── pick products ── */}
      {stableReady && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…"
              aria-label="Search products" className="w-full rounded px-3 py-2 text-sm oi-input"
            />
            <div className="inline-flex rounded border border-gray-300/60 p-0.5" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                  className={`oi-btn rounded px-2.5 py-1 text-xs font-semibold sm:text-sm ${filter === f.id ? 'oi-btn-on' : 'oi-btn-ghost'}`}
                >{f.label}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all shown" />
              Select all shown
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button" disabled={busy || !quoteOk || selectedLocal.length === 0} onClick={() => putOnStable(selectedLocal)}
                className="oi-btn oi-btn-primary rounded border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >Put {selectedLocal.length || ''} on stable coin</button>
              <button
                type="button" disabled={busy || selectedStable.length === 0} onClick={() => returnToShillings(selectedStable)}
                className="oi-btn oi-btn-ghost rounded border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >Back to shillings{selectedStable.length ? ` (${selectedStable.length})` : ''}</button>
            </div>
          </div>

          {loading && rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading your products…</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">{rows.length ? 'No products match.' : 'You have no active products yet.'}</p>
          ) : (
            <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-0.5" data-testid="stable-product-list">
              {visible.map((r) => {
                const stable = isStable(r);
                const offer = isOnOffer(r);
                return (
                  <li key={r.id} className="oi-card flex items-center gap-3 p-2">
                    <input
                      type="checkbox" checked={selected.has(r.id)} disabled={!selectable(r)} onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.name}`} className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold oi-name">{r.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {stable && <span className="oi-pill-ok rounded-full px-2 py-0.5 text-[11px] font-semibold">{Number(r.stable_price)} ICEC-S</span>}
                        {offer && (
                          <span className="oi-pill-offer rounded-full px-2 py-0.5 text-[11px] font-semibold" title="Its price is a temporary expiry discount; it can join the stable coin once the offer ends.">
                            On offer
                          </span>
                        )}
                        {!stable && !offer && !(Number(r.selling_price) > 0) && <span className="text-[11px] text-gray-500">No price yet</span>}
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-gray-800">{ugx(r.selling_price)}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {/* everything, in one go */}
          {eligibleLocal.length > 0 && quoteOk && (
            confirm === 'all' ? (
              <div className="rounded border border-gray-300/60 p-3 text-sm text-gray-700">
                <p>
                  Put <b>all {eligibleLocal.length}</b> shilling-priced products on the stable coin? Every price stays exactly as it is today.
                  From now on each follows ICEC-S, and you&apos;ll be told here whenever a price moves.
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="oi-btn oi-btn-ghost rounded border px-3 py-1.5 text-sm">Cancel</button>
                  <button type="button" disabled={busy} onClick={() => putOnStable(eligibleLocal)} className="oi-btn oi-btn-primary rounded border px-3 py-1.5 text-sm font-semibold">
                    {busy ? 'Working…' : `Confirm: put ${eligibleLocal.length} on stable coin`}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirm('all')} className="oi-btn oi-btn-ghost w-full rounded border px-3 py-2 text-sm font-semibold">
                Put all {eligibleLocal.length} shilling-priced products on the stable coin
              </button>
            )
          )}
        </>
      )}

      {/* earlier, already-acknowledged changes */}
      {earlier.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowEarlier((v) => !v)} className="text-sm font-medium text-gray-700 underline">
            {showEarlier ? 'Hide earlier price changes' : `Earlier price changes (${earlier.length})`}
          </button>
          {showEarlier && (
            <ul className="mt-2 max-h-60 divide-y divide-gray-200/40 overflow-y-auto text-sm" data-testid="earlier-changes">
              {earlier.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                  <span className="min-w-0 truncate text-gray-800">{c.product_name}</span>
                  <span className="tabular-nums text-gray-600">
                    {ugx(c.old_price)} → {ugx(c.new_price)} <span className="text-xs text-gray-500">· {when(c.changed_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
