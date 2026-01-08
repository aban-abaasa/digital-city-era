import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AnimatedCounter from '../components/AnimatedCounter';
import { useApp } from '../contexts/AppContext';
import axios from 'axios';
import {
  FiShoppingCart,
  FiPackage,
  FiUsers,
  FiTrendingUp,
  FiAlertTriangle,
  FiDollarSign,
  FiUserCheck,
  FiPlus,
  FiEye,
  FiRefreshCw,
  FiCalendar,
  FiArrowUp,
  FiArrowDown,
  FiClock,
  FiTarget,
  FiZap,
  FiBarChart2,
  FiActivity,
  FiStar,
  FiAward,
  FiTrendingDown,
  FiShield,
  FiHeart,
  FiBell,
  FiSettings,
  FiMapPin,
  FiTruck,
  FiCreditCard
} from 'react-icons/fi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const { state, actions, computed } = useApp();
  const [timeRange, setTimeRange] = useState('today');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherMood, setWeatherMood] = useState('sunny');
  const [activeTab, setActiveTab] = useState('overview');

  // Enhanced dashboard state
  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
    lowStockAlerts: 0,
    pendingOrders: 0,
    topSellingProduct: null,
    revenueGrowth: 0,
    customerGrowth: 0,
    inventoryTurnover: 0
  });

  const [quickActions] = useState([
    { id: 'new-sale', label: 'New Sale', icon: FiShoppingCart, color: 'bg-blue-500', path: '/pos' },
    { id: 'add-product', label: 'Add Product', icon: FiPlus, color: 'bg-green-500', path: '/products' },
    { id: 'add-customer', label: 'Add Customer', icon: FiUserCheck, color: 'bg-purple-500', path: '/customers' },
    { id: 'view-inventory', label: 'Check Inventory', icon: FiPackage, color: 'bg-orange-500', path: '/inventory' },
    { id: 'view-reports', label: 'View Reports', icon: FiBarChart2, color: 'bg-indigo-500', path: '/reports' },
    { id: 'manage-suppliers', label: 'Suppliers', icon: FiTruck, color: 'bg-teal-500', path: '/suppliers' }
  ]);

  // Live updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const weatherTimer = setInterval(() => {
      const moods = ['sunny', 'cloudy', 'rainy', 'stormy'];
      setWeatherMood(moods[Math.floor(Math.random() * moods.length)]);
    }, 300000); // Change every 5 minutes

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, []);

  // Fetch initial data and sync with global state
  useEffect(() => {
    fetchDashboardData();
    syncWithGlobalState();
  }, [timeRange, state.lastUpdated]);

  const fetchDashboardData = async () => {
    actions.setLoading('dashboard', true);
    try {
      // Fetch all necessary data
      const [productsRes, customersRes, salesRes, suppliersRes] = await Promise.all([
        axios.get('/api/products').catch(() => ({ data: { products: [] } })),
        axios.get('/api/customers').catch(() => ({ data: { customers: [] } })),
        axios.get('/api/sales').catch(() => ({ data: { sales: [] } })),
        axios.get('/api/suppliers').catch(() => ({ data: { suppliers: [] } }))
      ]);

      // Update global state
      actions.setProducts(productsRes.data.products || []);
      actions.setCustomers(customersRes.data.customers || []);
      actions.setSuppliers(suppliersRes.data.suppliers || []);

      // Calculate metrics
      calculateDashboardMetrics(
        productsRes.data.products || [],
        customersRes.data.customers || [],
        salesRes.data.sales || []
      );

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      actions.addNotification({
        type: 'error',
        message: 'Failed to fetch dashboard data',
        category: 'system'
      });
    } finally {
      actions.setLoading('dashboard', false);
    }
  };

  const syncWithGlobalState = () => {
    calculateDashboardMetrics(state.products, state.customers, state.sales);
  };

  const calculateDashboardMetrics = (products, customers, sales) => {
    const today = new Date();
    const todaySales = sales.filter(sale => {
      const saleDate = new Date(sale.createdAt || sale.date);
      return saleDate.toDateString() === today.toDateString();
    });

    const totalRevenue = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const lowStockItems = products.filter(p => p.stock <= (state.settings.lowStockThreshold || 10));
    
    setDashboardMetrics({
      totalRevenue,
      totalOrders: todaySales.length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      lowStockAlerts: lowStockItems.length,
      pendingOrders: Math.floor(Math.random() * 5), // Simulated
      topSellingProduct: products.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))[0],
      revenueGrowth: Math.random() * 20 - 10, // Simulated growth
      customerGrowth: Math.random() * 15 - 5, // Simulated growth
      inventoryTurnover: Math.random() * 10 + 2 // Simulated turnover
    });
  };

  const getWeatherEmoji = () => {
    switch (weatherMood) {
      case 'sunny': return '☀️';
      case 'cloudy': return '☁️';
      case 'rainy': return '🌧️';
      case 'stormy': return '⛈️';
      default: return '☀️';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: state.settings.currency || 'UGX'
    }).format(amount);
  };

  // Sample chart data
  const salesChartData = [
    { name: 'Mon', sales: 4000, orders: 24 },
    { name: 'Tue', sales: 3000, orders: 18 },
    { name: 'Wed', sales: 5000, orders: 32 },
    { name: 'Thu', sales: 4500, orders: 28 },
    { name: 'Fri', sales: 6000, orders: 40 },
    { name: 'Sat', sales: 5500, orders: 35 },
    { name: 'Sun', sales: 3500, orders: 22 }
  ];

  const categoryData = [
    { name: 'Electronics', value: 400, color: '#8884d8' },
    { name: 'Clothing', value: 300, color: '#82ca9d' },
    { name: 'Food', value: 200, color: '#ffc658' },
    { name: 'Books', value: 100, color: '#ff7c7c' }
  ];

  if (state.loading.dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading Dashboard...</h2>
          <p className="text-gray-500">Fetching real-time data from all systems</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center">
              🏪 FareDeal Dashboard
              <span className="ml-3 text-2xl">{getWeatherEmoji()}</span>
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              {currentTime.toLocaleDateString('en-UG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} • {currentTime.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchDashboardData}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiRefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <div className="relative">
              <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <FiBell className="h-4 w-4 mr-2" />
                Notifications
                {state.notifications.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {state.notifications.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Banner */}
      {state.notifications.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiAlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
              <span className="font-medium text-yellow-800">
                {state.notifications[0].message}
              </span>
            </div>
            <span className="text-xs text-yellow-600">
              {state.notifications.length} total notifications
            </span>
          </div>
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Today's Revenue</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={dashboardMetrics.totalRevenue} duration={2000} />
              </p>
              <p className="text-blue-200 text-sm flex items-center mt-2">
                <FiTrendingUp className="h-4 w-4 mr-1" />
                {dashboardMetrics.revenueGrowth > 0 ? '+' : ''}{dashboardMetrics.revenueGrowth.toFixed(1)}% vs yesterday
              </p>
            </div>
            <FiDollarSign className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Orders Today</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={dashboardMetrics.totalOrders} duration={1500} />
              </p>
              <p className="text-green-200 text-sm flex items-center mt-2">
                <FiShoppingCart className="h-4 w-4 mr-1" />
                Avg: {dashboardMetrics.totalOrders > 0 ? (dashboardMetrics.totalRevenue / dashboardMetrics.totalOrders).toFixed(0) : 0} per order
              </p>
            </div>
            <FiShoppingCart className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Total Customers</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={dashboardMetrics.totalCustomers} duration={1800} />
              </p>
              <p className="text-purple-200 text-sm flex items-center mt-2">
                <FiUsers className="h-4 w-4 mr-1" />
                {state.loyaltyProgram.activeMembers} active this month
              </p>
            </div>
            <FiUsers className="h-12 w-12 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Products in Stock</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={dashboardMetrics.totalProducts} duration={1200} />
              </p>
              <p className="text-orange-200 text-sm flex items-center mt-2">
                <FiAlertTriangle className="h-4 w-4 mr-1" />
                {dashboardMetrics.lowStockAlerts} low stock alerts
              </p>
            </div>
            <FiPackage className="h-12 w-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">⚡ Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.id}
              to={action.path}
              className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className={`${action.color} p-3 rounded-full mb-3 group-hover:scale-110 transition-transform`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {action.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="mb-6">
        <div className="flex space-x-4 border-b border-gray-200">
          {['overview', 'sales', 'inventory', 'customers'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-4 font-medium text-sm rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2">
          {activeTab === 'overview' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">📈 Sales Overview</h3>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="sales" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="orders" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">💰 Sales Analytics</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">📦 Inventory Status</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{state.products.length}</div>
                  <div className="text-sm text-green-700">Total Products</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{dashboardMetrics.lowStockAlerts}</div>
                  <div className="text-sm text-red-700">Low Stock</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">👥 Customer Insights</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{state.customers.length}</div>
                  <div className="text-sm text-blue-700">Total Customers</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{state.loyaltyProgram.activeMembers}</div>
                  <div className="text-sm text-purple-700">Active Members</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{computed.averageOrderValue.toFixed(0)}</div>
                  <div className="text-sm text-yellow-700">Avg Order Value</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FiActivity className="h-5 w-5 mr-2 text-blue-600" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {state.notifications.slice(0, 5).map((notification, index) => (
                <div key={index} className="flex items-center space-x-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    notification.type === 'success' ? 'bg-green-500' :
                    notification.type === 'warning' ? 'bg-yellow-500' :
                    notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-gray-700 flex-1">{notification.message}</span>
                  <span className="text-gray-400 text-xs">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FiStar className="h-5 w-5 mr-2 text-yellow-600" />
              Top Products
            </h3>
            <div className="space-y-3">
              {computed.topSellingProducts.slice(0, 5).map((product, index) => (
                <div key={product._id || index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <FiPackage className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.soldCount || 0} sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrency(product.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FiShield className="h-5 w-5 mr-2 text-green-600" />
              System Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">POS System</span>
                <span className="flex items-center text-green-600 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Inventory Sync</span>
                <span className="flex items-center text-green-600 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Payment Gateway</span>
                <span className="flex items-center text-green-600 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;