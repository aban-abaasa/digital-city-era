import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeName,
  findSimilarProducts,
  suggestCategoryId,
  priceFromMargin,
  marginPercent,
  checkQuickRows
} from '../src/utils/addProductSmarts.js';

const shelf = [
  { id: 'p1', name: 'Rice - 1kg', category_id: 'c-groceries' },
  { id: 'p2', name: 'Rice - 5kg', category_id: 'c-groceries' },
  { id: 'p3', name: 'Soap Bar', category_id: 'c-household' },
  { id: 'p4', name: 'Tomatoes', category_id: null }
];

test('names are compared without case, punctuation or extra spaces', () => {
  assert.equal(normalizeName('  Rice - 1KG  '), 'rice 1kg');
  assert.equal(normalizeName(null), '');
});

test('the same name is reported first, then names that overlap', () => {
  const matches = findSimilarProducts('rice 1kg', shelf);
  assert.equal(matches[0].kind, 'same');
  assert.equal(matches[0].product.id, 'p1');

  const similar = findSimilarProducts('Rice', shelf);
  assert.deepEqual(similar.map((m) => m.product.id), ['p1', 'p2']);
  assert.ok(similar.every((m) => m.kind === 'similar'));
});

test('two letters or fewer never flag anything', () => {
  assert.deepEqual(findSimilarProducts('ri', shelf), []);
  assert.deepEqual(findSimilarProducts('', shelf), []);
  assert.deepEqual(findSimilarProducts('rice', undefined), []);
});

test('similar products are capped', () => {
  assert.equal(findSimilarProducts('rice', shelf, 1).length, 1);
});

test('category comes from a product that starts with the same word', () => {
  assert.equal(suggestCategoryId('Rice 10kg', shelf, []), 'c-groceries');
  assert.equal(suggestCategoryId('Soap liquid', shelf, []), 'c-household');
});

test('category comes from the name when a category is mentioned in it', () => {
  const categories = [{ id: 'c-milk', name: 'Milk' }, { id: 'c-household', name: 'Household' }];
  assert.equal(suggestCategoryId('Fresh Milk 500ml', shelf, categories), 'c-milk');
});

test('no guess when nothing matches', () => {
  assert.equal(suggestCategoryId('Umbrella', shelf, []), null);
  assert.equal(suggestCategoryId('', shelf, []), null);
  assert.equal(suggestCategoryId('Tomato', shelf, []), null, 'a match with no category gives nothing');
});

test('selling price from a margin is rounded up to the next 100', () => {
  assert.equal(priceFromMargin(1000, 20), 1200);
  assert.equal(priceFromMargin(1234, 20), 1500);
  assert.equal(priceFromMargin(1000, 0), 1000);
  assert.equal(priceFromMargin(0, 20), 0);
  assert.equal(priceFromMargin('abc', 20), 0);
});

test('margin is profit as a percentage of cost', () => {
  assert.equal(marginPercent(1000, 1250), 25);
  assert.equal(marginPercent(0, 1250), null);
  assert.ok(marginPercent(1000, 800) < 0);
});

test('quick list: blank rows are skipped and good rows are ready', () => {
  const rows = [
    { id: 'a', name: 'Sugar 1kg', price: '5000', cost: '4200', stock: '12' },
    { id: 'b', name: '', price: '', cost: '', stock: '' },
    { id: 'c', name: 'Salt', price: '1500', cost: '', stock: '' }
  ];
  const { ready, issues } = checkQuickRows(rows, shelf);
  assert.deepEqual(issues, {});
  assert.deepEqual(ready, [
    { id: 'a', name: 'Sugar 1kg', selling_price: 5000, cost_price: 4200, initial_stock: 12 },
    { id: 'c', name: 'Salt', selling_price: 1500, cost_price: 0, initial_stock: 0 }
  ]);
});

test('quick list: every problem is named on its row', () => {
  const rows = [
    { id: 'a', name: 'Beans', price: '', stock: '' },
    { id: 'b', name: '', price: '2000', stock: '' },
    { id: 'c', name: 'Millet', price: '3000', stock: '-4' },
    { id: 'd', name: 'Rice 1KG', price: '4500', stock: '' },
    { id: 'e', name: 'Maize', price: '2500', stock: '' },
    { id: 'f', name: 'maize', price: '2500', stock: '' },
    { id: 'g', name: 'Flour', price: '3000', cost: '-1', stock: '' },
    { id: 'h', name: '', price: '', cost: '900', stock: '' }
  ];
  const { ready, issues } = checkQuickRows(rows, shelf);
  assert.equal(issues.a, 'Add a price');
  assert.equal(issues.b, 'Add a name');
  assert.equal(issues.c, 'Stock must be 0 or more');
  assert.equal(issues.d, 'Already in your shop');
  assert.equal(issues.f, 'Listed twice here');
  assert.equal(issues.g, 'Cost must be 0 or more');
  assert.equal(issues.h, 'Add a name', 'a row with only a cost is not blank');
  assert.deepEqual(ready.map((r) => r.id), ['e']);
});

test('quick list: part-filled stock is rounded down to whole items', () => {
  const { ready } = checkQuickRows([{ id: 'a', name: 'Cabbage', price: '1000', stock: '3.7' }], []);
  assert.equal(ready[0].initial_stock, 3);
});

test('quick list: a photo rides along, and a photo-only row is not treated as empty', () => {
  const photo = { name: 'sugar.jpg' };
  const { ready, issues } = checkQuickRows([
    { id: 'a', name: 'Sugar', price: '5000', photoFile: photo },
    { id: 'b', name: '', price: '', photoFile: photo }
  ], []);
  assert.equal(ready[0].photo_file, photo);
  assert.equal(issues.b, 'Add a name');
});
