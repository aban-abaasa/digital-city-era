import test from 'node:test';
import assert from 'node:assert/strict';
import { nextBatch, expiredUnits, groupBatchesByProduct } from '../src/utils/productBatches.js';

const NOW = new Date(2026, 9, 7);
const on = (n) => { const d = new Date(2026, 9, 7 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

test('nextBatch is the earliest unexpired batch that still has stock', () => {
  const rows = [
    { batch_number: 'old', expiry_date: on(-3), remaining: 4 },
    { batch_number: 'gone', expiry_date: on(2), remaining: 0 },
    { batch_number: 'soon', expiry_date: on(6), remaining: 3 },
    { batch_number: 'late', expiry_date: on(80), remaining: 9 },
  ];
  assert.equal(nextBatch(rows, NOW).batch_number, 'soon');
  assert.equal(nextBatch([rows[0], rows[1]], NOW), null);
});

test('expiredUnits counts only expired stock still on hand; grouping by product', () => {
  const rows = [
    { product_id: 'p1', expiry_date: on(-1), remaining: 5 },
    { product_id: 'p1', expiry_date: on(-9), remaining: 0 },
    { product_id: 'p2', expiry_date: on(4), remaining: 7 },
  ];
  assert.equal(expiredUnits(rows, NOW), 5);
  assert.deepEqual(Object.keys(groupBatchesByProduct(rows)).sort(), ['p1', 'p2']);
});
