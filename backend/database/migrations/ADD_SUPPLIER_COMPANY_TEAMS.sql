-- Supplier companies have their own roles and team hierarchy. These memberships
-- are separate from supermarket staff so onboarding a supplier manager or worker
-- never changes a store user's role or access.

CREATE TABLE IF NOT EXISTS public.supplier_company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'supplier')),
  manager_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_supplier_id, user_id),
  CHECK (role = 'supplier' OR manager_user_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_supplier_company_members_company_role
  ON public.supplier_company_members(company_supplier_id, role, status);
CREATE INDEX IF NOT EXISTS idx_supplier_company_members_user
  ON public.supplier_company_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_company_members_manager
  ON public.supplier_company_members(company_supplier_id, manager_user_id, status);

CREATE OR REPLACE FUNCTION public.supplier_company_is_owner(p_company_supplier_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.suppliers s
    LEFT JOIN public.users u ON u.id = s.user_id
    WHERE s.id = p_company_supplier_id
      AND (s.user_id = auth.uid() OR u.auth_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.supplier_company_is_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_company_is_owner(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_supplier_company_member_manager_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'supplier' AND NEW.manager_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.supplier_company_members manager
    WHERE manager.company_supplier_id = NEW.company_supplier_id
      AND manager.user_id = NEW.manager_user_id
      AND manager.role = 'manager'
      AND manager.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Supplier workers must be assigned to an active manager in the same supplier company';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_supplier_company_member_manager ON public.supplier_company_members;
CREATE TRIGGER trg_guard_supplier_company_member_manager
  BEFORE INSERT OR UPDATE OF company_supplier_id, role, manager_user_id, status
  ON public.supplier_company_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_company_member_manager_v1();

ALTER TABLE public.supplier_company_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_company_members TO authenticated;

DROP POLICY IF EXISTS supplier_company_members_read_team ON public.supplier_company_members;
CREATE POLICY supplier_company_members_read_team
  ON public.supplier_company_members FOR SELECT TO authenticated
  USING (
    public.supplier_company_is_owner(company_supplier_id)
    OR user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() OR u.id = auth.uid())
    OR manager_user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() OR u.id = auth.uid())
  );

DROP POLICY IF EXISTS supplier_company_members_owner_insert ON public.supplier_company_members;
CREATE POLICY supplier_company_members_owner_insert
  ON public.supplier_company_members FOR INSERT TO authenticated
  WITH CHECK (public.supplier_company_is_owner(company_supplier_id));

DROP POLICY IF EXISTS supplier_company_members_owner_update ON public.supplier_company_members;
CREATE POLICY supplier_company_members_owner_update
  ON public.supplier_company_members FOR UPDATE TO authenticated
  USING (public.supplier_company_is_owner(company_supplier_id))
  WITH CHECK (public.supplier_company_is_owner(company_supplier_id));

DROP POLICY IF EXISTS supplier_company_members_owner_delete ON public.supplier_company_members;
CREATE POLICY supplier_company_members_owner_delete
  ON public.supplier_company_members FOR DELETE TO authenticated
  USING (public.supplier_company_is_owner(company_supplier_id));

-- Team roles can see orders for their own supplier worker identities. Company
-- owners see the full team and managers see only workers assigned to them.
DROP POLICY IF EXISTS supplier_company_members_read_orders ON public.purchase_orders;
CREATE POLICY supplier_company_members_read_orders
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.suppliers company
      LEFT JOIN public.users company_user ON company_user.id = company.user_id
      WHERE public.supplier_company_is_owner(company.id)
        AND purchase_orders.supplier_id IN (company.user_id, company_user.auth_id)
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.supplier_company_members member
      JOIN public.suppliers company ON company.id = member.company_supplier_id
      LEFT JOIN public.users member_user ON member_user.id = member.user_id
      WHERE member.status = 'active'
        AND (
          public.supplier_company_is_owner(member.company_supplier_id)
          OR member.user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() OR u.id = auth.uid())
          OR member.manager_user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() OR u.id = auth.uid())
        )
        AND purchase_orders.supplier_id IN (member.user_id, member_user.auth_id)
    )
  );

