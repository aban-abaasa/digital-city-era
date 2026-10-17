import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cropKey, comparable, fromBase, marketKey, median, isLive, marketSummaries, verdict, offerVerdict, MIN_SAMPLE, unitName,
  regionOfSubRegion, proximity, catalogUnit, needsRestock, catalogMatch, catalogMargin, formatUgx, offerTotal, readiness,
  closesLabel, postedAgo, describeMarket, describeCatalog, cleanPhone, telLink, whatsappLink, enquiryText, filterOffers, decorate, sortOffers, topMarkets, REGIONS,
} from '../src/utils/farmProduce.js';

const NOW = new Date('2026-10-17T09:00:00Z');
const now = NOW.getTime();
const at = (days) => new Date(now + days * 86400000).toISOString();
let seq = 0;
const offer = (o = {}) => ({ id: `o${++seq}`, farmer_id: `f${seq}`, farmer_name: 'Aisha', contact_phone: '0772123456', status: 'active', expires_at: at(5), created_at: at(-seq / 100), unit: 'kg', quantity: 100, price_per_unit: 1000, crop: 'Maize', region: 'Central', sub_region: 'Buganda North', ...o });
const maize = (...prices) => prices.map((p) => offer({ price_per_unit: p }));

// ── names, units, plurals ───────────────────────────────────────────────────
test('cropKey treats plurals, case and spaces as the same crop', () => {
  assert.equal(cropKey('Tomatoes'), 'tomato');
  assert.equal(cropKey('  sweet   Potatoes'), 'sweet potato');
  assert.equal(cropKey('Passion fruits'), cropKey('passion fruit'));
  assert.equal(cropKey('Cherries'), 'cherry');
  assert.equal(cropKey(undefined), '');
});

test('comparable folds tons into kilograms; an unknown unit is not compared', () => {
  assert.deepEqual(comparable({ quantity: 2, unit: 'ton', price_per_unit: 1_200_000 }), { unit: 'kg', quantity: 2000, price: 1200 });
  assert.equal(comparable({ quantity: 1, unit: 'sack', price_per_unit: 1 }), null);
  assert.equal(fromBase(1200, 'ton'), 1_200_000);
  assert.equal(marketKey({ crop: 'Maize', unit: 'kg', quantity: 1, price_per_unit: 1 }), marketKey({ crop: 'maize', unit: 'ton', quantity: 1, price_per_unit: 1 }));
  assert.equal(marketKey({ crop: '', unit: 'kg', quantity: 1, price_per_unit: 1 }), null);
});

