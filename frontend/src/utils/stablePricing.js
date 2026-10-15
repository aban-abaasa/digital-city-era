// Stable-coin (ICEC-S) pricing + inflation analysis.
//
// ICEC-S is IcanEra's stable coin: one ICEC-S is worth one US dollar at the live
// rate, and never less than its start value grown by Uganda's inflation (the ICAN
// project's ICEC_S_IN_SYSTEM_DEPLOY.md). A store admin or a supplier can fix a
// price in ICEC-S instead of shillings, and it keeps its real value while the
// shilling loses it.
//
// The shilling price (products.selling_price / supplier_catalog_items.price_per_unit)
// stays as the *cached* figure every other screen already reads — POS, receipts,
// the supermarket ordering screen — and is recomputed from the ICEC-S price
// whenever the value of one ICEC-S moves, so nothing downstream has to learn
// about stable coins.
//
// Everything here is pure (no Supabase, no React) so the numbers the supplier
// analyst shows can be unit-tested. See tests/stablePricing.test.js.
//
// `rate` below always means "shillings per ICEC-S".

export const PRICE_UNIT_LOCAL = 'LOCAL';
export const PRICE_UNIT_STABLE = 'ICEC_S';

// For the "measured" estimate: how far back to look, and how short a span of
// history is too short to extrapolate from.
export const HISTORY_WINDOW_DAYS = 90;
export const MIN_MEASURE_SPAN_DAYS = 7;

// Used only when neither the official figure nor enough history is available;
// the UI labels it "assumed" so nobody mistakes it for a measurement. ~6% a year.
export const DEFAULT_MONTHLY_INFLATION_PCT = 0.5;

export const DEFAULT_TARGET_MARGIN_PCT = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const roundStable = (value) => Math.round(num(value) * 1e6) / 1e6;

export const localToStable = (local, rate) => (num(local) > 0 && num(rate) > 0 ? roundStable(num(local) / num(rate)) : 0);

export const stableToLocal = (stable, rate) => (num(stable) > 0 && num(rate) > 0 ? Math.round(num(stable) * num(rate)) : 0);

export const isStablePriced = (row) => row?.price_unit === PRICE_UNIT_STABLE && num(row?.stable_price) > 0;

// The shilling price an item should have at `rate`. Items priced in shillings
// are returned unchanged.
export const effectiveLocalPrice = (row, rate, localKey = 'selling_price') => (
  isStablePriced(row) && num(rate) > 0 ? stableToLocal(row.stable_price, rate) : num(row?.[localKey])
);

// True when the cached shilling price has drifted from what the ICEC-S price
// now implies by more than `tolerance` (0.5% by default — avoids rewriting
// every row for rounding noise).
export const needsRepricing = (row, rate, localKey = 'selling_price', tolerance = 0.005) => {
  if (!isStablePriced(row) || !(num(rate) > 0)) return false;
  const stored = num(row[localKey]);
  const target = stableToLocal(row.stable_price, rate);
  if (target <= 0) return false;
  if (stored <= 0) return true;
  return Math.abs(target - stored) / stored > tolerance;
};

// Bulk tiers ride along with the price: when an ICEC-S priced item is repriced
// by a factor, its tier prices move by the same factor.
export const scalePriceTiers = (tiers, factor) => {
  if (!Array.isArray(tiers) || !(factor > 0)) return tiers;
  return tiers.map((tier) => ({ ...tier, unit_price: Math.round(num(tier.unit_price) * factor) }));
};

// ─── Inflation: official figure + what the ICEC-S history shows ──────────────
//
// Two signals, both from ICEC-S itself:
//   official  Uganda's inflation rate (a yearly %), the figure ICEC-S's own
//             floor grows by (quote.inflation_pct).
//   measured  how fast one US dollar got dearer in shillings over the stored
//             hourly history (public.ican_stable_history), i.e. the shilling's
//             actual loss of value, which is what hits the cost of imported
//             stock.
// Margins are planned around the HIGHER of the two — the prudent choice for
// someone whose costs rise with whichever is worse.

const monthlyFromAnnual = (annualPct) => (Math.pow(1 + num(annualPct) / 100, 1 / 12) - 1) * 100;
const annualFromMonthly = (monthlyPct) => (Math.pow(1 + num(monthlyPct) / 100, 12) - 1) * 100;

const toTime = (point) => {
  const t = new Date(point?.t ?? point?.taken_at ?? point?.recorded_on).getTime();
  return Number.isFinite(t) ? t : null;
};

// The full dollar value of one ICEC-S in shillings at that moment: the market
// rate or the inflation floor, whichever was higher (the pool-share discount
// that `v` can carry is deliberately ignored — shelf prices shouldn't follow it).
const pointValue = (p) => {
  const fx = num(p?.fx);
  const floor = num(p?.floor);
  const full = Math.max(fx, floor);
  return full > 0 ? full : num(p?.v);
};

