/**
 * Supplier Price Analyst — shows a supplier how much of their margin inflation
 * will take, item by item, and lets them move an item onto ICEC-S (the stable
 * coin) so it can't.
 *
 * Numbers come from three places, all labelled for what they are:
 *   - the supplier's own catalog (price, cost, whether it is already ICEC-S priced)
 *   - ICEC-S's live value and Uganda's official inflation figure (ican_stable_quote)
 *   - ICEC-S's stored hourly value (ican_stable_history), from which the shilling's
 *     actual loss of value is measured
 * The projection is arithmetic on those inputs, not a forecast: the page says
 * which inflation rate it used and where it came from, and the supplier can change it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FiShield, FiCheckCircle, FiAlertTriangle, FiAlertOctagon, FiHelpCircle, FiMessageCircle, FiRefreshCw, FiTrendingUp,
} from 'react-icons/fi';
import StableCoinStyles from '../styles/StableCoinStyles';
import { supabase } from '../services/supabase';
import { getStableQuote, getStableHistory, savePricingMode } from '../services/stablePricingService';
import {
  STATUS, PRICE_UNIT_STABLE, DEFAULT_TARGET_MARGIN_PCT, estimateInflation, analyzeCatalog, summarizeCatalog,
} from '../utils/stablePricing';

const HORIZONS = [1, 3, 6, 12];

const STATUS_VIEW = {
  [STATUS.PROTECTED]: { label: 'Protected', Icon: FiShield, cls: 'sc-pill-ok' },
  [STATUS.HEALTHY]: { label: 'Healthy', Icon: FiCheckCircle, cls: 'sc-pill-info' },
  [STATUS.AT_RISK]: { label: 'At risk', Icon: FiAlertTriangle, cls: 'sc-pill-warn' },
  [STATUS.LOSING]: { label: 'Will lose money', Icon: FiAlertOctagon, cls: 'sc-pill-bad' },
  [STATUS.NO_COST]: { label: 'Add a cost price', Icon: FiHelpCircle, cls: 'sc-pill-plain' },
  [STATUS.NEGOTIABLE]: { label: 'Negotiable', Icon: FiMessageCircle, cls: 'sc-pill-plain' },
};

const ugx = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;
const pct = (n, digits = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(digits)}%`);
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const SOURCE_TEXT = {
  measured: 'measured from how much dearer a US dollar became in shillings',
  official: "Uganda's official inflation rate",
};

// ─── the shilling's cost of one US dollar, from ICEC-S's stored history ──────

const toSeries = (history) => (Array.isArray(history) ? history : [])
  .map((h) => ({
    t: new Date(h?.t).getTime(),
    value: Math.max(Number(h?.fx) || 0, Number(h?.floor) || 0) || Number(h?.v) || 0,
  }))
  .filter((p) => Number.isFinite(p.t) && p.value > 0)
  .sort((a, b) => a.t - b.t);

const downsample = (points, max = 160) => {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
};

function DollarCostChart({ history }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const svgRef = useRef(null);

  const all = useMemo(() => toSeries(history), [history]);
  const points = useMemo(() => downsample(all), [all]);
  if (points.length < 2) {
    return <p className="sc-muted text-sm">The chart appears once ICEC-S has stored a few days of values. Nothing here is simulated.</p>;
  }

  const W = 640; const H = 180; const PAD = { l: 56, r: 12, t: 10, b: 24 };
  const t0 = points[0].t; const t1 = points[points.length - 1].t;
  const lo = Math.min(...points.map((p) => p.value)); const hi = Math.max(...points.map((p) => p.value));
  const span = hi - lo || hi * 0.01 || 1;
  const yMin = lo - span * 0.1; const yMax = hi + span * 0.1;
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [yMin + (yMax - yMin) * 0.1, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.1];

  const first = points[0]; const last = points[points.length - 1];
  const change = ((last.value / first.value) - 1) * 100;

  const onMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const target = t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i += 1) if (Math.abs(points[i].t - target) < Math.abs(points[best].t - target)) best = i;
    setHover(best);
  };

  // Weekly rows for the table view (oldest first).
  const weekly = points.filter((_, i) => i % Math.max(1, Math.round(points.length / 12)) === 0 || i === points.length - 1);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="sc-title text-sm font-semibold">What one US dollar costs, in shillings</p>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="sc-link text-xs font-medium">
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <thead><tr className="sc-muted text-left text-xs"><th className="py-1 font-medium">Date</th><th className="py-1 text-right font-medium">UGX per US$1</th></tr></thead>
          <tbody>
            {weekly.map((p) => (
              <tr key={p.t} className="sc-rule sc-text border-t"><td className="py-1">{fmtDate(p.t)}</td><td className="py-1 text-right tabular-nums">{Math.round(p.value).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none"
            role="img"
            aria-label={`The shilling cost of one US dollar went from ${Math.round(first.value).toLocaleString()} on ${fmtDate(first.t)} to ${Math.round(last.value).toLocaleString()} on ${fmtDate(last.t)}, a change of ${change.toFixed(1)} percent.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line className="sc-svg-grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} strokeWidth="1" />
                <text className="sc-svg-axis" x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="14">{Math.round(v).toLocaleString()}</text>
              </g>
            ))}
            <text className="sc-svg-axis" x={PAD.l} y={H - 6} fontSize="14">{fmtDate(t0)}</text>
            <text className="sc-svg-axis" x={W - PAD.r} y={H - 6} fontSize="14" textAnchor="end">{fmtDate(t1)}</text>
            <path className="sc-svg-line" d={path} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && (
              <g>
                <line className="sc-svg-cross" x1={x(points[hover].t)} x2={x(points[hover].t)} y1={PAD.t} y2={H - PAD.b} strokeWidth="1" />
                <circle className="sc-svg-dot" cx={x(points[hover].t)} cy={y(points[hover].value)} r="4.5" strokeWidth="2" />
              </g>
            )}
          </svg>
          {hover !== null && (
            <div
              className="sc-tooltip pointer-events-none absolute top-1 rounded-md px-2 py-1 text-xs shadow"
              style={{ left: `${Math.min(Math.max((x(points[hover].t) / W) * 100, 14), 86)}%`, transform: 'translateX(-50%)' }}
            >
              <div className="sc-muted">{fmtDate(points[hover].t)}</div>
              <div className="sc-title font-semibold tabular-nums">UGX {Math.round(points[hover].value).toLocaleString()}</div>
            </div>
          )}
        </div>
      )}
      <p className="sc-muted mt-1 text-xs">
        {change >= 0 ? 'Up' : 'Down'} {Math.abs(change).toFixed(1)}% since {fmtDate(first.t)}. Taken from ICEC-S&apos;s own hourly record.
      </p>
    </div>
  );
}

// ─── pieces shared by the table (wide screens) and the cards (phones) ────────

function StatusChip({ status }) {
  const view = STATUS_VIEW[status];
  return (
    <span className={`sc-pill ${view.cls}`}>
      <view.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {view.label}
    </span>
  );
}

function ItemAdvice({ a, targetMargin, canSwitch, busy, onProtect }) {
  if (a.status === STATUS.PROTECTED) return 'Rises with the shilling’s loss of value.';
  if (a.status === STATUS.HEALTHY) return 'Margin holds for now. Re-check as inflation moves.';
  if (a.status === STATUS.NEGOTIABLE) return 'No list price, so nothing to protect.';
  if (a.status === STATUS.NO_COST) return 'Edit the item and enter what it costs you to see its margin.';
  const months = a.breakEvenMonths;
  return (
    <div className="space-y-1.5">
      <p>
        {months !== null && months < 120
          ? <>Stops covering its cost in about <b>{months < 1 ? 'under a month' : `${Math.round(months)} month${Math.round(months) === 1 ? '' : 's'}`}</b>. </>
          : null}
        To hold {targetMargin}% you&apos;d need {ugx(a.repricePrice)} by then.
      </p>
      {canSwitch && (
        <button
          type="button" disabled={busy} onClick={() => onProtect(a)}
          className="sc-btn sc-btn-primary sc-btn-sm"
        >
          {busy ? 'Saving…' : `Price in ICEC-S (${a.suggestedStablePrice})`}
        </button>
      )}
    </div>
  );
}

// ─── the analyst ─────────────────────────────────────────────────────────────

export default function SupplierPriceAnalyst({ userId }) {
  const [items, setItems] = useState([]);
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);
  const [targetMargin, setTargetMargin] = useState(DEFAULT_TARGET_MARGIN_PCT);
  const [inflationOverride, setInflationOverride] = useState(null); // monthly %, null = use the estimate
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [{ data, error }, q, h] = await Promise.all([
        supabase.from('supplier_catalog_items').select('*').eq('supplier_user_id', userId).order('created_at', { ascending: false }),
        getStableQuote({ force: true }),
        getStableHistory(2000),
      ]);
      if (error) throw error;
      setItems(data || []);
      setQuote(q);
      setHistory(h);
    } catch (error) {
      console.error('Price analyst failed to load:', error);
      toast.error('Could not load your catalog for analysis');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const quoteOk = quote?.status === 'ok';
  const rate = quoteOk ? quote.rate : 0;
  const estimate = useMemo(() => estimateInflation(history, quoteOk ? quote.inflationPct : null), [history, quote, quoteOk]);
  const monthlyInflation = inflationOverride ?? estimate.monthlyPct;

  const analyses = useMemo(() => analyzeCatalog(items, {
    rate, monthlyInflationPct: monthlyInflation, months, targetMarginPct: targetMargin,
  }), [items, rate, monthlyInflation, months, targetMargin]);
  const summary = useMemo(() => summarizeCatalog(analyses), [analyses]);

  const canSwitch = (a) => quoteOk && !a.stable && a.price > 0 && a.suggestedStablePrice > 0;
  const switchable = analyses.filter((a) => canSwitch(a) && (a.status === STATUS.LOSING || a.status === STATUS.AT_RISK));

  const setBusy = (id, on) => setBusyIds((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });

  // Moves one item onto ICEC-S at its CURRENT shilling price, so buyers see no change today.
  const protect = async (analysis, { quiet = false } = {}) => {
    const { item } = analysis;
    setBusy(item.id, true);
    try {
      const res = await savePricingMode('catalog', item.id, { priceUnit: PRICE_UNIT_STABLE, stablePrice: analysis.suggestedStablePrice });
      if (!res.saved && res.missingMigration) {
        toast.warn('ICEC-S pricing needs ADD_STABLECOIN_PRICING.sql to be run first.', { autoClose: 8000 });
        return false;
      }
      if (!quiet) toast.success(`"${item.name}" is now priced at ${analysis.suggestedStablePrice} ICEC-S`);
      return true;
    } catch (error) {
      toast.error(`Could not update "${item.name}": ${error.message || 'unknown error'}`);
      return false;
    } finally {
      setBusy(item.id, false);
    }
  };

  const protectOne = async (analysis) => { if (await protect(analysis)) load(); };

  const protectAll = async () => {
    setConfirmAll(false);
    let done = 0;
    for (const analysis of switchable) {
      // eslint-disable-next-line no-await-in-loop
      if (await protect(analysis, { quiet: true })) done += 1; else break;
    }
    if (done) toast.success(`${done} item${done === 1 ? '' : 's'} moved to ICEC-S pricing`);
    load();
  };

  if (loading && !items.length) return <div className="sc-root sc-supplier sc-muted py-12 text-center"><StableCoinStyles />Analysing your catalog…</div>;

  return (
    <div className="sc-root sc-supplier space-y-5 p-3 sm:p-4" data-testid="price-analyst">
      <StableCoinStyles />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="sc-title sc-title-serif flex items-center gap-2 text-xl font-bold"><FiTrendingUp /> Price Analyst</h2>
          <p className="sc-muted mt-1 max-w-2xl text-sm leading-relaxed">
            When the shilling weakens, your costs go up but a price fixed in shillings doesn&apos;t. This shows what that does to each item&apos;s margin,
            and lets you fix a price in ICEC-S — the stable coin, worth one US dollar and never below its inflation-protected value — so it can&apos;t.
          </p>
        </div>
        <button type="button" onClick={load} className="sc-btn inline-flex items-center gap-1.5">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {quote && !quoteOk && (
        <div className="sc-notice p-3 text-sm" role="status">
          {quote.status === 'missing' && 'ICEC-S is not installed on this system yet, so items cannot be moved to stable pricing. Margins below still work.'}
          {quote.status !== 'missing' && 'ICEC-S has no live price right now, so items cannot be moved to stable pricing. Margins below still work; try Refresh shortly.'}
        </div>
      )}

      {/* the market, and the inflation rate everything below is planned around */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="sc-card space-y-3 p-4 lg:col-span-2">
          {quoteOk && (
            <div>
              <p className="sc-muted text-xs uppercase tracking-wide">1 ICEC-S today</p>
              <p className="sc-title sc-title-serif text-2xl font-bold tabular-nums">{ugx(rate)}</p>
              {quote.stale && <p className="sc-pill sc-pill-warn mt-1">Exchange rates are a few hours old</p>}
            </div>
          )}
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="sc-muted">Shilling lost against the dollar</dt>
              <dd className="sc-text text-right font-medium tabular-nums">
                {estimate.measured ? `${pct(estimate.measured.totalChangePct)} in ${estimate.measured.spanDays} days` : 'not enough history yet'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="sc-muted">Uganda inflation (official)</dt>
              <dd className="sc-text text-right font-medium tabular-nums">{estimate.official ? `${pct(estimate.official.annualPct)} a year` : 'not published'}</dd>
            </div>
          </dl>
          <div className="sc-flat p-3">
            <label htmlFor="analyst-inflation" className="sc-text flex items-baseline justify-between gap-2 text-sm font-medium">
              <span>Planning around</span>
              <span className="tabular-nums">{pct(monthlyInflation, 2)} a month <span className="sc-muted font-normal">(≈ {pct((Math.pow(1 + monthlyInflation / 100, 12) - 1) * 100, 0)} a year)</span></span>
            </label>
            <input
              id="analyst-inflation" type="range" min="0" max="5" step="0.1" value={Math.min(monthlyInflation, 5)}
              onChange={(e) => setInflationOverride(Number(e.target.value))} className="sc-range mt-2 w-full"
            />
            <p className="sc-muted mt-1 text-xs">
              {inflationOverride === null
                ? (estimate.source === 'assumed'
                  ? 'There is no live inflation data yet, so this is an assumption. Move the slider to your own figure.'
                  : <>The higher of the two figures above — {SOURCE_TEXT[estimate.source]}.</>)
                : <>Your own figure. <button type="button" className="sc-link font-medium" onClick={() => setInflationOverride(null)}>Use the {estimate.source === 'assumed' ? 'default' : estimate.source} rate</button></>}
            </p>
          </div>
        </div>
        <div className="sc-card p-4 lg:col-span-3">
          <DollarCostChart history={history} />
        </div>
      </div>

      {/* what to look at */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="sc-muted">Look ahead</span>
          <div className="flex gap-1" role="group" aria-label="Months ahead">
            {HORIZONS.map((m) => (
              <button
                key={m} type="button" aria-pressed={months === m} onClick={() => setMonths(m)}
                className={`sc-btn ${months === m ? 'sc-btn-on' : ''}`}
              >{m} mo</button>
            ))}
          </div>
        </div>
        <label className="sc-muted flex items-center gap-2">
          Margin I need
          <input
            type="number" min="0" max="90" step="1" value={targetMargin}
            onChange={(e) => setTargetMargin(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
            className="sc-input w-20 px-2 text-right tabular-nums"
          />%
        </label>
      </div>

      {/* headline numbers */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="sc-card p-3">
            <p className="sc-muted text-xs">Need attention</p>
            <p className="sc-title sc-title-serif text-2xl font-bold tabular-nums">{summary.needAttention}</p>
            <p className="sc-muted text-xs">of {summary.total} items</p>
          </div>
          <div className="sc-card p-3">
            <p className="sc-muted text-xs">Priced in ICEC-S</p>
            <p className="sc-title sc-title-serif text-2xl font-bold tabular-nums">{pct(summary.stableShare, 0)}</p>
            <p className="sc-muted text-xs">of priced items</p>
          </div>
          <div className="sc-card p-3">
            <p className="sc-muted text-xs">Shilling-priced margin</p>
            <p className="sc-title sc-title-serif text-2xl font-bold tabular-nums">{pct(summary.avgMarginExposedNow)}</p>
            <p className="sc-muted text-xs">today, on average</p>
          </div>
          <div className="sc-card p-3">
            <p className="sc-muted text-xs">…in {months} month{months === 1 ? '' : 's'}</p>
            <p className="sc-title sc-title-serif text-2xl font-bold tabular-nums">{pct(summary.avgMarginExposedProjected)}</p>
            <p className="sc-muted text-xs">if those prices stay in shillings</p>
          </div>
        </div>
      )}

      {switchable.length > 0 && (
        <div className="sc-notice flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="sc-notice-text text-sm">
            <b>{switchable.length}</b> item{switchable.length === 1 ? ' is' : 's are'} on course to fall below your {targetMargin}% margin. Price {switchable.length === 1 ? 'it' : 'them'} in ICEC-S at {switchable.length === 1 ? 'its' : 'their'} current price — buyers see no change today.
          </p>
          {confirmAll ? (
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirmAll(false)} className="sc-btn">Cancel</button>
              <button type="button" onClick={protectAll} className="sc-btn sc-btn-primary">Confirm: move {switchable.length}</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmAll(true)} className="sc-btn sc-btn-primary">
              Protect all {switchable.length}
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="sc-card py-14 text-center">
          <p className="sc-text font-medium">Nothing to analyse yet</p>
          <p className="sc-muted mt-1 text-sm">Add items with a cost price to My Catalog and they appear here.</p>
        </div>
      ) : (
        <>
          {/* wide screens: a table */}
          <div className="sc-flat hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="sc-rule sc-muted border-b text-left text-xs">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Margin now → in {months} mo</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">What to do</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((a) => {
                  const { item } = a;
                  return (
                    <tr key={item.id} className="sc-rule sc-text border-b align-top last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="sc-title font-medium">{item.name}</div>
                        <div className="sc-muted text-xs">{item.category}{item.unit ? ` · per ${item.unit}` : ''}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{a.cost > 0 ? ugx(a.cost) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {a.price > 0 ? ugx(a.price) : 'Negotiable'}
                        {a.stable && <div className="sc-good text-xs">{Number(item.stable_price)} ICEC-S</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {a.marginNow === undefined ? '—' : (
                          <>{pct(a.marginNow)} → <b className={a.marginProjected < 0 ? 'sc-bad' : 'sc-title'}>{pct(a.marginProjected)}</b></>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><StatusChip status={a.status} /></td>
                      <td className="sc-muted px-3 py-2.5 text-xs">
                        <ItemAdvice a={a} targetMargin={targetMargin} canSwitch={canSwitch(a)} busy={busyIds.has(item.id)} onProtect={protectOne} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* phones: one card per item, so nothing is hidden off to the side */}
          <ul className="space-y-3 md:hidden">
            {analyses.map((a) => {
              const { item } = a;
              return (
                <li key={item.id} className="sc-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="sc-title font-medium">{item.name}</p>
                      <p className="sc-muted text-xs">{item.category}{item.unit ? ` · per ${item.unit}` : ''}</p>
                    </div>
                    <StatusChip status={a.status} />
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="sc-muted text-xs">Cost</dt><dd className="tabular-nums">{a.cost > 0 ? ugx(a.cost) : '—'}</dd></div>
                    <div>
                      <dt className="sc-muted text-xs">Price</dt>
                      <dd className="tabular-nums">{a.price > 0 ? ugx(a.price) : 'Negotiable'}</dd>
                      {a.stable && <dd className="sc-good text-xs">{Number(item.stable_price)} ICEC-S</dd>}
                    </div>
                    <div>
                      <dt className="sc-muted text-xs">Margin → {months} mo</dt>
                      <dd className="tabular-nums">
                        {a.marginNow === undefined ? '—' : <>{pct(a.marginNow)} → <b className={a.marginProjected < 0 ? 'sc-bad' : 'sc-title'}>{pct(a.marginProjected)}</b></>}
                      </dd>
                    </div>
                  </dl>
                  <div className="sc-muted mt-2 text-xs">
                    <ItemAdvice a={a} targetMargin={targetMargin} canSwitch={canSwitch(a)} busy={busyIds.has(item.id)} onProtect={protectOne} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="sc-muted text-xs">
        How this works: an item&apos;s margin later = its price less its cost grown by the monthly inflation above. A price in ICEC-S grows with it, so its margin stays put; a price in shillings doesn&apos;t. This is arithmetic on the figures above, not a forecast — change the inflation figure to see other cases.
      </p>
    </div>
  );
}
