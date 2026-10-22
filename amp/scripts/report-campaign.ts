import {
  arkansasOrderSummary,
  arkansasCashSummary,
} from "../src/analytics/campaign-orders.js";
import { RETENTION } from "../src/privacy/retention-periods.js";
import { createDatabasePool } from "../src/server/database.js";

/** Aggregate campaign report. No individual visitor/account data is emitted. */
const days = Number(process.argv[2] ?? 30);
if (!Number.isInteger(days) || days < 1 || days > RETENTION.funnelEventDays)
  throw new Error(
    `Days must be 1–${RETENTION.funnelEventDays}, the available funnel-retention window`,
  );
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const activity = await pool.query(
    `SELECT day,state,program,campaign,source,medium,action,count
    FROM amp_campaign_daily WHERE day >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
    ORDER BY day,campaign,source,medium,action`,
    [days - 1],
  );
  const funnel = await pool.query(
    `SELECT v.utm_source AS source,v.utm_medium AS medium,
    e.event,count(*)::int AS events FROM amp_funnel_events e
    JOIN amp_funnel_visitors v ON v.visitor_id=e.visitor_id
    WHERE v.utm_campaign='ar-efa-launch' AND e.occurred_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
    AND e.event IN ('try_click','placement_done','purchase')
    GROUP BY v.utm_source,v.utm_medium,e.event ORDER BY 1,2,3`,
    [days - 1],
  );
  const arkansasOrders = await arkansasOrderSummary(pool, days);
  const arkansasCash = await arkansasCashSummary(pool, days);
  const creatives = await pool.query(
    `SELECT day,campaign,source,medium,creative,action,count FROM amp_campaign_creative_daily
     WHERE day >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
     ORDER BY day,campaign,source,medium,creative,action`,
    [days - 1],
  );
  const fundedCampaign = await pool.query(
    `SELECT day,campaign,source,medium,action,count FROM amp_funded_campaign_daily
     WHERE day >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
     ORDER BY day,campaign,source,medium,action`,
    [days - 1],
  );
  console.log(
    JSON.stringify(
      {
        definitions: {
          arkansasCash:
            "Verified ESA settlements and completed refunds linked to retained Arkansas funding requests, grouped by UTC evidence date, currency and optional fixed campaign labels. Amounts are exact integer strings in the currency minor unit. Null labels mean unattributed; null creative does not infer an ad. Net cash is gross minus completed refunds, not profit or recognized revenue. Never sum different currencies. No ad-platform export.",
          activity:
            "Daily page loads and link clicks, not unique people. Reloads and bots can count.",
          invoice_click:
            "Opening an email link, not an invoice request, approved order, or sale.",
          funnel:
            "Existing AMP first-touch campaign events. Purchase means a server-verified Stripe purchase, not an ESA/ClassWallet order. No cross-domain visitor join; campaign totals only. Existing visitors may retain an earlier campaign.",
          fundedCampaign:
            "Historical server-verified transitions for Arkansas requests with fixed labels supplied at creation. Request preparation uses its creation date; order/refund events use their evidence date in UTC. Each action counts once per request. Labels are self-reported campaign context, not independently verified ad clicks or proof of causal lift. No ad-platform export.",
          creatives:
            "Optional breakdown of activity and fundedCampaign by fixed authored creative label. These counts are subsets of the coarse totals, not additional conversions. Unknown or absent creatives are omitted, not inferred. No creative attribution is added to learner or assessment events.",
        },
        limitations: [
          "Cash reporting follows settlement/refund evidence dates, regardless of request creation or import date. Refunds for older payments can make a period negative. Pending refunds, approvals and license activation are excluded. Processor fees, ad spend and unlinked payments are excluded; this is not an account reconciliation or return-on-ad-spend calculation.",
          "Arkansas order totals are current states for retained funding requests created in the report window, not purchases attributed to an ad. Expired unconverted requests are deleted, so request counts are not historical lead totals.",
          "Only retained offers with programId ar-efa and jurisdiction AR establish Arkansas classification. Unlinked commerce imports and email-only invoices are excluded.",
          "Prepared request records include submitted and cancelled records. Approved, settled, issued and refunded totals overlap; they are not additive sales.",
          "Funded campaign counts include only requests created with attribution. Existing requests are not backfilled. Count of settled orders is gross; refund_completed is distinct, not revenue or net sales. Requests and payments may occur in different report windows.",
        ],
        arkansasOrders,
        arkansasCash,
        fundedCampaign: fundedCampaign.rows,
        creatives: creatives.rows,
        activity: activity.rows,
        funnel: funnel.rows,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
