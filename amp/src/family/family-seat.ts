import type { PoolClient } from "pg";
import { activeToday } from "../schools/principal.js";

type Database = Pick<PoolClient, "query">;

/**
 * Whether this account teaches the learner in a family class: the learner is
 * a student enrolled there today, and the account is a teacher of that class
 * today while it holds a staff role along the class's org path (as
 * `classTeachers` counts teachers). A teacher may buy such a child an
 * additional-child seat (docs/families.md, docs/stripe.md). The learner stays
 * owned by their own parent's account; this never grants consent.
 */
export async function teachesFamilySeat(
  db: Database,
  accountId: string,
  learnerId: string,
): Promise<boolean> {
  // A schema from before families has no family classes.
  if (
    !(await db.query("SELECT to_regclass('amp_families') AS relation")).rows[0]
      .relation
  )
    return false;
  const { rowCount } = await db.query(
    `SELECT 1
       FROM amp_enrollments se
       JOIN amp_classes c ON c.id=se.class_id AND c.archived_at IS NULL
       JOIN amp_orgs o ON o.id=c.org_id AND o.kind='family'
       JOIN amp_people sp ON sp.id=se.person_id AND sp.deleted_at IS NULL AND sp.learner_id=$2
       JOIN amp_learners l ON l.id=sp.learner_id AND l.deleted_at IS NULL AND NOT l.adult
       JOIN amp_enrollments te ON te.class_id=c.id AND te.role='teacher' AND ${activeToday("te", "o")}
       JOIN amp_people tp ON tp.id=te.person_id AND tp.deleted_at IS NULL AND tp.account_id=$1
      WHERE se.role='student' AND ${activeToday("se", "o")}
        AND l.account_id<>$1
        AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=tp.id AND r.role<>'student'
          AND r.org_id=ANY(o.path) AND ${activeToday("r", "o")})
      LIMIT 1`,
    [accountId, learnerId],
  );
  return !!rowCount;
}
