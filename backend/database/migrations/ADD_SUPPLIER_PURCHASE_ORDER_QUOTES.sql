-- Supplier proposed supply lists for Supermarketa purchase orders.
-- Run this migration before enabling the Supplies tab.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_quote_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS supplier_quote_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supplier_quote_notes TEXT,
  ADD COLUMN IF NOT EXISTS supplier_quote_submitted_by UUID,
  ADD COLUMN IF NOT EXISTS supplier_quote_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_quote_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS supplier_quote_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS supplier_quote_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_supplier_quote_status_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_supplier_quote_status_check
  CHECK (supplier_quote_status IN (
    'not_requested', 'awaiting_supplier_quote', 'submitted', 'changes_requested', 'accepted'
  ));

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_quote_status
  ON public.purchase_orders(supplier_quote_status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.supplier_submit_purchase_order_quote_v1(
  p_order_id UUID,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_order public.purchase_orders;
  v_item JSONB;
  v_count INTEGER := 0;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id INTO v_user_id
    FROM public.users
   WHERE auth_id = auth.uid() OR id = auth.uid()
   ORDER BY CASE WHEN auth_id = auth.uid() THEN 0 ELSE 1 END
   LIMIT 1;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
         AND (u.id = v_order.supplier_id OR u.auth_id = v_order.supplier_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.business_profiles bp
       WHERE bp.id = v_order.supplier_business_profile_id
         AND bp.user_id IN (auth.uid(), v_user_id)
    )
  ) THEN RAISE EXCEPTION 'Only the supplier assigned to this order can submit a proposal'; END IF;
  IF v_order.supplier_quote_status NOT IN ('awaiting_supplier_quote', 'changes_requested') THEN
    RAISE EXCEPTION 'This order is not waiting for a supplier proposal';
  END IF;
  IF v_order.status IN ('cancelled', 'received', 'completed') OR v_order.wallet_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'This order can no longer be quoted';
  END IF;
  IF COALESCE(jsonb_typeof(p_items), '') <> 'array' THEN
    RAISE EXCEPTION 'Supply proposal must be a product list';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'Add between 1 and 100 products to the proposal';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_count := v_count + 1;
    IF COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'product_name', v_item->>'productName', v_item->>'name')), ''), '') = '' THEN
      RAISE EXCEPTION 'Every proposed product needs a name';
    END IF;
    IF COALESCE(NULLIF(COALESCE(v_item->>'quantity', v_item->>'qty'), '')::NUMERIC, 0) <= 0 THEN
      RAISE EXCEPTION 'Every proposed product needs a quantity above zero';
    END IF;
    IF COALESCE(NULLIF(COALESCE(v_item->>'unit_price', v_item->>'unitPrice', v_item->>'price'), '')::NUMERIC, -1) < 0 THEN
      RAISE EXCEPTION 'Every proposed product needs a valid unit price';
    END IF;
  END LOOP;

  UPDATE public.purchase_orders
     SET supplier_quote_items = p_items,
         supplier_quote_notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
         supplier_quote_status = 'submitted',
         supplier_quote_submitted_by = COALESCE(v_user_id, auth.uid()),
         supplier_quote_submitted_at = now(),
         supplier_quote_review_notes = NULL,
         supplier_quote_reviewed_by = NULL,
         supplier_quote_reviewed_at = NULL,
         updated_at = now()
   WHERE id = v_order.id;

  RETURN jsonb_build_object('success', TRUE, 'order_id', v_order.id, 'status', 'submitted', 'item_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_review_purchase_order_quote_v1(
  p_order_id UUID,
  p_decision TEXT,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_order public.purchase_orders;
  v_item JSONB;
  v_item_count INTEGER := 0;
  v_subtotal NUMERIC := 0;
  v_tax_rate NUMERIC := 18;
  v_tax_amount NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2) := 0;
  v_user_id UUID;
  v_decision TEXT := LOWER(BTRIM(COALESCE(p_decision, '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_decision NOT IN ('accepted', 'changes_requested') THEN
    RAISE EXCEPTION 'Choose approve or request changes';
  END IF;
  SELECT id INTO v_user_id
    FROM public.users
   WHERE auth_id = auth.uid() OR id = auth.uid()
   ORDER BY CASE WHEN auth_id = auth.uid() THEN 0 ELSE 1 END
   LIMIT 1;

  SELECT * INTO v_order FROM public.purchase_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF NOT (
    v_order.manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
         AND (u.role IN ('admin', 'superadmin')
              OR (u.supermarket_id = v_order.supermarket_id AND u.role IN ('manager', 'store_manager', 'admin')))
    )
    OR EXISTS (
      SELECT 1 FROM public.supermarkets sm
       WHERE sm.id = v_order.supermarket_id AND sm.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.supermarket_staff ss
       WHERE ss.supermarket_id = v_order.supermarket_id
         AND ss.user_id IN (auth.uid(), v_user_id)
         AND ss.role IN ('manager', 'admin') AND ss.status = 'active'
    )
  ) THEN RAISE EXCEPTION 'Only this store manager or administrator can review the proposal'; END IF;
  IF v_order.supplier_quote_status <> 'submitted' THEN
    RAISE EXCEPTION 'There is no submitted supplier proposal to review';
  END IF;

  IF v_decision = 'changes_requested' THEN
    UPDATE public.purchase_orders
       SET supplier_quote_status = 'changes_requested',
           supplier_quote_review_notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
           supplier_quote_reviewed_by = COALESCE(v_user_id, auth.uid()),
           supplier_quote_reviewed_at = now(),
           updated_at = now()
     WHERE id = v_order.id;
    RETURN jsonb_build_object('success', TRUE, 'order_id', v_order.id, 'status', 'changes_requested');
  END IF;

  IF COALESCE(jsonb_typeof(p_items), '') <> 'array' THEN
    RAISE EXCEPTION 'Final order must be a product list';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'The final order needs between 1 and 100 products';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_count := v_item_count + 1;
    IF COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'product_name', v_item->>'productName', v_item->>'name')), ''), '') = '' THEN
      RAISE EXCEPTION 'Every final product needs a name';
    END IF;
    IF COALESCE(NULLIF(COALESCE(v_item->>'quantity', v_item->>'qty'), '')::NUMERIC, 0) <= 0 THEN
      RAISE EXCEPTION 'Every final product needs a quantity above zero';
    END IF;
    IF COALESCE(NULLIF(COALESCE(v_item->>'unit_price', v_item->>'unitPrice', v_item->>'price'), '')::NUMERIC, -1) < 0 THEN
      RAISE EXCEPTION 'Every final product needs a valid unit price';
    END IF;
    v_subtotal := v_subtotal +
      (COALESCE(NULLIF(COALESCE(v_item->>'quantity', v_item->>'qty'), '')::NUMERIC, 0)
       * COALESCE(NULLIF(COALESCE(v_item->>'unit_price', v_item->>'unitPrice', v_item->>'price'), '')::NUMERIC, 0));
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);
  v_tax_rate := COALESCE(v_order.tax_rate, 18);
  v_tax_amount := ROUND(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax_amount;
  UPDATE public.purchase_orders
     SET items = p_items,
         subtotal = v_subtotal,
         tax_rate = v_tax_rate,
         tax_amount = v_tax_amount,
         total_amount = v_total,
         amount_paid_ugx = COALESCE(amount_paid_ugx, 0),
         balance_due_ugx = GREATEST(v_total - COALESCE(amount_paid_ugx, 0), 0),
         supplier_quote_status = 'accepted',
         supplier_quote_review_notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
         supplier_quote_reviewed_by = COALESCE(v_user_id, auth.uid()),
         supplier_quote_reviewed_at = now(),
         status = 'approved',
         approved_by = COALESCE(v_user_id, auth.uid()),
         approved_at = now(),
         updated_at = now()
   WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', TRUE, 'order_id', v_order.id, 'status', 'accepted',
    'item_count', v_item_count, 'subtotal', v_subtotal, 'tax_amount', v_tax_amount, 'total_amount', v_total
  );
