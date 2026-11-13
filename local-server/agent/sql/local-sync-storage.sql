-- Local-only storage for the business sync agent. Apply this to the local
-- Supabase database after the business app schema is installed.

CREATE TABLE IF NOT EXISTS public.business_local_sync_outbox (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version BETWEEN 1 AND 100),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_business_local_sync_outbox_pending
  ON public.business_local_sync_outbox(created_at)
  WHERE synced_at IS NULL;

CREATE TABLE IF NOT EXISTS public.business_local_sync_inbox (
  cursor BIGINT PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version BETWEEN 1 AND 100),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ,
  last_error TEXT
);

-- Safe upgrade for existing preview databases.
ALTER TABLE public.business_local_sync_outbox
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.business_local_sync_inbox
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_business_local_sync_inbox_unapplied
  ON public.business_local_sync_inbox(cursor)
  WHERE applied_at IS NULL;

CREATE TABLE IF NOT EXISTS public.business_local_sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read-only supermarket catalog replicated from the paired cloud business.
-- Product cost is intentionally omitted from the LAN-facing catalog.
CREATE TABLE IF NOT EXISTS public.business_local_catalog (
  business_id UUID NOT NULL,
  product_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price NUMERIC(15,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(7,3) NOT NULL DEFAULT 0,
  tax_included BOOLEAN NOT NULL DEFAULT true,
  category_id UUID,
  inventory_mode TEXT NOT NULL DEFAULT 'stock_controlled',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  reserved_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(12,2) NOT NULL DEFAULT 0,
  product_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stock_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, product_id)
);

ALTER TABLE public.business_local_catalog
  ADD COLUMN IF NOT EXISTS tax_included BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_business_local_catalog_active
  ON public.business_local_catalog(business_id, name)
  WHERE is_active;

ALTER TABLE public.business_local_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.business_local_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.business_local_catalog TO anon, authenticated;
GRANT ALL ON TABLE public.business_local_catalog TO service_role;
DROP POLICY IF EXISTS business_local_catalog_read
  ON public.business_local_catalog;
CREATE POLICY business_local_catalog_read
  ON public.business_local_catalog
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.preserve_newer_business_local_catalog_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Events can arrive after a concurrent transaction with a larger identity
  -- cursor committed first. Keep product and stock versions independently so
  -- a late older event cannot roll either part of the local catalog backward.
  IF NEW.product_updated_at < OLD.product_updated_at THEN
    NEW.name := OLD.name;
    NEW.sku := OLD.sku;
    NEW.barcode := OLD.barcode;
    NEW.price := OLD.price;
    NEW.selling_price := OLD.selling_price;
    NEW.tax_rate := OLD.tax_rate;
    NEW.category_id := OLD.category_id;
    NEW.inventory_mode := OLD.inventory_mode;
    NEW.is_active := OLD.is_active;
    NEW.product_updated_at := OLD.product_updated_at;
  END IF;

  IF NEW.stock_updated_at < OLD.stock_updated_at THEN
    NEW.current_stock := OLD.current_stock;
    NEW.reserved_stock := OLD.reserved_stock;
    NEW.minimum_stock := OLD.minimum_stock;
    NEW.reorder_point := OLD.reorder_point;
    NEW.stock_updated_at := OLD.stock_updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_newer_business_local_catalog_data
  ON public.business_local_catalog;
CREATE TRIGGER trg_preserve_newer_business_local_catalog_data
  BEFORE UPDATE ON public.business_local_catalog
  FOR EACH ROW EXECUTE FUNCTION public.preserve_newer_business_local_catalog_data();

