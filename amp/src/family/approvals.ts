import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  learningConsentActive,
  parentAddressConfirmed,
} from "../server/account-access.js";
import { coverWithFamilyGift } from "../access-grants/repository.js";
import { recordEvent } from "../schools/events.js";
import { INVITE_DAYS } from "../schools/license.js";
import { generateHandle, SchoolRepository } from "../schools/repository.js";
import {
  familyHasLearnerRoom,
  freeAllowance,
} from "../learning/free-allowance.js";
import { RETENTION, RETENTION_BATCH } from "../privacy/retention-periods.js";
import { FamilyError } from "./contracts.js";

/* A child from another family joins a family class once their own parent
   approves (docs/families.md, step 5). For anyone who isn't a school, the
   child's parent consents. The teacher supplies only the parent's address or
   selects an existing picture identity; the parent supplies the name. */

/** Links in mail and on screen, set up by the server at startup. */
export type ApprovalKeys = { secret: string; origin: string };
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const derive = (keys: ApprovalKeys, purpose: string, id: string) =>
  createHmac("sha256", keys.secret)
    .update(`family-approval-${purpose}:${id}`)
    .digest("base64url");
/** The link a teacher can always copy: derived, so nothing secret is stored. */
const approvalToken = (keys: ApprovalKeys, id: string) =>
  derive(keys, "link", id);
/** The mailed link's second half: only the mailbox sees it, so it shows the
 * parent can read that address. */
const approvalProof = (keys: ApprovalKeys, id: string) =>
  derive(keys, "proof", id);
const copyUrl = (keys: ApprovalKeys, id: string) =>
  `${keys.origin}/family/approve#${approvalToken(keys, id)}`;
export const mailedApprovalUrl = (keys: ApprovalKeys, id: string) =>
  `${copyUrl(keys, id)}.${approvalProof(keys, id)}`;
/** The parent's own page for this child, once they've opened the link. */
export const approvalPageUrl = (keys: ApprovalKeys, id: string) =>
  `${keys.origin}/family/approvals/${id}`;

/** New links a family may send in a day, and sends of one link. */
export const APPROVALS_PER_DAY = 20;
const SENDS_PER_LINK = 10;
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const firstName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\u0000-\u001f\u007f<>]+$/);
export const createApprovalSchema = z.strictObject({
  personId: z.uuid().optional(),
  parentEmail: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
});
export const openApprovalSchema = z.strictObject({
  token,
  proof: token.optional(),
});
export const approveSchema = z.strictObject({ name: firstName });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const approvalId = (id: string) => {
  if (!UUID.test(id)) throw new FamilyError(404, "approval_not_found");
  return id.toLowerCase();
};

/** One row of the teacher's list. The other family is the parent's address
 * the teacher typed, and nothing else of theirs. */
export type ApprovalRow = {
  id: string;
  name: string;
  status: "waiting" | "expired" | "paused" | "needs-access" | "active";
  parentEmail: string | null;
  /** Waiting: the link to copy. */
  inviteUrl: string | null;
  /** Approved: the parent's own page, where they can add access. */
  parentPageUrl: string | null;
  expiresAt: string | null;
  accessEndsAt: string | null;
};

type Database = Pick<PoolClient, "query">;
const approvalsExist = async (db: Database) =>
  !!(await db.query("SELECT to_regclass('amp_family_approvals') AS relation"))
    .rows[0].relation;
const lockFamily = (client: Database, familyAccountId: string) =>
  client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `family-class:${familyAccountId}`,
  ]);
const activeGrant = async (db: Database, learnerId: string) =>
  (
    await db.query<{ ends_at: Date }>(
      `SELECT max(ends_at) AS ends_at FROM amp_grants WHERE learner_id=$1 AND status='active'
       AND starts_at<=now() AND ends_at>now()`,
      [learnerId],
    )
  ).rows[0]?.ends_at ?? null;

async function transaction<T>(
  pool: Pool,
  lock: string | string[],
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    for (const key of [...new Set(Array.isArray(lock) ? lock : [lock])].sort())
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [key],
      );
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** The teacher's family and its class; only the family's own parent invites. */
async function familyOf(db: Database, accountId: string) {
  const row = (
    await db.query<{
      org_id: string;
      class_id: string;
      class_name: string;
      timezone: string;
    }>(
      `SELECT f.org_id,f.class_id,c.name AS class_name,o.timezone FROM amp_families f
       JOIN amp_orgs o ON o.id=f.org_id JOIN amp_classes c ON c.id=f.class_id
       WHERE f.account_id=$1`,
      [accountId],
    )
  ).rows[0];
  if (!row) throw new FamilyError(409, "family_class_required");
  return row;
}

