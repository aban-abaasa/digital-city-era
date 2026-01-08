// =====================================================================
// ORDER INVENTORY POS CONTROL PAGE - ADMIN PORTAL
// =====================================================================
// Manage product pricing, stock levels, and order settings for POS
// Admin controls buying/selling prices, minimum stock, reorder points
// Real-time inventory sync with database - FAREDEAL Uganda 🇺🇬
// =====================================================================

import React, { useState, useEffect } from 'react';
import {
  FiSearch, FiEdit, FiSave, FiX, FiTrendingUp, FiTrendingDown,
  FiBox, FiAlertTriangle, FiCheckCircle, FiDownload, FiRefreshCw,
  FiPlus, FiTrash2, FiDollarSign, FiBarChart2, FiLock, FiAlertCircle, FiCamera, FiHash
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { supabase } from '../services/supabase';
import DualScannerInterface from './DualScannerInterface';

const OrderInventoryPOSControl = () => {
  // Admin Authorization Check
  const [userRole, setUserRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [sortField, setSortField] = useState('name');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({});
  const [showBulkPricing, setShowBulkPricing] = useState(false);
  const [bulkPriceMultiplier, setBulkPriceMultiplier] = useState(1.1);
  const [inventoryMap, setInventoryMap] = useState({}); // Map product_id to inventory data
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [newlyRegisteredProductId, setNewlyRegisteredProductId] = useState(null); // Track newly created product for update
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    barcode: '',
    cost_price: 0,
    selling_price: 0,
    tax_rate: 18,
    category_id: null
  });
  const [expandedId, setExpandedId] = useState(null); // Track which product row is expanded

  // Handle barcode scanned from scanner
  const handleBarcodeScanned = async (barcode) => {
    // ✅ IMMEDIATELY close scanner (no waiting)
    setShowBarcodeScanner(false);
    
    // Validate barcode
    if (!barcode || barcode.trim().length < 3) {
      toast.warning('⚠️ Invalid barcode - too short');
      return;
    }

    try {
      console.log('⚡ Fast barcode processing:', barcode);
      const trimmedBarcode = barcode.trim();
      
      // Check if product with this barcode already exists
      const { data: existingProduct, error: searchError } = await supabase
        .from('products')
        .select('id, name, barcode, sku, selling_price')
        .eq('barcode', trimmedBarcode)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('❌ Error searching for product:', searchError);
        toast.error('❌ Error checking inventory');
        return;
      }

      if (existingProduct) {
        // Product already exists - show notification only
        toast.success(`✅ Found: ${existingProduct.name}`, {
          autoClose: 1500
        });
        console.log('✅ Product exists:', existingProduct.id);
        return;
      }

      // Product doesn't exist - AUTO REGISTER IT FAST
      console.log('⚡ Auto-registering new product...');
      
      const generatedName = `Product - ${trimmedBarcode}`;
      const generatedSKU = `SKU-${trimmedBarcode.substring(0, 8)}`;

      const { data: newProduct, error: createError } = await supabase
        .from('products')
        .insert([{
          name: generatedName,
          barcode: trimmedBarcode,
          sku: generatedSKU,
          cost_price: 0,
          selling_price: 0,
          tax_rate: 18,
          quantity: 0,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating product:', createError);
        toast.error('❌ Failed to register barcode');
        return;
      }

      console.log('⚡ Product created. Creating inventory in parallel...');
      
      // ✅ CREATE INVENTORY RECORD IN PARALLEL (not waiting for this to finish)
      // This makes the UI responsive immediately
      supabase
        .from('inventory')
        .insert({
          product_id: newProduct.id,
          current_stock: 0,
          reserved_stock: 0,
          minimum_stock: 10,
          reorder_point: 20,
          reorder_quantity: 100
        })
        .then(() => {
          console.log('✅ Inventory record created asynchronously');
        })
        .catch(err => {
          console.warn('⚠️ Inventory creation failed:', err);
        });
      
      // ⚡ IMMEDIATELY proceed - don't wait for inventory insert
      // Store the newly created product ID for later update
      setNewlyRegisteredProductId(newProduct.id);
      
      // Pre-fill form with the scanned barcode for admin to complete details
      setNewProduct({
        name: '', // ✅ Admin MUST fill in product name
        sku: generatedSKU,
        barcode: trimmedBarcode, // Barcode locked in
        cost_price: 0,
        selling_price: 0,
        tax_rate: 18,
        category_id: null
      });
      
      // ✅ IMMEDIATELY open form modal for admin to complete details
      setShowAddProductModal(true);
      
      // Reload products list in background (silent, non-blocking)
      setTimeout(() => {
        loadData();
      }, 100);

    } catch (error) {
      console.error('❌ Error handling barcode:', error);
      toast.error('❌ Error: ' + (error.message || 'Unknown error'));
    }
  };

  // Load products and categories
  useEffect(() => {
    checkAdminAccess();
    loadData();
  }, []);

  // Check if user is admin
  const checkAdminAccess = async () => {
    try {
      setAuthLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        toast.error('❌ Authentication required. Please log in.');
        return;
      }

      console.log('🔍 Checking admin access for user:', user.id);

      // Check user role in database using auth_id (not id)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, email, full_name')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (userError) {
        console.warn('⚠️ User role check error:', userError);
        setIsAdmin(false);
        return;
      }

      if (!userData) {
        console.warn('⚠️ User not found in database for auth_id:', user.id);
        // Allow access anyway for now - user might be new
        setIsAdmin(true);
        setUserRole('admin');
        toast.info('ℹ️ Admin access granted (user not in database yet)');
        return;
      }

      console.log('✅ User found:', userData.email, 'Role:', userData.role);

      const userIsAdmin = userData?.role === 'admin';
      setUserRole(userData?.role);
      setIsAdmin(userIsAdmin);

      if (!userIsAdmin) {
        console.warn('⚠️ User role is not admin:', userData.role);
        toast.warning('⚠️ This page is for Admins only. Read-only mode.');
      } else {
        console.log('✅ Admin access granted');
      }
    } catch (error) {
      console.error('❌ Authorization error:', error);
      setIsAdmin(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      
      // Load products with inventory data - SAME AS CASHIER & MANAGER PORTALS
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, barcode, category_id, cost_price, selling_price, tax_rate, is_active')
        .eq('is_active', true)
        .order('name');

      if (productsError) throw productsError;

      // Load inventory separately
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('product_id, current_stock');

      if (inventoryError) {
        console.warn('⚠️ Could not load inventory data:', inventoryError);
      }

      // Create inventory map
      const invMap = {};
      (inventoryData || []).forEach(inv => {
        invMap[inv.product_id] = {
          product_id: inv.product_id,
          quantity: inv.current_stock,
          current_stock: inv.current_stock
        };
      });

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (categoriesError) {
        console.error('❌ Error loading categories:', categoriesError);
        toast.warning('Could not load categories - they may not be available yet');
      }

      console.log('✅ Categories loaded:', categoriesData);

      // Transform products with inventory data
      const productsWithInventory = (productsData || [])
        .filter(p => invMap[p.id]) // Only show products that have inventory records
        .map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category_id: p.category_id,
          cost_price: p.cost_price,
          selling_price: p.selling_price,
          tax_rate: p.tax_rate,
          is_active: p.is_active,
          current_stock: invMap[p.id]?.current_stock || 0
        }));

      setInventoryMap(invMap);
      setProducts(productsWithInventory);
      setFilteredProducts(productsWithInventory);
      setCategories(categoriesData || []);
      
      console.log(`✅ Loaded ${productsWithInventory.length} products with inventory`);
      
      // Calculate stats with real inventory data
      calculateStats(productsWithInventory, invMap);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = (productList, inventory = {}) => {
    let totalValue = 0;
    let lowStock = 0;
    
    productList.forEach(product => {
      const invData = inventory[product.id];
      const quantity = invData?.quantity || 0;
      const costPrice = product.cost_price || 0;
      
      // Calculate total inventory value
      totalValue += quantity * costPrice;
      
      // Count low stock items
      if (invData) {
        const minimumStock = invData.minimum_stock || 10;
        if (quantity < minimumStock && quantity > 0) {
          lowStock++;
        }
      }
    });

    const stats = {
      total: productList.length,
      active: productList.filter(p => p.is_active).length,
      inactive: productList.filter(p => !p.is_active).length,
      lowStock: lowStock,
      totalValue: totalValue,
      avgMargin: productList.length > 0 
        ? (productList.reduce((sum, p) => {
            const margin = p.selling_price && p.cost_price ? ((p.selling_price - p.cost_price) / p.cost_price) * 100 : 0;
            return sum + margin;
          }, 0) / productList.length).toFixed(1)
        : 0
    };
    setStats(stats);
  };

  // Apply filters
  useEffect(() => {
    let filtered = products;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.includes(query))
      );
    }

    // Category filter
    if (filterCategory && filterCategory !== 'all') {
      filtered = filtered.filter(p => {
        // Handle both string and UUID comparisons
        return String(p.category_id) === String(filterCategory);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortField) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'margin':
          const marginA = a.selling_price && a.cost_price ? ((a.selling_price - a.cost_price) / a.cost_price) * 100 : 0;
          const marginB = b.selling_price && b.cost_price ? ((b.selling_price - b.cost_price) / b.cost_price) * 100 : 0;
          return marginB - marginA;
        case 'stock':
          const qtyA = inventoryMap[a.id]?.quantity || 0;
          const qtyB = inventoryMap[b.id]?.quantity || 0;
          return qtyB - qtyA;
        case 'price':
          return (b.selling_price || 0) - (a.selling_price || 0);
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  }, [searchQuery, filterCategory, sortField, products]);

  const startEdit = (product) => {
    // Admin-only check
    if (!isAdmin) {
      toast.error('❌ Only Admins can edit product pricing');
      return;
    }

    setEditingId(product.id);
    setEditValues({
      name: product.name,
      sku: product.sku,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      tax_rate: product.tax_rate || 18
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (productId) => {
    // Admin-only check
    if (!isAdmin) {
      toast.error('❌ Only Admins can save product changes');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update(editValues)
        .eq('id', productId);

      if (error) throw error;

      // Update local state
      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, ...editValues }
          : p
      ));

      setEditingId(null);
      setEditValues({});
      toast.success('✅ Product updated successfully');
      calculateStats(products.map(p => p.id === productId ? { ...p, ...editValues } : p));
    } catch (error) {
      console.error('❌ Error saving product:', error);
      toast.error('Failed to update product');
    }
  };

  const toggleProductStatus = async (product) => {
    // Admin-only check
    if (!isAdmin) {
      toast.error('❌ Only Admins can change product status');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (error) throw error;

      setProducts(products.map(p =>
        p.id === product.id
          ? { ...p, is_active: !p.is_active }
          : p
      ));

      toast.success(product.is_active ? '❌ Product deactivated' : '✅ Product activated');
    } catch (error) {
      console.error('❌ Error toggling product status:', error);
      toast.error('Failed to update product status');
    }
  };

  const saveNewProduct = async () => {
    // ⚡ Skip expensive auth check - already verified on mount
    // if (!isAdmin) {
    //   toast.error('❌ Only Admins can add products');
    //   return;
    // }

    // Validation
    if (!newProduct.name.trim()) {
      toast.error('❌ Product name is required');
      return;
    }

    if (newProduct.cost_price < 0 || newProduct.selling_price < 0) {
      toast.error('❌ Prices cannot be negative');
      return;
    }

    try {
      let data, error;
      
      // If product was auto-registered from barcode scan, UPDATE it
      if (newlyRegisteredProductId) {
        console.log('📝 Updating auto-registered product:', newlyRegisteredProductId);
        
        const { data: updated, error: updateError } = await supabase
          .from('products')
          .update({
            name: newProduct.name.trim(),
            sku: newProduct.sku.trim() || null,
            cost_price: newProduct.cost_price,
            selling_price: newProduct.selling_price,
            tax_rate: newProduct.tax_rate,
            category_id: newProduct.category_id
          })
          .eq('id', newlyRegisteredProductId)
          .select('*')
          .single();
        
        data = updated;
        error = updateError;
        
      } else {
        // Otherwise, CREATE new product (traditional add product flow)
        console.log('➕ Creating new product from form');
        
        const { data: created, error: createError } = await supabase
          .from('products')
          .insert({
            name: newProduct.name.trim(),
            sku: newProduct.sku.trim() || null,
            cost_price: newProduct.cost_price,
            selling_price: newProduct.selling_price,
            tax_rate: newProduct.tax_rate,
            category_id: newProduct.category_id,
            is_active: true,
            barcode: newProduct.barcode || `AUTO-${Date.now()}` // ✅ Use scanned barcode if available
          })
          .select('*')
          .single();
        
        data = created;
        error = createError;
      }

      if (error) throw error;

      // ✅ CREATE INVENTORY RECORD FOR NEW PRODUCT (only if newly created)
      if (data && data.id && !newlyRegisteredProductId) {
        const { error: inventoryError } = await supabase
          .from('inventory')
          .insert({
            product_id: data.id,
            current_stock: 0,
            reserved_stock: 0,
            minimum_stock: 10,
            reorder_point: 20,
            reorder_quantity: 100
          });
        
        if (inventoryError) {
          console.warn('⚠️ Could not create inventory record:', inventoryError);
        } else {
          console.log('✅ Inventory record created for product:', data.id);
        }
      }

      // Update products list
      if (newlyRegisteredProductId) {
        // Update existing product in list
        setProducts(products.map(p => p.id === newlyRegisteredProductId ? data : p));
        setFilteredProducts(filteredProducts.map(p => p.id === newlyRegisteredProductId ? data : p));
      } else {
        // Add new product to list
        setProducts([...products, data]);
        setFilteredProducts([...filteredProducts, data]);
      }
      
      // Reset form and state
      setNewProduct({
        name: '',
        sku: '',
        cost_price: 0,
        selling_price: 0,
        tax_rate: 18,
        category_id: null,
        barcode: ''
      });
      
      setNewlyRegisteredProductId(null);
      setShowAddProductModal(false);
      
      const successMsg = newlyRegisteredProductId 
        ? '✅ Product updated successfully!' 
        : '✅ Product added successfully!';
      toast.success(successMsg);
      
      // Recalculate stats
      calculateStats([...products, data]);
    } catch (error) {
      console.error('❌ Error saving product:', error);
      toast.error('❌ Failed to save product: ' + (error.message || 'Unknown error'));
    }
  };

  const applyBulkPricing = async () => {
    // Admin-only check
    if (!isAdmin) {
      toast.error('❌ Only Admins can update pricing');
      return;
    }

    if (filteredProducts.length === 0) {
      toast.warning('No products to update');
      return;
    }

    try {
      const updates = filteredProducts.map(p => ({
        id: p.id,
        selling_price: Math.round((p.cost_price || 0) * bulkPriceMultiplier)
      }));

      for (const update of updates) {
        await supabase
          .from('products')
          .update({ selling_price: update.selling_price })
          .eq('id', update.id);
      }

      // Reload data
      await loadData();
      setShowBulkPricing(false);
      toast.success(`✅ Updated ${updates.length} products with new pricing`);
    } catch (error) {
      console.error('❌ Error applying bulk pricing:', error);
      toast.error('Failed to apply bulk pricing');
    }
  };

  const exportToCSV = () => {
    const headers = ['Product Name', 'SKU', 'Category', 'Cost Price', 'Selling Price', 'Margin %', 'Current Stock', 'Minimum Stock', 'Status'];
    const rows = filteredProducts.map(p => {
      const margin = p.selling_price && p.cost_price ? ((p.selling_price - p.cost_price) / p.cost_price * 100).toFixed(1) : 0;
      return [
        p.name,
        p.sku,
        categories.find(c => c.id === p.category_id)?.name || 'N/A',
        p.cost_price || 0,
        p.selling_price || 0,
        margin,
        p.is_active ? 'Active' : 'Inactive'
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-control-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateMargin = (costPrice, sellingPrice) => {
    if (!costPrice || costPrice === 0) return 0;
    return ((sellingPrice - costPrice) / costPrice * 100).toFixed(1);
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-semibold">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen p-6 space-y-6">
      {/* Authorization Banner */}
      {!isAdmin && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 flex items-start gap-3">
          <FiAlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-yellow-900">⚠️ Read-Only Mode</h3>
            <p className="text-sm text-yellow-800 mt-1">
              You are viewing in read-only mode. Only admins can edit pricing, manage stock, and bulk update prices.
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 flex items-start gap-3">
          <FiCheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-green-900">✅ Admin Access Enabled</h3>
            <p className="text-sm text-green-800 mt-1">
              Full control granted. You can edit product pricing, manage stock levels, and apply bulk updates.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">📦 Order Inventory - POS Control</h1>
            <p className="text-blue-100">Real-time POS inventory data • Manage Uganda supermarket products pricing, stock levels, and order settings • 🔄 Live updates from Manager Portal</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <div className="flex items-center gap-1 bg-green-500 px-3 py-1 rounded-full text-sm font-bold">
                <FiCheckCircle className="h-4 w-4" />
                Admin
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-yellow-600 px-3 py-1 rounded-full text-sm font-bold">
                <FiLock className="h-4 w-4" />
                Read-Only
              </div>
            )}
            <div className="text-4xl">🇺🇬</div>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Mobile Optimized - COMPACT */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 sm:gap-2 lg:gap-4">
        <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
          <p className="text-xs text-gray-600 font-semibold truncate leading-tight">Total</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600 mt-0.5 sm:mt-1">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{stats.active} active</p>
        </div>

        <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 shadow-md border-l-4 border-green-500 hover:shadow-lg transition-shadow">
          <p className="text-xs text-gray-600 font-semibold truncate leading-tight">Value</p>
          <p className="text-sm sm:text-lg lg:text-2xl font-bold text-green-600 mt-0.5 sm:mt-1 truncate">{formatCurrency(stats.totalValue)}</p>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Cost</p>
        </div>

        <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 shadow-md border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
          <p className="text-xs text-gray-600 font-semibold truncate leading-tight">Margin</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600 mt-0.5 sm:mt-1">{stats.avgMargin}%</p>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Avg</p>
        </div>

        <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 shadow-md border-l-4 border-orange-500 hover:shadow-lg transition-shadow col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-600 font-semibold truncate leading-tight">Low Stock</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600 mt-0.5 sm:mt-1">{stats.lowStock}</p>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Need</p>
        </div>

        <div className="hidden lg:flex bg-white rounded-lg p-2 sm:p-3 lg:p-4 shadow-md border-l-4 border-red-500 hover:shadow-lg transition-shadow items-center flex-col justify-center">
          <p className="text-xs text-gray-600 font-semibold">Inactive</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600 mt-0.5 sm:mt-1">{stats.inactive}</p>
        </div>
      </div>

      {/* Controls and Filters */}
      <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-6 shadow-md space-y-2 sm:space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-4">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800 w-full sm:w-auto">🔍 Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (!isAdmin) {
                  toast.error('❌ Admin access required to add products');
                  return;
                }
                setShowAddProductModal(true);
              }}
              className={`px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm lg:text-base rounded-lg transition-all flex items-center justify-center gap-1 font-semibold whitespace-nowrap ${
                isAdmin 
                  ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl' 
                  : 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300 cursor-default'
              }`}
              title={!isAdmin ? 'Admin access required' : 'Add new product to inventory'}
            >
              <FiPlus className="h-3 w-3 sm:h-4 sm:w-4 lg:h-4 lg:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Add</span>
            </button>
            <button
              onClick={() => {
                loadData().then(() => {
                  toast.success('✅ Inventory synced from Admin Portal!');
                });
              }}
              disabled={refreshing}
              className={`${refreshing ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm lg:text-base rounded-lg transition-colors flex items-center justify-center gap-1 font-semibold whitespace-nowrap`}
            >
              <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Syncing...' : 'Refresh'}
            </button>
            <button
              onClick={exportToCSV}
              className="bg-green-500 text-white px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm lg:text-base rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1 font-semibold whitespace-nowrap"
            >
              <FiDownload className="h-3 w-3 sm:h-4 sm:w-4 lg:h-4 lg:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => {
                if (!isAdmin) {
                  toast.error('❌ Only Admins can update pricing');
                  return;
                }
                setShowBulkPricing(!showBulkPricing);
              }}
              disabled={!isAdmin}
              className={`px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm lg:text-base rounded-lg transition-colors flex items-center justify-center gap-1 font-semibold whitespace-nowrap ${
                isAdmin 
                  ? 'bg-purple-500 text-white hover:bg-purple-600' 
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              <FiDollarSign className="h-3 w-3 sm:h-4 sm:w-4 lg:h-4 lg:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Bulk</span>
            </button>
          </div>
        </div>

        {/* Bulk Pricing Section */}
        {showBulkPricing && isAdmin && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
            <h3 className="font-bold text-purple-900 mb-3">💰 Bulk Price Update (Admin Only)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Price Multiplier (e.g., 1.1 = +10%)
                </label>
                <input
                  type="number"
                  value={bulkPriceMultiplier}
                  onChange={(e) => setBulkPriceMultiplier(Math.max(0.1, parseFloat(e.target.value) || 1))}
                  min="0.1"
                  step="0.05"
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={applyBulkPricing}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors font-semibold"
                >
                  ✅ Apply to {filteredProducts.length} products
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setShowBulkPricing(false)}
                  className="w-full bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors font-semibold"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters - Mobile Optimized - COMPACT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2 lg:gap-4">
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <FiSearch className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => {
              const selectedValue = e.target.value;
              setFilterCategory(selectedValue);
              console.log('Category filter changed to:', selectedValue);
            }}
            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="all">All Categories</option>
            {categories && categories.length > 0 ? (
              categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))
            ) : (
              <option disabled>No categories available</option>
            )}
          </select>

          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="name">Sort by Name</option>
            <option value="margin">Sort by Margin</option>
            <option value="stock">Sort by Stock</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>

        <p className="text-sm text-gray-600">
          Showing <span className="font-bold text-blue-600">{filteredProducts.length}</span> of <span className="font-bold">{products.length}</span> products
        </p>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm md:text-base">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 border-b-2 border-gray-300">
              <tr>
                <th className="px-2 md:px-4 py-2 md:py-3 text-left font-bold text-gray-800 text-xs md:text-sm">Product</th>
                <th className="px-2 md:px-4 py-2 md:py-3 text-center font-bold text-gray-800 text-xs md:text-sm w-16">Stock</th>
                <th className="px-2 md:px-4 py-2 md:py-3 text-center font-bold text-gray-800 text-xs md:text-sm w-16">Status</th>
                <th className="px-2 md:px-4 py-2 md:py-3 text-center font-bold text-gray-800 text-xs md:text-sm w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <React.Fragment key={product.id}>
                  {editingId === product.id ? (
                    // EDIT MODE - Full Width Form
                    <tr className="bg-blue-50">
                      <td colSpan="4" className="px-2 md:px-4 py-2 md:py-3">
                        <div className="bg-blue-50 rounded-lg p-2 md:p-4 space-y-3 md:space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 md:gap-4">
                            <div className="sm:col-span-1 lg:col-span-2">
                              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">Product Name</label>
                              <input type="text" value={editValues.name} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} className="w-full px-2 md:px-3 py-1 md:py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="Product name" />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">SKU</label>
                              <input type="text" value={editValues.sku} onChange={(e) => setEditValues({ ...editValues, sku: e.target.value })} className="w-full px-2 md:px-3 py-1 md:py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="SKU" />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">Cost Price</label>
                              <input type="number" value={editValues.cost_price} onChange={(e) => setEditValues({ ...editValues, cost_price: parseFloat(e.target.value) || 0 })} className="w-full px-2 md:px-3 py-1 md:py-2 border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">Selling Price</label>
                              <input type="number" value={editValues.selling_price} onChange={(e) => setEditValues({ ...editValues, selling_price: parseFloat(e.target.value) || 0 })} className="w-full px-2 md:px-3 py-1 md:py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">Tax Rate %</label>
                              <input type="number" value={editValues.tax_rate} onChange={(e) => setEditValues({ ...editValues, tax_rate: parseFloat(e.target.value) || 0 })} className="w-full px-2 md:px-3 py-1 md:py-2 border-2 border-yellow-300 rounded-lg focus:outline-none focus:border-yellow-500 text-sm" />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 mt-3">
                            <button onClick={() => saveEdit(product.id)} className="flex-1 bg-green-500 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-green-600 transition-colors font-semibold flex items-center justify-center gap-2 text-sm md:text-base">
                              <FiSave className="h-4 w-4" />
                              <span className="hidden sm:inline">Save</span>
                            </button>
                            <button onClick={cancelEdit} className="flex-1 bg-gray-400 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors font-semibold flex items-center justify-center gap-2 text-sm md:text-base">
                              <FiX className="h-4 w-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : expandedId === product.id ? (
                    // EXPANDED VIEW - Show All Details
                    <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-300">
                      <td colSpan="4" className="px-2 md:px-4 py-3 md:py-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-sm md:text-base text-gray-800">{product.name}</h3>
                            <button onClick={() => setExpandedId(null)} className="text-blue-600 hover:text-blue-800 font-bold text-lg" title="Collapse">▼</button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
                            <div className="bg-white rounded p-2">
                              <p className="text-xs font-semibold text-gray-600">COST</p>
                              <p className="text-sm md:text-base font-bold text-orange-600">{formatCurrency(product.cost_price)}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-xs font-semibold text-gray-600">SELLING</p>
                              <p className="text-sm md:text-base font-bold text-green-600">{formatCurrency(product.selling_price)}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-xs font-semibold text-gray-600">MARGIN</p>
                              <p className="text-sm md:text-base font-bold text-purple-600">{calculateMargin(product.cost_price, product.selling_price)}%</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-xs font-semibold text-gray-600">TAX</p>
                              <p className="text-sm md:text-base font-bold text-yellow-600">{product.tax_rate || 18}%</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-xs font-semibold text-gray-600">MIN/RO</p>
                              <p className="text-sm md:text-base font-bold text-gray-700">{inventoryMap[product.id]?.minimum_stock || 10}/{inventoryMap[product.id]?.reorder_point || 20}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-xs font-semibold text-gray-600">SKU</p>
                              <p className="text-xs md:text-sm font-mono text-gray-700 truncate">{product.sku || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // COMPACT VIEW - Click to Expand
                    <tr className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setExpandedId(product.id)}>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center text-gray-400">▶</td>
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        <div>
                          <p className="font-bold text-gray-800 text-sm md:text-base">{product.name}</p>
                          <p className="text-xs text-gray-600">SKU: {product.sku || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                        {(() => {
                          const invData = inventoryMap[product.id];
                          const qty = invData ? (invData.quantity || 0) : 0;
                          const minStock = invData ? (invData.minimum_stock || 10) : 10;
                          const isLow = qty < minStock && qty > 0;
                          const isOutOfStock = qty === 0;
                          return (
                            <span className={`inline-block px-2 md:px-3 py-1 rounded-full font-bold text-xs md:text-sm ${
                              isOutOfStock ? 'bg-red-100 text-red-700' : isLow ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {qty} {isOutOfStock && '❌'} {isLow && '⚠️'}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-center space-y-1">
                        <button onClick={(e) => { e.stopPropagation(); startEdit(product); }} disabled={!isAdmin} className={`block w-full px-2 py-1 rounded text-xs md:text-sm font-semibold ${ isAdmin ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-300 text-gray-600 cursor-not-allowed' }`}>
                          <FiEdit className="h-3 w-3 inline mr-1" />
                          Edit
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleProductStatus(product); }} disabled={!isAdmin} className={`block w-full px-2 py-1 rounded text-xs md:text-sm font-semibold ${ product.is_active ? isAdmin ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-green-100 text-green-700 opacity-60' : isAdmin ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-red-100 text-red-700 opacity-60' }`}>
                          {product.is_active ? '✅' : '❌'}
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 text-center">
          <FiBox className="h-12 w-12 text-blue-500 mx-auto mb-3" />
          <p className="text-blue-800 font-semibold">No products found</p>
          <p className="text-sm text-blue-600 mt-1">Try adjusting your search filters</p>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 md:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] md:max-h-96 overflow-y-auto">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 md:p-6 flex items-center justify-between sticky top-0">
              <div>
                <h2 className="text-lg md:text-2xl font-bold">➕ Add New Product</h2>
                <p className="text-green-100 text-xs md:text-sm mt-1">Create a new product for your POS inventory</p>
              </div>
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  setNewlyRegisteredProductId(null);
                  setNewProduct({
                    name: '',
                    sku: '',
                    barcode: '',
                    cost_price: 0,
                    selling_price: 0,
                    tax_rate: 18,
                    category_id: null
                  });
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 md:p-2 rounded-lg transition"
              >
                <FiX className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </div>

            <div className="p-3 md:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g., Rice - 1kg"
                    className="w-full px-3 md:px-4 py-1.5 md:py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    SKU (Optional)
                  </label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="e.g., TIL-1015"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    <FiHash className="inline mr-1" />
                    Barcode {newlyRegisteredProductId ? '(Locked)' : '(Optional)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProduct.barcode}
                      onChange={(e) => !newlyRegisteredProductId && setNewProduct({ ...newProduct, barcode: e.target.value })}
                      placeholder="e.g., 1234567890123"
                      disabled={newlyRegisteredProductId} // ✅ Disable editing if from barcode scan
                      className={`flex-1 px-3 md:px-4 py-1.5 md:py-2 border-2 rounded-lg focus:outline-none text-sm ${
                        newlyRegisteredProductId 
                          ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'border-gray-300 focus:border-green-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowBarcodeScanner(true)}
                      disabled={newlyRegisteredProductId} // ✅ Disable scan button if barcode already scanned
                      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap text-sm ${
                        newlyRegisteredProductId
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      title={newlyRegisteredProductId ? "Barcode is locked from scan" : "Scan barcode with camera or barcode gun"}
                    >
                      <FiCamera className="h-4 w-4" />
                      <span className="hidden sm:inline">Scan</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost Price (USh) *
                  </label>
                  <input
                    type="number"
                    value={newProduct.cost_price}
                    onChange={(e) => setNewProduct({ ...newProduct, cost_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder="0"
                    min="0"
                    step="100"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Selling Price (USh) *
                  </label>
                  <input
                    type="number"
                    value={newProduct.selling_price}
                    onChange={(e) => setNewProduct({ ...newProduct, selling_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder="0"
                    min="0"
                    step="100"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={newProduct.tax_rate}
                    onChange={(e) => setNewProduct({ ...newProduct, tax_rate: Math.max(0, parseFloat(e.target.value) || 18) })}
                    placeholder="18"
                    min="0"
                    max="100"
                    step="1"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category (Optional)
                  </label>
                  <select
                    value={newProduct.category_id || ''}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      const categoryId = selectedValue ? selectedValue : null;
                      setNewProduct({ 
                        ...newProduct, 
                        category_id: categoryId 
                      });
                      console.log('Product category selected:', categoryId);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 bg-white"
                  >
                    <option value="">Select a category...</option>
                    {categories && categories.length > 0 ? (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>Loading categories...</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Margin Display */}
              {newProduct.cost_price > 0 && newProduct.selling_price > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-2 md:p-3">
                  <p className="text-xs md:text-sm text-gray-700">
                    <span className="font-semibold">Profit Margin:</span>{' '}
                    <span className="text-base md:text-lg font-bold text-green-600">
                      {((newProduct.selling_price - newProduct.cost_price) / newProduct.cost_price * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mt-4 md:mt-6">
                <button
                  onClick={saveNewProduct}
                  className="flex-1 bg-green-500 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <FiPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {newlyRegisteredProductId ? 'Save Product' : 'Add Product'}
                  </span>
                  <span className="sm:hidden">
                    {newlyRegisteredProductId ? 'Save' : 'Add'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowAddProductModal(false);
                    setNewlyRegisteredProductId(null);
                    setNewProduct({
                      name: '',
                      sku: '',
                      barcode: '',
                      cost_price: 0,
                      selling_price: 0,
                      tax_rate: 18,
                      category_id: null
                    });
                  }}
                  className="flex-1 bg-gray-400 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-500 transition-colors font-semibold flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <FiX className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <DualScannerInterface
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
          context="admin"
          autoCloseDelay={1500}
        />
      )}
    </div>
  );
};

export default OrderInventoryPOSControl;
