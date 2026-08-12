-- Supermartkera supplier orders are paid only from the linked store wallet.
-- Run after SUPPLIER_ORDER_DELIVERY_CHOICE.sql and shared
-- ICAN_BUSINESS_WALLET_TRANSFERS.sql.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS wallet_transaction_id UUID
    REFERENCES public.ican_business_wallet_transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_wallet_transaction
  ON public.purchase_orders(wallet_transaction_id)
  WHERE wallet_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.supermarketa_request_supplier_order_payment(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_order public.purchase_orders;
  v_store_business_id UUID;
  v_due_ugx NUMERIC;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_order.supplier_business_profile_id IS NULL THEN RAISE EXCEPTION 'Supplier business wallet is not linked'; END IF;
  IF v_order.wallet_transaction_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'status', 'already_requested', 'transaction_id', v_order.wallet_transaction_id);
  END IF;
  SELECT pichin_business_profile_id INTO v_store_business_id FROM public.supermarkets WHERE id = v_order.supermarket_id;
  IF v_store_business_id IS NULL THEN RAISE EXCEPTION 'Supermarket business wallet is not linked'; END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_order.manager_id AND (u.auth_id = auth.uid() OR u.id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.supermarkets sm WHERE sm.id = v_order.supermarket_id AND sm.owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.supermarket_staff ss WHERE ss.supermarket_id = v_order.supermarket_id AND ss.user_id = auth.uid() AND ss.role IN ('manager', 'admin') AND ss.status = 'active')
  ) THEN RAISE EXCEPTION 'Only the assigned store manager or administrator can request payment'; END IF;
  IF v_order.status NOT IN ('approved', 'sent_to_supplier', 'confirmed', 'received') THEN RAISE EXCEPTION 'Approve the order before requesting supplier payment'; END IF;
  v_due_ugx := GREATEST(coalesce(v_order.total_amount, v_order.total_amount_ugx, 0) - coalesce(v_order.amount_paid_ugx, 0), 0);
  IF v_due_ugx <= 0 THEN RAISE EXCEPTION 'No balance is due on this order'; END IF;
  v_result := public.pitchin_business_wallet_transfer_to_business(
    v_store_business_id, v_order.supplier_business_profile_id, round(v_due_ugx / 5000, 8),
    'Supermartkera purchase order ' || coalesce(v_order.po_number, v_order.id::TEXT), v_order.id::TEXT, NULL);
  UPDATE public.purchase_orders SET wallet_transaction_id = (v_result ->> 'transaction_id')::UUID,
    payment_status = 'pending_approval', updated_at = now() WHERE id = v_order.id;
  RETURN v_result || jsonb_build_object('order_id', v_order.id, 'amount_ugx', v_due_ugx);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_supermarketa_order_wallet_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.purchase_orders SET
    payment_status = CASE WHEN NEW.status = 'completed' THEN 'paid' WHEN NEW.status = 'rejected' THEN 'rejected' ELSE payment_status END,
    amount_paid_ugx = CASE WHEN NEW.status = 'completed' THEN coalesce(total_amount, total_amount_ugx, 0) ELSE amount_paid_ugx END,
    balance_due_ugx = CASE WHEN NEW.status = 'completed' THEN 0 ELSE balance_due_ugx END,
    last_payment_date = CASE WHEN NEW.status = 'completed' THEN coalesce(NEW.executed_at, now()) ELSE last_payment_date END,
    updated_at = now()
  WHERE wallet_transaction_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supermarketa_order_wallet_payment_sync ON public.ican_business_wallet_transactions;
CREATE TRIGGER supermarketa_order_wallet_payment_sync
AFTER UPDATE OF status ON public.ican_business_wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_supermarketa_order_wallet_payment();

REVOKE ALL ON FUNCTION public.supermarketa_request_supplier_order_payment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supermarketa_request_supplier_order_payment(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
