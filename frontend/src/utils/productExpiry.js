// Shared expiry / reduced-price helpers for products.
// Backed by products.expiry_date and the clearance_* columns from
// backend/database/migrations/ADD_PRODUCT_EXPIRY_CLEARANCE_PRICING.sql.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// expiry_date is a DATE ("YYYY-MM-DD"). Build it as a local calendar date;
// `new Date('2026-10-05')` would be UTC midnight and read a day early in
// timezones behind UTC.
export const parseExpiryDate = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

// Whole days from today until the expiry date: 0 = expires today, negative = expired.
export const daysUntilExpiry = (value, now = new Date()) => {
  const expiry = parseExpiryDate(value);
  if (!expiry) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry - today) / MS_PER_DAY);
};

export const formatExpiryDate = (value) => {
  const expiry = parseExpiryDate(value);
  if (!expiry) return '';
  return expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// key: none | expired | critical (<= 7 days) | soon (<= 30 days) | ok
export const getExpiryStatus = (value, now = new Date()) => {
  const days = daysUntilExpiry(value, now);
  if (days === null) return { key: 'none', days: null, label: 'No expiry' };
  if (days < 0) return { key: 'expired', days, label: days === -1 ? 'Expired yesterday' : `Expired ${-days}d ago` };
  if (days === 0) return { key: 'critical', days, label: 'Expires today' };
  if (days === 1) return { key: 'critical', days, label: 'Expires tomorrow' };
  if (days <= 7) return { key: 'critical', days, label: `${days} days left` };
  if (days <= 30) return { key: 'soon', days, label: `${days} days left` };
  return { key: 'ok', days, label: `${days} days left` };
};

// A starting point for the admin; they can change it before publishing.
export const suggestedDiscountPercent = (days) => {
  if (days === null || days === undefined) return 10;
  if (days <= 3) return 50;
  if (days <= 7) return 30;
  if (days <= 14) return 20;
  return 10;
};

// On offer = an original price is parked AND the live price is actually lower.
export const isOnClearance = (product) =>
  product?.clearance_original_price != null
  && Number(product.clearance_original_price) > Number(product.selling_price);

export const clearanceDiscountPercent = (product) => {
  if (!isOnClearance(product)) return 0;
  const original = Number(product.clearance_original_price);
  return Math.round((1 - Number(product.selling_price) / original) * 100);
};

// Price after taking `percent` off, in whole shillings (matches the database).
export const priceAfterDiscount = (basePrice, percent) =>
  Math.round(Number(basePrice) * (1 - Number(percent) / 100));
