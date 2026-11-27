-- Default supplier stock sharing to on for linked products. An explicit false
-- remains an admin opt-out. Run after ADD_SUPPLIER_STORE_INVENTORY_VISIBILITY.sql.

-- Ensure supplier accounts have a row whose ID can be stored in products.supplier_id.
INSERT INTO public.suppliers (user_id, company_name)
SELECT u.id,
       COALESCE(
         NULLIF(to_jsonb(u)->>'company_name', ''),
         NULLIF(to_jsonb(u)->>'full_name', ''),
         NULLIF(to_jsonb(u)->>'username', ''),
         'Supplier'
       )
FROM public.users u
WHERE u.role::TEXT = 'supplier'
  AND NOT EXISTS (
    SELECT 1
    FROM public.suppliers s
    WHERE s.user_id = u.id
  );

CREATE OR REPLACE FUNCTION public.default_supplier_inventory_visibility_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(jsonb_typeof(NEW.metadata), '') <> 'object' THEN
    NEW.metadata := '{}'::JSONB;
  END IF;

  IF COALESCE(jsonb_typeof(NEW.metadata->'supplier_inventory_visibility'), '') <> 'boolean' THEN
    NEW.metadata := NEW.metadata || jsonb_build_object('supplier_inventory_visibility', TRUE);
  END IF;

  IF NEW.metadata->'supplier_inventory_visibility_mode' IS NULL THEN
    NEW.metadata := NEW.metadata || jsonb_build_object('supplier_inventory_visibility_mode', 'full');
  END IF;

  IF NEW.metadata->'supplier_inventory_limit' IS NULL THEN
    NEW.metadata := NEW.metadata || jsonb_build_object('supplier_inventory_limit', 5);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS default_supplier_inventory_visibility ON public.supermarkets;
CREATE TRIGGER default_supplier_inventory_visibility
  BEFORE INSERT ON public.supermarkets
  FOR EACH ROW
  EXECUTE FUNCTION public.default_supplier_inventory_visibility_v1();

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
      -- A missing preference means enabled. Only an explicit false opts out.
      AND COALESCE(m.metadata->>'supplier_inventory_visibility', 'true') <> 'false'
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
      COALESCE(r.units_reduced_30d, 0)::NUMERIC AS units_reduced_30d,
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
    LEFT JOIN reductions r USING (product_id)
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
