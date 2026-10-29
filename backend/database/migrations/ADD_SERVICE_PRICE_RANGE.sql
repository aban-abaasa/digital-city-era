-- ============================================================
-- Service price ranges ("from X to Y")
-- ============================================================
-- A service often has no single price (a haircut, a repair, a clean-up).
-- products.price_max is the optional TOP of a range; products.selling_price
-- stays the lowest ("from") price, so everything that already reads
-- selling_price (POS, bookings, reports) keeps working unchanged.
--
--   price_max NULL, selling_price > 0   -> fixed price
--   price_max > selling_price           -> range
--   selling_price 0, price_max NULL     -> "ask for a quote"
--
-- No check against selling_price on purpose: ICEC-S repricing rewrites
-- selling_price on its own and must never be blocked by this column.
-- The apps treat price_max <= selling_price as "no range".
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_max NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass AND conname = 'products_price_max_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_max_check CHECK (price_max IS NULL OR price_max >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.products.price_max IS
  'Top of a service price range; selling_price is the lowest price. NULL = single price.';

NOTIFY pgrst, 'reload schema';

SELECT 'products.price_max ready.' AS status;
