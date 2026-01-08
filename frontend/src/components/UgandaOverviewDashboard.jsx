import React, { useState } from 'react';
import { 
  FiTrendingUp, FiUsers, FiDollarSign, FiPackage, FiClock, 
  FiBell, FiCalendar, FiRefreshCw, FiDownload, FiChevronRight, FiChevronDown, FiChevronUp 
} from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Area, AreaChart, Bar
} from 'recharts';

const UgandaOverviewDashboard = ({ 
  businessMetrics, 
  currentTime, 
  managerProfile, 
  revenueData, 
  realTimeActivity, 
  topProducts, 
  performanceIndicators,
  strategicGoals,
  formatCurrency,
  timeRange,
  setTimeRange,
  setActiveTab,
  setShowInventoryModal,
  openEditModal
}) => {

  const [showStrategicGoals, setShowStrategicGoals] = useState(false);

  const getUgandanGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Wasuze otya nno'; // Good morning in Luganda
    if (hour < 17) return 'Osiibye otya'; // Good afternoon in Luganda  
    return 'Oraire otya'; // Good evening in Luganda
  };

  const getTimeOfDayEmoji = () => {
    const hour = currentTime.getHours();
    if (hour < 6) return '🌙';
    if (hour < 12) return '🌅';
    if (hour < 18) return '🌞';
    return '🌆';
  };

  // Uganda-specific business insights
  const ugandaBusinessInsights = [
    "📱 Mobile Money transactions are 67% of total sales",
    "🏪 Local suppliers represent 78% of your supply chain", 
    "🇺🇬 Ugandan Shilling strength is affecting import costs",
    "⏰ Peak business hours: 10AM-2PM and 5PM-8PM",
    "📊 Matooke and Posho are your top selling products"
  ];

  return (
    <div className="space-y-4 sm:space-y-8 animate-fadeIn">
      {/* Enhanced Welcome Section with Uganda Cultural Elements */}
      <div className="relative overflow-hidden bg-gradient-to-br from-yellow-400 via-green-500 to-red-600 rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-white shadow-2xl">
        {/* Uganda Flag Pattern Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-1/3 bg-black"></div>
          <div className="h-1/3 bg-yellow-400"></div>
          <div className="h-1/3 bg-red-600"></div>
        </div>
        
        {/* Animated Elements */}
        <div className="absolute top-2 right-4 sm:top-4 sm:right-8 text-4xl sm:text-6xl opacity-30 animate-bounce">
          🦩 {/* Crested Crane - Uganda's national bird */}
        </div>
        <div className="absolute bottom-2 left-4 sm:bottom-4 sm:left-8 text-2xl sm:text-4xl opacity-20 animate-pulse">
          🏔️ {/* Mountains of the Moon */}
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start justify-between space-y-6 lg:space-y-0">
            <div className="flex-1 w-full">
              <div className="flex items-center space-x-2 sm:space-x-4 mb-4">
                <div className="text-4xl sm:text-6xl animate-wave">{getTimeOfDayEmoji()}</div>
                <div>
                  <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-1 sm:mb-2">
                    {getUgandanGreeting()}, {managerProfile.name}!
                  </h1>
                  <p className="text-yellow-100 text-sm sm:text-xl">
                    Welcome to your FAREDEAL command center 🇺🇬
                  </p>
                  <p className="text-yellow-200 text-xs sm:text-lg mt-1">
                    Kampala, Uganda • {currentTime.toLocaleTimeString('en-UG', { 
                      timeZone: 'Africa/Kampala',
                      hour12: true 
                    })} EAT
                  </p>
                </div>
              </div>
              
              {/* Today's Performance Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-8">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="text-2xl sm:text-3xl">💰</div>
                    <div>
                      <p className="text-yellow-100 text-xs sm:text-sm font-medium">Today's Revenue</p>
                      <p className="text-xl sm:text-2xl font-bold">{formatCurrency(businessMetrics.todayRevenue)}</p>
                      <p className="text-yellow-200 text-xs sm:text-sm">+{businessMetrics.weeklyGrowth}% from last week</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/30">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="text-2xl sm:text-3xl">📦</div>
                    <div>
                      <p className="text-yellow-100 text-xs sm:text-sm font-medium">Orders Processed</p>
                      <p className="text-xl sm:text-2xl font-bold">{businessMetrics.todayOrders}</p>
                      <p className="text-yellow-200 text-xs sm:text-sm">Serving {businessMetrics.todayCustomers} customers</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/30 sm:col-span-2 md:col-span-1">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="text-2xl sm:text-3xl">📱</div>
                    <div>
                      <p className="text-yellow-100 text-xs sm:text-sm font-medium">Mobile Money</p>
                      <p className="text-xl sm:text-2xl font-bold">{businessMetrics.mobileMoneyRatio}%</p>
                      <p className="text-yellow-200 text-xs sm:text-sm">of today's transactions</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Key Metrics with Uganda Context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          { 
            title: 'Total Revenue', 
            value: formatCurrency(businessMetrics.totalRevenue), 
            icon: '💰',
            gradient: 'from-green-500 to-green-600', 
            change: `+${businessMetrics.weeklyGrowth}%`,
            subtitle: 'This month',
            ugandaContext: 'Ensimbi (Money) earned'
          },
          { 
            title: 'Active Customers', 
            value: businessMetrics.activeCustomers.toLocaleString(), 
            icon: '👥',
            gradient: 'from-blue-500 to-blue-600', 
            change: `+${businessMetrics.newCustomerAcquisition}%`,
            subtitle: 'Growing customer base',
            ugandaContext: 'Abaguzi (Customers)'
          },
          { 
            title: 'Team Members', 
            value: businessMetrics.teamSize, 
            icon: '🏢',
            gradient: 'from-purple-500 to-purple-600', 
            change: '+3 new hires',
            subtitle: 'Strong workforce',
            ugandaContext: 'Abakozi (Workers)'
          },
          { 
            title: 'Mobile Money', 
            value: `${businessMetrics.mobileMoneyRatio}%`, 
            icon: '📱',
            gradient: 'from-orange-500 to-orange-600', 
            change: '+5% adoption',
            subtitle: 'Digital payments',
            ugandaContext: 'Ssente za simu'
          }
        ].map((metric, index) => (
          <div key={index} className="group">
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 border border-gray-100 hover:border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>
                  <div className="flex items-center mt-2 space-x-2">
                    <span className="flex items-center text-green-600 text-sm font-medium">
                      <FiTrendingUp className="h-3 w-3 mr-1" />
                      {metric.change}
                    </span>
                    <span className="text-gray-500 text-xs">•</span>
                    <span className="text-gray-500 text-xs">{metric.subtitle}</span>
                  </div>
                  <p className="text-yellow-600 text-xs mt-1 font-medium">
                    {metric.ugandaContext}
                  </p>
                </div>
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${metric.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-3xl">{metric.icon}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Uganda Business Insights */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <span className="text-2xl">🇺🇬</span>
            <span>Uganda Business Insights</span>
          </h3>
          <span className="text-sm text-gray-500">Updated {currentTime.toLocaleDateString()}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ugandaBusinessInsights.map((insight, index) => (
            <div key={index} className="bg-gradient-to-r from-yellow-50 to-green-50 rounded-xl p-4 border border-yellow-200 hover:shadow-md transition-all duration-300">
              <p className="text-sm text-gray-700 font-medium">{insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Activity Feed with Uganda Context */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <FiBell className="h-6 w-6 text-blue-600" />
            <span>Live Activity • Ebyeyongedde (Happenings)</span>
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Updates</span>
          </div>
        </div>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {realTimeActivity && realTimeActivity.length > 0 ? (
            realTimeActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-300">
                <div className="text-3xl">{activity.icon}</div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">{activity.message}</p>
                  <p className="text-sm text-gray-500">{activity.time}</p>
                </div>
                {activity.amount && (
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(activity.amount)}</p>
                    <p className="text-xs text-gray-500">Uganda Shillings</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <FiBell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No recent activity</p>
              <p className="text-sm text-gray-400">Real-time updates will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Revenue Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Revenue Trends • Amaguzi (Sales)</h3>
          <div className="flex space-x-2">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  timeRange === range
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb', 
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
              }} 
            />
            <Area type="monotone" dataKey="revenue" fill="#FCD34D" fillOpacity={0.3} stroke="#F59E0B" strokeWidth={3} />
            <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 2, r: 5 }} />
            <Bar dataKey="profit" fill="#3B82F6" radius={[6, 6, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products - Uganda Focus */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <span className="text-2xl">🌾</span>
            <span>Top Products • Ebintu ebigulibwa (Best Sellers)</span>
          </h3>
          <button 
            onClick={() => setActiveTab('analytics')}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 transition-colors"
          >
            <span>View All</span>
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topProducts.slice(0, 6).map((product, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl hover:shadow-md transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{product.name}</h4>
                  <p className="text-sm text-gray-600">{product.category}</p>
                  <p className="text-xs text-yellow-600">Uganda Local Product</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{product.sales} sales</p>
                <p className="text-sm text-gray-600">{formatCurrency(product.revenue)}</p>
                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {product.growth}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Goals with Uganda Context - Collapsible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <button
            onClick={() => setShowStrategicGoals(!showStrategicGoals)}
            className="w-full flex items-center justify-between text-xl font-bold text-gray-900 mb-4 hover:text-yellow-600 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎯</span>
              <span>Strategic Goals • Ebiruubirirwa</span>
            </div>
            {showStrategicGoals ? <FiChevronUp className="h-6 w-6" /> : <FiChevronDown className="h-6 w-6" />}
          </button>
          
          {showStrategicGoals && (
            <div className="space-y-3 animate-fadeIn">
              {strategicGoals && strategicGoals.length > 0 ? (
                <ul className="space-y-3">
                  {strategicGoals.map((goal) => (
                    <li key={goal.id} className="flex items-start space-x-3 p-3 hover:bg-yellow-50 rounded-lg transition-all">
                      <span className="text-yellow-500 text-xl mt-1">•</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-gray-900">{goal.title}</h4>
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{goal.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${goal.progress}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Target: {typeof goal.target === 'number' && goal.target > 1000 ? formatCurrency(goal.target) : goal.target}</span>
                          <span>Current: {typeof goal.current === 'number' && goal.current > 1000 ? formatCurrency(goal.current) : goal.current}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Deadline: {goal.deadline}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">🎯</span>
                  <p className="text-gray-500 font-medium">Loading strategic goals...</p>
                  <p className="text-sm text-gray-400">Data will appear shortly</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Performance Indicators */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <span className="text-2xl">📊</span>
            <span>Performance • Enkola</span>
          </h3>
          <div className="space-y-6">
            {performanceIndicators && performanceIndicators.length > 0 ? (
              performanceIndicators.map((indicator, index) => {
                const progress = (indicator.current / indicator.target) * 100;
                const colorClasses = {
                  blue: 'from-blue-500 to-blue-600',
                  green: 'from-green-500 to-green-600',
                  purple: 'from-purple-500 to-purple-600',
                  orange: 'from-orange-500 to-orange-600'
                };
                
                return (
                  <div key={index} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">{indicator.name}</span>
                      <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                        {indicator.unit === 'UGX' ? formatCurrency(indicator.current) : 
                         indicator.unit === 'USD' ? formatCurrency(indicator.current) : 
                         indicator.unit === 'stars' ? `${indicator.current}/5 ⭐` :
                         `${indicator.current}${indicator.unit}`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div 
                        className={`bg-gradient-to-r ${colorClasses[indicator.color]} h-4 rounded-full transition-all duration-500 relative overflow-hidden`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Target: {indicator.unit === 'UGX' ? formatCurrency(indicator.target) : 
                                indicator.unit === 'USD' ? formatCurrency(indicator.target) : 
                                indicator.unit === 'stars' ? `${indicator.target}/5 ⭐` :
                                `${indicator.target}${indicator.unit}`}</span>
                      <span className="font-medium">{Math.round(progress)}% Complete</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <span className="text-4xl mb-2 block">📊</span>
                <p className="text-gray-500 font-medium">Loading performance metrics...</p>
                <p className="text-sm text-gray-400">Data will appear shortly</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-xl">
        <h3 className="text-xl font-bold mb-6 flex items-center space-x-2">
          <span className="text-2xl">⚡</span>
          <span>Quick Actions • Ebiragiro byamangu</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { title: 'Add Team', icon: '👥', action: () => openEditModal('team', null, 'add') },
            { title: 'New Supplier', icon: '🤝', action: () => setActiveTab('suppliers') },
            { title: 'Check Orders', icon: '📦', action: () => setActiveTab('orders') },
            { title: 'View Stock', icon: '📋', action: () => setShowInventoryModal(true) },
            { title: 'Analytics', icon: '📊', action: () => setActiveTab('analytics') },
            { title: 'Team Schedule', icon: '📅', action: () => setActiveTab('team') }
          ].map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-4 rounded-xl transition-all duration-300 transform hover:scale-105 flex flex-col items-center space-y-2 border border-white/30"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-sm font-bold text-center">{action.title}</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(20deg); }
          75% { transform: rotate(-20deg); }
        }
        .animate-wave {
          animation: wave 2s ease-in-out infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UgandaOverviewDashboard;