/** "Add a child from another family": a link for that child's parent. Asking
 * again for the same unnamed student and address is the same link, good for
 * longer. A link without a student adds one new child, so a second one to the
 * same address is a sibling's, with its own link. */
export async function createApproval(
  pool: Pool,
  keys: ApprovalKeys,
  familyAccountId: string,
  raw: unknown,
) {
  const input = createApprovalSchema.parse(raw);
  return transaction(
    pool,
    `family-class:${familyAccountId}`,
    async (client) => {
      const family = await familyOf(client, familyAccountId);
      const student = input.personId
        ? (
            await client.query(
              `SELECT p.given_name FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id
       JOIN amp_enrollments e ON e.person_id=p.id AND e.class_id=$2 AND e.role='student'
       JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
       WHERE p.id=$1 AND p.deleted_at IS NULL AND l.deleted_at IS NULL AND l.name_pending
         AND l.account_id='school:'||p.id AND e.begin_on<=(now() AT TIME ZONE o.timezone)::date
         AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE o.timezone)::date)`,
              [input.personId, family.class_id],
            )
          ).rows[0]
        : null;
      if (input.personId && !student)
        throw new FamilyError(404, "unnamed_student_not_found");
      const childName = student?.given_name ?? null;
      const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000);
      const same = input.personId
        ? (
            await client.query<{ id: string }>(
              `SELECT id FROM amp_family_approvals WHERE family_account_id=$1 AND class_id=$2
         AND approved_at IS NULL AND ended_at IS NULL AND account_id IS NULL
         AND parent_email=$3 AND person_id=$4::uuid LIMIT 1`,
              [
                familyAccountId,
                family.class_id,
                input.parentEmail,
                input.personId,
              ],
            )
          ).rows[0]
        : undefined;
      if (same) {
        await client.query(
          "UPDATE amp_family_approvals SET expires_at=$2 WHERE id=$1",
          [same.id, expires],
        );
        return {
          id: same.id,
          email: input.parentEmail,
          className: family.class_name,
        };
      }
      if (
        input.personId &&
        (
          await client.query(
            "SELECT 1 FROM amp_family_approvals WHERE person_id=$1 AND approved_at IS NULL AND ended_at IS NULL",
            [input.personId],
          )
        ).rowCount
      )
        throw new FamilyError(409, "approval_pending");
      const today = (
        await client.query(
          "SELECT count(*)::int AS n FROM amp_family_approvals WHERE family_account_id=$1 AND created_at>now()-interval '1 day'",
          [familyAccountId],
        )
      ).rows[0].n as number;
      if (today >= APPROVALS_PER_DAY)
        throw new FamilyError(429, "too_many_approvals");
      const id = randomUUID();
      await client.query(
        `INSERT INTO amp_family_approvals(id,family_account_id,class_id,child_name,parent_email,lookup_hash,secret_hash,expires_at,person_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id,
          familyAccountId,
          family.class_id,
          childName,
          input.parentEmail,
          hash(approvalToken(keys, id)),
          hash(approvalProof(keys, id)),
          expires,
          input.personId ?? null,
        ],
      );
      await recordEvent(client, {
        orgId: family.org_id,
        action: "family.approval-sent",
        targetKind: "class",
        targetId: family.class_id,
      });
      return { id, email: input.parentEmail, className: family.class_name };
    },
  );
}

/** Counts a send of the mailed link; false once it has been sent enough. */
export async function countSend(pool: Pool, id: string) {
  return !!(
    await pool.query(
      `UPDATE amp_family_approvals SET sends=sends+1 WHERE id=$1 AND sends<$2
       AND approved_at IS NULL AND ended_at IS NULL RETURNING id`,
      [id, SENDS_PER_LINK],
    )
  ).rowCount;
}

/** Send again: the same link, good for another full period. */
export async function renewApproval(
  pool: Pool,
  familyAccountId: string,
  rawId: string,
) {
  const id = approvalId(rawId);
  const row = (
    await pool.query<{ parent_email: string | null; class_name: string }>(
      `UPDATE amp_family_approvals a SET expires_at=$3 FROM amp_classes c
       WHERE a.id=$1 AND a.family_account_id=$2 AND c.id=a.class_id
         AND a.approved_at IS NULL AND a.ended_at IS NULL
       RETURNING a.parent_email,c.name AS class_name`,
      [id, familyAccountId, new Date(Date.now() + INVITE_DAYS * 86_400_000)],
    )
  ).rows[0];
  if (!row) throw new FamilyError(404, "approval_not_found");
  return { id, email: row.parent_email, className: row.class_name };
}

/** Everyone the family has asked for, but not those who left: waiting on
 * their parent, approved, paused by a withdrawal, or with access. */
export async function listApprovals(
  pool: Pool,
  keys: ApprovalKeys,
  familyAccountId: string,
): Promise<ApprovalRow[]> {
  if (!(await approvalsExist(pool))) return [];
  const rows = (
    await pool.query<{
      id: string;
      child_name: string | null;
      parent_email: string | null;
      expires_at: Date;
      approved_at: Date | null;
      account_id: string | null;
      given_name: string | null;
      learner_id: string | null;
    }>(
      `SELECT a.id,a.child_name,a.parent_email,a.expires_at,a.approved_at,a.account_id,
         p.given_name,p.learner_id
       FROM amp_family_approvals a LEFT JOIN amp_people p ON p.id=a.person_id
       WHERE a.family_account_id=$1 AND a.ended_at IS NULL
         AND (a.approved_at IS NULL OR (p.deleted_at IS NULL AND p.learner_id IS NOT NULL))
       ORDER BY a.created_at,a.id LIMIT 200`,
      [familyAccountId],
    )
  ).rows;
  const result: ApprovalRow[] = [];
  for (const row of rows) {
    if (!row.approved_at) {
      const live = row.expires_at > new Date();
      result.push({
        id: row.id,
        name: row.child_name ?? "Child",
        status: live ? "waiting" : "expired",
        parentEmail: row.parent_email,
        inviteUrl: live ? copyUrl(keys, row.id) : null,
        parentPageUrl: null,
        expiresAt: row.expires_at.toISOString(),
        accessEndsAt: null,
      });
      continue;
    }
    const client = await pool.connect();
    try {
      const consent = await learningConsentActive(client, row.account_id!);
      const ends = await activeGrant(client, row.learner_id!);
      result.push({
        id: row.id,
        name: row.given_name ?? "Child",
        status: !consent ? "paused" : ends ? "active" : "needs-access",
        parentEmail: null,
        inviteUrl: null,
        parentPageUrl: approvalPageUrl(keys, row.id),
        expiresAt: null,
        accessEndsAt: ends?.toISOString() ?? null,
      });
    } finally {
      client.release();
    }
  }
  return result;
}

/** Removing a child from the class ends their place in it, and nothing else:
 * their learner, evidence, access and consent stay their parent's. The roster
 * row lets go of the learner, as a deleted learner's does. A waiting link is
 * withdrawn. */
export async function removeApproval(
  pool: Pool,
  familyAccountId: string,
  rawId: string,
) {
  const id = approvalId(rawId);
  return transaction(
    pool,
    `family-class:${familyAccountId}`,
    async (client) => {
      const row = (
        await client.query<{
          person_id: string | null;
          class_id: string;
          approved_at: Date | null;
        }>(
          `SELECT person_id,class_id,approved_at FROM amp_family_approvals
         WHERE id=$1 AND family_account_id=$2 AND ended_at IS NULL FOR UPDATE`,
          [id, familyAccountId],
        )
      ).rows[0];
      if (!row) throw new FamilyError(404, "approval_not_found");
      const family = await familyOf(client, familyAccountId);
      if (row.person_id && row.approved_at) {
        const today = await new SchoolRepository(pool).today(
          client,
          family.timezone,
        );
        await client.query(
          "UPDATE amp_org_roles SET end_on=GREATEST(begin_on,$2::date) WHERE person_id=$1 AND end_on IS NULL",
          [row.person_id, today],
        );
        await client.query(
          "UPDATE amp_enrollments SET end_on=GREATEST(begin_on,$2::date) WHERE person_id=$1 AND (end_on IS NULL OR end_on>$2::date)",
          [row.person_id, today],
        );
        await client.query(
          "UPDATE amp_student_sessions SET revoked_at=now() WHERE person_id=$1 AND revoked_at IS NULL",
          [row.person_id],
        );
        await client.query(
          "UPDATE amp_person_credentials SET revoked_at=now() WHERE person_id=$1 AND revoked_at IS NULL",
          [row.person_id],
        );
        await client.query(
          "UPDATE amp_people SET learner_id=NULL WHERE id=$1 AND learner_id IS NOT NULL",
          [row.person_id],
        );
        await recordEvent(client, {
          orgId: family.org_id,
          action: "student.removed",
          targetKind: "person",
          targetId: row.person_id,
          detail: { after: { classId: row.class_id, family: true } },
        });
      }
      await client.query(
        "UPDATE amp_family_approvals SET ended_at=now(),child_name=NULL,parent_email=NULL WHERE id=$1",
        [id],
      );
      return { removed: true };
    },
  );
}

/** Who teaches the class, by the names the class shows. */
async function teachers(db: Database, classId: string) {
  return (
    await db.query<{ name: string }>(
      `SELECT concat_ws(' ',p.given_name,p.family_name) AS name FROM amp_enrollments e
       JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
       WHERE e.class_id=$1 AND e.role='teacher' AND e.end_on IS NULL
       ORDER BY e.created_at,p.id LIMIT 4`,
      [classId],
    )
  ).rows.map((row) => row.name);
}

/** What the link's holder sees before signing in: the child, the class and
 * who teaches it. The token is the credential; the route takes it in the
 * body, which the request log skips. */
export async function lookupApproval(pool: Pool, raw: unknown) {
  const input = openApprovalSchema.pick({ token: true }).parse(raw);
  const row = (
    await pool.query<{
      child_name: string | null;
      expires_at: Date;
      account_id: string | null;
      approved_at: Date | null;
      ended_at: Date | null;
      class_id: string;
      class_name: string;
    }>(
      `SELECT a.child_name,a.expires_at,a.account_id,a.approved_at,a.ended_at,a.class_id,c.name AS class_name
       FROM amp_family_approvals a JOIN amp_classes c ON c.id=a.class_id WHERE a.lookup_hash=$1`,
      [hash(input.token)],
    )
  ).rows[0];
  if (!row) throw new FamilyError(404, "approval_not_found");
  const status = row.ended_at
    ? ("ended" as const)
    : row.account_id
      ? ("used" as const)
      : row.expires_at <= new Date()
        ? ("expired" as const)
        : ("open" as const);
  return {
    status,
    childName: status === "open" ? row.child_name : null,
    className: row.class_name,
    teachers: await teachers(pool, row.class_id),
  };
}

/** The signed-in parent opens the link, and it's theirs: single use, so
 * nobody after them can. A teacher of the class can't, because they can't
 * consent for someone else's child. With the mailed proof, an unconfirmed
 * account with that very address is confirmed. Opening again from the same
 * account returns the same page. */
export async function openApproval(
  pool: Pool,
  keys: ApprovalKeys,
  accountId: string,
  raw: unknown,
) {
  const input = openApprovalSchema.parse(raw);
  if (accountId.startsWith("school:") || accountId.startsWith("trial:"))
    throw new FamilyError(403, "parent_account_required");
  const found = (
    await pool.query<{ id: string; family_account_id: string }>(
      "SELECT id,family_account_id FROM amp_family_approvals WHERE lookup_hash=$1",
      [hash(input.token)],
    )
  ).rows[0];
  if (!found) throw new FamilyError(404, "approval_not_found");
  return transaction(
    pool,
    `family-class:${found.family_account_id}`,
    async (client) => {
      const row = (
        await client.query<{
          id: string;
          class_id: string;
          parent_email: string | null;
          secret_hash: string;
          expires_at: Date;
          account_id: string | null;
          ended_at: Date | null;
        }>(
          "SELECT id,class_id,parent_email,secret_hash,expires_at,account_id,ended_at FROM amp_family_approvals WHERE id=$1 FOR UPDATE",
          [found.id],
        )
      ).rows[0]!;
      if (row.account_id === accountId) return { id: row.id };
      if (row.ended_at) throw new FamilyError(410, "approval_ended");
      if (row.account_id) throw new FamilyError(410, "approval_used");
      if (row.expires_at <= new Date())
        throw new FamilyError(410, "approval_expired");
      const staff = await client.query(
        `SELECT 1 FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
       JOIN amp_classes c ON c.id=$2 JOIN amp_orgs o ON o.id=c.org_id
       WHERE p.account_id=$1 AND p.deleted_at IS NULL AND r.org_id=ANY(o.path) AND r.end_on IS NULL
       UNION ALL SELECT 1 FROM amp_families WHERE account_id=$1 AND class_id=$2 LIMIT 1`,
        [accountId, row.class_id],
      );
      if (staff.rowCount) throw new FamilyError(403, "teacher_cannot_approve");
      await client.query(
        "UPDATE amp_family_approvals SET account_id=$2,opened_at=now() WHERE id=$1",
        [row.id, accountId],
      );
      if (
        input.proof &&
        row.parent_email &&
        hash(input.proof) === row.secret_hash &&
        accountId.startsWith("amp|")
      )
        await client.query(
          `UPDATE amp_auth_users SET "emailVerified"=true,"updatedAt"=now()
         WHERE id=$1 AND lower(email)=$2 AND NOT "emailVerified"`,
          [accountId.slice(4), row.parent_email],
        );
      return { id: row.id };
    },
  );
}

/** The approving parent's page about their child in the class. */
export async function readApproval(
  pool: Pool,
  accountId: string,
  rawId: string,
  development = false,
) {
  const id = approvalId(rawId);
  const client = await pool.connect();
  try {
    const row = (
      await client.query<{
        child_name: string | null;
        expires_at: Date;
        approved_at: Date | null;
        ended_at: Date | null;
        class_id: string;
        class_name: string;
        given_name: string | null;
        learner_id: string | null;
        deleted_at: Date | null;
      }>(
        `SELECT a.child_name,a.expires_at,a.approved_at,a.ended_at,a.class_id,c.name AS class_name,
           p.given_name,p.learner_id,p.deleted_at
         FROM amp_family_approvals a JOIN amp_classes c ON c.id=a.class_id
         LEFT JOIN amp_people p ON p.id=a.person_id
         WHERE a.id=$1 AND a.account_id=$2`,
        [id, accountId],
      )
    ).rows[0];
    if (!row) throw new FamilyError(404, "approval_not_found");
    const approved = !!row.approved_at;
    const here = approved && !row.deleted_at && !!row.learner_id;
    const status =
      row.ended_at || (approved && !here)
        ? ("ended" as const)
        : approved
          ? ("approved" as const)
          : row.expires_at <= new Date()
            ? ("expired" as const)
            : ("open" as const);
    const ends = here ? await activeGrant(client, row.learner_id!) : null;
    const usage = here
      ? (
          await client.query(
            "SELECT free_online_used,free_workbooks_used FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL",
            [row.learner_id, accountId],
          )
        ).rows[0]
      : null;
    const allowance = usage
      ? freeAllowance(usage.free_online_used, usage.free_workbooks_used)
      : undefined;
    const consentActive = await learningConsentActive(
      client,
      accountId,
      development,
      here ? row.learner_id! : undefined,
    );
    return {
      id,
      status,
      childName: here ? row.given_name : (row.child_name ?? null),
      className: row.class_name,
      teachers: await teachers(client, row.class_id),
      consentActive,
      canPractice:
        consentActive && (!!ends || (allowance?.problems.remaining ?? 0) > 0),
      freeAllowance: allowance,
      learnerId: here ? row.learner_id : null,
      access: { active: !!ends, endsAt: ends?.toISOString() ?? null },
    };
  } finally {
    client.release();
  }
}

/** The parent approves: the child becomes a learner of their account and a
 * student of the teacher's class, with picture sign-in. Only with this
 * account's verified consent, which comes through the usual ways (a purchase
 * or email-plus), never from the teacher. The caller holds this account's
 * exclusive learning lock; the family's own lock comes after it. */
export async function approve(
  pool: Pool,
  accountId: string,
  rawId: string,
  raw: unknown,
  development = false,
) {
  const id = approvalId(rawId);
  const source = (
    await pool.query<{ account_id: string }>(
      `SELECT l.account_id FROM amp_family_approvals a JOIN amp_people p ON p.id=a.person_id
     JOIN amp_learners l ON l.id=p.learner_id WHERE a.id=$1 AND a.account_id=$2 AND a.approved_at IS NULL`,
      [id, accountId],
    )
  ).rows[0]?.account_id;
  // Ownership moves only while both accounts are locked in the same order.
  return transaction(pool, source ? [accountId, source] : accountId, (client) =>
    approveInside(client, pool, accountId, id, raw, development, source),
  );
}

async function approveInside(
  client: PoolClient,
  pool: Pool,
  accountId: string,
  rawId: string,
  raw: unknown,
  development = false,
  sourceAccount?: string,
) {
  const id = approvalId(rawId);
  const { name } = approveSchema.parse(raw);
  const peek = (
    await client.query<{ family_account_id: string }>(
      "SELECT family_account_id FROM amp_family_approvals WHERE id=$1 AND account_id=$2",
      [id, accountId],
    )
  ).rows[0];
  if (!peek) throw new FamilyError(404, "approval_not_found");
  await lockFamily(client, peek.family_account_id);
  const row = (
    await client.query<{
      approved_at: Date | null;
      ended_at: Date | null;
      expires_at: Date;
      class_id: string;
      person_id: string | null;
    }>(
      "SELECT approved_at,ended_at,expires_at,class_id,person_id FROM amp_family_approvals WHERE id=$1 FOR UPDATE",
      [id],
    )
  ).rows[0]!;
  if (row.ended_at) throw new FamilyError(410, "approval_ended");
  if (row.approved_at) {
    const learner = (
      await client.query<{ learner_id: string | null }>(
        "SELECT learner_id FROM amp_people WHERE id=$1 AND deleted_at IS NULL",
        [row.person_id],
      )
    ).rows[0]?.learner_id;
    if (!learner) throw new FamilyError(410, "approval_ended");
    return { learnerId: learner };
  }
  if (row.expires_at <= new Date())
    throw new FamilyError(410, "approval_expired");
  if (!(await parentAddressConfirmed(client, accountId)))
    throw new FamilyError(403, "email_unconfirmed");
  if (!(await learningConsentActive(client, accountId, development)))
    throw new FamilyError(409, "consent_required");
  const family = (
    await client.query<{ org_id: string; timezone: string; class_id: string }>(
      `SELECT f.org_id,o.timezone,c.id AS class_id FROM amp_families f
       JOIN amp_orgs o ON o.id=f.org_id JOIN amp_classes c ON c.id=$2 AND c.org_id=f.org_id AND c.archived_at IS NULL
       WHERE f.account_id=$1`,
      [peek.family_account_id, row.class_id],
    )
  ).rows[0];
  if (!family) throw new FamilyError(410, "approval_ended");
  const schools = new SchoolRepository(pool);
  const today = await schools.today(client, family.timezone);
  const personId = row.person_id ?? randomUUID();
  let learnerId: string;
  if (row.person_id) {
    const existing = (
      await client.query<{ id: string }>(
        `SELECT l.id FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id
       WHERE p.id=$1 AND p.deleted_at IS NULL AND l.deleted_at IS NULL AND l.name_pending
         AND l.account_id=$2 AND l.account_id='school:'||p.id
         AND EXISTS(SELECT 1 FROM amp_enrollments e WHERE e.person_id=p.id AND e.class_id=$3
           AND e.role='student' AND e.begin_on<=$4::date AND (e.end_on IS NULL OR e.end_on>$4::date))
       FOR UPDATE OF l`,
        [personId, sourceAccount ?? null, family.class_id, today],
      )
    ).rows[0];
    if (!existing) throw new FamilyError(410, "approval_ended");
    learnerId = existing.id;
    await client.query(
      "UPDATE amp_learners SET account_id=$2,name=$3,name_pending=false WHERE id=$1",
      [learnerId, accountId, name],
    );
    await client.query("UPDATE amp_people SET given_name=$2 WHERE id=$1", [
      personId,
      name,
    ]);
  } else {
    if (!(await familyHasLearnerRoom(client, accountId)))
      throw new FamilyError(403, "too_many_learners");
    learnerId = randomUUID();
    await client.query(
      "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,$3,NULL)",
      [learnerId, accountId, name],
    );
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,handle,grade_level,learner_id,timezone)
     VALUES($1,$2,$3,$4,NULL,$5,$6)`,
      [
        personId,
        family.org_id,
        name,
        generateHandle(),
        learnerId,
        family.timezone,
      ],
    );
    await client.query(
      "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'student',$4)",
      [randomUUID(), personId, family.org_id, today],
    );
    await schools.enroll(client, family.class_id, personId, "student", today);
  }
  // The approving family's gift in force covers this child too, whether
  // they were just added or moved in from a school's unnamed roster.
  await coverWithFamilyGift(client, accountId, learnerId);
  await client.query(
    "UPDATE amp_family_approvals SET approved_at=now(),person_id=$2,child_name=NULL,parent_email=NULL WHERE id=$1",
    [id, personId],
  );
  await recordEvent(client, {
    orgId: family.org_id,
    action: "student.added",
    targetKind: "person",
    targetId: personId,
    detail: {
      after: { classId: family.class_id, family: true, approved: true },
    },
  });
  return { learnerId };
}

