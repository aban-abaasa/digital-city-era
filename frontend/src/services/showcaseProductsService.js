import { supabase } from './supabase';

// Public, read-only sample of real stock across every onboarded supermarket
// — used to give landing-page visitors a "different products" preview
// before they sign in. Same shared products/inventory/categories/supermarkets
// tables mybodaguy's ProductPicker reads (see vendor/mybodaguy/services/productService.ts).
export async function getShowcaseProducts(limit = 24) {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, supermarket_id, name, selling_price, images, sku, categories(name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!products || products.length === 0) return [];

  const ids = products.map((p) => p.id);
  const { data: inventoryRows } = await supabase
    .from('inventory')
    .select('product_id, current_stock, reserved_stock')
    .in('product_id', ids);

  const stockByProduct = new Map();
  (inventoryRows || []).forEach((inv) => {
    stockByProduct.set(inv.product_id, Math.max(0, Number(inv.current_stock || 0) - Number(inv.reserved_stock || 0)));
  });

  // Not embedded via PostgREST relationship syntax (products.supermarket_id
  // has no discoverable FK to supermarkets in the schema cache) — looked up
  // separately instead, same pattern as the inventory join above.
  const supermarketIds = [...new Set(products.map((p) => p.supermarket_id).filter(Boolean))];
  const { data: supermarketRows } = supermarketIds.length
    ? await supabase.from('supermarkets').select('id, name').in('id', supermarketIds)
    : { data: [] };
  const nameBySupermarket = new Map((supermarketRows || []).map((s) => [s.id, s.name]));

  return products
    .map((p) => {
      const images = Array.isArray(p.images) ? p.images : [];
      return {
        id: p.id,
        supermarketId: p.supermarket_id,
        name: p.name,
        priceUgx: Number(p.selling_price) || 0,
        imageUrl: images[0] || null,
        category: p.categories?.name ?? null,
        storeName: nameBySupermarket.get(p.supermarket_id) ?? 'Supermartkera store',
        stock: stockByProduct.get(p.id) ?? 0,
      };
    })
    .filter((p) => p.stock > 0);
}
