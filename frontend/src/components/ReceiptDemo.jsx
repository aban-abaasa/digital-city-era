import React, { useState } from 'react';
import { FiPlay, FiFileText, FiMail, FiMessageSquare, FiDownload } from 'react-icons/fi';
import ReceiptModal from './ReceiptModal';

const ReceiptDemo = () => {
  const [showDemo, setShowDemo] = useState(false);

  // Sample sale data for demonstration
  const demoSaleData = {
    saleNumber: 'DEMO-001',
    createdAt: new Date().toISOString(),
    items: [
      { name: 'Bread - White Loaf', quantity: 2, price: 2500, productId: '1' },
      { name: 'Milk - Fresh 1L', quantity: 1, price: 3500, productId: '2' },
      { name: 'Sugar - 1kg Pack', quantity: 1, price: 4500, productId: '3' },
      { name: 'Tea Bags - 50 Pack', quantity: 1, price: 5000, productId: '4' }
    ],
    customer: {
      firstName: 'John',
      lastName: 'Mukasa',
      loyaltyPoints: 750
    },
    paymentMethod: 'cash',
    subtotal: 15500,
    tax: 2790, // 18% VAT
    discount: 775, // 5% loyalty discount
    total: 17515,
    change: 2485,
    loyaltyPointsEarned: 17,
    cashier: 'Demo User'
  };

  return (
    <div className="p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-xl">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">
          🇺🇬 Receipt System Demo
        </h3>
        <p className="text-gray-600 mb-6">
          Experience our comprehensive receipt system with SMS, Email, and PDF options
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <FiMessageSquare className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-bold text-gray-800">SMS Receipts</h4>
            <p className="text-sm text-gray-600">Quick & convenient</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <FiMail className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <h4 className="font-bold text-gray-800">Email Receipts</h4>
            <p className="text-sm text-gray-600">Detailed & professional</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <FiDownload className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <h4 className="font-bold text-gray-800">PDF Download</h4>
            <p className="text-sm text-gray-600">Print-ready format</p>
          </div>
        </div>

        <button
          onClick={() => setShowDemo(true)}
          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
        >
          <FiPlay className="inline h-6 w-6 mr-3" />
          Try Receipt Demo
        </button>

        <div className="mt-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>💡 Note:</strong> This is a demonstration. SMS and Email sending are simulated for demo purposes.
          </p>
        </div>
      </div>

      <ReceiptModal 
        isOpen={showDemo}
        onClose={() => setShowDemo(false)}
        saleData={demoSaleData}
      />
    </div>
  );
};

export default ReceiptDemo;
