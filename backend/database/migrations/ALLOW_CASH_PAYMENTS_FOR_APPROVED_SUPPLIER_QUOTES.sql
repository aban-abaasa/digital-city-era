-- Allow an accepted supplier quote to be paid in cash. Cash payments stay
-- pending until the supplier confirms receipt; wallet payments retain the
-- business-wallet administrator PIN approval flow.

CREATE OR REPLACE FUNCTION public.guard_supplier_quote_order_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.purchase_orders;
BEGIN
  SELECT * INTO v_order
    FROM public.purchase_orders
   WHERE id = NEW.purchase_order_id;

  IF v_order.supplier_quote_status <> 'not_requested' THEN
    IF v_order.supplier_quote_status <> 'accepted' THEN
      RAISE EXCEPTION 'Manager approval of the supplier proposal is required before payment';
    END IF;

    IF NEW.payment_method = 'cash' THEN
      NEW.payment_status := 'pending';
      NEW.confirmed_by_supplier := FALSE;
      NEW.confirmation_date := NULL;
    ELSIF NEW.payment_method <> 'ican_business_wallet' THEN
      RAISE EXCEPTION 'Quote-based supplier orders accept cash or business-wallet payments';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
