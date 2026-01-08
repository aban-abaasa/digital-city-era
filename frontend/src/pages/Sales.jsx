import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FiEye, 
  FiSearch, 
  FiCalendar, 
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiUsers,
  FiShoppingCart,
  FiTarget,
  FiAward,
  FiStar,
  FiZap,
  FiHeart,
  FiGift,
  FiClock,
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiMapPin,
  FiSmartphone,
  FiCreditCard,
  FiPercent,
  FiPackage,
  FiUser,
  FiX
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('7d');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid, table, analytics
  const [currentTime, setCurrentTime] = useState(new Date());
  const [salesStats, setSalesStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [customerInsights, setCustomerInsights] = useState([]);
  const [weatherMood, setWeatherMood] = useState('sunny'); // sunny, cloudy, rainy

  // Gamification states
  const [salesGoals, setSalesGoals] = useState({
    daily: { target: 500000, current: 0, streak: 5 },
    weekly: { target: 3000000, current: 0, streak: 2 },
    monthly: { target: 12000000, current: 0, streak: 1 }
  });

  useEffect(() => {
    fetchSales();
    fetchSalesStats();
    fetchTopProducts();
    fetchCustomerInsights();
    
    // Live clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Weather mood simulation
    const weatherTimer = setInterval(() => {
      const moods = ['sunny', 'cloudy', 'rainy'];
      setWeatherMood(moods[Math.floor(Math.random() * moods.length)]);
    }, 60000); // Change every minute for demo
    
    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, [dateRange]);

  const fetchSales = async () => {
    try {
      const response = await axios.get('/api/sales', { 
        params: { 
          limit: 100,
          dateRange,
          paymentMethod: paymentFilter !== 'all' ? paymentFilter : undefined
        } 
      });
      setSales(response.data.sales || []);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      toast.error('Failed to fetch sales data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesStats = async () => {
    try {
      const response = await axios.get('/api/sales/stats', { params: { dateRange } });
      setSalesStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch sales stats:', error);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const response = await axios.get('/api/sales/top-products', { params: { dateRange } });
      setTopProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch top products:', error);
    }
  };

  const fetchCustomerInsights = async () => {
    try {
      const response = await axios.get('/api/sales/customer-insights', { params: { dateRange } });
      setCustomerInsights(response.data.insights || []);
    } catch (error) {
      console.error('Failed to fetch customer insights:', error);
    }
  };

  const viewSale = (sale) => {
    setSelectedSale(sale);
    setShowModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Kampala'
    });
  };

  const getTimeGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getWeatherEmoji = () => {
    const weather = {
      sunny: '☀️',
      cloudy: '⛅',
      rainy: '🌧️'
    };
    return weather[weatherMood] || '☀️';
  };

  const getPaymentMethodEmoji = (method) => {
    const emojis = {
      cash: '💵',
      card: '💳',
      mobile_payment: '📱',
      check: '📋'
    };
    return emojis[method] || '💰';
  };

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const matchesSearch = !searchTerm || 
        sale.saleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.customer && `${sale.customer.firstName} ${sale.customer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter;
      
      return matchesSearch && matchesPayment;
    });
  }, [sales, searchTerm, paymentFilter]);

  // Mock data for charts (in production, this would come from API)
  const salesChartData = [
    { name: 'Mon', sales: 240000, target: 200000 },
    { name: 'Tue', sales: 300000, target: 250000 },
    { name: 'Wed', sales: 180000, target: 220000 },
    { name: 'Thu', sales: 400000, target: 300000 },
    { name: 'Fri', sales: 520000, target: 400000 },
    { name: 'Sat', sales: 680000, target: 500000 },
    { name: 'Sun', sales: 450000, target: 350000 }
  ];

  const paymentMethodData = [
    { name: 'Cash', value: 45, color: '#10B981' },
    { name: 'Mobile Money', value: 35, color: '#3B82F6' },
    { name: 'Card', value: 15, color: '#F59E0B' },
    { name: 'Check', value: 5, color: '#EF4444' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mb-4 mx-auto"></div>
          <p className="text-xl font-bold text-gray-700">Loading sales data...</p>
          <p className="text-gray-500">Preparing your Uganda sales insights 🇺🇬</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6">
      {/* Creative Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-2xl shadow-2xl mb-8">
        <div className="p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-6">
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                <FiBarChart2 className="h-12 w-12" />
              </div>
              <div>
                <h1 className="text-4xl font-bold flex items-center">
                  🇺🇬 Sales Analytics
                  <span className="ml-3 text-2xl">{getWeatherEmoji()}</span>
                </h1>
                <p className="text-purple-100 text-lg mt-2">
                  {getTimeGreeting()}! Let's track your business success
                </p>
                <div className="flex items-center space-x-4 mt-3 text-sm">
                  <span className="bg-white/20 px-3 py-1 rounded-full flex items-center">
                    <FiClock className="mr-2 h-4 w-4" />
                    {currentTime.toLocaleTimeString('en-UG')}
                  </span>
                  <span className="bg-green-500/30 px-3 py-1 rounded-full flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                    Live Data
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 lg:mt-0 grid grid-cols-2 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <FiTrendingUp className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                <p className="text-2xl font-bold">{formatCurrency(salesStats?.todaySales || 450000)}</p>
                <p className="text-purple-200 text-sm">Today's Sales</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <FiUsers className="h-8 w-8 mx-auto mb-2 text-green-300" />
                <p className="text-2xl font-bold">{salesStats?.todayCustomers || 127}</p>
                <p className="text-purple-200 text-sm">Happy Customers</p>
              </div>
            </div>
          </div>

          {/* Achievement Banner */}
          <div className="mt-6 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FiAward className="h-8 w-8 text-yellow-300" />
                <div>
                  <p className="font-bold text-lg">🎉 Achievement Unlocked!</p>
                  <p className="text-purple-100">5-day sales streak! Keep up the amazing work!</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-300">{salesGoals.daily.streak}</p>
                <p className="text-purple-200 text-sm">Day Streak</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="🔍 Search sales, customers, or sale numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-50"
              />
            </div>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="1d">📅 Today</option>
              <option value="7d">📅 Last 7 Days</option>
              <option value="30d">📅 Last 30 Days</option>
              <option value="90d">📅 Last 3 Months</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">💰 All Payments</option>
              <option value="cash">💵 Cash</option>
              <option value="card">💳 Card</option>
              <option value="mobile_payment">📱 Mobile Money</option>
              <option value="check">📋 Check</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('analytics')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewMode === 'analytics' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiPieChart className="inline h-4 w-4 mr-2" />
              Analytics
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewMode === 'grid' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiActivity className="inline h-4 w-4 mr-2" />
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewMode === 'table' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiBarChart2 className="inline h-4 w-4 mr-2" />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-8">
          {/* Sales Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sales Trend */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800 flex items-center">
                  <FiTrendingUp className="mr-3 h-6 w-6 text-green-600" />
                  📈 Sales vs Target
                </h3>
                <div className="text-right">
                  <p className="text-sm text-gray-600">This Week</p>
                  <p className="text-lg font-bold text-green-600">+15.3%</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="target" stackId="1" stroke="#E5E7EB" fill="#F3F4F6" />
                  <Area type="monotone" dataKey="sales" stackId="2" stroke="#10B981" fill="#34D399" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <FiPieChart className="mr-3 h-6 w-6 text-blue-600" />
                💳 Payment Methods
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSales.map((sale) => (
            <div
              key={sale._id}
              className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer overflow-hidden"
              onClick={() => viewSale(sale)}
            >
              <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 p-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="text-lg font-bold">{sale.saleNumber}</p>
                    <p className="text-purple-100 text-sm">{formatDate(sale.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatCurrency(sale.total)}</p>
                    <div className="flex items-center justify-end mt-1">
                      <span className="text-2xl mr-2">{getPaymentMethodEmoji(sale.paymentMethod)}</span>
                      <span className="text-purple-100 text-sm capitalize">{sale.paymentMethod}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <FiUsers className="h-4 w-4 text-gray-500" />
                    <p className="text-sm text-gray-600">
                      {sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : '👤 Walk-in Customer'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <FiUser className="h-4 w-4 text-gray-500" />
                    <p className="text-sm text-gray-600">
                      {sale.cashier?.firstName || 'System'} {sale.cashier?.lastName || 'User'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {sale.items?.length || 0} items
                  </p>
                  <button className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm font-bold hover:bg-purple-200 transition-all">
                    <FiEye className="inline h-4 w-4 mr-1" />
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    🧾 Sale Details
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    📅 Date & Time
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    👤 Customer
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    👨‍💼 Cashier
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    💰 Total
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    💳 Payment
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wider">
                    ⚡ Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.map((sale, index) => (
                  <tr key={sale._id} className={`hover:bg-purple-50 transition-all ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <FiShoppingCart className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{sale.saleNumber}</p>
                          <p className="text-xs text-gray-500">{sale.items?.length || 0} items</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.customer ? (
                        <div className="flex items-center space-x-2">
                          <FiHeart className="h-4 w-4 text-red-500" />
                          <span>{sale.customer.firstName} {sale.customer.lastName}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">👤 Walk-in</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.cashier?.firstName || 'System'} {sale.cashier?.lastName || 'User'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(sale.total)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 text-sm font-bold rounded-full bg-gradient-to-r from-blue-100 to-purple-100 text-purple-800">
                        <span className="mr-2 text-lg">{getPaymentMethodEmoji(sale.paymentMethod)}</span>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => viewSale(sale)}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg"
                      >
                        <FiEye className="inline h-4 w-4 mr-2" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enhanced Sale Details Modal */}
      {showModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                    <FiShoppingCart className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">🇺🇬 Sale Details</h3>
                    <p className="text-purple-100">{selectedSale.saleNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sale Information */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <FiCalendar className="mr-2 h-5 w-5 text-blue-600" />
                      📋 Sale Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Sale Number</label>
                        <p className="mt-1 text-sm font-bold text-gray-900">{selectedSale.saleNumber}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                        <p className="mt-1 text-sm text-gray-900">{formatDate(selectedSale.createdAt)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Customer</label>
                        <p className="mt-1 text-sm text-gray-900 flex items-center">
                          {selectedSale.customer ? (
                            <>
                              <FiHeart className="mr-2 h-4 w-4 text-red-500" />
                              {selectedSale.customer.firstName} {selectedSale.customer.lastName}
                            </>
                          ) : (
                            <>👤 Walk-in Customer</>
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Cashier</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedSale.cashier?.firstName || 'System'} {selectedSale.cashier?.lastName || 'User'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <FiCreditCard className="mr-2 h-5 w-5 text-green-600" />
                      💳 Payment Details
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Payment Method:</span>
                        <span className="flex items-center font-bold">
                          <span className="mr-2 text-lg">{getPaymentMethodEmoji(selectedSale.paymentMethod)}</span>
                          {selectedSale.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                          ✅ Completed
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items & Totals */}
                <div className="space-y-6">
                  {/* Items */}
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <FiPackage className="mr-2 h-5 w-5 text-orange-600" />
                      🛒 Items Purchased
                    </h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {selectedSale.items?.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{item.product?.name || 'Product'}</p>
                            <p className="text-xs text-gray-500">SKU: {item.product?.sku || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">Qty: {item.quantity}</p>
                            <p className="text-sm text-green-600 font-bold">{formatCurrency(item.totalPrice || (item.price * item.quantity))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                      <FiDollarSign className="mr-2 h-5 w-5 text-purple-600" />
                      💰 Financial Summary
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-bold">{formatCurrency(selectedSale.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax (18%):</span>
                        <span className="font-bold">{formatCurrency(selectedSale.tax || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-bold text-green-600">-{formatCurrency(selectedSale.discount || 0)}</span>
                      </div>
                      <div className="border-t-2 border-purple-200 pt-3">
                        <div className="flex justify-between text-xl font-bold">
                          <span className="text-gray-800">TOTAL:</span>
                          <span className="text-purple-600">{formatCurrency(selectedSale.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  💡 Need to reprint receipt? Check the POS system!
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-bold transition-all transform hover:scale-105 shadow-lg"
                >
                  ✅ Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredSales.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md mx-auto">
            <div className="h-24 w-24 mx-auto bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mb-6">
              <FiShoppingCart className="h-12 w-12 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Sales Found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || paymentFilter !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'No sales data available for the selected period'}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setPaymentFilter('all');
                setDateRange('7d');
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              <FiRefreshCw className="inline h-4 w-4 mr-2" />
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
