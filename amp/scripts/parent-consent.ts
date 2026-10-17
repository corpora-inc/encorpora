import { cancelPendingConsent } from "../src/parent-consent/lifecycle.js";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { z } from "zod";
const schema = z
  .object({
    accountId: z.string().min(1).max(500),
    policyVersion: z.string().min(1).max(100),
    verificationMethod: z.string().min(1).max(200),
    evidenceReference: z.string().min(1).max(500),
    withdraw: z.boolean().default(false),
  })
  .strict();
if (!process.env.AMP_DATABASE_URL || !process.argv[2])
  throw new Error(
    "Set AMP_DATABASE_URL and pass a private consent-record JSON file.",
  );
const record = schema.parse(
  JSON.parse(await readFile(process.argv[2], "utf8")),
);
if (record.verificationMethod === "internal-email-plus-v1")
  throw new Error("The self-service method requires its own verified workflow");
const pool = new Pool({ connectionString: process.env.AMP_DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    record.accountId,
  ]);
  await client.query(
    `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference,withdrawn_at)
 VALUES($1,$2,$3,$4,CASE WHEN $5 THEN now() ELSE NULL END)
 ON CONFLICT(account_id) DO UPDATE SET policy_version=EXCLUDED.policy_version,verification_method=EXCLUDED.verification_method,evidence_reference=EXCLUDED.evidence_reference,recorded_at=now(),withdrawn_at=EXCLUDED.withdrawn_at`,
    [
      record.accountId,
      record.policyVersion,
      record.verificationMethod,
      record.evidenceReference,
      record.withdraw,
    ],
  );
  await cancelPendingConsent(client, record.accountId);
  await client.query("COMMIT");
  console.log("Parent consent record updated.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
