import type { PoolClient } from "pg";
import { FamilyRepository } from "../family/repository.js";
import { SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import { activeToday, schoolAccountId } from "./principal.js";
import { birthYearForGrade, type SchoolRepository } from "./repository.js";
import {
  setClassesSchema,
  updateClassSchema,
  updateStudentSchema,
} from "./setup-contracts.js";
import { ensureDivision } from "./setup.js";
import {
  lockLearningAccount,
  namingConsentActive,
} from "../server/account-access.js";

/** The name a student's learner goes by across the app: a school's own display
 * name, else their roster name. */
export const learnerNameFrom = (person: {
  display_name?: string | null;
  given_name: string;
  family_name?: string | null;
}) =>
  person.display_name ??
  (person.family_name
    ? `${person.given_name} ${person.family_name}`
    : person.given_name);

/** A grade change moves the prior only while there's no evidence: after that,
 * the student's own answers say where they are. */
export async function writeStudent(
  client: PoolClient,
  personId: string,
  changes: {
    displayName?: string | null;
    gradeLevel?: number | null;
    givenName?: string;
    familyName?: string | null;
    email?: string | null;
    identifier?: string | null;
  },
) {
  const learner = (
    await client.query(
      `SELECT l.id,l.account_id,l.name_pending FROM amp_people p
     JOIN amp_learners l ON l.id=p.learner_id WHERE p.id=$1 AND p.deleted_at IS NULL`,
      [personId],
    )
  ).rows[0];
  if (learner) {
    await lockLearningAccount(client, learner.account_id);
    const locked = (
      await client.query(
        "SELECT name_pending FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [learner.id, learner.account_id],
      )
    ).rows[0];
    if (!locked) throw new SchoolError(409, "student_changed");
    const naming = [
      changes.givenName,
      changes.familyName,
      changes.displayName,
      changes.email,
      changes.identifier,
    ].some((value) => value != null);
    if (locked.name_pending && naming) {
      if (
        !(await namingConsentActive(
          client,
          learner.account_id,
          false,
          learner.id,
        ))
      )
        throw new SchoolError(403, "consent_required");
      await client.query(
        "UPDATE amp_learners SET name_pending=false WHERE id=$1",
        [learner.id],
      );
    }
  }
  const person = (
    await client.query(
      `UPDATE amp_people SET
         display_name=CASE WHEN $2::boolean THEN $3 ELSE display_name END,
         grade_level=CASE WHEN $4::boolean THEN $5::smallint ELSE grade_level END,
         given_name=COALESCE($6,given_name),
         family_name=CASE WHEN $7::boolean THEN $8 ELSE family_name END,
         email=CASE WHEN $9::boolean THEN $10 ELSE email END,
         identifier=CASE WHEN $11::boolean THEN $12 ELSE identifier END
       WHERE id=$1 AND deleted_at IS NULL
       RETURNING id,learner_id,display_name,given_name,family_name`,
      [
        personId,
        changes.displayName !== undefined,
        changes.displayName ?? null,
        changes.gradeLevel !== undefined,
        changes.gradeLevel ?? null,
        changes.givenName ?? null,
        changes.familyName !== undefined,
        changes.familyName ?? null,
        changes.email !== undefined,
        changes.email ?? null,
        changes.identifier !== undefined,
        changes.identifier ?? null,
      ],
    )
  ).rows[0];
  if (!person) throw new SchoolError(404, "student_not_found");
  if (person.learner_id) {
    await client.query("UPDATE amp_learners SET name=$2 WHERE id=$1", [
      person.learner_id,
      learnerNameFrom(person),
    ]);
    if (changes.gradeLevel !== undefined && changes.gradeLevel !== null)
      await client.query(
        `UPDATE amp_learners l SET birth_year=$2 WHERE l.id=$1 AND l.picture_identity IS NULL
         AND NOT EXISTS(SELECT 1 FROM amp_attempts a WHERE a.learner_id=l.id)`,
        [person.learner_id, birthYearForGrade(changes.gradeLevel)],
      );
  }
  return person;
}

export async function updateStudent(
  repo: SchoolRepository,
  orgId: string,
  personId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const input = updateStudentSchema.parse(raw);
  return repo.transaction(async (client) => {
    await writeStudent(client, personId, input);
    await recordEvent(client, {
      orgId,
      actorPersonId,
      action: "student.updated",
      targetKind: "person",
      targetId: personId,
      detail: {
        after: {
          ...(input.gradeLevel !== undefined
            ? { gradeLevel: input.gradeLevel }
            : {}),
          ...(input.displayName !== undefined ? { renamed: true } : {}),
        },
      },
    });
    return { id: personId };
  });
}

/** Which classes a student is in: the transfer. Leaving ends the enrollment
 * today and keeps its history; evidence stays on the learner, so nothing is
 * lost in the move. */
export async function setStudentClasses(
  repo: SchoolRepository,
  orgId: string,
  personId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const { classIds } = setClassesSchema.parse(raw);
  return repo.transaction(async (client) => {
    const org = await repo.org(client, orgId);
    const today = await repo.today(client, org.timezone);
    const ended = await client.query(
      `UPDATE amp_enrollments e SET end_on=GREATEST(e.begin_on,$2::date) FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.person_id=$1 AND e.role='student' AND (e.end_on IS NULL OR e.end_on>$2::date) AND c.id=e.class_id
         AND o.path @> ARRAY[$3]::uuid[] AND NOT (e.class_id=ANY($4::uuid[]))`,
      [personId, today, org.id, classIds],
    );
    for (const classId of classIds) {
      const home = await repo.classIn(client, classId, org.path);
      await repo.enroll(client, home.id, personId, "student", today);
    }
    await recordEvent(client, {
      orgId: org.id,
      actorPersonId,
      action: "student.transferred",
      targetKind: "person",
      targetId: personId,
      detail: { after: { classIds, left: ended.rowCount } },
    });
    return { classIds };
  });
}

/** Removing a student frees their seat and deletes their learning data through
 * the same path a family deletion takes. The tombstone keeps only what maps a
 * final grade to the school's own record. */
export async function removeStudent(
  repo: SchoolRepository,
  orgId: string,
  personId: string,
  actorPersonId: string | null,
) {
  const families = new FamilyRepository(repo.pool);
  const accountId = schoolAccountId(personId);
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
    const person = (
      await client.query(
        "SELECT id,learner_id FROM amp_people WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
        [personId],
      )
    ).rows[0];
    if (!person) throw new SchoolError(404, "student_not_found");
    await client.query(
      `UPDATE amp_grants g SET status='revoked' FROM amp_seats s
       WHERE s.person_id=$1 AND s.released_at IS NULL AND g.id=s.grant_id`,
      [personId],
    );
    await client.query(
      "UPDATE amp_seats SET released_at=now() WHERE person_id=$1 AND released_at IS NULL",
      [personId],
    );
    const org = await repo.org(client, orgId);
    const today = await repo.today(client, org.timezone);
    await client.query(
      `UPDATE amp_org_roles SET end_on=GREATEST(begin_on,$2::date) WHERE person_id=$1 AND end_on IS NULL`,
      [personId, today],
    );
    await client.query(
      `UPDATE amp_enrollments SET end_on=GREATEST(begin_on,$2::date) WHERE person_id=$1 AND (end_on IS NULL OR end_on>$2::date)`,
      [personId, today],
    );
    await client.query(
      "UPDATE amp_student_sessions SET revoked_at=now() WHERE person_id=$1 AND revoked_at IS NULL",
      [personId],
    );
    await client.query(
      "UPDATE amp_person_credentials SET revoked_at=now() WHERE person_id=$1 AND revoked_at IS NULL",
      [personId],
    );
    if (person.learner_id)
      await families.deleteLearningInside(client, accountId, person.learner_id);
    // Whichever way the learner row went, the person is scrubbed.
    await client.query(
      `UPDATE amp_people SET deleted_at=COALESCE(deleted_at,now()),given_name='Removed',
         family_name=NULL,display_name=NULL,email=NULL WHERE id=$1`,
      [personId],
    );
    await recordEvent(client, {
      orgId: org.id,
      actorPersonId,
      action: "student.removed",
      targetKind: "person",
      targetId: personId,
    });
    return { removed: true };
  });
}