END;
$$;

-- Authenticated users already have broad legacy purchase-order access. Guard
-- quote state and totals here so a supplier cannot approve their own proposal
-- or submit a payment without a manager's final approval.
CREATE OR REPLACE FUNCTION public.guard_supplier_quote_order_updates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_supplier_allowed BOOLEAN := FALSE;
  v_manager_allowed BOOLEAN := FALSE;
  v_supplier_submit BOOLEAN := FALSE;
  v_manager_review BOOLEAN := FALSE;
  v_quote_data_changed BOOLEAN := FALSE;
  v_order_items_changed BOOLEAN := FALSE;
  v_item JSONB;
  v_subtotal NUMERIC := 0;
  v_tax_amount NUMERIC(15,2) := 0;
  v_tax_rate NUMERIC := 18;
BEGIN
  -- Preserve the existing workflow for purchase orders created before quotes.
  IF OLD.supplier_quote_status = 'not_requested'
     AND NEW.supplier_quote_status = 'not_requested' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT id INTO v_user_id
    FROM public.users
   WHERE auth_id = auth.uid() OR id = auth.uid()
   ORDER BY CASE WHEN auth_id = auth.uid() THEN 0 ELSE 1 END
   LIMIT 1;

  v_supplier_allowed := (
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
         AND (u.id = OLD.supplier_id OR u.auth_id = OLD.supplier_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.business_profiles bp
       WHERE bp.id = OLD.supplier_business_profile_id
         AND bp.user_id IN (auth.uid(), v_user_id)
    )
  );
  v_manager_allowed := (
    OLD.manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
       WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
         AND (u.role IN ('admin', 'superadmin')
              OR (u.supermarket_id = OLD.supermarket_id AND u.role IN ('manager', 'store_manager', 'admin')))
    )
    OR EXISTS (
      SELECT 1 FROM public.supermarkets sm
       WHERE sm.id = OLD.supermarket_id AND sm.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.supermarket_staff ss
       WHERE ss.supermarket_id = OLD.supermarket_id
         AND ss.user_id IN (auth.uid(), v_user_id)
         AND ss.role IN ('manager', 'admin') AND ss.status = 'active'
    )
  );

  v_supplier_submit := v_supplier_allowed
    AND OLD.supplier_quote_status IN ('awaiting_supplier_quote', 'changes_requested')
    AND NEW.supplier_quote_status = 'submitted';
  v_manager_review := v_manager_allowed
    AND OLD.supplier_quote_status = 'submitted'
    AND NEW.supplier_quote_status IN ('accepted', 'changes_requested');
  v_quote_data_changed :=
    NEW.supplier_quote_items IS DISTINCT FROM OLD.supplier_quote_items
    OR NEW.supplier_quote_notes IS DISTINCT FROM OLD.supplier_quote_notes
    OR NEW.supplier_quote_submitted_by IS DISTINCT FROM OLD.supplier_quote_submitted_by
    OR NEW.supplier_quote_submitted_at IS DISTINCT FROM OLD.supplier_quote_submitted_at
    OR NEW.supplier_quote_review_notes IS DISTINCT FROM OLD.supplier_quote_review_notes
    OR NEW.supplier_quote_reviewed_by IS DISTINCT FROM OLD.supplier_quote_reviewed_by
    OR NEW.supplier_quote_reviewed_at IS DISTINCT FROM OLD.supplier_quote_reviewed_at;
  v_order_items_changed :=
    NEW.items IS DISTINCT FROM OLD.items
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate
    OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
    OR NEW.total_amount IS DISTINCT FROM OLD.total_amount;

  IF NEW.supplier_quote_status IS DISTINCT FROM OLD.supplier_quote_status THEN
    IF NOT v_supplier_submit AND NOT v_manager_review THEN
      RAISE EXCEPTION 'Only the assigned supplier may submit a proposal and only the store manager may review it';
    END IF;
  END IF;
  IF v_supplier_submit THEN
    IF COALESCE(jsonb_typeof(NEW.supplier_quote_items), '') <> 'array' THEN
      RAISE EXCEPTION 'Supply proposal must be a product list';
    END IF;
    IF jsonb_array_length(NEW.supplier_quote_items) < 1 THEN
      RAISE EXCEPTION 'Supply proposal must contain products';
    END IF;
  END IF;
  IF v_quote_data_changed AND NOT v_supplier_submit AND NOT v_manager_review THEN
    RAISE EXCEPTION 'Supplier proposal details can only change during an authorized submit or review';
  END IF;
  IF v_order_items_changed THEN
    IF NOT (v_manager_review AND NEW.supplier_quote_status = 'accepted') THEN
      RAISE EXCEPTION 'The final order items and total are locked until manager quote approval';
    END IF;
  END IF;

  IF NEW.supplier_quote_status = 'accepted' AND OLD.supplier_quote_status IS DISTINCT FROM 'accepted' THEN
    IF NOT v_manager_review OR NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'A store manager must approve the final supply list';
    END IF;
    IF COALESCE(jsonb_typeof(NEW.items), '') <> 'array' THEN
      RAISE EXCEPTION 'The approved supply list must contain products';
    END IF;
    IF jsonb_array_length(NEW.items) < 1 THEN
      RAISE EXCEPTION 'The approved supply list must contain products';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items)
    LOOP
      v_subtotal := v_subtotal
        + COALESCE(NULLIF(COALESCE(v_item->>'quantity', v_item->>'qty'), '')::NUMERIC, 0)
        * COALESCE(NULLIF(COALESCE(v_item->>'unit_price', v_item->>'unitPrice', v_item->>'price'), '')::NUMERIC, 0);
    END LOOP;
    v_subtotal := ROUND(v_subtotal, 2);
    v_tax_rate := COALESCE(NEW.tax_rate, 18);
    v_tax_amount := ROUND(v_subtotal * v_tax_rate / 100, 2);
    IF NEW.subtotal IS DISTINCT FROM ROUND(v_subtotal, 2)
       OR NEW.tax_amount IS DISTINCT FROM v_tax_amount
       OR NEW.total_amount IS DISTINCT FROM ROUND(v_subtotal, 2) + v_tax_amount THEN
      RAISE EXCEPTION 'Approved order totals must match the final product list';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_supplier_quote_order_updates ON public.purchase_orders;
