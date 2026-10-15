/**
 * Stable-coin (ICEC-S) pricing service — the only place this app talks to the
 * ICEC-S database functions (installed from the ICAN project in the shared
 * Supabase) and to the price_unit / stable_price columns
 * (backend/database/migrations/ADD_STABLECOIN_PRICING.sql).
 *
 *  - getStableQuote     what one ICEC-S is worth in shillings right now, the official inflation figure, and whether the rates are fresh
 *  - getStableHistory   its stored hourly value, for measuring how fast the shilling is losing value
 *  - savePricingMode    remember that an item is priced in ICEC-S (or back in shillings)
 *  - repriceStableItems recompute the shilling price of one store's / one supplier's ICEC-S priced items, and log what moved
 *  - listPricing / applyStablePricing / removeStablePricing / getPriceChanges / countUnseenChanges / markPriceChangesSeen
 *                       what the Stable price screen needs, for a store's products or a supplier's catalog alike
 *
 * Anything that isn't installed yet is reported ({ status: 'missing' }, { missingMigration: true })
 * instead of thrown, so every screen keeps working in plain shillings and can say why.
 */

import { supabase } from './supabase';
import {
  PRICE_UNIT_LOCAL, PRICE_UNIT_STABLE, needsRepricing, stableToLocal, localToStable, scalePriceTiers, isOnOffer,
} from '../utils/stablePricing';

