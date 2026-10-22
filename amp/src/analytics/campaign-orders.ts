import type { Pool } from "pg";
import { fundedCampaignSchema } from "./funded-campaign.js";
import { RETENTION } from "../privacy/retention-periods.js";

/** Current states of requests created in the window, not ad-attributed sales.
 * Program classification comes only from the retained, operator-configured offer.
 */
export async function arkansasOrderSummary(pool: Pool, days: number) {
  const result = await pool.query(
    `SELECT
    count(*)::int AS prepared_request_records,
    count(*) FILTER (WHERE r.status='parent-reported-submitted')::int AS parent_reported_submitted,
    count(*) FILTER (WHERE r.status='cancelled')::int AS cancelled_requests,
    count(o.id)::int AS linked_esa_orders,
    count(*) FILTER (WHERE o.order_state->>'approval'='approved')::int AS approved_orders,
    count(*) FILTER (WHERE o.order_state->>'settlement'='settled')::int AS settled_orders,
    count(*) FILTER (WHERE o.grant_state IS NOT NULL)::int AS issued_license_orders,
    count(*) FILTER (WHERE o.grant_state->>'status'='revoked')::int AS revoked_license_orders,
    count(*) FILTER (WHERE o.order_state->>'refund'='completed')::int AS refunded_orders
    FROM amp_funding_requests r
    LEFT JOIN amp_commerce_orders o ON o.id=r.order_id AND o.channel='esa'
    WHERE r.offer_snapshot->>'programId'='ar-efa'
      AND r.offer_snapshot->>'jurisdiction'='AR'
      AND r.created_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int)::timestamp AT TIME ZONE 'UTC'`,
    [days - 1],
  );
  return result.rows[0];
}

/** Evidence-dated cash movements, including requests created before the window.
 * Exact minor-unit strings avoid rounding aggregate amounts through JS numbers.
 * No identity, free text, or provider reference leaves this report boundary.
 */
export async function arkansasCashSummary(pool: Pool, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > RETENTION.funnelEventDays)
    throw new Error(`Days must be 1–${RETENTION.funnelEventDays}`);
  const result = await pool.query<{
    day: string;
    currency: string;
    campaign_attribution: unknown;
    gross_minor: string;
    refunded_minor: string;
  }>(
    `WITH movements AS (SELECT (e.payload->>'occurredAt')::timestamptz AT TIME ZONE 'UTC' AS evidence_at,
      e.payload->>'currency' AS currency, r.campaign_attribution,
      e.payload->>'type' AS kind, (e.payload->>'amountMinor')::numeric AS amount
     FROM amp_commerce_events e
     JOIN amp_commerce_orders o ON o.id=e.order_id AND o.channel=e.channel
       AND o.channel_reference=e.channel_reference
     JOIN amp_funding_requests r ON r.order_id=o.id
     WHERE e.channel='esa'
       AND e.payload->>'type' IN ('order.settled','refund.completed')
       AND r.offer_snapshot->>'programId'='ar-efa'
       AND r.offer_snapshot->>'jurisdiction'='AR'
     ) SELECT evidence_at::date::text AS day,currency,campaign_attribution,
       COALESCE(sum(amount) FILTER (WHERE kind='order.settled'),0)::text AS gross_minor,
       COALESCE(sum(amount) FILTER (WHERE kind='refund.completed'),0)::text AS refunded_minor
     FROM movements
     WHERE evidence_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
       AND evidence_at < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date + 1
     GROUP BY evidence_at::date,currency,campaign_attribution
     ORDER BY 1,2`,
    [days - 1],
  );
  const groups = new Map<
    string,
    {
      day: string;
      currency: string;
      campaign: string | null;
      source: string | null;
      medium: string | null;
      creative: string | null;
      gross: bigint;
      refunded: bigint;
    }
  >();
  for (const row of result.rows) {
    const parsed = fundedCampaignSchema.safeParse(row.campaign_attribution);
    const labels = parsed.success ? parsed.data : null;
    const dimensions = {
      day: row.day,
      currency: row.currency,
      campaign: labels?.campaign ?? null,
      source: labels?.source ?? null,
      medium: labels?.medium ?? null,
      creative: labels?.creative ?? null,
    };
    const key = JSON.stringify(dimensions);
    const group = groups.get(key) ?? { ...dimensions, gross: 0n, refunded: 0n };
    group.gross += BigInt(row.gross_minor);
    group.refunded += BigInt(row.refunded_minor);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { gross, refunded, ...dimensions }]) => ({
      ...dimensions,
      grossMinor: gross.toString(),
      refundedMinor: refunded.toString(),
      netMinor: (gross - refunded).toString(),
    }));
}
