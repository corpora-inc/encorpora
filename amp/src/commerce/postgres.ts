import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type {
  CommerceEvent,
  CommerceState,
  CommerceOrder,
  LicenseGrant,
} from "./contracts.js";
import {
  CommerceError,
  reduceCommerce,
  canonicalCommercePayload,
} from "./ledger.js";

const identifier = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => value.trim().length > 0);
const instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  }, "Invalid canonical UTC timestamp");
const channel = z.enum(["stripe", "apple", "google", "esa", "pilot"]);
const money = {
  amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/),
};
const envelope = {
  id: identifier,
  occurredAt: instant,
  channel,
  channelReference: identifier,
  orderId: identifier,
};
const evidence = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => value.trim().length > 0);
const order = z.strictObject({
  id: identifier,
  account: z.strictObject({ id: identifier }),
  license: z.strictObject({
    learnerId: identifier,
    accountId: identifier,
    sku: identifier,
    startsAt: instant,
    endsAt: instant,
  }),
  channel,
  channelReference: identifier,
  externalOrderId: identifier,
  ...money,
  activationPolicy: z.enum(["after-settlement", "after-approval"]),
});
/** Strict boundary schema; cross-field and transition validation occurs in the reducer. */
export const commerceEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...envelope, type: z.literal("order.created"), order }),
  z.strictObject({ ...envelope, type: z.literal("order.approved"), evidence }),
  z.strictObject({ ...envelope, type: z.literal("order.rejected"), evidence }),
  z.strictObject({ ...envelope, type: z.literal("order.fulfilled"), evidence }),
  z.strictObject({
    ...envelope,
    type: z.literal("license.activated"),
    evidence,
  }),
  z.strictObject({ ...envelope, type: z.literal("license.revoked"), evidence }),
  z.strictObject({
    ...envelope,
    type: z.literal("order.settled"),
    evidence,
    ...money,
  }),
  z.strictObject({
    ...envelope,
    type: z.literal("refund.requested"),
    evidence,
    ...money,
  }),
  z.strictObject({
    ...envelope,
    type: z.literal("refund.completed"),
    evidence,
    ...money,
  }),
]);
export function parseCommerceEvent(value: unknown): CommerceEvent {
  return commerceEventSchema.parse(value);
}

/** Unambiguous source projection compatible with amp_grants' (channel,external_order_id) key. */
export function commerceSourceId(
  channelReference: string,
  externalOrderId: string,
): string {
  return JSON.stringify([channelReference, externalOrderId]);
}

/** Account-scoped financial status; never accepts a caller-selected owner without authentication. */
export async function readCommerceOrder(
  pool: Pool,
  accountId: string,
  orderId: string,
): Promise<{ order: CommerceOrder; grant: LicenseGrant | null } | null> {
  const result = await pool.query<{
    order_state: CommerceOrder;
    grant_state: LicenseGrant | null;
  }>(
    "SELECT order_state,grant_state FROM amp_commerce_orders WHERE id=$1 AND account_id=$2",
    [orderId, accountId],
  );
  const row = result.rows[0];
  return row ? { order: row.order_state, grant: row.grant_state } : null;
}

/** Admin-only import: callers authorize the operator, not merely validate JSON.
 * Returns an ORDER-SCOPED state, never another family's commerce records.
 * Exact replay lookup uses the immutable source event index, not an unbounded history scan. */
export async function applyCommerceEvent(
  pool: Pool,
  input: unknown,
): Promise<CommerceState> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await applyCommerceEventInTransaction(client, input);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Caller must own an open transaction. Reuses its account lock and connection;
 * all failures must roll back the caller transaction. A caller should process
 * one order per transaction; multi-order callers must acquire account/order
 * locks in a stable sorted order first. No remote I/O occurs here. */