export const PRICED_KINDS = {
  // A store's product: the shilling price POS sells at lives in selling_price.
  product: {
    table: 'products', localKey: 'selling_price', scopeKey: 'supermarket_id',
    log: { table: 'stable_price_changes', scopeKey: 'supermarket_id', itemKey: 'product_id', nameKey: 'product_name' },
  },
  // A supplier's catalog item: what supermarkets see when they order.
  catalog: {
    table: 'supplier_catalog_items', localKey: 'price_per_unit', scopeKey: 'supplier_user_id',
    log: { table: 'supplier_stable_price_changes', scopeKey: 'supplier_user_id', itemKey: 'catalog_item_id', nameKey: 'item_name' },
  },
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

// Products carry an optional clearance_original_price (an expiry offer is active when it is set).
// A database without that migration has no such column, so every read tries with it first.
const PRODUCT_COLUMNS = 'id, name, supermarket_id, price_unit, stable_price, selling_price, cost_price';
// price_tiers comes from a different, optional migration, so it is only asked for when repricing needs it.
const CATALOG_COLUMNS = 'id, name, unit, category, supplier_user_id, price_unit, stable_price, price_per_unit';

// Reads one scope's items; `build` adds filters/order. A product query is retried without
// clearance_original_price, and a catalog query without price_tiers, on a database that lacks them.
const selectItems = async (kind, scopeId, build, { tiers = false } = {}) => {
  const spec = PRICED_KINDS[kind];
  if (kind === 'catalog') {
    let found = await build(supabase.from(spec.table).select(tiers ? `${CATALOG_COLUMNS}, price_tiers` : CATALOG_COLUMNS)).eq(spec.scopeKey, scopeId);
    if (tiers && found.error && isMissingColumn(found.error)) {
      found = await build(supabase.from(spec.table).select(CATALOG_COLUMNS)).eq(spec.scopeKey, scopeId);
    }
    return found;
  }
  let res = await build(supabase.from(spec.table).select(`${PRODUCT_COLUMNS}, clearance_original_price`)).eq(spec.scopeKey, scopeId);
  if (res.error && isMissingColumn(res.error)) {
    res = await build(supabase.from(spec.table).select(PRODUCT_COLUMNS)).eq(spec.scopeKey, scopeId);
  }
  return res;
};

// One shape for the screen whichever kind it is showing: `price` is the shilling price.
const normalizeItem = (kind, row) => ({
  id: row.id,
  name: row.name,
  unit: row.unit || null,
  price: Number(row[PRICED_KINDS[kind].localKey]) || 0,
  price_unit: row.price_unit || PRICE_UNIT_LOCAL,
  stable_price: row.stable_price ?? null,
  clearance_original_price: row.clearance_original_price ?? null,
});

// Best effort: the log is for telling the owner, so failing to write it must never undo a price change.
const logPriceChanges = async (kind, scopeId, changes, rate) => {
  if (!changes.length) return;
  const { table, scopeKey, itemKey, nameKey } = PRICED_KINDS[kind].log;
  const { error } = await supabase.from(table).insert(changes.map((c) => ({
    [scopeKey]: scopeId,
    [itemKey]: c.product_id,
    [nameKey]: c.product_name,
    old_price: c.old_price,
    new_price: c.new_price,
    stable_price: c.stable_price,
    rate_ugx: rate,
  })));
  if (error && !isMissingColumn(error) && !/relation .* does not exist|schema cache/i.test(error.message || '')) {
    console.warn('Could not record the price change log:', error.message);
  }
};

/**
 * Brings the cached shilling price of the ICEC-S priced items of ONE store
 * (kind 'product', scopeId = supermarket id) or ONE supplier (kind 'catalog',
 * scopeId = supplier user id) up to today's value of ICEC-S. Always scoped:
 * there's no way to call it for "everyone".
 *
 * Skips (and says why) rather than guessing when ICEC-S has no live price or its
 * rates are stale — the same rule the server-side repricer follows. A product on
 * an expiry offer is left alone: writing its selling_price would end the offer.
 *
 * `changes` lists each item whose shilling price moved, in the shape of a log row
 * ([{ product_id, product_name, old_price, new_price, stable_price }], whichever kind)
 * so it feeds describeChanges() directly; the same moves are written to the kind's
 * change log so the owner is told about them.
 */
export const repriceStableItems = async (kind, scopeId, { quote } = {}) => {
  const spec = PRICED_KINDS[kind];
  if (!spec) throw new Error(`Unknown kind: ${kind}`);
  if (!scopeId) throw new Error('A store or supplier is required to reprice');

  const q = quote || await getStableQuote();
  if (q.status !== 'ok') return { skipped: q.status, checked: 0, updated: 0, changes: [] };
  if (q.stale) return { skipped: 'stale', checked: 0, updated: 0, rate: q.rate, changes: [] };

  const { data, error } = await selectItems(kind, scopeId, (query) => query.eq('price_unit', PRICE_UNIT_STABLE), { tiers: true });
  if (error) {
    if (isMissingColumn(error)) return { skipped: 'missing', checked: 0, updated: 0, changes: [] };
    throw error;
  }
  const rows = data || [];

  const onOffer = rows.filter(isOnOffer);
  const due = rows.filter((row) => !isOnOffer(row) && needsRepricing(row, q.rate, spec.localKey));
  const changes = [];
  let updated = 0;
  await inChunks(due, 10, async (row) => {
    const target = stableToLocal(row.stable_price, q.rate);
    const before = Number(row[spec.localKey]) || 0;
    const patch = { [spec.localKey]: target, stable_priced_at: new Date().toISOString() };
    if (kind === 'catalog') {
      if (before > 0 && Array.isArray(row.price_tiers)) patch.price_tiers = scalePriceTiers(row.price_tiers, target / before);
    } else if (Number(row.cost_price) > 0) {
      patch.markup_percentage = Number(((target - row.cost_price) / row.cost_price * 100).toFixed(2));
    }
    const { error: updateError } = await supabase.from(spec.table).update(patch).eq('id', row.id);
    if (updateError) throw updateError;
    updated += 1;
    // An item that had no price yet is being set, not changed: nothing to tell the owner.
    if (before > 0) changes.push({ product_id: row.id, product_name: row.name, old_price: before, new_price: target, stable_price: Number(row.stable_price) });
  });

  await logPriceChanges(kind, scopeId, changes, q.rate);

  return { checked: rows.length, updated, rate: q.rate, changes, onOffer: onOffer.length };
};

// ─── The stable-price screen (a store's products, or a supplier's catalog) ───

/** { rows, stableReady }: the scope's active items. stableReady is false on a database without the migration. */
export const listPricing = async (kind, scopeId) => {
  const spec = PRICED_KINDS[kind];
  if (!spec) throw new Error(`Unknown kind: ${kind}`);
  if (!scopeId) throw new Error('A store or supplier is required');
  const { data, error } = await selectItems(kind, scopeId, (query) => (kind === 'product' ? query.eq('is_active', true) : query).order('name'));
  if (!error) return { rows: (data || []).map((r) => normalizeItem(kind, r)), stableReady: true };
  if (!isMissingColumn(error)) throw error;
  // No price_unit / stable_price columns yet: still list the items, just without stable pricing.
  const base = kind === 'product' ? 'id, name, selling_price' : 'id, name, unit, price_per_unit';
  let fallback = supabase.from(spec.table).select(base).eq(spec.scopeKey, scopeId);
  if (kind === 'product') fallback = fallback.eq('is_active', true);
  const res = await fallback.order('name');
  if (res.error) throw res.error;
  return { rows: (res.data || []).map((r) => normalizeItem(kind, r)), stableReady: false };
};

/**
 * Puts the given items on the stable coin AT THEIR CURRENT SHILLING PRICE, so
 * nothing changes on the shelf today; from now on the shilling price follows ICEC-S.
 * Items with no price, or on an expiry offer (whose price is a temporary discount,
 * not their real price), are skipped and counted. `items` are normalised rows (`price`).
 */
export const applyStablePricing = async (kind, scopeId, items, { quote } = {}) => {
  const spec = PRICED_KINDS[kind];
  if (!spec) throw new Error(`Unknown kind: ${kind}`);
  if (!scopeId) throw new Error('A store or supplier is required');
  const q = quote || await getStableQuote();
  if (q.status !== 'ok') throw new Error('ICEC-S has no live price right now');

  const eligible = [];
  let skippedOffer = 0;
  let skippedNoPrice = 0;
  (items || []).forEach((p) => {
    if (isOnOffer(p)) skippedOffer += 1;
    else if (!(Number(p.price) > 0)) skippedNoPrice += 1;
    else eligible.push(p);
  });

  let applied = 0;
  await inChunks(eligible, 10, async (p) => {
    const stablePrice = Number(localToStable(p.price, q.rate).toFixed(4));
    const { error } = await supabase.from(spec.table)
      .update({ price_unit: PRICE_UNIT_STABLE, stable_price: stablePrice, stable_priced_at: new Date().toISOString() })
      .eq('id', p.id).eq(spec.scopeKey, scopeId);
    if (error) throw error;
    applied += 1;
  });
  return { applied, skippedOffer, skippedNoPrice, rate: q.rate };
};

/** Takes the given items off the stable coin; each keeps its current shilling price. */
export const removeStablePricing = async (kind, scopeId, ids) => {
  const spec = PRICED_KINDS[kind];
  if (!spec) throw new Error(`Unknown kind: ${kind}`);
  if (!scopeId) throw new Error('A store or supplier is required');
  const list = (ids || []).filter(Boolean);
  if (!list.length) return { removed: 0 };
  const { error } = await supabase.from(spec.table)
    .update({ price_unit: PRICE_UNIT_LOCAL, stable_price: null, stable_priced_at: null })
    .in('id', list).eq(spec.scopeKey, scopeId);
  if (error) throw error;
  return { removed: list.length };
};

/** The scope's shilling-price changes caused by ICEC-S, newest first, as { id, product_id, product_name, ... }. { rows, missing } */
export const getPriceChanges = async (kind, scopeId, { limit = 60 } = {}) => {
  const spec = PRICED_KINDS[kind];
  if (!spec || !scopeId) return { rows: [], missing: false };
  const { table, scopeKey, itemKey, nameKey } = spec.log;
  const { data, error } = await supabase.from(table)
    .select(`id, ${itemKey}, ${nameKey}, old_price, new_price, stable_price, rate_ugx, changed_at, seen_at`)
    .eq(scopeKey, scopeId).order('changed_at', { ascending: false }).limit(limit);
  if (error) return { rows: [], missing: true };
  return {
    rows: (data || []).map((r) => ({
      id: r.id, product_id: r[itemKey], product_name: r[nameKey], old_price: r.old_price, new_price: r.new_price,
      stable_price: r.stable_price, rate_ugx: r.rate_ugx, changed_at: r.changed_at, seen_at: r.seen_at,
    })),
    missing: false,
  };
};

/** How many price changes the owner hasn't acknowledged yet (0 when the log isn't installed). */
export const countUnseenChanges = async (kind, scopeId) => {
  const spec = PRICED_KINDS[kind];
  if (!spec || !scopeId) return 0;
  const { table, scopeKey } = spec.log;
  const { count, error } = await supabase.from(table)
    .select('id', { count: 'exact', head: true }).eq(scopeKey, scopeId).is('seen_at', null);
  return error ? 0 : (count || 0);
};

export const markPriceChangesSeen = async (kind, scopeId) => {
  const spec = PRICED_KINDS[kind];
  if (!spec || !scopeId) return;
  const { table, scopeKey } = spec.log;
  const { error } = await supabase.from(table)
    .update({ seen_at: new Date().toISOString() }).eq(scopeKey, scopeId).is('seen_at', null);
  if (error) throw error;
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
  listPricing, applyStablePricing, removeStablePricing, getPriceChanges, countUnseenChanges, markPriceChangesSeen,
};
