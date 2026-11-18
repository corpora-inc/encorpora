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
      `INSERT INTO amp_adult_checkins(learner_id,role,kind)
       SELECT id,$2::amp_checkin_role,$3::amp_checkin_kind FROM amp_learners
       WHERE id=ANY($1::text[]) AND NOT adult AND deleted_at IS NULL`,
      [typeof learnerIds === "string" ? [learnerIds] : learnerIds, role, kind],
    ),
  );
}

/** The role a school actor holds over a rostered student: their class's
 * teacher or aide, else the school's staff (an admin or a viewer). */
export function staffRole(
  actor: Actor,
  target: { classIds?: readonly string[]; classId?: string },
): CheckinRole {
  const classes = target.classIds ?? (target.classId ? [target.classId] : []);
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
 * teacher. */
export function recordStaffCheckin(
  db: Database,
  log: Log,
  actor: Actor,
  target: {
    personId: string;
    classIds?: readonly string[];
    classId?: string;
    demo?: boolean;
  },
  kind: CheckinKind,
) {
  if (target.demo) return Promise.resolve();
  return kept(log, () =>
    db.query(
      `INSERT INTO amp_adult_checkins(learner_id,role,kind)
       SELECT l.id,CASE WHEN l.account_id=$2 OR EXISTS (
           SELECT 1 FROM amp_families f JOIN amp_people s ON s.id=f.second_parent
           WHERE f.account_id=l.account_id AND s.account_id=$2)
         THEN 'parent' ELSE $3 END::amp_checkin_role,$4::amp_checkin_kind
       FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id
       WHERE p.id=$1 AND NOT l.adult AND l.deleted_at IS NULL`,
      [target.personId, actor.accountId, staffRole(actor, target), kind],
    ),
  );
}
