// A product that comes in several flavors is sold as several products: each flavor has
// its own barcode, price and stock, so a scan at the till finds exactly the flavor in
// the customer's hand. These helpers let the admin create them together from one form.

import { barcodeVariants, barcodesMatch } from './barcodeHelper.js';
import { percentFromWholesale, wholesaleFromPercent } from './wholesalePricing.js';

// Offered as one-tap chips and as type-ahead; the admin can type anything.
export const FLAVOR_SUGGESTIONS = [
  'Original', 'Orange', 'Mango', 'Passion', 'Pineapple', 'Apple', 'Strawberry',
  'Vanilla', 'Chocolate', 'Banana', 'Lemon', 'Cola'
];

let rowSequence = 0;

export const newFlavorRow = (fields = {}) => ({
  id: `flavor-${++rowSequence}`,
  flavor: '',
  barcode: '',
  selling_price: '', // blank = same price as the main product
  photo: null, // optional image file, uploaded once the flavor's product exists
  photoPreview: '',
  ...fields
});

const text = (value) => String(value ?? '').trim();

// "Fanta 500ml" + "Orange" -> "Fanta 500ml - Orange"
export const flavorProductName = (sharedName, flavor) =>
  [text(sharedName), text(flavor)].filter(Boolean).join(' - ');

// A hand scanner in a text box types one code and presses Enter; a paste can carry a
// whole column. Barcodes never contain spaces, so any whitespace, comma or semicolon splits.
export const splitScannedCodes = (value) =>
  [...new Set(String(value ?? '').split(/[\s,;]+/).map((code) => code.trim()).filter(Boolean))];

// Scanned codes go into the first row still waiting for a barcode (say, a flavor the admin
// tapped before scanning its can), and start a new row when none is waiting. A code that is
// already on a row is skipped.
export const addBarcodesToRows = (rows, codes) => {
  const next = rows.map((row) => ({ ...row }));
  codes.forEach((code) => {
    const barcode = text(code);
    if (!barcode || next.some((row) => barcodesMatch(row.barcode, barcode))) return;
    const waiting = next.find((row) => !text(row.barcode));
    if (waiting) waiting.barcode = barcode;
    else next.push(newFlavorRow({ barcode }));
  });
  return next;
};

// The mirror image: a flavor name goes to the first row still waiting for a name (a code the
// admin scanned first), and starts a new row when none is waiting. A flavor already listed is skipped.
export const addFlavorNameToRows = (rows, flavor) => {
  const name = text(flavor);
  if (!name || rows.some((row) => text(row.flavor).toLowerCase() === name.toLowerCase())) return rows;
  const next = rows.map((row) => ({ ...row }));
  const waiting = next.find((row) => !text(row.flavor));
  if (waiting) waiting.flavor = name;
  else next.push(newFlavorRow({ flavor: name }));
  return next;
};

// A row with neither a flavor nor a barcode is just an empty line the admin left behind.
export const isBlankFlavorRow = (row) => !text(row.flavor) && !text(row.barcode);

export const activeFlavorRows = (rows) => rows.filter((row) => !isBlankFlavorRow(row));

// What is wrong with each row, keyed by row id: { flavor?: message, barcode?: message }.
// `products` is the store's loaded catalog; it catches a reused barcode without a round trip.
export const checkFlavorRows = (rows, { mainBarcode = '', products = [] } = {}) => {
  const issues = {};
  const flag = (row, field, message) => {
    issues[row.id] = { ...issues[row.id], [field]: message };
  };

  const seenFlavors = new Map();
  const seenBarcodes = [];

  activeFlavorRows(rows).forEach((row) => {
    const flavor = text(row.flavor);
    const barcode = text(row.barcode);

    if (!flavor) {
      flag(row, 'flavor', 'Name this flavor');
    } else if (seenFlavors.has(flavor.toLowerCase())) {
      flag(row, 'flavor', 'Already listed above');
    } else {
      seenFlavors.set(flavor.toLowerCase(), row.id);
    }

    if (!barcode) {
      flag(row, 'barcode', 'Scan, type or generate its barcode');
      return;
    }
    if (barcode.length < 3) {
      flag(row, 'barcode', 'Too short to be a barcode');
      return;
    }
    if (seenBarcodes.some((other) => barcodesMatch(other, barcode))) {
      flag(row, 'barcode', 'Same barcode as another flavor');
      return;
    }
    seenBarcodes.push(barcode);

    if (text(mainBarcode) && barcodesMatch(mainBarcode, barcode)) {
      flag(row, 'barcode', "Same as the main product's barcode");
      return;
    }
    const taken = products.find((p) => barcodesMatch(p.barcode, barcode));
    if (taken) flag(row, 'barcode', `Already used by ${taken.name}`);
  });

  return issues;
};

