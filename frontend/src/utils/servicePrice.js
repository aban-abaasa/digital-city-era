/**
 * How a service is priced. A product has one price; a service often does not:
 *   fixed - one price                         (price_max empty)
 *   range - "from X to Y"                     (selling_price = X, price_max = Y)
 *   quote - no price until the customer asks  (selling_price 0, price_max empty)
 *
 * selling_price always holds the lowest ("from") price, so everything that already reads it
 * (POS, bookings, reports) keeps working; price_max is the optional top of the range.
 */

const amount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** The pricing mode a saved service is in. */
export const priceModeOf = (item = {}) => {
  const from = amount(item.selling_price ?? item.price);
  const to = amount(item.price_max);
  if (from > 0 && to > from) return 'range';
  return from > 0 ? 'fixed' : 'quote';
};

/** The exact values to save for the chosen mode, or the reason they cannot be saved. */
export const buildServicePricing = ({ mode, from, to }) => {
  if (mode === 'quote') return { selling_price: 0, price_max: null, error: null };

  const low = Number(from);
  if (from === '' || from == null || !Number.isFinite(low) || low < 0) {
    return { field: 'selling_price', error: mode === 'range' ? 'Enter the lowest price' : 'Enter a price' };
  }
  if (mode !== 'range') return { selling_price: low, price_max: null, error: null };

  const high = Number(to);
  if (to === '' || to == null || !Number.isFinite(high)) return { field: 'price_max', error: 'Enter the highest price' };
  if (high <= low) return { field: 'price_max', error: 'The highest price must be more than the lowest' };
  return { selling_price: low, price_max: high, error: null };
};

/** "UGX 20,000", "UGX 20,000 - 50,000" or "Ask for a quote". */
export const servicePriceLabel = (item = {}, currency = 'UGX') => {
  const from = amount(item.selling_price ?? item.price);
  const to = amount(item.price_max);
  const money = (n) => n.toLocaleString('en-US');
  if (from > 0 && to > from) return `${currency} ${money(from)} - ${money(to)}`;
  if (from > 0) return `${currency} ${money(from)}`;
  return 'Ask for a quote';
};

/** Only a single fixed price can be paid for online; a range or a quote is agreed first. */
export const isFixedPriced = (item = {}) => priceModeOf(item) === 'fixed';