/** The open link this parent holds and hasn't approved yet, for first-run
 * routing: after consent, the approval is the next step, not a new child. */
export async function pendingApprovalOf(db: Database, accountId: string) {
  if (!(await approvalsExist(db))) return null;
  const row = (
    await db.query<{ id: string }>(
      `SELECT id FROM amp_family_approvals WHERE account_id=$1 AND approved_at IS NULL
       AND ended_at IS NULL AND expires_at>now() ORDER BY opened_at DESC,id LIMIT 1`,
      [accountId],
    )
  ).rows[0];
  return row ? { id: row.id } : null;
}

/** Does this sign-up carry a mailed approval link to this very address? Then
 * the address is already proven. A copied link has no proof. */
export async function approvalProvesAddress(
  pool: Pool,
  address: string,
  claim: string | null,
) {
  const match = claim?.match(/^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/);
  if (!match || !(await approvalsExist(pool))) return false;
  return !!(
    await pool.query(
      `SELECT 1 FROM amp_family_approvals WHERE lookup_hash=$1 AND secret_hash=$2
       AND account_id IS NULL AND ended_at IS NULL AND expires_at>now() AND parent_email=lower($3)`,
      [hash(match[1]!), hash(match[2]!), address],
    )
  ).rowCount;
}

export type ApprovalMail = (
  to: string,
  subject: string,
  text: string,
  url: string,
) => Promise<void>;
/** The link to the child's parent, through the account mail path. A failure
 * is reported, not thrown: the link stands, and the teacher can copy it. The
 * mail names the class and its teacher, not the child. */
