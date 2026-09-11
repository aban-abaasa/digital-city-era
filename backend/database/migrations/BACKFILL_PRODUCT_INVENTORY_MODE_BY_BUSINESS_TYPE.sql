-- ============================================================================
-- FIX: existing products don't agree with their store's business type.
--
-- AddProductModal.jsx used to always create products with
-- inventory_mode = 'stock_controlled', regardless of business type, even
-- though both inventorySupabaseService.js's createProduct() fallback and
-- this migration's own validate_pharmacy_product() trigger already know
-- laundry stores should default new services to 'service_item' (the cashier
-- POS only shows the job-status/bill-later/invoice step for
-- inventoryMode === 'service_item' — see cashier portal.jsx's hasServiceItem).
-- That default only ever applied to brand-new rows anyway, so every laundry
-- product created before the AddProductModal.jsx fix is stuck as a plain
-- stock item.
--
-- This migration:
--   1. Backfills existing products that are still sitting on the generic
--      'stock_controlled' default so they match what their store's business
--      type should have produced (laundry -> service_item,
--      restaurant_cafe -> listing_only). It intentionally only touches rows
--      still at that generic default — a product an owner has deliberately
--      set to 'batch_controlled' (pharmacy) or left as 'stock_controlled'
--      on purpose (e.g. detergent stock inside a laundry shop) is left alone.
--   2. Teaches validate_pharmacy_product() the same laundry rule so any
--      future insert/update that leaves inventory_mode NULL (the trigger's
--      safety net) also lands on 'service_item' for laundry stores, instead
--      of silently falling through to 'stock_controlled'.
-- ============================================================================

UPDATE public.products p
SET inventory_mode = 'service_item',
    track_inventory = FALSE,
    updated_at = now()
FROM public.supermarkets s
WHERE s.id = p.supermarket_id
  AND s.business_type = 'laundry'
  AND p.inventory_mode = 'stock_controlled';

UPDATE public.products p
SET inventory_mode = 'listing_only',
    track_inventory = FALSE,
    updated_at = now()
FROM public.supermarkets s
WHERE s.id = p.supermarket_id
  AND s.business_type = 'restaurant_cafe'
  AND p.inventory_mode = 'stock_controlled';

CREATE OR REPLACE FUNCTION public.validate_pharmacy_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_type TEXT;
BEGIN
  SELECT business_type INTO v_business_type
  FROM public.supermarkets
  WHERE id = NEW.supermarket_id;

  IF v_business_type = 'restaurant_cafe' THEN
    NEW.inventory_mode := COALESCE(NEW.inventory_mode, 'listing_only');
  END IF;

  IF v_business_type = 'laundry' THEN
    NEW.inventory_mode := COALESCE(NEW.inventory_mode, 'service_item');
  END IF;

  IF NEW.inventory_mode IS NULL THEN
    NEW.inventory_mode := CASE
      WHEN NEW.is_service = TRUE OR NEW.track_inventory = FALSE THEN 'service_item'
      WHEN v_business_type = 'restaurant_cafe' THEN 'listing_only'
      WHEN v_business_type = 'laundry' THEN 'service_item'
      WHEN v_business_type = 'pharmacy' THEN 'stock_controlled'
      ELSE 'stock_controlled'
    END;
  END IF;

  IF v_business_type = 'pharmacy'
     AND (NEW.controlled_medicine = TRUE OR NEW.prescription_required = TRUE)
     AND NOT public.supermarketa_can_manage_pharmacy() THEN
    RAISE EXCEPTION 'Only an authorized pharmacy user can manage controlled or prescription products';
  END IF;

  IF v_business_type <> 'pharmacy' THEN
    NEW.controlled_medicine := FALSE;
    NEW.prescription_required := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Existing laundry/restaurant_cafe products backfilled to their business type''s inventory mode; validate_pharmacy_product() now defaults laundry to service_item.';
END $$;
