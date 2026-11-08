import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { completedGrade } from "../learning/frontier.js";
import { recordEvent } from "../schools/events.js";
import {
  generateStudentToken,
  hashStudentToken,
  schoolAccountId,
  studentSessionExpiry,
} from "../schools/principal.js";
import { generateHandle, SchoolRepository } from "../schools/repository.js";
import { FamilyError } from "./contracts.js";

/** The family's class, as the parent's `/me` names it. */
export type FamilyClass = {
  orgId: string;
  classId: string;
  className: string;
  /** Children were here before families had classes, and the parent hasn't
   * dismissed the line about how they sign in now. */
  notice: boolean;
};

/** A family's days, until the parent sets their own on the calendar. */
const FAMILY_TIMEZONE = "America/New_York";
const isParentAccount = (accountId: string) =>
  !accountId.startsWith("school:") && !accountId.startsWith("trial:");
/** The grade a child of this birth year is in now; K is 0. */
const gradeFor = (birthYear: number | null) =>
  birthYear === null
    ? null
    : Math.min(13, Math.max(0, completedGrade(birthYear) + 1));

type Database = Pick<PoolClient, "query">;
type FamilyRow = {
  org_id: string;
  class_id: string;
  class_name: string;
  timezone: string;
  path: string[];
  session_ended: boolean;
  converted_at: Date | null;
  notice_dismissed_at: Date | null;
};
const FAMILY = `SELECT f.org_id,f.class_id,c.name AS class_name,o.timezone,o.path,
    s.ends_on<(now() AT TIME ZONE o.timezone)::date AS session_ended,
    f.converted_at,f.notice_dismissed_at
  FROM amp_families f JOIN amp_orgs o ON o.id=f.org_id
  JOIN amp_classes c ON c.id=f.class_id
  JOIN amp_academic_sessions s ON s.id=c.session_id
  WHERE f.account_id=$1`;
const view = (row: FamilyRow): FamilyClass => ({
  orgId: row.org_id,
  classId: row.class_id,
  className: row.class_name,
  notice: row.converted_at !== null && row.notice_dismissed_at === null,
});

/** A database before migration 0095 has no families, and reads as none. */
async function familiesExist(db: Database) {
  return !!(await db.query("SELECT to_regclass('amp_families') AS relation"))
    .rows[0].relation;
}

/**
 * Families are classes (docs/families.md). Gives a parent account with live
 * child learners its family org and class, with every child a student of it,
 * and returns that class; null for an account with no child learner (adult
 * learners never count). Idempotent: run it as often as you like.
 *
 * Each child keeps the learner the parent's account owns. This only adds
 * roster rows that point at it (person with `learner_id`, student role,
 * enrollment), so evidence, grants, consent and deletion are untouched.
 *
 * The caller holds the account's learning lock, shared or exclusive, in its
 * transaction; this takes the family's own lock after it, so two first
 * children created at once still make one family. `converting` says these
 * children were here before families had classes.
 */
