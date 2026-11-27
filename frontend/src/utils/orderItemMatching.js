// Matches a supplier order line to a product in ONE store.
//
// Supplier names rarely equal the names a store saved ("Coca Cola 500ml" vs "COKE PET 0.5L"),
// so the barcode decides. Order of preference, always inside the store's own catalogue:
//   1. barcode (any UPC-A / EAN-13 / GTIN-14 form of the same code)
//   2. SKU
//   3. product_id the line was picked from (only if it belongs to this store)
//   4. name, case/space-insensitive - optional last resort for lines that carry no code
// A miss is not an error: the caller creates the product for this store only.

import { barcodeVariants } from './barcodeHelper';
import { generateStoreBarcode, isPlaceholderBarcode } from './storeBarcodes';

const PRODUCT_COLUMNS = 'id, name, sku, barcode, supermarket_id, inventory (id, current_stock, minimum_stock)';

const clean = (value) => String(value ?? '').trim();

// The code printed on the supplier's item, whatever field the order screen stored it in
export const orderItemBarcode = (item = {}) => {
  const code = clean(item.barcode) || clean(item.product_data?.barcode) || clean(item.bar_code);
  return isPlaceholderBarcode(code) ? '' : code;
};

export const orderItemName = (item = {}) => clean(item.product_name ?? item.productName ?? item.name);

export const orderItemSku = (item = {}) => clean(item.sku) || clean(item.product_data?.sku);

const inStore = (query, supermarketId) => (supermarketId ? query.eq('supermarket_id', supermarketId) : query);

// -> { product, matchedBy: 'barcode' | 'sku' | 'id' | 'name' } or null
export const findStoreProductForOrderItem = async (supabase, { supermarketId, item }) => {
  const barcode = orderItemBarcode(item);
  if (barcode) {
    const { data, error } = await inStore(
      supabase.from('products').select(PRODUCT_COLUMNS).in('barcode', barcodeVariants(barcode)),
      supermarketId
    ).limit(1);
    if (error) throw error;
    if (data?.[0]) return { product: data[0], matchedBy: 'barcode' };
  }

  const sku = orderItemSku(item);
  if (sku) {
    const { data, error } = await inStore(supabase.from('products').select(PRODUCT_COLUMNS).eq('sku', sku), supermarketId).limit(1);
    if (error) throw error;
    if (data?.[0]) return { product: data[0], matchedBy: 'sku' };
  }

  // Only a real product uuid; sample/fallback rows use small integers
  const productId = clean(item.product_id);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    const { data, error } = await inStore(supabase.from('products').select(PRODUCT_COLUMNS).eq('id', productId), supermarketId).limit(1);
    if (error) throw error;
    if (data?.[0]) return { product: data[0], matchedBy: 'id' };
  }

  const name = orderItemName(item);
  if (name) {
    // Escape LIKE wildcards so "100%" or "a_b" match literally
    const pattern = name.replace(/[\\%_]/g, (char) => `\\${char}`);
    const { data, error } = await inStore(supabase.from('products').select(PRODUCT_COLUMNS).ilike('name', pattern), supermarketId).limit(1);
    if (error) throw error;
    if (data?.[0]) return { product: data[0], matchedBy: 'name' };
  }

  return null;
};

// A new store product from an order line. Keeps the supplier's barcode so the next order
// matches it; if the database already holds that code (barcodes are still unique across
// stores until ALLOW_SAME_BARCODE_PER_STORE.sql is run) the store gets its own code instead.
export const createStoreProductForOrderItem = async (supabase, { supermarketId, item, orderRef = '' }) => {
  const unitPrice = Number(item.unit_price ?? item.unitPrice) || 0;
  const supplierBarcode = orderItemBarcode(item);
  const name = orderItemName(item) || (supplierBarcode ? `Product - ${supplierBarcode}` : 'Unnamed product');
  const expiryDate = clean(item.expiry_date ?? item.expiryDate);
  const imageUrl = clean(item.image_url || item.product_data?.image_url || (Array.isArray(item.images) ? item.images[0] : ''));
  const makeSku = () => `SUP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`.toUpperCase();

  const row = {
    name,
    ...(supermarketId ? { supermarket_id: supermarketId } : {}),
    price: unitPrice,
    selling_price: unitPrice,
    cost_price: unitPrice,
    description: `Added from supplier order ${orderRef}`.trim(),
    markup_percentage: 0,
    ...(imageUrl ? { images: [imageUrl] } : {}),
    ...(expiryDate ? { expiry_date: expiryDate } : {})
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const barcode = attempt === 0 && supplierBarcode
      ? supplierBarcode
      : generateStoreBarcode({ supermarketId });
    // SKUs are globally unique in older store databases, so a supplier SKU
    // collision also needs a store-local generated SKU on the retry.
    const sku = attempt === 0 && orderItemSku(item) ? orderItemSku(item) : makeSku();
    const result = await supabase.from('products').insert({ ...row, sku, barcode }).select('id, name, barcode, sku').single();
    if (!result.error) return result.data;
    if (result.error.code !== '23505') throw result.error;
  }
  throw new Error(`Could not create a unique store product for ${name}`);
};
