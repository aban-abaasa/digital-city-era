import { supabase } from './supabase';
import { transferFromBusinessWallet, getOrCreateBusinessWallet } from './icanWalletService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getManagerId = () => {
  try {
    const stored = localStorage.getItem('supermarket_user');
    return stored ? JSON.parse(stored).id : null;
  } catch {
    return null;
  }
};

// Pichin business profiles own the wallet used for business payments. Staff
// may initiate the order, but their personal wallet must never be charged.
export const getBusinessWallet = async (businessProfileId) => {
  if (!businessProfileId) return null;
  return getOrCreateBusinessWallet(businessProfileId);
};

export const getBusinessWalletBalance = async (businessProfileId) => {
  const wallet = await getBusinessWallet(businessProfileId);
  return wallet ? {
    ican: Number(wallet.ican_balance || 0),
    ugx: Number(wallet.ican_balance || 0) * 5000,
    address: wallet.wallet_address || null,
  } : null;
};

// Resolve the supermarket's linked Pichin business profile for manager screens
// that were opened before the link was copied onto supermarkets. This keeps
// staff wallets out of supplier-order payments while supporting older account
// shapes used by the shared business-profile flow.
export const resolveBusinessProfileId = async (providedProfileId = null) => {
  if (providedProfileId) return providedProfileId;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data: userRows } = await supabase
    .from('users')
    .select('id, supermarket_id')
    .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
    .limit(1);
  const userRow = userRows?.[0] || null;
  let supermarketId = userRow?.supermarket_id || null;

  if (!supermarketId) {
    const { data: ownedSupermarket } = await supabase
      .from('supermarkets')
      .select('id, pichin_business_profile_id')
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (ownedSupermarket?.pichin_business_profile_id) return ownedSupermarket.pichin_business_profile_id;
    supermarketId = ownedSupermarket?.id || null;
  }

  if (supermarketId) {
    const { data: supermarket } = await supabase
      .from('supermarkets')
      .select('pichin_business_profile_id')
      .eq('id', supermarketId)
      .maybeSingle();
    if (supermarket?.pichin_business_profile_id) return supermarket.pichin_business_profile_id;

    const { data: appLink } = await supabase
      .from('business_app_links')
      .select('business_profile_id')
      .eq('app_key', 'supermarketa')
      .eq('source_entity_id', supermarketId)
      .eq('status', 'active')
      .maybeSingle();
    if (appLink?.business_profile_id) return appLink.business_profile_id;
  }

  const ownerIds = [...new Set([user.id, userRow?.id].filter(Boolean))];
  if (ownerIds.length) {
    const { data: ownedBusiness } = await supabase
      .from('business_profiles')
      .select('id')
      .in('user_id', ownerIds)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (ownedBusiness?.id) return ownedBusiness.id;
  }

  if (user.email) {
    const { data: coOwnedBusiness } = await supabase
      .from('business_co_owners')
      .select('business_profile_id')
      .ilike('owner_email', user.email)
      .in('status', ['active', 'approved'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (coOwnedBusiness?.business_profile_id) return coOwnedBusiness.business_profile_id;
  }

  return null;
};

// purchase_orders.supplier_id was historically written as either the supplier's
// auth UUID or their internal users.id row (see FIX_CURRENT_USER_HELPERS_ID_FALLBACK.sql
// for the same auth_id/id split elsewhere). Resolve both so orders stored under
// either id are still found. Use this (instead of a bare .eq('supplier_id', authId))
// in every supplier-facing query against purchase_orders.
export const getSupplierOrderMatchIds = async (authId) => {
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .or(`auth_id.eq.${authId},id.eq.${authId}`)
    .eq('role', 'supplier')
    .maybeSingle();

  return [...new Set([authId, userRow?.id].filter(Boolean))];
};

// A supplier's Pichin business profile is the durable order identity for new
// business-to-business flows. Return linked profiles as well as legacy user IDs
// so orders remain visible during the migration from personal to business IDs.
export const getSupplierBusinessProfileMatchIds = async (authId) => {
  const userIds = await getSupplierOrderMatchIds(authId);
  const { data: applications } = await supabase
    .from('supplier_applications')
    .select('supplier_business_profile_id')
    .in('supplier_user_id', userIds)
    .not('supplier_business_profile_id', 'is', null);
  return [...new Set((applications || []).map((row) => row.supplier_business_profile_id).filter(Boolean))];
};

// ---------------------------------------------------------------------------
// Suppliers — read from the shared CMMS/Pichin supplier directory.
// Store-by-store approval applications are historical compatibility data only.
// ---------------------------------------------------------------------------

export const getActiveSuppliers = async () => {
  try {
    const [{ data: publishedBusinesses, error: directoryError }, { data: businessProfiles, error: profilesError }] = await Promise.all([
      supabase
        .from('supplier_directory')
        .select('business_profile_id, supplier_user_id, supplier_type, business_profiles(id, business_name, business_type, user_id, status)')
        .eq('is_published', true),
      supabase
        .from('business_profiles')
        .select('id, user_id, business_name, business_type, status')
        .eq('status', 'active')
    ]);

    if (directoryError && profilesError) throw directoryError;

    const seen = new Set();
    const suppliers = [];
    (publishedBusinesses || []).forEach((listing) => {
      const profile = listing.business_profiles;
      const supplierId = listing.supplier_user_id || profile?.user_id;
      if (!supplierId || seen.has(listing.business_profile_id)) return;
      seen.add(listing.business_profile_id);
      const name = profile?.business_name || listing.supplier_type || 'Supplier';
      suppliers.push({
        id: supplierId,
        application_id: null,
        supplier_business_profile_id: listing.business_profile_id,
        company_name: name,
        business_name: name,
        contact_email: '',
        contact_phone: '',
        supplier_code: `BUS-${String(listing.business_profile_id || supplierId).slice(-6)}`,
        source: 'business_directory'
      });
    });

    // CMMS wholesalers, factories, hardware businesses, and supplier profiles
    // are available globally as soon as their shared business profile is active.
    // No supermarket manager approval is required.
    (businessProfiles || []).forEach((profile) => {
      const type = String(profile.business_type || '').toLowerCase();
      const isSupplierBusiness = ['wholesale', 'supplier', 'factory', 'hardware', 'raw material'].some(value => type.includes(value));
      if (!isSupplierBusiness || !profile.user_id || seen.has(profile.id)) return;
      seen.add(profile.id);
      const supplierId = profile.user_id;
      suppliers.push({
        id: supplierId,
        application_id: null,
        supplier_business_profile_id: profile.id,
        company_name: profile.business_name || 'Supplier',
        business_name: profile.business_name || 'Supplier',
        contact_email: '',
        contact_phone: '',
        supplier_code: `BUS-${String(profile.id).slice(-6)}`,
        source: 'cmms_business_profile'
      });
    });

    return { success: true, suppliers };
  } catch (error) {
    console.error('Error fetching active suppliers:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Purchase Orders — CRUD
// Actual DB columns: manager_id, ordered_at, total_amount, subtotal, tax_amount
// ---------------------------------------------------------------------------

export const getAllPurchaseOrders = async ({ status = null } = {}) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: orders, error } = await query;
    if (error) throw error;

    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return { success: false, error: error.message };
  }
};

export const getOrderHistory = async ({ status = null } = {}) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .in('status', ['received', 'completed', 'cancelled'])
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: orders, error } = await query;
    if (error) throw error;

    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Error fetching order history:', error);
    return { success: false, error: error.message };
  }
};

