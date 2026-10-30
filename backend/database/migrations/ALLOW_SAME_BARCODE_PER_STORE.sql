-- ALLOW THE SAME BARCODE IN DIFFERENT STORES (optional)
-- Every store is independent: two stores stocking the same supplier product both need that
-- product's real barcode, so manager orders can match supplier items by barcode in each store.
-- products.barcode is currently UNIQUE across all stores. This makes it unique per store instead.
--
-- Run it only after checking that nothing depends on a barcode being unique across stores:
-- scanner/POS lookups must filter by supermarket_id (the manager order matching does).

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.products'::regclass
      AND con.contype = 'u'
      AND (SELECT array_agg(att.attname::text) FROM pg_attribute att
           WHERE att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)) = ARRAY['barcode']
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Plain unique indexes on barcode alone (created outside a constraint)
DROP INDEX IF EXISTS public.products_barcode_key;

CREATE UNIQUE INDEX IF NOT EXISTS products_store_barcode_unique
  ON public.products (supermarket_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';
