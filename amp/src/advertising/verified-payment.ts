import type { PoolClient } from "pg";
import { z } from "zod";
import { commerceEventSchema } from "../commerce/postgres.js";

export const paymentReferenceSchema = z
  .strictObject({
    kind: z.enum(["stripe", "arkansas-efa", "arizona-esa"]),
    id: z.string().min(1).max(500),
  })
  .superRefine((ref, ctx) => {
    if (ref.kind === "stripe" && !z.uuid().safeParse(ref.id).success)
      ctx.addIssue({
        code: "custom",
        message: "Stripe payment record ID must be a UUID",
      });
  });
export type PaymentReference = z.infer<typeof paymentReferenceSchema>;
export const measurementSourcesSchema = z
  .strictObject({
    stripeNamespace: z
      .string()
      .regex(/^acct_[A-Za-z0-9_]+:live$/)
      .optional(),
    efaChannelReference: z.string().trim().min(1).max(500).optional(),
    azEsaChannelReference: z.string().trim().min(1).max(500).optional(),
  })
  .refine(
    (v) =>
      !!v.stripeNamespace ||
      !!v.efaChannelReference ||
      !!v.azEsaChannelReference,
  );
export type MeasurementSources = z.infer<typeof measurementSourcesSchema>;
export interface VerifiedAdvertisingPayment {
  accountId: string;
  occurredAt: string;
  originalMinor: number;
  netMinor: number;
  currency: "USD";
  refundPending: boolean;
}
const minor = z.number().int().nonnegative().max(100_000_000);
const second = z.number().int().positive().max(8_640_000_000_000);
const stripeFacts = z.object({
  account_id: z.string().min(1),
  paid_at: second,
  paid_minor: minor.refine((n) => n > 0),
  currency: z.literal("usd"),
  invoice_reason: z.literal("subscription_create"),
  live: z.literal(true),
  charge_id: z.string().min(1),
  refunds: z
    .array(
      z.object({
        id: z.string().min(1),
        chargeId: z.string().min(1),
        amountMinor: minor,
        currency: z.literal("usd"),
        created: second,
        status: z.enum([
          "pending",
          "requires_action",
          "succeeded",
          "failed",
          "canceled",
        ]),
      }),
    )
    .max(1000),
});

/** Read-only trusted financial projection. No caller-supplied amount, email,
 * timestamp, learner or advertising identifier is accepted. The caller must
 * hold the exclusive account lock before relying on this snapshot for delivery.
 * Acquisition measurement excludes renewals, test-mode payments and unlinked ESA imports.
 */