export const getOrdersByPaymentStatus = async (paymentStatus) => {
  try {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Error fetching orders by payment status:', error);
    return { success: false, error: error.message };
  }
};

export const createPurchaseOrder = async (orderData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const managerId = user?.id || getManagerId();

    const subtotal = (orderData.items || []).reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
      0
    );
    const taxAmount = subtotal * 0.18;
    const totalAmount = subtotal + taxAmount;

    const poNumber = `PO-${Date.now().toString().slice(-8)}`;

    // Accept either camelCase (as sent by SupplierOrderManagement's CreateOrderModal)
    // or snake_case keys — a prior mismatch here (orderData.supplier_id vs the
    // supplierId actually sent) meant every order was inserted with a NULL
    // supplier_id, so suppliers never saw orders managers had submitted.
    const selectedSupplierId = orderData.supplierId ?? orderData.supplier_id;
    if (!selectedSupplierId) throw new Error('Select a supplier before creating the order');

    // purchase_orders.supplier_id references public.users.id, but older screens
    // sometimes pass auth.users.id. Normalize it before inserting so the
    // supplier portal can always find the order.
    const { data: supplierRows, error: supplierLookupError } = await supabase
      .from('users')
      .select('id, auth_id')
      .or(`id.eq.${selectedSupplierId},auth_id.eq.${selectedSupplierId}`)
      .eq('role', 'supplier');
    if (supplierLookupError) throw supplierLookupError;
    const supplierRow = supplierRows?.[0];
    const supplierId = supplierRow?.id || selectedSupplierId;

    // Applications remain historical compatibility data only; they are not
    // required for a new supplier relationship.
    const { data: supplierApplication, error: applicationError } = await supabase
      .from('supplier_applications')
      .select('supplier_business_profile_id')
      .in('supplier_user_id', [...new Set([selectedSupplierId, supplierId])])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (applicationError && applicationError.code !== 'PGRST116') throw applicationError;

    const supplierBusinessProfileId = orderData.supplierBusinessProfileId
      ?? orderData.supplier_business_profile_id
      ?? supplierApplication?.supplier_business_profile_id
      ?? null;

    let resolvedSupplierBusinessProfileId = supplierBusinessProfileId;
    if (!resolvedSupplierBusinessProfileId) {
      const supplierOwnerIds = [...new Set([supplierId, supplierRow?.auth_id].filter(Boolean))];
      const { data: supplierBusiness } = await supabase
        .from('business_profiles')
        .select('id')
        .in('user_id', supplierOwnerIds)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      resolvedSupplierBusinessProfileId = supplierBusiness?.id || null;
    }

    const selectedManagerId = managerId;
    const { data: managerRow } = selectedManagerId ? await supabase
      .from('users')
      .select('id, supermarket_id')
      .or(`id.eq.${selectedManagerId},auth_id.eq.${selectedManagerId}`)
      .maybeSingle() : { data: null };
    const expectedDeliveryDate = orderData.expectedDeliveryDate ?? orderData.expected_delivery_date ?? null;
    const deliveryAddress = orderData.deliveryAddress ?? orderData.delivery_address ?? null;
    const deliveryInstructions = orderData.deliveryInstructions ?? orderData.delivery_instructions ?? null;

    const insertPayload = {
      po_number:             poNumber,
      supplier_id:           supplierId,
       manager_id:            managerId,
       supermarket_id:        managerRow?.supermarket_id || orderData.supermarketId || orderData.supermarket_id || null,
      items:                 orderData.items || [],
      notes:                 orderData.notes || '',
       supplier_business_profile_id: resolvedSupplierBusinessProfileId,
      expected_delivery_date: expectedDeliveryDate,
      delivery_address:      deliveryAddress,
      delivery_instructions: deliveryInstructions,
      priority:              orderData.priority || 'normal',
      status:                'pending_approval',
      subtotal:              subtotal,
      tax_amount:            taxAmount,
      total_amount:          totalAmount,
      // Initialize payment tracking so the balance is correct from the start —
      // otherwise balance_due_ugx stays NULL/0 and the "Add Payment" UI never appears.
      payment_status:        'unpaid',
      balance_due_ugx:       totalAmount,
      ordered_at:            new Date().toISOString(),
      transport_provider:    'bodagoera',
      transport_status:      'not_requested',
      pickup_address:        orderData.pickupAddress ?? orderData.pickup_address ?? null,
      pickup_latitude:       orderData.pickupLatitude ?? orderData.pickup_latitude ?? null,
      pickup_longitude:      orderData.pickupLongitude ?? orderData.pickup_longitude ?? null,
      pickup_country:        orderData.pickupCountry ?? orderData.pickup_country ?? null,
    };

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return { success: true, order: data };
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return { success: false, error: error.message };
  }
};

