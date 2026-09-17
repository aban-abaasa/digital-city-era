-- ============================================================
-- SERVICE BOOKING TYPES — tickets & rooms alongside time slots
-- ============================================================
-- Until now every bookable product was implicitly an appointment: a
-- customer picks a single time-of-day slot on one date. That's right for a
-- consultation or a haircut, but wrong for a lot of things the admin might
-- mark is_bookable: event tickets (no time-of-day at all, just "how many"),
-- or hotel/guesthouse rooms (a date RANGE, not a single day).
--
-- This adds products.booking_type ('slot' | 'ticket' | 'room', default
-- 'slot' so every existing bookable product keeps behaving exactly as
-- before) and lets service_bookings carry a quantity (>1 for "3 tickets" or
-- "2 rooms") and an optional checkout_date (room stays only).
--
-- The slot-generation machinery in fn_get_available_slots is NOT
-- duplicated per type. Instead:
--   - A 'ticket' or 'room' availability rule is just a normal
--     service_availability_rules row pinned to the whole day
--     (00:00-23:59, one 1439-minute "slot" -- the frontend fills this in
--     automatically, the admin only ever sees "how many available"), so it
--     naturally produces exactly one pseudo-slot per day through the exact
--     same candidate-slot logic 'slot' rules already use.
--   - The `booked` calculation changes from COUNT(*) to SUM(quantity), and
--     from an exact booking_date match to a range check against
--     COALESCE(checkout_date, booking_date + 1) -- this is a no-op for
--     existing 'slot'/'ticket' bookings (quantity defaults to 1,
--     checkout_date is null so the range is just that one day) and is what
--     makes a multi-night 'room' stay correctly occupy every night it
--     spans when any of those nights' availability is queried.
--
-- fn_create_service_booking gains p_quantity and p_checkout_date (both
-- optional, default 1 / NULL) and branches its validation by booking_type:
-- a 'slot' booking still needs an exact, currently-open p_slot_start; a
-- 'ticket' booking just needs p_quantity <= that date's spots_left; a
-- 'room' booking needs p_quantity <= spots_left on EVERY night from
-- p_booking_date up to (not including) p_checkout_date.
--
-- Run after: ADD_SERVICE_BOOKINGS.sql, ADD_SERVICE_BOOKING_HOUR_BLOCKS.sql.
-- Safe to run more than once.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'slot';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_booking_type_check' AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products DROP CONSTRAINT products_booking_type_check;
  END IF;
  ALTER TABLE public.products
    ADD CONSTRAINT products_booking_type_check CHECK (booking_type IN ('slot', 'ticket', 'room'));
END $$;

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checkout_date DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_quantity_check' AND conrelid = 'public.service_bookings'::regclass
  ) THEN
    ALTER TABLE public.service_bookings DROP CONSTRAINT service_bookings_quantity_check;
  END IF;
  ALTER TABLE public.service_bookings ADD CONSTRAINT service_bookings_quantity_check CHECK (quantity > 0);

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_checkout_after_booking_check' AND conrelid = 'public.service_bookings'::regclass
  ) THEN
    ALTER TABLE public.service_bookings DROP CONSTRAINT service_bookings_checkout_after_booking_check;
  END IF;
  ALTER TABLE public.service_bookings
    ADD CONSTRAINT service_bookings_checkout_after_booking_check CHECK (checkout_date IS NULL OR checkout_date > booking_date);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- fn_get_available_slots -- unchanged slot-generation logic; `booked` now
-- sums quantity across every booking whose [booking_date, checkout_date)
-- range covers p_date, instead of counting bookings pinned to exactly
-- p_date. For 'slot'/'ticket' bookings (checkout_date always NULL) this is
-- exactly equivalent to the old exact-date COUNT(*) behavior.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_get_available_slots(p_product_id UUID, p_date DATE)
RETURNS TABLE (slot_start TIME, slot_end TIME, spots_left INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_override BOOLEAN;
  v_dow SMALLINT := EXTRACT(DOW FROM p_date)::SMALLINT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.service_availability_rules
    WHERE product_id = p_product_id AND specific_date = p_date
  ) INTO v_has_override;

  RETURN QUERY
  WITH scope AS (
    SELECT r.start_time, r.end_time, r.slot_minutes, r.capacity, r.is_blackout
    FROM public.service_availability_rules r
    WHERE r.product_id = p_product_id
      AND (
        (v_has_override AND r.specific_date = p_date)
        OR (NOT v_has_override AND r.specific_date IS NULL AND r.day_of_week = v_dow)
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
  SELECT os.slot_start, os.slot_end, (os.capacity - COALESCE(bk.taken, 0))::INT AS spots_left
  FROM open_slots os
  LEFT JOIN booked bk ON bk.slot_start = os.slot_start
  WHERE (os.capacity - COALESCE(bk.taken, 0)) > 0
  ORDER BY os.slot_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_available_slots(UUID, DATE) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- fn_create_service_booking -- adds p_quantity/p_checkout_date, both
-- optional (appending trailing params with defaults is a valid
-- CREATE OR REPLACE, so this stays the same function/grants, not a new
-- overload). p_slot_start is now optional too: a 'ticket'/'room' product
-- always books against the whole-day pseudo-slot the admin's availability
-- rule already produces, so the frontend doesn't need to fabricate a time
-- for those types.
-- ─────────────────────────────────────────────────────────────────────────────

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

  IF v_product.booking_type = 'room' THEN
    v_check_date := p_booking_date;
    WHILE v_check_date < p_checkout_date LOOP
      SELECT spots_left INTO v_spots_left
      FROM public.fn_get_available_slots(p_product_id, v_check_date)
      WHERE slot_start = p_slot_start;

      IF v_spots_left IS NULL OR v_spots_left < p_quantity THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough rooms available on ' || v_check_date::TEXT);
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
    IF v_spots_left < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not enough spots left for that time');
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
  RAISE NOTICE '✅ Service booking types ready — products.booking_type (slot/ticket/room), service_bookings.quantity/checkout_date, fn_get_available_slots() and fn_create_service_booking() updated.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Service booking types installed.' AS status;
