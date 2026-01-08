import React, { useState, useEffect } from 'react';
import { 
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiUsers, FiPackage,
  FiPieChart, FiTarget, FiAward, FiClock, FiAlertTriangle,
  FiCalendar, FiMail, FiBell, FiSettings, FiLogOut, FiSearch,
  FiFilter, FiDownload, FiRefreshCw, FiEye, FiEdit, FiTrash2,
  FiPlus, FiMinus, FiChevronRight, FiChevronDown, FiStar,
  FiHeart, FiZap, FiShield, FiGift, FiNavigation, FiMapPin,
  FiSmartphone, FiHeadphones, FiCamera, FiWatch, FiHome,
  FiCreditCard, FiMessageCircle, FiShare2, FiThumbsUp,
  FiBookmark, FiGrid, FiList, FiInfo, FiHelpCircle,
  FiMaximize, FiMinimize, FiRotateCw, FiUpload, FiPrinter,
  FiTag, FiHash, FiImage, FiCheckCircle, FiXCircle, FiBarChart
} from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';

const PortalDashboard = ({ 
  userType, 
  userProfile, 
  metrics, 
  chartData, 
  recentActivity, 
  notifications,
  onAction 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherMood, setWeatherMood] = useState('sunny');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getPortalConfig = () => {
    switch (userType) {
      case 'manager':
        return {
          title: 'Manager Portal',
          icon: '👩‍💼',
          color: 'from-blue-600 to-purple-600',
          greeting: 'Strategic Business Management'
        };
      case 'employee':
        return {
          title: 'Employee Portal',
          icon: '👩‍💼',
          color: 'from-green-600 to-blue-600',
          greeting: 'Your Personal Workspace'
        };
      case 'supplier':
        return {
          title: 'Supplier Portal',
          icon: '🏢',
          color: 'from-purple-600 to-blue-600',
          greeting: 'Partnership Management Hub'
        };
      default:
        return {
          title: 'Portal',
          icon: '🏢',
          color: 'from-gray-600 to-gray-800',
          greeting: 'Professional Dashboard'
        };
    }
  };

  const config = getPortalConfig();

  const renderWelcomeSection = () => (
    <div className={`bg-gradient-to-r ${config.color} rounded-xl p-6 text-white shadow-lg mb-6`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {getGreeting()}, {userProfile?.name || 'User'}! 👋
          </h1>
          <p className="text-white text-opacity-90 text-lg">
            {config.greeting} - {currentTime.toLocaleDateString()}
          </p>
          <div className="flex items-center mt-4 space-x-4">
            <div className="flex items-center space-x-2">
              <FiClock className="h-5 w-5" />
              <span>{currentTime.toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <FiCalendar className="h-5 w-5" />
              <span>{currentTime.toLocaleDateString()}</span>
            </div>
            {userProfile?.role && (
              <div className="flex items-center space-x-2">
                <FiUser className="h-5 w-5" />
                <span>{userProfile.role}</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl mb-2 animate-float">{config.icon}</div>
          <p className="text-white text-opacity-90">Ready to excel!</p>
        </div>
      </div>
    </div>
  );

  const renderMetrics = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {metrics?.map((metric, index) => (
        <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">{metric.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
              {metric.change && (
                <p className={`text-sm font-medium mt-1 ${
                  metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.change}
                </p>
              )}
            </div>
            <div className={`p-3 rounded-lg bg-gradient-to-r ${metric.color || 'from-gray-500 to-gray-600'}`}>
              <metric.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderChart = () => (
    <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Performance Trends</h3>
        <div className="flex space-x-2">
          {['7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              className="px-3 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-300"
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      {chartData && (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" fill="#3B82F6" fillOpacity={0.3} />
            <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const renderRecentActivity = () => (
    <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
      <div className="space-y-4">
        {recentActivity?.map((activity, index) => (
          <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg hover:shadow-md transition-all duration-300">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              activity.type === 'success' ? 'bg-green-100' :
              activity.type === 'warning' ? 'bg-yellow-100' :
              activity.type === 'error' ? 'bg-red-100' :
              'bg-blue-100'
            }`}>
              <span className="text-lg">{activity.icon}</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{activity.title}</h4>
              <p className="text-sm text-gray-600">{activity.description}</p>
              <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
            </div>
            {activity.amount && (
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(activity.amount)}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Notifications</h3>
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          Mark all as read
        </button>
      </div>
      <div className="space-y-4">
        {notifications?.map((notification, index) => (
          <div key={index} className={`border-l-4 p-4 rounded-lg ${
            notification.type === 'critical' ? 'border-red-500 bg-red-50' :
            notification.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
            notification.type === 'info' ? 'border-blue-500 bg-blue-50' :
            'border-green-500 bg-green-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                <p className="text-gray-600">{notification.message}</p>
                <p className="text-sm text-gray-500 mt-1">{notification.timestamp}</p>
              </div>
              {notification.action && (
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 text-sm">
                  {notification.action}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeInUp">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes float {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          .animate-fadeInUp {
            animation: fadeInUp 0.8s ease-out;
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `
      }} />
      
      {renderWelcomeSection()}
      {renderMetrics()}
      {renderChart()}
      {renderRecentActivity()}
      {renderNotifications()}
    </div>
  );
};

export default PortalDashboard;
