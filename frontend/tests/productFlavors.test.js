import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newFlavorRow,
  flavorProductName,
  splitScannedCodes,
  activeFlavorRows,
  addBarcodesToRows,
  addFlavorNameToRows,
  checkFlavorRows,
  hasFlavorIssues,
  buildFlavorProducts,
  registerFlavorProducts
} from '../src/utils/productFlavors.js';

const row = (flavor, barcode, selling_price = '') => newFlavorRow({ flavor, barcode, selling_price });

test('product name joins the shared name and the flavor', () => {
  assert.equal(flavorProductName('Fanta 500ml', 'Orange'), 'Fanta 500ml - Orange');
  assert.equal(flavorProductName('  Fanta 500ml ', ' Orange '), 'Fanta 500ml - Orange');
  assert.equal(flavorProductName('', 'Orange'), 'Orange');
  assert.equal(flavorProductName('Fanta', ''), 'Fanta');
});

test('scanned or pasted codes are split and de-duplicated', () => {
  assert.deepEqual(splitScannedCodes('6001\n6002\r\n6003'), ['6001', '6002', '6003']);
  assert.deepEqual(splitScannedCodes('6001, 6002;6001  6003'), ['6001', '6002', '6003']);
  assert.deepEqual(splitScannedCodes('  '), []);
  assert.deepEqual(splitScannedCodes(null), []);
});

test('empty rows are ignored', () => {
  const rows = [row('Orange', '600111'), row('', ''), row('', '', '5000')];
  assert.equal(activeFlavorRows(rows).length, 1);
  assert.equal(hasFlavorIssues(checkFlavorRows([row('', ''), row('', '')])), false);
});

test('a complete, unique set of rows has no issues', () => {
  const rows = [row('Orange', '600111'), row('Mango', '600222')];
  assert.equal(hasFlavorIssues(checkFlavorRows(rows, { mainBarcode: '600999', products: [] })), false);
});

test('rows missing a name or a barcode are flagged', () => {
  const [a, b] = [row('Orange', ''), row('', '600222')];
  const issues = checkFlavorRows([a, b]);
  assert.equal(issues[a.id].barcode, 'Scan, type or generate its barcode');
  assert.equal(issues[b.id].flavor, 'Name this flavor');
  assert.equal(issues[a.id].flavor, undefined);
});

test('a barcode that is too short is flagged', () => {
  const a = row('Orange', '12');
  assert.equal(checkFlavorRows([a])[a.id].barcode, 'Too short to be a barcode');
});

test('the same barcode twice is flagged on the second row, including UPC-A vs EAN-13 forms', () => {
  const [a, b, c] = [row('Orange', '012345678905'), row('Mango', '12345678905'), row('Lemon', '600333')];
  const issues = checkFlavorRows([a, b, c]);
  assert.equal(issues[a.id], undefined);
  assert.equal(issues[b.id].barcode, 'Same barcode as another flavor');
  assert.equal(issues[c.id], undefined);
});

test('the same flavor twice is flagged regardless of case', () => {
  const [a, b] = [row('Orange', '600111'), row('orange', '600222')];
  const issues = checkFlavorRows([a, b]);
  assert.equal(issues[a.id], undefined);
  assert.equal(issues[b.id].flavor, 'Already listed above');
});

test('a flavor cannot reuse the main product barcode or one already in the catalog', () => {
  const [a, b] = [row('Orange', '600111'), row('Mango', '600222')];
  const issues = checkFlavorRows([a, b], {
    mainBarcode: '600111',
    products: [{ name: 'Sprite 500ml', barcode: '600222' }]
  });
  assert.equal(issues[a.id].barcode, "Same as the main product's barcode");
  assert.equal(issues[b.id].barcode, 'Already used by Sprite 500ml');
});

