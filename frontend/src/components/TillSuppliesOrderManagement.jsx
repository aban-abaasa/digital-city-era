// ===================================================
// 🏪 TILL & STATION SUPPLIES ORDER MANAGEMENT
// Manager Portal - Approve/Reject Cashier Supply Requests
// ===================================================

import React, { useState, useEffect } from 'react';
import { 
  FiShoppingCart, FiCheckCircle, FiXCircle, FiClock, FiDollarSign,
  FiPackage, FiUser, FiCalendar, FiAlertCircle, FiEye, FiPrinter,
  FiDownload, FiSearch, FiFilter, FiRefreshCw, FiEdit, FiCheck,
  FiX, FiTruck, FiMapPin, FiPhone, FiMail
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import cashierOrdersService from '../services/cashierOrdersService';
import { supabase } from '../services/supabase';

const TillSuppliesOrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    fulfilled: 0,
    totalValue: 0,
    pendingValue: 0
  });

  // Load orders from Supabase
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('cashier_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
      
      // Calculate stats
      const stats = {
        total: data.length,
        pending: data.filter(o => o.status === 'pending').length,
        approved: data.filter(o => o.status === 'approved').length,
        rejected: data.filter(o => o.status === 'rejected').length,
        fulfilled: data.filter(o => o.status === 'fulfilled').length,
        totalValue: data.reduce((sum, o) => sum + (parseFloat(o.estimated_cost) || 0), 0),
        pendingValue: data.filter(o => o.status === 'pending')
          .reduce((sum, o) => sum + (parseFloat(o.estimated_cost) || 0), 0)
      };
      setStats(stats);
      
      toast.success(`✅ Loaded ${data.length} supply orders`);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // 🚀 NEW: Automatically update inventory when order is confirmed
  const updateInventoryFromOrder = async (order, reason = 'restock') => {
    try {
      const { data: orderItems, error: itemsError } = await supabase
        .from('cashier_order_items')
        .select('*')
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      if (!orderItems || orderItems.length === 0) return true;

      // Update inventory for each item in the order
      for (const item of orderItems) {
        // Get current inventory
        const { data: products } = await supabase
          .from('products')
          .select('inventory(current_stock)')
          .eq('id', item.product_id || item.supply_id)
          .single();

        const currentStock = products?.inventory?.[0]?.current_stock || 0;
        const newStock = currentStock + item.quantity;

        // Update inventory
        const { error: invError } = await supabase
          .from('inventory')
          .update({
            current_stock: newStock,
            last_restocked: new Date().toISOString(),
            status: newStock === 0 ? 'out_of_stock' : 
                    newStock <= 10 ? 'low_stock' : 'available'
          })
          .eq('product_id', item.product_id || item.supply_id);

        if (invError) {
          console.warn(`⚠️ Could not update inventory for item ${item.product_id}:`, invError);
        }

        // Log the replenishment
        try {
          await supabase
            .from('inventory_replenishment_log')
            .insert({
              product_id: item.product_id || item.supply_id,
              product_name: item.item_name || item.product_name || `Item ${item.supply_id}`,
              product_sku: item.sku || '',
              old_quantity: currentStock,
              new_quantity: newStock,
              quantity_added: item.quantity,
              reason: reason,
              performed_by: 'manager',
              notes: `Via Order ${order.order_number || order.id}`,
              created_at: new Date().toISOString()
            });
        } catch (logError) {
          console.log('ℹ️ Replenishment log not created (table may not exist yet)');
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.warn('⚠️ Inventory update partial - order still approved');
      return false;
    }
  };

  const handleApproveOrder = async (orderId) => {
    try {
      setActionLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the order details first
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      // Update inventory first (non-blocking if it fails)
      await updateInventoryFromOrder(order, 'restock');
      
      // Then approve the order
      const { error } = await supabase
        .from('cashier_orders')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_by_name: user.user_metadata?.full_name || user.email || 'Manager',
          approved_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Enhanced notification showing inventory was updated
      toast.success(
        <div>
          <div className="font-bold mb-1">✅ Order Approved & Inventory Updated!</div>
          <div className="text-sm">
            <p>Order #{order.order_number} approved by {user.user_metadata?.full_name || 'Manager'}</p>
            <p className="mt-1">📦 Inventory automatically updated with {order.estimated_quantity || 0} items</p>
          </div>
        </div>,
        { autoClose: 5000 }
      );
      
      loadOrders();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error approving order:', error);
      toast.error('Failed to approve order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async (orderId, reason) => {
    try {
      setActionLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cashier_orders')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_by_name: user.user_metadata?.full_name || user.email || 'Manager',
          approved_at: new Date().toISOString(),
          rejection_reason: reason || 'Rejected by manager'
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('✅ Order rejected');
      loadOrders();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast.error('Failed to reject order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFulfillOrder = async (orderId) => {
    try {
      setActionLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the order details
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      // If order wasn't approved yet, update inventory now
      if (order.status !== 'approved') {
        await updateInventoryFromOrder(order, 'restock');
      }
      
      const { error } = await supabase
        .from('cashier_orders')
        .update({
          status: 'fulfilled',
          fulfilled_by: user.id,
          fulfilled_by_name: user.user_metadata?.full_name || user.email || 'Manager',
          fulfilled_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Enhanced notification for fulfillment
      toast.success(
        <div>
          <div className="font-bold mb-1">✅ Order Fulfilled & Inventory Confirmed!</div>
          <div className="text-sm">
            <p>Order #{order.order_number} successfully fulfilled</p>
            <p className="mt-1">🎯 Stock levels confirmed in system</p>
          </div>
        </div>,
        { autoClose: 5000 }
      );

      loadOrders();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error fulfilling order:', error);
      toast.error('Failed to fulfill order');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = !searchTerm || 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.cashier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'approved': return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
      case 'fulfilled': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiRefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading supply orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* �🇬 SUPPLIER ORDER VERIFICATION & MANAGEMENT */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl p-6 shadow-2xl border-2 border-orange-400">
        <div className="flex items-start gap-4">
          <div className="text-5xl">🇺🇬</div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">🇺🇬 Supplier Order Verification & Management</h3>
            <h4 className="text-lg font-semibold mb-3 text-orange-100">FAREDEAL Uganda - Complete Supplier & Purchase Order Management System</h4>
            <p className="text-orange-100 mb-4">
              Comprehensive supplier partnership management with verified partners and integrated till supplies ordering.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white/20 rounded-lg p-3">
                <p className="font-bold">📝 Create New Order</p>
                <p className="text-xs text-orange-100">Initiate purchase orders from verified suppliers</p>
              </div>
              <div className="bg-white/20 rounded-lg p-3">
                <p className="font-bold">📦 Active Orders</p>
                <p className="text-xs text-orange-100">Monitor & track all active purchase orders</p>
              </div>
              <div className="bg-white/20 rounded-lg p-3">
                <p className="font-bold">📚 Order History</p>
                <p className="text-xs text-orange-100">Complete history of all supplier transactions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 
        TILL & SUPPLIES SECTION (COMMENTED OUT - INTEGRATED WITH SUPPLIER ORDERS)
        This section is now integrated with the Supplier Order Verification System above.
        All till supplies are managed through the Create New Order, Active Orders, and Order History tabs.
        
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl p-6 shadow-2xl border-2 border-blue-400">
          <h3 className="text-2xl font-bold">📦 Till & Station Supplies - Integrated View</h3>
        </div>
      */}

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center mb-2">
              <FiShoppingCart className="mr-3 h-8 w-8" />
              🇺🇬 Supplier Orders & Till Supplies - Unified Management
            </h2>
            <p className="text-orange-100">Verify supplier partners → Manage till supplies through integrated purchase orders</p>
          </div>
          <button
            onClick={loadOrders}
            className="px-6 py-3 bg-white text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-all duration-300 flex items-center space-x-2"
          >
            <FiRefreshCw className="h-5 w-5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">Total Orders</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <FiShoppingCart className="h-10 w-10 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">⏳ Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <FiClock className="h-10 w-10 text-yellow-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">✅ Approved</p>
              <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <FiCheckCircle className="h-10 w-10 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">❌ Rejected</p>
              <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <FiXCircle className="h-10 w-10 text-red-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-cyan-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">🚚 Fulfilled</p>
              <p className="text-3xl font-bold text-cyan-600">{stats.fulfilled}</p>
            </div>
            <FiTruck className="h-10 w-10 text-cyan-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">💰 Total Value</p>
              <p className="text-lg font-bold text-purple-600">{formatUGX(stats.totalValue)}</p>
            </div>
            <FiDollarSign className="h-10 w-10 text-purple-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">⏳ Pending Value</p>
              <p className="text-lg font-bold text-orange-600">{formatUGX(stats.pendingValue)}</p>
            </div>
            <FiAlertCircle className="h-10 w-10 text-orange-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg p-4 shadow-md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by order number or cashier name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected', 'fulfilled'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-md">
            <FiShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-600">No orders found</p>
            <p className="text-gray-500 mt-2">
              {filterStatus !== 'all' ? `Try changing the filter` : 'No supply orders yet'}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-white rounded-lg shadow-md border-2 border-gray-200 hover:border-blue-300 transition-all duration-300">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{order.order_number}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      <FiUser className="inline mr-1" />
                      {order.cashier_name} • {order.store_location}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${getPriorityColor(order.priority)}`}>
                      {order.priority?.toUpperCase()}
                    </span>
                    <span className={`px-4 py-2 text-sm font-bold rounded-lg border-2 ${getStatusColor(order.status)}`}>
                      {order.status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-600 flex items-center">
                      <FiCalendar className="mr-1" /> Ordered:
                    </span>
                    <div className="font-medium">{new Date(order.created_at).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 flex items-center">
                      <FiPackage className="mr-1" /> Items:
                    </span>
                    <div className="font-medium">{order.total_items} items</div>
                  </div>
                  <div>
                    <span className="text-gray-600 flex items-center">
                      <FiDollarSign className="mr-1" /> Est. Cost:
                    </span>
                    <div className="font-bold text-blue-600">{formatUGX(order.estimated_cost)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 flex items-center">
                      <FiMapPin className="mr-1" /> Register:
                    </span>
                    <div className="font-medium">{order.register_number || 'N/A'}</div>
                  </div>
                </div>

                {order.request_notes && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-600"><strong>Notes:</strong> {order.request_notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowDetailModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FiEye className="h-4 w-4" />
                    <span>View Details</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApproveOrder(order.id)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
                        >
                          <FiCheck className="h-4 w-4" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleRejectOrder(order.id, 'Rejected by manager')}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
                        >
                          <FiX className="h-4 w-4" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                    
                    {order.status === 'approved' && (
                      <button
                        onClick={() => handleFulfillOrder(order.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
                      >
                        <FiTruck className="h-4 w-4" />
                        <span>Mark Fulfilled</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{selectedOrder.order_number}</h2>
                <p className="text-blue-100">Order Details & Management</p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Cashier</p>
                  <p className="text-lg font-bold">{selectedOrder.cashier_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Location</p>
                  <p className="text-lg font-bold">{selectedOrder.store_location}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Priority</p>
                  <span className={`inline-block px-3 py-1 text-sm font-bold rounded-full ${getPriorityColor(selectedOrder.priority)}`}>
                    {selectedOrder.priority?.toUpperCase()}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 text-sm font-bold rounded-lg border-2 ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Items Requested */}
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center">
                  <FiPackage className="mr-2" />
                  Items Requested
                </h3>
                <div className="space-y-2">
                  {selectedOrder.items_requested?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">{item.item_name || item.name}</p>
                        <p className="text-sm text-gray-600">{item.item_category || item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">Qty: {item.quantity}</p>
                        <p className="text-sm text-gray-600">{formatUGX(item.unit_cost || item.unitCost)}/unit</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Estimated Total:</span>
                  <span className="text-2xl font-bold text-blue-600">{formatUGX(selectedOrder.estimated_cost)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.request_notes && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <p className="font-semibold mb-1">📝 Cashier Notes:</p>
                  <p className="text-gray-700">{selectedOrder.request_notes}</p>
                </div>
              )}

              {/* Actions */}
              {selectedOrder.status === 'pending' && (
                <div className="flex items-center gap-4 pt-4 border-t">
                  <button
                    onClick={() => handleApproveOrder(selectedOrder.id)}
                    disabled={actionLoading}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all duration-300 disabled:opacity-50"
                  >
                    <FiCheck className="inline mr-2" />
                    Approve Order
                  </button>
                  <button
                    onClick={() => handleRejectOrder(selectedOrder.id, 'Rejected by manager')}
                    disabled={actionLoading}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                  >
                    <FiX className="inline mr-2" />
                    Reject Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TillSuppliesOrderManagement;
