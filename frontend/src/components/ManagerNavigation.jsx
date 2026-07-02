// ManagerNavigation Component v2.0 - Mobile: Hidden, Desktop: Full Navigation
import React from 'react';
import {
  FiBarChart, FiPieChart, FiTruck
} from 'react-icons/fi';

const ManagerNavigation = ({ activeTab, setActiveTab, isMobile }) => {
  const tabs = [
    {
      id: 'overview',
      label: 'Dashboard',
      icon: FiBarChart,
      description: 'Business overview',
      color: 'from-blue-500 to-blue-600',
      ugandaEmoji: '📊'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: FiPieChart,
      description: 'Data insights',
      color: 'from-purple-500 to-purple-600',
      ugandaEmoji: '📈'
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: FiTruck,
      description: 'Order management',
      color: 'from-orange-500 to-orange-600',
      ugandaEmoji: '📦'
    }
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // On mobile, hide this navigation completely - hamburger menu handles it
  if (isMobile) {
    return null;
  }

  // Desktop Navigation
  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        <nav className="flex px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 lg:space-x-6 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center space-x-2 py-4 px-4 lg:px-6 border-b-3 font-medium text-sm lg:text-base transition-all duration-300 whitespace-nowrap group relative ${
                  activeTab === tab.id
                    ? 'border-yellow-500 text-yellow-600 bg-yellow-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{tab.ugandaEmoji}</span>
                  <tab.icon className={`h-5 w-5 transition-transform duration-300 ${
                    activeTab === tab.id ? 'scale-110' : 'group-hover:scale-105'
                  }`} />
                </div>
                
                <div className="text-left">
                  <div className="font-medium">{tab.label}</div>
                  <div className="text-xs text-gray-500">{tab.description}</div>
                </div>
                
                {activeTab === tab.id && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

// Add custom styles for scrollbar hiding
const style = document.createElement('style');
style.textContent = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('scrollbar-hide-style')) {
  style.id = 'scrollbar-hide-style';
  document.head.appendChild(style);
}

export default ManagerNavigation;