test('flavor products copy the main product and may carry their own price', () => {
  const base = { name: 'Fanta 500ml', cost_price: 1500, wholesale_price: 1900, wholesale_discount_percent: 0, selling_price: 2000, tax_rate: 18, category_id: 'cat-1' };
  const [orange, mango] = buildFlavorProducts({
    supermarketId: 'store-1',
    base,
    rows: [row('Orange', '600111'), row('Mango', '600222', '2500'), row('', '')]
  });
  assert.deepEqual(orange, {
    name: 'Fanta 500ml - Orange', sku: 'SKU-600111', barcode: '600111',
    cost_price: 1500, wholesale_price: 1900, selling_price: 2000, tax_rate: 18,
    category_id: 'cat-1', is_active: true, supermarket_id: 'store-1'
  });
  assert.equal(mango.selling_price, 2500);
  assert.equal(mango.wholesale_price, 2375, "keeps the main product's 5% wholesale discount, worked out from its two prices");
});

test('a flavor with no price of its own copies the wholesale price as it is', () => {
  const base = { name: 'Fanta', cost_price: 1500, wholesale_price: 1900, selling_price: 2000, tax_rate: 18 };
  const [orange] = buildFlavorProducts({ supermarketId: 's', base, rows: [row('Orange', '600111')] });
  assert.equal(orange.wholesale_price, 1900);
});

test('no wholesale price on the main product means none on a flavor with its own price', () => {
  const base = { name: 'Fanta', cost_price: 1500, wholesale_price: 0, selling_price: 2000, tax_rate: 18 };
  const [mango] = buildFlavorProducts({ supermarketId: 's', base, rows: [row('Mango', '600222', '2500')] });
  assert.equal(mango.wholesale_price, 0);
});

test('with a wholesale discount, an own price rebuilds the wholesale price from it', () => {
  const base = { name: 'Fanta', cost_price: 1500, wholesale_price: 1800, wholesale_discount_percent: 10, selling_price: 2000, tax_rate: 18 };
  const [mango] = buildFlavorProducts({ supermarketId: 's', base, rows: [row('Mango', '600222', '2500')] });
  assert.equal(mango.wholesale_price, 2250);
});

// A just-enough stand-in for the Supabase query builder: every call chains, awaiting resolves.
const fakeSupabase = ({ existing = [], insertError = null, stockError = null } = {}) => {
  const calls = [];
  const builder = (table, result) => {
    const chain = {
      select: () => chain,
      in: () => chain,
      eq: () => chain,
      insert: (payload) => { calls.push({ table, payload }); return chain; },
      then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
    };
    return chain;
  };
  return {
    calls,
    from: (table) => {
      if (table === 'inventory') return builder(table, () => ({ error: stockError }));
      let inserted = null;
      const chain = builder(table, () => (inserted
        ? { data: insertError ? null : inserted.map((p, i) => ({ ...p, id: `id-${i}` })), error: insertError }
        : { data: existing, error: null }));
      const insert = chain.insert;
      chain.insert = (payload) => { inserted = payload; return insert(payload); };
      return chain;
    }
  };
};

const base = { name: 'Fanta', cost_price: 1500, wholesale_price: 0, selling_price: 2000, tax_rate: 18 };

test('registering flavors inserts the products, then one stock record each', async () => {
  const supabase = fakeSupabase();
  const { products, stockError } = await registerFlavorProducts({
    supabase, supermarketId: 's1', base, rows: [row('Orange', '600111'), row('Mango', '600222')]
  });
  assert.equal(products.length, 2);
  assert.equal(stockError, null);
  const [productInsert, stockInsert] = supabase.calls;
  assert.equal(productInsert.table, 'products');
  assert.equal(productInsert.payload.length, 2);
  assert.equal(stockInsert.table, 'inventory');
  assert.deepEqual(stockInsert.payload.map((s) => s.product_id), ['id-0', 'id-1']);
  assert.ok(stockInsert.payload.every((s) => s.supermarket_id === 's1' && s.current_stock === 0));
});

test('a barcode this store already uses stops everything before anything is written', async () => {
  const supabase = fakeSupabase({ existing: [{ name: 'Sprite 500ml', barcode: '600222' }] });
  await assert.rejects(
    registerFlavorProducts({ supabase, supermarketId: 's1', base, rows: [row('Orange', '600111'), row('Mango', '600222')] }),
    /Barcode 600222 is already used by Sprite 500ml/
  );
  assert.equal(supabase.calls.length, 0);
});

