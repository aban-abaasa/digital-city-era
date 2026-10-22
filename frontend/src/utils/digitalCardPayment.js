// "IcanEra Digital Card": a customer who comes to the till with the digital card from their IcanEra wallet
// (ICAN app -> Wallet -> Cards) pays the sale with it. The cashier scans the card's QR, the customer types their
// wallet transaction PIN on the till and the sale is paid from their wallet to the store's wallet, with no fee
// (see icanDigitalCardService.js and ADD_ICAN_CARD_POS_PAYMENTS.sql). These are the small pure rules the cashier
// screen shares with the tests.

import { MOBILE_CARD_MIN_UGX, MOBILE_CARD_MAX_UGX } from './mobileCardPayment.js';

// The row in the cashier's "Take payment" list. A paid card sale is booked as an IcanEra Wallet sale (the money
// comes out of the customer's IcanEra wallet), so this id is only the chooser entry and never reaches a receipt.
export const DIGITAL_CARD_CHOOSER_ID = 'icanera_digital_card';
export const DIGITAL_CARD_CHOOSER_NAME = 'IcanEra Digital Card';

// A card's QR holds a link like https://<app>/card-pay/<token>; the token is a long run of letters and digits.
// The server decides what a token means, so the screen only needs to pull it out of whatever was scanned or pasted.
const TOKEN = /^[A-Za-z0-9]{20,100}$/;
const LINK_TOKEN = /\/card-pay\/([A-Za-z0-9]{20,100})(?=$|[/?#\s])/;

// What the camera read, or the cashier pasted, -> the card's token, or null when it is not an IcanEra card QR
// (a product barcode, someone's website, a payment link ...).
export const parseCardQr = (text) => {
  const value = String(text ?? '').trim();
  if (!value) return null;
  if (TOKEN.test(value)) return value;
  const match = value.match(LINK_TOKEN);
  return match ? match[1] : null;
};

// The wallet transaction PIN: 4 to 6 digits, the same rule the wallet itself uses.
export const isCardPin = (pin) => /^[0-9]{4,6}$/.test(String(pin ?? ''));

// Why this PIN cannot be sent yet (null = it can).
export const cardPinProblem = (pin) => (isCardPin(pin) ? null : 'The card PIN is 4 to 6 digits.');

// Why a sale of this size cannot be paid with a card (null = it can). Same limits as every IcanEra till payment
// (the database enforces them when the sale is opened).
export const digitalCardAmountProblem = (amountUGX) => {
  const amount = Math.ceil(Number(amountUGX));
  if (!Number.isFinite(amount) || amount <= 0) return 'Add products before taking a card payment.';
  if (amount < MOBILE_CARD_MIN_UGX) {
    return `A card payment needs a sale of at least UGX ${MOBILE_CARD_MIN_UGX.toLocaleString()}. Take cash for this one.`;
  }
  if (amount > MOBILE_CARD_MAX_UGX) {
    return `A card payment is limited to UGX ${MOBILE_CARD_MAX_UGX.toLocaleString()} per sale. Split the sale or use another method.`;
  }
  return null;
};

// What the cashier reads to confirm it is the right customer's card: 'Mary - card ending 4321'.
export const cardHolderLabel = (card) => {
  const name = String(card?.holder_first_name || '').trim() || 'IcanEra member';
  const last4 = String(card?.last4 || '').replace(/\D/g, '').slice(-4);
  return last4 ? `${name} - card ending ${last4}` : name;
};

// The settled sale as the till's "payment received" handler wants it, plus the card that paid (for the receipt note).
export const digitalCardPaymentData = (result, base) => ({
  ...base,
  cardLast4: String(result?.card_last4 || '').replace(/\D/g, '').slice(-4) || null,
});
