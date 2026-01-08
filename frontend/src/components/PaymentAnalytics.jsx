import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiCreditCard, FiUsers,
  FiActivity, FiPieChart, FiCalendar, FiDownload,
  FiRefreshCw, FiFilter, FiSearch, FiGlobe, FiSmartphone, FiPercent,
  FiClock, FiTarget, FiAward, FiZap, FiInfo, FiEye, FiArrowUp,
  FiArrowDown, FiMoreHorizontal, FiShield, FiHeart, FiStar
} from 'react-icons/fi';
import paymentService from '../services/paymentService';

const PaymentAnalytics = ({ isOpen, onClose }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState('revenue');

  useEffect(() => {
    if (isOpen) {
      loadAnalyticsData();
    }
  }, [isOpen, timeframe]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Simulate loading analytics data
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const mockData = {
        overview: {
          totalRevenue: 2847392.50,
          revenueGrowth: 12.8,
          totalTransactions: 15847,
          transactionGrowth: 8.4,
          averageOrderValue: 179.65,
          aovGrowth: 4.2,
          conversionRate: 3.8,
          conversionGrowth: -0.3,
          topPaymentMethod: 'digital_wallet',
          fraudRate: 0.12
        },
        revenueData: [
          { date: '2024-01-01', amount: 45000, transactions: 250 },
          { date: '2024-01-02', amount: 52000, transactions: 310 },
          { date: '2024-01-03', amount: 48000, transactions: 275 },
          { date: '2024-01-04', amount: 61000, transactions: 340 },
          { date: '2024-01-05', amount: 58000, transactions: 325 },
          { date: '2024-01-06', amount: 67000, transactions: 380 },
          { date: '2024-01-07', amount: 72000, transactions: 410 }
        ],
        paymentMethodBreakdown: [
          { method: 'Credit/Debit Card', percentage: 42.5, amount: 1210000, color: 'bg-blue-500' },
          { method: 'Digital Wallet', percentage: 28.3, amount: 805000, color: 'bg-green-500' },
          { method: 'Bank Transfer', percentage: 12.7, amount: 362000, color: 'bg-purple-500' },
          { method: 'Buy Now Pay Later', percentage: 8.9, amount: 253000, color: 'bg-pink-500' },
          { method: 'Cash', percentage: 4.2, amount: 120000, color: 'bg-yellow-500' },
          { method: 'Cryptocurrency', percentage: 2.1, amount: 60000, color: 'bg-orange-500' },
          { method: 'Gift Card', percentage: 1.3, amount: 37000, color: 'bg-red-500' }
        ],
        geographicData: [
          { country: 'United States', revenue: 1420000, percentage: 49.9, flag: '🇺🇸' },
          { country: 'Canada', revenue: 426000, percentage: 15.0, flag: '🇨🇦' },
          { country: 'United Kingdom', revenue: 284000, percentage: 10.0, flag: '🇬🇧' },
          { country: 'Germany', revenue: 227000, percentage: 8.0, flag: '🇩🇪' },
          { country: 'France', revenue: 170000, percentage: 6.0, flag: '🇫🇷' },
          { country: 'Others', revenue: 320000, percentage: 11.1, flag: '🌍' }
        ],
        deviceData: [
          { device: 'Mobile', percentage: 58.3, sessions: 9245 },
          { device: 'Desktop', percentage: 32.1, sessions: 5086 },
          { device: 'Tablet', percentage: 9.6, sessions: 1516 }
        ],
        timeAnalysis: [
          { hour: 0, transactions: 45, revenue: 8100 },
          { hour: 6, transactions: 120, revenue: 21600 },
          { hour: 12, transactions: 380, revenue: 68400 },
          { hour: 18, transactions: 420, revenue: 75600 },
          { hour: 21, transactions: 290, revenue: 52200 }
        ],
        customerSegments: [
          { segment: 'VIP Customers', revenue: 854000, percentage: 30.0, count: 1250, avgSpend: 683.20 },
          { segment: 'Regular Customers', revenue: 1423000, percentage: 50.0, count: 7890, avgSpend: 180.35 },
          { segment: 'New Customers', revenue: 570000, percentage: 20.0, count: 6707, avgSpend: 85.05 }
        ],
        trending: [
          { metric: 'Mobile Payments', change: 23.5, trend: 'up' },
          { metric: 'Cryptocurrency', change: 156.7, trend: 'up' },
          { metric: 'BNPL Adoption', change: 45.2, trend: 'up' },
          { metric: 'Cash Payments', change: -12.8, trend: 'down' },
          { metric: 'Fraud Rate', change: -8.3, trend: 'down' }
        ]
      };
      
      setAnalyticsData(mockData);
    } catch (error) {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percentage, showSign = true) => {
    const sign = showSign && percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-green-800 mb-2">Total Revenue</h4>
              <div className="text-2xl font-bold text-green-900">
                {formatCurrency(analyticsData.overview.totalRevenue)}
              </div>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-sm font-medium text-green-600">
                  {formatPercentage(analyticsData.overview.revenueGrowth)}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <FiDollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-2">Total Transactions</h4>
              <div className="text-2xl font-bold text-blue-900">
                {analyticsData.overview.totalTransactions.toLocaleString()}
              </div>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="h-4 w-4 text-blue-600 mr-1" />
                <span className="text-sm font-medium text-blue-600">
                  {formatPercentage(analyticsData.overview.transactionGrowth)}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <FiActivity className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-purple-800 mb-2">Average Order Value</h4>
              <div className="text-2xl font-bold text-purple-900">
                {formatCurrency(analyticsData.overview.averageOrderValue)}
              </div>
              <div className="flex items-center mt-2">
                <FiTrendingUp className="h-4 w-4 text-purple-600 mr-1" />
                <span className="text-sm font-medium text-purple-600">
                  {formatPercentage(analyticsData.overview.aovGrowth)}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <FiTarget className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-orange-800 mb-2">Conversion Rate</h4>
              <div className="text-2xl font-bold text-orange-900">
                {analyticsData.overview.conversionRate}%
              </div>
              <div className="flex items-center mt-2">
                <FiTrendingDown className="h-4 w-4 text-red-600 mr-1" />
                <span className="text-sm font-medium text-red-600">
                  {formatPercentage(analyticsData.overview.conversionGrowth)}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
              <FiPercent className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">Revenue Trend</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setChartType('revenue')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                chartType === 'revenue' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setChartType('transactions')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                chartType === 'transactions' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Transactions
            </button>
          </div>
        </div>
        
        <div className="h-64 flex items-end justify-between space-x-2">
          {analyticsData.revenueData.map((data, index) => {
            const value = chartType === 'revenue' ? data.amount : data.transactions;
            const maxValue = Math.max(...analyticsData.revenueData.map(d => 
              chartType === 'revenue' ? d.amount : d.transactions
            ));
            const height = (value / maxValue) * 100;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t-lg relative" style={{ height: '200px' }}>
                  <div 
                    className="bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg absolute bottom-0 w-full transition-all duration-500"
                    style={{ height: `${height}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-600 mt-2 text-center">
                  {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-xs font-medium text-gray-900 text-center">
                  {chartType === 'revenue' ? formatCurrency(value) : value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Methods & Geographic Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Payment Methods</h3>
          <div className="space-y-4">
            {analyticsData.paymentMethodBreakdown.map((method, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <div className={`w-4 h-4 rounded-full ${method.color} mr-3`}></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{method.method}</span>
                      <span className="text-sm text-gray-600">{method.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${method.color} transition-all duration-500`}
                        style={{ width: `${method.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-sm font-bold text-gray-900">{formatCurrency(method.amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Geographic Distribution</h3>
          <div className="space-y-4">
            {analyticsData.geographicData.map((country, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <span className="text-2xl mr-3">{country.flag}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{country.country}</span>
                      <span className="text-sm text-gray-600">{country.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${country.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-sm font-bold text-gray-900">{formatCurrency(country.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrendsTab = () => (
    <div className="space-y-6">
      {/* Trending Metrics */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Trending Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyticsData.trending.map((trend, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">{trend.metric}</h4>
                <div className={`flex items-center ${
                  trend.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trend.trend === 'up' ? <FiArrowUp className="h-4 w-4" /> : <FiArrowDown className="h-4 w-4" />}
                  <span className="font-bold ml-1">{formatPercentage(Math.abs(trend.change))}</span>
                </div>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    trend.trend === 'up' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.abs(trend.change), 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Segments */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Customer Segments</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {analyticsData.customerSegments.map((segment, index) => (
            <div key={index} className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-purple-900">{segment.segment}</h4>
                <div className="flex items-center">
                  {segment.segment === 'VIP Customers' && <FiAward className="h-5 w-5 text-yellow-500" />}
                  {segment.segment === 'Regular Customers' && <FiHeart className="h-5 w-5 text-purple-500" />}
                  {segment.segment === 'New Customers' && <FiStar className="h-5 w-5 text-blue-500" />}
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-purple-700">Revenue:</span>
                  <div className="text-xl font-bold text-purple-900">{formatCurrency(segment.revenue)}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-purple-700">Customers:</span>
                    <div className="font-bold text-purple-900">{segment.count.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-sm text-purple-700">Avg Spend:</span>
                    <div className="font-bold text-purple-900">{formatCurrency(segment.avgSpend)}</div>
                  </div>
                </div>
                
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${segment.percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Device Analysis */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Device Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {analyticsData.deviceData.map((device, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                {device.device === 'Mobile' && <FiSmartphone className="h-8 w-8 text-white" />}
                {device.device === 'Desktop' && <FiEye className="h-8 w-8 text-white" />}
                {device.device === 'Tablet' && <FiActivity className="h-8 w-8 text-white" />}
              </div>
              <h4 className="font-bold text-gray-900 mb-2">{device.device}</h4>
              <div className="text-2xl font-bold text-blue-600 mb-2">{device.percentage}%</div>
              <div className="text-sm text-gray-600">{device.sessions.toLocaleString()} sessions</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div 
                  className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${device.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiActivity className="h-6 w-6 text-white mr-3" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    📊 Payment Analytics
                  </h3>
                  <p className="text-blue-100 text-sm">
                    Comprehensive payment insights and performance metrics
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="px-3 py-2 bg-white/20 text-white border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <option value="1d" className="text-gray-900">Last 24 Hours</option>
                    <option value="7d" className="text-gray-900">Last 7 Days</option>
                    <option value="30d" className="text-gray-900">Last 30 Days</option>
                    <option value="90d" className="text-gray-900">Last 90 Days</option>
                  </select>
                  
                  <button
                    onClick={loadAnalyticsData}
                    className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                  >
                    <FiRefreshCw className="h-4 w-4" />
                  </button>
                  
                  <button className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors">
                    <FiDownload className="h-4 w-4" />
                  </button>
                </div>
                
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <FiMoreHorizontal className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Tabs */}
              <div className="flex space-x-1 mb-6">
                {[
                  { id: 'overview', name: 'Overview', icon: FiActivity },
                  { id: 'trends', name: 'Trends & Insights', icon: FiTrendingUp },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <TabIcon className="h-4 w-4 mr-2" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              {analyticsData && (
                <>
                  {activeTab === 'overview' && renderOverviewTab()}
                  {activeTab === 'trends' && renderTrendsTab()}
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <FiZap className="h-4 w-4 mr-1" />
                  <span>Real-time data</span>
                </div>
                <div className="flex items-center">
                  <FiShield className="h-4 w-4 mr-1" />
                  <span>Secure analytics</span>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Data updated every 5 minutes • Last refresh: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentAnalytics;