export async function verifiedAdvertisingPayment(
  client: PoolClient,
  rawSources: MeasurementSources,
  rawReference: PaymentReference,
  now = new Date(),
): Promise<VerifiedAdvertisingPayment | null> {
  const sources = measurementSourcesSchema.parse(rawSources);
  const ref = paymentReferenceSchema.parse(rawReference);
  if (!Number.isFinite(+now)) throw new Error("invalid_measurement_time");
  if (ref.kind === "stripe") {
    if (!sources.stripeNamespace) return null;
    const result = await client.query(
      `SELECT r.account_id,r.baseline->'paidAt' AS paid_at,r.baseline->'paidMinor' AS paid_minor,
       r.baseline->>'currency' AS currency,r.baseline->>'invoiceReason' AS invoice_reason,
       r.baseline->'profile'->'livemode' AS live,r.baseline->>'chargeId' AS charge_id,
       (SELECT o.observation->'observation'->'refunds' FROM amp_payment_observations o
        WHERE o.record_id=r.id ORDER BY o.sequence DESC LIMIT 1) AS refunds
       FROM amp_payment_records r JOIN amp_stripe_checkouts c ON c.id=r.checkout_id
       AND c.account_id=r.account_id AND c.namespace=r.namespace
       WHERE r.id=$1 AND r.namespace=$2 AND r.status='verified' AND r.review_reason IS NULL
       AND r.baseline->>'invoiceId'=r.invoice_id AND r.baseline->>'checkoutId'=r.checkout_id::text
       AND (r.baseline->'profile'->>'accountId') || ':live'=r.namespace
       AND NOT EXISTS(SELECT 1 FROM amp_payment_holds h WHERE h.namespace=r.namespace AND h.invoice_id=r.invoice_id)
       AND (SELECT o.observation->>'kind' FROM amp_payment_observations o WHERE o.record_id=r.id ORDER BY o.sequence DESC LIMIT 1)='verified'`,
      [ref.id, sources.stripeNamespace],
    );
    const parsed = stripeFacts.safeParse(result.rows[0]);
    if (!parsed.success) return null;
    const facts = parsed.data;
    const seen = new Set<string>();
    let refunded = 0;
    for (const refund of facts.refunds) {
      if (
        seen.has(refund.id) ||
        refund.chargeId !== facts.charge_id ||
        refund.created * 1000 > +now ||
        refund.created < facts.paid_at
      )
        return null;
      seen.add(refund.id);
      if (refund.status === "succeeded") refunded += refund.amountMinor;
    }
    if (refunded > facts.paid_minor || facts.paid_at * 1000 > +now) return null;
    return {
      accountId: facts.account_id,
      occurredAt: new Date(facts.paid_at * 1000).toISOString(),
      originalMinor: facts.paid_minor,
      netMinor: facts.paid_minor - refunded,
      currency: "USD",
      refundPending: facts.refunds.some(
        (f) => f.status === "pending" || f.status === "requires_action",
      ),
    };
  }
  const channel =
    ref.kind === "arizona-esa"
      ? sources.azEsaChannelReference
      : sources.efaChannelReference;
  const program = ref.kind === "arizona-esa" ? "az-esa" : "ar-efa";
  const jurisdiction = ref.kind === "arizona-esa" ? "AZ" : "AR";
  if (!channel) return null;
  const result = await client.query(
    `SELECT o.account_id,o.order_state->'amountMinor' AS amount,o.order_state->>'refund' AS refund,
     (SELECT jsonb_agg(e.payload ORDER BY e.sequence) FROM amp_commerce_events e
       WHERE e.order_id=o.id AND e.channel=o.channel AND e.channel_reference=o.channel_reference
       AND e.payload->>'type' IN ('order.settled','refund.completed')) AS events
     FROM amp_commerce_orders o JOIN amp_funding_requests r ON r.order_id=o.id AND r.account_id=o.account_id
     WHERE o.id=$1 AND o.channel='esa' AND o.channel_reference=$2
       AND o.order_state->>'settlement'='settled' AND o.order_state->>'currency'='USD'
       AND r.offer_snapshot->>'programId'=$3 AND r.offer_snapshot->>'jurisdiction'=$4
       AND r.offer_snapshot->>'channelReference'=o.channel_reference`,
    [ref.id, channel, program, jurisdiction],
  );
  const row = result.rows[0];
  if (
    !row ||
    !minor.refine((n) => n > 0).safeParse(row.amount).success ||
    !Array.isArray(row.events) ||
    !["none", "requested", "completed"].includes(row.refund)
  )
    return null;
  const parsed = z.array(commerceEventSchema).max(2).safeParse(row.events);
  if (!parsed.success) return null;
  const events = parsed.data;
  const paid = events.filter((e) => e.type === "order.settled");
  const refunds = events.filter((e) => e.type === "refund.completed");
  if (
    paid.length !== 1 ||
    refunds.length !== (row.refund === "completed" ? 1 : 0)
  )
    return null;
  const settlement = paid[0]!;
  if (
    events.some(
      (e) =>
        e.channel !== "esa" ||
        e.channelReference !== channel ||
        e.orderId !== ref.id ||
        !("amountMinor" in e) ||
        e.amountMinor !== row.amount ||
        e.currency !== "USD" ||
        Date.parse(e.occurredAt) > +now ||
        Date.parse(e.occurredAt) < Date.parse(settlement.occurredAt),
    )
  )
    return null;
  return {
    accountId: row.account_id,
    occurredAt: settlement.occurredAt,
    originalMinor: row.amount,
    netMinor: refunds.length ? 0 : row.amount,
    currency: "USD",
    refundPending: row.refund === "requested",
  };
}
