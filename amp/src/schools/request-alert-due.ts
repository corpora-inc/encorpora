import type { Pool } from "pg";

/**
 * When the operator's alerts about school connection requests are due
 * (request-alerts.ts). Kept apart, with type imports only, so the Clever
 * job's idle check reads it without loading the mail code.
 */

/** The invitation target, from the request: within 24 hours. */
export const INVITE_TARGET_HOURS = 24;
/** The invitation limit, from the request: 72 hours at most. */
export const INVITE_LIMIT_HOURS = 72;

/** Requests whose age-derived alert is not recorded yet. Shared with the
 * worker's due check, so the two can never disagree. */
export const ALERTS_TO_DERIVE_SQL = `SELECT r.id,CASE
    WHEN r.created_at>now()-interval '${INVITE_TARGET_HOURS} hours' THEN 'requested'
    WHEN r.created_at>now()-interval '${INVITE_LIMIT_HOURS} hours' THEN 'reminder'
    ELSE 'overdue' END AS kind
  FROM amp_school_connection_requests r WHERE r.status='requested'`;

/** Alerts ready to send now. */
export const ALERTS_READY_SQL = `SELECT a.id FROM amp_school_request_alerts a
  WHERE a.sent_at IS NULL AND a.stopped_at IS NULL AND a.available_at<=now()
    AND (a.lease_until IS NULL OR a.lease_until<=now())`;

/** A boolean SQL expression: a pass has an alert to record or send. */
export const ALERTS_DUE_SQL = `(EXISTS (SELECT 1 FROM (${ALERTS_TO_DERIVE_SQL}) d WHERE NOT EXISTS (
    SELECT 1 FROM amp_school_request_alerts a WHERE a.request_id=d.id AND a.kind=d.kind))
  OR EXISTS (${ALERTS_READY_SQL}))`;

/** True when a pass has an alert to record or send. One cheap query. */
export async function requestAlertsDue(db: Pick<Pool, "query">) {
  return (await db.query(`SELECT ${ALERTS_DUE_SQL} AS due`)).rows[0]
    .due as boolean;
}
