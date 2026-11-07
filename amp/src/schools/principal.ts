import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import type { SessionMode } from "./contracts.js";

/** Who a student is to the rest of AMP: one synthetic account per person, so
 * learner ownership and `transaction()` work unchanged. This module imports
 * nothing from the server, because `learningConsentActive` depends on it. */
export const SCHOOL_PREFIX = "school:";
export const isSchoolAccount = (accountId: string) =>
  accountId.startsWith(SCHOOL_PREFIX);
export const schoolAccountId = (personId: string) =>
  `${SCHOOL_PREFIX}${personId}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function schoolPersonId(accountId: string): string | null {
  if (!isSchoolAccount(accountId)) return null;
  const id = accountId.slice(SCHOOL_PREFIX.length);
  return UUID.test(id) ? id : null;
}

export const STUDENT_TOKEN_PREFIX = "st_";
const SESSION_HOURS: Record<SessionMode, number> = {
  shared: 12,
  personal: 90 * 24,
};
const TOKEN = /^st_[A-Za-z0-9_-]{43}$/;

export const generateStudentToken = () =>
  `${STUDENT_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
export const hashStudentToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function studentSessionExpiry(mode: SessionMode, now = new Date()) {
  return new Date(now.getTime() + SESSION_HOURS[mode] * 3_600_000);
}

type Headers = { headers: { authorization?: string } };
/** The token in `Authorization: Bearer st_…`, malformed or not. A request that
 * presents one is a student's: it is never answered as anyone else. */
export function studentBearer(request: Headers): string | null {
  return (
    request.headers.authorization?.match(/^bearer\s+(st_.*)$/i)?.[1] ?? null
  );
}

type Database = Pick<PoolClient, "query">;
/** SQL: `row` (a role or enrollment) is active today in the org's timezone. */
export const activeToday = (row: string, org: string) =>
  `${row}.begin_on<=(now() AT TIME ZONE ${org}.timezone)::date AND (${row}.end_on IS NULL OR ${row}.end_on>(now() AT TIME ZONE ${org}.timezone)::date)`;
export const ACTIVE_STUDENT = `EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
  WHERE r.person_id=p.id AND r.role='student' AND ${activeToday("r", "o")})`;

/** The synthetic account for a live token, or null when the token is revoked or
 * expired, or the student was removed or deleted. `last_seen_at` is the
 * student's own row, written at most every five minutes. */
export async function resolveStudentToken(
  db: Database,
  token: string,
): Promise<string | null> {
  if (!TOKEN.test(token)) return null;
  const { rows } = await db.query(
    `WITH live AS (
       SELECT s.id,s.person_id FROM amp_student_sessions s
       JOIN amp_people p ON p.id=s.person_id
       JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL
       WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
         AND p.deleted_at IS NULL AND ${ACTIVE_STUDENT}
     ), touched AS (
       UPDATE amp_student_sessions s SET last_seen_at=now() FROM live
       WHERE s.id=live.id AND s.last_seen_at<now()-interval '5 minutes'
     )
     SELECT person_id FROM live`,
    [hashStudentToken(token)],
  );
  return rows[0] ? schoolAccountId(rows[0].person_id) : null;
}

/** A school's consent: the student is active and the nearest data agreement up
 * the org path is accepted and not ended. Reads only, with no row locks: every
 * answer in a class passes through here. */
export async function schoolConsentActive(
  db: Database,
  accountId: string,
): Promise<boolean> {
  const personId = schoolPersonId(accountId);
  if (!personId) return false;
  const { rows } = await db.query(
    `SELECT EXISTS(
       SELECT 1 FROM amp_people p
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role='student'
       JOIN amp_orgs o ON o.id=r.org_id
       JOIN LATERAL (
         SELECT a.ended_at FROM amp_data_agreements a
         WHERE a.org_id=ANY(o.path)
         ORDER BY array_position(o.path,a.org_id) DESC,a.accepted_at DESC,a.id
         LIMIT 1
       ) nearest ON nearest.ended_at IS NULL
       WHERE p.id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
     ) AS active`,
    [personId],
  );
  return rows[0].active === true;
}
