-- ============================================================
-- FIX: PostgREST can't embed supermarkets under products
-- ============================================================
-- Error seen client-side: "Could not find a relationship between
-- 'products' and 'supermarkets' in the schema cache" -- this is PostgREST
-- refusing the `.select('..., supermarkets!inner(...)')` embed syntax
-- bookingService.searchBookableServices() relies on (see
-- FIX_PRODUCTS_CUSTOMER_READ_ACCESS.sql for the RLS half of this same
-- bug hunt). PostgREST only knows how to embed a table through a real
-- FOREIGN KEY constraint -- an index or a NOT NULL column isn't enough.
--
-- CREATE_PRODUCTS_INVENTORY_TABLES.sql adds products.supermarket_id via
-- `ADD COLUMN IF NOT EXISTS supermarket_id UUID REFERENCES
-- public.supermarkets(id) ...`, but that whole clause -- REFERENCES
-- included -- is skipped by IF NOT EXISTS whenever the column already
-- exists from some earlier migration/seed run. The column having data in
-- it (products clearly have a working supermarket_id in the app today)
-- says nothing about whether the FK constraint itself ever got attached --
-- and evidently, on this database, it didn't.
--
-- This adds that FK constraint directly if it's missing, tolerating (with
-- a NOTICE, not a failure) the one thing that could make it fail: existing
-- rows whose supermarket_id doesn't match any real supermarkets.id.
--
-- Run after: CREATE_PRODUCTS_INVENTORY_TABLES.sql.
-- Safe to run more than once.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.products'::regclass
      AND confrelid = 'public.supermarkets'::regclass
      AND conkey = (
        SELECT ARRAY[attnum] FROM pg_attribute
        WHERE attrelid = 'public.products'::regclass AND attname = 'supermarket_id'
      )
  ) THEN
    BEGIN
      ALTER TABLE public.products
        ADD CONSTRAINT products_supermarket_id_fkey
        FOREIGN KEY (supermarket_id) REFERENCES public.supermarkets(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ products_supermarket_id_fkey added.';
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE NOTICE '⚠️ Could not add products_supermarket_id_fkey — some products.supermarket_id values do not match any supermarkets.id. Fix or null out those rows, then re-run this migration.';
    END;
  ELSE
    RAISE NOTICE 'products_supermarket_id_fkey (or an equivalent FK) already exists — nothing to do.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Products→supermarkets relationship fixed.' AS status;
