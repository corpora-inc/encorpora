import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { eraseAccountAdClicks } from "../advertising/click-evidence.js";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const AD_PROVIDERS = ["google", "meta", "openai"] as const;

/** An account that arrived through a school isn't a new parent: no follow-up
 * mail and no ad measurement, for all providers. A person who is already a
 * parent here keeps what they have, because a teacher can be both. */
export async function markStaffAccount(
  client: Pick<PoolClient, "query"> & PoolClient,
  accountId: string,
): Promise<void> {
  if (!accountId.startsWith("amp|")) return;
  const userId = accountId.slice(4);
  const parent = (
    await client.query(
      `SELECT EXISTS(SELECT 1 FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL AND NOT adult)
         OR EXISTS(SELECT 1 FROM amp_parent_consents WHERE account_id=$1) AS parent`,
      [accountId],
    )
  ).rows[0].parent;
  if (parent) return;
  const note = "Staff account created through AMP for Schools.";
  await client.query(
    `INSERT INTO amp_account_classification_events(user_id,event_key,category,note)
     SELECT id,'school-staff','school_staff',$2 FROM amp_auth_users WHERE id=$1
     ON CONFLICT DO NOTHING`,
    [userId, note],
  );
  // An operator's own classification of this account stands.
  await client.query(
    `INSERT INTO amp_account_classifications(user_id,category,note)
     SELECT id,'school_staff',$2 FROM amp_auth_users WHERE id=$1
     ON CONFLICT(user_id) DO UPDATE SET category=excluded.category,note=excluded.note,updated_at=now()
     WHERE amp_account_classifications.category='prospect'`,
    [userId, note],
  );
  await client.query(
    `INSERT INTO amp_ad_collection_withdrawals(account_id,provider)
     SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING`,
    [accountId, AD_PROVIDERS],
  );
  for (const provider of AD_PROVIDERS)
    await eraseAccountAdClicks(client, accountId, provider);
  await client.query(
    `UPDATE amp_parent_followup_outbox SET stopped_at=now(),stopped_reason='not-a-prospect',lease_until=NULL
     WHERE user_id=$1 AND accepted_at IS NULL AND stopped_at IS NULL`,
    [userId],
  );
}

/** Set by the browser while someone signs up on their way into a school: `1`
 * from setup, `token.proof` from a mailed invitation. Scoped to `/api/auth`. */
export const SCHOOL_SIGNUP_COOKIE = "amp.school-signup";
function signupClaim(cookie: string | null | undefined) {
  const value = (cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SCHOOL_SIGNUP_COOKIE}=`))
    ?.slice(SCHOOL_SIGNUP_COOKIE.length + 1);
  return value ? decodeURIComponent(value) : null;
}
export const isSchoolSignup = (cookie: string | null | undefined) =>
  !!signupClaim(cookie);

/** Does this sign-up carry a mailed invitation to this very address? Then the
 * address is already proven, and asking again would be a second mail. A copied
 * link has no proof: it binds an account, and proves nothing about a mailbox. */
export async function invitationProvesAddress(
  pool: Pool,
  address: string,
  cookie: string | null | undefined,
): Promise<boolean> {
  const claim = signupClaim(cookie);
  const match = claim?.match(/^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return false;
  const found = await pool.query(
    `SELECT 1 FROM amp_person_credentials c JOIN amp_people p ON p.id=c.person_id
     WHERE c.kind='invite' AND c.lookup_hash=$1 AND c.secret_hash=$2
       AND c.revoked_at IS NULL AND c.expires_at>now()
       AND p.deleted_at IS NULL AND lower(p.email)=lower($3)`,
    [hash(match[1]!), hash(match[2]!), address],
  );
  return !!found.rowCount;
}

/** Whether this account holds, or held, a school role: its mail shouldn't call
 * it a parent account. A family's roles are a parent's. */
export async function isSchoolStaff(pool: Pool, userId: string) {
  const found = await pool.query(
    `SELECT 1 FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role<>'student'
     JOIN amp_orgs o ON o.id=r.org_id AND o.kind<>'family'
     WHERE p.account_id=$1 LIMIT 1`,
    [`amp|${userId}`],
  );
  return !!found.rowCount;
}

/** This address is invited as a family's second parent: a parent, whose
 * mail never calls their account a school's. */
export async function isFamilyInvitee(pool: Pool, email: string) {
  const found = await pool.query(
    `SELECT 1 FROM amp_families f JOIN amp_people p ON p.id=f.second_parent
     WHERE lower(p.email)=lower($1) AND p.deleted_at IS NULL LIMIT 1`,
    [email],
  );
  return !!found.rowCount;
}
