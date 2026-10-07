import test from 'node:test';
import assert from 'node:assert/strict';
import { autoDiscountPercent, batchDiscountPercent, catalogItemOffer } from '../src/utils/supplierBatchExpiry.js';

const NOW = new Date(2026, 9, 7); // 7 Oct 2026, local
const on = (offsetDays) => {
  const d = new Date(2026, 9, 7 + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('auto schedule deepens as expiry nears and stops at 30 days / after expiry', () => {
  assert.deepEqual([45, 30, 15, 14, 8, 7, 4, 3, 0, -1].map(autoDiscountPercent), [0, 10, 10, 20, 20, 30, 30, 50, 50, 0]);
});

test('same batch gets a bigger discount as days pass, with no re-publish', () => {
  const batch = { expiry_date: on(10), discount_mode: 'auto', quantity: 5 };
  assert.equal(batchDiscountPercent(batch, NOW), 20);
  assert.equal(batchDiscountPercent(batch, new Date(2026, 9, 12)), 30); // 5 days left
  assert.equal(batchDiscountPercent(batch, new Date(2026, 9, 16)), 50); // 1 day left
});

test('changing the expiry date changes the discount; manual/none modes respected', () => {
  assert.equal(batchDiscountPercent({ expiry_date: on(2), discount_mode: 'auto' }, NOW), 50);
  assert.equal(batchDiscountPercent({ expiry_date: on(60), discount_mode: 'auto' }, NOW), 0);
  assert.equal(batchDiscountPercent({ expiry_date: on(2), discount_mode: 'none' }, NOW), 0);
  assert.equal(batchDiscountPercent({ expiry_date: on(40), discount_mode: 'manual', discount_percent: 15 }, NOW), 15);
  assert.equal(batchDiscountPercent({ expiry_date: on(-1), discount_mode: 'manual', discount_percent: 15 }, NOW), 0);
});

test('buyer offer uses earliest sellable batch and never an expired or empty one', () => {
  const item = { price_per_unit: 10000 };
  const batches = [
    { id: 'a', expiry_date: on(-2), quantity: 9, discount_mode: 'auto' },  // expired
    { id: 'b', expiry_date: on(5), quantity: 0, discount_mode: 'auto' },   // empty
    { id: 'c', expiry_date: on(6), quantity: 4, discount_mode: 'auto' },   // 30% off
    { id: 'd', expiry_date: on(90), quantity: 50, discount_mode: 'auto' },
  ];
  const offer = catalogItemOffer(item, batches, NOW);
  assert.equal(offer.first.batch.id, 'c');
  assert.equal(offer.percent, 30);
  assert.equal(offer.price, 7000);
  assert.equal(offer.expiredCount, 1);
  assert.equal(catalogItemOffer(item, [batches[0]], NOW).first, null);
  assert.equal(catalogItemOffer(item, [], NOW).price, 10000);
});
