-- Supermartkera supplier orders are paid only from the linked store wallet.
-- ICAN conversion uses the store owner's live local-currency price; it is not
-- fixed to UGX and supports every country configured in ICAN currency rates.
-- Run after SUPPLIER_ORDER_DELIVERY_CHOICE.sql and shared
-- ICAN_BUSINESS_WALLET_TRANSFERS.sql.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS wallet_transaction_id UUID
    REFERENCES public.ican_business_wallet_transactions(id) ON DELETE SET NULL;

-- The original purchase-order check allowed only unpaid/partially_paid/paid.
-- Wallet requests also have pending-approval and rejected states.
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_payment_status_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'partially_paid', 'pending_approval', 'paid', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_wallet_transaction
  ON public.purchase_orders(wallet_transaction_id)
  WHERE wallet_transaction_id IS NOT NULL;

-- A purchase order only keeps the *current* approval request.  Keep a
-- permanent, one-row-per-wallet-transfer register as well so that a rejected
-- retry or a later partial payment cannot erase the manager's financial trail.
CREATE TABLE IF NOT EXISTS public.supermarketa_wallet_payment_audit (
  wallet_transaction_id UUID PRIMARY KEY
    REFERENCES public.ican_business_wallet_transactions(id) ON DELETE RESTRICT,
  purchase_order_id UUID NOT NULL
    REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  initiated_by UUID,
  approved_by UUID,
  amount_local NUMERIC(18,2) NOT NULL CHECK (amount_local > 0),
  currency_code TEXT NOT NULL,
  ican_amount NUMERIC(24,8) NOT NULL CHECK (ican_amount > 0),
  ican_price_local NUMERIC(24,8) NOT NULL CHECK (ican_price_local > 0),
  status TEXT NOT NULL DEFAULT 'pending_approval',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supermarketa_wallet_payment_audit_order
  ON public.supermarketa_wallet_payment_audit(purchase_order_id, requested_at DESC);

-- Keeps the payment register idempotent even when a wallet status update is
-- delivered more than once by a trigger/retry.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_ican_wallet_reference
  ON public.payment_transactions(payment_reference)
  WHERE payment_method = 'ican_business_wallet' AND payment_reference IS NOT NULL;

DROP FUNCTION IF EXISTS public.supermarketa_request_supplier_order_payment(UUID);
CREATE OR REPLACE FUNCTION public.supermarketa_request_supplier_order_payment(
  p_order_id UUID,
  p_amount_ugx NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_order public.purchase_orders;
  v_store_business_id UUID;
  v_due_ugx NUMERIC;
  v_ican_price_ugx NUMERIC;
  v_currency_code TEXT;
  v_result JSONB;
  v_existing_wallet_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_order.supplier_business_profile_id IS NULL THEN RAISE EXCEPTION 'Supplier business wallet is not linked'; END IF;
  IF v_order.wallet_transaction_id IS NOT NULL THEN
    SELECT status INTO v_existing_wallet_status
      FROM public.ican_business_wallet_transactions WHERE id = v_order.wallet_transaction_id;
    IF v_existing_wallet_status = 'rejected' THEN
      -- A rejected request (for example, insufficient balance) may be retried
      -- with a smaller manager-entered Add Payment amount.
      UPDATE public.purchase_orders
         SET wallet_transaction_id = NULL, payment_status = 'unpaid', updated_at = now()
       WHERE id = v_order.id;
      v_order.wallet_transaction_id := NULL;
    ELSE
      RETURN jsonb_build_object('success', TRUE, 'status', 'already_requested', 'transaction_id', v_order.wallet_transaction_id);
    END IF;
  END IF;
  SELECT pichin_business_profile_id INTO v_store_business_id FROM public.supermarkets WHERE id = v_order.supermarket_id;
  IF v_store_business_id IS NULL THEN RAISE EXCEPTION 'Supermarket business wallet is not linked'; END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_order.manager_id AND (u.auth_id = auth.uid() OR u.id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.supermarkets sm WHERE sm.id = v_order.supermarket_id AND sm.owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.supermarket_staff ss WHERE ss.supermarket_id = v_order.supermarket_id AND ss.user_id = auth.uid() AND ss.role IN ('manager', 'admin') AND ss.status = 'active')
  ) THEN RAISE EXCEPTION 'Only the assigned store manager or administrator can request payment'; END IF;
  -- A manager can submit a new PO directly for wallet-admin approval. The
  -- admin's PIN approval completes payment and advances this PO to approved.
  IF v_order.status NOT IN ('pending_approval', 'approved', 'sent_to_supplier', 'confirmed', 'received') THEN RAISE EXCEPTION 'This purchase order cannot be submitted for wallet approval in its current status'; END IF;
  v_due_ugx := GREATEST(coalesce(v_order.total_amount, v_order.total_amount_ugx, 0) - coalesce(v_order.amount_paid_ugx, 0), 0);
  IF p_amount_ugx IS NOT NULL THEN
    IF p_amount_ugx <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;
    IF p_amount_ugx > v_due_ugx THEN RAISE EXCEPTION 'Payment amount exceeds the outstanding order balance'; END IF;
    v_due_ugx := p_amount_ugx;
  END IF;
  IF v_due_ugx <= 0 THEN RAISE EXCEPTION 'No balance is due on this order'; END IF;
  -- Resolve the linked business owner's configured local currency, then use
  -- its live ICAN price. Existing Supermarketa amount columns retain their
  -- legacy *_ugx names, but are treated here as the order's local amount.
  SELECT wd.currency_code INTO v_currency_code
    FROM public.business_profiles bp
    CROSS JOIN LATERAL public.ican_get_user_wallet_display(bp.user_id) wd
   WHERE bp.id = v_store_business_id
   LIMIT 1;
  v_currency_code := COALESCE(NULLIF(UPPER(v_currency_code), ''), 'USD');
  SELECT price_local INTO v_ican_price_ugx
    FROM public.ican_get_price_in_currency(v_currency_code::VARCHAR(3))
   LIMIT 1;
  IF v_ican_price_ugx IS NULL OR v_ican_price_ugx <= 0 THEN
    RAISE EXCEPTION 'Live ICAN price is unavailable for %; payment request was not created', v_currency_code;
  END IF;
  v_result := public.pitchin_business_wallet_transfer_to_business(
    v_store_business_id, v_order.supplier_business_profile_id, round(v_due_ugx / v_ican_price_ugx, 8),
    'Supermartkera purchase order ' || coalesce(v_order.po_number, v_order.id::TEXT), v_order.id::TEXT, NULL);
  INSERT INTO public.supermarketa_wallet_payment_audit
    (wallet_transaction_id, purchase_order_id, initiated_by, amount_local,
     currency_code, ican_amount, ican_price_local)
  VALUES
    ((v_result ->> 'transaction_id')::UUID, v_order.id, auth.uid(), v_due_ugx,
     v_currency_code, round(v_due_ugx / v_ican_price_ugx, 8), v_ican_price_ugx);

  UPDATE public.purchase_orders SET wallet_transaction_id = (v_result ->> 'transaction_id')::UUID,
    payment_status = 'pending_approval', updated_at = now() WHERE id = v_order.id;
  RETURN v_result || jsonb_build_object(
    'order_id', v_order.id, 'amount_local', v_due_ugx,
    'currency_code', v_currency_code, 'ican_price_local', v_ican_price_ugx
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_supermarketa_order_wallet_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_audit public.supermarketa_wallet_payment_audit;
  v_order public.purchase_orders;
  v_new_paid NUMERIC;
  v_total NUMERIC;
BEGIN
  SELECT * INTO v_audit
    FROM public.supermarketa_wallet_payment_audit
   WHERE wallet_transaction_id = NEW.id
   FOR UPDATE;
  -- This trigger also observes non-Supermarketa business payments.  Those
  -- payments have no PO audit row and must remain untouched here.
  IF v_audit.wallet_transaction_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.supermarketa_wallet_payment_audit
     SET status = NEW.status,
         approved_by = CASE WHEN NEW.status = 'completed' THEN auth.uid() ELSE approved_by END,
         approved_at = CASE WHEN NEW.status = 'completed' THEN COALESCE(approved_at, now()) ELSE approved_at END,
         executed_at = CASE WHEN NEW.status = 'completed' THEN COALESCE(NEW.executed_at, now()) ELSE executed_at END,
         rejected_at = CASE WHEN NEW.status = 'rejected' THEN COALESCE(rejected_at, now()) ELSE rejected_at END,
         updated_at = now()
   WHERE wallet_transaction_id = NEW.id;

  SELECT * INTO v_order FROM public.purchase_orders
   WHERE id = v_audit.purchase_order_id FOR UPDATE;
  IF NEW.status = 'completed' THEN
    -- Financial Reports read payment_transactions.  Writing this receipt in
    -- the same transaction as the wallet status makes a delivered ICAN
    -- payment visible in Today's/Recent transactions without charging twice.
    INSERT INTO public.payment_transactions
      (purchase_order_id, user_id, recorded_by, amount_ugx, payment_method,
       payment_status, payment_reference, transaction_ref, transaction_number,
       payment_date, confirmed_by_supplier, confirmation_date, confirmation_notes, notes)
    VALUES
      (v_order.id, v_order.manager_id, v_order.manager_id, v_audit.amount_local,
       'ican_business_wallet', 'confirmed', NEW.id::TEXT, NEW.id::TEXT,
       'ICAN-BIZ-' || NEW.id::TEXT, COALESCE(NEW.executed_at, now()), TRUE,
       COALESCE(NEW.executed_at, now()),
       'Delivered to supplier business ICAN wallet after PIN approval.',
       'ICAN business-wallet supplier payment (' || v_audit.currency_code || ')')
    ON CONFLICT (payment_reference) WHERE payment_method = 'ican_business_wallet'
    DO NOTHING;

    v_total := COALESCE(v_order.total_amount, v_order.total_amount_ugx, 0);
    v_new_paid := LEAST(v_total, COALESCE(v_order.amount_paid_ugx, 0) + v_audit.amount_local);
    UPDATE public.purchase_orders SET
      status = CASE WHEN status = 'pending_approval' THEN 'approved' ELSE status END,
      payment_status = CASE WHEN v_new_paid >= v_total THEN 'paid' ELSE 'partially_paid' END,
      amount_paid_ugx = v_new_paid,
      balance_due_ugx = GREATEST(v_total - v_new_paid, 0),
      last_payment_date = COALESCE(NEW.executed_at, now()),
      -- Clear the completed request so a remaining balance can be submitted.
      wallet_transaction_id = NULL,
      updated_at = now()
    WHERE id = v_order.id;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.purchase_orders SET
      payment_status = 'rejected', updated_at = now()
    WHERE id = v_order.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supermarketa_order_wallet_payment_sync ON public.ican_business_wallet_transactions;
CREATE TRIGGER supermarketa_order_wallet_payment_sync
AFTER UPDATE OF status ON public.ican_business_wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_supermarketa_order_wallet_payment();

REVOKE ALL ON FUNCTION public.supermarketa_request_supplier_order_payment(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supermarketa_request_supplier_order_payment(UUID, NUMERIC) TO authenticated;
NOTIFY pgrst, 'reload schema';
