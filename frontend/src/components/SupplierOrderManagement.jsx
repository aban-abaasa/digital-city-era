// =====================================================================
// SUPPLIER ORDER MANAGEMENT COMPONENT
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
  FiX, FiCheck, FiPrinter, FiRefreshCw, FiFileText
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import supplierOrdersService, { getBusinessWalletBalance, resolveBusinessProfileId } from '../services/supplierOrdersService';
import { dispatchDeliveryForPurchaseOrder, checkRouteNeedsSeaLeg } from '../services/deliveryDispatchService';
import { supabase } from '../services/supabase';
import { ugxToICAN, formatICAN } from '../services/icanWalletService';
import { verifyPin } from '../services/pinService';
import OrderPaymentTracker from './OrderPaymentTracker';
import useSupermarketBranding from '../hooks/useSupermarketBranding';
import OrderItemsSelector from './OrderItemsSelector';
import './SupplierOrderManagement.css';

// Money on screen: short ("UGX 2K", "UGX 5.2M") to save space, exact on hover / long-press
const fullUGX = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString('en-UG')}`;
const ugxShort = (n) => {
  const x = Number(n) || 0;
  const v = Math.abs(x);
  const sign = x < 0 ? '-' : '';
  const trim = (y, d) => y.toFixed(d).replace(/\.0+$/, '');
  if (v >= 1e9) return `${sign}UGX ${trim(v / 1e9, v >= 1e11 ? 0 : 1)}B`;
  if (v >= 1e6) return `${sign}UGX ${trim(v / 1e6, v >= 1e8 ? 0 : 1)}M`;
  if (v >= 1e3) return `${sign}UGX ${trim(v / 1e3, v >= 1e5 ? 0 : 1)}K`;
  return `${sign}UGX ${Math.round(v)}`;
};
const Money = ({ v }) => <span className="money" title={fullUGX(v)}>{ugxShort(v)}</span>;

const ORDER_STAGES = [
  { id: 'pending_approval', label: 'Awaiting approval', icon: '📝', also: ['pending', 'draft'] },
  { id: 'approved', label: 'Approved', icon: '✔' },
  { id: 'sent_to_supplier', label: 'With supplier', icon: '✉', also: ['ordered'] },
  { id: 'confirmed', label: 'Confirmed', icon: '🤝' },
  { id: 'received', label: 'Received', icon: '📦', also: ['partially_received'] },
  { id: 'completed', label: 'Completed', icon: '★' }
];
const PAYABLE_STATUSES = ['pending_approval', 'approved', 'sent_to_supplier', 'confirmed', 'received'];
const QUICK_FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'action', label: 'Needs action' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'incoming', label: 'On the way' },
  { id: 'late', label: 'Late' },
  { id: 'urgent', label: 'Urgent' }
];

const SupplierOrderManagement = ({ onPosUpdated, businessProfileId = null, openCreateSignal = 0 }) => {
  const [resolvedBusinessProfileId, setResolvedBusinessProfileId] = useState(businessProfileId);
  const activeBusinessProfileId = businessProfileId || resolvedBusinessProfileId;
  const branding = useSupermarketBranding();

  useEffect(() => {
    let cancelled = false;
    resolveBusinessProfileId(businessProfileId)
      .then((profileId) => {
        if (!cancelled && profileId) setResolvedBusinessProfileId(profileId);
      })
      .catch((error) => console.warn('Could not resolve the store business account:', error.message));
    return () => { cancelled = true; };
  }, [businessProfileId]);

  // State Management
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState({});
  const [products, setProducts] = useState([]); // Products in POS inventory
  const [wholesalePricingMode, setWholesalePricingMode] = useState('supplier_price');
  const [storeId, setStoreId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userRow } = await supabase.from('users').select('supermarket_id').or(`auth_id.eq.${user.id},id.eq.${user.id}`).maybeSingle();
      const id = userRow?.supermarket_id;
      if (!id) return;
      const { data: store } = await supabase.from('supermarkets').select('id, business_type, wholesale_pricing_mode').eq('id', id).maybeSingle();
      setStoreId(store?.id || null);
      if (store?.business_type === 'wholesale') setWholesalePricingMode(store.wholesale_pricing_mode || 'supplier_price');
    })();
  }, []);

  const saveWholesalePricingMode = async (mode) => {
    setWholesalePricingMode(mode);
    if (storeId) await supabase.from('supermarkets').update({ wholesale_pricing_mode: mode }).eq('id', storeId);
  };

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
  const [quickFilter, setQuickFilter] = useState('all'); // all | action | unpaid | incoming | urgent | late
  const [sortBy, setSortBy] = useState('newest');
  const [showShelf, setShowShelf] = useState(false);
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
  const [approvalIcanBalance, setApprovalIcanBalance] = useState(null);
  const [approvalIcanBalanceLoading, setApprovalIcanBalanceLoading] = useState(false);
  // Manager's own vehicle choice at approval time (Car/Van/Truck, or Ship
  // when the route genuinely needs a sea leg) — overrides whatever the
  // supplier picked earlier when set. null = leave the supplier's choice
  // (or full automatic default) untouched.
  const [approvalVehicleType, setApprovalVehicleType] = useState(null);
  const [approvalShipOptionAvailable, setApprovalShipOptionAvailable] = useState(false);

  // Load the manager's live ICAN balance when they switch to the IcanEra Wallet method
  // in the order-approval modal
  useEffect(() => {
    if (approvalData.paymentMethod !== 'ican_wallet' || approvalIcanBalance !== null || approvalIcanBalanceLoading) return;

    setApprovalIcanBalanceLoading(true);
    getBusinessWalletBalance(activeBusinessProfileId)
      .then((bal) => setApprovalIcanBalance(bal))
      .catch(() => setApprovalIcanBalance(null))
      .finally(() => setApprovalIcanBalanceLoading(false));
  }, [approvalData.paymentMethod, approvalIcanBalance, approvalIcanBalanceLoading, activeBusinessProfileId]);

  // Load data on component mount
  useEffect(() => {
    loadAllData();
    loadProducts();
  }, [viewMode]);

  // The manager dashboard's "New purchase order" shortcut
  useEffect(() => {
    if (openCreateSignal) setShowCreateModal(true);
  }, [openCreateSignal]);

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
      // Status, priority and payment filters are applied client-side (see
      // visibleOrders) so the pipeline counts always cover the whole book.
      const ordersResponse = viewMode === 'history'
        ? await supplierOrdersService.getOrderHistory({})
        : await supplierOrdersService.getAllPurchaseOrders({});

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
    setApprovalIcanBalance(null);
    setApprovalVehicleType(null);
    setApprovalShipOptionAvailable(false);
    checkRouteNeedsSeaLeg(order).then(setApprovalShipOptionAvailable);
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
      
      // Step 2: Approve the order directly. This no longer calls the
      // approve_order_with_payment RPC — that RPC is listed in
      // VERIFY_DATABASE_DEPLOYMENT.sql in the same "required" group as
      // record_payment_with_tracking, which we already confirmed was never
      // actually created on this DB (see supplierOrdersService.recordPayment).
      // ManagerPortal.jsx's own approve button already does this exact direct
      // update successfully, so it doesn't depend on a possibly-missing RPC.
      console.log('📝 Approving order:', { orderId: approvalOrderId, managerId, ...approvalData });

      const { error: approveError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'approved',
          approved_by: managerId,
          approved_at: new Date().toISOString(),
          notes: approvalData.notes || selectedOrderData.notes,
          // Manager's choice at approval wins over whatever the supplier
          // picked earlier; leaving it null keeps the supplier's choice.
          ...(approvalVehicleType ? { preferred_vehicle_type: approvalVehicleType } : {}),
        })
        .eq('id', approvalOrderId);

      if (approveError) {
        console.error('❌ Error approving order:', approveError);
        alert(`❌ Error: ${approveError.message}`);
        return;
      }

      // Step 2b: Auto-dispatch a delivery vehicle (BodaGo's matching engine,
      // extended with van/truck/ship vehicle types — see
      // deliveryDispatchService.js). Best-effort: never blocks the approval
      // that already succeeded above. A cross-bloc route (e.g. Uganda-
      // Nigeria) dispatches a 3-leg road->sea->road journey instead of a
      // single ride, so there's no single fare/rideId to show yet.
      dispatchDeliveryForPurchaseOrder(approvalOrderId).then((result) => {
        if (result.dispatched && result.viaSea) {
          toast.success('🚢 Cross-border shipment dispatched — road leg to the departure port is underway.');
        } else if (result.dispatched) {
          toast.success(`🚚 Delivery vehicle dispatched automatically (fare: UGX ${result.fare?.toLocaleString?.() || result.fare})`);
        } else {
          console.log('ℹ️ Auto-dispatch skipped:', result.reason);
        }
      });

      // Step 3: Record any payment made at approval time — "Cash Paid Now"
      // and the legacy "Initial Payment" field both represent money paid
      // right now, so they're combined into a single payment routed through
      // whichever method is selected (Cash or IcanEra Wallet).
      const amountPaidNow = (parseFloat(approvalData.cashPaidNow) || 0) + (parseFloat(approvalData.initialPayment) || 0);
      let paymentResult = null;

      if (amountPaidNow > 0) {
        if (approvalData.paymentMethod === 'ican_wallet') {
          const icanNeeded = ugxToICAN(amountPaidNow);
          if (!approvalIcanBalance || approvalIcanBalance.ican < icanNeeded) {
            alert(
              `⚠️ Order approved, but ICAN payment skipped — insufficient balance ` +
              `(needed ${formatICAN(icanNeeded)}, have ${formatICAN(approvalIcanBalance?.ican || 0)}).`
            );
          } else {
            paymentResult = await supplierOrdersService.payOrderWithICAN({
              orderId:        approvalOrderId,
              supplierUserId: selectedOrderData.supplier_id,
              supplierBusinessProfileId: selectedOrderData.supplier_business_profile_id,
              icanAmount:     icanNeeded,
              ugxAmount:      amountPaidNow,
              businessProfileId: activeBusinessProfileId,
              notes:          `Payment made during order approval. ${approvalData.notes || ''}`,
            });
          }
        } else {
          paymentResult = await supplierOrdersService.recordPayment({
            orderId:          approvalOrderId,
            amountPaid:       amountPaidNow,
            paymentMethod:    approvalData.paymentMethod,
            paymentReference: `APPROVAL-${approvalOrderId.substring(0, 8)}`,
            notes:            `Payment made during order approval. ${approvalData.notes || ''}`,
            paidBy:           managerId
          });
        }

        if (paymentResult && !paymentResult.success) {
          console.error('⚠️ Payment tracking failed:', paymentResult.error);
          alert(`⚠️ Order approved but payment tracking failed: ${paymentResult.error}`);
        }
      }

      // Show success message with payment details
      let successMsg = '✅ Purchase order approved successfully!\n\n';

      if (paymentResult?.success) {
        if (approvalData.paymentMethod === 'ican_wallet') {
          successMsg += `🪙 ICAN PAYMENT REQUESTED: ${formatICAN(ugxToICAN(amountPaidNow))} ICAN (UGX ${amountPaidNow.toLocaleString()})\n`;
          successMsg += paymentResult.wallet_approval_required
            ? `🔔 Authorized wallet administrator must approve with the business-wallet PIN.\n`
            : `✅ Supplier's business wallet credited.\n`;
        } else {
          successMsg += `💵 PAID NOW: UGX ${amountPaidNow.toLocaleString()}\n`;
          successMsg += `⏳ Status: Awaiting supplier confirmation\n`;
        }
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
      setApprovalIcanBalance(null);
      setApprovalVehicleType(null);
      setApprovalShipOptionAvailable(false);
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
    const deliveryMethod = window.prompt(
      'Choose delivery method before completing this order:\n\n1 = Supplier delivery\n2 = MyBodaGuy delivery\n3 = Supermarket pickup',
      '1'
    );
    const deliveryMethods = { '1': 'supplier_delivery', '2': 'mybodaguy_delivery', '3': 'supermarket_pickup' };
    if (!deliveryMethods[deliveryMethod]) {
      alert('A delivery method is required. The order was not completed.');
      return;
    }
    if (!confirm('Mark this order as RECEIVED and update inventory?\n\nDelivery: ' + deliveryMethods[deliveryMethod])) {
      return;
    }

    try {
      setLoading(true);
      // Step 1: Update order status to 'received'
      const { error: statusError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received',
          delivery_method: deliveryMethods[deliveryMethod],
          delivery_selected_by: (await supabase.auth.getUser()).data.user?.id || null,
          delivery_selected_at: new Date().toISOString(),
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
        const receivedOrder = orders.find((order) => order.id === orderId);
        if (receivedOrder && /function|rpc|does not exist|not found/i.test(inventoryError.message || '')) {
          await handleAddOrderProductsToPOS(receivedOrder);
          alert('✅ Order marked as received and inventory quantities were synchronised.');
          loadAllData();
          return;
        }
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
      let supermarketId = null;
      try {
        supermarketId = JSON.parse(localStorage.getItem('supermarket_user') || '{}').supermarket_id || null;
      } catch {
        // Fall back to the authenticated user below.
      }
      if (!supermarketId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: userRow } = await supabase
            .from('users')
            .select('supermarket_id')
            .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
            .maybeSingle();
          supermarketId = userRow?.supermarket_id || null;
        }
      }
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
          let productQuery = supabase
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
          if (supermarketId) productQuery = productQuery.eq('supermarket_id', supermarketId);
          const { data: existingProducts, error: searchError } = await productQuery;

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
                  ...(supermarketId ? { supermarket_id: supermarketId } : {}),
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
                ...(supermarketId ? { supermarket_id: supermarketId } : {}),
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
                  ...(supermarketId ? { supermarket_id: supermarketId } : {}),
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
            .from('purchase_orders')
            .update({ status: 'received' })
            .eq('id', order.id);
          console.log('✅ Order marked as received');
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
    const deliveryMethod = window.prompt(
      'Choose delivery method before completing this order:\n\n1 = Supplier delivery\n2 = MyBodaGuy delivery\n3 = Supermarket pickup',
      '1'
    );
    const deliveryMethods = { '1': 'supplier_delivery', '2': 'mybodaguy_delivery', '3': 'supermarket_pickup' };
    if (!deliveryMethods[deliveryMethod]) {
      alert('A delivery method is required. The order was not completed.');
      return;
    }
    if (!confirm('Mark this order as RECEIVED?\n\nDelivery: ' + deliveryMethods[deliveryMethod])) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received',
          delivery_method: deliveryMethods[deliveryMethod],
          delivery_selected_by: (await supabase.auth.getUser()).data.user?.id || null,
          delivery_selected_at: new Date().toISOString(),
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

  // ---- Order ledger helpers: tolerate both the old and new purchase_orders columns ----
  const amountOf = (o) => parseFloat(o.total_amount_ugx ?? o.total_amount) || 0;
  const paidOf = (o) => {
    const paid = parseFloat(o.amount_paid_ugx ?? o.amount_paid);
    if (!Number.isNaN(paid)) return paid;
    return o.payment_status === 'paid' ? amountOf(o) : 0;
  };
  const balanceOf = (o) => {
    if (o.payment_status === 'paid') return 0;
    const due = parseFloat(o.balance_due_ugx ?? o.balance_due);
    return Number.isNaN(due) ? Math.max(0, amountOf(o) - paidOf(o)) : due;
  };
  const dateOf = (o) => o.order_date || o.ordered_at || o.created_at;
  const supplierNameOf = (o) =>
    o.supplierName || o.supplier_name
    || suppliers.find((s) => s.id === o.supplier_id)?.company_name
    || 'Supplier';
  const stageIndexOf = (status) => {
    const i = ORDER_STAGES.findIndex((s) => s.id === status || (s.also || []).includes(status));
    return i < 0 ? 0 : i;
  };
  const statusLabel = (status) => {
    const stage = ORDER_STAGES.find((s) => s.id === status || (s.also || []).includes(status));
    if (stage) return stage.label;
    return String(status || 'draft').replace(/_/g, ' ');
  };
  const isLate = (o) => {
    if (!o.expected_delivery_date || !['approved', 'sent_to_supplier', 'confirmed', 'pending_approval'].includes(o.status)) return false;
    const due = new Date(o.expected_delivery_date);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  };
  const needsAction = (o) => ['pending_approval', 'approved', 'received'].includes(o.status) || isLate(o);
  const isUnpaid = (o) => !['cancelled', 'rejected'].includes(o.status) && o.payment_status !== 'paid';
  const isIncoming = (o) => ['sent_to_supplier', 'confirmed'].includes(o.status);
  const stockOf = (p) => Number(p.inventory?.[0]?.current_stock ?? p.inventory?.[0]?.quantity) || 0;

  // The single most useful next step for an order, shown on its folded docket
  const nextActionOf = (o) => {
    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
    if (o.status === 'approved') {
      return { hint: 'send it to the supplier', label: 'Send', icon: <FiSend />, tone: 'pol-btn-ink', run: stop(() => handleSendToSupplier(o.id)) };
    }
    if (o.status === 'sent_to_supplier' || o.status === 'confirmed') {
      return { hint: 'check the delivery in', label: 'Receive', icon: <FiTruck />, tone: 'pol-btn-teal', run: stop(() => handleMarkAsReceived(o.id)) };
    }
    if (o.status === 'received') {
      return { hint: 'close the order', label: 'Complete', icon: <FiCheckCircle />, tone: 'pol-btn-green', run: stop(() => handleMarkAsCompleted(o.id)) };
    }
    if (PAYABLE_STATUSES.includes(o.status) && o.payment_status !== 'paid') {
      return { hint: 'record a payment', label: 'Pay', icon: <FiDollarSign />, tone: 'pol-btn-gold', run: stop(() => { setSelectedOrder(o); setShowPaymentModal(true); }) };
    }
    return null;
  };

  const stageCounts = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      const stage = ORDER_STAGES.find((s) => s.id === o.status || (s.also || []).includes(o.status));
      if (stage) counts[stage.id] = (counts[stage.id] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const quickCounts = useMemo(() => ({
    action: orders.filter(needsAction).length,
    unpaid: orders.filter(isUnpaid).length,
    incoming: orders.filter(isIncoming).length,
    urgent: orders.filter((o) => o.priority === 'urgent' || o.priority === 'high').length,
    late: orders.filter(isLate).length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [orders]);

  /**
   * Search, filter and sort — all client-side over the loaded orders, so the
   * pipeline counts always describe the whole book, not just the filtered page.
   */
  const visibleOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (statusFilter !== 'all') {
        const stage = ORDER_STAGES.find((s) => s.id === statusFilter);
        const ids = stage ? [stage.id, ...(stage.also || [])] : [statusFilter];
        if (!ids.includes(o.status)) return false;
      }
      if (priorityFilter !== 'all' && (o.priority || 'normal') !== priorityFilter) return false;
      if (paymentFilter !== 'all') {
        const ps = o.payment_status || 'unpaid';
        if (paymentFilter === 'overdue' ? !(ps === 'overdue' || (isLate(o) && ps !== 'paid')) : ps !== paymentFilter) return false;
      }
      if (quickFilter === 'action' && !needsAction(o)) return false;
      if (quickFilter === 'unpaid' && !isUnpaid(o)) return false;
      if (quickFilter === 'incoming' && !isIncoming(o)) return false;
      if (quickFilter === 'urgent' && !(o.priority === 'urgent' || o.priority === 'high')) return false;
      if (quickFilter === 'late' && !isLate(o)) return false;
      if (!q) return true;
      const hay = [
        o.po_number, supplierNameOf(o), o.orderedBy, o.ordered_by_name, o.notes,
        ...(Array.isArray(o.items) ? o.items.map((i) => i.product_name || i.productName) : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    const time = (o) => new Date(dateOf(o) || 0).getTime();
    const sorters = {
      newest: (a, b) => time(b) - time(a),
      oldest: (a, b) => time(a) - time(b),
      value: (a, b) => amountOf(b) - amountOf(a),
      balance: (a, b) => balanceOf(b) - balanceOf(a)
    };
    return list.sort(sorters[sortBy] || sorters.newest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, suppliers, searchTerm, statusFilter, priorityFilter, paymentFilter, quickFilter, sortBy]);

  /**
   * Money and payment totals across every loaded order (not just the filtered view)
   */
  const realTimeStats = useMemo(() => {
    const live = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'rejected');
    return {
      totalOrders: orders.length,
      totalValue: live.reduce((s, o) => s + amountOf(o), 0),
      pendingOrders: orders.filter((o) => o.status === 'pending_approval' || o.status === 'pending').length,
      completedOrders: orders.filter((o) => o.status === 'completed' || o.status === 'received').length,
      paidOrders: live.filter((o) => o.payment_status === 'paid').length,
      partiallyPaidOrders: live.filter((o) => o.payment_status === 'partially_paid').length,
      unpaidOrders: live.filter((o) => o.payment_status === 'unpaid' || !o.payment_status).length,
      totalPaidAmount: live.reduce((s, o) => s + Math.min(paidOf(o), amountOf(o) || paidOf(o)), 0),
      totalOutstanding: live.reduce((s, o) => s + balanceOf(o), 0)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const shelfStats = useMemo(() => {
    let low = 0;
    let out = 0;
    products.forEach((p) => {
      const stock = stockOf(p);
      const min = Number(p.inventory?.[0]?.minimum_stock) || 0;
      if (stock <= 0) out += 1;
      else if (stock <= Math.max(min, 10)) low += 1;
    });
    return { low, out };
  }, [products]);

  // Download the orders currently on screen as a spreadsheet-friendly CSV
  const exportOrdersCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['PO number', 'Supplier', 'Status', 'Priority', 'Payment', 'Ordered', 'Expected delivery', 'Items', 'Total (UGX)', 'Paid (UGX)', 'Balance (UGX)'];
    const rows = visibleOrders.map((o) => [
      o.po_number, supplierNameOf(o), statusLabel(o.status), o.priority || 'normal', o.payment_status || 'unpaid',
      dateOf(o) ? new Date(dateOf(o)).toISOString().slice(0, 10) : '',
      o.expected_delivery_date || '',
      Array.isArray(o.items) ? o.items.length : 0,
      Math.round(amountOf(o)), Math.round(paidOf(o)), Math.round(balanceOf(o))
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Open a classic printable docket for one order (Print → Save as PDF works too)
  const printOrderDocket = (o) => {
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const items = Array.isArray(o.items) ? o.items : [];
    const rows = items.map((i) => {
      const unit = parseFloat(i.unit_price ?? i.unitPrice) || 0;
      const qty = Number(i.quantity) || 0;
      return `<tr><td>${esc(i.product_name || i.productName || 'Item')}</td><td class="r">${qty}</td><td class="r">${esc(formatUGX(unit))}</td><td class="r">${esc(formatUGX(unit * qty))}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="muted">No items listed</td></tr>';
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { toast.error('Allow pop-ups to print this order'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.po_number || 'Purchase order')}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#1e1b4b;margin:40px;}
  .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px double #c4a052;padding-bottom:12px}
  h1{margin:0;font-size:28px;letter-spacing:.02em} .eyebrow{font:700 10px/1 Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#8a6d1f}
  .po{font:700 16px 'Courier New',monospace}
  .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 18px;margin:18px 0;font:13px Arial,sans-serif}
  .facts span{display:block;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
  table{width:100%;border-collapse:collapse;font:13px Arial,sans-serif}
  th{text-align:left;border-bottom:1px solid #c4a052;padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
  td{border-bottom:1px dashed #e5dcc3;padding:8px 6px} .r{text-align:right} .muted{color:#94a3b8;text-align:center}
  .totals{margin-top:14px;margin-left:auto;width:280px;font:14px Arial,sans-serif}
  .totals div{display:flex;justify-content:space-between;padding:4px 0} .totals .grand{border-top:3px double #c4a052;font-weight:700;font-size:16px;margin-top:4px;padding-top:8px}
  .notes{margin-top:18px;font:13px Arial,sans-serif;background:#faf8f3;border:1px solid #efe4c4;padding:10px 12px;border-radius:8px}
  .sign{display:flex;gap:40px;margin-top:48px;font:12px Arial,sans-serif;color:#64748b} .sign div{flex:1;border-top:1px solid #94a3b8;padding-top:6px}
</style></head><body>
<div class="top"><div><div class="eyebrow">Purchase order</div><h1>${esc(supplierNameOf(o))}</h1></div><div class="po">${esc(o.po_number || '')}</div></div>
<div class="facts">
  <div><span>Status</span>${esc(statusLabel(o.status))}</div>
  <div><span>Ordered</span>${dateOf(o) ? esc(new Date(dateOf(o)).toLocaleDateString()) : '—'}</div>
  <div><span>Expected delivery</span>${o.expected_delivery_date ? esc(new Date(o.expected_delivery_date).toLocaleDateString()) : 'TBD'}</div>
  <div><span>Priority</span>${esc(o.priority || 'normal')}</div>
  <div><span>Payment</span>${esc(String(o.payment_status || 'unpaid').replace(/_/g, ' '))}</div>
  <div><span>Ordered by</span>${esc(o.orderedBy || o.ordered_by_name || '—')}</div>
</div>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Line total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>Total</span><span>${esc(formatUGX(amountOf(o)))}</span></div><div><span>Paid</span><span>${esc(formatUGX(paidOf(o)))}</span></div><div class="grand"><span>Balance due</span><span>${esc(formatUGX(balanceOf(o)))}</span></div></div>
${o.notes ? `<div class="notes"><b>Notes:</b> ${esc(o.notes)}</div>` : ''}
<div class="sign"><div>Prepared by</div><div>Approved by</div><div>Received by</div></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    w.document.close();
  };

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

  // Approval-with-payment modal. This was previously defined at module scope
  // (after PaymentModal's closing brace) instead of nested here — meaning it
  // referenced showApprovalModal/selectedOrder/approvalData/etc. from a scope
  // that didn't have them, and would throw a ReferenceError the moment it
  // rendered. Moved inside SupplierOrderManagement so it has proper closure
  // access to this component's state.
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

            {/* Delivery Vehicle Choice — manager's own choice at approval
                time, overriding whatever the supplier picked earlier.
                Ship only appears when this specific route genuinely needs
                a sea leg (checked via mbg_route_needs_sea_leg). No "Plane"
                option: Duffel only books passenger flights, there's no
                credentialed air-freight API in this project, so a cargo
                Plane choice would be fake. */}
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <h3 className="font-bold text-gray-800 mb-1">🚚 Delivery Vehicle</h3>
              <p className="text-xs text-gray-600 mb-3">
                {selectedOrder.preferred_vehicle_type
                  ? `Supplier requested: ${selectedOrder.preferred_vehicle_type}. Pick a different one to override it.`
                  : 'Choose what fits this shipment, or leave unset to let dispatch decide automatically.'}
              </p>
              <div className={`grid ${approvalShipOptionAvailable ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                {[
                  { value: 'car', label: 'Car', emoji: '🚗' },
                  { value: 'van', label: 'Van', emoji: '🚐' },
                  { value: 'truck', label: 'Truck', emoji: '🚚' },
                  ...(approvalShipOptionAvailable ? [{ value: 'ship', label: 'Ship', emoji: '🚢' }] : []),
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setApprovalVehicleType(approvalVehicleType === opt.value ? null : opt.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      approvalVehicleType === opt.value
                        ? 'border-purple-600 bg-purple-100'
                        : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-sm font-semibold text-gray-800">{opt.label}</span>
                  </button>
                ))}
              </div>
              {approvalShipOptionAvailable && (
                <p className="text-xs text-blue-700 mt-2">🌊 This route crosses into a different trade bloc — shipping is available.</p>
              )}
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
                  <option value="ican_wallet">🪙 IcanEra Wallet</option>
                </select>
              </div>

              {/* IcanEra Wallet Balance — shown only when paying with ICAN */}
              {approvalData.paymentMethod === 'ican_wallet' && (
                <div className="mb-4 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-300">
                  <div className="text-sm text-gray-600 mb-1">Store Business Account Balance</div>
                  {approvalIcanBalanceLoading ? (
                    <div className="text-sm text-gray-500">Loading balance...</div>
                  ) : (
                    <>
                      <div className="text-xl font-bold text-purple-700">
                        {formatICAN(approvalIcanBalance?.ican || 0)} ICAN
                      </div>
                      {(parseFloat(approvalData.cashPaidNow || 0) + parseFloat(approvalData.initialPayment || 0)) > 0 && (
                        <div className="text-sm text-gray-600 mt-1">
                          This payment needs ≈ {formatICAN(ugxToICAN(parseFloat(approvalData.cashPaidNow || 0) + parseFloat(approvalData.initialPayment || 0)))} ICAN
                          {approvalIcanBalance && approvalIcanBalance.ican < ugxToICAN(parseFloat(approvalData.cashPaidNow || 0) + parseFloat(approvalData.initialPayment || 0)) && (
                            <span className="text-red-600 font-semibold"> — insufficient balance</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {approvalData.paymentMethod === 'ican_wallet' && (
                <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                  <strong>Manager action:</strong> submit the payment request only. The authorized business-wallet administrator receives the notification in ICANera Wallet or CMMS and enters the business-wallet PIN there to approve payment.
                </div>
              )}

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
              <button
                type="button"
                onClick={submitOrderApproval}
                disabled={
                  approvalData.paymentMethod === 'ican_wallet' &&
                  (parseFloat(approvalData.cashPaidNow || 0) + parseFloat(approvalData.initialPayment || 0)) > 0 &&
                  approvalIcanBalance &&
                  approvalIcanBalance.ican < ugxToICAN(parseFloat(approvalData.cashPaidNow || 0) + parseFloat(approvalData.initialPayment || 0))
                }
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <FiCheckCircle className="h-5 w-5" />
                <span>Approve Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasFilters = statusFilter !== 'all' || priorityFilter !== 'all' || paymentFilter !== 'all' || quickFilter !== 'all' || searchTerm;
  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setPaymentFilter('all');
    setQuickFilter('all');
    setSearchTerm('');
  };
  const paidShare = realTimeStats.totalValue > 0 ? Math.min(100, Math.round((realTimeStats.totalPaidAmount / realTimeStats.totalValue) * 100)) : 0;

  return (
    <div className="pol animate-fadeInUp">
      {/* Ledger header */}
      <section className="pol-hero">
        <div className="pol-hero-main">
          <p className="pol-eyebrow">Purchase order ledger</p>
          <h2 className="pol-title">Orders</h2>
          <p className="pol-sub">Buy from suppliers, approve, pay, receive and shelve — every order in one book.</p>
          {storeId && (
            <label className="pol-pricing">
              <span>Order using</span>
              <select value={wholesalePricingMode} onChange={e => saveWholesalePricingMode(e.target.value)}>
                <option value="supplier_price">Supplier price</option>
                <option value="admin_price">Admin-set price</option>
              </select>
            </label>
          )}
        </div>
        <div className="pol-hero-actions">
          <button type="button" className="pol-btn pol-btn-gold" onClick={() => setShowCreateModal(true)}>
            <FiPlus /> New purchase order
          </button>
          <div className="pol-hero-row">
            <button type="button" className="pol-btn pol-btn-ghost" onClick={loadAllData} aria-label="Refresh orders">
              <FiRefreshCw /> Refresh
            </button>
            <button type="button" className="pol-btn pol-btn-ghost" onClick={exportOrdersCsv} disabled={visibleOrders.length === 0}>
              <FiDownload /> Export
            </button>
          </div>
        </div>
      </section>

      {/* Money strip */}
      <section className="pol-money" aria-label="Order money summary">
        <div className="pol-money-cell">
          <span className="pol-money-label">Order value</span>
          <b className="pol-money-value"><Money v={realTimeStats.totalValue} /></b>
          <small>{realTimeStats.totalOrders} {realTimeStats.totalOrders === 1 ? 'order' : 'orders'}</small>
        </div>
        <div className="pol-money-cell is-ok">
          <span className="pol-money-label">Paid</span>
          <b className="pol-money-value"><Money v={realTimeStats.totalPaidAmount} /></b>
          <small>{realTimeStats.paidOrders} settled · {realTimeStats.partiallyPaidOrders} part-paid</small>
        </div>
        <div className="pol-money-cell is-due">
          <span className="pol-money-label">Outstanding</span>
          <b className="pol-money-value"><Money v={realTimeStats.totalOutstanding} /></b>
          <small>{realTimeStats.unpaidOrders} unpaid</small>
        </div>
        <div className="pol-money-bar" role="img" aria-label={`${paidShare}% of order value paid`}>
          <span style={{ width: `${paidShare}%` }} />
          <em>{paidShare}% paid</em>
        </div>
      </section>

      {/* Active / history */}
      <div className="pol-views" role="tablist" aria-label="Order view">
        <button type="button" role="tab" aria-selected={viewMode === 'active'} className={viewMode === 'active' ? 'is-on' : ''} onClick={() => setViewMode('active')}>
          <FiTruck /> Active orders
        </button>
        <button type="button" role="tab" aria-selected={viewMode === 'history'} className={viewMode === 'history' ? 'is-on' : ''} onClick={() => setViewMode('history')}>
          <FiClock /> Order history
        </button>
      </div>

      {/* Pipeline — tap a stage to filter */}
      <section className="pol-panel" aria-label="Order pipeline">
        <div className="pol-panel-head">
          <div>
            <h3>Where every order stands</h3>
            <p>Tap a stage to see only those orders</p>
          </div>
          {statusFilter !== 'all' && (
            <button type="button" className="pol-link" onClick={() => setStatusFilter('all')}>Show all <FiX /></button>
          )}
        </div>
        <ol className="pol-stages">
          {ORDER_STAGES.map((stage) => {
            const count = stageCounts[stage.id] || 0;
            const on = statusFilter === stage.id;
            return (
              <li key={stage.id} className={`${count > 0 ? 'has' : ''} ${on ? 'is-on' : ''}`}>
                <button type="button" onClick={() => setStatusFilter(on ? 'all' : stage.id)} aria-pressed={on}>
                  <span className="pol-stage-dot">{stage.icon}</span>
                  <span className="pol-stage-count">{count}</span>
                  <span className="pol-stage-label">{stage.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Search, quick filters, sort */}
      <section className="pol-panel pol-tools">
        <div className="pol-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Search PO number, supplier, item or who ordered…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear search"><FiX /></button>}
        </div>
        <div className="pol-chips" role="group" aria-label="Quick filters">
          {QUICK_FILTERS.map((q) => (
            <button key={q.id} type="button" className={`pol-chip ${quickFilter === q.id ? 'is-on' : ''}`} onClick={() => setQuickFilter(q.id)} aria-pressed={quickFilter === q.id}>
              {q.label}
              {q.id !== 'all' && quickCounts[q.id] > 0 && <span>{quickCounts[q.id]}</span>}
            </button>
          ))}
        </div>
        <div className="pol-selects">
          <label>
            <span>Priority</span>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            <span>Payment</span>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Part-paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="value">Highest value</option>
              <option value="balance">Most owed</option>
            </select>
          </label>
          {hasFilters && (
            <button type="button" className="pol-link" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
        <p className="pol-count">
          Showing <b>{visibleOrders.length}</b> of {orders.length} {viewMode === 'history' ? 'past' : ''} {orders.length === 1 ? 'order' : 'orders'}
        </p>
      </section>

      {/* Order dockets */}
      <div className="pol-list">
        {visibleOrders.length === 0 ? (
          <div className="pol-empty">
            <FiPackage />
            <h3>No orders here</h3>
            <p>{hasFilters ? 'Nothing matches these filters.' : 'Create your first purchase order to get started.'}</p>
            {hasFilters ? (
              <button type="button" className="pol-btn pol-btn-ink" onClick={clearFilters}>Clear filters</button>
            ) : (
              <button type="button" className="pol-btn pol-btn-gold" onClick={() => setShowCreateModal(true)}><FiPlus /> New purchase order</button>
            )}
          </div>
        ) : (
          visibleOrders.map((order) => {
            const open = expandedOrderId === order.id;
            const total = amountOf(order);
            const paid = paidOf(order);
            const balance = balanceOf(order);
            const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            const stageIdx = stageIndexOf(order.status);
            const late = isLate(order);
            const next = nextActionOf(order);
            const cancelledOrder = order.status === 'cancelled' || order.status === 'rejected';
            return (
              <article key={order.id} className={`pol-docket ${open ? 'is-open' : ''} ${cancelledOrder ? 'is-void' : ''} pr-${order.priority || 'normal'}`}>
                <button
                  type="button"
                  className="pol-docket-head"
                  onClick={() => setExpandedOrderId(open ? null : order.id)}
                  aria-expanded={open}
                >
                  <span className="pol-docket-top">
                    <span className="pol-po">{order.po_number || `PO-${String(order.id).slice(0, 8)}`}</span>
                    <span className={`pol-pill st-${order.status}`}>{statusLabel(order.status)}</span>
                    {(order.priority === 'urgent' || order.priority === 'high') && (
                      <span className={`pol-pill pr-pill-${order.priority}`}>{order.priority === 'urgent' ? 'Urgent' : 'High'}</span>
                    )}
                    {late && <span className="pol-pill pol-pill-late"><FiAlertTriangle /> Late</span>}
                    {order.unconfirmedPaymentsCount > 0 && (
                      <span className="pol-pill pol-pill-wait">{order.unconfirmedPaymentsCount} payment{order.unconfirmedPaymentsCount === 1 ? '' : 's'} unconfirmed</span>
                    )}
                  </span>
                  <span className="pol-docket-mid">
                    <span className="pol-supplier">
                      <b>{supplierNameOf(order)}</b>
                      <small>
                        Ordered {dateOf(order) ? new Date(dateOf(order)).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        {order.expected_delivery_date && ` · due ${new Date(order.expected_delivery_date).toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
                        {Array.isArray(order.items) && order.items.length > 0 && ` · ${order.items.length} item${order.items.length === 1 ? '' : 's'}`}
                      </small>
                    </span>
                    <span className="pol-amount">
                      <b><Money v={total} /></b>
                      {cancelledOrder ? (
                        <small>Cancelled</small>
                      ) : (
                        <small className={balance > 0 ? 'is-due' : 'is-ok'}>{balance > 0 ? <><Money v={balance} /> owed</> : 'Fully paid'}</small>
                      )}
                    </span>
                  </span>
                  {!cancelledOrder && (
                    <span className="pol-track" aria-label={`Stage ${stageIdx + 1} of ${ORDER_STAGES.length}`}>
                      {ORDER_STAGES.map((s, i) => (
                        <i key={s.id} className={i <= stageIdx ? 'done' : ''} title={s.label} />
                      ))}
                    </span>
                  )}
                  <span className="pol-paybar"><span style={{ width: `${paidPct}%` }} /></span>
                  <FiChevronDown className="pol-chev" />
                </button>

                {/* one-tap next step, without opening the docket */}
                {next && !open && (
                  <div className="pol-next">
                    <span>Next: <b>{next.hint}</b></span>
                    <button type="button" className={`pol-btn pol-btn-sm ${next.tone}`} onClick={next.run}>
                      {next.icon} {next.label}
                    </button>
                  </div>
                )}

                {open && (
                  <div className="pol-docket-body">
                    <div className="pol-facts">
                      <div><span>Supplier</span><b>{supplierNameOf(order)}</b></div>
                      <div><span>Ordered</span><b>{dateOf(order) ? new Date(dateOf(order)).toLocaleDateString() : '—'}</b></div>
                      <div><span>Expected</span><b className={late ? 'is-due' : ''}>{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'TBD'}</b></div>
                      <div><span>Ordered by</span><b>{order.orderedBy || order.ordered_by_name || '—'}</b></div>
                      <div><span>Paid</span><b className="is-ok"><Money v={paid} /></b></div>
                      <div><span>Balance</span><b className={balance > 0 ? 'is-due' : 'is-ok'}><Money v={balance} /></b></div>
                    </div>

                    {Array.isArray(order.items) && order.items.length > 0 && (
                      <div className="pol-items">
                        <p className="pol-eyebrow">Items ({order.items.length})</p>
                        <ul>
                          {order.items.map((item, idx) => {
                            const unit = parseFloat(item.unit_price ?? item.unitPrice) || 0;
                            return (
                              <li key={idx}>
                                <span>{item.product_name || item.productName || 'Item'} <em>× {item.quantity}</em></span>
                                <b><Money v={unit * (Number(item.quantity) || 0)} /></b>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {order.notes && <p className="pol-notes"><b>Notes:</b> {order.notes}</p>}

                    {PAYABLE_STATUSES.includes(order.status) && (
                      <div className="pol-tracker">
                        <OrderPaymentTracker
                          order={order}
                          businessProfileId={activeBusinessProfileId}
                          pricingMode={wholesalePricingMode}
                          onPaymentAdded={loadAllData}
                          showAddPayment={true}
                          userRole="manager"
                        />
                      </div>
                    )}

                    <div className="pol-actions">
                      {order.status === 'approved' && (
                        <button type="button" className="pol-btn pol-btn-ink" onClick={(e) => { e.stopPropagation(); handleSendToSupplier(order.id); }}>
                          <FiSend /> Send to supplier
                        </button>
                      )}
                      {(order.status === 'sent_to_supplier' || order.status === 'confirmed') && (
                        <button type="button" className="pol-btn pol-btn-teal" onClick={(e) => { e.stopPropagation(); handleMarkAsReceived(order.id); }}>
                          <FiTruck /> Mark received &amp; update stock
                        </button>
                      )}
                      {order.status === 'received' && (
                        <button type="button" className="pol-btn pol-btn-green" onClick={(e) => { e.stopPropagation(); handleMarkAsCompleted(order.id); }}>
                          <FiCheckCircle /> Mark completed
                        </button>
                      )}
                      {PAYABLE_STATUSES.includes(order.status) && order.payment_status !== 'paid' && (
                        <button type="button" className="pol-btn pol-btn-gold" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowPaymentModal(true); }}>
                          <FiDollarSign /> Add payment
                        </button>
                      )}
                      <button
                        type="button"
                        className="pol-btn pol-btn-outline"
                        onClick={(e) => { e.stopPropagation(); handleAddOrderProductsToPOS(order); }}
                        title={order.added_to_pos ? 'This order has already been added to POS' : 'Add all order products to POS inventory'}
                        disabled={!order.items || order.items.length === 0 || order.added_to_pos}
                      >
                        <FiPlus /> {order.added_to_pos ? 'Added to POS' : 'Add to POS'}
                      </button>
                      <button type="button" className="pol-btn pol-btn-outline" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>
                        <FiEdit /> Details
                      </button>
                      <button type="button" className="pol-btn pol-btn-outline" onClick={(e) => { e.stopPropagation(); printOrderDocket(order); }} title="Print or save this order as PDF">
                        <FiPrinter /> Print
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Stock on the shelves — folded away until needed */}
      <section className={`pol-panel pol-shelf ${showShelf ? 'is-open' : ''}`}>
        <button type="button" className="pol-shelf-head" onClick={() => setShowShelf((v) => !v)} aria-expanded={showShelf}>
          <span>
            <h3>Stock on your shelves</h3>
            <p>{products.length} products · {shelfStats.low} low · {shelfStats.out} out of stock</p>
          </span>
          <span className="pol-link">{showShelf ? 'Hide' : 'Show'} <FiChevronDown className="pol-chev" /></span>
        </button>
        {showShelf && (
          products.length > 0 ? (
            <ul className="pol-shelf-list">
              {products.map((product) => {
                const stock = stockOf(product);
                const min = Number(product.inventory?.[0]?.minimum_stock) || 0;
                const state = stock <= 0 ? 'out' : stock <= Math.max(min, 10) ? 'low' : 'ok';
                return (
                  <li key={product.id}>
                    <span>
                      <b>{product.name}</b>
                      <small>SKU {product.sku || '—'} · <Money v={product.selling_price || product.price || 0} /></small>
                    </span>
                    <em className={`pol-stock is-${state}`}>{state === 'out' ? 'Out' : `${stock} in stock`}</em>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="pol-empty pol-empty-sm"><p>No products in POS inventory yet — add them from a received order.</p></div>
          )
        )}
      </section>

      {/* Create Order Modal */}
      {showCreateModal && (
      <CreateOrderModal
          suppliers={suppliers}
          storeName={branding.name}
          businessProfileId={activeBusinessProfileId}
          pricingMode={wholesalePricingMode}
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
                      <p className="font-bold text-lg text-green-600"><Money v={amountOf(selectedOrder)} /></p>
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
                      <p className="font-bold text-lg text-red-600"><Money v={balanceOf(selectedOrder)} /></p>
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
                                <td className="px-4 py-3 text-right"><Money v={item.unit_price || item.unitPrice} /></td>
                                <td className="px-4 py-3 text-right font-semibold">
                                  <Money v={(item.unit_price || item.unitPrice) * item.quantity} />
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
                  businessProfileId={activeBusinessProfileId}
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
          businessProfileId={activeBusinessProfileId}
          storeName={branding.name}
          supplierName={supplierNameOf(selectedOrder)}
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

      {/* Approval Modal — was defined but never mounted here, so the
          "Approve" action (handleApproveOrder) set showApprovalModal to
          true with no visible effect. Its own submitOrderApproval also
          depended on the approve_order_with_payment RPC, which — like
          record_payment_with_tracking — was never actually created on
          this DB; both issues are fixed above. */}
      <ApprovalModal />

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
const CreateOrderModal = ({ suppliers, businessProfileId, storeName = 'Your store', pricingMode = 'supplier_price', onClose, onSuccess }) => {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({
    productName: '',
    quantity: 1,
    unitPrice: 0
  });
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(`${storeName} — main store`);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // NEW: Payment fields for cash paid at order creation
  const [cashPaidNow, setCashPaidNow] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [icanBalance, setIcanBalance] = useState(null);
  const [icanBalanceLoading, setIcanBalanceLoading] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [walletPin, setWalletPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  // Load the manager's live ICAN balance when they switch to the ICAN Wallet method
  useEffect(() => {
    if (paymentMethod !== 'ican_wallet' || icanBalance !== null || icanBalanceLoading) return;

    setIcanBalanceLoading(true);
    getBusinessWalletBalance(businessProfileId)
      .then((bal) => setIcanBalance(bal))
      .catch(() => setIcanBalance(null))
      .finally(() => setIcanBalanceLoading(false));
  }, [paymentMethod, icanBalance, icanBalanceLoading, businessProfileId]);

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
      goToSection('supplier');
      alert('Please select a supplier');
      return;
    }

    if (orderItems.length === 0) {
      goToSection('items');
      alert('Please add at least one item');
      return;
    }

    if (!expectedDeliveryDate) {
      goToSection('delivery');
      alert('Please select expected delivery date');
      return;
    }

    // An ICAN selection creates only a purchase order. Once the order is
    // approved, the manager submits the separate wallet request and the
    // authorized business-wallet administrator approves it with the PIN.
    if (paymentMethod === 'ican_wallet') {
      await createOrder(null);
      return;
    }

    setWalletPin('');
    setPinError('');
    setShowPinPrompt(true);
  };

  const confirmCreateOrder = async () => {
    if (!/^\d{4,6}$/.test(walletPin)) {
      setPinError('Enter your 4-6 digit IcanEra Wallet PIN.');
      return;
    }

    setVerifyingPin(true);
    setPinError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setPinError('Your session has expired. Please log in again.');
        return;
      }

      // This is the manager's personal confirmation PIN for a cash order.
      // It never authorizes a business-wallet transfer.
      if (paymentMethod !== 'ican_wallet') {
        const pinCheck = await verifyPin(user.id, walletPin);
        if (!pinCheck.success) {
          setPinError(pinCheck.error || 'PIN verification failed. Order was not sent.');
          return;
        }
      }

      setShowPinPrompt(false);
      setWalletPin('');
      await createOrder();
    } catch (err) {
      console.error('PIN verification failed:', err);
      setPinError('PIN verification failed. Order was not sent.');
    } finally {
      setVerifyingPin(false);
    }
  };

  const createOrder = async () => {

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
        
        // New orders remain pending approval. Cash can be recorded now, but an
        // ICAN business-wallet request must wait for approval; the authorized
        // wallet administrator is notified only after that request is created.
        if (cashPaidNow && parseFloat(cashPaidNow) > 0 && response.order?.id) {
          try {
            if (paymentMethod === 'ican_wallet') {
              const payResult = await supplierOrdersService.payOrderWithICAN({ orderId: response.order.id, ugxAmount: parseFloat(cashPaidNow) });
              if (!payResult.success) throw new Error(payResult.error);
              successMsg += `\n\n🪙 ICAN PAYMENT REQUEST SENT.` +
                `\nThe authorized business-wallet administrator has been notified and must open the request in ICANera Wallet or CMMS, then enter the business-wallet PIN to approve payment.`;
            } else {
              const payResult = await supplierOrdersService.recordPayment({
                orderId:          response.order.id,
                amountPaid:       parseFloat(cashPaidNow),
                paymentMethod:    paymentMethod,
                paymentReference: paymentReference || `ORDER-CREATE-${response.order.id.substring(0, 8)}`,
                notes:            `Payment made at order creation. ${paymentNotes}`,
                paidBy:           managerId
              });

              if (!payResult.success) {
                console.error('⚠️ Payment recording error:', payResult.error);
                successMsg += `\n\n⚠️ Warning: Order created but payment tracking failed: ${payResult.error || 'table may not exist yet — run CREATE_PAYMENT_TRANSACTIONS_TABLE.sql'}`;
              } else {
                successMsg += `\n\n💵 CASH PAID: ${formatUGX(cashPaidNow)}`;
                successMsg += `\n⏳ Awaiting supplier confirmation`;
              }
            }
          } catch (paymentErr) {
            console.error('⚠️ Payment recording error:', paymentErr);
            successMsg += '\n\n⚠️ Order created but payment recording failed';
          }
        }
        
        successMsg = successMsg.replace('no confirmation needed', 'awaiting supplier confirmation');
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

  // ---- Sheet layout: one section open at a time, step rail on top ----
  const [openSection, setOpenSection] = useState('supplier');
  const [supplierQuery, setSupplierQuery] = useState('');
  const supplierObj = suppliers.find((sup) => sup.id === selectedSupplier) || null;
  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((sup) => `${sup.business_name} ${sup.supplier_code}`.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);
  const cashNow = parseFloat(cashPaidNow) || 0;
  const dayFromNow = (d) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const steps = [
    { id: 'supplier', label: 'Supplier', done: Boolean(selectedSupplier) },
    { id: 'items', label: 'Items', done: orderItems.length > 0 },
    { id: 'delivery', label: 'Delivery', done: Boolean(expectedDeliveryDate && deliveryAddress) },
    { id: 'payment', label: 'Payment', done: cashNow > 0 }
  ];
  const missing = [
    !selectedSupplier && 'supplier',
    orderItems.length === 0 && 'items',
    !expectedDeliveryDate && 'delivery date'
  ].filter(Boolean);
  const goToSection = (id) => {
    setOpenSection(id);
    requestAnimationFrame(() => document.getElementById(`po-sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const toggleSection = (id) => (openSection === id ? setOpenSection(null) : goToSection(id));

  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="po-backdrop">
      {showPinPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">Confirm Purchase Order</h3>
            <p className="mt-2 text-sm text-gray-600">
                Enter your personal IcanEra confirmation PIN to submit this cash order. This PIN cannot approve or spend from the store business wallet.
              </p>
              <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                <strong>Business-wallet protection:</strong> ICAN supplier payments are requested only after the purchase order is approved. The authorized business-wallet administrator receives the notification in ICANera Wallet or CMMS and must enter the business-wallet PIN to approve payment.
              </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (!verifyingPin) confirmCreateOrder(); }}
              className="mt-5"
            >
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="purchase-order-wallet-pin">
                Personal confirmation PIN
              </label>
              <input
                id="purchase-order-wallet-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                value={walletPin}
                onChange={(e) => setWalletPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg tracking-[0.35em] focus:border-blue-500 focus:outline-none"
                placeholder="••••••"
                autoFocus
              />
              {pinError && <p className="mt-2 text-sm font-medium text-red-600">{pinError}</p>}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowPinPrompt(false); setWalletPin(''); setPinError(''); }}
                  disabled={verifyingPin}
                  className="rounded-lg border-2 border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPin || walletPin.length < 4}
                  className="rounded-lg bg-gradient-to-r from-green-600 to-blue-600 px-5 py-2.5 font-bold text-white hover:from-green-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {verifyingPin ? 'Verifying...' : 'Verify & Submit Cash Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="po-sheet" role="dialog" aria-modal="true" aria-labelledby="po-title">
        {/* Header */}
        <header className="po-head">
          <div className="po-head-main">
            <p className="po-eyebrow">{storeName} · New purchase order</p>
            <h2 id="po-title">Order stock</h2>
          </div>
          <button type="button" className="po-close" onClick={onClose} disabled={submitting} aria-label="Close">
            <FiX />
          </button>
        </header>

        {/* Step rail — tap to jump; ticks show what's done */}
        <nav className="po-steps" aria-label="Order steps">
          {steps.map((st, i) => (
            <button
              key={st.id}
              type="button"
              className={`po-step ${st.done ? 'is-done' : ''} ${openSection === st.id ? 'is-on' : ''}`}
              onClick={() => goToSection(st.id)}
            >
              <span className="po-step-dot">{st.done ? <FiCheck /> : i + 1}</span>
              <span className="po-step-label">{st.label}</span>
            </button>
          ))}
        </nav>

        <form onSubmit={handleSubmit} className="po-form">
          <div className="po-layout">
            <div className="po-main">
              {/* 1 · Supplier */}
              <section id="po-sec-supplier" className={`po-sec ${openSection === 'supplier' ? 'is-open' : ''}`}>
                <button type="button" className="po-sec-head" onClick={() => toggleSection('supplier')} aria-expanded={openSection === 'supplier'}>
                  <span className="po-sec-num">1</span>
                  <span className="po-sec-title"><b>Supplier</b><small>{supplierObj ? supplierObj.business_name : 'Choose who you are buying from'}</small></span>
                  <FiChevronDown className="po-chev" />
                </button>
                {openSection === 'supplier' && (
                  <div className="po-sec-body">
                    <div className="po-search">
                      <FiSearch />
                      <input
                        type="text"
                        value={supplierQuery}
                        onChange={(e) => setSupplierQuery(e.target.value)}
                        placeholder={`Search ${suppliers.length} suppliers & wholesalers`}
                      />
                    </div>
                    {filteredSuppliers.length === 0 ? (
                      <p className="po-empty">{suppliers.length === 0 ? 'No active suppliers yet.' : 'No supplier matches that search.'}</p>
                    ) : (
                      <div className="po-suppliers" role="radiogroup" aria-label="Supplier">
                        {filteredSuppliers.map((sup) => (
                          <button
                            key={sup.id}
                            type="button"
                            role="radio"
                            aria-checked={selectedSupplier === sup.id}
                            className={`po-supplier ${selectedSupplier === sup.id ? 'is-on' : ''}`}
                            onClick={() => { setSelectedSupplier(sup.id); setOpenSection('items'); }}
                          >
                            <span className="po-supplier-avatar">{(sup.business_name || 'S').charAt(0).toUpperCase()}</span>
                            <span className="po-supplier-text"><b>{sup.business_name}</b><small>{sup.supplier_code}</small></span>
                            {selectedSupplier === sup.id && <FiCheckCircle className="po-supplier-tick" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* 2 · Items */}
              <section id="po-sec-items" className={`po-sec ${openSection === 'items' ? 'is-open' : ''}`}>
                <button type="button" className="po-sec-head" onClick={() => toggleSection('items')} aria-expanded={openSection === 'items'}>
                  <span className="po-sec-num">2</span>
                  <span className="po-sec-title">
                    <b>Items</b>
                    <small>{orderItems.length > 0 ? `${orderItems.length} item${orderItems.length === 1 ? '' : 's'} · ${ugxShort(totals.total)}` : 'Pick products from the catalog'}</small>
                  </span>
                  <FiChevronDown className="po-chev" />
                </button>
                {/* Kept mounted so the picker keeps its search state while folded */}
                <div className="po-sec-body" hidden={openSection !== 'items'}>
                  <OrderItemsSelector
                    orderItems={orderItems}
                    onItemsChange={setOrderItems}
                    totals={totals}
                    pricingMode={pricingMode}
                    supplierId={selectedSupplier}
                    supplierBusinessProfileId={supplierObj?.supplier_business_profile_id || ''}
                    onTotalsChange={setTotals}
                  />
                </div>
              </section>

              {/* 3 · Delivery */}
              <section id="po-sec-delivery" className={`po-sec ${openSection === 'delivery' ? 'is-open' : ''}`}>
                <button type="button" className="po-sec-head" onClick={() => toggleSection('delivery')} aria-expanded={openSection === 'delivery'}>
                  <span className="po-sec-num">3</span>
                  <span className="po-sec-title">
                    <b>Delivery</b>
                    <small>{expectedDeliveryDate ? `Due ${new Date(`${expectedDeliveryDate}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${priority} priority` : 'When and where it should arrive'}</small>
                  </span>
                  <FiChevronDown className="po-chev" />
                </button>
                {openSection === 'delivery' && (
                  <div className="po-sec-body po-grid">
                    <div className="po-field">
                      <label htmlFor="po-date">Expected delivery *</label>
                      <input id="po-date" className="po-input" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} min={dayFromNow(0)} required />
                      <div className="po-chips">
                        {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([label, d]) => (
                          <button key={label} type="button" className={expectedDeliveryDate === dayFromNow(d) ? 'is-on' : ''} onClick={() => setExpectedDeliveryDate(dayFromNow(d))}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="po-field">
                      <span className="po-label">Priority</span>
                      <div className="po-seg" role="radiogroup" aria-label="Priority">
                        {['low', 'normal', 'high', 'urgent'].map((p) => (
                          <button key={p} type="button" role="radio" aria-checked={priority === p} className={`${priority === p ? 'is-on' : ''} pr-${p}`} onClick={() => setPriority(p)}>{p}</button>
                        ))}
                      </div>
                    </div>
                    <div className="po-field po-span">
                      <label htmlFor="po-addr">Deliver to *</label>
                      <input id="po-addr" className="po-input" type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Delivery address" required />
                    </div>
                    <div className="po-field">
                      <label htmlFor="po-instr">Delivery instructions <em>optional</em></label>
                      <textarea id="po-instr" className="po-input" rows="2" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} placeholder="Gate, contact person, unloading…" />
                    </div>
                    <div className="po-field">
                      <label htmlFor="po-notes">Notes for the supplier <em>optional</em></label>
                      <textarea id="po-notes" className="po-input" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brands, packaging, anything else" />
                    </div>
                  </div>
                )}
              </section>

              {/* 4 · Payment */}
              <section id="po-sec-payment" className={`po-sec ${openSection === 'payment' ? 'is-open' : ''}`}>
                <button type="button" className="po-sec-head" onClick={() => toggleSection('payment')} aria-expanded={openSection === 'payment'}>
                  <span className="po-sec-num">4</span>
                  <span className="po-sec-title">
                    <b>Payment now</b>
                    <small>{cashNow > 0 ? `${ugxShort(cashNow)} by ${paymentMethod === 'ican_wallet' ? 'IcanEra Wallet' : 'cash'}` : 'Optional — pay later from the order'}</small>
                  </span>
                  <FiChevronDown className="po-chev" />
                </button>
                {openSection === 'payment' && (
                  <div className="po-sec-body">
                    <div className="po-field">
                      <label htmlFor="po-cash">Amount paid now <em>UGX · leave 0 to pay later</em></label>
                      <input id="po-cash" className="po-input po-input-big" type="number" inputMode="numeric" value={cashPaidNow} onChange={(e) => setCashPaidNow(e.target.value)} min="0" max={totals.total} step="any" placeholder="0" />
                      {totals.total > 0 && (
                        <div className="po-chips">
                          <button type="button" className={cashNow === 0 ? 'is-on' : ''} onClick={() => setCashPaidNow(0)}>Pay later</button>
                          <button type="button" className={cashNow === Math.round(totals.total / 2) ? 'is-on' : ''} onClick={() => setCashPaidNow(Math.round(totals.total / 2))}>Half</button>
                          <button type="button" className={cashNow === Math.round(totals.total) ? 'is-on' : ''} onClick={() => setCashPaidNow(Math.round(totals.total))}>In full</button>
                        </div>
                      )}
                    </div>
                    {cashNow > 0 && (
                      <>
                        <div className="po-methods" role="radiogroup" aria-label="Payment method">
                          {[['cash', 'Cash', 'Supplier confirms receipt'], ['ican_wallet', 'IcanEra Wallet', 'Requested after approval']].map(([id, t, sub]) => (
                            <button key={id} type="button" role="radio" aria-checked={paymentMethod === id} className={`po-method ${paymentMethod === id ? 'is-on' : ''}`} onClick={() => setPaymentMethod(id)}>
                              <b>{t}</b><small>{sub}</small>
                            </button>
                          ))}
                        </div>
                        {paymentMethod === 'ican_wallet' ? (
                          <div className="po-callout">
                            <div className="po-callout-top"><span>Store business account</span><b>{icanBalanceLoading ? 'Loading…' : `${formatICAN(icanBalance?.ican || 0)} ICAN`}</b></div>
                            <p>Needs ≈ {formatICAN(ugxToICAN(cashNow))} ICAN{icanBalance && icanBalance.ican < ugxToICAN(cashNow) ? ' — not enough balance' : ''}. No ICAN moves now: after approval, the wallet administrator approves the request with the business-wallet PIN.</p>
                          </div>
                        ) : (
                          <div className="po-field">
                            <label htmlFor="po-ref">Reference <em>optional</em></label>
                            <input id="po-ref" className="po-input" type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Receipt or transaction number" />
                          </div>
                        )}
                        <div className="po-field">
                          <label htmlFor="po-pnotes">Payment notes <em>optional</em></label>
                          <textarea id="po-pnotes" className="po-input" rows="2" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Anything about this payment" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* Order summary — a sticky receipt beside the form on wide screens */}
            <aside className="po-receipt" aria-label="Order summary">
              <p className="po-eyebrow">Order summary</p>
              <p className="po-receipt-supplier">{supplierObj ? supplierObj.business_name : 'No supplier yet'}</p>
              {orderItems.length > 0 ? (
                <ul className="po-receipt-items">
                  {orderItems.slice(0, 6).map((it, i) => (
                    <li key={it.id || i}>
                      <span>{it.product_name || it.productName} <em>× {it.quantity}</em></span>
                      <b><Money v={it.total ?? (Number(it.quantity) || 0) * (parseFloat(it.unit_price ?? it.unitPrice) || 0)} /></b>
                    </li>
                  ))}
                  {orderItems.length > 6 && <li className="po-more">+ {orderItems.length - 6} more</li>}
                </ul>
              ) : (
                <p className="po-receipt-empty">Items you add will appear here.</p>
              )}
              <div className="po-receipt-rows">
                <div><span>Subtotal</span><b><Money v={totals.subtotal} /></b></div>
                <div><span>VAT 18%</span><b><Money v={totals.tax} /></b></div>
                <div className="po-receipt-grand"><span>Total</span><b><Money v={totals.total} /></b></div>
                {cashNow > 0 && <div><span>Paying now</span><b className="po-ok"><Money v={cashNow} /></b></div>}
                {cashNow > 0 && <div><span>Balance after</span><b className="po-due"><Money v={Math.max(0, totals.total - cashNow)} /></b></div>}
              </div>
            </aside>
          </div>

          {/* Sticky footer */}
          <footer className="po-foot">
            <div className="po-foot-total">
              <span>{missing.length ? `Still needed: ${missing.join(', ')}` : 'Ready to send'}</span>
              <b><Money v={totals.total} /></b>
            </div>
            <div className="po-foot-actions">
              <button type="button" className="po-btn po-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="po-btn po-btn-gold" disabled={submitting || orderItems.length === 0}>
                {submitting ? <><span className="pm-spin" /> Creating…</> : <><FiCheckCircle /> Create order</>}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

// =====================================================================
// PAYMENT MODAL COMPONENT
// =====================================================================
const PaymentModal = ({ order, businessProfileId, storeName = 'Your store', supplierName = 'Supplier', onClose, onSuccess }) => {
  // Tolerate both the old and new purchase_orders columns (the old modal read
  // balance_due only, so orders stored with balance_due_ugx showed "Maximum: UGX 0")
  const orderTotal = parseFloat(order.total_amount_ugx ?? order.total_amount) || 0;
  const paidRaw = parseFloat(order.amount_paid_ugx ?? order.amount_paid);
  const alreadyPaid = Number.isNaN(paidRaw) ? (order.payment_status === 'paid' ? orderTotal : 0) : paidRaw;
  const dueRaw = parseFloat(order.balance_due_ugx ?? order.balance_due);
  const balanceDue = order.payment_status === 'paid' ? 0 : (Number.isNaN(dueRaw) ? Math.max(0, orderTotal - alreadyPaid) : dueRaw);

  const [amountPaid, setAmountPaid] = useState('');
  // A pending order can only be paid as an ICAN wallet request
  const [paymentMethod, setPaymentMethod] = useState(order.status === 'pending_approval' ? 'ican_wallet' : 'cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [icanBalance, setIcanBalance] = useState(null);
  const [icanBalanceLoading, setIcanBalanceLoading] = useState(false);

  // Load the manager's live ICAN balance when they switch to the IcanEra Wallet method
  useEffect(() => {
    if (paymentMethod !== 'ican_wallet' || icanBalance !== null || icanBalanceLoading) return;

    setIcanBalanceLoading(true);
    getBusinessWalletBalance(businessProfileId)
      .then((bal) => setIcanBalance(bal))
      .catch(() => setIcanBalance(null))
      .finally(() => setIcanBalanceLoading(false));
  }, [paymentMethod, icanBalance, icanBalanceLoading, businessProfileId]);

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

    if (!['pending_approval', 'approved', 'sent_to_supplier', 'confirmed', 'received'].includes(order.status)) {
      alert('This purchase order is not available for payment in its current status.');
      return;
    }

    if (order.status === 'pending_approval' && paymentMethod !== 'ican_wallet') {
      alert('A pending purchase order can only be submitted as an ICAN business-wallet approval request. Select ICANera Wallet to notify the authorized administrator.');
      return;
    }

    const amount = parseFloat(amountPaid);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (amount > balanceDue) {
      alert(`Payment amount cannot exceed balance due: ${formatUGX(balanceDue)}`);
      return;
    }

    if (paymentMethod === 'ican_wallet') {
      const icanNeeded = ugxToICAN(amount);
      if (!icanBalance || icanBalance.ican < icanNeeded) {
        alert(
          `Insufficient ICAN balance.\n\n` +
          `Needed: ${formatICAN(icanNeeded)} ICAN\n` +
          `Available: ${formatICAN(icanBalance?.ican || 0)} ICAN`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      if (paymentMethod === 'ican_wallet') {
        const payResult = await supplierOrdersService.payOrderWithICAN({
          orderId:        order.id,
          supplierUserId: order.supplier_id,
          supplierBusinessProfileId: order.supplier_business_profile_id,
          icanAmount:     ugxToICAN(amount),
          ugxAmount:      amount,
          businessProfileId,
          notes:          paymentNotes || null,
        });

        if (!payResult.success) {
          if (payResult.requires_order_approval) {
            alert('This purchase order cannot be submitted for wallet approval in its current status.');
            return;
          }
          throw new Error(payResult.error);
        }

        alert(payResult.wallet_approval_required
          ? `🔔 ICAN payment request submitted.\n\nAmount: ${formatUGX(amount)}\n\nAn authorized wallet administrator must approve it with the business-wallet PIN.`
          : `✅ Paid ${formatICAN(ugxToICAN(amount))} ICAN from the store business account!\n\nAmount: ${formatUGX(amount)}\n\nThe supplier's business wallet has been credited.`);
      } else {
        // Get manager ID from localStorage
        const storedUser = localStorage.getItem('supermarket_user');
        if (!storedUser) {
          throw new Error('No user session found');
        }
        const parsedUser = JSON.parse(storedUser);
        const managerId = parsedUser.id;

        // Record payment directly into payment_transactions
        const payResult = await supplierOrdersService.recordPayment({
          orderId:          order.id,
          amountPaid:       amount,
          paymentMethod:    paymentMethod,
          paymentReference: paymentReference || null,
          notes:            paymentNotes || null,
          paidBy:           managerId
        });

        if (!payResult.success) throw new Error(payResult.error);

        alert(`✅ Payment recorded successfully!\n\nAmount Paid: ${formatUGX(amount)}\n⏳ Awaiting supplier confirmation...`);
      }
      onSuccess();
    } catch (err) {
      console.error('Error recording payment:', err);
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const methodBlocked = order.status === 'pending_approval' && paymentMethod !== 'ican_wallet';
  const enteredAmount = parseFloat(amountPaid) || 0;
  const icanShort = paymentMethod === 'ican_wallet' && enteredAmount > 0 && icanBalance && icanBalance.ican < ugxToICAN(enteredAmount);
  const afterPayment = Math.max(0, balanceDue - enteredAmount);
  const paidPct = orderTotal > 0 ? Math.min(100, Math.round((alreadyPaid / orderTotal) * 100)) : 0;
  const newPct = orderTotal > 0 ? Math.min(100 - paidPct, Math.round((Math.min(enteredAmount, balanceDue) / orderTotal) * 100)) : 0;
  const quickAmounts = [
    { label: 'Full balance', value: balanceDue },
    { label: 'Half', value: Math.round(balanceDue / 2) },
    { label: 'Quarter', value: Math.round(balanceDue / 4) }
  ].filter((q) => q.value > 0);

  return (
    <div className="pm-backdrop" role="dialog" aria-modal="true" aria-labelledby="pm-title" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="pm">
        {/* Header */}
        <header className="pm-head">
          <div className="pm-head-main">
            <p className="pm-eyebrow">{storeName} · Payment voucher</p>
            <h2 id="pm-title">Record payment</h2>
            <p className="pm-po"><FiFileText /> {order.po_number || 'Purchase order'} · {supplierName}</p>
          </div>
          <button type="button" className="pm-close" onClick={onClose} disabled={submitting} aria-label="Close">
            <FiX />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="pm-body">
          {/* Receipt-style summary */}
          <section className="pm-receipt" aria-label="Payment summary">
            <div className="pm-row"><span>Order total</span><b><Money v={orderTotal} /></b></div>
            <div className="pm-row"><span>Already paid</span><b className="pm-ok"><Money v={alreadyPaid} /></b></div>
            <div className="pm-row pm-row-grand"><span>Balance due</span><b className={balanceDue > 0 ? 'pm-due' : 'pm-ok'}><Money v={balanceDue} /></b></div>
            <div className="pm-bar" aria-hidden="true">
              <span className="pm-bar-paid" style={{ width: `${paidPct}%` }} />
              <span className="pm-bar-new" style={{ left: `${paidPct}%`, width: `${newPct}%` }} />
            </div>
            <p className="pm-bar-legend">
              <span><i className="is-paid" /> Paid {paidPct}%</span>
              {newPct > 0 && <span><i className="is-new" /> This payment {newPct}%</span>}
            </p>
          </section>

          {balanceDue <= 0 && (
            <p className="pm-note pm-note-ok"><FiCheckCircle /> This order is fully paid — nothing left to record.</p>
          )}

          {/* Amount */}
          <div className="pm-field">
            <label htmlFor="pm-amount">Amount to pay <em>UGX</em></label>
            <div className="pm-amount">
              <span>UGX</span>
              <input
                id="pm-amount"
                type="number"
                inputMode="numeric"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
                min="1"
                max={balanceDue || undefined}
                step="any"
                required
                disabled={balanceDue <= 0}
              />
            </div>
            {quickAmounts.length > 0 && (
              <div className="pm-quick">
                {quickAmounts.map((q) => (
                  <button key={q.label} type="button" onClick={() => setAmountPaid(String(q.value))} className={enteredAmount === q.value ? 'is-on' : ''}>
                    {q.label}<small><Money v={q.value} /></small>
                  </button>
                ))}
              </div>
            )}
            <p className="pm-hint">
              {enteredAmount > balanceDue
                ? <span className="pm-due">More than the balance due of <Money v={balanceDue} /></span>
                : enteredAmount > 0
                  ? <>Balance after this payment: <b><Money v={afterPayment} /></b></>
                  : <>Up to <Money v={balanceDue} /></>}
            </p>
          </div>

          {/* Method */}
          <div className="pm-field">
            <span className="pm-label">Pay with</span>
            <div className="pm-methods" role="radiogroup" aria-label="Payment method">
              {[
                { id: 'cash', title: 'Cash', sub: 'Supplier confirms receipt', icon: <FiDollarSign /> },
                { id: 'ican_wallet', title: 'IcanEra Wallet', sub: 'From the store business account', icon: <span className="pm-coin">₡</span> }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === m.id}
                  className={`pm-method ${paymentMethod === m.id ? 'is-on' : ''}`}
                  onClick={() => setPaymentMethod(m.id)}
                >
                  <span className="pm-method-icon">{m.icon}</span>
                  <span className="pm-method-text"><b>{m.title}</b><small>{m.sub}</small></span>
                  <span className="pm-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            {methodBlocked && (
              <p className="pm-note pm-note-warn"><FiAlertTriangle /> This order is still awaiting approval, so it can only be paid as an IcanEra Wallet request.</p>
            )}
          </div>

          {paymentMethod === 'ican_wallet' && (
            <div className="pm-wallet">
              <div className="pm-wallet-top">
                <span>Store business account</span>
                <b>{icanBalanceLoading ? 'Loading…' : `${formatICAN(icanBalance?.ican || 0)} ICAN`}</b>
              </div>
              {enteredAmount > 0 && !icanBalanceLoading && (
                <p className={icanShort ? 'pm-due' : ''}>
                  Needs ≈ {formatICAN(ugxToICAN(enteredAmount))} ICAN{icanShort ? ' — not enough balance' : ''}
                </p>
              )}
              <p className="pm-wallet-note">This sends an approval request. The authorized wallet administrator approves it with the business-wallet PIN in ICANera Wallet or CMMS.</p>
            </div>
          )}

          {paymentMethod !== 'ican_wallet' && (
            <div className="pm-field">
              <label htmlFor="pm-ref">Reference / receipt number <em>optional</em></label>
              <input
                id="pm-ref"
                className="pm-input"
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. receipt 00123, cheque 12345"
              />
            </div>
          )}

          <div className="pm-field">
            <label htmlFor="pm-notes">Notes <em>optional</em></label>
            <textarea
              id="pm-notes"
              className="pm-input"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Anything the supplier or your team should know"
              rows="2"
            />
          </div>

          {/* Footer */}
          <div className="pm-foot">
            <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button
              type="submit"
              className="pm-btn pm-btn-gold"
              disabled={submitting || balanceDue <= 0 || enteredAmount <= 0 || enteredAmount > balanceDue || methodBlocked || icanShort}
            >
              {submitting ? (
                <><span className="pm-spin" /> Recording…</>
              ) : (
                <><FiCheckCircle /> {paymentMethod === 'ican_wallet' ? 'Request ICAN payment' : `Record ${enteredAmount > 0 ? ugxShort(enteredAmount) : 'payment'}`}</>
              )}
            </button>
          </div>
        </form>
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