export const rejectPurchaseOrder = async (orderId, reason, managerId) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled', notes: reason || 'Rejected by manager' })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, order: data };
  } catch (error) {
    console.error('Error rejecting purchase order:', error);
    return { success: false, error: error.message };
  }
};

export const sendOrderToSupplier = async (orderId, managerId) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'sent_to_supplier' })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, order: data };
  } catch (error) {
    console.error('Error sending order to supplier:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getSupplierOrderStats = async () => {
  try {
    const { data: orders, error } = await supabase
      .from('purchase_orders')
      .select('*');

    if (error) throw error;

    const stats = {
      total:       orders?.length || 0,
      pending:     orders?.filter(o => o.status === 'pending_approval').length || 0,
      approved:    orders?.filter(o => o.status === 'approved').length || 0,
      sent:        orders?.filter(o => o.status === 'sent_to_supplier').length || 0,
      confirmed:   orders?.filter(o => o.status === 'confirmed').length || 0,
      received:    orders?.filter(o => o.status === 'received').length || 0,
      cancelled:   orders?.filter(o => o.status === 'cancelled').length || 0,
      totalValue:  orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
    };

    return { success: true, stats };
  } catch (error) {
    console.error('Error fetching order stats:', error);
    return { success: false, stats: {} };
  }
};

// ---------------------------------------------------------------------------
// Deliveries — mark purchase_order as received
// ---------------------------------------------------------------------------

export const getAllDeliveries = async () => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('status', 'received')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, deliveries: data || [] };
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return { success: false, error: error.message };
  }
};

