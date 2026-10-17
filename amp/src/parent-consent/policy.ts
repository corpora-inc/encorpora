import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Pool, PoolClient } from "pg";
import {
  consentPolicySchema,
  type ConsentPolicy,
  ConsentError,
} from "./contracts.js";
import { digest, noticeDigest } from "./crypto.js";
export async function loadConsentPolicy(
  path?: string,
): Promise<ConsentPolicy | null> {
  if (!path) return null;
  const file = await readFile(path);
  if (file.length > 128 * 1024) throw new Error("Consent policy exceeds limit");
  return consentPolicySchema.parse(JSON.parse(file.toString("utf8")));
}
/** Explicit administrative operation; route registration never changes policy. */
export async function installConsentPolicy(
  pool: Pool,
  input: unknown,
): Promise<void> {
  const p = consentPolicySchema.parse(input);
  await pool.query(
    `INSERT INTO amp_consent_policy(singleton,digest,notice_digest,policy,enabled,reviewed_until,generation)
    VALUES(true,$1,$2,$3,$4,$5,$6) ON CONFLICT(singleton) DO UPDATE SET generation=CASE WHEN amp_consent_policy.digest=$1 THEN amp_consent_policy.generation ELSE $6 END,digest=$1,notice_digest=$2,policy=$3,enabled=$4,reviewed_until=$5,updated_at=now()`,
    [
      digest(p),
      noticeDigest(p),
      p,
      p.enabled,
      p.review.expiresAt,
      randomUUID(),
    ],
  );
}
export async function currentPolicy(
  client: PoolClient,
  configured: ConsentPolicy | null,
): Promise<ConsentPolicy> {
  if (!configured?.enabled)
    throw new ConsentError("consent_enrollment_unavailable", 503);
  const result = await client.query(
    "SELECT digest,enabled,reviewed_until>now() AS current FROM amp_consent_policy WHERE singleton FOR SHARE",
  );
  const row = result.rows[0];
  if (!row?.enabled || !row.current || row.digest !== digest(configured))
    throw new ConsentError("consent_enrollment_unavailable", 503);
  return configured;
}

export async function policyGeneration(client: PoolClient): Promise<string> {
  return (
    await client.query(
      "SELECT generation FROM amp_consent_policy WHERE singleton",
    )
  ).rows[0].generation;
}
