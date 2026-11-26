-- Let each store admin decide whether linked suppliers can see that store's
-- stock and sales for products assigned to them. The supplier read is exposed
-- through a scoped RPC so customer and transaction details are never returned.

-- Older deployments do not have a metadata column on supermarkets. Keep the
-- visibility settings on the store row while allowing this migration to run on
-- both the older and newer store schemas.
ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

DROP FUNCTION IF EXISTS public.set_supplier_store_inventory_visibility_v1(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.set_supplier_store_inventory_visibility_v1(
  p_supermarket_id UUID,
  p_enabled BOOLEAN,
  p_visibility_mode TEXT,
  p_inventory_limit NUMERIC
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

  SELECT u.id, u.role::TEXT
    INTO v_user_id, v_role
  FROM public.users u
  WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
  ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only an admin can change supplier stock visibility';
  END IF;

  IF p_visibility_mode IS NULL OR p_visibility_mode NOT IN ('full', 'limited') THEN
    RAISE EXCEPTION 'Inventory visibility must be full or limited';
  END IF;

  IF p_inventory_limit IS NULL
     OR p_inventory_limit <> TRUNC(p_inventory_limit)
     OR p_inventory_limit < 1
     OR p_inventory_limit > 10000 THEN
    RAISE EXCEPTION 'The limited inventory amount must be between 1 and 10000 units';
  END IF;

  UPDATE public.supermarkets s
  SET metadata = COALESCE(s.metadata, '{}'::JSONB)
        || jsonb_build_object(
          'supplier_inventory_visibility', COALESCE(p_enabled, FALSE),
          'supplier_inventory_visibility_mode', p_visibility_mode,
          'supplier_inventory_limit', p_inventory_limit
        ),
      updated_at = NOW()
  WHERE s.id = p_supermarket_id
    AND (
      COALESCE(to_jsonb(s)->>'admin_id' IN (v_user_id::TEXT, auth.uid()::TEXT), FALSE)
      OR COALESCE(to_jsonb(s)->>'owner_user_id' = auth.uid()::TEXT, FALSE)
      OR EXISTS (
        SELECT 1
        FROM public.users store_admin
        WHERE store_admin.id = v_user_id
          AND store_admin.role::TEXT IN ('admin', 'super_admin')
          AND to_jsonb(store_admin)->>'supermarket_id' = s.id::TEXT
      )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This admin account is not assigned to that store';
  END IF;

  RETURN COALESCE(p_enabled, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.set_supplier_store_inventory_visibility_v1(UUID, BOOLEAN, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_supplier_store_inventory_visibility_v1(UUID, BOOLEAN, TEXT, NUMERIC) TO authenticated;

-- Some existing deployments have broad supermarket write policies. Protect
-- these specific metadata keys at the row level as well, so suppliers cannot
-- bypass the admin control by updating the store record directly.
CREATE OR REPLACE FUNCTION public.guard_supplier_inventory_visibility_admin_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  IF OLD.metadata->'supplier_inventory_visibility' IS NOT DISTINCT FROM NEW.metadata->'supplier_inventory_visibility'
     AND OLD.metadata->'supplier_inventory_visibility_mode' IS NOT DISTINCT FROM NEW.metadata->'supplier_inventory_visibility_mode'
     AND OLD.metadata->'supplier_inventory_limit' IS NOT DISTINCT FROM NEW.metadata->'supplier_inventory_limit' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to change supplier inventory visibility';
  END IF;

  SELECT u.id, u.role::TEXT
    INTO v_user_id, v_role
  FROM public.users u
  WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
  ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user_id IS NULL
     OR v_role IS NULL
     OR v_role NOT IN ('admin', 'super_admin')
     OR NOT COALESCE((
       COALESCE(to_jsonb(OLD)->>'admin_id' IN (v_user_id::TEXT, auth.uid()::TEXT), FALSE)
       OR COALESCE(to_jsonb(OLD)->>'owner_user_id' = auth.uid()::TEXT, FALSE)
       OR EXISTS (
         SELECT 1
         FROM public.users store_admin
         WHERE store_admin.id = v_user_id
           AND to_jsonb(store_admin)->>'supermarket_id' = OLD.id::TEXT
       )
     ), FALSE) THEN
    RAISE EXCEPTION 'Only this store admin can change supplier inventory visibility';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_supplier_inventory_visibility_admin ON public.supermarkets;
CREATE TRIGGER guard_supplier_inventory_visibility_admin
  BEFORE UPDATE OF metadata ON public.supermarkets
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_inventory_visibility_admin_v1();

-- Keep a small audit record whenever store stock goes down. This lets the
-- supplier view show only products that had a real inventory reduction.
CREATE OR REPLACE FUNCTION public.capture_supplier_inventory_reduction_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.current_stock IS NOT NULL
     AND NEW.current_stock IS NOT NULL
     AND NEW.current_stock < OLD.current_stock THEN
    INSERT INTO public.stock_movements (
      product_id, movement_type, quantity, reference_type, notes
    ) VALUES (
      NEW.product_id,
      'out',
      OLD.current_stock - NEW.current_stock,
      'supplier_visibility_inventory_reduction',
      'Automatically recorded inventory reduction'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_supplier_inventory_reduction ON public.inventory;
CREATE TRIGGER capture_supplier_inventory_reduction
  AFTER UPDATE OF current_stock ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.capture_supplier_inventory_reduction_v1();

-- Seed the recent feed from completed POS sales so the supplier page has a
-- useful 30-day window as soon as this migration is applied. The transaction
-- plus product key makes this backfill safe to rerun.
INSERT INTO public.stock_movements (
  product_id, movement_type, quantity, reference_id, reference_type, notes
)
SELECT
  sold.product_id,
  'out',
  sold.quantity,
  sold.transaction_id,
  'supplier_visibility_inventory_reduction',
  'Backfilled completed POS sale'
FROM (
  SELECT
    t.id AS transaction_id,
    COALESCE(t.updated_at, t.created_at) AS event_at,
    p.id AS product_id,
    SUM(CASE
      WHEN COALESCE(item.value->>'quantity', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN (item.value->>'quantity')::NUMERIC
      ELSE 1
    END) AS quantity
  FROM public.transactions t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::JSONB END
  ) AS item(value)
  JOIN public.products p
    ON p.id::TEXT = COALESCE(NULLIF(item.value->>'product_id', ''), NULLIF(item.value->>'id', ''))
   AND p.supermarket_id = t.supermarket_id
  JOIN public.inventory inv
    ON inv.product_id = p.id
   AND inv.supermarket_id = t.supermarket_id
  WHERE t.status = 'completed'
    AND t.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY t.id, COALESCE(t.updated_at, t.created_at), p.id
) AS sold
WHERE NOT EXISTS (
  SELECT 1
  FROM public.stock_movements existing
  WHERE existing.product_id = sold.product_id
    AND existing.reference_type = 'supplier_visibility_inventory_reduction'
    AND (
      existing.reference_id = sold.transaction_id
      OR (
        existing.reference_id IS NULL
        AND existing.created_at BETWEEN sold.event_at - INTERVAL '1 minute' AND sold.event_at + INTERVAL '1 minute'
      )
    )
);

CREATE OR REPLACE FUNCTION public.get_supplier_store_inventory_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_ids UUID[];
  v_supplier_ids UUID[];
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT u.id), ARRAY[]::UUID[])
    INTO v_user_ids
  FROM public.users u
  WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
    AND u.role::TEXT IN ('supplier', 'manager', 'admin', 'super_admin');

  SELECT COALESCE(array_agg(DISTINCT s.id), ARRAY[]::UUID[])
    INTO v_supplier_ids
  FROM public.suppliers s
  WHERE s.user_id = ANY(v_user_ids)
     OR s.user_id = auth.uid();

  IF cardinality(v_supplier_ids) = 0 THEN
    RETURN jsonb_build_object('enabled', FALSE, 'products', '[]'::JSONB);
  END IF;

  WITH tracked AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      p.supermarket_id,
      m.name AS store_name,
      COALESCE(inv.current_stock, 0)::NUMERIC AS current_stock,
      COALESCE(inv.reserved_stock, 0)::NUMERIC AS reserved_stock,
      GREATEST(COALESCE(inv.current_stock, 0) - COALESCE(inv.reserved_stock, 0), 0)::NUMERIC AS available_stock,
      COALESCE(inv.minimum_stock, 0)::NUMERIC AS minimum_stock,
      COALESCE(inv.reorder_point, 0)::NUMERIC AS reorder_point,
      COALESCE(inv.reorder_quantity, 0)::NUMERIC AS reorder_quantity,
      CASE WHEN m.metadata->>'supplier_inventory_visibility_mode' = 'limited' THEN 'limited' ELSE 'full' END AS visibility_mode,
      CASE
        WHEN COALESCE(m.metadata->>'supplier_inventory_limit', '') ~ '^[0-9]+([.][0-9]+)?$'
          THEN (m.metadata->>'supplier_inventory_limit')::NUMERIC
        ELSE 5::NUMERIC
      END AS visibility_limit
    FROM public.products p
    JOIN public.suppliers s ON s.id = p.supplier_id
    JOIN public.supermarkets m ON m.id = p.supermarket_id
    LEFT JOIN LATERAL (
      SELECT i.current_stock, i.reserved_stock, i.minimum_stock,
             i.reorder_point, i.reorder_quantity
      FROM public.inventory i
      WHERE i.product_id = p.id
        AND (i.supermarket_id = p.supermarket_id OR i.supermarket_id IS NULL)
      ORDER BY (i.supermarket_id = p.supermarket_id) DESC NULLS LAST
      LIMIT 1
    ) inv ON TRUE
    WHERE s.id = ANY(v_supplier_ids)
      AND p.supermarket_id IS NOT NULL
      AND m.metadata->'supplier_inventory_visibility' = 'true'::JSONB
  ), visible AS (
    SELECT *
    FROM tracked
    WHERE visibility_mode = 'full' OR current_stock <= visibility_limit
  ), sales AS (
    SELECT
      p.product_id,
      p.supermarket_id,
      SUM(
        CASE WHEN t.created_at >= NOW() - INTERVAL '7 days'
          THEN CASE WHEN COALESCE(item.value->>'quantity', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN (item.value->>'quantity')::NUMERIC ELSE 0 END
          ELSE 0 END
      ) AS units_sold_7d,
      SUM(
        CASE WHEN COALESCE(item.value->>'quantity', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          THEN (item.value->>'quantity')::NUMERIC ELSE 0 END
      ) AS units_sold_30d,
      SUM(
        CASE
          WHEN COALESCE(item.value->>'line_total', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN (item.value->>'line_total')::NUMERIC
          WHEN COALESCE(item.value->>'quantity', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            AND COALESCE(NULLIF(item.value->>'selling_price', ''), NULLIF(item.value->>'price', ''), '') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN (item.value->>'quantity')::NUMERIC
                 * COALESCE(NULLIF(item.value->>'selling_price', '')::NUMERIC, NULLIF(item.value->>'price', '')::NUMERIC, 0)
          ELSE 0
        END
      ) AS sales_30d_ugx
    FROM visible p
    JOIN public.transactions t
      ON t.supermarket_id = p.supermarket_id
     AND t.created_at >= NOW() - INTERVAL '30 days'
     AND COALESCE(t.status, 'completed') NOT IN ('voided', 'cancelled', 'refunded', 'failed')
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::JSONB END
    ) AS item(value)
    WHERE COALESCE(NULLIF(item.value->>'product_id', ''), NULLIF(item.value->>'id', '')) = p.product_id::TEXT
    GROUP BY p.product_id, p.supermarket_id
  ), reductions AS (
    SELECT
      sm.product_id,
      SUM(sm.quantity)::NUMERIC AS units_reduced_30d
    FROM public.stock_movements sm
    WHERE sm.movement_type = 'out'
      AND sm.reference_type = 'supplier_visibility_inventory_reduction'
      AND sm.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY sm.product_id
  ), metrics AS (
    SELECT
      p.*,
      r.units_reduced_30d,
      COALESCE(s.units_sold_7d, 0)::NUMERIC AS units_sold_7d,
      COALESCE(s.units_sold_30d, 0)::NUMERIC AS units_sold_30d,
      COALESCE(s.sales_30d_ugx, 0)::NUMERIC AS sales_30d_ugx,
      CASE WHEN COALESCE(s.units_sold_30d, 0) > 0
        THEN ROUND(p.available_stock / (s.units_sold_30d / 30.0), 1)
        ELSE NULL
      END AS estimated_days_remaining,
      CASE WHEN p.available_stock <= p.reorder_point
        THEN GREATEST(p.reorder_quantity, p.reorder_point + p.minimum_stock - p.available_stock, 0)
        ELSE 0
      END AS suggested_delivery_quantity
    FROM visible p
    -- USING keeps one product_id in the join result so the following sales
    -- join can safely use product_id again without an ambiguous left column.
    JOIN reductions r USING (product_id)
    LEFT JOIN sales s USING (product_id, supermarket_id)
  )
  SELECT jsonb_build_object(
    'enabled', EXISTS (SELECT 1 FROM tracked),
    'products', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'product_name', product_name,
          'sku', sku,
          'supermarket_id', supermarket_id,
          'store_name', store_name,
          'current_stock', current_stock,
          'reserved_stock', reserved_stock,
          'available_stock', available_stock,
          'minimum_stock', minimum_stock,
          'reorder_point', reorder_point,
          'reorder_quantity', reorder_quantity,
          'visibility_mode', visibility_mode,
          'visibility_limit', visibility_limit,
          'units_reduced_30d', units_reduced_30d,
          'units_sold_7d', units_sold_7d,
          'units_sold_30d', units_sold_30d,
          'sales_30d_ugx', sales_30d_ugx,
          'estimated_days_remaining', estimated_days_remaining,
          'suggested_delivery_quantity', suggested_delivery_quantity
        ) ORDER BY suggested_delivery_quantity DESC, store_name, product_name
      ),
      '[]'::JSONB
    )
  )
    INTO v_result
  FROM metrics;

  RETURN COALESCE(v_result, jsonb_build_object('enabled', TRUE, 'products', '[]'::JSONB));
END;
$$;

REVOKE ALL ON FUNCTION public.get_supplier_store_inventory_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_store_inventory_v1() TO authenticated;

NOTIFY pgrst, 'reload schema';
