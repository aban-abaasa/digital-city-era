-- Store receipt QR preference and public store-page details for offline installs.
-- Run after ADD_BUSINESS_LOCAL_CATALOG_SYNC.sql and the supplier visibility
-- migration. Safe to apply more than once.

ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE OR REPLACE FUNCTION public.set_store_receipt_qr_preference_v1(
  p_supermarket_id UUID,
  p_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT u.id, u.role::TEXT INTO v_user_id, v_role
  FROM public.users u
  WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
  ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user_id IS NULL OR v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only a store admin can change receipt settings';
  END IF;

  UPDATE public.supermarkets s
  SET metadata = COALESCE(s.metadata, '{}'::JSONB)
        || jsonb_build_object('receipt_include_qr', COALESCE(p_enabled, FALSE)),
      updated_at = NOW()
  WHERE s.id = p_supermarket_id
    AND (
      COALESCE(to_jsonb(s)->>'admin_id' IN (v_user_id::TEXT, auth.uid()::TEXT), FALSE)
      OR COALESCE(to_jsonb(s)->>'owner_user_id' = auth.uid()::TEXT, FALSE)
      OR EXISTS (
        SELECT 1 FROM public.users store_admin
        WHERE store_admin.id = v_user_id
          AND to_jsonb(store_admin)->>'supermarket_id' = s.id::TEXT
      )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This admin account is not assigned to that store';
  END IF;
  RETURN COALESCE(p_enabled, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.set_store_receipt_qr_preference_v1(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_store_receipt_qr_preference_v1(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_store_receipt_qr_preference_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  IF OLD.metadata->'receipt_include_qr' IS NOT DISTINCT FROM NEW.metadata->'receipt_include_qr' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to change receipt settings';
  END IF;

  SELECT u.id, u.role::TEXT INTO v_user_id, v_role
  FROM public.users u
  WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
  ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user_id IS NULL OR v_role NOT IN ('admin', 'super_admin')
     OR NOT (
       COALESCE(to_jsonb(OLD)->>'admin_id' IN (v_user_id::TEXT, auth.uid()::TEXT), FALSE)
       OR COALESCE(to_jsonb(OLD)->>'owner_user_id' = auth.uid()::TEXT, FALSE)
       OR EXISTS (
         SELECT 1 FROM public.users store_admin
         WHERE store_admin.id = v_user_id
           AND to_jsonb(store_admin)->>'supermarket_id' = OLD.id::TEXT
       )
     ) THEN
    RAISE EXCEPTION 'Only this store admin can change receipt settings';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_store_receipt_qr_preference ON public.supermarkets;
CREATE TRIGGER guard_store_receipt_qr_preference
  BEFORE UPDATE OF metadata ON public.supermarkets
  FOR EACH ROW EXECUTE FUNCTION public.guard_store_receipt_qr_preference_v1();

ALTER TABLE public.business_local_sync_pairings
  ADD COLUMN IF NOT EXISTS receipt_website_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt_include_qr BOOLEAN NOT NULL DEFAULT FALSE;

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
  v_receipt_website_url TEXT := 'https://icanera.space';
  v_receipt_include_qr BOOLEAN := FALSE;
  v_store JSONB;
  v_business_profile_id UUID;
  v_public_profile_id TEXT;
BEGIN
  IF auth.uid() IS NULL OR p_business_type NOT IN ('supermarket', 'business_profile')
     OR p_business_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choose a valid business and sign in as its owner.');
  END IF;
  IF NOT public.can_manage_business_local_sync(p_business_type, p_business_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the business owner can set up its local server.');
  END IF;

  IF p_business_type = 'supermarket' THEN
    SELECT to_jsonb(sm), sm.pichin_business_profile_id
      INTO v_store, v_business_profile_id
    FROM public.supermarkets sm WHERE sm.id = p_business_id;
    v_receipt_include_qr := COALESCE((v_store->'metadata'->>'receipt_include_qr')::BOOLEAN, FALSE);
    IF v_business_profile_id IS NOT NULL AND to_regclass('public.cmms_company_profiles') IS NOT NULL THEN
      EXECUTE 'SELECT id::TEXT FROM public.cmms_company_profiles WHERE pichin_business_profile_id = $1 LIMIT 1'
        INTO v_public_profile_id USING v_business_profile_id;
    END IF;
    IF v_public_profile_id IS NOT NULL THEN
      v_receipt_website_url := 'https://icanera.space/notices/' || v_public_profile_id;
    ELSE
      v_receipt_website_url := COALESCE(
        NULLIF(v_store->>'website_url', ''),
        NULLIF(v_store->>'website', ''),
        CASE WHEN v_business_profile_id IS NOT NULL
          THEN 'https://icanera.space/store/' || v_business_profile_id::TEXT END,
        'https://icanera.space'
      );
    END IF;
  ELSIF to_regclass('public.cmms_company_profiles') IS NOT NULL THEN
    EXECUTE 'SELECT id::TEXT FROM public.cmms_company_profiles WHERE pichin_business_profile_id = $1 LIMIT 1'
      INTO v_public_profile_id USING p_business_id;
    IF v_public_profile_id IS NOT NULL THEN
      v_receipt_website_url := 'https://icanera.space/notices/' || v_public_profile_id;
    ELSE
      v_receipt_website_url := 'https://icanera.space/store/' || p_business_id::TEXT;
    END IF;
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.business_local_sync_pairings (
    business_type, business_id, node_name, pairing_token_hash, created_by, expires_at,
    receipt_website_url, receipt_include_qr
  ) VALUES (
    p_business_type, p_business_id,
    COALESCE(NULLIF(left(trim(p_node_name), 80), ''), 'Business local server'),
    extensions.digest(v_token, 'sha256'), auth.uid(), v_expires_at,
    v_receipt_website_url, v_receipt_include_qr
  );

  RETURN jsonb_build_object(
    'success', true, 'pairingToken', v_token, 'expiresAt', v_expires_at,
    'protocolVersion', 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_local_sync_pairing(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_local_sync_pairing(TEXT, UUID, TEXT) TO authenticated;

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
    AND claimed_at IS NULL AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pairing token is invalid, expired, or already used.');
  END IF;

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
      OR (v_pairing.business_type = 'supermarket' AND m.business_type = 'business_profile'
          AND EXISTS (SELECT 1 FROM public.supermarkets sm WHERE sm.id = v_pairing.business_id
                      AND sm.pichin_business_profile_id = m.business_id))
      OR (v_pairing.business_type = 'business_profile' AND m.business_type = 'supermarket'
          AND EXISTS (SELECT 1 FROM public.supermarkets sm WHERE sm.id = m.business_id
                      AND sm.pichin_business_profile_id = v_pairing.business_id))
    )
    ORDER BY m.created_at, m.id
  LOOP
    INSERT INTO public.business_local_sync_events (
      event_id, business_type, business_id, direction, target_node_id,
      event_type, schema_version, occurred_at, payload
    ) VALUES (
      v_message.id, v_pairing.business_type, v_pairing.business_id,
      'cloud_to_node', v_node_id, 'team.message.v1', 1, v_message.created_at,
      jsonb_build_object('sender_role', v_message.sender_role, 'sender_name', v_message.sender_name,
                         'body', v_message.body, 'created_at', v_message.created_at)
    ) ON CONFLICT (target_node_id, event_id) WHERE target_node_id IS NOT NULL DO NOTHING;
  END LOOP;

  IF v_pairing.business_type = 'supermarket' THEN
    FOR v_product IN
      SELECT id, updated_at, created_at FROM public.products
      WHERE supermarket_id = v_pairing.business_id ORDER BY id
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

  UPDATE public.business_local_sync_pairings SET claimed_at = now() WHERE id = v_pairing.id;
  RETURN jsonb_build_object(
    'success', true, 'nodeId', v_node_id, 'nodeSecret', v_node_secret,
    'businessType', v_pairing.business_type, 'businessId', v_pairing.business_id,
    'protocolVersion', 3,
    'receiptWebsiteUrl', COALESCE(v_pairing.receipt_website_url, 'https://icanera.space'),
    'receiptIncludeQr', COALESCE(v_pairing.receipt_include_qr, FALSE)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_business_local_sync_pairing(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_business_local_sync_pairing(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
