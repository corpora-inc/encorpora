import { can, rosterScope, type Actor } from "./authz.js";
import {
  PLACES_LIMIT,
  type OrgResource,
  type PlacesResource,
} from "./contracts.js";
import type { SchoolRepository } from "./repository.js";
import { YEAR_IN_USE } from "./years.js";

/**
 * The place switcher's one read (docs/architecture/spaces.md): every org this
 * account holds a staff role at, the schools below each district or network
 * it may oversee, and the classes it teaches or aides this year. Nothing here
 * grants anything: each row is what the account's own roles and enrollments
 * already open, decided by the same `can` as every school route. Each list is
 * bounded; `more` says one was cut, and `/school` lists them all.
 */
export async function readPlaces(
  repository: SchoolRepository,
  actor: Actor,
  limit = PLACES_LIMIT,
): Promise<PlacesResource> {
  // The orgs this account holds a current staff role at, decided by the
  // same live predicate as every school route: the actor's roles (dated, not
  // removed, and not a lapsed or revoked provider authority), each read
  // allowed by `can`. Limited in the database, one past the page to say more.
  const held = actor.roles.filter((role) =>
    can(actor, "org.read", { kind: "org", orgId: role.orgId, path: role.path }),
  );
  const ids = [...new Set(held.map((role) => role.orgId))];
  const mine: OrgResource[] = ids.length
    ? (
        await repository.pool.query(
          `SELECT o.id,o.kind,o.name,o.parent_id AS "parentId",o.timezone,o.solo,
             o.demo AND o.created_by LIKE 'amp-demo:%' AS "sharedDemo",
             o.setup_pending AS "setupPending",o.demo
           FROM amp_orgs o
           WHERE o.id=ANY($1::uuid[]) AND (o.kind<>'family' OR o.created_by<>$2)
           ORDER BY o.name,o.id LIMIT $3`,
          [ids, actor.accountId, limit + 1],
        )
      ).rows.map(({ sharedDemo, ...row }) => {
        const roles = [
          ...new Set(
            held
              .filter((role) => role.orgId === row.id)
              .map((role) => role.role),
          ),
        ].sort();
        // A shared demo is "just my class" for its visitors, not its admins.
        return {
          ...row,
          solo: sharedDemo ? !roles.includes("admin") : row.solo,
          roles,
        } as OrgResource;
      })
    : [];
  const orgs = mine.slice(0, limit);
  // A school with one class shows as that class (docs/design/ia.md). Only a
  // solo school can be one, so only those are counted, as the caller sees them.
  const lone = await Promise.all(
    orgs.map(async (org) => {
      if (org.solo !== true || org.kind === "family") return false;
      const role = actor.roles.find((entry) => entry.orgId === org.id);
      const path = role?.path ?? [org.id];
      const classes = await repository.classes(
        org.id,
        rosterScope(actor, { kind: "org", orgId: org.id, path }),
        { limit: 2, offset: 0 },
      );
      return classes.length <= 1;
    }),
  );
  // A district's or network's schools, where this account reads its overview.
  const above = actor.roles
    .filter((role) =>
      mine.some(
        (org) =>
          org.id === role.orgId &&
          (org.kind === "district" || org.kind === "network"),
      ),
    )
    .filter((role) =>
      can(actor, "overview.read", {
        kind: "org",
        orgId: role.orgId,
        path: role.path,
      }),
    )
    .map((role) => role.orgId);
  const schools = above.length
    ? (
        await repository.pool.query(
          `SELECT o.id,o.name,o.parent_id AS "parentId",o.demo FROM amp_orgs o
           WHERE o.path && $1::uuid[] AND o.kind='school' AND NOT o.id=ANY($1::uuid[])
           ORDER BY lower(o.name),o.id LIMIT $2`,
          [above, limit + 1],
        )
      ).rows
    : [];
  // The classes they teach or aide this year, outside a family: a family's
  // class is the family's own place.
  const taught = actor.classes;
  const classes = taught.length
    ? (
        await repository.pool.query(
          `SELECT c.id,c.org_id AS "orgId",c.name,o.name AS "orgName",o.demo
           FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
           JOIN amp_academic_sessions cs ON cs.id=c.session_id
           WHERE c.id=ANY($1::uuid[]) AND o.kind<>'family' AND c.archived_at IS NULL AND ${YEAR_IN_USE}
           ORDER BY lower(o.name),lower(c.name),c.id LIMIT $2`,
          [taught.map((entry) => entry.classId), limit + 1],
        )
      ).rows
    : [];
  const demo = (row: { demo?: boolean | null }) =>
    row.demo ? { demo: true as const } : {};
  return {
    orgs: orgs.map((org, index) => ({
      id: org.id,
      kind: org.kind,
      name: org.name,
      parentId: org.parentId,
      roles: org.roles,
      solo: org.solo === true,
      ...(org.setupPending ? { setupPending: true } : {}),
      ...demo(org),
      lone: lone[index]!,
    })),
    schools: schools.slice(0, limit).map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      ...demo(row),
    })),
    classes: classes.slice(0, limit).map((row) => ({
      id: row.id,
      orgId: row.orgId,
      orgName: row.orgName,
      name: row.name,
      // A teacher's enrollment names the class as theirs before an aide's.
      role: taught.some(
        (entry) => entry.classId === row.id && entry.role === "teacher",
      )
        ? ("teacher" as const)
        : ("aide" as const),
      ...demo(row),
    })),
    more:
      mine.length > limit || schools.length > limit || classes.length > limit,
  };
}
