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
const pool = new Pool({ connectionString: process.env.AMP_DATABASE_URL });
try {
  await pool.query(
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
  console.log("Parent consent record updated.");
} finally {
  await pool.end();
}
