-- FIX: Supermarkets RLS infinite recursion + create supplier_applications table

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE tablename = 'supermarkets' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.supermarkets';
  END LOOP;
END $$;

CREATE POLICY "supermarkets_read_all"
  ON public.supermarkets FOR SELECT USING (true);

CREATE POLICY "supermarkets_auth_write"
  ON public.supermarkets FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.supplier_applications (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id     UUID        REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  supplier_user_id   UUID        REFERENCES public.users(id) ON DELETE CASCADE,
  business_name      TEXT        NOT NULL,
  contact_name       TEXT,
  contact_phone      TEXT,
  contact_email      TEXT,
  product_categories JSONB       DEFAULT '[]',
  message            TEXT,
  status             TEXT        DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (supermarket_id, supplier_user_id)
);

ALTER TABLE public.supplier_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_apps_read_own"
  ON public.supplier_applications FOR SELECT TO authenticated
  USING (
    supplier_user_id = auth.uid()
    OR supplier_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "supplier_apps_write"
  ON public.supplier_applications FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
