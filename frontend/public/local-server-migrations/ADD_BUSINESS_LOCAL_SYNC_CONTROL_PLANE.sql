-- Optional per-business local server enrollment and scoped sync transport.
-- This migration deliberately stores sync envelopes rather than copying
-- arbitrary cloud tables to a local node. Domain-specific handlers must
-- validate and apply each event type before a workflow is considered synced.

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.business_local_sync_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type TEXT NOT NULL CHECK (business_type IN ('supermarket', 'business_profile')),
  business_id UUID NOT NULL,
  node_name TEXT NOT NULL DEFAULT 'Business local server',
  pairing_token_hash BYTEA NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_business_local_sync_pairings_expiry
  ON public.business_local_sync_pairings(expires_at)
  WHERE claimed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.business_local_sync_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type TEXT NOT NULL CHECK (business_type IN ('supermarket', 'business_profile')),
  business_id UUID NOT NULL,
  node_name TEXT NOT NULL DEFAULT 'Business local server',
  node_secret_hash BYTEA NOT NULL,
  protocol_version INTEGER NOT NULL DEFAULT 1 CHECK (protocol_version > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_business_local_sync_nodes_business
  ON public.business_local_sync_nodes(business_type, business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.business_local_sync_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id UUID NOT NULL,
  business_type TEXT NOT NULL CHECK (business_type IN ('supermarket', 'business_profile')),
  business_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('cloud_to_node', 'node_to_cloud')),
  source_node_id UUID REFERENCES public.business_local_sync_nodes(id) ON DELETE RESTRICT,
  target_node_id UUID REFERENCES public.business_local_sync_nodes(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  CHECK (
    (direction = 'cloud_to_node' AND source_node_id IS NULL AND target_node_id IS NOT NULL)
    OR
    (direction = 'node_to_cloud' AND source_node_id IS NOT NULL AND target_node_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_local_sync_events_from_node
  ON public.business_local_sync_events(source_node_id, event_id)
  WHERE source_node_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_local_sync_events_to_node
  ON public.business_local_sync_events(target_node_id, event_id)
  WHERE target_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_local_sync_events_pending_node
  ON public.business_local_sync_events(target_node_id, id)
  WHERE direction = 'cloud_to_node';

CREATE INDEX IF NOT EXISTS idx_business_local_sync_events_pending_cloud
  ON public.business_local_sync_events(created_at, id)
  WHERE direction = 'node_to_cloud' AND processed_at IS NULL;

ALTER TABLE public.business_local_sync_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_local_sync_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_local_sync_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.business_local_sync_pairings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_local_sync_nodes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_local_sync_events FROM PUBLIC, anon, authenticated;

-- Only the business owner (or the owner of its linked Pichin profile) can
-- provision or revoke a local node. Staff memberships do not grant server
-- enrollment rights.
CREATE OR REPLACE FUNCTION public.can_manage_business_local_sync(
  p_business_type TEXT,
  p_business_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND CASE p_business_type
    WHEN 'supermarket' THEN EXISTS (
      SELECT 1
      FROM public.supermarkets sm
      WHERE sm.id = p_business_id
        AND (
          sm.owner_user_id = p_user_id
          OR EXISTS (
            SELECT 1 FROM public.business_profiles bp
            WHERE bp.id = sm.pichin_business_profile_id
              AND (
                bp.user_id = p_user_id
                OR EXISTS (
                  SELECT 1 FROM public.users u
                  WHERE u.id = bp.user_id
                    AND (u.id = p_user_id OR u.auth_id = p_user_id)
                )
              )
          )
        )
    )
    WHEN 'business_profile' THEN EXISTS (
      SELECT 1 FROM public.business_profiles bp
      WHERE bp.id = p_business_id
        AND (
          bp.user_id = p_user_id
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = bp.user_id
              AND (u.id = p_user_id OR u.auth_id = p_user_id)
          )
        )
    )
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_business_local_sync(TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_business_local_sync_businesses()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_businesses JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in as a business owner to continue.');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'businessType', business_type,
    'businessId', business_id,
    'businessName', business_name
  ) ORDER BY business_name), '[]'::jsonb)
  INTO v_businesses
  FROM (
    SELECT 'supermarket'::TEXT AS business_type, sm.id AS business_id,
           COALESCE(sm.name, 'Store') AS business_name
    FROM public.supermarkets sm
    WHERE public.can_manage_business_local_sync('supermarket', sm.id, auth.uid())
    UNION ALL
    SELECT 'business_profile'::TEXT, bp.id,
           COALESCE(bp.business_name, 'Business')
    FROM public.business_profiles bp
    WHERE public.can_manage_business_local_sync('business_profile', bp.id, auth.uid())
  ) owned_businesses;

  RETURN jsonb_build_object('success', true, 'businesses', v_businesses);
END;
$$;

REVOKE ALL ON FUNCTION public.list_business_local_sync_businesses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_business_local_sync_businesses() TO authenticated;

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

  -- Pairing secrets are high-entropy, one-use values. Only their SHA-256
  -- hashes are stored in the cloud database.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.business_local_sync_pairings (
    business_type, business_id, node_name, pairing_token_hash, created_by, expires_at
  ) VALUES (
    p_business_type,
    p_business_id,
    COALESCE(NULLIF(left(trim(p_node_name), 80), ''), 'Business local server'),
    extensions.digest(v_token, 'sha256'),
    auth.uid(),
    v_expires_at
  );

  RETURN jsonb_build_object(
    'success', true,
    'pairingToken', v_token,
    'expiresAt', v_expires_at,
    'protocolVersion', 1
  );
END;
$$;

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

  v_node_secret := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.business_local_sync_nodes (
    business_type, business_id, node_name, node_secret_hash, created_by
  ) VALUES (
    v_pairing.business_type,
    v_pairing.business_id,
    v_pairing.node_name,
    extensions.digest(v_node_secret, 'sha256'),
    v_pairing.created_by
  )
  RETURNING id INTO v_node_id;

  UPDATE public.business_local_sync_pairings
  SET claimed_at = now()
  WHERE id = v_pairing.id;

  RETURN jsonb_build_object(
    'success', true,
    'nodeId', v_node_id,
    'nodeSecret', v_node_secret,
    'businessType', v_pairing.business_type,
    'businessId', v_pairing.business_id,
    'protocolVersion', 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_business_local_sync_node(p_node_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node public.business_local_sync_nodes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in as the business owner to revoke this server.');
  END IF;

  SELECT * INTO v_node
  FROM public.business_local_sync_nodes
  WHERE id = p_node_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.can_manage_business_local_sync(
    v_node.business_type, v_node.business_id, auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Local server not found or you do not own its business.');
  END IF;

  UPDATE public.business_local_sync_nodes
  SET revoked_at = COALESCE(revoked_at, now())
  WHERE id = v_node.id;

  RETURN jsonb_build_object('success', true, 'revoked', true, 'nodeId', v_node.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_business_local_sync_nodes(
  p_business_type TEXT,
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nodes JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_business_local_sync(
    p_business_type, p_business_id, auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the business owner can manage local servers.');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nodeId', id,
    'nodeName', node_name,
    'createdAt', created_at,
    'lastSeenAt', last_seen_at,
    'revokedAt', revoked_at,
    'protocolVersion', protocol_version
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_nodes
  FROM public.business_local_sync_nodes
  WHERE business_type = p_business_type AND business_id = p_business_id;

  RETURN jsonb_build_object('success', true, 'nodes', v_nodes);
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_business_local_sync_event(
  p_business_type TEXT,
  p_business_id UUID,
  p_event_id UUID,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queued INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_business_local_sync(
    p_business_type, p_business_id, auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the business owner can publish local sync events.');
  END IF;

  IF p_event_id IS NULL
     OR COALESCE(p_event_type, '') !~ '^[a-z][a-z0-9_.-]{2,63}$'
     OR p_payload IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(p_payload::text) > 262144 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sync event is invalid or too large.');
  END IF;

  INSERT INTO public.business_local_sync_events (
    event_id, business_type, business_id, direction, target_node_id, event_type, payload
  )
  SELECT p_event_id, p_business_type, p_business_id, 'cloud_to_node', n.id, p_event_type, p_payload
  FROM public.business_local_sync_nodes n
  WHERE n.business_type = p_business_type
    AND n.business_id = p_business_id
    AND n.revoked_at IS NULL
  ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_queued = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'queued', v_queued, 'eventId', p_event_id);
END;
$$;

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

  -- Validate the entire batch before inserting anything so a malformed later
  -- item cannot leave earlier items committed while returning an error.
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
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', 'A sync event has an invalid event ID.');
    END;

    IF v_event_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'A sync event is missing its event ID.');
    END IF;
  END LOOP;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    v_event_id := (v_event->>'event_id')::UUID;
    v_event_type := v_event->>'event_type';
    v_payload := v_event->'payload';

    INSERT INTO public.business_local_sync_events (
      event_id, business_type, business_id, direction, source_node_id, event_type, payload
    ) VALUES (
      v_event_id, v_node.business_type, v_node.business_id,
      'node_to_cloud', v_node.id, v_event_type, v_payload
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

  RETURN jsonb_build_object(
    'success', true,
    'accepted', v_accepted,
    'duplicates', v_duplicates
  );
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
    SELECT id, event_id, event_type, payload, created_at
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
           'payload', payload,
           'created_at', created_at
         ) ORDER BY id), '[]'::jsonb),
         COALESCE(MAX(id), v_after)
  INTO v_events, v_next_cursor
  FROM page;

  UPDATE public.business_local_sync_nodes
  SET last_seen_at = now()
  WHERE id = v_node.id;

  RETURN jsonb_build_object(
    'success', true,
    'events', v_events,
    'nextCursor', v_next_cursor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_local_sync_pairing(TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_business_local_sync_pairing(TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_business_local_sync_node(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_business_local_sync_nodes(TEXT, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.queue_business_local_sync_event(TEXT, UUID, UUID, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_business_local_sync_events(UUID, TEXT, JSONB)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pull_business_local_sync_events(UUID, TEXT, BIGINT, INTEGER)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_business_local_sync_pairing(TEXT, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_business_local_sync_pairing(TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_business_local_sync_node(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_business_local_sync_nodes(TEXT, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_business_local_sync_event(TEXT, UUID, UUID, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_business_local_sync_events(UUID, TEXT, JSONB)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pull_business_local_sync_events(UUID, TEXT, BIGINT, INTEGER)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