export async function applyCommerceEventInTransaction(
  client: PoolClient,
  input: unknown,
): Promise<CommerceState> {
  const event = parseCommerceEvent(input);
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='30s'");
  // Ownership is immutable. Read it before locking, then take the account lock
  // before order/event/learner locks, matching Stripe and parent privacy writers.
  const ownership = await client.query<{ account_id: string }>(
    "SELECT account_id FROM amp_commerce_orders WHERE id=$1",
    [event.orderId],
  );
  const accountId =
    ownership.rows[0]?.account_id ??
    (event.type === "order.created" ? event.order.account.id : undefined);
  if (!accountId) throw new CommerceError("Order does not exist");
  await client.query(
    "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
    [accountId],
  );
  // Event/order lock namespaces are separate from account privacy locks.
  // Keep an order ahead of every event lock: a caller may apply several events
  // for this order before commit, while a concurrent replay waits for the order.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [
    event.orderId,
  ]);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [
    JSON.stringify([event.channel, event.channelReference, event.id]),
  ]);
  const prior = await client.query<{ payload: CommerceEvent }>(
    "SELECT payload FROM amp_commerce_events WHERE channel=$1 AND channel_reference=$2 AND event_id=$3",
    [event.channel, event.channelReference, event.id],
  );
  const result = await client.query<{
    order_state: CommerceOrder;
    grant_state: LicenseGrant | null;
  }>(
    "SELECT order_state,grant_state FROM amp_commerce_orders WHERE id=$1 FOR UPDATE",
    [event.orderId],
  );
  const row = result.rows[0];
  const state: CommerceState = {
    version: 1,
    orders: row ? [row.order_state] : [],
    grants: row?.grant_state ? [row.grant_state] : [],
    events: prior.rows.map(({ payload }) => ({
      id: payload.id,
      channel: payload.channel,
      channelReference: payload.channelReference,
      canonicalPayload: canonicalCommercePayload(payload),
    })),
  };
  if (Date.parse(event.occurredAt) > Date.now())
    throw new CommerceError("Future events require reconciliation");
  const next = reduceCommerce(state, event);
  if (next === state) return state;
  const target = next.orders[0]!;
  // Financial reconciliation survives withdrawal and retains only opaque references.
  const owner = await client.query<{ account_id: string }>(
    "SELECT account_id FROM amp_learners WHERE id=$1 FOR SHARE",
    [target.license.learnerId],
  );
  if (
    owner.rows.length !== 1 ||
    owner.rows[0]!.account_id !== target.account.id
  )
    throw new CommerceError("Learner does not belong to purchasing account");
  const grant = next.grants.find((item) => item.orderId === target.id);
  if (!row) {
    const collision = await client.query(
      "SELECT id FROM amp_commerce_orders WHERE channel=$1 AND channel_reference=$2 AND external_order_id=$3",
      [target.channel, target.channelReference, target.externalOrderId],
    );
    if (collision.rowCount)
      throw new CommerceError("External order already exists");
    await client.query(
      `INSERT INTO amp_commerce_orders(id,account_id,learner_id,channel,channel_reference,external_order_id,order_state,grant_state)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        target.id,
        target.account.id,
        target.license.learnerId,
        target.channel,
        target.channelReference,
        target.externalOrderId,
        JSON.stringify(target),
        grant ? JSON.stringify(grant) : null,
      ],
    );
  } else {
    await client.query(
      "UPDATE amp_commerce_orders SET order_state=$2,grant_state=$3,updated_at=now() WHERE id=$1",
      [target.id, JSON.stringify(target), grant ? JSON.stringify(grant) : null],
    );
  }

  if (grant) {
    // Parent/learner API grants have no issued_at column; encode the access floor.
    const startsAt =
      grant.startsAt > grant.issuedAt ? grant.startsAt : grant.issuedAt;
    const grantId = `commerce:${grant.id}`;
    const externalOrderId = commerceSourceId(
      target.channelReference,
      target.externalOrderId,
    );
    const existing = await client.query<{
      learner_id: string;
      channel: string;
      external_order_id: string;
    }>(
      "SELECT learner_id,channel,external_order_id FROM amp_grants WHERE id=$1 FOR UPDATE",
      [grantId],
    );
    if (
      existing.rows.length &&
      (existing.rows[0]!.learner_id !== grant.learnerId ||
        existing.rows[0]!.channel !== grant.channel ||
        existing.rows[0]!.external_order_id !== externalOrderId)
    )
      throw new CommerceError("Grant projection identity collision");
    await client.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET
        status=EXCLUDED.status,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at`,
      [
        grantId,
        grant.learnerId,
        grant.channel,
        externalOrderId,
        grant.status,
        startsAt,
        grant.endsAt,
      ],
    );
  }
  await client.query(
    "INSERT INTO amp_commerce_events(channel,channel_reference,event_id,order_id,payload) VALUES($1,$2,$3,$4,$5)",
    [
      event.channel,
      event.channelReference,
      event.id,
      event.orderId,
      JSON.stringify(event),
    ],
  );
  return next;
}
