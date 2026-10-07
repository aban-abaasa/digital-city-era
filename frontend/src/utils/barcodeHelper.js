// Barcode matching shared by the scanner and the portals that consume its scans.

// Scanner libraries disagree on how they report the same retail code: a UPC-A
// (12 digits) is read as an EAN-13 with a leading 0 by some decoders, and the
// stored barcode may be either form. Numeric codes of 8-14 digits are therefore
// compared as zero-padded GTIN-14; anything shorter (in-store SKUs) must match exactly.
export const normalizeBarcode = (value) => {
  const code = String(value ?? '').trim();
  if (/^\d{8,14}$/.test(code)) return code.padStart(14, '0');
  return code;
};

export const barcodesMatch = (a, b) => {
  const left = normalizeBarcode(a);
  return left !== '' && left === normalizeBarcode(b);
};

// Looks a scanned code up by barcode, SKU or id. Exact matches win over normalised ones.
export const findProductByBarcode = (products, scanned) => {
  const code = String(scanned ?? '').trim();
  if (!code || !Array.isArray(products)) return null;

  const exact = products.find((p) =>
    [p.barcode, p.sku, p.id].some((field) => field != null && String(field).trim() === code)
  );
  if (exact) return exact;

  return products.find((p) => barcodesMatch(p.barcode, code) || barcodesMatch(p.sku, code)) || null;
};
