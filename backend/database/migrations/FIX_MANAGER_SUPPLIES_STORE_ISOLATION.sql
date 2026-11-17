-- Restrict manager purchase-order access to the manager's assigned store.
-- Suppliers retain access to orders addressed to their user or business profile.
-- Apply after the purchase_orders, supermarket_staff, and business_profiles tables exist.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_business_profile_id UUID;

CREATE OR REPLACE FUNCTION public.can_manage_supplier_orders_for_store_v1(p_supermarket_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_supermarket_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
          AND (
            u.role::TEXT IN ('super_admin', 'superadmin')
            OR (
              u.supermarket_id = p_supermarket_id
              AND u.role::TEXT IN ('admin', 'manager', 'store_manager')
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.supermarket_staff ss
        JOIN public.users u ON u.id = ss.user_id
        WHERE ss.supermarket_id = p_supermarket_id
          AND ss.status = 'active'
          AND ss.role IN ('manager', 'admin')
          AND (u.auth_id = auth.uid() OR u.id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.supermarkets sm
        WHERE sm.id = p_supermarket_id
          AND (
            to_jsonb(sm)->>'owner_user_id' IN (
              auth.uid()::TEXT,
              (SELECT u.id::TEXT FROM public.users u
               WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
               ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
               LIMIT 1)
            )
            OR to_jsonb(sm)->>'admin_id' IN (
              auth.uid()::TEXT,
              (SELECT u.id::TEXT FROM public.users u
               WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
               ORDER BY CASE WHEN u.auth_id = auth.uid() THEN 0 ELSE 1 END
               LIMIT 1)
            )
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_supplier_for_order_v1(
  p_supplier_id UUID,
  p_supplier_business_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
          AND (u.id = p_supplier_id OR u.auth_id = p_supplier_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.business_profiles bp
        JOIN public.users u ON u.id = bp.user_id OR u.auth_id = bp.user_id
        WHERE bp.id = p_supplier_business_profile_id
          AND (u.auth_id = auth.uid() OR u.id = auth.uid())
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_supplier_orders_for_store_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_assigned_supplier_for_order_v1(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_supplier_orders_for_store_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_supplier_for_order_v1(UUID, UUID) TO authenticated;

-- Policies are permissive by default and combine with OR. Remove the legacy
-- authenticated-users-can-access-everything policies before adding scoped ones.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'purchase_orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.purchase_orders', v_policy.policyname);
  END LOOP;
END;
$$;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchase_orders_store_or_supplier_read
  ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    public.can_manage_supplier_orders_for_store_v1(supermarket_id)
    OR public.is_assigned_supplier_for_order_v1(supplier_id, supplier_business_profile_id)
  );

CREATE POLICY purchase_orders_store_insert
  ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    supermarket_id IS NOT NULL
    AND public.can_manage_supplier_orders_for_store_v1(supermarket_id)
  );

CREATE POLICY purchase_orders_store_or_supplier_update
  ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_supplier_orders_for_store_v1(supermarket_id)
    OR public.is_assigned_supplier_for_order_v1(supplier_id, supplier_business_profile_id)
  )
  WITH CHECK (
    public.can_manage_supplier_orders_for_store_v1(supermarket_id)
    OR public.is_assigned_supplier_for_order_v1(supplier_id, supplier_business_profile_id)
  );

CREATE POLICY purchase_orders_store_delete
  ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (public.can_manage_supplier_orders_for_store_v1(supermarket_id));

NOTIFY pgrst, 'reload schema';
