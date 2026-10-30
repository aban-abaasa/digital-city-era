// =====================================================================
// ORDER ITEMS SELECTOR - ENHANCED WITH PRODUCT CATALOG
// =====================================================================
// Smart product selection with admin-controlled pricing
// Features: Auto-complete, unit selection (boxes/units), price validation
// Real-time inventory & cost tracking - SUPERMARTKERA Uganda 🇺🇬
// =====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  FiX, FiPlus, FiMinus, FiSearch, FiEdit2, FiBox, FiChevronDown, FiShoppingCart
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import { catalogItemOffer, groupBatchesByItem } from '../utils/supplierBatchExpiry';
import '../styles/supplier-order-create.css';

const initialOf = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();

// One product in the grid: picture, name, price, and either an Add button or a - qty + stepper
const OisTile = ({ image, name, price, sub, note, qty, dimmed, onAdd, onStep }) => (
  <div className={`ois-tile${qty != null ? ' is-in' : ''}${dimmed ? ' is-dim' : ''}`}>
    <button type="button" className="ois-tile-main" onClick={onAdd} aria-label={`Add ${name}`}>
      <span className="ois-img">
        {image
          ? <img src={image} alt="" loading="lazy" />
          : <span className="ois-initial" aria-hidden="true">{initialOf(name)}</span>}
        {qty != null && <span className="ois-pill">{qty} in order</span>}
      </span>
      <span className="ois-name">{name}</span>
      <span className="ois-price">{price}</span>
      {sub && <span className="ois-sub">{sub}</span>}
      {note && <span className="ois-note">{note}</span>}
    </button>
    {qty != null ? (
      <div className="ois-step">
        <button type="button" onClick={() => onStep(-1)} aria-label="One less"><FiMinus className="h-4 w-4" /></button>
        <span aria-live="polite">{qty}</span>
        <button type="button" onClick={() => onStep(1)} aria-label="One more"><FiPlus className="h-4 w-4" /></button>
      </div>
    ) : (
      <button type="button" className="ois-add" onClick={onAdd} aria-label={`Add ${name}`}><FiPlus className="h-4 w-4" /> Add</button>
    )}
  </div>
);

