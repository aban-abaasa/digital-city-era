// Selling price, wholesale price and wholesale discount (%) are one relationship seen three
// ways, so whichever the admin types, the other two follow. Each function takes the form's
// current values ({ selling_price, wholesale_price, wholesale_discount_percent }) plus the
// new input and returns the fields to merge in — the percentage is always filled in.

const number = (value) => Number(value) || 0;
const clampPercent = (value) => Math.min(100, Math.max(0, number(value)));

export const wholesaleFromPercent = (sellingPrice, percent) => {
  const selling = number(sellingPrice);
  return selling > 0 ? Math.round(selling * (1 - clampPercent(percent) / 100)) : 0;
};

// Two decimals, so a price typed in by hand survives the round trip through the percentage.
export const percentFromWholesale = (sellingPrice, wholesalePrice) => {
  const selling = number(sellingPrice);
  const wholesale = number(wholesalePrice);
  if (selling <= 0 || wholesale <= 0) return 0;
  return clampPercent(Math.round((1 - wholesale / selling) * 10000) / 100);
};

// A percentage is already set: a new selling price carries the wholesale price with it.
// None yet: the wholesale price stays as typed and the percentage just follows.
export const withSellingPrice = (values, sellingPrice) => {
  const selling = Math.max(0, number(sellingPrice));
  const percent = number(values.wholesale_discount_percent);
  return percent > 0
    ? { selling_price: selling, wholesale_price: wholesaleFromPercent(selling, percent) }
    : { selling_price: selling, wholesale_discount_percent: percentFromWholesale(selling, values.wholesale_price) };
};

export const withWholesalePrice = (values, wholesalePrice) => {
  const wholesale = Math.max(0, number(wholesalePrice));
  return { wholesale_price: wholesale, wholesale_discount_percent: percentFromWholesale(values.selling_price, wholesale) };
};

export const withDiscountPercent = (values, percent) => {
  const clamped = clampPercent(percent);
  return { wholesale_discount_percent: clamped, wholesale_price: wholesaleFromPercent(values.selling_price, clamped) };
};

// For a product that already exists: the percentage its two prices imply.
export const impliedDiscountPercent = (product) => percentFromWholesale(product.selling_price, product.wholesale_price);
