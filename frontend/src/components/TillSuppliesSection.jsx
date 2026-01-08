import React from 'react';
import { 
  FiShoppingCart, FiCheckCircle, FiDollarSign, FiClock, 
  FiPackage, FiEye, FiDownload, FiAlertCircle, FiPrinter, FiPlus
} from 'react-icons/fi';

const TillSuppliesSection = ({ 
  tillSupplies = [], 
  orderStats = { myOrders: 0, approved: 0, totalPaid: 0, pending: 0 },
  onOpenOrderModal,
  formatUGX = (amount) => `UGX ${amount?.toLocaleString() || 0}`
}) => {
  
  const getStockStatus = (supply) => {
    if (supply.current_stock <= (supply.reorder_point || supply.minimum_stock * 0.5)) {
      return 'critical';
    } else if (supply.current_stock <= supply.minimum_stock) {
      return 'low';
    }
    return 'good';
  };

  const getSupplyIcon = (category) => {
    const icons = {
      bags: '🛍️',
      paper: '🧾',
      equipment: '💰',
      cleaning: '🧴',
      stationery: '🏷️',
      safety: '😷'
    };
    return icons[category] || '📦';
  };

  // Get supply statistics
  const lowStockCount = tillSupplies.filter(s => getStockStatus(s) === 'low').length;
  const criticalStockCount = tillSupplies.filter(s => getStockStatus(s) === 'critical').length;
  const goodStockCount = tillSupplies.filter(s => getStockStatus(s) === 'good').length;

  return (
    <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 rounded-xl p-6 shadow-2xl border-2 border-blue-300 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-60 h-60 bg-cyan-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3 text-3xl animate-pulse">🏪</span>
              Till & Station Supplies
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {tillSupplies.length} total items • 
              <span className="text-green-600 font-semibold ml-1">{goodStockCount} good</span> • 
              <span className="text-yellow-600 font-semibold ml-1">{lowStockCount} low</span> • 
              <span className="text-red-600 font-semibold ml-1">{criticalStockCount} critical</span>
            </p>
          </div>
          <button
            onClick={onOpenOrderModal}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 text-white rounded-lg font-bold hover:from-blue-700 hover:via-cyan-700 hover:to-teal-700 transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 shadow-xl hover:shadow-2xl"
          >
            <FiPlus className="h-5 w-5" />
            <span>Order Now</span>
          </button>
        </div>

      {/* Order Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">My Orders</p>
              <p className="text-3xl font-bold text-blue-600">{orderStats.myOrders}</p>
            </div>
            <FiShoppingCart className="h-10 w-10 text-blue-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">✅ Approved</p>
              <p className="text-3xl font-bold text-green-600">{orderStats.approved}</p>
            </div>
            <FiCheckCircle className="h-10 w-10 text-green-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">💰 Payments</p>
              <p className="text-2xl font-bold text-orange-600">{formatUGX(orderStats.totalPaid)}</p>
            </div>
            <FiDollarSign className="h-10 w-10 text-orange-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">⏳ Pending</p>
              <p className="text-3xl font-bold text-purple-600">{orderStats.pending}</p>
            </div>
            <FiClock className="h-10 w-10 text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Current Supplies Status */}
      <div className="bg-white rounded-lg p-4 shadow-md mb-4">
        <h5 className="font-bold text-gray-900 mb-3 flex items-center">
          <FiPackage className="mr-2 h-5 w-5 text-blue-600" />
          Current Stock Levels
        </h5>
        {tillSupplies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FiPackage className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>No supplies data available. Loading from database...</p>
            <button 
              onClick={onOpenOrderModal}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Request Supplies Anyway
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {tillSupplies.slice(0, 6).map((supply, index) => {
            const stockStatus = getStockStatus(supply);
            const supplyIcon = getSupplyIcon(supply.item_category);
            
            return (
              <div 
                key={supply.id || index} 
                className={`p-3 border-2 rounded-lg text-center transition-all duration-300 hover:scale-105 cursor-pointer ${
                  stockStatus === 'critical' ? 'border-red-300 bg-red-50 hover:border-red-400' :
                  stockStatus === 'low' ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400' :
                  'border-green-300 bg-green-50 hover:border-green-400'
                }`}
              >
                <div className="text-2xl mb-1">{supplyIcon}</div>
                <h5 className="font-semibold text-gray-900 text-xs">{supply.item_name}</h5>
                <p className="text-xs text-gray-600 mt-1 font-bold">
                  {supply.current_stock}/{supply.minimum_stock}
                </p>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                  stockStatus === 'critical' ? 'bg-red-200 text-red-900' :
                  stockStatus === 'low' ? 'bg-yellow-200 text-yellow-900' :
                  'bg-green-200 text-green-900'
                }`}>
                  {stockStatus.toUpperCase()}
                </span>
                {stockStatus !== 'good' && (
                  <button 
                    onClick={onOpenOrderModal}
                    className="mt-2 w-full text-xs bg-blue-600 text-white py-1 rounded hover:bg-blue-700"
                  >
                    Request
                  </button>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Quick Insights */}
      {(lowStockCount > 0 || criticalStockCount > 0) && (
        <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <FiAlertCircle className="h-6 w-6 text-orange-600 animate-pulse" />
            <h5 className="font-bold text-gray-900">⚠️ Action Required</h5>
          </div>
          <p className="text-sm text-gray-700">
            {criticalStockCount > 0 && (
              <span className="font-bold text-red-600">
                {criticalStockCount} item{criticalStockCount > 1 ? 's' : ''} critically low!
              </span>
            )}
            {criticalStockCount > 0 && lowStockCount > 0 && ' • '}
            {lowStockCount > 0 && (
              <span className="font-semibold text-yellow-700">
                {lowStockCount} item{lowStockCount > 1 ? 's' : ''} running low
              </span>
            )}
          </p>
          <button 
            onClick={onOpenOrderModal}
            className="mt-2 text-sm font-bold text-orange-600 hover:text-orange-700 underline"
          >
            → Click to order now
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button 
          onClick={onOpenOrderModal}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 flex items-center justify-center space-x-2 font-semibold shadow-lg hover:shadow-xl"
        >
          <FiEye className="h-5 w-5" />
          <span>View All</span>
        </button>
        <button className="bg-gradient-to-r from-green-500 to-green-600 text-white p-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 flex items-center justify-center space-x-2 font-semibold shadow-lg hover:shadow-xl">
          <FiDownload className="h-5 w-5" />
          <span>History</span>
        </button>
        <button className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-300 flex items-center justify-center space-x-2 font-semibold shadow-lg hover:shadow-xl">
          <FiAlertCircle className="h-5 w-5" />
          <span>Report</span>
        </button>
        <button className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center space-x-2 font-semibold shadow-lg hover:shadow-xl">
          <FiPrinter className="h-5 w-5" />
          <span>Print</span>
        </button>
      </div>
      </div>
    </div>
  );
};

export default TillSuppliesSection;
