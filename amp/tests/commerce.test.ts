import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommerceEvent, CommerceState, OrderInput } from '../src/commerce/contracts.js';
import { activeGrants, emptyCommerceState, reduceCommerce } from '../src/commerce/ledger.js';
const at = '2026-10-16T12:00:00.000Z';
const later = '2026-10-17T12:00:00.000Z';
const end = '2027-10-16T12:00:00.000Z';
const order: OrderInput = { id: 'o1', account: { id: 'parent' }, license: { accountId: 'parent', learnerId: 'child', sku: 'math-year', startsAt: at, endsAt: end }, channel: 'stripe', channelReference: 'merchant', externalOrderId: 'external', amountMinor: 10000, currency: 'USD', activationPolicy: 'after-settlement' };
function create(input = order) { return { id: 'created', occurredAt: at, orderId: input.id, channel: input.channel, channelReference: input.channelReference, type: 'order.created' as const, order: input }; }
function event(type: 'order.approved' | 'order.fulfilled' | 'license.activated' | 'license.revoked' | 'order.rejected', input = order) {
  return { id: type, occurredAt: at, orderId: input.id, channel: input.channel, channelReference: input.channelReference, type, evidence: 'reviewed-reference' };
}
function paid(type: 'order.settled' | 'refund.requested' | 'refund.completed', input = order) {
  return { id: type, occurredAt: at, orderId: input.id, channel: input.channel, channelReference: input.channelReference, type, evidence: 'payment-reference', amountMinor: input.amountMinor, currency: input.currency };
}
function approved(input = order): CommerceState {
  return reduceCommerce(reduceCommerce(emptyCommerceState(), create(input)), event('order.approved', input));
}
function activated(input = order): CommerceState {
  let state = approved(input);
  if (input.channel !== 'pilot') state = reduceCommerce(state, paid('order.settled', input));
  return reduceCommerce(reduceCommerce(state, event('order.fulfilled', input)), event('license.activated', input));
}

test('paid activation requires independent approval, delivery and settlement without mutating inputs', () => {
  const initial = emptyCommerceState();
  const created = reduceCommerce(initial, create());
  assert.equal(initial.orders.length, 0);
  assert.throws(() => reduceCommerce(created, event('order.fulfilled')), /cannot be fulfilled/);
  let state = approved();
  state = reduceCommerce(state, event('order.fulfilled'));
  assert.throws(() => reduceCommerce(state, event('license.activated')), /Settlement required/);
  const settled = reduceCommerce(state, paid('order.settled'));
  assert.equal(state.orders[0]!.settlement, 'pending');
  const active = reduceCommerce(settled, event('license.activated'));
  assert.equal(activeGrants(active, 'parent', 'child', at).length, 1);
  assert.equal(activeGrants(active, 'someone-else', 'child', at).length, 0);
  assert.equal(activeGrants(active, 'parent', 'other-child', at).length, 0);
  assert.equal(activeGrants(active, 'parent', 'child', end).length, 0);
  assert.equal(activeGrants(active, 'parent', 'child', '2026-10-16T11:59:59.999Z').length, 0);
});

test('exact events replay idempotently; mismatched payload and source collisions fail', () => {
  const source = create();
  const state = reduceCommerce(emptyCommerceState(), source);
  assert.equal(reduceCommerce(state, structuredClone(source)), state);
  assert.throws(() => reduceCommerce(state, { ...source, occurredAt: later }), /different payload/);
  assert.throws(() => reduceCommerce(state, create({ ...order, id: 'another' })), /different payload/);
  assert.throws(() => reduceCommerce(state, { ...create({ ...order, id: 'another' }), id: 'second' }), /External order already exists/);
  assert.throws(() => reduceCommerce(state, { ...event('order.approved'), channelReference: 'other' }), /source mismatch/);
});

test('ESA approved-order policy permits activation before settlement but not before approval', () => {
  const esa: OrderInput = { ...order, channel: 'esa', channelReference: 'az-esa', activationPolicy: 'after-approval' };
  let state = approved(esa);
  state = reduceCommerce(state, event('order.fulfilled', esa));
  state = reduceCommerce(state, event('license.activated', esa));
  assert.equal(state.orders[0]!.settlement, 'pending');
  assert.equal(activeGrants(state, 'parent', 'child', at).length, 1);
  assert.throws(() => reduceCommerce(emptyCommerceState(), create({ ...order, activationPolicy: 'after-approval' })), /restricted/);
});

test('refund request does not revoke access; completion revokes it without rewriting payment or history', () => {
  const state = activated();
  const requested = reduceCommerce(state, { ...paid('refund.requested'), occurredAt: later });
  assert.equal(activeGrants(requested, 'parent', 'child', later).length, 1);
  const refunded = reduceCommerce(requested, { ...paid('refund.completed'), occurredAt: later });
  assert.equal(activeGrants(refunded, 'parent', 'child', later).length, 0);
  assert.equal(activeGrants(refunded, 'parent', 'child', at).length, 1);
  assert.equal(refunded.orders[0]!.settlement, 'settled');
  assert.equal(state.grants[0]!.status, 'active');
  assert.throws(() => reduceCommerce(refunded, { ...event('license.activated'), id: 'reactivate', occurredAt: later }), /not eligible/);
  assert.throws(() => reduceCommerce(state, { ...paid('refund.completed'), amountMinor: 1 }), /full settled-order refund/);
});

test('revocation blocks future activation even when no grant has been issued', () => {
  const state = reduceCommerce(approved(), event('license.revoked'));
  assert.throws(() => reduceCommerce(state, event('order.fulfilled')), /cannot be fulfilled/);
  const revoked = reduceCommerce(activated(), { ...event('license.revoked'), occurredAt: later });
  assert.equal(activeGrants(revoked, 'parent', 'child', later).length, 0);
});

test('pilot grant is explicit and free; Apple and Google follow settled activation', () => {
  const pilot: OrderInput = { ...order, channel: 'pilot', amountMinor: 0, activationPolicy: 'after-approval' };
  assert.equal(activeGrants(activated(pilot), 'parent', 'child', at).length, 1);
  assert.throws(() => reduceCommerce(approved(pilot), paid('order.settled', pilot)), /Settlement does not match/);
  for (const channel of ['apple', 'google'] as const) assert.equal(activated({ ...order, channel }).grants.length, 1);
});

test('invalid terms, ownership, money, time ordering and unknown transitions reject', () => {
  assert.throws(() => reduceCommerce(emptyCommerceState(), create({ ...order, license: { ...order.license, accountId: 'wrong' } })), /parent account/);
  assert.throws(() => reduceCommerce(emptyCommerceState(), create({ ...order, license: { ...order.license, endsAt: at } })), /positive fixed term/);
  assert.throws(() => reduceCommerce(emptyCommerceState(), create({ ...order, amountMinor: 0.5 })), /minor-unit/);
  assert.throws(() => reduceCommerce(approved(), { ...paid('order.settled'), currency: 'EUR' }), /does not match/);
  const future = reduceCommerce(approved(), { ...event('order.fulfilled'), occurredAt: later });
  assert.throws(() => reduceCommerce(future, paid('order.settled')), /Out-of-order/);
  assert.throws(() => reduceCommerce(approved(), { ...event('order.fulfilled'), occurredAt: '2026-02-30T00:00:00.000Z' }), /Invalid timestamp/);
  assert.throws(() => reduceCommerce(approved(), { ...event('order.fulfilled'), type: 'invented' } as unknown as CommerceEvent), /Unknown commerce event/);
});
