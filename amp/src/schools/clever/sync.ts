import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { CleverClient, CleverHttpError, type CleverEvent } from "./client.js";
import {
  CleverSyncError,
  collections,
  schemas,
  validateSnapshot,
  type Kind,
  type Snapshot,
} from "./model.js";
import { requireAgreement } from "./connection.js";
import {
  applySnapshot,
  stageSnapshot,
  endMissingMemberships,
  storedSnapshot,
  type Connection,
} from "./store.js";

export type SyncMode = "auto" | "full" | "events";
export type SyncResult = {
  runId: string;
  mode: "full" | "events";
  counts: {
    schools: number;
    users: number;
    sections: number;
    courses: number;
    terms: number;
  };
  cursor: string | null;
};
type Client = Pick<
  CleverClient,
  "districtToken" | "snapshot" | "latestEvent" | "events"
>;

/** Events contain complete objects. Apply feed order, not lexical ID or event
 * timestamp order. The final dependency graph is validated before any write. */
export function applyEvents(
  snapshot: Snapshot,
  events: CleverEvent[],
): Snapshot {
  const maps = {
    district: new Map([[snapshot.district.id, snapshot.district]]),
    school: new Map(snapshot.schools.map((x) => [x.id, x])),
    user: new Map(snapshot.users.map((x) => [x.id, x])),
    section: new Map(snapshot.sections.map((x) => [x.id, x])),
    course: new Map(snapshot.courses.map((x) => [x.id, x])),
    term: new Map(snapshot.terms.map((x) => [x.id, x])),
  };
  for (const event of events) {
    const [collection, operation] = event.type.split(".");
    const kind = (Object.keys(collections) as Kind[]).find(
      (k) => collections[k] === collection,
    );
    if (!kind) continue; // Other product capabilities do not mutate core rosters.
    if (!["created", "updated", "deleted"].includes(operation))
      throw new CleverSyncError("clever_unknown_event_operation");
    const object = schemas[kind].parse(event.data.object);
    if (
      (kind === "district"
        ? object.id
        : (object as { district: string }).district) !== snapshot.district.id
    )
      throw new CleverSyncError("district_mismatch");
    const target = maps[kind] as Map<string, unknown>;
    if (operation === "deleted") target.delete(object.id);
    else target.set(object.id, object);
  }
  const district = maps.district.get(snapshot.district.id);
  if (!district) throw new CleverSyncError("clever_district_revoked");
  return {
    district,
    schools: [...maps.school.values()],
    users: [...maps.user.values()],
    sections: [...maps.section.values()],
    courses: [...maps.course.values()],
    terms: [...maps.term.values()],
  };
}

export function safeSyncError(error: unknown): string {
  if (error instanceof CleverSyncError) return error.code;
  if (error instanceof z.ZodError) return "clever_invalid_response";
  return "clever_sync_failed";
}

/** Claims each run separately from the short database-apply lock. The cursor, source
 * snapshot and AMP roster commit together; failed runs cannot sweep removals. */
