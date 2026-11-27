-- Allow a supplier to link an otherwise unlisted quote line to one of their
-- own catalog items. On delivery confirmation, deduct stock only from that
-- supplier catalog. Store inventory continues to be updated by the receiving
-- flow in ADD_SUPPLIER_ORDER_RECEIVING_BATCHES.sql.
-- Run after ADD_SUPPLIER_PURCHASE_ORDER_QUOTES.sql,
-- ADD_SUPPLIER_CATALOG_BATCH_EXPIRY.sql, and
-- REQUIRE_SUPPLIER_DELIVERY_CONFIRMATION_BEFORE_RECEIPT.sql.

-- Supplier catalog batch quantities and item stock must support fractional
-- units such as kilograms and litres.
ALTER TABLE public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_catalog_items
  ALTER COLUMN stock_quantity TYPE NUMERIC(14, 3)
  USING stock_quantity::NUMERIC(14, 3);
UPDATE public.supplier_catalog_items SET stock_quantity = 0 WHERE stock_quantity IS NULL;
ALTER TABLE public.supplier_catalog_items
  ALTER COLUMN stock_quantity SET DEFAULT 0,
  ALTER COLUMN stock_quantity SET NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.supplier_catalog_batches') IS NOT NULL THEN
    ALTER TABLE public.supplier_catalog_batches
      ALTER COLUMN quantity TYPE NUMERIC(14, 3)
      USING quantity::NUMERIC(14, 3);
  END IF;
END;
$$;

-- Validate links at the database boundary. This checks the supplier quote and
-- the manager-approved order, so a client cannot attach another supplier's
-- stock by sending a forged catalog item ID.
CREATE OR REPLACE FUNCTION public.validate_purchase_order_supplier_catalog_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_catalog_item_id UUID;
  v_supplier_row_id UUID;
  v_supplier_auth_id UUID;
  v_link_exists BOOLEAN;
  v_lines JSONB;
BEGIN
  SELECT u.id, u.auth_id
    INTO v_supplier_row_id, v_supplier_auth_id
    FROM public.users u
   WHERE u.id = NEW.supplier_id OR u.auth_id = NEW.supplier_id
   ORDER BY CASE WHEN u.auth_id = NEW.supplier_id THEN 0 ELSE 1 END
   LIMIT 1;

  IF TG_OP = 'INSERT' OR NEW.supplier_quote_items IS DISTINCT FROM OLD.supplier_quote_items THEN
    v_lines := COALESCE(NEW.supplier_quote_items, '[]'::JSONB);
    IF jsonb_typeof(v_lines) = 'array' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_lines)
      LOOP
        v_catalog_item_id := NULLIF(v_item->>'supplier_catalog_item_id', '')::UUID;
        IF v_catalog_item_id IS NOT NULL THEN
          SELECT EXISTS (
            SELECT 1
              FROM public.supplier_catalog_items i
             WHERE i.id = v_catalog_item_id
               AND (
                 i.supplier_user_id IN (NEW.supplier_id, v_supplier_row_id, v_supplier_auth_id)
                 OR (NEW.supplier_business_profile_id IS NOT NULL
                     AND i.supplier_business_profile_id = NEW.supplier_business_profile_id)
               )
          ) INTO v_link_exists;
          IF NOT v_link_exists THEN
            RAISE EXCEPTION 'A supplier inventory link must belong to the supplier assigned to this order.';
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.items IS DISTINCT FROM OLD.items THEN
    v_lines := COALESCE(NEW.items, '[]'::JSONB);
    IF jsonb_typeof(v_lines) = 'array' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_lines)
      LOOP
        v_catalog_item_id := NULLIF(v_item->>'supplier_catalog_item_id', '')::UUID;
        IF v_catalog_item_id IS NOT NULL THEN
          SELECT EXISTS (
            SELECT 1
              FROM public.supplier_catalog_items i
             WHERE i.id = v_catalog_item_id
               AND (
                 i.supplier_user_id IN (NEW.supplier_id, v_supplier_row_id, v_supplier_auth_id)
                 OR (NEW.supplier_business_profile_id IS NOT NULL
                     AND i.supplier_business_profile_id = NEW.supplier_business_profile_id)
               )
          ) INTO v_link_exists;
          IF NOT v_link_exists THEN
            RAISE EXCEPTION 'A supplier inventory link must belong to the supplier assigned to this order.';
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_purchase_order_supplier_catalog_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_purchase_order_supplier_catalog_links() TO authenticated;

DROP TRIGGER IF EXISTS po_validate_supplier_catalog_links ON public.purchase_orders;
CREATE TRIGGER po_validate_supplier_catalog_links
  BEFORE INSERT OR UPDATE OF supplier_quote_items, items ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_purchase_order_supplier_catalog_links();