// history: [{ t, v, fx, floor }] in any order (ican_stable_history is newest-first).
export const measureDepreciation = (history, now = new Date()) => {
  const cutoff = now.getTime() - HISTORY_WINDOW_DAYS * DAY_MS;
  const points = (Array.isArray(history) ? history : [])
    .map((p) => ({ t: toTime(p), value: pointValue(p) }))
    .filter((p) => p.t !== null && p.value > 0 && p.t >= cutoff && p.t <= now.getTime())
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return { points: points.length, spanDays: 0, monthlyPct: null };

  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = (last.t - first.t) / DAY_MS;
  if (spanDays < MIN_MEASURE_SPAN_DAYS) return { points: points.length, spanDays, monthlyPct: null };

  const growth = last.value / first.value; // shillings per dollar, end / start
  // ICEC-S's value can't fall (the floor), but a strengthening shilling can make
  // the market rate dip below it; never plan margins around negative inflation.
  const monthly = Math.max(Math.pow(growth, 30 / spanDays) - 1, 0) * 100;
  return {
    points: points.length,
    spanDays: Math.round(spanDays),
    monthlyPct: monthly,
    totalChangePct: (growth - 1) * 100,
  };
};

export const estimateInflation = (history, officialAnnualPct = null, now = new Date()) => {
  const measuredRaw = measureDepreciation(history, now);
  const measured = measuredRaw.monthlyPct === null ? null : {
    ...measuredRaw,
    annualPct: annualFromMonthly(measuredRaw.monthlyPct),
  };
  const officialAnnual = Number(officialAnnualPct);
  const official = Number.isFinite(officialAnnual) && officialAnnual > 0
    ? { annualPct: officialAnnual, monthlyPct: monthlyFromAnnual(officialAnnual) }
    : null;

  let source;
  let monthlyPct;
  if (measured && official) {
    source = measured.monthlyPct >= official.monthlyPct ? 'measured' : 'official';
    monthlyPct = Math.max(measured.monthlyPct, official.monthlyPct);
  } else if (measured) {
    source = 'measured'; monthlyPct = measured.monthlyPct;
  } else if (official) {
    source = 'official'; monthlyPct = official.monthlyPct;
  } else {
    source = 'assumed'; monthlyPct = DEFAULT_MONTHLY_INFLATION_PCT;
  }

  return {
    source,
    monthlyPct,
    annualPct: annualFromMonthly(monthlyPct),
    measured,
    official,
    points: measuredRaw.points,
    spanDays: measuredRaw.spanDays,
  };
};

// ─── Per-item margin analysis ────────────────────────────────────────────────

export const STATUS = {
  PROTECTED: 'protected', // priced in ICEC-S — margin holds as the shilling erodes
  HEALTHY: 'healthy', // priced in shillings but margin survives the horizon
  AT_RISK: 'at_risk', // projected margin falls below the target
  LOSING: 'losing', // projected to sell below replacement cost
  NO_COST: 'no_cost', // can't judge margin without a cost price
  NEGOTIABLE: 'negotiable', // no list price (buyers negotiate)
};

// opts: { rate, monthlyInflationPct, months, targetMarginPct }
// item: a supplier_catalog_items row (price_per_unit / cost_price /
// price_unit / stable_price).
export const analyzeItem = (item, opts) => {
  const rate = num(opts.rate);
  const monthly = Math.max(num(opts.monthlyInflationPct), 0) / 100;
  const months = Math.max(num(opts.months), 0);
  const target = num(opts.targetMarginPct ?? DEFAULT_TARGET_MARGIN_PCT);

  const price = effectiveLocalPrice(item, rate, 'price_per_unit');
  const cost = num(item.cost_price);
  const stable = isStablePriced(item);
  const growth = Math.pow(1 + monthly, months);

  const base = { item, price, cost, stable, growth };

  if (price <= 0) return { ...base, status: STATUS.NEGOTIABLE };
  if (cost <= 0) return { ...base, status: stable ? STATUS.PROTECTED : STATUS.NO_COST };

  const marginNow = ((price - cost) / price) * 100;
  // Replacement cost climbs with inflation. An ICEC-S price climbs with it (the
  // coin's shilling value is what inflation is measured by); a shilling price doesn't.
  const projectedCost = cost * growth;
  const projectedPrice = stable ? price * growth : price;
  const marginProjected = ((projectedPrice - projectedCost) / projectedPrice) * 100;

  let status;
  if (stable) status = STATUS.PROTECTED;
  else if (marginProjected < 0) status = STATUS.LOSING;
  else if (marginProjected < target) status = STATUS.AT_RISK;
  else status = STATUS.HEALTHY;

  // Months until a shilling price stops covering replacement cost.
  let breakEvenMonths = null;
  if (!stable && monthly > 0 && price > cost) {
    breakEvenMonths = Math.log(price / cost) / Math.log(1 + monthly);
  }

  return {
    ...base,
    status,
    marginNow,
    marginProjected,
    erosionPts: marginNow - marginProjected,
    projectedCost,
    breakEvenMonths,
    // What to charge (in shillings) to hold the target margin on the projected
    // cost, and today's price expressed in ICEC-S.
    repricePrice: Math.ceil(projectedCost / (1 - Math.min(target, 95) / 100)),
    // 4 decimals is plenty for a price (under a shilling of rounding at today's rate) and reads cleanly.
    suggestedStablePrice: Number(localToStable(price, rate).toFixed(4)),
  };
};

