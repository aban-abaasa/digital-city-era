-- ============================================================================
-- Supermarketa: pharmacy support + flexible POS inventory modes
-- ============================================================================
-- Additive migration. Existing supermarket IDs, products, inventory rows,
-- transactions, and historical stock movements are preserved.

-- --------------------------------------------------------------------------
-- 1. Business types
-- --------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.supermarkets
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'supermarket',
  ADD COLUMN IF NOT EXISTS pichin_business_profile_id UUID
    REFERENCES public.business_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supermarkets_pichin_business
  ON public.supermarkets(pichin_business_profile_id);

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.supermarkets'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%business_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.supermarkets DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.supermarkets
  ADD CONSTRAINT supermarkets_business_type_check
  CHECK (business_type IN ('supermarket', 'pharmacy', 'hotel', 'boutique', 'restaurant_cafe', 'wholesale'));

CREATE INDEX IF NOT EXISTS idx_supermarkets_business_type
  ON public.supermarkets(business_type);

-- Replace every old overload. Older deployments commonly have the original
-- eight-argument function, while newer clients call the nine-argument version.
-- Keep an eight-argument compatibility wrapper below so existing supermarket,
-- hotel, boutique, and restaurant/café callers continue to work.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'onboard_supermarket'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.onboard_supermarket(%s)', fn.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.onboard_supermarket(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_business_type TEXT DEFAULT 'supermarket'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_existing_id UUID;
  v_new_id UUID;
  v_token UUID;
  v_internal_user_id UUID;
  v_pichin_business_id UUID;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Store name is required');
  END IF;

  IF COALESCE(p_business_type, '') NOT IN
    ('supermarket', 'pharmacy', 'hotel', 'boutique', 'restaurant_cafe', 'wholesale') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid business type');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.supermarkets
  WHERE owner_user_id = v_auth_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'supermarket_id', v_existing_id,
      'already_existed', true
    );
  END IF;

  v_token := gen_random_uuid();

  SELECT id INTO v_pichin_business_id
  FROM public.business_profiles
  WHERE user_id = v_auth_id
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.supermarkets (
    name, description, phone, email, address, city, country,
    owner_user_id, onboarding_token, is_active, business_type,
    pichin_business_profile_id,
    created_at, updated_at
  )
  VALUES (
    trim(p_name), p_description, p_phone, p_email, p_address, p_city,
    p_country, v_auth_id, v_token, true, COALESCE(p_business_type, 'supermarket'),
    v_pichin_business_id,
    NOW(), NOW()
  )
  RETURNING id INTO v_new_id;

  SELECT id INTO v_internal_user_id
  FROM public.users
  WHERE auth_id = v_auth_id OR id = v_auth_id
  LIMIT 1;

  IF v_internal_user_id IS NOT NULL THEN
    UPDATE public.users
    SET role = 'admin', supermarket_id = v_new_id, updated_at = NOW()
    WHERE id = v_internal_user_id;
  END IF;

  IF v_pichin_business_id IS NOT NULL
     AND to_regclass('public.business_app_links') IS NOT NULL THEN
    INSERT INTO public.business_app_links (
      business_profile_id, app_key, source_entity_id, linked_by, metadata
    ) VALUES (
      v_pichin_business_id, 'supermarketa', v_new_id, v_auth_id,
      jsonb_build_object('business_type', COALESCE(p_business_type, 'supermarket'))
    )
    ON CONFLICT (business_profile_id, app_key) DO UPDATE
      SET source_entity_id = EXCLUDED.source_entity_id,
          status = 'active',
          metadata = EXCLUDED.metadata,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'supermarket_id', v_new_id,
    'onboarding_token', v_token,
    'business_type', COALESCE(p_business_type, 'supermarket'),
    'pichin_business_profile_id', v_pichin_business_id
  );
END;
$$;

