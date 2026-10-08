import { supabase } from './supabase';

// Stock on a business LAN server. Products are the read-only catalog mirrored from the cloud store;
// changes are made through business_local_adjust_stock(), which updates the local number straight
// away and queues the difference for the cloud (see local-sync-storage.sql).

export const STOCK_REASONS = {
  add: [
    ['received', 'Stock received'],
    ['returned', 'Customer return'],
    ['correction', 'Correction'],
  ],
  remove: [
    ['damaged', 'Damaged'],
    ['expired', 'Expired'],
    ['lost', 'Lost or stolen'],
    ['correction', 'Correction'],
  ],
  set: [['count', 'Stock count']],
};

export const REASON_LABELS = {
  received: 'Stock received',
  returned: 'Customer return',
  damaged: 'Damaged',
  expired: 'Expired',
  lost: 'Lost or stolen',
  correction: 'Correction',
  count: 'Stock count',
};

const unwrap = (data, error, fallback) => {
  if (error) throw new Error(error.message || fallback);
  if (!data?.success) throw new Error(data?.error || fallback);
  return data;
};

export async function listInventory() {
  const { data, error } = await supabase
    .from('business_local_catalog')
    .select('product_id,name,sku,barcode,selling_price,current_stock,minimum_stock,reorder_point,inventory_mode,stock_updated_at')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message || 'Could not load the product list.');
  return data || [];
}

// { [productId]: { delta, changes } } for changes the cloud has not confirmed yet
export async function getPendingStock() {
  const { data, error } = await supabase.rpc('business_local_pending_stock');
  const result = unwrap(data, error, 'Could not check which changes are waiting to sync.');
  return Object.fromEntries((result.pending || []).map((row) => [row.product_id, { delta: Number(row.delta), changes: Number(row.changes) }]));
}

export async function getStockHistory(productId, limit = 10) {
  const { data, error } = await supabase.rpc('business_local_stock_history', { p_product_id: productId, p_limit: limit });
  return unwrap(data, error, 'Could not load the stock history.').history || [];
}

// New products are created on this server straight away and queued for the cloud store. Prices and
// quantities are plain numbers; SKU and barcode are optional (a barcode is generated when blank).
export async function addProduct({ name, sellingPrice, sku, barcode, taxRate, initialStock, minimumStock, reorderPoint }) {
  const { data, error } = await supabase.rpc('business_local_add_product', {
    p_name: name,
    p_selling_price: sellingPrice,
    p_sku: sku || null,
    p_barcode: barcode || null,
    p_tax_rate: taxRate,
    p_initial_stock: initialStock,
    p_minimum_stock: minimumStock,
    p_reorder_point: reorderPoint,
  });
  return unwrap(data, error, 'Could not add the product.');
}

export async function adjustStock({ productId, mode, quantity, reason, note }) {
  const { data, error } = await supabase.rpc('business_local_adjust_stock', {
    p_product_id: productId,
    p_mode: mode,
    p_quantity: quantity,
    p_reason: reason,
    p_note: note || null,
  });
  return unwrap(data, error, 'Could not change the stock.');
}
