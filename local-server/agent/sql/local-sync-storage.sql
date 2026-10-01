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