export const hasFlavorIssues = (issues) => Object.keys(issues).length > 0;

// The product rows to insert. Every flavor copies the main product's cost, tax and
// category; its own price replaces the selling price when the admin typed one, and its
// wholesale price then keeps the main product's wholesale discount (typed as a percentage,
// or implied by the main product's two prices).
// SKU follows the scan convention (SKU-<barcode>) because SKUs are unique.
export const buildFlavorProducts = ({ supermarketId, base, rows }) =>
  activeFlavorRows(rows).map((row) => {
    const ownPrice = row.selling_price === '' || row.selling_price == null
      ? null
      : Math.max(0, Number(row.selling_price) || 0);
    const sellingPrice = ownPrice ?? (Number(base.selling_price) || 0);
    const discount = Number(base.wholesale_discount_percent) || percentFromWholesale(base.selling_price, base.wholesale_price);
    const wholesalePrice = ownPrice != null && discount > 0
      ? wholesaleFromPercent(sellingPrice, discount)
      : Number(base.wholesale_price) || 0;
    const barcode = text(row.barcode);

    return {
      name: flavorProductName(base.name, row.flavor),
      sku: `SKU-${barcode}`,
      barcode,
      cost_price: Number(base.cost_price) || 0,
      wholesale_price: wholesalePrice,
      selling_price: sellingPrice,
      tax_rate: base.tax_rate ?? 18,
      category_id: base.category_id || null,
      is_active: true,
      supermarket_id: supermarketId
    };
  });

// Writes the flavors: one check that none of the barcodes is taken, one insert for the
// products (all or nothing), one insert for their stock records, then each flavor's photo
// (`uploadPhoto(productId, file)` saves it and returns its url). Throws with a message the
// admin can act on. Returns { products, stockError, photoFailures } — a stock record or a
// photo that fails is reported rather than thrown, since the products themselves exist by then.
export const registerFlavorProducts = async ({ supabase, supermarketId, base, rows, uploadPhoto }) => {
  const payloads = buildFlavorProducts({ supermarketId, base, rows });
  if (payloads.length === 0) return { products: [], stockError: null, photoFailures: 0 };

  const { data: taken, error: lookupError } = await supabase
    .from('products')
    .select('name, barcode')
    .in('barcode', payloads.flatMap((p) => barcodeVariants(p.barcode)))
    .eq('supermarket_id', supermarketId);
  if (lookupError) throw new Error('Could not check the flavor barcodes. Try again.');

  const clash = payloads
    .map((p) => ({ payload: p, owner: (taken || []).find((t) => barcodesMatch(t.barcode, p.barcode)) }))
    .find((entry) => entry.owner);
  if (clash) {
    throw new Error(`Barcode ${clash.payload.barcode} is already used by ${clash.owner.name}`);
  }

  const { data: created, error: insertError } = await supabase
    .from('products')
    .insert(payloads)
    .select('*');
  if (insertError) {
    // products.barcode is unique across every store, so a code another store registered can't be reused
    throw new Error(insertError.code === '23505'
      ? 'One of these barcodes is already registered to another store'
      : `Could not save the flavors${insertError.message ? `: ${insertError.message}` : ''}`);
  }

  const { error: stockError } = await supabase
    .from('inventory')
    .insert(created.map((product) => ({
      product_id: product.id,
      supermarket_id: supermarketId,
      current_stock: 0,
      reserved_stock: 0,
      minimum_stock: 10,
      reorder_point: 20,
      reorder_quantity: 100
    })));

  // One at a time: several full-size phone photos compressing at once can exhaust a phone's memory
  let photoFailures = 0;
  if (uploadPhoto) {
    for (const row of activeFlavorRows(rows).filter((r) => r.photo)) {
      const product = created.find((p) => barcodesMatch(p.barcode, row.barcode));
      if (!product) continue;
      try {
        product.images = [await uploadPhoto(product.id, row.photo)];
      } catch {
        photoFailures += 1;
      }
    }
  }

  return { products: created, stockError: stockError || null, photoFailures };
};