export async function mailApproval(
  pool: Pool,
  keys: ApprovalKeys,
  mail: ApprovalMail | undefined,
  sent: { id: string; email: string | null; className: string },
) {
  if (!mail || !sent.email || !(await countSend(pool, sent.id))) return false;
  const classId = (
    await pool.query("SELECT class_id FROM amp_family_approvals WHERE id=$1", [
      sent.id,
    ])
  ).rows[0]?.class_id as string;
  const teacher = (await teachers(pool, classId))[0] ?? "A teacher";
  try {
    await mail(
      sent.email,
      `${teacher} asked you to approve your child joining ${sent.className} on AMP`,
      `${teacher} would like your child to join ${sent.className}, a class on AMP, the adaptive math practice. Your child can practice there only once you approve. Open this link to read about the class and approve. It works once and expires in ${INVITE_DAYS} days. If you weren’t expecting this, you can ignore it.`,
      mailedApprovalUrl(keys, sent.id),
    );
    return true;
  } catch (error) {
    console.error("[family] approval mail not sent", {
      message: (error as Error).message,
    });
    return false;
  }
}

/** Set by the browser while a parent signs up from a mailed approval link:
 * `token.proof`, scoped to `/api/auth`. */
export const APPROVAL_SIGNUP_COOKIE = "amp.family-approval";
export function approvalSignupClaim(cookie: string | null | undefined) {
  const value = (cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${APPROVAL_SIGNUP_COOKIE}=`))
    ?.slice(APPROVAL_SIGNUP_COOKIE.length + 1);
  return value ? decodeURIComponent(value) : null;
}

/** Links nobody approved go a while after they expired or were withdrawn,
 * with the name and address the teacher typed. Approved links hold neither. */
export async function purgeFamilyApprovals(
  pool: Pool,
  at = new Date(),
): Promise<number> {
  if (!Number.isFinite(at.getTime()))
    throw new Error("Invalid retention clock");
  if (!(await approvalsExist(pool))) return 0;
  let count = 0;
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const result = await pool.query(
      `DELETE FROM amp_family_approvals WHERE id IN (
         SELECT id FROM amp_family_approvals WHERE approved_at IS NULL
           AND COALESCE(ended_at,expires_at) <= $1::timestamptz-make_interval(days=>$2)
         ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED)`,
      [
        at.toISOString(),
        RETENTION.familyApprovalDays,
        RETENTION_BATCH.batchSize,
      ],
    );
    count += result.rowCount ?? 0;
    if ((result.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
  }
  return count;
}
