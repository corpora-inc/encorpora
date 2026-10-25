import type { Pool } from "pg";
import { RETENTION } from "../privacy/retention-periods.js";

/** Read the authoritative invoice, settlement and access records. A parent
 * submission or provider approval alone is never counted as paid revenue.
 * Output contains aggregates only, not request, visitor, account or learner IDs.
 */
export async function fundedJourneyReport(pool: Pool, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > RETENTION.funnelEventDays)
    throw new Error(`Days must be 1–${RETENTION.funnelEventDays}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='20s'");
    const cohort = `WITH purchases AS (
      SELECT f.*,coalesce(v.traffic_kind,'unattributed') AS traffic_kind,
        coalesce(v.utm_source,v.referrer,i.campaign_attribution->>'source',r.campaign_attribution->>'source','unknown') AS source,
        coalesce(v.utm_medium,i.campaign_attribution->>'medium',r.campaign_attribution->>'medium','none') AS medium,
        coalesce(v.utm_campaign,i.campaign_attribution->>'campaign',r.campaign_attribution->>'campaign','none') AS campaign,
        coalesce(v.utm_content,i.campaign_attribution->>'creative',r.campaign_attribution->>'creative','none') AS creative,
        CASE WHEN v.referrer IS NOT NULL THEN 'browser_first_touch'
          WHEN i.campaign_attribution IS NOT NULL OR r.campaign_attribution IS NOT NULL THEN 'purchase_campaign_snapshot'
          ELSE 'unknown' END AS attribution_basis,
        (r.id IS NOT NULL) AS account_claimed,
        (f.submitted_on IS NOT NULL OR coalesce(r.status='parent-reported-submitted',false)) AS parent_submitted,
        (f.cancelled_on IS NOT NULL OR coalesce(r.status='cancelled',false) OR coalesce(i.state='cancelled',false)) AS cancelled,
        (p.order_id IS NOT NULL OR coalesce(o.order_state->>'approval'='approved',false)
          OR coalesce(c.callback_status='complete' AND c.stopped_at IS NULL AND c.exception_code IS NULL,false)) AS provider_approved,
        (p.order_id IS NOT NULL OR coalesce(o.order_state->>'settlement'='settled',false)) AS paid,
        (o.grant_state IS NOT NULL) AS access_issued,
        (mail.accepted_at IS NOT NULL) AS activation_email_accepted,
        (mail.stopped_at IS NOT NULL) AS activation_email_attention,
        coalesce(o.grant_state->>'status'='active' AND (o.grant_state->>'startsAt')::timestamptz<=now()
          AND (o.grant_state->>'endsAt')::timestamptz>now(),false) AS access_active,
        coalesce(o.order_state->>'refund'='completed',false) AS refunded,
        (r.id IS NULL AND i.id IS NULL) AS purchase_record_expired
      FROM amp_funded_visitor_links f
      LEFT JOIN amp_funnel_visitors v ON v.visitor_id=f.visitor_id
      LEFT JOIN amp_funding_invoice_intents i ON i.id=f.request_id
      LEFT JOIN amp_funding_requests r ON r.id=f.request_id::text
      LEFT JOIN amp_classwallet_payments p ON p.invoice_id=f.request_id::text
      LEFT JOIN amp_commerce_orders o ON o.id=r.order_id
      LEFT JOIN amp_classwallet_checkouts c ON c.request_id=r.id
      LEFT JOIN amp_funded_activation_outbox mail ON mail.request_id=r.id
      WHERE f.created_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date-($1::int-1)
    )`;
    const query = async (sql: string) => (await client.query(sql, [days])).rows;
    const coverage = await query(`${cohort}
      SELECT traffic_kind,attribution_basis,count(*)::int AS prepared
      FROM purchases GROUP BY 1,2 ORDER BY 1,2`);
    const sources = await query(`${cohort}
      SELECT jurisdiction,program,currency,source,medium,campaign,creative,attribution_basis,
        count(*)::int AS prepared,
        count(*) FILTER(WHERE document_kind='invoice')::int AS invoices,
        count(*) FILTER(WHERE account_claimed)::int AS account_claimed,
        count(*) FILTER(WHERE parent_submitted)::int AS parent_submitted,
        count(*) FILTER(WHERE provider_approved)::int AS provider_approved,
        count(*) FILTER(WHERE paid)::int AS paid,
        count(*) FILTER(WHERE access_issued)::int AS access_issued,
        count(*) FILTER(WHERE activation_email_accepted)::int AS activation_email_accepted,
        count(*) FILTER(WHERE activation_email_attention)::int AS activation_email_attention,
        count(*) FILTER(WHERE paid AND access_active)::int AS paid_with_active_access,
        count(*) FILTER(WHERE paid AND NOT access_issued)::int AS paid_awaiting_access,
        count(*) FILTER(WHERE cancelled)::int AS cancelled,
        count(*) FILTER(WHERE purchase_record_expired)::int AS purchase_record_expired,
        coalesce(sum(amount_minor) FILTER(WHERE paid),0)::float8 AS gross_paid_minor,
        coalesce(sum(amount_minor) FILTER(WHERE paid AND refunded),0)::float8 AS refunded_minor,
        coalesce(sum(amount_minor) FILTER(WHERE paid AND NOT refunded),0)::float8 AS net_after_refunds_minor
      FROM purchases WHERE traffic_kind NOT IN ('internal','automated')
      GROUP BY 1,2,3,4,5,6,7,8 ORDER BY paid DESC,prepared DESC,1,2,3,4,5,6,7,8`);
    const unlinked = await query(`WITH financial AS (
      SELECT id::text AS id FROM amp_funding_invoice_intents
        WHERE created_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date-($1::int-1)) AT TIME ZONE 'UTC'
      UNION SELECT id FROM amp_funding_requests
        WHERE created_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date-($1::int-1)) AT TIME ZONE 'UTC'
      ) SELECT count(*)::int AS missing_journey_records FROM financial f
      WHERE NOT EXISTS(SELECT 1 FROM amp_funded_visitor_links l WHERE l.request_id::text=f.id)`);
    await client.query("COMMIT");
    return {
      days,
      asOf: new Date().toISOString(),
      coverage,
      sources,
      unlinked,
      definitions: [
        "Cohorts are purchases prepared during the selected UTC days. A guest invoice and its later account claim count once; multiple invoices are not necessarily multiple families.",
        "Parent-submitted is self-reported. Approved is provider evidence. Paid requires a verified settled ClassWallet report row or a settled commerce order; approval and invoice creation never imply payment.",
        "ClassWallet settlement is counted even before an invoice is claimed or access is provisioned. A later ledger entry for that payment is not a second conversion.",
        "Activation-email acceptance means the mail provider accepted the notification, not proof the parent read it.",
        "Active access means a valid current license, not proof that a learner practiced. Gross paid includes the invoice total; net after refunds excludes completed full refunds, but does not subtract taxes, provider fees or advertising costs. Currencies are never combined.",
        "Customer rows exclude linked staff and automated browsers. Unknown and unattributed records may include historical testing; coverage exposes this uncertainty. First-touch browser attribution and purchase campaign snapshots are labeled separately.",
        "The bounded purchase-to-visitor link expires 90 days after invoice/request creation. Financial records retain their independent retention policy. Expired unconverted purchase records do not prove a parent abandoned the process.",
      ],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
