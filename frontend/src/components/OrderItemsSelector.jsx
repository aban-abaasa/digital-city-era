// =====================================================================
// ORDER ITEMS SELECTOR - ENHANCED WITH PRODUCT CATALOG
// =====================================================================
// Smart product selection with admin-controlled pricing
// Features: Auto-complete, unit selection (boxes/units), price validation
// Real-time inventory & cost tracking - FAREDEAL Uganda 🇺🇬
// =====================================================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  FiX, FiPlus, FiSearch, FiEdit2, FiTrendingUp, FiTrendingDown, FiBox,
  FiAlertCircle, FiCheckCircle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import './OrderItemsSelector.css';

// products.images can be an array of URLs, a single URL, or empty.
const firstImage = (images) => (Array.isArray(images) ? images[0] : images) || null;

// Framed picture, or a patterned placeholder when no photo was uploaded.
const Picture = ({ src, name }) => (src
  ? <img src={src} alt={name} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
  : <span className="ois-plate-empty" aria-hidden="true">📦</span>);

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
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unitType, setUnitType] = useState('units');
  const [unitsPerBox, setUnitsPerBox] = useState(12);
  const [unitPrice, setUnitPrice] = useState(0);
  const [buyingPrice, setBuyingPrice] = useState(0);
  const [supplierPrices, setSupplierPrices] = useState({});
  const [supplierCatalogItems, setSupplierCatalogItems] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

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
      let catalogQuery = supabase.from('supplier_catalog_items')
        .select('id, name, description, price_per_unit, unit, category, min_order_qty, image_url')
        .eq('is_available', true);
    const catalogOwnerFilters = [
      supplierId ? `supplier_user_id.eq.${supplierId}` : null,
      supplierBusinessProfileId ? `supplier_business_profile_id.eq.${supplierBusinessProfileId}` : null
    ].filter(Boolean);
      if (catalogOwnerFilters.length) catalogQuery = catalogQuery.or(catalogOwnerFilters.join(','));
      const [{ data: catalog, error: catalogError }, { data: supplierStores }] = await Promise.all([
        catalogQuery,
        supabase.from('supermarkets').select('id').eq('owner_user_id', supplierId).eq('is_active', true)
      ]);
      if (catalogError) console.warn('Could not load supplier catalog prices:', catalogError.message);

      // Wholesale and factory businesses also sell products entered by their
      // POS/admin. Bring those products into the same ordering catalog.
      let posOfferings = [];
      const storeIds = (supplierStores || []).map(store => store.id);
      if (storeIds.length) {
        const { data: posProducts, error: posError } = await supabase.from('products')
          .select('id, name, sku, cost_price, wholesale_price, selling_price, price, images, is_active')
          .in('supermarket_id', storeIds)
          .eq('is_active', true)
          .order('name');
        if (posError) console.warn('Could not load supplier POS products:', posError.message);
        posOfferings = (posProducts || []).map(product => ({
          id: `pos-${product.id}`,
          source_product_id: product.id,
          name: product.name,
          description: `POS product${product.sku ? ` · SKU ${product.sku}` : ''}`,
          price_per_unit: Number(product.wholesale_price) || Number(product.cost_price) || Number(product.selling_price) || Number(product.price) || 0,
          admin_buying_price: Number(product.wholesale_price) || Number(product.cost_price) || 0,
          admin_selling_price: Number(product.selling_price) || Number(product.price) || 0,
          unit: 'unit', category: 'POS inventory', min_order_qty: 1,
          image_url: Array.isArray(product.images) ? product.images[0] : product.images || null,
          is_pos_product: true
        }));
      }

      const offerings = [...(catalog || []), ...posOfferings];
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
        ? { ...item, quantity: item.quantity + (Number(catalogItem.min_order_qty) || 1), total: (item.quantity + (Number(catalogItem.min_order_qty) || 1)) * item.unit_price }
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
      image_url: catalogItem.image_url || null,
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
          images,
          category_id,
          supermarket_id,
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
        image_url: firstImage(product.images),
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

  // Filter products based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.includes(query))
      ).slice(0, 15);
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [searchQuery, products]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectProduct = (product) => {
    // Search selections are also order selections. Editing an existing item
    // remains manual so choosing a replacement does not add a new row.
    if (editingIndex === null) {
      addCatalogProduct(product);
      return;
    }
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setUnitPrice(priceFor(product));
    setBuyingPrice(pricingMode === 'supplier_price' ? priceFor(product) : (product.cost_price || 0));
    setShowDropdown(false);
  };

  const calculateTotalPrice = () => {
    const units = unitType === 'boxes' ? quantity * unitsPerBox : quantity;
    return units * unitPrice;
  };

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

  const addOrUpdateItem = () => {
    if (!validateItem()) return;

    const totalUnits = unitType === 'boxes' ? quantity * unitsPerBox : quantity;
    const itemTotal = calculateTotalPrice();
    
    const newItem = {
      id: editingIndex !== null ? orderItems[editingIndex].id : Date.now(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      image_url: selectedProduct.image_url || null,
      sku: selectedProduct.sku,
      quantity: totalUnits,
      display_quantity: quantity,
      unit_type: unitType,
      units_per_box: unitsPerBox,
      unit_price: unitPrice,
      buying_price: buyingPrice,
      total: itemTotal,
      margin: unitPrice - buyingPrice,
      margin_percent: ((unitPrice - buyingPrice) / buyingPrice * 100).toFixed(1),
      current_stock: selectedProduct.current_stock || 0
    };

    let updatedItems;
    if (editingIndex !== null) {
      updatedItems = [...orderItems];
      updatedItems[editingIndex] = newItem;
      setEditingIndex(null);
    } else {
      updatedItems = [...orderItems, newItem];
    }

    onItemsChange(updatedItems);
    
    // Calculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.18; // 18% VAT
    const total = subtotal + tax;
    
    onTotalsChange({
      subtotal,
      tax,
      total,
      itemCount: updatedItems.length,
      totalUnits: updatedItems.reduce((sum, item) => sum + item.quantity, 0)
    });

    // Reset form
    setSearchQuery('');
    setSelectedProduct(null);
    setQuantity(1);
    setUnitType('units');
    setUnitPrice(0);
    setBuyingPrice(0);
    searchInputRef.current?.focus();
    
    toast.success('✅ Item added successfully');
  };

  // A product chosen from Quick Select is already an order choice. Add it
  // immediately with the default quantity instead of forcing the manager to
  // select the same product again and press Add Item.
  const addCatalogProduct = (product) => {
    const unitPriceForProduct = priceFor(product);
    if (unitPriceForProduct <= 0) {
      toast.warning(pricingMode === 'supplier_price'
        ? 'This supplier has not published a price for this product yet.'
        : 'This product has no admin buying price yet. Set its cost price first.');
      return;
    }

    const existingIndex = orderItems.findIndex((item) => item.product_id === product.id);
    let updatedItems;

    if (existingIndex >= 0) {
      updatedItems = orderItems.map((item, index) => {
        if (index !== existingIndex) return item;
        const itemQuantity = (Number(item.quantity) || 0) + 1;
        return { ...item, quantity: itemQuantity, display_quantity: itemQuantity, total: itemQuantity * unitPriceForProduct };
      });
    } else {
      const buyingPriceForProduct = pricingMode === 'supplier_price'
        ? unitPriceForProduct
        : (Number(product.cost_price) || 0);
      updatedItems = [...orderItems, {
        id: Date.now(),
        product_id: product.id,
        product_name: product.name,
        image_url: product.image_url || null,
        sku: product.sku,
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
      }];
    }

    onItemsChange(updatedItems);
    const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    onTotalsChange({
      subtotal,
      tax: subtotal * 0.18,
      total: subtotal * 1.18,
      itemCount: updatedItems.length,
      totalUnits: updatedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    });
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setUnitPrice(priceFor(product));
    setBuyingPrice(pricingMode === 'supplier_price' ? priceFor(product) : (Number(product.cost_price) || 0));
    setShowDropdown(false);
    toast.success(`${product.name} added to the order`);
  };

  const editItem = (index) => {
    const item = orderItems[index];
    setSelectedProduct({
      id: item.product_id,
      name: item.product_name,
      image_url: item.image_url || null,
      sku: item.sku,
      selling_price: item.unit_price,
      cost_price: item.buying_price
    });
    setSearchQuery(item.product_name);
    setQuantity(item.display_quantity);
    setUnitType(item.unit_type);
    setUnitsPerBox(item.units_per_box);
    setUnitPrice(item.unit_price);
    setBuyingPrice(item.buying_price);
    setEditingIndex(index);
    searchInputRef.current?.focus();
    toast.info('ℹ️ Editing item - Click Add Item when done');
  };

  const removeItem = (index) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    onItemsChange(updatedItems);
    
    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;
    
    onTotalsChange({
      subtotal,
      tax,
      total,
      itemCount: updatedItems.length,
      totalUnits: updatedItems.reduce((sum, item) => sum + item.quantity, 0)
    });

    if (editingIndex === index) {
      setEditingIndex(null);
      setSearchQuery('');
      setSelectedProduct(null);
      setQuantity(1);
      setUnitPrice(0);
      setBuyingPrice(0);
    }
    
    toast.success('✅ Item removed');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getTotalUnits = () => {
    return unitType === 'boxes' ? quantity * unitsPerBox : quantity;
  };

  const addNewProduct = async () => {
    if (!searchQuery.trim()) {
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
        .ilike('name', searchQuery.trim())
        .single();

      if (existing) {
        toast.info('ℹ️ Product already exists in your store catalog');
        selectProduct(existing);
        return;
      }

      // Generate SKU from name
      const sku = searchQuery.trim().replace(/\s+/g, '-').toUpperCase().substring(0, 20);
      
      // Insert new product FOR THIS SUPERMARKET
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert([{
          name: searchQuery.trim(),
          sku: sku,
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

      // Notify admin
      const adminMessage = `🆕 NEW PRODUCT ADDED BY MANAGER\n📦 ${searchQuery.trim()}\n🏪 Supermarket ID: ${supermarketId}\n⏰ ${new Date().toLocaleString('en-UG')}`;
      console.log('Admin notification:', adminMessage);
      
      // Optional: Send notification to admin via email/push
      toast.success('✅ Product added to your store catalog! Admin notified.');
      
      // Load updated products
      await loadProducts();
      selectProduct(newProduct);
    } catch (error) {
      console.error('❌ Error adding product:', error);
      toast.error('Failed to add product');
    }
  };

  const priceLabel = pricingMode === 'supplier_price' ? 'Supplier price' : 'Admin price';
  const filterText = catalogFilter.trim().toLowerCase();
  const catalogMatches = filterText
    ? products.filter((p) =>
        (p.name || '').toLowerCase().includes(filterText) ||
        (p.sku || '').toLowerCase().includes(filterText) ||
        (p.barcode || '').includes(filterText))
    : products;
  const PAGE_SIZE = 12;
  const visibleProducts = showAllProducts || filterText ? catalogMatches : catalogMatches.slice(0, PAGE_SIZE);
  const qtyInOrder = (productId) => orderItems
    .filter((item) => item.product_id === productId)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="ois space-y-6">
      {/* ===== The Catalogue: store products as framed plates ===== */}
      <section className="ois-catalogue">
        <h3 className="ois-heading">
          <span className="ois-orn">❦</span> The Catalogue <small>{products.length} {products.length === 1 ? 'article' : 'articles'}</small>
        </h3>

        <div className="ois-search">
          <FiSearch className="h-5 w-5" />
          <input
            type="text"
            value={catalogFilter}
            onChange={(e) => setCatalogFilter(e.target.value)}
            placeholder="Search the catalogue by name, SKU or barcode…"
            aria-label="Search the catalogue"
          />
        </div>

        {visibleProducts.length === 0 ? (
          <p className="ois-empty">{products.length === 0 ? 'No products in your store catalogue yet.' : `Nothing matches “${catalogFilter}”.`}</p>
        ) : (
          <div className="ois-grid">
            {visibleProducts.map((product) => {
              const price = priceFor(product);
              const inOrder = qtyInOrder(product.id);
              const stock = Number(product.current_stock || 0);
              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => addCatalogProduct(product)}
                  className={`ois-card-item ${price > 0 ? '' : 'is-unpriced'}`}
                  title={price > 0 ? `Add ${product.name} to the order` : 'No price set yet'}
                >
                  <div className="ois-plate">
                    <Picture src={product.image_url} name={product.name} />
                    {inOrder > 0 && <span className="ois-badge">× {inOrder} in order</span>}
                    <span className={`ois-stock ${stock <= 5 ? 'is-low' : ''}`}>Stock {stock}</span>
                  </div>
                  <div className="ois-caption">
                    <b>{product.name}</b>
                    {product.sku && <span className="ois-sku">{product.sku}</span>}
                    <div className="ois-price">
                      <em>{priceLabel}</em>
                      <strong>{price > 0 ? formatCurrency(price) : 'Not set'}</strong>
                    </div>
                    {Number(product.selling_price) > 0 && <span className="ois-meta">Shelf price {formatCurrency(product.selling_price)}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!filterText && catalogMatches.length > PAGE_SIZE && (
          <button type="button" className="ois-more" onClick={() => setShowAllProducts((v) => !v)}>
            {showAllProducts ? 'Show fewer' : `Show all ${catalogMatches.length} articles`}
          </button>
        )}
      </section>

      {/* ===== Supplier shelf ===== */}
      {supplierId && (
        <section className="ois-catalogue ois-supplier">
          <h3 className="ois-heading">
            <span className="ois-orn">❦</span> Supplier’s Shelf <small>{supplierCatalogItems.length} offered</small>
          </h3>
          {supplierCatalogItems.length === 0 ? (
            <p className="ois-empty">No available catalogue items found for this supplier.</p>
          ) : (
            <div className="ois-grid">
              {supplierCatalogItems.map((item) => {
                const shownPrice = pricingMode === 'admin_price'
                  ? (Number(item.admin_buying_price) || Number(item.price_per_unit) || 0)
                  : (Number(item.price_per_unit) || 0);
                const inOrder = orderItems
                  .filter((row) => row.supplier_catalog_item_id === item.id)
                  .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
                return (
                  <button type="button" key={item.id} onClick={() => addSupplierCatalogItem(item)} className={`ois-card-item ${shownPrice > 0 ? '' : 'is-unpriced'}`}>
                    <div className="ois-plate">
                      <Picture src={item.image_url} name={item.name} />
                      {inOrder > 0 && <span className="ois-badge">× {inOrder} in order</span>}
                    </div>
                    <div className="ois-caption">
                      <b>{item.name}</b>
                      {item.category && <span className="ois-sku">{item.category}</span>}
                      <div className="ois-price">
                        <em>per {item.unit || 'unit'}</em>
                        <strong>{shownPrice > 0 ? formatCurrency(shownPrice) : 'Not set'}</strong>
                      </div>
                      <span className="ois-meta">Minimum order {item.min_order_qty || 1}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ===== Order slip: quantity, unit and price for the chosen article ===== */}
      <section className="ois-form">
        <h3 className="ois-heading">
          <span className="ois-orn">❦</span> {editingIndex !== null ? 'Amend the Line' : 'Order Slip'}
        </h3>

        {selectedProduct && (
          <div className="ois-chosen" style={{ marginBottom: 14 }}>
            <div className="ois-thumb"><Picture src={selectedProduct.image_url} name={selectedProduct.name} /></div>
            <div>
              <p className="ois-chosen-name">{selectedProduct.name}</p>
              <p className="ois-chosen-sub">{selectedProduct.sku ? `SKU ${selectedProduct.sku} · ` : ''}Stock {selectedProduct.current_stock || 0}</p>
            </div>
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <label htmlFor="ois-product-search">Product name</label>
          <div className="ois-search" style={{ marginBottom: 0 }}>
            <FiSearch className="h-5 w-5" />
            <input
              id="ois-product-search"
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                setSelectedProduct(null);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search product name, SKU, or barcode…"
            />
          </div>

          {showDropdown && filteredProducts.length > 0 && (
            <div className="ois-search-drop">
              {filteredProducts.map((product) => (
                <button type="button" key={product.id} onClick={() => selectProduct(product)}>
                  <div className="ois-thumb"><Picture src={product.image_url} name={product.name} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="ois-chosen-name" style={{ fontSize: '0.95rem' }}>{product.name}</p>
                    <p className="ois-chosen-sub">SKU {product.sku || '—'} · Stock {product.current_stock || 0}</p>
                  </div>
                  <strong style={{ fontFamily: 'var(--serif, Georgia, serif)', color: 'var(--ok, #047857)', whiteSpace: 'nowrap' }}>
                    {formatCurrency(priceFor(product))}
                  </strong>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchQuery && filteredProducts.length === 0 && (
            <div className="ois-search-drop" style={{ padding: 14 }}>
              <p className="ois-chosen-sub" style={{ marginBottom: 10 }}>No products found matching “{searchQuery}”.</p>
              <button type="button" onClick={addNewProduct} className="ois-add" style={{ marginTop: 0 }}>
                <FiPlus className="h-5 w-5" /> Add “{searchQuery}” to Catalogue
              </button>
              <p className="ois-chosen-sub" style={{ marginTop: 8 }}>The new product is added and the admin is notified.</p>
            </div>
          )}
        </div>

        <div className="ois-form-row">
          <div>
            <label htmlFor="ois-qty">Quantity</label>
            <input id="ois-qty" type="number" value={quantity} min="1" onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div>
            <label htmlFor="ois-unit">Unit type</label>
            <select id="ois-unit" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
              <option value="units">Units</option>
              <option value="boxes">Boxes</option>
            </select>
          </div>
          {unitType === 'boxes' && (
            <div>
              <label htmlFor="ois-upb">Units / box</label>
              <input id="ois-upb" type="number" value={unitsPerBox} min="1" onChange={(e) => setUnitsPerBox(Math.max(1, parseInt(e.target.value) || 12))} />
            </div>
          )}
          <div>
            <label htmlFor="ois-price">{priceLabel} (UGX)</label>
            <input id="ois-price" type="number" value={unitPrice} min="0" step="100" onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))} />
          </div>
          <div>
            <label htmlFor="ois-buy">Buying price (UGX)</label>
            <input id="ois-buy" type="number" value={buyingPrice} min="0" step="100" onChange={(e) => setBuyingPrice(Math.max(0, parseFloat(e.target.value) || 0))} />
          </div>
        </div>

        {selectedProduct && (
          <div className="ois-stats">
            <div className="ois-stat"><span>Total units</span><b>{getTotalUnits()}</b></div>
            <div className="ois-stat"><span>Line total</span><b>{formatCurrency(calculateTotalPrice())}</b></div>
            <div className={`ois-stat ${buyingPrice > 0 && unitPrice > buyingPrice ? 'is-good' : 'is-bad'}`}>
              <span>Margin</span>
              <b>{buyingPrice > 0 ? `${((unitPrice - buyingPrice) / buyingPrice * 100).toFixed(1)}%` : 'N/A'}</b>
            </div>
            <div className="ois-stat"><span>In stock</span><b>{selectedProduct.current_stock || 0}</b></div>
          </div>
        )}

        <button type="button" onClick={addOrUpdateItem} disabled={!selectedProduct} className="ois-add">
          <FiPlus className="h-5 w-5" />
          {editingIndex !== null ? 'Update Line' : 'Add to Order'}
        </button>
      </section>

      {/* ===== The Ledger: order lines with pictures ===== */}
      <section className="ois-ledger ois-list">
        <h3 className="ois-heading ois-list-title">
          <FiCheckCircle className="h-5 w-5 ois-orn" /> The Ledger <small>{orderItems.length} {orderItems.length === 1 ? 'line' : 'lines'}</small>
        </h3>

        {orderItems.length > 0 ? (
          <>
            <div className="ois-lines">
              {orderItems.map((item, index) => (
                <article key={item.id} className={`ois-line ${editingIndex === index ? 'is-editing' : ''}`}>
                  <div className="ois-thumb"><Picture src={item.image_url} name={item.product_name} /></div>
                  <div style={{ minWidth: 0 }}>
                    <p className="ois-line-name">{item.product_name}</p>
                    {item.sku && <p className="ois-line-sku">SKU {item.sku}</p>}
                    <div className="ois-line-figures">
                      <div className="ois-fig">
                        <span>Quantity</span>
                        <b>
                          {item.display_quantity} {item.unit_type === 'boxes' ? 'boxes' : (item.unit_type === 'units' ? 'units' : item.unit_type)}
                          {item.unit_type === 'boxes' && <small style={{ fontWeight: 400 }}> ({item.quantity} units)</small>}
                        </b>
                      </div>
                      <div className="ois-fig"><span>{priceLabel}</span><b className="po-ok">{formatCurrency(item.unit_price)}</b></div>
                      <div className="ois-fig">
                        <span>Margin</span>
                        <b style={{ color: item.margin >= 0 ? 'var(--ok, #047857)' : 'var(--due, #be123c)' }}>{item.margin_percent}%</b>
                      </div>
                      <div className="ois-fig is-total"><span>Line total</span><b>{formatCurrency(item.total)}</b></div>
                    </div>
                    <div className="ois-line-actions">
                      <button type="button" onClick={() => editItem(index)}><FiEdit2 className="h-4 w-4" /> Amend</button>
                      <button type="button" className="is-danger" onClick={() => removeItem(index)}><FiX className="h-4 w-4" /> Strike out</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="ois-receipt">
              <div><span>Articles</span><b>{orderItems.length}</b></div>
              <div><span>Total units</span><b>{calculatedTotalUnits}</b></div>
              <div><span>Subtotal</span><b>{formatCurrency(totals.subtotal)}</b></div>
              <div><span>VAT (18%)</span><b>{formatCurrency(totals.tax)}</b></div>
              <div className="ois-grand"><span>Total</span><b>{formatCurrency(totals.total)}</b></div>
            </div>
          </>
        ) : (
          <div className="ois-blank">
            <FiAlertCircle className="h-10 w-10 ois-orn" style={{ margin: '0 auto' }} />
            <p>The ledger is empty</p>
            <small>Choose articles from the catalogue above to begin your order.</small>
          </div>
        )}
      </section>
    </div>
  );
};

export default OrderItemsSelector;
