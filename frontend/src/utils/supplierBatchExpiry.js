// Batch expiry + dynamic discount rules for supplier catalog items.
// Backed by supplier_catalog_batches (backend/ADD_SUPPLIER_CATALOG_BATCH_EXPIRY.sql).
//
// The discount is never stored for 'auto' batches — it is worked out from the
// days left every time it is read, so it deepens by itself as the date nears
// and the supplier never has to re-publish a price. Supplier screens and the
// supermarket's ordering screen both call these helpers, so they always agree.

import { getExpiryStatus, priceAfterDiscount } from './productExpiry.js';

export { formatExpiryDate } from './productExpiry.js';

// Nearest first. Anything further out than the last row is not discounted.
export const AUTO_DISCOUNT_SCHEDULE = [
  { withinDays: 3, percent: 50 },
  { withinDays: 7, percent: 30 },
  { withinDays: 14, percent: 20 },
  { withinDays: 30, percent: 10 },
];

export const autoDiscountPercent = (days) => {
  if (days === null || days === undefined || days < 0) return 0;
  const tier = AUTO_DISCOUNT_SCHEDULE.find((row) => days <= row.withinDays);
  return tier ? tier.percent : 0;
};

// Flag window: a batch is "flagged" once it is within this many days of expiry.
export const FLAG_WITHIN_DAYS = 30;

// The percentage a batch is discounted by today (0 = full price).
export const batchDiscountPercent = (batch, now = new Date()) => {
  const { days } = getExpiryStatus(batch?.expiry_date, now);
  if (days === null || days < 0) return 0;
  if (batch.discount_mode === 'none') return 0;
  if (batch.discount_mode === 'manual') return Number(batch.discount_percent) || 0;
  return autoDiscountPercent(days);
};

// Everything the UI needs to know about one batch, as of today.
export const describeBatch = (batch, now = new Date()) => {
  const status = getExpiryStatus(batch.expiry_date, now);
  const percent = batchDiscountPercent(batch, now);
  return {
    batch,
    status,
    expired: status.key === 'expired',
    flagged: status.days !== null && status.days <= FLAG_WITHIN_DAYS,
    percent,
  };
};

// What a buyer is offered for a catalog item: the batch that will be shipped
// first (earliest expiry that has stock and is not already expired) and the
// discount on it. Expired batches are never sellable.
export const catalogItemOffer = (item, batches, now = new Date()) => {
  const rows = (batches || []).map((batch) => describeBatch(batch, now));
  const sellable = rows
    .filter((row) => !row.expired && Number(row.batch.quantity) > 0)
    .sort((a, b) => a.status.days - b.status.days);
  const first = sellable[0] || null;
  const base = Number(item?.price_per_unit) || 0;
  const percent = first ? first.percent : 0;
  return {
    rows,
    first,
    percent,
    basePrice: base,
    price: percent > 0 && base > 0 ? priceAfterDiscount(base, percent) : base,
    onOffer: percent > 0 && base > 0,
    expiredCount: rows.filter((row) => row.expired).length,
    flaggedCount: rows.filter((row) => row.flagged && !row.expired).length,
  };
};

export const groupBatchesByItem = (batches) => {
  const map = {};
  (batches || []).forEach((batch) => {
    (map[batch.catalog_item_id] ||= []).push(batch);
  });
  return map;
};

export const isMissingBatchTable = (error) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || /supplier_catalog_batches/i.test(error?.message || '');
