-- ============================================================
-- SERVICE BOOKING FORMS — multiple-choice ("select many") field type
-- ============================================================
-- service_booking_form_fields.field_type so far only had 'select' (choose
-- exactly one from a dropdown). This adds 'multiselect' — the same
-- admin-authored options list, but the customer can tick several (e.g.
-- "Which add-ons?" with Shampoo/Conditioner/Scalp massage, any combination).
--
-- Purely additive: widens the existing CHECK constraint, no new table, no
-- column rename. A 'multiselect' answer in service_bookings.form_responses
-- is a JSON array of the chosen option strings (vs. a single string for
-- 'select'), so fn_create_service_booking's required-field check gains an
-- array-aware branch: an empty array must fail the same "answer this" check
-- a blank string would, which the old plain non-blank-string check couldn't
-- see (a JSON array's text form, e.g. '[]', is never itself blank).
--
-- Run after: ADD_SERVICE_BOOKING_FORMS.sql.
-- Safe to run more than once.
-- ============================================================

ALTER TABLE public.service_booking_form_fields DROP CONSTRAINT IF EXISTS service_booking_form_fields_field_type_check;
ALTER TABLE public.service_booking_form_fields
  ADD CONSTRAINT service_booking_form_fields_field_type_check
  CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'phone', 'email', 'select', 'checkbox', 'file', 'multiselect'));

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
  p_checkout_date DATE DEFAULT NULL,
  p_form_responses JSONB DEFAULT NULL
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
  v_missing_field TEXT;
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

  -- Every field currently marked required on this product's attached form
  -- (if it has one) must have a non-blank answer. A 'multiselect' answer is
  -- a JSON array, so "blank" means an empty array there instead of an empty
  -- string. Client-side validation already does this for a good UX, but
  -- the check has to be re-run here since the RPC is the actual trust
  -- boundary.
  SELECT f.label INTO v_missing_field
  FROM public.service_booking_form_fields f
  JOIN public.service_booking_form_services sfs ON sfs.form_id = f.form_id
  WHERE sfs.product_id = p_product_id
    AND f.is_required = true
    AND (
      p_form_responses IS NULL
      OR NOT (p_form_responses ? f.field_key)
      OR (
        jsonb_typeof(p_form_responses -> f.field_key) = 'array'
        AND jsonb_array_length(p_form_responses -> f.field_key) = 0
      )
      OR (
        jsonb_typeof(p_form_responses -> f.field_key) <> 'array'
        AND LENGTH(TRIM(COALESCE(p_form_responses ->> f.field_key, ''))) = 0
      )
    )
  ORDER BY f.sort_order
  LIMIT 1;

  IF v_missing_field IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '"' || v_missing_field || '" is required');
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
    booking_date, slot_start, slot_end, quantity, checkout_date, notes, form_responses
  ) VALUES (
    v_product.supermarket_id, p_product_id, v_auth_id, TRIM(p_customer_name), p_customer_phone, p_customer_email,
    p_booking_date, p_slot_start, v_slot_end, p_quantity, p_checkout_date, p_notes, p_form_responses
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

GRANT EXECUTE ON FUNCTION public.fn_create_service_booking(UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, INT, DATE, JSONB) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ service_booking_form_fields.field_type now allows multiselect; fn_create_service_booking() required-field check is array-aware.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Booking form multiselect installed.' AS status;
