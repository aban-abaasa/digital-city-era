import test from 'node:test';
import assert from 'node:assert/strict';
import { familyName, groupProductFamilies } from '../src/utils/productFamilies.js';

const product = (name, barcode, extra = {}) => ({ id: `${name}|${barcode}`, name, barcode, current_stock: 0, images: [], ...extra });

test('a family name is the name before the flavor', () => {
  assert.equal(familyName('Fanta 500ml - Orange'), 'Fanta 500ml');
  assert.equal(familyName('Fanta 500ml – Orange'), 'Fanta 500ml');
  assert.equal(familyName('  Fanta   500ml '), 'Fanta 500ml');
  assert.equal(familyName('Fanta 500ml - Original - Passion'), 'Fanta 500ml');
  assert.equal(familyName('Coca-Cola 500ml'), 'Coca-Cola 500ml', 'a hyphen inside a word is not a separator');
  assert.equal(familyName(null), '');
});

test('products with the same name and different barcodes are listed as a family', () => {
  const families = groupProductFamilies([
    product('Fanta 500ml', '600111'),
    product('Fanta 500ml', '600222'),
    product('Bread', '700111')
  ]);
  assert.equal(families.length, 1);
  assert.equal(families[0].name, 'Fanta 500ml');
  assert.equal(families[0].members.length, 2);
});

test('flavors named "<name> - <flavor>" gather under the product, base first', () => {
  const [family] = groupProductFamilies([
    product('Fanta 500ml - Orange', '600222'),
    product('Fanta 500ml - Mango', '600333'),
    product('Fanta 500ml', '600111'),
    product('Sprite 500ml', '600555')
  ]);
  assert.deepEqual(family.members.map((m) => m.name), ['Fanta 500ml', 'Fanta 500ml - Mango', 'Fanta 500ml - Orange']);
});

test('names match regardless of case and spacing', () => {
  const families = groupProductFamilies([product('FANTA  500ml', '600111'), product('fanta 500ml - Orange', '600222')]);
  assert.equal(families.length, 1);
});

test('a lone product is not a family', () => {
  assert.deepEqual(groupProductFamilies([product('Bread', '700111'), product('Sugar - 1kg', '700222')]), []);
});

test('the same barcode on two rows is not "different barcodes"', () => {
  assert.deepEqual(groupProductFamilies([product('Fanta', '012345678905'), product('Fanta', '12345678905')]), []);
});

test('families come A to Z and carry stock and photo counts', () => {
  const families = groupProductFamilies([
    product('Sprite', '2', { current_stock: 5, images: ['http://x/a.jpg'] }),
    product('Sprite - Lime', '3', { current_stock: 7 }),
    product('Fanta', '4', { current_stock: 1 }),
    product('Fanta - Orange', '5', { images: null })
  ]);
  assert.deepEqual(families.map((f) => f.name), ['Fanta', 'Sprite']);
  assert.deepEqual([families[1].units, families[1].withoutPhoto], [12, 1]);
  assert.deepEqual([families[0].units, families[0].withoutPhoto], [1, 2]);
});

test('no products, no families', () => {
  assert.deepEqual(groupProductFamilies([]), []);
  assert.deepEqual(groupProductFamilies(undefined), []);
});
