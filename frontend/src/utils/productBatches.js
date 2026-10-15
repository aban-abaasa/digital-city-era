// Helpers for the store admin's per-product batch tracking.
// Rows come from the product_batch_overview() RPC
// (backend/database/migrations/ADD_PRODUCT_BATCH_EXPIRY_TRACKING.sql).

import { getExpiryStatus } from './productExpiry.js';

export const groupBatchesByProduct = (rows) => {
  const map = {};
  (rows || []).forEach((row) => {
    (map[row.product_id] ||= []).push(row);
  });
  return map;
};

// The batch that will be sold first: earliest expiry that still has stock and
// has not expired. Mirrors sync_product_expiry_from_batches() in the database.
export const nextBatch = (rows, now = new Date()) =>
  (rows || [])
    .filter((row) => Number(row.remaining) > 0 && getExpiryStatus(row.expiry_date, now).days >= 0)
    .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)))[0] || null;

// Units of expired stock still sitting in expired batches (to pull from the shelf).
export const expiredUnits = (rows, now = new Date()) =>
  (rows || [])
    .filter((row) => Number(row.remaining) > 0 && getExpiryStatus(row.expiry_date, now).days < 0)
    .reduce((sum, row) => sum + Number(row.remaining), 0);

export const isMissingBatchSetup = (error) =>
  error?.code === 'PGRST202' || error?.code === '42883' || error?.code === '42P01' || error?.code === 'PGRST205';

// Batches a cashier can sell right now: on sale, not expired, units left.
export const sellableBatches = (rows, now = new Date()) =>
  (rows || []).filter((row) =>
    row.status === 'active'
    && Number(row.remaining) > 0
    && getExpiryStatus(row.expiry_date, now).days >= 0);

// Short name that tells two batches of one product apart.
export const batchLabel = (batch) => (batch?.quality || '').trim() || `Batch ${batch?.batch_number}`;
