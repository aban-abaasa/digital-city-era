-- ============================================================================
-- FIX: switching a store's business type (Supermarket <-> Laundry <->
-- Restaurant/Cafe, in either direction) never updated its EXISTING products.
--
-- BACKFILL_PRODUCT_INVENTORY_MODE_BY_BUSINESS_TYPE.sql fixed this once, as a
-- one-time UPDATE, for stores that were already laundry/restaurant_cafe at
-- the time it ran. But UnifiedProfilePage.jsx's saveBusinessType() lets an
-- owner change business_type any time after onboarding, and every time that
-- happens the store's products are left exactly as they were:
--   - Supermarket -> Laundry: old products stay inventory_mode =
--     'stock_controlled', so the cashier POS (CushierPortal.jsx / cashier
--     portal.jsx, keyed off item.inventoryMode === 'service_item') still
--     rings them up as ordinary stock-tracked products, not services.
--   - Laundry -> Supermarket (switching back): the reverse — products stay
--     'service_item' and the POS keeps showing the job-status/bill-later
--     stepper for what is now supposed to be a plain product sale.
-- UnifiedProfilePage.jsx even claims in a comment that this is "safe to
-- change after onboarding without data loss" specifically *because* it only
-- affects new products — that assumption is what's wrong.
--
-- This migration makes the sync automatic and bidirectional:
--   1. default_inventory_mode_for_business_type() centralizes the
--      business_type -> inventory_mode mapping (previously duplicated inline
--      in inventorySupabaseService.js and validate_pharmacy_product()).
--   2. validate_pharmacy_product() is refactored to call it (same behavior,
--      one source of truth).
--   3. A new AFTER UPDATE OF business_type trigger on supermarkets calls
--      sync_products_inventory_mode_on_business_type_change(), which moves
--      every product still sitting on the OLD business type's default mode
--      onto the NEW one. Exactly like the original backfill, it only ever
--      touches rows that match the old default — a product an owner
--      deliberately set to something else (e.g. detergent stock kept
--      'stock_controlled' inside a laundry shop) is left alone.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.default_inventory_mode_for_business_type(p_business_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_business_type
    WHEN 'restaurant_cafe' THEN 'listing_only'
    WHEN 'laundry' THEN 'service_item'
    ELSE 'stock_controlled'
  END;
$$;

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

  IF v_business_type IN ('restaurant_cafe', 'laundry') THEN
    NEW.inventory_mode := COALESCE(NEW.inventory_mode, public.default_inventory_mode_for_business_type(v_business_type));
  END IF;

  IF NEW.inventory_mode IS NULL THEN
    NEW.inventory_mode := CASE
      WHEN NEW.is_service = TRUE OR NEW.track_inventory = FALSE THEN 'service_item'
      ELSE public.default_inventory_mode_for_business_type(v_business_type)
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

CREATE OR REPLACE FUNCTION public.sync_products_inventory_mode_on_business_type_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_default TEXT;
  v_new_default TEXT;
BEGIN
  IF NEW.business_type IS DISTINCT FROM OLD.business_type THEN
    v_old_default := public.default_inventory_mode_for_business_type(OLD.business_type);
    v_new_default := public.default_inventory_mode_for_business_type(NEW.business_type);

    IF v_old_default IS DISTINCT FROM v_new_default THEN
      UPDATE public.products
      SET inventory_mode = v_new_default,
          track_inventory = (v_new_default = 'stock_controlled'),
          updated_at = now()
      WHERE supermarket_id = NEW.id
        AND inventory_mode = v_old_default;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_products_inventory_mode_on_business_type_change_trigger ON public.supermarkets;
CREATE TRIGGER sync_products_inventory_mode_on_business_type_change_trigger
AFTER UPDATE OF business_type ON public.supermarkets
FOR EACH ROW
EXECUTE FUNCTION public.sync_products_inventory_mode_on_business_type_change();

-- One-time catch-up, forward direction only — a store that is now
-- laundry/restaurant_cafe but still has products on the plain
-- 'stock_controlled' default (the exact rows the original backfill
-- targeted; safe to re-run, idempotent on rows it already fixed). There is
-- deliberately no blind reverse sweep here: unlike the trigger above (which
-- compares a specific store's OLD vs NEW business_type on an actual change
-- event), a global "service_item/listing_only but store isn't
-- laundry/restaurant_cafe right now" scan can't tell a store that recently
-- switched away from laundry apart from, say, a boutique that always had a
-- deliberate hand-added service line item — so it would risk clobbering
-- genuine data. Any store still showing stale service/listing items from a
-- *past* business_type change (before this migration existed) needs that
-- one flip fixed by hand; every change from here on is handled exactly by
-- the trigger.
UPDATE public.products p
SET inventory_mode = 'service_item', track_inventory = FALSE, updated_at = now()
FROM public.supermarkets s
WHERE s.id = p.supermarket_id AND s.business_type = 'laundry' AND p.inventory_mode = 'stock_controlled';

UPDATE public.products p
SET inventory_mode = 'listing_only', track_inventory = FALSE, updated_at = now()
FROM public.supermarkets s
WHERE s.id = p.supermarket_id AND s.business_type = 'restaurant_cafe' AND p.inventory_mode = 'stock_controlled';

DO $$
BEGIN
  RAISE NOTICE '✅ Product inventory_mode now stays in sync automatically whenever a store''s business_type changes, in either direction.';
END $$;

NOTIFY pgrst, 'reload schema';
