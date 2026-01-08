import React, { useState } from 'react';
import { 
  FiHome, FiUser, FiUsers, FiTruck, FiShoppingBag, FiPackage,
  FiBarChart, FiPieChart, FiTrendingUp, FiBell, FiSettings,
  FiLogOut, FiChevronRight, FiChevronDown, FiStar, FiAward,
  FiDollarSign, FiTarget, FiZap, FiShield, FiGift, FiNavigation
} from 'react-icons/fi';

const PortalNavigation = ({ userType, activeTab, onTabChange, userProfile }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getPortalConfig = () => {
    switch (userType) {
      case 'manager':
        return {
          title: 'Manager Portal',
          icon: '👩‍💼',
          color: 'from-blue-600 to-purple-600',
          tabs: [
            { id: 'overview', label: 'Overview', icon: FiBarChart, description: 'Business insights and metrics' },
            { id: 'analytics', label: 'Analytics', icon: FiPieChart, description: 'Advanced data analysis' },
            { id: 'team', label: 'Team Management', icon: FiUsers, description: 'Manage your team' },
            { id: 'alerts', label: 'Alerts', icon: FiBell, description: 'Important notifications' }
          ]
        };
      case 'employee':
      case 'cashier':
        return {
          title: 'Cashier Portal',
          icon: '�',
          color: 'from-green-600 to-blue-600',
          tabs: [
            { id: 'dashboard', label: 'Dashboard', icon: FiBarChart, description: 'Your cashier workspace' },
            { id: 'performance', label: 'Performance', icon: FiTrendingUp, description: 'Track your cashier metrics' },
            { id: 'inventory', label: 'Station Supplies', icon: FiPackage, description: 'Register & station supplies' },
            { id: 'notifications', label: 'Notifications', icon: FiBell, description: 'Cashier alerts & updates' }
          ]
        };
      case 'supplier':
        return {
          title: 'Supplier Portal',
          icon: '🏢',
          color: 'from-purple-600 to-blue-600',
          tabs: [
            { id: 'overview', label: 'Overview', icon: FiBarChart, description: 'Partnership dashboard' },
            { id: 'orders', label: 'Orders', icon: FiPackage, description: 'Order management' },
            { id: 'products', label: 'Products', icon: FiShoppingBag, description: 'Product catalog' },
            { id: 'performance', label: 'Performance', icon: FiTrendingUp, description: 'Performance metrics' },
            { id: 'notifications', label: 'Notifications', icon: FiBell, description: 'Important updates' }
          ]
        };
      default:
        return {
          title: 'Portal',
          icon: '🏢',
          color: 'from-gray-600 to-gray-800',
          tabs: []
        };
    }
  };

  const config = getPortalConfig();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className={`bg-white shadow-lg border-r transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b ${isCollapsed ? 'px-2' : ''}`}>
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className={`h-8 w-8 bg-gradient-to-r ${config.color} rounded-full flex items-center justify-center`}>
                <span className="text-white text-sm">{config.icon}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{config.title}</h2>
                <p className="text-xs text-gray-500">Professional Portal</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-all duration-300"
          >
            {isCollapsed ? <FiChevronRight className="h-5 w-5" /> : <FiChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* User Profile */}
      {!isCollapsed && userProfile && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className={`h-10 w-10 bg-gradient-to-r ${config.color} rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold">{userProfile.avatar || '👤'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getGreeting()}, {userProfile.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{userProfile.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="p-2">
        <div className="space-y-1">
          {config.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${config.color} text-white shadow-lg`
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={isCollapsed ? tab.label : ''}
            >
              <tab.icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <div>{tab.label}</div>
                  <div className="text-xs opacity-75">{tab.description}</div>
                </div>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="p-4 border-t">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Actions
          </h3>
          <div className="space-y-1">
            <button className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-all duration-300">
              <FiSettings className="h-4 w-4 mr-3" />
              Settings
            </button>
            <button className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-all duration-300">
              <FiBell className="h-4 w-4 mr-3" />
              Notifications
            </button>
            <button className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-all duration-300">
              <FiLogOut className="h-4 w-4 mr-3" />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Collapsed Icons */}
      {isCollapsed && (
        <div className="p-2 space-y-1">
          {config.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center justify-center p-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${config.color} text-white shadow-lg`
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={tab.label}
            >
              <tab.icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalNavigation;
