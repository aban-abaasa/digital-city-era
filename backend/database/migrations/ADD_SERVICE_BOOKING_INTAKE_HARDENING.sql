-- ============================================================
-- SERVICE BOOKINGS — world-class intake (how Supabase RECEIVES a booking)
-- ============================================================
-- Problems this fixes in the current booking pipeline:
--
--  1. Function drift. fn_create_service_booking was re-defined by five
--     migrations with DIFFERENT argument lists, which leaves several overloads
--     side by side in Postgres. The one the app actually calls (the one with
--     p_form_responses) still carries the OLD capacity wall ("Not enough
--     rooms/spots"), contradicting the "sold out is a badge, not a block"
--     rule from ADD_SERVICE_BOOKING_ALWAYS_BOOKABLE.sql. This migration drops
--     EVERY overload and installs ONE canonical function.
--
--  2. Double submits. A double-tap, a flaky connection or an automatic retry
--     created two bookings (and two chat threads/messages). Now the client
--     sends an idempotency key; the same key from the same user returns the
--     original booking instead of creating another.
--
--  3. No server-side sanity limits. The RPC is the trust boundary, but it
--     accepted past dates, 10-year-ahead dates, 100000 tickets, 5 MB notes
--     and unlimited requests per minute. Now: not in the past (store-local
--     time, Africa/Kampala), a booking horizon, a room-stay cap, a ticket
--     cap, field length/format checks, a duplicate-slot guard and a per-user
--     rate limit. Every refusal carries a machine-readable `code` next to the
--     human `error` so the app can react (e.g. refresh the slot grid).
--
--  4. Status changes were free-for-all (a cancelled booking could be
--     "completed"). Now there is a real state machine, and every change is
--     written to an audit trail (service_booking_events): who, when, from,
--     to. Staff can undo a mistaken Completed/No-show within 24 hours.
--
--  5. Missing indexes/constraints for the queries the admin screen runs.
--
-- Backwards compatible: every new parameter has a default, so existing
-- callers (digital-city-era, mybodaguy's p_origin_app call) keep working.
--
-- Run after: ADD_SERVICE_BOOKING_FORM_MULTISELECT.sql (and the others before it).
-- Safe to run more than once.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Columns, constraints, indexes
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- One logical submission per user: a retried request with the same key
-- resolves to the booking it already created.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_bookings_idempotency
  ON public.service_bookings (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- The admin list (store + date, optionally by status) and the availability
-- calculation (only requested/confirmed rows count) both get a matching index.
CREATE INDEX IF NOT EXISTS idx_service_bookings_store_date_status
  ON public.service_bookings (supermarket_id, booking_date, status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_active_by_product_date
  ON public.service_bookings (product_id, booking_date)
  WHERE status IN ('requested', 'confirmed');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_checkout_after_checkin') THEN
    ALTER TABLE public.service_bookings
      ADD CONSTRAINT service_bookings_checkout_after_checkin
      CHECK (checkout_date IS NULL OR checkout_date > booking_date) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_bookings_quantity_sane') THEN
    ALTER TABLE public.service_bookings
      ADD CONSTRAINT service_bookings_quantity_sane
      CHECK (quantity BETWEEN 1 AND 500) NOT VALID;
  END IF;
END $$;
-- NOT VALID: enforced for every new/updated row, without failing on any old
-- row that predates the rule.

-- ─────────────────────────────────────────────────────────────
-- 2. Audit trail
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_booking_events (
  id           BIGSERIAL PRIMARY KEY,
  booking_id   UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  actor_id     UUID,
  actor_role   TEXT NOT NULL CHECK (actor_role IN ('customer', 'staff', 'system')),
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_booking_events_booking
  ON public.service_booking_events (booking_id, created_at);

ALTER TABLE public.service_booking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_booking_events_select" ON public.service_booking_events;
CREATE POLICY "service_booking_events_select" ON public.service_booking_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_bookings b
      WHERE b.id = service_booking_events.booking_id
        AND (
          b.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
              AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
              AND u.supermarket_id = b.supermarket_id
          )
        )
    )
  );
-- Read-only for clients: rows are only ever written by the two
-- SECURITY DEFINER functions below.
GRANT SELECT ON TABLE public.service_booking_events TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. ONE canonical fn_create_service_booking
-- ─────────────────────────────────────────────────────────────

-- Drop every historic overload by name so none can shadow the new one.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_create_service_booking'
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig::TEXT;
  END LOOP;
END $$;

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
  p_form_responses JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tz CONSTANT TEXT := 'Africa/Kampala';
  c_horizon_days CONSTANT INT := 365;
  c_max_nights CONSTANT INT := 60;
  c_max_qty CONSTANT INT := 50;
  c_rate_limit CONSTANT INT := 10;          -- bookings per user ...
  c_rate_window CONSTANT INTERVAL := '10 minutes';

  v_auth_id UUID := auth.uid();
  v_now_local TIMESTAMP := (NOW() AT TIME ZONE c_tz);
  v_today DATE := (NOW() AT TIME ZONE c_tz)::DATE;
  v_product RECORD;
  v_store RECORD;
  v_slot_end TIME;
  v_spots_left INT;
  v_check_date DATE;
  v_booking public.service_bookings%ROWTYPE;
  v_existing public.service_bookings%ROWTYPE;
  v_conversation_id UUID;
  v_local_user_id UUID;
  v_local_name TEXT;
  v_display_name TEXT;
  v_qty_label TEXT;
  v_missing_field TEXT;
  v_name TEXT := NULLIF(TRIM(p_customer_name), '');
  v_phone TEXT := NULLIF(TRIM(p_customer_phone), '');
  v_email TEXT := NULLIF(lower(TRIM(p_customer_email)), '');
  v_notes TEXT := NULLIF(TRIM(p_notes), '');
  v_key TEXT := NULLIF(TRIM(p_idempotency_key), '');
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'auth_required', 'error', 'Sign in required to book');
  END IF;

  -- ── Idempotency: same user + same key = same booking, never a second one.
  IF v_key IS NOT NULL THEN
    IF LENGTH(v_key) > 100 THEN
      RETURN jsonb_build_object('success', false, 'code', 'invalid_key', 'error', 'Invalid request key');
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('svc_idem:' || v_auth_id::TEXT || ':' || v_key));
    SELECT * INTO v_existing FROM public.service_bookings
    WHERE user_id = v_auth_id AND idempotency_key = v_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'duplicate', true,
        'booking', to_jsonb(v_existing),
        'conversationId', v_existing.chat_conversation_id
      );
    END IF;
  END IF;

  -- ── Field validation (this RPC is the trust boundary; the UI checks are only UX).
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'name_required', 'error', 'Name is required');
  END IF;
  IF LENGTH(v_name) > 120 THEN
    RETURN jsonb_build_object('success', false, 'code', 'name_too_long', 'error', 'Name is too long (max 120 characters)');
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[0-9+()\-\s.]{5,40}$' THEN
    RETURN jsonb_build_object('success', false, 'code', 'phone_invalid', 'error', 'That phone number does not look right');
  END IF;
  IF v_email IS NOT NULL AND (LENGTH(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RETURN jsonb_build_object('success', false, 'code', 'email_invalid', 'error', 'That email address does not look right');
  END IF;
  IF v_notes IS NOT NULL AND LENGTH(v_notes) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'code', 'notes_too_long', 'error', 'Notes are too long (max 2000 characters)');
  END IF;
  IF p_form_responses IS NOT NULL AND LENGTH(p_form_responses::TEXT) > 20000 THEN
    RETURN jsonb_build_object('success', false, 'code', 'form_too_large', 'error', 'Form answers are too long');
  END IF;
  IF p_booking_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'date_required', 'error', 'Pick a date');
  END IF;

  -- ── Product + store must be live.
  SELECT id, supermarket_id, name, is_bookable, is_active, booking_type INTO v_product
  FROM public.products WHERE id = p_product_id;

  IF NOT FOUND OR v_product.is_bookable IS NOT TRUE OR v_product.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_bookable', 'error', 'This service is not bookable');
  END IF;

  SELECT id, is_active, offers_services INTO v_store
  FROM public.supermarkets WHERE id = v_product.supermarket_id;
  IF NOT FOUND OR v_store.is_active IS NOT TRUE OR v_store.offers_services IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'code', 'store_unavailable', 'error', 'This business is not taking bookings right now');
  END IF;

  -- ── Dates (store-local time).
  IF p_booking_date < v_today THEN
    RETURN jsonb_build_object('success', false, 'code', 'date_in_past', 'error', 'That date has already passed');
  END IF;
  IF p_booking_date > v_today + c_horizon_days THEN
    RETURN jsonb_build_object('success', false, 'code', 'date_too_far', 'error', 'Bookings open up to ' || c_horizon_days || ' days ahead');
  END IF;

  -- ── Required form fields (array-aware, as in the multiselect migration).
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
    RETURN jsonb_build_object('success', false, 'code', 'form_field_required', 'error', '"' || v_missing_field || '" is required');
  END IF;

  -- ── Per-type shape.
  p_quantity := COALESCE(p_quantity, 1);
  IF p_quantity < 1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'quantity_invalid', 'error', 'Quantity must be at least 1');
  END IF;

  IF v_product.booking_type = 'slot' THEN
    p_quantity := 1;
    p_checkout_date := NULL;
    IF p_slot_start IS NULL THEN
      RETURN jsonb_build_object('success', false, 'code', 'slot_required', 'error', 'Pick a time');
    END IF;
    IF p_booking_date = v_today AND p_slot_start <= v_now_local::TIME THEN
      RETURN jsonb_build_object('success', false, 'code', 'slot_passed', 'error', 'That time has already passed today');
    END IF;
  ELSIF v_product.booking_type = 'room' THEN
    p_slot_start := '00:00:00'::TIME;
    IF p_checkout_date IS NULL OR p_checkout_date <= p_booking_date THEN
      RETURN jsonb_build_object('success', false, 'code', 'checkout_invalid', 'error', 'Pick a valid check-out date after check-in');
    END IF;
    IF p_checkout_date - p_booking_date > c_max_nights THEN
      RETURN jsonb_build_object('success', false, 'code', 'stay_too_long', 'error', 'Stays are limited to ' || c_max_nights || ' nights');
    END IF;
  ELSE -- 'ticket'
    p_slot_start := '00:00:00'::TIME;
    p_checkout_date := NULL;
  END IF;

  IF p_quantity > c_max_qty THEN
    RETURN jsonb_build_object('success', false, 'code', 'quantity_too_high', 'error', 'You can book up to ' || c_max_qty || ' at a time. Contact the store for larger groups.');
  END IF;

  -- ── Abuse guard: a person books a handful of things, not hundreds a minute.
  IF (SELECT COUNT(*) FROM public.service_bookings
      WHERE user_id = v_auth_id AND created_at > NOW() - c_rate_window) >= c_rate_limit THEN
    RETURN jsonb_build_object('success', false, 'code', 'rate_limited', 'error', 'Too many booking requests. Please wait a few minutes and try again.');
  END IF;

  -- ── Serialize concurrent attempts (slot: its own slot; ticket/room: whole product).
  IF v_product.booking_type = 'slot' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_product_id::TEXT || p_booking_date::TEXT || p_slot_start::TEXT));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(p_product_id::TEXT));
  END IF;

  -- ── Same person, same slot, still active: that is a double booking, say so.
  IF v_product.booking_type = 'slot' AND EXISTS (
    SELECT 1 FROM public.service_bookings
    WHERE user_id = v_auth_id AND product_id = p_product_id
      AND booking_date = p_booking_date AND slot_start = p_slot_start
      AND status IN ('requested', 'confirmed')
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'already_booked', 'error', 'You already have a booking for that time.');
  END IF;

  -- ── Is the day/slot actually OPEN? (Being full is NOT a block: it lands as
  --    'requested' and the store approves or declines by hand.)
  IF v_product.booking_type = 'room' THEN
    v_check_date := p_booking_date;
    WHILE v_check_date < p_checkout_date LOOP
      SELECT spots_left INTO v_spots_left
      FROM public.fn_get_available_slots(p_product_id, v_check_date)
      WHERE slot_start = p_slot_start;

      IF v_spots_left IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'closed_day', 'error', 'Not open for booking on ' || v_check_date::TEXT);
      END IF;
      v_check_date := v_check_date + 1;
    END LOOP;
    v_slot_end := '23:59:00'::TIME;
  ELSE
    SELECT slot_end, spots_left INTO v_slot_end, v_spots_left
    FROM public.fn_get_available_slots(p_product_id, p_booking_date)
    WHERE slot_start = p_slot_start;

    IF v_slot_end IS NULL THEN
      RETURN jsonb_build_object('success', false, 'code', 'slot_unavailable', 'error', 'That slot is no longer available');
    END IF;
  END IF;

  SELECT id, full_name INTO v_local_user_id, v_local_name
  FROM public.users WHERE auth_id = v_auth_id LIMIT 1;

  v_display_name := COALESCE(v_local_name, v_name);

  INSERT INTO public.service_bookings (
    supermarket_id, product_id, user_id, customer_name, customer_phone, customer_email,
    booking_date, slot_start, slot_end, quantity, checkout_date, notes, form_responses, idempotency_key
  ) VALUES (
    v_product.supermarket_id, p_product_id, v_auth_id, v_name, v_phone, v_email,
    p_booking_date, p_slot_start, v_slot_end, p_quantity, p_checkout_date, v_notes, p_form_responses, v_key
  )
  RETURNING * INTO v_booking;

  INSERT INTO public.service_booking_events (booking_id, actor_id, actor_role, from_status, to_status)
  VALUES (v_booking.id, v_auth_id, 'customer', NULL, 'requested');

  -- Reuse this customer's already-open thread for this service, else start one.
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
      WHEN v_product.booking_type = 'slot' THEN ' at ' || LEFT(p_slot_start::TEXT, 5)
      ELSE ''
    END ||
    CASE WHEN v_notes IS NOT NULL THEN E'\n' || v_notes ELSE '' END
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'booking', to_jsonb(v_booking), 'conversationId', v_conversation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_create_service_booking(UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT, INT, DATE, JSONB, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. fn_update_booking_status with a real state machine + audit trail
-- ─────────────────────────────────────────────────────────────
--   requested -> confirmed | completed | no_show | cancelled
--   confirmed -> completed | no_show | cancelled
--   completed / no_show -> confirmed   (STAFF only, within 24h: undo a mis-tap)
--   cancelled           -> (final)
--   Customers may only cancel, and only while it is still requested/confirmed.

CREATE OR REPLACE FUNCTION public.fn_update_booking_status(
  p_booking_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_booking RECORD;
  v_is_staff BOOLEAN;
  v_is_owner BOOLEAN;
  v_allowed BOOLEAN;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'auth_required', 'error', 'Sign in required');
  END IF;

  IF p_new_status IS NULL OR p_new_status NOT IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_status', 'error', 'Invalid booking status');
  END IF;

  SELECT * INTO v_booking FROM public.service_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Booking not found');
  END IF;

  v_is_owner := v_booking.user_id = v_auth_id;

  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = v_auth_id OR u.auth_id = v_auth_id)
      AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
      AND u.supermarket_id = v_booking.supermarket_id
  ) INTO v_is_staff;

  IF NOT (v_is_owner OR v_is_staff) THEN
    RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Not authorized to update this booking');
  END IF;

  IF v_is_owner AND NOT v_is_staff AND p_new_status <> 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'code', 'customer_cancel_only', 'error', 'Customers can only cancel a booking');
  END IF;

  -- Re-sending the status it already has is a harmless no-op (double tap).
  IF v_booking.status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'status', p_new_status, 'unchanged', true);
  END IF;

  v_allowed := CASE v_booking.status
    WHEN 'requested' THEN p_new_status IN ('confirmed', 'completed', 'no_show', 'cancelled')
    WHEN 'confirmed' THEN p_new_status IN ('completed', 'no_show', 'cancelled')
    WHEN 'completed' THEN v_is_staff AND p_new_status = 'confirmed' AND v_booking.updated_at > NOW() - INTERVAL '24 hours'
    WHEN 'no_show'   THEN v_is_staff AND p_new_status = 'confirmed' AND v_booking.updated_at > NOW() - INTERVAL '24 hours'
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'invalid_transition',
      'error', 'A ' || replace(v_booking.status, '_', ' ') || ' booking cannot be changed to ' || replace(p_new_status, '_', ' ')
    );
  END IF;

  UPDATE public.service_bookings SET status = p_new_status, updated_at = NOW() WHERE id = p_booking_id;

  INSERT INTO public.service_booking_events (booking_id, actor_id, actor_role, from_status, to_status)
  VALUES (p_booking_id, v_auth_id, CASE WHEN v_is_staff THEN 'staff' ELSE 'customer' END, v_booking.status, p_new_status);

  RETURN jsonb_build_object('success', true, 'status', p_new_status, 'previous', v_booking.status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_booking_status(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Booking intake hardened — one canonical fn_create_service_booking (idempotent, validated, rate-limited, sold-out-is-a-badge), status state machine + service_booking_events audit trail, new indexes/constraints.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Service booking intake hardening installed.' AS status;
