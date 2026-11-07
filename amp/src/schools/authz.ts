import type { PoolClient } from "pg";
import type { SchoolAction, StaffRole } from "./contracts.js";
import { activeToday, isSchoolAccount } from "./principal.js";

type Database = Pick<PoolClient, "query">;

export type ActorRole = {
  personId: string;
  orgId: string;
  path: string[];
  role: StaffRole;
};
export type ActorClass = {
  personId: string;
  classId: string;
  orgId: string;
  path: string[];
  role: "teacher" | "aide";
};
/** One account's school access, read on every request so an ended role or
 * enrollment stops working on the next one. */
export type Actor = {
  accountId: string;
  roles: ActorRole[];
  classes: ActorClass[];
};
export type SchoolTarget =
  | { kind: "self" }
  | { kind: "org"; orgId: string; path: string[] }
  | { kind: "class"; classId: string; orgId: string; path: string[] }
  /** A rostered student, reached through the org they attend and the classes
   * they are in today. */
  | {
      kind: "student";
      personId: string;
      orgId: string;
      path: string[];
      classIds: string[];
    };

/** Staff roles and staff enrollments in force today. A staff enrollment counts
 * only while the person still holds a staff role along the class's org path,
 * and only in a class that hasn't been archived. */
export async function loadActor(
  db: Database,
  accountId: string,
): Promise<Actor> {
  if (isSchoolAccount(accountId)) return { accountId, roles: [], classes: [] };
  const roles = await db.query(
    `SELECT r.person_id,r.org_id,o.path,r.role FROM amp_people p
     JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
     JOIN amp_orgs o ON o.id=r.org_id
     WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}`,
    [accountId],
  );
  const classes = await db.query(
    `SELECT e.person_id,e.class_id,c.org_id,o.path,e.role FROM amp_people p
     JOIN amp_enrollments e ON e.person_id=p.id AND e.role<>'student'
     JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
     JOIN amp_orgs o ON o.id=c.org_id
     WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("e", "o")}
       AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.role<>'student'
         AND r.org_id=ANY(o.path) AND ${activeToday("r", "o")})`,
    [accountId],
  );
  return {
    accountId,
    roles: roles.rows.map((row) => ({
      personId: row.person_id,
      orgId: row.org_id,
      path: row.path,
      role: row.role,
    })),
    classes: classes.rows.map((row) => ({
      personId: row.person_id,
      classId: row.class_id,
      orgId: row.org_id,
      path: row.path,
      role: row.role,
    })),
  };
}

/** What staff can do at the org they work at: open it, and list what's theirs. */
const ORG_STAFF = new Set<SchoolAction>([
  "org.read",
  "classes.read",
  "students.read",
  "calendar.read",
  "settings.read",
]);
const VIEWER = new Set<SchoolAction>([
  ...ORG_STAFF,
  "staff.read",
  "license.read",
  "signin.read",
  "workbooks.read",
]);
const AIDE_CLASS = new Set<SchoolAction>([
  "classes.read",
  "students.read",
  "signin.read",
  "settings.read",
  "workbooks.read",
  "workbooks.write",
]);
const TEACHER_CLASS = new Set<SchoolAction>([
  ...AIDE_CLASS,
  "students.add",
  "classes.update",
  "students.update",
  "signin.manage",
  "settings.write",
]);
const SELF = new Set<SchoolAction>([
  "orgs.list",
  "setup.start",
  "invites.accept",
]);

/** The only authorization rule for school routes. Admin covers descendants
 * along the path, viewer reads them, and teacher and aide cover the classes
 * they're actively enrolled in as staff. A student never passes. */
export function can(
  actor: Actor,
  action: SchoolAction,
  target: SchoolTarget,
): boolean {
  if (isSchoolAccount(actor.accountId)) return false;
  if (target.kind === "self") return SELF.has(action);
  if (SELF.has(action)) return false;
  const roles = actor.roles.filter((role) => target.path.includes(role.orgId));
  if (roles.some((role) => role.role === "admin")) return true;
  if (VIEWER.has(action) && roles.some((role) => role.role === "viewer"))
    return true;
  if (target.kind === "class" || target.kind === "student") {
    const ids = target.kind === "class" ? [target.classId] : target.classIds;
    const own = actor.classes.filter((c) => ids.includes(c.classId));
    return (
      (own.some((c) => c.role === "teacher") && TEACHER_CLASS.has(action)) ||
      (own.some((c) => c.role === "aide") && AIDE_CLASS.has(action))
    );
  }
  return (
    ORG_STAFF.has(action) &&
    roles.some((role) => role.role === "teacher" || role.role === "aide")
  );
}

/** Which rows of an org's roster this actor reads: all of them, or only their
 * own classes. Call after `can` has allowed the read. */
export function rosterScope(
  actor: Actor,
  target: Extract<SchoolTarget, { kind: "org" }>,
): { classIds: string[] | null } {
  const whole = actor.roles.some(
    (role) =>
      (role.role === "admin" || role.role === "viewer") &&
      target.path.includes(role.orgId),
  );
  return {
    classIds: whole
      ? null
      : actor.classes
          .filter((c) => c.path.includes(target.orgId))
          .map((c) => c.classId),
  };
}

/** Who to attribute a change to: the actor's person in this target's tenant. */
export function actorPerson(
  actor: Actor,
  target: { path: string[] },
): string | null {
  return (
    actor.roles.find((role) => target.path.includes(role.orgId))?.personId ??
    actor.classes.find((c) => target.path.includes(c.orgId))?.personId ??
    null
  );
}
