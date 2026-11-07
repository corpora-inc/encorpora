import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { SchoolError } from "./contracts.js";
import { levels, perDay } from "./evidence.js";
import { recordEvent } from "./events.js";
import { csvCell } from "./exports.js";
import { activeToday } from "./principal.js";
import type { SchoolRepository } from "./repository.js";
import type { ParentView, ShareState } from "./share-contracts.js";
import {
  classContext,
  countedObjectives,
  courseBand,
  currentTerm,
  objectivesBySpan,
  PERSON_FIRST,
  PERSON_NAME,
  skillStrandOf,
  skillTitleOf,
  termsFor,
} from "./term-grades.js";
import { strandLabel } from "./teacher-reads.js";

/** A link lasts about a school year, as a printed card does. */
const SHARE_LIFETIME_DAYS = 366;
const ROSTER_LIMIT = 1000;
const RECENT_OBJECTIVES = 8;
/** Keys for a family link: derived, so nothing secret is stored, and a teacher
 * can copy the same link again for as long as it lasts. */
export type ShareKeys = { secret: string; origin: string };

const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const shareToken = (keys: ShareKeys, credentialId: string) =>
  createHmac("sha256", keys.secret)
    .update(`school-share-link:${credentialId}`)
    .digest("base64url");
const shareUrl = (keys: ShareKeys, credentialId: string) =>
  `${keys.origin}/p#${shareToken(keys, credentialId)}`;

const LIVE_SHARE = `k.kind='share' AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at>now())`;
type Database = Pick<PoolClient, "query">;
type StudentTarget = {
  personId: string;
  orgId: string;
  classIds: readonly string[];
};
type ClassTarget = { classId: string; orgId: string };

/** One credential change for this person at a time, as sign-in does. */
const lockCredentials = (client: Database, personId: string) =>
  client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `school-credential:${personId}`,
  ]);