test('unitName and median', () => {
  assert.equal(unitName('bunch', 1), 'bunch');
  assert.equal(unitName('bunch', 40), 'bunches');
  assert.equal(unitName('kg', 2), 'kg');
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

// ── the market ──────────────────────────────────────────────────────────────
test('isLive: active and not past its closing time', () => {
  assert.equal(isLive(offer(), now), true);
  assert.equal(isLive(offer({ expires_at: at(-1) }), now), false);
  assert.equal(isLive(offer({ status: 'paused' }), now), false);
  assert.equal(isLive(offer({ status: 'sold' }), now), false);
});

test('marketSummaries groups live offers by crop and comparison unit', () => {
  const offers = [
    ...maize(900, 1000, 1100),
    offer({ crop: 'maize', price_per_unit: 2_000_000, unit: 'ton', quantity: 2 }),
    offer({ crop: 'Beans', price_per_unit: 3000 }),
    offer({ crop: 'Maize', price_per_unit: 1, expires_at: at(-1) }),
    offer({ crop: 'Maize', price_per_unit: 5, status: 'sold' }),
    offer({ crop: 'Maize', price_per_unit: 100, unit: 'bag' }),
  ];
  const s = marketSummaries(offers, now);
  const m = s.get('maize|kg');
  assert.equal(m.count, 4);
  assert.equal(m.min, 900);
  assert.equal(m.max, 2000);
  assert.equal(m.median, 1050);
  assert.equal(m.totalQuantity, 100 * 3 + 2000);
  assert.equal(m.crop, 'Maize', 'named the way most offers write it');
  assert.equal(s.get('maize|bag').count, 1, 'bags are a market of their own');
  assert.equal(s.get('bean|kg').count, 1);
  assert.equal(s.size, 3);
});

test('verdict needs enough offers; label and number agree at the 10% edge', () => {
  const few = { count: MIN_SAMPLE - 1, median: 1000 };
  const enough = { count: MIN_SAMPLE, median: 1000 };
  assert.equal(verdict(500, few).level, 'unknown');
  assert.equal(verdict(500, null).level, 'unknown');
  assert.equal(verdict(0, enough).level, 'unknown');
  assert.deepEqual(verdict(850, enough), { level: 'below', diffPct: -15 });
  assert.deepEqual(verdict(1500, enough), { level: 'above', diffPct: 50 });
  assert.equal(verdict(1050, enough).level, 'fair');
  assert.equal(verdict(900, enough).level, 'below', 'exactly 10% under is under');
  assert.equal(verdict(1100, enough).level, 'above', 'exactly 10% over is over');
});

test('offerVerdict prices a ton-offer against kilo offers', () => {
  const s = marketSummaries(maize(900, 1000, 1100, 1200), now);
  assert.equal(offerVerdict(offer({ unit: 'ton', price_per_unit: 800_000 }), s).level, 'below');
  assert.equal(offerVerdict(offer({ unit: 'ton', price_per_unit: 1_050_000 }), s).level, 'fair');
  assert.equal(offerVerdict(offer({ crop: 'Cassava' }), s).level, 'unknown');
});

// ── where it is ─────────────────────────────────────────────────────────────
test('proximity: same sub-region, same region, elsewhere, or no area chosen', () => {
  assert.equal(regionOfSubRegion('Ankole'), 'Western');
  assert.equal(regionOfSubRegion('Nowhere'), '');
  const o = offer({ region: 'Western', sub_region: 'Kigezi' });
  assert.equal(proximity(o, 'Kigezi'), 2);
  assert.equal(proximity(o, 'Ankole'), 1);
  assert.equal(proximity(o, 'Acholi'), 0);
  assert.equal(proximity(o, ''), 0);
  assert.equal(proximity(offer({ region: null, sub_region: 'Kigezi' }), 'Tooro'), 1, 'region is worked out from the sub-region when missing');
  for (const [region, subs] of Object.entries(REGIONS)) for (const s of subs) assert.equal(regionOfSubRegion(s), region);
});

// ── the supplier's catalog ──────────────────────────────────────────────────
test('catalogUnit reads plain units and refuses pack sizes', () => {
  for (const [text, unit] of [['kg', 'kg'], ['Per Kg', 'kg'], ['1 kg', 'kg'], ['1kg', 'kg'], ['Kilograms', 'kg'], ['tonne', 'ton'], ['sack', 'bag'], ['1 Bag', 'bag'], ['bunches', 'bunch'], ['Litre', 'litre'], ['L', 'litre'], ['pcs', 'piece']]) {
    assert.equal(catalogUnit(text), unit, text);
  }
  for (const text of ['500g', '10 kg', '1.5kg', 'bag (50kg)', '2 kg', 'unit', '', null, undefined]) assert.equal(catalogUnit(text), null, String(text));
});

test('needsRestock: unavailable, or at/below the minimum stock', () => {
  assert.equal(needsRestock({ is_available: false }), true);
  assert.equal(needsRestock({ is_available: true, stock_quantity: 5, minimum_stock: 10 }), true);
  assert.equal(needsRestock({ is_available: true, stock_quantity: 10, minimum_stock: 10 }), true);
  assert.equal(needsRestock({ is_available: true, stock_quantity: 50, minimum_stock: 10 }), false);
  assert.equal(needsRestock({ is_available: true, stock_quantity: null, minimum_stock: 10 }), false, 'no stock figure: say nothing');
  assert.equal(needsRestock({ is_available: true }), false);
});

const catalog = [
  { id: 'c1', name: 'Fresh Tomatoes', unit: 'kg', price_per_unit: 3000 },
  { id: 'c2', name: 'Tomato', unit: 'crate', price_per_unit: 60000 },
  { id: 'c3', name: 'Green Beans', unit: 'kg', price_per_unit: 5000 },
  { id: 'c4', name: 'Maize', unit: '10 kg', price_per_unit: 12000 },
  { id: 'c5', name: 'Rice', unit: 'kg', price_per_unit: 4500 },
];

test('catalogMatch: exact by crop name, similar when the catalog name has extra words', () => {
  const withoutPlainTomato = catalog.filter((i) => i.id !== 'c2');
  assert.equal(catalogMatch(offer({ crop: 'Tomatoes' }), withoutPlainTomato).kind, 'similar', '"Fresh Tomatoes" is not exactly tomato');
  const exact = catalogMatch(offer({ crop: 'tomatoes', unit: 'kg' }), catalog);
  assert.equal(exact.kind, 'exact', '"Tomato" is');
  assert.equal(exact.item.id, 'c2');
  const beans = catalogMatch(offer({ crop: 'Beans' }), catalog);
  assert.equal(beans.kind, 'similar');
  assert.equal(beans.item.id, 'c3');
  assert.equal(catalogMatch(offer({ crop: 'Cassava' }), catalog), null);
  assert.equal(catalogMatch(offer({ crop: '' }), catalog), null);
  assert.equal(catalogMatch(offer(), null), null);
});

test('catalogMatch prefers the catalog item sold in the same unit', () => {
  const twoTomatoes = [
    { id: 'a', name: 'Tomato', unit: 'crate', price_per_unit: 60000 },
    { id: 'b', name: 'Tomatoes', unit: 'kg', price_per_unit: 3000 },
  ];
  assert.equal(catalogMatch(offer({ crop: 'Tomatoes', unit: 'kg' }), twoTomatoes).item.id, 'b');
  assert.equal(catalogMatch(offer({ crop: 'Tomatoes', unit: 'crate' }), twoTomatoes).item.id, 'a');
});

test('catalogMargin: what the supplier keeps buying at the farmer price and selling at their own', () => {
  const o = offer({ crop: 'Tomatoes', unit: 'kg', price_per_unit: 1200 });
  assert.deepEqual(catalogMargin(o, { unit: 'kg', price_per_unit: 3000 }), { sellPerOfferUnit: 3000, profitPerOfferUnit: 1800, marginPct: 60 });
  // farmer sells by the ton, supplier by the kilo
  const ton = offer({ unit: 'ton', price_per_unit: 1_200_000 });
  assert.deepEqual(catalogMargin(ton, { unit: 'kg', price_per_unit: 3000 }), { sellPerOfferUnit: 3_000_000, profitPerOfferUnit: 1_800_000, marginPct: 60 });
  // buying above the shelf price is a negative margin, not hidden
  assert.equal(catalogMargin(offer({ price_per_unit: 4000 }), { unit: 'kg', price_per_unit: 3000 }).marginPct, -33);
  // units that cannot be compared
  assert.equal(catalogMargin(offer({ unit: 'bag' }), { unit: 'kg', price_per_unit: 3000 }), null);
  assert.equal(catalogMargin(o, { unit: '500g', price_per_unit: 3000 }), null);
  assert.equal(catalogMargin(o, { unit: 'kg', price_per_unit: null }), null);
  assert.equal(catalogMargin(o, null), null);
});

// ── showing, filtering, ranking ─────────────────────────────────────────────
test('money, totals and phone links', () => {
  assert.equal(formatUgx(1234567.4), 'UGX 1,234,567');
  assert.equal(offerTotal({ quantity: 50, price_per_unit: 1200 }), 60000);
  assert.equal(offerTotal({ quantity: 0, price_per_unit: 1200 }), 0);
  assert.equal(cleanPhone('+256 772 123-456'), '+256772123456');
  assert.equal(telLink('0772 123 456'), 'tel:0772123456');
  assert.equal(whatsappLink('0772 123 456'), 'https://wa.me/256772123456');
  assert.equal(whatsappLink('+256772123456', 'Hi there'), 'https://wa.me/256772123456?text=Hi%20there');
  assert.equal(whatsappLink('256772123456'), 'https://wa.me/256772123456');
});

test('enquiryText names the farmer, the produce and the price', () => {
  const text = enquiryText(offer({ farmer_name: 'Joel', crop: 'Beans', quantity: 40, unit: 'bag', price_per_unit: 210000 }), 'Kato Traders');
  assert.equal(text, 'Hello Joel, this is Kato Traders. I saw your Beans on Digital City Era — 40 bags at UGX 210,000 per bag. Is it still available?');
  assert.ok(!enquiryText(offer(), '').includes('this is'));
});

test('readiness, closing time and "posted ago"', () => {
  assert.deepEqual(readiness(offer({ ready_date: null }), NOW), { now: true, label: 'Ready now', date: null });
  assert.equal(readiness(offer({ ready_date: '2026-10-17' }), NOW).now, true);
  assert.deepEqual(readiness(offer({ ready_date: '2026-10-25' }), NOW), { now: false, label: 'Ready from 2026-10-25', date: '2026-10-25' });
  assert.equal(closesLabel(offer({ expires_at: at(-1) }), now), 'closed');
  assert.equal(closesLabel(offer({ expires_at: at(0.5) }), now), 'closes today');
  assert.equal(closesLabel(offer({ expires_at: at(1) }), now), '1 day left');
  assert.equal(closesLabel(offer({ expires_at: at(2.3) }), now), '3 days left');
  assert.equal(postedAgo(at(0), now), 'just now');
  assert.equal(postedAgo(new Date(now - 5 * 60000).toISOString(), now), '5 min ago');
  assert.equal(postedAgo(new Date(now - 3 * 3600000).toISOString(), now), '3 h ago');
  assert.equal(postedAgo(new Date(now - 2 * 86400000).toISOString(), now), '2 days ago');
});

const board = () => {
  const offers = [
    offer({ id: 'cheap', crop: 'Maize', price_per_unit: 800, created_at: at(-3), sub_region: 'Acholi', region: 'Northern', quantity: 50 }),
    offer({ id: 'fair', crop: 'Maize', price_per_unit: 1000, created_at: at(-2), sub_region: 'Buganda North', quantity: 5000 }),
    offer({ id: 'mid', crop: 'Maize', price_per_unit: 1050, created_at: at(-1), sub_region: 'Buganda South', is_organic: true }),
    offer({ id: 'dear', crop: 'Maize', price_per_unit: 1500, created_at: at(-0.5), sub_region: 'Kigezi', region: 'Western', ready_date: '2026-10-30' }),
    offer({ id: 'lone', crop: 'Cassava', price_per_unit: 400, created_at: at(-0.1), sub_region: 'Buganda North', unit: 'ton', quantity: 3 }),
    offer({ id: 'gone', crop: 'Maize', price_per_unit: 1, expires_at: at(-1) }),
  ];
  const catalog = [{ id: 'c', name: 'Maize', unit: 'kg', price_per_unit: 1400, stock_quantity: 2, minimum_stock: 10, is_available: true }];
  return decorate(offers, { catalog, area: 'Buganda North', now });
};

test('decorate works out what the board shows, and drops closed offers', () => {
  const d = board();
  assert.equal(d.length, 5);
  assert.ok(!d.some((x) => x.offer.id === 'gone'));
  const by = Object.fromEntries(d.map((x) => [x.offer.id, x]));
  assert.equal(by.cheap.verdict.level, 'below');
  assert.equal(by.dear.verdict.level, 'above');
  assert.equal(by.fair.verdict.level, 'fair');
  assert.equal(by.lone.verdict.level, 'unknown', 'one cassava offer is not a market');
  assert.equal(by.fair.near, 2);
  assert.equal(by.mid.near, 1);
  assert.equal(by.cheap.near, 0);
  assert.equal(by.dear.ready.now, false);
  assert.equal(by.cheap.match.kind, 'exact');
  assert.equal(by.cheap.restock, true, 'catalog Maize is below its minimum stock');
  assert.equal(by.cheap.margin.marginPct, 43);
  assert.equal(by.lone.match, null);
  assert.equal(by.lone.margin, null);
  assert.equal(by.fair.total, 5_000_000);
});

test('filterOffers', () => {
  const d = board();
  const ids = (f) => filterOffers(d, f).map((x) => x.offer.id).sort();
  assert.deepEqual(ids({}), ['cheap', 'dear', 'fair', 'lone', 'mid']);
  assert.deepEqual(ids({ search: 'cassava' }), ['lone']);
  assert.deepEqual(ids({ search: ' KIGEZI ' }), ['dear'], 'matches the place too');
  assert.deepEqual(ids({ organic: true }), ['mid']);
  assert.deepEqual(ids({ readyNow: true }), ['cheap', 'fair', 'lone', 'mid']);
  assert.deepEqual(ids({ inCatalog: true }), ['cheap', 'dear', 'fair', 'mid']);
  // an offer that is only *similar* to a catalog item ("Beans" vs "Green Beans") is not "in my catalog"
  const withBeans = decorate([offer({ id: 'beans', crop: 'Beans' }), offer({ id: 'veg', crop: 'Maize' })], { catalog: [{ name: 'Green Beans', unit: 'kg', price_per_unit: 5000 }, { name: 'Maize', unit: 'kg', price_per_unit: 1400 }], now });
  assert.equal(withBeans.find((x) => x.offer.id === 'beans').match.kind, 'similar');
  assert.deepEqual(filterOffers(withBeans, { inCatalog: true }).map((x) => x.offer.id), ['veg']);
  assert.deepEqual(ids({ onlyArea: true, area: 'Buganda North' }), ['fair', 'lone', 'mid'], 'only this sub-region or its region');
  assert.deepEqual(ids({ onlyArea: true, area: '' }), ['cheap', 'dear', 'fair', 'lone', 'mid'], 'no area chosen: nothing is hidden');
  assert.deepEqual(ids({ search: 'maize', organic: true, readyNow: true }), ['mid']);
});

test('sortOffers', () => {
  // Fixture: maize at 800 / 1000 / 1050 / 1500 (median 1025), one cassava offer.
  //   area Buganda North -> fair & lone are 2 (same sub-region), mid is 1 (same region), dear & cheap are 0
  //   base quantity      -> fair 5000, lone 3000 (3 tons), then mid & dear 100 each, cheap 50
  const d = board();
  const ids = (sort) => sortOffers(d, sort).map((x) => x.offer.id);
  assert.deepEqual(ids('best'), ['cheap', 'fair', 'mid', 'dear', 'lone'], 'furthest under market first; the lone cassava offer has nothing to compare with, so last');
  assert.deepEqual(ids('newest'), ['lone', 'dear', 'mid', 'fair', 'cheap']);
  assert.deepEqual(ids('nearest'), ['lone', 'fair', 'mid', 'dear', 'cheap'], 'same sub-region (newest first), same region, then the rest');
  assert.deepEqual(ids('biggest'), ['fair', 'lone', 'dear', 'mid', 'cheap'], 'tons are counted as kilograms; ties go to the newest');
  assert.deepEqual(ids('nonsense'), ids('newest'), 'an unknown sort falls back to newest');
  assert.deepEqual(d.map((x) => x.offer.id), board().map((x) => x.offer.id), 'sorting does not reorder the input');
});

test('describeMarket says how a price compares, and admits when it cannot', () => {
  const s = marketSummaries(maize(900, 1000, 1100, 1200), now).get('maize|kg');
  const o = offer({ price_per_unit: 800 });
  assert.equal(describeMarket(o, s, verdict(800, s)),
    'Typical Maize price is UGX 1,050 per kg across 4 offers (from UGX 900 to UGX 1,200). This one is 24% under.');
  assert.match(describeMarket(o, s, verdict(1500, s)), /This one is 43% over\.$/);
  assert.match(describeMarket(o, s, verdict(1050, s)), /This one is in line\.$/);
  const ton = offer({ unit: 'ton', price_per_unit: 1_000_000 });
  assert.match(describeMarket(ton, s, verdict(1000, s)), /UGX 1,050,000 per ton/, 'said in the offer\'s own unit');
  const one = marketSummaries([offer()], now).get('maize|kg');
  assert.equal(describeMarket(offer(), one, verdict(1000, one)), 'This is the only Maize offer right now, so there is nothing to compare it with.');
  const two = marketSummaries(maize(900, 1000), now).get('maize|kg');
  assert.equal(describeMarket(offer(), two, verdict(1000, two)), '2 Maize offers right now: too few to say what a typical price is.');
  assert.equal(describeMarket(offer(), null, verdict(1000, null)), '');
});

test('describeCatalog explains the match and the margin in plain money', () => {
  const o = offer({ crop: 'Maize', price_per_unit: 1000 });
  const item = { name: 'Maize', unit: 'kg', price_per_unit: 1400 };
  assert.equal(describeCatalog(o, { kind: 'exact', item }, catalogMargin(o, item)),
    'In your catalog as “Maize” at UGX 1,400 per kg. Buying at this price leaves UGX 400 per kg (29% of your price).');
  const dear = offer({ price_per_unit: 1600 });
  assert.equal(describeCatalog(dear, { kind: 'exact', item }, catalogMargin(dear, item)),
    'In your catalog as “Maize” at UGX 1,400 per kg: this offer costs UGX 200 per kg more than you sell it for.');
  const pack = { name: 'Maize', unit: '10 kg', price_per_unit: 12000 };
  assert.match(describeCatalog(o, { kind: 'exact', item: pack }, null), /different unit/);
  assert.match(describeCatalog(o, { kind: 'similar', item: { name: 'Green Beans' } }, null), /similar item, “Green Beans”/);
  assert.equal(describeCatalog(o, null, null), '');
});

test('topMarkets lists the busiest crops first', () => {
  const tops = topMarkets(marketSummaries([...maize(1, 2, 3), offer({ crop: 'Beans' }), ...Array.from({ length: 2 }, () => offer({ crop: 'Rice' }))], now), 2);
  assert.deepEqual(tops.map((t) => t.crop), ['Maize', 'Rice']);
});
