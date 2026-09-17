-- ============================================================
-- SERVICE BOOKINGS — appointment slots for bookable service products
-- ============================================================
-- Today a "service_item" product (see ADD_PHARMACY_FLEXIBLE_INVENTORY.sql)
-- only supports a walk-in flow: the cashier sells it and tracks a job_status
-- (pending -> in_progress -> ready_for_collection -> collected) on the
-- transaction itself. That's still exactly right for e.g. laundry drop-off,
-- so it is left untouched.
--
-- This adds a second, separate, additive path for services a customer books
-- ahead of time with a real date/time slot (a consultation, a hair
-- appointment, a video call, ...):
--   - supermarkets.offers_products / offers_services -- an explicit admin
--     toggle for what the business sells, instead of only inferring it from
--     business_type.
--   - products.is_bookable -- opts a specific service_item product into slot
--     booking (walk-in service_item products without this flag are
--     unaffected).
--   - service_availability_rules -- admin-defined open hours per bookable
--     product: either a recurring weekly rule (day_of_week) or a one-off
--     override for a specific_date (extra hours, or is_blackout to close a
--     normally-open day). A specific_date rule fully replaces that
--     product's day_of_week rules for that date.
--   - service_bookings -- one row per appointment. Slots are never
--     materialized/cached: fn_get_available_slots() computes open slots live
--     from service_availability_rules minus already-booked service_bookings,
--     so availability "updates automatically" the moment a booking lands.
--   - chat_conversations.kind gains a third value, 'booking' -- creating a
--     booking opens (or reuses) a real conversation thread with the store,
--     reusing the existing chat_conversations/chat_messages tables and the
--     useDirectCall voice/video call system as-is (rooms are keyed
--     `booking:<bookingId>`, exactly like ChatWidget already keys support
--     rooms `support:<conversationId>`). No new chat/call infrastructure.
--
-- These RPCs are plain Postgres functions in the one shared Supabase
-- project, so mybodaguy's frontend calls them the same way
-- digital-city-era's does (passing p_origin_app = 'mybodaguy') -- no
-- separate backend needed there.
--
-- Run after: ADD_PHARMACY_FLEXIBLE_INVENTORY.sql, CREATE_CHAT_SUPPORT_SYSTEM.sql,
-- ADD_CHAT_TEAM_CHANNEL.sql, ADD_CROSS_APP_CHAT.sql, ADD_JOB_STATUS_UPDATE_RPC.sql.
-- Safe to run more than once.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Business profile toggle + per-product bookable flag
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS offers_products BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS offers_services BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. chat_conversations.kind -- widen 'support'/'team' to also allow 'booking'
--
-- Some environments have rows whose `kind` was never actually 'support' or
-- 'team' (e.g. rows created before ADD_CHAT_TEAM_CHANNEL.sql's constraint
-- existed, or inserted while it was briefly absent) -- adding a tighter
-- CHECK constraint validates every existing row, so it fails outright unless
-- those stray values are dealt with first. Coerced to 'support' rather than
-- deleted: it's the original/default kind and keeps the conversation (and
-- its messages) visible in the Dev Panel inbox instead of silently losing it.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.chat_conversations
SET kind = 'support'
WHERE kind IS NOT NULL AND kind NOT IN ('support', 'team', 'booking');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_conversations_kind_check' AND conrelid = 'public.chat_conversations'::regclass
  ) THEN
    ALTER TABLE public.chat_conversations DROP CONSTRAINT chat_conversations_kind_check;
  END IF;

  ALTER TABLE public.chat_conversations
    ADD CONSTRAINT chat_conversations_kind_check CHECK (kind IN ('support', 'team', 'booking'));
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. service_availability_rules -- admin-defined open hours per product
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_availability_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  day_of_week    SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  specific_date  DATE,
  start_time     TIME,
  end_time       TIME,
  slot_minutes   INT NOT NULL DEFAULT 30 CHECK (slot_minutes > 0),
  capacity       INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  is_blackout    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT service_availability_rules_one_scope CHECK ((day_of_week IS NULL) <> (specific_date IS NULL)),
  CONSTRAINT service_availability_rules_hours CHECK (
    is_blackout OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_service_availability_rules_product ON public.service_availability_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_service_availability_rules_specific_date ON public.service_availability_rules(product_id, specific_date) WHERE specific_date IS NOT NULL;

ALTER TABLE public.service_availability_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_availability_rules_select" ON public.service_availability_rules;
CREATE POLICY "service_availability_rules_select" ON public.service_availability_rules
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "service_availability_rules_manage" ON public.service_availability_rules;
CREATE POLICY "service_availability_rules_manage" ON public.service_availability_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_availability_rules.supermarket_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_availability_rules.supermarket_id
    )
  );

GRANT SELECT ON TABLE public.service_availability_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.service_availability_rules TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. service_bookings -- one row per appointment. Carries customer PII
--    (phone/email/notes) so, unlike the older chat/product tables, RLS here
--    is NOT left fully open -- SELECT is scoped to the booking's own
--    customer or that store's admin/manager, and there are no direct
--    INSERT/UPDATE grants at all: every write goes through the two
--    SECURITY DEFINER functions below, which run their own authorization
--    checks (same pattern as update_job_status() in
--    ADD_JOB_STATUS_UPDATE_RPC.sql).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_bookings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id       UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id              UUID,
  customer_name        TEXT NOT NULL,
  customer_phone       TEXT,
  customer_email       TEXT,
  booking_date         DATE NOT NULL,
  slot_start           TIME NOT NULL,
  slot_end             TIME NOT NULL,
  status               TEXT NOT NULL DEFAULT 'requested'
                       CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes                TEXT,
  chat_conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_bookings_product_date ON public.service_bookings(product_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_service_bookings_supermarket ON public.service_bookings(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_user ON public.service_bookings(user_id);

ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_bookings_select" ON public.service_bookings;
CREATE POLICY "service_bookings_select" ON public.service_bookings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_bookings.supermarket_id
    )
  );

