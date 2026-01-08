import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiPackage, FiShoppingCart, FiSettings, FiTrendingUp, FiAlertTriangle, FiPlus, FiTruck, FiZap } from 'react-icons/fi';
import { supabase } from '../services/supabase';
import AddProductModal from './AddProductModal';
// import PurchaseOrderManager from './PurchaseOrderManager'; // COMMENTED OUT - Using order system instead

const ProductInventoryInterface = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  // const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false); // COMMENTED OUT
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState(0);
  const [expandedProductId, setExpandedProductId] = useState(null); // Track which product is expanded
  const [showProductList, setShowProductList] = useState(false); // Track if product list is shown

  // Load products from Supabase on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Error loading products:', productsError);
        toast.error('Failed to load products from database');
        return;
      }

      console.log('Raw products from Supabase:', productsData);

      // Fetch inventory data separately
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('product_id, current_stock, minimum_stock, reorder_point');

      if (inventoryError) {
        console.warn('⚠️ Could not load inventory data:', inventoryError);
      }

      // Create inventory map
      const inventoryMap = {};
      (inventoryData || []).forEach(inv => {
        inventoryMap[inv.product_id] = inv;
      });

      // Transform data to match component format
      const transformedProducts = (productsData || []).map(p => {
        const inv = inventoryMap[p.id] || {}; // Get inventory for this product
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: parseFloat(p.selling_price || p.price || 0),
          stock: inv.current_stock || 0,
          minStock: inv.minimum_stock || p.low_stock_threshold || 10,
          maxStock: p.maximum_stock || p.max_stock || 100,
          status: calculateStatus(
            inv.current_stock || 0,
            inv.minimum_stock || p.low_stock_threshold || 10
          ),
          location: p.location || 'Not assigned',
          supplier: p.supplier_name || p.supplier || 'No supplier',
          productId: p.id,
          inventoryId: p.inventory_id || p.id
        };
      });

      console.log(`✅ Loaded ${transformedProducts.length} products with inventory data`);
      setProducts(transformedProducts);
      
    } catch (error) {
      console.error('Error in loadProducts:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatus = (stock, minStock) => {
    if (stock === 0) return 'Out of Stock';
    if (stock <= minStock) return 'Low Stock';
    return 'In Stock';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Stock':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Low Stock':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Out of Stock':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleReorder = (product) => {
    setSelectedProduct(product);
    const suggestedQuantity = product.reorderQuantity || (product.maxStock - product.stock);
    setReorderQuantity(suggestedQuantity);
    setShowReorderModal(true);
  };

  const handleAdjust = (product) => {
    setSelectedProduct(product);
    setAdjustmentAmount(0);
    setAdjustmentReason('');
    setShowAdjustModal(true);
  };

  /**
   * Process reorder - Create a real purchase order through the system
   */
  const processReorder = async () => {
    if (!selectedProduct || reorderQuantity <= 0) {
      toast.error('Invalid reorder quantity');
      return;
    }

    try {
      setLoading(true);
      
      toast.info(
        <div>
          <div className="font-bold">🔄 Creating Purchase Order...</div>
          <div className="text-sm mt-1">
            <div>{selectedProduct.name}</div>
            <div>Quantity: {reorderQuantity} units</div>
            <div>Estimated Cost: {formatCurrency(selectedProduct.price * reorderQuantity)}</div>
            <div>Supplier: {selectedProduct.supplier || 'Default Supplier'}</div>
          </div>
        </div>,
        { autoClose: 2000 }
      );

      // Get current user (manager)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get manager's user ID from users table
      const { data: managerData, error: managerError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .eq('role', 'manager')
        .single();

      if (managerError || !managerData) {
        throw new Error('Manager profile not found');
      }

      // Get supplier ID (use the product's supplier_id or find a default supplier)
      let supplierId = selectedProduct.supplierId;
      
      if (!supplierId) {
        // Try to find any active supplier
        const { data: supplierData, error: supplierError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'supplier')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (supplierData) {
          supplierId = supplierData.id;
        } else {
          toast.warning('No supplier found. Creating order without supplier assignment.');
        }
      }

      // Generate PO number
      const poNumber = `PO-${Date.now()}`;

      // Calculate total amount
      const unitPrice = selectedProduct.price || 0;
      const totalAmount = unitPrice * reorderQuantity;

      // Create purchase order
      const { data: purchaseOrder, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: supplierId,
          ordered_by: managerData.id, // Use ordered_by instead of manager_id
          order_date: new Date().toISOString(),
          expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          status: 'pending_approval',
          priority: selectedProduct.stock === 0 ? 'urgent' : 'normal',
          total_amount_ugx: totalAmount,
          amount_paid_ugx: 0,
          balance_due_ugx: totalAmount,
          payment_status: 'unpaid',
          notes: `Auto-generated reorder from inventory management for low stock product: ${selectedProduct.name}`,
          items: [{
            product_id: selectedProduct.productId,
            product_name: selectedProduct.name,
            quantity: reorderQuantity,
            unit_price: unitPrice,
            total_price: totalAmount
          }]
        })
        .select()
        .single();

      if (poError) {
        throw poError;
      }

      // Create purchase order items entry
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: purchaseOrder.id,
          product_id: selectedProduct.productId,
          quantity: reorderQuantity,
          unit_price: unitPrice,
          total_price: totalAmount,
          notes: 'Inventory reorder'
        });

      if (itemsError) {
        console.error('Error creating PO items:', itemsError);
        // Don't throw - PO is already created
      }

      toast.success(
        <div>
          <div className="font-bold">✅ Purchase Order Created!</div>
          <div className="text-sm mt-1">
            <div>PO #: {poNumber}</div>
            <div>{selectedProduct.name}</div>
            <div>Quantity: {reorderQuantity} units</div>
            <div>Total: {formatCurrency(totalAmount)}</div>
            <div className="mt-2 text-yellow-600">📋 Order pending approval in Supplier Order Management</div>
          </div>
        </div>,
        { autoClose: 5000 }
      );

      setShowReorderModal(false);
      setSelectedProduct(null);
      setReorderQuantity(0);
      
      // Optionally reload products to update any related data
      await loadProducts();

    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error(
        <div>
          <div className="font-bold">❌ Failed to Create Purchase Order</div>
          <div className="text-sm mt-1">{error.message}</div>
        </div>,
        { autoClose: 5000 }
      );
    } finally {
      setLoading(false);
    }
  };

  const processAdjustment = async () => {
    if (selectedProduct && adjustmentAmount !== 0 && adjustmentReason.trim()) {
      try {
        const newStock = Math.max(0, selectedProduct.stock + adjustmentAmount);
        
        // Update inventory in Supabase
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            quantity: newStock
          })
          .eq('product_id', selectedProduct.productId);

        if (updateError) {
          throw updateError;
        }

        // Log the adjustment (optional - create stock_adjustments table later)
        console.log('Stock adjustment:', {
          product: selectedProduct.name,
          amount: adjustmentAmount,
          reason: adjustmentReason,
          newStock
        });

        // Update local state
        setProducts(prev => prev.map(p => {
          if (p.id === selectedProduct.id) {
            return {
              ...p,
              stock: newStock,
              status: calculateStatus(newStock, p.minStock)
            };
          }
          return p;
        }));

        toast.success(
          <div>
            <div className="font-bold">📦 Stock Adjusted Successfully</div>
            <div className="text-sm mt-1">
              <div>{selectedProduct.name}</div>
              <div>Adjustment: {adjustmentAmount > 0 ? '+' : ''}{adjustmentAmount} units</div>
              <div>Reason: {adjustmentReason}</div>
              <div>New Stock: {newStock} units</div>
            </div>
          </div>,
          { autoClose: 4000 }
        );

        setShowAdjustModal(false);
      } catch (error) {
        console.error('Error processing adjustment:', error);
        toast.error('Failed to update inventory in database');
      }
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header - Mobile Optimized */}
      <div className="p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto">
          {/* Title Section */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 md:p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
              <FiPackage className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Inventory Management
              </h2>
              <p className="text-xs md:text-sm text-gray-600">
                {loading ? 'Loading...' : `${products.length} products`}
              </p>
            </div>
          </div>
          
          {/* Action Buttons - Stacked on Mobile */}
          <div className="grid grid-cols-2 md:flex md:space-x-2 gap-2">
            <button
              onClick={() => setShowAddProductModal(true)}
              className="col-span-1 px-3 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs md:text-sm rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-medium shadow-lg flex items-center justify-center md:justify-start space-x-1 md:space-x-2"
            >
              <FiPlus className="h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden md:inline">Add Product</span>
              <span className="md:hidden">Add</span>
            </button>
            <button
              onClick={loadProducts}
              className="col-span-1 px-3 md:px-4 py-2 md:py-2.5 bg-blue-600 text-white text-xs md:text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md flex items-center justify-center space-x-1"
              disabled={loading}
            >
              <span className="text-lg">🔄</span>
              <span className="hidden md:inline">{loading ? 'Loading...' : 'Refresh'}</span>
            </button>
            <select className="col-span-2 md:col-span-1 px-3 py-2 md:py-2.5 border border-gray-300 rounded-lg text-xs md:text-sm bg-white shadow-sm">
              <option>All Categories</option>
              <option>Electronics</option>
              <option>Food & Beverages</option>
              <option>Household</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading products from database...</p>
        </div>
      )}

      {/* No Products State - Mobile Optimized */}
      {!loading && products.length === 0 && (
        <div>
          <div className="p-6 md:p-16 text-center bg-gradient-to-br from-gray-50 to-blue-50 min-h-[calc(100vh-200px)]">
            <div className="max-w-2xl mx-auto">
              <div className="inline-flex items-center justify-center w-16 md:w-24 h-16 md:h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-4 md:mb-6">
                <FiPackage className="h-8 md:h-12 w-8 md:w-12 text-blue-600" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-3">No Products Found</h3>
              <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8">Start by adding products or creating purchase orders</p>
              
              {/* Action Cards */}
              <div className="grid grid-cols-1 gap-4 md:gap-6 max-w-2xl mx-auto">
                {/* Add Product Card */}
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="group bg-white border-2 border-green-200 rounded-xl md:rounded-2xl p-6 md:p-8 hover:border-green-500 hover:shadow-2xl transition-all transform hover:scale-105"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 md:w-20 h-14 md:h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                      <FiPlus className="h-7 md:h-10 w-7 md:w-10 text-white" />
                    </div>
                    <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Add Product</h4>
                    <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
                      Create a new product with pricing and stock details
                    </p>
                    <div className="flex items-center space-x-2 text-green-600 font-semibold text-sm">
                      <span>Add Now</span>
                      <FiPlus className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              </div>

              {/* Features List */}
              <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 md:w-12 h-10 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2 md:mb-3">
                    <FiZap className="h-5 md:h-6 w-5 md:w-6 text-blue-600" />
                  </div>
                  <h5 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">Auto-Approval</h5>
                  <p className="text-xs md:text-sm text-gray-600">Trusted suppliers get automatic approval</p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 md:w-12 h-10 md:h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2 md:mb-3">
                    <FiPackage className="h-5 md:h-6 w-5 md:w-6 text-green-600" />
                  </div>
                  <h5 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">Auto-Create</h5>
                  <p className="text-xs md:text-sm text-gray-600">Products created from orders</p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 md:w-12 h-10 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2 md:mb-3">
                    <FiTrendingUp className="h-5 md:h-6 w-5 md:w-6 text-purple-600" />
                  </div>
                  <h5 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">Real-Time</h5>
                  <p className="text-xs md:text-sm text-gray-600">Changes sync instantly</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid - Mobile Optimized with Accordion */}
      {!loading && products.length > 0 && (
        <div className="p-4 md:p-6">
          {/* Show/Hide Products Button - Compact */}
          <div className="max-w-7xl mx-auto mb-4">
            <button
              onClick={() => setShowProductList(!showProductList)}
              className="w-full flex items-center justify-between px-4 md:px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg md:rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-bold text-sm md:text-base shadow-lg"
            >
              <div className="flex items-center gap-2 md:gap-3">
                <FiPackage className="h-5 w-5 md:h-6 md:w-6" />
                <span>🔍 Product Management</span>
              </div>
              <span className="text-lg md:text-xl">
                {showProductList ? '▼' : '▶'}
              </span>
            </button>
          </div>

          {/* Products List - Collapsible */}
          {showProductList && (
            <div className="max-w-7xl mx-auto space-y-2 md:space-y-3 animate-fadeIn">
              {products.map((product) => (
                <div key={product.id} className="bg-white border-2 border-gray-200 rounded-lg md:rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                  {/* Product Summary Row - Clickable */}
                  <button
                    onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
                    className="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    {/* Expand Icon */}
                    <span className="text-lg md:text-xl flex-shrink-0 min-w-[24px] text-center">
                      {expandedProductId === product.id ? '▼' : '▶'}
                    </span>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm md:text-base">{product.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">SKU: {product.sku}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(product.status)}`}>
                          {product.status}
                        </span>
                      </div>
                    </div>

                    {/* Stock & Price - Compact */}
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm md:text-base text-gray-900">{product.stock}</div>
                      <div className="text-xs text-gray-600">
                        {formatCurrency(product.price)}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedProductId === product.id && (
                    <div className="border-t border-gray-200 p-3 md:p-4 bg-gradient-to-b from-gray-50 to-white space-y-3 md:space-y-4 animate-slideDown">
                      {/* Stock Progress */}
                      <div>
                        <div className="flex justify-between items-center text-xs md:text-sm mb-2">
                          <span className="text-gray-600">Stock Level</span>
                          <span className="font-semibold text-gray-900">
                            {product.stock} / {product.maxStock} units
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              product.stock === 0 ? 'bg-red-500' :
                              product.stock <= product.minStock ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((product.stock / product.maxStock) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
                        <div className="bg-white p-2 md:p-3 rounded-lg border border-gray-100">
                          <div className="text-gray-600">Price</div>
                          <div className="font-bold text-gray-900">{formatCurrency(product.price)}</div>
                        </div>
                        <div className="bg-white p-2 md:p-3 rounded-lg border border-gray-100">
                          <div className="text-gray-600">Min Stock</div>
                          <div className="font-bold text-gray-900">{product.minStock}</div>
                        </div>
                        <div className="bg-white p-2 md:p-3 rounded-lg border border-gray-100 col-span-2">
                          <div className="text-gray-600 mb-1">📍 Location</div>
                          <div className="font-bold text-gray-900 text-xs md:text-sm truncate">{product.location}</div>
                        </div>
                        <div className="bg-white p-2 md:p-3 rounded-lg border border-gray-100 col-span-2">
                          <div className="text-gray-600 mb-1">🏢 Supplier</div>
                          <div className="font-bold text-gray-900 text-xs md:text-sm truncate">{product.supplier}</div>
                        </div>
                      </div>

                      {/* Action Buttons - Full Width Stack */}
                      <div className="flex flex-col gap-2 pt-2 md:pt-3 border-t border-gray-200">
                        <button
                          onClick={() => {
                            handleReorder(product);
                            setExpandedProductId(null);
                          }}
                          className="w-full bg-blue-600 text-white py-2.5 md:py-3 px-3 md:px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm md:text-base flex items-center justify-center gap-2"
                        >
                          <FiShoppingCart className="h-4 w-4" />
                          <span>Reorder</span>
                        </button>
                        <button
                          onClick={() => {
                            handleAdjust(product);
                            setExpandedProductId(null);
                          }}
                          className="w-full bg-green-600 text-white py-2.5 md:py-3 px-3 md:px-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm md:text-base flex items-center justify-center gap-2"
                        >
                          <FiSettings className="h-4 w-4" />
                          <span>Adjust Stock</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reorder Modal - Mobile Optimized */}
      {showReorderModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-4 md:p-0">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto md:max-h-none">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
              🔄 Reorder
            </h3>
            
            <div className="mb-4 p-3 md:p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="font-semibold text-gray-900 text-sm md:text-base">{selectedProduct.name}</div>
              <div className="text-xs md:text-sm text-gray-600 mt-1">Current Stock: <strong>{selectedProduct.stock}</strong> units</div>
              <div className="text-xs md:text-sm text-gray-600">Supplier: {selectedProduct.supplier}</div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reorder Quantity
                </label>
                <input
                  type="number"
                  value={reorderQuantity}
                  onChange={(e) => setReorderQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
                  min="1"
                />
                <div className="mt-2 text-xs md:text-sm text-gray-600">
                  Suggested: {selectedProduct.maxStock - selectedProduct.stock} units
                </div>
              </div>

              {reorderQuantity > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-xs md:text-sm text-green-800">
                    <strong>Cost:</strong> {formatCurrency(selectedProduct.price * reorderQuantity)}
                  </div>
                  <div className="text-xs md:text-sm text-green-800 mt-1">
                    <strong>New Level:</strong> {selectedProduct.stock + reorderQuantity} units
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-3 mt-6 md:space-x-3">
              <button
                onClick={processReorder}
                disabled={reorderQuantity <= 0}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-sm md:text-base"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowReorderModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal - Mobile Optimized */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-4 md:p-0">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto md:max-h-none">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
              📦 Adjust Stock
            </h3>
            
            <div className="mb-4 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="font-semibold text-gray-900 text-sm md:text-base">{selectedProduct.name}</div>
              <div className="text-xs md:text-sm text-gray-600 mt-1">Current Stock: <strong>{selectedProduct.stock}</strong> units</div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quick Adjust
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setAdjustmentAmount(-10)}
                    className="px-2 py-2 md:py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs md:text-sm font-medium transition-colors"
                  >
                    -10
                  </button>
                  <button
                    onClick={() => setAdjustmentAmount(-5)}
                    className="px-2 py-2 md:py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs md:text-sm font-medium transition-colors"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => setAdjustmentAmount(5)}
                    className="px-2 py-2 md:py-2.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs md:text-sm font-medium transition-colors"
                  >
                    +5
                  </button>
                  <button
                    onClick={() => setAdjustmentAmount(10)}
                    className="px-2 py-2 md:py-2.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs md:text-sm font-medium transition-colors"
                  >
                    +10
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Custom Amount
                </label>
                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-base"
                  placeholder="Enter adjustment"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason
                </label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm md:text-base"
                >
                  <option value="">Select reason...</option>
                  <option value="Stock count correction">Stock count correction</option>
                  <option value="Damaged goods removal">Damaged goods removal</option>
                  <option value="Emergency restock">Emergency restock</option>
                  <option value="Return from customer">Return from customer</option>
                  <option value="Transfer between locations">Transfer between locations</option>
                  <option value="Manager override">Manager override</option>
                </select>
              </div>

              {adjustmentAmount !== 0 && (
                <div className={`p-3 rounded-lg border ${adjustmentAmount > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-xs md:text-sm ${adjustmentAmount > 0 ? 'text-green-800' : 'text-red-800'}`}>
                    <strong>Update:</strong> {selectedProduct.stock} → {Math.max(0, selectedProduct.stock + adjustmentAmount)} units
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-3 mt-6 md:space-x-3">
              <button
                onClick={processAdjustment}
                disabled={adjustmentAmount === 0 || !adjustmentReason.trim()}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-sm md:text-base"
              >
                Apply
              </button>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onProductAdded={async (newProduct) => {
          console.log('✅ New product added:', newProduct);
          toast.success(`🎉 Product "${newProduct.name}" added successfully!`);
          setShowAddProductModal(false);
          // Reload products to show the new one
          await loadProducts();
        }}
      />

      {/* Purchase Order Manager Modal - COMMENTED OUT */}
      {/* <PurchaseOrderManager
        isOpen={showPurchaseOrderModal}
        onClose={() => setShowPurchaseOrderModal(false)}
      /> */}
    </div>
  );
};

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
      overflow: hidden;
    }
    to {
      opacity: 1;
      max-height: 1000px;
      overflow: visible;
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in-out;
  }

  .animate-slideDown {
    animation: slideDown 0.3s ease-in-out;
  }
`;
document.head.appendChild(style);

export default ProductInventoryInterface;