/**
 * Stable-coin (ICEC-S) pricing service — the only place this app talks to the
 * ICEC-S database functions (installed from the ICAN project in the shared
 * Supabase) and to the price_unit / stable_price columns
 * (backend/database/migrations/ADD_STABLECOIN_PRICING.sql).
 *
 *  - getStableQuote     what one ICEC-S is worth in shillings right now, the official inflation figure, and whether the rates are fresh
 *  - getStableHistory   its stored hourly value, for measuring how fast the shilling is losing value
 *  - savePricingMode    remember that an item is priced in ICEC-S (or back in shillings)
 *  - repriceStableItems recompute the shilling price of one store's / one supplier's ICEC-S priced items
 *
 * Anything that isn't installed yet is reported ({ status: 'missing' }, { missingMigration: true })
 * instead of thrown, so every screen keeps working in plain shillings and can say why.
 */

import { supabase } from './supabase';
import {
  PRICE_UNIT_LOCAL, PRICE_UNIT_STABLE, needsRepricing, stableToLocal, scalePriceTiers,
} from '../utils/stablePricing';

export const PRICED_KINDS = {
  // A store's product: the shilling price POS sells at lives in selling_price.
  product: { table: 'products', localKey: 'selling_price', scopeKey: 'supermarket_id' },
  // A supplier's catalog item: what supermarkets see when they order.
  catalog: { table: 'supplier_catalog_items', localKey: 'price_per_unit', scopeKey: 'supplier_user_id' },
};

const QUOTE_TTL_MS = 60_000;
const REPRICE_THROTTLE_MS = 10 * 60_000;

const isMissingColumn = (error) => /column|schema cache/i.test(error?.message || '');
const isMissingFunction = (error) => (
  error?.code === '42883' || error?.code === 'PGRST202' || /could not find the function|function .* does not exist/i.test(error?.message || '')
);

let quoteCache = { at: 0, value: null };

/**
 * { status: 'ok', rate, inflationPct, stale, updatedAt, protectedByFloor, floorUgx, poolShort }
 *   | { status: 'missing' }      ICEC-S isn't installed in this database
 *   | { status: 'unavailable' }  installed, but no live exchange rate right now
 *   | { status: 'error', message }
 *
 * `rate` is shillings per ICEC-S at its FULL dollar value (dollar_ugx), not the
 * pool's share: if the pool is ever short, ICEC-S holders share that, but a
 * shelf price shouldn't drop because of it. Older installs without dollar_ugx
 * fall back to unit_ugx.
 */
export const getStableQuote = async ({ force = false } = {}) => {
  if (!force && quoteCache.value && Date.now() - quoteCache.at < QUOTE_TTL_MS) return quoteCache.value;

  const { data, error } = await supabase.rpc('ican_stable_quote');
  if (error) return isMissingFunction(error) ? { status: 'missing' } : { status: 'error', message: error.message };
  if (!data?.available) return { status: 'unavailable' };

  const rate = Number(data.dollar_ugx) > 0 ? Number(data.dollar_ugx) : Number(data.unit_ugx);
  if (!(rate > 0)) return { status: 'unavailable' };

  const inflation = Number(data.inflation_pct);
  const value = {
    status: 'ok',
    rate,
    inflationPct: Number.isFinite(inflation) && inflation > 0 ? inflation : null,
    stale: Boolean(data.rates_stale),
    updatedAt: data.rates_updated_at || null,
    protectedByFloor: Boolean(data.protected),
    floorUgx: Number(data.floor_ugx) || null,
    poolShort: Boolean(data.pool_short),
  };
  quoteCache = { at: Date.now(), value };
  return value;
};

