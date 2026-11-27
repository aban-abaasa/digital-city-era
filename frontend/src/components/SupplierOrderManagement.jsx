// =====================================================================
// SUPPLIER ORDER MANAGEMENT COMPONENT - SUPERMARTKERA UGANDA 🇺🇬
// =====================================================================
// Comprehensive supplier order verification and management for managers
// Features: Create PO, Approve/Reject, Send to Supplier, Track Deliveries
// Real-time Supabase integration - NO MOCK DATA
// =====================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  FiTruck, FiCheckCircle, FiXCircle, FiSend, FiEdit, FiPlus,
  FiPackage, FiDollarSign, FiClock, FiAlertTriangle, FiSearch,
  FiDownload, FiMail, FiPhone, FiMapPin, FiCalendar, FiUser, FiChevronDown,
  FiX, FiCheck, FiArrowLeft, FiChevronRight, FiMinus
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LabelList } from 'recharts';
import inventoryService from '../services/inventorySupabaseService';
import supplierOrdersService, { getBusinessWalletBalance, resolveBusinessProfileId } from '../services/supplierOrdersService';
import { dispatchDeliveryForPurchaseOrder, checkRouteNeedsSeaLeg } from '../services/deliveryDispatchService';
import { supabase } from '../services/supabase';
import { ugxToICAN, formatICAN } from '../services/icanWalletService';
import OrderPaymentTracker from './OrderPaymentTracker';
import PurchaseOrderQuoteEditor from './PurchaseOrderQuoteEditor';
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

