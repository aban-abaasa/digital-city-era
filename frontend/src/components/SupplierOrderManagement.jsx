// =====================================================================
// SUPPLIER ORDER MANAGEMENT COMPONENT - SUPERMARTKERA UGANDA 🇺🇬
// =====================================================================
// Comprehensive supplier order verification and management for managers
// Features: Create PO, Approve/Reject, Send to Supplier, Track Deliveries
// Real-time Supabase integration - NO MOCK DATA
// =====================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FiTruck, FiCheckCircle, FiXCircle, FiSend, FiEdit, FiPlus,
  FiPackage, FiDollarSign, FiClock, FiAlertTriangle, FiSearch,
  FiDownload, FiMail, FiPhone, FiMapPin, FiCalendar, FiUser, FiChevronDown,
  FiX, FiCheck, FiArrowLeft, FiChevronRight, FiMinus
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LabelList } from 'recharts';
import supplierOrdersService, { getBusinessWalletBalance, resolveBusinessProfileId } from '../services/supplierOrdersService';
import { dispatchDeliveryForPurchaseOrder, checkRouteNeedsSeaLeg } from '../services/deliveryDispatchService';
import { supabase } from '../services/supabase';
import { ugxToICAN, formatICAN } from '../services/icanWalletService';
import { verifyPin } from '../services/pinService';
import OrderPaymentTracker from './OrderPaymentTracker';
import OrderItemsSelector from './OrderItemsSelector';
import '../styles/supplier-order-create.css';
import { useBackLayer } from '../hooks/useBackLayer';
import { findStoreProductForOrderItem, createStoreProductForOrderItem, orderItemBarcode } from '../utils/orderItemMatching';

