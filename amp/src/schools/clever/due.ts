import type { Pool } from "pg";
import { ALERTS_DUE_SQL } from "../request-alert-due.js";

/**
 * When a Clever connection is due a sync pass: active, not paused (or a
 * paused connection's staging was asked for), past any retry backoff, and
 * asked for, never synced, or past its interval (five minutes with Events,
 * otherwise a day). `runDueCleverSync` claims with this predicate and the
 * scheduled job's idle check reads it, so the two cannot disagree.
 */
export const connectionDue = (c: string) =>
  `${c}.status='active' AND (NOT ${c}.sync_paused OR ${c}.sync_requested_at IS NOT NULL)
   AND (${c}.next_attempt_at IS NULL OR ${c}.next_attempt_at<=now())
   AND (${c}.sync_requested_at IS NOT NULL OR ${c}.last_sync_at IS NULL
     OR ${c}.last_sync_at<now()-CASE WHEN ${c}.events_enabled AND ${c}.events_unavailable_at IS NULL
       THEN interval '5 minutes' ELSE interval '1 day' END)`;

/**
 * The scheduled pass's idle check, in one query: does any connection in this
 * environment need a sync pass, or (with LMS Connect configured) an LMS pass,
 * and does the operator have a school request alert to record or send?
 * The LMS pass visits every active connection each minute
 * (`lmsCandidates`), so any active connection is LMS work. This module
 * and the SQL it reads import nothing but types, so the job answers "nothing
 * due" without loading the sync or mail code at all.
 */
export async function cleverWorkDue(
  db: Pick<Pool, "query">,
  environment: "sandbox" | "production",
  lms: boolean,
): Promise<{ sync: boolean; lms: boolean; alerts: boolean }> {
  const row = (
    await db.query(
      `SELECT EXISTS (SELECT 1 FROM amp_clever_connections c
           WHERE c.environment=$1 AND ${connectionDue("c")}) AS sync,
         $2::boolean AND EXISTS (SELECT 1 FROM amp_clever_connections c
           WHERE c.environment=$1 AND c.status='active') AS lms,
         ${ALERTS_DUE_SQL} AS alerts`,
      [environment, lms],
    )
  ).rows[0];
  return { sync: row.sync, lms: row.lms, alerts: row.alerts };
}
