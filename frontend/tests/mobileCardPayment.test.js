import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOBILE_CARD_MIN_UGX,
  MOBILE_CARD_MAX_UGX,
  mobileCardAmountProblem,
  isMobileCardTxRef,
  mobileCardPayUrl,
  ugandaPhoneVariants,
  mobileCardChannelLabel,
  classifyCustomerInput,
  maskAccountName,
  mobileCardShareText,
  whatsappShareUrl,
  smsShareUrl,
} from '../src/utils/mobileCardPayment.js';
import { formatPaymentMethod } from '../src/utils/paymentMethod.js';

test('mobileCardAmountProblem: the limits match the database (UGX 500 to 5,000,000)', () => {
  assert.equal(MOBILE_CARD_MIN_UGX, 500);
  assert.equal(MOBILE_CARD_MAX_UGX, 5000000);
  assert.equal(mobileCardAmountProblem(500), null);
  assert.equal(mobileCardAmountProblem(5000000), null);
  assert.equal(mobileCardAmountProblem(10000.2), null);
  assert.match(mobileCardAmountProblem(499), /at least UGX 500/);
  assert.match(mobileCardAmountProblem(5000001), /limited to UGX 5,000,000/);
  assert.match(mobileCardAmountProblem(0), /Add products/);
  assert.match(mobileCardAmountProblem(NaN), /Add products/);
  assert.match(mobileCardAmountProblem(undefined), /Add products/);
});

test('mobileCardAmountProblem: a sale that rounds UP to the minimum is allowed (the server rounds up to a whole shilling)', () => {
  assert.equal(mobileCardAmountProblem(499.2), null);
});

test('isMobileCardTxRef / mobileCardPayUrl', () => {
  assert.equal(isMobileCardTxRef('IMC-ABCDEFGHIJKLMNOP1234'), true);
  assert.equal(isMobileCardTxRef('IMC-short'), false);
  assert.equal(isMobileCardTxRef('CQP-ABCDEFGHIJKLMNOP1234'), false);
  assert.equal(isMobileCardTxRef(null), false);
  assert.equal(mobileCardPayUrl('https://shop.example/', 'IMC-ABCDEFGHIJKLMNOP1234'), 'https://shop.example/mobile-pay/IMC-ABCDEFGHIJKLMNOP1234');
  assert.equal(mobileCardPayUrl('https://shop.example', 'IMC-X'), 'https://shop.example/mobile-pay/IMC-X');
});

test('ugandaPhoneVariants: every way of writing the same number gives the same set', () => {
  const expected = ['0772123456', '256772123456', '+256772123456', '772123456'];
  for (const input of ['0772123456', '0772 123 456', '+256 772 123 456', '256772123456', '772123456', '(0772) 123-456']) {
    assert.deepEqual(ugandaPhoneVariants(input), expected, input);
  }
});

test('ugandaPhoneVariants: anything that is not a Ugandan national number gives nothing', () => {
  for (const input of ['', null, undefined, '12345', '077212345', '25577212345678', '1234567890123456', 'abc']) {
    assert.deepEqual(ugandaPhoneVariants(input), [], String(input));
  }
});

test('mobileCardChannelLabel: reads Flutterwave payment types', () => {
  assert.equal(mobileCardChannelLabel('card'), 'Card');
  assert.equal(mobileCardChannelLabel('mobilemoneyuganda'), 'Mobile Money');
  assert.equal(mobileCardChannelLabel('MobileMoneyUganda'), 'Mobile Money');
  assert.equal(mobileCardChannelLabel('account'), 'Bank');
  assert.equal(mobileCardChannelLabel('banktransfer'), 'Bank');
  assert.equal(mobileCardChannelLabel(''), 'Mobile Money / Card');
  assert.equal(mobileCardChannelLabel(null), 'Mobile Money / Card');
  assert.equal(mobileCardChannelLabel('ussd'), 'Mobile Money / Card');
});

test('classifyCustomerInput: one box for a phone number, a wallet number or an email', () => {
  assert.equal(classifyCustomerInput('0772 123 456').type, 'phone');
  assert.equal(classifyCustomerInput('+256772123456').type, 'phone');
  assert.deepEqual(classifyCustomerInput('0772123456').variants, ['0772123456', '256772123456', '+256772123456', '772123456']);
  assert.deepEqual(classifyCustomerInput('1234 5678 9012 3456'), { type: 'account', value: '1234567890123456' });
  assert.deepEqual(classifyCustomerInput('Jane@Mail.com '), { type: 'email', value: 'jane@mail.com' });
});

test('classifyCustomerInput: business wallets and junk are never treated as a customer', () => {
  assert.deepEqual(classifyCustomerInput('3234567890123456'), { type: 'business' });
  for (const input of ['', '   ', null, undefined, 'hello', '12345', '12ab34', 'jane@']) {
    assert.deepEqual(classifyCustomerInput(input), { type: null }, String(input));
  }
});

test('maskAccountName: enough to recognise the person, not the whole name', () => {
  assert.equal(maskAccountName('Jane Kato'), 'Jane K.');
  assert.equal(maskAccountName('  jane   mary kato '), 'jane K.');
  assert.equal(maskAccountName('Jane'), 'Jane');
  assert.equal(maskAccountName(''), 'IcanEra member');
  assert.equal(maskAccountName(null), 'IcanEra member');
});

test('share links: WhatsApp and SMS open straight to the typed number, or to a picker without one', () => {
  const text = mobileCardShareText({ merchantName: 'Kampala Fresh', amountUGX: 10000.4, url: 'https://shop.example/mobile-pay/IMC-X' });
  assert.match(text, /^Kampala Fresh - please pay UGX 10,001\./);
  assert.match(text, /https:\/\/shop\.example\/mobile-pay\/IMC-X$/);
  assert.equal(whatsappShareUrl('0772 123 456', 'hi there').startsWith('https://wa.me/256772123456?text=hi%20there'), true);
  assert.equal(whatsappShareUrl('', 'hi').startsWith('https://wa.me/?text='), true);
  assert.equal(whatsappShareUrl('nonsense', 'hi').startsWith('https://wa.me/?text='), true);
  assert.equal(smsShareUrl('0772123456', 'a b'), 'sms:+256772123456?body=a%20b');
  assert.equal(smsShareUrl('', 'a'), 'sms:?body=a');
});

test('the new method reads well wherever receipts and history show it', () => {
  assert.equal(formatPaymentMethod('icanera_mobile_card'), 'IcanEra Mobile / Card');
  assert.equal(formatPaymentMethod({ id: 'icanera_mobile_card', name: 'IcanEra Mobile / Card' }), 'IcanEra Mobile / Card');
  assert.equal(formatPaymentMethod('IcanEra Mobile / Card'), 'IcanEra Mobile / Card');
});
