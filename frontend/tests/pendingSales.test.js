import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_WAITING_SALES,
  MAX_LISTED_SALES,
  isWaiting,
  canParkAnother,
  saleItemCount,
  pendingSaleLabel,
  buildPendingEntry,
  salesForOwner,
  mergeOwnerSales,
  recoverInterrupted,
  pruneListed,
  pendingStatusText,
} from '../src/utils/pendingSales.js';

const sale = (qtys = [2, 1]) => ({ items: qtys.map((quantity, i) => ({ id: `p${i}`, name: `P${i}`, quantity })), subtotal: 6780, tax: 1220, total: 8000, customer: null });
const charge = (ref = 'IMC-AAAAAAAAAAAAAAAAAAAA') => ({ tx_ref: ref, merchant_name: 'Kampala Fresh', amount_ugx: 8000, processing_fee_ugx: 300, charge_ugx: 8300, expires_at: new Date(Date.now() + 25 * 60000).toISOString() });
const entry = (over = {}) => ({ ...buildPendingEntry({ ownerKey: 'u1', supermarketId: 's1', charge: charge(), sale: sale(), contact: '0772 123 456' }), ...over });

test('buildPendingEntry: a parked sale keeps what is needed to record it later, and starts out waiting', () => {
  const e = entry();
  assert.equal(e.id, 'IMC-AAAAAAAAAAAAAAAAAAAA');
  assert.equal(e.status, 'waiting');
  assert.equal(e.ownerKey, 'u1');
  assert.equal(e.charge.charge_ugx, 8300);
  assert.equal(e.sale.total, 8000);
  assert.equal(e.sale.items.length, 2);
  assert.equal(e.contact, '0772 123 456');
});

test('buildPendingEntry: unrelated basket fields are not carried along', () => {
  const e = buildPendingEntry({ ownerKey: 'u1', charge: charge(), sale: { ...sale(), paymentMethod: { id: 'x' }, secret: 'no' } });
  assert.equal('secret' in e.sale, false);
  assert.equal('paymentMethod' in e.sale, false);
});

test('saleItemCount / pendingSaleLabel: recognised by the number asked, else by the basket', () => {
  assert.equal(saleItemCount(sale([2, 1])), 3);
  assert.equal(saleItemCount(null), 0);
  assert.equal(pendingSaleLabel(entry()), '0772 123 456');
  assert.equal(pendingSaleLabel(entry({ contact: '   ' })), '3 items');
  assert.equal(pendingSaleLabel(entry({ contact: '', sale: sale([1]) })), '1 item');
});

test('canParkAnother: at most five sales may wait; finished ones do not count against it', () => {
  const waiting = (n) => Array.from({ length: n }, (_, i) => entry({ id: `w${i}` }));
  assert.equal(MAX_WAITING_SALES, 5);
  assert.equal(canParkAnother(waiting(4)), true);
  assert.equal(canParkAnother(waiting(5)), false);
  assert.equal(canParkAnother([...waiting(4), entry({ status: 'paid' }), entry({ status: 'ended' })]), true);
  assert.equal(canParkAnother([...waiting(4), entry({ status: 'recording' })]), false);
  assert.equal(canParkAnother([]), true);
  assert.equal(canParkAnother(undefined), true);
});

test('isWaiting: waiting and recording are still open', () => {
  assert.equal(isWaiting({ status: 'waiting' }), true);
  assert.equal(isWaiting({ status: 'recording' }), true);
  assert.equal(isWaiting({ status: 'paid' }), false);
  assert.equal(isWaiting({ status: 'ended' }), false);
  assert.equal(isWaiting(null), false);
});

test('salesForOwner / mergeOwnerSales: a cashier only ever handles their own, and saving never drops a colleague\'s', () => {
  const all = [entry({ id: 'a', ownerKey: 'u1' }), entry({ id: 'b', ownerKey: 'u2' }), null];
  assert.deepEqual(salesForOwner(all, 'u1').map((e) => e.id), ['a']);
  assert.deepEqual(salesForOwner(all, 'u2').map((e) => e.id), ['b']);
  assert.deepEqual(salesForOwner(all, null), []);
  assert.deepEqual(salesForOwner(all, 'nobody'), []);
  const merged = mergeOwnerSales(all, 'u1', [entry({ id: 'a2', ownerKey: 'u1' })]);
  assert.deepEqual(merged.map((e) => e.id).sort(), ['a2', 'b']);
});

test('recoverInterrupted: a sale caught mid-recording is never recorded twice', () => {
  const [a, b] = recoverInterrupted([entry({ id: 'a', status: 'recording' }), entry({ id: 'b', status: 'waiting' })]);
  assert.equal(a.status, 'paid');
  assert.equal(a.receipt, null);
  assert.match(a.note, /Check My Receipts/);
  assert.equal(b.status, 'waiting');
});

test('pruneListed: newest first, and finished entries are trimmed but waiting ones never are', () => {
  const finished = Array.from({ length: 20 }, (_, i) => entry({ id: `f${i}`, status: 'paid', createdAt: 1000 + i }));
  const waiting = [entry({ id: 'w1', createdAt: 1 }), entry({ id: 'w2', createdAt: 2 })];
  const out = pruneListed([...finished, ...waiting]);
  assert.equal(out.length, MAX_LISTED_SALES);
  assert.equal(out.filter(isWaiting).length, 2, 'both waiting sales survive');
  assert.ok(out.some((e) => e.id === 'f19'), 'the newest finished one is kept');
  assert.ok(!out.some((e) => e.id === 'f0'), 'the oldest finished one is dropped');
  assert.equal(pruneListed(undefined).length, 0);
});

test('pendingStatusText: a countdown while waiting, and the reason once it ends', () => {
  const now = Date.now();
  const e = entry({ charge: { ...charge(), expires_at: new Date(now + 125000).toISOString() } });
  assert.equal(pendingStatusText(e, now), 'Waiting for payment - 2:05 left');
  assert.match(pendingStatusText(entry({ charge: { ...charge(), expires_at: new Date(now - 1000).toISOString() } }), now), /about to time out/);
  assert.match(pendingStatusText(entry({ status: 'recording' }), now), /recording the sale/);
  assert.equal(pendingStatusText(entry({ status: 'paid' }), now), 'Paid');
  assert.equal(pendingStatusText(entry({ status: 'paid', note: 'Check receipts' }), now), 'Check receipts');
  assert.equal(pendingStatusText(entry({ status: 'ended', endedReason: 'Customer did not pay' }), now), 'Customer did not pay');
});
