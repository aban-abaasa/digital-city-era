-- Store-level tax presentation for product selling prices.
-- Existing stores keep the current behavior: tax is included in the displayed price.
ALTER TABLE public.supermarkets
  ADD COLUMN IF NOT EXISTS tax_included BOOLEAN NOT NULL DEFAULT TRUE;

-- Preserve the established checkout's stock, payment, receipt and rewards flow,
-- changing only its tax treatment to read the chosen store setting.
DO $patch$
DECLARE
  d TEXT;
  d0 TEXT;
  item_columns_pos INTEGER;
  item_flag_pos INTEGER;
BEGIN
  SELECT pg_get_functiondef('public.customer_self_checkout(jsonb,text,boolean,text)'::regprocedure)
    INTO d;
  d0 := d;

  IF position('v_tax_included BOOLEAN' in d) > 0 THEN
    RAISE NOTICE 'customer_self_checkout already supports store tax inclusion';
    RETURN;
  END IF;

  d := replace(d,
    $old$v_supermarket_id UUID;$old$,
    $new$v_supermarket_id UUID;
  v_tax_included BOOLEAN := TRUE;$new$);
  d := replace(d,
    '    v_unit_price := v_product.selling_price;',
    '    SELECT COALESCE(tax_included, TRUE) INTO v_tax_included FROM public.supermarkets WHERE id = v_supermarket_id;' || chr(10) ||
    '    v_unit_price := v_product.selling_price;');

  -- Support both historical function bodies: the original added tax on top,
  -- while the later repair extracted VAT from the displayed price.
  d := replace(d,
    '    v_tax_amount := ROUND(v_unit_price * v_qty * (v_tax_rate / 100), 2);',
    '    v_tax_amount := CASE WHEN v_tax_rate > 0 THEN CASE WHEN v_tax_included THEN ROUND((v_unit_price * v_qty) - ((v_unit_price * v_qty) / (1 + v_tax_rate / 100)), 2) ELSE ROUND(v_unit_price * v_qty * (v_tax_rate / 100), 2) END ELSE 0 END;');
  d := regexp_replace(d,
    'v_tax_amount := CASE WHEN v_tax_rate > 0[[:space:]]+THEN ROUND\(v_line_total - \(v_line_total / \(1 \+ v_tax_rate / 100\)\), 2\)[[:space:]]+ELSE 0[[:space:]]+END;',
    'v_tax_amount := CASE WHEN v_tax_rate > 0 THEN CASE WHEN v_tax_included THEN ROUND(v_line_total - (v_line_total / (1 + v_tax_rate / 100)), 2) ELSE ROUND(v_line_total * (v_tax_rate / 100), 2) END ELSE 0 END;');
  d := replace(d,
    '    v_line_total := ROUND(v_unit_price * v_qty + v_tax_amount, 2);',
    '    v_line_total := ROUND(v_unit_price * v_qty + CASE WHEN v_tax_included THEN 0 ELSE v_tax_amount END, 2);');
  d := replace(d,
    '    v_line_total := ROUND(v_unit_price * v_qty, 2);',
    '    v_line_total := ROUND(v_unit_price * v_qty + CASE WHEN v_tax_included THEN 0 ELSE v_tax_amount END, 2);');

  -- Snapshot and item-table amounts must retain the pre-tax selling price;
  -- line_total remains the charged total for the order and receipt.
  d := replace(d,
    $old$      'line_total', v_line_total$old$,
    $new$      'line_total', v_line_total,
      'tax_included', v_tax_included$new$);
  d := replace(d,
    $old$    TRUE,
    (item->>'tax_amount')::DECIMAL$old$,
    $new$    COALESCE((item->>'tax_included')::BOOLEAN, TRUE),
    (item->>'tax_amount')::DECIMAL$new$);
  d := replace(d,
    $old$    TRUE,
    (item->>'tax_rate')::DECIMAL / 100 *$old$,
    $new$    COALESCE((item->>'tax_included')::BOOLEAN, TRUE),
    (item->>'tax_rate')::DECIMAL / 100 *$new$);

  -- Some deployed versions format or calculate tax_amount differently. Locate
  -- the TRUE value by its position after the sales line-item column list, then
  -- replace only that tax_included value without depending on the next SQL expr.
  item_columns_pos := position('tax_included, tax_amount' in lower(d));
  IF item_columns_pos > 0 THEN
    item_flag_pos := position('true,' in substring(lower(d) from item_columns_pos));
    IF item_flag_pos > 0 THEN
      item_flag_pos := item_columns_pos + item_flag_pos - 1;
      d := overlay(d placing 'COALESCE((item->>''tax_included'')::BOOLEAN, TRUE)'
                   from item_flag_pos for 4);
    END IF;
  END IF;

  IF d = d0 OR position('v_tax_included BOOLEAN' in d) = 0
     OR position('v_tax_included THEN' in d) = 0
     OR position('''tax_included'', v_tax_included' in d) = 0
     OR position('COALESCE((item->>''tax_included'')::BOOLEAN, TRUE)' in d) = 0 THEN
    RAISE EXCEPTION E'customer_self_checkout did not match supported tax patterns; the function was not changed.\nMatches: declaration=%, tax_case=%, snapshot_flag=%, line_item_flag=%, source_length=%\nPlease run SELECT pg_get_functiondef(''public.customer_self_checkout(jsonb,text,boolean,text)''::regprocedure); and share the output.',
      position('v_tax_included BOOLEAN' in d) > 0,
      position('v_tax_included THEN' in d) > 0,
      position('''tax_included'', v_tax_included' in d) > 0,
      position('COALESCE((item->>''tax_included'')::BOOLEAN, TRUE)' in d) > 0,
      length(d);
  END IF;
  EXECUTE d;
END;
$patch$;
