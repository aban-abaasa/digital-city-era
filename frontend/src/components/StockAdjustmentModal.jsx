import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FiX, FiSave, FiPlus, FiMinus, FiPackage, FiTrendingUp, FiTrendingDown,
  FiRotateCw, FiAlertTriangle, FiCheckCircle, FiEdit3, FiTrash2,
  FiUpload, FiDownload, FiZap, FiCalendar, FiUser, FiFileText
} from 'react-icons/fi';
import inventoryService from '../services/inventoryApiService';

const StockAdjustmentModal = ({ isOpen, onClose, products = [], onAdjustmentComplete }) => {
  const [adjustments, setAdjustments] = useState([]);
  const [reason, setReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('manual'); // 'manual', 'received', 'damaged', 'sold', 'returned'
  const [batchValue, setBatchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notes, setNotes] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);

  const adjustmentTypes = [
    { id: 'manual', label: '✏️ Manual Adjustment', color: 'blue' },
    { id: 'received', label: '📦 Stock Received', color: 'green' },
    { id: 'damaged', label: '💔 Damaged/Lost', color: 'red' },
    { id: 'sold', label: '🛒 Direct Sale', color: 'purple' },
    { id: 'returned', label: '↩️ Customer Return', color: 'orange' },
    { id: 'expired', label: '⏰ Expired Items', color: 'gray' },
    { id: 'theft', label: '🚨 Theft/Missing', color: 'red' },
    { id: 'promotion', label: '🎁 Promotional Give-away', color: 'pink' }
  ];

  useEffect(() => {
    if (isOpen && products.length > 0) {
      initializeAdjustments();
    }
  }, [isOpen, products]);

  const initializeAdjustments = () => {
    const initialAdjustments = products.map(product => ({
      productId: product.id,
      productName: product.name,
      currentStock: product.stock,
      adjustment: 0,
      newStock: product.stock,
      sku: product.sku,
      category: product.category,
      price: product.price
    }));
    setAdjustments(initialAdjustments);
  };

  const updateAdjustment = (productId, adjustment) => {
    setAdjustments(prev => prev.map(item => 
      item.productId === productId 
        ? { 
            ...item, 
            adjustment: parseInt(adjustment) || 0,
            newStock: Math.max(0, item.currentStock + (parseInt(adjustment) || 0))
          }
        : item
    ));
  };

  const applyBatchAdjustment = () => {
    const value = parseInt(batchValue) || 0;
    if (value === 0) {
      toast.warning('Please enter a valid adjustment value');
      return;
    }

    setAdjustments(prev => prev.map(item => ({
      ...item,
      adjustment: value,
      newStock: Math.max(0, item.currentStock + value)
    })));

    setBatchValue('');
    toast.success(`Applied ${value > 0 ? '+' : ''}${value} to all selected products`);
  };

  const resetAdjustments = () => {
    setAdjustments(prev => prev.map(item => ({
      ...item,
      adjustment: 0,
      newStock: item.currentStock
    })));
    toast.info('All adjustments reset');
  };

  const removeProduct = (productId) => {
    setAdjustments(prev => prev.filter(item => item.productId !== productId));
  };

  const calculateTotals = () => {
    const totalAdjustment = adjustments.reduce((sum, item) => sum + item.adjustment, 0);
    const positiveAdjustments = adjustments.filter(item => item.adjustment > 0).length;
    const negativeAdjustments = adjustments.filter(item => item.adjustment < 0).length;
    const totalValue = adjustments.reduce((sum, item) => sum + (item.adjustment * item.price), 0);

    return {
      totalAdjustment,
      positiveAdjustments,
      negativeAdjustments,
      totalValue,
      affectedProducts: adjustments.filter(item => item.adjustment !== 0).length
    };
  };

  const validateAdjustments = () => {
    const hasAdjustments = adjustments.some(item => item.adjustment !== 0);
    if (!hasAdjustments) {
      toast.warning('No adjustments to apply');
      return false;
    }

    if (!reason.trim()) {
      toast.warning('Please provide a reason for the adjustment');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateAdjustments()) return;

    setLoading(true);
    try {
      const adjustmentData = adjustments
        .filter(item => item.adjustment !== 0)
        .map(item => ({
          productId: item.productId,
          adjustment: item.adjustment
        }));

      await inventoryService.bulkStockAdjustment(adjustmentData);
      
      // Log the adjustment
      const adjustmentLog = {
        type: adjustmentType,
        reason,
        notes,
        date: adjustmentDate,
        adjustments: adjustments.filter(item => item.adjustment !== 0),
        totals: calculateTotals(),
        timestamp: new Date().toISOString()
      };

      console.log('Stock adjustment logged:', adjustmentLog);
      
      onAdjustmentComplete && onAdjustmentComplete(adjustmentLog);
      onClose();
      
    } catch (error) {
      toast.error('Failed to apply stock adjustments');
    } finally {
      setLoading(false);
    }
  };

  const getAdjustmentColor = (adjustment) => {
    if (adjustment > 0) return 'text-green-600 bg-green-50';
    if (adjustment < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getTypeColor = (type) => {
    const typeConfig = adjustmentTypes.find(t => t.id === type);
    return typeConfig ? typeConfig.color : 'gray';
  };

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiPackage className="h-6 w-6 text-white mr-3" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    📊 Stock Adjustment Center
                  </h3>
                  <p className="text-orange-100 text-sm">
                    {adjustments.length} products • {totals.affectedProducts} with changes
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center">
                  <FiPackage className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{adjustments.length}</div>
                    <div className="text-sm text-blue-800">Products</div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center">
                  <FiTrendingUp className="h-8 w-8 text-green-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">+{totals.positiveAdjustments}</div>
                    <div className="text-sm text-green-800">Increases</div>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="flex items-center">
                  <FiTrendingDown className="h-8 w-8 text-red-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">-{totals.negativeAdjustments}</div>
                    <div className="text-sm text-red-800">Decreases</div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center">
                  <FiZap className="h-8 w-8 text-purple-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      ${Math.abs(totals.totalValue).toFixed(2)}
                    </div>
                    <div className="text-sm text-purple-800">Value Impact</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Adjustment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adjustment Type
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {adjustmentTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch Adjustment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Adjustment
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      value={batchValue}
                      onChange={(e) => setBatchValue(e.target.value)}
                      placeholder="±0"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      onClick={applyBatchAdjustment}
                      className="px-4 py-2 bg-orange-600 text-white rounded-r-lg hover:bg-orange-700 transition-colors"
                    >
                      Apply All
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Actions
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={resetAdjustments}
                      className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                    >
                      <FiRotateCw className="h-4 w-4 inline mr-1" />
                      Reset
                    </button>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Physical count correction, Damaged goods, New shipment received..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Products List */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900">
                  Product Adjustments
                </h4>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {adjustments.map((item, index) => (
                  <div key={item.productId} className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    item.adjustment !== 0 ? 'bg-blue-50' : ''
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900">{item.productName}</h5>
                            <p className="text-sm text-gray-500">
                              SKU: {item.sku} • Category: {item.category} • ${item.price}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            {/* Current Stock */}
                            <div className="text-center">
                              <div className="text-sm text-gray-500">Current</div>
                              <div className="font-bold text-gray-900">{item.currentStock}</div>
                            </div>

                            {/* Adjustment Input */}
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateAdjustment(item.productId, item.adjustment - 1)}
                                className="w-8 h-8 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center"
                              >
                                <FiMinus className="h-4 w-4" />
                              </button>
                              
                              <input
                                type="number"
                                value={item.adjustment}
                                onChange={(e) => updateAdjustment(item.productId, e.target.value)}
                                className={`w-20 px-2 py-1 text-center border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${getAdjustmentColor(item.adjustment)}`}
                              />
                              
                              <button
                                onClick={() => updateAdjustment(item.productId, item.adjustment + 1)}
                                className="w-8 h-8 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors flex items-center justify-center"
                              >
                                <FiPlus className="h-4 w-4" />
                              </button>
                            </div>

                            {/* New Stock */}
                            <div className="text-center">
                              <div className="text-sm text-gray-500">New</div>
                              <div className={`font-bold ${
                                item.newStock > item.currentStock ? 'text-green-600' : 
                                item.newStock < item.currentStock ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {item.newStock}
                              </div>
                            </div>

                            {/* Value Impact */}
                            {item.adjustment !== 0 && (
                              <div className="text-center">
                                <div className="text-sm text-gray-500">Value</div>
                                <div className={`font-bold text-sm ${
                                  item.adjustment > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {item.adjustment > 0 ? '+' : ''}${(item.adjustment * item.price).toFixed(2)}
                                </div>
                              </div>
                            )}

                            {/* Remove Button */}
                            <button
                              onClick={() => removeProduct(item.productId)}
                              className="w-8 h-8 text-gray-400 hover:text-red-600 transition-colors flex items-center justify-center"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FiCheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                  Adjustment Preview
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Summary</h5>
                    <ul className="text-sm space-y-1">
                      <li>Type: <span className="font-medium">{adjustmentTypes.find(t => t.id === adjustmentType)?.label}</span></li>
                      <li>Affected Products: <span className="font-medium">{totals.affectedProducts}</span></li>
                      <li>Total Adjustment: <span className={`font-medium ${totals.totalAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totals.totalAdjustment >= 0 ? '+' : ''}{totals.totalAdjustment}
                      </span></li>
                      <li>Value Impact: <span className={`font-medium ${totals.totalValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totals.totalValue >= 0 ? '+' : ''}${totals.totalValue.toFixed(2)}
                      </span></li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Changes</h5>
                    <div className="max-h-32 overflow-y-auto text-sm">
                      {adjustments.filter(item => item.adjustment !== 0).map(item => (
                        <div key={item.productId} className="flex justify-between py-1">
                          <span className="truncate mr-2">{item.productName}</span>
                          <span className={`font-medium ${item.adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.adjustment >= 0 ? '+' : ''}{item.adjustment}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional information about this adjustment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <FiAlertTriangle className="h-4 w-4 inline mr-1" />
                This action will update inventory levels immediately
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || totals.affectedProducts === 0}
                  className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Applying...
                    </>
                  ) : (
                    <>
                      <FiSave className="h-4 w-4 mr-2" />
                      Apply Adjustments ({totals.affectedProducts})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;



