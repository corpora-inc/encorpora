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
  const result = await client.query(
    "SELECT withdrawn_at FROM amp_parent_consents WHERE account_id=$1",
    [accountId],
  );
  if (!result.rowCount) return development;
  return result.rows[0].withdrawn_at === null;
}
