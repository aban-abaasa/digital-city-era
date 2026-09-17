-- ============================================================
-- SERVICE BOOKING FORMS — admin-defined intake questions per bookable service
-- ============================================================
-- Today fn_create_service_booking() only ever collects name/phone/email/notes
-- — the same four fields no matter what the service actually is. A hair
-- salon wants "which stylist?", a clinic wants "reason for visit" plus a
-- photo of a referral letter, an event ticket wants "attendee name". This
-- lets the admin define those questions once as a reusable FORM and attach
-- it to one or many bookable products, and has the customer's answers (and
-- any uploaded files) travel with the booking instead of getting buried in
-- a free-text notes field.
--
--   - service_booking_forms -- a named set of questions the admin builds
--     once (e.g. "Salon intake"), independent of any one product.
--   - service_booking_form_services -- which bookable product(s) use which
--     form. A product uses at most one form at a time (product_id is the
--     primary key), but a form can be attached to many products — that's
--     what lets the admin reuse "Salon intake" across "Haircut", "Hair
--     colouring", etc. instead of re-typing the same questions per service.
--   - service_booking_form_fields -- one row per question on a form
--     (label, input type, options for 'select', required flag, display
--     order). Input types include 'file' (image/PDF upload) alongside the
--     usual text/number/date/etc.
--   - service_bookings.form_responses -- JSONB object of
--     { field_key: answer } captured at booking time (a 'file' answer is
--     the uploaded object's public URL). Keyed by field_key rather than
--     field id/form id so it stays readable even after the form is edited
--     or unattached later.
--   - booking-uploads storage bucket -- customers upload straight from the
--     browser to Supabase Storage (the exact same direct-upload pattern
--     AddProductModal already uses for product photos), so this needs no
--     new backend endpoint/serverless function at all.
--
-- All three tables carry supermarket_id directly (denormalized from the
-- product, same choice service_availability_rules already made) purely so
-- their RLS policies stay a simple one-table check instead of a join.
--
-- This SUPERSEDES the product_id-scoped service_booking_form_fields shape
-- from the first cut of this migration (fields keyed straight off
-- product_id, one form per product, no reuse). Nothing has shipped on that
-- shape yet, so this migration drops and recreates it rather than adding a
-- second, messier migration on top.
--
-- Run after: ADD_SERVICE_BOOKINGS.sql, ADD_SERVICE_BOOKING_TYPES.sql,
-- ADD_SERVICE_BOOKING_HOUR_BLOCKS.sql.
-- Safe to run more than once.
-- ============================================================

DROP TABLE IF EXISTS public.service_booking_form_fields;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. service_booking_forms + service_booking_form_services
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_booking_forms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_booking_forms_supermarket ON public.service_booking_forms(supermarket_id);

-- One row per bookable product that has a form attached. product_id as the
-- primary key is what enforces "at most one form per product" while still
-- letting many products point at the same form_id.
CREATE TABLE IF NOT EXISTS public.service_booking_form_services (
  product_id     UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  form_id        UUID NOT NULL REFERENCES public.service_booking_forms(id) ON DELETE CASCADE,
  supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_booking_form_services_form ON public.service_booking_form_services(form_id);

ALTER TABLE public.service_booking_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_booking_form_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_booking_forms_select" ON public.service_booking_forms;
CREATE POLICY "service_booking_forms_select" ON public.service_booking_forms
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "service_booking_forms_manage" ON public.service_booking_forms;
CREATE POLICY "service_booking_forms_manage" ON public.service_booking_forms
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_booking_forms.supermarket_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_booking_forms.supermarket_id
    )
  );

DROP POLICY IF EXISTS "service_booking_form_services_select" ON public.service_booking_form_services;
CREATE POLICY "service_booking_form_services_select" ON public.service_booking_form_services
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "service_booking_form_services_manage" ON public.service_booking_form_services;
CREATE POLICY "service_booking_form_services_manage" ON public.service_booking_form_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_booking_form_services.supermarket_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_booking_form_services.supermarket_id
    )
  );

GRANT SELECT ON TABLE public.service_booking_forms TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.service_booking_forms TO authenticated;
GRANT SELECT ON TABLE public.service_booking_form_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.service_booking_form_services TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. service_booking_form_fields -- now keyed off form_id, not product_id,
--    and 'file' joins the input type list (image/PDF upload).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.service_booking_form_fields (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  form_id        UUID NOT NULL REFERENCES public.service_booking_forms(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  field_key      TEXT NOT NULL,
  field_type     TEXT NOT NULL DEFAULT 'text'
                 CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'phone', 'email', 'select', 'checkbox', 'file')),
  options        JSONB,
  is_required    BOOLEAN NOT NULL DEFAULT false,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT service_booking_form_fields_unique_key UNIQUE (form_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_service_booking_form_fields_form ON public.service_booking_form_fields(form_id, sort_order);

ALTER TABLE public.service_booking_form_fields ENABLE ROW LEVEL SECURITY;

-- Public read: the customer needs to see the questions before they've
-- booked anything (same as service_availability_rules_select).
DROP POLICY IF EXISTS "service_booking_form_fields_select" ON public.service_booking_form_fields;
CREATE POLICY "service_booking_form_fields_select" ON public.service_booking_form_fields
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "service_booking_form_fields_manage" ON public.service_booking_form_fields;
CREATE POLICY "service_booking_form_fields_manage" ON public.service_booking_form_fields
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_booking_form_fields.supermarket_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
        AND lower(COALESCE(u.role, '')) IN ('admin', 'manager')
        AND u.supermarket_id = service_booking_form_fields.supermarket_id
    )
  );

GRANT SELECT ON TABLE public.service_booking_form_fields TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.service_booking_form_fields TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. service_bookings.form_responses
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS form_responses JSONB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. booking-uploads storage bucket -- public read (so the URL saved in
--    form_responses just works), authenticated-only write. No signed URLs,
--    no server-side proxy, no new endpoint: the browser uploads directly to
--    Supabase Storage exactly like AddProductModal's product-photos flow.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-uploads', 'booking-uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "booking_uploads_insert" ON storage.objects;
CREATE POLICY "booking_uploads_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'booking-uploads');

DROP POLICY IF EXISTS "booking_uploads_read" ON storage.objects;
CREATE POLICY "booking_uploads_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'booking-uploads');

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_create_service_booking -- adds p_form_responses (trailing, optional,
--    so this stays a CREATE OR REPLACE of the same function/grants, not a
--    new overload) and server-side-enforces every field currently marked
--    required on the product's attached form actually has a non-blank
--    answer (a 'file' field's answer is just the uploaded URL string, so
--    the same non-blank check covers it).
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
  -- (if it has one) must have a non-blank answer. Client-side validation
  -- already does this for a good UX, but the check has to be re-run here
  -- since the RPC is the actual trust boundary.
  SELECT f.label INTO v_missing_field
  FROM public.service_booking_form_fields f
  JOIN public.service_booking_form_services sfs ON sfs.form_id = f.form_id
  WHERE sfs.product_id = p_product_id
    AND f.is_required = true
    AND (
      p_form_responses IS NULL
      OR NOT (p_form_responses ? f.field_key)
      OR LENGTH(TRIM(COALESCE(p_form_responses ->> f.field_key, ''))) = 0
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
  RAISE NOTICE '✅ Service booking forms ready — service_booking_forms, service_booking_form_services, service_booking_form_fields (incl. file uploads), service_bookings.form_responses, booking-uploads storage bucket, fn_create_service_booking() validates required fields.';
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Service booking forms installed.' AS status;
