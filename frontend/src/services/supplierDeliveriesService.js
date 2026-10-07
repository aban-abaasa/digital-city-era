import { supabase } from './supabase';
import { getSupplierOrderMatchIds, getSupplierBusinessProfileMatchIds } from './supplierOrdersService';
import {
  deliveryMethodOf, dueState, needsAction, nextStep, stageOf, trackOf, sortDeliveries, STAGE,
} from '../utils/supplierDeliveryStage';

// Everything the supplier's Deliveries tab shows, in one place:
//  - store purchase orders (purchase_orders), plus the live BodaGoEra ride or
//    multi-leg journey for each, when the tracking function is installed
//    (backend/SUPPLIER_DELIVERY_TRACKING.sql)
//  - marketplace / awarded-bid orders (supplier_marketplace_orders)
// Without the SQL the tab still works from order-level status; only the rider
// and trip details are missing (tripsAvailable = false).

const STORE_STATUSES = ['sent_to_supplier', 'approved', 'confirmed', 'received', 'completed'];
const MARKET_HIDDEN = ['rejected', 'cancelled'];
const LIMIT = 60;

const itemsSummary = (items) => {
  const names = (Array.isArray(items) ? items : []).map((item) => item?.product_name || item?.name).filter(Boolean);
  if (names.length === 0) return 'Various items';
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more` : names.join(', ');
};

async function resolveBusinessProfileIds(userIds, hintId) {
  const ids = new Set(hintId ? [hintId] : []);
  const [{ data: owned }, linked] = await Promise.all([
    supabase.from('business_profiles').select('id').in('user_id', userIds).eq('status', 'active')
      .contains('metadata', { source: 'supermarketa_supplier' }),
    getSupplierBusinessProfileMatchIds(userIds[0]),
  ]);
  (owned || []).forEach((row) => ids.add(row.id));
  (linked || []).forEach((id) => ids.add(id));
  return [...ids];
}

/** True when a pickup point is pinned, which riders need to be booked at all. */
async function hasPickupPin(userIds, businessProfileIds) {
  const checks = [];
  if (businessProfileIds.length) {
    checks.push(supabase.from('supplier_directory').select('latitude, longitude').in('business_profile_id', businessProfileIds));
  }
  checks.push(supabase.from('suppliers').select('latitude, longitude').in('user_id', userIds));
  const results = await Promise.all(checks);
  const rows = results.flatMap((result) => result.data || []);
  if (results.every((result) => result.error)) return null; // cannot tell
  return rows.some((row) => row.latitude != null && row.longitude != null);
}

export async function getSupplierDeliveries({ businessProfileHint = null } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in', deliveries: [] };

  try {
    const userIds = await getSupplierOrderMatchIds(user.id);
    const businessProfileIds = await resolveBusinessProfileIds(userIds, businessProfileHint);

    const identity = [`supplier_id.in.(${userIds.join(',')})`];
    if (businessProfileIds.length) identity.push(`supplier_business_profile_id.in.(${businessProfileIds.join(',')})`);

    const [storeResult, marketResult, pinned] = await Promise.all([
      supabase.from('purchase_orders')
        .select('id, po_number, status, total_amount, items, ordered_at, expected_delivery_date, delivered_date, delivery_address, delivery_instructions, delivery_method, transport_provider, transport_status, preferred_vehicle_type, pickup_address, supermarket_id, updated_at')
        .or(identity.join(','))
        .in('status', STORE_STATUSES)
        .order('ordered_at', { ascending: false })
        .limit(LIMIT),
      businessProfileIds.length
        ? supabase.from('supplier_marketplace_orders')
            .select('id, order_number, status, quantity, unit_price, created_at, updated_at, transport_provider, transport_status, transport_method, preferred_vehicle_type, pickup_address, delivery_address, delivery_details, buyer_business_profile_id')
            .in('supplier_business_profile_id', businessProfileIds)
            .not('status', 'in', `(${MARKET_HIDDEN.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(LIMIT)
        : Promise.resolve({ data: [] }),
      hasPickupPin(userIds, businessProfileIds),
    ]);

    if (storeResult.error) throw storeResult.error;
    const storeOrders = storeResult.data || [];
    const marketOrders = marketResult.data || [];

    // Who is buying: store names for purchase orders, business names for marketplace orders.
    const storeIds = [...new Set(storeOrders.map((o) => o.supermarket_id).filter(Boolean))];
    const buyerIds = [...new Set(marketOrders.map((o) => o.buyer_business_profile_id).filter(Boolean))];
    const [stores, buyers, tripResult] = await Promise.all([
      storeIds.length ? supabase.from('supermarkets').select('id, name, address, phone').in('id', storeIds) : { data: [] },
      buyerIds.length ? supabase.from('business_profiles').select('id, business_name').in('id', buyerIds) : { data: [] },
      storeOrders.length
        ? supabase.rpc('supplier_get_delivery_trips', { p_order_ids: storeOrders.map((o) => o.id) })
        : { data: [], error: null },
    ]);
    const storeById = Object.fromEntries((stores.data || []).map((s) => [s.id, s]));
    const buyerById = Object.fromEntries((buyers.data || []).map((b) => [b.id, b.business_name]));
    const tripsAvailable = !tripResult.error;
    const tripByOrder = Object.fromEntries((tripResult.data || []).map((t) => [t.order_id, t]));

    const toDelivery = (order, trip) => {
      const stage = stageOf(order, trip);
      const track = trackOf(order, trip, stage);
      const due = dueState(order, stage);
      return {
        ...order,
        trip: trip || null,
        stage,
        method: track.method,
        track,
        due,
        needsAction: needsAction(order, stage, track.method, due),
        next: nextStep(order, trip, stage, track.method),
      };
    };

    const store = storeOrders.map((o) => {
      const shop = storeById[o.supermarket_id];
      return toDelivery({
        key: `po:${o.id}`,
        kind: 'store',
        id: o.id,
        reference: o.po_number || String(o.id).slice(-8),
        buyer: shop?.name || 'Store',
        buyer_phone: shop?.phone || null,
        deliver_to: o.delivery_address || shop?.address || null,
        pickup_from: o.pickup_address || null,
        summary: itemsSummary(o.items),
        amount: Number(o.total_amount) || 0,
        ordered_at: o.ordered_at,
        status: o.status,
        expected_delivery_date: o.expected_delivery_date,
        delivered_date: o.delivered_date,
        delivery_method: o.delivery_method,
        transport_provider: o.transport_provider,
        transport_status: o.transport_status,
        vehicle: o.preferred_vehicle_type,
        instructions: o.delivery_instructions,
        updated_at: o.updated_at,
      }, tripByOrder[o.id]);
    });

    const market = marketOrders.map((o) => toDelivery({
      key: `mk:${o.id}`,
      kind: 'marketplace',
      id: o.id,
      reference: o.order_number,
      buyer: buyerById[o.buyer_business_profile_id] || 'Business buyer',
      buyer_phone: null,
      deliver_to: o.delivery_address || o.delivery_details?.delivery_address || null,
      pickup_from: o.pickup_address || null,
      summary: `Qty ${Number(o.quantity) || 0}`,
      amount: (Number(o.quantity) || 0) * (Number(o.unit_price) || 0),
      ordered_at: o.created_at,
      status: o.status,
      expected_delivery_date: o.delivery_details?.expected_delivery_date || null,
      delivered_date: null,
      delivery_method: null,
      transport_provider: o.transport_provider,
      transport_status: o.transport_status,
      vehicle: o.preferred_vehicle_type,
      instructions: null,
      updated_at: o.updated_at,
    }, null));

    return {
      success: true,
      deliveries: sortDeliveries([...store, ...market]),
      tripsAvailable,
      hasPickupPin: pinned,
      businessProfileId: businessProfileIds[0] || null,
    };
  } catch (error) {
    console.error('Error loading supplier deliveries:', error);
    return { success: false, error: error.message || 'Could not load deliveries', deliveries: [] };
  }
}

/** A supplier who delivers by themselves marks a confirmed order out for delivery (or undoes it). */
export async function setOrderDispatched(orderId, dispatched = true) {
  const { error } = await supabase.rpc('supplier_set_order_dispatched', { p_order_id: orderId, p_dispatched: dispatched });
  if (error) {
    const missing = /could not find the function|does not exist/i.test(error.message || '');
    return { success: false, error: missing ? 'Self-delivery tracking is not installed yet.' : error.message };
  }
  return { success: true };
}

export { STAGE };
export default { getSupplierDeliveries, setOrderDispatched };
