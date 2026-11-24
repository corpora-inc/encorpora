import type { PoolClient } from "pg";
import { activeToday } from "../principal.js";
import type { ClassEventKind } from "./contracts.js";

type Database = Pick<PoolClient, "query">;

/* The live outbox (`amp_class_events`, migration 0149). A row says only "this
   person in this class changed"; readers recompute the row from the evidence
   (`rows.ts`). Writes ride on the statement or transaction that already runs
   (an answer, a heartbeat, a sign-in) and write nothing unless a session is
   open, so a class nobody is watching pays one index probe per answer. */

/** SQL: when session `s` stops counting: its planned end, or four hours. */
export const SESSION_ENDS_AT = (s: string) =>
  `LEAST(COALESCE(${s}.planned_end_at,'infinity'::timestamptz),${s}.started_at+interval '4 hours')`;

/** SQL joins from a person `p` to the open, unexpired session `s` of each
 * class they are a student of today (enrollment `ev_e`, class `ev_c`, org
 * `ev_o`). A learner in two classes with sessions running joins twice. */
const OPEN_SESSIONS_OF = (p: string) => `
  JOIN amp_enrollments ev_e ON ev_e.person_id=${p}.id AND ev_e.role='student'
  JOIN amp_class_sessions s ON s.class_id=ev_e.class_id AND s.ended_at IS NULL AND now()<${SESSION_ENDS_AT("s")}
  JOIN amp_classes ev_c ON ev_c.id=s.class_id AND ev_c.archived_at IS NULL
  JOIN amp_orgs ev_o ON ev_o.id=ev_c.org_id AND ${activeToday("ev_e", "ev_o")}`;

/** A learner's answer or help reached their classes' running sessions. The
 * one write `saveAttempt` makes for the live view, inside its transaction, so
 * the event commits with the answer. Keyed by learner: a family child who
 * answers on a parent's account has no student session but has a roster row. */
export async function noteLearnerEvent(
  db: Database,
  learnerId: string,
  kind: Extract<ClassEventKind, "answer" | "help" | "presence">,
): Promise<void> {
  await db.query(
    `INSERT INTO amp_class_events(class_id,session_id,person_id,kind)
     SELECT s.class_id,s.id,p.id,$2 FROM amp_people p ${OPEN_SESSIONS_OF("p")}
     WHERE p.learner_id=$1 AND p.deleted_at IS NULL`,
    [learnerId, kind],
  );
}

/** A student signed in: presence for their classes' running sessions. */
export async function notePersonEvent(
  db: Database,
  personId: string,
  kind: Extract<ClassEventKind, "presence">,
): Promise<void> {
  await db.query(
    `INSERT INTO amp_class_events(class_id,session_id,person_id,kind)
     SELECT s.class_id,s.id,p.id,$2 FROM amp_people p ${OPEN_SESSIONS_OF("p")}
     WHERE p.id=$1 AND p.deleted_at IS NULL`,
    [personId, kind],
  );
}

/** A CTE for a heartbeat statement whose `live` CTE names the learner
 * (`learner_id`): `help` when the heartbeat carries help events (`$<param>`,
 * the `helpEventsCte` rows), and `presence` on their first heartbeat in a
 * session, so a student who signed in before Start shows up without
 * answering. Every heartbeat that reaches a statement is the learner's own:
 * a student's sign-in, or an account's for its own learner
 * (`recordLearnerActivity` writes nothing for a child on an adult's). */
export const liveHeartbeatCte = (param: number) => `live_noted AS (
  INSERT INTO amp_class_events(class_id,session_id,person_id,kind)
  SELECT s.class_id,s.id,p.id,k.kind FROM live
  JOIN amp_people p ON p.learner_id=live.learner_id AND p.deleted_at IS NULL
  ${OPEN_SESSIONS_OF("p")}
  CROSS JOIN (VALUES ('help'),('presence')) AS k(kind)
  WHERE (k.kind='help' AND jsonb_array_length($${param}::jsonb)>0)
     OR (k.kind='presence' AND NOT EXISTS (SELECT 1 FROM amp_class_events v
       WHERE v.session_id=s.id AND v.person_id=p.id AND v.kind='presence'))
)`;

/** An event about a class: a session started or stopped (`session`), or a
 * signal raised or resolved (`signal`, work package L4), which is written
 * with or without a session. */
export async function noteClassEvent(
  db: Database,
  event: {
    classId: string;
    sessionId: string | null;
    personId: string | null;
    kind: Extract<ClassEventKind, "session" | "signal">;
  },
): Promise<void> {
  await db.query(
    "INSERT INTO amp_class_events(class_id,session_id,person_id,kind) VALUES($1,$2,$3,$4)",
    [event.classId, event.sessionId, event.personId, event.kind],
  );
}

export type ClassEvent = {
  /** A bigint, as a string. */
  id: string;
  classId: string;
  sessionId: string | null;
  personId: string | null;
  kind: ClassEventKind;
  at: string;
};
/** The outbox's re-read window. A transaction can commit a little after the
 * `now()` it stamped, so a tail re-reads this much and dedupes by id. */
export const CLASS_EVENT_WINDOW_MS = 5_000;

/** For the stream hub (L2): the events of these classes in the last
 * `windowMs`, oldest first. One indexed statement for every subscribed class;
 * the caller dedupes by id (`classChanges`). */
export async function readClassEvents(
  db: Database,
  classIds: readonly string[],
  windowMs = CLASS_EVENT_WINDOW_MS,
): Promise<ClassEvent[]> {
  if (!classIds.length) return [];
  const { rows } = await db.query(
    `SELECT id::text AS id,class_id AS "classId",session_id AS "sessionId",person_id AS "personId",kind,
       to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at
     FROM amp_class_events
     WHERE class_id=ANY($1::uuid[]) AND created_at>now()-make_interval(secs=>$2/1000.0)
     ORDER BY id`,
    [classIds, windowMs],
  );
  return rows;
}

export type ClassChange = {
  classId: string;
  /** People whose live row should be re-read (`readLiveRows` with `personIds`). */
  personIds: string[];
  /** A session started or stopped: re-read the snapshot. */
  session: boolean;
  /** A signal changed: re-read the open signals. */
  signals: boolean;
};
/** Pure: which classes and people changed among `events` not in `seen`.
 * Adds the new ids to `seen`; the caller forgets ids older than the window. */
export function classChanges(
  events: readonly ClassEvent[],
  seen: Set<string>,
): ClassChange[] {
  const byClass = new Map<
    string,
    { people: Set<string>; session: boolean; signals: boolean }
  >();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const change = byClass.get(event.classId) ?? {
      people: new Set<string>(),
      session: false,
      signals: false,
    };
    byClass.set(event.classId, change);
    if (event.kind === "session") change.session = true;
    else if (event.kind === "signal") change.signals = true;
    // A signal too: a raised hand is the student showing up (`rows.ts`).
    if (event.personId) change.people.add(event.personId);
  }
  return [...byClass].map(([classId, change]) => ({
    classId,
    personIds: [...change.people].sort(),
    session: change.session,
    signals: change.signals,
  }));
}
