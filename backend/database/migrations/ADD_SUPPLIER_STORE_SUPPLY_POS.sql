-- Let suppliers issue POS receipts/invoices to stores that do not use this
-- platform. The sale reuses the protected stock deduction transaction from
-- ADD_SUPPLIER_DIRECT_SALES_RECEIPTS.sql and records the store delivery details.

ALTER TABLE public.supplier_direct_sales
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.supplier_direct_sales'::regclass
      AND conname = 'supplier_direct_sales_customer_type_check'
  ) THEN
    ALTER TABLE public.supplier_direct_sales
      ADD CONSTRAINT supplier_direct_sales_customer_type_check
      CHECK (customer_type IN ('individual', 'store'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_supplier_store_supply_sale_v1(
  p_items JSONB,
  p_business_name TEXT,
  p_contact_person TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_business_name TEXT;
  v_contact_person TEXT;
  v_delivery_address TEXT;
  v_phone TEXT;
  v_result JSONB;
  v_sale JSONB;
  v_sale_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to issue a store supply receipt';
  END IF;
  v_business_name := NULLIF(left(trim(COALESCE(p_business_name, '')), 160), '');
  v_contact_person := NULLIF(left(trim(COALESCE(p_contact_person, '')), 120), '');
  v_delivery_address := NULLIF(left(trim(COALESCE(p_delivery_address, '')), 240), '');
  v_phone := NULLIF(left(trim(COALESCE(p_phone, '')), 40), '');
  IF v_business_name IS NULL THEN
    RAISE EXCEPTION 'Store or business name is required';
  END IF;

  -- This RPC checks ownership, price and available stock, then creates the
  -- sale. Any later error in this wrapper rolls the stock change back too.
  v_result := public.create_supplier_direct_sale_v1(
    p_items,
    v_business_name,
    v_phone,
    p_amount_paid,
    p_payment_method
  );
  IF COALESCE((v_result->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Could not save store supply sale';
  END IF;

  v_sale := v_result->'sale';
  v_sale_id := (v_sale->>'id')::UUID;
  UPDATE public.supplier_direct_sales
  SET customer_type = 'store',
      business_name = v_business_name,
      contact_person = v_contact_person,
      delivery_address = v_delivery_address
  WHERE id = v_sale_id AND supplier_user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not save store delivery details';
  END IF;

  v_sale := v_sale || jsonb_build_object(
    'customer_type', 'store',
    'business_name', v_business_name,
    'contact_person', v_contact_person,
    'delivery_address', v_delivery_address
  );
  RETURN jsonb_set(v_result, '{sale}', v_sale, TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.create_supplier_store_supply_sale_v1(JSONB, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_supplier_store_supply_sale_v1(JSONB, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
