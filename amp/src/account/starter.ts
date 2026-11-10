import type { PoolClient } from "pg";
import { z } from "zod";
import { ownBirthYear, startAdultPractice } from "./adult.js";
import { FamilyError } from "../family/contracts.js";
import { ensureFamilyClass, familyClassOf } from "../family/family-class.js";
import type { FamilyRepository } from "../family/repository.js";
import { MAX_FAMILY_LEARNERS } from "../learning/free-allowance.js";
import { adultStarts } from "../learning/starting-point.js";
import { timezone } from "../schools/contracts.js";
import { SchoolRepository } from "../schools/repository.js";
import { insertFamilyChild } from "../server/learner-label.js";
import { optionalChildName, optionalNickname } from "../learning/nickname.js";

/* "What brings you to AMP?" (docs/product-model.md). One answer, one call, one
   transaction: it creates the place that answer needs and nothing else, and
   says where that place opens. A parent names their own children (or leaves
   them "Child 1", "Child 2"); a tutor gives each student a nickname or
   initials, and the student's own parent names them. Asking again for a place the
   account already has opens it instead of making a second one, so a retried
   request never duplicates anything. */

/* A teacher or a school starts with a demo instead (POST /school/demo):
   nothing real exists until an agreement or a purchase. */
export const starterChoices = ["myself", "parent", "tutor"] as const;
export type StarterChoice = (typeof starterChoices)[number];
export const MAX_STARTER_CHILDREN = 6;
export const MAX_STARTER_STUDENTS = 30;

/** A school-age birth year: the starter's picker offers ages 4 to 19. */
const childBirthYear = z
  .number()
  .int()
  .refine((year) => {
    const now = new Date().getUTCFullYear();
    return year >= now - 21 && year <= now - 2;
  }, "A child’s birth year");
/** A parent's own child: the name the parent enters, or blank. */
const child = z.strictObject({
  birthYear: childBirthYear,
  name: optionalChildName,
});
/** A tutor's student from another family: a nickname or initials, or blank. */
const student = z.strictObject({
  birthYear: childBirthYear,
  nickname: optionalNickname,
});

export const starterSchema = z.discriminatedUnion("as", [
  // A school-age birth year sets where their own practice starts; an adult
  // chooses the start instead (`pastSchoolAge`). Both optional for a screen
  // loaded before either was asked.
  z.strictObject({
    as: z.literal("myself"),
    timezone,
    birthYear: ownBirthYear.optional(),
    start: z.enum(adultStarts).optional(),
  }),
  z.strictObject({
    as: z.literal("parent"),
    children: z.array(child).min(1).max(MAX_STARTER_CHILDREN),
  }),
  z.strictObject({
    as: z.literal("tutor"),
    students: z.array(student).max(MAX_STARTER_STUDENTS),
  }),
]);
export type StarterInput = z.infer<typeof starterSchema>;
/** Where the new place opens, without the leading slash, and the learner
 * who practices first there (the adult's own, or the family's first child). */
export type StarterResult = {
  home: string;
  learnerId?: string;
  /** Children or students this answer added; 0 when the place already had
   * as many. */
  added?: number;
};

const classToday = (orgId: string, classId: string) =>
  `school/${orgId}/classes/${classId}/today`;

export async function startPlace(
  families: FamilyRepository,
  accountId: string,
  raw: unknown,
): Promise<StarterResult> {
  if (accountId.startsWith("school:") || accountId.startsWith("trial:"))
    throw new FamilyError(403, "starter_unavailable");
  const input = starterSchema.parse(raw);
  // The adult's own learner keeps its own transaction and one-per-account rule.
  if (input.as === "myself") {
    const { learnerId } = await startAdultPractice(families, accountId, {
      timezone: input.timezone,
      birthYear: input.birthYear,
      start: input.start,
    });
    return { home: "me", learnerId };
  }
  return families.transaction(accountId, async (client) => {
    if (input.as === "parent")
      return startFamily(client, families, accountId, input.children);
    return startTutor(client, families, accountId, input.students);
  });
}

/** The family class with that many children in all: the answer to "How many
 * children?" is the family's count, so asking again adds only the children
 * missing from it, with the birth years given for them, and a retry of the
 * same answer adds none (`added: 0`). */