CREATE OR REPLACE FUNCTION public.get_business_local_sync_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_outbound BIGINT;
  v_pending_inbound BIGINT;
  v_quarantined_outbound BIGINT;
  v_quarantined BIGINT;
  v_last_sync TEXT;
  v_has_error BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_pending_outbound
  FROM public.business_local_sync_outbox
  WHERE synced_at IS NULL;

  SELECT COUNT(*) INTO v_pending_inbound
  FROM public.business_local_sync_inbox
  WHERE applied_at IS NULL;

  SELECT COUNT(*) INTO v_quarantined
  FROM public.business_local_sync_inbox
  WHERE last_error IS NOT NULL;

  SELECT COUNT(*) INTO v_quarantined_outbound
  FROM public.business_local_sync_outbox
  WHERE last_error IS NOT NULL;

  SELECT value INTO v_last_sync
  FROM public.business_local_sync_meta
  WHERE key = 'last_successful_sync';

  SELECT COALESCE(value, '') <> '' INTO v_has_error
  FROM public.business_local_sync_meta
  WHERE key = 'last_sync_error';

  RETURN jsonb_build_object(
    'success', true,
    'pendingOutbound', v_pending_outbound,
    'pendingInbound', v_pending_inbound,
    'quarantined', v_quarantined + v_quarantined_outbound,
    'lastSyncAt', v_last_sync,
    'hasError', COALESCE(v_has_error, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_local_sync_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_local_sync_status() TO anon, authenticated;

-- This is the first app workflow installed on a business node. A node stores
-- only the team messages for its paired business; the sync agent transports
-- append-only text events to and from the cloud.
CREATE TABLE IF NOT EXISTS public.business_local_team_messages (
  id UUID PRIMARY KEY,
  business_type TEXT NOT NULL CHECK (business_type IN ('supermarket', 'business_profile')),
  business_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role ~ '^[a-z][a-z0-9_-]{1,31}$'),
  sender_name TEXT NOT NULL CHECK (length(sender_name) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_team_messages_scope
  ON public.business_local_team_messages(business_type, business_id, created_at, id);

-- Local staff identity is enforced by the database for LAN writes. The
-- sync-agent service role bypasses the local account check when replaying
-- messages that originated on another paired node.
CREATE OR REPLACE FUNCTION public.enforce_local_team_message_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_name TEXT;
  v_staff_role TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL
     OR NEW.business_id::TEXT IS DISTINCT FROM auth.jwt()->'app_metadata'->>'business_id'
     OR NEW.business_type IS DISTINCT FROM auth.jwt()->'app_metadata'->>'business_type' THEN
    RAISE EXCEPTION 'Sign in to this business server before sending a team message.';
  END IF;

  SELECT display_name, role INTO v_staff_name, v_staff_role
  FROM public.business_local_staff
  WHERE id = auth.uid()
    AND business_id = NEW.business_id
    AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active local staff account is required to send a team message.';
  END IF;

  NEW.sender_name := v_staff_name;
  NEW.sender_role := v_staff_role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_local_team_message_staff
  ON public.business_local_team_messages;
CREATE TRIGGER trg_enforce_local_team_message_staff
  BEFORE INSERT ON public.business_local_team_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_local_team_message_staff();

CREATE OR REPLACE FUNCTION public.enqueue_local_team_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The sync agent applies cloud rows using the local service-role key. Those
  -- inserts must not be echoed back as new local events.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.business_local_sync_outbox(
    event_id, event_type, schema_version, payload, occurred_at
  ) VALUES (
    NEW.id, 'team.message.v1', 1,
    jsonb_build_object(
      'sender_role', NEW.sender_role,
      'sender_name', NEW.sender_name,
      'body', NEW.body,
      'created_at', NEW.created_at
    ), NEW.created_at
  )
  ON CONFLICT (event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_local_team_message
  ON public.business_local_team_messages;
CREATE TRIGGER trg_enqueue_local_team_message
  AFTER INSERT ON public.business_local_team_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_local_team_message();

ALTER TABLE public.business_local_team_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS local_team_messages_read ON public.business_local_team_messages;
CREATE POLICY local_team_messages_read
  ON public.business_local_team_messages FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS local_team_messages_insert ON public.business_local_team_messages;
CREATE POLICY local_team_messages_insert
  ON public.business_local_team_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND business_id::TEXT = auth.jwt()->'app_metadata'->>'business_id'
    AND length(trim(sender_name)) BETWEEN 1 AND 120
    AND length(trim(body)) BETWEEN 1 AND 4000
  );
GRANT SELECT ON public.business_local_team_messages TO anon, authenticated;
REVOKE INSERT ON public.business_local_team_messages FROM anon;
GRANT INSERT ON public.business_local_team_messages TO authenticated;
GRANT SELECT, INSERT ON public.business_local_team_messages TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime
      FOR TABLE public.business_local_team_messages;
  ELSIF NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'business_local_team_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_local_team_messages;
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'business_local_catalog'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_local_catalog;
  END IF;
END;
$$;

ALTER TABLE public.business_local_sync_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_local_sync_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_local_sync_meta ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.business_local_sync_outbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_local_sync_inbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_local_sync_meta FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.business_local_sync_outbox TO service_role;
GRANT ALL ON TABLE public.business_local_sync_inbox TO service_role;
GRANT ALL ON TABLE public.business_local_sync_meta TO service_role;

-- Local accounts are deliberately independent from cloud Supabase Auth.
-- They authenticate on the business LAN and receive a short-lived JWT signed
-- with this node's private JWT_SECRET. Local staff credentials never sync to
-- the shared cloud project.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.business_local_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  is_owner BOOLEAN NOT NULL DEFAULT false,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(username) BETWEEN 3 AND 64),
  CHECK (length(display_name) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS business_local_staff_username_key
  ON public.business_local_staff(business_id, lower(username));
CREATE INDEX IF NOT EXISTS business_local_staff_active_scope
  ON public.business_local_staff(business_id, role)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.business_local_login_throttles (
  business_id UUID NOT NULL,
  username TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, username)
);

ALTER TABLE public.business_local_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_local_login_throttles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.business_local_staff FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_local_login_throttles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.business_local_staff TO service_role;
GRANT ALL ON TABLE public.business_local_login_throttles TO service_role;
DROP POLICY IF EXISTS business_local_staff_self_or_owner_read
  ON public.business_local_staff;
CREATE POLICY business_local_staff_self_or_owner_read
  ON public.business_local_staff
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      business_id::TEXT = auth.jwt()->'app_metadata'->>'business_id'
      AND auth.jwt()->'app_metadata'->>'local_role' = 'owner'
    )
  );

