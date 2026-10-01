-- Add explicit per-event schema versions and source event time to the
-- business-scoped local sync protocol. created_at remains the cloud receipt
-- time; occurred_at records when the originating node created the event.

ALTER TABLE public.business_local_sync_events
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1
    CHECK (schema_version BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.business_local_sync_nodes
  ALTER COLUMN protocol_version SET DEFAULT 2;

UPDATE public.business_local_sync_nodes
SET protocol_version = 2
WHERE protocol_version < 2;

CREATE OR REPLACE FUNCTION public.business_local_sync_protocol_info()
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'protocolVersion', 2,
    'eventSchemaVersion', 1,
    'teamHistoryBootstrapVersion', 1,
    'minimumInstallerVersion', '0.2.0'
  );
$$;

REVOKE ALL ON FUNCTION public.business_local_sync_protocol_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_local_sync_protocol_info() TO anon, authenticated;

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
    'protocolVersion', 2
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

  -- Coordinate with the team-message broadcast trigger. This closes the race
  -- between seeding existing history and the node becoming visible to new
  -- message inserts without taking a table-wide write lock.
  PERFORM pg_advisory_xact_lock(145019777, 1);

  v_node_secret := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.business_local_sync_nodes (
    business_type, business_id, node_name, node_secret_hash, protocol_version, created_by
  ) VALUES (
    v_pairing.business_type, v_pairing.business_id, v_pairing.node_name,
    extensions.digest(v_node_secret, 'sha256'), 2, v_pairing.created_by
  ) RETURNING id INTO v_node_id;

  -- Seed the new node with the same company-scoped conversation history that
  -- live broadcasts deliver. The event ID remains the original message ID,
  -- so retries and overlapping live broadcasts are idempotent.
  INSERT INTO public.business_local_sync_events (
    event_id, business_type, business_id, direction, target_node_id,
    event_type, schema_version, occurred_at, payload
  )
  SELECT m.id, v_pairing.business_type, v_pairing.business_id,
         'cloud_to_node', v_node_id, 'team.message.v1', 1, m.created_at,
         jsonb_build_object(
           'sender_role', m.sender_role,
           'sender_name', m.sender_name,
           'body', m.body,
           'created_at', m.created_at
         )
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
  ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;

  UPDATE public.business_local_sync_pairings
  SET claimed_at = now()
  WHERE id = v_pairing.id;

  RETURN jsonb_build_object(
    'success', true,
    'nodeId', v_node_id,
    'nodeSecret', v_node_secret,
    'businessType', v_pairing.business_type,
    'businessId', v_pairing.business_id,
    'protocolVersion', 2
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_business_local_sync_pairing(TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_business_local_sync_pairing(TEXT)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_business_local_sync_events(
  p_node_id UUID,
  p_node_secret TEXT,
  p_events JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_node public.business_local_sync_nodes%ROWTYPE;
  v_event JSONB;
  v_event_id UUID;
  v_event_type TEXT;
  v_payload JSONB;
  v_schema_version INTEGER;
  v_occurred_at TIMESTAMPTZ;
  v_accepted INTEGER := 0;
  v_duplicates INTEGER := 0;
  v_rows INTEGER;
BEGIN
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array'
     OR jsonb_array_length(p_events) > 100
     OR octet_length(p_events::text) > 1048576 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sync batch is invalid or too large.');
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

  -- Validate the whole batch before inserting any event. Older agents may
  -- omit the new metadata; they are treated as schema version 1 and receive
  -- the current server time as their source timestamp.
  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    IF jsonb_typeof(v_event) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_event->'payload') IS DISTINCT FROM 'object'
       OR octet_length(COALESCE(v_event->'payload', '{}'::jsonb)::text) > 262144
       OR COALESCE(v_event->>'event_type', '') !~ '^[a-z][a-z0-9_.-]{2,63}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'A sync event is invalid or too large.');
    END IF;

    BEGIN
      v_event_id := (v_event->>'event_id')::UUID;
      v_schema_version := COALESCE(NULLIF(v_event->>'schema_version', '')::INTEGER, 1);
      v_occurred_at := COALESCE(NULLIF(v_event->>'occurred_at', '')::TIMESTAMPTZ, now());
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', 'A sync event has invalid ID or origin metadata.');
    END;

    IF v_event_id IS NULL OR v_schema_version NOT BETWEEN 1 AND 100 OR v_occurred_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'A sync event is missing valid origin metadata.');
    END IF;
  END LOOP;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    v_event_id := (v_event->>'event_id')::UUID;
    v_event_type := v_event->>'event_type';
    v_payload := v_event->'payload';
    v_schema_version := COALESCE(NULLIF(v_event->>'schema_version', '')::INTEGER, 1);
    v_occurred_at := COALESCE(NULLIF(v_event->>'occurred_at', '')::TIMESTAMPTZ, now());

    INSERT INTO public.business_local_sync_events (
      event_id, business_type, business_id, direction, source_node_id,
      event_type, schema_version, occurred_at, payload
    ) VALUES (
      v_event_id, v_node.business_type, v_node.business_id,
      'node_to_cloud', v_node.id, v_event_type, v_schema_version,
      v_occurred_at, v_payload
    )
    ON CONFLICT (source_node_id, event_id) WHERE source_node_id IS NOT NULL DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
      v_accepted := v_accepted + 1;
    ELSE
      v_duplicates := v_duplicates + 1;
    END IF;
  END LOOP;

  UPDATE public.business_local_sync_nodes
  SET last_seen_at = now()
  WHERE id = v_node.id;

  RETURN jsonb_build_object('success', true, 'accepted', v_accepted, 'duplicates', v_duplicates);
END;
$$;

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
      AND id > v_after
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

-- Preserve the cloud message's true creation time on nodes instead of using
-- its queue/receipt time as the user-visible message time.
CREATE OR REPLACE FUNCTION public.broadcast_business_local_team_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Pairing takes the exclusive form of this transaction-scoped advisory
  -- lock while it seeds history. New message inserts wait, then broadcast to
  -- the newly committed node, preventing an enrollment history gap.
  PERFORM pg_advisory_xact_lock_shared(145019777, 1);

  INSERT INTO public.business_local_sync_events (
    event_id, business_type, business_id, direction, target_node_id,
    event_type, schema_version, occurred_at, payload
  )
  SELECT NEW.id, n.business_type, n.business_id, 'cloud_to_node', n.id,
         'team.message.v1', 1, NEW.created_at,
         jsonb_build_object(
           'sender_role', NEW.sender_role,
           'sender_name', NEW.sender_name,
           'body', NEW.body,
           'created_at', NEW.created_at
         )
  FROM public.business_local_sync_nodes n
  WHERE n.revoked_at IS NULL
    AND (
      (n.business_type = NEW.business_type AND n.business_id = NEW.business_id)
      OR (
        NEW.business_type = 'supermarket'
        AND n.business_type = 'business_profile'
        AND EXISTS (
          SELECT 1 FROM public.supermarkets sm
          WHERE sm.id = NEW.business_id
            AND sm.pichin_business_profile_id = n.business_id
        )
      )
      OR (
        NEW.business_type = 'business_profile'
        AND n.business_type = 'supermarket'
        AND EXISTS (
          SELECT 1 FROM public.supermarkets sm
          WHERE sm.id = n.business_id
            AND sm.pichin_business_profile_id = NEW.business_id
        )
      )
    )
  ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill history for nodes paired before team-history bootstrap was added.
-- The partial unique index makes reapplying this migration safe. Taking the
-- same transaction lock as pairing and live broadcasts prevents new messages
-- from falling between this snapshot and normal fan-out.
DO $$
BEGIN
  PERFORM pg_advisory_xact_lock(145019777, 1);

  INSERT INTO public.business_local_sync_events (
    event_id, business_type, business_id, direction, target_node_id,
    event_type, schema_version, occurred_at, payload
  )
  SELECT m.id, n.business_type, n.business_id, 'cloud_to_node', n.id,
         'team.message.v1', 1, m.created_at,
         jsonb_build_object(
           'sender_role', m.sender_role,
           'sender_name', m.sender_name,
           'body', m.body,
           'created_at', m.created_at
         )
  FROM public.business_local_sync_nodes n
  JOIN public.business_local_team_messages m ON (
    (m.business_type = n.business_type AND m.business_id = n.business_id)
    OR (
      n.business_type = 'supermarket'
      AND m.business_type = 'business_profile'
      AND EXISTS (
        SELECT 1 FROM public.supermarkets sm
        WHERE sm.id = n.business_id
          AND sm.pichin_business_profile_id = m.business_id
      )
    )
    OR (
      n.business_type = 'business_profile'
      AND m.business_type = 'supermarket'
      AND EXISTS (
        SELECT 1 FROM public.supermarkets sm
        WHERE sm.id = m.business_id
          AND sm.pichin_business_profile_id = n.business_id
      )
    )
  )
  WHERE n.revoked_at IS NULL
  ORDER BY m.created_at, m.id, n.id
  ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_business_local_sync_events(
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
  v_event RECORD;
  v_payload JSONB;
  v_message_business_type TEXT;
  v_message_business_id UUID;
  v_error TEXT;
  v_applied INTEGER := 0;
  v_quarantined INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  IF p_event_ids IS NULL OR cardinality(p_event_ids) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apply batch is invalid or too large.');
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

  FOR v_event IN
    SELECT id, event_id, event_type, schema_version, occurred_at, payload
    FROM public.business_local_sync_events
    WHERE source_node_id = v_node.id
      AND direction = 'node_to_cloud'
      AND processed_at IS NULL
      AND event_id = ANY(p_event_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    v_payload := v_event.payload;
    v_error := NULL;

    IF v_event.event_type <> 'team.message.v1'
       OR v_event.schema_version <> 1
       OR length(trim(COALESCE(v_payload->>'sender_role', ''))) NOT BETWEEN 2 AND 32
       OR COALESCE(v_payload->>'sender_role', '') !~ '^[a-z][a-z0-9_-]{1,31}$'
       OR length(trim(COALESCE(v_payload->>'sender_name', ''))) NOT BETWEEN 1 AND 120
       OR length(trim(COALESCE(v_payload->>'body', ''))) NOT BETWEEN 1 AND 4000 THEN
      v_error := 'Unsupported or invalid team message event version or payload.';
    ELSE
      v_message_business_type := v_node.business_type;
      v_message_business_id := v_node.business_id;
      IF v_node.business_type = 'supermarket' THEN
        SELECT sm.pichin_business_profile_id INTO v_message_business_id
        FROM public.supermarkets sm WHERE sm.id = v_node.business_id;
        IF v_message_business_id IS NOT NULL THEN
          v_message_business_type := 'business_profile';
        ELSE
          v_message_business_id := v_node.business_id;
        END IF;
      END IF;

      INSERT INTO public.business_local_team_messages (
        id, business_type, business_id, sender_role, sender_name, body, created_at
      ) VALUES (
        v_event.event_id, v_message_business_type, v_message_business_id,
        v_payload->>'sender_role', trim(v_payload->>'sender_name'),
        trim(v_payload->>'body'), v_event.occurred_at
      ) ON CONFLICT (id) DO NOTHING;

      IF NOT EXISTS (
        SELECT 1 FROM public.business_local_team_messages
        WHERE id = v_event.event_id
          AND business_type = v_message_business_type
          AND business_id = v_message_business_id
      ) THEN
        v_error := 'Team message ID is already used by another business.';
      END IF;
    END IF;

    UPDATE public.business_local_sync_events
    SET processed_at = now(), processing_error = v_error
    WHERE id = v_event.id;

    IF v_error IS NULL THEN
      v_applied := v_applied + 1;
    ELSE
      v_quarantined := v_quarantined + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('event_id', v_event.event_id, 'error', v_error));
    END IF;
  END LOOP;

  UPDATE public.business_local_sync_nodes SET last_seen_at = now() WHERE id = v_node.id;
  RETURN jsonb_build_object('success', true, 'applied', v_applied, 'quarantined', v_quarantined, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.push_business_local_sync_events(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pull_business_local_sync_events(UUID, TEXT, BIGINT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_business_local_sync_events(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.push_business_local_sync_events(UUID, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pull_business_local_sync_events(UUID, TEXT, BIGINT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_business_local_sync_events(UUID, TEXT, UUID[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