async function liveLink(db: Database, keys: ShareKeys, personId: string) {
  const row = (
    await db.query(
      `SELECT k.id,k.lookup_hash,k.created_at,k.expires_at FROM amp_person_credentials k
       WHERE k.person_id=$1 AND ${LIVE_SHARE} ORDER BY k.created_at DESC,k.id LIMIT 1`,
      [personId],
    )
  ).rows[0];
  // A link made under a replaced server key no longer opens, so it isn't one.
  if (!row || row.lookup_hash !== sha256(shareToken(keys, row.id))) return null;
  return {
    url: shareUrl(keys, row.id),
    createdAt: (row.created_at as Date).toISOString(),
    expiresAt: (row.expires_at as Date | null)?.toISOString() ?? null,
  };
}
async function insertLink(client: Database, keys: ShareKeys, personId: string) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO amp_person_credentials(id,person_id,kind,lookup_hash,expires_at)
     VALUES($1,$2,'share',$3,now()+interval '${SHARE_LIFETIME_DAYS} days')`,
    [id, personId, sha256(shareToken(keys, id))],
  );
  return id;
}
const revokeLive = (client: Database, personId: string) =>
  client.query(
    `UPDATE amp_person_credentials SET revoked_at=now()
     WHERE person_id=$1 AND kind='share' AND revoked_at IS NULL`,
    [personId],
  );

export async function shareState(
  pool: Pool,
  keys: ShareKeys,
  target: StudentTarget,
  canManage: boolean,
): Promise<ShareState> {
  return {
    canManage,
    available: target.classIds.length > 0,
    link: canManage ? await liveLink(pool, keys, target.personId) : null,
  };
}

/** The student's link: the one already out there, or a new one. */
export async function createShare(
  repository: SchoolRepository,
  keys: ShareKeys,
  target: StudentTarget,
  actorPersonId: string | null,
): Promise<ShareState> {
  if (!target.classIds.length) throw new SchoolError(409, "no_active_class");
  return repository.transaction(async (client) => {
    await lockCredentials(client, target.personId);
    let link = await liveLink(client, keys, target.personId);
    if (!link) {
      await revokeLive(client, target.personId);
      await insertLink(client, keys, target.personId);
      await recordEvent(client, {
        orgId: target.orgId,
        actorPersonId,
        action: "student.share-created",
        targetKind: "person",
        targetId: target.personId,
      });
      link = await liveLink(client, keys, target.personId);
    }
    return { canManage: true, available: true, link };
  });
}

export async function revokeShare(
  repository: SchoolRepository,
  target: StudentTarget,
  actorPersonId: string | null,
): Promise<ShareState> {
  return repository.transaction(async (client) => {
    await lockCredentials(client, target.personId);
    const revoked = await revokeLive(client, target.personId);
    if (revoked.rowCount)
      await recordEvent(client, {
        orgId: target.orgId,
        actorPersonId,
        action: "student.share-revoked",
        targetKind: "person",
        targetId: target.personId,
      });
    return {
      canManage: true,
      available: target.classIds.length > 0,
      link: null,
    };
  });
}

/** Everyone in the class gets a fresh link, for the school's own mail system.
 * Every link it replaces stops working, and each change is logged. */
export async function rotateClassShares(
  repository: SchoolRepository,
  keys: ShareKeys,
  target: ClassTarget,
  actorPersonId: string | null,
): Promise<{ name: string; url: string }[]> {
  return repository.transaction(async (client) => {
    const { rows: students } = await client.query(
      `SELECT p.id,${PERSON_NAME} AS name FROM amp_enrollments e
       JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
       JOIN amp_people p ON p.id=e.person_id
       WHERE e.class_id=$1 AND e.role='student' AND c.archived_at IS NULL
         AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL AND ${activeToday("e", "o")}
       ORDER BY lower(${PERSON_NAME}),p.id LIMIT ${ROSTER_LIMIT}`,
      [target.classId],
    );
    const links: { name: string; url: string }[] = [];
    for (const student of students) {
      await lockCredentials(client, student.id);
      const replaced = await revokeLive(client, student.id);
      const id = await insertLink(client, keys, student.id);
      await recordEvent(client, {
        orgId: target.orgId,
        actorPersonId,
        action: replaced.rowCount
          ? "student.share-rotated"
          : "student.share-created",
        targetKind: "person",
        targetId: student.id,
        detail: { after: { classId: target.classId } },
      });
      links.push({ name: student.name, url: shareUrl(keys, id) });
    }
    return links;
  });
}

const BOM = "﻿";
export const parentLinksCsv = (
  links: readonly { name: string; url: string }[],
) =>
  `${BOM}Student,Link\r\n${links
    .map(({ name, url }) => `${csvCell(name)},${csvCell(url)}\r\n`)
    .join("")}`;

/** One answer for a link that was never real, was revoked, has expired, or
 * belongs to a student who has left: the family needs a new one either way. */
const ended = () => new SchoolError(410, "link_ended");
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** What a family's link shows. It reads one student and returns nothing about
 * anyone else; levels show whatever the student's own setting, because the
 * reader isn't the student. */
export async function parentView(
  pool: Pool,
  token: string,
): Promise<ParentView> {
  if (!SHARE_TOKEN.test(token)) throw ended();
  const person = (
    await pool.query(
      `SELECT p.id,p.learner_id AS "learnerId",${PERSON_NAME} AS name,${PERSON_FIRST} AS first,
         p.grade_level AS "gradeLevel",p.identifier,p.timezone
       FROM amp_person_credentials k JOIN amp_people p ON p.id=k.person_id
       WHERE k.lookup_hash=$1 AND ${LIVE_SHARE}
         AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL`,
      [sha256(token)],
    )
  ).rows[0];
  if (!person) throw ended();
  const school = (
    await pool.query(
      `SELECT o.name FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.role='student' AND ${activeToday("r", "o")}
       ORDER BY r.begin_on DESC,o.id LIMIT 1`,
      [person.id],
    )
  ).rows[0];
  const { rows: enrolled } = await pool.query(
    `SELECT c.id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
     JOIN amp_orgs o ON o.id=c.org_id
     WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}
     ORDER BY lower(c.name),c.id`,
    [person.id],
  );
  if (!school || !enrolled.length) throw ended();
  const contexts = await Promise.all(
    enrolled.map(({ id }) => classContext(pool, id)),
  );
  const today = contexts[0]!.today;
  const roster = [{ personId: person.id, learnerId: person.learnerId }];
  const [stored, terms, grades] = await Promise.all([
    levels(pool, roster),
    Promise.all(
      contexts.map(async (context) =>
        currentTerm(await termsFor(pool, context), context.today),
      ),
    ),
    pool.query(
      `SELECT c.name AS "className",s.name AS "termName",g.final_value AS final
       FROM amp_term_grades g JOIN amp_classes c ON c.id=g.class_id
       JOIN amp_academic_sessions s ON s.id=g.session_id
       WHERE g.person_id=$1 AND g.final_value IS NOT NULL
       ORDER BY s.starts_on DESC,lower(c.name),c.id`,
      [person.id],
    ),
  ]);
  const level = stored[0] ?? null;
  // A student in two classes on different calendars: the term that began first.
  const term = terms
    .filter((entry) => entry !== null)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  const lastYear = shift(today, -365);
  const gained = countedObjectives(
    (
      await objectivesBySpan(pool, [
        {
          id: person.id,
          learnerId: person.learnerId,
          name: person.name,
          first: person.first,
          identifier: person.identifier,
          gradeLevel: person.gradeLevel,
          from: lastYear,
          to: today,
          beginOn: lastYear,
          endOn: null,
        },
      ])
    ).get(person.id) ?? [],
    level ? level.overall.level - 1 : null,
  );
  const days = term
    ? await perDay(pool, roster, { from: term.startsOn, to: today })
    : [];
  const course = contexts
    .map((context) => courseBand(context.courseBands))
    .find(Boolean);
  return {
    student: { name: person.name, first: person.first },
    schoolName: school.name,
    classes: contexts.map((context) => context.name),
    level: level
      ? {
          overall: { level: level.overall.level, sd: level.overall.sd },
          strands: Object.fromEntries(
            Object.entries(level.strands).map(([id, { level: at, sd }]) => [
              id,
              { level: at, sd },
            ]),
          ),
        }
      : null,
    reference: course
      ? { from: course.from, to: course.to }
      : person.gradeLevel === null
        ? null
        : { from: person.gradeLevel - 0.5, to: person.gradeLevel + 0.5 },
    strands: level
      ? Object.entries(level.strands)
          .sort(
            (a, b) => b[1].answered - a[1].answered || a[0].localeCompare(b[0]),
          )
          .map(([id]) => ({ id, label: strandLabel(id) }))
      : [],
    term: term
      ? {
          name: term.name,
          startsOn: term.startsOn,
          activeMinutes: Math.round(
            days.reduce((sum, day) => sum + day.activeMinutes, 0),
          ),
          objectives: gained.filter(({ day }) => day >= term.startsOn).length,
        }
      : null,
    objectives: gained.slice(0, RECENT_OBJECTIVES).map(({ skillId, day }) => ({
      title: skillTitleOf(skillId),
      strand: skillStrandOf(skillId),
      day,
    })),
    grades: grades.rows,
  };
}
