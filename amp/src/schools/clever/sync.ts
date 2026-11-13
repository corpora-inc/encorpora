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

/** Serializes each connection from fetch through commit. The cursor, source
 * snapshot and AMP roster commit together; failed runs cannot sweep removals. */
export async function syncCleverConnection(
  pool: Pool,
  connectionId: string,
  client: Client,
  options: { mode?: SyncMode; now?: Date; db?: PoolClient } = {},
): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? (await pool.connect());
  const runId = randomUUID();
  const lock = `clever-sync:${connectionId}`;
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
    const token = await client.districtToken(connection.district_id);
    let snapshot: Snapshot;
    let cursor = connection.event_cursor;
    if (mode === "events") {
      try {
        const events = await client.events(token, cursor!);
        snapshot = applyEvents(await storedSnapshot(db, connectionId), events);
        snapshot = validateSnapshot(snapshot, connection.district_id);
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
    snapshot = validateSnapshot(snapshot, connection.district_id);
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SET LOCAL statement_timeout='120s'");
    const active = (
      await db.query(
        "SELECT status FROM amp_clever_connections WHERE id=$1 FOR UPDATE",
        [connectionId],
      )
    ).rows[0];
    if (active?.status !== "active")
      throw new CleverSyncError("clever_connection_inactive");
    const counts = await applySnapshot(db, connection, runId, snapshot, now);
    const launchDate = snapshot.district.launch_date?.slice(0, 10) || null;
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
        launchDate,
        snapshot.district.last_clever_sync ?? null,
      ],
    );
    await db.query(
      `UPDATE amp_clever_sync_runs SET status='succeeded',finished_at=$2,counts=$3,mode=$4 WHERE id=$1`,
      [runId, new Date(), JSON.stringify(counts), mode],
    );
    await db.query("COMMIT");
    return { runId, mode, counts, cursor };
  } catch (error) {
    await db.query("ROLLBACK");
    const code = safeSyncError(error);
    if (running) {
      if (
        ["district_not_authorized", "clever_district_revoked"].includes(code)
      ) {
        await db.query("BEGIN");
        const row = (
          await db.query(
            `SELECT c.tenant_id,to_char($2::timestamptz AT TIME ZONE o.timezone,'YYYY-MM-DD') AS day
          FROM amp_clever_connections c JOIN amp_orgs o ON o.id=c.tenant_id WHERE c.id=$1 FOR UPDATE OF c`,
            [connectionId, now],
          )
        ).rows[0];
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
