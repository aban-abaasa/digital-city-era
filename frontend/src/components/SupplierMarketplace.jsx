import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { FiStar } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { enqueuePortalMutation } from '../services/portalOfflineQueue';
import { isNetworkFailure, loadPortalSnapshot, savePortalSnapshot } from '../services/posOfflineCache';
import AddProductModal from './AddProductModal';
import {
  SUPPLIER_CATALOG_CATEGORIES as CATEGORIES,
  catalogItemToFormData
} from '../utils/supplierCatalog';
import SupplierBatchManager from './SupplierBatchManager';
import StablePricePanel from './StablePricePanel';
import StableCoinStyles from '../styles/StableCoinStyles';
import { refreshStablePricesQuietly, countUnseenChanges } from '../services/stablePricingService';
import { describeChanges } from '../utils/stablePricing';
import {
  catalogItemOffer,
  groupBatchesByItem,
  formatExpiryDate,
  isMissingBatchTable
} from '../utils/supplierBatchExpiry';

// ── shared helpers ─────────────────────────────────────────────────────────────
const fmtUGX = n => n ? 'UGX ' + Number(n).toLocaleString() : '—';

// ─── MY CATALOG TAB ───────────────────────────────────────────────────────────
export function SupplierCatalogTab({ userId, cacheUserId = userId }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeProductSearch, setStoreProductSearch] = useState('');
  const [storeProductMatches, setStoreProductMatches] = useState([]);
  const [searchingStoreProducts, setSearchingStoreProducts] = useState(false);
  const [storeProductSearchError, setStoreProductSearchError] = useState('');
  // Adding and editing both use the shared full Add Product form (the one the
  // admin portal uses) in supplier mode; `modal.item` is null for a new item.
  const [modal, setModal]     = useState({ open: false, item: null, sourceProductId: null, prefilledData: {} });
  // Batches (each with its own expiry date) per catalog item, and the item
  // whose batch manager is open.
  const [batches, setBatches]   = useState([]);
  const [batchItemId, setBatchItemId] = useState(null);
  // Stable price (ICEC-S): the tab, and how many shilling-price changes the supplier hasn't acknowledged yet.
  const [showStable, setShowStable] = useState(false);
  const [unseenPriceChanges, setUnseenPriceChanges] = useState(0);
  const priceChangesAnnounced = useRef(false);

  useEffect(() => { load(); }, [userId, cacheUserId]);

  useEffect(() => {
    const search = storeProductSearch.trim();
    if (search.length < 2) {
      setStoreProductMatches([]);
      setSearchingStoreProducts(false);
      setStoreProductSearchError('');
      return undefined;
    }
    if (!navigator.onLine) {
      setStoreProductMatches([]);
      setSearchingStoreProducts(false);
      setStoreProductSearchError('Connect to the internet to search store products.');
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setSearchingStoreProducts(true);
      setStoreProductSearchError('');
      try {
        // Product names and barcodes are shared from active store products.
        // Price and stock are deliberately collected in the supplier's own listing.
        const [nameResult, barcodeResult] = await Promise.all([
          supabase.from('products').select('id, name, barcode').eq('is_active', true)
            .ilike('name', `%${search}%`).order('name', { ascending: true }).limit(30),
          supabase.from('products').select('id, name, barcode').eq('is_active', true)
            .ilike('barcode', `%${search}%`).order('name', { ascending: true }).limit(30),
        ]);
        if (nameResult.error) throw nameResult.error;
        if (barcodeResult.error) throw barcodeResult.error;

        if (active) {
          const unique = new Map();
          [...(nameResult.data || []), ...(barcodeResult.data || [])].forEach((product) => {
            if (!product.name?.trim()) return;
            const key = `${product.name.trim().toLocaleLowerCase()}\u0000${String(product.barcode || '').trim()}`;
            if (!unique.has(key)) unique.set(key, product);
          });
          setStoreProductMatches([...unique.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20));
        }
      } catch (error) {
        if (active) {
          console.warn('Could not search store products:', error);
          setStoreProductMatches([]);
          setStoreProductSearchError(error.message || 'Could not search store products.');
        }
      } finally {
        if (active) setSearchingStoreProducts(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [storeProductSearch]);

  useEffect(() => {
    const handleSynced = (event) => {
      if (event.detail?.userId === cacheUserId && String(event.detail?.kind || '').startsWith('supplier-catalog-')) load();
    };
    window.addEventListener('portal-offline-mutation-synced', handleSynced);
    return () => window.removeEventListener('portal-offline-mutation-synced', handleSynced);
  }, [cacheUserId]);

  const load = async () => {
    setLoading(true);
    if (!userId || !cacheUserId) { setLoading(false); return; }
    if (!navigator.onLine) {
      const cached = await loadPortalSnapshot('supplier', cacheUserId, 'supplier-catalog');
      const cachedBatches = await loadPortalSnapshot('supplier', cacheUserId, 'supplier-catalog-batches');
      setItems(cached?.value || []);
      setBatches(cachedBatches?.value || []);
      setLoading(false);
      return;
    }
    try {
      // Items priced in ICEC-S (the stable coin) get today's shilling price before the list is read.
      // Throttled, silent, and a no-op for a supplier who doesn't use it.
      const repriced = await refreshStablePricesQuietly('catalog', userId);
      if (repriced?.changes?.length) {
        priceChangesAnnounced.current = true;
        toast.info(`${describeChanges(repriced.changes, repriced.rate)} Open Stable price to review.`, {
          autoClose: 12000,
          onClick: () => setShowStable(true),
        });
      }
      const { data, error } = await supabase
        .from('supplier_catalog_items')
        .select('*')
        .eq('supplier_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
      await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog', data || []);
      setLoading(false);
      await loadBatches((data || []).map(item => item.id));

      // How many price changes from ICEC-S the supplier hasn't seen yet. Changes made while they were away
      // (the scheduled repricer) are announced once per visit.
      const unseen = await countUnseenChanges('catalog', userId);
      setUnseenPriceChanges(unseen);
      if (unseen > 0 && !priceChangesAnnounced.current) {
        priceChangesAnnounced.current = true;
        toast.info(`${unseen} shilling price change${unseen === 1 ? '' : 's'} from ICEC-S since you last looked. Open Stable price to review.`, {
          autoClose: 12000,
          onClick: () => setShowStable(true),
        });
      }
    } catch (error) {
      if (isNetworkFailure(error)) {
        const cached = await loadPortalSnapshot('supplier', cacheUserId, 'supplier-catalog');
        const cachedBatches = await loadPortalSnapshot('supplier', cacheUserId, 'supplier-catalog-batches');
        setItems(cached?.value || []);
        setBatches(cachedBatches?.value || []);
      } else toast.error(error.message || 'Could not load supplier catalog');
      setLoading(false);
    }
  };

  const loadBatches = async (itemIds) => {
    if (!itemIds.length) {
      setBatches([]);
      if (navigator.onLine) await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog-batches', []);
      return;
    }
    if (!navigator.onLine) {
      const cached = await loadPortalSnapshot('supplier', cacheUserId, 'supplier-catalog-batches');
      setBatches((cached?.value || []).filter((batch) => itemIds.includes(batch.catalog_item_id)));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('supplier_catalog_batches')
        .select('*')
        .in('catalog_item_id', itemIds);
      if (error) {
        // Table not created yet: the catalog still works, just without batches.
        if (!isMissingBatchTable(error)) throw error;
        setBatches([]);
        await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog-batches', []);
        return;
      }
      setBatches(data || []);
      await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog-batches', data || []);
    } catch (error) {
      if (isNetworkFailure(error)) {
        const cached = await loadPortalSnapshot('supplier', cacheUserId, 'supplier-catalog-batches');
        setBatches(cached?.value || []);
      } else {
        console.warn('Could not load batches:', error.message);
        setBatches([]);
      }
    }
  };

  const openNew = () => setModal({ open: true, item: null, sourceProductId: null, prefilledData: {} });
  const openEdit = (item) => setModal({ open: true, item, sourceProductId: null, prefilledData: {} });
  const openFromStoreProduct = (product) => setModal({
    open: true,
    item: null,
    sourceProductId: product.id,
    prefilledData: { name: product.name || '', barcode: product.barcode || '' },
  });
  const closeModal = () => setModal({ open: false, item: null, sourceProductId: null, prefilledData: {} });

  const listedStoreProduct = (product) => items.find((item) => {
    const sourceBarcode = String(product.barcode || '').trim();
    const itemBarcode = String(item.barcode || '').trim();
    if (sourceBarcode && itemBarcode) return sourceBarcode === itemBarcode;
    return String(item.name || '').trim().toLocaleLowerCase() === String(product.name || '').trim().toLocaleLowerCase();
  });

  const toggle = async (item) => {
    const updates = { is_available: !item.is_available };
    if (!navigator.onLine) {
      await enqueuePortalMutation('supplier-catalog-update', cacheUserId, { supplierUserId: userId, itemId: item.id, updates });
      const updated = items.map((entry) => entry.id === item.id ? { ...entry, ...updates, offline_pending_sync: true } : entry);
      setItems(updated);
      await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog', updated);
      return;
    }
    const { error } = await supabase.from('supplier_catalog_items').update(updates).eq('id', item.id);
    if (error && isNetworkFailure(error)) {
      await enqueuePortalMutation('supplier-catalog-update', cacheUserId, { supplierUserId: userId, itemId: item.id, updates });
      const updated = items.map((entry) => entry.id === item.id ? { ...entry, ...updates, offline_pending_sync: true } : entry);
      setItems(updated);
      await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog', updated);
      return;
    }
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (id) => {
    if (!navigator.onLine) {
      await enqueuePortalMutation('supplier-catalog-delete', cacheUserId, { supplierUserId: userId, itemId: id });
      const updated = items.filter((item) => item.id !== id);
      setItems(updated);
      await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog', updated);
      return;
    }
    const { error } = await supabase.from('supplier_catalog_items').delete().eq('id', id);
    if (error && isNetworkFailure(error)) {
      await enqueuePortalMutation('supplier-catalog-delete', cacheUserId, { supplierUserId: userId, itemId: id });
      const updated = items.filter((item) => item.id !== id);
      setItems(updated);
      await savePortalSnapshot('supplier', cacheUserId, 'supplier-catalog', updated);
      return;
    }
    if (error) { toast.error(error.message); return; }
    load();
    toast.success('Item removed');
  };

  const batchesByItem = groupBatchesByItem(batches);
  const offers = Object.fromEntries(items.map(item => [item.id, catalogItemOffer(item, batchesByItem[item.id])]));
  const flaggedItems = items.filter(item => offers[item.id].flaggedCount > 0 || offers[item.id].expiredCount > 0);
  const batchItem = items.find(item => item.id === batchItemId) || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            className="inline-flex items-center gap-2 border border-[#c4a052] bg-gradient-to-r from-[#fff8dc] via-[#e9cd78] to-[#fff8dc] px-4 py-2 text-[#705719] shadow-sm"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 88% 88%, 12% 88%, 0 100%)' }}
          >
            <FiStar className="h-5 w-5 fill-current" aria-hidden="true" />
            <h2 className="text-lg font-bold">Own your supplies</h2>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            List everything you can supply. Supermarkets browse this when reviewing your applications.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StableCoinStyles />
          <button
            type="button"
            onClick={() => setShowStable(v => !v)}
            aria-pressed={showStable}
            title="Fix your prices in the stable coin (ICEC-S) so inflation can't eat your margin"
            className={`sc-scope sc-supplier sc-btn inline-flex items-center gap-1.5 whitespace-nowrap ${showStable ? 'sc-btn-on' : ''}`}
          >
            <span aria-hidden="true">🪙</span>
            <span>Stable price</span>
            {unseenPriceChanges > 0 && (
              <span
                className="sc-badge-count rounded-full px-1.5 text-[10px] font-bold leading-4"
                aria-label={`${unseenPriceChanges} new price changes`}
              >
                {unseenPriceChanges > 99 ? '99+' : unseenPriceChanges}
              </span>
            )}
          </button>
          <button onClick={openNew}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-xl hover:opacity-90">
            + Add Item
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="store-product-search-title">
        <div>
          <h3 id="store-product-search-title" className="text-base font-semibold text-gray-800">Find a store product</h3>
          <p className="mt-1 text-sm text-gray-500">Search products already listed by stores using a name or barcode, then add one to your supply catalog.</p>
        </div>
        <label htmlFor="supplier-store-product-search" className="sr-only">Search store products by name or barcode</label>
        <input
          id="supplier-store-product-search"
          type="search"
          value={storeProductSearch}
          onChange={(event) => setStoreProductSearch(event.target.value)}
          placeholder="Type a product name or barcode"
          className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
        />
        {storeProductSearch.trim().length < 2 ? (
          <p className="mt-2 text-xs text-gray-400">Enter at least 2 characters to search.</p>
        ) : searchingStoreProducts ? (
          <p className="mt-3 text-sm text-gray-500" role="status">Searching store products…</p>
        ) : storeProductSearchError ? (
          <p className="mt-3 text-sm text-amber-700" role="status">{storeProductSearchError}</p>
        ) : storeProductMatches.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No matching store products found. You can still use “Add Item” to create a listing.</p>
        ) : (
          <div className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
            {storeProductMatches.map((product) => {
              const existingItem = listedStoreProduct(product);
              return (
                <div key={`${product.id}-${product.barcode || ''}`} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{product.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">Barcode: {product.barcode || 'Not listed'}</p>
                  </div>
                  {existingItem ? (
                    <button type="button" onClick={() => openEdit(existingItem)} className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                      Edit listing
                    </button>
                  ) : (
                    <button type="button" onClick={() => openFromStoreProduct(product)} className="shrink-0 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700">
                      Add to catalog
                    </button>
                  )}
                </div>
              );
            })}
            <p className="bg-gray-50 px-3 py-2 text-xs text-gray-500 sm:px-4">Showing up to 20 matching products. Refine your search to find more.</p>
          </div>
        )}
      </section>

      {/* Stable price: keep what you supply on the stable coin, and see every shilling change it causes */}
      {showStable && (
        <StablePricePanel
          kind="catalog"
          scopeId={userId}
          onChanged={load}
          onUnseenChange={setUnseenPriceChanges}
          onClose={() => setShowStable(false)}
        />
      )}

      {/* Near-expiry flags: batches inside the flag window are discounted for buyers automatically */}
      {flaggedItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">⏰ {flaggedItems.length} item{flaggedItems.length > 1 ? 's have' : ' has'} batches close to expiry</p>
          <p className="text-xs text-amber-800 mt-0.5">Discounts update by themselves every day. Open Batches to change an expiry date or the discount.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {flaggedItems.map(item => {
              const offer = offers[item.id];
              return (
                <button key={item.id} onClick={() => setBatchItemId(item.id)}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                  {item.name}
                  {offer.first ? ` · ${offer.first.status.label}` : ' · expired'}
                  {offer.percent > 0 ? ` · −${offer.percent}%` : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Catalog list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading catalog…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-gray-600 font-medium">No items in your catalog yet</p>
          <p className="text-sm text-gray-400 mt-1">Add what you supply so supermarkets can see your offerings</p>
          <button onClick={openNew}
            className="mt-4 px-6 py-2 bg-purple-500 text-white text-sm font-semibold rounded-xl hover:bg-purple-600">
            Add First Item
          </button>
        </div>
      ) : (
        <div className="supplier-catalog-list">
          {items.map(item => {
            const offer = offers[item.id];
            const nearest = offer.first;
            const priceLabel = offer.onOffer
              ? `${fmtUGX(offer.price)}/${item.unit}`
              : (item.price_per_unit ? `${fmtUGX(item.price_per_unit)}/${item.unit}` : 'Negotiable');
            return (
              <details key={item.id} className="supplier-catalog-row">
                <summary className="supplier-catalog-summary">
                  {item.image_url
                    ? <img src={item.image_url} alt="" loading="lazy" className="supplier-catalog-summary-image" />
                    : <span className="supplier-catalog-summary-image supplier-catalog-summary-placeholder" aria-hidden="true">Item</span>}
                  <span className="supplier-catalog-summary-copy">
                    <span className="supplier-catalog-summary-name">{item.name}</span>
                    <span className="supplier-catalog-summary-meta">{item.category || 'Uncategorized'} · {priceLabel}</span>
                  </span>
                  <span className={`supplier-catalog-availability ${item.is_available ? 'is-available' : 'is-hidden'}`}>
                    {item.is_available ? 'Available' : 'Hidden'}
                  </span>
                  <svg className="supplier-catalog-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>

                <div className="supplier-catalog-details">
                  <div className="supplier-catalog-detail-heading">
                    <div>
                      <p className="supplier-catalog-detail-category">{item.category || 'Uncategorized'}</p>
                      <p className="supplier-catalog-barcode">
                        {item.barcode ? `Barcode ${item.barcode}` : 'Barcode not set'}{item.sku ? ` · SKU ${item.sku}` : ''}
                      </p>
                    </div>
                    <p className="supplier-catalog-detail-price">
                      {offer.onOffer && <span className="supplier-catalog-old-price">{fmtUGX(item.price_per_unit)}</span>}
                      {priceLabel}
                    </p>
                  </div>

                  {item.description && <p className="supplier-catalog-description">{item.description}</p>}
                  {(item.brand || item.stock_quantity != null || (Array.isArray(item.price_tiers) && item.price_tiers.length > 0)) && (
                    <div className="supplier-catalog-tags">
                      {item.brand && <span>{item.brand}</span>}
                      {item.stock_quantity != null && <span>{item.stock_quantity} in stock</span>}
                      {Array.isArray(item.price_tiers) && item.price_tiers.length > 0 && <span>{item.price_tiers.length} bulk price tiers</span>}
                    </div>
                  )}
                  {item.price_unit === 'ICEC_S' && Number(item.stable_price) > 0 && (
                    <span className="sc-scope sc-supplier sc-pill sc-pill-ok supplier-catalog-stable-price">
                      {Number(item.stable_price)} ICEC-S stable price
                    </span>
                  )}

                  <div className="supplier-catalog-detail-row">
                    <span>Minimum order: <b>{item.min_order_qty} {item.unit}</b></span>
                    <span>
                      {nearest
                        ? <>Next expiry: <b className={nearest.flagged ? 'text-amber-700' : 'text-gray-700'}>{formatExpiryDate(nearest.batch.expiry_date)}</b>
                            {offer.percent > 0 && <b className="text-purple-700"> · {offer.percent}% off</b>}</>
                        : offer.rows.length ? 'All batches expired' : 'No batches tracked'}
                    </span>
                  </div>

                  <div className="supplier-catalog-actions">
                    <button type="button" onClick={() => setBatchItemId(item.id)} className="supplier-catalog-action-primary">
                      Manage batches{offer.rows.length ? ` (${offer.rows.length})` : ''}
                    </button>
                    <button type="button" onClick={() => openEdit(item)} className="supplier-catalog-action-secondary">Edit item</button>
                    <button type="button" onClick={() => toggle(item)} className="supplier-catalog-action-secondary">
                      {item.is_available ? 'Hide from buyers' : 'Make available'}
                    </button>
                    <button type="button" onClick={() => remove(item.id)} className="supplier-catalog-action-danger">Remove</button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
      {batchItem && (
        <SupplierBatchManager
          item={batchItem}
          batches={batchesByItem[batchItem.id] || []}
          cacheUserId={cacheUserId}
          onClose={() => setBatchItemId(null)}
          onChanged={() => loadBatches(items.map(item => item.id))}
        />
      )}

      <AddProductModal
        key={modal.item?.id || modal.sourceProductId || 'new-catalog-item'}
        isOpen={modal.open}
        onClose={closeModal}
        mode="supplier"
        enableCatalogProductSuggestions
        supplierUserId={userId}
        supplierAuthId={cacheUserId}
        editingProductId={modal.item?.id || null}
        prefilledData={modal.item ? catalogItemToFormData(modal.item) : modal.prefilledData}
        onProductAdded={load}
      />
    </div>
  );
}

// ─── APPLY TO STORES TAB ──────────────────────────────────────────────────────
export function SupplierApplicationsTab({ userId, supplierProfile = null }) {
  const [stores, setStores]   = useState([]);
  const [myApps, setMyApps]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);  // supermarket id being applied to
  const [supplierDefaults, setSupplierDefaults] = useState(null);
  const [form, setForm]         = useState({
    business_name: '', contact_name: '', contact_phone: '', contact_email: '',
    product_categories: [], message: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleCat = (cat) => setForm(f => ({
    ...f,
    product_categories: f.product_categories.includes(cat)
      ? f.product_categories.filter(c => c !== cat)
      : [...f.product_categories, cat],
  }));

  useEffect(() => {
    loadAll();
    loadSupplierDefaults();
  }, [userId, supplierProfile]);

  const loadSupplierDefaults = async () => {
    if (!userId) return null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUserId = authData?.user?.id || userId;
      const results = await Promise.allSettled([
        supabase.from('suppliers')
          .select('company_name, contact_email, contact_phone')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.from('business_profiles')
          .select('id, business_name, business_type')
          .eq('user_id', authUserId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const supplier = results[0].status === 'fulfilled' ? results[0].value.data : null;
      const business = results[1].status === 'fulfilled' ? results[1].value.data : null;

      const defaults = {
        business_name: supplierProfile?.name || business?.business_name || supplier?.company_name || '',
        contact_name: supplierProfile?.contactPerson || authData?.user?.user_metadata?.full_name || '',
        contact_phone: supplierProfile?.phone || supplier?.contact_phone || '',
        contact_email: supplierProfile?.email || supplier?.contact_email || authData?.user?.email || '',
        product_categories: CATEGORIES.includes(supplierProfile?.category)
          ? [supplierProfile.category]
          : [],
        message: '',
        business_type: business?.business_type || 'Sole Proprietorship',
        business_profile_id: business?.id || null,
      };
      setSupplierDefaults(defaults);
      return defaults;
    } catch (error) {
      console.warn('Could not load supplier application defaults:', error.message);
      return null;
    }
  };

  const loadAll = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: sm }, { data: apps }] = await Promise.all([
      supabase.from('supermarkets').select('id, name, city, country, is_active').eq('is_active', true),
      supabase.from('supplier_applications').select('*').eq('supplier_user_id', userId),
    ]);
    setStores(sm || []);
    setMyApps(apps || []);
    setLoading(false);
  };

  const appStatus = (smId) => myApps.find(a => a.supermarket_id === smId)?.status || null;

  const openApply = async (smId) => {
    setApplying(smId);
    // Pre-fill from the saved supplier/Pichin profile, then let an existing
    // draft override those values for this specific supermarket.
    const defaults = supplierDefaults || await loadSupplierDefaults() || {};
    const existing = myApps.find(a => a.supermarket_id === smId);
    setForm({
      business_name:      existing?.business_name || defaults.business_name || '',
      contact_name:       existing?.contact_name || defaults.contact_name || '',
      contact_phone:      existing?.contact_phone || defaults.contact_phone || '',
      contact_email:      existing?.contact_email || defaults.contact_email || '',
      product_categories: existing?.product_categories || defaults.product_categories || [],
      message:            existing?.message || defaults.message || '',
    });
  };

  const submitApplication = async (smId) => {
    if (!form.business_name || !form.contact_name || !form.contact_phone) {
      toast.error('Business name, contact name and phone are required'); return;
    }
    try {
      const { data: businessProfileId, error: businessError } = await supabase.rpc('supplier_create_business_account', {
        p_business_name: form.business_name,
        p_business_type: supplierDefaults?.business_type || 'Sole Proprietorship',
        p_registration_number: null
      });
      if (businessError) throw businessError;

      const { error } = await supabase.from('supplier_applications').upsert({
        supermarket_id:     smId,
        supplier_user_id:   userId,
        supplier_business_profile_id: businessProfileId,
        business_name:      form.business_name,
        contact_name:       form.contact_name,
        contact_phone:      form.contact_phone,
        contact_email:      form.contact_email,
        product_categories: form.product_categories,
        message:            form.message,
        status:             'pending',
      }, { onConflict: 'supermarket_id,supplier_user_id' });
      if (error) throw error;
      toast.success('Application submitted! Supermarket will review it.');
      setApplying(null);
      loadAll();
    } catch (e) {
      toast.error(e.message || 'Application failed');
    }
  };

  const STATUS_COLORS = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading stores…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Apply to Supermarkets</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Apply to supply any supermarket on the platform. You can apply to multiple at once.
          Approved suppliers earn <strong>5 ICAN</strong> per approval.
        </p>
      </div>

      {/* My applications summary */}
      {myApps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">My Applications ({myApps.length})</h3>
          <div className="space-y-2">
            {myApps.map(app => {
              const store = stores.find(s => s.id === app.supermarket_id);
              return (
                <div key={app.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{store?.name || 'Unknown Store'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-500'}`}>
                    {app.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Store directory */}
      <div className="grid sm:grid-cols-2 gap-4">
        {stores.length === 0 ? (
          <div className="sm:col-span-2 text-center py-12 text-gray-400">
            No supermarkets registered on the platform yet.
          </div>
        ) : stores.map(store => {
          const status = appStatus(store.id);
          return (
            <div key={store.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{store.name}</p>
                  <p className="text-xs text-gray-400">{store.city}, {store.country}</p>
                </div>
                {status ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-500'}`}>
                    {status}
                  </span>
                ) : (
                  <button
                    onClick={() => openApply(store.id)}
                    className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-semibold rounded-lg hover:opacity-90">
                    Apply
                  </button>
                )}
              </div>

              {/* Inline application form */}
              {applying === store.id && (
                <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Application to {store.name}</p>
                  <input placeholder="Business name *" value={form.business_name} onChange={e => set('business_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Contact name *" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                    <input placeholder="Phone *" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  </div>
                  <input placeholder="Email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">What do you supply?</p>
                    <div className="flex flex-wrap gap-1">
                      {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => toggleCat(cat)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            form.product_categories.includes(cat)
                              ? 'bg-purple-500 text-white border-purple-500'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea placeholder="Message to the supermarket (optional)" value={form.message}
                    onChange={e => set('message', e.target.value)} rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => submitApplication(store.id)}
                      className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-lg hover:opacity-90">
                      Submit Application
                    </button>
                    <button onClick={() => setApplying(null)}
                      className="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