// A section that stays folded until it is wanted; its content stays mounted so nothing typed inside is lost.
const SoFold = ({ title, badge, startOpen = false, children }) => {
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="so-fold">
      <button type="button" className="so-fold-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="so-fold-title">{title}</span>
        {badge && <span className="so-count">{badge}</span>}
        <FiChevronDown className={`so-link-chevron so-fold-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <div className="so-fold-body" hidden={!open}>{children}</div>
    </section>
  );
};

const SupplierOrderManagement = ({ onPosUpdated, businessProfileId = null }) => {
  const [resolvedBusinessProfileId, setResolvedBusinessProfileId] = useState(businessProfileId);
  const activeBusinessProfileId = businessProfileId || resolvedBusinessProfileId;

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
  useBackLayer(!!selectedOrder, () => setSelectedOrder(null));
  useBackLayer(showPaymentModal, () => setShowPaymentModal(false));
  useBackLayer(showApprovalModal, () => setShowApprovalModal(false));
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
  const [ordersPage, setOrdersPage] = useState(null); // which tab is open as a full page: 'active' | 'history' | 'pos'
  const closePage = () => {
    setOrdersPage(null);
    setViewMode('active');
  };
  useBackLayer(Boolean(ordersPage), closePage);
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
          
          if (!productName && !orderItemBarcode(item)) {
            console.warn('⚠️ No product name or barcode found in item:', item);
            failedCount++;
            results.push({
              name: 'Unknown',
              action: 'failed',
              error: 'Order item has no barcode or product name'
            });
            continue;
          }

          // Barcode decides which of THIS store's products the line is; the supplier's name is optional
          const match = await findStoreProductForOrderItem(supabase, { supermarketId, item });
          console.log(`🔍 Match for "${productName}" / ${orderItemBarcode(item) || 'no barcode'}:`, match?.matchedBy || 'none');
          const existingProducts = match ? [match.product] : [];

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
              name: existingProduct.name || productName,
              action: 'updated',
              quantity: quantity,
              newStock: newStock
            });
            successCount++;
          } else {
            // Create new product in POS
            console.log(`🆕 Creating new product in POS: "${productName}" x ${quantity} @ ${unitPrice}`);

            const createdProduct = await createStoreProductForOrderItem(supabase, {
              supermarketId,
              item,
              orderRef: order.po_number
            });
            const newProduct = [createdProduct];

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
              name: productName || orderItemBarcode(item),
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

  // Data for the Order Overview line graph — replaces the old stat-card grid
  const overviewChartData = useMemo(() => ([
    { name: 'Total', icon: '📦', value: realTimeStats.totalOrders || 0, amount: realTimeStats.totalValue, sub: 'All orders', color: '#3b82f6' },
    { name: 'Pending', icon: '⏳', value: realTimeStats.pendingOrders || 0, amount: null, sub: 'Awaiting action', color: '#eab308' },
    { name: 'Completed', icon: '✅', value: realTimeStats.completedOrders || 0, amount: null, sub: 'Delivered', color: '#22c55e' },
    { name: 'Paid', icon: '💵', value: realTimeStats.paidOrders || 0, amount: realTimeStats.totalPaidAmount, sub: 'Fully settled', color: '#10b981' },
    { name: 'Half Paid', icon: '⚠️', value: realTimeStats.partiallyPaidOrders || 0, amount: null, sub: 'Partial payments', color: '#f97316' },
    { name: 'Unpaid', icon: '❌', value: realTimeStats.unpaidOrders || 0, amount: realTimeStats.totalOutstanding, sub: 'Outstanding balance', color: '#ef4444' },
  ]), [realTimeStats]);

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
      <div className="co-root co-legacy" role="dialog" aria-modal="true" aria-label="Approve purchase order">
          <header className="co-bar" style={{ paddingBottom: '0.6rem' }}>
            <div className="co-bar-top">
              <button type="button" className="co-back" onClick={() => setShowApprovalModal(false)} aria-label="Back">
                <FiArrowLeft className="h-5 w-5" />
              </button>
              <div className="co-title">
                <h1>✅ Approve Purchase Order</h1>
                <p>Order #{selectedOrder.po_number}</p>
              </div>
            </div>
          </header>

          <main className="co-main">
          <div className="co-wrap" style={{ paddingTop: '0.75rem' }}>
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
            <div className="co-sticky-actions">
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
          </main>
      </div>
    );
  };

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || paymentFilter !== 'all' || Boolean(searchTerm);
  const pricingLabel = wholesalePricingMode === 'admin_price' ? 'Admin-set price' : 'Supplier price';
  const PAGE_TITLES = { active: 'Active orders', history: 'Order history', pos: 'POS inventory' };

  const openPage = (page) => {
    if (page === 'active' || page === 'history') setViewMode(page);
    setOrdersPage(page);
  };

  return (
    <div className="manager-supplier-orders animate-fadeInUp">
      {/* Home: one button to order, a line for each tab (each opens a full page), the rest folded away */}
      <div className="so-home">
        <button type="button" className="so-new" onClick={() => setShowCreateModal(true)}>
          <FiPlus className="h-5 w-5" /> <span>New order</span>
        </button>

        <nav className="so-links" aria-label="Orders">
          {[
            { key: 'active', icon: FiPackage, count: viewMode === 'active' ? orders.length : null },
            { key: 'history', icon: FiClock, count: null },
            { key: 'pos', icon: FiTruck, count: products ? products.length : null }
          ].map(({ key, icon: Icon, count }) => (
            <button key={key} type="button" className="so-link" onClick={() => openPage(key)}>
              <Icon className="so-link-icon" aria-hidden="true" />
              <span className="so-link-label">{PAGE_TITLES[key]}</span>
              {count != null && <span className="so-count">{count}</span>}
              <FiChevronRight className="so-link-chevron" aria-hidden="true" />
            </button>
          ))}
        </nav>

        <SoFold title="Overview">
          <div className="so-chart-wrap">
        <div className="supplier-order-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={overviewChartData} layout="vertical" margin={{ top: 4, right: 30, left: 0, bottom: 4 }} barCategoryGap={8}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8e2d3" />
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis dataKey="name" type="category" width={82} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
              <RechartsTooltip
                cursor={{ fill: 'rgba(196, 160, 82, 0.1)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 px-4 py-3 min-w-[160px]">
                      <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                        <span>{d.icon}</span>{d.name}
                      </p>
                      <p className="text-xl font-extrabold mt-0.5" style={{ color: d.color }}>
                        {d.value} <span className="text-xs font-medium text-gray-400">orders</span>
                      </p>
                      {d.amount != null && (
                        <p className="text-xs font-semibold text-gray-700 mt-1">{formatUGX(d.amount)}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5">{d.sub}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={18}>
                <LabelList dataKey="value" position="right" fill="#475569" fontSize={12} fontWeight={700} />
                {overviewChartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
          </div>
        </SoFold>

        {storeId && (
          <SoFold title="Order pricing" badge={pricingLabel}>
            <select value={wholesalePricingMode} onChange={e => saveWholesalePricingMode(e.target.value)} className="so-select" aria-label="Order using">
              <option value="supplier_price">Supplier price</option>
              <option value="admin_price">Admin-set price</option>
            </select>
          </SoFold>
        )}
      </div>

      {/* Full page for whichever tab was opened */}
      {ordersPage && (
        <div className="so-page fixed inset-0 z-[45] flex flex-col" role="dialog" aria-modal="true" aria-label={PAGE_TITLES[ordersPage]}>
          <header className="so-page-bar">
            <button type="button" className="so-back" onClick={closePage} aria-label="Back to orders">
              <FiArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="so-page-title">{PAGE_TITLES[ordersPage]}</h2>
            <button type="button" className="so-new so-new-small" onClick={() => setShowCreateModal(true)}>
              <FiPlus className="h-4 w-4" /> <span>New order</span>
            </button>
          </header>
          <main className="so-page-body">
            {ordersPage === 'pos' ? (
              <>
      <div className="so-pos">

        {products && products.length > 0 ? (
          <div>
            {products.map((product) => {
              const stock = product.inventory?.[0]?.quantity || 0;
              const stockStatus = stock > 10 ? 'text-green-600' : stock > 0 ? 'text-yellow-600' : 'text-red-600';
              
              return (
                <div key={product.id} className="so-pos-row">
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
          </div>
        )}
        
        {/* Summary Stats */}
        {products && products.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2">
              <p className="font-bold text-gray-800">{products.length}</p>
              <p className="text-gray-600">Total Products</p>
            </div>
            <div className="p-2">
              <p className="font-bold text-gray-800">{products.reduce((sum, p) => sum + (p.inventory?.[0]?.quantity || 0), 0)}</p>
              <p className="text-gray-600">Total Stock</p>
            </div>
            <div className="p-2">
              <p className="font-bold text-green-600">UGX {(products.reduce((sum, p) => sum + (p.price || 0), 0)).toLocaleString()}</p>
              <p className="text-gray-600">Total Value</p>
            </div>
          </div>
        )}
      </div>

              </>
            ) : (
              <>
                <SoFold title="Search & filters" badge={hasActiveFilters ? 'On' : null} startOpen={hasActiveFilters}>
            <div className="so-filters">
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

                </SoFold>
      <div className="so-list">
        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center">
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
              className={`so-order ${
                order.status === 'pending_approval' ? 'is-pending' :
                order.status === 'approved' ? 'is-approved' :
                order.status === 'cancelled' ? 'is-cancelled' : ''
              }`}
            >
              {/* Collapsed View - Order Header */}
              <button
                type="button"
                className="supplier-order-summary"
                aria-expanded={expandedOrderId === order.id}
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
              >
                <span className="supplier-order-summary-main">
                  <span className="supplier-order-number">{order.po_number}</span>
                  <span className={`supplier-order-status ${getStatusColor(order.status)}`}>
                    {order.status?.replace(/_/g, ' ')}
                  </span>
                  <span className="supplier-order-meta">
                    <span>{order.supplierName}</span>
                    <span aria-hidden="true">/</span>
                    <span>{new Date(order.order_date).toLocaleDateString()}</span>
                  </span>
                </span>
                <span className="supplier-order-summary-end">
                  <span className="supplier-order-total">{formatUGX(order.total_amount_ugx)}</span>
                  <FiChevronDown className={`supplier-order-chevron${expandedOrderId === order.id ? ' is-open' : ''}`} aria-hidden="true" />
                </span>
              </button>
              {/* Expanded View - Order Details */}
              {expandedOrderId === order.id && (
                <div id={`supplier-order-details-${order.id}`} className="supplier-order-details border-t-2 border-gray-200 p-6 bg-white animate-fadeInUp">
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
                  {(order.status === 'pending_approval' ||
                    order.status === 'approved' || 
                    order.status === 'sent_to_supplier' || 
                    order.status === 'confirmed' || 
                    order.status === 'received' || 
                    order.status === 'received') && (
                    <div className="mb-4">
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
                    {(order.status === 'pending_approval' ||
                      order.status === 'approved' || 
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

              </>
            )}
          </main>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
      <CreateOrderModal
          suppliers={suppliers}
          businessProfileId={activeBusinessProfileId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadAllData();
          }}
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrder && !showPaymentModal && (() => {
        const detailTotal = Number(selectedOrder.total_amount_ugx || 0);
        const detailPaid = Number(selectedOrder.amount_paid_ugx ?? selectedOrder.amount_paid ?? 0);
        const storedBalance = Number(selectedOrder.balance_due_ugx ?? selectedOrder.balance_due ?? 0);
        const detailBalance = storedBalance > 0 ? storedBalance : Math.max(0, detailTotal - detailPaid);
        const canPay = ['pending_approval', 'approved', 'sent_to_supplier', 'confirmed', 'received'].includes(selectedOrder.status)
          && selectedOrder.payment_status !== 'paid';
        const closeDetail = () => { setSelectedOrder(null); setActiveTab('details'); };
        const lines = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
        return (
          <div className="co-root" role="dialog" aria-modal="true" aria-label="Purchase order details">
            <header className="co-bar">
              <div className="co-bar-top">
                <button type="button" className="co-back" onClick={closeDetail} aria-label="Back to orders">
                  <FiArrowLeft className="h-5 w-5" />
                </button>
                <div className="co-title">
                  <h1>{selectedOrder.po_number}</h1>
                  <p>{selectedOrder.supplierName || 'Purchase order'} · {selectedOrder.status?.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="co-tabs" role="tablist" aria-label="Order sections">
                <button type="button" role="tab" className="co-tab" aria-selected={activeTab === 'details'} onClick={() => setActiveTab('details')}>📋 Details</button>
                <button type="button" role="tab" className="co-tab" aria-selected={activeTab === 'payment'} onClick={() => setActiveTab('payment')}>💰 Payment</button>
              </div>
            </header>

            <main className="co-main">
              <div className="co-wrap">
                {activeTab === 'details' && (
                  <>
                    <dl className="co-facts">
                      <div><dt>Total</dt><dd className="co-big">{formatUGX(detailTotal)}</dd></div>
                      <div><dt>Balance due</dt><dd className={`co-big ${detailBalance > 0 ? 'co-bad' : 'co-good'}`}>{formatUGX(detailBalance)}</dd></div>
                      <div>
                        <dt>Status</dt>
                        <dd><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}>{selectedOrder.status?.replace(/_/g, ' ').toUpperCase()}</span></dd>
                      </div>
                      <div>
                        <dt>Payment</dt>
                        <dd><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border-2 ${getPaymentStatusColor(selectedOrder.payment_status)}`}>{getPaymentStatusLabel(selectedOrder.payment_status)}</span></dd>
                      </div>
                      <div className="is-wide"><dt>Supplier</dt><dd>{selectedOrder.supplierName || 'N/A'}</dd></div>
                    </dl>

                    <div className="co-head-row">
                      <h2 className="co-open-title" style={{ padding: 0 }}>Items <span className="ois-tab-count">{lines.length}</span></h2>
                      <button
                        type="button"
                        className="co-btn-sm"
                        onClick={() => { setSelectedOrderForProduct(selectedOrder); setShowAddProductModal(true); }}
                      >
                        <FiPlus className="h-4 w-4" /> Add product
                      </button>
                    </div>
                    {lines.length === 0 ? (
                      <p className="ois-empty">No items on this order.</p>
                    ) : (
                      <ul className="co-lines">
                        {lines.map((item, idx) => {
                          const price = item.unit_price || item.unitPrice || 0;
                          return (
                            <li key={idx}>
                              <span className="n">{item.product_name || item.productName}</span>
                              <span className="s">{item.quantity} × {formatUGX(price)}</span>
                              <span className="t">{formatUGX(price * item.quantity)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}

                {activeTab === 'payment' && (
                  <div className="co-legacy" style={{ paddingTop: '0.75rem' }}>
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
                  </div>
                )}
              </div>
            </main>

            <footer className="co-foot">
              <div className="co-foot-actions">
                <button type="button" className="co-ghost" onClick={closeDetail}>Close</button>
                {canPay && (
                  <button type="button" className="co-cta" onClick={() => setShowPaymentModal(true)}>
                    <FiDollarSign className="h-5 w-5" /><span>Add payment</span>
                  </button>
                )}
              </div>
            </footer>
          </div>
        );
      })()}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          businessProfileId={activeBusinessProfileId}
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
      {ApprovalModal()}

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
// Dates for the delivery shortcuts, in the phone's own time zone (toISOString would shift them).
const toLocalISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const inDays = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return toLocalISO(date); };

// A folded section of a full page: one line with a summary until it is opened.
const CoFold = ({ icon, title, summary, tone, open, onToggle, hasError, sectionRef, children }) => (
  <section className={`co-section${hasError ? ' has-error' : ''}`} ref={sectionRef}>
    <button type="button" className="co-fold-head" aria-expanded={open} onClick={onToggle}>
      <span className="co-fold-icon" aria-hidden="true">{icon}</span>
      <span className="co-fold-title">
        {title}
        {summary && <small className={tone ? `is-${tone}` : undefined}>{summary}</small>}
      </span>
      <FiChevronDown className={`co-fold-chev${open ? ' is-open' : ''}`} aria-hidden="true" />
    </button>
    <div className="co-fold-body" hidden={!open}>{children}</div>
  </section>
);

const CreateOrderModal = ({ suppliers, businessProfileId, pricingMode = 'supplier_price', onClose, onSuccess }) => {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({
    productName: '',
    quantity: 1,
    unitPrice: 0
  });
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('SUPERMARTKERA Main Store, Kampala');
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
  useBackLayer(showPinPrompt, () => setShowPinPrompt(false));
  const [walletPin, setWalletPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  // Page state: which sections are open, what is missing, and where to scroll to
  const [errors, setErrors] = useState({});
  const [openSections, setOpenSections] = useState({ supplier: true, delivery: false, details: false, pay: false });
  const sectionRefs = { supplier: useRef(null), items: useRef(null), delivery: useRef(null), details: useRef(null), pay: useRef(null) };
  const toggleSection = (key) => setOpenSections((previous) => ({ ...previous, [key]: !previous[key] }));

  const requestClose = () => {
    if (submitting) return;
    if (orderItems.length > 0 && !window.confirm('Discard this order?')) return;
    onClose();
  };
  useBackLayer(true, requestClose);

  // Nothing behind the page should scroll while it covers the dashboard
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const goTo = (key) => {
    if (key !== 'items') setOpenSections((previous) => ({ ...previous, [key]: true }));
    setTimeout(() => sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

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
    e?.preventDefault?.();

    const found = {};
    if (!selectedSupplier) found.supplier = 'Choose a supplier';
    if (orderItems.length === 0) found.items = 'Add at least one product';
    if (!expectedDeliveryDate) found.date = 'Pick a delivery date';
    if (!deliveryAddress.trim()) found.address = 'Add a delivery address';
    setErrors(found);
    const first = found.supplier ? 'supplier' : found.items ? 'items' : (found.date || found.address) ? 'delivery' : null;
    if (first) {
      goTo(first);
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

  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const chosenSupplier = suppliers.find((supplier) => supplier.id === selectedSupplier);
  const supplierDone = Boolean(selectedSupplier);
  const itemsDone = orderItems.length > 0;
  const deliveryDone = Boolean(expectedDeliveryDate) && Boolean(deliveryAddress.trim());
  const nextStep = !supplierDone ? 'supplier' : !itemsDone ? 'items' : !deliveryDone ? 'delivery' : null;
  const ctaLabel = nextStep === 'supplier' ? 'Choose a supplier'
    : nextStep === 'items' ? 'Add products'
    : nextStep === 'delivery' ? (expectedDeliveryDate ? 'Add delivery address' : 'Set delivery date')
    : `Create order · ${formatUGX(totals.total)}`;
  const unitCount = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const prettyDate = expectedDeliveryDate
    ? new Date(`${expectedDeliveryDate}T00:00:00`).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';
  const priorityLabel = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }[priority];
  const payingNow = Number(cashPaidNow) > 0;

  return (
    <>
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

      <div className="co-root" role="dialog" aria-modal="true" aria-label="Create New Purchase Order">
        <header className="co-bar">
          <div className="co-bar-top">
            <button type="button" className="co-back" onClick={requestClose} disabled={submitting} aria-label="Back to orders">
              <FiArrowLeft className="h-5 w-5" />
            </button>
            <div className="co-title">
              <h1>🇺🇬 Create New Purchase Order</h1>
              <p>{chosenSupplier ? chosenSupplier.business_name : 'SUPERMARTKERA Uganda · Supplier Order System'}</p>
            </div>
          </div>
          <div className="co-steps" role="list" aria-label="Progress">
            {[
              { key: 'supplier', label: 'Supplier', done: supplierDone },
              { key: 'items', label: 'Products', done: itemsDone },
              { key: 'delivery', label: 'Delivery', done: deliveryDone }
            ].map((step, index) => (
              <button
                key={step.key}
                type="button"
                role="listitem"
                className={`co-step${step.done ? ' is-done' : ''}${nextStep === step.key ? ' is-next' : ''}`}
                onClick={() => goTo(step.key)}
              >
                <i aria-hidden="true">{step.done ? '✓' : index + 1}</i><span>{step.label}</span>
              </button>
            ))}
          </div>
        </header>

        <form className="co-form" onSubmit={handleSubmit} noValidate>
          <main className="co-main">
            <div className="co-wrap">
              {/* 1. Supplier: open until one is chosen, then a single line */}
              <CoFold
                icon="🏢"
                title="Supplier or wholesaler"
                summary={chosenSupplier ? `${chosenSupplier.business_name} (${chosenSupplier.supplier_code})` : (errors.supplier || 'Tap to choose')}
                tone={chosenSupplier ? 'ok' : errors.supplier ? 'bad' : undefined}
                open={openSections.supplier}
                onToggle={() => toggleSection('supplier')}
                hasError={Boolean(errors.supplier)}
                sectionRef={sectionRefs.supplier}
              >
                <select
                  value={selectedSupplier}
                  onChange={(e) => {
                    setSelectedSupplier(e.target.value);
                    setErrors((previous) => ({ ...previous, supplier: undefined }));
                    if (e.target.value) {
                      setOpenSections((previous) => ({ ...previous, supplier: false }));
                      if (orderItems.length === 0) goTo('items');
                    }
                  }}
                  className="co-input"
                  aria-label="Supplier or wholesaler"
                >
                  <option value="">-- Choose supplier or wholesaler --</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.business_name} ({supplier.supplier_code})
                    </option>
                  ))}
                </select>
              </CoFold>

              {/* 2. Products: a grid you tap */}
              <section className={`co-section${errors.items ? ' has-error' : ''}`} ref={sectionRefs.items}>
                <h2 className="co-open-title"><span aria-hidden="true">🛒</span> Products</h2>
                {errors.items && <p className="co-error" role="alert">{errors.items}</p>}
                <OrderItemsSelector
                  orderItems={orderItems}
                  onItemsChange={(items) => { setOrderItems(items); setErrors((previous) => ({ ...previous, items: undefined })); }}
                  totals={totals}
                  pricingMode={pricingMode}
                  supplierId={selectedSupplier}
                  supplierBusinessProfileId={chosenSupplier?.supplier_business_profile_id || ''}
                  onTotalsChange={setTotals}
                />
              </section>

              {/* 3. Delivery */}
              <CoFold
                icon="📅"
                title="Delivery"
                summary={deliveryDone ? `${prettyDate} · ${deliveryAddress}` : (errors.date || errors.address || 'Date and address needed')}
                tone={deliveryDone ? 'ok' : (errors.date || errors.address) ? 'bad' : undefined}
                open={openSections.delivery}
                onToggle={() => toggleSection('delivery')}
                hasError={Boolean(errors.date || errors.address)}
                sectionRef={sectionRefs.delivery}
              >
                <label className="co-label" htmlFor="co-date">Expected delivery date *</label>
                <input
                  id="co-date"
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => { setExpectedDeliveryDate(e.target.value); setErrors((previous) => ({ ...previous, date: undefined })); }}
                  min={toLocalISO(new Date())}
                  className="co-input"
                  aria-invalid={errors.date ? 'true' : undefined}
                />
                <div className="co-chips">
                  {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([label, days]) => (
                    <button
                      key={label}
                      type="button"
                      className="co-chip"
                      aria-pressed={expectedDeliveryDate === inDays(days)}
                      onClick={() => { setExpectedDeliveryDate(inDays(days)); setErrors((previous) => ({ ...previous, date: undefined })); }}
                    >{label}</button>
                  ))}
                </div>
                {errors.date && <p className="co-error" role="alert">{errors.date}</p>}

                <label className="co-label" htmlFor="co-address">Delivery address *</label>
                <input
                  id="co-address"
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => { setDeliveryAddress(e.target.value); setErrors((previous) => ({ ...previous, address: undefined })); }}
                  placeholder="Where should it be delivered?"
                  className="co-input"
                  aria-invalid={errors.address ? 'true' : undefined}
                />
                {errors.address && <p className="co-error" role="alert">{errors.address}</p>}
              </CoFold>

              {/* 4. Optional extras, folded */}
              <CoFold
                icon="⚡"
                title="Priority and notes"
                summary={`${priorityLabel}${notes || deliveryInstructions ? ' · notes added' : ''}`}
                open={openSections.details}
                onToggle={() => toggleSection('details')}
                sectionRef={sectionRefs.details}
              >
                <p className="co-label">Priority</p>
                <div className="co-seg" role="group" aria-label="Priority">
                  {[['low', '📝 Low'], ['normal', '📋 Normal'], ['high', '⚠️ High'], ['urgent', '🔥 Urgent']].map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={priority === value} onClick={() => setPriority(value)}>{label}</button>
                  ))}
                </div>
                <label className="co-label" htmlFor="co-instructions">Delivery instructions</label>
                <textarea id="co-instructions" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} placeholder="Gate, contact person, time of day…" rows="2" className="co-input" />
                <label className="co-label" htmlFor="co-notes">Notes</label>
                <textarea id="co-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the supplier should know" rows="2" className="co-input" />
              </CoFold>

              {/* 5. Pay now, optional */}
              <CoFold
                icon="💵"
                title="Pay now"
                summary={payingNow ? `${formatUGX(cashPaidNow)} · ${paymentMethod === 'ican_wallet' ? 'IcanEra Wallet' : 'Cash'}` : 'Optional'}
                tone={payingNow ? 'ok' : undefined}
                open={openSections.pay}
                onToggle={() => toggleSection('pay')}
                sectionRef={sectionRefs.pay}
              >
                <label className="co-label" htmlFor="co-cash">Amount paid now (UGX)</label>
                <input
                  id="co-cash"
                  type="number"
                  inputMode="numeric"
                  value={cashPaidNow}
                  onChange={(e) => setCashPaidNow(e.target.value)}
                  min="0"
                  max={totals.total}
                  step="1000"
                  placeholder="0"
                  className="co-input"
                />
                {itemsDone && (
                  <div className="co-chips">
                    <button type="button" className="co-chip" onClick={() => setCashPaidNow(Math.round(totals.total / 2))}>Half</button>
                    <button type="button" className="co-chip" onClick={() => setCashPaidNow(Math.round(totals.total))}>Full amount</button>
                    {payingNow && <button type="button" className="co-chip" onClick={() => setCashPaidNow(0)}>Clear</button>}
                  </div>
                )}
                {payingNow && (
                  <>
                    <p className="co-balance is-due"><span>Balance due</span><span>{formatUGX(Math.max(0, totals.total - parseFloat(cashPaidNow || 0)))}</span></p>

                    <p className="co-label">Pay with</p>
                    <div className="co-seg two" role="group" aria-label="Payment method">
                      <button type="button" aria-pressed={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')}>💵 Cash</button>
                      <button type="button" aria-pressed={paymentMethod === 'ican_wallet'} onClick={() => setPaymentMethod('ican_wallet')}>🪙 IcanEra Wallet</button>
                    </div>

                    {paymentMethod === 'ican_wallet' ? (
                      <div className="co-note">
                        {icanBalanceLoading ? 'Loading balance…' : (
                          <>
                            Store balance <b>{formatICAN(icanBalance?.ican || 0)} ICAN</b>. This payment needs ≈ <b>{formatICAN(ugxToICAN(parseFloat(cashPaidNow)))} ICAN</b>
                            {icanBalance && icanBalance.ican < ugxToICAN(parseFloat(cashPaidNow)) && <b style={{ color: 'var(--c-red)' }}> — not enough</b>}.
                          </>
                        )}
                        <br />No ICAN moves now. After the order is approved, the wallet administrator approves the payment with the business-wallet PIN.
                      </div>
                    ) : (
                      <>
                        <label className="co-label" htmlFor="co-ref">Payment reference (optional)</label>
                        <input id="co-ref" type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Receipt or transaction number" className="co-input" />
                      </>
                    )}
                    <label className="co-label" htmlFor="co-paynotes">Payment notes (optional)</label>
                    <textarea id="co-paynotes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows="2" className="co-input" />
                  </>
                )}
              </CoFold>
            </div>
          </main>

          <footer className="co-foot">
            <p className="co-foot-sum" aria-live="polite">
              <span>{orderItems.length === 0 ? 'No products yet' : `${orderItems.length} item${orderItems.length === 1 ? '' : 's'} · ${unitCount} unit${unitCount === 1 ? '' : 's'} · incl. VAT`}</span>
              <b>{formatUGX(totals.total)}</b>
            </p>
            <div className="co-foot-actions">
              <button type="button" className="co-ghost" onClick={requestClose} disabled={submitting}>Cancel</button>
              <button
                type="button"
                className={`co-cta${nextStep ? ' is-guide' : ''}`}
                disabled={submitting}
                onClick={nextStep ? () => goTo(nextStep) : handleSubmit}
              >
                {submitting ? (
                  <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div><span>Creating…</span></>
                ) : (
                  <>{nextStep ? <FiChevronRight className="h-5 w-5" /> : <FiCheckCircle className="h-5 w-5" />}<span>{ctaLabel}</span></>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </>
  );
};

// =====================================================================
// PAYMENT MODAL COMPONENT
// =====================================================================
const PaymentModal = ({ order, businessProfileId, onClose, onSuccess }) => {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
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

  // The order row stores these as *_ugx; older rows and other screens used the short names
  const orderTotal = Number(order.total_amount_ugx ?? order.total_amount ?? 0);
  const alreadyPaid = Number(order.amount_paid_ugx ?? order.amount_paid ?? 0);
  const storedBalance = Number(order.balance_due_ugx ?? order.balance_due ?? 0);
  const balanceDue = storedBalance > 0 ? storedBalance : Math.max(0, orderTotal - alreadyPaid);
  const supplierLabel = order.supplierName || order.supplier_name || order.supplier?.business_name || 'Supplier';
  const [showExtras, setShowExtras] = useState(false);
  useBackLayer(true, () => { if (!submitting) onClose(); });

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

  const amountNumber = parseFloat(amountPaid) || 0;
  const notEnoughIcan = paymentMethod === 'ican_wallet' && amountNumber > 0 && icanBalance && icanBalance.ican < ugxToICAN(amountNumber);

  return (
    <div className="co-root" role="dialog" aria-modal="true" aria-label="Record payment">
      <header className="co-bar" style={{ paddingBottom: '0.6rem' }}>
        <div className="co-bar-top">
          <button type="button" className="co-back" onClick={onClose} disabled={submitting} aria-label="Back">
            <FiArrowLeft className="h-5 w-5" />
          </button>
          <div className="co-title">
            <h1>💰 Record Payment</h1>
            <p>{order.po_number} · {supplierLabel}</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="co-form" noValidate>
        <main className="co-main">
          <div className="co-wrap">
            <dl className="co-stats" aria-label="Payment summary">
              <div><dt>Order total</dt><dd>{formatUGX(orderTotal)}</dd></div>
              <div><dt>Paid</dt><dd className="co-good">{formatUGX(alreadyPaid)}</dd></div>
              <div><dt>Balance due</dt><dd className="co-bad">{formatUGX(balanceDue)}</dd></div>
            </dl>

            <label className="co-label" htmlFor="pay-amount" style={{ marginTop: '1rem' }}>Amount to pay (UGX)</label>
            <input
              id="pay-amount"
              type="number"
              inputMode="numeric"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0"
              min="0"
              max={balanceDue || undefined}
              step="1000"
              className="co-input co-amount"
              autoFocus={typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: fine)').matches)}
            />
            {balanceDue > 0 && (
              <div className="co-chips">
                <button type="button" className="co-chip" onClick={() => setAmountPaid(String(Math.round(balanceDue / 4)))}>25%</button>
                <button type="button" className="co-chip" onClick={() => setAmountPaid(String(Math.round(balanceDue / 2)))}>Half</button>
                <button type="button" className="co-chip" onClick={() => setAmountPaid(String(Math.round(balanceDue)))}>Full balance</button>
              </div>
            )}

            <p className="co-label">Pay with</p>
            <div className="co-seg two" role="group" aria-label="Payment method">
              <button type="button" aria-pressed={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')}>💵 Cash</button>
              <button type="button" aria-pressed={paymentMethod === 'ican_wallet'} onClick={() => setPaymentMethod('ican_wallet')}>🪙 IcanEra Wallet</button>
            </div>

            {paymentMethod === 'ican_wallet' && (
              <div className="co-note">
                {icanBalanceLoading ? 'Loading balance…' : (
                  <>
                    Store balance <b>{formatICAN(icanBalance?.ican || 0)} ICAN</b>
                    {amountNumber > 0 && <> · this payment needs ≈ <b>{formatICAN(ugxToICAN(amountNumber))} ICAN</b></>}
                    {notEnoughIcan && <b style={{ color: 'var(--c-red)' }}> — not enough</b>}
                  </>
                )}
                <br />This only sends an approval request. The wallet administrator approves it with the business-wallet PIN in ICANera Wallet or CMMS.
              </div>
            )}

            <button type="button" className="co-fold-head" aria-expanded={showExtras} onClick={() => setShowExtras((value) => !value)} style={{ marginTop: '0.6rem', borderTop: '1px solid var(--c-line)' }}>
              <span className="co-fold-icon" aria-hidden="true">📝</span>
              <span className="co-fold-title">Reference and notes<small>{paymentReference || paymentNotes ? 'Added' : 'Optional'}</small></span>
              <FiChevronDown className={`co-fold-chev${showExtras ? ' is-open' : ''}`} aria-hidden="true" />
            </button>
            <div className="co-fold-body" hidden={!showExtras}>
              {paymentMethod !== 'ican_wallet' && (
                <>
                  <label className="co-label" htmlFor="pay-ref">Reference / transaction ID</label>
                  <input id="pay-ref" type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="e.g. TXN123456789, cheque no." className="co-input" />
                </>
              )}
              <label className="co-label" htmlFor="pay-notes">Notes</label>
              <textarea id="pay-notes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows="2" className="co-input" />
            </div>
          </div>
        </main>

        <footer className="co-foot">
          <div className="co-foot-actions">
            <button type="button" className="co-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="co-cta" disabled={submitting || Boolean(notEnoughIcan)}>
              {submitting ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div><span>Recording…</span></>
              ) : (
                <><FiCheckCircle className="h-5 w-5" /><span>{paymentMethod === 'ican_wallet' ? 'Pay with ICAN' : 'Record payment'}{amountNumber > 0 ? ` · ${formatUGX(amountNumber)}` : ''}</span></>
              )}
            </button>
          </div>
        </footer>
      </form>
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

  useBackLayer(Boolean(isOpen), onClose);

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

  const setQuantity = (value) => setFormData({ ...formData, quantity: Math.max(1, value) });

  return (
    <div className="co-root" role="dialog" aria-modal="true" aria-label="Add product to order">
      <header className="co-bar" style={{ paddingBottom: '0.6rem' }}>
        <div className="co-bar-top">
          <button type="button" className="co-back" onClick={onClose} aria-label="Back">
            <FiArrowLeft className="h-5 w-5" />
          </button>
          <div className="co-title">
            <h1>Add Product to Order</h1>
            <p>{order.po_number} · now UGX {(order.total_amount_ugx || 0).toLocaleString()}</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleAddProduct} className="co-form" noValidate>
        <main className="co-main">
          <div className="co-wrap">
            <label className="co-label" htmlFor="ap-order-name" style={{ marginTop: '0.9rem' }}>Product name *</label>
            <input
              id="ap-order-name"
              ref={productNameRef}
              type="text"
              placeholder="e.g. Sugar - 1kg, Rice - 10kg"
              value={formData.productName}
              onChange={(e) => {
                setFormData({ ...formData, productName: e.target.value });
                if (errors.productName) setErrors({ ...errors, productName: '' });
              }}
              className="co-input"
              aria-invalid={errors.productName ? 'true' : undefined}
            />
            {errors.productName && <p className="co-error" role="alert">{errors.productName}</p>}

            <p className="co-label">Quantity *</p>
            <div className="co-qty">
              <button type="button" onClick={() => setQuantity(formData.quantity - 1)} aria-label="One less"><FiMinus className="h-5 w-5" /></button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={formData.quantity}
                onChange={(e) => {
                  setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 });
                  if (errors.quantity) setErrors({ ...errors, quantity: '' });
                }}
                className="co-input"
                aria-label="Quantity"
              />
              <button type="button" onClick={() => setQuantity(formData.quantity + 1)} aria-label="One more"><FiPlus className="h-5 w-5" /></button>
            </div>
            <div className="co-chips">
              {[6, 12, 24, 50].map((count) => (
                <button key={count} type="button" className="co-chip" aria-pressed={formData.quantity === count} onClick={() => setQuantity(count)}>{count}</button>
              ))}
            </div>
            {errors.quantity && <p className="co-error" role="alert">{errors.quantity}</p>}

            <label className="co-label" htmlFor="ap-order-price">Unit price (UGX) *</label>
            <input
              id="ap-order-price"
              type="number"
              inputMode="numeric"
              min="0"
              step="100"
              placeholder="0"
              value={formData.unitPrice}
              onChange={(e) => {
                setFormData({ ...formData, unitPrice: e.target.value });
                if (errors.unitPrice) setErrors({ ...errors, unitPrice: '' });
              }}
              className="co-input"
              aria-invalid={errors.unitPrice ? 'true' : undefined}
            />
            {errors.unitPrice && <p className="co-error" role="alert">{errors.unitPrice}</p>}

            {formData.quantity > 0 && formData.unitPrice && (
              <dl className="ois-sum" style={{ marginTop: '0.9rem' }} aria-live="polite">
                <div><dt>This line</dt><dd>UGX {totalLineAmount.toLocaleString()}</dd></div>
                <div className="is-total"><dt>New order total</dt><dd>UGX {((order.total_amount_ugx || 0) + totalLineAmount).toLocaleString()}</dd></div>
              </dl>
            )}

            <label className="co-label" htmlFor="ap-order-notes">Notes (optional)</label>
            <textarea
              id="ap-order-notes"
              placeholder="Anything special about this product"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="2"
              className="co-input"
            />
          </div>
        </main>

        <footer className="co-foot">
          <div className="co-foot-actions">
            <button type="button" className="co-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading} className="co-cta">
              {loading ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div><span>Adding…</span></>
              ) : (
                <><FiCheck className="h-5 w-5" /><span>Add product</span></>
              )}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};

// =====================================================================
// EXPORT
// =====================================================================
export default SupplierOrderManagement;
