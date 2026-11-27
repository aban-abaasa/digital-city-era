-- Do not expose an approved supplier order as active store stock until the
-- assigned supplier confirms that the goods reached the store.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_delivery_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_delivery_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS transport_status TEXT DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS delivered_date TIMESTAMPTZ;

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

  -- Supplier company teammates can confirm for the assigned business profile
  -- when that membership helper is installed.
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

CREATE OR REPLACE FUNCTION public.require_supplier_delivery_confirmation_before_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_allowed BOOLEAN := FALSE;
BEGIN
  IF NEW.supplier_delivery_confirmed_at IS DISTINCT FROM OLD.supplier_delivery_confirmed_at
     OR NEW.supplier_delivery_confirmed_by IS DISTINCT FROM OLD.supplier_delivery_confirmed_by THEN
    IF OLD.supplier_delivery_confirmed_at IS NOT NULL
       AND NEW.supplier_delivery_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Supplier delivery confirmation cannot be removed.';
    END IF;

    IF NEW.supplier_delivery_confirmed_at IS NOT NULL THEN
      IF auth.uid() IS NULL OR NEW.supplier_delivery_confirmed_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned supplier can confirm delivery.';
      END IF;

      SELECT id INTO v_user_id
        FROM public.users
       WHERE auth_id = auth.uid() OR id = auth.uid()
       ORDER BY CASE WHEN auth_id = auth.uid() THEN 0 ELSE 1 END
       LIMIT 1;

      SELECT EXISTS (
        SELECT 1
          FROM public.users u
         WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
           AND (u.id = NEW.supplier_id OR u.auth_id = NEW.supplier_id)
      ) OR EXISTS (
        SELECT 1
          FROM public.business_profiles bp
         WHERE bp.id = NEW.supplier_business_profile_id
           AND bp.user_id IN (auth.uid(), v_user_id)
      ) INTO v_allowed;

      IF NOT v_allowed
         AND NEW.supplier_business_profile_id IS NOT NULL
         AND to_regprocedure('public.unified_business_member(uuid)') IS NOT NULL THEN
        EXECUTE 'SELECT public.unified_business_member($1)'
           INTO v_allowed
          USING NEW.supplier_business_profile_id;
      END IF;

      IF NOT v_allowed THEN
        RAISE EXCEPTION 'Only the supplier assigned to this order can confirm its delivery.';
      END IF;
      IF NEW.status <> 'confirmed'
         OR COALESCE(NEW.delivery_method, '') NOT IN (
           'supplier_delivery', 'supplier_own_delivery', 'mybodaguy_delivery', 'supermarket_pickup'
         ) THEN
        RAISE EXCEPTION 'Accept the order and choose a delivery method before confirming delivery.';
      END IF;
    END IF;
  END IF;

  IF OLD.status IS DISTINCT FROM 'received'
     AND NEW.status = 'received'
     AND (OLD.status <> 'confirmed' OR NEW.supplier_delivery_confirmed_at IS NULL) THEN
    RAISE EXCEPTION 'The supplier must confirm the order and its delivery before the store can receive it into POS.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_supplier_delivery_confirmation_before_receipt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_supplier_delivery_confirmation_before_receipt() TO authenticated;

DROP TRIGGER IF EXISTS po_require_supplier_delivery_confirmation ON public.purchase_orders;
CREATE TRIGGER po_require_supplier_delivery_confirmation
  BEFORE UPDATE OF status, supplier_delivery_confirmed_at, supplier_delivery_confirmed_by ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.require_supplier_delivery_confirmation_before_receipt();

NOTIFY pgrst, 'reload schema';
