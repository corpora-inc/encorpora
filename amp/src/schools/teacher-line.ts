import type { PoolClient } from "pg";
import { activeToday } from "./principal.js";
import { PERSON_FIRST, PERSON_NAME } from "./term-grades.js";

/* The teacher in their class (docs/families.md): a teacher of a class who
   practices on their own adult learner is a line on that class's map and board,
   marked as the teacher and never ranked. They are never a student: rosters,
   seats, grades, exports, Today and class medians read enrollments as students
   and never reach this. */
type Database = Pick<PoolClient, "query">;

/** The class-scope key listing teachers who chose not to show in this class.
 * It sits beside the settings in `amp_scope_settings`, as `leftOff` does;
 * `resolveSettings` only reads its own keys. */
export const TEACHERS_HIDDEN_KEY = "teachersHidden";

export type ClassTeacher = {
  personId: string;
  learnerId: string;
  accountId: string;
  name: string;
  first: string;
  /** Off only when this teacher chose not to show in this class. */
  shown: boolean;
};

/** Every teacher of this class today who has their own live adult learner,
 * shown or not, by name. A teacher counts as `loadActor` counts them: a teacher
 * enrollment in force, in a class that isn't archived, while they still hold a
 * staff role along its org path. Aides never practice here. */
export async function classTeachers(
  db: Database,
  classId: string,
): Promise<ClassTeacher[]> {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (lower(${PERSON_NAME}),p.id)
       p.id AS "personId",l.id AS "learnerId",p.account_id AS "accountId",
       ${PERSON_NAME} AS name,${PERSON_FIRST} AS first,
       NOT EXISTS(SELECT 1 FROM amp_scope_settings s WHERE s.scope_kind='class' AND s.scope_id=c.id
         AND s."values"->'${TEACHERS_HIDDEN_KEY}' ? p.id::text) AS shown
     FROM amp_enrollments e
     JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
     JOIN amp_orgs o ON o.id=c.org_id
     JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL AND p.account_id IS NOT NULL
     JOIN amp_learners l ON l.account_id=p.account_id AND l.adult AND NOT l.simulation AND l.deleted_at IS NULL
     WHERE e.class_id=$1 AND e.role='teacher' AND ${activeToday("e", "o")}
       AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.role<>'student'
         AND r.org_id=ANY(o.path) AND ${activeToday("r", "o")})
     ORDER BY lower(${PERSON_NAME}),p.id`,
    [classId],
  );
  return rows;
}

/** The teachers whose line this class shows. */
export const shownTeachers = async (db: Database, classId: string) =>
  (await classTeachers(db, classId)).filter((teacher) => teacher.shown);
