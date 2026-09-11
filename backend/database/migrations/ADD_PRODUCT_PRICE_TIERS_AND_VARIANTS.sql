-- Wholesale quantity-tier pricing and boutique-style product variants
-- (size/color). Additive, new tables only.
-- Run after CREATE_PRODUCTS_INVENTORY_TABLES.sql.
--
-- product_variants is shaped to match the columns
-- frontend/src/services/productService.jsx already selects
-- (id, product_id, variant_name, variant_value, price_adjustment,
-- stock_quantity, is_active) — that storefront code has been referencing
-- this table without it existing; this migration makes it real.

CREATE TABLE IF NOT EXISTS public.product_price_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supermarket_id  UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  min_quantity    NUMERIC(12, 2) NOT NULL CHECK (min_quantity > 0),
  unit_price      NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, min_quantity)
);

CREATE INDEX IF NOT EXISTS idx_price_tiers_product ON public.product_price_tiers(product_id, min_quantity);
CREATE INDEX IF NOT EXISTS idx_price_tiers_supermarket ON public.product_price_tiers(supermarket_id);

ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_price_tiers_authenticated_access ON public.product_price_tiers;
CREATE POLICY product_price_tiers_authenticated_access ON public.product_price_tiers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supermarket_id  UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  variant_name    TEXT NOT NULL,      -- e.g. 'Size', 'Color'
  variant_value   TEXT NOT NULL,      -- e.g. 'M', 'Red'
  sku             TEXT,
  price_adjustment NUMERIC(15, 2) NOT NULL DEFAULT 0,
  stock_quantity  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, variant_name, variant_value)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_supermarket ON public.product_variants(supermarket_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_variants_authenticated_access ON public.product_variants;
CREATE POLICY product_variants_authenticated_access ON public.product_variants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Decrement variant stock on sale, mirroring the batch_id branch already in
-- deduct_inventory_on_transaction() (see ADD_PHARMACY_FLEXIBLE_INVENTORY.sql).
-- Runs BEFORE the existing function's own logic via CREATE OR REPLACE, since
-- Postgres does not support multiple triggers layering on one function name;
-- this replaces the function body, adding one new branch, and otherwise
-- keeps it byte-for-byte identical to the pharmacy migration's version.
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_batch_id UUID;
  v_variant_id UUID;
  v_qty NUMERIC;
  v_mode TEXT;
  v_product_status TEXT;
  v_requires_prescription BOOLEAN;
  v_controlled BOOLEAN;
  v_expiry DATE;
  v_stock NUMERIC;
  v_supermarket_type TEXT;
BEGIN
  IF NEW.status <> 'completed'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT business_type INTO v_supermarket_type
  FROM public.supermarkets
  WHERE id = NEW.supermarket_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb))
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_batch_id := NULLIF(v_item->>'batch_id', '')::UUID;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
    v_qty := GREATEST(COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1), 0);

    IF v_product_id IS NULL OR v_qty = 0 THEN
      CONTINUE;
    END IF;

    SELECT inventory_mode, product_status, prescription_required,
           controlled_medicine, expiry_date
    INTO v_mode, v_product_status, v_requires_prescription,
         v_controlled, v_expiry
    FROM public.products
    WHERE id = v_product_id
      AND supermarket_id = NEW.supermarket_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not belong to supermarket %', v_product_id, NEW.supermarket_id;
    END IF;

    IF COALESCE(v_product_status, 'active') IN ('expired', 'recalled', 'discontinued')
       OR (v_expiry IS NOT NULL AND v_expiry < CURRENT_DATE) THEN
      RAISE EXCEPTION 'Product % is expired, recalled, or discontinued', v_product_id;
    END IF;

    IF v_supermarket_type = 'pharmacy'
       AND (v_requires_prescription OR v_controlled)
       AND COALESCE((v_item->>'prescription_verified')::BOOLEAN, FALSE) = FALSE THEN
      RAISE EXCEPTION 'Prescription verification is required for product %', v_product_id;
    END IF;

    IF v_mode IN ('listing_only', 'service_item') THEN
      CONTINUE;
    END IF;

    -- Sold item carries a specific variant (e.g. boutique size/color):
    -- deduct that variant's own stock instead of the shared product stock.
    IF v_variant_id IS NOT NULL THEN
      SELECT stock_quantity INTO v_stock
      FROM public.product_variants
      WHERE id = v_variant_id
        AND product_id = v_product_id
        AND supermarket_id = NEW.supermarket_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant % does not belong to product %', v_variant_id, v_product_id;
      END IF;

      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for selected variant of product %', v_product_id;
      END IF;

      UPDATE public.product_variants
      SET stock_quantity = stock_quantity - v_qty,
          updated_at = now()
      WHERE id = v_variant_id;

      CONTINUE;
    END IF;

    IF v_mode = 'batch_controlled' THEN
      IF v_batch_id IS NOT NULL THEN
        SELECT current_stock, expiry_date, status
        INTO v_stock, v_expiry, v_product_status
        FROM public.product_inventory_batches
        WHERE id = v_batch_id
          AND product_id = v_product_id
          AND supermarket_id = NEW.supermarket_id
        FOR UPDATE;

        IF NOT FOUND OR v_product_status <> 'active' OR v_expiry < CURRENT_DATE THEN
          RAISE EXCEPTION 'Selected pharmacy batch is unavailable or expired';
        END IF;

        IF v_stock < v_qty THEN
          RAISE EXCEPTION 'Insufficient stock in selected pharmacy batch for product %', v_product_id;
        END IF;

        UPDATE public.product_inventory_batches
        SET current_stock = current_stock - v_qty,
            status = CASE WHEN current_stock - v_qty = 0 THEN 'depleted' ELSE status END,
            updated_at = now()
        WHERE id = v_batch_id;
      ELSE
        SELECT id, current_stock, expiry_date
        INTO v_batch_id, v_stock, v_expiry
        FROM public.product_inventory_batches
        WHERE product_id = v_product_id
          AND supermarket_id = NEW.supermarket_id
          AND status = 'active'
          AND expiry_date >= CURRENT_DATE
          AND current_stock >= v_qty
        ORDER BY expiry_date ASC
        LIMIT 1
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'No eligible pharmacy batch has enough stock for product %', v_product_id;
        END IF;

        UPDATE public.product_inventory_batches
        SET current_stock = current_stock - v_qty,
            status = CASE WHEN current_stock - v_qty = 0 THEN 'depleted' ELSE status END,
            updated_at = now()
        WHERE id = v_batch_id;
      END IF;
    ELSE
      SELECT current_stock INTO v_stock
      FROM public.inventory
      WHERE product_id = v_product_id
        AND supermarket_id = NEW.supermarket_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record is missing for product %', v_product_id;
      END IF;

      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
      END IF;

      UPDATE public.inventory
      SET current_stock = current_stock - v_qty,
          updated_at = now()
      WHERE product_id = v_product_id
        AND supermarket_id = NEW.supermarket_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transaction_deduct_inventory ON public.transactions;
CREATE TRIGGER transaction_deduct_inventory
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_on_transaction();

COMMENT ON TABLE public.product_price_tiers IS 'Wholesale quantity-break pricing: unit_price applies once cart quantity for the product reaches min_quantity.';
COMMENT ON TABLE public.product_variants IS 'Per-product variants (e.g. boutique size/color) with their own stock and price adjustment.';
