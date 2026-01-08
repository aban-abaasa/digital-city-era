import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiUsers, FiUser, FiTruck, FiArrowRight, FiShield, FiStar,
  FiTrendingUp, FiBarChart, FiPackage, FiShoppingBag, FiBell,
  FiAward, FiTarget, FiZap, FiGift, FiNavigation, FiCheckCircle,
  FiBriefcase, FiDollarSign, FiClock
} from 'react-icons/fi';
import SupabaseConnectionTest from '../components/SupabaseConnectionTest';

const PortalLanding = () => {
  const navigate = useNavigate();
  const [selectedPortal, setSelectedPortal] = useState(null);

  const portals = [
    {
      id: 'manager',
      title: 'Manager',
      shortDesc: 'Management',
      description: 'Strategic business management',
      icon: FiBriefcase,
      color: 'from-blue-600 to-blue-700',
      route: '/manager-login',
    },
    {
      id: 'cashier',
      title: 'Cashier',
      shortDesc: 'Transactions',
      description: 'Real-time transaction management',
      icon: FiDollarSign,
      color: 'from-green-600 to-green-700',
      route: '/cashier-login',
    },
    // {
    //   id: 'employee',
    //   title: 'Employee',
    //   shortDesc: 'Tasks',
    //   description: 'Personal dashboard & tasks',
    //   icon: FiUser,
    //   color: 'from-indigo-600 to-indigo-700',
    //   route: '/employee-login',
    // },
    {
      id: 'supplier',
      title: 'Supplier',
      shortDesc: 'Orders',
      description: 'Order & inventory management',
      icon: FiTruck,
      color: 'from-purple-600 to-purple-700',
      route: '/supplier-login',
    }
  ];

  const handlePortalSelect = (portal) => {
    setSelectedPortal(portal);
    setTimeout(() => {
      navigate(portal.route);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideInDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse-ring {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
            }
            50% {
              box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
            }
          }
          .animate-fadeInUp {
            animation: fadeInUp 0.6s ease-out;
          }
          .animate-slideInDown {
            animation: slideInDown 0.6s ease-out;
          }
          .animate-pulse-ring {
            animation: pulse-ring 2s infinite;
          }
        `
      }} />

      {/* Header */}
      <div className="border-b border-gray-700 backdrop-blur-sm bg-gray-800 bg-opacity-50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <FiTarget className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">FareDeal</h1>
                <p className="text-xs sm:text-sm text-gray-400">Professional Portals</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Title Section */}
        <div className="text-center mb-8 sm:mb-12 animate-fadeInUp">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-4">
            Select Your Portal
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            Choose your role to access your personalized workspace
          </p>
        </div>

        {/* Portal Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {portals.map((portal, index) => {
            const IconComponent = portal.icon;
            return (
              <div
                key={portal.id}
                className={`group relative bg-gradient-to-b from-gray-700 to-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 border border-gray-600 hover:border-blue-500 ${
                  selectedPortal?.id === portal.id ? 'ring-2 ring-blue-500' : ''
                } animate-fadeInUp`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => handlePortalSelect(portal)}
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-r ${portal.color} opacity-0 group-hover:opacity-10 rounded-xl sm:rounded-2xl transition-opacity duration-300`}></div>
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`inline-flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-lg sm:rounded-xl bg-gradient-to-r ${portal.color} mb-3 sm:mb-4 group-hover:shadow-lg transition-all duration-300`}>
                    <IconComponent className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>

                  {/* Title and Description */}
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{portal.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-400 mb-4 line-clamp-2">{portal.description}</p>

                  {/* Access Button */}
                  <button className={`w-full bg-gradient-to-r ${portal.color} text-white py-2 px-3 sm:py-2.5 sm:px-4 rounded-lg font-semibold text-sm hover:shadow-lg transition-all duration-300 flex items-center justify-center space-x-2 group/btn`}>
                    <span>Access</span>
                    <FiArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Features */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl sm:rounded-2xl p-6 sm:p-8 mb-8 border border-gray-600 animate-fadeInUp">
          <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-6 sm:mb-8">
            Why FareDeal?
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: FiShield, title: 'Secure', desc: 'Enterprise security' },
              { icon: FiZap, title: 'Real-time', desc: 'Live updates' },
              { icon: FiTarget, title: 'Tailored', desc: 'Role-specific' },
              { icon: FiAward, title: 'Advanced', desc: 'Analytics & insights' }
            ].map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <h4 className="font-semibold text-white text-sm mb-1">{feature.title}</h4>
                <p className="text-xs text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Supabase Connection Test */}
        <div className="mb-6 sm:mb-8 animate-fadeInUp">
          <SupabaseConnectionTest />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 sm:mt-12 animate-fadeInUp">
          {/* <p className="text-xs sm:text-sm text-gray-500 mb-3">
            💡 Tip: Add <span className="text-blue-400 font-mono">#/admin</span> to URL for admin access
          </p> */}
          <div className="flex justify-center space-x-4 flex-wrap gap-2">
            <button className="text-sm sm:text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300">
              Learn More
            </button>
            <button className="text-sm sm:text-base border border-gray-600 text-gray-300 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:border-blue-500 hover:text-blue-400 transition-all duration-300">
              Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalLanding;
