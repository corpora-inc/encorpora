import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { followupMail, type FollowupMail, type MailConfig } from "./mail.js";
export type Transport = (
  mail: FollowupMail,
  id: string,
) => Promise<{ accepted: string } | { stopped: string } | null>;
/** A bounded scheduler job. Immutable payload and provider idempotency cover lost responses. */
export async function deliverParentFollowup(
  pool: Pool,
  config: MailConfig,
  send: Transport,
) {
  const db = await pool.connect();
  let job;
  try {
    await db.query("BEGIN");
    const row = (
      await db.query(`SELECT o.*,p.email,p.program,p.unsubscribe_token,p.unsubscribed_at,
      u.email AS current_email,u."emailVerified",
      EXISTS(SELECT 1 FROM amp_parent_followup_outbox w WHERE w.user_id=o.user_id AND w.stage='welcome' AND w.stopped_at IS NOT NULL) AS welcome_stopped,
      EXISTS(SELECT 1 FROM amp_commerce_orders c WHERE c.account_id='amp|'||p.user_id AND c.grant_state IS NOT NULL)
      OR EXISTS(SELECT 1 FROM amp_payment_records r WHERE r.account_id='amp|'||p.user_id AND r.status='verified')
      OR EXISTS(SELECT 1 FROM amp_access_gifts g WHERE g.account_id='amp|'||p.user_id AND g.activated_at IS NOT NULL) AS purchased
      FROM amp_parent_followup_outbox o JOIN amp_parent_followups p ON p.user_id=o.user_id
      JOIN amp_auth_users u ON u.id=p.user_id
      WHERE o.accepted_at IS NULL AND o.stopped_at IS NULL AND o.available_at<=now()
        AND (o.lease_until IS NULL OR o.lease_until<=now())
        AND (u."emailVerified" OR p.created_at<now()-interval '7 days' OR p.unsubscribed_at IS NOT NULL)
        AND (o.stage='welcome' OR EXISTS(SELECT 1 FROM amp_parent_followup_outbox w
          WHERE w.user_id=o.user_id AND w.stage='welcome' AND (w.accepted_at<=now()-interval '24 hours' OR w.stopped_at IS NOT NULL)))
      ORDER BY o.available_at,o.id LIMIT 1 FOR UPDATE OF o SKIP LOCKED`)
    ).rows[0];
    if (!row) {
      await db.query("COMMIT");
      return false;
    }
    const reason =
      row.stage === "reminder" && row.welcome_stopped
        ? "welcome-not-delivered"
        : row.unsubscribed_at
          ? "unsubscribed"
          : row.email !== row.current_email
            ? "email-changed"
            : !row.emailVerified
              ? "email-unverified"
              : row.purchased
                ? "access-purchased"
                : row.attempts >= 8
                  ? "attempts-exhausted"
                  : row.first_dispatch_at &&
                      Date.now() - row.first_dispatch_at.getTime() >=
                        23 * 3600_000 - 15_000
                    ? "retry-window-ended"
                    : null;
    if (reason) {
      await db.query(
        "UPDATE amp_parent_followup_outbox SET stopped_at=now(),stopped_reason=$2,lease_until=NULL WHERE id=$1",
        [row.id, reason],
      );
      await db.query("COMMIT");
      return true;
    }
    const mail =
      row.payload ??
      followupMail(config, {
        email: row.email,
        program: row.program,
        token: row.unsubscribe_token,
        stage: row.stage,
      });
    const lease = randomUUID();
    await db.query(
      `UPDATE amp_parent_followup_outbox SET lease_id=$3,payload=$2,attempts=attempts+1,lease_until=now()+interval '2 minutes',first_dispatch_at=COALESCE(first_dispatch_at,clock_timestamp()) WHERE id=$1`,
      [row.id, mail, lease],
    );
    job = { id: row.id, mail, lease };
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
  // Recheck preferences immediately before dispatch. An in-flight request cannot be recalled.
  const allowed = await pool.query(
    `SELECT 1 FROM amp_parent_followup_outbox o JOIN amp_parent_followups p ON p.user_id=o.user_id
    JOIN amp_auth_users u ON u.id=p.user_id WHERE o.id=$1 AND p.unsubscribed_at IS NULL AND u."emailVerified" AND u.email=p.email
    AND o.lease_id=$2 AND o.lease_until>now()+interval '15 seconds'
    AND o.first_dispatch_at>now()-interval '23 hours'+interval '15 seconds'
    AND o.accepted_at IS NULL AND o.stopped_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM amp_acquisition_contacts c WHERE c.user_id=o.user_id)
    AND NOT EXISTS(SELECT 1 FROM amp_commerce_orders c WHERE c.account_id='amp|'||p.user_id AND c.grant_state IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM amp_payment_records r WHERE r.account_id='amp|'||p.user_id AND r.status='verified')
    AND NOT EXISTS(SELECT 1 FROM amp_access_gifts g WHERE g.account_id='amp|'||p.user_id AND g.activated_at IS NOT NULL)`,
    [job.id, job.lease],
  );
  if (!allowed.rowCount) {
    await pool.query(
      "UPDATE amp_parent_followup_outbox SET stopped_at=now(),stopped_reason='preferences-changed',lease_until=NULL WHERE id=$1 AND lease_id=$2 AND accepted_at IS NULL",
      [job.id, job.lease],
    );
    return true;
  }
  let result: Awaited<ReturnType<Transport>> = null;
  try {
    result = await send(job.mail, `amp-parent-followup-${job.id}`);
  } catch {
    /* Same key and payload on retry. */
  }
  await pool.query(
    `UPDATE amp_parent_followup_outbox SET accepted_at=CASE WHEN $2::text IS NOT NULL THEN now() ELSE NULL END,
    receipt=$2,stopped_at=CASE WHEN $3::text IS NOT NULL THEN now() ELSE NULL END,stopped_reason=$3,
    available_at=now()+interval '5 minutes',lease_until=NULL WHERE id=$1 AND lease_id=$4 AND accepted_at IS NULL AND stopped_at IS NULL`,
    [
      job.id,
      result && "accepted" in result ? result.accepted : null,
      result && "stopped" in result ? result.stopped : null,
      job.lease,
    ],
  );
  return true;
}
export function resendTransport(config: MailConfig): Transport {
  return async (mail, id) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": id,
      },
      body: JSON.stringify(mail),
    });
    if (response.ok) {
      const result = (await response.json()) as { id?: string };
      return typeof result.id === "string" ? { accepted: result.id } : null;
    }
    return [400, 401, 403, 409, 422].includes(response.status)
      ? { stopped: `provider-${response.status}` }
      : null;
  };
}
