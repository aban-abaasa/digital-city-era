import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBarcodeSheet, barcodeSheetFilename } from '../src/utils/barcodePdf.js';
import { generateStoreBarcodes } from '../src/utils/storeBarcodes.js';

const categories = [{ id: 'c-bakery', name: 'Bakery' }, { id: 'c-drinks', name: 'Drinks' }];
const codes = generateStoreBarcodes({ supermarketId: 'store-1', count: 80 });
const product = (i, extra = {}) => ({ id: `p${i}`, name: `Product ${i}`, barcode: codes[i], selling_price: 1000 + i, category_id: 'c-bakery', ...extra });
const fixedNow = new Date('2026-10-17T10:00:00Z');

test('one printed label per printable barcode, none lost across pages', () => {
  const products = Array.from({ length: 80 }, (_, i) => product(i));
  const sheet = buildBarcodeSheet({ products, categories, storeName: 'Kampala Fresh', now: fixedNow });
  assert.equal(sheet.printed, 80);
  assert.equal(sheet.placements.length, 80);
  assert.equal(sheet.pages, 5, "18 labels fit on a page, so 80 take five");
  assert.deepEqual(sheet.placements.map((p) => p.digits).sort(), [...codes].sort());
  assert.ok(sheet.placements.every((p) => p.page >= 1 && p.page <= sheet.pages));
});

test('labels stay inside the page and never overlap on a page', () => {
  const products = Array.from({ length: 40 }, (_, i) => product(i, { category_id: i % 2 ? 'c-drinks' : 'c-bakery' }));
  const { placements } = buildBarcodeSheet({ products, categories, now: fixedNow });
  placements.forEach((p) => {
    assert.ok(p.x >= 10 && p.x + p.width <= 200, `x ${p.x}..${p.x + p.width}`);
    assert.ok(p.y >= 24 && p.y + p.height <= 285, `y ${p.y}`);
  });
  placements.forEach((a, i) => placements.slice(i + 1).forEach((b) => {
    if (a.page !== b.page) return;
    const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    assert.ok(apart, `${a.digits} overlaps ${b.digits}`);
  }));
});

test('codes that cannot be drawn are listed, not printed', () => {
  const products = [
    product(0),
    { id: 'x1', name: 'Text code', barcode: 'ABC-123', selling_price: 1 },
    { id: 'x2', name: 'Placeholder', barcode: 'AUTO-1792237392296', selling_price: 1 },
    { id: 'x3', name: 'No code', barcode: '', selling_price: 1 },
    { id: 'x4', name: 'Bad check digit', barcode: '4006381333932', selling_price: 1 },
    { id: 'x5', name: 'Manufacturer EAN-13', barcode: '4006381333931', selling_price: 1 },
    { id: 'x6', name: 'UPC-A', barcode: '036000291452', selling_price: 1 }
  ];
  const sheet = buildBarcodeSheet({ products, now: fixedNow });
  assert.equal(sheet.printed, 3);
  assert.deepEqual(sheet.skipped.map((p) => p.id), ['x1', 'x2', 'x3', 'x4']);
});

test('with no printable barcodes it still produces a one-page PDF', () => {
  const sheet = buildBarcodeSheet({ products: [{ name: 'x', barcode: '' }], now: fixedNow });
  assert.equal(sheet.printed, 0);
  assert.equal(sheet.pages, 1);
});

test('the output is a real PDF', () => {
  const { doc } = buildBarcodeSheet({ products: [product(0), product(1)], storeName: 'Kampala Fresh', now: fixedNow });
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-');
  assert.ok(bytes.length > 1500);
});

test('without grouping the labels run on A to Z; without prices the labels are shorter', () => {
  const products = [product(3, { name: 'Zucchini' }), product(1, { name: 'Apple' }), product(2, { name: 'mango' })];
  const grouped = buildBarcodeSheet({ products, groupByCategory: false, now: fixedNow });
  assert.deepEqual(grouped.placements.map((p) => p.digits), [codes[1], codes[2], codes[3]]);
  const many = Array.from({ length: 30 }, (_, i) => product(i));
  const withPrice = buildBarcodeSheet({ products: many, now: fixedNow });
  const noPrice = buildBarcodeSheet({ products: many, includePrice: false, now: fixedNow });
  assert.ok(noPrice.pages <= withPrice.pages);
});

test('long names and non-Latin text do not break the sheet', () => {
  const products = [product(0, { name: 'A very long product name that goes on and on and on past two lines of a label for sure' }), product(1, { name: 'Café – 咖啡' })];
  const sheet = buildBarcodeSheet({ products, now: fixedNow });
  assert.equal(sheet.printed, 2);
});

test('the file name carries the store and the date', () => {
  assert.equal(barcodeSheetFilename('Kampala Fresh Mart!', fixedNow), 'barcodes-kampala-fresh-mart-2026-10-17.pdf');
  assert.equal(barcodeSheetFilename('', fixedNow), 'barcodes-2026-10-17.pdf');
});
