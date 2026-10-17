import type { PoolClient } from "pg";
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
export async function learningConsentActive(
  client: PoolClient,
  accountId: string,
  development = false,
): Promise<boolean> {
  // An anonymous trial holds no personal information about a child: no name,
  // no contact data, only a birth year and answers, deleted unless a parent
  // adopts them (with consent) into their own account.
  if (accountId.startsWith("trial:")) return true;
  const result = await client.query(
    "SELECT withdrawn_at,verification_method,evidence_reference FROM amp_parent_consents WHERE account_id=$1",
    [accountId],
  );
  if (!result.rowCount) return development;
  const consent = result.rows[0];
  if (consent.withdrawn_at !== null) return false;
  if (consent.verification_method !== "internal-email-plus-v1") return true;
  const effective = await client.query(
    `SELECT 1 FROM amp_consent_requests r JOIN amp_consent_policy p ON p.singleton AND p.digest=r.policy_digest AND p.generation=r.policy_generation
    WHERE r.id::text=$1 AND r.account_id=$2 AND r.phase='active' AND r.completed_at IS NOT NULL AND p.enabled AND p.reviewed_until>clock_timestamp() FOR SHARE OF p`,
    [consent.evidence_reference, accountId],
  );
  return !!effective.rowCount;
}
