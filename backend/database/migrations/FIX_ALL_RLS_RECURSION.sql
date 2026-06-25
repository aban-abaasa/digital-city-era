-- FIX: Drop all cross-referencing RLS policies that cause infinite recursion.
-- Architecture: supermarket_staff (employees), suppliers (independent partners),
-- mybodaguy (independent delivery partners) are separate entities.
-- Access control is handled at the application layer, not via cross-table RLS.

DO $$
DECLARE r RECORD;
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'supermarkets',
    'supermarket_staff',
    'supplier_applications',
    'suppliers',
    'purchase_orders',
    'mybodaguy_delivery_requests',
    'mybodaguy_partners',
    'staff_access_ledger'
  ]
  LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE tablename = t AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- SUPERMARKETS: anyone authenticated can read; only admins write (enforced in app)
CREATE POLICY "supermarkets_read"  ON public.supermarkets FOR SELECT TO authenticated USING (true);
CREATE POLICY "supermarkets_write" ON public.supermarkets FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- SUPERMARKET_STAFF: employees assigned by admin/manager
CREATE POLICY "staff_read"  ON public.supermarket_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_write" ON public.supermarket_staff FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- STAFF_ACCESS_LEDGER: blockchain audit trail
CREATE POLICY "ledger_read"  ON public.staff_access_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "ledger_write" ON public.staff_access_ledger FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- SUPPLIERS: independent partners, self-managed profiles
CREATE POLICY "suppliers_read"  ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_write" ON public.suppliers FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- SUPPLIER_APPLICATIONS: suppliers apply to supermarkets independently
CREATE POLICY "supplier_apps_read"  ON public.supplier_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_apps_write" ON public.supplier_applications FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- PURCHASE_ORDERS: created by managers, fulfilled by suppliers
CREATE POLICY "purchase_orders_read"  ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "purchase_orders_write" ON public.purchase_orders FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- MYBODAGUY_DELIVERY_REQUESTS: independent delivery partners
CREATE POLICY "boda_requests_read"  ON public.mybodaguy_delivery_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "boda_requests_write" ON public.mybodaguy_delivery_requests FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- MYBODAGUY_PARTNERS (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mybodaguy_partners' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "boda_partners_read"  ON public.mybodaguy_partners FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "boda_partners_write" ON public.mybodaguy_partners FOR ALL    TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;
