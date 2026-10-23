import { fundedCohortSummary } from "../src/analytics/funded-cohort.js";
import {
  arkansasOrderSummary,
  arkansasCashSummary,
  fundedOrderSummary,
  fundedCashSummary,
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
    `SELECT v.utm_campaign AS campaign,v.utm_source AS source,v.utm_medium AS medium,
    e.event,count(*)::int AS events FROM amp_funnel_events e
    JOIN amp_funnel_visitors v ON v.visitor_id=e.visitor_id
    WHERE v.utm_campaign IN ('ar-efa-launch','az-esa-launch') AND e.occurred_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - $1::int
    AND e.event IN ('try_click','placement_done','purchase')
    GROUP BY v.utm_campaign,v.utm_source,v.utm_medium,e.event ORDER BY 1,2,3,4`,
    [days - 1],
  );
  const arkansasCohort = await fundedCohortSummary(pool, days, "ar-efa-launch");
  const arizonaCohort = await fundedCohortSummary(pool, days, "az-esa-launch");
  const arkansasOrders = await arkansasOrderSummary(pool, days);
  const arkansasCash = await arkansasCashSummary(pool, days);
  const arizonaOrders = await fundedOrderSummary(pool, days, "az-esa-launch");
  const arizonaCash = await fundedCashSummary(pool, days, "az-esa-launch");
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
          fundedCohorts:
            "Retained invoice-created UTC cohorts through the report snapshot, including unattributed and unclaimed invoices. A claimed guest invoice counts once. Counts overlap and represent invoices/licenses, not unique parents. Provider evidence awaiting claim is not assumed to be settled money. Current usable access requires a current grant, an undeleted learner and the product's current consent decision. Observed use requires a retained server-recorded answer for the exact learner during the grant term, after activation was both evidenced and imported, and before revocation. Settled-with-use may include authorized practice before bank settlement; it is not a new conversion. No answers, learner identities, learning metrics or usage events are exported to ad platforms. Mail acceptance is provider acceptance, not inbox delivery. Waiting ages are whole hours, null when no retained timing evidence qualifies.",
          arkansasCash:
            "Verified ESA settlements and completed refunds linked to retained Arkansas funding requests, grouped by UTC evidence date, currency and optional fixed campaign labels. Amounts are exact integer strings in the currency minor unit. Null labels mean unattributed; null creative does not infer an ad. Net cash is gross minus completed refunds, not profit or recognized revenue. Never sum different currencies. No ad-platform export.",
          arizonaCash:
            "Same cash definitions as arkansasCash, restricted to retained offers with programId az-esa and jurisdiction AZ.",
          activity:
            "Daily page loads and link clicks, not unique people. Reloads and bots can count.",
          invoice_click:
            "Opening the invoice entry action (the form on current state pages; an email link on older pages), not proof of an invoice, submission, approval or sale.",
          funnel:
            "Existing AMP first-touch campaign events. Purchase means a server-verified Stripe purchase, not an ESA/ClassWallet order. No cross-domain visitor join; campaign totals only. Existing visitors may retain an earlier campaign.",
          fundedCampaign:
            "Historical server-verified transitions for Arkansas and Arizona requests with fixed labels supplied at creation. Request preparation uses its creation date; order/refund events use their evidence date in UTC. Each action counts once per request. Labels are self-reported campaign context, not independently verified ad clicks or proof of causal lift. No ad-platform export.",
          creatives:
            "Optional breakdown of activity and fundedCampaign by fixed authored creative label. These counts are subsets of the coarse totals, not additional conversions. Unknown or absent creatives are omitted, not inferred. No creative attribution is added to learner or assessment events.",
        },
        limitations: [
          "Cash reporting follows settlement/refund evidence dates, regardless of request creation or import date. Refunds for older payments can make a period negative. Pending refunds, approvals and license activation are excluded. Processor fees, ad spend and unlinked payments are excluded; this is not an account reconciliation or return-on-ad-spend calculation.",
          "State order totals are current states for retained funding requests created in the report window, not purchases attributed to an ad. Expired unconverted requests are deleted, so request counts are not historical lead totals.",
          "Cohort observation is limited to retained invoices and online practice records. Expired unconverted invoices and erased learning history are not reconstructible. It does not prove learning outcomes, unique parent conversion, causal attribution, offline use or an ordered visitor funnel. A state-page visitor is not a verified scholarship participant.",
          "Retained offers establish state classification: ar-efa/AR for Arkansas and az-esa/AZ for Arizona. Unlinked commerce imports and email-only invoices are excluded.",
          "Prepared request records include submitted and cancelled records. Approved, settled, issued and refunded totals overlap; they are not additive sales.",
          "Funded campaign counts include only requests created with attribution. Existing requests are not backfilled. Count of settled orders is gross; refund_completed is distinct, not revenue or net sales. Requests and payments may occur in different report windows.",
        ],
        arizonaCohort,
        arkansasCohort,
        arizonaOrders,
        arizonaCash,
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
