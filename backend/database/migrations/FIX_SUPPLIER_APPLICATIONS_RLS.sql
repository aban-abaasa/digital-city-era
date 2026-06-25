-- FIX: supplier_applications RLS policies causing 500 infinite recursion

DROP POLICY IF EXISTS "supplier_apps_read_own" ON public.supplier_applications;
DROP POLICY IF EXISTS "supplier_apps_write" ON public.supplier_applications;

CREATE POLICY "supplier_apps_read" ON public.supplier_applications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "supplier_apps_insert" ON public.supplier_applications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "supplier_apps_update" ON public.supplier_applications
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "supplier_apps_delete" ON public.supplier_applications
  FOR DELETE TO authenticated USING (true);
