import type { Pool } from "pg";
import { purchaseEvidenceSql, grantedAccessSql } from "./evidence.js";

/** Private operator snapshot. No HTTP route; never publish contact-level output. */
export async function acquisitionPipelineReport(pool: Pool) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL statement_timeout='15s'");
    const asOf = (await db.query("SELECT now() AS at")).rows[0].at;
    const contacts = (
      await db.query(`SELECT c.user_id,u.name,p.email,u."createdAt" AS signed_up_at,
      p.program,p.campaign,p.entry_label,p.signup_method,u."emailVerified" AS email_verified,p.verified_at,
      c.next_contact_at,c.time_zone,c.time_zone_basis,c.hold_reason,c.suppressed_at,c.suppression_reason,
      p.unsubscribed_at,c.mailbox_checked_at,c.mailbox_checked_for,
      lower(u.email)<>lower(p.email) AS email_changed,
      (SELECT max(sent_at) FROM amp_acquisition_messages m WHERE m.user_id=c.user_id) AS last_sent_at,
      (SELECT count(*)::int FROM amp_acquisition_messages m WHERE m.user_id=c.user_id AND m.status='sent') AS sent_count,
      (SELECT max(occurred_at) FROM amp_acquisition_contact_events e WHERE e.user_id=c.user_id AND e.kind='reply') AS last_reply_at,
      (SELECT max(received_at) FROM amp_visitor_journeys j WHERE j.account_id='amp|'||c.user_id) AS last_observed_at,
      (SELECT count(*)::int FROM amp_trials t WHERE t.owner_account_id='amp|'||c.user_id OR t.adopted_by='amp|'||c.user_id) AS trials,
      (SELECT count(*)::int FROM amp_funding_requests r WHERE r.account_id='amp|'||c.user_id) AS funding_requests,
      (SELECT count(*)::int FROM amp_funding_invoice_intents i WHERE i.claimed_account_id='amp|'||c.user_id
        OR (i.claimed_account_id IS NULL AND u."emailVerified" AND i.parent_email=lower(u.email))) AS invoices,
      (SELECT count(*)::int FROM amp_stripe_checkouts s WHERE s.account_id='amp|'||c.user_id) AS card_checkouts,
      ${purchaseEvidenceSql("'amp|'||c.user_id")} AS has_verified_payment,
      ${grantedAccessSql("'amp|'||c.user_id")} AS has_granted_access,
      EXISTS(SELECT 1 FROM amp_access_gifts g WHERE g.account_id='amp|'||c.user_id AND g.activated_at IS NOT NULL) AS has_activated_gift,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'purpose',m.purpose,'intentKey',m.intent_key,'status',m.status,'subject',m.subject,'sender',m.sender,'recipient',m.recipient,
        'draftId',m.draft_id,'contentHash',m.content_hash,'approvedAt',m.approved_at,'claimedAt',m.claimed_at,'sentAt',m.sent_at,'messageId',m.provider_message_id,'threadId',m.provider_thread_id) ORDER BY m.created_at)
        FROM amp_acquisition_messages m WHERE m.user_id=c.user_id),'[]'::jsonb) AS messages,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('stage',o.stage,'acceptedAt',o.accepted_at,'stoppedAt',o.stopped_at,'reason',o.stopped_reason) ORDER BY o.stage)
        FROM amp_parent_followup_outbox o WHERE o.user_id=c.user_id),'[]'::jsonb) AS automated_mail
      FROM amp_acquisition_contacts c JOIN amp_parent_followups p USING(user_id) JOIN amp_auth_users u ON u.id=c.user_id
      ORDER BY u."createdAt",c.user_id`)
    ).rows;
    for (const c of contacts) {
      const nextAction = () => {
        const messages = c.messages as { status: string; purpose: string }[];
        if (c.suppressed_at || c.unsubscribed_at) return "do_not_contact";
        if (messages.some((m) => m.status === "sending"))
          return "reconcile_send";
        if (c.email_changed) return "review_changed_email";
        if (!c.email_verified || !c.verified_at) return "await_verification";
        if (c.hold_reason) return "held";
        if (
          c.last_reply_at &&
          (!c.last_sent_at || c.last_reply_at > c.last_sent_at)
        )
          return "review_reply";
        const pendingReply = messages.find(
          (m) =>
            m.purpose === "reply" && ["draft", "approved"].includes(m.status),
        );
        if (pendingReply)
          return pendingReply.status === "approved"
            ? "approved_check_mailbox"
            : "review_draft";
        if (c.has_verified_payment || c.has_granted_access) return "customer";
        if (
          !messages.some((m) => ["draft", "approved"].includes(m.status)) &&
          messages.some((m) => m.purpose === "welcome" && m.status === "sent")
        )
          return "await_reply";
        if (
          c.next_contact_at > asOf &&
          !messages.some(
            (m) =>
              m.purpose === "reply" && ["draft", "approved"].includes(m.status),
          )
        )
          return "wait_until_due";
        if (messages.some((m) => m.status === "approved"))
          return "approved_check_mailbox";
        if (messages.some((m) => m.status === "draft")) return "review_draft";
        if (
          messages.some((m) => m.purpose === "welcome" && m.status === "sent")
        )
          return "await_reply";
        return "review_first_contact";
      };
      c.next_action = nextAction();
    }
    const totals = (
      await db.query<{ accounts: number }>(
        "SELECT count(*)::int AS accounts FROM amp_auth_users",
      )
    ).rows[0];
    const coverage = (
      await db.query<{
        acquisition_signups: number;
        missing_contacts: number;
      }>(`SELECT count(*)::int AS acquisition_signups,count(*) FILTER(WHERE c.user_id IS NULL)::int AS missing_contacts
      FROM amp_parent_followups p LEFT JOIN amp_acquisition_contacts c USING(user_id) WHERE p.new_account`)
    ).rows[0];
    const unclassifiedAccounts = (
      await db.query(`SELECT u.id,u.email,u.name,u."createdAt" AS created_at,u."emailVerified" AS email_verified
      FROM amp_auth_users u LEFT JOIN amp_acquisition_contacts c ON c.user_id=u.id WHERE c.user_id IS NULL ORDER BY u."createdAt",u.id`)
    ).rows;
    await db.query("COMMIT");
    return { asOf, ...totals, ...coverage, contacts, unclassifiedAccounts };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
