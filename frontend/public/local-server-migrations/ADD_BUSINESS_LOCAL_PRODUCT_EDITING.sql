-- Apply after ADD_BUSINESS_LOCAL_CASH_SALES.sql in the shared cloud project.
-- Lets an Admin edit product details on a paired local server and sync those
-- fields to the matching supermarket product. Stock changes remain separate,
-- audited stock.adjustment.v1 events.

CREATE OR REPLACE FUNCTION public.business_local_apply_product_update(
  p_node_id UUID,
  p_event_id UUID,
  p_schema_version INTEGER,
  p_payload JSONB,
  p_occurred_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node RECORD;
  v_product_id UUID;
  v_name TEXT;
  v_sku TEXT;
  v_barcode TEXT;
  v_price NUMERIC;
  v_tax NUMERIC;
  v_min NUMERIC;
  v_reorder NUMERIC;
BEGIN
  IF p_schema_version IS DISTINCT FROM 1 THEN
    RETURN 'Unsupported product update event version.';
  END IF;

  BEGIN
    v_product_id := (p_payload->>'product_id')::UUID;
    v_price := round((p_payload->>'selling_price')::NUMERIC, 2);
    v_tax := round((p_payload->>'tax_rate')::NUMERIC, 3);
    v_min := round((p_payload->>'minimum_stock')::NUMERIC, 2);
    v_reorder := round((p_payload->>'reorder_point')::NUMERIC, 2);
  EXCEPTION WHEN OTHERS THEN
    RETURN 'Product update has an invalid ID, price or threshold.';
  END;
  v_name := trim(COALESCE(p_payload->>'name', ''));
  v_sku := NULLIF(trim(COALESCE(p_payload->>'sku', '')), '');
  v_barcode := NULLIF(trim(COALESCE(p_payload->>'barcode', '')), '');

  IF v_product_id IS NULL OR length(v_name) NOT BETWEEN 1 AND 255
     OR v_price IS NULL OR v_price < 0 OR v_price > 1000000000000
     OR v_tax IS NULL OR v_tax < 0 OR v_tax > 100
     OR v_min IS NULL OR v_min < 0 OR v_min > 1000000000
     OR v_reorder IS NULL OR v_reorder < 0 OR v_reorder > 1000000000
     OR length(COALESCE(v_sku, '')) > 100 OR length(COALESCE(v_barcode, '')) > 100 THEN
    RETURN 'Product update has invalid details.';
  END IF;

  SELECT n.business_type, n.business_id INTO v_node
  FROM public.business_local_sync_nodes n
  WHERE n.id = p_node_id AND n.revoked_at IS NULL;
  IF NOT FOUND OR v_node.business_type <> 'supermarket' THEN
    RETURN 'Product updates can only sync for a server paired to a supermarket.';
  END IF;

  BEGIN
    UPDATE public.products p
    SET name = v_name,
        sku = COALESCE(v_sku, p.sku),
        barcode = COALESCE(v_barcode, p.barcode),
        price = v_price,
        selling_price = v_price,
        tax_rate = v_tax,
        updated_at = now()
    WHERE p.id = v_product_id AND p.supermarket_id = v_node.business_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'That barcode or SKU is already registered to another product.';
  END;
  IF NOT FOUND THEN
    RETURN 'That product does not exist in the paired supermarket.';
  END IF;

  UPDATE public.inventory
  SET minimum_stock = v_min,
      reorder_point = v_reorder,
      updated_at = now()
  WHERE product_id = v_product_id AND supermarket_id = v_node.business_id;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN left('Could not apply product update: ' || SQLERRM, 500);
END;
$$;

REVOKE ALL ON FUNCTION public.business_local_apply_product_update(UUID, UUID, INTEGER, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r RECORD;
  def TEXT;
  patched TEXT;
  found_any BOOLEAN := false;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'apply_business_local_sync_events' AND n.nspname = 'public'
  LOOP
    found_any := true;
    def := pg_get_functiondef(r.oid);
    IF position('business_local_apply_product_update' in def) > 0 THEN
      RAISE NOTICE 'Already handles local product updates, skipping: %', r.sig;
      CONTINUE;
    END IF;

    patched := regexp_replace(
      def,
      'IF v_event\.event_type\s*=\s*''sale\.cash\.v1'' THEN',
      'IF v_event.event_type = ''product.update.v1'' THEN
      v_error := public.business_local_apply_product_update(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type = ''sale.cash.v1'' THEN'
    );
    IF patched = def THEN
      patched := regexp_replace(
        def,
        'IF v_event\.event_type\s*=\s*''stock\.adjustment\.v1'' THEN',
        'IF v_event.event_type = ''product.update.v1'' THEN
      v_error := public.business_local_apply_product_update(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type = ''stock.adjustment.v1'' THEN'
      );
    END IF;
    IF patched = def THEN
      patched := regexp_replace(
        def,
        'IF\s+v_event\.event_type\s*<>\s*''team\.message\.v1''',
        'IF v_event.event_type = ''product.update.v1'' THEN
      v_error := public.business_local_apply_product_update(v_node.id, v_event.event_id, v_event.schema_version, v_payload, v_event.occurred_at);
    ELSIF v_event.event_type <> ''team.message.v1'''
      );
    END IF;
    IF patched = def THEN
      RAISE EXCEPTION 'Could not find a supported product-update insertion point in %; dispatcher was not changed.', r.sig;
    END IF;
    EXECUTE patched;
    RAISE NOTICE 'Now applies local product updates: %', r.sig;
  END LOOP;
  IF NOT found_any THEN
    RAISE EXCEPTION 'public.apply_business_local_sync_events does not exist; run the earlier business-local migrations first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.business_local_sync_protocol_info()
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'protocolVersion', 4,
    'eventSchemaVersion', 1,
    'teamHistoryBootstrapVersion', 1,
    'catalogBootstrapVersion', 1,
    'cashSalesSyncVersion', 1,
    'productEditingSyncVersion', 1,
    'minimumInstallerVersion', '0.2.0'
  );
$$;
REVOKE ALL ON FUNCTION public.business_local_sync_protocol_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_local_sync_protocol_info() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
