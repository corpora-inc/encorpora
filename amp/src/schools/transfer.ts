import type { PoolClient } from "pg";
import { can, actorPerson, type Actor, type SchoolTarget } from "./authz.js";
import { SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import {
  transferSchema,
  type seatOutcomes,
  type TransferOptions,
} from "./org-contracts.js";
import type { SchoolRepository } from "./repository.js";
import { syncSsoCredentials } from "./sso-credentials.js";

type Database = Pick<PoolClient, "query">;
type Student = Extract<SchoolTarget, { kind: "student" }>;
type SeatOutcome = (typeof seatOutcomes)[number];
type School = { id: string; name: string; path: string[]; timezone: string };

const IN_FORCE = `l.status='active' AND l.starts_at<=now() AND l.ends_at>now()`;
/** The license a student holds a seat on now, if it is still in force. */
const heldLicense = async (db: Database, personId: string) =>
  ((
    await db.query(
      `SELECT l.org_id FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
       WHERE s.person_id=$1 AND s.released_at IS NULL AND ${IN_FORCE}`,
      [personId],
    )
  ).rows[0]?.org_id ?? null) as string | null;
const hasRoom = async (db: Database, path: readonly string[]) =>
  !!(
    await db.query(
      `SELECT 1 FROM amp_school_licenses l WHERE l.org_id=ANY($1::uuid[]) AND ${IN_FORCE}
         AND l.seats>(SELECT count(*) FROM amp_seats s WHERE s.license_id=l.id AND s.released_at IS NULL)
       LIMIT 1`,
      [path],
    )
  ).rowCount;

/** The other schools in this tenant that this person can move a student to, and
 * what would happen to the seat at each. */
export async function transferOptions(
  db: Database,
  actor: Actor,
  target: Student,
): Promise<TransferOptions> {
  const { rows } = await db.query(
    `SELECT id,name,path FROM amp_orgs WHERE kind='school' AND path[1]=$1 ORDER BY lower(name),id`,
    [target.path[0]],
  );
  const schools = rows as { id: string; name: string; path: string[] }[];
  const from = schools.find((school) => school.id === target.orgId);
  const held = await heldLicense(db, target.personId);
  const options = [];
  for (const school of schools) {
    if (school.id === target.orgId) continue;
    if (
      !can(actor, "students.transfer", {
        kind: "org",
        orgId: school.id,
        path: school.path,
      })
    )
      continue;
    const stays = held !== null && school.path.includes(held);
    options.push({
      id: school.id,
      name: school.name,
      seat: stays
        ? ("stays" as const)
        : (await hasRoom(db, school.path))
          ? ("moves" as const)
          : ("needs" as const),
    });
  }
  return {
    from: { id: target.orgId, name: from?.name ?? "" },
    schools: options,
  };
}

/** A student moves campus: the role and enrollments at the old school end today,
 * a role at the new one begins, and it's the same person and learner, so evidence
 * and frozen grades don't move at all. A seat on a license that covers the new
 * school stays; otherwise it's released and one taken from the new school's
 * license, or the student shows "needs a seat". */
export async function transferCampus(
  repo: SchoolRepository,
  actor: Actor,
  target: Student,
  raw: unknown,
) {
  const input = transferSchema.parse(raw);
  const actorPersonId = actorPerson(actor, target);
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-student:${target.personId}`,
    ]);
    const person = (
      await client.query(
        "SELECT id,learner_id,tenant_id FROM amp_people WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
        [target.personId],
      )
    ).rows[0];
    if (!person?.learner_id) throw new SchoolError(404, "student_not_found");
    const to = (
      await client.query(
        "SELECT id,name,path,timezone FROM amp_orgs WHERE id=$1 AND kind='school' AND path[1]=$2",
        [input.to, person.tenant_id],
      )
    ).rows[0] as School | undefined;
    if (
      !to ||
      to.id === target.orgId ||
      !can(actor, "students.transfer", {
        kind: "org",
        orgId: to.id,
        path: to.path,
      })
    )
      throw new SchoolError(404, "school_not_found");
    const from = await repo.org(client, target.orgId);
    const leaving = await repo.today(client, from.timezone);
    await client.query(
      `UPDATE amp_org_roles SET end_on=GREATEST(begin_on,$3::date)
       WHERE person_id=$1 AND org_id=$2 AND role='student' AND (end_on IS NULL OR end_on>$3::date)`,
      [person.id, from.id, leaving],
    );
    await client.query(
      `UPDATE amp_enrollments e SET end_on=GREATEST(e.begin_on,$3::date)
       FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.class_id=c.id AND e.person_id=$1 AND e.role='student'
         AND o.path @> ARRAY[$2]::uuid[] AND (e.end_on IS NULL OR e.end_on>$3::date)`,
      [person.id, from.id, leaving],
    );
    const starting = await repo.today(client, to.timezone);
    await client.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES(gen_random_uuid(),$1,$2,'student',$3)
       ON CONFLICT (person_id,org_id,role) WHERE end_on IS NULL DO NOTHING`,
      [person.id, to.id, starting],
    );
    await client.query("UPDATE amp_people SET timezone=$2 WHERE id=$1", [
      person.id,
      to.timezone,
    ]);
    const seat = (
      await client.query(
        `SELECT s.id,s.grant_id,l.org_id,${IN_FORCE} AS in_force
         FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
         WHERE s.person_id=$1 AND s.released_at IS NULL FOR UPDATE OF s`,
        [person.id],
      )
    ).rows[0] as
      | {
          id: string;
          grant_id: string | null;
          org_id: string;
          in_force: boolean;
        }
      | undefined;
    let outcome: SeatOutcome = "stays";
    if (!seat?.in_force || !to.path.includes(seat.org_id)) {
      if (seat) {
        await client.query(
          "UPDATE amp_seats SET released_at=now() WHERE id=$1",
          [seat.id],
        );
        if (seat.grant_id)
          await client.query(
            "UPDATE amp_grants SET status='revoked' WHERE id=$1",
            [seat.grant_id],
          );
      }
      outcome = (await repo.takeSeat(
        client,
        person.id,
        person.learner_id,
        to.path,
      ))
        ? "moves"
        : "needs";
    }
    if (input.classId) {
      const home = await repo.classIn(client, input.classId, to.path);
      await repo.enroll(client, home.id, person.id, "student", starting);
    }
    await syncSsoCredentials(client, person.tenant_id);
    for (const orgId of [from.id, to.id])
      await recordEvent(client, {
        orgId,
        actorPersonId,
        action: "student.moved-school",
        targetKind: "person",
        targetId: person.id,
        detail: {
          before: { orgId: from.id },
          after: { orgId: to.id, seat: outcome },
        },
      });
    return { to: { id: to.id, name: to.name }, seat: outcome };
  });
}