export const createDelivery = async (orderId, deliveryData = {}) => {
  try {
    const allowedMethods = ['supplier_delivery', 'mybodaguy_delivery', 'supermarket_pickup'];
    if (!allowedMethods.includes(deliveryData.deliveryMethod)) {
      throw new Error('Choose a delivery method before recording delivery');
    }
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        delivery_method: deliveryData.deliveryMethod,
        delivery_selected_by: (await supabase.auth.getUser()).data.user?.id || null,
        delivery_selected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: deliveryData.notes || 'Delivery recorded'
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, delivery: data };
  } catch (error) {
    console.error('Error recording delivery:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Payment tracking — replaces the missing record_payment_with_tracking RPC
// ---------------------------------------------------------------------------

export const recordPayment = async ({ orderId, amountPaid, paymentMethod, paymentReference, notes, paidBy }) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || paidBy;

    if (!userId) throw new Error('No authenticated user for payment recording');

    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        purchase_order_id: orderId,
        user_id:           userId,
        recorded_by:       userId,
        amount_ugx:        amountPaid,
        payment_method:    paymentMethod || 'cash',
        payment_reference: paymentReference || null,
        payment_status:    'confirmed',
        payment_date:      new Date().toISOString(),
        notes:             notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, payment: data };
  } catch (error) {
    const msg = error?.message || error?.details || JSON.stringify(error) || 'Unknown error';
    console.error('Error recording payment:', msg);
    return { success: false, error: msg };
  }
};

// Pay a supplier order straight from the manager's ICAN wallet. Unlike cash/
// mobile money/bank transfer, the transfer itself is provable and instant —
// sendICAN() already validates the manager's balance and moves the coins —
// so this records the payment as confirmed immediately instead of waiting
// on a separate supplier confirmation step.
// Note: like every ICAN transfer platform-wide, there is no fee on sends
// (see transfer_ican) — the supplier receives the full ICAN amount sent.
// Submit a supplier payment request from the supermarket business wallet.
// Store workers may submit it, but an authorized wallet administrator must
// approve it with the business-wallet PIN before either wallet is changed.
export const payOrderWithICAN = async ({ orderId, supplierUserId, supplierBusinessProfileId, icanAmount, ugxAmount, notes, businessProfileId, businessWalletPin }) => {
  try {
    if (!supplierUserId) throw new Error('This order has no supplier assigned — cannot pay with ICAN.');
    if (!businessProfileId) throw new Error('This supermarket has no linked Pichin business account. ICAN payment is unavailable.');
    if (!supplierBusinessProfileId) throw new Error('This supplier has no linked Pichin business account. ICAN payment is unavailable.');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user for ICAN payment');
    const transfer = await transferFromBusinessWallet({
      businessProfileId,
      recipientUserId: supplierUserId,
      recipientBusinessProfileId: supplierBusinessProfileId,
      amount: icanAmount,
      note: notes || `Purchase order payment (${orderId})`,
      referenceId: orderId,
      pin: businessWalletPin,
    });

    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        purchase_order_id: orderId,
        user_id: user.id,
        recorded_by: user.id,
        amount_ugx: ugxAmount,
        payment_method: 'ican_wallet',
        payment_reference: transfer?.transaction_id || null,
        payment_status: 'pending',
        payment_date: new Date().toISOString(),
        confirmed_by_supplier: false,
        confirmation_date: null,
        confirmation_notes: transfer?.status === 'completed'
          ? 'ICAN wallet transfer completed'
          : 'Awaiting authorized business-wallet administrator approval',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      payment: data,
      transfer,
      pending_confirmation: transfer?.status !== 'completed',
      wallet_approval_required: transfer?.status === 'pending_approval',
    };
  } catch (error) {
    const msg = error?.message || 'Unknown error';
    console.error('Error paying order with ICAN:', msg);
    return { success: false, error: msg };
  }
};

