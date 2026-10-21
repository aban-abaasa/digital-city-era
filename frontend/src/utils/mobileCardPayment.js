// "IcanEra Mobile / Card": a POS customer with no IcanEra account pays with
// Mobile Money or a card through Flutterwave and the money is credited straight
// into the store's IcanEra wallet (see icanMobileCardService.js and
// ADD_ICAN_MOBILE_CARD_PAYMENTS.sql). These are the small pure rules the cashier
// screen and the customer's pay page share.

export const MOBILE_CARD_METHOD_ID = 'icanera_mobile_card';
export const MOBILE_CARD_METHOD_NAME = 'IcanEra Mobile / Card';

// Same limits the database enforces (imc_pay_create): Flutterwave will not take
// a charge below ~UGX 500, and one sale is capped like the other guest payments.
export const MOBILE_CARD_MIN_UGX = 500;
export const MOBILE_CARD_MAX_UGX = 5000000;

// Why a sale of this size cannot be paid this way (null = it can).
export const mobileCardAmountProblem = (amountUGX) => {
  const amount = Math.ceil(Number(amountUGX));
  if (!Number.isFinite(amount) || amount <= 0) return 'Add products before taking a Mobile Money / card payment.';
  if (amount < MOBILE_CARD_MIN_UGX) {
    return `Mobile Money / card needs a sale of at least UGX ${MOBILE_CARD_MIN_UGX.toLocaleString()}. Take cash for this one.`;
  }
  if (amount > MOBILE_CARD_MAX_UGX) {
    return `Mobile Money / card is limited to UGX ${MOBILE_CARD_MAX_UGX.toLocaleString()} per sale. Split the sale or use another method.`;
  }
  return null;
};

// A charge reference, as made by imc_pay_create().
export const isMobileCardTxRef = (value) => /^IMC-[A-Z0-9]{20}$/.test(String(value || ''));

// The link a customer opens (by scanning the till's QR) to pay on their own phone.
export const mobileCardPayUrl = (origin, txRef) => `${String(origin || '').replace(/\/+$/, '')}/mobile-pay/${txRef}`;

// Every way a Ugandan mobile number might be stored or typed, so the cashier can
// check whether a typed number already belongs to an IcanEra account.
// '0772 123 456', '+256772123456', '256772123456' and '772123456' are all the
// same person. Anything that is not a 9-digit national number gives [].
export const ugandaPhoneVariants = (input) => {
  const digits = String(input || '').replace(/\D/g, '');
  let national = null;
  if (digits.length === 12 && digits.startsWith('256')) national = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith('0')) national = digits.slice(1);
  else if (digits.length === 9 && !digits.startsWith('0')) national = digits; // a national number never starts with 0 (that is a truncated 0772...)
  if (!national) return [];
  return [`0${national}`, `256${national}`, `+256${national}`, national];
};

// Flutterwave's payment_type -> what the cashier and customer read.
export const mobileCardChannelLabel = (channel) => {
  const key = String(channel || '').trim().toLowerCase();
  if (!key) return 'Mobile Money / Card';
  if (key === 'card') return 'Card';
  if (key.startsWith('mobilemoney') || key === 'mobile_money') return 'Mobile Money';
  if (key.includes('bank') || key === 'account') return 'Bank';
  return 'Mobile Money / Card';
};

// What the cashier typed to find / reach the customer. One box handles all of it:
//   '0772 123 456' / '+256772123456'  -> { type: 'phone' }   (an IcanEra account may or may not exist behind it)
//   '1234 5678 9012 3456'             -> { type: 'account' } (a 16-digit IcanEra wallet number)
//   'jane@mail.com'                   -> { type: 'email' }
//   a 16-digit number starting with 3 is a BUSINESS wallet: it cannot be asked for a payment here.
export const classifyCustomerInput = (input) => {
  const text = String(input ?? '').trim();
  if (!text) return { type: null };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return { type: 'email', value: text.toLowerCase() };
  if (/[^\d\s+()-]/.test(text)) return { type: null };
  const digits = text.replace(/\D/g, '');
  if (digits.length === 16) return digits.startsWith('3') ? { type: 'business' } : { type: 'account', value: digits };
  const variants = ugandaPhoneVariants(text);
  if (variants.length) return { type: 'phone', value: variants[0], variants };
  return { type: null };
};

// Enough for the cashier to confirm they found the right person, no more: 'Jane Kato' -> 'Jane K.'
export const maskAccountName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'IcanEra member';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

// The message sent with the pay link (WhatsApp / SMS) to a customer who is not at the till.
export const mobileCardShareText = ({ merchantName, amountUGX, url }) =>
  `${merchantName || 'SupermartKera'} - please pay UGX ${Math.ceil(Number(amountUGX)).toLocaleString()}. `
  + `Pay with Mobile Money, card or your IcanEra wallet (no account needed): ${url}`;

// wa.me needs the number as digits only with the country code; with no usable number it opens WhatsApp's contact picker.
export const whatsappShareUrl = (phone, text) => {
  const variants = ugandaPhoneVariants(phone);
  const to = variants.length ? variants[1] : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
};

export const smsShareUrl = (phone, text) => {
  const variants = ugandaPhoneVariants(phone);
  return `sms:${variants.length ? variants[2] : ''}?body=${encodeURIComponent(text)}`;
};
