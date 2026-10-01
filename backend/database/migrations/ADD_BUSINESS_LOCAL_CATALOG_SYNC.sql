-- Protocol v3 adds a supermarket-only product and stock catalog to each
-- paired local node. The node receives a scoped snapshot, then typed updates.

-- The main app supports service/listing items as well as stocked products.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_mode TEXT NOT NULL DEFAULT 'stock_controlled';

ALTER TABLE public.business_local_sync_nodes
  ALTER COLUMN protocol_version SET DEFAULT 3;

UPDATE public.business_local_sync_nodes
SET protocol_version = 3
WHERE protocol_version < 3;

CREATE OR REPLACE FUNCTION public.business_local_sync_protocol_info()
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'protocolVersion', 3,
    'eventSchemaVersion', 1,
    'teamHistoryBootstrapVersion', 1,
    'catalogBootstrapVersion', 1,
    'minimumInstallerVersion', '0.2.0'
  );
$$;

REVOKE ALL ON FUNCTION public.business_local_sync_protocol_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_local_sync_protocol_info() TO anon, authenticated;

-- A cursor based only on sequence IDs can skip a transaction that committed
-- late with a lower identity value. Protocol v3 adds durable per-event
-- acknowledgements. Passing a NULL cursor selects this mode; numeric cursors
-- retain the v2 behavior for already-installed agents until they are updated.
ALTER TABLE public.business_local_sync_events
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_business_local_sync_events_undelivered_node
  ON public.business_local_sync_events(target_node_id, id)
  WHERE direction = 'cloud_to_node' AND delivered_at IS NULL;

