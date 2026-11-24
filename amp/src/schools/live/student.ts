import type { PoolClient } from "pg";
import { activeToday } from "../principal.js";
import type { LiveSession } from "./contracts.js";
import type { StudentSession } from "./stream-contracts.js";

type Database = Pick<PoolClient, "query">;

/* What a signed-in student may know live (work package L2): the sessions
   running in their own classes and their own requests. Nothing here reads
   another student. */

/** The classes a student is in today (their stream's subscriptions), and
 * which of them are a family's own: there the adult is a parent, and a
 * student's screen says so ("Your parent saw it."). */
export async function studentClasses(
  db: Database,
  personId: string,
): Promise<{ classIds: string[]; familyClassIds: string[] }> {
  const { rows } = await db.query(
    `SELECT e.class_id,o.kind='family' AS family FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
     JOIN amp_orgs o ON o.id=c.org_id
     WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}
     ORDER BY e.class_id`,
    [personId],
  );
  return {
    classIds: rows.map((row) => row.class_id as string),
    familyClassIds: rows
      .filter((row) => row.family === true)
      .map((row) => row.class_id as string),
  };
}

/** A running session as a student sees it. */
export const toStudentSession = (session: LiveSession): StudentSession => ({
  id: session.id,
  classId: session.classId,
  startedAt: session.startedAt,
  endsAt: session.endsAt,
});