/** A class's name, course, and grading period; choosing a period the calendar
 * doesn't have yet adds it, so the choice always works. */
export async function updateClass(
  repo: SchoolRepository,
  classId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const input = updateClassSchema.parse(raw);
  return repo.transaction(async (client) => {
    const found = (
      await client.query(
        `UPDATE amp_classes SET name=COALESCE($2,name),grading_kind=COALESCE($3,grading_kind),course_bands=COALESCE($4,course_bands)
         WHERE id=$1 AND archived_at IS NULL RETURNING org_id`,
        [
          classId,
          input.name ?? null,
          input.gradingKind ?? null,
          input.courseBands ?? null,
        ],
      )
    ).rows[0];
    if (!found) throw new SchoolError(404, "class_not_found");
    if (input.gradingKind)
      await ensureDivision(client, repo, found.org_id, input.gradingKind);
    await recordEvent(client, {
      orgId: found.org_id,
      actorPersonId,
      action: "class.updated",
      targetKind: "class",
      targetId: classId,
      detail: {
        after: {
          gradingKind: input.gradingKind ?? null,
          courseBands: input.courseBands ?? null,
        },
      },
    });
    return { id: classId };
  });
}

/** Seats and dates at this org and above, and who's waiting for a seat. */
export async function licenseView(repo: SchoolRepository, orgId: string) {
  const org = (
    await repo.pool.query("SELECT path FROM amp_orgs WHERE id=$1", [orgId])
  ).rows[0];
  if (!org) throw new SchoolError(404, "org_not_found");
  const licenses = (
    await repo.pool.query(
      `SELECT l.id,l.seats,l.starts_at,l.ends_at,l.reference,
         (SELECT count(*)::int FROM amp_seats s WHERE s.license_id=l.id AND s.released_at IS NULL) AS used
       FROM amp_school_licenses l WHERE l.org_id=ANY($1::uuid[]) AND l.status='active'
         AND l.starts_at<=now() AND l.ends_at>now()
       ORDER BY l.ends_at DESC,l.id`,
      [org.path],
    )
  ).rows;
  const latest = (
    await repo.pool.query(
      `SELECT l.id,l.starts_at,l.ends_at,l.reference FROM amp_school_licenses l
       WHERE l.org_id=ANY($1::uuid[]) ORDER BY l.ends_at DESC,l.id LIMIT 1`,
      [org.path],
    )
  ).rows[0];
  const waiting = (
    await repo.pool.query(
      `SELECT count(*)::int AS waiting FROM amp_people p
       WHERE p.tenant_id=$1 AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
         AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
           WHERE r.person_id=p.id AND r.role='student' AND o.path @> ARRAY[$2]::uuid[] AND ${activeToday("r", "o")})
         AND NOT EXISTS(SELECT 1 FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
           WHERE s.person_id=p.id AND s.released_at IS NULL AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now())`,
      [org.path[0], orgId],
    )
  ).rows[0].waiting as number;
  const seats = licenses.reduce((sum, row) => sum + row.seats, 0);
  const used = licenses.reduce((sum, row) => sum + row.used, 0);
  const shown = licenses[0] ?? latest;
  return {
    seats,
    used,
    available: Math.max(0, seats - used),
    waiting,
    license: shown
      ? {
          id: shown.id,
          startsAt: shown.starts_at.toISOString(),
          endsAt: shown.ends_at.toISOString(),
          reference: shown.reference === "Evaluation" ? null : shown.reference,
          evaluation: shown.reference === "Evaluation",
        }
      : null,
  };
}
