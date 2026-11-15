import type { PoolClient } from "pg";

/** Synthetic practice predates creation of the preview accounts. Move only
 * those fixture learners' enrollments back to their first seeded practice day
 * so term reports and Today describe the same enrollment history. */
export async function alignPersonaEnrollments(
  db: Pick<PoolClient, "query">,
  learners: string[],
) {
  await db.query(
    `WITH first_day AS (
    SELECT learner_id,min(day) AS day FROM amp_active_days
    WHERE learner_id=ANY($1::text[]) GROUP BY learner_id
  ) UPDATE amp_enrollments e SET begin_on=LEAST(e.begin_on,d.day)
    FROM amp_people p,first_day d
    WHERE e.person_id=p.id AND p.learner_id=d.learner_id AND e.role='student'`,
    [learners],
  );
}