async function startFamily(
  client: PoolClient,
  families: FamilyRepository,
  accountId: string,
  children: { birthYear: number; name?: string }[],
): Promise<StarterResult> {
  const live = async () =>
    (
      await client.query<{ id: string }>(
        "SELECT id FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL AND NOT adult ORDER BY created_at,id",
        [accountId],
      )
    ).rows;
  const existing = (await live()).length;
  const missing = children.slice(existing);
  if (missing.length) {
    // Withdrawal stops collection, named or not (docs/families.md).
    const withdrawn = await client.query(
      "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND withdrawn_at IS NOT NULL",
      [accountId],
    );
    if (withdrawn.rowCount) throw new FamilyError(403, "consent_withdrawn");
    const all = (
      await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL",
        [accountId],
      )
    ).rows[0]!.n;
    if (all + missing.length > MAX_FAMILY_LEARNERS)
      throw new FamilyError(403, "too_many_learners");
    for (const { birthYear, name } of missing)
      await insertFamilyChild(client, accountId, birthYear, name);
  }
  // The same child a retry would name: one order, read after the inserts.
  const first = (await live())[0]?.id;
  const family = await ensureFamilyClass(client, families.pool, accountId, {
    converting: false,
  });
  if (!family) throw new FamilyError(409, "family_class_required");
  return {
    home: classToday(family.orgId, family.classId),
    learnerId: first,
    added: missing.length,
  };
}

/** A tutor's or co-op's class: the account's family class, with that many
 * students in all, the school way (owned by their roster person), each with
 * the tutor's nickname for them or "Student 3", so each one's own parent can
 * name them by an approval link. Asking again adds
 * only the students missing from that count; a retry adds none. */
async function startTutor(
  client: PoolClient,
  families: FamilyRepository,
  accountId: string,
  students: { birthYear: number; nickname?: string }[],
): Promise<StarterResult> {
  const family =
    (await familyClassOf(client, accountId)) ??
    (await ensureFamilyClass(client, families.pool, accountId, {
      converting: false,
      withoutChildren: true,
    }));
  if (!family) throw new FamilyError(409, "family_class_required");
  // The class's own students: those the class holds for another family
  // (a person's learner), not the account's own children.
  const existing = (
    await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM amp_enrollments e
       JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
       JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL AND l.account_id='school:'||p.id
       WHERE e.class_id=$1 AND e.role='student' AND e.end_on IS NULL`,
      [family.classId],
    )
  ).rows[0]!.n;
  const missing = students.slice(existing);
  const schools = new SchoolRepository(families.pool);
  const teacher = await teacherPerson(client, family.orgId, accountId);
  for (const { birthYear, nickname } of missing)
    await schools.provisionStudentIn(
      client,
      family.orgId,
      { birthYear, nickname, classId: family.classId },
      teacher,
    );
  return {
    home: classToday(family.orgId, family.classId),
    added: missing.length,
  };
}

/** One more student in a tutor's class, after the starter: the tutor's
 * nickname for them (or "Student 4") and a birth year, owned by their roster
 * person the school way, so their own parent names them by a link. */
export async function addClassStudent(
  families: FamilyRepository,
  accountId: string,
  raw: unknown,
) {
  if (accountId.startsWith("school:") || accountId.startsWith("trial:"))
    throw new FamilyError(403, "starter_unavailable");
  const input = student.parse(raw);
  return families.transaction(accountId, async (client) => {
    const family = await familyClassOf(client, accountId);
    if (!family) throw new FamilyError(409, "family_class_required");
    const schools = new SchoolRepository(families.pool);
    const added = await schools.provisionStudentIn(
      client,
      family.orgId,
      { ...input, classId: family.classId },
      await teacherPerson(client, family.orgId, accountId),
    );
    const { name } = (
      await client.query<{ name: string }>(
        "SELECT name FROM amp_learners WHERE id=$1",
        [added.learnerId],
      )
    ).rows[0]!;
    return { personId: added.personId, learnerId: added.learnerId, name };
  });
}

/** This account's person in the org, as the actor of what the starter adds. */
async function teacherPerson(
  client: PoolClient,
  orgId: string,
  accountId: string,
) {
  return (
    (
      await client.query<{ id: string }>(
        "SELECT id FROM amp_people WHERE tenant_id=$1 AND account_id=$2 AND deleted_at IS NULL",
        [orgId, accountId],
      )
    ).rows[0]?.id ?? null
  );
}
