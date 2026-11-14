import type { PoolClient } from "pg";
import {
  EMAIL_PLUS_METHOD,
  isEmailPlusMethod,
} from "../parent-consent/contracts.js";
import {
  isSchoolAccount,
  schoolConsentActive,
  schoolUnnamedLearningActive,
} from "../schools/principal.js";
/** All learning writers take this lock before a learner lock. Privacy mutations
 * take its exclusive counterpart, then lock learners in sorted ID order. */
export async function lockLearningAccount(
  client: PoolClient,
  accountId: string,
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
    [accountId],
  );
}
/** Consent and purchase need an account whose email the parent has
 * confirmed. A passkey sign-up starts unconfirmed; other identities (OIDC,
 * development) are confirmed by their issuer. */
export async function parentAddressConfirmed(
  client: Pick<PoolClient, "query">,
  accountId: string,
): Promise<boolean> {
  if (!accountId.startsWith("amp|")) return true;
  const table = await client.query(
    "SELECT to_regclass('amp_auth_users') IS NOT NULL AS present",
  );
  if (!table.rows[0].present) return true;
  const user = await client.query(
    'SELECT "emailVerified" FROM amp_auth_users WHERE id=$1 FOR SHARE',
    [accountId.slice(4)],
  );
  return user.rows[0]?.emailVerified === true;
}
/** The account's own adult learner, live. Account holders are adults by the
 * terms, so this learner learns on the account's own terms: no parental
 * consent applies to it (docs/families.md). */
export async function isAdultLearner(
  client: Pick<PoolClient, "query">,
  accountId: string,
  learnerId: string,
): Promise<boolean> {
  // Read through the row, so a database before migration 0093 has none.
  return !!(
    await client.query(
      "SELECT 1 FROM amp_learners l WHERE l.id=$1 AND l.account_id=$2 AND l.deleted_at IS NULL AND to_jsonb(l)->'adult'='true'::jsonb",
      [learnerId, accountId],
    )
  ).rowCount;
}
/** Whether a purchase or a gift may be made for this learner: the account
 * holder's own adult learner needs no parental consent (they act for
 * themselves); any other learner, a child, needs the account's verified
 * parental consent. Unlike `learningConsentActive`, an unnamed child's
 * restricted permission never stands in for that consent. */
export async function purchaseConsentSatisfied(
  client: Pick<PoolClient, "query">,
  accountId: string,
  learnerId: string,
  development = false,
): Promise<boolean> {
  // A practice profile is marked adult too, but is never bought for.
  const own = await client.query(
    "SELECT 1 FROM amp_learners l WHERE l.id=$1 AND l.account_id=$2 AND l.deleted_at IS NULL AND to_jsonb(l)->'adult'='true'::jsonb AND (to_jsonb(l)->'simulation') IS DISTINCT FROM 'true'::jsonb",
    [learnerId, accountId],
  );
  if (own.rowCount) return true;
  return learningConsentActive(client, accountId, development);
}
/** Whether learning data may be collected. With `learnerId`, for that learner:
 * an adult learns on their own terms, an unnamed child uses the restricted
 * learning permission, and a named child requires naming consent. */
export async function learningConsentActive(
  client: Pick<PoolClient, "query">,
  accountId: string,
  development = false,
  learnerId?: string,
): Promise<boolean> {
  // Trial learners use a separate namespace and expire after 14 days.
  // A parent owns the trial for cross-device resume; adopting its answers
  // into a named family learner requires the regular consent checks.
  if (accountId.startsWith("trial:")) return true;
  if (await namingConsentActive(client, accountId, development, learnerId))
    return true;
  if (!learnerId) return false;
  const unnamed = await client.query(
    "SELECT 1 FROM amp_learners WHERE id=$1 AND account_id=$2 AND name_pending AND deleted_at IS NULL",
    [learnerId, accountId],
  );
  if (!unnamed.rowCount) return false;
  if (isSchoolAccount(accountId))
    return schoolUnnamedLearningActive(client, accountId);
  // Withdrawal stops collection even when the learner has no name.
  return !(
    await client.query(
      "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND withdrawn_at IS NOT NULL",
      [accountId],
    )
  ).rowCount;
}

