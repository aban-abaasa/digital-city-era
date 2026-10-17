// Store-made barcodes: scannable EAN-13 numbers for products that have no barcode of their own
// (loose goods, bakery, produce, anything made or repacked in store). The cashier points the
// scanner at the printed label instead of searching for the product.
//
// Layout: 2 + 4 digits of the store + 7 digits for the item + the EAN-13 check digit.
// GS1 sets numbers starting with 2 aside for in-store use, so one can never clash with a
// manufacturer's code, and the store digits keep two stores' codes apart (products.barcode
// is unique across every store).

export const ean13CheckDigit = (first12) => {
  const digits = String(first12);
  const sum = [...digits].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
};

export const isValidEan13 = (code) =>
  /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);

export const isStoreBarcode = (code) => /^2\d{12}$/.test(String(code ?? '')) && isValidEan13(String(code));

// Left by earlier versions when a product was saved without a barcode: not scannable, so
// they count as "no barcode" and can be replaced.
export const isPlaceholderBarcode = (code) => {
  const text = String(code ?? '').trim();
  return !text || /^(AUTO|BC)-/i.test(text);
};

// A stable 4-digit number for a store (FNV-1a over its id)
export const storeNumber = (supermarketId) => {
  let hash = 0x811c9dc5;
  for (const char of String(supermarketId ?? '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return String(hash % 10000).padStart(4, '0');
};

export const buildStoreBarcode = (storeDigits, item) => {
  const first12 = `2${storeDigits}${String(item).padStart(7, '0')}`;
  return `${first12}${ean13CheckDigit(first12)}`;
};

const randomBelow = (max) => {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % max;
  return Math.floor(Math.random() * max);
};

// One new code that is not in `taken`. `random(max)` can be swapped out in tests.
export const generateStoreBarcode = ({ supermarketId, taken = [], random = randomBelow }) => {
  const used = new Set([...taken].map((code) => String(code ?? '').trim()));
  const store = storeNumber(supermarketId);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = buildStoreBarcode(store, random(10_000_000));
    if (!used.has(code)) return code;
  }
  throw new Error('Could not find a free barcode number');
};

// `count` new codes, all different from each other and from `taken`
export const generateStoreBarcodes = ({ supermarketId, count, taken = [], random }) => {
  const used = [...taken];
  const made = [];
  for (let i = 0; i < count; i += 1) {
    const code = generateStoreBarcode({ supermarketId, taken: used, random });
    made.push(code);
    used.push(code);
  }
  return made;
};
