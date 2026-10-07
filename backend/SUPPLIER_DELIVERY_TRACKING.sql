-- ============================================================================
-- SUPPLIER DELIVERY TRACKING (Supplier Portal "Deliveries" tab)
--
-- A supplier hands cargo to a BodaGoEra rider, but could not see that ride: the
-- rider, vehicle and trip status live in mbg_rides / mbg_journeys, which only the
-- customer, the rider and staff can read. This adds two narrow, supplier-scoped
-- functions and changes nothing else:
--
--   supplier_get_delivery_trips(order_ids[])
--       READ-ONLY. For purchase orders the caller supplies, returns the live
--       BodaGoEra ride (status, rider name, plate, vehicle, times) or the
--       multi-leg journey (road -> sea -> road). It never returns fares, phone
--       numbers or the buyer's payment details: freight is billed to the buyer
--       and is not the supplier's business.
--
--   supplier_set_order_dispatched(order_id, dispatched)
--       Lets a supplier who delivers an order THEMSELVES mark it "out for
--       delivery" (or undo that). It only moves transport_status; it never
--       touches purchase_orders.status, so stock is still added only when the
--       store confirms receipt. Refused while a BodaGoEra ride exists.
--
-- Ownership: a purchase order belongs to the caller when supplier_id is their
-- auth id or their public.users row, or their supplier business profile.
-- Run after SUPPLIER_BODAGOERA_TRANSPORT.sql. Safe to re-run.
-- The Deliveries tab works without this file (order-level status only); the rider
-- and trip details simply stay hidden until it is run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.supplier_owns_purchase_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_orders po
     WHERE po.id = p_order_id
       AND auth.uid() IS NOT NULL
       AND (
         po.supplier_id = auth.uid()
         OR po.supplier_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
         OR (po.supplier_business_profile_id IS NOT NULL
             AND public.unified_business_member(po.supplier_business_profile_id))
       )
  );
$$;

REVOKE ALL ON FUNCTION public.supplier_owns_purchase_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_owns_purchase_order(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- Live trips for a supplier's purchase orders
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supplier_get_delivery_trips(p_order_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in is required.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'order_id', o.id,
      'ride', (
        SELECT jsonb_build_object(
                 'id',            r.id,
                 'status',        r.status::TEXT,
                 'requested_at',  r.requested_at,
                 'accepted_at',   r.accepted_at,
                 'started_at',    r.started_at,
                 'completed_at',  r.completed_at,
                 'distance_km',   r.distance_km,
                 'pickup',        r.pickup_location,
                 'dropoff',       r.dropoff_location,
                 'rider_name',    COALESCE(NULLIF(btrim(up.full_name), ''), 'BodaGoEra rider'),
                 'rider_avatar',  up.avatar_url,
                 'rider_rating',  rd.rating,
                 'vehicle_type',  rd.vehicle_type::TEXT,
                 'plate_number',  rd.plate_number,
                 'vehicle_model', rd.vehicle_model,
                 'vehicle_color', rd.vehicle_color)
          FROM public.mbg_rides r
          LEFT JOIN public.mbg_riders rd ON rd.id = r.rider_id
          LEFT JOIN public.mbg_user_profiles up ON up.user_id = rd.user_id
         WHERE r.purchase_order_id = o.id
           AND r.status::TEXT NOT IN ('cancelled', 'failed', 'refunded')
         ORDER BY r.created_at DESC
         LIMIT 1
      ),
      'journey', (
        SELECT jsonb_build_object(
                 'id',     j.id,
                 'status', j.status,
                 'legs', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                            'leg_order',      l.leg_order,
                            'leg_type',       l.leg_type,
                            'status',         l.status,
                            'from',           COALESCE(l.origin_city, l.origin_country),
                            'to',             COALESCE(l.destination_city, l.destination_country),
                            'dispatched_at',  l.dispatched_at,
                            'completed_at',   l.completed_at) ORDER BY l.leg_order)
                   FROM public.mbg_journey_legs l WHERE l.journey_id = j.id), '[]'::JSONB))
          FROM public.mbg_journeys j
         WHERE j.purchase_order_id = o.id
           AND j.status NOT IN ('cancelled', 'failed')
         ORDER BY j.created_at DESC
         LIMIT 1
      )
    ))
    FROM public.purchase_orders o
    WHERE o.id = ANY (COALESCE(p_order_ids, ARRAY[]::UUID[]))
      AND public.supplier_owns_purchase_order(o.id)
  ), '[]'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_get_delivery_trips(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_get_delivery_trips(UUID[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- A supplier who delivers by themselves marks the order out for delivery
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supplier_set_order_dispatched(p_order_id UUID, p_dispatched BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.purchase_orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in is required.';
  END IF;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL OR NOT public.supplier_owns_purchase_order(p_order_id) THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_order.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only a confirmed order can be marked out for delivery (this one is "%").', v_order.status;
  END IF;

  IF EXISTS (SELECT 1 FROM public.mbg_rides r
              WHERE r.purchase_order_id = p_order_id
                AND r.status::TEXT NOT IN ('cancelled', 'failed', 'refunded'))
     OR EXISTS (SELECT 1 FROM public.mbg_journeys j
                 WHERE j.purchase_order_id = p_order_id AND j.status NOT IN ('cancelled', 'failed')) THEN
    RAISE EXCEPTION 'A BodaGoEra rider is already handling this delivery.';
  END IF;

  IF p_dispatched THEN
    UPDATE public.purchase_orders
       SET transport_provider = 'supplier',
           transport_status = 'dispatched',
           transport_requested_at = COALESCE(transport_requested_at, NOW()),
           updated_at = NOW()
     WHERE id = p_order_id;
  ELSE
    IF COALESCE(v_order.transport_provider, '') <> 'supplier' THEN
      RAISE EXCEPTION 'This order was not marked out for delivery by you.';
    END IF;
    UPDATE public.purchase_orders
       SET transport_provider = 'bodagoera',
           transport_status = 'not_requested',
           updated_at = NOW()
     WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'transport_status', CASE WHEN p_dispatched THEN 'dispatched' ELSE 'not_requested' END);
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_set_order_dispatched(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_set_order_dispatched(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'Supplier delivery tracking installed' AS status;
