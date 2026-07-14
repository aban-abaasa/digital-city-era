import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Auto-dispatches a delivery vehicle right after a purchase order is
// approved, by calling into BodaGo's matching engine (same Supabase
// project — see mybodaguy/backend/database/ADD_SHIP_DISPATCH.sql,
// mbg_dispatch_cargo_for_purchase_order). This is best-effort: a failure
// here must never block the approval itself, since the manager already
// completed the action they came to do.
//
// mbg_dispatch_cargo_for_purchase_order decides internally (via
// mbg_route_needs_sea_leg) whether this is a same-bloc cross-border cargo
// hop (still a single truck/van match, unchanged) or a cross-bloc route
// needing a real road->sea->road journey — so this file only needs to
// resolve and pass along each side's own country, not compute a flattened
// country/cross_border pair itself anymore.
// ---------------------------------------------------------------------------

/**
 * Resolves supplier (pickup) and supermarket (dropoff) coordinates for a
 * purchase order. Returns null if either side hasn't been geocoded yet —
 * dispatch simply can't run without real coordinates (mbg_rides requires
 * them, same as every ordinary BodaGo ride), so this is a data-completeness
 * gap to close during supplier/store onboarding, not something to fake here.
 */
const resolvePickupAndDropoff = async (purchaseOrder) => {
  const { data: supermarket } = await supabase
    .from('supermarkets')
    .select('name, address, latitude, longitude, country')
    .eq('id', purchaseOrder.supermarket_id)
    .maybeSingle();

  let supplier = null;
  if (purchaseOrder.supplier_id) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .or(`auth_id.eq.${purchaseOrder.supplier_id},id.eq.${purchaseOrder.supplier_id}`)
      .eq('role', 'supplier')
      .maybeSingle();

    const { data: supplierRow } = await supabase
      .from('suppliers')
      .select('company_name, address, latitude, longitude, country')
      .eq('user_id', userRow?.id || purchaseOrder.supplier_id)
      .maybeSingle();
    supplier = supplierRow;
  }

  if (!supermarket?.latitude || !supermarket?.longitude || !supplier?.latitude || !supplier?.longitude) {
    return null;
  }

  return {
    pickupLat: supplier.latitude,
    pickupLng: supplier.longitude,
    pickupLocation: supplier.address || supplier.company_name || 'Supplier',
    pickupCountry: supplier.country || 'Uganda',
    dropoffLat: supermarket.latitude,
    dropoffLng: supermarket.longitude,
    dropoffLocation: supermarket.address || supermarket.name || 'Store',
    dropoffCountry: supermarket.country || 'Uganda'
  };
};

/**
 * Call right after a purchase_orders row transitions to 'approved'.
 * Returns { dispatched: boolean, reason?: string, rideId?: string } —
 * callers should surface `reason` as an informational note, not an error.
 */
export const dispatchDeliveryForPurchaseOrder = async (purchaseOrderId) => {
  try {
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, supermarket_id, supplier_id, preferred_vehicle_type')
      .eq('id', purchaseOrderId)
      .single();
    if (poError || !purchaseOrder) {
      return { dispatched: false, reason: 'Purchase order not found' };
    }

    const locations = await resolvePickupAndDropoff(purchaseOrder);
    if (!locations) {
      return { dispatched: false, reason: 'Supplier or store location is not geocoded yet — dispatch skipped' };
    }

    const { data, error } = await supabase.rpc('mbg_dispatch_cargo_for_purchase_order', {
      p_purchase_order_id: purchaseOrderId,
      p_pickup_lat: locations.pickupLat,
      p_pickup_lng: locations.pickupLng,
      p_pickup_location: locations.pickupLocation,
      p_pickup_country: locations.pickupCountry,
      p_dropoff_lat: locations.dropoffLat,
      p_dropoff_lng: locations.dropoffLng,
      p_dropoff_location: locations.dropoffLocation,
      p_dropoff_country: locations.dropoffCountry,
      p_preferred_vehicle_type: purchaseOrder.preferred_vehicle_type || null
    });

    if (error) {
      console.error('deliveryDispatchService: RPC error:', error);
      return { dispatched: false, reason: error.message };
    }
    if (!data?.success) {
      return { dispatched: false, reason: data?.error || 'No vehicle available right now' };
    }

    // Same-bloc cargo returns { ride_id, rider_id, fare } (single hop, as
    // before); a cross-bloc route returns { journey_id, via_sea: true }
    // instead — the first (road-to-port) leg's own ride/fare aren't known
    // by the caller until it dispatches, seconds later.
    return { dispatched: true, rideId: data.ride_id, rider_id: data.rider_id, fare: data.fare, journeyId: data.journey_id, viaSea: !!data.via_sea };
  } catch (err) {
    console.error('deliveryDispatchService: unexpected error:', err);
    return { dispatched: false, reason: err.message };
  }
};
