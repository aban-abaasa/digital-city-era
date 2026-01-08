import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FiHome, 
  FiUser, 
  FiShoppingBag, 
  FiCreditCard, 
  FiTruck,
  FiSettings,
  FiBarChart2
} from 'react-icons/fi';

const DemoNavigation = () => {
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">🚀 Demo Navigation</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/"
            className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <FiHome className="h-3 w-3 mr-1" />
            Home
          </Link>
          <Link
            to="/customer"
            className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <FiUser className="h-3 w-3 mr-1" />
            Customer
          </Link>
          <Link
            to="/customer-dashboard"
            className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <FiUser className="h-3 w-3 mr-1" />
            Dashboard
          </Link>
          <Link
            to="/customer-delivery"
            className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <FiTruck className="h-3 w-3 mr-1" />
            Delivery
          </Link>
          <Link
            to="/customer-payment"
            className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <FiCreditCard className="h-3 w-3 mr-1" />
            Payment
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center px-3 py-2 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <FiBarChart2 className="h-3 w-3 mr-1" />
            Manager
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DemoNavigation;
