// =====================================================================
// SUPPLIER ORDER MANAGEMENT COMPONENT - FAREDEAL UGANDA 🇺🇬
// =====================================================================
// Comprehensive supplier order verification and management for managers
// Features: Create PO, Approve/Reject, Send to Supplier, Track Deliveries
// Real-time Supabase integration - NO MOCK DATA
// =====================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiTruck, FiCheckCircle, FiXCircle, FiSend, FiEdit, FiPlus,
  FiPackage, FiDollarSign, FiClock, FiAlertTriangle, FiSearch,
  FiDownload, FiMail, FiPhone, FiMapPin, FiCalendar, FiUser, FiChevronDown,
  FiX, FiCheck
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import supplierOrdersService from '../services/supplierOrdersService';
import { supabase } from '../services/supabase';
import OrderPaymentTracker from './OrderPaymentTracker';
import OrderItemsSelector from './OrderItemsSelector';

const SupplierOrderManagement = ({ onPosUpdated }) => {
  // State Management
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState({});
  const [products, setProducts] = useState([]); // Products in POS inventory

  /**
   * Get current manager ID from localStorage (custom authentication)
   */
  const getManagerId = () => {
    const storedUser = localStorage.getItem('supermarket_user');
    if (!storedUser) {
      console.warn('⚠️ No user session in localStorage');
      return null;
    }
    
    try {
      const parsedUser = JSON.parse(storedUser);
      return parsedUser.id;
    } catch (e) {
      console.error('Error parsing stored user:', e);
      return null;
    }
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false); // NEW: Approval with payment modal
  const [approvalOrderId, setApprovalOrderId] = useState(null); // NEW: Order being approved
  const [showAddProductModal, setShowAddProductModal] = useState(false); // 🆕 Add Product modal state
  const [selectedOrderForProduct, setSelectedOrderForProduct] = useState(null); // 🆕 Track which order we're adding product to
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'history'
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'payment'
  
  // NEW: Approval form state
  const [approvalData, setApprovalData] = useState({
    initialPayment: 0,
    cashPaidNow: 0, // NEW: Cash paid at approval time
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().split('T')[0], // Today's date
    nextPaymentDate: '',
    adjustedTotal: null, // For balance adjustments
    adjustmentReason: '',
    notes: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadAllData();
    loadProducts();
  }, [statusFilter, priorityFilter, paymentFilter, viewMode]);

  // Real-time subscription to products
  useEffect(() => {
    const subscription = supabase
      .channel('products_manager_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('🔄 Manager Portal - Real-time product update:', payload);
          loadProducts(); // Refresh products list
        }
      )
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  /**
   * Load products from Supabase
   */
  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          selling_price,
          cost_price,
          barcode,
          sku,
          category_id,
          inventory (
            id,
            current_stock,
            minimum_stock
          )
        `);

      if (error) throw error;

      setProducts(data || []);
      console.log('✅ Manager Portal - Products loaded:', data?.length);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  /**
   * Load all supplier order data from Supabase
   */
  const loadAllData = async () => {
    setLoading(true);
    try {
      let ordersResponse;
      
      // Load based on view mode
      if (viewMode === 'history') {
        ordersResponse = await supplierOrdersService.getOrderHistory({
          status: statusFilter === 'all' ? null : statusFilter,
          priority: priorityFilter === 'all' ? null : priorityFilter
        });
      } else if (paymentFilter !== 'all') {
        ordersResponse = await supplierOrdersService.getOrdersByPaymentStatus(paymentFilter);
      } else {
        ordersResponse = await supplierOrdersService.getAllPurchaseOrders({
          status: statusFilter === 'all' ? null : statusFilter,
          priority: priorityFilter === 'all' ? null : priorityFilter
        });
      }

      const [suppliersResponse, statsResponse] = await Promise.all([
        supplierOrdersService.getActiveSuppliers(),
        supplierOrdersService.getSupplierOrderStats()
      ]);

      if (ordersResponse.success) {
        // OPTIMIZED: Fetch all unconfirmed payments in single query instead of N+1
        const orderIds = ordersResponse.orders.map(o => o.id);
        
        let unconfirmedMap = {};
        if (orderIds.length > 0) {
          try {
            const { data, error } = await supabase
              .from('payment_transactions')
              .select('purchase_order_id', { count: 'exact', head: false })
              .in('purchase_order_id', orderIds)
              .eq('confirmed_by_supplier', false);
            
            // Group counts by order ID
            if (!error && data) {
              unconfirmedMap = data.reduce((acc, item) => {
                acc[item.purchase_order_id] = (acc[item.purchase_order_id] || 0) + 1;
                return acc;
              }, {});
            }
          } catch (err) {
            console.error('Error fetching unconfirmed payments in batch:', err);
          }
        }
        
        // Add unconfirmed counts to orders
        const ordersWithUnconfirmed = ordersResponse.orders.map(order => ({
          ...order,
          unconfirmedPaymentsCount: unconfirmedMap[order.id] || 0
        }));
        
        setOrders(ordersWithUnconfirmed);
      } else {
        setError(ordersResponse.error);
      }

      if (suppliersResponse.success) {
        setSuppliers(suppliersResponse.suppliers);
      }

      if (statsResponse.success) {
        setStats(statsResponse.stats);
      }

    } catch (err) {
      console.error('Error loading supplier data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle order approval - Opens modal for payment details
   */
  const handleApproveOrder = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    setApprovalOrderId(orderId);
    setSelectedOrder(order);
    setApprovalData({
      initialPayment: 0,
      paymentMethod: 'cash',
      notes: ''
    });
    setShowApprovalModal(true);
  };
  
  /**
   * Submit order approval with payment
   */
  const submitOrderApproval = async () => {
    try {
      const managerId = await getManagerId();
      if (!managerId) {
        alert('❌ Error: User not authenticated. Please log in again.');
        return;
      }

      const selectedOrderData = orders.find(o => o.id === approvalOrderId);
      
      // Step 1: If balance was adjusted, apply the adjustment first
      if (approvalData.adjustedTotal && approvalData.adjustedTotal !== selectedOrderData.total_amount_ugx) {
        const { data: adjustData, error: adjustError } = await supabase.rpc('adjust_order_balance', {
          p_order_id: approvalOrderId,
          p_new_total_amount: parseFloat(approvalData.adjustedTotal),
          p_adjustment_reason: approvalData.adjustmentReason || 'Manager adjustment',
          p_adjusted_by: managerId,
          p_requires_supplier_acceptance: true
        });

        if (adjustError) {
          console.error('❌ Error adjusting balance:', adjustError);
          alert(`❌ Error: ${adjustError.message}`);
          return;
        }

        if (adjustData && !adjustData.success) {
          alert(`❌ Error: ${adjustData.error}`);
          return;
        }

        console.log('� Balance adjusted:', adjustData);
      }
      
      // Step 2: Approve order with payment details
      console.log('�📝 Approving order with payment:', {
        orderId: approvalOrderId,
        managerId,
        ...approvalData
      });
      
      const { data, error } = await supabase.rpc('approve_order_with_payment', {
        p_order_id: approvalOrderId,
        p_approved_by: managerId,
        p_initial_payment: parseFloat(approvalData.initialPayment) || 0,
        p_payment_method: approvalData.paymentMethod,
        p_payment_date: approvalData.paymentDate ? new Date(approvalData.paymentDate).toISOString() : new Date().toISOString(),
        p_next_payment_date: approvalData.nextPaymentDate || null,
        p_notes: approvalData.notes
      });

      if (error) {
        console.error('❌ Error approving order:', error);
        alert(`❌ Error: ${error.message}`);
        return;
      }
      
      if (data && !data.success) {
        alert(`❌ Error: ${data.error}`);
        return;
      }

      // Step 3: Record cash payment with tracking if cash was paid now
      let cashPaymentResult = null;
      if (approvalData.cashPaidNow && parseFloat(approvalData.cashPaidNow) > 0) {
        const { data: cashData, error: cashError } = await supabase.rpc('record_payment_with_tracking', {
          p_order_id: approvalOrderId,
          p_amount_paid: parseFloat(approvalData.cashPaidNow),
          p_payment_method: 'cash',
          p_payment_reference: `CASH-APPROVAL-${approvalOrderId.substring(0, 8)}`,
          p_notes: `Cash payment made during order approval. ${approvalData.notes || ''}`,
          p_paid_by: managerId
        });

        if (cashError) {
          console.error('⚠️ Warning: Cash payment recorded but tracking failed:', cashError);
          alert(`⚠️ Order approved but cash tracking issue: ${cashError.message}`);
        } else {
          cashPaymentResult = cashData;
          console.log('💵 Cash payment recorded with tracking:', cashData);
        }
      }

      // Show success message with payment details
      let successMsg = '✅ Purchase order approved successfully!\n\n';
      
      // Show cash payment info if recorded
      if (cashPaymentResult) {
        successMsg += `💵 CASH PAID NOW: UGX ${parseFloat(approvalData.cashPaidNow).toLocaleString()}\n`;
        successMsg += `🔖 Transaction #: ${cashPaymentResult.transaction_number}\n`;
        successMsg += `⏳ Status: Awaiting supplier confirmation\n\n`;
      }
      
      if (data.balance_due > 0) {
        successMsg += `💰 Initial Payment: UGX ${approvalData.initialPayment.toLocaleString()}\n`;
        successMsg += `📊 Balance Remaining: UGX ${data.balance_due.toLocaleString()}\n`;
        if (approvalData.nextPaymentDate) {
          successMsg += `📅 Next Payment: ${approvalData.nextPaymentDate}`;
        }
      } else if (approvalData.initialPayment > 0) {
        successMsg += '💚 FULLY PAID!';
      }

      alert(successMsg);
      setShowApprovalModal(false);
      setApprovalData({
        initialPayment: 0,
        cashPaidNow: 0,
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().split('T')[0],
        nextPaymentDate: '',
        adjustedTotal: null,
        adjustmentReason: '',
        notes: ''
      });
      loadAllData(); // Reload data
    } catch (err) {
      console.error('Error approving order:', err);
      alert('Failed to approve order');
    }
  };

  /**
   * Handle order rejection
   */
  const handleRejectOrder = async (orderId) => {
    const reason = prompt('Enter reason for rejection:');
    if (!reason) return;

    try {
      const managerId = await getManagerId();
      if (!managerId) {
        alert('❌ Error: User not authenticated. Please log in again.');
        return;
      }
      
      const response = await supplierOrdersService.rejectPurchaseOrder(orderId, reason, managerId);

      if (response.success) {
        alert('❌ Purchase order rejected');
        loadAllData();
      } else {
        alert(`Error: ${response.error}`);
      }
    } catch (err) {
      console.error('Error rejecting order:', err);
      alert('Failed to reject order');
    }
  };

  /**
   * Handle send to supplier
   */
  const handleSendToSupplier = async (orderId) => {
    if (!confirm('Send this order to the supplier?')) return;

    try {
      const managerId = await getManagerId();
      if (!managerId) {
        alert('❌ Error: User not authenticated. Please log in again.');
        return;
      }
      
      const response = await supplierOrdersService.sendOrderToSupplier(orderId, managerId);

      if (response.success) {
        alert(`📧 Order sent to ${response.order.supplier?.business_name}`);
        loadAllData();
      } else {
        alert(`Error: ${response.error}`);
      }
    } catch (err) {
      console.error('Error sending order:', err);
      alert('Failed to send order');
    }
  };

  /**
   * Handle mark order as received/delivered - Updates inventory automatically
   */
  const handleMarkAsReceived = async (orderId) => {
    if (!confirm('Mark this order as RECEIVED and update inventory?\n\n✅ This will automatically:\n• Add received quantities to inventory\n• Update stock levels\n• Log inventory movements')) {
      return;
    }

    try {
      setLoading(true);

      // Step 1: Update order status to 'received'
      const { error: statusError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received',
          actual_delivery_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (statusError) {
        console.error('❌ Error updating order status:', statusError);
        alert(`❌ Error: ${statusError.message}`);
        return;
      }

      // Step 2: Call inventory update function (trigger will auto-run, but we'll call manually for confirmation)
      const { data: inventoryResult, error: inventoryError } = await supabase
        .rpc('update_inventory_on_delivery', {
          p_order_id: orderId
        });

      if (inventoryError) {
        console.error('❌ Error updating inventory:', inventoryError);
        alert(`⚠️ Order marked as received, but inventory update failed:\n${inventoryError.message}\n\nPlease contact IT support.`);
        loadAllData();
        return;
      }

      if (inventoryResult && inventoryResult.length > 0) {
        const result = inventoryResult[0];
        if (result.success) {
          // Build success message with product details
          let successMsg = `✅ ORDER RECEIVED & INVENTORY UPDATED!\n\n`;
          successMsg += `${result.message}\n\n`;
          successMsg += `📦 Products Updated:\n`;
          
          const products = result.updated_products;
          if (Array.isArray(products)) {
            products.forEach(product => {
              successMsg += `\n• ${product.product_name} (${product.sku})\n`;
              successMsg += `  Received: ${product.quantity_received} units\n`;
              successMsg += `  Stock: ${product.previous_stock} → ${product.new_stock}\n`;
            });
          }

          alert(successMsg);
        } else {
          alert(`⚠️ ${result.message}`);
        }
      } else {
        alert('✅ Order marked as received!\n\nInventory will be updated automatically by the system.');
      }

      loadAllData();
    } catch (err) {
      console.error('Error marking order as received:', err);
      alert('Failed to mark order as received');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle adding order products to POS inventory
   */
  const handleAddOrderProductsToPOS = async (order) => {
    console.log('📦 handleAddOrderProductsToPOS called with order:', order);
    console.log('Order items:', order.items);
    
    // Check if order already added to POS
    if (order.added_to_pos) {
      toast.warning('⚠️ This order has already been added to POS');
      return;
    }
    
    if (!order.items || order.items.length === 0) {
      alert('❌ No products in this order to add to POS');
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      let failedCount = 0;
      const results = [];

      // Add each product from the order to POS
      for (const item of order.items) {
        try {
          // Get product name - check all possible field names
          const productName = item.product_name || item.productName || item.name;
          const quantity = item.quantity || 0;
          const unitPrice = item.unit_price || item.unitPrice || 0;
          
          console.log(`🛒 Processing item:`, { productName, quantity, unitPrice, item });
          
          if (!productName) {
            console.warn('⚠️ No product name found in item:', item);
            failedCount++;
            results.push({
              name: 'Unknown',
              action: 'failed',
              error: 'No product name in order item'
            });
            continue;
          }

          // Try to find existing product - use exact match on name
          const { data: existingProducts, error: searchError } = await supabase
            .from('products')
            .select(`
              id,
              name,
              inventory (
                id,
                current_stock,
                minimum_stock
              )
            `)
            .eq('name', productName);

          console.log(`🔍 Search result for "${productName}":`, { existingProducts, searchError });

          if (searchError) {
            throw searchError;
          }

          if (existingProducts && existingProducts.length > 0) {
            // Product exists - update stock in inventory table
            const existingProduct = existingProducts[0];
            const inventoryRecord = existingProduct.inventory?.[0];
            let newStock = 0;
            
            if (!inventoryRecord) {
              console.warn(`⚠️ No inventory record for ${productName}, creating one`);
              // Create inventory record if it doesn't exist
              newStock = quantity;
              const { error: invError } = await supabase
                .from('inventory')
                .upsert({
                  product_id: existingProduct.id,
                  current_stock: quantity,
                  minimum_stock: 10
                }, { onConflict: 'product_id' });
              if (invError) throw invError;
            } else {
              newStock = (inventoryRecord.current_stock || 0) + quantity;
              
              console.log(`✅ Updating existing product "${productName}": stock ${inventoryRecord.current_stock} -> ${newStock}`);

              const { error: updateError } = await supabase
                .from('inventory')
                .update({
                  current_stock: newStock
                })
                .eq('id', inventoryRecord.id);

              if (updateError) throw updateError;
            }

            results.push({
              name: productName,
              action: 'updated',
              quantity: quantity,
              newStock: newStock
            });
            successCount++;
          } else {
            // Create new product in POS
            console.log(`🆕 Creating new product in POS: "${productName}" x ${quantity} @ ${unitPrice}`);

            const { data: newProduct, error: insertError } = await supabase
              .from('products')
              .insert({
                name: productName,
                price: unitPrice,
                selling_price: unitPrice,
                cost_price: unitPrice,
                description: `Added from supplier order ${order.po_number}`,
                barcode: `AUTO-${Date.now()}`,
                markup_percentage: 0
              })
              .select('id');

            if (insertError) throw insertError;

            // Create inventory record
            if (newProduct && newProduct.length > 0) {
              const { error: invError } = await supabase
                .from('inventory')
                .upsert({
                  product_id: newProduct[0].id,
                  current_stock: quantity,
                  minimum_stock: 10
                }, { onConflict: 'product_id' });

              if (invError) throw invError;
            }

            results.push({
              name: productName,
              action: 'created',
              quantity: quantity
            });
            successCount++;
          }
        } catch (itemErr) {
          console.error(`❌ Error adding ${item.product_name || item.productName}:`, itemErr);
          failedCount++;
          results.push({
            name: item.product_name || item.productName || 'Unknown',
            action: 'failed',
            error: itemErr.message
          });
        }
      }

      // Show summary
      let message = `✅ POS Inventory Updated!\n\n`;
      message += `Order: ${order.po_number}\n`;
      message += `Successfully added/updated: ${successCount}/${order.items.length} products\n\n`;
      
      results.forEach(r => {
        if (r.action === 'updated') {
          message += `✅ ${r.name} - Updated (+ ${r.quantity} units, new stock: ${r.newStock})\n`;
        } else if (r.action === 'created') {
          message += `🆕 ${r.name} - Created (${r.quantity} units)\n`;
        } else if (r.action === 'failed') {
          message += `❌ ${r.name} - Failed: ${r.error}\n`;
        }
      });

      if (failedCount > 0) {
        message += `\n⚠️ ${failedCount} product(s) failed to add.`;
      }

      toast.success(message, {
        autoClose: 5000
      });

      // Mark order as added to POS to prevent duplicate additions
      if (successCount > 0) {
        try {
          await supabase
            .from('supplier_orders')
            .update({ added_to_pos: true })
            .eq('id', order.id);
          console.log('✅ Order marked as added_to_pos');
        } catch (err) {
          console.warn('Could not update order added_to_pos flag:', err);
        }
      }

      // OPTIMIZED: Only refresh the current orders list, don't reload everything
      // Update the order in the orders array instead of reloading all data
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id 
            ? { ...o, added_to_pos: true }
            : o
        )
      );
      
      // TRIGGER POS REFRESH with added products data (for parent components to update POS inventory)
      if (onPosUpdated && typeof onPosUpdated === 'function') {
        // Pass the successfully added products so parent can update state immediately
        const addedProducts = results.filter(r => r.action === 'created' || r.action === 'updated').map(r => ({
          name: r.name,
          quantity: r.quantity,
          newStock: r.newStock
        }));
        onPosUpdated(addedProducts);
      }
      
      console.log('✅ Orders list updated without full reload');
    } catch (err) {
      console.error('Error adding products to POS:', err);
      toast.error(`❌ Failed to add products to POS: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle mark order as completed
   */
  const handleMarkAsCompleted = async (orderId) => {
    if (!confirm('Mark this order as RECEIVED?')) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('❌ Error completing order:', error);
        alert(`❌ Error: ${error.message}`);
        return;
      }

      alert('✅ Order marked as received!');
      loadAllData();
    } catch (err) {
      console.error('Error completing order:', err);
      alert('Failed to complete order');
    }
  };

  /**
   * Format currency to UGX
   */
  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  /**
   * Get status color
   */
  const getStatusColor = (status) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-800 border-gray-300',
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'approved': 'bg-green-100 text-green-800 border-green-300',
      'ordered': 'bg-blue-100 text-blue-800 border-blue-300',
      'partially_received': 'bg-purple-100 text-purple-800 border-purple-300',
      'received': 'bg-teal-100 text-teal-800 border-teal-300',
      'cancelled': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  /**
   * Get priority color
   */
  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'bg-gray-100 text-gray-600',
      'normal': 'bg-blue-100 text-blue-600',
      'high': 'bg-orange-100 text-orange-600',
      'urgent': 'bg-red-100 text-red-600'
    };
    return colors[priority] || 'bg-gray-100 text-gray-600';
  };

  /**
   * Get payment status color
   */
  const getPaymentStatusColor = (paymentStatus) => {
    const colors = {
      'paid': 'bg-green-100 text-green-800 border-green-300',
      'unpaid': 'bg-red-100 text-red-800 border-red-300',
      'partially_paid': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'overdue': 'bg-orange-100 text-orange-800 border-orange-300',
      'disputed': 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return colors[paymentStatus] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  /**
   * Get payment status label
   */
  const getPaymentStatusLabel = (paymentStatus) => {
    const labels = {
      'paid': '✅ PAID',
      'unpaid': '❌ UNPAID',
      'partially_paid': '⚠️ HALF PAID',
      'overdue': '🔴 OVERDUE',
      'disputed': '⚡ DISPUTED'
    };
    return labels[paymentStatus] || paymentStatus?.toUpperCase();
  };

  /**
   * Filter orders based on search term
   */
  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.po_number?.toLowerCase().includes(searchLower) ||
      order.supplierName?.toLowerCase().includes(searchLower) ||
      order.orderedBy?.toLowerCase().includes(searchLower)
    );
  });

  /**
   * Calculate real-time statistics from current orders
   */
  const realTimeStats = useMemo(() => {
    const allOrders = orders; // Use all orders, not just filtered ones
    
    const totalOrders = allOrders.length;
    const totalValue = allOrders.reduce((sum, order) => sum + (parseFloat(order.total_amount_ugx) || 0), 0);
    
    // Count by status
    const pendingOrders = allOrders.filter(o => 
      o.status === 'pending_approval' || o.status === 'pending'
    ).length;
    
    const completedOrders = allOrders.filter(o => 
      o.status === 'completed' || o.status === 'received'
    ).length;
    
    // Count and calculate by payment status
    const paidOrders = allOrders.filter(o => o.payment_status === 'paid').length;
    const partiallyPaidOrders = allOrders.filter(o => o.payment_status === 'partially_paid').length;
    const unpaidOrders = allOrders.filter(o => 
      o.payment_status === 'unpaid' || !o.payment_status
    ).length;
    
    // Calculate payment amounts
    const totalPaidAmount = allOrders.reduce((sum, order) => {
      if (order.payment_status === 'paid') {
        return sum + (parseFloat(order.total_amount_ugx) || 0);
      } else if (order.payment_status === 'partially_paid') {
        return sum + (parseFloat(order.amount_paid_ugx) || 0);
      }
      return sum;
    }, 0);
    
    const totalOutstanding = allOrders.reduce((sum, order) => {
      if (order.payment_status === 'unpaid' || !order.payment_status) {
        return sum + (parseFloat(order.total_amount_ugx) || 0);
      } else if (order.payment_status === 'partially_paid') {
        return sum + (parseFloat(order.balance_due_ugx) || 0);
      }
      return sum;
    }, 0);
    
    return {
      totalOrders,
      totalValue,
      pendingOrders,
      completedOrders,
      paidOrders,
      partiallyPaidOrders,
      unpaidOrders,
      totalPaidAmount,
      totalOutstanding
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading supplier orders from Supabase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <FiAlertTriangle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-red-800 font-semibold">Error Loading Data</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadAllData}
              className="mt-2 text-sm text-red-700 underline hover:text-red-900"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-yellow-500 via-red-600 to-black rounded-xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center mb-2">
              <FiTruck className="mr-3 h-8 w-8" />
              🇺🇬 Supplier Order Verification & Management
            </h2>
            <p className="text-yellow-100 text-lg">
              FAREDEAL Uganda - Complete Supplier & Purchase Order Management System
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-100 transition-all duration-300 flex items-center space-x-2 shadow-lg"
          >
            <FiPlus className="h-5 w-5" />
            <span>Create New Order</span>
          </button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-center space-x-4 mb-4">
        <button
          onClick={() => setViewMode('active')}
          className={`px-8 py-3 rounded-lg font-bold transition-all duration-300 ${
            viewMode === 'active'
              ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📦 Active Orders
        </button>
        <button
          onClick={() => setViewMode('history')}
          className={`px-8 py-3 rounded-lg font-bold transition-all duration-300 ${
            viewMode === 'history'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📚 Order History
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Orders */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-blue-600">Total Orders</h3>
            <FiPackage className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-800">{realTimeStats.totalOrders || 0}</p>
          <p className="text-xs text-blue-600 mt-1">{formatUGX(realTimeStats.totalValue)}</p>
        </div>

        {/* Pending Approval */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border-2 border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-yellow-600">Pending</h3>
            <FiClock className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-800">{realTimeStats.pendingOrders || 0}</p>
          <p className="text-xs text-yellow-600 mt-1">Awaiting action</p>
        </div>

        {/* Completed Orders */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-green-600">Completed</h3>
            <FiCheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-800">{realTimeStats.completedOrders || 0}</p>
          <p className="text-xs text-green-600 mt-1">Delivered</p>
        </div>

        {/* Paid Orders */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border-2 border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-emerald-600">✅ Paid</h3>
            <FiDollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-800">{realTimeStats.paidOrders || 0}</p>
          <p className="text-xs text-emerald-600 mt-1">{formatUGX(realTimeStats.totalPaidAmount)}</p>
        </div>

        {/* Half Paid Orders */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-orange-600">⚠️ Half Paid</h3>
            <FiDollarSign className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-800">{realTimeStats.partiallyPaidOrders || 0}</p>
          <p className="text-xs text-orange-600 mt-1">Partial payments</p>
        </div>

        {/* Unpaid Orders */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-2 border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-red-600">❌ Unpaid</h3>
            <FiAlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-800">{realTimeStats.unpaidOrders || 0}</p>
          <p className="text-xs text-red-600 mt-1">{formatUGX(realTimeStats.totalOutstanding)}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search by PO number, supplier, or ordered by..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-semibold text-gray-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="sent_to_supplier">Sent to Supplier</option>
                <option value="confirmed">Confirmed</option>
                <option value="received">Received</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-semibold text-gray-700">Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">🔥 Urgent</option>
                <option value="high">⚠️ High</option>
                <option value="normal">📋 Normal</option>
                <option value="low">📝 Low</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-semibold text-gray-700">Payment:</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Payments</option>
                <option value="paid">✅ Paid</option>
                <option value="partially_paid">⚠️ Half Paid</option>
                <option value="unpaid">❌ Unpaid</option>
                <option value="overdue">🔴 Overdue</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(statusFilter !== 'all' || priorityFilter !== 'all' || paymentFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setPaymentFilter('all');
                  setSearchTerm('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-300 font-semibold"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center">
            <FiPackage className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Orders Found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters or search term'
                : 'Create your first purchase order to get started'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-xl shadow-lg border-2 hover:shadow-xl transition-all duration-300 overflow-hidden ${
                order.status === 'pending_approval' ? 'border-yellow-300' :
                order.status === 'approved' ? 'border-green-300' :
                order.status === 'cancelled' ? 'border-red-300' :
                'border-gray-200'
              }`}
            >
              {/* Collapsed View - Order Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
              >
                <div className="flex items-center justify-between">
                  {/* Left Section */}
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <FiPackage className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-gray-900">{order.po_number}</h3>
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                          {order.status?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {/* Priority Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPriorityColor(order.priority)}`}>
                          {order.priority === 'urgent' && '🔥 '}
                          {order.priority === 'high' && '⚠️ '}
                          {order.priority?.toUpperCase()}
                        </span>
                        {/* Payment Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border-2 ${getPaymentStatusColor(order.payment_status)}`}>
                          {getPaymentStatusLabel(order.payment_status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {order.supplierName} • {new Date(order.order_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Right Section */}
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">{formatUGX(order.total_amount_ugx)}</p>
                      {order.payment_status === 'partially_paid' && (
                        <p className="text-xs text-gray-600">
                          Paid: <span className="text-green-600 font-semibold">{formatUGX(order.amount_paid_ugx || 0)}</span>
                        </p>
                      )}
                    </div>
                    {/* Expand/Collapse Icon */}
                    <div className={`transform transition-transform ${expandedOrderId === order.id ? 'rotate-180' : ''}`}>
                      <FiChevronDown className="h-5 w-5 text-gray-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded View - Order Details */}
              {expandedOrderId === order.id && (
                <div className="border-t-2 border-gray-200 p-6 bg-white animate-fadeInUp">
                  {/* Supplier Info */}
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-blue-600 mb-2 flex items-center gap-2">
                      {order.supplierAvatar && (
                        <img 
                          src={order.supplierAvatar} 
                          alt={order.supplierName}
                          className="w-8 h-8 rounded-full border-2 border-blue-300"
                        />
                      )}
                      <span>{order.supplierName}</span>
                      {order.supplierCategory && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          {order.supplierCategory}
                        </span>
                      )}
                    </h4>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FiCalendar className="text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Order Date</p>
                        <p className="font-semibold text-gray-900">{new Date(order.order_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FiClock className="text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Expected Delivery</p>
                        <p className="font-semibold text-gray-900">
                          {order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'TBD'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FiUser className="text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Ordered By</p>
                        <p className="font-semibold text-gray-900">{order.orderedBy}</p>
                      </div>
                    </div>
                  </div>

                  {/* 💰 PAYMENT TRACKER - Interactive Payment Management */}
                  {/* Show payment tracker for all orders that are approved or beyond, allowing managers to add payments anytime */}
                  {(order.status === 'approved' || 
                    order.status === 'sent_to_supplier' || 
                    order.status === 'confirmed' || 
                    order.status === 'received' || 
                    order.status === 'received') && (
                    <div className="mb-4">
                      <OrderPaymentTracker
                        order={order}
                        onPaymentAdded={loadAllData}
                        showAddPayment={true}
                        userRole="manager"
                      />
                    </div>
                  )}

                  {/* Items Summary */}
                  {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Order Items ({order.items.length})</h5>
                      <div className="space-y-1">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              {item.product_name || item.productName} × {item.quantity}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {formatUGX((item.unit_price || item.unitPrice) * item.quantity)}
                            </span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <p className="text-sm text-blue-600 font-semibold">
                            +{order.items.length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {order.notes && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-700"><strong>Notes:</strong> {order.notes}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center flex-wrap gap-3 pt-4 border-t border-gray-200">
                    {/* ❌ COMMENTED OUT: Approve/Reject buttons disabled
                    {order.status === 'pending_approval' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveOrder(order.id);
                          }}
                          className="flex-1 min-w-[180px] bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-all duration-300 flex items-center justify-center space-x-2 font-semibold shadow-lg"
                        >
                          <FiCheckCircle className="h-5 w-5" />
                          <span>Approve Order</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectOrder(order.id);
                          }}
                          className="flex-1 min-w-[180px] bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-all duration-300 flex items-center justify-center space-x-2 font-semibold shadow-lg"
                        >
                          <FiXCircle className="h-5 w-5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                    */}
                    
                    {order.status === 'approved' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendToSupplier(order.id);
                        }}
                        className="flex-1 min-w-[180px] bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center space-x-2 font-semibold shadow-lg"
                      >
                        <FiSend className="h-5 w-5" />
                        <span>Send to Supplier</span>
                      </button>
                    )}

                    {/* Mark as Received Button - Shows for sent_to_supplier or confirmed orders */}
                    {(order.status === 'sent_to_supplier' || order.status === 'confirmed') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsReceived(order.id);
                        }}
                        className="flex-1 min-w-[180px] bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-3 rounded-lg hover:from-teal-700 hover:to-cyan-700 transition-all duration-300 flex items-center justify-center space-x-2 font-bold shadow-lg"
                      >
                        <FiTruck className="h-5 w-5" />
                        <span>📦 Mark as Received & Update Inventory</span>
                      </button>
                    )}

                    {/* Mark as Completed Button - Shows for received orders */}
                    {order.status === 'received' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsCompleted(order.id);
                        }}
                        className="flex-1 min-w-[180px] bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center space-x-2 font-bold shadow-lg"
                      >
                        <FiCheckCircle className="h-5 w-5" />
                        <span>✅ Mark as Completed</span>
                      </button>
                    )}

                    {/* Add Payment Button - Show for approved orders and beyond (not fully paid) */}
                    {(order.status === 'approved' || 
                      order.status === 'sent_to_supplier' || 
                      order.status === 'confirmed' || 
                      order.status === 'received' || 
                      order.status === 'received') && 
                      order.payment_status !== 'paid' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                          setShowPaymentModal(true);
                        }}
                        className="flex-1 min-w-[180px] bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center justify-center space-x-2 font-bold shadow-lg"
                      >
                        <FiDollarSign className="h-5 w-5" />
                        <span>💰 Add Payment</span>
                      </button>
                    )}

                    {/* 🆕 ADD PRODUCT BUTTON - Add order products to POS inventory */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('✅ Add to POS button clicked for order:', order?.id, order?.po_number);
                        handleAddOrderProductsToPOS(order);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="flex-1 min-w-[180px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800 transition-all duration-300 flex items-center justify-center space-x-2 font-bold shadow-lg cursor-pointer hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      title={order.added_to_pos ? "This order has already been added to POS" : "Add all order products to POS inventory"}
                      disabled={!order.items || order.items.length === 0 || order.added_to_pos}
                    >
                      <FiPlus className="h-5 w-5" />
                      <span>➕ {order.added_to_pos ? 'Added to POS ✓' : 'Add to POS'}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all duration-300 flex items-center space-x-2"
                    >
                      <FiEdit className="h-5 w-5" />
                      <span>View Details</span>
                    </button>

                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-all duration-300 flex items-center space-x-2"
                      title="Download PDF"
                    >
                      <FiDownload className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 🛒 POS INVENTORY SECTION - Products Added to POS */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <span className="mr-2 text-2xl">🛒</span>
          POS Inventory
        </h3>
        <p className="text-gray-600 text-sm mb-4">Products available for sale in POS system</p>
        
        {products && products.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.map((product) => {
              const stock = product.inventory?.[0]?.quantity || 0;
              const stockStatus = stock > 10 ? 'text-green-600' : stock > 0 ? 'text-yellow-600' : 'text-red-600';
              
              return (
                <div key={product.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-400 transition-all hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm break-words">{product.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">SKU: {product.sku || 'N/A'}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${stockStatus} bg-opacity-10`}>
                          📦 {stock} units
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-600">UGX {(product.price || 0).toLocaleString()}</p>
                      <p className={`text-xs font-semibold mt-1 ${stockStatus}`}>
                        {stock > 10 ? '✅ Good' : stock > 0 ? '⚠️ Low' : '❌ Out'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <p className="text-sm">📭 No products in POS inventory</p>
            <p className="text-xs text-gray-400 mt-1">Add from supplier orders to populate</p>
          </div>
        )}
        
        {/* Summary Stats */}
        {products && products.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white rounded p-2">
              <p className="font-bold text-gray-800">{products.length}</p>
              <p className="text-gray-600">Total Products</p>
            </div>
            <div className="bg-white rounded p-2">
              <p className="font-bold text-gray-800">{products.reduce((sum, p) => sum + (p.inventory?.[0]?.quantity || 0), 0)}</p>
              <p className="text-gray-600">Total Stock</p>
            </div>
            <div className="bg-white rounded p-2">
              <p className="font-bold text-green-600">UGX {(products.reduce((sum, p) => sum + (p.price || 0), 0)).toLocaleString()}</p>
              <p className="text-gray-600">Total Value</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <CreateOrderModal
          suppliers={suppliers}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadAllData();
          }}
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrder && !showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4 sm:p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6 rounded-t-2xl sm:rounded-t-xl">
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-4">
                <h2 className="text-lg sm:text-2xl font-bold">Purchase Order Details</h2>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setActiveTab('details');
                  }}
                  className="text-white hover:text-gray-200 text-2xl sm:text-3xl font-bold flex-shrink-0"
                >
                  ×
                </button>
              </div>
              
              {/* Tabs - Mobile Optimized */}
              <div className="flex gap-2 sm:gap-4 border-b border-white/20 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`pb-2 px-3 sm:px-4 font-semibold text-xs sm:text-base transition-all whitespace-nowrap ${
                    activeTab === 'details'
                      ? 'border-b-2 border-white text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  📋 Details
                </button>
                <button
                  onClick={() => setActiveTab('payment')}
                  className={`pb-2 px-3 sm:px-4 font-semibold text-xs sm:text-base transition-all whitespace-nowrap ${
                    activeTab === 'payment'
                      ? 'border-b-2 border-white text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  💰 Payment
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Order Details Tab */}
              {activeTab === 'details' && (
                <>
                  {/* Complete order details would go here */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">PO Number</p>
                      <p className="font-bold text-lg">{selectedOrder.po_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="font-bold text-lg text-green-600">{formatUGX(selectedOrder.total_amount_ugx)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Supplier</p>
                      <p className="font-semibold">{selectedOrder.supplierName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Payment Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border-2 ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                        {getPaymentStatusLabel(selectedOrder.payment_status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Balance Due</p>
                      <p className="font-bold text-lg text-red-600">{formatUGX(selectedOrder.balance_due)}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  {selectedOrder.items && Array.isArray(selectedOrder.items) && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg">Order Items</h3>
                        <button
                          onClick={() => {
                            console.log('Add Product modal clicked for order:', selectedOrder);
                            setSelectedOrderForProduct(selectedOrder);
                            setShowAddProductModal(true);
                          }}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center space-x-2 font-semibold text-sm"
                        >
                          <FiPlus className="h-4 w-4" />
                          <span>Add Product</span>
                        </button>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Product</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold">Quantity</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold">Unit Price</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.items.map((item, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-3">{item.product_name || item.productName}</td>
                                <td className="px-4 py-3 text-center">{item.quantity}</td>
                                <td className="px-4 py-3 text-right">{formatUGX(item.unit_price || item.unitPrice)}</td>
                                <td className="px-4 py-3 text-right font-semibold">
                                  {formatUGX((item.unit_price || item.unitPrice) * item.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Payment Progress Tab */}
              {activeTab === 'payment' && (
                <OrderPaymentTracker 
                  order={selectedOrder}
                  onPaymentAdded={() => {
                    loadAllData();
                    // Refresh selected order data
                    const updatedOrder = orders.find(o => o.id === selectedOrder.id);
                    if (updatedOrder) setSelectedOrder(updatedOrder);
                  }}
                  showAddPayment={true}
                  userRole="manager"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedOrder(null);
            loadAllData();
          }}
        />
      )}

      {/* 🆕 ADD PRODUCT TO ORDER MODAL */}
      {showAddProductModal && selectedOrderForProduct && (
        <AddProductToOrderModal
          isOpen={showAddProductModal}
          onClose={() => {
            setShowAddProductModal(false);
            setSelectedOrderForProduct(null);
          }}
          order={selectedOrderForProduct}
          onProductAdded={() => {
            loadAllData();
            setShowAddProductModal(false);
            setSelectedOrderForProduct(null);
          }}
        />
      )}
    </div>
  );
};

// =====================================================================
// CREATE ORDER MODAL COMPONENT
// =====================================================================
const CreateOrderModal = ({ suppliers, onClose, onSuccess }) => {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({
    productName: '',
    quantity: 1,
    unitPrice: 0
  });
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('FAREDEAL Main Store, Kampala');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // NEW: Payment fields for cash paid at order creation
  const [cashPaidNow, setCashPaidNow] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const handleAddItem = () => {
    if (!newItem.productName || newItem.quantity <= 0 || newItem.unitPrice <= 0) {
      alert('Please fill in all item details');
      return;
    }

    const item = {
      product_name: newItem.productName,
      quantity: parseInt(newItem.quantity),
      unit_price: parseFloat(newItem.unitPrice),
      total: parseInt(newItem.quantity) * parseFloat(newItem.unitPrice)
    };

    setOrderItems([...orderItems, item]);
    setNewItem({ productName: '', quantity: 1, unitPrice: 0 });
  };

  const handleRemoveItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.18; // 18% VAT
    return {
      subtotal,
      tax,
      total: subtotal + tax
    };
  };

  const setTotals = (newTotals) => {
    // No-op: totals is calculated directly from orderItems
    // This satisfies the OrderItemsSelector callback requirement
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSupplier) {
      alert('Please select a supplier');
      return;
    }

    if (orderItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    if (!expectedDeliveryDate) {
      alert('Please select expected delivery date');
      return;
    }

    setSubmitting(true);

    try {
      // Get manager ID from localStorage (custom authentication)
      const storedUser = localStorage.getItem('supermarket_user');
      
      if (!storedUser) {
        alert('❌ Error: No user session found. Please log in again.');
        return;
      }

      const parsedUser = JSON.parse(storedUser);
      const managerId = parsedUser.id;
      console.log('👤 Manager ID for order:', managerId);
      
      const orderData = {
        supplierId: selectedSupplier,
        items: orderItems,
        expectedDeliveryDate,
        deliveryAddress,
        deliveryInstructions,
        priority,
        notes,
        orderedBy: managerId // Use internal user ID, not auth_id
      };

      const response = await supplierOrdersService.createPurchaseOrder(orderData);

      if (response.success) {
        let successMsg = '✅ Purchase order created successfully!';
        
        // If cash was paid during order creation, record it with tracking
        if (cashPaidNow && parseFloat(cashPaidNow) > 0 && response.order?.id) {
          try {
            const { data: paymentData, error: paymentError } = await supabase.rpc('record_payment_with_tracking', {
              p_order_id: response.order.id,
              p_amount_paid: parseFloat(cashPaidNow),
              p_payment_method: paymentMethod,
              p_payment_reference: paymentReference || `ORDER-CREATE-${response.order.id.substring(0, 8)}`,
              p_notes: `Payment made at order creation. ${paymentNotes}`,
              p_paid_by: managerId
            });

            if (paymentError) {
              console.error('⚠️ Payment recording error:', paymentError);
              successMsg += `\n\n⚠️ Warning: Order created but payment tracking failed: ${paymentError.message}`;
            } else if (paymentData) {
              successMsg += `\n\n💵 CASH PAID: ${formatUGX(cashPaidNow)}`;
              successMsg += `\n🔖 Transaction #: ${paymentData.transaction_number}`;
              successMsg += `\n⏳ Awaiting supplier confirmation`;
              successMsg += `\n📊 Balance: ${formatUGX(paymentData.balance_due)}`;
            }
          } catch (paymentErr) {
            console.error('⚠️ Payment recording error:', paymentErr);
            successMsg += '\n\n⚠️ Order created but payment recording failed';
          }
        }
        
        alert(successMsg);
        onSuccess();
      } else {
        alert(`❌ Error: ${response.error}`);
      }
    } catch (err) {
      console.error('Error creating order:', err);
      alert('Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotal();

  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">🇺🇬 Create New Purchase Order</h2>
              <p className="text-green-100 mt-1">FAREDEAL Uganda - Supplier Order System</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
              disabled={submitting}
            >
              ×
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Supplier Selection */}
          <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🏢 Select Supplier *
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
              required
            >
              <option value="">-- Choose Supplier --</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.business_name} ({supplier.supplier_code})
                </option>
              ))}
            </select>
          </div>

          {/* Order Items - Using New Enhanced Selector */}
          <OrderItemsSelector
            orderItems={orderItems}
            onItemsChange={setOrderItems}
            totals={totals}
            onTotalsChange={setTotals}
          />

          {/* Delivery Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                📅 Expected Delivery Date *
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                ⚡ Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="low">📝 Low</option>
                <option value="normal">📋 Normal</option>
                <option value="high">⚠️ High</option>
                <option value="urgent">🔥 Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📍 Delivery Address *
            </label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Enter delivery address"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📝 Delivery Instructions
            </label>
            <textarea
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="Any special delivery instructions..."
              rows="2"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              💬 Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or requirements..."
              rows="3"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Payment Section - NEW */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-300">
            <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
              💵 Payment at Order Creation (Optional)
              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                Awaits Supplier Confirmation
              </span>
            </h3>
            <p className="text-sm text-green-700 mb-4">
              💡 If you're paying cash now, enter the amount here. It will be recorded with a transaction number and sent to the supplier for confirmation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cash Amount */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-green-800 mb-2">
                  💵 Cash Paid Now (UGX)
                </label>
                <input
                  type="number"
                  value={cashPaidNow}
                  onChange={(e) => setCashPaidNow(e.target.value)}
                  min="0"
                  max={totals.total}
                  step="1000"
                  placeholder="Enter cash amount (leave 0 if not paying now)"
                  className="w-full px-4 py-3 border-2 border-green-500 rounded-lg focus:border-green-600 focus:outline-none text-lg font-semibold text-green-700 bg-white"
                />
                {cashPaidNow > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-green-700 flex justify-between">
                      <span>Order Total:</span>
                      <span className="font-bold">{formatUGX(totals.total)}</span>
                    </p>
                    <p className="text-sm text-green-700 flex justify-between">
                      <span>Paying Now:</span>
                      <span className="font-bold">{formatUGX(cashPaidNow)}</span>
                    </p>
                    <p className="text-sm font-bold text-orange-700 flex justify-between pt-2 border-t border-green-300">
                      <span>Balance Due:</span>
                      <span>{formatUGX(totals.total - parseFloat(cashPaidNow || 0))}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              {cashPaidNow > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-green-800 mb-2">
                      💳 Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-green-400 rounded-lg focus:border-green-600 focus:outline-none bg-white"
                    >
                      <option value="cash">💵 Cash</option>
                      <option value="mobile_money">📱 Mobile Money</option>
                      <option value="bank_transfer">🏦 Bank Transfer</option>
                      <option value="check">📝 Cheque</option>
                      <option value="credit">💳 Credit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-green-800 mb-2">
                      🔖 Payment Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Transaction ID, receipt #, etc."
                      className="w-full px-4 py-3 border-2 border-green-400 rounded-lg focus:border-green-600 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-green-800 mb-2">
                      📝 Payment Notes (Optional)
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Any notes about this payment..."
                      rows="2"
                      className="w-full px-4 py-3 border-2 border-green-400 rounded-lg focus:border-green-600 focus:outline-none bg-white"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || orderItems.length === 0}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-300 font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating Order...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle className="h-5 w-5" />
                  <span>Create Purchase Order</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================
// PAYMENT MODAL COMPONENT
// =====================================================================
const PaymentModal = ({ order, onClose, onSuccess }) => {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amount = parseFloat(amountPaid);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (amount > parseFloat(order.balance_due_ugx)) {
      alert(`Payment amount cannot exceed balance due: ${formatUGX(order.balance_due_ugx)}`);
      return;
    }

    setSubmitting(true);

    try {
      // Get manager ID from localStorage
      const storedUser = localStorage.getItem('supermarket_user');
      if (!storedUser) {
        throw new Error('No user session found');
      }
      const parsedUser = JSON.parse(storedUser);
      const managerId = parsedUser.id;
      
      // Record payment with tracking
      const { data, error } = await supabase.rpc('record_payment_with_tracking', {
        p_order_id: order.id,
        p_amount_paid: amount,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference || null,
        p_payment_date: new Date().toISOString(),
        p_notes: paymentNotes || null,
        p_paid_by: managerId
      });

      if (error) throw error;

      if (data && data.success) {
        alert(`✅ Payment recorded successfully!\n\n` +
              `Transaction: ${data.transaction_number}\n` +
              `Amount Paid: ${formatUGX(amount)}\n` +
              `New Balance: ${formatUGX(data.balance_due)}\n` +
              `Payment: ${data.payment_percentage.toFixed(1)}% complete\n\n` +
              `⏳ Awaiting supplier confirmation...`);
        onSuccess();
      } else {
        alert(`❌ Error: ${data?.error || 'Failed to record payment'}`);
      }
    } catch (err) {
      console.error('Error recording payment:', err);
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center">
                <FiDollarSign className="mr-3 h-8 w-8" />
                💰 Record Payment - FAREDEAL Uganda
              </h2>
              <p className="text-green-100 mt-1">Order: {order.po_number}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
              disabled={submitting}
            >
              ×
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
            <h3 className="font-bold text-lg mb-3">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Supplier:</span>
                <span className="font-semibold">{order.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Order Total:</span>
                <span className="font-semibold">{formatUGX(order.total_amount_ugx)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Already Paid:</span>
                <span className="font-semibold text-green-600">{formatUGX(order.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t-2 border-gray-300">
                <span className="font-bold text-lg">Balance Due:</span>
                <span className="font-bold text-lg text-red-600">{formatUGX(order.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              💵 Payment Amount (UGX) *
            </label>
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="Enter payment amount"
              min="0"
              max={order.balance_due}
              step="1000"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-lg font-semibold"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Maximum: {formatUGX(order.balance_due)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              💳 Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
              required
            >
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="mobile_money">📱 Mobile Money (MTN/Airtel)</option>
              <option value="cash">💵 Cash</option>
              <option value="cheque">📝 Cheque</option>
              <option value="credit_card">💳 Credit Card</option>
            </select>
          </div>

          {/* Payment Reference */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🔖 Payment Reference / Transaction ID
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g., TXN123456789, Cheque #12345"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Payment Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📝 Payment Notes
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Any additional notes about this payment..."
              rows="3"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Recording Payment...</span>
                </>
              ) : (
                <>
                  <FiCheckCircle className="h-5 w-5" />
                  <span>Record Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================
// APPROVAL WITH PAYMENT MODAL
  // =============================================
  const ApprovalModal = () => {
    if (!showApprovalModal || !selectedOrder) return null;

    const originalTotal = selectedOrder.total_amount_ugx || 0;
    const adjustedTotal = approvalData.adjustedTotal ? parseFloat(approvalData.adjustedTotal) : originalTotal;
    const totalAmount = adjustedTotal;
    const paymentAmount = parseFloat(approvalData.initialPayment) || 0;
    const balance = totalAmount - paymentAmount;
    const discount = originalTotal - adjustedTotal;
    const paymentStatus = paymentAmount >= totalAmount ? 'paid' : paymentAmount > 0 ? 'partially_paid' : 'unpaid';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">✅ Approve Purchase Order</h2>
                <p className="text-blue-100 mt-1">Order #{selectedOrder.po_number}</p>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-white hover:text-gray-200 text-3xl font-bold"
              >
                ×
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <h3 className="font-bold text-gray-800 mb-3">📋 Order Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Supplier:</span>
                  <p className="font-semibold">{selectedOrder.supplierName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Total Amount:</span>
                  {discount > 0 ? (
                    <div>
                      <p className="font-semibold text-sm line-through text-gray-500">
                        UGX {originalTotal.toLocaleString()}
                      </p>
                      <p className="font-bold text-lg text-purple-600">
                        UGX {totalAmount.toLocaleString()}
                        <span className="text-xs text-green-600 ml-2">(-{discount.toLocaleString()})</span>
                      </p>
                    </div>
                  ) : (
                    <p className="font-bold text-lg text-blue-600">
                      {new Intl.NumberFormat('en-UG', {
                        style: 'currency',
                        currency: 'UGX',
                        minimumFractionDigits: 0
                      }).format(totalAmount)}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Items:</span>
                  <p className="font-semibold">{selectedOrder.items?.length || 0} items</p>
                </div>
                {discount > 0 && (
                  <div className="col-span-2 bg-green-100 p-2 rounded border border-green-300">
                    <p className="text-xs text-green-800 font-bold">
                      ✨ Discount Applied: UGX {discount.toLocaleString()} 
                      <span className="ml-2">({((discount/originalTotal)*100).toFixed(1)}% off)</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <h3 className="font-bold text-gray-800 mb-4">💰 Payment Details</h3>
              
              {/* Cash Paid Now - Prominent Field */}
              <div className="mb-6 bg-gradient-to-r from-green-100 to-emerald-100 p-4 rounded-lg border-2 border-green-400">
                <label className="block text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                  💵 Cash Paid Now (UGX)
                  <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">Awaits Supplier Confirmation</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  step="1000"
                  value={approvalData.cashPaidNow}
                  onChange={(e) => setApprovalData({...approvalData, cashPaidNow: e.target.value})}
                  placeholder="Enter cash amount paid at this moment"
                  className="w-full px-4 py-4 border-2 border-green-500 rounded-lg focus:border-green-600 focus:outline-none text-xl font-bold text-green-700 bg-white"
                />
                <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                  <FiAlertTriangle className="text-yellow-600" />
                  This payment will be recorded and sent to supplier for confirmation
                </p>
              </div>
              
              {/* Initial Payment Amount */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  💵 Initial Payment Amount (UGX)
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  step="1000"
                  value={approvalData.initialPayment}
                  onChange={(e) => setApprovalData({...approvalData, initialPayment: e.target.value})}
                  placeholder="Enter amount (0 for unpaid)"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-lg font-semibold"
                />
                <div className="mt-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment:</span>
                    <span className="font-bold text-green-600">
                      {new Intl.NumberFormat('en-UG', {
                        style: 'currency',
                        currency: 'UGX',
                        minimumFractionDigits: 0
                      }).format(paymentAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Balance Due:</span>
                    <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {new Intl.NumberFormat('en-UG', {
                        style: 'currency',
                        currency: 'UGX',
                        minimumFractionDigits: 0
                      }).format(balance)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="text-gray-700 font-semibold">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                      paymentStatus === 'partially_paid' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {paymentStatus === 'paid' && '✅ FULLY PAID'}
                      {paymentStatus === 'partially_paid' && '⚠️ HALF PAID'}
                      {paymentStatus === 'unpaid' && '❌ UNPAID'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  💳 Payment Method
                </label>
                <select
                  value={approvalData.paymentMethod}
                  onChange={(e) => setApprovalData({...approvalData, paymentMethod: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="cash">💵 Cash</option>
                  <option value="mobile_money">📱 Mobile Money</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                  <option value="check">📝 Cheque</option>
                  <option value="credit">💳 Credit</option>
                </select>
              </div>

              {/* Payment Date */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📅 Payment Date
                </label>
                <input
                  type="date"
                  value={approvalData.paymentDate}
                  onChange={(e) => setApprovalData({...approvalData, paymentDate: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                />
              </div>

              {/* Next Payment Date (if partial payment) */}
              {balance > 0 && paymentAmount > 0 && (
                <div className="mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    📆 Next Payment Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={approvalData.nextPaymentDate}
                    onChange={(e) => setApprovalData({...approvalData, nextPaymentDate: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                  />
                  <p className="text-xs text-yellow-700 mt-1">
                    ⚠️ Set when you expect the next payment of UGX {balance.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📝 Notes (Optional)
                </label>
                <textarea
                  value={approvalData.notes}
                  onChange={(e) => setApprovalData({...approvalData, notes: e.target.value})}
                  placeholder="Add any notes about this approval or payment..."
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Balance Adjustment Section */}
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <h3 className="font-bold text-gray-800 mb-4">✂️ Adjust Order Total (Optional)</h3>
              <p className="text-sm text-purple-700 mb-4">
                💡 You can reduce the order total (apply discount). Supplier must accept this change.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  💰 Adjusted Total Amount (UGX)
                </label>
                <input
                  type="number"
                  min="0"
                  max={originalTotal}
                  step="1000"
                  value={approvalData.adjustedTotal || originalTotal}
                  onChange={(e) => setApprovalData({...approvalData, adjustedTotal: e.target.value})}
                  placeholder={`Original: ${originalTotal.toLocaleString()}`}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-lg font-semibold"
                />
                {discount > 0 && (
                  <div className="mt-2 bg-white rounded p-3 border border-purple-300">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Original Total:</span>
                      <span className="font-semibold line-through">UGX {originalTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-purple-600 font-bold">Discount:</span>
                      <span className="font-bold text-green-600">-UGX {discount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-purple-200">
                      <span className="text-gray-800">New Total:</span>
                      <span className="text-purple-600">UGX {adjustedTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {discount > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    📋 Reason for Adjustment *
                  </label>
                  <textarea
                    value={approvalData.adjustmentReason}
                    onChange={(e) => setApprovalData({...approvalData, adjustmentReason: e.target.value})}
                    placeholder="E.g., Volume discount, damaged goods, price negotiation..."
                    rows="2"
                    required
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                  <p className="text-xs text-purple-600 mt-1 flex items-center">
                    <span className="mr-1">🔔</span>
                    Supplier will be notified and must accept this change
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t-2 border-gray-200">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold"
              >
                Cancel
              </button>
              {/* ❌ COMMENTED OUT: Approve Order button disabled
              <button
                type="button"
                onClick={submitOrderApproval}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-bold shadow-lg flex items-center space-x-2"
              >
                <FiCheckCircle className="h-5 w-5" />
                <span>Approve Order</span>
              </button>
              */}
            </div>
          </div>
        </div>
      </div>
    );
  };

/**
 * 🆕 ADD PRODUCT TO ORDER MODAL
 * Modal for adding additional products to an existing purchase order
 * Allows managers to dynamically add items to pending/approved orders
 */
const AddProductToOrderModal = ({ isOpen, onClose, order, onProductAdded }) => {
  const [formData, setFormData] = React.useState({
    productName: '',
    quantity: 1,
    unitPrice: '',
    notes: ''
  });

  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const productNameRef = React.useRef(null);

  // Auto-focus on product name input when modal opens
  React.useEffect(() => {
    if (isOpen && productNameRef.current) {
      setTimeout(() => productNameRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }
    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    if (!formData.unitPrice || parseFloat(formData.unitPrice) <= 0) {
      newErrors.unitPrice = 'Unit price must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const newLineTotal = formData.quantity * parseFloat(formData.unitPrice);
      
      // Add the product to the order in Supabase
      const { data, error } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: order.id,
          product_name: formData.productName,
          quantity: formData.quantity,
          unit_price: parseFloat(formData.unitPrice),
          line_total: newLineTotal,
          notes: formData.notes,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      // Update the order total
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          total_amount_ugx: (order.total_amount_ugx || 0) + newLineTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        throw updateError;
      }

      // 🆕 UPDATE POS INVENTORY - Add the product to products table
      try {
        console.log('🛒 Adding product to POS inventory:', formData.productName);
        
        // First, try to find existing product - use exact match on name
        const { data: existingProducts, error: searchError } = await supabase
          .from('products')
          .select('id, stock')
          .eq('name', formData.productName);

        let posUpdateResult;

        if (existingProducts && existingProducts.length > 0) {
          // Product exists - update stock
          const existingProduct = existingProducts[0];
          console.log('✅ Product exists in POS:', existingProduct.id, 'Current stock:', existingProduct.stock);
          
          const newStock = (existingProduct.stock || 0) + formData.quantity;
          const { error: updateError } = await supabase
            .from('products')
            .update({
              stock: newStock,
              price: parseFloat(formData.unitPrice), // Update price too
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProduct.id);

          if (updateError) {
            console.error('⚠️ Error updating product stock:', updateError);
          } else {
            console.log('✅ Product stock updated in POS. New stock:', newStock);
            posUpdateResult = { success: true, action: 'updated', stock: newStock };
          }
        } else {
          // Product doesn't exist - create new
          console.log('🆕 Creating new product in POS inventory');
          
          const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert({
              name: formData.productName,
              price: parseFloat(formData.unitPrice),
              stock: formData.quantity,
              category: 'Imported',
              brand: 'Supplier Order',
              unit: 'piece',
              description: formData.notes || `Added from supplier order - ${new Date().toLocaleDateString()}`,
              created_at: new Date().toISOString()
            })
            .select();

          if (insertError) {
            console.error('⚠️ Error creating product in POS:', insertError);
          } else {
            console.log('✅ New product created in POS:', newProduct);
            posUpdateResult = { success: true, action: 'created', stock: formData.quantity };
          }
        }

        // Log the result
        if (posUpdateResult?.success) {
          console.log('🎉 POS inventory updated successfully!');
        }
      } catch (posErr) {
        console.error('⚠️ Error updating POS inventory:', posErr);
      }

      // Show success with animation
      toast.success(`✅ ${formData.productName} added!\n📦 Product quantity: ${formData.quantity}\n🛒 Added to POS inventory`, {
        autoClose: 4000,
        style: { animation: 'slideInRight 0.3s ease-out' }
      });

      // Reset form with smooth animation
      setFormData({
        productName: '',
        quantity: 1,
        unitPrice: '',
        notes: ''
      });

      // Trigger callback to refresh data
      setTimeout(() => {
        onProductAdded();
      }, 300);
    } catch (err) {
      console.error('Error adding product:', err);
      toast.error(`❌ Failed to add product: ${err.message}\n\nPlease check console for details.`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !order) return null;

  const totalLineAmount = formData.quantity * (parseFloat(formData.unitPrice) || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity duration-300">
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideOutDown {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(30px);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        .animate-slideInUp {
          animation: slideInUp 0.4s ease-out;
        }
        .animate-slideOutDown {
          animation: slideOutDown 0.3s ease-in;
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-bounce {
          animation: bounce 1s infinite;
        }
      `}</style>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full animate-slideInUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 rounded-t-xl flex items-center justify-between shadow-lg">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FiPlus className="h-6 w-6 animate-bounce" />
            Add Product to Order
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all duration-200 hover:rotate-90"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Order Info */}
        <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Order Number</p>
              <p className="font-bold text-gray-900">{order.po_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Current Total</p>
              <p className="font-bold text-green-600">UGX {(order.total_amount_ugx || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleAddProduct} className="p-6 space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📦 Product Name *
            </label>
            <input
              ref={productNameRef}
              type="text"
              placeholder="e.g., Sugar - 1kg, Rice - 10kg"
              value={formData.productName}
              onChange={(e) => {
                setFormData({ ...formData, productName: e.target.value });
                if (errors.productName) setErrors({ ...errors, productName: '' });
              }}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all duration-200 ${
                errors.productName ? 'border-red-500 focus:border-red-600' : 'border-gray-300 focus:border-indigo-500'
              }`}
            />
            {errors.productName && (
              <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                <FiAlertTriangle className="h-4 w-4" />
                {errors.productName}
              </p>
            )}
          </div>

          {/* Quantity and Unit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                📊 Quantity *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.quantity}
                onChange={(e) => {
                  setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 });
                  if (errors.quantity) setErrors({ ...errors, quantity: '' });
                }}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.quantity ? 'border-red-500 focus:border-red-600' : 'border-gray-300 focus:border-indigo-500'
                }`}
              />
              {errors.quantity && (
                <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                  <FiAlertTriangle className="h-4 w-4" />
                  {errors.quantity}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                💰 Unit Price (UGX) *
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={formData.unitPrice}
                onChange={(e) => {
                  setFormData({ ...formData, unitPrice: e.target.value });
                  if (errors.unitPrice) setErrors({ ...errors, unitPrice: '' });
                }}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.unitPrice ? 'border-red-500 focus:border-red-600' : 'border-gray-300 focus:border-indigo-500'
                }`}
              />
              {errors.unitPrice && (
                <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                  <FiAlertTriangle className="h-4 w-4" />
                  {errors.unitPrice}
                </p>
              )}
            </div>
          </div>

          {/* Line Total Preview */}
          {formData.quantity > 0 && formData.unitPrice && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-lg border-2 border-indigo-200 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-semibold">Line Total:</span>
                <span className="text-xl font-bold text-indigo-600 animate-pulse">
                  UGX {totalLineAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-indigo-200">
                <span className="text-gray-700 font-semibold">New Order Total:</span>
                <span className="text-xl font-bold text-green-600 animate-pulse">
                  UGX {((order.total_amount_ugx || 0) + totalLineAmount).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📝 Notes (Optional)
            </label>
            <textarea
              placeholder="Add any special notes about this product..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="2"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Adding...
                </>
              ) : (
                <>
                  <FiCheck className="h-5 w-5" />
                  Add Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================
// EXPORT
// =====================================================================
export default SupplierOrderManagement;
