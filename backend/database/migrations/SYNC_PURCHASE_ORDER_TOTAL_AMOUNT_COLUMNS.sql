-- Keep the legacy total_amount column and the newer total_amount_ugx field
-- aligned. Quote approval writes total_amount, while older payment flows and
-- some screens read total_amount_ugx.
-- Run after ADD_PURCHASE_ORDERS_COLUMNS.sql and ADD_SUPPLIER_PURCHASE_ORDER_QUOTES.sql.

UPDATE public.purchase_orders
   SET total_amount = COALESCE(NULLIF(total_amount, 0), NULLIF(total_amount_ugx, 0), 0),
       total_amount_ugx = COALESCE(NULLIF(total_amount, 0), NULLIF(total_amount_ugx, 0), 0)
 WHERE total_amount IS DISTINCT FROM total_amount_ugx;

CREATE OR REPLACE FUNCTION public.sync_purchase_order_total_amount_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total_changed BOOLEAN;
  v_total_ugx_changed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.total_amount := COALESCE(NULLIF(NEW.total_amount, 0), NULLIF(NEW.total_amount_ugx, 0), 0);
    NEW.total_amount_ugx := NEW.total_amount;
    RETURN NEW;
  END IF;

  v_total_changed := NEW.total_amount IS DISTINCT FROM OLD.total_amount;
  v_total_ugx_changed := NEW.total_amount_ugx IS DISTINCT FROM OLD.total_amount_ugx;

  IF v_total_changed AND NOT v_total_ugx_changed THEN
    NEW.total_amount_ugx := COALESCE(NEW.total_amount, 0);
  ELSIF v_total_ugx_changed AND NOT v_total_changed THEN
    NEW.total_amount := COALESCE(NEW.total_amount_ugx, 0);
  ELSIF v_total_changed AND v_total_ugx_changed THEN
    -- total_amount is the canonical amount when a caller changes both fields.
    NEW.total_amount_ugx := COALESCE(NEW.total_amount, 0);
  ELSIF COALESCE(NEW.total_amount, 0) = 0 AND COALESCE(NEW.total_amount_ugx, 0) > 0 THEN
    NEW.total_amount := NEW.total_amount_ugx;
  ELSIF COALESCE(NEW.total_amount_ugx, 0) = 0 AND COALESCE(NEW.total_amount, 0) > 0 THEN
    NEW.total_amount_ugx := NEW.total_amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_purchase_order_total_amount_columns ON public.purchase_orders;
CREATE TRIGGER sync_purchase_order_total_amount_columns
BEFORE INSERT OR UPDATE OF total_amount, total_amount_ugx
ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_purchase_order_total_amount_columns();

NOTIFY pgrst, 'reload schema';
