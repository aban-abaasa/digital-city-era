-- NULL means inherit supermarkets.tax_included; TRUE/FALSE is a product override.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tax_included BOOLEAN;

-- Customer/BodaGoera self-checkout resolves product override before store default.
DO $patch$
DECLARE
  d TEXT;
  d0 TEXT;
BEGIN
  SELECT pg_get_functiondef('public.customer_self_checkout(jsonb,text,boolean,text)'::regprocedure)
    INTO d;
  d0 := d;

  IF position('v_product.tax_included' in d) > 0 THEN
    RAISE NOTICE 'customer_self_checkout already supports product tax overrides';
    RETURN;
  END IF;

  d := replace(d,
    'p.tax_rate AS tax_rate,',
    'p.tax_rate AS tax_rate, p.tax_included AS tax_included,');
  d := replace(d,
    'SELECT COALESCE(tax_included, TRUE) INTO v_tax_included FROM public.supermarkets WHERE id = v_supermarket_id;',
    'SELECT COALESCE(v_product.tax_included, s.tax_included, TRUE) INTO v_tax_included FROM public.supermarkets s WHERE s.id = v_supermarket_id;');
  d := replace(d,
    'SELECT COALESCE(tax_included, TRUE) INTO v_tax_included' || chr(10) ||
    '    FROM public.supermarkets WHERE id = v_supermarket_id;',
    'SELECT COALESCE(v_product.tax_included, s.tax_included, TRUE) INTO v_tax_included' || chr(10) ||
    '    FROM public.supermarkets s WHERE s.id = v_supermarket_id;');

  IF d = d0 OR position('v_product.tax_included' in d) = 0
     OR position('COALESCE(v_product.tax_included, s.tax_included, TRUE)' in d) = 0 THEN
    RAISE EXCEPTION 'Could not safely add product tax overrides to customer_self_checkout. Function unchanged.';
  END IF;
  EXECUTE d;
END;
$patch$;
