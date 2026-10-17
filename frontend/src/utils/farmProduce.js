/**
 * Farm produce for suppliers: what farmers (in the AgriBone / farm-agentera app)
 * have on offer and at what price, read from `farm_produce_offers`.
 *
 * Plain functions only (no React, no Supabase) so the rules can be tested alone.
 * Everything "smart" is arithmetic on the live offers and the supplier's own
 * catalog — a median, a range, a margin — and the screen says how many offers a
 * figure comes from. Nothing here is a forecast.
 *
 * The market arithmetic (cropKey, comparable, benchmark, verdict) matches
 * farm-agentera/frontend/src/utils/produceOffers.js on purpose, so a farmer and a
 * supplier looking at the same offers agree on what "typical" means. Keep them in step.
 */

// ── vocabulary ───────────────────────────────────────────────────────────────

/** UBOS sub-regions of Uganda, grouped by region (same names the farmers choose from). */
export const REGIONS = {
  Central: ['Kampala', 'Buganda North', 'Buganda South'],
  Eastern: ['Busoga', 'Bukedi', 'Bugisu', 'Teso', 'Karamoja'],
  Northern: ['Lango', 'Acholi', 'West Nile'],
  Western: ['Bunyoro', 'Tooro', 'Ankole', 'Kigezi'],
};

/** How many other offers it takes before a figure is called "typical". */
export const MIN_SAMPLE = 3;

const DAY = 24 * 60 * 60 * 1000;

// Prices are only comparable in the same unit; tons are folded into kilograms.
const BASE = {
  kg: { base: 'kg', factor: 1 },
  ton: { base: 'kg', factor: 1000 },
  bag: { base: 'bag', factor: 1 },
  crate: { base: 'crate', factor: 1 },
  bunch: { base: 'bunch', factor: 1 },
  basket: { base: 'basket', factor: 1 },
  tray: { base: 'tray', factor: 1 },
  piece: { base: 'piece', factor: 1 },
  litre: { base: 'litre', factor: 1 },
};

const NAMES = {
  kg: ['kg', 'kg'], ton: ['ton', 'tons'], bag: ['bag', 'bags'], crate: ['crate', 'crates'], bunch: ['bunch', 'bunches'],
  basket: ['basket', 'baskets'], tray: ['tray', 'trays'], piece: ['piece', 'pieces'], litre: ['litre', 'litres'],
};

/** "1 bunch", "40 bunches". */
export const unitName = (unit, quantity = 1) => {
  const names = NAMES[unit];
  if (!names) return String(unit ?? '');
  return Number(quantity) === 1 ? names[0] : names[1];
};

const singular = (word) => {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};

