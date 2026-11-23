import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { SchoolError } from "../contracts.js";
import {
  MAX_SESSION_MINUTES,
  type LiveSession,
  type LiveSnapshot,
  type ReportRow,
  type SessionEndReason,
  type SessionList,
  type SessionReport,
} from "./contracts.js";
import { noteClassEvent, SESSION_ENDS_AT } from "./events.js";
import { STUDENT_LABEL } from "../sign-in.js";
import { readLiveRows, readOpenSignals, skillRef, toLiveRow } from "./rows.js";
import {
  LIVE_RULES,
  liveTotals,
  reportStatus,
  reportTotals,
} from "./status.js";

type Database = Pick<PoolClient, "query">;

/* A class's sessions: start (idempotent), stop (one transaction that freezes
   the report), and the lazy close every reader runs, so a session nobody
   stopped ends at its planned end or after four hours without a timer. Each
   function takes and releases its own connection; none is held between
   statements of different functions. */

const SESSION_COLUMNS = `s.id,s.class_id,s.started_at,s.planned_end_at,${SESSION_ENDS_AT("s")} AS ends_at,
  s.ended_at,s.end_reason,s.started_by,s.ended_by,s.rules_version`;
type SessionRow = {
  id: string;
  class_id: string;
  started_at: Date;
  planned_end_at: Date | null;
  ends_at: Date;
  ended_at: Date | null;
  end_reason: SessionEndReason | null;
  started_by: string | null;
  ended_by: string | null;
  rules_version: number;
};
const toSession = (row: SessionRow): LiveSession => ({
  id: row.id,
  classId: row.class_id,
  startedAt: row.started_at.toISOString(),
  plannedEndAt: row.planned_end_at?.toISOString() ?? null,
  endsAt: row.ends_at.toISOString(),
  endedAt: row.ended_at?.toISOString() ?? null,
  endReason: row.end_reason,
  startedBy: row.started_by,
  endedBy: row.ended_by,
  rulesVersion: row.rules_version,
});

async function inTransaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Ends session `id` at `endedAt` and stores each student's row, in the
 * caller's transaction. The conditional update makes it once-only: a second
 * Stop, or a reader closing it at the same moment, finds it ended and writes
 * nothing. Null when it had already ended. */
async function freeze(
  client: Database,
  input: {
    id: string;
    endedAt: "now" | "due";
    endedBy: string | null;
  },
): Promise<SessionRow | null> {
  const ended = (
    await client.query(
      `UPDATE amp_class_sessions s SET
         ended_at=CASE WHEN $2 THEN ${SESSION_ENDS_AT("s")} ELSE GREATEST(now(),s.started_at) END,
         end_reason=CASE WHEN NOT $2 THEN 'stopped'
           WHEN s.planned_end_at IS NOT NULL AND s.planned_end_at<=s.started_at+interval '4 hours' THEN 'planned_end'
           ELSE 'time_limit' END,
         ended_by=CASE WHEN $2 THEN NULL ELSE $3::uuid END
       WHERE s.id=$1 AND s.ended_at IS NULL
       RETURNING ${SESSION_COLUMNS}`,
      [input.id, input.endedAt === "due", input.endedBy],
    )
  ).rows[0] as SessionRow | undefined;
  if (!ended) return null;
  const rows = await readLiveRows(
    client,
    {
      classId: ended.class_id,
      sessionId: ended.id,
      from: ended.started_at,
      to: ended.ended_at!,
    },
    undefined,
    { skills: true },
  );
  const at = {
    now: ended.ended_at!,
    startedAt: ended.started_at.toISOString(),
  };
  if (rows.length)
    await client.query(
      `INSERT INTO amp_class_session_students(session_id,person_id,learner_id,problems,correct,independent,assisted,
         hints,lessons,examples,videos,skills,skill_id,level,first_seen_at,first_answer_at,last_answer_at,status)
       SELECT $1,x.person_id,x.learner_id,x.problems,x.correct,x.independent,x.assisted,x.hints,x.lessons,x.examples,
         x.videos,ARRAY(SELECT jsonb_array_elements_text(x.skills)),x.skill_id,x.level,x.first_seen_at,x.first_answer_at,
         x.last_answer_at,x.status
       FROM jsonb_to_recordset($2::jsonb) AS x(person_id uuid,learner_id text,problems int,correct int,independent int,
         assisted int,hints int,lessons int,examples int,videos int,skills jsonb,skill_id text,level real,
         first_seen_at timestamptz,first_answer_at timestamptz,last_answer_at timestamptz,status text)`,
      [
        ended.id,
        JSON.stringify(
          rows.map((row) => ({
            person_id: row.personId,
            learner_id: row.learnerId,
            problems: row.problems,
            correct: row.correct,
            independent: row.independent,
            assisted: row.assisted,
            hints: row.hints,
            lessons: row.lessons,
            examples: row.examples,
            videos: row.videos,
            skills: row.skills.map((skill) => skill.id),
            skill_id: row.skill?.id ?? null,
            level: row.level,
            first_seen_at: row.firstSeenAt,
            first_answer_at: row.firstAnswerAt,
            last_answer_at: row.lastAnswerAt,
            status: reportStatus(row, at),
          })),
        ),
      ],
    );
  await noteClassEvent(client, {
    classId: ended.class_id,
    sessionId: ended.id,
    personId: null,
    kind: "session",
  });
  return ended;
}