GRANT SELECT ON TABLE public.service_bookings TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_bookings;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_get_available_slots -- computed live, never cached. specific_date
--    rules (if any exist for that product+date) fully replace the
--    recurring day_of_week rules for that date; otherwise the day_of_week
--    rule(s) for that weekday apply. A slot is returned only while
--    spots_left > 0, so it disappears the instant capacity is used up.
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
  WITH rules AS (
    SELECT r.start_time, r.end_time, r.slot_minutes, r.capacity
    FROM public.service_availability_rules r
    WHERE r.product_id = p_product_id
      AND r.is_blackout = false
      AND (
        (v_has_override AND r.specific_date = p_date)
        OR (NOT v_has_override AND r.specific_date IS NULL AND r.day_of_week = v_dow)
      )
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
  booked AS (
    SELECT b.slot_start, COUNT(*) AS taken
    FROM public.service_bookings b
    WHERE b.product_id = p_product_id
      AND b.booking_date = p_date
      AND b.status IN ('requested', 'confirmed')
    GROUP BY b.slot_start
  )
  SELECT cs.slot_start, cs.slot_end, (cs.capacity - COALESCE(bk.taken, 0))::INT AS spots_left
  FROM candidate_slots cs
  LEFT JOIN booked bk ON bk.slot_start = cs.slot_start
  WHERE (cs.capacity - COALESCE(bk.taken, 0)) > 0
  ORDER BY cs.slot_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_available_slots(UUID, DATE) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. fn_create_service_booking -- re-validates the slot under an advisory
--    lock (closes the race two customers could otherwise hit clicking the
--    same last-open slot at once), inserts the booking, and opens/reuses a
--    'booking'-kind chat_conversations thread so the customer lands in a
--    real message thread with the store immediately -- same tables
--    ChatWidget/chatService.js already use, just a new `kind`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_create_service_booking(
  p_product_id UUID,
  p_booking_date DATE,
  p_slot_start TIME,
  p_customer_name TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_origin_app TEXT DEFAULT 'digital-city-era'
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
  v_booking public.service_bookings%ROWTYPE;
  v_conversation_id UUID;
  v_local_user_id UUID;
  v_local_name TEXT;
  v_display_name TEXT;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required to book');
  END IF;

  IF p_customer_name IS NULL OR LENGTH(TRIM(p_customer_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name is required');
  END IF;

  SELECT id, supermarket_id, name, is_bookable INTO v_product
  FROM public.products WHERE id = p_product_id;

  IF NOT FOUND OR v_product.is_bookable IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'This service is not bookable');
  END IF;

  -- Serialize concurrent attempts at the exact same product/date/slot.
  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::TEXT || p_booking_date::TEXT || p_slot_start::TEXT));

  SELECT slot_end INTO v_slot_end
  FROM public.fn_get_available_slots(p_product_id, p_booking_date)
  WHERE slot_start = p_slot_start;

  IF v_slot_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'That slot is no longer available');
  END IF;

  SELECT id, full_name INTO v_local_user_id, v_local_name
  FROM public.users WHERE auth_id = v_auth_id LIMIT 1;

  v_display_name := COALESCE(v_local_name, TRIM(p_customer_name));

  INSERT INTO public.service_bookings (
    supermarket_id, product_id, user_id, customer_name, customer_phone, customer_email,
    booking_date, slot_start, slot_end, notes
  ) VALUES (
    v_product.supermarket_id, p_product_id, v_auth_id, TRIM(p_customer_name), p_customer_phone, p_customer_email,
    p_booking_date, p_slot_start, v_slot_end, p_notes
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

  INSERT INTO public.chat_messages (conversation_id, sender_role, sender_name, body)
  VALUES (
    v_conversation_id, 'customer', v_display_name,
    'Booked ' || v_product.name || ' for ' || p_booking_date::TEXT || ' at ' || p_slot_start::TEXT ||
    CASE WHEN p_notes IS NOT NULL AND LENGTH(TRIM(p_notes)) > 0 THEN E'\n' || p_notes ELSE '' END
  );

  RETURN jsonb_build_object('success', true, 'booking', to_jsonb(v_booking), 'conversationId', v_conversation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_create_service_booking(UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. fn_update_booking_status -- the booking's own customer may only cancel;
--    that store's admin/manager may set any status. Same authorization
--    shape as update_job_status() in ADD_JOB_STATUS_UPDATE_RPC.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_update_booking_status(p_booking_id UUID, p_new_status TEXT)
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
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in required');
  END IF;

  IF p_new_status NOT IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid booking status');
  END IF;

  SELECT * INTO v_booking FROM public.service_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  v_is_owner := v_booking.user_id = v_auth_id;

  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = v_auth_id OR u.auth_id = v_auth_id)
      AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
      AND u.supermarket_id = v_booking.supermarket_id
  ) INTO v_is_staff;

  IF NOT (v_is_owner OR v_is_staff) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to update this booking');
  END IF;

  IF v_is_owner AND NOT v_is_staff AND p_new_status != 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customers can only cancel a booking');
  END IF;

  UPDATE public.service_bookings SET status = p_new_status, updated_at = NOW() WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_booking_status(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Service bookings ready — offers_products/offers_services, products.is_bookable, service_availability_rules, service_bookings, fn_get_available_slots(), fn_create_service_booking(), fn_update_booking_status().';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Service bookings installed.' AS status;
