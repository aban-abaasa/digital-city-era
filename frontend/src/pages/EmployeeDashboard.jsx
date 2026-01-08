import React, { useState, useEffect } from 'react';
import { 
  FiUser, FiShoppingBag, FiPackage, FiTruck, FiTrendingUp, 
  FiZap, FiAward, FiBell, FiSettings, FiLogOut, FiSearch,
  FiSmartphone, FiHeadphones, FiCamera, FiWatch,
  FiHome, FiCreditCard, FiShield, FiMessageCircle,
  FiCalendar, FiMapPin, FiClock, FiUsers, FiShare2, FiEye,
  FiThumbsUp, FiBookmark, FiFilter, FiGrid, FiList,
  FiChevronRight, FiChevronDown, FiPlus, FiMinus, FiRefreshCw,
  FiDollarSign, FiTarget, FiAlertCircle, FiCheckCircle,
  FiEdit, FiTrash2, FiDownload, FiUpload, FiPrinter, FiMail,
  FiStar, FiHeart, FiShoppingCart, FiTag, FiHash, FiImage,
  FiInfo, FiHelpCircle, FiMaximize, FiMinimize, FiRotateCw
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdvancedPOS from '../components/AdvancedPOS';
import SupplierManagement from '../components/SupplierManagement';
import ProductInventoryInterface from '../components/ProductInventoryInterface';

const EmployeeDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showPOS, setShowPOS] = useState(false);
  const [showSupplierManagement, setShowSupplierManagement] = useState(false);
  const [employeeProfile, setEmployeeProfile] = useState({
    name: 'Sarah Johnson',
    role: 'Store Manager',
    department: 'Operations',
    employeeId: 'EMP-001',
    joinDate: '2022-03-15',
    avatar: '👩‍💼',
    permissions: {
      pos: true,
      inventory: true,
      suppliers: true,
      reports: true,
      employees: false
    }
  });

  const [quickStats, setQuickStats] = useState({
    todaySales: 12450,
    todayOrders: 47,
    lowStockItems: 12,
    pendingSuppliers: 3,
    activeCustomers: 156,
    inventoryValue: 125000
  });

  const [recentActivity, setRecentActivity] = useState([
    {
      id: 1,
      type: 'sale',
      title: 'Large Sale Completed',
      description: 'iPhone 15 Pro Max - $1,199',
      timestamp: '5 minutes ago',
      icon: '💰',
      status: 'completed',
      amount: 1199
    },
    {
      id: 2,
      type: 'inventory',
      title: 'Low Stock Alert',
      description: 'AirPods Pro - Only 3 left',
      timestamp: '15 minutes ago',
      icon: '⚠️',
      status: 'warning'
    },
    {
      id: 3,
      type: 'supplier',
      title: 'New Order Placed',
      description: 'Apple Inc. - 50 units',
      timestamp: '1 hour ago',
      icon: '📦',
      status: 'pending'
    }
  ]);

  const [posData, setPosData] = useState({
    currentCart: [],
    total: 0,
    tax: 0,
    discount: 0,
    paymentMethod: 'card',
    customer: null
  });

  const [inventoryAlerts, setInventoryAlerts] = useState([
    {
      id: 1,
      product: 'iPhone 15 Pro Max',
      currentStock: 3,
      minStock: 10,
      status: 'critical',
      category: 'Electronics'
    },
    {
      id: 2,
      product: 'AirPods Pro',
      currentStock: 5,
      minStock: 15,
      status: 'warning',
      category: 'Audio'
    },
    {
      id: 3,
      product: 'MacBook Air M2',
      currentStock: 2,
      minStock: 5,
      status: 'critical',
      category: 'Computers'
    }
  ]);

  const [supplierOrders, setSupplierOrders] = useState([
    {
      id: 1,
      supplier: 'Apple Inc.',
      orderNumber: 'PO-2024-001',
      total: 25000,
      status: 'pending',
      expectedDate: '2024-02-15',
      items: 5
    },
    {
      id: 2,
      supplier: 'Samsung Electronics',
      orderNumber: 'PO-2024-002',
      total: 18000,
      status: 'shipped',
      expectedDate: '2024-02-12',
      items: 3
    }
  ]);

  // Animated counter effect
  const [animatedStats, setAnimatedStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    lowStockItems: 0,
    activeCustomers: 0
  });

  useEffect(() => {
    const animateCounters = () => {
      const duration = 2000;
      const steps = 60;
      const stepDuration = duration / steps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        
        setAnimatedStats({
          todaySales: Math.floor(quickStats.todaySales * progress),
          todayOrders: Math.floor(quickStats.todayOrders * progress),
          lowStockItems: Math.floor(quickStats.lowStockItems * progress),
          activeCustomers: Math.floor(quickStats.activeCustomers * progress)
        });

        if (currentStep >= steps) {
          clearInterval(timer);
        }
      }, stepDuration);
    };

    animateCounters();
  }, []);

  const getRoleColor = (role) => {
    switch (role.toLowerCase()) {
      case 'store manager': return 'from-purple-500 to-pink-500';
      case 'sales associate': return 'from-blue-500 to-cyan-500';
      case 'inventory manager': return 'from-green-500 to-emerald-500';
      case 'cashier': return 'from-orange-500 to-red-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getRoleIcon = (role) => {
    switch (role.toLowerCase()) {
      case 'store manager': return '👑';
      case 'sales associate': return '💼';
      case 'inventory manager': return '📦';
      case 'cashier': return '💰';
      default: return '👤';
    }
  };

  const handlePOSAction = (action) => {
    switch (action) {
      case 'newSale':
        setShowPOS(true);
        break;
      case 'quickCheckout':
        setShowPOS(true);
        break;
      case 'return':
        toast.info('Return process started');
        break;
      case 'void':
        toast.warning('Void transaction');
        break;
    }
  };

  const handleInventoryAction = (action, item) => {
    switch (action) {
      case 'reorder':
        toast.success(`Reorder placed for ${item.product}`);
        break;
      case 'adjust':
        toast.info(`Adjusting inventory for ${item.product}`);
        break;
      case 'view':
        toast.info(`Viewing details for ${item.product}`);
        break;
    }
  };

  const handleSupplierAction = (action, order) => {
    switch (action) {
      case 'track':
        setShowSupplierManagement(true);
        break;
      case 'receive':
        toast.success(`Marking order ${order.orderNumber} as received`);
        break;
      case 'contact':
        toast.info(`Contacting ${order.supplier}`);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FareDeal Employee Portal
              </div>
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>Employee Dashboard</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors">
                <FiBell className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {quickStats.lowStockItems + quickStats.pendingSuppliers}
                </span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">{employeeProfile.name}</div>
                  <div className="text-xs text-gray-500">{employeeProfile.role}</div>
                </div>
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {employeeProfile.avatar}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    Welcome back, {employeeProfile.name}! 👋
                  </h1>
                  <p className="text-blue-100 text-lg">
                    Manage your store operations efficiently
                  </p>
                </div>
                <div className="hidden md:block">
                  <div className="text-6xl opacity-20">🏪</div>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{getRoleIcon(employeeProfile.role)}</div>
                    <div>
                      <div className="text-sm text-blue-100">Role</div>
                      <div className="font-bold text-lg">{employeeProfile.role}</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">💰</div>
                    <div>
                      <div className="text-sm text-blue-100">Today's Sales</div>
                      <div className="font-bold text-lg">${animatedStats.todaySales.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">📦</div>
                    <div>
                      <div className="text-sm text-blue-100">Orders Today</div>
                      <div className="font-bold text-lg">{animatedStats.todayOrders}</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">⚠️</div>
                    <div>
                      <div className="text-sm text-blue-100">Low Stock</div>
                      <div className="font-bold text-lg">{animatedStats.lowStockItems} items</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-2xl w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: FiTrendingUp },
              { id: 'pos', label: 'POS System', icon: FiCreditCard },
              { id: 'inventory', label: 'Inventory', icon: FiPackage },
              { id: 'suppliers', label: 'Suppliers', icon: FiTruck },
              { id: 'analytics', label: 'Analytics', icon: FiTrendingUp },
              { id: 'settings', label: 'Settings', icon: FiSettings }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: FiCreditCard, label: 'POS System', color: 'from-green-500 to-emerald-500', action: () => setShowPOS(true) },
                    { icon: FiPackage, label: 'Check Inventory', color: 'from-blue-500 to-cyan-500', action: () => setActiveTab('inventory') },
                    { icon: FiTruck, label: 'Supplier Management', color: 'from-purple-500 to-pink-500', action: () => setShowSupplierManagement(true) },
                    { icon: FiTrendingUp, label: 'View Reports', color: 'from-orange-500 to-red-500', action: () => setActiveTab('analytics') }
                  ].map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                      className="group bg-gradient-to-r p-6 rounded-2xl text-white hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
                      style={{ background: `linear-gradient(135deg, ${action.color.split(' ')[1]}, ${action.color.split(' ')[3]})` }}
                    >
                      <action.icon className="h-8 w-8 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                      <div className="text-sm font-medium">{action.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
                <div className="space-y-4">
                  {recentActivity.map(activity => (
                    <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                      <div className="text-2xl">{activity.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-gray-900">{activity.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                            activity.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {activity.status}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-1">{activity.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs">{activity.timestamp}</span>
                          {activity.amount && (
                            <span className="text-green-600 font-bold text-sm">+${activity.amount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Inventory Alerts */}
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <FiAlertCircle className="h-6 w-6 text-red-500" />
                  <span>Inventory Alerts</span>
                </h3>
                <div className="space-y-3">
                  {inventoryAlerts.map(alert => (
                    <div key={alert.id} className={`p-3 rounded-xl border-l-4 ${
                      alert.status === 'critical' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-gray-900 text-sm">{alert.product}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          alert.status === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {alert.status}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs mb-2">{alert.category}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Stock: {alert.currentStock}</span>
                        <button
                          onClick={() => handleInventoryAction('reorder', alert)}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                        >
                          Reorder
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supplier Orders */}
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <FiTruck className="h-6 w-6 text-blue-500" />
                  <span>Supplier Orders</span>
                </h3>
                <div className="space-y-3">
                  {supplierOrders.map(order => (
                    <div key={order.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-gray-900 text-sm">{order.supplier}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs mb-2">Order: {order.orderNumber}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">${order.total.toLocaleString()}</span>
                        <button
                          onClick={() => handleSupplierAction('track', order)}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                        >
                          Track
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* POS System Tab */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Point of Sale System</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
                      <h3 className="text-xl font-bold mb-2">Quick Sale</h3>
                      <p className="text-green-100 mb-4">Start a new transaction</p>
                      <button
                        onClick={() => handlePOSAction('newSale')}
                        className="bg-white text-green-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                      >
                        New Sale
                      </button>
                    </div>
                    
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
                      <h3 className="text-xl font-bold mb-2">Quick Checkout</h3>
                      <p className="text-blue-100 mb-4">Express checkout for regular customers</p>
                      <button
                        onClick={() => handlePOSAction('quickCheckout')}
                        className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                      >
                        Quick Checkout
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
                      <h3 className="text-xl font-bold mb-2">Returns</h3>
                      <p className="text-orange-100 mb-4">Process customer returns</p>
                      <button
                        onClick={() => handlePOSAction('return')}
                        className="bg-white text-orange-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                      >
                        Process Return
                      </button>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
                      <h3 className="text-xl font-bold mb-2">Void Transaction</h3>
                      <p className="text-purple-100 mb-4">Cancel or void a transaction</p>
                      <button
                        onClick={() => handlePOSAction('void')}
                        className="bg-white text-purple-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                      >
                        Void Transaction
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Today's Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Sales</span>
                    <span className="font-bold text-green-600">${quickStats.todaySales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Transactions</span>
                    <span className="font-bold text-blue-600">{quickStats.todayOrders}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average Sale</span>
                    <span className="font-bold text-purple-600">${Math.round(quickStats.todaySales / quickStats.todayOrders)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Tab - Enhanced with Full Functionality */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
              <h2 className="text-2xl font-bold mb-2">📦 Inventory Management</h2>
              <p className="text-blue-100">Complete inventory control with reorder and adjustment capabilities</p>
            </div>
            
            {/* Stats Overview */}
            <div className="p-6 bg-gray-50 border-b">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Total Inventory Value</h3>
                  <p className="text-3xl font-bold">UGX {quickStats.inventoryValue.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Low Stock Items</h3>
                  <p className="text-3xl font-bold">{quickStats.lowStockItems}</p>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Active Products</h3>
                  <p className="text-3xl font-bold">6</p>
                </div>
              </div>
            </div>
            
            {/* Full Inventory Interface */}
            <ProductInventoryInterface />
          </div>
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Supplier Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
                <h3 className="text-xl font-bold mb-2">Active Suppliers</h3>
                <p className="text-3xl font-bold">24</p>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
                <h3 className="text-xl font-bold mb-2">Pending Orders</h3>
                <p className="text-3xl font-bold">{quickStats.pendingSuppliers}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {supplierOrders.map(order => (
                <div key={order.id} className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{order.supplier}</h3>
                      <p className="text-gray-600">Order: {order.orderNumber}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="font-bold text-lg">${order.total.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Items</p>
                      <p className="font-bold text-lg">{order.items}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expected Date</p>
                      <p className="font-bold text-lg">{order.expectedDate}</p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleSupplierAction('track', order)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Track Order
                    </button>
                    <button
                      onClick={() => handleSupplierAction('receive', order)}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Mark Received
                    </button>
                    <button
                      onClick={() => handleSupplierAction('contact', order)}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Contact Supplier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics & Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-bold mb-2">Sales Today</h3>
                <p className="text-3xl font-bold">${quickStats.todaySales.toLocaleString()}</p>
                <p className="text-green-100 text-sm">+12% from yesterday</p>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-bold mb-2">Orders Today</h3>
                <p className="text-3xl font-bold">{quickStats.todayOrders}</p>
                <p className="text-blue-100 text-sm">+8% from yesterday</p>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-bold mb-2">Active Customers</h3>
                <p className="text-3xl font-bold">{quickStats.activeCustomers}</p>
                <p className="text-purple-100 text-sm">+5% from yesterday</p>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-bold mb-2">Inventory Value</h3>
                <p className="text-3xl font-bold">${quickStats.inventoryValue.toLocaleString()}</p>
                <p className="text-orange-100 text-sm">+2% from last week</p>
              </div>
            </div>
            
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Advanced Analytics Coming Soon</h3>
              <p className="text-gray-600">
                Detailed reports, charts, and insights will be available here.
              </p>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⚙️</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Settings Panel Coming Soon</h3>
              <p className="text-gray-600">
                Employee preferences, system settings, and configuration options will be available here.
              </p>
            </div>
          </div>
        )}

        {/* Advanced POS Modal */}
        <AdvancedPOS 
          isOpen={showPOS} 
          onClose={() => setShowPOS(false)} 
        />

        {/* Supplier Management Modal */}
        <SupplierManagement 
          isOpen={showSupplierManagement} 
          onClose={() => setShowSupplierManagement(false)} 
        />
      </div>
    </div>
  );
};

export default EmployeeDashboard;
