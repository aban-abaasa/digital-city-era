import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import '../styles/animations.css';
import { 
  FiPackage, FiAlertTriangle, FiTrendingUp, FiSearch, FiFilter, FiPlus, 
  FiEdit3, FiTrash2, FiDownload, FiUpload, FiBarChart2, FiRefreshCw,
  FiEye, FiShoppingCart, FiCamera, FiGrid, FiList, FiSettings,
  FiZap, FiClock, FiDollarSign, FiTruck, FiMapPin, FiStar, FiX
} from 'react-icons/fi';
import inventoryService from '../services/inventoryApiService';
import DualScannerInterface from '../components/DualScannerInterface';
import ProductModal from '../components/ProductModal';
import StockAdjustmentModal from '../components/StockAdjustmentModal';

const Inventory = () => {
  // Core data states
  const [inventoryData, setInventoryData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [sortBy] = useState('name');
  const [sortOrder] = useState('asc');
  
  // Selection states
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Pagination
  const [currentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchInventoryData(),
        fetchCategories(),
        fetchSuppliers(),
        fetchReorderSuggestions()
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const params = {
        search: searchTerm,
        category: selectedCategory,
        stockStatus: stockFilter,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: itemsPerPage
      };
      
      const response = await inventoryService.getProducts(params);
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, [searchTerm, selectedCategory, stockFilter, sortBy, sortOrder, currentPage, itemsPerPage]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    await loadProducts();
    setRefreshing(false);
    toast.success('Inventory data refreshed!');
  }, [loadAllData, loadProducts]);

  const handleProductSelect = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, id]
    );
  };

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
    setSelectAll(!selectAll);
  }, [selectAll, products]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + N: New Product
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowProductModal(true);
      }
      
      // Ctrl/Cmd + B: Barcode Scanner
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setShowBarcodeScanner(true);
      }
      
      // Ctrl/Cmd + R: Refresh
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        handleRefresh();
      }
      
      // Ctrl/Cmd + A: Select All (when products are visible)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && products.length > 0) {
        e.preventDefault();
        handleSelectAll();
      }
      
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowProductModal(false);
        setShowBarcodeScanner(false);
        setShowStockModal(false);
        setShowKeyboardHelp(false);
        setEditingProduct(null);
      }
      
      // ?: Show keyboard shortcuts
      if ((e.key === '?' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setShowKeyboardHelp(true);
      }
      
      // F: Focus search
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput && document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
      
      // G: Toggle grid/list view
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
        toast.info(`Switched to ${viewMode === 'grid' ? 'list' : 'grid'} view`);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [products.length, viewMode, handleRefresh, handleSelectAll]);

  const fetchInventoryData = async () => {
    try {
      const response = await inventoryService.getInventoryOverview();
      setInventoryData(response.stats);
    } catch {
      toast.error('Failed to fetch inventory data');
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await inventoryService.getCategories();
      setCategories(response.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      await inventoryService.getSuppliers();
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchReorderSuggestions = async () => {
    try {
      const response = await inventoryService.getReorderSuggestions();
      setReorderSuggestions(response.data);
    } catch (error) {
      console.error('Failed to fetch reorder suggestions:', error);
    }
  };



  const handleBulkStockAdjustment = () => {
    if (selectedProducts.length === 0) {
      toast.warning('Please select products first');
      return;
    }

    setShowStockModal(true);
  };

  const handleStockAdjustmentComplete = async () => {
    await loadProducts();
    await fetchInventoryData();
    setSelectedProducts([]);
    setSelectAll(false);
    setShowBulkActions(false);
    setShowStockModal(false);
  };

  const handleExportInventory = async () => {
    try {
      await inventoryService.exportInventory('csv');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleBarcodeScanned = async (barcode) => {
    try {
      const response = await inventoryService.scanBarcode(barcode);
      if (response.success) {
        setEditingProduct(response.data);
        setShowProductModal(true);
      }
    } catch (error) {
      console.error('Barcode scan failed:', error);
    }
    setShowBarcodeScanner(false);
  };

  const handleProductSave = async () => {
    await loadProducts();
    await fetchInventoryData();
    setEditingProduct(null);
    setShowProductModal(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStockStatusColor = (product) => {
    if (!product || product.stock === 0) return 'text-red-600 bg-red-50';
    if (product.stock <= (product.minStock || 0)) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStockStatusText = (product) => {
    if (!product || product.stock === 0) return 'Out of Stock';
    if (product.stock <= (product.minStock || 0)) return 'Low Stock';
    return 'In Stock';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="ml-4 text-gray-600">Loading inventory data...</div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Products',
      value: inventoryData?.totalProducts || 0,
      icon: FiPackage,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      change: '+12%',
      changeType: 'positive'
    },
    {
      name: 'Low Stock Items',
      value: inventoryData?.lowStockProducts || 0,
      icon: FiAlertTriangle,
      color: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
      change: '-5%',
      changeType: 'positive'
    },
    {
      name: 'Out of Stock',
      value: inventoryData?.outOfStockProducts || 0,
      icon: FiTrendingUp,
      color: 'bg-gradient-to-r from-red-500 to-red-600',
      change: '-15%',
      changeType: 'positive'
    },
    {
      name: 'Total Value',
      value: formatCurrency(inventoryData?.totalInventoryValue || 0),
      icon: FiDollarSign,
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      change: '+8%',
      changeType: 'positive'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🏪 Smart Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Advanced inventory management with real-time insights
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 btn-bounce"
            title="Refresh data (Ctrl+R)"
          >
            <FiRefreshCw className={`-ml-1 mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="relative inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 hover:from-blue-700 hover:via-purple-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 btn-bounce hover-scale animate-pulse transform hover:scale-110 transition-all duration-300"
            title="Advanced Hardware Scanner - Mobile, USB, Bluetooth (Ctrl+B)"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 rounded-xl animate-pulse"></div>
            <div className="relative flex items-center space-x-2">
              <div className="relative">
                <FiCamera className="h-5 w-5" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-ping"></div>
              </div>
              <div className="flex flex-col items-start">
                <span>📱 Hardware Scanner</span>
                <span className="text-xs opacity-80">Mobile • USB • BT</span>
              </div>
            </div>
          </button>
          <button
            onClick={() => setShowProductModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 btn-bounce hover-scale"
            title="Add new product (Ctrl+N)"
          >
            <FiPlus className="-ml-1 mr-2 h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div 
            key={stat.name} 
            className="stagger-item bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover-lift card-hover"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-4 rounded-xl ${stat.color} shadow-lg animate-float`}>
                    <stat.icon className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900 animate-slideUp">
                        {stat.value}
                      </div>
                      <div className={`ml-2 flex items-baseline text-sm font-semibold animate-bounceIn ${
                        stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Filters */}
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search products, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>

            {/* Stock Filter */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Stock Levels</option>
              <option value="good">✅ In Stock</option>
              <option value="low">⚠️ Low Stock</option>
              <option value="out">❌ Out of Stock</option>
            </select>
          </div>

          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FiGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FiList className="h-4 w-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 btn-bounce"
              title="Toggle filters (F to focus search)"
            >
              <FiFilter className="h-4 w-4 mr-2" />
              Filters
            </button>

            <button
              onClick={handleExportInventory}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FiDownload className="h-4 w-4 mr-2" />
              Export
            </button>

            {selectedProducts.length > 0 && (
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <FiZap className="h-4 w-4 mr-2" />
                Bulk Actions ({selectedProducts.length})
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {showBulkActions && selectedProducts.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedProducts.length} products selected
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={handleBulkStockAdjustment}
                    className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                  >
                    📊 Adjust Stock
                  </button>
                  <button
                    onClick={() => setShowStockModal(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    ⚡ Quick Actions
                  </button>
                </div>
              </div>
              <button
                onClick={() => {setSelectedProducts([]); setShowBulkActions(false);}}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products Grid/List */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              📦 Products ({products.length})
            </h3>
            {products.length > 0 && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-600">Select All</span>
              </label>
            )}
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
            {products.map((product) => (
              <div key={product.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => handleProductSelect(product.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {setEditingProduct(product); setShowProductModal(true);}}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <FiEdit3 className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-green-600">
                      <FiEye className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">
                      {product.name || 'Unnamed Product'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      SKU: {product.sku || 'N/A'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(product.price)}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatusColor(product)}`}>
                      {getStockStatusText(product)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Stock: {product.stock || 0}</span>
                      <span>Min: {product.minStock || 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (product.stock || 0) === 0 ? 'bg-red-500' : 
                          (product.stock || 0) <= (product.minStock || 0) ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(((product.stock || 0) / (product.maxStock || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center">
                      <FiMapPin className="h-3 w-3 mr-1" />
                      {product.location || 'No Location'}
                    </span>
                    <span className="flex items-center">
                      <FiTruck className="h-3 w-3 mr-1" />
                      {product.supplier?.name || 'No Supplier'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleProductSelect(product.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name || 'Unnamed Product'}</div>
                          <div className="text-sm text-gray-500">SKU: {product.sku || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {product.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <span className="mr-2">{product.stock || 0}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              (product.stock || 0) === 0 ? 'bg-red-500' : 
                              (product.stock || 0) <= (product.minStock || 0) ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(((product.stock || 0) / (product.maxStock || 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(product.price || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.supplier?.name || 'No Supplier'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(product)}`}>
                        {getStockStatusText(product)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {setEditingProduct(product); setShowProductModal(true);}}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <FiEdit3 className="h-4 w-4" />
                        </button>
                        <button className="text-green-600 hover:text-green-900">
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button className="text-purple-600 hover:text-purple-900">
                          <FiBarChart2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {products.length === 0 && (
          <div className="text-center py-12">
            <FiPackage className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding a new product to your inventory.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowProductModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <FiPlus className="-ml-1 mr-2 h-4 w-4" />
                Add Product
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reorder Suggestions */}
      {reorderSuggestions.length > 0 && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <FiShoppingCart className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                🔄 Smart Reorder Suggestions ({reorderSuggestions.length})
              </h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reorderSuggestions.slice(0, 6).map((suggestion) => (
                <div key={suggestion.product?.id || suggestion.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {suggestion.product?.name || 'Unknown Product'}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                      {suggestion.priority || 'low'} priority
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Current Stock:</span>
                      <span className="font-medium">{suggestion.currentStock || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Suggested Order:</span>
                      <span className="font-medium text-blue-600">{suggestion.suggestedOrder || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Est. Cost:</span>
                      <span className="font-medium">{formatCurrency(suggestion.estimatedCost || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Days of Stock:</span>
                      <span className="font-medium">{Math.round(suggestion.daysOfStock || 0)} days</span>
                    </div>
                  </div>
                  <button className="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                    Create Purchase Order
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Performance */}
      {inventoryData?.categoryStats && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <FiBarChart2 className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                📊 Category Performance
              </h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventoryData.categoryStats.map((category) => (
                  <tr key={category._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">{category.icon}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {category.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {category.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {category.totalStock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(category.totalValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                                              <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                              style={{ width: `${Math.min(((category.totalValue || 0) / (inventoryData.totalInventoryValue || 1)) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">
                            {(((category.totalValue || 0) / (inventoryData.totalInventoryValue || 1)) * 100).toFixed(1)}%
                          </span>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSave={handleProductSave}
      />

      <StockAdjustmentModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        products={products.filter(p => selectedProducts.includes(p.id))}
        onAdjustmentComplete={handleStockAdjustmentComplete}
      />

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <DualScannerInterface
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 overflow-y-auto animate-modalFadeIn">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={() => setShowKeyboardHelp(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full animate-modalSlideUp">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiSettings className="h-6 w-6 text-white mr-3" />
                    <h3 className="text-xl font-bold text-white">⌨️ Keyboard Shortcuts</h3>
                  </div>
                  <button
                    onClick={() => setShowKeyboardHelp(false)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">New Product</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl+N</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Barcode Scanner</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl+B</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Refresh Data</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl+R</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Select All</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl+A</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Focus Search</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">F</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Toggle View</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">G</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Show Help</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">?</kbd>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Close Modals</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Esc</kbd>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowKeyboardHelp(false)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors btn-bounce"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Help Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowKeyboardHelp(true)}
          className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center animate-float"
          title="Keyboard shortcuts (?)"
        >
          <FiSettings className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default Inventory;