/** Permission to collect a name is separate from unnamed practice. */
export async function namingConsentActive(
  client: Pick<PoolClient, "query">,
  accountId: string,
  development = false,
  learnerId?: string,
): Promise<boolean> {
  if (accountId.startsWith("trial:")) return false;
  if (isSchoolAccount(accountId)) return schoolConsentActive(client, accountId);
  if (await parentConsentActive(client, accountId, development)) return true;
  return !!learnerId && (await isAdultLearner(client, accountId, learnerId));
}
/** The account's verified parental consent for collecting children's names. */
async function parentConsentActive(
  client: Pick<PoolClient, "query">,
  accountId: string,
  development: boolean,
): Promise<boolean> {
  const result = await client.query(
    "SELECT withdrawn_at,verification_method,evidence_reference FROM amp_parent_consents WHERE account_id=$1",
    [accountId],
  );
  if (!result.rowCount) return development;
  const consent = result.rows[0];
  if (consent.withdrawn_at !== null) return false;
  if (consent.verification_method === "monetary-transaction") {
    const effective = await client.query(
      `SELECT 1 FROM amp_purchase_consents c JOIN amp_consent_policy p ON p.singleton AND p.digest=c.policy_digest AND p.generation=c.policy_generation
       WHERE c.checkout_id::text=$1 AND c.account_id=$2 AND c.consent_at IS NOT NULL AND c.revoked_at IS NULL AND p.enabled AND p.reviewed_until>clock_timestamp() FOR SHARE OF p`,
      [consent.evidence_reference, accountId],
    );
    return !!effective.rowCount;
  }
  if (!isEmailPlusMethod(consent.verification_method)) return true;
  // A newer workflow must never fall through to the manual-verification path
  // while older application instances are finishing a rolling deployment.
  if (consent.verification_method !== EMAIL_PLUS_METHOD) return false;
  const effective = await client.query(
    `SELECT 1 FROM amp_consent_requests r JOIN amp_consent_policy p ON p.singleton AND p.digest=r.policy_digest AND p.generation=r.policy_generation
    WHERE r.id::text=$1 AND r.account_id=$2 AND r.phase='active' AND r.completed_at IS NOT NULL AND p.enabled AND p.reviewed_until>clock_timestamp() FOR SHARE OF p`,
    [consent.evidence_reference, accountId],
  );
  return !!effective.rowCount;
}

/** Bounded, read-only equivalent of parentConsentActive for projection readers.
 * Callers select the accounts first; ended approvals need no consent lookup. */
export async function parentConsentStates(
  db: Pick<PoolClient, "query">,
  accounts: string[],
  development = false,
): Promise<Map<string, { active: boolean; withdrawn: boolean }>> {
  const result = await db.query<{
    account_id: string;
    active: boolean;
    withdrawn: boolean;
  }>(
    `SELECT a.account_id,c.withdrawn_at IS NOT NULL AS withdrawn,
      CASE WHEN c.account_id IS NULL THEN $2
        WHEN c.withdrawn_at IS NOT NULL THEN false
        WHEN c.verification_method='monetary-transaction' THEN EXISTS(
          SELECT 1 FROM amp_purchase_consents pc JOIN amp_consent_policy p
            ON p.singleton AND p.digest=pc.policy_digest AND p.generation=pc.policy_generation
          WHERE pc.checkout_id::text=c.evidence_reference AND pc.account_id=c.account_id
            AND pc.consent_at IS NOT NULL AND pc.revoked_at IS NULL AND p.enabled AND p.reviewed_until>clock_timestamp())
        WHEN c.verification_method=$3 THEN EXISTS(
          SELECT 1 FROM amp_consent_requests r JOIN amp_consent_policy p
            ON p.singleton AND p.digest=r.policy_digest AND p.generation=r.policy_generation
          WHERE r.id::text=c.evidence_reference AND r.account_id=c.account_id
            AND r.phase='active' AND r.completed_at IS NOT NULL AND p.enabled AND p.reviewed_until>clock_timestamp())
        WHEN c.verification_method LIKE 'internal-email-plus%' THEN false
        ELSE true END AS active
      FROM unnest($1::text[]) a(account_id)
      LEFT JOIN amp_parent_consents c ON c.account_id=a.account_id`,
    [[...new Set(accounts)], development, EMAIL_PLUS_METHOD],
  );
  return new Map(result.rows.map((row) => [row.account_id, row]));
}
