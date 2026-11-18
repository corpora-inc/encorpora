import type { Pool } from "pg";
import type { Actor } from "../schools/authz.js";

/** An adult checking in on a learner (migration 0145): a parent or a teacher
 * reading the learner's record, assigning them work, or scoring their
 * workbook. A row holds the learner, the adult's role, what they did and when.
 * Never who the adult is, never what they read. An adult's own learner and
 * their practice profiles are never checked in on: that is their own
 * practice. Demo schools are not recorded. */
export type CheckinRole = "parent" | "teacher" | "aide" | "school_staff";
export type CheckinKind = "view" | "assign" | "score";
type Database = Pick<Pool, "query">;
type Log = { error(details: object, message: string): void };

/** A check-in is a record beside the work, never a reason the work fails:
 * a lost row is said aloud and the request goes on. */
async function kept(log: Log, write: () => Promise<unknown>) {
  try {
    await write();
  } catch (error) {
    log.error({ err: error }, "Adult check-in not recorded");
  }
}

/** Inserts the rows of a CTE `n` (learner_id, role, kind). One look is one
 * view: a screen refetching, a tab coming back into focus, a PDF of what was
 * just read. So a view counts once per learner and role in 30 minutes;
 * assigning and scoring are each their own act. */
const INSERT_CHECKINS = `INSERT INTO amp_adult_checkins(learner_id,role,kind)
  SELECT n.learner_id,n.role,n.kind FROM n
  WHERE n.kind<>'view' OR NOT EXISTS (SELECT 1 FROM amp_adult_checkins c
    WHERE c.learner_id=n.learner_id AND c.role=n.role AND c.kind='view'
      AND c."at">now()-interval '30 minutes')`;

/** Records `kind` by an adult in `role` on each of `learnerIds`. */
export function recordCheckin(
  db: Database,
  log: Log,
  learnerIds: string | readonly string[],
  role: CheckinRole,
  kind: CheckinKind,
) {
  return kept(log, () =>
    db.query(
      `WITH n AS (
         SELECT id AS learner_id,$2::amp_checkin_role AS role,$3::amp_checkin_kind AS kind
         FROM amp_learners WHERE id=ANY($1::text[]) AND NOT adult AND deleted_at IS NULL
       ) ${INSERT_CHECKINS}`,
      [typeof learnerIds === "string" ? [learnerIds] : learnerIds, role, kind],
    ),
  );
}

type StaffTarget = {
  personId: string;
  classIds?: readonly string[];
  classId?: string;
  demo?: boolean;
};
const classesOf = (target: Omit<StaffTarget, "personId">) =>
  target.classIds ?? (target.classId ? [target.classId] : []);

/** The role a school actor holds over a rostered student: their class's
 * teacher or aide, else the school's staff (an admin or a viewer). */
export function staffRole(
  actor: Actor,
  target: Omit<StaffTarget, "personId">,
): CheckinRole {
  const classes = classesOf(target);
  const roles = actor.classes
    .filter((c) => classes.includes(c.classId))
    .map((c) => c.role);
  return roles.includes("teacher")
    ? "teacher"
    : roles.includes("aide")
      ? "aide"
      : "school_staff";
}

/** Records `kind` on a rostered student by a school actor. In a family's
 * class the family's own parents (its holder and its second parent) are
 * parents there, whatever their class role; a tutor teaching it is a
 * teacher, and so is a school teacher whose own child is in their class. */
export function recordStaffCheckin(
  db: Database,
  log: Log,
  actor: Actor,
  target: StaffTarget,
  kind: CheckinKind,
) {
  if (target.demo) return Promise.resolve();
  return kept(log, () => {
    const classes = classesOf(target);
    const familyClass = actor.classes.some(
      (c) => c.family && classes.includes(c.classId),
    );
    return db.query(
      `WITH n AS (
         SELECT l.id AS learner_id,CASE WHEN $5 AND (l.account_id=$2 OR EXISTS (
             SELECT 1 FROM amp_families f JOIN amp_people s ON s.id=f.second_parent
             WHERE f.account_id=l.account_id AND s.account_id=$2))
           THEN 'parent' ELSE $3 END::amp_checkin_role AS role,$4::amp_checkin_kind AS kind
         FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id
         WHERE p.id=$1 AND NOT l.adult AND l.deleted_at IS NULL
       ) ${INSERT_CHECKINS}`,
      [
        target.personId,
        actor.accountId,
        staffRole(actor, target),
        kind,
        familyClass,
      ],
    );
  });
}
