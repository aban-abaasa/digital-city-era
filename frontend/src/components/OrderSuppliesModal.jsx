import React, { useState } from 'react';
import { FiX, FiPlus, FiMinus, FiShoppingCart, FiPackage } from 'react-icons/fi';
import { toast } from 'react-toastify';

const OrderSuppliesModal = ({ 
  isOpen, 
  onClose, 
  tillSupplies = [], 
  onSubmitOrder,
  submitting = false 
}) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [priority, setPriority] = useState('normal');
  const [showAddNew, setShowAddNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [newItem, setNewItem] = useState({
    item_name: '',
    item_category: 'stationery',
    unit_cost: 0,
    minimum_stock: 10,
    quantity: 1
  });

  if (!isOpen) return null;

  const categories = ['all', 'bags', 'paper', 'stationery', 'equipment', 'cleaning', 'safety'];
  
  const filteredSupplies = tillSupplies.filter(supply => {
    const matchesSearch = supply.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || supply.item_category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleQuantityChange = (supply, quantity) => {
    const qty = parseInt(quantity) || 0;
    if (qty === 0) {
      setSelectedItems(selectedItems.filter(item => item.id !== supply.id));
    } else {
      const existing = selectedItems.find(item => item.id === supply.id);
      if (existing) {
        setSelectedItems(selectedItems.map(item => 
          item.id === supply.id ? { ...item, quantity: qty } : item
        ));
      } else {
        setSelectedItems([...selectedItems, { ...supply, quantity: qty }]);
      }
    }
  };

  const incrementQuantity = (supply) => {
    const existing = selectedItems.find(item => item.id === supply.id);
    const currentQty = existing ? existing.quantity : 0;
    handleQuantityChange(supply, currentQty + 1);
  };

  const decrementQuantity = (supply) => {
    const existing = selectedItems.find(item => item.id === supply.id);
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty > 0) {
      handleQuantityChange(supply, currentQty - 1);
    }
  };

  const getQuantity = (supply) => {
    const existing = selectedItems.find(item => item.id === supply.id);
    return existing ? existing.quantity : 0;
  };

  const getTotalEstimate = () => {
    return selectedItems.reduce((sum, item) => {
      return sum + (item.unit_cost * item.quantity);
    }, 0);
  };

  const handleAddNewItem = () => {
    if (!newItem.item_name.trim()) {
      toast.error('⚠️ Please enter an item name');
      return;
    }
    if (newItem.unit_cost <= 0) {
      toast.error('⚠️ Please enter a valid unit cost');
      return;
    }

    // Add as a custom item (will be added to inventory after approval)
    const customItem = {
      id: `custom_${Date.now()}`,
      ...newItem,
      current_stock: 0,
      minimum_stock: newItem.minimum_stock,
      is_custom: true
    };

    setSelectedItems([...selectedItems, customItem]);
    setNewItem({
      item_name: '',
      item_category: 'stationery',
      unit_cost: 0,
      minimum_stock: 10,
      quantity: 1
    });
    setShowAddNew(false);
    toast.success(`✅ Custom item "${customItem.item_name}" added to order`);
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error('⚠️ Please select at least one supply item');
      return;
    }

    const orderData = {
      items: selectedItems.map(item => ({
        id: item.id,
        item_name: item.item_name,
        item_category: item.item_category,
        quantity: item.quantity,
        unit_cost: item.unit_cost
      })),
      priority,
      notes: orderNotes
    };

    await onSubmitOrder(orderData);
    
    // Reset form
    setSelectedItems([]);
    setOrderNotes('');
    setPriority('normal');
  };

  const getStockStatus = (supply) => {
    if (supply.current_stock <= (supply.reorder_point || supply.minimum_stock * 0.5)) {
      return 'critical';
    } else if (supply.current_stock <= supply.minimum_stock) {
      return 'low';
    }
    return 'good';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FiShoppingCart className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">Order Supplies</h2>
              <p className="text-blue-100 text-sm">Select items you need to restock</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Search and Filter Bar */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="🔍 Search supplies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setShowAddNew(!showAddNew)}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center space-x-2 whitespace-nowrap"
              >
                <FiPlus className="h-5 w-5" />
                <span>Add New</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-2 rounded-full font-semibold transition-all ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {cat === 'all' ? '🌟 All' : `${cat.charAt(0).toUpperCase()}${cat.slice(1)}`}
                </button>
              ))}
            </div>

            {/* Results Count */}
            <p className="text-sm text-gray-600">
              Found <span className="font-bold text-blue-600">{filteredSupplies.length}</span> items
              {selectedItems.length > 0 && (
                <span className="ml-2">• <span className="font-bold text-green-600">{selectedItems.length}</span> selected</span>
              )}
            </p>
          </div>

          {/* Add New Item Form */}
          {showAddNew && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                <FiPlus className="mr-2 h-5 w-5 text-green-600" />
                Add Custom Supply Item
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., USB Flash Drives"
                    value={newItem.item_name}
                    onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                    className="w-full border-2 border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category *</label>
                  <select
                    value={newItem.item_category}
                    onChange={(e) => setNewItem({ ...newItem, item_category: e.target.value })}
                    className="w-full border-2 border-gray-300 rounded-lg p-2"
                  >
                    <option value="stationery">Stationery</option>
                    <option value="equipment">Equipment</option>
                    <option value="bags">Bags</option>
                    <option value="paper">Paper</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="safety">Safety</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Unit Cost (UGX) *</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newItem.unit_cost}
                    onChange={(e) => setNewItem({ ...newItem, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full border-2 border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity Needed *</label>
                  <input
                    type="number"
                    placeholder="1"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full border-2 border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 mt-3">
                <button
                  onClick={handleAddNewItem}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  ✓ Add to Order
                </button>
                <button
                  onClick={() => setShowAddNew(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Supplies Grid */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center">
                <FiPackage className="mr-2 h-5 w-5 text-blue-600" />
                Available Supplies
              </span>
              <span className="text-sm text-gray-600 font-normal">
                Select quantities needed
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredSupplies.map((supply) => {
                const stockStatus = getStockStatus(supply);
                const quantity = getQuantity(supply);
                
                return (
                  <div 
                    key={supply.id} 
                    className={`border-2 rounded-lg p-4 ${
                      quantity > 0 ? 'border-blue-500 bg-blue-50' :
                      stockStatus === 'critical' ? 'border-red-300 bg-red-50' :
                      stockStatus === 'low' ? 'border-yellow-300 bg-yellow-50' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{supply.item_name}</h4>
                        <p className="text-xs text-gray-600">
                          Stock: {supply.current_stock} / Min: {supply.minimum_stock}
                        </p>
                        <p className="text-sm text-gray-700 font-semibold mt-1">
                          UGX {supply.unit_cost?.toLocaleString()} per {supply.unit_of_measure}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        stockStatus === 'critical' ? 'bg-red-200 text-red-900' :
                        stockStatus === 'low' ? 'bg-yellow-200 text-yellow-900' :
                        'bg-green-200 text-green-900'
                      }`}>
                        {stockStatus}
                      </span>
                    </div>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-2 mt-3">
                      <button
                        onClick={() => decrementQuantity(supply)}
                        className="bg-gray-200 hover:bg-gray-300 rounded-lg p-2 transition-colors"
                        disabled={quantity === 0}
                      >
                        <FiMinus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(supply, e.target.value)}
                        className="w-20 text-center border-2 border-gray-300 rounded-lg p-2 font-bold"
                      />
                      <button
                        onClick={() => incrementQuantity(supply)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 transition-colors"
                      >
                        <FiPlus className="h-4 w-4" />
                      </button>
                      {quantity > 0 && (
                        <span className="ml-2 text-sm font-semibold text-blue-600">
                          = UGX {(supply.unit_cost * quantity).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Order Details</h3>
            
            {/* Priority */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg p-2"
              >
                <option value="low">Low - Standard delivery</option>
                <option value="normal">Normal - Next available</option>
                <option value="high">High - Priority delivery</option>
                <option value="urgent">Urgent - Immediate need</option>
              </select>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Add any special instructions or reasons for this order..."
                className="w-full border-2 border-gray-300 rounded-lg p-3 h-24 resize-none"
              />
            </div>

            {/* Order Summary */}
            {selectedItems.length > 0 && (
              <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg p-4 border-2 border-blue-300">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center justify-between">
                  <span>Order Summary</span>
                  <span className="text-sm font-normal text-gray-600">{selectedItems.length} items</span>
                </h4>
                <div className="space-y-2 text-sm mb-3 max-h-40 overflow-y-auto">
                  {selectedItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`flex justify-between items-start p-2 rounded ${
                        item.is_custom ? 'bg-green-100 border-l-4 border-green-500' : 'bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {item.is_custom && '✨ '}
                          {item.item_name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {item.item_category} • {item.quantity} x UGX {item.unit_cost.toLocaleString()}
                          {item.is_custom && <span className="ml-2 text-green-600 font-semibold">(New Item)</span>}
                        </div>
                      </div>
                      <div className="font-bold text-blue-600 ml-2">
                        UGX {(item.unit_cost * item.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-blue-300 pt-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-900">Estimated Total:</div>
                    <div className="text-xs text-gray-600">
                      {selectedItems.filter(i => i.is_custom).length > 0 && 
                        `Including ${selectedItems.filter(i => i.is_custom).length} custom item(s)`
                      }
                    </div>
                  </div>
                  <span className="text-3xl font-bold text-blue-600">
                    UGX {getTotalEstimate().toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 p-6 rounded-b-2xl flex items-center justify-between space-x-4">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-bold transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedItems.length === 0 || submitting}
            className={`flex-1 px-6 py-3 rounded-lg font-bold text-white transition-all ${
              selectedItems.length === 0 || submitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transform hover:scale-105'
            }`}
          >
            {submitting ? 'Submitting...' : `Submit Order (${selectedItems.length} items)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuppliesModal;
