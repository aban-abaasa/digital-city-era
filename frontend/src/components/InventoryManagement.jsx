import React, { useState, useEffect } from 'react';
import { 
  FiPackage, FiAlertTriangle, FiTrendingUp, FiSearch, FiFilter, FiPlus, 
  FiEdit3, FiTrash2, FiDownload, FiUpload, FiBarChart2, FiRefreshCw,
  FiEye, FiShoppingCart, FiCamera, FiGrid, FiList, FiSettings,
  FiZap, FiClock, FiDollarSign, FiTruck, FiMapPin, FiStar, FiX,
  FiMonitor, FiWifi, FiBluetooth, FiSmartphone, FiPrinter, FiDatabase,
  FiActivity, FiTarget, FiAward, FiTrendingDown, FiArrowUp, FiArrowDown,
  FiCheckCircle, FiXCircle, FiCpu, FiHardDrive, FiServer, FiCloud
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const InventoryManagement = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Real-time data simulation
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');

  // Enhanced inventory data with more realistic structure
  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 1250,
    lowStockItems: 45,
    outOfStockItems: 12,
    totalValue: 85000000, // UGX
    categoriesCount: 15,
    suppliersCount: 28,
    lastUpdated: '2024-01-28 14:30',
    monthlyTurnover: 75.8,
    profitMargin: 32.5,
    stockAccuracy: 98.2,
    reordersPending: 23
  });

  // Comprehensive product data
  const [products, setProducts] = useState([
    {
      id: 1,
      name: 'iPhone 15 Pro Max 256GB',
      sku: 'IP15PM-256-BLU',
      category: 'Electronics',
      subcategory: 'Mobile Phones',
      stock: 25,
      minStock: 10,
      maxStock: 100,
      price: 4500000,
      costPrice: 3800000,
      supplier: 'Tech Solutions Ltd',
      location: 'A1-B2-S3',
      status: 'in_stock',
      lastSale: '2024-01-28',
      salesVelocity: 'fast',
      profit: 700000,
      margin: 18.4,
      barcode: '123456789012',
      image: '📱',
      description: 'Latest iPhone model with advanced camera system',
      warranty: '12 months',
      condition: 'new',
      tags: ['premium', 'latest', 'bestseller']
    },
    {
      id: 2,
      name: 'Samsung Galaxy A54 128GB',
      sku: 'SGA54-128-BLK',
      category: 'Electronics',
      subcategory: 'Mobile Phones',
      stock: 8,
      minStock: 15,
      maxStock: 50,
      price: 1200000,
      costPrice: 950000,
      supplier: 'Mobile World',
      location: 'A1-B3-S1',
      status: 'low_stock',
      lastSale: '2024-01-27',
      salesVelocity: 'medium',
      profit: 250000,
      margin: 20.8,
      barcode: '123456789013',
      image: '📱',
      description: 'Popular mid-range Android smartphone',
      warranty: '24 months',
      condition: 'new',
      tags: ['popular', 'android', 'mid-range']
    },
    {
      id: 3,
      name: 'Fresh Organic Bananas (50kg)',
      sku: 'ORG-BAN-50KG',
      category: 'Fresh Produce',
      subcategory: 'Fruits',
      stock: 0,
      minStock: 20,
      maxStock: 100,
      price: 150000,
      costPrice: 100000,
      supplier: 'Fresh Produce Co',
      location: 'C1-F1-S2',
      status: 'out_of_stock',
      lastSale: '2024-01-26',
      salesVelocity: 'very_fast',
      profit: 50000,
      margin: 33.3,
      barcode: '123456789014',
      image: '🍌',
      description: 'Locally sourced organic bananas',
      warranty: 'N/A',
      condition: 'fresh',
      tags: ['organic', 'local', 'fresh']
    },
    {
      id: 4,
      name: 'Premium Rice - Local (25kg)',
      sku: 'RICE-PREM-25KG',
      category: 'Cereals & Grains',
      subcategory: 'Rice',
      stock: 45,
      minStock: 20,
      maxStock: 200,
      price: 120000,
      costPrice: 85000,
      supplier: 'Grain Masters Ltd',
      location: 'B2-G1-S4',
      status: 'in_stock',
      lastSale: '2024-01-28',
      salesVelocity: 'medium',
      profit: 35000,
      margin: 29.2,
      barcode: '123456789015',
      image: '🌾',
      description: 'High-quality local rice variety',
      warranty: 'N/A',
      condition: 'sealed',
      tags: ['staple', 'local', 'bulk']
    },
    {
      id: 5,
      name: 'Cooking Oil - Sunflower (5L)',
      sku: 'OIL-SUN-5L',
      category: 'Cooking Essentials',
      subcategory: 'Oils',
      stock: 12,
      minStock: 15,
      maxStock: 80,
      price: 25000,
      costPrice: 18000,
      supplier: 'Fresh Dairy Ltd',
      location: 'B1-O1-S2',
      status: 'low_stock',
      lastSale: '2024-01-27',
      salesVelocity: 'fast',
      profit: 7000,
      margin: 28.0,
      barcode: '123456789016',
      image: '🛢️',
      description: 'Pure sunflower cooking oil',
      warranty: 'N/A',
      condition: 'sealed',
      tags: ['essential', 'cooking', 'household']
    },
    {
      id: 6,
      name: 'MacBook Air M2 512GB',
      sku: 'MBA-M2-512-SLV',
      category: 'Electronics',
      subcategory: 'Laptops',
      stock: 15,
      minStock: 8,
      maxStock: 30,
      price: 5500000,
      costPrice: 4600000,
      supplier: 'Tech Solutions Ltd',
      location: 'A2-L1-S1',
      status: 'in_stock',
      lastSale: '2024-01-25',
      salesVelocity: 'slow',
      profit: 900000,
      margin: 19.6,
      barcode: '123456789017',
      image: '💻',
      description: 'Latest MacBook Air with M2 chip',
      warranty: '12 months',
      condition: 'new',
      tags: ['premium', 'laptop', 'apple']
    }
  ]);

  // Sales analytics data
  const [salesData] = useState([
    { month: 'Jan', sales: 45000, profit: 12000, volume: 340 },
    { month: 'Feb', sales: 52000, profit: 15000, volume: 380 },
    { month: 'Mar', sales: 48000, profit: 13500, volume: 360 },
    { month: 'Apr', sales: 58000, profit: 18000, volume: 420 },
    { month: 'May', sales: 65000, profit: 22000, volume: 480 },
    { month: 'Jun', sales: 62000, profit: 20000, volume: 450 }
  ]);

  // Category performance data
  const [categoryData] = useState([
    { name: 'Electronics', value: 35, color: '#3B82F6' },
    { name: 'Fresh Produce', value: 28, color: '#10B981' },
    { name: 'Cereals & Grains', value: 20, color: '#F59E0B' },
    { name: 'Cooking Essentials', value: 17, color: '#8B5CF6' }
  ]);

  const [categories] = useState([
    { id: 1, name: 'Electronics', icon: '📱', count: 120, value: 35000000 },
    { id: 2, name: 'Fresh Produce', icon: '🥬', count: 89, value: 15000000 },
    { id: 3, name: 'Cereals & Grains', icon: '🌾', count: 65, value: 12000000 },
    { id: 4, name: 'Cooking Essentials', icon: '🍳', count: 43, value: 8000000 },
    { id: 5, name: 'Beverages', icon: '🥤', count: 78, value: 6000000 },
    { id: 6, name: 'Dairy Products', icon: '🥛', count: 45, value: 4500000 },
    { id: 7, name: 'Cleaning Supplies', icon: '🧽', count: 32, value: 3200000 }
  ]);

  const [recentActivities, setRecentActivities] = useState([
    { 
      id: 1,
      type: 'stock_in', 
      message: 'iPhone 15 Pro Max - 15 units added', 
      time: '10 min ago', 
      icon: '📥',
      user: 'Manager',
      details: { product: 'iPhone 15 Pro Max', quantity: 15, value: 67500000 }
    },
    { 
      id: 2,
      type: 'stock_out', 
      message: 'Samsung Galaxy A54 - 8 units sold', 
      time: '25 min ago', 
      icon: '📤',
      user: 'Cashier Sarah',
      details: { product: 'Samsung Galaxy A54', quantity: 8, value: 9600000 }
    },
    { 
      id: 3,
      type: 'low_stock', 
      message: 'Cooking Oil running low (12 remaining)', 
      time: '1 hour ago', 
      icon: '⚠️',
      user: 'System',
      details: { product: 'Cooking Oil', threshold: 15, current: 12 }
    },
    { 
      id: 4,
      type: 'new_product', 
      message: 'MacBook Air M2 added to inventory', 
      time: '2 hours ago', 
      icon: '🆕',
      user: 'Manager',
      details: { product: 'MacBook Air M2', quantity: 15, value: 82500000 }
    },
    { 
      id: 5,
      type: 'supplier_update', 
      message: 'Fresh Produce Co delivery scheduled', 
      time: '3 hours ago', 
      icon: '🚛',
      user: 'System',
      details: { supplier: 'Fresh Produce Co', eta: '2024-01-29 09:00' }
    }
  ]);

  // Real-time simulation
  useEffect(() => {
    if (realTimeUpdates) {
      const interval = setInterval(() => {
        // Simulate real-time stock changes
        setProducts(prev => prev.map(product => {
          if (Math.random() < 0.1) { // 10% chance of stock change
            const change = Math.random() < 0.5 ? -1 : 1;
            const newStock = Math.max(0, product.stock + change);
            return { ...product, stock: newStock };
          }
          return product;
        }));
        
        setLastUpdated(new Date());
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [realTimeUpdates]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStockStatusColor = (product) => {
    if (!product || product.stock === 0) return 'text-red-600 bg-red-50 border-red-200';
    if (product.stock <= (product.minStock || 0)) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStockStatusText = (product) => {
    if (!product || product.stock === 0) return 'Out of Stock';
    if (product.stock <= (product.minStock || 0)) return 'Low Stock';
    return 'In Stock';
  };

  const getSalesVelocityColor = (velocity) => {
    switch(velocity) {
      case 'very_fast': return 'text-red-600 bg-red-100';
      case 'fast': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'slow': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === '' || product.category === selectedCategory;
    
    const matchesStock = stockFilter === '' || 
                        (stockFilter === 'in_stock' && product.stock > product.minStock) ||
                        (stockFilter === 'low_stock' && product.stock > 0 && product.stock <= product.minStock) ||
                        (stockFilter === 'out_of_stock' && product.stock === 0);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleRefresh = async () => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setInventoryStats(prev => ({
      ...prev,
      lastUpdated: new Date().toLocaleString(),
      totalProducts: prev.totalProducts + Math.floor(Math.random() * 5),
      lowStockItems: Math.max(0, prev.lowStockItems + Math.floor(Math.random() * 3) - 1)
    }));
    
    setLastUpdated(new Date());
    setConnectionStatus('connected');
    setIsLoading(false);
    toast.success('🔄 Inventory data refreshed successfully!');
  };

  const handleStockAction = async (action, productId = null, data = null) => {
    setIsLoading(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    switch(action) {
      case 'reorder':
        const product = products.find(p => p.id === productId);
        const suggestedQuantity = product.maxStock - product.stock;
        toast.success(`🛒 Reorder request sent for ${product.name} (${suggestedQuantity} units)`);
        break;
      case 'adjust':
        if (data && data.newStock !== undefined) {
          setProducts(prev => prev.map(p => 
            p.id === productId ? { ...p, stock: data.newStock } : p
          ));
          toast.success('📝 Stock quantity updated successfully!');
        } else {
          setEditingProduct(products.find(p => p.id === productId));
          setShowStockModal(true);
        }
        break;
      case 'transfer':
        toast.info(`🔄 Stock transfer initiated for product ID: ${productId}`);
        break;
      case 'audit':
        toast.info(`🔍 Stock audit scheduled for product ID: ${productId}`);
        break;
      case 'bulk_action':
        toast.success(`⚡ Bulk action applied to ${selectedProducts.length} products`);
        setSelectedProducts([]);
        setShowBulkActions(false);
        break;
      case 'export':
        toast.success('📊 Inventory report exported successfully!');
        break;
      case 'import':
        toast.info('📥 Import wizard opened');
        break;
      default:
        break;
    }
    
    setIsLoading(false);
  };

  const handleProductSelect = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === sortedProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(sortedProducts.map(p => p.id));
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowAddModal(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowAddModal(true);
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('🗑️ Product deleted successfully!');
    }
  };

  if (!isOpen) return null;

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Enhanced Stats Grid with Real-time Updates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            title: 'Total Products', 
            value: inventoryStats.totalProducts, 
            icon: FiPackage, 
            color: 'from-blue-500 to-blue-600', 
            change: '+5.2%',
            trend: 'up',
            subtitle: `${inventoryStats.categoriesCount} categories`
          },
          { 
            title: 'Low Stock Items', 
            value: inventoryStats.lowStockItems, 
            icon: FiAlertTriangle, 
            color: 'from-yellow-500 to-yellow-600', 
            change: '-12%',
            trend: 'down',
            subtitle: 'Require attention'
          },
          { 
            title: 'Out of Stock', 
            value: inventoryStats.outOfStockItems, 
            icon: FiXCircle, 
            color: 'from-red-500 to-red-600', 
            change: '-8%',
            trend: 'down',
            subtitle: 'Immediate reorder needed'
          },
          { 
            title: 'Total Value', 
            value: formatCurrency(inventoryStats.totalValue), 
            icon: FiDollarSign, 
            color: 'from-green-500 to-green-600', 
            change: '+15%',
            trend: 'up',
            subtitle: `${inventoryStats.profitMargin}% profit margin`
          }
        ].map((metric, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-r ${metric.color} shadow-lg`}>
                <metric.icon className="h-6 w-6 text-white" />
              </div>
              <div className={`flex items-center space-x-1 text-sm font-medium ${
                metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.trend === 'up' ? <FiArrowUp className="h-3 w-3" /> : <FiArrowDown className="h-3 w-3" />}
                <span>{metric.change}</span>
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">{metric.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
              <p className="text-gray-500 text-xs mt-1">{metric.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Real-time Connection Status */}
      <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium text-gray-700">
              {connectionStatus === 'connected' ? '🔗 Real-time sync active' : 
               connectionStatus === 'connecting' ? '⏳ Connecting...' : '❌ Connection lost'}
            </span>
            <span className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setRealTimeUpdates(!realTimeUpdates)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                realTimeUpdates ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {realTimeUpdates ? '⚡ Live' : '⏸ Paused'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? '🔄' : '↻'} Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">📈 Sales Performance</h3>
            <div className="flex space-x-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">6M Trend</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="sales" 
                stroke="#3B82F6" 
                fill="url(#colorSales)" 
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">🎯 Category Distribution</h3>
            <button className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors">
              View All
            </button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {categoryData.map((category, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: category.color }}
                ></div>
                <span className="text-xs text-gray-600">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions with Enhanced UI */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">⚡ Quick Actions</h3>
          <div className="text-sm text-gray-500">
            {selectedProducts.length > 0 && `${selectedProducts.length} products selected`}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { title: 'Add Product', icon: FiPlus, color: 'bg-green-600 hover:bg-green-700', action: handleAddProduct },
            { title: 'Bulk Import', icon: FiUpload, color: 'bg-blue-600 hover:bg-blue-700', action: () => handleStockAction('import') },
            { title: 'Export Data', icon: FiDownload, color: 'bg-purple-600 hover:bg-purple-700', action: () => handleStockAction('export') },
            { title: 'Stock Audit', icon: FiBarChart2, color: 'bg-orange-600 hover:bg-orange-700', action: () => setActiveTab('audit') },
            { title: 'Low Stock Alert', icon: FiAlertTriangle, color: 'bg-yellow-600 hover:bg-yellow-700', action: () => setStockFilter('low_stock') },
            { title: 'Scanner Mode', icon: FiCamera, color: 'bg-indigo-600 hover:bg-indigo-700', action: () => toast.info('📷 Barcode scanner activated') }
          ].map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              disabled={isLoading}
              className={`${action.color} text-white p-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex flex-col items-center space-y-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-xs font-medium text-center">{action.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Recent Activities */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">🕐 Recent Activities</h3>
          <div className="flex space-x-2">
            <button className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-gray-200 transition-colors">
              View All
            </button>
            <button 
              onClick={() => setRecentActivities([])}
              className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-full hover:bg-red-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-4 max-h-64 overflow-y-auto">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="text-2xl flex-shrink-0">{activity.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium text-sm">{activity.message}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-xs text-gray-500">{activity.time}</p>
                  <span className="text-xs text-gray-400">•</span>
                  <p className="text-xs text-gray-500">by {activity.user}</p>
                </div>
                {activity.details && (
                  <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border">
                    {Object.entries(activity.details).map(([key, value]) => (
                      <span key={key} className="mr-3">
                        <strong>{key}:</strong> {typeof value === 'number' && key.includes('value') ? formatCurrency(value) : value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Monthly Turnover', value: `${inventoryStats.monthlyTurnover}%`, icon: FiActivity, color: 'text-blue-600' },
          { title: 'Stock Accuracy', value: `${inventoryStats.stockAccuracy}%`, icon: FiTarget, color: 'text-green-600' },
          { title: 'Pending Reorders', value: inventoryStats.reordersPending, icon: FiTruck, color: 'text-orange-600' }
        ].map((metric, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 text-center">
            <div className={`inline-flex p-3 rounded-full bg-gray-100 ${metric.color} mb-4`}>
              <metric.icon className="h-6 w-6" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</div>
            <div className="text-sm text-gray-600">{metric.title}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
              />
            </div>
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}
              >
                <FiGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}
              >
                <FiList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Display */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            📦 Products ({filteredProducts.length})
          </h3>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">
                      {product.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      SKU: {product.sku}
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
                      <span>Stock: {product.stock}</span>
                      <span>Min: {product.minStock}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          product.stock === 0 ? 'bg-red-500' : 
                          product.stock <= product.minStock ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((product.stock / product.maxStock) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center">
                      <FiMapPin className="h-3 w-3 mr-1" />
                      {product.location}
                    </span>
                    <span className="flex items-center">
                      <FiTruck className="h-3 w-3 mr-1" />
                      {product.supplier}
                    </span>
                  </div>

                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={() => handleStockAction('reorder', product.id)}
                      className="flex-1 bg-blue-600 text-white py-1 px-2 rounded text-xs hover:bg-blue-700 transition-colors"
                    >
                      Reorder
                    </button>
                    <button
                      onClick={() => handleStockAction('adjust', product.id)}
                      className="flex-1 bg-green-600 text-white py-1 px-2 rounded text-xs hover:bg-green-700 transition-colors"
                    >
                      Adjust
                    </button>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <span className="mr-2">{product.stock}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              product.stock === 0 ? 'bg-red-500' : 
                              product.stock <= product.minStock ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((product.stock / product.maxStock) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(product)}`}>
                        {getStockStatusText(product)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleStockAction('reorder', product.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <FiShoppingCart className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStockAction('adjust', product.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <FiEdit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStockAction('audit', product.id)}
                          className="text-purple-600 hover:text-purple-900"
                        >
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
      </div>
    </div>
  );

  // Enhanced Product Card Component
  const ProductCard = ({ product, viewMode, isSelected, onSelect, onEdit, onQuickUpdate }) => {
    const stockPercentage = Math.min((product.stock / product.maxStock) * 100, 100);
    const profitMargin = ((product.price - product.cost) / product.cost * 100).toFixed(1);
    
    if (viewMode === 'list') {
      return (
        <div className={`bg-white rounded-lg p-4 shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <div className="flex items-center space-x-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(product.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            
            <div className="flex-1 grid grid-cols-8 gap-4 items-center">
              <div className="col-span-2">
                <h3 className="font-bold text-gray-900 text-sm">{product.name}</h3>
                <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                <p className="text-xs text-gray-500">📦 {product.location}</p>
              </div>
              
              <div className="text-center">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {product.category}
                </span>
              </div>
              
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">{product.stock}</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      product.stock === 0 ? 'bg-red-500' : 
                      product.stock <= product.minStock ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${stockPercentage}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">{formatCurrency(product.price)}</div>
                <div className="text-xs text-gray-500">+{profitMargin}% margin</div>
              </div>
              
              <div className="text-center">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(product)}`}>
                  {getStockStatusText(product)}
                </span>
                <div className="text-xs text-gray-500 mt-1">
                  🚀 {product.salesVelocity} units/week
                </div>
              </div>
              
              <div className="text-center text-xs text-gray-500">
                <div>Updated</div>
                <div>{product.lastUpdated}</div>
              </div>
              
              <div className="flex items-center justify-center space-x-1">
                <button
                  onClick={() => onQuickUpdate(product.id)}
                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Quick Stock Update"
                >
                  <FiEdit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onEdit(product)}
                  className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                  title="Edit Product"
                >
                  <FiEdit className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleStockAction('audit', product.id)}
                  className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                  title="View Analytics"
                >
                  <FiBarChart2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleStockAction('reorder', product.id)}
                  className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                  title="Reorder Stock"
                >
                  <FiShoppingCart className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Grid view
    return (
      <div className={`bg-white rounded-xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}>
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(product.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            
            <div className="flex space-x-1">
              <button
                onClick={() => onEdit(product)}
                className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                title="Edit Product"
              >
                <FiEdit className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleStockAction('favorite', product.id)}
                className="p-1.5 text-gray-600 hover:text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors"
                title="Add to Favorites"
              >
                <FiStar className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-bold text-gray-900 text-sm line-clamp-2 mb-1">
                {product.name}
              </h3>
              <p className="text-xs text-gray-500">
                SKU: {product.sku} • 📦 {product.location}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(product.price)}
              </span>
              <div className="text-right">
                <div className="text-xs text-green-600 font-medium">+{profitMargin}%</div>
                <div className="text-xs text-gray-500">margin</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Stock: {product.stock}/{product.maxStock}</span>
                <span className={`px-2 py-1 rounded-full font-medium ${getStockStatusColor(product)}`}>
                  {getStockStatusText(product)}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    product.stock === 0 ? 'bg-red-500' : 
                    product.stock <= product.minStock ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${stockPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Sales Velocity</div>
                <div className="font-medium text-gray-900">🚀 {product.salesVelocity}/week</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Category</div>
                <div className="font-medium text-gray-900">{product.category}</div>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => onQuickUpdate(product.id)}
                className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
              >
                <FiEdit3 className="h-3 w-3" />
                <span>Quick Update</span>
              </button>
              <button
                onClick={() => handleStockAction('reorder', product.id)}
                className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-colors"
                title="Reorder"
              >
                <FiShoppingCart className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleStockAction('audit', product.id)}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 transition-colors"
                title="Analytics"
              >
                <FiBarChart2 className="h-3 w-3" />
              </button>
            </div>

            <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
              Last updated: {product.lastUpdated} by {product.updatedBy || 'System'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAudit = () => (
    <div className="space-y-6">
      {/* Audit Overview */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">🔍 Stock Audit</h3>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📊 Start New Audit
            </button>
            <button
              onClick={() => toast.info('📋 Audit report generated')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📄 Generate Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-blue-50 rounded-xl">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-2xl font-bold text-blue-600">98.5%</div>
            <div className="text-sm text-gray-600">Accuracy Rate</div>
          </div>
          <div className="text-center p-6 bg-yellow-50 rounded-xl">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="text-2xl font-bold text-yellow-600">12</div>
            <div className="text-sm text-gray-600">Discrepancies Found</div>
          </div>
          <div className="text-center p-6 bg-green-50 rounded-xl">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-2xl font-bold text-green-600">{new Date().toLocaleDateString()}</div>
            <div className="text-sm text-gray-600">Last Audit</div>
          </div>
        </div>
      </div>

      {/* Recent Audits */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-6">📋 Recent Audit History</h3>
        <div className="space-y-4">
          {[
            { date: '2024-01-15', auditor: 'John Manager', accuracy: '98.5%', discrepancies: 12, status: 'completed' },
            { date: '2024-01-08', auditor: 'Sarah Admin', accuracy: '97.8%', discrepancies: 18, status: 'completed' },
            { date: '2024-01-01', auditor: 'Mike Supervisor', accuracy: '99.2%', discrepancies: 5, status: 'completed' }
          ].map((audit, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <FiCheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Audit - {audit.date}</div>
                  <div className="text-sm text-gray-500">Conducted by {audit.auditor}</div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="font-medium text-green-600">{audit.accuracy}</div>
                  <div className="text-sm text-gray-500">{audit.discrepancies} discrepancies</div>
                </div>
                <button className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                  <FiDownload className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      {/* Report Generation */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">📊 Inventory Reports</h3>
          <button
            onClick={() => toast.success('📄 Custom report builder opened')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            🔧 Custom Report Builder
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'Stock Level Report', desc: 'Current inventory levels', icon: '📦', color: 'blue' },
            { title: 'Sales Performance', desc: 'Product sales analysis', icon: '📈', color: 'green' },
            { title: 'Low Stock Alert', desc: 'Items needing reorder', icon: '⚠️', color: 'yellow' },
            { title: 'Profit Analysis', desc: 'Margin and profitability', icon: '💰', color: 'purple' },
            { title: 'Category Breakdown', desc: 'Performance by category', icon: '🎯', color: 'indigo' },
            { title: 'Supplier Report', desc: 'Supplier performance', icon: '🚚', color: 'red' }
          ].map((report, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group">
              <div className={`text-4xl mb-4 group-hover:scale-110 transition-transform`}>
                {report.icon}
              </div>
              <h4 className="font-bold text-gray-900 mb-2">{report.title}</h4>
              <p className="text-gray-600 text-sm mb-4">{report.desc}</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => toast.success(`📄 ${report.title} generated`)}
                  className={`flex-1 bg-${report.color}-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-${report.color}-700 transition-colors`}
                >
                  Generate
                </button>
                <button
                  onClick={() => toast.info(`📧 ${report.title} scheduled`)}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
                >
                  📅
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-6">📋 Recent Reports</h3>
        <div className="space-y-4">
          {[
            { name: 'Monthly Stock Report - January 2024', date: '2024-01-15', size: '2.4 MB', type: 'PDF' },
            { name: 'Low Stock Alert Report', date: '2024-01-14', size: '856 KB', type: 'Excel' },
            { name: 'Profit Analysis Q4 2023', date: '2024-01-10', size: '1.8 MB', type: 'PDF' },
            { name: 'Category Performance Report', date: '2024-01-08', size: '1.2 MB', type: 'Excel' }
          ].map((report, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <FiFileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{report.name}</div>
                  <div className="text-sm text-gray-500">{report.date} • {report.size} • {report.type}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toast.success(`📄 Downloaded ${report.name}`)}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <FiDownload className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toast.info(`📧 Shared ${report.name}`)}
                  className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <FiShare2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      {/* Inventory Settings */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-6">⚙️ Inventory Settings</h3>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Low Stock Threshold
              </label>
              <input
                type="number"
                defaultValue="10"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="UGX">UGX - Ugandan Shilling</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                defaultChecked={realTimeUpdates}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable real-time inventory updates</span>
            </label>
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                defaultChecked={true}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Send low stock alerts via email</span>
            </label>
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                defaultChecked={false}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Auto-reorder when stock reaches minimum</span>
            </label>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex space-x-4">
            <button
              onClick={() => toast.success('⚙️ Settings saved successfully')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Settings
            </button>
            <button
              onClick={() => toast.info('🔄 Settings reset to defaults')}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-6">🗄️ Data Management</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-xl p-6">
            <h4 className="font-bold text-blue-900 mb-2">📤 Export Data</h4>
            <p className="text-blue-700 text-sm mb-4">Download your inventory data in various formats</p>
            <div className="space-y-2">
              <button
                onClick={() => toast.success('📊 Excel export started')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Export to Excel
              </button>
              <button
                onClick={() => toast.success('📄 CSV export started')}
                className="w-full bg-blue-100 text-blue-700 py-2 px-4 rounded-lg hover:bg-blue-200 transition-colors text-sm"
              >
                Export to CSV
              </button>
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-6">
            <h4 className="font-bold text-green-900 mb-2">📥 Import Data</h4>
            <p className="text-green-700 text-sm mb-4">Bulk import products from external sources</p>
            <div className="space-y-2">
              <button
                onClick={() => toast.info('📋 Template downloaded')}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Download Template
              </button>
              <button
                onClick={() => toast.success('📤 Bulk import started')}
                className="w-full bg-green-100 text-green-700 py-2 px-4 rounded-lg hover:bg-green-200 transition-colors text-sm"
              >
                Upload File
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-6">ℹ️ System Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-600">v2.1.0</div>
            <div className="text-sm text-gray-600">System Version</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-600">{lastUpdated.toLocaleDateString()}</div>
            <div className="text-sm text-gray-600">Last Update</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-600">99.9%</div>
            <div className="text-sm text-gray-600">Uptime</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FiPackage className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Inventory Management</h2>
                <p className="text-blue-100">Manager access to inventory overview and controls</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX className="h-8 w-8" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-4">
            {[
              { id: 'overview', label: 'Overview', icon: FiBarChart2 },
              { id: 'products', label: 'Products', icon: FiPackage },
              { id: 'categories', label: 'Categories', icon: FiGrid },
              { id: 'reports', label: 'Reports', icon: FiDownload }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'products' && renderProducts()}
          {activeTab === 'categories' && (
            <div className="text-center py-12">
              <FiGrid className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Categories Management</h3>
              <p className="mt-1 text-sm text-gray-500">Category overview and management tools coming soon.</p>
            </div>
          )}
          {activeTab === 'audit' && renderAudit()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'settings' && renderSettings()}
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
