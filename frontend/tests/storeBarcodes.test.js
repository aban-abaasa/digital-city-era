import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ean13CheckDigit,
  isValidEan13,
  isStoreBarcode,
  isPlaceholderBarcode,
  storeNumber,
  buildStoreBarcode,
  generateStoreBarcode,
  generateStoreBarcodes
} from '../src/utils/storeBarcodes.js';

test('EAN-13 check digits match known codes', () => {
  assert.equal(ean13CheckDigit('400638133393'), 1);   // 4006381333931
  assert.equal(ean13CheckDigit('590123412345'), 7);   // 5901234123457
  assert.equal(ean13CheckDigit('978030640615'), 7);   // ISBN 9780306406157
  assert.ok(isValidEan13('4006381333931'));
  assert.ok(!isValidEan13('4006381333932'));
  assert.ok(!isValidEan13('400638133393'));
  assert.ok(!isValidEan13('abcdefghijklm'));
});

test('a store barcode is 13 digits, starts with 2, carries the store digits and a valid check digit', () => {
  const code = buildStoreBarcode('0427', 31);
  assert.equal(code.length, 13);
  assert.equal(code.slice(0, 6), '204270');
  assert.equal(code.slice(6, 12), '000031');
  assert.ok(isValidEan13(code));
  assert.ok(isStoreBarcode(code));
});

test('only valid numbers starting with 2 count as store barcodes', () => {
  assert.ok(!isStoreBarcode('4006381333931'));
  assert.ok(!isStoreBarcode('2000000000000'.slice(0, 12) + '9'), 'wrong check digit');
  assert.ok(!isStoreBarcode(null));
  assert.ok(!isStoreBarcode('AUTO-123'));
});

test('blank and AUTO-/BC- codes are placeholders; real codes are not', () => {
  ['', '  ', null, undefined, 'AUTO-1792237392296', 'auto-5', 'BC-1792-ABC-12'].forEach((code) => assert.ok(isPlaceholderBarcode(code), String(code)));
  ['4006381333931', '600111', 'ABC123', '2042700000312'].forEach((code) => assert.ok(!isPlaceholderBarcode(code), code));
});

test('a store number is four digits and always the same for a store', () => {
  const id = '3f9c2b3e-6a52-4d3e-9d6a-0f4d2c6b1a77';
  assert.match(storeNumber(id), /^\d{4}$/);
  assert.equal(storeNumber(id), storeNumber(id));
  assert.notEqual(storeNumber(id), storeNumber('a-different-store-id'));
  assert.match(storeNumber(null), /^\d{4}$/);
});

test('generated codes are valid, in the store range, and skip anything taken', () => {
  const id = 'store-1';
  const first = generateStoreBarcode({ supermarketId: id, random: () => 5 });
  assert.equal(first, buildStoreBarcode(storeNumber(id), 5));
  const draws = [5, 5, 9];
  const next = generateStoreBarcode({ supermarketId: id, taken: [first], random: () => draws.shift() });
  assert.equal(next, buildStoreBarcode(storeNumber(id), 9));
});

test('a batch is all different, valid, and clear of existing codes', () => {
  const id = 'store-1';
  const existing = Array.from({ length: 50 }, (_, i) => buildStoreBarcode(storeNumber(id), i));
  const codes = generateStoreBarcodes({ supermarketId: id, count: 500, taken: existing });
  assert.equal(new Set(codes).size, 500);
  assert.ok(codes.every((code) => isStoreBarcode(code) && !existing.includes(code)));
});

test('two stores never get the same code from the same draw', () => {
  const a = generateStoreBarcode({ supermarketId: 'store-a', random: () => 7 });
  const b = generateStoreBarcode({ supermarketId: 'store-b', random: () => 7 });
  assert.notEqual(a, b);
});

test('it gives up rather than loop forever when nothing is free', () => {
  assert.throws(() => generateStoreBarcode({ supermarketId: 's', taken: [buildStoreBarcode(storeNumber('s'), 1)], random: () => 1 }), /free barcode/);
});
