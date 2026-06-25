-- FIX: supermarket_staff RLS infinite recursion

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE tablename = 'supermarket_staff' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.supermarket_staff';
  END LOOP;
END $$;

CREATE POLICY "supermarket_staff_read"
  ON public.supermarket_staff FOR SELECT TO authenticated USING (true);

CREATE POLICY "supermarket_staff_insert"
  ON public.supermarket_staff FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "supermarket_staff_update"
  ON public.supermarket_staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "supermarket_staff_delete"
  ON public.supermarket_staff FOR DELETE TO authenticated USING (true);