test('a barcode owned by another store is reported plainly', async () => {
  const supabase = fakeSupabase({ insertError: { code: '23505', message: 'duplicate key' } });
  await assert.rejects(
    registerFlavorProducts({ supabase, supermarketId: 's1', base, rows: [row('Orange', '600111')] }),
    /already registered to another store/
  );
  assert.equal(supabase.calls.some((c) => c.table === 'inventory'), false);
});

test('a failed stock record is reported, not thrown', async () => {
  const supabase = fakeSupabase({ stockError: { message: 'boom' } });
  const { products, stockError } = await registerFlavorProducts({
    supabase, supermarketId: 's1', base, rows: [row('Orange', '600111')]
  });
  assert.equal(products.length, 1);
  assert.equal(stockError.message, 'boom');
});

test('each flavor photo is uploaded to its own product, and a failed upload is counted, not thrown', async () => {
  const supabase = fakeSupabase();
  const uploads = [];
  const uploadPhoto = async (productId, file) => {
    uploads.push([productId, file]);
    if (file === 'bad.jpg') throw new Error('upload failed');
    return `http://img/${productId}.jpg`;
  };
  const rows = [
    newFlavorRow({ flavor: 'Orange', barcode: '600111', photo: 'orange.jpg' }),
    newFlavorRow({ flavor: 'Mango', barcode: '600222' }),
    newFlavorRow({ flavor: 'Lime', barcode: '600333', photo: 'bad.jpg' })
  ];
  const { products, photoFailures } = await registerFlavorProducts({ supabase, supermarketId: 's1', base, rows, uploadPhoto });
  assert.deepEqual(uploads, [['id-0', 'orange.jpg'], ['id-2', 'bad.jpg']]);
  assert.deepEqual(products.map((p) => p.images ?? null), [['http://img/id-0.jpg'], null, null]);
  assert.equal(photoFailures, 1);
});

test('photos are optional: without an upload function nothing is uploaded', async () => {
  const supabase = fakeSupabase();
  const { photoFailures } = await registerFlavorProducts({
    supabase, supermarketId: 's1', base, rows: [newFlavorRow({ flavor: 'Orange', barcode: '600111', photo: 'orange.jpg' })]
  });
  assert.equal(photoFailures, 0);
});

test('no complete rows means nothing is written', async () => {
  const supabase = fakeSupabase();
  const result = await registerFlavorProducts({ supabase, supermarketId: 's1', base, rows: [row('', '')] });
  assert.deepEqual(result, { products: [], stockError: null, photoFailures: 0 });
  assert.equal(supabase.calls.length, 0);
});

test('scanned codes fill rows that are waiting for a barcode, then add new rows', () => {
  const rows = [row('Orange', ''), row('Mango', '600222')];
  const next = addBarcodesToRows(rows, ['600111', '600333', '600444']);
  assert.deepEqual(next.map((r) => [r.flavor, r.barcode]), [
    ['Orange', '600111'], ['Mango', '600222'], ['', '600333'], ['', '600444']
  ]);
  assert.equal(next[0].id, rows[0].id);
  assert.equal(rows[0].barcode, '', 'the original rows are not mutated');
});

test('a scanned code that is already listed, in any UPC-A / EAN-13 form, is skipped', () => {
  const rows = [row('Orange', '012345678905')];
  assert.equal(addBarcodesToRows(rows, ['12345678905', '600111', '600111']).length, 2);
  assert.equal(addBarcodesToRows(rows, ['  ', '12345678905']).length, 1);
});

test('flavor names fill rows that are waiting for a name, then add new rows', () => {
  const rows = [row('', '600111'), row('', '600222')];
  let next = addFlavorNameToRows(rows, 'Orange');
  next = addFlavorNameToRows(next, 'Mango');
  next = addFlavorNameToRows(next, 'Lemon');
  assert.deepEqual(next.map((r) => [r.flavor, r.barcode]), [
    ['Orange', '600111'], ['Mango', '600222'], ['Lemon', '']
  ]);
  assert.equal(rows[0].flavor, '', 'the original rows are not mutated');
});

test('a flavor name that is already listed is not added twice', () => {
  const rows = [row('Orange', '600111')];
  assert.equal(addFlavorNameToRows(rows, 'orange'), rows);
  assert.equal(addFlavorNameToRows(rows, '  '), rows);
});