const OrderItemsSelector = ({ 
  orderItems, 
  onItemsChange, 
  totals,
  onTotalsChange,
  pricingMode = 'admin_price',
  supplierId = '',
  supplierBusinessProfileId = ''
}) => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [source, setSource] = useState(null); // 'store' | 'supplier'; null = pick a sensible one
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unitType, setUnitType] = useState('units');
  const [unitsPerBox, setUnitsPerBox] = useState(12);
  const [unitPrice, setUnitPrice] = useState(0);
  const [buyingPrice, setBuyingPrice] = useState(0);
  const [supplierPrices, setSupplierPrices] = useState({});
  const [supplierCatalogItems, setSupplierCatalogItems] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);

  // Always derive this from the rows being displayed. Some parent screens use
  // a read-only totals object, so relying only on totals.totalUnits can leave
  // the summary stuck at zero.
  const calculatedTotalUnits = (orderItems || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  // Load products from Supabase
  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!supplierId) {
      setSupplierPrices({});
      setSupplierCatalogItems([]);
      return;
    }
    const loadSupplierOfferings = async () => {
      const catalogOwnerFilters = [
        supplierId ? `supplier_user_id.eq.${supplierId}` : null,
        supplierBusinessProfileId ? `supplier_business_profile_id.eq.${supplierBusinessProfileId}` : null
      ].filter(Boolean);
      const baseCatalogColumns = 'id, name, description, price_per_unit, unit, category, min_order_qty, image_url';
      const buildCatalogQuery = (columns) => {
        let query = supabase.from('supplier_catalog_items').select(columns).eq('is_available', true);
        if (catalogOwnerFilters.length) query = query.or(catalogOwnerFilters.join(','));
        return query;
      };
      // Barcode/SKU let the receiving store match by code; older databases may not have the columns yet
      const loadCatalog = async () => {
        const withCodes = await buildCatalogQuery(`${baseCatalogColumns}, barcode, sku`);
        return withCodes.error ? buildCatalogQuery(baseCatalogColumns) : withCodes;
      };
      const [{ data: catalog, error: catalogError }, { data: supplierStores }] = await Promise.all([
        loadCatalog(),
        supabase.from('supermarkets').select('id').eq('owner_user_id', supplierId).eq('is_active', true)
      ]);
      if (catalogError) console.warn('Could not load supplier catalog prices:', catalogError.message);

      // Wholesale and factory businesses also sell products entered by their
      // POS/admin. Bring those products into the same ordering catalog.
      let posOfferings = [];
      const storeIds = (supplierStores || []).map(store => store.id);
      if (storeIds.length) {
        const { data: posProducts, error: posError } = await supabase.from('products')
          .select('id, name, sku, barcode, cost_price, wholesale_price, selling_price, price, images, is_active')
          .in('supermarket_id', storeIds)
          .eq('is_active', true)
          .order('name');
        if (posError) console.warn('Could not load supplier POS products:', posError.message);
        posOfferings = (posProducts || []).map(product => ({
          id: `pos-${product.id}`,
          source_product_id: product.id,
          name: product.name,
          barcode: product.barcode || '',
          sku: product.sku || '',
          description: `POS product${product.sku ? ` · SKU ${product.sku}` : ''}`,
          price_per_unit: Number(product.wholesale_price) || Number(product.cost_price) || Number(product.selling_price) || Number(product.price) || 0,
          admin_buying_price: Number(product.wholesale_price) || Number(product.cost_price) || 0,
          admin_selling_price: Number(product.selling_price) || Number(product.price) || 0,
          unit: 'unit', category: 'POS inventory', min_order_qty: 1,
          image_url: Array.isArray(product.images) ? product.images[0] : product.images || null,
          is_pos_product: true
        }));
      }

      // Batch expiry: the supplier's near-expiry stock is discounted live, so
      // the price shown (and ordered) already reflects today's discount.
      let catalogWithOffers = catalog || [];
      const catalogIds = catalogWithOffers.map(item => item.id);
      if (catalogIds.length) {
        const { data: batchRows, error: batchError } = await supabase
          .from('supplier_catalog_batches').select('*').in('catalog_item_id', catalogIds);
        if (!batchError) {
          const byItem = groupBatchesByItem(batchRows);
          catalogWithOffers = catalogWithOffers.map(item => {
            const batches = byItem[item.id] || [];
            if (!batches.length) return item;
            const offer = catalogItemOffer(item, batches);
            // Every batch expired / out of stock: nothing safe to order.
            if (!offer.first) return { ...item, is_unavailable_expired: true };
            return {
              ...item,
              list_price: offer.basePrice,
              price_per_unit: offer.price,
              expiry_discount_percent: offer.percent,
              next_expiry_date: offer.first.batch.expiry_date,
              next_expiry_label: offer.first.status.label,
              next_batch_quantity: offer.first.batch.quantity
            };
          }).filter(item => !item.is_unavailable_expired);
        }
      }

      const offerings = [...catalogWithOffers, ...posOfferings];
      setSupplierCatalogItems(offerings);
      setSupplierPrices(Object.fromEntries(offerings.map(item => [item.name.trim().toLowerCase(), Number(item.price_per_unit) || 0])));
    };
    loadSupplierOfferings();
  }, [supplierId, supplierBusinessProfileId]);

  const priceFor = (product) => pricingMode === 'supplier_price'
    ? (supplierPrices[product.name?.trim().toLowerCase()] || 0)
    : (Number(product.wholesale_price) || Number(product.cost_price) || 0);

  const addSupplierCatalogItem = (catalogItem) => {
    const unitPrice = pricingMode === 'admin_price'
      ? (Number(catalogItem.admin_buying_price) || Number(catalogItem.price_per_unit) || 0)
      : (Number(catalogItem.price_per_unit) || 0);
    if (!unitPrice) {
      toast.warning('This supplier has not published a price for this item.');
      return;
    }
    const existingIndex = orderItems.findIndex(item => item.supplier_catalog_item_id === catalogItem.id);
    if (existingIndex >= 0) {
      const updated = orderItems.map((item, index) => index === existingIndex
        ? { ...item, quantity: item.quantity + (Number(catalogItem.min_order_qty) || 1), display_quantity: item.quantity + (Number(catalogItem.min_order_qty) || 1), total: (item.quantity + (Number(catalogItem.min_order_qty) || 1)) * item.unit_price }
        : item);
      onItemsChange(updated);
      return;
    }
    const quantity = Number(catalogItem.min_order_qty) || 1;
    const item = {
      id: `supplier-${catalogItem.id}`,
      supplier_catalog_item_id: catalogItem.id,
      product_id: null,
      product_name: catalogItem.name,
      barcode: catalogItem.barcode || '',
      sku: catalogItem.sku || '',
      quantity,
      display_quantity: quantity,
      unit_type: catalogItem.unit || 'units',
      unit_price: unitPrice,
      buying_price: unitPrice,
      total: quantity * unitPrice,
      margin: 0,
      margin_percent: '0.0'
    };
    const updated = [...orderItems, item];
    onItemsChange(updated);
    onTotalsChange({
      subtotal: updated.reduce((sum, row) => sum + Number(row.total || 0), 0),
      tax: updated.reduce((sum, row) => sum + Number(row.total || 0), 0) * 0.18,
      total: updated.reduce((sum, row) => sum + Number(row.total || 0), 0) * 1.18,
      itemCount: updated.length,
      totalUnits: updated.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
    });
    toast.success(`${catalogItem.name} added to the order`);
  };

  const loadProducts = async () => {
    try {
      // Get the current supermarket ID from localStorage (custom auth system)
      const storedUser = localStorage.getItem('supermarket_user');
      let supermarketId = null;

      // Prefer the authenticated account's store. Portal switching keeps the
      // admin session active, so the cached localStorage value can be stale.
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        let { data: authUserRow } = await supabase
          .from('users')
          .select('supermarket_id')
          .eq('auth_id', authUser.id)
          .maybeSingle();
        if (!authUserRow) {
          const { data: idUserRow } = await supabase
            .from('users')
            .select('supermarket_id')
            .eq('id', authUser.id)
            .maybeSingle();
          authUserRow = idUserRow;
        }
        supermarketId = authUserRow?.supermarket_id || null;
      }

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Legacy auth fallback when no authenticated users row is available.
        supermarketId = supermarketId || parsedUser.supermarket_id;
        console.log('🏪 Loading products for supermarket:', supermarketId);
        console.log('👤 User role:', parsedUser.role);
      }

      // ⚠️ CRITICAL SECURITY: Always require supermarket_id
      // Without this, admins/managers could see ALL products from ALL stores
      if (!supermarketId) {
        console.error('❌ No supermarket_id found! User must be assigned to a store.');
        toast.error('You must be assigned to a supermarket to view products. Please contact support.');
        setProducts([]);
        return;
      }

      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          barcode,
          selling_price,
          cost_price,
          wholesale_price,
          category_id,
          supermarket_id,
          images,
          inventory(current_stock,supermarket_id)
        `)
        .eq('is_active', true)
        .eq('supermarket_id', supermarketId)           // ✅ ALWAYS filter by supermarket
        .eq('inventory.supermarket_id', supermarketId) // ✅ ALWAYS filter inventory by supermarket
        .order('name');

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform data to flatten inventory.current_stock
      const transformedData = (data || []).map(product => ({
        ...product,
        current_stock: product.inventory?.[0]?.current_stock || 0,
        inventory: undefined // Remove nested inventory object
      }));
      
      console.log(`✅ Loaded ${transformedData?.length || 0} products for this supermarket`);
      setProducts(transformedData);

      if (!transformedData || transformedData.length === 0) {
        toast.info('ℹ️ No products found for your store. Add products in the POS or Inventory section first.');
      }
    } catch (error) {
      console.error('❌ Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // One place that saves a new list of rows and keeps the parent's totals in step
  const commit = (updatedItems) => {
    onItemsChange(updatedItems);
    const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    onTotalsChange({
      subtotal,
      tax: subtotal * 0.18,
      total: subtotal * 1.18,
      itemCount: updatedItems.length,
      totalUnits: updatedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    });
  };

  const firstImage = (images) => (Array.isArray(images) ? images[0] : images) || null;

  const productImage = (item) => {
    if (item.supplier_catalog_item_id) return supplierCatalogItems.find((c) => c.id === item.supplier_catalog_item_id)?.image_url || null;
    return firstImage(products.find((p) => p.id === item.product_id)?.images);
  };

  const rowIndexOfProduct = (productId) => orderItems.findIndex((item) => item.product_id === productId);
  const rowIndexOfCatalog = (catalogId) => orderItems.findIndex((item) => item.supplier_catalog_item_id === catalogId);

  // + / - on a row or a tile. Going below 1 takes the row off the order.
  const bumpItem = (index, delta) => {
    const item = orderItems[index];
    if (!item) return;
    const boxes = item.unit_type === 'boxes';
    const display = (Number(item.display_quantity) || Number(item.quantity) || 0) + delta;
    if (display <= 0) { removeItem(index); return; }
    const quantity = boxes ? display * (Number(item.units_per_box) || 1) : display;
    commit(orderItems.map((row, i) => (i === index
      ? { ...row, quantity, display_quantity: display, total: quantity * Number(row.unit_price || 0) }
      : row)));
  };

  const resetForm = () => {
    setEditingIndex(null);
    setSelectedProduct(null);
    setQuantity(1);
    setUnitType('units');
    setUnitsPerBox(12);
    setUnitPrice(0);
    setBuyingPrice(0);
  };

  const calculateTotalPrice = () => {
    const units = unitType === 'boxes' ? quantity * unitsPerBox : quantity;
    return units * unitPrice;
  };

  const getTotalUnits = () => (unitType === 'boxes' ? quantity * unitsPerBox : quantity);

  const validateItem = () => {
    if (!selectedProduct) {
      toast.warning('⚠️ Please select a product');
      return false;
    }
    if (quantity <= 0) {
      toast.warning('⚠️ Quantity must be greater than 0');
      return false;
    }
    if (unitPrice <= 0) {
      toast.warning('⚠️ Unit price must be greater than 0');
      return false;
    }
    return true;
  };

  // Saves the line being edited (boxes, a different quantity or a custom price)
  const updateEditedItem = () => {
    if (!validateItem() || editingIndex === null) return;

    const totalUnits = getTotalUnits();
    const previous = orderItems[editingIndex];
    const edited = {
      ...previous,
      quantity: totalUnits,
      display_quantity: quantity,
      unit_type: unitType,
      units_per_box: unitsPerBox,
      unit_price: unitPrice,
      buying_price: buyingPrice,
      total: calculateTotalPrice(),
      margin: unitPrice - buyingPrice,
      margin_percent: buyingPrice > 0 ? ((unitPrice - buyingPrice) / buyingPrice * 100).toFixed(1) : '0.0'
    };
    commit(orderItems.map((row, i) => (i === editingIndex ? edited : row)));
    resetForm();
    toast.success('✅ Item updated');
  };

  // Tapping a tile adds the product straight away with a quantity of 1; tapping again adds one more.
  const addCatalogProduct = (product) => {
    const unitPriceForProduct = priceFor(product);
    if (unitPriceForProduct <= 0) {
      toast.warning(!supplierId && pricingMode === 'supplier_price'
        ? 'Choose a supplier first to see its prices.'
        : pricingMode === 'supplier_price'
          ? 'This supplier has not published a price for this product yet.'
          : 'This product has no admin buying price yet. Set its cost price first.');
      return;
    }

    const existingIndex = rowIndexOfProduct(product.id);
    if (existingIndex >= 0) {
      bumpItem(existingIndex, 1);
      return;
    }

    const buyingPriceForProduct = pricingMode === 'supplier_price'
      ? unitPriceForProduct
      : (Number(product.cost_price) || 0);
    commit([...orderItems, {
      id: Date.now(),
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      quantity: 1,
      display_quantity: 1,
      unit_type: 'units',
      units_per_box: 12,
      unit_price: unitPriceForProduct,
      buying_price: buyingPriceForProduct,
      total: unitPriceForProduct,
      margin: unitPriceForProduct - buyingPriceForProduct,
      margin_percent: buyingPriceForProduct > 0
        ? ((unitPriceForProduct - buyingPriceForProduct) / buyingPriceForProduct * 100).toFixed(1)
        : '0.0',
      current_stock: product.current_stock || 0
    }]);
  };

  const editItem = (index) => {
    const item = orderItems[index];
    setSelectedProduct({
      id: item.product_id,
      name: item.product_name,
      sku: item.sku,
      selling_price: item.unit_price,
      cost_price: item.buying_price,
      current_stock: item.current_stock || 0
    });
    setQuantity(item.display_quantity || item.quantity || 1);
    setUnitType(item.unit_type === 'boxes' ? 'boxes' : 'units');
    setUnitsPerBox(item.units_per_box || 12);
    setUnitPrice(item.unit_price);
    setBuyingPrice(item.buying_price || 0);
    setEditingIndex(index);
  };

  const removeItem = (index) => {
    commit(orderItems.filter((_, i) => i !== index));
    if (editingIndex === index) resetForm();
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
    toast.success('✅ Item removed');
  };

  const addNewProduct = async () => {
    const name = searchQuery.trim();
    if (!name) {
      toast.warning('⚠️ Enter product name first');
      return;
    }

    try {
      // Get the current supermarket ID from localStorage
      const storedUser = localStorage.getItem('supermarket_user');
      let supermarketId = null;

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        supermarketId = parsedUser.supermarket_id;
      }

      if (!supermarketId) {
        toast.error('❌ Cannot add product: Supermarket ID not found');
        return;
      }

      // Check if product already exists IN THIS SUPERMARKET
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('supermarket_id', supermarketId)
        .ilike('name', name)
        .single();

      if (existing) {
        toast.info('ℹ️ Product already exists in your store catalog');
        return;
      }

      // Generate SKU from name
      const sku = name.replace(/\s+/g, '-').toUpperCase().substring(0, 20);

      // Insert new product FOR THIS SUPERMARKET
      const { error } = await supabase
        .from('products')
        .insert([{
          name,
          sku,
          cost_price: 0,
          selling_price: 0,
          price: 0,
          tax_rate: 18,
          is_active: true,
          supermarket_id: supermarketId  // ✅ Associate with manager's supermarket
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('✅ Product added to your store catalog! Admin notified.');
      await loadProducts();
    } catch (error) {
      console.error('❌ Error adding product:', error);
      toast.error('Failed to add product');
    }
  };

  // ---------- what the grid shows ----------
  const hasSupplierItems = Boolean(supplierId) && supplierCatalogItems.length > 0;
  const activeSource = source || (hasSupplierItems ? 'supplier' : 'store');
  const query = searchQuery.trim().toLowerCase();

  const shownProducts = useMemo(() => {
    if (!query) return products;
    return products.filter((p) =>
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.barcode && p.barcode.includes(query))
    );
  }, [products, query]);

  const shownCatalog = useMemo(() => {
    if (!query) return supplierCatalogItems;
    return supplierCatalogItems.filter((item) =>
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.sku && String(item.sku).toLowerCase().includes(query)) ||
      (item.barcode && String(item.barcode).includes(query))
    );
  }, [supplierCatalogItems, query]);

  const needsSupplierFirst = pricingMode === 'supplier_price' && !supplierId;

  const subtotal = totals?.subtotal ?? 0;

  return (
    <div className="ois">
      {/* Search + which shelf to browse */}
      <div className="ois-search">
        <FiSearch className="ois-search-icon" aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, SKU or barcode"
          aria-label="Search products"
          className="ois-input"
        />
        {searchQuery && (
          <button type="button" className="ois-clear" onClick={() => setSearchQuery('')} aria-label="Clear search"><FiX className="h-4 w-4" /></button>
        )}
      </div>

      <div className="ois-tabs" role="tablist" aria-label="Where to pick products from">
        <button type="button" role="tab" aria-selected={activeSource === 'store'} className="ois-tab" onClick={() => setSource('store')}>
          <FiBox className="h-4 w-4" /> My products <span className="ois-tab-count">{products.length}</span>
        </button>
        {supplierId && (
          <button type="button" role="tab" aria-selected={activeSource === 'supplier'} className="ois-tab" onClick={() => setSource('supplier')}>
            🏢 Supplier catalog <span className="ois-tab-count">{supplierCatalogItems.length}</span>
          </button>
        )}
      </div>

      {needsSupplierFirst && activeSource === 'store' && (
        <p className="ois-hint">Choose a supplier above and the prices appear on every product.</p>
      )}

      {activeSource === 'supplier' && supplierId ? (
        shownCatalog.length === 0 ? (
          <p className="ois-empty">{supplierCatalogItems.length === 0 ? 'No available catalog items for this supplier.' : `Nothing matches “${searchQuery}”.`}</p>
        ) : (
          <div className="ois-grid">
            {shownCatalog.map((item) => {
              const idx = rowIndexOfCatalog(item.id);
              return (
                <OisTile
                  key={item.id}
                  image={item.image_url}
                  name={item.name}
                  price={<>
                    {item.expiry_discount_percent > 0 && <s className="ois-was">{formatCurrency(item.list_price)}</s>}
                    {formatCurrency(item.price_per_unit)}<small> / {item.unit || 'unit'}</small>
                  </>}
                  sub={`Min ${item.min_order_qty || 1}${item.admin_selling_price > 0 ? ` · Sell ${formatCurrency(item.admin_selling_price)}` : ''}`}
                  note={item.expiry_discount_percent > 0 ? `−${item.expiry_discount_percent}% · ${item.next_expiry_label}` : null}
                  qty={idx >= 0 ? (orderItems[idx]?.display_quantity ?? orderItems[idx]?.quantity) : null}
                  onStep={(delta) => bumpItem(idx, delta)}
                  onAdd={() => addSupplierCatalogItem(item)}
                />
              );
            })}
          </div>
        )
      ) : shownProducts.length === 0 ? (
        <div className="ois-empty">
          {products.length === 0 ? 'No products in your store yet. Add them in Inventory first.' : <>Nothing matches “{searchQuery}”.</>}
          {products.length > 0 && query && (
            <button type="button" className="ois-addnew" onClick={addNewProduct}>
              <FiPlus className="h-4 w-4" /> Add “{searchQuery.trim()}” to my catalog
            </button>
          )}
        </div>
      ) : (
        <div className="ois-grid">
          {shownProducts.map((product) => {
            const price = priceFor(product);
            const idx = rowIndexOfProduct(product.id);
            return (
              <OisTile
                key={product.id}
                image={firstImage(product.images)}
                name={product.name}
                price={price > 0 ? formatCurrency(price) : (needsSupplierFirst ? 'Pick a supplier' : 'No price yet')}
                sub={`Stock ${product.current_stock || 0}`}
                qty={idx >= 0 ? (orderItems[idx]?.display_quantity ?? orderItems[idx]?.quantity) : null}
                onStep={(delta) => bumpItem(idx, delta)}
                dimmed={price <= 0}
                onAdd={() => addCatalogProduct(product)}
              />
            );
          })}
        </div>
      )}

      {/* The order so far */}
      <section className="ois-list" aria-label="Order items">
        <h3 className="ois-list-title"><FiShoppingCart className="h-4 w-4" /> Your order <span className="ois-tab-count">{orderItems.length}</span></h3>

        {orderItems.length === 0 ? (
          <p className="ois-empty">Tap a product above to start your order.</p>
        ) : (
          <>
            <ul className="ois-rows">
              {orderItems.map((item, index) => {
                const image = productImage(item);
                return (
                  <li key={item.id} className={`ois-row${editingIndex === index ? ' is-editing' : ''}`}>
                    <span className="ois-thumb">
                      {image ? <img src={image} alt="" loading="lazy" /> : <span aria-hidden="true">{initialOf(item.product_name)}</span>}
                    </span>
                    <span className="ois-row-main">
                      <span className="ois-row-name">{item.product_name}</span>
                      <span className="ois-row-sub">
                        {formatCurrency(item.unit_price)} × {item.quantity}{item.unit_type === 'boxes' ? ` (${item.display_quantity} boxes)` : ''}
                      </span>
                    </span>
                    <span className="ois-row-end">
                      <span className="ois-row-total">{formatCurrency(item.total)}</span>
                      <span className="ois-row-ctrl">
                        <button type="button" onClick={() => bumpItem(index, -1)} aria-label="One less"><FiMinus className="h-4 w-4" /></button>
                        <b>{item.display_quantity ?? item.quantity}</b>
                        <button type="button" onClick={() => bumpItem(index, 1)} aria-label="One more"><FiPlus className="h-4 w-4" /></button>
                        {!item.supplier_catalog_item_id && (
                          <button type="button" onClick={() => editItem(index)} aria-label={`Edit ${item.product_name}`}><FiEdit2 className="h-4 w-4" /></button>
                        )}
                        <button type="button" className="is-remove" onClick={() => removeItem(index)} aria-label={`Remove ${item.product_name}`}><FiX className="h-4 w-4" /></button>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="ois-sum">
              <div><dt>Units</dt><dd>{calculatedTotalUnits}</dd></div>
              <div><dt>Subtotal</dt><dd>{formatCurrency(subtotal)}</dd></div>
              <div><dt>VAT (18%)</dt><dd>{formatCurrency(totals?.tax)}</dd></div>
              <div className="is-total"><dt>Total</dt><dd>{formatCurrency(totals?.total)}</dd></div>
            </dl>
          </>
        )}

        {/* Boxes, or a price that differs from the list: opens from a row's pencil */}
        {editingIndex !== null && selectedProduct && (
          <div className="ois-edit">
            <button type="button" className="ois-edit-head" onClick={resetForm} aria-label="Close editor">
              <span><FiEdit2 className="h-4 w-4" /> {selectedProduct.name}</span>
              <FiChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
            </button>
            <div className="ois-edit-grid">
              <label>Quantity
                <input type="number" min="1" className="ois-input" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
              </label>
              <label>Sold as
                <select className="ois-input" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
                  <option value="units">Units</option>
                  <option value="boxes">Boxes</option>
                </select>
              </label>
              {unitType === 'boxes' && (
                <label>Units per box
                  <input type="number" min="1" className="ois-input" value={unitsPerBox} onChange={(e) => setUnitsPerBox(Math.max(1, parseInt(e.target.value) || 12))} />
                </label>
              )}
              <label>{pricingMode === 'supplier_price' ? 'Supplier price' : 'Admin buying price'} (UGX)
                <input type="number" min="0" step="100" className="ois-input" value={unitPrice} onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))} />
              </label>
              <label>Buying price (UGX)
                <input type="number" min="0" step="100" className="ois-input" value={buyingPrice} onChange={(e) => setBuyingPrice(Math.max(0, parseFloat(e.target.value) || 0))} />
              </label>
            </div>
            <p className="ois-edit-sum">
              {getTotalUnits()} units · {formatCurrency(calculateTotalPrice())}
              {buyingPrice > 0 && <> · margin <b className={unitPrice > buyingPrice ? 'is-good' : 'is-bad'}>{((unitPrice - buyingPrice) / buyingPrice * 100).toFixed(1)}%</b></>}
            </p>
            <div className="ois-edit-actions">
              <button type="button" className="ois-btn ois-btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="button" className="ois-btn ois-btn-primary" onClick={updateEditedItem}>Update item</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default OrderItemsSelector;