const RISK_ORDER = {
  [STATUS.LOSING]: 0,
  [STATUS.AT_RISK]: 1,
  [STATUS.NO_COST]: 2,
  [STATUS.HEALTHY]: 3,
  [STATUS.PROTECTED]: 4,
  [STATUS.NEGOTIABLE]: 5,
};

export const analyzeCatalog = (items, opts) => (
  (items || [])
    .map((item) => analyzeItem(item, opts))
    .sort((a, b) => (RISK_ORDER[a.status] - RISK_ORDER[b.status])
      || ((b.erosionPts || 0) - (a.erosionPts || 0)))
);

const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

export const summarizeCatalog = (analyses) => {
  const counts = Object.fromEntries(Object.values(STATUS).map((s) => [s, 0]));
  analyses.forEach((a) => { counts[a.status] += 1; });

  const priced = analyses.filter((a) => a.status !== STATUS.NEGOTIABLE);
  const measurable = analyses.filter((a) => a.marginNow !== undefined);
  const exposed = measurable.filter((a) => !a.stable);

  return {
    total: analyses.length,
    counts,
    stableShare: priced.length ? (priced.filter((a) => a.stable).length / priced.length) * 100 : 0,
    // Average margin across items we can judge, now and at the horizon, for the
    // catalog as it is today (ICEC-S items hold, shilling ones erode)…
    avgMarginNow: mean(measurable.map((a) => a.marginNow)),
    avgMarginProjected: mean(measurable.map((a) => a.marginProjected)),
    // …and the shilling-priced items alone, so the cost of staying in shillings can be shown.
    avgMarginExposedNow: mean(exposed.map((a) => a.marginNow)),
    avgMarginExposedProjected: mean(exposed.map((a) => a.marginProjected)),
    needAttention: counts[STATUS.LOSING] + counts[STATUS.AT_RISK],
  };
};

// ─── Telling the admin what moved ────────────────────────────────────────────
//
// When ICEC-S moves, the shilling price of every product priced in it moves too.
// These turn the stored change rows ({ product_name, old_price, new_price,
// changed_at, seen_at }) into what the admin reads.

export const changePct = (oldPrice, newPrice) => (
  num(oldPrice) > 0 ? ((num(newPrice) - num(oldPrice)) / num(oldPrice)) * 100 : null
);

// A product on an expiry offer is deliberately left alone (repricing it would end
// the offer), so it can't be moved onto — or repriced by — the stable coin.
export const isOnOffer = (row) => row?.clearance_original_price !== null
  && row?.clearance_original_price !== undefined && num(row.clearance_original_price) > 0;

// Net move per product: where it started (the first change's old price) against where
// it ended up (the last change's new price), so a product that moved twice reads once.
// Rows are taken oldest-first by changed_at when they have it, else in the order given.
export const netChangesByProduct = (changes) => {
  const rows = (Array.isArray(changes) ? changes : []).filter((c) => num(c?.old_price) > 0);
  const timed = rows.every((c) => Number.isFinite(Date.parse(c?.changed_at)));
  const ordered = timed ? [...rows].sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at)) : rows;
  const byProduct = new Map();
  ordered.forEach((c) => {
    const key = c.product_id ?? c.product_name;
    const entry = byProduct.get(key);
    if (entry) entry.new_price = num(c.new_price);
    else byProduct.set(key, { product_id: c.product_id, product_name: c.product_name, old_price: num(c.old_price), new_price: num(c.new_price) });
  });
  return [...byProduct.values()].map((e) => ({ ...e, pct: changePct(e.old_price, e.new_price) }));
};

export const summarizeChanges = (changes) => {
  const net = netChangesByProduct(changes).filter((e) => e.new_price !== e.old_price);
  const pcts = net.map((e) => e.pct).filter((p) => p !== null);
  return {
    products: net.length,
    up: net.filter((e) => e.new_price > e.old_price).length,
    down: net.filter((e) => e.new_price < e.old_price).length,
    avgPct: pcts.length ? pcts.reduce((sum, p) => sum + p, 0) / pcts.length : null,
    net,
  };
};

// One sentence for a toast / banner. `rate` is shillings per ICEC-S, when known.
export const describeChanges = (changes, rate = null) => {
  const s = summarizeChanges(changes);
  if (!s.products) return '';
  const direction = s.up && !s.down ? 'up' : (s.down && !s.up ? 'down' : 'changed');
  const avg = s.avgPct === null ? '' : ` (${s.avgPct >= 0 ? '+' : ''}${s.avgPct.toFixed(1)}% on average)`;
  const why = rate > 0 ? ` because 1 ICEC-S is now UGX ${Math.round(rate).toLocaleString()}` : ' with ICEC-S';
  return `${s.products} shilling price${s.products === 1 ? '' : 's'} went ${direction}${avg}${why}.`;
};
