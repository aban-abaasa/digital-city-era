-- ============================================================
-- SUPPLIER CATALOG: BATCHES WITH EXPIRY DATES + DYNAMIC DISCOUNTS (ADD-ONLY)
-- ============================================================
-- A supplier can list several batches of the same catalog item, each with its
-- own quantity and expiry date, and can change a batch's expiry date at any
-- time (re-test, relabel, extended shelf life).
--
-- Discounts are DYNAMIC: nothing about the discount is stored by default.
--   discount_mode = 'auto'   -> the percentage is worked out from the days left
--                               every time it is read (see the schedule in
--                               frontend/src/utils/supplierBatchExpiry.js), so
--                               it deepens by itself as the batch approaches
--                               its date.
--   discount_mode = 'manual' -> the supplier pins a percentage (1-90).
--   discount_mode = 'none'   -> never discounted.
-- Changing expiry_date never needs the discount to be re-published.
--
-- Access follows the catalog item: whoever can manage the item (the owning
-- supplier or a member of its business) manages its batches; anyone who can
-- see an available item can see its batches, so supermarkets ordering from
-- the catalog see the live discounted price.
--
-- Safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.supplier_catalog_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES public.supplier_catalog_items(id) ON DELETE CASCADE,
  batch_number    TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  expiry_date     DATE NOT NULL,
  discount_mode   TEXT NOT NULL DEFAULT 'auto' CHECK (discount_mode IN ('auto', 'manual', 'none')),
  discount_percent NUMERIC(5, 2) CHECK (discount_percent IS NULL OR (discount_percent >= 1 AND discount_percent <= 90)),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_item_id, batch_number),
  CHECK (discount_mode <> 'manual' OR discount_percent IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_batches_item
  ON public.supplier_catalog_batches(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_batches_expiry
  ON public.supplier_catalog_batches(expiry_date);

CREATE OR REPLACE FUNCTION public.touch_supplier_catalog_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_supplier_catalog_batch ON public.supplier_catalog_batches;
CREATE TRIGGER trg_touch_supplier_catalog_batch
  BEFORE UPDATE ON public.supplier_catalog_batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_supplier_catalog_batch();

ALTER TABLE public.supplier_catalog_batches ENABLE ROW LEVEL SECURITY;

-- Read: exactly the people who can already read the parent item (RLS on
-- supplier_catalog_items applies inside the subquery).
DROP POLICY IF EXISTS supplier_batches_read ON public.supplier_catalog_batches;
CREATE POLICY supplier_batches_read
  ON public.supplier_catalog_batches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_catalog_items i WHERE i.id = catalog_item_id
  ));

-- Write: the owning supplier, or an admin of the supplier's business.
DROP POLICY IF EXISTS supplier_batches_write ON public.supplier_catalog_batches;
CREATE POLICY supplier_batches_write
  ON public.supplier_catalog_batches FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supplier_catalog_items i
    WHERE i.id = catalog_item_id
      AND (i.supplier_user_id = auth.uid()
           OR public.supplier_business_admin(i.supplier_business_profile_id, i.supplier_user_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.supplier_catalog_items i
    WHERE i.id = catalog_item_id
      AND (i.supplier_user_id = auth.uid()
           OR public.supplier_business_admin(i.supplier_business_profile_id, i.supplier_user_id))
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_catalog_batches TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'supplier_catalog_batches ready' AS status;