/** Closes the class's open session if it is past its planned end or four
 * hours old. Every reader calls this first. Cheap when there's nothing to do:
 * one probe of the open-session index. */
export async function closeIfDue(pool: Pool, classId: string): Promise<void> {
  const due = (
    await pool.query(
      `SELECT s.id FROM amp_class_sessions s
       WHERE s.class_id=$1 AND s.ended_at IS NULL AND now()>=${SESSION_ENDS_AT("s")}`,
      [classId],
    )
  ).rows[0] as { id: string } | undefined;
  if (due)
    await inTransaction(pool, (client) =>
      freeze(client, { id: due.id, endedAt: "due", endedBy: null }),
    );
}

/** Every session past its end, closed and its report stored, for the daily
 * retention run, before the outbox it reads presence from is pruned. */
export async function closeDueSessions(pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `SELECT s.id FROM amp_class_sessions s
     WHERE s.ended_at IS NULL AND now()>=${SESSION_ENDS_AT("s")} ORDER BY s.started_at LIMIT 1000`,
  );
  let closed = 0;
  for (const { id } of rows)
    if (
      await inTransaction(pool, (client) =>
        freeze(client, { id, endedAt: "due", endedBy: null }),
      )
    )
      closed++;
  return closed;
}

/** The class's running session, after closing one that is due; null for none. */
export async function openSession(
  pool: Pool,
  classId: string,
): Promise<LiveSession | null> {
  await closeIfDue(pool, classId);
  const row = (
    await pool.query(
      `SELECT ${SESSION_COLUMNS} FROM amp_class_sessions s WHERE s.class_id=$1 AND s.ended_at IS NULL`,
      [classId],
    )
  ).rows[0] as SessionRow | undefined;
  return row ? toSession(row) : null;
}

/** Starts a session, or answers the one running: Start twice, from two
 * screens at once, is one session. `minutes` plans its end; the running one's
 * plan doesn't change. */
export async function startSession(
  pool: Pool,
  input: { classId: string; startedBy: string | null; minutes?: number },
): Promise<{ session: LiveSession; created: boolean }> {
  await closeIfDue(pool, input.classId);
  const minutes = input.minutes ?? null;
  if (minutes !== null && !(minutes >= 1 && minutes <= MAX_SESSION_MINUTES))
    throw new SchoolError(400, "invalid_school_request");
  return inTransaction(pool, async (client) => {
    const created = (
      await client.query(
        `INSERT INTO amp_class_sessions AS s(id,class_id,started_by,planned_end_at,rules_version)
         VALUES($1,$2,$3,CASE WHEN $4::int IS NULL THEN NULL ELSE now()+make_interval(mins=>$4::int) END,$5)
         ON CONFLICT(class_id) WHERE ended_at IS NULL DO NOTHING
         RETURNING ${SESSION_COLUMNS}`,
        [
          randomUUID(),
          input.classId,
          input.startedBy,
          minutes,
          LIVE_RULES.version,
        ],
      )
    ).rows[0] as SessionRow | undefined;
    if (created) {
      await noteClassEvent(client, {
        classId: input.classId,
        sessionId: created.id,
        personId: null,
        kind: "session",
      });
      return { session: toSession(created), created: true };
    }
    const running = (
      await client.query(
        `SELECT ${SESSION_COLUMNS} FROM amp_class_sessions s WHERE s.class_id=$1 AND s.ended_at IS NULL`,
        [input.classId],
      )
    ).rows[0] as SessionRow | undefined;
    // Stopped between the insert and this read: the caller can try again.
    if (!running) throw new SchoolError(409, "session_changed");
    return { session: toSession(running), created: false };
  });
}

/** Stops the session and returns its stored report. Stopping one that has
 * already ended (by Stop, or past its end) returns the report it has. */
export async function stopSession(
  pool: Pool,
  input: { classId: string; sessionId: string; endedBy: string | null },
): Promise<SessionReport> {
  await closeIfDue(pool, input.classId);
  const found = (
    await pool.query(
      "SELECT 1 FROM amp_class_sessions WHERE id=$1 AND class_id=$2",
      [input.sessionId, input.classId],
    )
  ).rowCount;
  if (!found) throw new SchoolError(404, "not_found");
  await inTransaction(pool, (client) =>
    freeze(client, {
      id: input.sessionId,
      endedAt: "now",
      endedBy: input.endedBy,
    }),
  );
  const report = await readReport(pool, input.classId, input.sessionId);
  if (!report) throw new SchoolError(404, "not_found");
  return report;
}

