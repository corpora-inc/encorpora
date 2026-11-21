import type { PoolClient } from "pg";
import { activeToday } from "../principal.js";
import { SIGNAL_OPEN_MS, type LiveSession } from "./contracts.js";
import type { StudentSession, StudentSignal } from "./stream-contracts.js";

type Database = Pick<PoolClient, "query">;

/* What a signed-in student may know live (work package L2): the sessions
   running in their own classes and their own requests. Nothing here reads
   another student. */

/** The classes a student is in today: their stream's subscriptions. */
export async function studentClassIds(
  db: Database,
  personId: string,
): Promise<string[]> {
  const { rows } = await db.query(
    `SELECT e.class_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
     JOIN amp_orgs o ON o.id=c.org_id
     WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}
     ORDER BY e.class_id`,
    [personId],
  );
  return rows.map((row) => row.class_id as string);
}

/** A running session as a student sees it. */
export const toStudentSession = (session: LiveSession): StudentSession => ({
  id: session.id,
  classId: session.classId,
  startedAt: session.startedAt,
  endsAt: session.endsAt,
});

/** The most of one student's requests a student read carries. */
const STUDENT_SIGNALS = 20;

/** Each student's own requests in their classes: open, or resolved within
 * `SIGNAL_OPEN_MS`, oldest first, by person. One statement for any number of
 * students (the hub reads every student whose signal changed in a tick at
 * once). */
export async function readStudentSignals(
  db: Database,
  students: readonly { personId: string; classIds: readonly string[] }[],
): Promise<Map<string, StudentSignal[]>> {
  const bySubject = new Map<string, StudentSignal[]>(
    students.map((student) => [student.personId, []]),
  );
  const pairs = students.flatMap((student) =>
    student.classIds.map((classId) => [student.personId, classId] as const),
  );
  if (!pairs.length) return bySubject;
  // Over `amp_class_signals_person_idx`; each (person, class) pair is one
  // student in one of their classes.
  const { rows } = await db.query(
    `WITH who AS (SELECT * FROM unnest($1::uuid[],$2::uuid[]) AS w(person_id,class_id)),
     mine AS (
       SELECT g.id,g.person_id,g.class_id,g.kind,g.created_at,g.resolved_at,g.resolution,
         row_number() OVER (PARTITION BY g.person_id ORDER BY g.created_at DESC,g.id DESC) AS n
       FROM amp_class_signals g JOIN who ON who.person_id=g.person_id AND who.class_id=g.class_id
       WHERE (g.resolved_at IS NULL AND g.created_at>now()-make_interval(secs=>$3/1000.0))
          OR g.resolved_at>now()-make_interval(secs=>$3/1000.0)
     )
     SELECT id,person_id,class_id,kind,created_at,resolved_at,resolution FROM mine
     WHERE n<=$4 ORDER BY person_id,created_at,id`,
    [
      pairs.map(([personId]) => personId),
      pairs.map(([, classId]) => classId),
      SIGNAL_OPEN_MS,
      STUDENT_SIGNALS,
    ],
  );
  for (const row of rows)
    bySubject.get(row.person_id)?.push({
      id: row.id,
      classId: row.class_id,
      kind: row.kind,
      createdAt: (row.created_at as Date).toISOString(),
      resolvedAt: (row.resolved_at as Date | null)?.toISOString() ?? null,
      resolution: row.resolution,
    });
  return bySubject;
}
