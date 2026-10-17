import test from 'node:test';
import assert from 'node:assert/strict';
import { ean13Modules, ean8Modules, printableBarcode, barRuns } from '../src/utils/barcodeSymbols.js';
import { generateStoreBarcodes } from '../src/utils/storeBarcodes.js';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((bits) => [...bits].map((b) => (b === '1' ? '0' : '1')).join(''));
const G = R.map((bits) => [...bits].reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// An independent reading of the bars: recovers the 13 digits from the modules the way a scanner would
const read = (modules) => {
  const bits = modules.join('');
  assert.equal(bits.length, 95);
  assert.equal(bits.slice(0, 3), '101');
  assert.equal(bits.slice(45, 50), '01010');
  assert.equal(bits.slice(92), '101');
  const leftBits = Array.from({ length: 6 }, (_, i) => bits.slice(3 + i * 7, 10 + i * 7));
  const rightBits = Array.from({ length: 6 }, (_, i) => bits.slice(50 + i * 7, 57 + i * 7));
  const pattern = leftBits.map((chunk) => (L.includes(chunk) ? 'L' : 'G')).join('');
  const first = PARITY.indexOf(pattern);
  const left = leftBits.map((chunk, i) => (pattern[i] === 'L' ? L : G).indexOf(chunk));
  const right = rightBits.map((chunk) => R.indexOf(chunk));
  return [first, ...left, ...right].join('');
};

test('EAN-13 bars are 95 modules with the guard patterns in the right places', () => {
  const modules = ean13Modules('4006381333931');
  assert.equal(modules.length, 95);
  assert.ok(modules.every((m) => m === 0 || m === 1));
});

test('EAN-13 for a known code starts as 4 006381 333931 reads', () => {
  assert.equal(read(ean13Modules('4006381333931')), '4006381333931');
  assert.equal(read(ean13Modules('5901234123457')), '5901234123457');
});

test('every first digit and every digit value round-trips', () => {
  for (let first = 0; first < 10; first += 1) {
    const body = `${first}${String((first * 111111 + 123456) % 10 ** 11).padStart(11, '0')}`;
    const check = (10 - ([...body].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
    const code = `${body}${check}`;
    assert.equal(read(ean13Modules(code)), code);
  }
});

test('a thousand generated store barcodes all read back', () => {
  generateStoreBarcodes({ supermarketId: 'abc', count: 1000 }).forEach((code) => {
    assert.equal(read(ean13Modules(code)), code);
  });
});

test('EAN-8 is 67 modules with guards', () => {
  const modules = ean8Modules('96385074');
  assert.equal(modules.length, 67);
  const bits = modules.join('');
  assert.equal(bits.slice(0, 3), '101');
  assert.equal(bits.slice(31, 36), '01010');
  assert.equal(bits.slice(64), '101');
});

test('what can be printed: EAN-13, UPC-A as EAN-13, EAN-8 — and not text or bad check digits', () => {
  assert.equal(printableBarcode('4006381333931').kind, 'ean13');
  assert.equal(printableBarcode(' 4006381333931 ').digits, '4006381333931');
  const upc = printableBarcode('036000291452');
  assert.equal(upc.kind, 'ean13');
  assert.equal(upc.digits, '0036000291452');
  assert.equal(printableBarcode('96385074').kind, 'ean8');
  assert.equal(printableBarcode('4006381333932'), null);
  assert.equal(printableBarcode('AUTO-123'), null);
  assert.equal(printableBarcode('600111'), null);
  assert.equal(printableBarcode(''), null);
  assert.equal(printableBarcode(null), null);
});

test('bar runs merge neighbouring bars', () => {
  assert.deepEqual(barRuns([1, 1, 0, 1, 0, 0, 1, 1, 1]), [[0, 2], [3, 1], [6, 3]]);
  assert.deepEqual(barRuns([0, 0]), []);
  const runs = barRuns(ean13Modules('4006381333931'));
  assert.deepEqual(runs[0], [0, 1]);
  assert.equal(runs.at(-1)[0] + runs.at(-1)[1], 95);
});
