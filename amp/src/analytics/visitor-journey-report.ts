import type { Pool } from "pg";
import { visitorIdSchema } from "./events.js";

/** Operator-only database report. Contains personal information: never publish
 * its output or expose this through an anonymous HTTP endpoint. */
export async function visitorJourneyReport(
  pool: Pool,
  input: { email?: string; visitor?: string; days?: number },
) {
  const days = input.days ?? 30;
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 90 ||
    (!input.email && !input.visitor) ||
    (input.email && input.visitor)
  )
    throw new Error("Choose one email or visitor and 1–90 days");
  if (input.visitor) visitorIdSchema.parse(input.visitor);
  const db = await pool.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL statement_timeout='15s'");
    const asOf = (await db.query("SELECT now() AS at")).rows[0].at;
    const user = input.email
      ? (
          await db.query(
            `SELECT id,email,"emailVerified" AS verified,"createdAt" AS created_at FROM amp_auth_users WHERE lower(email)=lower($1)`,
            [input.email],
          )
        ).rows[0]
      : null;
    if (input.email && !user) throw new Error("Account not found");
    const accountId = user ? `amp|${user.id}` : null;
    const params = [accountId, input.visitor ?? null, days];
    const events = (
      await db.query(
        `SELECT event,props,client_at,received_at,session_id,visitor_id,
      CASE WHEN account_id IS NULL THEN 'anonymous_browser' ELSE 'authenticated_account' END AS attribution
      FROM amp_visitor_journeys WHERE ($1::text IS NOT NULL AND account_id=$1 OR $2::uuid IS NOT NULL AND visitor_id=$2)
      AND received_at >= now()-make_interval(days=>$3) ORDER BY received_at,event_id LIMIT 10001`,
        params,
      )
    ).rows;
    const timeline: {
      at: Date | string;
      event: string;
      evidence: string;
      details: unknown;
    }[] = [];
    const add = (
      at: Date | string | null,
      event: string,
      details: unknown = {},
    ) => {
      if (at) timeline.push({ at, event, evidence: "server_record", details });
    };
    let followup: unknown = null;
    let invoices: unknown[] = [],
      requests: unknown[] = [];
    if (user) {
      add(user.created_at, "account_created");
      const f = (
        await db.query(
          "SELECT program,campaign,signup_method,verified_at,unsubscribed_at FROM amp_parent_followups WHERE user_id=$1",
          [user.id],
        )
      ).rows[0];
      followup = f ?? null;
      add(f?.verified_at, "email_verified");
      add(f?.unsubscribed_at, "followup_unsubscribed");
      const rows = async (sql: string) =>
        (await db.query(sql, [accountId, days])).rows;
      for (const row of await rows(
        `SELECT created_at FROM amp_parent_assessment_entries WHERE 'amp|'||user_id=$1 AND created_at>=now()-make_interval(days=>$2)`,
      ))
        add(row.created_at, "learner_birth_year_selected");
      for (const row of await rows(
        `SELECT created_at,adopted_at FROM amp_trials WHERE owner_account_id=$1 AND created_at>=now()-make_interval(days=>$2)`,
      )) {
        add(row.created_at, "trial_created");
        add(row.adopted_at, "trial_adopted");
      }
      const ownership = `(l.account_id=$1 OR EXISTS(SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND (t.owner_account_id=$1 OR t.adopted_by=$1)))`;
      for (const row of await rows(
        `SELECT i.created_at,i.content->>'skippedAt' AS skipped_at FROM amp_instances i JOIN amp_learners l ON l.id=i.learner_id WHERE ${ownership} AND i.created_at>=now()-make_interval(days=>$2)`,
      )) {
        add(row.created_at, "problem_generated");
        if (row.skipped_at) add(row.skipped_at, "problem_skipped");
      }
      for (const row of await rows(
        `SELECT a.created_at FROM amp_attempts a JOIN amp_learners l ON l.id=a.learner_id WHERE ${ownership} AND a.created_at>=now()-make_interval(days=>$2)`,
      ))
        add(row.created_at, "answer_recorded");
      invoices = await rows(
        `SELECT created_at,state,received_payment_at FROM amp_funding_invoice_intents WHERE (claimed_account_id=$1 OR (claimed_account_id IS NULL AND EXISTS(SELECT 1 FROM amp_auth_users u WHERE 'amp|'||u.id=$1 AND u."emailVerified" AND lower(u.email)=parent_email))) AND created_at>=now()-make_interval(days=>$2)`,
      );
      for (const row of invoices as {
        created_at: Date;
        state: string;
        received_payment_at: Date | null;
      }[]) {
        add(row.created_at, "invoice_prepared", { currentState: row.state });
        add(row.received_payment_at, "invoice_payment_received");
      }
      requests = await rows(
        `SELECT created_at,status,offer_id FROM amp_funding_requests WHERE account_id=$1 AND created_at>=now()-make_interval(days=>$2)`,
      );
      for (const row of requests as {
        created_at: Date;
        status: string;
        offer_id: string;
      }[])
        add(row.created_at, "funding_request_prepared", {
          currentStatus: row.status,
          offer: row.offer_id,
        });
      for (const row of await rows(
        `SELECT created_at,closed FROM amp_stripe_checkouts WHERE account_id=$1 AND created_at>=now()-make_interval(days=>$2)`,
      ))
        add(row.created_at, "card_checkout_created", { closed: row.closed });
      for (const row of await rows(
        `SELECT observed_at,status FROM amp_payment_records WHERE account_id=$1 AND observed_at>=now()-make_interval(days=>$2)`,
      ))
        add(row.observed_at, "payment_record_observed", { status: row.status });
      for (const row of await rows(
        `SELECT stage,accepted_at,stopped_at,stopped_reason FROM amp_parent_followup_outbox WHERE 'amp|'||user_id=$1 AND coalesce(accepted_at,stopped_at)>=now()-make_interval(days=>$2)`,
      )) {
        add(row.accepted_at, "followup_provider_accepted", {
          stage: row.stage,
        });
        add(row.stopped_at, "followup_stopped", {
          stage: row.stage,
          reason: row.stopped_reason,
        });
      }
    }
    for (const row of events.slice(0, 10000))
      timeline.push({
        at: row.client_at,
        event: row.event,
        evidence: "browser_event",
        details: {
          props: row.props,
          receivedAt: row.received_at,
          session: row.session_id,
          visitor: row.visitor_id,
          attribution: row.attribution,
        },
      });
    timeline.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
    // Browser context is correlation, not proof that anonymous activity belongs to this parent.
    const browsers = (
      await db.query(
        `SELECT visitor_id,first_seen,last_seen,utm_source,utm_medium,utm_campaign,referrer,device,traffic_kind FROM amp_funnel_visitors WHERE visitor_id=$2::uuid OR visitor_id IN (SELECT visitor_id FROM amp_visitor_journeys WHERE account_id=$1) ORDER BY last_seen DESC LIMIT 100`,
        params.slice(0, 2),
      )
    ).rows;
    await db.query("COMMIT");
    return {
      asOf,
      days,
      account: user ? { email: user.email, verified: user.verified } : null,
      followup,
      browsers,
      invoices,
      requests,
      truncated: events.length > 10000,
      timeline,
      limitations: [
        "Client times can be skewed; receivedAt is the server clock. No event proves why someone left. Last observed activity is not an exact exit time.",
        "Account attribution comes from authenticated sessions. Anonymous browser history is not assigned retroactively; shared devices can contain multiple people's activity.",
        "Historical events without detailed envelopes have day-level aggregate evidence only; legacy unowned trials cannot reliably be attributed to a parent.",
        "Generated problems may be prefetched. Rendered means a mounted component in a visible document after a paint opportunity, not proof it was seen or read.",
        "Invoice creation, document download, handoff and parent-reported submission are not payment. Payment records require their verified status; consult report:funded-journeys for settled funded revenue.",
        "Mail-provider acceptance is not delivery, reading, replying or clicking. Personal outreach appears only if a private sent-receipt ledger is supplied to the CLI.",
        "Blocked analytics, privacy opt-outs, offline tab closure and expired queues can leave gaps. Internal and automated traffic is labeled in browser context. No session replay, input contents or raw errors are collected.",
      ],
    };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
