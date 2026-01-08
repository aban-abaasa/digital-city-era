import React from 'react';
import { FiCheck, FiAlertCircle, FiClock } from 'react-icons/fi';

const VerificationDashboard = () => {
  // Demo data for verification status
  const verificationStats = {
    verified: 125,
    pending: 8,
    rejected: 3
  };

  // Demo verification items
  const recentVerifications = [
    {
      id: 1,
      type: 'Product',
      name: 'Blue Band Margarine',
      status: 'verified',
      date: '2025-09-19',
      verifiedBy: 'Demo Manager'
    },
    {
      id: 2,
      type: 'Supplier',
      name: 'Mukwano Industries',
      status: 'pending',
      date: '2025-09-19',
      verifiedBy: '-'
    },
    {
      id: 3,
      type: 'Order',
      name: 'Order #12345',
      status: 'verified',
      date: '2025-09-18',
      verifiedBy: 'Demo Staff'
    }
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Verification Dashboard</h2>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center">
            <FiCheck className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm text-green-600">Verified</p>
              <h3 className="text-2xl font-bold text-green-700">{verificationStats.verified}</h3>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
          <div className="flex items-center">
            <FiClock className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm text-yellow-600">Pending</p>
              <h3 className="text-2xl font-bold text-yellow-700">{verificationStats.pending}</h3>
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-center">
            <FiAlertCircle className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm text-red-600">Rejected</p>
              <h3 className="text-2xl font-bold text-red-700">{verificationStats.rejected}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Verifications */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Verifications</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentVerifications.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${item.status === 'verified' ? 'bg-green-100 text-green-800' : 
                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.verifiedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Message */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-600">
          This is a demo verification dashboard. In a production environment, this would show real-time verification data.
        </p>
      </div>
    </div>
  );
};

export default VerificationDashboard;