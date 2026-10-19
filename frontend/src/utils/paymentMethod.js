// Payment methods are stored two ways: transactions.payment_method holds an
// id ('cash', 'icanera_wallet', 'ican', 'momo'…) and payment_provider holds
// the display name the cashier saw ('IcanEra Wallet', 'MTN Mobile Money'…).
// Self-checkout and delivery sales write only the id, so screens that read
// payment_provider alone showed nothing for them, and raw ids like 'cash_ugx'
// leaked onto receipts. These helpers turn either value into one readable
// label.

const LABELS = {
  ican: 'IcanEra Wallet',
  icanera: 'IcanEra Wallet',
  icanera_wallet: 'IcanEra Wallet',
  ican_wallet: 'IcanEra Wallet',
  wallet: 'Wallet',
  cash: 'Cash',
  cash_ugx: 'Cash (UGX)',
  cod: 'Cash on Delivery',
  cash_on_delivery: 'Cash on Delivery',
  momo: 'MTN Mobile Money',
  mtn: 'MTN Mobile Money',
  mtn_momo: 'MTN Mobile Money',
  mtn_mobile_money: 'MTN Mobile Money',
  airtel: 'Airtel Money',
  airtel_money: 'Airtel Money',
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank: 'Bank Transfer',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  check: 'Cheque'
};

const keyOf = (value) => String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');

const titleCase = (text) => text.replace(/\b\w/g, (char) => char.toUpperCase());

// Readable name for a payment id or display name; '' when nothing was recorded.
export const formatPaymentMethod = (value) => {
  if (value === null || value === undefined) return '';
  // The cashier portal's method objects look like { id, name }.
  if (typeof value === 'object') return formatPaymentMethod(value.name || value.id);
  const raw = String(value).trim();
  if (!raw) return '';
  const known = LABELS[keyOf(raw)];
  if (known) return known;
  // Already a display name ('Cash (UGX)', 'Visa Card'): leave it alone.
  // Anything lower-case or snake_case is an unmapped id: make it readable.
  const looksLikeId = raw === raw.toLowerCase() || /_/.test(raw);
  return looksLikeId ? titleCase(raw.replace(/[_-]+/g, ' ')) : raw;
};

// Broad family of a payment method, for badge colours.
export const paymentMethodKind = (value) => {
  const label = formatPaymentMethod(value).toLowerCase();
  if (!label) return 'other';
  if (label.startsWith('cash')) return 'cash';
  if (label.includes('mtn')) return 'mtn';
  if (label.includes('airtel')) return 'airtel';
  if (label.includes('wallet')) return 'wallet';
  return 'other';
};
