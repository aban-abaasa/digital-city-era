import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wholesaleFromPercent,
  percentFromWholesale,
  withSellingPrice,
  withWholesalePrice,
  withDiscountPercent,
  impliedDiscountPercent
} from '../src/utils/wholesalePricing.js';

test('wholesale price from a percentage of the selling price', () => {
  assert.equal(wholesaleFromPercent(2000, 10), 1800);
  assert.equal(wholesaleFromPercent(2000, 0), 2000);
  assert.equal(wholesaleFromPercent(2000, 150), 0, 'capped at 100%');
  assert.equal(wholesaleFromPercent(0, 10), 0);
  assert.equal(wholesaleFromPercent(1999, 12.5), 1749);
});

test('percentage implied by the two prices', () => {
  assert.equal(percentFromWholesale(2000, 1800), 10);
  assert.equal(percentFromWholesale(3333, 3000), 9.99);
  assert.equal(percentFromWholesale(2000, 0), 0);
  assert.equal(percentFromWholesale(0, 1800), 0);
  assert.equal(percentFromWholesale(1000, 1500), 0, 'a wholesale price above the selling price is not a discount');
});

test('typing a wholesale price fills the percentage in', () => {
  assert.deepEqual(withWholesalePrice({ selling_price: 2000 }, '1700'), { wholesale_price: 1700, wholesale_discount_percent: 15 });
});

test('typing a percentage fills the wholesale price in', () => {
  assert.deepEqual(withDiscountPercent({ selling_price: 2000 }, 15), { wholesale_discount_percent: 15, wholesale_price: 1700 });
  assert.deepEqual(withDiscountPercent({ selling_price: 2000 }, -5), { wholesale_discount_percent: 0, wholesale_price: 2000 });
});

test('with a percentage set, a new selling price carries the wholesale price with it', () => {
  assert.deepEqual(
    withSellingPrice({ selling_price: 2000, wholesale_price: 1700, wholesale_discount_percent: 15 }, 2400),
    { selling_price: 2400, wholesale_price: 2040 }
  );
});

test('with no percentage yet, a new selling price leaves the wholesale price and the percentage follows', () => {
  assert.deepEqual(
    withSellingPrice({ selling_price: 2000, wholesale_price: 1800, wholesale_discount_percent: 0 }, 2400),
    { selling_price: 2400, wholesale_discount_percent: 25 }
  );
  assert.deepEqual(
    withSellingPrice({ selling_price: 0, wholesale_price: 0, wholesale_discount_percent: 0 }, 2000),
    { selling_price: 2000, wholesale_discount_percent: 0 }
  );
});

test('an existing product opens with its percentage already filled in', () => {
  assert.equal(impliedDiscountPercent({ selling_price: 2000, wholesale_price: 1800 }), 10);
  assert.equal(impliedDiscountPercent({ selling_price: 2000, wholesale_price: null }), 0);
});
