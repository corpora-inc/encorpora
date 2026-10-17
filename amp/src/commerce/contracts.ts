export type CommerceChannel = 'stripe' | 'apple' | 'google' | 'esa' | 'pilot';
export interface ParentAccount { id: string }
export interface StudentLicense {
  learnerId: string;
  accountId: string;
  sku: string;
  startsAt: string;
  endsAt: string;
}
export interface OrderInput {
  id: string;
  account: ParentAccount;
  license: StudentLicense;
  channel: CommerceChannel;
  /** Merchant/store/program namespace, not a credential. */
  channelReference: string;
  externalOrderId: string;
  currency: string;
  amountMinor: number;
  activationPolicy: 'after-settlement' | 'after-approval';
}
export interface CommerceOrder extends OrderInput {
  createdAt: string;
  lastEventAt: string;
  approval: 'pending' | 'approved' | 'rejected';
  fulfillment: 'pending' | 'delivered';
  settlement: 'pending' | 'settled';
  refund: 'none' | 'requested' | 'completed';
  revocation: 'none' | 'revoked';
  evidence: readonly { eventId: string; kind: string; reference: string }[];
}
export interface LicenseGrant extends StudentLicense {
  id: string;
  orderId: string;
  channel: CommerceChannel;
  externalOrderId: string;
  issuedAt: string;
  status: 'active' | 'revoked';
  revokedAt?: string;
}
interface Envelope {
  id: string;
  occurredAt: string;
  channel: CommerceChannel;
  channelReference: string;
  orderId: string;
}
export type CommerceEvent = Envelope & (
  | { type: 'order.created'; order: OrderInput }
  | { type: 'order.approved' | 'order.rejected' | 'order.fulfilled' | 'license.revoked'; evidence: string }
  | { type: 'order.settled'; evidence: string; amountMinor: number; currency: string }
  | { type: 'refund.requested' | 'refund.completed'; evidence: string; amountMinor: number; currency: string }
  | { type: 'license.activated'; evidence: string }
);
export interface CommerceState {
  version: 1;
  orders: readonly CommerceOrder[];
  grants: readonly LicenseGrant[];
  /** Canonical payloads retained for exact replay detection, scoped by source. */
  events: readonly { id: string; channel: CommerceChannel; channelReference: string; canonicalPayload: string }[];
}
