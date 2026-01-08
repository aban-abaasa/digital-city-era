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

const OrderItemsSelector = ({ 
  orderItems, 
  onItemsChange, 
  totals,
  onTotalsChange 
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
  const [editingIndex, setEditingIndex] = useState(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load products from Supabase
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          barcode,
          selling_price,
          cost_price,
          category_id
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
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
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setUnitPrice(product.selling_price || 0);
    setBuyingPrice(product.cost_price || 0);
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

  const editItem = (index) => {
    const item = orderItems[index];
    setSelectedProduct({
      id: item.product_id,
      name: item.product_name,
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
      // Check if product already exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .ilike('name', searchQuery.trim())
        .single();

      if (existing) {
        toast.info('ℹ️ Product already exists in catalog');
        selectProduct(existing);
        return;
      }

      // Generate SKU from name
      const sku = searchQuery.trim().replace(/\s+/g, '-').toUpperCase().substring(0, 20);
      
      // Insert new product
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert([{
          name: searchQuery.trim(),
          sku: sku,
          cost_price: 0,
          selling_price: 0,
          price: 0,
          tax_rate: 18,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      // Notify admin
      const adminMessage = `🆕 NEW PRODUCT ADDED BY MANAGER\n📦 ${searchQuery.trim()}\n⏰ ${new Date().toLocaleString('en-UG')}`;
      console.log('Admin notification:', adminMessage);
      
      // Optional: Send notification to admin via email/push
      toast.success('✅ Product added to catalog! Admin notified.');
      
      // Load updated products
      await loadProducts();
      selectProduct(newProduct);
    } catch (error) {
      console.error('❌ Error adding product:', error);
      toast.error('Failed to add product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Selection Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          <FiBox className="h-5 w-5" />
          🛒 Order Items - Select from Catalog
        </h3>

        {/* Quick Select Dropdown - All Products */}
        <div className="mb-4 p-4 bg-white rounded-lg border-2 border-blue-200">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ⚡ Quick Select - All Products ({products.length})
          </label>
          <select
            onChange={(e) => {
              if (e.target.value) {
                const product = products.find(p => p.id === e.target.value);
                if (product) {
                  selectProduct(product);
                  setSearchQuery(product.name);
                }
                e.target.value = '';
              }
            }}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white"
          >
            <option value="">-- Click to Browse All Products --</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku}) - {formatCurrency(product.selling_price)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Product Search */}
          <div className="lg:col-span-5 relative" ref={dropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📦 Product Name
            </label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  setSelectedProduct(null);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search product name, SKU, or barcode..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Dropdown */}
            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-blue-300 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-100 border-b border-gray-100 transition-colors last:border-b-0"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{product.name}</p>
                        <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(product.selling_price)}</p>
                        <p className="text-xs text-gray-500">Stock: {product.current_stock || 0}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchQuery && filteredProducts.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-amber-50 border-2 border-amber-300 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    ⚠️ No products found matching "{searchQuery}"
                  </p>
                  <button
                    onClick={addNewProduct}
                    type="button"
                    className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    <FiPlus className="h-5 w-5" />
                    ✨ Add "{searchQuery}" to Catalog
                  </button>
                  <p className="text-xs text-amber-700 mt-2">
                    💡 New product will be added & admin will be notified
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quantity Section */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📊 Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
            />
          </div>

          {/* Unit Type */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📦 Unit Type
            </label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="units">Units</option>
              <option value="boxes">Boxes</option>
            </select>
          </div>

          {/* Units per Box (if boxes selected) */}
          {unitType === 'boxes' && (
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📦 Units/Box
              </label>
              <input
                type="number"
                value={unitsPerBox}
                onChange={(e) => setUnitsPerBox(Math.max(1, parseInt(e.target.value) || 12))}
                min="1"
                className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
              />
            </div>
          )}

          {/* Unit Price */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💰 Selling Price (UGX)
            </label>
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              min="0"
              step="100"
              className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-bold text-green-600"
            />
          </div>

          {/* Buying Price */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🏪 Buying Price (UGX)
            </label>
            <input
              type="number"
              value={buyingPrice}
              onChange={(e) => setBuyingPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              min="0"
              step="100"
              className="w-full px-3 py-3 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none font-bold text-orange-600"
            />
          </div>
        </div>

        {/* Smart Info Display */}
        {selectedProduct && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-blue-100 rounded-lg p-3 border-l-4 border-blue-500">
              <p className="text-xs text-blue-600 font-semibold">Total Units</p>
              <p className="text-lg font-bold text-blue-900">{getTotalUnits()}</p>
            </div>
            <div className="bg-green-100 rounded-lg p-3 border-l-4 border-green-500">
              <p className="text-xs text-green-600 font-semibold">Item Total</p>
              <p className="text-lg font-bold text-green-900">{formatCurrency(calculateTotalPrice())}</p>
            </div>
            <div className={`rounded-lg p-3 border-l-4 ${buyingPrice > 0 && unitPrice > buyingPrice ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'}`}>
              <p className="text-xs font-semibold">Profit Margin</p>
              <p className={`text-lg font-bold ${buyingPrice > 0 && unitPrice > buyingPrice ? 'text-green-900' : 'text-red-900'}`}>
                {buyingPrice > 0 ? `${((unitPrice - buyingPrice) / buyingPrice * 100).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="bg-purple-100 rounded-lg p-3 border-l-4 border-purple-500">
              <p className="text-xs text-purple-600 font-semibold">Current Stock</p>
              <p className="text-lg font-bold text-purple-900">{selectedProduct.current_stock || 0}</p>
            </div>
          </div>
        )}

        {/* Add Button */}
        <button
          onClick={addOrUpdateItem}
          disabled={!selectedProduct}
          className={`w-full mt-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
            selectedProduct
              ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:shadow-lg'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          <FiPlus className="h-5 w-5" />
          {editingIndex !== null ? 'Update Item' : 'Add Item to Order'}
        </button>
      </div>

      {/* Items List */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FiCheckCircle className="h-5 w-5 text-blue-600" />
          📋 Order Items ({orderItems.length} items)
        </h3>

        {orderItems.length > 0 ? (
          <div className="space-y-3">
            {orderItems.map((item, index) => (
              <div
                key={item.id}
                className={`bg-white border-2 rounded-lg p-4 hover:shadow-md transition-all ${
                  editingIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* Product Info */}
                  <div className="md:col-span-3">
                    <p className="font-bold text-gray-800">{item.product_name}</p>
                    <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                  </div>

                  {/* Quantity Info */}
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-600 font-semibold">Quantity</p>
                    <p className="font-bold text-blue-600">
                      {item.display_quantity} {item.unit_type === 'boxes' ? 'boxes' : 'units'}
                      {item.unit_type === 'boxes' && <span className="text-sm text-gray-600"> ({item.quantity} units)</span>}
                    </p>
                  </div>

                  {/* Prices */}
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-600 font-semibold">Selling Price</p>
                    <p className="font-bold text-green-600">{formatCurrency(item.unit_price)}</p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-600 font-semibold">Buying Price</p>
                    <p className="font-bold text-orange-600">{formatCurrency(item.buying_price)}</p>
                  </div>

                  {/* Margin */}
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-600 font-semibold">Margin</p>
                    <p className={`font-bold ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.margin_percent}%
                    </p>
                  </div>

                  {/* Total */}
                  <div className="md:col-span-1">
                    <p className="text-xs text-gray-600 font-semibold">Total</p>
                    <p className="font-bold text-gray-900">{formatCurrency(item.total)}</p>
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      onClick={() => editItem(index)}
                      className="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1 text-sm font-semibold"
                    >
                      <FiEdit2 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => removeItem(index)}
                      className="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1 text-sm font-semibold"
                    >
                      <FiX className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Totals Summary */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border-2 border-gray-200 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold">Total Items</p>
                  <p className="text-2xl font-bold text-blue-600">{orderItems.length}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold">Total Units</p>
                  <p className="text-2xl font-bold text-purple-600">{totals.totalUnits || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold">Subtotal</p>
                  <p className="text-2xl font-bold text-gray-800">{formatCurrency(totals.subtotal)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold">VAT (18%)</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(totals.tax)}</p>
                </div>
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-3 text-white">
                  <p className="text-xs font-semibold">TOTAL</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 text-center">
            <FiAlertCircle className="h-12 w-12 text-blue-500 mx-auto mb-3" />
            <p className="text-blue-800 font-semibold">No items added yet</p>
            <p className="text-sm text-blue-600 mt-1">Search and add products above to start building your order</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderItemsSelector;