const tokens = (name) => String(name ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .map(singular);

/** "Sweet Potatoes " and "sweet potato" are the same crop. */
export const cropKey = (name) => tokens(name).join(' ');

/** The offer's price and quantity in the unit prices are compared in, or null for an unknown unit. */
export const comparable = ({ quantity, unit, price_per_unit: price }) => {
  const b = BASE[unit];
  const q = Number(quantity);
  const p = Number(price);
  if (!b || !Number.isFinite(q) || !Number.isFinite(p)) return null;
  return { unit: b.base, quantity: q * b.factor, price: p / b.factor };
};

/** A comparison-unit price shown in another unit (UGX 1,000/kg -> UGX 1,000,000/ton). */
export const fromBase = (price, unit) => price * (BASE[unit]?.factor ?? 1);

export const marketKey = (offer) => {
  const c = comparable(offer);
  const crop = cropKey(offer.crop);
  return c && crop ? `${crop}|${c.unit}` : null;
};

export const median = (numbers) => {
  const sorted = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Is this offer still in front of suppliers? (The database enforces the same rule.) */
export const isLive = (offer, now = Date.now()) =>
  offer.status === 'active' && new Date(offer.expires_at).getTime() > now;

// ── the market ───────────────────────────────────────────────────────────────

const summarisePrices = (rows) => {
  const prices = rows.map((r) => r.price);
  return {
    count: rows.length,
    totalQuantity: rows.reduce((sum, r) => sum + r.quantity, 0),
    min: Math.min(...prices),
    max: Math.max(...prices),
    median: median(prices),
  };
};

/**
 * Figures for every crop+unit across the live offers, keyed by marketKey().
 * Each: { key, crop (as most often written), unit, count, totalQuantity, min, max, median }.
 */
export const marketSummaries = (offers, now = Date.now()) => {
  const groups = new Map();
  for (const offer of offers) {
    if (!isLive(offer, now)) continue;
    const key = marketKey(offer);
    const c = comparable(offer);
    if (!key || !c || !(c.price > 0)) continue;
    if (!groups.has(key)) groups.set(key, { rows: [], names: new Map(), unit: c.unit });
    const g = groups.get(key);
    g.rows.push(c);
    const name = String(offer.crop).trim();
    g.names.set(name, (g.names.get(name) || 0) + 1);
  }
  const out = new Map();
  for (const [key, g] of groups) {
    const crop = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.set(key, { key, crop, unit: g.unit, ...summarisePrices(g.rows) });
  }
  return out;
};

/**
 * Where a price sits against the median of the live offers for that crop.
 *   unknown — fewer than MIN_SAMPLE offers
 *   below / fair / above — at least `tolerance` under, within, or at least over the median
 * Classified on the whole percentage that is shown, so the label and the number never disagree.
 */
export const verdict = (price, summary, tolerance = 0.1) => {
  if (!summary || summary.count < MIN_SAMPLE || !(price > 0) || !(summary.median > 0)) {
    return { level: 'unknown', diffPct: null };
  }
  const diffPct = Math.round((price / summary.median - 1) * 100);
  const limit = Math.round(tolerance * 100);
  if (diffPct <= -limit) return { level: 'below', diffPct };
  if (diffPct >= limit) return { level: 'above', diffPct };
  return { level: 'fair', diffPct };
};

/** The verdict for one offer against the summaries from marketSummaries(). */
export const offerVerdict = (offer, summaries) => {
  const key = marketKey(offer);
  const c = comparable(offer);
  return verdict(c?.price, key ? summaries.get(key) : null);
};

// ── where it is ──────────────────────────────────────────────────────────────

export const regionOfSubRegion = (subRegion) =>
  Object.keys(REGIONS).find((r) => REGIONS[r].includes(subRegion)) || '';

/**
 * How close an offer is to the supplier's chosen sub-region:
 *   2 same sub-region · 1 same region · 0 elsewhere (or no area chosen)
 */
export const proximity = (offer, area) => {
  if (!area) return 0;
  if (offer.sub_region && offer.sub_region === area) return 2;
  const region = regionOfSubRegion(area);
  if (region && (offer.region === region || regionOfSubRegion(offer.sub_region) === region)) return 1;
  return 0;
};

export const PROXIMITY_LABEL = { 2: 'In your area', 1: 'In your region' };

// ── the supplier's own catalog ───────────────────────────────────────────────

/**
 * The comparison unit a catalog item's free-text unit means ("kg", "Per Kg", "1 bag",
 * "tonne"), or null when it is a pack size or something we can't read ("500g", "2kg", "unit").
 */
export const catalogUnit = (text) => {
  let t = String(text ?? '').toLowerCase().replace(/\bper\b/g, ' ').trim();
  t = t.replace(/^1(?![0-9.,])\s*/, ''); // "1 kg" and "1kg" mean one kilogram...
  if (/[0-9]/.test(t)) return null; // ...but "500g", "10 kg" or "bag (50kg)" are pack sizes
  t = t.replace(/[^a-z]/g, '');
  const map = {
    kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
    ton: 'ton', tons: 'ton', tonne: 'ton', tonnes: 'ton',
    bag: 'bag', bags: 'bag', sack: 'bag', sacks: 'bag',
    crate: 'crate', crates: 'crate', bunch: 'bunch', bunches: 'bunch', basket: 'basket', baskets: 'basket',
    tray: 'tray', trays: 'tray', piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece',
    litre: 'litre', litres: 'litre', liter: 'litre', liters: 'litre', l: 'litre',
  };
  return map[t] ?? null;
};

/** Low or out of stock — the signal that a farmer's offer could refill it. */
export const needsRestock = (item) => {
  if (item.is_available === false) return true;
  const stock = Number(item.stock_quantity);
  const floor = Number(item.minimum_stock);
  return item.stock_quantity != null && item.minimum_stock != null && Number.isFinite(stock) && Number.isFinite(floor) && stock <= floor;
};

/**
 * Which of the supplier's catalog items an offer is.
 *   exact   — same crop name ("Tomatoes" = "tomato")
 *   similar — the catalog name contains the crop plus other words ("Green beans" for "Beans");
 *             a different product more often than not, so no margin is worked out for it
 */
export const catalogMatch = (offer, catalog) => {
  const want = tokens(offer.crop);
  if (!want.length || !Array.isArray(catalog)) return null;
  const wantKey = want.join(' ');
  const exact = [];
  const similar = [];
  for (const item of catalog) {
    const have = tokens(item.name);
    if (!have.length) continue;
    if (have.join(' ') === wantKey) exact.push(item);
    else if (want.every((w) => have.includes(w))) similar.push(item);
  }
  const wantBase = BASE[offer.unit]?.base;
  const sameUnit = (item) => BASE[catalogUnit(item.unit)]?.base === wantBase;
  const pick = (list) => list.find(sameUnit) || list[0];
  if (exact.length) return { kind: 'exact', item: pick(exact) };
  if (similar.length) return { kind: 'similar', item: pick(similar) };
  return null;
};

/**
 * What the supplier would make buying this offer at the farmer's price and selling at
 * their own catalog price, per unit of the offer. Null when the units can't be compared
 * or the catalog has no price.
 */
export const catalogMargin = (offer, item) => {
  const sellUnit = catalogUnit(item?.unit);
  const buy = comparable(offer);
  const sell = Number(item?.price_per_unit);
  if (!sellUnit || !buy || !(sell > 0) || BASE[sellUnit].base !== buy.unit) return null;
  const sellBase = sell / BASE[sellUnit].factor;
  const perBaseUnit = sellBase - buy.price;
  return {
    sellPerOfferUnit: fromBase(sellBase, offer.unit),
    profitPerOfferUnit: fromBase(perBaseUnit, offer.unit),
    marginPct: Math.round((perBaseUnit / sellBase) * 100),
  };
};

// ── showing, filtering, ranking ──────────────────────────────────────────────

export const formatUgx = (n) => `UGX ${Math.round(Number(n) || 0).toLocaleString('en-UG')}`;

// ── saying it in words ───────────────────────────────────────────────────────

const perUnit = (offer, price) => `${formatUgx(fromBase(price, offer.unit))} per ${unitName(offer.unit)}`;

/** One or two sentences on how an offer's price compares with the other live offers for the crop. */
export const describeMarket = (offer, summary, v) => {
  if (!summary) return '';
  if (summary.count < MIN_SAMPLE) {
    return summary.count === 1
      ? `This is the only ${offer.crop} offer right now, so there is nothing to compare it with.`
      : `${summary.count} ${offer.crop} offers right now: too few to say what a typical price is.`;
  }
  const typical = `Typical ${offer.crop} price is ${perUnit(offer, summary.median)} across ${summary.count} offers (from ${formatUgx(fromBase(summary.min, offer.unit))} to ${formatUgx(fromBase(summary.max, offer.unit))}).`;
  if (v.level === 'below') return `${typical} This one is ${Math.abs(v.diffPct)}% under.`;
  if (v.level === 'above') return `${typical} This one is ${v.diffPct}% over.`;
  return `${typical} This one is in line.`;
};

/** What the supplier's own catalog says about an offer: the match, and the margin when it can be worked out. */
export const describeCatalog = (offer, match, margin) => {
  if (!match) return '';
  const name = match.item.name;
  if (match.kind === 'similar') return `You list a similar item, “${name}”. It may be a different product, so no margin is worked out.`;
  if (!margin) return `In your catalog as “${name}”, sold in a different unit, so no margin is worked out.`;
  const unit = unitName(offer.unit);
  if (margin.profitPerOfferUnit < 0) {
    return `In your catalog as “${name}” at ${formatUgx(margin.sellPerOfferUnit)} per ${unit}: this offer costs ${formatUgx(-margin.profitPerOfferUnit)} per ${unit} more than you sell it for.`;
  }
  return `In your catalog as “${name}” at ${formatUgx(margin.sellPerOfferUnit)} per ${unit}. Buying at this price leaves ${formatUgx(margin.profitPerOfferUnit)} per ${unit} (${margin.marginPct}% of your price).`;
};


export const offerTotal = (offer) => {
  const q = Number(offer.quantity);
  const p = Number(offer.price_per_unit);
  return q > 0 && p > 0 ? q * p : 0;
};

/** Ready now, or the date it will be. */
export const readiness = (offer, today = new Date()) => {
  const iso = today.toISOString().slice(0, 10);
  if (offer.ready_date && offer.ready_date > iso) return { now: false, label: `Ready from ${offer.ready_date}`, date: offer.ready_date };
  return { now: true, label: 'Ready now', date: null };
};

/** "closes today", "2 days left". */
export const closesLabel = (offer, now = Date.now()) => {
  const left = new Date(offer.expires_at).getTime() - now;
  if (!(left > 0)) return 'closed';
  if (left < DAY) return 'closes today';
  const days = Math.ceil(left / DAY);
  return `${days} day${days === 1 ? '' : 's'} left`;
};

/** How long ago something was posted, in plain words. */
export const postedAgo = (iso, now = Date.now()) => {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

/** Digits with an optional leading +. */
export const cleanPhone = (phone) => {
  const raw = String(phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  return raw.startsWith('+') ? `+${digits}` : digits;
};

export const telLink = (phone) => `tel:${cleanPhone(phone)}`;

/** wa.me wants the number in international form: 0772… becomes 256772…. */
export const whatsappLink = (phone, text = '') => {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = `256${digits.slice(1)}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
};

/** The first line of a WhatsApp message to a farmer about an offer. */
export const enquiryText = (offer, who) =>
  `Hello ${offer.farmer_name}, ${who ? `this is ${who}. ` : ''}I saw your ${offer.crop} on Digital City Era — ${Number(offer.quantity).toLocaleString('en-UG')} ${unitName(offer.unit, offer.quantity)} at ${formatUgx(offer.price_per_unit)} per ${unitName(offer.unit)}. Is it still available?`;

/**
 * Narrow the offers. filters: { search, area, onlyArea, organic, readyNow, inCatalog }
 * `decorated` offers carry what the board worked out for them (see decorate()).
 */
export const filterOffers = (decorated, { search = '', organic = false, readyNow = false, inCatalog = false, onlyArea = false, area = '' } = {}) => {
  const q = String(search).trim().toLowerCase();
  return decorated.filter(({ offer, ready, match, near }) => {
    if (q) {
      const hay = [offer.crop, offer.farmer_name, offer.district, offer.sub_region, offer.region, offer.notes].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (organic && !offer.is_organic) return false;
    if (readyNow && !ready.now) return false;
    if (inCatalog && match?.kind !== 'exact') return false; // a merely similar item isn't "in my catalog"
    if (onlyArea && area && near === 0) return false;
    return true;
  });
};

/** Work out, once per offer, everything the board shows about it. */
export const decorate = (offers, { catalog = [], area = '', now = Date.now(), today = new Date(now) } = {}) => {
  const summaries = marketSummaries(offers, now);
  return offers.filter((o) => isLive(o, now)).map((offer) => {
    const match = catalogMatch(offer, catalog);
    return {
      offer,
      verdict: offerVerdict(offer, summaries),
      summary: summaries.get(marketKey(offer)) || null,
      ready: readiness(offer, today),
      near: proximity(offer, area),
      match,
      margin: match?.kind === 'exact' ? catalogMargin(offer, match.item) : null,
      restock: match?.kind === 'exact' ? needsRestock(match.item) : false,
      total: offerTotal(offer),
    };
  });
};

export const SORTS = [
  { value: 'best', label: 'Best deal' },
  { value: 'newest', label: 'Newest' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'biggest', label: 'Biggest' },
];

const newest = (a, b) => new Date(b.offer.created_at) - new Date(a.offer.created_at);

/**
 * Order decorated offers.
 *   best    — furthest under the typical price first (offers with too few rivals to compare go last, newest first)
 *   newest  — most recently posted
 *   nearest — same sub-region, then same region, then the rest; newest first within each
 *   biggest — most quantity, counted in the comparison unit (a ton is 1,000 kg)
 */
export const sortOffers = (decorated, sort = 'newest') => {
  const list = [...decorated];
  if (sort === 'best') {
    return list.sort((a, b) => {
      const da = a.verdict.diffPct;
      const db = b.verdict.diffPct;
      if (da == null && db == null) return newest(a, b);
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db || newest(a, b);
    });
  }
  if (sort === 'nearest') return list.sort((a, b) => b.near - a.near || newest(a, b));
  if (sort === 'biggest') return list.sort((a, b) => (comparable(b.offer)?.quantity ?? 0) - (comparable(a.offer)?.quantity ?? 0) || newest(a, b));
  return list.sort(newest);
};

/** The crops with most offers first, for the market strip. */
export const topMarkets = (summaries, limit = 8) =>
  [...summaries.values()].sort((a, b) => b.count - a.count || b.totalQuantity - a.totalQuantity || a.crop.localeCompare(b.crop)).slice(0, limit);
