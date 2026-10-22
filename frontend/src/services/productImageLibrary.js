import { supabase } from './supabase';

// Photos that already exist for products, in this store or any other, so the
// Add/Edit Product forms can reuse one instead of uploading the same picture
// again. products.images and supplier_catalog_items.image_url already hold
// every uploaded URL, so this searches those rather than keeping a second
// index in sync. Nothing in the app deletes from the product-photos bucket,
// which is what makes several products sharing one file safe.

const DEFAULT_LIMIT = 36;
const FETCH_LIMIT = 120;

// PostgREST reads , ( ) * and quotes as syntax inside or()/ilike values, so
// search text is cut down to letters, numbers and hyphens.
const searchTokens = (term) => String(term || '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 5);

// Every word must appear in the name, brand or barcode (one or() group per word).
const matchEveryToken = (query, tokens) => tokens.reduce(
  (q, token) => q.or(`name.ilike.*${token}*,brand.ilike.*${token}*,barcode.ilike.*${token}*`),
  query
);

const firstImageUrl = (images) => {
  const url = (Array.isArray(images) ? images : []).find((u) => typeof u === 'string' && u.trim());
  return url ? url.trim() : null;
};

// Exact name first, then names that start with the search, then the rest.
const relevance = (entry, term) => {
  const name = entry.name.toLowerCase();
  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  return 2;
};

/**
 * Searches existing product photos by name, brand or barcode. An empty search
 * lists the photos in the catalog alphabetically. Several products using the
 * same file come back as one entry with `usedBy` counting them.
 *
 * Returns [{ url, name, brand, barcode, usedBy }].
 */
export const searchProductImages = async (term, { limit = DEFAULT_LIMIT } = {}) => {
  const tokens = searchTokens(term);

  // An empty photo list is stored as '[]', not NULL, so it has to be excluded explicitly.
  const productsQuery = matchEveryToken(
    supabase
      .from('products')
      .select('name, brand, barcode, images')
      .not('images', 'is', null)
      .neq('images', '[]')
      .order('name', { ascending: true })
      .limit(FETCH_LIMIT),
    tokens
  );
  const catalogQuery = matchEveryToken(
    supabase
      .from('supplier_catalog_items')
      .select('name, brand, barcode, image_url')
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .order('name', { ascending: true })
      .limit(FETCH_LIMIT),
    tokens
  );

  const [products, catalog] = await Promise.all([productsQuery, catalogQuery]);
  // The supplier catalog is a bonus source (its access rules differ); only fail when the main one does.
  if (products.error) throw products.error;
  if (catalog.error) console.warn('Supplier catalog photos unavailable:', catalog.error.message);

  const byUrl = new Map();
  const add = (url, row) => {
    if (!url) return;
    const entry = byUrl.get(url) || { url, name: row.name || '', brand: row.brand || '', barcode: row.barcode || '', usedBy: 0 };
    entry.usedBy += 1;
    byUrl.set(url, entry);
  };
  (products.data || []).forEach((row) => add(firstImageUrl(row.images), row));
  (catalog.data || []).forEach((row) => add(row.image_url?.trim(), row));

  const normalizedTerm = String(term || '').trim().toLowerCase();
  return Array.from(byUrl.values())
    .sort((a, b) => relevance(a, normalizedTerm) - relevance(b, normalizedTerm) || a.name.localeCompare(b.name))
    .slice(0, limit);
};

/**
 * Points a product at a photo that is already uploaded: no file is sent, the
 * shared URL is just saved on the product.
 */
export const attachExistingProductImage = async (productId, url) => {
  const { error } = await supabase
    .from('products')
    .update({ images: [url] })
    .eq('id', productId);
  if (error) throw error;
  return url;
};
