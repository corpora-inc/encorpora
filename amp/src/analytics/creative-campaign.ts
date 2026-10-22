import type { PoolClient } from "pg";
import type {
  CAMPAIGN_CREATIVES,
  CAMPAIGN_MEDIA,
  CAMPAIGN_SOURCES,
} from "./campaign.js";

type Labels = {
  source: (typeof CAMPAIGN_SOURCES)[number];
  medium: (typeof CAMPAIGN_MEDIA)[number];
  creative?: (typeof CAMPAIGN_CREATIVES)[number];
};
type Action =
  | "landing_view"
  | "try_click"
  | "invoice_click"
  | "request_prepared"
  | "order_created"
  | "order_settled"
  | "refund_completed";

/** The caller's transaction also records the existing coarse counter. Historical
 * data without a known creative is never assigned to one retrospectively. */
export async function incrementCreativeCampaign(
  client: PoolClient,
  labels: Labels,
  action: Action,
  occurredAt?: string,
) {
  if (!labels.creative) return;
  await client.query(
    `INSERT INTO amp_campaign_creative_daily(day,campaign,source,medium,creative,action,count)
     VALUES ((COALESCE($1::timestamptz,CURRENT_TIMESTAMP) AT TIME ZONE 'UTC')::date,'ar-efa-launch',$2,$3,$4,$5,1)
     ON CONFLICT(day,campaign,source,medium,creative,action)
     DO UPDATE SET count=amp_campaign_creative_daily.count+1`,
    [occurredAt ?? null, labels.source, labels.medium, labels.creative, action],
  );
}
