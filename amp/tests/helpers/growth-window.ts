import type { Pool, PoolClient } from "pg";
import { growthWindowStart } from "../../src/schools/standings.js";

/**
 * Term growth is the settled pace times the term's elapsed days, from the
 * term's start or the day a student joined (`src/schools/growth.ts`). A
 * fixture that writes a start level on `from` and an end level later means
 * the change between them to be the growth, so its start level must open
 * that window. This moves it there (over any start level an earlier call
 * left), and a student who joined after `from` joined on it.
 */
export async function alignGrowthStart(
  db: Pool | PoolClient,
  learnerId: string,
  from: string,
  /** The class whose board reads it: a teacher's own learner has no
   * enrollment to find it by. */
  classId?: string,
) {
  // A student was in the class for the work being counted.
  await db.query(
    `UPDATE amp_org_roles r SET begin_on=$2::date FROM amp_people p
     WHERE p.id=r.person_id AND p.learner_id=$1 AND r.role='student' AND r.begin_on>$2::date`,
    [learnerId, from],
  );
  await db.query(
    `UPDATE amp_enrollments e SET begin_on=$2::date FROM amp_people p
     WHERE p.id=e.person_id AND p.learner_id=$1 AND e.role='student' AND e.begin_on>$2::date`,
    [learnerId, from],
  );
  const klass =
    classId ??
    ((
      await db.query(
        `SELECT e.class_id FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
         WHERE p.learner_id=$1 ORDER BY e.begin_on LIMIT 1`,
        [learnerId],
      )
    ).rows[0]?.class_id as string | undefined);
  if (!klass) return;
  const start = await growthWindowStart(db, learnerId, klass);
  if (start === from) return;
  await db.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
     SELECT learner_id,$3::date,frontier,policy_version FROM amp_level_days
     WHERE learner_id=$1 AND day=$2::date
     ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
    [learnerId, from, start],
  );
  await db.query(
    "DELETE FROM amp_level_days WHERE learner_id=$1 AND day=$2::date",
    [learnerId, from],
  );
}
