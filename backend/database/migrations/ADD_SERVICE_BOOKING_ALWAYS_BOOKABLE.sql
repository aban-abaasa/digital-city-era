-- ============================================================
-- SERVICE BOOKING — "sold out" is a badge, never a wall
-- ============================================================
-- Today, once a slot/date/night hits its capacity, two things happen:
--   1. fn_get_available_slots stops returning it at all (it just
--      vanishes from the picker instead of showing as full).
--   2. fn_create_service_booking re-checks capacity under a lock and
--      HARD-REJECTS the booking with "Not enough spots left" /
--      "Not enough rooms available on <date>" if someone still tries.
--
-- That's a real wait-list problem for a business that wants to take every
-- request and decide by hand (chat/call the customer, confirm/decline).
-- Every booking already lands as status='requested' — nothing is
-- auto-confirmed — so capacity doesn't need to be a hard limit at all.
--
-- This migration keeps capacity as *information* (so the UI can show a
-- "Sold out" badge and stop pretending there's room) but removes it as a
-- *gate*: every open slot/date always stays bookable, however oversubscribed.
--
-- What still legitimately blocks a booking (unchanged):
--   - A day/slot the admin has explicitly closed (a blackout row, or no
--     rule covering that weekday at all) — that's a deliberate "we are not
--     open then" decision, not a capacity problem, and fn_get_available_slots
--     still omits it entirely.
--   - Missing required fields (name, valid check-out date, etc).
--
-- Run after: ADD_SERVICE_BOOKING_DEFAULT_AVAILABILITY.sql.
-- Safe to run more than once.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_available_slots(p_product_id UUID, p_date DATE)
RETURNS TABLE (slot_start TIME, slot_end TIME, spots_left INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_override BOOLEAN;
  v_has_dow_rule BOOLEAN;
  v_dow SMALLINT := EXTRACT(DOW FROM p_date)::SMALLINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.service_availability_rules
    WHERE product_id = p_product_id AND specific_date = p_date
  ) INTO v_has_override;

  SELECT EXISTS (
    SELECT 1 FROM public.service_availability_rules
    WHERE product_id = p_product_id AND specific_date IS NULL AND day_of_week = v_dow
  ) INTO v_has_dow_rule;

  RETURN QUERY
  WITH scope AS (
    SELECT r.start_time, r.end_time, r.slot_minutes, r.capacity, r.is_blackout
    FROM public.service_availability_rules r
    WHERE r.product_id = p_product_id
      AND (
        (v_has_override AND r.specific_date = p_date)
        OR (NOT v_has_override AND v_has_dow_rule AND r.specific_date IS NULL AND r.day_of_week = v_dow)
        OR (NOT v_has_override AND NOT v_has_dow_rule AND r.specific_date IS NULL AND r.day_of_week IS NULL)
      )
  ),
  full_day_blackout AS (
    SELECT 1 FROM scope WHERE is_blackout = true AND start_time IS NULL
  ),
  rules AS (
    SELECT start_time, end_time, slot_minutes, capacity
    FROM scope
    WHERE is_blackout = false AND NOT EXISTS (SELECT 1 FROM full_day_blackout)
  ),
  blocks AS (
    SELECT start_time, end_time
    FROM scope
    WHERE is_blackout = true AND start_time IS NOT NULL AND end_time IS NOT NULL
  ),
  candidate_slots AS (
    SELECT
      (r.start_time + make_interval(mins => n))::TIME AS slot_start,
      (r.start_time + make_interval(mins => n + r.slot_minutes))::TIME AS slot_end,
      r.capacity
    FROM rules r,
      LATERAL generate_series(
        0,
        (EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 60)::INT - r.slot_minutes,
        r.slot_minutes
      ) AS n
  ),
  open_slots AS (
    SELECT cs.slot_start, cs.slot_end, cs.capacity
    FROM candidate_slots cs
    WHERE NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE cs.slot_start < b.end_time AND cs.slot_end > b.start_time
    )
  ),
  booked AS (
    SELECT b.slot_start, SUM(b.quantity)::INT AS taken
    FROM public.service_bookings b
    WHERE b.product_id = p_product_id
      AND p_date >= b.booking_date
      AND p_date < COALESCE(b.checkout_date, b.booking_date + 1)
      AND b.status IN ('requested', 'confirmed')
    GROUP BY b.slot_start
  )
  -- No more "WHERE spots_left > 0" — a fully (or over-) booked slot is still
  -- returned, just with spots_left clamped to 0, so the UI can badge it
  -- "Sold out" instead of making it disappear. Booking it is still allowed;
  -- fn_create_service_booking below no longer rejects on capacity either.
  SELECT os.slot_start, os.slot_end, GREATEST((os.capacity - COALESCE(bk.taken, 0))::INT, 0) AS spots_left
  FROM open_slots os
  LEFT JOIN booked bk ON bk.slot_start = os.slot_start
  ORDER BY os.slot_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_available_slots(UUID, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_create_service_booking(
  p_product_id UUID,
  p_booking_date DATE,
  p_slot_start TIME DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_origin_app TEXT DEFAULT 'digital-city-era',
  p_quantity INT DEFAULT 1,
  p_checkout_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_product RECORD;
  v_slot_end TIME;
  v_spots_left INT;
  v_check_date DATE;
  v_booking public.service_bookings%ROWTYPE;
  v_conversation_id UUID;
  v_local_user_id UUID;
  v_local_name TEXT;
  v_display_name TEXT;
  v_qty_label TEXT;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required to book');
  END IF;

  IF p_customer_name IS NULL OR LENGTH(TRIM(p_customer_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name is required');
  END IF;

  SELECT id, supermarket_id, name, is_bookable, booking_type INTO v_product
  FROM public.products WHERE id = p_product_id;

  IF NOT FOUND OR v_product.is_bookable IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'This service is not bookable');
  END IF;

  p_quantity := COALESCE(p_quantity, 1);
  IF p_quantity < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be at least 1');
  END IF;

  IF v_product.booking_type = 'slot' THEN
    p_quantity := 1;
    p_checkout_date := NULL;
    IF p_slot_start IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Pick a time');
    END IF;
  ELSIF v_product.booking_type = 'room' THEN
    p_slot_start := '00:00:00'::TIME;
    IF p_checkout_date IS NULL OR p_checkout_date <= p_booking_date THEN
      RETURN jsonb_build_object('success', false, 'error', 'Pick a valid check-out date after check-in');
    END IF;
  ELSE -- 'ticket'
    p_slot_start := '00:00:00'::TIME;
    p_checkout_date := NULL;
  END IF;

  -- Serialize concurrent attempts. A 'slot' booking only needs to lock its
  -- own exact slot; 'ticket'/'room' bookings all share one whole-day
  -- pseudo-slot (and a room stay can span several of them), so lock the
  -- whole product instead to fully serialize those.
  IF v_product.booking_type = 'slot' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_product_id::TEXT || p_booking_date::TEXT || p_slot_start::TEXT));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(p_product_id::TEXT));
  END IF;

  -- Capacity is no longer a gate here — only "is this day/slot actually
  -- open at all" is. A slot/date the admin hasn't opened (outside hours, a
  -- blackout, or a weekday with no rule and no default) simply won't come
  -- back from fn_get_available_slots, and THAT still blocks the booking.
  -- Being fully booked does not: the request still goes through, lands as
  -- 'requested', and the store approves/declines it by hand.
  IF v_product.booking_type = 'room' THEN
    v_check_date := p_booking_date;
    WHILE v_check_date < p_checkout_date LOOP
      SELECT spots_left INTO v_spots_left
      FROM public.fn_get_available_slots(p_product_id, v_check_date)
      WHERE slot_start = p_slot_start;

      IF v_spots_left IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not open for booking on ' || v_check_date::TEXT);
      END IF;
      v_check_date := v_check_date + 1;
    END LOOP;
    v_slot_end := '23:59:00'::TIME;
  ELSE
    SELECT slot_end, spots_left INTO v_slot_end, v_spots_left
    FROM public.fn_get_available_slots(p_product_id, p_booking_date)
    WHERE slot_start = p_slot_start;

    IF v_slot_end IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'That slot is no longer available');
    END IF;
  END IF;

  SELECT id, full_name INTO v_local_user_id, v_local_name
  FROM public.users WHERE auth_id = v_auth_id LIMIT 1;

  v_display_name := COALESCE(v_local_name, TRIM(p_customer_name));

  INSERT INTO public.service_bookings (
    supermarket_id, product_id, user_id, customer_name, customer_phone, customer_email,
    booking_date, slot_start, slot_end, quantity, checkout_date, notes
  ) VALUES (
    v_product.supermarket_id, p_product_id, v_auth_id, TRIM(p_customer_name), p_customer_phone, p_customer_email,
    p_booking_date, p_slot_start, v_slot_end, p_quantity, p_checkout_date, p_notes
  )
  RETURNING * INTO v_booking;

  -- Reuse this customer's already-open booking thread for this exact
  -- service if one exists, otherwise start a fresh one.
  SELECT id INTO v_conversation_id
  FROM public.chat_conversations
  WHERE kind = 'booking' AND user_id = v_auth_id AND supermarket_id = v_product.supermarket_id
    AND subject = v_product.name AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.chat_conversations (
      user_id, role, portal, supermarket_id, subject, kind, origin_app, guest_name
    ) VALUES (
      COALESCE(v_local_user_id, v_auth_id), 'customer', 'customer', v_product.supermarket_id, v_product.name,
      'booking', p_origin_app, v_display_name
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  v_booking.chat_conversation_id := v_conversation_id;
  UPDATE public.service_bookings SET chat_conversation_id = v_conversation_id WHERE id = v_booking.id;

  v_qty_label := CASE
    WHEN v_product.booking_type = 'room' THEN p_quantity || ' room' || CASE WHEN p_quantity > 1 THEN 's' ELSE '' END
    WHEN v_product.booking_type = 'ticket' THEN p_quantity || ' ticket' || CASE WHEN p_quantity > 1 THEN 's' ELSE '' END
    ELSE ''
  END;

  INSERT INTO public.chat_messages (conversation_id, sender_role, sender_name, body)
  VALUES (
    v_conversation_id, 'customer', v_display_name,
    'Booked ' || v_product.name ||
    CASE WHEN v_qty_label != '' THEN ' (' || v_qty_label || ')' ELSE '' END ||
    ' for ' || p_booking_date::TEXT ||
    CASE
      WHEN v_product.booking_type = 'room' THEN ' to ' || p_checkout_date::TEXT
      WHEN v_product.booking_type = 'slot' THEN ' at ' || p_slot_start::TEXT
      ELSE ''
    END ||
    CASE WHEN p_notes IS NOT NULL AND LENGTH(TRIM(p_notes)) > 0 THEN E'\n' || p_notes ELSE '' END
  );

  RETURN jsonb_build_object('success', true, 'booking', to_jsonb(v_booking), 'conversationId', v_conversation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_create_service_booking(UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, INT, DATE) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Capacity is now a "Sold out" badge, not a wall — fn_get_available_slots() always returns open slots/dates (spots_left can be 0), and fn_create_service_booking() only blocks a day/slot the admin actually closed, never one that''s merely full. Every booking still lands as status=''requested'' for the store to approve.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Bookings always allowed (sold out is a badge, not a block) installed.' AS status;
