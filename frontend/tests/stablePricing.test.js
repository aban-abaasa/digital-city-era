import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS, localToStable, stableToLocal, effectiveLocalPrice, needsRepricing, scalePriceTiers,
  measureDepreciation, estimateInflation, analyzeItem, analyzeCatalog, summarizeCatalog,
  DEFAULT_MONTHLY_INFLATION_PCT,
} from '../src/utils/stablePricing.js';

const NOW = new Date(Date.UTC(2026, 9, 15, 12)); // 15 Oct 2026
const hoursAgo = (days) => new Date(NOW.getTime() - days * 86400000).toISOString();
// An ican_stable_history row: market rate `fx`, inflation floor `floor`, and `v` (the price, which can be the pool's share).
const row = (daysAgo, fx, floor = 0, v = null) => ({ t: hoursAgo(daysAgo), fx, floor, v: v ?? Math.max(fx, floor) });

test('conversion round-trips and refuses nonsense input', () => {
  assert.equal(stableToLocal(0.5, 3700), 1850);
  assert.equal(localToStable(1850, 3700), 0.5);
  assert.equal(localToStable(7400, 3700), 2);
  assert.equal(stableToLocal(1, 0), 0);
  assert.equal(localToStable(-5, 3700), 0);
  assert.equal(localToStable('abc', 3700), 0);
});

test('an ICEC-S priced item follows the rate; a shilling-priced one does not', () => {
  const stable = { price_unit: 'ICEC_S', stable_price: 0.5, selling_price: 1850 };
  const plain = { price_unit: 'LOCAL', selling_price: 1850 };
  assert.equal(effectiveLocalPrice(stable, 3700), 1850);
  assert.equal(effectiveLocalPrice(stable, 3848), 1924); // shilling lost 4%, shelf price follows
  assert.equal(effectiveLocalPrice(plain, 3848), 1850);
  // Rate unavailable: fall back to the cached price rather than showing 0.
  assert.equal(effectiveLocalPrice(stable, 0), 1850);
});

test('needsRepricing ignores rounding noise but catches real drift', () => {
  const stable = { price_unit: 'ICEC_S', stable_price: 0.5, selling_price: 1850 };
  assert.equal(needsRepricing(stable, 3700), false);
  assert.equal(needsRepricing(stable, 3704), false); // 0.1% — noise
  assert.equal(needsRepricing(stable, 3848), true);
  assert.equal(needsRepricing({ price_unit: 'LOCAL', selling_price: 100 }, 9999), false);
  assert.equal(needsRepricing({ ...stable, selling_price: 0 }, 3700), true);
  // Catalog rows keep their shilling price in price_per_unit.
  assert.equal(needsRepricing({ price_unit: 'ICEC_S', stable_price: 1, price_per_unit: 3700 }, 4070, 'price_per_unit'), true);
});

test('bulk tiers scale with the item', () => {
  const tiers = [{ min_quantity: 10, unit_price: 2000 }, { min_quantity: 50, unit_price: 1800 }];
  assert.deepEqual(scalePriceTiers(tiers, 1.05).map((t) => t.unit_price), [2100, 1890]);
  assert.deepEqual(scalePriceTiers(tiers, 0), tiers);
  assert.deepEqual(scalePriceTiers(null, 1.1), null);
});

test('with no history and no official figure, inflation is assumed and says so', () => {
  const est = estimateInflation([], null, NOW);
  assert.equal(est.source, 'assumed');
  assert.equal(est.monthlyPct, DEFAULT_MONTHLY_INFLATION_PCT);
  assert.equal(est.measured, null);
  assert.equal(est.official, null);
});

test('too little history to measure: falls back to the official yearly figure', () => {
  const est = estimateInflation([row(3, 3700), row(0, 3710)], 6, NOW); // only 3 days
  assert.equal(est.source, 'official');
  assert.equal(est.measured, null);
  assert.ok(Math.abs(est.annualPct - 6) < 1e-9);
  assert.ok(Math.abs(est.monthlyPct - (Math.pow(1.06, 1 / 12) - 1) * 100) < 1e-9);
});

test('depreciation is measured from the full dollar value, and the pool-share price is ignored', () => {
  // 3700 -> 3811 over 30 days = 3% a month. `v` dips (pool short) at the end; it must not matter.
  const m = measureDepreciation([row(0, 3811, 3600, 3000), row(30, 3700, 3600)], NOW);
  assert.equal(m.spanDays, 30);
  assert.ok(Math.abs(m.monthlyPct - 3) < 0.01, `monthly ${m.monthlyPct}`);
  assert.ok(Math.abs(m.totalChangePct - 3) < 0.01);
});

test('the inflation floor counts: when it is above the market rate, that is the dollar value', () => {
  // market flat at 3700, floor climbs 3700 -> 3811 over 30 days
  const m = measureDepreciation([row(0, 3700, 3811), row(30, 3700, 3700)], NOW);
  assert.ok(Math.abs(m.monthlyPct - 3) < 0.01);
});

test('the planning rate is the higher of official and measured, and says which', () => {
  const hist = [row(0, 3811), row(30, 3700)]; // measured 3%/month
  const bigMeasured = estimateInflation(hist, 6, NOW); // official ~0.49%/month
  assert.equal(bigMeasured.source, 'measured');
  assert.ok(Math.abs(bigMeasured.monthlyPct - 3) < 0.01);
  assert.ok(bigMeasured.official && bigMeasured.measured);

  const calm = estimateInflation([row(0, 3703), row(30, 3700)], 12, NOW); // measured ~0.08%, official ~0.95%
  assert.equal(calm.source, 'official');
  assert.ok(calm.monthlyPct > calm.measured.monthlyPct);
});

