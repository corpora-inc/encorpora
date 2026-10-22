import type { PoolClient } from "pg";
import { z } from "zod";
import {
  CAMPAIGN_MEDIA,
  CAMPAIGN_SOURCES,
  CAMPAIGN_CREATIVES,
} from "./campaign.js";
import { incrementCreativeCampaign } from "./creative-campaign.js";
import type { CommerceEvent } from "../commerce/contracts.js";

/** Coarse first-party labels only; never ad-platform identifiers or learning data. */
export const fundedCampaignSchema = z.strictObject({
  campaign: z.literal("ar-efa-launch"),
  source: z.enum(CAMPAIGN_SOURCES),
  medium: z.enum(CAMPAIGN_MEDIA),
  creative: z.enum(CAMPAIGN_CREATIVES).optional(),
});
export type FundedCampaign = z.infer<typeof fundedCampaignSchema>;
type Action =
  "request_prepared" | "order_created" | "order_settled" | "refund_completed";

/** Caller owns the transaction that creates the request or verifies the payment. */
export async function incrementFundedCampaign(
  client: PoolClient,
  labels: FundedCampaign,
  action: Action,
  occurredAt: string,
) {
  await client.query(
    `INSERT INTO amp_funded_campaign_daily(day,campaign,source,medium,action,count)
     VALUES (($1::timestamptz AT TIME ZONE 'UTC')::date,$2,$3,$4,$5,1)
     ON CONFLICT(day,campaign,source,medium,action)
     DO UPDATE SET count=amp_funded_campaign_daily.count+1`,
    [occurredAt, labels.campaign, labels.source, labels.medium, action],
  );
  await incrementCreativeCampaign(client, labels, action, occurredAt);
}

/** Count a verified transition once per linked funded request. The deduplication
 * marker stays with the financial record; aggregate rows have no identity keys.
 * Provisioning calls this after linking its request. Later imports call it from
 * the ledger transaction, including settlements following credit activation.
 */
export async function recordFundedCampaignEvent(
  client: PoolClient,
  event: CommerceEvent,
) {
  if (event.channel !== "esa") return;
  const action: Action | undefined =
    event.type === "order.created"
      ? "order_created"
      : event.type === "order.settled" && event.amountMinor > 0
        ? "order_settled"
        : event.type === "refund.completed" && event.amountMinor > 0
          ? "refund_completed"
          : undefined;
  if (!action) return;
  const result = await client.query(
    `SELECT id,campaign_attribution,campaign_counted FROM amp_funding_requests
     WHERE order_id=$1 AND offer_snapshot->>'programId'='ar-efa'
       AND offer_snapshot->>'jurisdiction'='AR'
       AND campaign_attribution IS NOT NULL FOR UPDATE`,
    [event.orderId],
  );
  const row = result.rows[0];
  if (!row || row.campaign_counted.includes(action)) return;
  const labels = fundedCampaignSchema.parse(row.campaign_attribution);
  await incrementFundedCampaign(client, labels, action, event.occurredAt);
  await client.query(
    "UPDATE amp_funding_requests SET campaign_counted=array_append(campaign_counted,$2) WHERE id=$1",
    [row.id, action],
  );
}
