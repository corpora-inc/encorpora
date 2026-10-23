import type { Pool } from "pg";
import { CAMPAIGN_PROGRAMS } from "./campaign.js";
import {
  campaignMatchesOffer,
  fundedCampaignSchema,
} from "./funded-campaign.js";
import { RETENTION } from "../privacy/retention-periods.js";
import { learningConsentActive } from "../server/account-access.js";

/** Internal invoice cohort, not a visitor funnel or an advertising export.
 * Only aggregate counts and waiting ages leave this function. Retention can
 * remove invoices and attempts, so this is a snapshot of retained evidence.
 */
export async function fundedCohortSummary(
  pool: Pool,
  days: number,
  campaign: keyof typeof CAMPAIGN_PROGRAMS,
) {
  if (!Number.isInteger(days) || days < 1 || days > RETENTION.funnelEventDays)
    throw new Error(`Days must be 1–${RETENTION.funnelEventDays}`);
  const program = CAMPAIGN_PROGRAMS[campaign];
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    const window = (
      await client.query<{ from: string; as_of: string }>(
        `SELECT to_char(((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date-$1::int)::timestamp,
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "from",
        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS as_of`,
        [days - 1],
      )
    ).rows[0]!;
    const rows = (
      await client.query<{
        account_id: string | null;
        campaign_attribution: unknown;
        unclaimed: boolean;
        cancelled: boolean;
        submitted: boolean;
        evidence_before_claim: boolean;
        linked: boolean;
        approved: boolean;
        settled: boolean;
        refunded: boolean;
        issued: boolean;
        revoked: boolean;
        grant_current: boolean;
        observed_use: boolean;
        mail_accepted: boolean;
        mail_stopped: boolean;
        mail_pending: boolean;
        mail_missing: boolean;
        invoice_age_hours: number;
        approval_age_hours: number | null;
        access_age_hours: number | null;
      }>(
        `WITH invoices AS (
        SELECT r.id,r.account_id,r.learner_id,r.offer_snapshot,r.created_at,r.status,
          r.order_id,r.campaign_attribution,false AS unclaimed,false AS evidence_before_claim
        FROM amp_funding_requests r
        UNION ALL
        SELECT i.id,NULL,NULL,i.offer_snapshot,i.created_at,
          CASE WHEN i.state='cancelled' THEN 'cancelled' ELSE 'prepared' END,
          NULL,i.campaign_attribution,true,i.received_payment_at IS NOT NULL
        FROM amp_funding_invoice_intents i WHERE i.claimed_request_id IS NULL
      ), cohort AS (
        SELECT * FROM invoices WHERE offer_snapshot->>'programId'=$2
          AND offer_snapshot->>'jurisdiction'=$3 AND created_at >= $1::timestamptz
          AND created_at <= CURRENT_TIMESTAMP
      ), evidence AS (
        SELECT e.order_id,
          min(e.recorded_at) FILTER (WHERE e.payload->>'type'='license.activated') AS activation_recorded,
          min((e.payload->>'occurredAt')::timestamptz)
            FILTER (WHERE e.payload->>'type'='order.approved') AS approval_recorded
        FROM amp_commerce_events e JOIN amp_commerce_orders o ON o.id=e.order_id
          AND o.channel=e.channel AND o.channel_reference=e.channel_reference
        JOIN cohort c ON c.order_id=o.id AND c.account_id=o.account_id AND c.learner_id=o.learner_id
        WHERE e.channel='esa' GROUP BY e.order_id
      )
      SELECT c.account_id,c.campaign_attribution,c.unclaimed,c.status='cancelled' AS cancelled,
        c.status='parent-reported-submitted' AS submitted,c.evidence_before_claim,
        o.id IS NOT NULL AS linked,o.order_state->>'approval'='approved' AS approved,
        o.order_state->>'settlement'='settled' AS settled,
        o.order_state->>'refund'='completed' AS refunded,
        o.grant_state IS NOT NULL AS issued,o.grant_state->>'status'='revoked' AS revoked,
        g.status='active' AND o.grant_state->>'status'='active' AND l.deleted_at IS NULL
          AND l.id IS NOT NULL AND g.starts_at<=CURRENT_TIMESTAMP AND g.ends_at>CURRENT_TIMESTAMP
          AS grant_current,
        e.activation_recorded IS NOT NULL AND EXISTS (
          SELECT 1 FROM amp_attempts a WHERE a.learner_id=c.learner_id
            AND a.created_at >= GREATEST(e.activation_recorded,
              (o.grant_state->>'issuedAt')::timestamptz,(o.grant_state->>'startsAt')::timestamptz)
            AND a.created_at < LEAST((o.grant_state->>'endsAt')::timestamptz,
              (o.grant_state->>'revokedAt')::timestamptz)
            AND a.created_at <= CURRENT_TIMESTAMP
        ) AS observed_use,
        n.accepted_at IS NOT NULL AS mail_accepted,
        n.accepted_at IS NULL AND n.stopped_at IS NOT NULL AS mail_stopped,
        n.request_id IS NOT NULL AND n.accepted_at IS NULL AND n.stopped_at IS NULL AS mail_pending,
        o.grant_state IS NOT NULL AND n.request_id IS NULL AS mail_missing,
        (extract(epoch FROM CURRENT_TIMESTAMP-c.created_at)/3600)::float8 AS invoice_age_hours,
        (extract(epoch FROM CURRENT_TIMESTAMP-e.approval_recorded)/3600)::float8 AS approval_age_hours,
        CASE WHEN e.activation_recorded IS NOT NULL THEN
          (extract(epoch FROM CURRENT_TIMESTAMP-GREATEST(e.activation_recorded,
            (o.grant_state->>'issuedAt')::timestamptz,(o.grant_state->>'startsAt')::timestamptz))/3600)::float8
          END AS access_age_hours
      FROM cohort c
      LEFT JOIN amp_commerce_orders o ON o.id=c.order_id AND o.channel='esa'
        AND o.account_id=c.account_id AND o.learner_id=c.learner_id
      LEFT JOIN evidence e ON e.order_id=o.id
      LEFT JOIN amp_learners l ON l.id=c.learner_id AND l.account_id=c.account_id
      LEFT JOIN amp_grants g ON g.id='commerce:' || (o.grant_state->>'id')
        AND g.learner_id=c.learner_id AND g.channel='esa'
      LEFT JOIN amp_funded_activation_outbox n ON n.request_id=c.id`,
        [window.from, program.programId, program.state],
      )
    ).rows;
    // Reuse the product's consent decision instead of copying its policy/version
    // logic into analytics. One lookup per distinct currently entitled account.
    const consent = new Map<string, boolean>();
    for (const row of rows)
      if (row.grant_current && row.account_id && !consent.has(row.account_id))
        consent.set(
          row.account_id,
          await learningConsentActive(client, row.account_id),
        );
    const counts = {
      retained_invoices: rows.length,
      unattributed_invoices: 0,
      unclaimed_invoices: 0,
      account_bound_requests: 0,
      cancelled_invoices: 0,
      parent_reported_submitted: 0,
      provider_evidence_waiting_for_claim: 0,
      linked_orders: 0,
      approved_orders: 0,
      approved_awaiting_settlement: 0,
      settled_orders: 0,
      refunded_orders: 0,
      issued_grants: 0,
      revoked_grants: 0,
      current_usable_access: 0,
      current_access_without_observed_use: 0,
      observed_use_during_grant: 0,
      settled_with_observed_use: 0,
      activation_mail_accepted: 0,
      activation_mail_pending: 0,
      activation_mail_stopped: 0,
      issued_grant_without_mail_record: 0,
    };
    const waiting = {
      oldest_unclaimed_hours: null as number | null,
      oldest_approved_unsettled_hours: null as number | null,
      oldest_current_access_unused_hours: null as number | null,
    };
    const oldest = (a: number | null, b: number | null) =>
      b === null || b < 0 ? a : Math.max(a ?? 0, Math.floor(b));
    for (const r of rows) {
      const labels = fundedCampaignSchema.safeParse(r.campaign_attribution);
      if (
        !labels.success ||
        !campaignMatchesOffer(labels.data, {
          programId: program.programId,
          jurisdiction: program.state,
        })
      )
        counts.unattributed_invoices++;
      if (r.unclaimed) counts.unclaimed_invoices++;
      else counts.account_bound_requests++;
      if (r.cancelled) counts.cancelled_invoices++;
      if (r.submitted) counts.parent_reported_submitted++;
      if (r.evidence_before_claim) counts.provider_evidence_waiting_for_claim++;
      if (r.linked) counts.linked_orders++;
      if (r.approved) counts.approved_orders++;
      if (r.approved && !r.settled) {
        counts.approved_awaiting_settlement++;
        waiting.oldest_approved_unsettled_hours = oldest(
          waiting.oldest_approved_unsettled_hours,
          r.approval_age_hours,
        );
      }
      if (r.settled) counts.settled_orders++;
      if (r.refunded) counts.refunded_orders++;
      if (r.issued) counts.issued_grants++;
      if (r.revoked) counts.revoked_grants++;
      if (r.observed_use) counts.observed_use_during_grant++;
      if (r.settled && r.observed_use) counts.settled_with_observed_use++;
      if (r.grant_current && r.account_id && consent.get(r.account_id)) {
        counts.current_usable_access++;
        if (!r.observed_use) {
          counts.current_access_without_observed_use++;
          waiting.oldest_current_access_unused_hours = oldest(
            waiting.oldest_current_access_unused_hours,
            r.access_age_hours,
          );
        }
      }
      if (r.mail_accepted) counts.activation_mail_accepted++;
      if (r.mail_pending) counts.activation_mail_pending++;
      if (r.mail_stopped) counts.activation_mail_stopped++;
      if (r.mail_missing) counts.issued_grant_without_mail_record++;
      if (r.unclaimed && !r.cancelled)
        waiting.oldest_unclaimed_hours = oldest(
          waiting.oldest_unclaimed_hours,
          r.invoice_age_hours,
        );
    }
    await client.query("COMMIT");
    return {
      program: program.programId,
      from: window.from,
      asOf: window.as_of,
      counts,
      waiting,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
