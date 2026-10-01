-- First business workflow supported by the optional local sync node:
-- append-only text messages for a business's internal team channel.

CREATE TABLE IF NOT EXISTS public.business_local_team_messages (
  id UUID PRIMARY KEY,
  business_type TEXT NOT NULL CHECK (business_type IN ('supermarket', 'business_profile')),
  business_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role ~ '^[a-z][a-z0-9_-]{1,31}$'),
  sender_name TEXT NOT NULL CHECK (length(sender_name) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_local_team_messages_scope
  ON public.business_local_team_messages(business_type, business_id, created_at, id);

ALTER TABLE public.business_local_team_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_local_team_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_local_team_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_business_local_sync(
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
            SELECT 1
            FROM public.supermarket_staff ss
            JOIN public.users u ON u.id = ss.user_id
            WHERE ss.supermarket_id = sm.id
              AND ss.status = 'active'
              AND (u.id = p_user_id OR u.auth_id = p_user_id)
          )
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
          OR EXISTS (
            SELECT 1 FROM public.business_account_members bam
            WHERE bam.business_profile_id = sm.pichin_business_profile_id
              AND bam.auth_user_id = p_user_id
              AND bam.employment_status = 'active'
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
          OR EXISTS (
            SELECT 1 FROM public.business_account_members bam
            WHERE bam.business_profile_id = bp.id
              AND bam.auth_user_id = p_user_id
              AND bam.employment_status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM public.supermarkets sm
            WHERE sm.pichin_business_profile_id = bp.id
              AND (
                sm.owner_user_id = p_user_id
                OR EXISTS (
                  SELECT 1 FROM public.supermarket_staff ss
                  JOIN public.users u ON u.id = ss.user_id
                  WHERE ss.supermarket_id = sm.id
                    AND ss.status = 'active'
                    AND (u.id = p_user_id OR u.auth_id = p_user_id)
                )
              )
          )
        )
    )
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION public.can_access_business_local_sync(TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_business_local_sync(TEXT, UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_business_local_team_chat_scope(p_supermarket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_business_local_sync(
    'supermarket', p_supermarket_id, auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only an active member of this store can open its team chat.');
  END IF;

  SELECT sm.pichin_business_profile_id INTO v_profile_id
  FROM public.supermarkets sm
  WHERE sm.id = p_supermarket_id;

  IF v_profile_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'businessType', 'business_profile',
      'businessId', v_profile_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'businessType', 'supermarket',
    'businessId', p_supermarket_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_business_local_team_chat_scope(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_business_local_team_chat_scope(UUID)
  TO authenticated;

DROP POLICY IF EXISTS business_local_team_messages_read_member
  ON public.business_local_team_messages;
CREATE POLICY business_local_team_messages_read_member
  ON public.business_local_team_messages
  FOR SELECT TO authenticated
  USING (public.can_access_business_local_sync(business_type, business_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.broadcast_business_local_team_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_local_sync_events (
    event_id, business_type, business_id, direction, target_node_id,
    event_type, payload
  )
  SELECT
    NEW.id,
    n.business_type,
    n.business_id,
    'cloud_to_node',
    n.id,
    'team.message.v1',
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

DROP TRIGGER IF EXISTS trg_broadcast_business_local_team_message
  ON public.business_local_team_messages;
CREATE TRIGGER trg_broadcast_business_local_team_message
  AFTER INSERT ON public.business_local_team_messages
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_business_local_team_message();

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
END;
$$;

CREATE OR REPLACE FUNCTION public.send_business_local_team_message(
  p_business_type TEXT,
  p_business_id UUID,
  p_event_id UUID,
  p_sender_role TEXT,
  p_sender_name TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message public.business_local_team_messages%ROWTYPE;
  v_profile_name TEXT;
  v_profile_role TEXT;
  v_sender_name TEXT;
  v_sender_role TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_business_local_sync(
    p_business_type, p_business_id, auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only an active member of this business can send team messages.');
  END IF;

  IF p_event_id IS NULL
     OR COALESCE(p_sender_role, '') !~ '^[a-z][a-z0-9_-]{1,31}$'
     OR length(trim(COALESCE(p_sender_name, ''))) NOT BETWEEN 1 AND 120
     OR length(trim(COALESCE(p_body, ''))) NOT BETWEEN 1 AND 4000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team message is empty or too long.');
  END IF;

  SELECT u.full_name, u.role
  INTO v_profile_name, v_profile_role
  FROM public.users u
  WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
  ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;

  v_sender_name := left(COALESCE(NULLIF(trim(v_profile_name), ''), trim(p_sender_name)), 120);
  v_sender_role := CASE
    WHEN COALESCE(v_profile_role, '') ~ '^[a-z][a-z0-9_-]{1,31}$' THEN v_profile_role
    ELSE p_sender_role
  END;

  INSERT INTO public.business_local_team_messages (
    id, business_type, business_id, sender_role, sender_name, body
  ) VALUES (
    p_event_id,
    p_business_type,
    p_business_id,
    v_sender_role,
    v_sender_name,
    trim(p_body)
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_message;

  IF NOT FOUND THEN
    SELECT * INTO v_message
    FROM public.business_local_team_messages
    WHERE id = p_event_id
      AND business_type = p_business_type
      AND business_id = p_business_id;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message ID is already used by another business.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', jsonb_build_object(
      'id', v_message.id,
      'business_type', v_message.business_type,
      'business_id', v_message.business_id,
      'sender_role', v_message.sender_role,
      'sender_name', v_message.sender_name,
      'body', v_message.body,
      'created_at', v_message.created_at
    )
  );
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
    SELECT id, event_id, event_type, payload
    FROM public.business_local_sync_events
    WHERE source_node_id = v_node.id
      AND direction = 'node_to_cloud'
      AND processed_at IS NULL
      AND event_id = ANY(p_event_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    v_payload := v_event.payload;
    IF v_event.event_type <> 'team.message.v1'
       OR length(trim(COALESCE(v_payload->>'sender_role', ''))) NOT BETWEEN 2 AND 32
       OR COALESCE(v_payload->>'sender_role', '') !~ '^[a-z][a-z0-9_-]{1,31}$'
       OR length(trim(COALESCE(v_payload->>'sender_name', ''))) NOT BETWEEN 1 AND 120
       OR length(trim(COALESCE(v_payload->>'body', ''))) NOT BETWEEN 1 AND 4000 THEN
      UPDATE public.business_local_sync_events
      SET processed_at = now(), processing_error = 'Unsupported or invalid team message event.'
      WHERE id = v_event.id;
      v_quarantined := v_quarantined + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'event_id', v_event.event_id,
        'error', 'Unsupported or invalid team message event.'
      ));
      CONTINUE;
    END IF;

    v_message_business_type := v_node.business_type;
    v_message_business_id := v_node.business_id;
    IF v_node.business_type = 'supermarket' THEN
      SELECT sm.pichin_business_profile_id
      INTO v_message_business_id
      FROM public.supermarkets sm
      WHERE sm.id = v_node.business_id;
      IF v_message_business_id IS NOT NULL THEN
        v_message_business_type := 'business_profile';
      ELSE
        v_message_business_id := v_node.business_id;
      END IF;
    END IF;

    INSERT INTO public.business_local_team_messages (
      id, business_type, business_id, sender_role, sender_name, body, created_at
    ) VALUES (
      v_event.event_id,
      v_message_business_type,
      v_message_business_id,
      v_payload->>'sender_role',
      trim(v_payload->>'sender_name'),
      trim(v_payload->>'body'),
      now()
    )
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM public.business_local_team_messages
      WHERE id = v_event.event_id
        AND business_type = v_message_business_type
        AND business_id = v_message_business_id
    ) THEN
      UPDATE public.business_local_sync_events
      SET processed_at = now(), processing_error = 'Team message ID is already used by another business.'
      WHERE id = v_event.id;
      v_quarantined := v_quarantined + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'event_id', v_event.event_id,
        'error', 'Team message ID is already used by another business.'
      ));
      CONTINUE;
    END IF;

    UPDATE public.business_local_sync_events
    SET processed_at = now(), processing_error = NULL
    WHERE id = v_event.id;
    v_applied := v_applied + 1;
  END LOOP;

  UPDATE public.business_local_sync_nodes
  SET last_seen_at = now()
  WHERE id = v_node.id;

  RETURN jsonb_build_object(
    'success', true,
    'applied', v_applied,
    'quarantined', v_quarantined,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_business_local_team_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_business_local_team_message(TEXT, UUID, UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_business_local_sync_events(UUID, TEXT, UUID[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_business_local_team_message(TEXT, UUID, UUID, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_business_local_sync_events(UUID, TEXT, UUID[])
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