/** A stopped session's stored report: the rows frozen when it ended, named
 * as the class names them now. Null when the class has no such session;
 * `session_open` (409) while it runs. */
export async function readReport(
  pool: Pool,
  classId: string,
  sessionId: string,
): Promise<SessionReport | null> {
  await closeIfDue(pool, classId);
  const session = (
    await pool.query(
      `SELECT ${SESSION_COLUMNS} FROM amp_class_sessions s WHERE s.id=$1 AND s.class_id=$2`,
      [sessionId, classId],
    )
  ).rows[0] as SessionRow | undefined;
  if (!session) return null;
  if (!session.ended_at) throw new SchoolError(409, "session_open");
  const rows = (await readReportRows(pool, [sessionId])).get(sessionId) ?? [];
  return { session: toSession(session), rows, totals: reportTotals(rows) };
}

/** Stored rows of these sessions, by session, each sorted by name. Names are
 * read now, labelled as a class list labels them (exact for one session; the
 * list reads totals only). */
async function readReportRows(
  db: Database,
  sessionIds: string[],
): Promise<Map<string, ReportRow[]>> {
  const { rows } = await db.query(
    `SELECT x.session_id,x.person_id,${STUDENT_LABEL} AS name,
       x.problems,x.correct,x.independent,x.assisted,x.hints,x.lessons,x.examples,x.videos,x.skills,x.skill_id,
       x.level,x.first_seen_at,x.first_answer_at,x.last_answer_at,x.status
     FROM amp_class_session_students x JOIN amp_people p ON p.id=x.person_id
     WHERE x.session_id=ANY($1::uuid[])
     ORDER BY x.session_id,lower(${STUDENT_LABEL}),x.person_id`,
    [sessionIds],
  );
  const bySession = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.session_id) ?? [];
    bySession.set(row.session_id, list);
    list.push({
      personId: row.person_id,
      name: row.name,
      problems: row.problems,
      correct: row.correct,
      independent: row.independent,
      assisted: row.assisted,
      hints: row.hints,
      lessons: row.lessons,
      examples: row.examples,
      videos: row.videos,
      skills: (row.skills as string[]).map(skillRef),
      skill: row.skill_id ? skillRef(row.skill_id) : null,
      level: row.level,
      firstSeenAt: row.first_seen_at?.toISOString() ?? null,
      firstAnswerAt: row.first_answer_at?.toISOString() ?? null,
      lastAnswerAt: row.last_answer_at?.toISOString() ?? null,
      status: row.status,
    });
  }
  return bySession;
}

/** The class's sessions, newest first, each with its stored totals. */
export async function listSessions(
  pool: Pool,
  classId: string,
  page: { limit: number; offset: number },
): Promise<SessionList> {
  await closeIfDue(pool, classId);
  const sessions = (
    await pool.query(
      `SELECT ${SESSION_COLUMNS} FROM amp_class_sessions s WHERE s.class_id=$1
       ORDER BY s.started_at DESC,s.id LIMIT $2 OFFSET $3`,
      [classId, page.limit, page.offset],
    )
  ).rows as SessionRow[];
  const rows = await readReportRows(
    pool,
    sessions.filter((s) => s.ended_at).map((s) => s.id),
  );
  return {
    sessions: sessions.map((session) => ({
      ...toSession(session),
      totals: session.ended_at
        ? reportTotals(rows.get(session.id) ?? [])
        : null,
    })),
    nextOffset:
      sessions.length === page.limit ? page.offset + page.limit : null,
  };
}

/** `GET …/live`: the running session with every student's row, the class's
 * totals and its open signals. */
export async function readLiveSnapshot(
  pool: Pool,
  classId: string,
  manage: boolean,
): Promise<LiveSnapshot> {
  const session = await openSession(pool, classId);
  const rows = session
    ? (
        await readLiveRows(pool, {
          classId,
          sessionId: session.id,
          from: session.startedAt,
          to: session.endsAt,
        })
      ).map(toLiveRow)
    : [];
  const signals = await readOpenSignals(pool, classId);
  const serverNow = (await pool.query("SELECT now() AS now")).rows[0]
    .now as Date;
  return {
    serverNow: serverNow.toISOString(),
    session,
    rules: LIVE_RULES,
    rows,
    totals: liveTotals(rows, {
      now: serverNow,
      startedAt: session?.startedAt ?? serverNow.toISOString(),
    }),
    signals,
    can: { manage },
  };
}
