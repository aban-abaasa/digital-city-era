// Draws retail barcodes as bars. EAN-13 is what the store makes and what most shop products carry
// (a 12-digit UPC-A is the same symbol with a leading 0); EAN-8 covers small packs.
// Output is a list of 0/1 modules (1 = bar), so a PDF can draw crisp vector rectangles at any size.

import { ean13CheckDigit, isValidEan13 } from './storeBarcodes.js';

const L_CODES = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const complement = (bits) => [...bits].map((bit) => (bit === '1' ? '0' : '1')).join('');
const R_CODES = L_CODES.map(complement);
const G_CODES = R_CODES.map((bits) => [...bits].reverse().join(''));

// Which of the six left-hand digits use the L or G set, chosen by the first digit
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

const toModules = (bits) => [...bits].map(Number);

export const ean13Modules = (code) => {
  const digits = [...code].map(Number);
  const left = digits.slice(1, 7).map((digit, i) => (PARITY[digits[0]][i] === 'L' ? L_CODES : G_CODES)[digit]).join('');
  const right = digits.slice(7).map((digit) => R_CODES[digit]).join('');
  return toModules(`101${left}01010${right}101`);
};

export const ean8Modules = (code) => {
  const digits = [...code].map(Number);
  const left = digits.slice(0, 4).map((digit) => L_CODES[digit]).join('');
  const right = digits.slice(4).map((digit) => R_CODES[digit]).join('');
  return toModules(`101${left}01010${right}101`);
};

const isValidEan8 = (code) =>
  /^\d{8}$/.test(code) && ean13CheckDigit(`00000${code.slice(0, 7)}`) === Number(code[7]);

// What can be printed for a stored barcode, or null (text codes, wrong check digit, odd lengths).
// { kind, digits, modules } — `digits` is what appears under the bars.
export const printableBarcode = (value) => {
  const code = String(value ?? '').trim();
  if (/^\d{12}$/.test(code) && isValidEan13(`0${code}`)) return { kind: 'ean13', digits: `0${code}`, modules: ean13Modules(`0${code}`) };
  if (isValidEan13(code)) return { kind: 'ean13', digits: code, modules: ean13Modules(code) };
  if (isValidEan8(code)) return { kind: 'ean8', digits: code, modules: ean8Modules(code) };
  return null;
};

// Runs of bars as [startModule, widthInModules] so a drawing needs one rectangle per bar
export const barRuns = (modules) => {
  const runs = [];
  let start = -1;
  modules.forEach((module, index) => {
    if (module === 1 && start < 0) start = index;
    if (module === 0 && start >= 0) { runs.push([start, index - start]); start = -1; }
  });
  if (start >= 0) runs.push([start, modules.length - start]);
  return runs;
};