// Resolve every supplier line to a product owned by the receiving store before
// the purchase order transitions to received. The database trigger then adds
// stock and records its batch exactly once in the same transaction.
const prepareReceivedOrderItems = async (items, supermarketId, orderRef) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error('This order has no products to receive.');
  const prepared = [];
  for (const item of items) {
    const quantity = Number(item.quantity ?? item.qty ?? 0);
    const name = item.product_name || item.productName || item.name || '';
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Enter a valid quantity for ${name || 'each product'}.`);
    if (!name && !orderItemBarcode(item)) throw new Error('An order product needs a name or barcode before it can be received.');

    const match = await findStoreProductForOrderItem(supabase, { supermarketId, item });
    const product = match?.product || await createStoreProductForOrderItem(supabase, { supermarketId, item, orderRef });
    prepared.push({
      ...item,
      product_id: product.id,
      product_name: product.name || name,
      barcode: orderItemBarcode(item) || product.barcode || '',
      sku: item.sku || product.sku || '',
      quantity,
      unit_price: Number(item.unit_price ?? item.unitPrice ?? item.price ?? 0),
      batch_number: String(item.batch_number || '').trim(),
      expiry_date: String(item.expiry_date || '').trim() || null,
    });
  }
  return prepared;
};

const SupplierOrderManagement = ({ onPosUpdated, businessProfileId = null, supermarketId: assignedSupermarketId = null }) => {
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
  const loadAllDataRef = useRef(null);
  const loadAllDataRequestRef = useRef(0);
  const loadProductsRequestRef = useRef(0);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState({});
  const [products, setProducts] = useState([]); // Products in POS inventory
  const [wholesalePricingMode, setWholesalePricingMode] = useState('supplier_price');
  const [storeId, setStoreId] = useState(assignedSupermarketId || null);

  useEffect(() => {
    let cancelled = false;
    if (assignedSupermarketId && assignedSupermarketId !== storeId) {
      loadAllDataRequestRef.current += 1;
      loadProductsRequestRef.current += 1;
      setOrders([]);
      setStats({});
      setProducts([]);
      setStoreId(assignedSupermarketId);
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userRow } = await supabase.from('users').select('supermarket_id').or(`auth_id.eq.${user.id},id.eq.${user.id}`).maybeSingle();
      let cachedStoreId = null;
      try {
        cachedStoreId = JSON.parse(localStorage.getItem('supermarket_user') || '{}').supermarket_id || null;
      } catch { /* Use the database assignment below. */ }
      const id = userRow?.supermarket_id || assignedSupermarketId || cachedStoreId;
      if (!id) {
        if (!cancelled) setStoreId(null);
        return;
      }
      const { data: store } = await supabase.from('supermarkets').select('id, business_type, wholesale_pricing_mode').eq('id', id).maybeSingle();
      if (cancelled) return;
      setStoreId(store?.id || id);
      if (store?.business_type === 'wholesale') setWholesalePricingMode(store.wholesale_pricing_mode || 'supplier_price');
    })();
    return () => { cancelled = true; };
  }, [assignedSupermarketId]);

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
  const [quoteReviewBusy, setQuoteReviewBusy] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  useBackLayer(!!selectedOrder, () => setSelectedOrder(null));
  useBackLayer(showPaymentModal, () => setShowPaymentModal(false));
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false); // NEW: Approval with payment modal
  useBackLayer(showApprovalModal, () => setShowApprovalModal(false));
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
  }, [statusFilter, priorityFilter, paymentFilter, viewMode, storeId]);

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

  useEffect(() => {
    const subscription = supabase
      .channel('manager_purchase_order_supplies_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        loadAllDataRef.current?.();
      })
      .subscribe();
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, []);

  /**
   * Load products from Supabase
   */
  const loadProducts = async () => {
    const requestId = ++loadProductsRequestRef.current;
    try {
      // Keep this inventory list bound to the same assigned store as Supplies.
      const supermarketId = storeId;
      if (!supermarketId) {
        setProducts([]);
        return;
      }
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
            minimum_stock,
            supermarket_id
          )
        `)
        .eq('supermarket_id', supermarketId)
        .or(`supermarket_id.eq.${supermarketId},supermarket_id.is.null`, { referencedTable: 'inventory' });

      if (error) throw error;
      if (requestId !== loadProductsRequestRef.current) return;

      setProducts((data || []).map((product) => ({
        ...product,
        inventory: Array.isArray(product.inventory)
          ? product.inventory
          : product.inventory ? [product.inventory] : []
      })));
      console.log('✅ Manager Portal - Products loaded:', data?.length);
    } catch (err) {
      if (requestId !== loadProductsRequestRef.current) return;
      console.error('Error loading products:', err);
      setProducts([]);
    }
  };

  /**
   * Load all supplier order data from Supabase
   */
  const loadAllData = async () => {
    const requestId = ++loadAllDataRequestRef.current;
    setLoading(true);
    if (!storeId) {
      setOrders([]);
      setStats({});
      setError('This manager account is not assigned to a store.');
      if (requestId === loadAllDataRequestRef.current) setLoading(false);
      return;
    }
    setError(null);
    try {
      let ordersResponse;
      
      // Load based on view mode
      if (viewMode === 'history') {
        ordersResponse = await supplierOrdersService.getOrderHistory({
          status: statusFilter === 'all' ? null : statusFilter,
          priority: priorityFilter === 'all' ? null : priorityFilter,
          supermarketId: storeId
        });
      } else if (paymentFilter !== 'all') {
        ordersResponse = await supplierOrdersService.getOrdersByPaymentStatus(paymentFilter, storeId);
      } else {
        ordersResponse = await supplierOrdersService.getAllPurchaseOrders({
          status: statusFilter === 'all' ? null : statusFilter,
          priority: priorityFilter === 'all' ? null : priorityFilter,
          supermarketId: storeId
        });
      }

      const [suppliersResponse, statsResponse] = await Promise.all([
        supplierOrdersService.getActiveSuppliers(),
        supplierOrdersService.getSupplierOrderStats(storeId)
      ]);
      if (requestId !== loadAllDataRequestRef.current) return;

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
        const ordersWithUnconfirmed = ordersResponse.orders.map(order => {
          const total = Number(order.total_amount_ugx ?? order.total_amount ?? 0);
          const paid = order.payment_status === 'paid'
            ? total
            : Math.min(total, Math.max(0, Number(order.amount_paid_ugx ?? order.amount_paid ?? 0)));
          return {
            ...order,
            total_amount_ugx: total,
            amount_paid_ugx: paid,
            balance_due_ugx: Math.max(0, total - paid),
            unconfirmedPaymentsCount: unconfirmedMap[order.id] || 0,
          };
        });
        
        setOrders(ordersWithUnconfirmed);
      } else {
        setOrders([]);
        setError(ordersResponse.error);
      }

      if (suppliersResponse.success) {
        setSuppliers(suppliersResponse.suppliers);
      }

      if (statsResponse.success) {
        setStats(statsResponse.stats);
      }

    } catch (err) {
      if (requestId !== loadAllDataRequestRef.current) return;
      console.error('Error loading supplier data:', err);
      setOrders([]);
      setError(err.message);
    } finally {
      if (requestId === loadAllDataRequestRef.current) setLoading(false);
    }
  };
  loadAllDataRef.current = loadAllData;

  const handleQuoteReview = async (orderId, items, notes, decision) => {
    setQuoteReviewBusy(true);
    try {
      const result = await supplierOrdersService.reviewSupplierPurchaseOrderQuote({
        orderId,
        decision,
        items,
        notes,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === 'accepted'
        ? 'Final supply list approved. Payment can now be submitted for admin approval.'
        : 'Changes requested. The supplier can update and resubmit the proposal.');
      await loadAllData();
      const { data: refreshedOrder, error: refreshError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      if (!refreshError && refreshedOrder) {
        const total = Number(refreshedOrder.total_amount_ugx ?? refreshedOrder.total_amount ?? 0);
        const paid = refreshedOrder.payment_status === 'paid'
          ? total
          : Math.min(total, Math.max(0, Number(refreshedOrder.amount_paid_ugx ?? refreshedOrder.amount_paid ?? 0)));
        setSelectedOrder({
          ...refreshedOrder,
          total_amount_ugx: total,
          amount_paid_ugx: paid,
          balance_due_ugx: Math.max(0, total - paid),
          supplierName: orders.find((item) => item.id === orderId)?.supplierName || selectedOrder?.supplierName,
        });
      }
    } finally {
      setQuoteReviewBusy(false);
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
          ...(approvalVehicleType ? { preferred_vehicle_type: approvalVehicleType, delivery_method: null } : {}),
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
      'Choose delivery method before completing this order:\n\n1 = Supplier delivery\n2 = MyBodaGuy delivery\n3 = Supermarket pickup\n4 = Supplier own delivery',
      '1'
    );
    const deliveryMethods = { '1': 'supplier_delivery', '2': 'mybodaguy_delivery', '3': 'supermarket_pickup', '4': 'supplier_own_delivery' };
    if (!deliveryMethods[deliveryMethod]) {
      alert('A delivery method is required. The order was not completed.');
      return;
    }
    const deliveryLabels = { supplier_delivery: 'Supplier delivery', supplier_own_delivery: 'Supplier own delivery', mybodaguy_delivery: 'MyBodaGuy delivery', supermarket_pickup: 'Supermarket pickup' };
    if (!confirm('Mark this order as RECEIVED and update inventory?\n\nDelivery: ' + deliveryLabels[deliveryMethods[deliveryMethod]])) {
      return;
    }

    try {
      setLoading(true);

      // Receiving adds stock to the order's store, so the order must have one. Orders made before
      // the store was recorded get the receiving manager's store here; without it the database
      // refuses the stock update ("null value in column supermarket_id of relation inventory").
      const { data: orderRow, error: orderLoadError } = await supabase
        .from('purchase_orders').select('supermarket_id, items, po_number, status').eq('id', orderId).maybeSingle();
      if (orderLoadError) throw orderLoadError;
      if (!orderRow) throw new Error('Purchase order not found.');
      if (orderRow.status === 'received') {
        alert('This order is already marked as received. Inventory has already been updated.');
        return;
      }
      let receivingStoreId = orderRow.supermarket_id || storeId;
      if (!receivingStoreId) {
        let storeId = null;
        try {
          storeId = JSON.parse(localStorage.getItem('supermarket_user') || '{}').supermarket_id || null;
        } catch {
          // Fall back to the authenticated user below.
        }
        if (!storeId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const { data: userRow } = await supabase
              .from('users')
              .select('supermarket_id')
              .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
              .maybeSingle();
            storeId = userRow?.supermarket_id || null;
          }
        }
        if (!storeId) {
          alert('❌ Your account is not assigned to a store, so this order cannot be received into inventory. Ask an admin to assign your account to a store, then try again.');
          return;
        }
        receivingStoreId = storeId;
      }

      if (!receivingStoreId) throw new Error('This account is not assigned to a store. Assign it to a store before receiving orders.');
      const receivedItems = await prepareReceivedOrderItems(orderRow.items, receivingStoreId, orderRow.po_number || orderId);

      // The receive trigger adds inventory and batch records atomically.
      const { error: statusError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received',
          supermarket_id: receivingStoreId,
          inventory_receiving_items: receivedItems,
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

      alert('Order received. Inventory was updated for ' + receivedItems.length + ' products, including supplier barcodes and batch expiry details.');

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
    if (order.added_to_pos || order.status === 'received') {
      toast.warning('This order is already received. Inventory is only added once when an order is received.');
      return;
    }
    if (order.status !== 'confirmed' || !order.supplier_delivery_confirmed_at) {
      toast.info(order.status === 'confirmed'
        ? 'Waiting for the supplier to confirm delivery to the store.'
        : 'Waiting for the supplier to accept the order and confirm delivery.');
      return;
    }
    setLoading(true);
    try {
      const { data: confirmedOrder, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, supermarket_id, items, po_number, status, supplier_delivery_confirmed_at, delivery_method, preferred_vehicle_type')
        .eq('id', order.id)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!confirmedOrder || confirmedOrder.status !== 'confirmed' || !confirmedOrder.supplier_delivery_confirmed_at) {
        throw new Error('The supplier must confirm delivery before this order can be received into POS.');
      }
      const deliveryMethod = confirmedOrder.delivery_method || (confirmedOrder.preferred_vehicle_type ? 'supplier_delivery' : null);
      if (!deliveryMethod) throw new Error('The supplier must choose a delivery method before confirming delivery.');

      let receivingStoreId = confirmedOrder.supermarket_id || storeId || null;
      try {
        receivingStoreId ||= JSON.parse(localStorage.getItem('supermarket_user') || '{}').supermarket_id || null;
      } catch { /* Use the authenticated user's store below. */ }
      if (!receivingStoreId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: userRow } = await supabase.from('users').select('supermarket_id')
            .or('auth_id.eq.' + user.id + ',id.eq.' + user.id).maybeSingle();
          receivingStoreId = userRow?.supermarket_id || null;
        }
      }
      if (!receivingStoreId) throw new Error('Your account is not assigned to a store.');
      const preparedItems = await prepareReceivedOrderItems(confirmedOrder.items, receivingStoreId, confirmedOrder.po_number || confirmedOrder.id);
      const { data: receivedOrder, error } = await supabase.from('purchase_orders').update({
        status: 'received',
        supermarket_id: receivingStoreId,
        inventory_receiving_items: preparedItems,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id)
        .eq('status', 'confirmed')
        .not('supplier_delivery_confirmed_at', 'is', null)
        .select('id')
        .single();
      if (error) throw error;
      if (!receivedOrder) throw new Error('The order could not be received. Refresh and try again.');

      setOrders((previous) => previous.map((row) => row.id === order.id
        ? { ...row, status: 'received', supermarket_id: receivingStoreId, added_to_pos: true }
        : row));
      toast.success('Supplier delivery received. ' + preparedItems.length + ' products and their batches are now active in POS.');
      if (typeof onPosUpdated === 'function') {
        onPosUpdated(preparedItems.map((item) => ({ name: item.product_name, quantity: item.quantity })));
      }
    } catch (err) {
      console.error('Could not receive order into POS:', err);
      toast.error('Could not receive order: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  /**
   * Handle mark order as completed
   */
  const handleMarkAsCompleted = async (orderId) => {
    const deliveryMethod = window.prompt(
      'Choose delivery method before completing this order:\n\n1 = Supplier delivery\n2 = MyBodaGuy delivery\n3 = Supermarket pickup\n4 = Supplier own delivery',
      '1'
    );
    const deliveryMethods = { '1': 'supplier_delivery', '2': 'mybodaguy_delivery', '3': 'supermarket_pickup', '4': 'supplier_own_delivery' };
    if (!deliveryMethods[deliveryMethod]) {
      alert('A delivery method is required. The order was not completed.');
      return;
    }
    const deliveryLabels = { supplier_delivery: 'Supplier delivery', supplier_own_delivery: 'Supplier own delivery', mybodaguy_delivery: 'MyBodaGuy delivery', supermarket_pickup: 'Supermarket pickup' };
    if (!confirm('Mark this order as RECEIVED?\n\nDelivery: ' + deliveryLabels[deliveryMethods[deliveryMethod]])) return;

    try {
      const { data: order, error: orderError } = await supabase.from('purchase_orders')
        .select('supermarket_id, items, po_number, status').eq('id', orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) throw new Error('Purchase order not found.');
      if (order.status === 'received') {
        alert('This order is already received. Inventory has already been updated.');
        return;
      }
      let receivingStoreId = order.supermarket_id || storeId || null;
      if (!receivingStoreId) {
        try { receivingStoreId = JSON.parse(localStorage.getItem('supermarket_user') || '{}').supermarket_id || null; } catch { /* Use user assignment below. */ }
      }
      if (!receivingStoreId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: userRow } = await supabase.from('users').select('supermarket_id')
            .or('auth_id.eq.' + user.id + ',id.eq.' + user.id).maybeSingle();
          receivingStoreId = userRow?.supermarket_id || null;
        }
      }
      if (!receivingStoreId) throw new Error('Your account is not assigned to a store.');
      const receivedItems = await prepareReceivedOrderItems(order.items, receivingStoreId, order.po_number || orderId);
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received',
          supermarket_id: receivingStoreId,
          inventory_receiving_items: receivedItems,
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

      alert('Order received. Inventory and supplier batch details were recorded for ' + receivedItems.length + ' products.');
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
        const total = Number(order.total_amount_ugx ?? order.total_amount) || 0;
        const paid = Math.min(total, Number(order.amount_paid_ugx ?? order.amount_paid) || 0);
        return sum + Math.max(0, total - paid);
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
                  : selectedOrder.delivery_method === 'supplier_own_delivery'
                    ? 'Supplier will use their own delivery. Choose a vehicle below to override that choice.'
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
  const PAGE_TITLES = { active: 'Supply requests', history: 'Supply history', pos: 'POS inventory' };

  const openPage = (page) => {
    if (page === 'active' || page === 'history') setViewMode(page);
    setOrdersPage(page);
  };

  return (
    <div className="manager-supplier-orders">
      <header className="so-home-head">
        <div>
          <p>SUPPLIES</p>
          <h1>Supplier orders</h1>
        </div>
        <button type="button" className="so-new so-new-small" onClick={() => setShowCreateModal(true)}>
          <FiPlus className="h-4 w-4" /> <span>New supply request</span>
        </button>
      </header>
      {/* Home: a line for each section; the rest stays folded away */}
      <div className="so-home">
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
      {ordersPage && createPortal((
        <div className="so-page" role="dialog" aria-modal="true" aria-label={PAGE_TITLES[ordersPage]}>
          <header className="so-page-bar">
            <button type="button" className="so-back" onClick={closePage} aria-label="Back to orders">
              <FiArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <h2 className="so-page-title">{PAGE_TITLES[ordersPage]}</h2>
            <button type="button" className="so-new so-new-small" onClick={() => setShowCreateModal(true)}>
              <FiPlus className="h-4 w-4" /> <span>New supply request</span>
            </button>
          </header>
          <main className="so-page-body">
            {ordersPage === 'pos' ? (
              <>
      <div className="so-pos">

        {products && products.length > 0 ? (
          <div>
            {products.map((product) => {
              const stock = Number(product.inventory?.[0]?.current_stock ?? product.inventory?.[0]?.quantity ?? 0) || 0;
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
              <p className="font-bold text-gray-800">{products.reduce((sum, p) => sum + (Number(p.inventory?.[0]?.current_stock ?? p.inventory?.[0]?.quantity ?? 0) || 0), 0)}</p>
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
                  <span className="supplier-order-money">
                    <span><small>Total</small><b>{formatUGX(order.total_amount_ugx ?? order.total_amount)}</b></span>
                    <span><small>Paid</small><b>{formatUGX(order.payment_status === 'paid' ? (order.total_amount_ugx ?? order.total_amount) : (order.amount_paid_ugx ?? order.amount_paid))}</b></span>
                    <span><small>Left</small><b>{formatUGX(Math.max(0, (Number(order.total_amount_ugx ?? order.total_amount) || 0) - (order.payment_status === 'paid' ? (Number(order.total_amount_ugx ?? order.total_amount) || 0) : (Number(order.amount_paid_ugx ?? order.amount_paid) || 0)))}</b></span>
                  </span>
                  <FiChevronDown className={`supplier-order-chevron${expandedOrderId === order.id ? ' is-open' : ''}`} aria-hidden="true" />
                </span>
              </button>
              {/* Expanded View - Order Details */}
              {expandedOrderId === order.id && (
                <div id={`supplier-order-details-${order.id}`} className="supplier-order-details so-order-details">
                  {/* Supplier Info */}
                  <div className="so-order-supplier">
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
                  <div className="so-order-facts">
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
                    <SoFold title="Payment tracker">
                      <OrderPaymentTracker
                        order={order}
           businessProfileId={activeBusinessProfileId}
           pricingMode={wholesalePricingMode}
                        onPaymentAdded={loadAllData}
                        showAddPayment={true}
                        userRole="manager"
                      />
                    </SoFold>
                  )}

                  {/* Items Summary */}
                  {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                    <div className="so-order-products">
                      <h5>Products ({order.items.length})</h5>
                      <ul className="so-order-products-list">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="so-order-product-row">
                            <div className="min-w-0">
                              <span className="block text-gray-700">{item.product_name || item.productName || item.name} × {item.quantity}</span>
                              {(item.barcode || item.batch_number || item.expiry_date) && <small className="block text-xs text-gray-500">
                                {[item.barcode ? `Barcode ${item.barcode}` : null, item.batch_number ? `Batch ${item.batch_number}` : null, item.expiry_date ? `Expires ${item.expiry_date}` : null].filter(Boolean).join(' · ')}
                              </small>}
                            </div>
                            <span className="font-semibold text-gray-900">
                              {formatUGX((item.unit_price || item.unitPrice) * item.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>
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
                    {false && (order.status === 'sent_to_supplier' || order.status === 'confirmed') && (
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
                    {false && order.status === 'received' && (
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

                    {order.supplier_quote_status === 'submitted' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('details');
                          setSelectedOrder(order);
                        }}
                        className="flex-1 min-w-[180px] bg-indigo-700 px-4 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-800"
                      >
                        <FiCheckCircle className="mr-2 inline h-5 w-5" />Review supplier proposal
                      </button>
                    )}

                    {['pending_approval', 'approved', 'sent_to_supplier', 'confirmed'].includes(order.status)
                      && !order.supplier_delivery_confirmed_at && (
                      <p className="so-receive-wait" role="status">
                        {order.status === 'confirmed'
                          ? 'Order accepted by supplier. Waiting for supplier delivery confirmation.'
                          : 'Waiting for the supplier to accept the order and confirm delivery.'}
                      </p>
                    )}

                    {/* Add Payment Button - quote-based orders unlock only after the manager accepts the final list */}
                    {(order.status === 'pending_approval' ||
                      order.status === 'approved' || 
                      order.status === 'sent_to_supplier' || 
                      order.status === 'confirmed' || 
                      order.status === 'received' || 
                      order.status === 'received') && 
                      order.payment_status !== 'paid' &&
                      (order.supplier_quote_status === 'not_requested' || order.supplier_quote_status === 'accepted') && (
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
                      title={order.status === 'received' || order.added_to_pos
                        ? 'This delivery is already active in POS'
                        : order.supplier_delivery_confirmed_at
                          ? 'Receive the supplier-confirmed delivery into POS'
                          : 'This action becomes available after the supplier confirms delivery'}
                      disabled={!order.items || order.items.length === 0 || order.added_to_pos || order.status === 'received' || order.status !== 'confirmed' || !order.supplier_delivery_confirmed_at}
                    >
                      <FiPlus className="h-5 w-5" />
                      <span>➕ {order.added_to_pos || order.status === 'received' ? 'Added to POS ✓' : 'Receive into POS'}</span>
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
      ), document.body)}

      {/* Create Order Modal */}
      {showCreateModal && (
      <CreateOrderModal
          suppliers={suppliers}
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
      {selectedOrder && !showPaymentModal && (() => {
        const detailTotal = Number(selectedOrder.total_amount_ugx ?? selectedOrder.total_amount ?? 0);
        const detailPaid = selectedOrder.payment_status === 'paid'
          ? detailTotal
          : Math.min(detailTotal, Math.max(0, Number(selectedOrder.amount_paid_ugx ?? selectedOrder.amount_paid ?? 0)));
        const detailBalance = Math.max(0, detailTotal - detailPaid);
        const quoteEnabled = selectedOrder.supplier_quote_status && selectedOrder.supplier_quote_status !== 'not_requested';
        const quoteAccepted = selectedOrder.supplier_quote_status === 'accepted';
        const canPay = ['pending_approval', 'approved', 'sent_to_supplier', 'confirmed', 'received'].includes(selectedOrder.status)
          && selectedOrder.payment_status !== 'paid'
          && (!quoteEnabled || quoteAccepted);
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
                    {quoteEnabled && (
                      <section className="mb-4">
                        {selectedOrder.supplier_quote_status === 'submitted' ? (
                          <PurchaseOrderQuoteEditor
                            mode="manager"
                            catalog={products}
                            taxRate={selectedOrder.tax_rate ?? 18}
                            initialItems={selectedOrder.supplier_quote_items || []}
                            initialNotes={selectedOrder.supplier_quote_review_notes || ''}
                            busy={quoteReviewBusy}
                            onSubmit={(items, notes, decision) => handleQuoteReview(selectedOrder.id, items, notes, decision)}
                          />
                        ) : (
                          <div className={`rounded-xl border p-4 ${quoteAccepted ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                            <p className={`font-semibold ${quoteAccepted ? 'text-green-900' : 'text-amber-900'}`}>
                              {quoteAccepted ? 'Final supply list approved' : selectedOrder.supplier_quote_status === 'awaiting_supplier_quote' ? 'Waiting for supplier proposal' : 'Waiting for supplier to update the proposal'}
                            </p>
                            <p className={`mt-1 text-sm ${quoteAccepted ? 'text-green-800' : 'text-amber-800'}`}>
                              {quoteAccepted
                                ? 'The agreed order total is ready for payment by cash or ICAN business wallet. Cash only needs supplier confirmation; wallet payments need an authorized administrator’s PIN approval.'
                                : 'The supplier can propose products, quantities, and prices. Payment remains locked until you approve the final list.'}
                            </p>
                            {selectedOrder.supplier_quote_review_notes && <p className="mt-2 text-sm"><strong>Review note:</strong> {selectedOrder.supplier_quote_review_notes}</p>}
                          </div>
                        )}
                      </section>
                    )}

                    <dl className="co-facts">
                      <div><dt>Total</dt><dd className="co-big">{formatUGX(detailTotal)}</dd></div>
                      <div><dt>Paid</dt><dd className="co-big co-good">{formatUGX(detailPaid)}</dd></div>
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
                      {!quoteEnabled ? <button
                        type="button"
                        className="co-btn-sm"
                        onClick={() => { setSelectedOrderForProduct(selectedOrder); setShowAddProductModal(true); }}
                      >
                        <FiPlus className="h-4 w-4" /> Add product
                      </button> : <span className="text-xs text-gray-500">{quoteAccepted ? 'Final supply list is locked after approval' : 'Edit products in the proposal above'}</span>}
                    </div>
                    {lines.length === 0 ? (
                      <p className="ois-empty">No items on this order.</p>
                    ) : (
                      <ul className="co-lines">
                        {lines.map((item, idx) => {
                          const price = item.unit_price || item.unitPrice || 0;
                          const itemDetails = [
                            `${item.quantity} × ${formatUGX(price)}`,
                            item.barcode ? `Barcode ${item.barcode}` : null,
                            item.batch_number ? `Batch ${item.batch_number}` : null,
                            item.expiry_date ? `Expires ${item.expiry_date}` : null,
                          ].filter(Boolean).join(' · ');
                          return (
                            <li key={idx}>
                              <span className="n">{item.product_name || item.productName || item.name}</span>
                              <span className="s">{itemDetails}</span>
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
                      showAddPayment={!quoteEnabled || quoteAccepted}
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

const CreateOrderModal = ({ suppliers, pricingMode = 'supplier_price', onClose, onSuccess }) => {
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
  
  // Page state: which sections are open, what is missing, and where to scroll to
  const [errors, setErrors] = useState({});
  const [supplierQuery, setSupplierQuery] = useState('');
  const [openSections, setOpenSections] = useState({ supplier: true, delivery: false, details: false });
  const sectionRefs = { supplier: useRef(null), items: useRef(null), delivery: useRef(null), details: useRef(null) };
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
    if (!expectedDeliveryDate) found.date = 'Pick a delivery date';
    if (!deliveryAddress.trim()) found.address = 'Add a delivery address';
    setErrors(found);
    const first = found.supplier ? 'supplier' : (found.date || found.address) ? 'delivery' : null;
    if (first) {
      goTo(first);
      return;
    }

    // A request can start without products. The supplier proposes the list,
    // then the manager approves it before payment can be submitted.
    await createOrder();
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
        orderedBy: managerId, // Use internal user ID, not auth_id
        // The store receiving the goods: stock is added to it when the order is marked received
        supermarketId: parsedUser.supermarket_id || null
      };

      const response = await supplierOrdersService.createPurchaseOrder(orderData);

      if (response.success) {
        const successMsg = 'Supply request sent. The supplier can now propose products and quantities. Payment unlocks after manager approval and requires administrator PIN approval.';
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
  const nextStep = !supplierDone ? 'supplier' : !deliveryDone ? 'delivery' : null;
  const ctaLabel = nextStep === 'supplier' ? 'Choose a supplier'
    : nextStep === 'delivery' ? (expectedDeliveryDate ? 'Add delivery address' : 'Set delivery date')
    : 'Send supply request';
  const unitCount = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const prettyDate = expectedDeliveryDate
    ? new Date(`${expectedDeliveryDate}T00:00:00`).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';
  const priorityLabel = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }[priority];
  return (
    <>
      <div className="co-root" role="dialog" aria-modal="true" aria-label="Create Supply Request">
        <header className="co-bar">
          <div className="co-bar-top">
            <button type="button" className="co-back" onClick={requestClose} disabled={submitting} aria-label="Back to orders">
              <FiArrowLeft className="h-5 w-5" />
            </button>
            <div className="co-title">
              <h1>Create Supply Request</h1>
              <p>{chosenSupplier ? chosenSupplier.business_name : 'SUPERMARTKERA Uganda · Supplier Order System'}</p>
            </div>
          </div>
          <div className="co-steps" role="list" aria-label="Progress">
            {[
              { key: 'supplier', label: 'Supplier', done: supplierDone },
              { key: 'items', label: 'Products (optional)', done: itemsDone || !orderItems.length },
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
                summary={chosenSupplier ? chosenSupplier.business_name : (errors.supplier || 'Tap to choose')}
                tone={chosenSupplier ? 'ok' : errors.supplier ? 'bad' : undefined}
                open={openSections.supplier}
                onToggle={() => toggleSection('supplier')}
                hasError={Boolean(errors.supplier)}
                sectionRef={sectionRefs.supplier}
              >
                {suppliers.length > 6 && (
                  <div className="co-pick-search">
                    <FiSearch className="co-pick-search-icon" aria-hidden="true" />
                    <input
                      type="search"
                      className="co-input"
                      value={supplierQuery}
                      onChange={(e) => setSupplierQuery(e.target.value)}
                      placeholder="Find a supplier"
                      aria-label="Find a supplier"
                    />
                  </div>
                )}
                <ul className="co-pick-list" role="listbox" aria-label="Supplier or wholesaler">
                  {[...suppliers]
                    .filter((supplier) => (supplier.business_name || '').toLowerCase().includes(supplierQuery.trim().toLowerCase()))
                    .sort((first, second) => (first.business_name || '').localeCompare(second.business_name || ''))
                    .map((supplier) => {
                      const chosen = supplier.id === selectedSupplier;
                      return (
                        <li key={supplier.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={chosen}
                            className={`co-pick-row${chosen ? ' is-chosen' : ''}`}
                            onClick={() => {
                              setSelectedSupplier(supplier.id);
                              setSupplierQuery('');
                              setErrors((previous) => ({ ...previous, supplier: undefined }));
                              setOpenSections((previous) => ({ ...previous, supplier: false }));
                              if (orderItems.length === 0) goTo('items');
                            }}
                          >
                            <span className="co-pick-mark" aria-hidden="true">{(supplier.business_name || '?').trim()[0]?.toUpperCase()}</span>
                            <span className="co-pick-name">{supplier.business_name}</span>
                            {chosen && <FiCheck className="co-pick-check" aria-hidden="true" />}
                          </button>
                        </li>
                      );
                    })}
                  {suppliers.length === 0 && <li className="ois-empty">No suppliers available yet.</li>}
                </ul>
              </CoFold>

              {/* 2. Products: a grid you tap */}
              <section className={`co-section${errors.items ? ' has-error' : ''}`} ref={sectionRefs.items}>
                <h2 className="co-open-title"><span aria-hidden="true">🛒</span> Starter products <span className="ml-2 text-xs font-medium text-gray-500">Optional</span></h2>
                <p className="mb-3 text-sm text-gray-600">Add a suggested list or leave it empty and let the supplier propose what they can provide.</p>
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

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <strong>Payment comes after quote approval.</strong> The manager approves the final supply list first. Then payment is submitted from the store business wallet for administrator PIN approval.
              </div>

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
  const quotePaymentOnly = Boolean(order?.supplier_quote_status && order.supplier_quote_status !== 'not_requested');
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

    if (quotePaymentOnly && order.supplier_quote_status !== 'accepted') {
      alert('The manager must approve the supplier proposal before payment can be requested.');
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

        alert(`✅ Cash payment recorded successfully!\n\nAmount Paid: ${formatUGX(amount)}\n⏳ Awaiting supplier confirmation. No wallet administrator approval is needed.`);
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

            <>
            <p className="co-label">Pay with</p>
            <div className="co-seg two" role="group" aria-label="Payment method">
              <button type="button" aria-pressed={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')}>💵 Cash</button>
              <button type="button" aria-pressed={paymentMethod === 'ican_wallet'} onClick={() => setPaymentMethod('ican_wallet')}>🪙 IcanEra Wallet</button>
            </div>
            </>

            {paymentMethod === 'cash' && quotePaymentOnly && (
              <div className="co-note">Cash is recorded for the supplier to confirm. It does not need a business-wallet PIN approval.</div>
            )}

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
        
        // Only this store's catalog: a same-named product in another store must
        // never be matched (its stock would be changed) and a new one belongs here.
        const supermarketId = await inventoryService.getCurrentSupermarketId();
        if (!supermarketId) throw new Error('No supermarket is assigned to this account.');

        // First, try to find existing product - use exact match on name
        const { data: existingProducts, error: searchError } = await supabase
          .from('products')
          .select('id, stock')
          .eq('supermarket_id', supermarketId)
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
              supermarket_id: supermarketId,
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
