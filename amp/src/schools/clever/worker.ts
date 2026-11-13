import type { Pool } from "pg";
import type { CleverClient } from "./client.js";
import { syncCleverConnection } from "./sync.js";
import { SchoolRepository } from "../repository.js";

type Client = Pick<
  CleverClient,
  "districtToken" | "snapshot" | "latestEvent" | "events"
>;
/** A deployment-wide claim, followed by a fresh due check. The session lock
 * disappears on process death; the sync runner repairs its interrupted run. */
export async function runDueCleverSync(pool: Pool, id: string, client: Client) {
  const db = await pool.connect(),
    key = `clever-worker:${id}`;
  let locked = false,
    tenantId: string | null = null;
  try {
    locked = (
      await db.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS ok",
        [key],
      )
    ).rows[0].ok;
    if (!locked) return;
    const due = (
      await db.query(
        `SELECT tenant_id,sync_paused,clock_timestamp()::text AS started_at FROM amp_clever_connections
      WHERE id=$1 AND status='active' AND (NOT sync_paused OR sync_requested_at IS NOT NULL) AND (next_attempt_at IS NULL OR next_attempt_at<=now()) AND (sync_requested_at IS NOT NULL OR last_sync_at IS NULL
       OR last_sync_at<now()-CASE WHEN events_enabled THEN interval '5 minutes' ELSE interval '1 day' END)`,
        [id],
      )
    ).rows[0];
    if (!due) return;
    const result = await syncCleverConnection(pool, id, client, {
      db,
      stageOnly: due.sync_paused,
    });
    await db.query(
      "UPDATE amp_clever_connections SET sync_requested_at=NULL WHERE id=$1 AND sync_requested_at<=$2",
      [id, due.started_at],
    );
    tenantId = due.tenant_id;
    await new SchoolRepository(pool).reconcileSeats(tenantId!);
    return result;
  } finally {
    if (locked)
      await db.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
        key,
      ]);
    db.release();
  }
}
