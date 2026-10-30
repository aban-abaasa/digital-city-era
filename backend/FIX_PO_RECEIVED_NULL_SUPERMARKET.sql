-- Marking a purchase order as received failed with:
--   null value in column "supermarket_id" of relation "inventory" violates not-null constraint
-- The trigger po_received_update_inventory adds stock to inventory using purchase_orders.supermarket_id,
-- and orders were being saved without one. This:
--   1. fills in the store on existing orders from the manager who placed them,
--   2. makes the trigger fall back to the product's own store (and skip a line it cannot place
--      instead of blocking the whole receipt).
-- Safe to run more than once.

-- 1. Backfill orders that have no store
UPDATE public.purchase_orders po
SET supermarket_id = u.supermarket_id
FROM public.users u
WHERE po.supermarket_id IS NULL
  AND u.supermarket_id IS NOT NULL
  AND (u.id = po.manager_id OR u.auth_id = po.manager_id);

-- 2. Trigger: use the order's store, else the product's store, else skip the line
CREATE OR REPLACE FUNCTION public.update_inventory_on_po_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_item       JSONB;
  v_product_id UUID;
  v_qty        INTEGER;
  v_store_id   UUID;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'))
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_qty        := COALESCE((v_item->>'quantity')::INTEGER, 0);
      IF v_product_id IS NOT NULL AND v_qty > 0 THEN
        v_store_id := COALESCE(NEW.supermarket_id, (SELECT supermarket_id FROM public.products WHERE id = v_product_id));
        IF v_store_id IS NULL THEN
          RAISE WARNING 'Order % line for product % has no store; stock not added', NEW.id, v_product_id;
          CONTINUE;
        END IF;
        INSERT INTO public.inventory
          (product_id, supermarket_id, current_stock, last_restocked_at, updated_at)
        VALUES
          (v_product_id, v_store_id, v_qty, now(), now())
        ON CONFLICT (product_id, supermarket_id)
        DO UPDATE SET
          current_stock     = public.inventory.current_stock + v_qty,
          last_restocked_at = now(),
          updated_at        = now();
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