-- Team stock respects each store's existing supplier visibility settings.
CREATE OR REPLACE FUNCTION public.get_supplier_company_store_stock_v1(p_company_supplier_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_user_id UUID;
  v_company_role TEXT;
  v_supplier_user_ids UUID[] := ARRAY[]::UUID[];
  v_supplier_ids UUID[] := ARRAY[]::UUID[];
  v_result JSONB;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE u.auth_id = v_auth_id OR u.id = v_auth_id
  ORDER BY (u.auth_id = v_auth_id) DESC NULLS LAST
  LIMIT 1;

  IF public.supplier_company_is_owner(p_company_supplier_id) THEN
    SELECT COALESCE(array_agg(DISTINCT member.user_id), ARRAY[]::UUID[])
      INTO v_supplier_user_ids
    FROM public.supplier_company_members member
    WHERE member.company_supplier_id = p_company_supplier_id
      AND member.role = 'supplier'
      AND member.status = 'active';

    SELECT array_append(v_supplier_user_ids, company.user_id)
      INTO v_supplier_user_ids
    FROM public.suppliers company
    WHERE company.id = p_company_supplier_id;
  ELSE
    SELECT member.role INTO v_company_role
    FROM public.supplier_company_members member
    WHERE member.company_supplier_id = p_company_supplier_id
      AND member.user_id = v_user_id
      AND member.status = 'active'
    LIMIT 1;

    IF v_company_role IS NULL THEN
      RAISE EXCEPTION 'Not a member of this supplier company';
    ELSIF v_company_role = 'manager' THEN
      SELECT COALESCE(array_agg(DISTINCT member.user_id), ARRAY[]::UUID[])
        INTO v_supplier_user_ids
      FROM public.supplier_company_members member
      WHERE member.company_supplier_id = p_company_supplier_id
        AND member.manager_user_id = v_user_id
        AND member.role = 'supplier'
        AND member.status = 'active';
    ELSE
      v_supplier_user_ids := ARRAY[v_user_id];
    END IF;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT supplier.id), ARRAY[]::UUID[])
    INTO v_supplier_ids
  FROM public.suppliers supplier
  WHERE supplier.user_id = ANY(v_supplier_user_ids);

  WITH tracked AS (
    SELECT
      product.id AS product_id,
      product.name AS product_name,
      product.sku,
      product.supermarket_id,
      store.name AS store_name,
      COALESCE(
        NULLIF(to_jsonb(inventory)->>'current_stock', '')::NUMERIC,
        NULLIF(to_jsonb(inventory)->>'quantity', '')::NUMERIC,
        0
      ) AS current_stock,
      COALESCE(NULLIF(to_jsonb(inventory)->>'reserved_stock', '')::NUMERIC, 0) AS reserved_stock,
      COALESCE(
        NULLIF(to_jsonb(inventory)->>'reorder_point', '')::NUMERIC,
        NULLIF(to_jsonb(inventory)->>'reorder_level', '')::NUMERIC,
        0
      ) AS reorder_point,
      CASE WHEN store.metadata->>'supplier_inventory_visibility_mode' = 'limited' THEN 'limited' ELSE 'full' END AS visibility_mode,
      CASE
        WHEN COALESCE(store.metadata->>'supplier_inventory_limit', '') ~ '^[0-9]+([.][0-9]+)?$'
          THEN (store.metadata->>'supplier_inventory_limit')::NUMERIC
        ELSE 5::NUMERIC
      END AS visibility_limit
    FROM public.products product
    JOIN public.suppliers supplier ON supplier.id = product.supplier_id
    JOIN public.supermarkets store ON store.id = product.supermarket_id
    LEFT JOIN LATERAL (
      SELECT i.*
      FROM public.inventory i
      WHERE i.product_id = product.id
        AND (i.supermarket_id = product.supermarket_id OR i.supermarket_id IS NULL)
      ORDER BY (i.supermarket_id = product.supermarket_id) DESC NULLS LAST
      LIMIT 1
    ) inventory ON TRUE
    WHERE supplier.id = ANY(v_supplier_ids)
      AND product.supermarket_id IS NOT NULL
      AND store.metadata->'supplier_inventory_visibility' = 'true'::JSONB
  ), visible AS (
    SELECT * FROM tracked
    WHERE visibility_mode = 'full' OR current_stock <= visibility_limit
  )
  SELECT jsonb_build_object(
    'enabled', EXISTS (SELECT 1 FROM tracked),
    'products', COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', product_id,
      'product_name', product_name,
      'sku', sku,
      'supermarket_id', supermarket_id,
      'store_name', store_name,
      'current_stock', current_stock,
      'available_stock', GREATEST(current_stock - reserved_stock, 0),
      'reorder_point', reorder_point,
      'visibility_mode', visibility_mode,
      'visibility_limit', visibility_limit
    ) ORDER BY store_name, product_name), '[]'::JSONB)
  ) INTO v_result
  FROM visible;

  RETURN COALESCE(v_result, jsonb_build_object('enabled', FALSE, 'products', '[]'::JSONB));
END;
$$;

REVOKE ALL ON FUNCTION public.get_supplier_company_store_stock_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_company_store_stock_v1(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
