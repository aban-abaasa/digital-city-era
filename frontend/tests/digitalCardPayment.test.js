import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIGITAL_CARD_CHOOSER_ID,
  DIGITAL_CARD_CHOOSER_NAME,
  parseCardQr,
  isCardPin,
  cardPinProblem,
  digitalCardAmountProblem,
  cardHolderLabel,
  digitalCardPaymentData,
} from '../src/utils/digitalCardPayment.js';
import { mobileCardPaymentData } from '../src/utils/mobileCardPayment.js';

// What the server mints: two UUIDs with the dashes removed (64 hex characters).
const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

test('the chooser entry has its own id and a readable name', () => {
  assert.equal(DIGITAL_CARD_CHOOSER_ID, 'icanera_digital_card');
  assert.equal(DIGITAL_CARD_CHOOSER_NAME, 'IcanEra Digital Card');
});

test('parseCardQr: the card QR is a link ending in /card-pay/<token>', () => {
  assert.equal(parseCardQr(`https://icanera.space/card-pay/${TOKEN}`), TOKEN);
  assert.equal(parseCardQr(`http://localhost:5173/card-pay/${TOKEN}`), TOKEN);
  assert.equal(parseCardQr(`  https://supermartkera.icanera.space/card-pay/${TOKEN}\n`), TOKEN);
});

test('parseCardQr: a trailing slash, query or fragment does not matter', () => {
  assert.equal(parseCardQr(`https://x.test/card-pay/${TOKEN}/`), TOKEN);
  assert.equal(parseCardQr(`https://x.test/card-pay/${TOKEN}?from=qr`), TOKEN);
  assert.equal(parseCardQr(`https://x.test/card-pay/${TOKEN}#top`), TOKEN);
});

test('parseCardQr: a bare token (pasted from the card) works too', () => {
  assert.equal(parseCardQr(TOKEN), TOKEN);
  assert.equal(parseCardQr(` ${TOKEN} `), TOKEN);
});

test('parseCardQr: anything else is not a card', () => {
  assert.equal(parseCardQr(''), null);
  assert.equal(parseCardQr(null), null);
  assert.equal(parseCardQr(undefined), null);
  assert.equal(parseCardQr('6001234567890'), null);                                   // a product barcode
  assert.equal(parseCardQr('https://example.com/some/page'), null);                  // someone's website
  assert.equal(parseCardQr('https://x.test/mobile-pay/IMC-ABCDEFGHIJKLMNOPQRST'), null); // a payment link, not a card
  assert.equal(parseCardQr(`https://x.test/other/${TOKEN}`), null);                  // a token in the wrong place
  assert.equal(parseCardQr('card-pay/short'), null);
});

test('parseCardQr: a token that is too short or too long is refused', () => {
  assert.equal(parseCardQr('a'.repeat(19)), null);
  assert.equal(parseCardQr('a'.repeat(20)), 'a'.repeat(20));
  assert.equal(parseCardQr('a'.repeat(100)), 'a'.repeat(100));
  assert.equal(parseCardQr('a'.repeat(101)), null);
  assert.equal(parseCardQr(`https://x.test/card-pay/${'a'.repeat(101)}`), null);
});

test('parseCardQr: nothing but letters and digits is ever returned', () => {
  for (const text of [`https://x.test/card-pay/${TOKEN}`, TOKEN, `${TOKEN}?a=b`]) {
    const token = parseCardQr(text);
    assert.match(token ?? '', /^[A-Za-z0-9]*$/);
  }
  assert.equal(parseCardQr('javascript:alert(1)//card-pay/' + TOKEN), TOKEN); // only the token is lifted out; the rest is thrown away
  assert.equal(parseCardQr(`${TOKEN}'; drop table x; --`), null);
});

test('PIN: 4 to 6 digits, nothing else', () => {
  for (const ok of ['1234', '12345', '123456', '0000']) {
    assert.equal(isCardPin(ok), true, ok);
    assert.equal(cardPinProblem(ok), null, ok);
  }
  for (const bad of ['', '123', '1234567', '12a4', ' 1234', '12 34', '12.4', null, undefined]) {
    assert.equal(isCardPin(bad), false, String(bad));
    assert.match(cardPinProblem(bad), /4 to 6 digits/);
  }
});

test('digitalCardAmountProblem: the limits match every IcanEra till payment (UGX 500 to 5,000,000)', () => {
  assert.equal(digitalCardAmountProblem(500), null);
  assert.equal(digitalCardAmountProblem(5000000), null);
  assert.equal(digitalCardAmountProblem(10000.2), null);
  assert.match(digitalCardAmountProblem(499), /at least UGX 500/);
  assert.match(digitalCardAmountProblem(5000001), /limited to UGX 5,000,000/);
  assert.match(digitalCardAmountProblem(0), /Add products/);
  assert.match(digitalCardAmountProblem(NaN), /Add products/);
  assert.match(digitalCardAmountProblem(undefined), /Add products/);
});

test('cardHolderLabel: first name and last 4 digits, enough to confirm it is the right person', () => {
  assert.equal(cardHolderLabel({ holder_first_name: 'Mary', last4: '4321' }), 'Mary - card ending 4321');
  assert.equal(cardHolderLabel({ holder_first_name: '  Mary ', last4: '4321' }), 'Mary - card ending 4321');
  assert.equal(cardHolderLabel({ holder_first_name: 'Mary' }), 'Mary');
  assert.equal(cardHolderLabel({ last4: '4321' }), 'IcanEra member - card ending 4321');
  assert.equal(cardHolderLabel({ holder_first_name: 'Mary', last4: '**4321' }), 'Mary - card ending 4321');
  assert.equal(cardHolderLabel(null), 'IcanEra member');
});

test('digitalCardPaymentData: a settled card sale as the till books it, plus the card that paid', () => {
  // What imc_pay_with_card returns (_imc_pay_json) plus the Edge Function's card_last4.
  const server = {
    success: true, status: 'paid', tx_ref: 'IMC-ABCDEFGHIJKLMNOPQRST', merchant_name: 'Card Corner', amount_ugx: 10000,
    processing_fee_ugx: 0, charged_ugx: 10000, ican_amount: 2, ican_tx_id: 'tx-1', channel: 'wallet',
    payer_name: 'Mary Nakato', payer_phone: null, card_last4: '4321',
  };
  const data = digitalCardPaymentData(server, mobileCardPaymentData(server, { amountUGX: 10000 }));
  assert.equal(data.paymentCode, 'IMC-ABCDEFGHIJKLMNOPQRST');
  assert.equal(data.transactionId, 'tx-1');
  assert.equal(data.channel, 'wallet');        // so the till books it as an IcanEra Wallet sale
  assert.equal(data.amountUGX, 10000);
  assert.equal(data.processingFeeUGX, 0);      // the customer pays no fee
  assert.equal(data.icanAmount, 2);
  assert.equal(data.payerName, 'Mary Nakato');
  assert.equal(data.cardLast4, '4321');
});

test('digitalCardPaymentData: no usable card hint leaves it out rather than inventing one', () => {
  assert.equal(digitalCardPaymentData({}, {}).cardLast4, null);
  assert.equal(digitalCardPaymentData({ card_last4: 'abc' }, {}).cardLast4, null);
  assert.equal(digitalCardPaymentData({ card_last4: '1234567' }, {}).cardLast4, '4567');
});