-- Backward-compatible seven-argument signature for existing clients that do
-- not send a business type.
CREATE OR REPLACE FUNCTION public.onboard_supermarket(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.onboard_supermarket(
    p_name, p_description, p_phone, p_email, p_address, p_city,
    p_country, 'supermarket'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboard_supermarket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

-- --------------------------------------------------------------------------
-- 2. Product inventory modes and pharmacy metadata
-- --------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS inventory_mode TEXT,
  ADD COLUMN IF NOT EXISTS generic_name TEXT,
  ADD COLUMN IF NOT EXISTS medicine_category TEXT,
  ADD COLUMN IF NOT EXISTS strength TEXT,
  ADD COLUMN IF NOT EXISTS dosage_form TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS prescription_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS controlled_medicine BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS product_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(12,2);

UPDATE public.products p
SET inventory_mode = CASE
  WHEN p.is_service = TRUE OR p.track_inventory = FALSE THEN 'service_item'
  ELSE COALESCE(
    (SELECT CASE
      WHEN s.business_type = 'restaurant_cafe' THEN 'listing_only'
      WHEN s.business_type = 'pharmacy' THEN 'stock_controlled'
      ELSE 'stock_controlled'
    END
    FROM public.supermarkets s
    WHERE s.id = p.supermarket_id),
    'stock_controlled'
  )
END
WHERE p.inventory_mode IS NULL;

ALTER TABLE public.products
  ALTER COLUMN inventory_mode SET DEFAULT 'stock_controlled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_inventory_mode_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_inventory_mode_check
      CHECK (inventory_mode IN ('stock_controlled', 'listing_only', 'batch_controlled', 'service_item'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_status_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_status_check
      CHECK (product_status IN ('active', 'expired', 'recalled', 'discontinued'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_inventory_mode
  ON public.products(inventory_mode);
CREATE INDEX IF NOT EXISTS idx_products_pharmacy_status
  ON public.products(product_status);
CREATE INDEX IF NOT EXISTS idx_products_expiry_date
  ON public.products(expiry_date);

-- Pharmacy batch stock. Product-level inventory remains available for general
-- pharmacy products and all existing supermarkets.
CREATE TABLE IF NOT EXISTS public.product_inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  current_stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  purchase_price NUMERIC(15,2),
  selling_price NUMERIC(15,2),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'recalled', 'depleted')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, supermarket_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_product_batches_product
  ON public.product_inventory_batches(product_id, supermarket_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry
  ON public.product_inventory_batches(expiry_date, status);

ALTER TABLE public.product_inventory_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_batches_authenticated_access ON public.product_inventory_batches;
CREATE POLICY product_batches_authenticated_access
  ON public.product_inventory_batches FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 3. Pharmacy product validation
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supermarketa_can_manage_pharmacy()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM public.users u
        LEFT JOIN public.supermarket_staff ss ON ss.user_id = u.id
        WHERE (u.id = auth.uid() OR u.auth_id = auth.uid())
          AND (
            lower(COALESCE(u.role, '')) IN ('admin', 'manager', 'pharmacy_manager', 'pharmacist')
            OR lower(COALESCE(ss.role, '')) IN ('admin', 'manager', 'pharmacy_manager', 'pharmacist')
          )
          AND COALESCE(u.is_active, true) = true
      );
$$;

CREATE OR REPLACE FUNCTION public.validate_pharmacy_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_type TEXT;
BEGIN
  SELECT business_type INTO v_business_type
  FROM public.supermarkets
  WHERE id = NEW.supermarket_id;

  IF v_business_type = 'restaurant_cafe' THEN
    NEW.inventory_mode := COALESCE(NEW.inventory_mode, 'listing_only');
  END IF;

  IF NEW.inventory_mode IS NULL THEN
    NEW.inventory_mode := CASE
      WHEN NEW.is_service = TRUE OR NEW.track_inventory = FALSE THEN 'service_item'
      WHEN v_business_type = 'restaurant_cafe' THEN 'listing_only'
      WHEN v_business_type = 'pharmacy' THEN 'stock_controlled'
      ELSE 'stock_controlled'
    END;
  END IF;

  IF v_business_type = 'pharmacy'
     AND (NEW.controlled_medicine = TRUE OR NEW.prescription_required = TRUE)
     AND NOT public.supermarketa_can_manage_pharmacy() THEN
    RAISE EXCEPTION 'Only an authorized pharmacy user can manage controlled or prescription products';
  END IF;

  IF v_business_type <> 'pharmacy' THEN
    NEW.controlled_medicine := FALSE;
    NEW.prescription_required := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_pharmacy_product_trigger ON public.products;
CREATE TRIGGER validate_pharmacy_product_trigger
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_pharmacy_product();

-- --------------------------------------------------------------------------
-- 4. Server-side POS enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_batch_id UUID;
  v_qty NUMERIC;
  v_mode TEXT;
  v_product_status TEXT;
  v_requires_prescription BOOLEAN;
  v_controlled BOOLEAN;
  v_expiry DATE;
  v_stock NUMERIC;
  v_supermarket_type TEXT;
BEGIN
  IF NEW.status <> 'completed'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT business_type INTO v_supermarket_type
  FROM public.supermarkets
  WHERE id = NEW.supermarket_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb))
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_batch_id := NULLIF(v_item->>'batch_id', '')::UUID;
    v_qty := GREATEST(COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1), 0);

    IF v_product_id IS NULL OR v_qty = 0 THEN
      CONTINUE;
    END IF;

    SELECT inventory_mode, product_status, prescription_required,
           controlled_medicine, expiry_date
    INTO v_mode, v_product_status, v_requires_prescription,
         v_controlled, v_expiry
    FROM public.products
    WHERE id = v_product_id
      AND supermarket_id = NEW.supermarket_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not belong to supermarket %', v_product_id, NEW.supermarket_id;
    END IF;

    IF COALESCE(v_product_status, 'active') IN ('expired', 'recalled', 'discontinued')
       OR (v_expiry IS NOT NULL AND v_expiry < CURRENT_DATE) THEN
      RAISE EXCEPTION 'Product % is expired, recalled, or discontinued', v_product_id;
    END IF;

    IF v_supermarket_type = 'pharmacy'
       AND (v_requires_prescription OR v_controlled)
       AND COALESCE((v_item->>'prescription_verified')::BOOLEAN, FALSE) = FALSE THEN
      RAISE EXCEPTION 'Prescription verification is required for product %', v_product_id;
    END IF;

    IF v_mode IN ('listing_only', 'service_item') THEN
      CONTINUE;
    END IF;

    IF v_mode = 'batch_controlled' THEN
      IF v_batch_id IS NOT NULL THEN
        SELECT current_stock, expiry_date, status
        INTO v_stock, v_expiry, v_product_status
        FROM public.product_inventory_batches
        WHERE id = v_batch_id
          AND product_id = v_product_id
          AND supermarket_id = NEW.supermarket_id
        FOR UPDATE;

        IF NOT FOUND OR v_product_status <> 'active' OR v_expiry < CURRENT_DATE THEN
          RAISE EXCEPTION 'Selected pharmacy batch is unavailable or expired';
        END IF;

        IF v_stock < v_qty THEN
          RAISE EXCEPTION 'Insufficient stock in selected pharmacy batch for product %', v_product_id;
        END IF;

        UPDATE public.product_inventory_batches
        SET current_stock = current_stock - v_qty,
            status = CASE WHEN current_stock - v_qty = 0 THEN 'depleted' ELSE status END,
            updated_at = now()
        WHERE id = v_batch_id;
      ELSE
        SELECT id, current_stock, expiry_date
        INTO v_batch_id, v_stock, v_expiry
        FROM public.product_inventory_batches
        WHERE product_id = v_product_id
          AND supermarket_id = NEW.supermarket_id
          AND status = 'active'
          AND expiry_date >= CURRENT_DATE
          AND current_stock >= v_qty
        ORDER BY expiry_date ASC
        LIMIT 1
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'No eligible pharmacy batch has enough stock for product %', v_product_id;
        END IF;

        UPDATE public.product_inventory_batches
        SET current_stock = current_stock - v_qty,
            status = CASE WHEN current_stock - v_qty = 0 THEN 'depleted' ELSE status END,
            updated_at = now()
        WHERE id = v_batch_id;
      END IF;
    ELSE
      SELECT current_stock INTO v_stock
      FROM public.inventory
      WHERE product_id = v_product_id
        AND supermarket_id = NEW.supermarket_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record is missing for product %', v_product_id;
      END IF;

      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
      END IF;

      UPDATE public.inventory
      SET current_stock = current_stock - v_qty,
          updated_at = now()
      WHERE product_id = v_product_id
        AND supermarket_id = NEW.supermarket_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transaction_deduct_inventory ON public.transactions;
CREATE TRIGGER transaction_deduct_inventory
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_on_transaction();

COMMENT ON COLUMN public.products.inventory_mode IS
  'POS behavior: stock_controlled, listing_only, batch_controlled, or service_item';
COMMENT ON TABLE public.product_inventory_batches IS
  'Batch, expiry, and stock records for pharmacy products';
