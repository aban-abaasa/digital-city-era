-- Add the supplier's own transport as an explicit choice during confirmation.
-- Apply to existing databases before suppliers start selecting it.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS delivery_selected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_selected_at TIMESTAMPTZ;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_delivery_method_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_delivery_method_check
  CHECK (delivery_method IS NULL OR delivery_method IN (
    'supplier_delivery', 'supplier_own_delivery', 'mybodaguy_delivery', 'supermarket_pickup'
  ));

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
  IF p_delivery_method NOT IN ('supplier_delivery', 'supplier_own_delivery', 'mybodaguy_delivery', 'supermarket_pickup') THEN
    RAISE EXCEPTION 'Select supplier delivery, supplier own delivery, MyBodaGuy delivery, or supermarket pickup';
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
