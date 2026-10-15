/**
 * Stable price — the owner's tab for keeping prices on ICEC-S, the stable coin. One component
 * for both sides of the platform:
 *
 *   kind="product"  an admin's store products   (scopeId = supermarket id)  — Order Inventory
 *   kind="catalog"  a supplier's catalog items  (scopeId = supplier user id) — My Catalog
 *
 *  - Put items on the stable coin at their CURRENT shilling price (nothing changes for buyers
 *    today). From then on the shilling price follows ICEC-S.
 *  - Every time that moves a shilling price, the owner is told here — what it was, what it is
 *    now, and why — until they acknowledge it. Moves made by the scheduled repricer while nobody
 *    was logged in are in the same list.
 *
 * Styled by the shared stable-coin theme (styles/stableCoinTheme.js): classic ledger look, light
 * and dark, with the supplier portal's indigo flavour for suppliers. Every surface carries its own
 * colours, so it reads the same on the page's cream background and inside a dark panel.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import StableCoinStyles from '../styles/StableCoinStyles';
import {
  getStableQuote, repriceStableItems, listPricing, applyStablePricing, removeStablePricing,
  getPriceChanges, markPriceChangesSeen,
} from '../services/stablePricingService';
import { isOnOffer, netChangesByProduct, describeChanges } from '../utils/stablePricing';

const ugx = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;
const signedPct = (p) => (p === null || !Number.isFinite(p) ? '' : `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`);
const when = (t) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// What each side calls things, and why the stable coin matters to them.
const COPY = {
  product: {
    noun: 'product', nouns: 'products',
    intro: "Keep a product's price on the stable coin — worth one US dollar, never below its inflation-protected value — so inflation can't eat it. When the shilling weakens, the UGX price rises with ICEC-S, and you are told here every time.",
    today: 'nothing changes on the shelf today',
  },
  catalog: {
    noun: 'item', nouns: 'items',
    intro: "Fix what you supply in the stable coin — worth one US dollar, never below its inflation-protected value — so inflation can't eat your margin. The UGX price supermarkets see follows ICEC-S, and you are told here every time it moves.",
    today: 'supermarkets see no change today',
  },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'stable', label: 'On stable coin' },
  { id: 'local', label: 'In shillings' },
];

const PREVIEW_ROWS = 5;

export default function StablePricePanel({ kind = 'product', scopeId, onChanged, onUnseenChange, onClose }) {
  const copy = COPY[kind] || COPY.product;
  const supplier = kind === 'catalog';

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
    if (!scopeId) return;
    setLoading(true);
    setError('');
    try {
      const q = await getStableQuote({ force: true });
      setQuote(q);
      // Bring this owner's stable-priced items up to today's value first, so what's listed is current
      // and any move is in the notice below.
      let repriced = null;
      if (q.status === 'ok') repriced = await repriceStableItems(kind, scopeId, { quote: q }).catch(() => null);
      const [list, log] = await Promise.all([listPricing(kind, scopeId), getPriceChanges(kind, scopeId)]);
      setRows(list.rows);
      setStableReady(list.stableReady);
      setChanges(log.rows);
      callbacks.current.onUnseenChange?.(log.rows.filter((c) => !c.seen_at).length);
      if (repriced?.updated) callbacks.current.onChanged?.();
    } catch (e) {
      console.error('Stable price panel failed to load:', e);
      setError(e.message || `Could not load your ${copy.nouns}`);
    } finally {
      setLoading(false);
    }
  }, [kind, scopeId, copy.nouns]);

  useEffect(() => { load(); }, [load]);

  const quoteOk = quote?.status === 'ok';
  const isStable = (r) => r.price_unit === 'ICEC_S' && Number(r.stable_price) > 0;

  const stableCount = rows.filter(isStable).length;
  const eligibleLocal = rows.filter((r) => !isStable(r) && !isOnOffer(r) && r.price > 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'stable' && !(r.price_unit === 'ICEC_S' && Number(r.stable_price) > 0)) return false;
      if (filter === 'local' && r.price_unit === 'ICEC_S' && Number(r.stable_price) > 0) return false;
      return !q || String(r.name || '').toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  // ── what the owner hasn't acknowledged ──
  const unseen = useMemo(() => changes.filter((c) => !c.seen_at), [changes]);
  const earlier = useMemo(() => changes.filter((c) => c.seen_at), [changes]);
  const unseenNet = useMemo(() => netChangesByProduct(unseen), [unseen]);
  const sentence = describeChanges(unseen, quoteOk ? quote.rate : null);
  const shownNet = showAllNew ? unseenNet : unseenNet.slice(0, PREVIEW_ROWS);

  const acknowledge = async () => {
    try {
      await markPriceChangesSeen(kind, scopeId);
      setChanges((prev) => prev.map((c) => (c.seen_at ? c : { ...c, seen_at: new Date().toISOString() })));
      callbacks.current.onUnseenChange?.(0);
    } catch (e) {
      toast.error(`Could not mark as seen: ${e.message || 'unknown error'}`);
    }
  };

  // ── choosing items ──
  const selectable = (r) => isStable(r) || (!isOnOffer(r) && r.price > 0);
  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectableVisible = visible.filter(selectable);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((r) => selected.has(r.id));
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) selectableVisible.forEach((r) => next.delete(r.id)); else selectableVisible.forEach((r) => next.add(r.id));
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
      `${res.applied} ${res.applied === 1 ? copy.noun : copy.nouns} now follow${res.applied === 1 ? 's' : ''} ICEC-S at today's price — ${copy.today}.${skipped.length ? ` Skipped: ${skipped.join(', ')}.` : ''}`,
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

  const putOnStable = (items) => run(async () => reportApplied(await applyStablePricing(kind, scopeId, items, { quote })));
  const returnToShillings = (items) => run(async () => {
    const { removed } = await removeStablePricing(kind, scopeId, items.map((p) => p.id));
    toast.success(`${removed} ${removed === 1 ? copy.noun : copy.nouns} back in shillings, at ${removed === 1 ? 'its' : 'their'} current price.`);
  });

  return (
    <div className={`sc-root ${supplier ? 'sc-supplier' : ''} p-3 sm:p-4 space-y-4`} data-testid="stable-price-panel">
      <StableCoinStyles />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="sc-title sc-title-serif text-lg font-bold">🪙 Stable price (ICEC-S)</h3>
          <p className="sc-muted mt-1 text-sm leading-relaxed">{copy.intro}</p>
        </div>
        <button type="button" onClick={onClose} className="sc-btn shrink-0" aria-label="Close stable price">✕</button>
      </div>

      {/* what 1 ICEC-S is worth */}
      {quote && (
        quoteOk ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="sc-text text-sm">1 ICEC-S = <b className="sc-title">{ugx(quote.rate)}</b></p>
            {stableReady && <p className="sc-muted text-sm"><b className="sc-title">{stableCount}</b> of {rows.length} {copy.nouns} on the stable coin</p>}
            {quote.stale && <p className="sc-pill sc-pill-warn">Rates a few hours old — prices won&apos;t move until they refresh</p>}
          </div>
        ) : (
          <p className="sc-notice px-3 py-2 text-sm" role="status">
            {quote.status === 'missing'
              ? `ICEC-S is not installed on this system yet, so ${copy.nouns} cannot be moved onto the stable coin.`
              : `ICEC-S has no live price right now, so ${copy.nouns} cannot be moved onto the stable coin. Try again shortly.`}
          </p>
        )
      )}

      {!stableReady && !loading && (
        <p className="sc-notice px-3 py-2 text-sm" role="status">
          Stable pricing needs <b>ADD_STABLECOIN_PRICING.sql</b> to be run first. Until then {copy.nouns} can&apos;t be saved on the stable coin.
        </p>
      )}

      {error && <p className="sc-bad text-sm" role="alert">{error}</p>}

      {/* ── always: what changed in the local-currency value ── */}
      {unseen.length > 0 && (
        <section className="sc-notice p-3" aria-label="Price changes" role="status" data-testid="price-changes-notice">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="sc-notice-text text-sm font-semibold">⚠️ {sentence || `${unseen.length} price change${unseen.length === 1 ? '' : 's'} to review.`}</p>
            <button type="button" onClick={acknowledge} className="sc-btn sc-btn-primary">Got it</button>
          </div>
          {shownNet.length > 0 && (
            <ul className="sc-divide mt-2 text-sm">
              {shownNet.map((c) => (
                <li key={c.product_id ?? c.product_name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
                  <span className="sc-notice-sub min-w-[8rem] flex-1 break-words">{c.product_name}</span>
                  <span className="sc-notice-sub tabular-nums">
                    {ugx(c.old_price)} → <b>{ugx(c.new_price)}</b>{' '}
                    <span className={c.new_price >= c.old_price ? 'sc-up font-semibold' : 'sc-good font-semibold'}>{signedPct(c.pct)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {unseenNet.length > PREVIEW_ROWS && (
            <button type="button" onClick={() => setShowAllNew((v) => !v)} className="sc-link mt-1 text-xs font-medium">
              {showAllNew ? 'Show fewer' : `Show all ${unseenNet.length}`}
            </button>
          )}
        </section>
      )}

      {/* ── pick items ── */}
      {stableReady && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${copy.nouns}…`}
              aria-label={`Search ${copy.nouns}`} className="sc-input w-full px-3"
            />
            <div className="flex gap-1" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                  className={`sc-btn flex-1 sm:flex-none ${filter === f.id ? 'sc-btn-on' : ''}`}
                >{f.label}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="sc-text flex items-center gap-2 text-sm">
              <input type="checkbox" className="sc-check h-4 w-4" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all shown" />
              Select all shown
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button" disabled={busy || !quoteOk || selectedLocal.length === 0} onClick={() => putOnStable(selectedLocal)}
                className="sc-btn sc-btn-primary"
              >Put {selectedLocal.length || ''} on stable coin</button>
              <button
                type="button" disabled={busy || selectedStable.length === 0} onClick={() => returnToShillings(selectedStable)}
                className="sc-btn"
              >Back to shillings{selectedStable.length ? ` (${selectedStable.length})` : ''}</button>
            </div>
          </div>

          {loading && rows.length === 0 ? (
            <p className="sc-muted py-6 text-center text-sm">Loading your {copy.nouns}…</p>
          ) : visible.length === 0 ? (
            <p className="sc-muted py-6 text-center text-sm">{rows.length ? `No ${copy.nouns} match.` : `You have no ${supplier ? '' : 'active '}${copy.nouns} yet.`}</p>
          ) : (
            <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-0.5" data-testid="stable-product-list">
              {visible.map((r) => {
                const stable = isStable(r);
                const offer = isOnOffer(r);
                return (
                  <li key={r.id} className="sc-card flex items-center gap-3 p-2">
                    <input
                      type="checkbox" className="sc-check h-4 w-4 shrink-0" checked={selected.has(r.id)} disabled={!selectable(r)}
                      onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="sc-title truncate text-sm font-semibold">{r.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {stable && <span className="sc-pill sc-pill-ok">{Number(r.stable_price)} ICEC-S</span>}
                        {offer && (
                          <span className="sc-pill sc-pill-gold" title="Its price is a temporary expiry discount; it can join the stable coin once the offer ends.">
                            On offer
                          </span>
                        )}
                        {!stable && !offer && !(r.price > 0) && <span className="sc-muted text-[11px]">No price yet</span>}
                        {r.unit && <span className="sc-muted text-[11px]">per {r.unit}</span>}
                      </div>
                    </div>
                    <p className="sc-text shrink-0 text-sm font-bold tabular-nums">{r.price > 0 ? ugx(r.price) : '—'}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {/* everything, in one go */}
          {eligibleLocal.length > 0 && quoteOk && (
            confirm === 'all' ? (
              <div className="sc-flat p-3 text-sm">
                <p className="sc-text">
                  Put <b className="sc-title">all {eligibleLocal.length}</b> shilling-priced {eligibleLocal.length === 1 ? copy.noun : copy.nouns} on the stable coin? Every price stays exactly as it is today.
                  From now on {eligibleLocal.length === 1 ? 'it follows' : 'each follows'} ICEC-S, and you&apos;ll be told here whenever a price moves.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="sc-btn">Cancel</button>
                  <button type="button" disabled={busy} onClick={() => putOnStable(eligibleLocal)} className="sc-btn sc-btn-primary">
                    {busy ? 'Working…' : `Confirm: put ${eligibleLocal.length} on stable coin`}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirm('all')} className="sc-btn w-full">
                Put all {eligibleLocal.length} shilling-priced {eligibleLocal.length === 1 ? copy.noun : copy.nouns} on the stable coin
              </button>
            )
          )}
        </>
      )}

      {/* earlier, already-acknowledged changes */}
      {earlier.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowEarlier((v) => !v)} className="sc-link text-sm font-medium">
            {showEarlier ? 'Hide earlier price changes' : `Earlier price changes (${earlier.length})`}
          </button>
          {showEarlier && (
            <ul className="sc-divide mt-2 max-h-60 overflow-y-auto text-sm" data-testid="earlier-changes">
              {earlier.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
                  <span className="sc-text min-w-[8rem] flex-1 break-words">{c.product_name}</span>
                  <span className="sc-muted tabular-nums">
                    {ugx(c.old_price)} → {ugx(c.new_price)} <span className="text-xs">· {when(c.changed_at)}</span>
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
