import React from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingCart, FiTruck, FiHome, FiPackage, FiCreditCard } from 'react-icons/fi';

const CustomerNavigation = () => {
  return (
    <div className="bg-white shadow-lg border-b-4 border-gradient-to-r from-blue-500 to-purple-500">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mr-4">
              <span className="text-2xl">🛍️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">FAREDEAL</h1>
              <p className="text-sm text-gray-500">Customer Portal</p>
            </div>
          </div>
          
          <nav className="flex items-center space-x-4">
            <Link
              to="/customer-delivery"
              className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium"
            >
              <FiTruck className="h-5 w-5 mr-2" />
              Shop & Delivery
            </Link>
            
            <Link
              to="/customer-payment"
              className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 font-medium"
            >
              <FiCreditCard className="h-5 w-5 mr-2" />
              In-Store Payment
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default CustomerNavigation;
