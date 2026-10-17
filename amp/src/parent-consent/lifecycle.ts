import type { Pool, PoolClient } from "pg";
export async function cancelPendingConsent(
  client: PoolClient,
  account: string,
): Promise<void> {
  if (
    !(
      await client.query(
        "SELECT to_regclass('amp_consent_requests') AS relation",
      )
    ).rows[0]?.relation
  )
    return;
  await client.query(
    `UPDATE amp_consent_requests SET phase='withdrawn',recipient_ciphertext=NULL,withdrawn_at=COALESCE(withdrawn_at,now()),
    purge_after=CASE WHEN completed_at IS NULL THEN expires_at ELSE now()+((notice->>'withdrawnEvidenceDays')::int * interval '1 day') END
    WHERE account_id=$1 AND phase IN ('awaiting-initial','awaiting-confirmation','active')`,
    [account],
  );
  await client.query(
    `UPDATE amp_consent_outbox o SET lease_id=NULL,lease_until=NULL FROM amp_consent_requests r WHERE r.id=o.request_id AND r.account_id=$1`,
    [account],
  );
}
export async function purgeConsentRecords(pool: Pool): Promise<number> {
  // Serialized with start/ack/withdraw for each account; bounded batches avoid a
  // global lock or holding one account lock while waiting for another.
  // Close completed records whose reviewed policy was withdrawn or expired.
  // This starts their declared post-consent retention period, instead of leaving
  // ineffective "active" evidence indefinitely. Pending contact uses its TTL.
  const invalidated = (
    await pool.query(`SELECT r.id,r.account_id FROM amp_consent_requests r LEFT JOIN amp_consent_policy p ON p.singleton AND p.digest=r.policy_digest AND p.generation=r.policy_generation
    WHERE r.phase='active' AND (p.digest IS NULL OR NOT p.enabled OR p.reviewed_until<=now()) LIMIT 100`)
  ).rows;
  for (const row of invalidated) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [row.account_id],
      );
      await client.query(
        `UPDATE amp_consent_requests r SET phase='expired',recipient_ciphertext=NULL,purge_after=now()+((notice->>'withdrawnEvidenceDays')::int * interval '1 day')
        WHERE r.id=$1 AND r.phase='active' AND NOT EXISTS(SELECT 1 FROM amp_consent_policy p WHERE p.singleton AND p.digest=r.policy_digest AND p.generation=r.policy_generation AND p.enabled AND p.reviewed_until>now())`,
        [row.id],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  const candidates = (
    await pool.query(`SELECT DISTINCT account_id FROM amp_consent_requests WHERE
    (completed_at IS NULL AND expires_at<=now()) OR purge_after<=now() LIMIT 100`)
  ).rows;
  let removed = 0;
  for (const { account_id: account } of candidates) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [account],
      );
      const result = await client.query(
        "DELETE FROM amp_consent_requests WHERE account_id=$1 AND ((completed_at IS NULL AND expires_at<=now()) OR purge_after<=now())",
        [account],
      );
      removed += result.rowCount ?? 0;
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  return removed;
}
