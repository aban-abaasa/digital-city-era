import { supabase } from '../services/supabase';
import { compressImageFile } from './imageCompression';

// One vocabulary for everything that touches the supplier catalog — the
// shared Add/Edit Item form, the catalog list, and store applications.
export const SUPPLIER_CATALOG_CATEGORIES = [
  'Fresh Produce', 'Dairy', 'Meat & Poultry', 'Beverages', 'Bakery',
  'Grains & Cereals', 'Snacks', 'Household', 'Personal Care', 'Frozen Foods',
  'Spices & Condiments', 'Electronics', 'Clothing', 'Hardware & Tools',
  'Building Materials', 'Raw Materials', 'Professional Services', 'Transport & Logistics', 'Other',
];
export const SUPPLIER_CATALOG_UNITS = ['kg', 'piece', 'litre', 'box', 'bag', 'crate', 'dozen', 'pack'];

const PRODUCT_IMAGE_BUCKET = 'product-photos';

// Maps a supplier_catalog_items row onto the shared form's field names, so the
// admin's Add Product form can edit a catalog item as-is.
export const catalogItemToFormData = (item) => ({
  name: item.name || '',
  description: item.description || '',
  category_id: item.category || '',
  unit: item.unit || 'kg',
  min_order_qty: String(item.min_order_qty ?? 1),
  selling_price: item.price_per_unit != null ? String(item.price_per_unit) : '',
  cost_price: item.cost_price != null ? String(item.cost_price) : '0',
  sku: item.sku || '',
  barcode: item.barcode || '',
  brand: item.brand || '',
  tax_rate: item.tax_rate != null ? String(item.tax_rate) : '18',
  initial_stock: String(item.stock_quantity ?? 0),
  minimum_stock: String(item.minimum_stock ?? 10),
  images: item.image_url ? [item.image_url] : [],
  price_tiers: Array.isArray(item.price_tiers) ? item.price_tiers : [],
});

/**
 * Saves the shared Add/Edit Item form into the supplier catalog — the table
 * supermarkets read when ordering (OrderItemsSelector), not any store's stock.
 *
 * Core columns exist on every deployment; the extra product fields (SKU,
 * barcode, brand, cost, tax, stock, price tiers) need
 * ADD_SUPPLIER_CATALOG_FULL_PRODUCT_FIELDS.sql. If that hasn't been run yet the
 * item is still saved with the core fields, and `extrasSaved` is false so the
 * caller can say so instead of silently dropping data.
 */
export const saveSupplierCatalogItem = async ({ supplierUserId, editingId, form, priceTiers, imageFile, existingImageUrl }) => {
  if (!supplierUserId) throw new Error('Your supplier profile is still loading — try again in a moment');

  let imageUrl = existingImageUrl || null;
  if (imageFile) {
    const compressed = await compressImageFile(imageFile, 1280, 0.8);
    const ext = compressed.name.split('.').pop() || 'jpg';
    const path = `supplier-catalog/${supplierUserId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, compressed, { upsert: true, cacheControl: '31536000' });
    if (uploadError) throw uploadError;
    imageUrl = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const price = parseFloat(form.selling_price);
  const core = {
    supplier_user_id: supplierUserId,
    name: form.name.trim(),
    category: form.category_id || 'Other',
    description: form.description?.trim() || null,
    unit: form.unit || 'kg',
    min_order_qty: Number(form.min_order_qty) || 1,
    // Blank/0 means "negotiable" in the buyer's catalog view.
    price_per_unit: price > 0 ? price : null,
    image_url: imageUrl,
    ...(editingId ? {} : { is_available: true }),
  };
  const extras = {
    sku: form.sku?.trim() || null,
    barcode: form.barcode?.trim() || null,
    brand: form.brand?.trim() || null,
    cost_price: parseFloat(form.cost_price) || 0,
    tax_rate: parseFloat(form.tax_rate) || 0,
    stock_quantity: parseInt(form.initial_stock, 10) || 0,
    minimum_stock: parseInt(form.minimum_stock, 10) || 0,
    price_tiers: (priceTiers || []).filter((t) => Number(t.min_quantity) > 0 && Number(t.unit_price) > 0),
  };

  const write = (payload) => (editingId
    ? supabase.from('supplier_catalog_items').update(payload).eq('id', editingId).select('id').single()
    : supabase.from('supplier_catalog_items').insert(payload).select('id').single());

  let { data, error } = await write({ ...core, ...extras });
  let extrasSaved = true;
  if (error && /column|schema cache/i.test(error.message || '')) {
    ({ data, error } = await write(core));
    extrasSaved = false;
  }
  if (error) throw error;
  return { id: data?.id || editingId, extrasSaved };
};
