import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPaymentMethod, paymentMethodKind } from '../src/utils/paymentMethod.js';

test('formatPaymentMethod: known ids become display names', () => {
  assert.equal(formatPaymentMethod('ican'), 'IcanEra Wallet');
  assert.equal(formatPaymentMethod('icanera_wallet'), 'IcanEra Wallet');
  assert.equal(formatPaymentMethod('cash_ugx'), 'Cash (UGX)');
  assert.equal(formatPaymentMethod('cash'), 'Cash');
  assert.equal(formatPaymentMethod('momo'), 'MTN Mobile Money');
  assert.equal(formatPaymentMethod('airtel'), 'Airtel Money');
  assert.equal(formatPaymentMethod('mobile_money'), 'Mobile Money');
  assert.equal(formatPaymentMethod('bank_transfer'), 'Bank Transfer');
});

test('formatPaymentMethod: ignores case, spaces and dashes in ids', () => {
  assert.equal(formatPaymentMethod('  ICAN '), 'IcanEra Wallet');
  assert.equal(formatPaymentMethod('Mobile-Money'), 'Mobile Money');
  assert.equal(formatPaymentMethod('cash on delivery'), 'Cash on Delivery');
});

test('formatPaymentMethod: display names pass through untouched', () => {
  assert.equal(formatPaymentMethod('IcanEra Wallet'), 'IcanEra Wallet');
  assert.equal(formatPaymentMethod('Cash (UGX)'), 'Cash (UGX)');
  assert.equal(formatPaymentMethod('MTN Mobile Money'), 'MTN Mobile Money');
  assert.equal(formatPaymentMethod('Visa Card'), 'Visa Card');
});

test('formatPaymentMethod: unmapped ids are made readable, not dropped', () => {
  assert.equal(formatPaymentMethod('store_credit'), 'Store Credit');
  assert.equal(formatPaymentMethod('layaway'), 'Layaway');
});

test('formatPaymentMethod: accepts the cashier portal { id, name } objects', () => {
  assert.equal(formatPaymentMethod({ id: 'icanera_wallet', name: 'IcanEra Wallet' }), 'IcanEra Wallet');
  assert.equal(formatPaymentMethod({ id: 'cash_ugx' }), 'Cash (UGX)');
  assert.equal(formatPaymentMethod({}), '');
});

test('formatPaymentMethod: nothing recorded gives an empty string', () => {
  assert.equal(formatPaymentMethod(null), '');
  assert.equal(formatPaymentMethod(undefined), '');
  assert.equal(formatPaymentMethod(''), '');
  assert.equal(formatPaymentMethod('   '), '');
});

test('paymentMethodKind: groups ids and display names alike', () => {
  assert.equal(paymentMethodKind('cash'), 'cash');
  assert.equal(paymentMethodKind('cash_ugx'), 'cash');
  assert.equal(paymentMethodKind('Cash (UGX)'), 'cash');
  assert.equal(paymentMethodKind('momo'), 'mtn');
  assert.equal(paymentMethodKind('MTN Mobile Money'), 'mtn');
  assert.equal(paymentMethodKind('airtel'), 'airtel');
  assert.equal(paymentMethodKind('ican'), 'wallet');
  assert.equal(paymentMethodKind('card'), 'other');
  assert.equal(paymentMethodKind(null), 'other');
});