export async function ensureFamilyClass(
  client: PoolClient,
  pool: Pool,
  accountId: string,
  { converting }: { converting: boolean },
): Promise<(FamilyClass & { created: boolean; enrolled: number }) | null> {
  if (!isParentAccount(accountId) || !(await familiesExist(client)))
    return null;
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `family-class:${accountId}`,
  ]);
  const children = (
    await client.query<{
      id: string;
      name: string;
      birth_year: number | null;
      person_id: string | null;
      tenant_id: string | null;
      given_name: string | null;
      grade_level: number | null;
    }>(
      `SELECT l.id,l.name,l.birth_year,p.id AS person_id,p.tenant_id,p.given_name,p.grade_level
       FROM amp_learners l LEFT JOIN amp_people p ON p.learner_id=l.id
       WHERE l.account_id=$1 AND l.deleted_at IS NULL AND NOT l.adult
       ORDER BY l.created_at,l.id`,
      [accountId],
    )
  ).rows;
  const schools = new SchoolRepository(pool);
  let family = (await client.query<FamilyRow>(FAMILY, [accountId])).rows[0];
  const created = !family;
  if (!family) {
    if (!children.length) return null;
    await createFamily(client, schools, accountId, converting);
    family = (await client.query<FamilyRow>(FAMILY, [accountId])).rows[0]!;
  }
  let enrolled = 0;
  // A family's class follows the year in use, so a code that worked in June
  // still works in July. Its past terms keep their own grades.
  if (family.session_ended) {
    const sessionId = await schools.yearSession(client, {
      id: family.org_id,
      path: family.path,
      timezone: family.timezone,
    });
    await client.query("UPDATE amp_classes SET session_id=$2 WHERE id=$1", [
      family.class_id,
      sessionId,
    ]);
  }
  let today: string | null = null;
  for (const child of children) {
    const name = child.name.trim().slice(0, 100) || "Student";
    const grade = gradeFor(child.birth_year);
    if (child.person_id) {
      // Rostered somewhere else: moving them is an operator's procedure.
      if (child.tenant_id !== family.org_id) continue;
      // The family's own names and birth years are the roster's.
      if (child.given_name !== name || child.grade_level !== grade)
        await client.query(
          "UPDATE amp_people SET given_name=$2,grade_level=$3 WHERE id=$1",
          [child.person_id, name, grade],
        );
      continue;
    }
    today ??= await schools.today(client, family.timezone);
    const personId = randomUUID();
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,handle,grade_level,learner_id,timezone)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        personId,
        family.org_id,
        name,
        generateHandle(),
        grade,
        child.id,
        family.timezone,
      ],
    );
    await client.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'student',$4)
       ON CONFLICT (person_id,org_id,role) WHERE end_on IS NULL DO NOTHING`,
      [randomUUID(), personId, family.org_id, today],
    );
    await schools.enroll(client, family.class_id, personId, "student", today);
    await recordEvent(client, {
      orgId: family.org_id,
      action: "student.added",
      targetKind: "person",
      targetId: personId,
      detail: { after: { classId: family.class_id, family: true } },
    });
    enrolled++;
  }
  return { ...view(family), created, enrolled };
}

/** The parent's own name, for their class and their line on its map. */
async function parentName(client: Database, accountId: string) {
  const table = await client.query(
    "SELECT to_regclass('amp_auth_users') AS relation",
  );
  const raw = accountId.startsWith("amp|") && table.rows[0].relation
    ? ((
        await client.query("SELECT name FROM amp_auth_users WHERE id=$1", [
          accountId.slice(4),
        ])
      ).rows[0]?.name as string | undefined)
    : undefined;
  const words = (raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const given = words.length ? words[0]!.slice(0, 60) : null;
  const family =
    words.length > 1 ? words.slice(1).join(" ").slice(0, 100) : null;
  return { given, family };
}

async function createFamily(
  client: PoolClient,
  schools: SchoolRepository,
  accountId: string,
  converting: boolean,
) {
  const { given, family } = await parentName(client, accountId);
  const orgId = randomUUID();
  await client.query(
    `INSERT INTO amp_orgs(id,kind,path,name,timezone,solo,setup_pending,created_by)
     VALUES($1,'family',$2,$3,$4,true,false,$5)`,
    [
      orgId,
      [orgId],
      given ? `${given}’s family` : "Our family",
      FAMILY_TIMEZONE,
      accountId,
    ],
  );
  await recordEvent(client, {
    orgId,
    action: "org.created",
    targetKind: "org",
    targetId: orgId,
    detail: { after: { kind: "family" } },
  });
  // The parent: admin and teacher of the family, and teacher of its class.
  const personId = randomUUID();
  await client.query(
    `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,account_id,timezone)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      personId,
      orgId,
      given ?? "Parent",
      family,
      generateHandle(),
      accountId,
      FAMILY_TIMEZONE,
    ],
  );
  const today = await schools.today(client, FAMILY_TIMEZONE);
  for (const role of ["admin", "teacher"])
    await client.query(
      "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), personId, orgId, role, today],
    );
  // No course band: each child works at their own level.
  const created = await schools.createClassIn(
    client,
    orgId,
    {
      name: given ? `${given}’s class` : "Our class",
      gradingKind: "year",
    },
    personId,
  );
  await schools.enroll(client, created.id, personId, "teacher", today);
  await client.query(
    "INSERT INTO amp_families(account_id,org_id,class_id,converted_at) VALUES($1,$2,$3,$4)",
    [accountId, orgId, created.id, converting ? new Date() : null],
  );
}

/** The family's class, read without changing anything; null without one. */
export async function familyClassOf(
  db: Database,
  accountId: string,
): Promise<FamilyClass | null> {
  if (!isParentAccount(accountId) || !(await familiesExist(db))) return null;
  const row = (await db.query<FamilyRow>(FAMILY, [accountId])).rows[0];
  return row ? view(row) : null;
}

export async function dismissFamilyNotice(db: Database, accountId: string) {
  await db.query(
    "UPDATE amp_families SET notice_dismissed_at=now() WHERE account_id=$1 AND notice_dismissed_at IS NULL",
    [accountId],
  );
}

/**
 * "Let Maya practice here": a student session for one child of this account,
 * on the parent's own device, in shared mode. The caller holds the account's
 * family transaction. Only a child who can practice now gets one, so the
 * button never leads to a refusal.
 */
export async function practiceHere(
  client: PoolClient,
  pool: Pool,
  accountId: string,
  learnerId: string,
  canPractice: boolean,
) {
  const family = await ensureFamilyClass(client, pool, accountId, {
    converting: true,
  });
  const person = family
    ? ((
        await client.query<{ id: string }>(
          `SELECT p.id FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id
           WHERE p.learner_id=$1 AND p.tenant_id=$2 AND p.deleted_at IS NULL
             AND l.account_id=$3 AND l.deleted_at IS NULL AND NOT l.adult`,
          [learnerId, family.orgId, accountId],
        )
      ).rows[0] ?? null)
    : null;
  if (!person) throw new FamilyError(404, "learner_not_found");
  if (!canPractice) throw new FamilyError(409, "learner_cannot_practice");
  const token = generateStudentToken();
  const expiresAt = studentSessionExpiry("shared");
  await client.query(
    "INSERT INTO amp_student_sessions(id,token_hash,person_id,mode,expires_at) VALUES($1,$2,$3,'shared',$4)",
    [randomUUID(), hashStudentToken(token), person.id, expiresAt],
  );
  return {
    token,
    // The browser keys every student's sign-in by their person; the server
    // acts as the learner's owner (`resolveStudentSession`).
    accountId: schoolAccountId(person.id),
    mode: "shared" as const,
    expiresAt: expiresAt.toISOString(),
  };
}