-- Delivery and supplier stock deduction happen in one transaction. The
-- existing delivery timestamp makes retries idempotent, so stock cannot be
-- deducted twice if the supplier taps confirm again or reloads the page.
CREATE OR REPLACE FUNCTION public.confirm_supplier_order_delivery(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.purchase_orders;
  v_user_id UUID;
  v_allowed BOOLEAN := FALSE;
  v_item JSONB;
  v_catalog_item_id UUID;
  v_quantity NUMERIC(14, 3);
  v_remaining NUMERIC(14, 3);
  v_take NUMERIC(14, 3);
  v_batch_number TEXT;
  v_batch_id UUID;
  v_batch_quantity NUMERIC(14, 3);
  v_batch RECORD;
  v_has_batches BOOLEAN;
  v_link_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in is required.';
  END IF;

  SELECT id INTO v_user_id
    FROM public.users
   WHERE auth_id = auth.uid() OR id = auth.uid()
   ORDER BY CASE WHEN auth_id = auth.uid() THEN 0 ELSE 1 END
   LIMIT 1;

  SELECT * INTO v_order
    FROM public.purchase_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Purchase order not found.';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
       AND (u.id = v_order.supplier_id OR u.auth_id = v_order.supplier_id)
  ) OR EXISTS (
    SELECT 1
      FROM public.business_profiles bp
     WHERE bp.id = v_order.supplier_business_profile_id
       AND bp.user_id IN (auth.uid(), v_user_id)
  ) INTO v_allowed;

  IF NOT v_allowed
     AND v_order.supplier_business_profile_id IS NOT NULL
     AND to_regprocedure('public.unified_business_member(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.unified_business_member($1)'
       INTO v_allowed
      USING v_order.supplier_business_profile_id;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Only the supplier assigned to this order can confirm its delivery.';
  END IF;

  IF v_order.status <> 'confirmed' THEN
    RAISE EXCEPTION 'The supplier must accept the order before confirming delivery.';
  END IF;

  IF COALESCE(v_order.delivery_method, '') NOT IN (
    'supplier_delivery', 'supplier_own_delivery', 'mybodaguy_delivery', 'supermarket_pickup'
  ) THEN
    RAISE EXCEPTION 'Choose a delivery method before confirming delivery.';
  END IF;

  IF v_order.supplier_delivery_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'order_id', v_order.id,
      'supplier_delivery_confirmed_at', v_order.supplier_delivery_confirmed_at
    );
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::JSONB))
  LOOP
    v_catalog_item_id := NULLIF(v_item->>'supplier_catalog_item_id', '')::UUID;
    IF v_catalog_item_id IS NULL THEN
      CONTINUE;
    END IF;

    v_quantity := COALESCE(
      NULLIF(v_item->>'quantity', '')::NUMERIC,
      NULLIF(v_item->>'qty', '')::NUMERIC,
      0
    );
    IF v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM public.supplier_catalog_items i
       WHERE i.id = v_catalog_item_id
         AND (
           i.supplier_user_id IN (v_order.supplier_id, v_user_id, auth.uid())
           OR (v_order.supplier_business_profile_id IS NOT NULL
               AND i.supplier_business_profile_id = v_order.supplier_business_profile_id)
         )
    ) INTO v_link_exists;
    IF NOT v_link_exists THEN
      -- The supplier may have removed an item after the manager approved the
      -- quote. Preserve delivery confirmation; there is no owned stock left
      -- to deduct, and a missing optional link must not block store receipt.
      CONTINUE;
    END IF;

    v_batch_number := NULLIF(BTRIM(COALESCE(v_item->>'batch_number', '')), '');
    v_remaining := v_quantity;
    v_has_batches := FALSE;

    IF to_regclass('public.supplier_catalog_batches') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.supplier_catalog_batches WHERE catalog_item_id = $1)'
        INTO v_has_batches
        USING v_catalog_item_id;
    END IF;

    IF v_has_batches THEN
      -- Use the explicitly selected batch first, then the nearest-expiry
      -- batches if that batch alone does not cover the delivered quantity.
      IF v_batch_number IS NOT NULL THEN
        EXECUTE 'SELECT id, quantity FROM public.supplier_catalog_batches
                  WHERE catalog_item_id = $1 AND lower(btrim(batch_number)) = lower(btrim($2))
                  FOR UPDATE'
          INTO v_batch_id, v_batch_quantity
          USING v_catalog_item_id, v_batch_number;
        IF v_batch_id IS NOT NULL AND v_batch_quantity > 0 THEN
          v_take := LEAST(v_remaining, v_batch_quantity);
          EXECUTE 'UPDATE public.supplier_catalog_batches
                      SET quantity = GREATEST(quantity - $2, 0)
                    WHERE id = $1'
            USING v_batch_id, v_take;
          v_remaining := v_remaining - v_take;
        END IF;
      ELSE
        v_batch_id := NULL;
      END IF;

      FOR v_batch IN EXECUTE
        'SELECT id, quantity
           FROM public.supplier_catalog_batches
          WHERE catalog_item_id = $1 AND quantity > 0
            AND ($2::UUID IS NULL OR id <> $2)
          ORDER BY expiry_date ASC, created_at ASC, id ASC
          FOR UPDATE'
        USING v_catalog_item_id, v_batch_id
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_remaining, v_batch.quantity);
        EXECUTE 'UPDATE public.supplier_catalog_batches
                    SET quantity = GREATEST(quantity - $2, 0)
                  WHERE id = $1'
          USING v_batch.id, v_take;
        v_remaining := v_remaining - v_take;
      END LOOP;
    END IF;

    -- Keep the catalog item's aggregate stock value in sync as well as the
    -- batch rows (the catalog uses this value when no batches are configured).
    UPDATE public.supplier_catalog_items
       SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_quantity, 0)
     WHERE id = v_catalog_item_id;
  END LOOP;

  UPDATE public.purchase_orders
     SET supplier_delivery_confirmed_at = NOW(),
         supplier_delivery_confirmed_by = auth.uid(),
         transport_status = 'delivered',
         delivered_date = COALESCE(delivered_date, NOW()),
         updated_at = NOW()
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_id', p_order_id,
    'supplier_delivery_confirmed_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_supplier_order_delivery(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_supplier_order_delivery(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
