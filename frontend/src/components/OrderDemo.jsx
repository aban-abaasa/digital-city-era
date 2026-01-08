import React, { useState } from 'react';
import { FiPackage, FiSend, FiCheck } from 'react-icons/fi';
import OrderModal from './OrderModal';

const OrderDemo = () => {
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Demo supplier data
  const demoSupplier = {
    _id: 'demo_supplier_001',
    name: 'Uganda Coffee Co.',
    contactPerson: 'John Mukasa',
    email: 'orders@ugandacoffee.co.ug',
    phone: '+256 700 123 456',
    address: 'Kampala Industrial Area',
    category: 'Food & Beverages',
    rating: 4.8,
    country: 'Uganda',
    paymentTerms: 'net_30'
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
      <div className="text-center">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiPackage className="h-8 w-8 text-white" />
        </div>
        
        <h3 className="text-2xl font-bold text-gray-800 mb-2">📦 Order System Demo</h3>
        <p className="text-gray-600 mb-6">
          Test the complete order creation and sending functionality with Uganda Coffee Co.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="text-center">
              <FiPackage className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="font-bold text-gray-800">Create Orders</p>
              <p className="text-sm text-gray-600">Add Ugandan products</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="text-center">
              <FiSend className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="font-bold text-gray-800">Send Orders</p>
              <p className="text-sm text-gray-600">SMS, Email, PDF</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="text-center">
              <FiCheck className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="font-bold text-gray-800">Track Status</p>
              <p className="text-sm text-gray-600">Real-time updates</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
          <h4 className="font-bold text-gray-800 mb-2">Demo Supplier: {demoSupplier.name}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Contact: {demoSupplier.contactPerson}</p>
              <p className="text-gray-600">Phone: {demoSupplier.phone}</p>
            </div>
            <div>
              <p className="text-gray-600">Email: {demoSupplier.email}</p>
              <p className="text-gray-600">Rating: ⭐ {demoSupplier.rating}/5.0</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowOrderModal(true)}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
        >
          <FiPackage className="inline h-5 w-5 mr-2" />
          Try Order System
        </button>
      </div>

      {/* Order Modal */}
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        supplier={demoSupplier}
      />
    </div>
  );
};

export default OrderDemo;
