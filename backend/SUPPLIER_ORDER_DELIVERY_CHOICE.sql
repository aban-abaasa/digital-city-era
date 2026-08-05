-- Supplier-owned order identity and mandatory manual delivery choice.
-- Run after ADD_PURCHASE_ORDERS_COLUMNS.sql and the supplier/authority SQL.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supermarket_id UUID REFERENCES public.supermarkets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_business_profile_id UUID
    REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS delivery_selected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_selected_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_delivery_method_check;
  ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_delivery_method_check
    CHECK (delivery_method IS NULL OR delivery_method IN (
      'supplier_delivery', 'mybodaguy_delivery', 'supermarket_pickup'
    ));
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_business
  ON public.purchase_orders(supplier_business_profile_id)
  WHERE supplier_business_profile_id IS NOT NULL;

-- No order may be completed/received/fulfilled without an explicit delivery
-- choice.  This keeps delivery from being silently auto-selected.
CREATE OR REPLACE FUNCTION public.enforce_supplier_order_delivery_choice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('received', 'completed', 'fulfilled')
     AND NULLIF(trim(NEW.delivery_method), '') IS NULL THEN
    RAISE EXCEPTION 'Choose a delivery method before completing this supplier order';
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.delivery_method IS DISTINCT FROM OLD.delivery_method
     AND NEW.delivery_method IS NOT NULL THEN
    NEW.delivery_selected_by := COALESCE(NEW.delivery_selected_by, auth.uid());
    NEW.delivery_selected_at := COALESCE(NEW.delivery_selected_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_orders_delivery_choice ON public.purchase_orders;
CREATE TRIGGER purchase_orders_delivery_choice
  BEFORE INSERT OR UPDATE OF status, delivery_method ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_supplier_order_delivery_choice();

-- The supplier can complete its own order, but the supermarket still controls
-- receipt/inventory.  The selected delivery method is returned for dispatch.
CREATE OR REPLACE FUNCTION public.complete_supplier_order(
  p_order_id UUID,
  p_delivery_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.purchase_orders;
BEGIN
  IF p_delivery_method NOT IN ('supplier_delivery', 'mybodaguy_delivery', 'supermarket_pickup') THEN
    RAISE EXCEPTION 'Select supplier delivery, MyBodaGuy delivery, or supermarket pickup';
  END IF;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier order not found'; END IF;

  IF v_order.supplier_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.supermarkets sm
       WHERE sm.id = v_order.supermarket_id AND sm.owner_user_id = auth.uid()
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.supermarket_staff ss
       WHERE ss.supermarket_id = v_order.supermarket_id
         AND ss.user_id = auth.uid() AND ss.role = 'manager' AND ss.status = 'active'
     ) THEN
    RAISE EXCEPTION 'You cannot complete this supplier order';
  END IF;

  UPDATE public.purchase_orders
     SET status = 'received', delivery_method = p_delivery_method,
         delivery_selected_by = auth.uid(), delivery_selected_at = now(),
         delivered_date = COALESCE(delivered_date, now()), updated_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id,
                            'status', 'received', 'delivery_method', p_delivery_method);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_supplier_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_supplier_order(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
