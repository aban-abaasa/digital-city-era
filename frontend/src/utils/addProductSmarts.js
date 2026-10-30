// The "smart" part of the Add Products page, kept free of React so it can be tested:
// spotting a product that is already listed, guessing a category from the name, turning a
// margin into a selling price, and checking the rows of the quick list before they are saved.

// "  Rice - 1KG  " and "rice 1kg" are the same product to a shopkeeper.
export const normalizeName = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// A trailing "s" should not make "tomato" and "tomatoes" look unrelated.
const stem = (word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

const wordsOf = (name) => normalizeName(name).split(' ').filter(Boolean).map(stem);

// Products already in the shop that look like the one being typed: the exact same name first
// ('same'), then names that start with it or contain it ('similar'). Needs 3+ letters so that
// typing "r" does not flag the whole shelf.
export const findSimilarProducts = (name, products, limit = 3) => {
  const typed = normalizeName(name);
  if (typed.length < 3 || !Array.isArray(products)) return [];

  const same = [];
  const similar = [];
  for (const product of products) {
    const existing = normalizeName(product?.name);
    if (!existing) continue;
    if (existing === typed) same.push({ product, kind: 'same' });
    else if (existing.startsWith(typed) || typed.startsWith(existing) || existing.includes(typed)) {
      similar.push({ product, kind: 'similar' });
    }
  }
  return [...same, ...similar].slice(0, limit);
};

// Which category fits this name? First a category the name mentions ("Fresh Milk 500ml" ->
// the category called Milk), otherwise the category most often used by products that start
// with the same word ("Rice 5kg" -> where "Rice 1kg" was put). null when unsure.
export const suggestCategoryId = (name, products, categories) => {
  const typedWords = wordsOf(name);
  if (typedWords.length === 0) return null;

  for (const category of categories || []) {
    const categoryWords = wordsOf(category?.name);
    if (categoryWords.length > 0 && categoryWords.every((word) => word.length >= 3 && typedWords.includes(word))) {
      return category.id;
    }
  }

  const first = typedWords[0];
  if (first.length < 3) return null;
  const tally = new Map();
  for (const product of products || []) {
    if (!product?.category_id) continue;
    if (wordsOf(product.name)[0] === first) tally.set(product.category_id, (tally.get(product.category_id) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [id, count] of tally) {
    if (count > bestCount) { best = id; bestCount = count; }
  }
  return best;
};

// Selling price for a wanted margin on the cost, rounded UP to the next 100 so nobody ends up
// selling a 1,234.5 shilling item. 0 when there is no cost to work from.
export const priceFromMargin = (cost, marginPercent) => {
  const base = Number(cost);
  if (!(base > 0)) return 0;
  const raw = base * (1 + Math.max(0, Number(marginPercent) || 0) / 100);
  return Math.ceil(raw / 100) * 100;
};

// Profit as a percentage of the cost (what the page shows), or null with no cost.
export const marginPercent = (cost, selling) => {
  const base = Number(cost);
  if (!(base > 0)) return null;
  return ((Number(selling) - base) / base) * 100;
};

let rowCounter = 0;
export const newQuickRow = () => ({ id: `q${Date.now().toString(36)}${rowCounter++}`, name: '', price: '', cost: '', stock: '' });

const isBlankRow = (row) => ['name', 'price', 'cost', 'stock'].every((field) => !String(row[field] ?? '').trim());

// Splits the quick list into rows ready to save and rows with a problem. Completely empty rows
// are ignored; a row needs a name and a price above zero (cost and stock are optional). Names repeated inside the list or
// already in the shop are reported too, because saving them would create a second copy.
export const checkQuickRows = (rows, products = []) => {
  const ready = [];
  const issues = {};
  const seen = new Map();

  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const name = String(row.name ?? '').trim();
    const price = Number(row.price);
    const stock = String(row.stock ?? '').trim() === '' ? 0 : Number(row.stock);
    const cost = String(row.cost ?? '').trim() === '' ? 0 : Number(row.cost);

    if (!name) { issues[row.id] = 'Add a name'; continue; }
    if (!(price > 0)) { issues[row.id] = 'Add a price'; continue; }
    if (!Number.isFinite(cost) || cost < 0) { issues[row.id] = 'Cost must be 0 or more'; continue; }
    if (!Number.isFinite(stock) || stock < 0) { issues[row.id] = 'Stock must be 0 or more'; continue; }

    const key = normalizeName(name);
    if (seen.has(key)) { issues[row.id] = 'Listed twice here'; continue; }
    seen.set(key, row.id);

    if (findSimilarProducts(name, products, 5).some((match) => match.kind === 'same')) {
      issues[row.id] = 'Already in your shop';
      continue;
    }
    ready.push({ id: row.id, name, selling_price: price, cost_price: cost, initial_stock: Math.floor(stock) });
  }
  return { ready, issues };
};