CREATE OR REPLACE FUNCTION public.business_local_bootstrap_owner(
  p_business_id UUID,
  p_username TEXT,
  p_display_name TEXT,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_staff public.business_local_staff%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner setup is unavailable.');
  END IF;
  IF p_business_id IS NULL
     OR COALESCE(trim(p_username), '') !~ '^[A-Za-z0-9._-]{3,64}$'
     OR length(trim(COALESCE(p_display_name, ''))) NOT BETWEEN 1 AND 120
     OR COALESCE(p_pin, '') !~ '^[0-9]{6,12}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid username, display name, and 6–12 digit PIN.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('business-local-owner:' || p_business_id::TEXT, 0));
  IF EXISTS (
    SELECT 1 FROM public.business_local_staff
    WHERE business_id = p_business_id AND is_owner
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This local server already has an owner account.');
  END IF;

  INSERT INTO public.business_local_staff (
    business_id, username, display_name, role, is_owner, pin_hash
  ) VALUES (
    p_business_id, lower(trim(p_username)), trim(p_display_name), 'admin', true,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
  ) RETURNING * INTO v_staff;

  RETURN jsonb_build_object('success', true, 'staff', jsonb_build_object(
    'id', v_staff.id, 'businessId', v_staff.business_id,
    'username', v_staff.username, 'displayName', v_staff.display_name,
    'role', v_staff.role, 'isOwner', v_staff.is_owner
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.business_local_authenticate_staff(
  p_business_id UUID,
  p_username TEXT,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username TEXT := lower(trim(COALESCE(p_username, '')));
  v_staff public.business_local_staff%ROWTYPE;
  v_throttle public.business_local_login_throttles%ROWTYPE;
  v_valid_pin BOOLEAN := false;
BEGIN
  IF p_business_id IS NULL OR v_username !~ '^[a-z0-9._-]{3,64}$'
     OR COALESCE(p_pin, '') !~ '^[0-9]{6,12}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid username or PIN.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::TEXT || ':' || v_username, 0));
  SELECT * INTO v_throttle
  FROM public.business_local_login_throttles
  WHERE business_id = p_business_id AND username = v_username
  FOR UPDATE;
  IF FOUND AND v_throttle.locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid username or PIN. Try again later.');
  END IF;

  SELECT * INTO v_staff
  FROM public.business_local_staff
  WHERE business_id = p_business_id
    AND username = v_username
    AND is_active
  LIMIT 1;

  IF FOUND THEN
    v_valid_pin := extensions.crypt(p_pin, v_staff.pin_hash) = v_staff.pin_hash;
  ELSE
    -- Keep the missing-account path close to the password-hash cost.
    PERFORM extensions.crypt(p_pin, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
  END IF;

  IF NOT v_valid_pin THEN
    INSERT INTO public.business_local_login_throttles (
      business_id, username, failed_attempts, last_attempt_at
    ) VALUES (p_business_id, v_username, 1, now())
    ON CONFLICT (business_id, username) DO UPDATE
      SET failed_attempts = CASE
            WHEN public.business_local_login_throttles.last_attempt_at < now() - interval '15 minutes' THEN 1
            ELSE public.business_local_login_throttles.failed_attempts + 1
          END,
          locked_until = CASE
            WHEN public.business_local_login_throttles.last_attempt_at < now() - interval '15 minutes' THEN NULL
            WHEN public.business_local_login_throttles.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
            ELSE public.business_local_login_throttles.locked_until
          END,
          last_attempt_at = now()
    RETURNING * INTO v_throttle;
    RETURN jsonb_build_object('success', false, 'error', 'Invalid username or PIN.');
  END IF;

  DELETE FROM public.business_local_login_throttles
  WHERE business_id = p_business_id AND username = v_username;

  RETURN jsonb_build_object('success', true, 'staff', jsonb_build_object(
    'id', v_staff.id, 'businessId', v_staff.business_id,
    'username', v_staff.username, 'displayName', v_staff.display_name,
    'role', v_staff.role, 'isOwner', v_staff.is_owner
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.business_local_list_staff()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
  v_staff JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.jwt()->'app_metadata'->>'local_role' <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the local server owner can manage staff.');
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'username', username, 'displayName', display_name,
    'role', role, 'isOwner', is_owner, 'isActive', is_active,
    'createdAt', created_at
  ) ORDER BY is_owner DESC, display_name), '[]'::JSONB)
  INTO v_staff
  FROM public.business_local_staff
  WHERE business_id = v_business_id;
  RETURN jsonb_build_object('success', true, 'staff', v_staff);
END;
$$;

CREATE OR REPLACE FUNCTION public.business_local_create_staff(
  p_username TEXT,
  p_display_name TEXT,
  p_role TEXT,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
  v_staff public.business_local_staff%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.jwt()->'app_metadata'->>'local_role' <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the local server owner can add staff.');
  END IF;
  IF v_business_id IS NULL
     OR COALESCE(trim(p_username), '') !~ '^[A-Za-z0-9._-]{3,64}$'
     OR length(trim(COALESCE(p_display_name, ''))) NOT BETWEEN 1 AND 120
     OR COALESCE(p_role, '') NOT IN ('manager', 'cashier')
     OR COALESCE(p_pin, '') !~ '^[0-9]{6,12}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid username, name, role, and 6–12 digit PIN.');
  END IF;

  INSERT INTO public.business_local_staff (
    business_id, username, display_name, role, pin_hash
  ) VALUES (
    v_business_id, lower(trim(p_username)), trim(p_display_name), p_role,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
  ) RETURNING * INTO v_staff;
  RETURN jsonb_build_object('success', true, 'staff', jsonb_build_object(
    'id', v_staff.id, 'username', v_staff.username,
    'displayName', v_staff.display_name, 'role', v_staff.role,
    'isOwner', v_staff.is_owner, 'isActive', v_staff.is_active
  ));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'That username is already in use on this server.');
END;
$$;

CREATE OR REPLACE FUNCTION public.business_local_set_staff_active(
  p_staff_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.jwt()->'app_metadata'->>'local_role' <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the local server owner can update staff.');
  END IF;
  IF p_staff_id IS NULL OR p_staff_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot disable your own account.');
  END IF;
  UPDATE public.business_local_staff
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_staff_id AND business_id = v_business_id AND NOT is_owner;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Staff account not found.');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_bootstrap_owner(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_local_authenticate_staff(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.business_local_list_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_local_create_staff(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_local_set_staff_active(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_local_bootstrap_owner(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.business_local_authenticate_staff(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_local_list_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_local_create_staff(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_local_set_staff_active(UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- Stock adjustments (owner / manager)
-- ============================================================================
-- The local catalog above is a mirror of the cloud store. Owners and managers can correct stock on
-- this server while offline. Each change is recorded here, applied to the local catalog straight
-- away, and queued in the sync outbox as a stock.adjustment.v1 event carrying the DIFFERENCE
-- ("+24", "-3"), not the final number — so an offline change can never overwrite stock the cloud
-- changed in the meantime. The cloud applies the difference when the server is next online.
CREATE TABLE IF NOT EXISTS public.business_local_stock_adjustments (
  id UUID PRIMARY KEY,                       -- also the sync event id
  business_id UUID NOT NULL,
  product_id UUID NOT NULL,
  delta NUMERIC(12,2) NOT NULL CHECK (delta <> 0),
  stock_before NUMERIC(12,2) NOT NULL,
  stock_after NUMERIC(12,2) NOT NULL CHECK (stock_after >= 0),
  reason TEXT NOT NULL CHECK (reason IN ('received', 'returned', 'damaged', 'expired', 'lost', 'correction', 'count')),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  staff_id UUID NOT NULL,
  staff_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_local_stock_adjustments_product
  ON public.business_local_stock_adjustments(business_id, product_id, created_at DESC);

ALTER TABLE public.business_local_stock_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.business_local_stock_adjustments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.business_local_stock_adjustments TO service_role;

-- Change one product's stock. p_mode: 'add' | 'remove' | 'set' (p_quantity is the amount to add or
-- remove, or the counted total for 'set'). Returns {success, stock, delta} or {success:false, error}.
CREATE OR REPLACE FUNCTION public.business_local_adjust_stock(
  p_product_id UUID,
  p_mode TEXT,
  p_quantity NUMERIC,
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt()->'app_metadata'->>'local_role';
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
  v_staff_name TEXT := COALESCE(NULLIF(trim(auth.jwt()->'user_metadata'->>'full_name'), ''), auth.jwt()->'user_metadata'->>'username', 'Staff');
  v_stock NUMERIC;
  v_mode TEXT;
  v_delta NUMERIC;
  v_after NUMERIC;
  v_id UUID := gen_random_uuid();
  v_note TEXT := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  IF auth.uid() IS NULL OR v_business_id IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner or a manager can change stock.');
  END IF;
  IF p_mode NOT IN ('add', 'remove', 'set')
     OR p_quantity IS NULL
     OR p_quantity > 1000000000
     OR (p_mode = 'set' AND p_quantity < 0)
     OR (p_mode <> 'set' AND p_quantity <= 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid quantity.');
  END IF;
  v_mode := p_mode;
  IF p_reason NOT IN ('received', 'returned', 'damaged', 'expired', 'lost', 'correction', 'count') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choose a reason for the change.');
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'The note is too long (500 characters at most).');
  END IF;

  SELECT c.current_stock INTO v_stock
  FROM public.business_local_catalog c
  WHERE c.business_id = v_business_id
    AND c.product_id = p_product_id
    AND c.is_active
    AND c.inventory_mode = 'stock_controlled'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'That product is not stock-controlled on this server, so its stock cannot be changed here.');
  END IF;

  v_delta := CASE v_mode
    WHEN 'add' THEN round(p_quantity, 2)
    WHEN 'remove' THEN -round(p_quantity, 2)
    ELSE round(p_quantity, 2) - v_stock
  END;
  IF v_delta = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', format('Stock is already %s.', v_stock));
  END IF;
  v_after := v_stock + v_delta;
  IF v_after < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', format('Not enough stock: only %s in stock.', v_stock));
  END IF;

  INSERT INTO public.business_local_stock_adjustments (
    id, business_id, product_id, delta, stock_before, stock_after, reason, note, staff_id, staff_name
  ) VALUES (
    v_id, v_business_id, p_product_id, v_delta, v_stock, v_after, p_reason, v_note, auth.uid(), v_staff_name
  );

  UPDATE public.business_local_catalog
  SET current_stock = v_after, stock_updated_at = now()
  WHERE business_id = v_business_id AND product_id = p_product_id;

  INSERT INTO public.business_local_sync_outbox (event_id, event_type, schema_version, payload, occurred_at)
  VALUES (
    v_id, 'stock.adjustment.v1', 1,
    jsonb_build_object(
      'product_id', p_product_id,
      'delta', v_delta,
      'reason', p_reason,
      'note', v_note,
      'staff_name', v_staff_name
    ),
    now()
  );

  RETURN jsonb_build_object('success', true, 'stock', v_after, 'delta', v_delta);
END;
$$;

-- Changes made on this server that the cloud has not confirmed yet, per product (for "waiting to sync").
CREATE OR REPLACE FUNCTION public.business_local_pending_stock()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt()->'app_metadata'->>'local_role';
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
BEGIN
  IF auth.uid() IS NULL OR v_business_id IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner or a manager can view stock changes.');
  END IF;
  RETURN jsonb_build_object('success', true, 'pending', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('product_id', product_id, 'delta', delta, 'changes', changes))
    FROM (
      SELECT a.product_id, sum(a.delta) AS delta, count(*) AS changes
      FROM public.business_local_stock_adjustments a
      JOIN public.business_local_sync_outbox o ON o.event_id = a.id
      WHERE a.business_id = v_business_id AND o.synced_at IS NULL
      GROUP BY a.product_id
    ) pending
  ), '[]'::jsonb));
END;
$$;

-- Recent stock changes, newest first — for one product or all of them.
CREATE OR REPLACE FUNCTION public.business_local_stock_history(
  p_product_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt()->'app_metadata'->>'local_role';
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
BEGIN
  IF auth.uid() IS NULL OR v_business_id IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner or a manager can view stock changes.');
  END IF;
  RETURN jsonb_build_object('success', true, 'history', COALESCE((
    SELECT jsonb_agg(row_to_json(h) ORDER BY h.created_at DESC)
    FROM (
      SELECT a.id, a.product_id, a.delta, a.stock_before, a.stock_after, a.reason, a.note,
             a.staff_name, a.created_at, (o.synced_at IS NOT NULL) AS synced
      FROM public.business_local_stock_adjustments a
      LEFT JOIN public.business_local_sync_outbox o ON o.event_id = a.id
      WHERE a.business_id = v_business_id
        AND (p_product_id IS NULL OR a.product_id = p_product_id)
      ORDER BY a.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 200)
    ) h
  ), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_adjust_stock(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_local_pending_stock() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_local_stock_history(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_local_adjust_stock(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_local_pending_stock() TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_local_stock_history(UUID, INTEGER) TO authenticated;

-- Add a new product on this server (owner / manager). It appears in the local catalog immediately with
-- its opening stock and is queued as a product.create.v1 event so the cloud store gets the same
-- product (same id) when the server is next online. Returns {success, product_id} or {success:false, error}.
CREATE OR REPLACE FUNCTION public.business_local_add_product(
  p_name TEXT,
  p_selling_price NUMERIC,
  p_sku TEXT DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_tax_rate NUMERIC DEFAULT 0,
  p_initial_stock NUMERIC DEFAULT 0,
  p_minimum_stock NUMERIC DEFAULT 10,
  p_reorder_point NUMERIC DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt()->'app_metadata'->>'local_role';
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
  v_staff_name TEXT := COALESCE(NULLIF(trim(auth.jwt()->'user_metadata'->>'full_name'), ''), auth.jwt()->'user_metadata'->>'username', 'Staff');
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_sku TEXT := NULLIF(trim(COALESCE(p_sku, '')), '');
  v_barcode TEXT := NULLIF(trim(COALESCE(p_barcode, '')), '');
  v_price NUMERIC := round(COALESCE(p_selling_price, -1), 2);
  v_tax NUMERIC := round(COALESCE(p_tax_rate, 0), 3);
  v_stock NUMERIC := round(COALESCE(p_initial_stock, 0), 2);
  v_min NUMERIC := round(COALESCE(p_minimum_stock, 0), 2);
  v_reorder NUMERIC := round(COALESCE(p_reorder_point, 0), 2);
  v_id UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL OR v_business_id IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner or a manager can add products.');
  END IF;
  IF length(v_name) NOT BETWEEN 1 AND 255 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter the product name (255 characters at most).');
  END IF;
  IF v_price < 0 OR v_price > 1000000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid selling price.');
  END IF;
  IF v_tax < 0 OR v_tax > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tax rate must be between 0 and 100.');
  END IF;
  IF v_stock < 0 OR v_stock > 1000000000 OR v_min < 0 OR v_min > 1000000000 OR v_reorder < 0 OR v_reorder > 1000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock quantities must be zero or more.');
  END IF;
  IF length(COALESCE(v_sku, '')) > 100 OR length(COALESCE(v_barcode, '')) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'SKU and barcode can be 100 characters at most.');
  END IF;

  -- Barcodes are unique across every store in the cloud, so a product without one gets a generated code.
  IF v_barcode IS NULL THEN
    v_barcode := 'AUTO-' || (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT || '-' || substr(replace(v_id::TEXT, '-', ''), 1, 6);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.business_local_catalog c
    WHERE c.business_id = v_business_id
      AND ((c.barcode IS NOT NULL AND lower(c.barcode) = lower(v_barcode))
           OR (v_sku IS NOT NULL AND c.sku IS NOT NULL AND lower(c.sku) = lower(v_sku)))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A product with that barcode or SKU already exists.');
  END IF;

  INSERT INTO public.business_local_catalog (
    business_id, product_id, name, sku, barcode, price, selling_price, tax_rate, inventory_mode,
    is_active, current_stock, reserved_stock, minimum_stock, reorder_point, product_updated_at, stock_updated_at
  ) VALUES (
    v_business_id, v_id, v_name, v_sku, v_barcode, v_price, v_price, v_tax, 'stock_controlled',
    true, v_stock, 0, v_min, v_reorder, now(), now()
  );

  INSERT INTO public.business_local_sync_outbox (event_id, event_type, schema_version, payload, occurred_at)
  VALUES (
    gen_random_uuid(), 'product.create.v1', 1,
    jsonb_build_object(
      'product_id', v_id,
      'name', v_name,
      'sku', v_sku,
      'barcode', v_barcode,
      'selling_price', v_price,
      'tax_rate', v_tax,
      'initial_stock', v_stock,
      'minimum_stock', v_min,
      'reorder_point', v_reorder,
      'staff_name', v_staff_name
    ),
    now()
  );

  RETURN jsonb_build_object('success', true, 'product_id', v_id, 'barcode', v_barcode);
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_add_product(TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_local_add_product(TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- A LAN till records paid cash sales on the shared local database. The stock
-- decrement and cloud-sync outbox event are part of the same transaction, so
-- a printed receipt always represents a durable sale on this node.
CREATE TABLE IF NOT EXISTS public.business_local_cash_sales (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL,
  client_transaction_id TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  cashier_id UUID NOT NULL,
  cashier_name TEXT NOT NULL,
  register_number TEXT NOT NULL DEFAULT 'Local Till',
  customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
  customer_phone TEXT,
  subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount NUMERIC(15,2) NOT NULL CHECK (tax_amount >= 0),
  total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid_ugx NUMERIC(15,2) NOT NULL CHECK (amount_paid_ugx >= total_amount),
  change_given NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (change_given >= 0),
  tax_included BOOLEAN NOT NULL DEFAULT true,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method = 'cash'),
  payment_reference TEXT NOT NULL,
  items_count INTEGER NOT NULL CHECK (items_count > 0),
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ,
  sync_error TEXT,
  UNIQUE (business_id, client_transaction_id),
  UNIQUE (business_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_business_local_cash_sales_recent
  ON public.business_local_cash_sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_local_cash_sales_cashier
  ON public.business_local_cash_sales(business_id, cashier_id, created_at DESC);

ALTER TABLE public.business_local_cash_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.business_local_cash_sales FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.business_local_cash_sales TO authenticated;
GRANT ALL ON TABLE public.business_local_cash_sales TO service_role;
DROP POLICY IF EXISTS business_local_cash_sales_read ON public.business_local_cash_sales;
CREATE POLICY business_local_cash_sales_read
  ON public.business_local_cash_sales FOR SELECT TO authenticated
  USING (
    business_id = NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID
    AND (
      auth.jwt()->'app_metadata'->>'local_role' IN ('owner', 'manager')
      OR (
        auth.jwt()->'app_metadata'->>'local_role' = 'cashier'
        AND cashier_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.business_local_record_cash_sale(p_sale JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt()->'app_metadata'->>'local_role';
  v_business_id UUID := NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
  v_cashier_name TEXT := COALESCE(
    NULLIF(trim(auth.jwt()->'user_metadata'->>'full_name'), ''),
    NULLIF(trim(auth.jwt()->'user_metadata'->>'username'), ''),
    'Cashier'
  );
  v_id UUID := gen_random_uuid();
  v_client_transaction_id TEXT := NULLIF(trim(COALESCE(p_sale->>'clientTransactionId', '')), '');
  v_receipt_number TEXT;
  v_items JSONB := p_sale->'items';
  v_item JSONB;
  v_normalized_items JSONB := '[]'::JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_already_sold NUMERIC;
  v_unit_price NUMERIC;
  v_rate NUMERIC;
  v_tax_included BOOLEAN;
  v_line_gross NUMERIC;
  v_line_tax NUMERIC;
  v_line_total NUMERIC;
  v_expected_subtotal NUMERIC := 0;
  v_expected_tax NUMERIC := 0;
  v_expected_total NUMERIC := 0;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
  v_total NUMERIC;
  v_amount_paid NUMERIC;
  v_change NUMERIC;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_register TEXT;
  v_payment_reference TEXT;
  v_catalog public.business_local_catalog%ROWTYPE;
  v_existing public.business_local_cash_sales%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_business_id IS NULL OR v_role IS NULL
     OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in as local cashier, manager, or owner to record a sale.');
  END IF;
  IF jsonb_typeof(p_sale) <> 'object' OR v_client_transaction_id IS NULL
     OR length(v_client_transaction_id) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'The sale details are incomplete.');
  END IF;
  IF COALESCE(p_sale->'paymentMethod'->>'id', '') <> 'cash_ugx' THEN
    RETURN jsonb_build_object('success', false, 'error', 'The local server accepts cash sales only.');
  END IF;
  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) NOT BETWEEN 1 AND 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add at least one item before completing a cash sale.');
  END IF;

  SELECT * INTO v_existing
  FROM public.business_local_cash_sales
  WHERE business_id = v_business_id
    AND client_transaction_id = v_client_transaction_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'alreadyRecorded', true, 'id', v_existing.id,
      'transactionId', v_existing.client_transaction_id, 'receiptNumber', v_existing.receipt_number,
      'subtotal', v_existing.subtotal, 'tax', v_existing.tax_amount, 'total', v_existing.total_amount,
      'amountPaid', v_existing.amount_paid_ugx, 'changeGiven', v_existing.change_given,
      'items', v_existing.items, 'cashier', v_existing.cashier_name,
      'register', v_existing.register_number, 'createdAt', v_existing.created_at
    );
  END IF;

  BEGIN
    v_subtotal := round((p_sale->>'subtotal')::NUMERIC, 2);
    v_tax := round((p_sale->>'tax')::NUMERIC, 2);
    v_total := round((p_sale->>'total')::NUMERIC, 2);
    v_amount_paid := round((p_sale->>'amountPaid')::NUMERIC, 2);
    v_change := round(COALESCE((p_sale->>'changeGiven')::NUMERIC, 0), 2);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'The sale totals are not valid numbers.');
  END;
  IF v_subtotal IS NULL OR v_tax IS NULL OR v_total IS NULL OR v_amount_paid IS NULL
     OR v_subtotal < 0 OR v_tax < 0 OR v_total <= 0 OR v_amount_paid < v_total
     OR v_change < 0 OR abs(v_change - (v_amount_paid - v_total)) > 0.02 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A local cash sale must be paid in full with valid change.');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    BEGIN
      v_product_id := COALESCE(NULLIF(v_item->>'product_id', ''), NULLIF(v_item->>'id', ''))::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;
      v_unit_price := COALESCE(NULLIF(v_item->>'selling_price', '')::NUMERIC, NULLIF(v_item->>'price', '')::NUMERIC);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', 'A sale item has an invalid product, price, or quantity.');
    END;
    IF v_quantity IS NOT NULL AND v_quantity <> trunc(v_quantity) THEN
      RETURN jsonb_build_object('success', false, 'error', 'This local till currently supports whole-number quantities only.');
    END IF;
    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000000
       OR v_unit_price IS NULL OR v_unit_price < 0 OR v_unit_price > 1000000000000 THEN
      RETURN jsonb_build_object('success', false, 'error', 'A sale item has an invalid product, price, or quantity.');
    END IF;

    SELECT * INTO v_catalog
    FROM public.business_local_catalog
    WHERE business_id = v_business_id AND product_id = v_product_id AND is_active
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'A product in this sale is no longer active on the local server. Refresh the catalog and try again.');
    END IF;
    IF v_catalog.inventory_mode = 'batch_controlled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'This item needs a live batch selection and cannot be sold from the local till yet.');
    END IF;
    IF v_catalog.inventory_mode NOT IN ('stock_controlled', 'listing_only', 'service_item') THEN
      RETURN jsonb_build_object('success', false, 'error', 'This item type is not supported for a local cash sale.');
    END IF;
    IF abs(round(v_unit_price, 2) - round(v_catalog.selling_price, 2)) > 0.01 THEN
      RETURN jsonb_build_object('success', false, 'error', format('The price for %s changed. Refresh the catalog before taking payment.', v_catalog.name));
    END IF;
    IF v_catalog.inventory_mode = 'stock_controlled' THEN
      SELECT COALESCE(sum((line->>'quantity')::NUMERIC), 0)
      INTO v_already_sold
      FROM jsonb_array_elements(v_normalized_items) AS prior(line)
      WHERE line->>'product_id' = v_product_id::TEXT;
      IF v_catalog.current_stock - v_catalog.reserved_stock - v_already_sold < v_quantity THEN
        RETURN jsonb_build_object('success', false, 'error', format('Not enough local stock for %s. Refresh the catalog.', v_catalog.name));
      END IF;
    END IF;

    v_rate := COALESCE(v_catalog.tax_rate, 0) / 100;
    v_tax_included := COALESCE(v_catalog.tax_included, true);
    v_line_gross := v_unit_price * v_quantity;
    v_line_tax := CASE
      WHEN v_rate <= 0 THEN 0
      WHEN v_tax_included THEN v_line_gross - (v_line_gross / (1 + v_rate))
      ELSE v_line_gross * v_rate
    END;
    v_line_total := CASE WHEN v_tax_included THEN v_line_gross ELSE v_line_gross + v_line_tax END;
    v_expected_subtotal := v_expected_subtotal + CASE WHEN v_tax_included THEN v_line_gross - v_line_tax ELSE v_line_gross END;
    v_expected_tax := v_expected_tax + v_line_tax;
    v_expected_total := v_expected_total + v_line_total;

    v_normalized_items := v_normalized_items || jsonb_build_array(
      v_item || jsonb_build_object(
        'id', v_product_id,
        'product_id', v_product_id,
        'name', v_catalog.name,
        'price', v_unit_price,
        'selling_price', v_unit_price,
        'tax_rate', v_catalog.tax_rate,
        'tax_included', v_tax_included,
        'tax_amount', v_line_tax,
        'line_total', v_line_total,
        'inventoryMode', v_catalog.inventory_mode
      )
    );

  END LOOP;

  v_expected_subtotal := round(v_expected_subtotal, 2);
  v_expected_tax := round(v_expected_tax, 2);
  v_expected_total := round(v_expected_total, 2);
  IF abs(v_subtotal - v_expected_subtotal) > 0.02
     OR abs(v_tax - v_expected_tax) > 0.02
     OR abs(v_total - v_expected_total) > 0.02 THEN
    RETURN jsonb_build_object('success', false, 'error', 'The cart total changed. Recheck the receipt before taking cash.');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_normalized_items)
  LOOP
    IF v_item->>'inventoryMode' = 'stock_controlled' THEN
      UPDATE public.business_local_catalog
      SET current_stock = current_stock - (v_item->>'quantity')::NUMERIC,
          stock_updated_at = now()
      WHERE business_id = v_business_id
        AND product_id = (v_item->>'product_id')::UUID;
    END IF;
  END LOOP;

  v_customer_name := left(NULLIF(trim(COALESCE(p_sale->'customer'->>'name', '')), ''), 255);
  v_customer_name := COALESCE(v_customer_name, 'Walk-in Customer');
  v_customer_phone := NULLIF(left(trim(COALESCE(p_sale->'customer'->>'phone', '')), 80), '');
  v_register := COALESCE(NULLIF(left(trim(COALESCE(p_sale->>'register', '')), 80), ''), 'Local Till');
  v_payment_reference := COALESCE(NULLIF(left(trim(COALESCE(p_sale->>'paymentReference', '')), 120), ''), v_client_transaction_id);
  v_receipt_number := 'LOCAL-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(v_id::TEXT, '-', ''), 1, 8));

  INSERT INTO public.business_local_cash_sales (
    id, business_id, client_transaction_id, receipt_number, cashier_id, cashier_name,
    register_number, customer_name, customer_phone, subtotal, tax_amount, total_amount,
    amount_paid_ugx, change_given, tax_included, payment_method, payment_reference,
    items_count, items, created_at
  ) VALUES (
    v_id, v_business_id, v_client_transaction_id, v_receipt_number, auth.uid(), v_cashier_name,
    v_register, v_customer_name, v_customer_phone, v_expected_subtotal, v_expected_tax,
    v_expected_total, v_amount_paid, v_change, COALESCE((p_sale->>'taxIncluded')::BOOLEAN, true),
    'cash', v_payment_reference, jsonb_array_length(v_normalized_items), v_normalized_items,
    COALESCE(NULLIF(p_sale->>'soldAt', '')::TIMESTAMPTZ, now())
  );

  INSERT INTO public.business_local_sync_outbox (event_id, event_type, schema_version, payload, occurred_at)
  VALUES (
    v_id,
    'sale.cash.v1',
    1,
    jsonb_build_object(
      'client_transaction_id', v_client_transaction_id,
      'receipt_number', v_receipt_number,
      'cashier_name', v_cashier_name,
      'register_number', v_register,
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'subtotal', v_expected_subtotal,
      'tax_amount', v_expected_tax,
      'total_amount', v_expected_total,
      'amount_paid_ugx', v_amount_paid,
      'change_given', v_change,
      'tax_included', COALESCE((p_sale->>'taxIncluded')::BOOLEAN, true),
      'payment_method', 'cash',
      'payment_provider', 'Cash (UGX)',
      'payment_reference', v_payment_reference,
      'items_count', jsonb_array_length(v_normalized_items),
      'items', v_normalized_items,
      'created_at', COALESCE(NULLIF(p_sale->>'soldAt', '')::TIMESTAMPTZ, now())
    ),
    COALESCE(NULLIF(p_sale->>'soldAt', '')::TIMESTAMPTZ, now())
  );

  RETURN jsonb_build_object(
    'success', true, 'id', v_id, 'transactionId', v_client_transaction_id,
    'receiptNumber', v_receipt_number, 'subtotal', v_expected_subtotal,
    'tax', v_expected_tax, 'total', v_expected_total, 'amountPaid', v_amount_paid,
    'changeGiven', v_change, 'items', v_normalized_items, 'cashier', v_cashier_name,
    'register', v_register, 'createdAt', COALESCE(NULLIF(p_sale->>'soldAt', '')::TIMESTAMPTZ, now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_record_cash_sale(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_local_record_cash_sale(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