CREATE OR REPLACE FUNCTION public.pull_business_local_sync_events(
  p_node_id UUID,
  p_node_secret TEXT,
  p_after_event_id BIGINT DEFAULT 0,
  p_limit INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_node public.business_local_sync_nodes%ROWTYPE;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
  v_after BIGINT := GREATEST(COALESCE(p_after_event_id, 0), 0);
  v_events JSONB;
  v_next_cursor BIGINT;
BEGIN
  SELECT * INTO v_node
  FROM public.business_local_sync_nodes
  WHERE id = p_node_id
    AND revoked_at IS NULL
    AND node_secret_hash = extensions.digest(COALESCE(p_node_secret, ''), 'sha256')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Local server credentials are invalid or revoked.');
  END IF;

  WITH page AS (
    SELECT id, event_id, event_type, schema_version, occurred_at, payload, created_at
    FROM public.business_local_sync_events
    WHERE target_node_id = v_node.id
      AND business_type = v_node.business_type
      AND business_id = v_node.business_id
      AND direction = 'cloud_to_node'
      AND (
        (p_after_event_id IS NULL AND delivered_at IS NULL)
        OR (p_after_event_id IS NOT NULL AND id > v_after)
      )
    ORDER BY id
    LIMIT v_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'cursor', id,
           'event_id', event_id,
           'event_type', event_type,
           'schema_version', schema_version,
           'occurred_at', occurred_at,
           'payload', payload,
           'created_at', created_at
         ) ORDER BY id), '[]'::jsonb),
         COALESCE(MAX(id), v_after)
  INTO v_events, v_next_cursor
  FROM page;

  UPDATE public.business_local_sync_nodes
  SET last_seen_at = now()
  WHERE id = v_node.id;

  RETURN jsonb_build_object('success', true, 'events', v_events, 'nextCursor', v_next_cursor);
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_business_local_sync_events(
  p_node_id UUID,
  p_node_secret TEXT,
  p_event_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_node public.business_local_sync_nodes%ROWTYPE;
  v_acknowledged INTEGER := 0;
BEGIN
  IF p_event_ids IS NULL OR cardinality(p_event_ids) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acknowledgement batch is invalid or too large.');
  END IF;

  SELECT * INTO v_node
  FROM public.business_local_sync_nodes
  WHERE id = p_node_id
    AND revoked_at IS NULL
    AND node_secret_hash = extensions.digest(COALESCE(p_node_secret, ''), 'sha256')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Local server credentials are invalid or revoked.');
  END IF;

  UPDATE public.business_local_sync_events
  SET delivered_at = now()
  WHERE target_node_id = v_node.id
    AND business_type = v_node.business_type
    AND business_id = v_node.business_id
    AND direction = 'cloud_to_node'
    AND delivered_at IS NULL
    AND event_id = ANY(p_event_ids);

  GET DIAGNOSTICS v_acknowledged = ROW_COUNT;
  UPDATE public.business_local_sync_nodes SET last_seen_at = now() WHERE id = v_node.id;

  RETURN jsonb_build_object('success', true, 'acknowledged', v_acknowledged);
END;
$$;

REVOKE ALL ON FUNCTION public.pull_business_local_sync_events(UUID, TEXT, BIGINT, INTEGER)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ack_business_local_sync_events(UUID, TEXT, UUID[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pull_business_local_sync_events(UUID, TEXT, BIGINT, INTEGER)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_business_local_sync_events(UUID, TEXT, UUID[])
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.business_local_catalog_event_payload(
  p_supermarket_id UUID,
  p_product_id UUID
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'operation', 'upsert',
    'product_id', p.id,
    'name', p.name,
    'sku', p.sku,
    'barcode', p.barcode,
    'price', COALESCE(p.price, p.selling_price, 0),
    'selling_price', COALESCE(p.selling_price, p.price, 0),
    'tax_rate', COALESCE(p.tax_rate, 0),
    'category_id', p.category_id,
    'inventory_mode', COALESCE(p.inventory_mode, 'stock_controlled'),
    'is_active', COALESCE(p.is_active, true),
    'current_stock', COALESCE(i.current_stock, 0),
    'reserved_stock', COALESCE(i.reserved_stock, 0),
    'minimum_stock', COALESCE(i.minimum_stock, 0),
    'reorder_point', COALESCE(i.reorder_point, 0),
    'product_updated_at', COALESCE(p.updated_at, p.created_at, now()),
    'stock_updated_at', COALESCE(i.updated_at, i.created_at, p.created_at, now())
  )
  FROM public.products p
  LEFT JOIN public.inventory i
    ON i.product_id = p.id
   AND i.supermarket_id = p_supermarket_id
  WHERE p.id = p_product_id
    AND p.supermarket_id = p_supermarket_id;
$$;

REVOKE ALL ON FUNCTION public.business_local_catalog_event_payload(UUID, UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_business_local_catalog_event(
  p_supermarket_id UUID,
  p_event_id UUID,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.business_local_sync_events (
    event_id, business_type, business_id, direction, target_node_id,
    event_type, schema_version, occurred_at, payload
  )
  SELECT p_event_id, n.business_type, n.business_id, 'cloud_to_node', n.id,
         'catalog.product.v1', 1,
         GREATEST(
           COALESCE((p_payload->>'product_updated_at')::TIMESTAMPTZ, '-infinity'::TIMESTAMPTZ),
           COALESCE((p_payload->>'stock_updated_at')::TIMESTAMPTZ, '-infinity'::TIMESTAMPTZ)
         ), p_payload
  FROM public.business_local_sync_nodes n
  WHERE p_supermarket_id IS NOT NULL
    AND n.business_type = 'supermarket'
    AND n.business_id = p_supermarket_id
    AND n.revoked_at IS NULL
    AND p_payload IS NOT NULL
  ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.enqueue_business_local_catalog_event(UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.broadcast_business_local_catalog_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supermarket_id UUID;
  v_product_id UUID;
  v_payload JSONB;
BEGIN
  -- Pairing takes this transaction lock while it seeds a full catalog. This
  -- makes product/stock changes either part of the snapshot or a later event.
  PERFORM pg_advisory_xact_lock_shared(145019777, 2);

  IF TG_TABLE_NAME = 'products' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.enqueue_business_local_catalog_event(
        OLD.supermarket_id,
        extensions.gen_random_uuid(),
        jsonb_build_object(
          'operation', 'delete', 'product_id', OLD.id,
          'product_updated_at', clock_timestamp(),
          'stock_updated_at', clock_timestamp()
        )
      );
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.supermarket_id IS DISTINCT FROM NEW.supermarket_id THEN
      PERFORM public.enqueue_business_local_catalog_event(
        OLD.supermarket_id,
        extensions.gen_random_uuid(),
        jsonb_build_object(
          'operation', 'delete', 'product_id', OLD.id,
          'product_updated_at', clock_timestamp(),
          'stock_updated_at', clock_timestamp()
        )
      );
    END IF;

    v_supermarket_id := NEW.supermarket_id;
    v_product_id := NEW.id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_supermarket_id := OLD.supermarket_id;
      v_product_id := OLD.product_id;
    ELSE
      v_supermarket_id := NEW.supermarket_id;
      v_product_id := NEW.product_id;
    END IF;
  END IF;

  IF v_supermarket_id IS NULL OR v_product_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  v_payload := public.business_local_catalog_event_payload(v_supermarket_id, v_product_id);
  IF v_payload IS NOT NULL AND TG_TABLE_NAME = 'products' THEN
    v_payload := v_payload || jsonb_build_object('product_updated_at', clock_timestamp());
  ELSIF v_payload IS NOT NULL AND TG_TABLE_NAME = 'inventory' THEN
    IF TG_OP = 'DELETE' THEN
      v_payload := v_payload || jsonb_build_object(
        'current_stock', 0,
        'reserved_stock', 0,
        'minimum_stock', 0,
        'reorder_point', 0
      );
    END IF;
    v_payload := v_payload || jsonb_build_object('stock_updated_at', clock_timestamp());
  END IF;
  IF v_payload IS NOT NULL THEN
    PERFORM public.enqueue_business_local_catalog_event(
      v_supermarket_id,
      extensions.gen_random_uuid(),
      v_payload
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_business_local_catalog_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_business_local_catalog_products
  ON public.products;
CREATE TRIGGER trg_business_local_catalog_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_business_local_catalog_change();

DROP TRIGGER IF EXISTS trg_business_local_catalog_inventory
  ON public.inventory;
CREATE TRIGGER trg_business_local_catalog_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_business_local_catalog_change();

CREATE OR REPLACE FUNCTION public.create_business_local_sync_pairing(
  p_business_type TEXT,
  p_business_id UUID,
  p_node_name TEXT DEFAULT 'Business local server'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_expires_at TIMESTAMPTZ := now() + interval '10 minutes';
BEGIN
  IF auth.uid() IS NULL OR p_business_type NOT IN ('supermarket', 'business_profile')
     OR p_business_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choose a valid business and sign in as its owner.');
  END IF;

  IF NOT public.can_manage_business_local_sync(p_business_type, p_business_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the business owner can set up its local server.');
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.business_local_sync_pairings (
    business_type, business_id, node_name, pairing_token_hash, created_by, expires_at
  ) VALUES (
    p_business_type, p_business_id,
    COALESCE(NULLIF(left(trim(p_node_name), 80), ''), 'Business local server'),
    extensions.digest(v_token, 'sha256'), auth.uid(), v_expires_at
  );

  RETURN jsonb_build_object(
    'success', true,
    'pairingToken', v_token,
    'expiresAt', v_expires_at,
    'protocolVersion', 3
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_local_sync_pairing(TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_local_sync_pairing(TEXT, UUID, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_business_local_sync_pairing(p_pairing_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pairing public.business_local_sync_pairings%ROWTYPE;
  v_node_id UUID;
  v_node_secret TEXT;
  v_message RECORD;
  v_product RECORD;
BEGIN
  IF p_pairing_token IS NULL OR length(p_pairing_token) <> 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pairing token is invalid or expired.');
  END IF;

  SELECT * INTO v_pairing
  FROM public.business_local_sync_pairings
  WHERE pairing_token_hash = extensions.digest(p_pairing_token, 'sha256')
    AND claimed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pairing token is invalid, expired, or already used.');
  END IF;

  -- Acquire locks in the same order used by the migration backfills.
  PERFORM pg_advisory_xact_lock(145019777, 1);
  PERFORM pg_advisory_xact_lock(145019777, 2);

  v_node_secret := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.business_local_sync_nodes (
    business_type, business_id, node_name, node_secret_hash, protocol_version, created_by
  ) VALUES (
    v_pairing.business_type, v_pairing.business_id, v_pairing.node_name,
    extensions.digest(v_node_secret, 'sha256'), 3, v_pairing.created_by
  ) RETURNING id INTO v_node_id;

  FOR v_message IN
    SELECT id, sender_role, sender_name, body, created_at
    FROM public.business_local_team_messages m
    WHERE (
      (m.business_type = v_pairing.business_type AND m.business_id = v_pairing.business_id)
      OR (
        v_pairing.business_type = 'supermarket'
        AND m.business_type = 'business_profile'
        AND EXISTS (
          SELECT 1 FROM public.supermarkets sm
          WHERE sm.id = v_pairing.business_id
            AND sm.pichin_business_profile_id = m.business_id
        )
      )
      OR (
        v_pairing.business_type = 'business_profile'
        AND m.business_type = 'supermarket'
        AND EXISTS (
          SELECT 1 FROM public.supermarkets sm
          WHERE sm.id = m.business_id
            AND sm.pichin_business_profile_id = v_pairing.business_id
        )
      )
    )
    ORDER BY m.created_at, m.id
  LOOP
    INSERT INTO public.business_local_sync_events (
      event_id, business_type, business_id, direction, target_node_id,
      event_type, schema_version, occurred_at, payload
    ) VALUES (
      v_message.id, v_pairing.business_type, v_pairing.business_id,
      'cloud_to_node', v_node_id, 'team.message.v1', 1, v_message.created_at,
      jsonb_build_object(
        'sender_role', v_message.sender_role,
        'sender_name', v_message.sender_name,
        'body', v_message.body,
        'created_at', v_message.created_at
      )
    ) ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
  END LOOP;

  IF v_pairing.business_type = 'supermarket' THEN
    FOR v_product IN
      SELECT id, updated_at, created_at
      FROM public.products
      WHERE supermarket_id = v_pairing.business_id
      ORDER BY id
    LOOP
      INSERT INTO public.business_local_sync_events (
        event_id, business_type, business_id, direction, target_node_id,
        event_type, schema_version, occurred_at, payload
      ) VALUES (
        v_product.id, v_pairing.business_type, v_pairing.business_id,
        'cloud_to_node', v_node_id, 'catalog.product.v1', 1,
         COALESCE(v_product.updated_at, v_product.created_at, now()),
        public.business_local_catalog_event_payload(v_pairing.business_id, v_product.id)
      ) ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.business_local_sync_pairings
  SET claimed_at = now()
  WHERE id = v_pairing.id;

  RETURN jsonb_build_object(
    'success', true,
    'nodeId', v_node_id,
    'nodeSecret', v_node_secret,
    'businessType', v_pairing.business_type,
    'businessId', v_pairing.business_id,
    'protocolVersion', 3
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_business_local_sync_pairing(TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_business_local_sync_pairing(TEXT)
  TO anon, authenticated;

-- Idempotently backfill the catalog for nodes enrolled before protocol v3.
DO $$
DECLARE
  v_product RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(145019777, 1);
  PERFORM pg_advisory_xact_lock(145019777, 2);

  FOR v_product IN
    SELECT n.id AS node_id, n.business_id, p.id AS product_id,
           p.updated_at, p.created_at
    FROM public.business_local_sync_nodes n
    JOIN public.products p ON p.supermarket_id = n.business_id
    WHERE n.business_type = 'supermarket'
      AND n.revoked_at IS NULL
    ORDER BY n.id, p.id
  LOOP
    INSERT INTO public.business_local_sync_events (
      event_id, business_type, business_id, direction, target_node_id,
      event_type, schema_version, occurred_at, payload
    ) VALUES (
      v_product.product_id, 'supermarket', v_product.business_id,
      'cloud_to_node', v_product.node_id, 'catalog.product.v1', 1,
      COALESCE(v_product.updated_at, v_product.created_at, now()),
      public.business_local_catalog_event_payload(v_product.business_id, v_product.product_id)
    ) ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
