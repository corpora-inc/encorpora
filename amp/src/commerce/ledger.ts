import type { CommerceEvent, CommerceOrder, CommerceState, LicenseGrant, OrderInput } from './contracts.js';

export function emptyCommerceState(): CommerceState { return { version: 1, orders: [], grants: [], events: [] }; }
export class CommerceError extends Error {}
function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new CommerceError(message);
}
function timestamp(value: string): number {
  requireCondition(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), 'Timestamp must be canonical UTC ISO');
  const result = Date.parse(value);
  requireCondition(Number.isFinite(result) && new Date(result).toISOString() === value, 'Invalid timestamp');
  return result;
}
function nonempty(value: string): void { requireCondition(typeof value === 'string' && value.trim().length > 0, 'Missing identifier or evidence'); }
function money(amount: number, currency: string): void {
  requireCondition(Number.isSafeInteger(amount) && amount >= 0, 'Invalid minor-unit amount');
  requireCondition(typeof currency === 'string' && /^[A-Z]{3}$/.test(currency), 'Invalid currency code');
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { requireCondition(Number.isFinite(value), 'Nonfinite payload'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  requireCondition(typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, 'Event must contain JSON objects');
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
}
function validateOrder(order: OrderInput): void {
  for (const value of [order.id, order.account.id, order.license.accountId, order.license.learnerId, order.license.sku, order.channelReference, order.externalOrderId]) nonempty(value);
  requireCondition(order.account.id === order.license.accountId, 'License must belong to purchasing parent account');
  requireCondition(timestamp(order.license.startsAt) < timestamp(order.license.endsAt), 'License must have a positive fixed term');
  money(order.amountMinor, order.currency);
  requireCondition(order.activationPolicy === 'after-settlement' || order.activationPolicy === 'after-approval', 'Unknown activation policy');
  requireCondition(order.activationPolicy !== 'after-approval' || order.channel === 'esa' || order.channel === 'pilot', 'Early activation is restricted to ESA and pilot orders');
  requireCondition(order.channel !== 'pilot' || order.amountMinor === 0, 'Pilot grants cannot collect payment');
  requireCondition(order.channel === 'pilot' || order.amountMinor > 0, 'Paid orders require a positive amount');
}

/** Apply only authenticated, authorized, normalized events inside a serializable transaction. */
export function reduceCommerce(state: CommerceState, event: CommerceEvent): CommerceState {
  requireCondition(state.version === 1, 'Unsupported ledger version');
  nonempty(event.id); nonempty(event.orderId); nonempty(event.channelReference);
  requireCondition(['stripe', 'apple', 'google', 'esa', 'pilot'].includes(event.channel), 'Unknown commerce channel');
  const eventTime = timestamp(event.occurredAt);
  const payload = canonical(event);
  const prior = state.events.find(item => item.id === event.id && item.channel === event.channel && item.channelReference === event.channelReference);
  if (prior) { requireCondition(prior.canonicalPayload === payload, 'Event ID reused with a different payload'); return state; }
  let order = state.orders.find(item => item.id === event.orderId);
  let grants = state.grants;
  if (event.type === 'order.created') {
    requireCondition(!order, 'Order ID already exists');
    validateOrder(event.order);
    requireCondition(event.order.id === event.orderId && event.order.channel === event.channel && event.order.channelReference === event.channelReference, 'Order source mismatch');
    requireCondition(!state.orders.some(item => item.channel === event.channel && item.channelReference === event.channelReference && item.externalOrderId === event.order.externalOrderId), 'External order already exists');
    order = { ...structuredClone(event.order), createdAt: event.occurredAt, lastEventAt: event.occurredAt, approval: 'pending', fulfillment: 'pending', settlement: 'pending', refund: 'none', revocation: 'none', evidence: [] };
  } else {
    requireCondition(order, 'Order does not exist');
    requireCondition(order.channel === event.channel && order.channelReference === event.channelReference, 'Order source mismatch');
    requireCondition(eventTime >= timestamp(order.lastEventAt), 'Out-of-order event requires reconciliation');
    nonempty(event.evidence);
    order = { ...order, lastEventAt: event.occurredAt, evidence: [...order.evidence, { eventId: event.id, kind: event.type, reference: event.evidence }] };
    switch (event.type) {
      case 'order.approved':
      case 'order.rejected':
        requireCondition(order.approval === 'pending', 'Approval decision already recorded');
        order.approval = event.type === 'order.approved' ? 'approved' : 'rejected';
        break;
      case 'order.fulfilled':
        requireCondition(order.approval === 'approved' && order.fulfillment === 'pending' && order.refund === 'none' && order.revocation === 'none', 'Order cannot be fulfilled');
        order.fulfillment = 'delivered';
        break;
      case 'order.settled':
        money(event.amountMinor, event.currency);
        requireCondition(order.channel !== 'pilot' && order.settlement === 'pending' && event.amountMinor === order.amountMinor && event.currency === order.currency, 'Settlement does not match order');
        order.settlement = 'settled';
        break;
      case 'refund.requested':
      case 'refund.completed':
        money(event.amountMinor, event.currency);
        requireCondition(order.settlement === 'settled' && event.amountMinor === order.amountMinor && event.currency === order.currency, 'Only a full settled-order refund is supported');
        requireCondition(event.type === 'refund.requested' ? order.refund === 'none' : order.refund !== 'completed', 'Refund transition already recorded');
        order.refund = event.type === 'refund.requested' ? 'requested' : 'completed';
        if (event.type === 'refund.completed') grants = grants.map(grant => grant.orderId === order!.id && grant.status === 'active' ? { ...grant, status: 'revoked', revokedAt: event.occurredAt } : grant);
        break;
      case 'license.revoked':
        requireCondition(order.revocation === 'none', 'License revocation already recorded');
        order.revocation = 'revoked';
        grants = grants.map(grant => grant.orderId === order!.id && grant.status === 'active' ? { ...grant, status: 'revoked', revokedAt: event.occurredAt } : grant);
        break;
      case 'license.activated':
        requireCondition(order.approval === 'approved' && order.fulfillment === 'delivered' && order.refund === 'none' && order.revocation === 'none', 'Order is not eligible for activation');
        requireCondition(order.activationPolicy === 'after-approval' || order.settlement === 'settled', 'Settlement required before activation');
        requireCondition(eventTime < timestamp(order.license.endsAt), 'Cannot activate an expired license');
        requireCondition(!grants.some(grant => grant.orderId === order!.id), 'Grant already issued');
        grants = [...grants, { ...order.license, id: order.id, orderId: order.id, channel: order.channel, externalOrderId: order.externalOrderId, issuedAt: event.occurredAt, status: 'active' }];
        break;
      default: throw new CommerceError('Unknown commerce event');
    }
  }
  return { version: 1, orders: state.orders.some(item => item.id === order.id) ? state.orders.map(item => item.id === order.id ? order : item) : [...state.orders, order], grants,
    events: [...state.events, { id: event.id, channel: event.channel, channelReference: event.channelReference, canonicalPayload: payload }] };
}

/** Inclusive start, exclusive end. Issuance and revocation also constrain historical access. */
export function activeGrants(state: CommerceState, accountId: string, learnerId: string, at: string): readonly LicenseGrant[] {
  const instant = timestamp(at);
  return state.grants.filter(grant => grant.accountId === accountId && grant.learnerId === learnerId &&
    timestamp(grant.issuedAt) <= instant && timestamp(grant.startsAt) <= instant && instant < timestamp(grant.endsAt) &&
    (grant.status === 'active' || (grant.revokedAt !== undefined && instant < timestamp(grant.revokedAt))));
}
