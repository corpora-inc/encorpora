import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { SchoolError } from "../contracts.js";
import { classLiveSql } from "../pilot-access.js";
import { studentInClassSql } from "../principal.js";
import {
  SIGNAL_OPEN_MS,
  type ForgotPictureResponse,
  type SignalKind,
  type StudentSignal,
} from "./contracts.js";
import { noteClassEvent, SESSION_ENDS_AT } from "./events.js";

type Database = Pick<PoolClient, "query">;
type SignalRow = {
  id: string;
  class_id: string;
  person_id: string;
  kind: SignalKind;
  created_at: Date;
  resolved_at: Date | null;
  resolution: StudentSignal["resolution"];
};
const resource = (row: SignalRow): StudentSignal => ({
  id: row.id,
  classId: row.class_id,
  personId: row.person_id,
  kind: row.kind,
  createdAt: row.created_at.toISOString(),
  resolvedAt: row.resolved_at?.toISOString() ?? null,
  resolution: row.resolution,
});

/** All mutations below use the caller's transaction, including the outbox. */
async function note(db: Database, row: SignalRow) {
  const session = await db.query<{ id: string }>(
    `SELECT s.id FROM amp_class_sessions s WHERE s.class_id=$1
     AND s.ended_at IS NULL AND now()<${SESSION_ENDS_AT("s")}`,
    [row.class_id],
  );
  await noteClassEvent(db, {
    classId: row.class_id,
    sessionId: session.rows[0]?.id ?? null,
    personId: row.person_id,
    kind: "signal",
  });
}

/** Serializes a person's raises with their withdrawal, sign-in and reset. */
async function lockPerson(db: Database, personId: string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `school-signals:${personId}`,
  ]);
}

/** Bounded retention, or expiry before a raise. Releases the open unique key. */
export async function expireSignals(
  db: Database,
  at: Date,
  limit: number,
  personId: string | null = null,
): Promise<number> {
  const expired = await db.query<SignalRow>(
    `UPDATE amp_class_signals SET resolved_at=$1,resolution='expired'
     WHERE id IN (SELECT id FROM amp_class_signals WHERE resolved_at IS NULL
       AND created_at<=$1::timestamptz-make_interval(secs=>$2/1000.0)
       AND ($3::uuid IS NULL OR person_id=$3) ORDER BY id LIMIT $4)
       AND resolved_at IS NULL RETURNING *`,
    [at.toISOString(), SIGNAL_OPEN_MS, personId, limit],
  );
  for (const row of expired.rows) await note(db, row);
  return expired.rowCount ?? 0;
}

async function prepareRaise(db: Database, personId: string) {
  await lockPerson(db, personId);
  while ((await expireSignals(db, new Date(), 1000, personId)) === 1000) {
    /* bounded batches */
  }
}

async function raise(
  db: Database,
  classId: string,
  personId: string,
  kind: SignalKind,
) {
  await db.query(
    `INSERT INTO amp_class_signals(id,class_id,person_id,kind) VALUES($1,$2,$3,$4)
     ON CONFLICT (class_id,person_id,kind) WHERE resolved_at IS NULL DO NOTHING`,
    [randomUUID(), classId, personId, kind],
  );
  // A separate statement also sees the winner of a concurrent insert.
  const { rows } = await db.query<SignalRow>(
    `SELECT * FROM amp_class_signals WHERE class_id=$1 AND person_id=$2 AND kind=$3 AND resolved_at IS NULL`,
    [classId, personId, kind],
  );
  await note(db, rows[0]!);
  return resource(rows[0]!);
}

export async function raiseHand(
  db: Database,
  personId: string,
): Promise<StudentSignal[]> {
  await prepareRaise(db, personId);
  const { rows } = await db.query<{ id: string; running: boolean }>(
    `SELECT DISTINCT c.id,EXISTS(SELECT 1 FROM amp_class_sessions s WHERE s.class_id=c.id
       AND s.ended_at IS NULL AND now()<${SESSION_ENDS_AT("s")}) AS running
     FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
     JOIN amp_orgs o ON o.id=c.org_id JOIN amp_people p ON p.id=e.person_id
     WHERE p.id=$1 AND ${studentInClassSql("e", "p", "c", "o")} AND ${classLiveSql("c", "o")}
     ORDER BY c.id`,
    [personId],
  );
  const targets = rows.some((row) => row.running)
    ? rows.filter((row) => row.running)
    : rows;
  const signals: StudentSignal[] = [];
  for (const target of targets)
    signals.push(await raise(db, target.id, personId, "hand"));
  return signals;
}

