import type { Pool } from 'pg';
import { z } from 'zod';
import type { CommerceEvent, CommerceState } from './contracts.js';
import { CommerceError, reduceCommerce } from './ledger.js';

const identifier = z.string().min(1).max(500).refine(value => value.trim().length > 0);
const instant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(value => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}, 'Invalid canonical UTC timestamp');
const channel = z.enum(['stripe', 'apple', 'google', 'esa', 'pilot']);
const money = { amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), currency: z.string().regex(/^[A-Z]{3}$/) };
const envelope = { id: identifier, occurredAt: instant, channel, channelReference: identifier, orderId: identifier };
const evidence = z.string().min(1).max(2000).refine(value => value.trim().length > 0);
const order = z.strictObject({
  id: identifier, account: z.strictObject({ id: identifier }),
  license: z.strictObject({ learnerId: identifier, accountId: identifier, sku: identifier, startsAt: instant, endsAt: instant }),
  channel, channelReference: identifier, externalOrderId: identifier, ...money,
  activationPolicy: z.enum(['after-settlement', 'after-approval']),
});
/** Strict boundary schema; cross-field and transition validation occurs in the reducer. */
export const commerceEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...envelope, type: z.literal('order.created'), order }),
  z.strictObject({ ...envelope, type: z.literal('order.approved'), evidence }),
  z.strictObject({ ...envelope, type: z.literal('order.rejected'), evidence }),
  z.strictObject({ ...envelope, type: z.literal('order.fulfilled'), evidence }),
  z.strictObject({ ...envelope, type: z.literal('license.activated'), evidence }),
  z.strictObject({ ...envelope, type: z.literal('license.revoked'), evidence }),
  z.strictObject({ ...envelope, type: z.literal('order.settled'), evidence, ...money }),
  z.strictObject({ ...envelope, type: z.literal('refund.requested'), evidence, ...money }),
  z.strictObject({ ...envelope, type: z.literal('refund.completed'), evidence, ...money }),
]);
export function parseCommerceEvent(value: unknown): CommerceEvent { return commerceEventSchema.parse(value); }

/** Unambiguous source projection compatible with amp_grants' (channel,external_order_id) key. */
export function commerceSourceId(channelReference: string, externalOrderId: string): string {
  return JSON.stringify([channelReference, externalOrderId]);
}

/** Admin-only import: callers must authorize the operator, not merely validate JSON. */
export async function applyCommerceEvent(pool: Pool, input: unknown): Promise<CommerceState> {
  const event = parseCommerceEvent(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ state: CommerceState }>('SELECT state FROM amp_commerce_ledger WHERE id=1 FOR UPDATE');
    if (result.rows.length !== 1) throw new CommerceError('Commerce migration is not installed');
    const state = result.rows[0]!.state;
    if (Date.parse(event.occurredAt) > Date.now()) throw new CommerceError('Future events require reconciliation');
    const next = reduceCommerce(state, event);
    // Exact replays must remain no-ops even if the learner has since been deleted.
    if (next === state) { await client.query('COMMIT'); return state; }
    const target = next.orders.find(item => item.id === event.orderId)!;
    const owner = await client.query<{ account_id: string }>('SELECT account_id FROM amp_learners WHERE id=$1 FOR SHARE', [target.license.learnerId]);
    if (owner.rows.length !== 1 || owner.rows[0]!.account_id !== target.account.id) throw new CommerceError('Learner does not belong to purchasing account');
    const grant = next.grants.find(item => item.orderId === target.id);
    if (grant) {
      // Parent/learner API grants have no issued_at column; encode the access floor.
      const startsAt = grant.startsAt > grant.issuedAt ? grant.startsAt : grant.issuedAt;
      const grantId = `commerce:${grant.id}`;
      const externalOrderId = commerceSourceId(target.channelReference, target.externalOrderId);
      const existing = await client.query<{ learner_id: string; channel: string; external_order_id: string }>('SELECT learner_id,channel,external_order_id FROM amp_grants WHERE id=$1 FOR UPDATE', [grantId]);
      if (existing.rows.length && (existing.rows[0]!.learner_id !== grant.learnerId || existing.rows[0]!.channel !== grant.channel || existing.rows[0]!.external_order_id !== externalOrderId)) throw new CommerceError('Grant projection identity collision');
      await client.query(`INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET
        status=EXCLUDED.status,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at`,
      [grantId, grant.learnerId, grant.channel, externalOrderId, grant.status, startsAt, grant.endsAt]);
    }
    await client.query('INSERT INTO amp_commerce_events(channel,channel_reference,event_id,order_id,payload) VALUES($1,$2,$3,$4,$5)', [event.channel, event.channelReference, event.id, event.orderId, JSON.stringify(event)]);
    await client.query('UPDATE amp_commerce_ledger SET state=$1,updated_at=now() WHERE id=1', [JSON.stringify(next)]);
    await client.query('COMMIT');
    return next;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
