import { supabase } from './supabase';
import { compressImageFile } from '../utils/imageCompression';
import { isNetworkFailure } from './posOfflineCache';

const DB_NAME = 'DcePortalOfflineQueue';
const DB_VERSION = 2;
const STORE = 'mutations';
const META = 'meta';
const RETRY_INTERVAL_MS = 30 * 1000;

let dbPromise;
let syncing = false;

const makeId = () => globalThis.crypto?.randomUUID?.()
  || `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = null; reject(request.error); };
  });
  return dbPromise;
}

export async function enqueuePortalMutation(kind, userId, payload) {
  if (!kind || !userId) throw new Error('A signed-in account is required to save this change offline.');
  const db = await openDB();
  const record = { id: makeId(), kind, userId, payload, queuedAt: Date.now(), sequence: 0, attempts: 0 };
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, META], 'readwrite');
    const meta = tx.objectStore(META);
    const sequenceRequest = meta.get('sequence');
    sequenceRequest.onsuccess = () => {
      record.sequence = Number(sequenceRequest.result || 0) + 1;
      meta.put(record.sequence, 'sequence');
      tx.objectStore(STORE).add(record);
    };
    sequenceRequest.onerror = () => tx.abort();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || sequenceRequest.error);
    tx.onabort = () => reject(tx.error || sequenceRequest.error);
  });
  return record;
}

export async function getPendingPortalMutations(userId = null) {
  const db = await openDB();
  const records = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  return records
    .filter((record) => !userId || record.userId === userId)
    .sort((a, b) => a.queuedAt - b.queuedAt || a.sequence - b.sequence);
}

async function updateMutation(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function removeMutation(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function uploadQueuedProductPhoto(productId, mutationId, file) {
  if (!file) return null;
  const compressed = await compressImageFile(file, 1280, 0.8);
  const ext = compressed.name.split('.').pop() || 'jpg';
  const path = `${productId}/offline-${mutationId}.${ext}`;
  const { error } = await supabase.storage.from('product-photos')
    .upload(path, compressed, { upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl;
}

async function syncAdminProduct(record) {
  const { product, inventory, imageFile, batch } = record.payload;
  const { error: productError } = await supabase.from('products')
    .upsert(product, { onConflict: 'id' });
  if (productError) throw productError;

  if (inventory) {
    const { data: existingInventory, error: lookupError } = await supabase.from('inventory')
      .select('id')
      .eq('product_id', product.id)
      .eq('supermarket_id', inventory.supermarket_id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const write = existingInventory?.id
      ? supabase.from('inventory').update(inventory).eq('id', existingInventory.id)
      : supabase.from('inventory').insert(inventory);
    const { error: inventoryError } = await write;
    if (inventoryError) throw inventoryError;
  }

  const imageUrl = await uploadQueuedProductPhoto(product.id, record.id, imageFile);
  if (imageUrl) {
    const { error } = await supabase.from('products').update({ images: [imageUrl] }).eq('id', product.id);
    if (error) throw error;
  }

  if (batch?.batchNumber && batch.expiryDate) {
    const missingBatchSupport = (error) => error?.code === '42883' || error?.code === '42P01'
      || /add_product_batch|product_inventory_batches|does not exist|schema cache/i.test(error?.message || '');
    const { data: existing, error: lookupError } = await supabase.from('product_inventory_batches')
      .select('id').eq('product_id', product.id).eq('batch_number', batch.batchNumber).eq('expiry_date', batch.expiryDate).limit(1);
    if (lookupError && !missingBatchSupport(lookupError)) throw lookupError;
    if (lookupError) return;
    if (!existing?.length) {
      const { error } = await supabase.rpc('add_product_batch', {
        p_product_id: product.id,
        p_batch_number: batch.batchNumber,
        p_expiry_date: batch.expiryDate,
        p_quantity: batch.quantity,
        p_add_to_stock: false
      });
      if (error && !missingBatchSupport(error)) throw error;
    }
  }
}

async function syncAdminProductUpdate(record) {
  const { productId, supermarketId, updates, inventory, imageFile } = record.payload;
  const imageUrl = await uploadQueuedProductPhoto(productId, record.id, imageFile);
  const productUpdates = imageUrl ? { ...updates, images: [imageUrl] } : updates;
  const { error: productError } = await supabase.from('products').update(productUpdates).eq('id', productId);
  if (productError) throw productError;
  if (inventory) {
    const { data: existingInventory, error: lookupError } = await supabase.from('inventory')
      .select('id').eq('product_id', productId).eq('supermarket_id', supermarketId).maybeSingle();
    if (lookupError) throw lookupError;
    const write = existingInventory?.id
      ? supabase.from('inventory').update(inventory).eq('id', existingInventory.id)
      : supabase.from('inventory').insert({ ...inventory, product_id: productId, supermarket_id: supermarketId });
    const { error: inventoryError } = await write;
    if (inventoryError) throw inventoryError;
  }
}

async function syncSupplierCatalogSave(record) {
  const { saveSupplierCatalogItem } = await import('../utils/supplierCatalog');
  const result = await saveSupplierCatalogItem({ ...record.payload, itemId: record.payload.itemId || record.payload.editingId });
  if (!result?.id) throw new Error('The supplier catalog did not return a saved item.');
}

async function syncMutation(record) {
  const { payload } = record;
  switch (record.kind) {
    case 'admin-product-create':
      return syncAdminProduct(record);
    case 'admin-product-update':
      return syncAdminProductUpdate(record);
    case 'supplier-catalog-save':
      return syncSupplierCatalogSave(record);
    case 'supplier-catalog-update': {
      const { error } = await supabase.from('supplier_catalog_items')
        .update(payload.updates).eq('id', payload.itemId).eq('supplier_user_id', payload.supplierUserId);
      if (error) throw error;
      return;
    }
    case 'supplier-catalog-delete': {
      const { error } = await supabase.from('supplier_catalog_items')
        .delete().eq('id', payload.itemId).eq('supplier_user_id', payload.supplierUserId);
      if (error) throw error;
      return;
    }
    case 'supplier-catalog-batch-save': {
      const { error } = await supabase.from('supplier_catalog_batches')
        .upsert(payload.batch, { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'supplier-catalog-batch-delete': {
      const { error } = await supabase.from('supplier_catalog_batches')
        .delete().eq('id', payload.batch.id).eq('catalog_item_id', payload.itemId);
      if (error) throw error;
      return;
    }
    case 'supplier-profile-update': {
      const { data, error } = await supabase.from('users').update(payload.updates)
        .or(`auth_id.eq.${payload.authUserId},id.eq.${payload.authUserId}`).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Supplier profile was not updated.');
      return;
    }
    case 'supplier-payment-confirm': {
      const { confirmPayment } = await import('./supplierOrdersService');
      const result = await confirmPayment(payload.txnId, payload.confirmationNotes || '');
      if (!result?.success) {
        const { data: transaction, error } = await supabase.from('payment_transactions')
          .select('confirmed_by_supplier').eq('id', payload.txnId).maybeSingle();
        if (error || transaction?.confirmed_by_supplier !== true) throw new Error(result?.error || error?.message || 'Could not confirm payment.');
      }
      return;
    }
    case 'supplier-order-dispatch': {
      const { default: deliveriesService } = await import('./supplierDeliveriesService');
      const result = await deliveriesService.setOrderDispatched(payload.orderId, payload.dispatched);
      if (!result?.success) throw new Error(result?.error || 'Could not update delivery status.');
      return;
    }
    case 'supplier-order-quote': {
      const { error } = await supabase.rpc('supplier_submit_purchase_order_quote_v1', {
        p_order_id: payload.orderId,
        p_items: payload.items,
        p_notes: payload.notes || '',
      });
      if (error) {
        const { data: order, error: lookupError } = await supabase.from('purchase_orders')
          .select('supplier_quote_status, supplier_quote_items, supplier_quote_notes')
          .eq('id', payload.orderId).maybeSingle();
        if (lookupError) throw error;
        const sameItems = JSON.stringify(order?.supplier_quote_items || []) === JSON.stringify(payload.items || []);
        const sameNotes = (order?.supplier_quote_notes || '') === (payload.notes || '');
        if (['submitted', 'accepted', 'changes_requested'].includes(order?.supplier_quote_status) && sameItems && sameNotes) return;
        throw error;
      }
      return;
    }
    case 'supplier-order-confirm': {
      const updates = {
        status: 'confirmed',
        preferred_vehicle_type: payload.isOwnDelivery ? null : payload.vehicleType,
        delivery_method: payload.isOwnDelivery ? 'supplier_own_delivery' : 'supplier_delivery',
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('purchase_orders').update(updates).eq('id', payload.orderId).select('id').single();
      if (error) {
        const { data: order, error: lookupError } = await supabase.from('purchase_orders')
          .select('status, delivery_method, preferred_vehicle_type').eq('id', payload.orderId).maybeSingle();
        if (lookupError) throw error;
        if (['confirmed', 'received', 'completed'].includes(order?.status) && order.delivery_method === updates.delivery_method && order.preferred_vehicle_type === updates.preferred_vehicle_type) return;
        throw error;
      }
      return;
    }
    case 'supplier-order-reject': {
      const updates = { status: 'cancelled', cancellation_reason: payload.reason, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('purchase_orders').update(updates).eq('id', payload.orderId).select('id').single();
      if (error) {
        const { data: order, error: lookupError } = await supabase.from('purchase_orders')
          .select('status, cancellation_reason').eq('id', payload.orderId).maybeSingle();
        if (lookupError) throw error;
        if (order?.status === 'cancelled' && order.cancellation_reason === payload.reason) return;
        throw error;
      }
      return;
    }
    case 'supplier-delivery-confirm': {
      const { data, error } = await supabase.rpc('confirm_supplier_order_delivery', { p_order_id: payload.orderId });
      if (error) {
        // A request may have reached the server just before the connection
        // dropped. Treat an already-received order as the acknowledged retry.
        const { data: order } = await supabase.from('purchase_orders')
          .select('status, supplier_delivery_confirmed_at').eq('id', payload.orderId).maybeSingle();
        if (order?.supplier_delivery_confirmed_at || ['received', 'completed'].includes(order?.status)) return;
        throw error;
      }
      if (data?.success === false) throw new Error(data.error || 'Could not confirm delivery.');
      return;
    }
    default:
      throw new Error(`Unsupported offline change: ${record.kind}`);
  }
}

// Replays queued writes only as the same account that created them. This
// matters on shared till devices where an admin and a supplier may both sign in.
export async function syncPortalOfflineMutations() {
  if (syncing || !navigator.onLine) return { synced: 0, blockedAdminProducts: false };
  syncing = true;
  let synced = 0;
  let blockedAdminProducts = false;
  try {
    const pendingForDevice = await getPendingPortalMutations();
    blockedAdminProducts = pendingForDevice.some((record) =>
      record.kind === 'admin-product-create' || record.kind === 'admin-product-update'
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { synced, blockedAdminProducts };
    const records = pendingForDevice.filter((record) => record.userId === user.id);

    for (const record of records) {
      try {
        await syncMutation(record);
        await removeMutation(record.id);
        synced += 1;
        window.dispatchEvent(new CustomEvent('portal-offline-mutation-synced', {
          detail: { kind: record.kind, userId: record.userId, payload: record.payload }
        }));
      } catch (error) {
        const updated = { ...record, attempts: (record.attempts || 0) + 1, lastError: error?.message || 'Sync failed' };
        await updateMutation(updated);
        console.warn(`[Portal offline sync] ${record.kind} remains queued:`, updated.lastError);
        if (record.kind === 'admin-product-create' || record.kind === 'admin-product-update') blockedAdminProducts = true;
        if (isNetworkFailure(error)) break;
      }
    }
    const stillPending = await getPendingPortalMutations();
    blockedAdminProducts = stillPending.some((record) =>
      record.kind === 'admin-product-create' || record.kind === 'admin-product-update'
    );
    if (synced) window.dispatchEvent(new Event('portal-offline-sync-complete'));
    return { synced, blockedAdminProducts };
  } finally {
    syncing = false;
  }
}

export function startPortalOfflineSync() {
  const run = () => syncPortalOfflineMutations().catch((error) => {
    console.warn('[Portal offline sync] Retry failed:', error);
  });
  window.addEventListener('online', run);
  const timer = setInterval(run, RETRY_INTERVAL_MS);
  run();
  return () => {
    window.removeEventListener('online', run);
    clearInterval(timer);
  };
}