export async function syncCleverConnection(
  pool: Pool,
  connectionId: string,
  client: Client,
  options: {
    mode?: SyncMode;
    now?: Date;
    db?: PoolClient;
    stageOnly?: boolean;
  } = {},
): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? (await pool.connect());
  const runId = randomUUID();
  const lock = `clever-run:${connectionId}`;
  let locked = false,
    running = false;
  try {
    locked = (
      await db.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",
        [lock],
      )
    ).rows[0].locked;
    if (!locked) throw new CleverSyncError("clever_sync_already_running");
    const connection = (
      await db.query("SELECT * FROM amp_clever_connections WHERE id=$1", [
        connectionId,
      ])
    ).rows[0] as Connection | undefined;
    if (!connection || connection.status !== "active")
      throw new CleverSyncError("clever_connection_inactive");

    let mode: "full" | "events" =
      options.stageOnly ||
      options.mode === "full" ||
      !connection.events_enabled ||
      !connection.event_cursor ||
      !connection.last_sync_at ||
      now.getTime() - connection.last_sync_at.getTime() > 27 * 86_400_000 ||
      (options.mode !== "events" &&
        (!connection.last_full_sync_at ||
          now.getTime() - connection.last_full_sync_at.getTime() >= 86_400_000))
        ? "full"
        : "events";
    // A crashed process releases its session lock. Its run must not look active.
    await db.query(
      `UPDATE amp_clever_sync_runs SET status='failed',finished_at=$2,error_code='clever_worker_interrupted'
      WHERE connection_id=$1 AND status='running'`,
      [connectionId, now],
    );
    await requireAgreement(db, connection.tenant_id);
    await db.query(
      "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status,started_at) VALUES($1,$2,$3,'running',$4)",
      [runId, connectionId, mode, now],
    );
    running = true;
    let token: string;
    try {
      token = await client.districtToken(connection.district_id);
    } catch (error) {
      if (
        !(error instanceof CleverSyncError) ||
        error.code !== "district_not_authorized"
      )
        throw error;
      // A successful empty response must be confirmed before ending memberships.
      token = await client.districtToken(connection.district_id);
    }
    let snapshot: Snapshot | undefined;
    let cursor = connection.event_cursor;
    if (mode === "events") {
      try {
        const events = await client.events(token, cursor!);
        // Most polls have no changes. Do not read/rewrite a whole district for
        // an empty feed; the daily full snapshot still repairs local drift.
        if (events.length) {
          snapshot = applyEvents(
            await storedSnapshot(db, connectionId),
            events,
          );
          snapshot = validateSnapshot(snapshot, connection.district_id);
        }
        cursor = events.at(-1)?.id ?? cursor;
      } catch (error) {
        // A retained cursor can expire, and a delta may require dependencies
        // absent from a partial sharing change. A complete read repairs both.
        if (
          !(
            error instanceof CleverHttpError &&
            [400, 404].includes(error.status)
          ) &&
          !(
            error instanceof CleverSyncError &&
            [
              "missing_section_school",
              "missing_section_student",
              "missing_section_teacher",
              "clever_full_sync_required",
            ].includes(error.code)
          )
        )
          throw error;
        mode = "full";
        cursor = connection.events_enabled
          ? await client.latestEvent(token)
          : null;
        snapshot = await client.snapshot(connection.district_id, token);
      }
    } else {
      // Capture the watermark BEFORE scanning the snapshot. Concurrent changes
      // will be replayed idempotently on the next Events run.
      cursor = connection.events_enabled
        ? await client.latestEvent(token)
        : null;
      snapshot = await client.snapshot(connection.district_id, token);
    }
    if (snapshot) snapshot = validateSnapshot(snapshot, connection.district_id);
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SET LOCAL statement_timeout='120s'");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever-sync:${connectionId}`,
    ]);
    const active = (
      await db.query(
        "SELECT status,sync_paused FROM amp_clever_connections WHERE id=$1 FOR UPDATE",
        [connectionId],
      )
    ).rows[0];
    if (active?.status !== "active")
      throw new CleverSyncError("clever_connection_inactive");
    if (options.stageOnly && !active.sync_paused)
      throw new CleverSyncError("clever_preview_changed");
    const counts: SyncResult["counts"] = snapshot
      ? options.stageOnly
        ? await stageSnapshot(db, connection, runId, snapshot)
        : await applySnapshot(db, connection, runId, snapshot, now)
      : { schools: 0, users: 0, sections: 0, courses: 0, terms: 0 };
    if (!snapshot) {
      const rows = await db.query(
        "SELECT kind,count(*)::int AS count FROM amp_clever_bindings WHERE connection_id=$1 AND archived_at IS NULL GROUP BY kind",
        [connectionId],
      );
      for (const row of rows.rows) {
        const collection = collections[row.kind as Kind];
        if (collection in counts)
          counts[collection as keyof typeof counts] = row.count;
      }
      await db.query(
        "UPDATE amp_clever_connections SET last_sync_at=$2 WHERE id=$1",
        [connectionId, now],
      );
    } else if (!options.stageOnly)
      await db.query(
        `UPDATE amp_clever_connections SET event_cursor=$2,last_sync_at=$3,
      last_full_sync_at=CASE WHEN $4='full' THEN $3 ELSE last_full_sync_at END,
      connection_type=$5,launch_date=$6,last_clever_sync=$7 WHERE id=$1`,
        [
          connectionId,
          cursor,
          now,
          mode,
          snapshot.district.connection_type ?? null,
          snapshot.district.launch_date?.slice(0, 10) || null,
          snapshot.district.last_clever_sync ?? null,
        ],
      );
    await db.query(
      `UPDATE amp_clever_sync_runs SET status='succeeded',finished_at=$2,counts=$3,mode=$4 WHERE id=$1`,
      [runId, new Date(), JSON.stringify(counts), mode],
    );
    await db.query(
      "UPDATE amp_clever_connections SET failure_code=NULL,failure_count=0,next_attempt_at=NULL WHERE id=$1",
      [connectionId],
    );
    await db.query(
      `DELETE FROM amp_clever_sync_runs r WHERE connection_id=$1 AND finished_at<now()-interval '30 days'
      AND NOT EXISTS(SELECT 1 FROM amp_clever_bindings b WHERE b.last_seen_run_id=r.id)
      AND NOT EXISTS(SELECT 1 FROM amp_clever_memberships m WHERE m.last_seen_run_id=r.id)`,
      [connectionId],
    );
    await db.query("COMMIT");
    return { runId, mode, counts, cursor };
  } catch (error) {
    await db.query("ROLLBACK");
    const code = safeSyncError(error);
    if (running) {
      await db.query(
        `UPDATE amp_clever_connections SET failure_count=CASE WHEN failure_code=$2 THEN least(failure_count+1,10) ELSE 1 END,
        next_attempt_at=now()+interval '1 minute'*power(2,CASE WHEN failure_code=$2 THEN least(failure_count,9) ELSE 0 END),failure_code=$2 WHERE id=$1`,
        [connectionId, code],
      );
      if (
        ["district_not_authorized", "clever_district_revoked"].includes(code)
      ) {
        await db.query("BEGIN");
        await db.query("SET LOCAL lock_timeout='5s'");
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          `clever-sync:${connectionId}`,
        ]);
        const row = (
          await db.query(
            `SELECT c.tenant_id,to_char($2::timestamptz AT TIME ZONE o.timezone,'YYYY-MM-DD') AS day
          FROM amp_clever_connections c JOIN amp_orgs o ON o.id=c.tenant_id WHERE c.id=$1 FOR UPDATE OF c`,
            [connectionId, now],
          )
        ).rows[0];
        if (row) {
          await endMissingMemberships(db, connectionId, runId, row.day);
          await db.query(
            `UPDATE amp_clever_connections SET status='disconnected',disconnected_at=$2 WHERE id=$1`,
            [connectionId, now],
          );
          await db.query(
            `UPDATE amp_clever_bindings SET archived_at=COALESCE(archived_at,$2) WHERE connection_id=$1`,
            [connectionId, now],
          );
          await db.query(
            `UPDATE amp_classes c SET archived_at=COALESCE(c.archived_at,$2) FROM amp_clever_bindings b
          WHERE b.connection_id=$1 AND b.kind='section' AND c.id=b.local_id`,
            [connectionId, now],
          );
        }
        await db.query("COMMIT");
      }
      await db.query(
        "UPDATE amp_clever_sync_runs SET status='failed',finished_at=$2,error_code=$3 WHERE id=$1",
        [runId, new Date(), code],
      );
    }
    throw new CleverSyncError(code);
  } finally {
    if (locked)
      await db.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
        lock,
      ]);
    if (!options.db) db.release();
  }
}
