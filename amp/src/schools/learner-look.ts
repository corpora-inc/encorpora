import type { Pool } from "pg";
import type { ClassLook } from "../learning/look.js";
import { enrollmentSettings } from "./enrollment-settings.js";
import { activeToday } from "./principal.js";

/** What each of a learner's classes says about look (a family's class is
 * one of them). A learner with no school or family person has none: their
 * own choice and Calm decide. Reads only. */
export async function learnerClassLooks(
  db: Pick<Pool, "query">,
  learnerId: string,
): Promise<ClassLook[]> {
  const person = (
    await db.query(
      "SELECT id FROM amp_people WHERE learner_id=$1 AND deleted_at IS NULL",
      [learnerId],
    )
  ).rows[0]?.id as string | undefined;
  if (!person) return [];
  const home = (
    await db.query(
      `SELECT o.path FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.role='student' AND ${activeToday("r", "o")}
       ORDER BY r.begin_on DESC,o.id LIMIT 1`,
      [person],
    )
  ).rows[0] as { path: string[] } | undefined;
  if (!home) return [];
  const classes = (
    await db.query(
      `SELECT c.id,o.path FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
       JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}
       ORDER BY e.begin_on DESC,c.name,c.id`,
      [person],
    )
  ).rows as { id: string; path: string[] }[];
  return (await enrollmentSettings(db, person, home, classes)).map(
    ({ look }) => ({
      value: look.value,
      set: look.setBy !== null,
      locked: look.lockedBy !== null,
    }),
  );
}
