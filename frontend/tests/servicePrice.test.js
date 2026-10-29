import test from 'node:test';
import assert from 'node:assert/strict';
import {
  priceModeOf,
  buildServicePricing,
  servicePriceLabel,
  isFixedPriced
} from '../src/utils/servicePrice.js';

test('a saved service is fixed, a range or a quote', () => {
  assert.equal(priceModeOf({ selling_price: 20000 }), 'fixed');
  assert.equal(priceModeOf({ selling_price: '20000', price_max: null }), 'fixed');
  assert.equal(priceModeOf({ selling_price: 20000, price_max: 50000 }), 'range');
  assert.equal(priceModeOf({ selling_price: 0 }), 'quote');
  assert.equal(priceModeOf({}), 'quote');
  // a top that is not above the bottom is not a range
  assert.equal(priceModeOf({ selling_price: 20000, price_max: 20000 }), 'fixed');
  assert.equal(priceModeOf({ selling_price: 20000, price_max: 100 }), 'fixed');
});

test('falls back to price when selling_price is empty', () => {
  assert.equal(priceModeOf({ selling_price: null, price: 15000 }), 'fixed');
  assert.equal(servicePriceLabel({ selling_price: null, price: 15000 }), 'UGX 15,000');
});

test('saving a fixed price keeps no top', () => {
  assert.deepEqual(buildServicePricing({ mode: 'fixed', from: '20000', to: '50000' }), { selling_price: 20000, price_max: null, error: null });
});

test('saving a range stores the bottom as the selling price and the top as price_max', () => {
  assert.deepEqual(buildServicePricing({ mode: 'range', from: '20000', to: '50000' }), { selling_price: 20000, price_max: 50000, error: null });
});

test('saving a quote clears both prices', () => {
  assert.deepEqual(buildServicePricing({ mode: 'quote', from: '20000', to: '50000' }), { selling_price: 0, price_max: null, error: null });
});

test('bad prices are refused with a reason', () => {
  assert.match(buildServicePricing({ mode: 'fixed', from: '' }).error, /Enter a price/);
  assert.match(buildServicePricing({ mode: 'fixed', from: '-5' }).error, /Enter a price/);
  assert.match(buildServicePricing({ mode: 'range', from: '', to: '5' }).error, /lowest/);
  assert.match(buildServicePricing({ mode: 'range', from: '10', to: '' }).error, /highest/);
  assert.match(buildServicePricing({ mode: 'range', from: '50', to: '50' }).error, /more than/);
  assert.match(buildServicePricing({ mode: 'range', from: '50', to: '10' }).error, /more than/);
});

test('zero is a valid lowest price for a range', () => {
  assert.deepEqual(buildServicePricing({ mode: 'range', from: '0', to: '10000' }), { selling_price: 0, price_max: 10000, error: null });
});

test('labels read as a price, a range or a quote request', () => {
  assert.equal(servicePriceLabel({ selling_price: 20000 }), 'UGX 20,000');
  assert.equal(servicePriceLabel({ selling_price: 20000, price_max: 50000 }), 'UGX 20,000 - 50,000');
  assert.equal(servicePriceLabel({ selling_price: 0 }), 'Ask for a quote');
  assert.equal(servicePriceLabel({ selling_price: 20, price_max: 50 }, 'USD'), 'USD 20 - 50');
});

test('only a single fixed price can be paid for online', () => {
  assert.equal(isFixedPriced({ selling_price: 20000 }), true);
  assert.equal(isFixedPriced({ selling_price: 20000, price_max: 50000 }), false);
  assert.equal(isFixedPriced({ selling_price: 0 }), false);
});