test('history outside the window, bad rows, and a falling rate are handled', () => {
  const m = measureDepreciation([
    row(200, 1000), // outside the 90-day window
    row(40, 3700),
    row(10, 3600), // shilling strengthened
    { t: 'garbage', fx: 9999 },
    row(5, 0, 0, 0),
  ], NOW);
  assert.equal(m.points, 2);
  assert.equal(m.monthlyPct, 0, 'never plan around negative inflation');
});

const OPTS = { rate: 3700, monthlyInflationPct: 2, months: 6, targetMarginPct: 15 };

test('margin maths: 6 months at 2% a month', () => {
  const a = analyzeItem({ price_per_unit: 12000, cost_price: 10000 }, OPTS);
  assert.ok(Math.abs(a.marginNow - 16.667) < 0.01);
  const projectedCost = 10000 * Math.pow(1.02, 6);
  assert.ok(Math.abs(a.projectedCost - projectedCost) < 1e-6);
  assert.ok(Math.abs(a.marginProjected - ((12000 - projectedCost) / 12000) * 100) < 1e-9);
  assert.equal(a.status, STATUS.AT_RISK); // ~6.1% < 15% target
  assert.ok(Math.abs(a.erosionPts - (a.marginNow - a.marginProjected)) < 1e-9);

  const stable = analyzeItem({ price_unit: 'ICEC_S', stable_price: 3.24, price_per_unit: 12000, cost_price: 10000 }, OPTS);
  assert.equal(stable.status, STATUS.PROTECTED);
  assert.ok(Math.abs(stable.marginProjected - stable.marginNow) < 1e-9, 'stable price tracks cost, margin holds');
});

test('an item that will sell below cost is flagged LOSING, with a break-even horizon', () => {
  const a = analyzeItem({ price_per_unit: 10500, cost_price: 10000 }, { ...OPTS, months: 12 });
  assert.equal(a.status, STATUS.LOSING);
  assert.ok(Math.abs(a.breakEvenMonths - Math.log(1.05) / Math.log(1.02)) < 1e-9);
  assert.equal(a.repricePrice, Math.ceil((10000 * Math.pow(1.02, 12)) / 0.85));
  assert.equal(a.suggestedStablePrice, 2.8378); // 10500 / 3700, to 4 places
  assert.ok(Math.abs(stableToLocal(a.suggestedStablePrice, 3700) - 10500) <= 1, 'switching to ICEC-S moves the shilling price by under a shilling');
});

test('a fat margin survives the horizon and is HEALTHY', () => {
  assert.equal(analyzeItem({ price_per_unit: 20000, cost_price: 10000 }, OPTS).status, STATUS.HEALTHY);
});

test('missing cost / missing price are reported, not guessed', () => {
  assert.equal(analyzeItem({ price_per_unit: 5000 }, OPTS).status, STATUS.NO_COST);
  assert.equal(analyzeItem({ price_per_unit: null, cost_price: 4000 }, OPTS).status, STATUS.NEGOTIABLE);
  assert.equal(analyzeItem({ price_unit: 'ICEC_S', stable_price: 1, price_per_unit: 3700 }, OPTS).status, STATUS.PROTECTED);
});

test('zero inflation: nothing erodes and no break-even is reported', () => {
  const a = analyzeItem({ price_per_unit: 12000, cost_price: 10000 }, { ...OPTS, monthlyInflationPct: 0 });
  assert.equal(a.marginProjected, a.marginNow);
  assert.equal(a.breakEvenMonths, null);
});

test('catalog is sorted worst-first and summarised', () => {
  const items = [
    { id: 'safe', price_unit: 'ICEC_S', stable_price: 5.4, price_per_unit: 20000, cost_price: 10000 },
    { id: 'fat', price_per_unit: 20000, cost_price: 10000 },
    { id: 'thin', price_per_unit: 10500, cost_price: 10000 },
    { id: 'meh', price_per_unit: 12000, cost_price: 10000 },
    { id: 'nego', price_per_unit: null },
  ];
  const analyses = analyzeCatalog(items, { ...OPTS, months: 12 });
  assert.deepEqual(analyses.map((a) => a.item.id), ['thin', 'meh', 'fat', 'safe', 'nego']);

  const s = summarizeCatalog(analyses);
  assert.equal(s.total, 5);
  assert.equal(s.counts[STATUS.LOSING], 2); // 12 months at 2%: cost +27%, so 'meh' (12000 vs 10000) is under water too
  assert.equal(s.counts[STATUS.HEALTHY], 1);
  assert.equal(s.needAttention, s.counts[STATUS.LOSING] + s.counts[STATUS.AT_RISK]);
  assert.equal(s.stableShare, 25); // 1 of the 4 priced items
  assert.ok(s.avgMarginExposedProjected < s.avgMarginExposedNow);
  assert.ok(s.avgMarginProjected > s.avgMarginExposedProjected, 'the stable item lifts the projected average');
});

test('empty catalog does not divide by zero', () => {
  const s = summarizeCatalog([]);
  assert.equal(s.total, 0);
  assert.equal(s.stableShare, 0);
  assert.equal(s.avgMarginNow, null);
});