export async function raiseForgotPicture(
  db: Database,
  classId: string,
  personId: string,
): Promise<void> {
  await prepareRaise(db, personId);
  await raise(db, classId, personId, "forgot_picture");
}

export async function readStudentSignals(
  db: Database,
  personId: string,
): Promise<StudentSignal[]> {
  const { rows } = await db.query<SignalRow>(
    `SELECT * FROM amp_class_signals WHERE person_id=$1 AND
       ((resolved_at IS NULL AND created_at>now()-make_interval(secs=>$2/1000.0))
        OR resolved_at>now()-interval '60 seconds') ORDER BY created_at,id`,
    [personId, SIGNAL_OPEN_MS],
  );
  return rows.map(resource);
}

/** Pictures belong to the person, so reset/sign-in resolves requests in every
 * class. Reset must call this in the credential-reset transaction. */
export async function resolvePersonSignals(
  db: Database,
  personId: string,
  kind: SignalKind,
  resolution: "reset" | "withdrawn",
  resolvedBy: string | null,
): Promise<StudentSignal[]> {
  await lockPerson(db, personId);
  const { rows } = await db.query<SignalRow>(
    `UPDATE amp_class_signals SET resolved_at=now(),resolved_by=$3,
       resolution=CASE WHEN created_at<=now()-make_interval(secs=>$5/1000.0) THEN 'expired' ELSE $4 END
     WHERE person_id=$1 AND kind=$2 AND resolved_at IS NULL RETURNING *`,
    [personId, kind, resolvedBy, resolution, SIGNAL_OPEN_MS],
  );
  for (const row of rows) await note(db, row);
  return rows.map(resource).sort((a, b) => a.classId.localeCompare(b.classId));
}

export async function acknowledgeHand(
  db: Database,
  classId: string,
  signalId: string,
  resolvedBy: string | null,
): Promise<StudentSignal> {
  const owner = await db.query<{ person_id: string }>(
    "SELECT person_id FROM amp_class_signals WHERE id=$1 AND class_id=$2",
    [signalId, classId],
  );
  if (!owner.rows[0]) throw new SchoolError(404, "not_found");
  await lockPerson(db, owner.rows[0].person_id);
  const found = await db.query<SignalRow>(
    "SELECT * FROM amp_class_signals WHERE id=$1 AND class_id=$2 FOR UPDATE",
    [signalId, classId],
  );
  const row = found.rows[0];
  if (!row) throw new SchoolError(404, "not_found");
  if (row.kind !== "hand") throw new SchoolError(409, "picture_reset_required");
  if (row.resolved_at) return resource(row);
  const updated = await db.query<SignalRow>(
    `UPDATE amp_class_signals SET resolved_at=now(),resolved_by=$2,
       resolution=CASE WHEN created_at<=now()-make_interval(secs=>$3/1000.0) THEN 'expired' ELSE 'acknowledged' END
     WHERE id=$1 RETURNING *`,
    [signalId, resolvedBy, SIGNAL_OPEN_MS],
  );
  await note(db, updated.rows[0]!);
  return resource(updated.rows[0]!);
}

/** Only the latest request can unblock this waiting screen. A completed reset
 * stays visible for its request's 30-minute lifetime; a new request supersedes it. */
export async function forgotPictureState(
  db: Database,
  classId: string,
  personId: string,
): Promise<ForgotPictureResponse> {
  const { rows } = await db.query<SignalRow>(
    `SELECT * FROM amp_class_signals WHERE class_id=$1 AND person_id=$2 AND kind='forgot_picture'
     ORDER BY created_at DESC,id DESC LIMIT 1`,
    [classId, personId],
  );
  const row = rows[0];
  if (!row || Date.now() - row.created_at.getTime() >= SIGNAL_OPEN_MS)
    return { state: "none" };
  return {
    state: !row.resolved_at
      ? "waiting"
      : row.resolution === "reset"
        ? "reset"
        : "none",
  };
}