CREATE TRIGGER guard_supplier_quote_order_updates
BEFORE UPDATE OF supplier_quote_status, supplier_quote_items, supplier_quote_notes,
  supplier_quote_submitted_by, supplier_quote_submitted_at, supplier_quote_review_notes,
  supplier_quote_reviewed_by, supplier_quote_reviewed_at, items, subtotal, tax_rate,
  tax_amount, total_amount, status
ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_quote_order_updates();

-- A quote-based order must not accept a wallet payment request or a hand-entered
-- cash transfer until the manager approves its final products and total.
CREATE OR REPLACE FUNCTION public.guard_supplier_quote_order_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order public.purchase_orders;
BEGIN
  SELECT * INTO v_order FROM public.purchase_orders WHERE id = NEW.purchase_order_id;
  IF v_order.supplier_quote_status <> 'not_requested' THEN
    IF v_order.supplier_quote_status <> 'accepted' THEN
      RAISE EXCEPTION 'Manager approval of the supplier proposal is required before payment';
    END IF;
    IF NEW.payment_method <> 'ican_business_wallet' THEN
      RAISE EXCEPTION 'Quote-based supplier orders must be paid through the business wallet admin approval flow';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_supplier_quote_order_payment ON public.payment_transactions;
CREATE TRIGGER guard_supplier_quote_order_payment
BEFORE INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_quote_order_payment();

CREATE OR REPLACE FUNCTION public.guard_supplier_quote_wallet_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.wallet_transaction_id IS NOT NULL
     AND NEW.wallet_transaction_id IS DISTINCT FROM OLD.wallet_transaction_id
     AND NEW.supplier_quote_status <> 'not_requested'
     AND NEW.supplier_quote_status <> 'accepted' THEN
    RAISE EXCEPTION 'Manager approval of the supplier proposal is required before payment';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_supplier_quote_wallet_request ON public.purchase_orders;
CREATE TRIGGER guard_supplier_quote_wallet_request
BEFORE UPDATE OF wallet_transaction_id ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_quote_wallet_request();

REVOKE ALL ON FUNCTION public.supplier_submit_purchase_order_quote_v1(UUID, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manager_review_purchase_order_quote_v1(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_submit_purchase_order_quote_v1(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_review_purchase_order_quote_v1(UUID, TEXT, JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
