import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FiDollarSign, FiActivity, FiTrendingUp, FiShield, FiUsers, FiCreditCard,
  FiAlertTriangle, FiCheckCircle, FiClock, FiGlobe, FiZap,
  FiRefreshCw, FiDownload, FiEye, FiSettings, FiBell, FiFilter, FiSearch,
  FiCalendar, FiPieChart, FiTarget, FiAward, FiHeart, FiStar, FiPercent,
  FiLock, FiWifi, FiSmartphone, FiMapPin, FiInfo, FiTrendingDown,
  FiArrowUp, FiArrowDown, FiMoreHorizontal, FiGrid, FiList, FiXCircle
} from 'react-icons/fi';
import PaymentSecurity from './PaymentSecurity';
import PaymentAnalytics from './PaymentAnalytics';
import PaymentMethods from './PaymentMethods';
import paymentService from '../services/paymentService';

const PaymentDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('overview');
  const [showSecurity, setShowSecurity] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPaymentTest, setShowPaymentTest] = useState(false);
  const [timeframe, setTimeframe] = useState('7d');
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadDashboardData();
    // Simulate real-time updates
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [timeframe]);

  const loadDashboardData = async () => {
    try {
      // Simulate loading dashboard data
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockData = {
        overview: {
          totalRevenue: 2847392.50,
          revenueGrowth: 12.8,
          totalTransactions: 15847,
          transactionGrowth: 8.4,
          activeCustomers: 3247,
          customerGrowth: 15.2,
          conversionRate: 3.8,
          conversionChange: -0.3
        },
        realtimeMetrics: {
          transactionsToday: 1247,
          revenueToday: 89432.50,
          averageTransaction: 71.75,
          peakHour: '2:00 PM',
          activeSessions: 127
        },
        paymentMethods: [
          { name: 'Credit Cards', usage: 42.5, trend: 'up', amount: 1210000 },
          { name: 'Digital Wallets', usage: 28.3, trend: 'up', amount: 805000 },
          { name: 'Bank Transfers', usage: 12.7, trend: 'stable', amount: 362000 },
          { name: 'Cryptocurrency', usage: 8.9, trend: 'up', amount: 253000 },
          { name: 'BNPL', usage: 5.1, trend: 'up', amount: 145000 },
          { name: 'Cash', usage: 2.5, trend: 'down', amount: 71000 }
        ],
        securityStatus: {
          fraudPrevention: 'Active',
          riskScore: 'Low',
          alertsToday: 3,
          blockedTransactions: 27
        },
        recentTransactions: [
          { id: 'TXN001', amount: 156.75, method: 'Credit Card', status: 'Success', time: '2 mins ago' },
          { id: 'TXN002', amount: 89.20, method: 'PayPal', status: 'Success', time: '5 mins ago' },
          { id: 'TXN003', amount: 234.50, method: 'Apple Pay', status: 'Success', time: '8 mins ago' },
          { id: 'TXN004', amount: 45.30, method: 'Google Pay', status: 'Pending', time: '12 mins ago' },
          { id: 'TXN005', amount: 678.90, method: 'Bank Transfer', status: 'Success', time: '15 mins ago' }
        ]
      };

      setDashboardData(mockData);
      
      // Simulate notifications
      setNotifications([
        { id: 1, type: 'success', message: 'Payment system running optimally', time: '2 mins ago' },
        { id: 2, type: 'warning', message: 'High volume detected - monitoring', time: '15 mins ago' },
        { id: 3, type: 'info', message: 'New payment method activated', time: '1 hour ago' }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('en-US').format(number);
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <FiTrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <FiTrendingDown className="h-4 w-4 text-red-500" />;
      default: return <FiActivity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-xl font-semibold text-gray-700">Loading Payment Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FiDollarSign className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">💳 Payment Dashboard</h1>
                <p className="text-sm text-gray-500">Real-time payment analytics and management</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Timeframe Selector */}
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>

              {/* Quick Actions */}
              <button
                onClick={() => setShowSecurity(true)}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiShield className="h-4 w-4 mr-2" />
                🔒 Security
              </button>
              
              <button
                onClick={() => setShowAnalytics(true)}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiActivity className="h-4 w-4 mr-2" />
                📊 Analytics
              </button>

              <button
                onClick={() => setShowPaymentTest(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiCreditCard className="h-4 w-4 mr-2" />
                🧪 Test Payment
              </button>

              <button
                onClick={loadDashboardData}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FiRefreshCw className="h-4 w-4 mr-2" />
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">💰 Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(dashboardData.overview.totalRevenue)}
                </p>
                <div className="flex items-center mt-2">
                  <FiTrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600 font-medium">
                    +{dashboardData.overview.revenueGrowth}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FiDollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Transactions */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">🔢 Total Transactions</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatNumber(dashboardData.overview.totalTransactions)}
                </p>
                <div className="flex items-center mt-2">
                  <FiTrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600 font-medium">
                    +{dashboardData.overview.transactionGrowth}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <FiCreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Active Customers */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">👥 Active Customers</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatNumber(dashboardData.overview.activeCustomers)}
                </p>
                <div className="flex items-center mt-2">
                  <FiTrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600 font-medium">
                    +{dashboardData.overview.customerGrowth}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <FiUsers className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">🎯 Conversion Rate</p>
                <p className="text-3xl font-bold text-gray-900">
                  {dashboardData.overview.conversionRate}%
                </p>
                <div className="flex items-center mt-2">
                  <FiTrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600 font-medium">
                    {dashboardData.overview.conversionChange}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <FiTarget className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Metrics & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Real-time Metrics */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">⚡ Real-time Metrics</h3>
              <div className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                <span className="text-sm font-medium">Live</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <FiActivity className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="font-medium text-gray-900">📈 Transactions Today</span>
                </div>
                <span className="text-xl font-bold text-blue-600">
                  {formatNumber(dashboardData.realtimeMetrics.transactionsToday)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <FiDollarSign className="h-5 w-5 text-green-600 mr-3" />
                  <span className="font-medium text-gray-900">💵 Revenue Today</span>
                </div>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(dashboardData.realtimeMetrics.revenueToday)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center">
                  <FiTrendingUp className="h-5 w-5 text-purple-600 mr-3" />
                  <span className="font-medium text-gray-900">📊 Average Transaction</span>
                </div>
                <span className="text-xl font-bold text-purple-600">
                  {formatCurrency(dashboardData.realtimeMetrics.averageTransaction)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <FiUsers className="h-5 w-5 text-yellow-600 mr-3" />
                  <span className="font-medium text-gray-900">👤 Active Sessions</span>
                </div>
                <span className="text-xl font-bold text-yellow-600">
                  {formatNumber(dashboardData.realtimeMetrics.activeSessions)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Methods Usage */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">💳 Payment Methods</h3>
              <FiPieChart className="h-5 w-5 text-gray-500" />
            </div>

            <div className="space-y-3">
              {dashboardData.paymentMethods.map((method, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center flex-1">
                    <div className="flex items-center mr-4">
                      {getTrendIcon(method.trend)}
                      <span className="ml-2 font-medium text-gray-900">{method.name}</span>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>{method.usage}%</span>
                        <span>{formatCurrency(method.amount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${method.usage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security Status & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Security Status */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">🛡️ Security Status</h3>
              <FiShield className="h-5 w-5 text-green-600" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <FiCheckCircle className="h-5 w-5 text-green-600 mr-3" />
                  <span className="font-medium text-gray-900">🔒 Fraud Prevention</span>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {dashboardData.securityStatus.fraudPrevention}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <FiActivity className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="font-medium text-gray-900">⚠️ Risk Score</span>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {dashboardData.securityStatus.riskScore}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <FiAlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                  <span className="font-medium text-gray-900">🚨 Alerts Today</span>
                </div>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  {dashboardData.securityStatus.alertsToday}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <FiXCircle className="h-5 w-5 text-red-600 mr-3" />
                  <span className="font-medium text-gray-900">🚫 Blocked Today</span>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  {dashboardData.securityStatus.blockedTransactions}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">📋 Recent Transactions</h3>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View All
              </button>
            </div>

            <div className="space-y-3">
              {dashboardData.recentTransactions.map((transaction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <FiCreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{transaction.id}</p>
                      <p className="text-sm text-gray-600">{transaction.method}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </p>
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                      <span className="text-xs text-gray-500">{transaction.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🔔 System Notifications</h3>
              <FiBell className="h-5 w-5 text-gray-500" />
            </div>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className={`p-3 rounded-lg border-l-4 ${
                  notification.type === 'success' ? 'border-green-500 bg-green-50' :
                  notification.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{notification.message}</p>
                    <span className="text-xs text-gray-500">{notification.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSecurity && (
        <PaymentSecurity
          isOpen={showSecurity}
          onClose={() => setShowSecurity(false)}
        />
      )}

      {showAnalytics && (
        <PaymentAnalytics
          isOpen={showAnalytics}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showPaymentTest && (
        <PaymentMethods
          isOpen={showPaymentTest}
          onClose={() => setShowPaymentTest(false)}
          orderTotal={99.99}
          customerInfo={{ name: 'Test Customer', email: 'test@example.com' }}
          loyaltyPoints={1250}
          onPaymentComplete={(result) => {
            setShowPaymentTest(false);
            if (result.success) {
              toast.success('Test payment completed successfully! 🎉');
              loadDashboardData(); // Refresh dashboard
            } else {
              toast.error('Test payment failed: ' + result.message);
            }
          }}
        />
      )}
    </div>
  );
};

export default PaymentDashboard;