/** [{ t, v, fx, floor }] newest first; [] when ICEC-S isn't installed or the call fails. */
export const getStableHistory = async (limit = 2000) => {
  const { data, error } = await supabase.rpc('ican_stable_history', { p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return data;
};

/**
 * Remember how one item is priced. `priceUnit` PRICE_UNIT_STABLE needs a
 * stablePrice; PRICE_UNIT_LOCAL clears it. Returns { saved: true } or, when the
 * migration hasn't been run, { saved: false, missingMigration: true } so the
 * caller can tell the user instead of silently dropping the choice.
 */
export const savePricingMode = async (kind, id, { priceUnit, stablePrice = null }) => {
  const spec = PRICED_KINDS[kind];
  if (!spec || !id) throw new Error('Nothing to save the price mode on');

  const stable = priceUnit === PRICE_UNIT_STABLE;
  if (stable && !(Number(stablePrice) > 0)) throw new Error('Enter a price in ICEC-S first');

  const patch = stable
    ? { price_unit: PRICE_UNIT_STABLE, stable_price: Number(stablePrice), stable_priced_at: new Date().toISOString() }
    : { price_unit: PRICE_UNIT_LOCAL, stable_price: null, stable_priced_at: null };

  const { error } = await supabase.from(spec.table).update(patch).eq('id', id);
  if (error) {
    if (isMissingColumn(error)) return { saved: false, missingMigration: true };
    throw error;
  }
  return { saved: true };
};

const inChunks = async (items, size, worker) => {
  for (let i = 0; i < items.length; i += size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(items.slice(i, i + size).map(worker));
  }
};

/**
 * Brings the cached shilling price of the ICEC-S priced items of ONE store
 * (kind 'product', scopeId = supermarket id) or ONE supplier (kind 'catalog',
 * scopeId = supplier user id) up to today's value of ICEC-S. Always scoped:
 * there's no way to call it for "everyone".
 *
 * Skips (and says why) rather than guessing when ICEC-S has no live price or its
 * rates are stale — the same rule the server-side repricer follows.
 */
export const repriceStableItems = async (kind, scopeId, { quote } = {}) => {
  const spec = PRICED_KINDS[kind];
  if (!spec) throw new Error(`Unknown kind: ${kind}`);
  if (!scopeId) throw new Error('A store or supplier is required to reprice');

  const q = quote || await getStableQuote();
  if (q.status !== 'ok') return { skipped: q.status, checked: 0, updated: 0 };
  if (q.stale) return { skipped: 'stale', checked: 0, updated: 0, rate: q.rate };

  const extra = kind === 'catalog' ? 'price_tiers' : 'cost_price';
  const { data: rows, error } = await supabase
    .from(spec.table)
    .select(`id, price_unit, stable_price, ${spec.localKey}, ${extra}`)
    .eq(spec.scopeKey, scopeId)
    .eq('price_unit', PRICE_UNIT_STABLE);
  if (error) {
    if (isMissingColumn(error)) return { skipped: 'missing', checked: 0, updated: 0 };
    throw error;
  }

  const due = (rows || []).filter((row) => needsRepricing(row, q.rate, spec.localKey));
  let updated = 0;
  await inChunks(due, 10, async (row) => {
    const target = stableToLocal(row.stable_price, q.rate);
    const patch = { [spec.localKey]: target, stable_priced_at: new Date().toISOString() };
    if (kind === 'catalog') {
      const before = Number(row[spec.localKey]) || 0;
      if (before > 0) patch.price_tiers = scalePriceTiers(row.price_tiers, target / before);
    } else if (Number(row.cost_price) > 0) {
      patch.markup_percentage = Number(((target - row.cost_price) / row.cost_price * 100).toFixed(2));
    }
    const { error: updateError } = await supabase.from(spec.table).update(patch).eq('id', row.id);
    if (updateError) throw updateError;
    updated += 1;
  });

  return { checked: (rows || []).length, updated, rate: q.rate };
};

const lastRun = new Map();

/**
 * Fire-and-forget reprice for when a portal opens: at most once per scope per
 * 10 minutes, never throws. Resolves to the reprice result (or null if throttled
 * or failed) so a caller can reload its list when something changed.
 */
export const refreshStablePricesQuietly = async (kind, scopeId) => {
  if (!scopeId) return null;
  const key = `${kind}:${scopeId}`;
  if (Date.now() - (lastRun.get(key) || 0) < REPRICE_THROTTLE_MS) return null;
  lastRun.set(key, Date.now());
  try {
    return await repriceStableItems(kind, scopeId);
  } catch (error) {
    lastRun.delete(key);
    console.warn('Stable price refresh failed:', error?.message || error);
    return null;
  }
};

export default {
  getStableQuote, getStableHistory, savePricingMode, repriceStableItems, refreshStablePricesQuietly,
};
