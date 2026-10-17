-- =====================================================================
-- FIX: barcodes that were saved with "Ente" on the end
-- =====================================================================
-- A hand-scanner bug (fixed) saved codes like 8717896009292Ente instead of
-- 8717896009292. This cleans them up. Run the whole file once in the Supabase
-- SQL editor; it is safe to run again (a second run changes nothing).
--
--  1. A product whose cleaned barcode is free gets it. Its name and SKU are
--     cleaned too, but only when they are still the auto-made ones
--     ("Product - <barcode>" / "SKU-<barcode>"), so anything you renamed stays.
--  2. If the cleaned barcode already belongs to another product IN THE SAME
--     STORE, the item was registered twice. Any stock on the "Ente" copy is
--     added to the clean product, then the "Ente" copy is switched off
--     (is_active = false). Nothing is deleted, so sales history is untouched.
--  3. If the cleaned barcode belongs to a product in ANOTHER store, nothing is
--     changed (barcodes are unique across stores); it is counted at the end.
--
-- The last statement shows how it went. still_active_ending_in_ente should be 0.
-- =====================================================================

-- 1. Fix every product whose cleaned barcode is free
update products p
set name    = case when p.name = 'Product - ' || p.barcode
                   then regexp_replace(p.name, 'Ente$', '') else p.name end,
    sku     = case when p.sku = 'SKU-' || p.barcode
                    and not exists (select 1 from products o
                                    where o.sku = regexp_replace(p.sku, 'Ente$', ''))
                   then regexp_replace(p.sku, 'Ente$', '') else p.sku end,
    barcode = regexp_replace(p.barcode, 'Ente$', '')
where p.barcode ~ 'Ente$'
  and not exists (select 1 from products o
                  where o.barcode = regexp_replace(p.barcode, 'Ente$', ''));

-- 2a. Same-store duplicates: move their stock onto the clean product
--     (only where the clean product has a stock record to receive it)
with duplicates as (
  select bad.id as bad_id, good.id as good_id, bad.supermarket_id
  from products bad
  join products good on good.barcode = regexp_replace(bad.barcode, 'Ente$', '')
  where bad.barcode ~ 'Ente$'
    and good.supermarket_id is not distinct from bad.supermarket_id
),
stock_to_move as (
  select bi.id as bad_inventory_id, gi.id as good_inventory_id, bi.current_stock
  from duplicates d
  join inventory bi on bi.product_id = d.bad_id
  join inventory gi on gi.product_id = d.good_id
                   and gi.supermarket_id is not distinct from bi.supermarket_id
  where bi.current_stock > 0
),
emptied as (
  update inventory
  set current_stock = 0
  where id in (select bad_inventory_id from stock_to_move)
  returning id
)
update inventory gi
set current_stock = gi.current_stock + m.current_stock
from stock_to_move m
where gi.id = m.good_inventory_id;

-- 2b. Same-store duplicates: switch the "Ente" copy off
update products bad
set is_active = false
where bad.barcode ~ 'Ente$'
  and bad.is_active
  and exists (select 1 from products good
              where good.barcode = regexp_replace(bad.barcode, 'Ente$', '')
                and good.supermarket_id is not distinct from bad.supermarket_id);

-- 3. How it went
select count(*) filter (where is_active)     as still_active_ending_in_ente,  -- 0 = all done
       count(*) filter (where not is_active) as duplicates_switched_off
from products
where barcode ~ 'Ente$';

-- If still_active_ending_in_ente is not 0, those products clash with a barcode
-- owned by another store. List them with:
--
--   select p.id, p.name, p.barcode, p.supermarket_id
--   from products p
--   where p.barcode ~ 'Ente$' and p.is_active;
