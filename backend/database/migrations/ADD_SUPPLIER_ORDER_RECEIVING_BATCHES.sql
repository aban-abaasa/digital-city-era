-- Resolve received supplier order lines into store stock exactly once and keep
-- supplier batch details (batch number + expiry date) in store inventory.
-- Run after CREATE_PRODUCTS_INVENTORY_TABLES.sql. Safe to re-run.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Keep the approved supplier quote untouched; this private-to-receiving copy
-- adds the receiving store's matched/created product IDs for the stock trigger.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS inventory_receiving_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.product_inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  current_stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  purchase_price NUMERIC(15,2),
  selling_price NUMERIC(15,2),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'recalled', 'depleted')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, supermarket_id, batch_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_inventory_batches_product_store_batch_key
  ON public.product_inventory_batches(product_id, supermarket_id, batch_number);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry
  ON public.product_inventory_batches(expiry_date, status);

ALTER TABLE public.product_inventory_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_batches_authenticated_access ON public.product_inventory_batches;
CREATE POLICY product_batches_authenticated_access
  ON public.product_inventory_batches FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_inventory_batches TO authenticated;

CREATE OR REPLACE FUNCTION public.update_inventory_on_po_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_receive_items JSONB;
  v_product_id UUID;
  v_qty NUMERIC(12,2);
  v_batch_number TEXT;
  v_expiry_date DATE;
  v_unit_price NUMERIC(15,2);
BEGIN
  IF NEW.status = 'received' AND OLD.status IS DISTINCT FROM 'received' THEN
    IF NEW.supermarket_id IS NULL THEN
      RAISE EXCEPTION 'A store is required before receiving a purchase order';
    END IF;

    v_receive_items := CASE
      WHEN jsonb_typeof(NEW.inventory_receiving_items) = 'array'
       AND jsonb_array_length(NEW.inventory_receiving_items) > 0
        THEN NEW.inventory_receiving_items
      ELSE COALESCE(NEW.items, '[]'::jsonb)
    END;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_receive_items)
    LOOP
      v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
      v_qty := COALESCE(
        NULLIF(v_item->>'quantity', '')::NUMERIC,
        NULLIF(v_item->>'qty', '')::NUMERIC,
        0
      );
      v_batch_number := NULLIF(BTRIM(COALESCE(v_item->>'batch_number', '')), '');
      v_expiry_date := NULLIF(v_item->>'expiry_date', '')::DATE;
      v_unit_price := COALESCE(
        NULLIF(v_item->>'unit_price', '')::NUMERIC,
        NULLIF(v_item->>'unitPrice', '')::NUMERIC,
        0
      );

      IF v_product_id IS NOT NULL AND v_qty > 0 THEN
        INSERT INTO public.inventory
          (product_id, supermarket_id, current_stock, last_restocked_at, updated_at)
        VALUES
          (v_product_id, NEW.supermarket_id, v_qty, now(), now())
        ON CONFLICT (product_id, supermarket_id)
        DO UPDATE SET
          current_stock = COALESCE(public.inventory.current_stock, 0) + EXCLUDED.current_stock,
          last_restocked_at = now(),
          updated_at = now();

        IF v_batch_number IS NOT NULL AND v_expiry_date IS NOT NULL THEN
          INSERT INTO public.product_inventory_batches
            (product_id, supermarket_id, batch_number, expiry_date, current_stock,
             purchase_price, selling_price, created_by, status, updated_at)
          VALUES
            (v_product_id, NEW.supermarket_id, v_batch_number, v_expiry_date, v_qty,
             v_unit_price, v_unit_price, auth.uid(), 'active', now())
          ON CONFLICT (product_id, supermarket_id, batch_number)
          DO UPDATE SET
            expiry_date = EXCLUDED.expiry_date,
            current_stock = public.product_inventory_batches.current_stock + EXCLUDED.current_stock,
            purchase_price = EXCLUDED.purchase_price,
            status = 'active',
            updated_at = now();

          UPDATE public.products p
             SET expiry_date = (
               SELECT b.expiry_date
                 FROM public.product_inventory_batches b
                WHERE b.product_id = v_product_id
                  AND b.supermarket_id = NEW.supermarket_id
                  AND b.status = 'active'
                  AND b.current_stock > 0
                ORDER BY (b.expiry_date >= CURRENT_DATE) DESC, b.expiry_date ASC
                LIMIT 1
             ),
                 updated_at = now()
           WHERE p.id = v_product_id;
        ELSIF v_expiry_date IS NOT NULL THEN
          UPDATE public.products
             SET expiry_date = v_expiry_date, updated_at = now()
           WHERE id = v_product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS po_received_update_inventory ON public.purchase_orders;
CREATE TRIGGER po_received_update_inventory
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_inventory_on_po_received();

NOTIFY pgrst, 'reload schema';