// Recompute amount_paid_ugx / balance_due_ugx / payment_status on the order
// from its confirmed payment_transactions rows. Must run after every
// confirmation — nothing else keeps these columns in sync (the RPC these
// were designed around, record_payment_with_tracking, was never created).
export const syncOrderPaymentTotals = async (orderId) => {
  const { data: order, error: orderErr } = await supabase
    .from('purchase_orders')
    .select('total_amount')
    .eq('id', orderId)
    .single();

  if (orderErr) throw orderErr;

  const { data: txns, error: txErr } = await supabase
    .from('payment_transactions')
    .select('amount_ugx')
    .eq('purchase_order_id', orderId)
    .eq('confirmed_by_supplier', true);

  if (txErr) throw txErr;

  const totalAmount = parseFloat(order?.total_amount) || 0;
  const amountPaid = (txns || []).reduce((sum, t) => sum + (parseFloat(t.amount_ugx) || 0), 0);
  const balanceDue = Math.max(totalAmount - amountPaid, 0);
  const paymentStatus = amountPaid <= 0 ? 'unpaid' : balanceDue <= 0 ? 'paid' : 'partially_paid';

  const { error: updateErr } = await supabase
    .from('purchase_orders')
    .update({
      amount_paid_ugx: amountPaid,
      balance_due_ugx: balanceDue,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateErr) throw updateErr;

  return { amountPaid, balanceDue, paymentStatus };
};

// Confirm a payment transaction (supplier side) and roll the totals up onto
// the order — the two must happen together or the order's tracked balance
// silently stops matching the actual confirmed payments.
export const confirmPayment = async (txnId, confirmationNotes = '') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to confirm a payment');

    const { data: txn, error: fetchErr } = await supabase
      .from('payment_transactions')
      .select('purchase_order_id')
      .eq('id', txnId)
      .single();

    if (fetchErr) throw fetchErr;

    const { data: order, error: orderErr } = await supabase
      .from('purchase_orders')
      .select('supplier_id, supplier_business_profile_id')
      .eq('id', txn.purchase_order_id)
      .single();
    if (orderErr) throw orderErr;

    const supplierIds = await getSupplierOrderMatchIds(user.id);
    const supplierBusinessIds = await getSupplierBusinessProfileMatchIds(user.id);
    const ownsOrder = supplierIds.includes(order.supplier_id)
      || (order.supplier_business_profile_id && supplierBusinessIds.includes(order.supplier_business_profile_id));
    if (!ownsOrder) throw new Error('You cannot confirm a payment for this supplier order');

    const { error: confirmErr } = await supabase
      .from('payment_transactions')
      .update({
        confirmed_by_supplier: true,
        confirmation_date: new Date().toISOString(),
        confirmation_notes: confirmationNotes.trim() || null,
        payment_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', txnId);

    if (confirmErr) throw confirmErr;

    const totals = await syncOrderPaymentTotals(txn.purchase_order_id);
    return { success: true, ...totals };
  } catch (error) {
    console.error('Error confirming payment:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Approve supplier (status management in users table)
// ---------------------------------------------------------------------------

export const updateSupplierStatus = async (supplierId, status) => {
  try {
    const isActive = status === 'active';
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', supplierId)
      .eq('role', 'supplier')
      .select()
      .single();

    if (error) throw error;
    return { success: true, supplier: data };
  } catch (error) {
    console.error('Error updating supplier status:', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Default export object (component uses `import supplierOrdersService from ...`)
// ---------------------------------------------------------------------------

const supplierOrdersService = {
  getActiveSuppliers,
  getAllPurchaseOrders,
  getOrderHistory,
  getOrdersByPaymentStatus,
  createPurchaseOrder,
  rejectPurchaseOrder,
  sendOrderToSupplier,
  getSupplierOrderStats,
  getAllDeliveries,
  createDelivery,
  updateSupplierStatus,
  recordPayment,
  payOrderWithICAN,
  confirmPayment,
  syncOrderPaymentTotals,
  getSupplierOrderMatchIds,
  getSupplierBusinessProfileMatchIds,
};

export default supplierOrdersService;
