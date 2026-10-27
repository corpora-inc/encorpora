import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import {
  GoogleDataManager,
  googleDestinationSchema,
  googleConversionDestinationKey,
  type GoogleSignup,
  type GoogleIngestionReceipt,
} from "./google-data-manager.js";
export const signupMeasurementConfig = z.strictObject({
  enabled: z.boolean().default(false),
  destination: googleDestinationSchema,
});
export type SignupMeasurementConfig = z.infer<typeof signupMeasurementConfig>;
/** First-party signup events are separate from purchase exports and revenue. */
export async function collectSignupConversions(
  pool: Pool,
  config: SignupMeasurementConfig,
) {
  if (!config.enabled) return 0;
  const key = googleConversionDestinationKey(config.destination);
  const leads = await pool.query(
    `SELECT p.user_id,p.verified_at,c.identifiers,c.id AS evidence_id FROM amp_parent_followups p
    JOIN amp_ad_click_journeys j ON j.id=p.acquisition_journey_id AND j.account_id='amp|'||p.user_id AND j.expires_at>now()
    JOIN LATERAL (SELECT id,identifiers FROM amp_ad_click_evidence c WHERE c.journey_id=j.id AND c.provider='google' AND c.observed_at<=p.verified_at ORDER BY c.first_observed_at DESC,c.sequence DESC LIMIT 1) c ON true
    WHERE p.new_account AND p.verified_at>now()-interval '90 days'
      AND NOT EXISTS(SELECT 1 FROM amp_ad_collection_withdrawals w WHERE w.account_id='amp|'||p.user_id AND w.provider='google')
      AND NOT EXISTS(SELECT 1 FROM amp_google_signup_exports e WHERE e.user_id=p.user_id AND e.destination_key=$1)
    ORDER BY p.verified_at LIMIT 100`,
    [key],
  );
  let count = 0;
  for (const lead of leads.rows) {
    const id = randomUUID();
    const payload: GoogleSignup = {
      transactionId: `amp_signup_${id.replaceAll("-", "")}`,
      occurredAt: lead.verified_at.toISOString(),
      adIdentifiers: lead.identifiers,
    };
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `amp|${lead.user_id}`,
      ]);
      count +=
        (
          await db.query(
            `INSERT INTO amp_google_signup_exports(id,user_id,destination_key,payload,evidence_id)
        SELECT $1,$2,$3,$4,$5 WHERE EXISTS(SELECT 1 FROM amp_ad_click_evidence WHERE id=$5)
        AND NOT EXISTS(SELECT 1 FROM amp_ad_collection_withdrawals WHERE account_id='amp|'||$2 AND provider='google')
        ON CONFLICT(user_id,destination_key) DO NOTHING`,
            [id, lead.user_id, key, payload, lead.evidence_id],
          )
        ).rowCount ?? 0;
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }
  return count;
}
export async function deliverSignupConversion(
  pool: Pool,
  config: SignupMeasurementConfig,
  client: Pick<GoogleDataManager, "signup">,
) {
  if (!config.enabled) return false;
  const key = googleConversionDestinationKey(config.destination),
    lease = randomUUID();
  const job = (
    await pool.query(
      `UPDATE amp_google_signup_exports SET lease_id=$2,lease_until=now()+interval '2 minutes',attempts=attempts+1
    WHERE id=(SELECT id FROM amp_google_signup_exports WHERE destination_key=$1 AND receipt IS NULL AND stopped_reason IS NULL
      AND available_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`,
      [key, lease],
    )
  ).rows[0];
  if (!job) return false;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='2s'");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `amp|${job.user_id}`,
    ]);
    const owned = await db.query(
      "SELECT 1 FROM amp_google_signup_exports WHERE id=$1 AND lease_id=$2 AND lease_until>now()+interval '15 seconds' AND receipt IS NULL FOR UPDATE",
      [job.id, lease],
    );
    if (!owned.rowCount) {
      await db.query("COMMIT");
      return true;
    }
    const current = await db.query(
      `SELECT 1 FROM amp_parent_followups p JOIN amp_auth_users u ON u.id=p.user_id
    JOIN amp_ad_click_journeys j ON j.id=p.acquisition_journey_id AND j.expires_at>now() AND j.account_id='amp|'||p.user_id
    WHERE p.user_id=$1 AND p.verified_at IS NOT NULL AND u."emailVerified" AND u.email=p.email
      AND EXISTS(SELECT 1 FROM amp_ad_click_evidence c WHERE c.journey_id=j.id AND c.provider='google')
      AND NOT EXISTS(SELECT 1 FROM amp_ad_collection_withdrawals w WHERE w.account_id='amp|'||p.user_id AND w.provider='google')`,
      [job.user_id],
    );
    const stop = !current.rowCount
      ? "attribution-withdrawn"
      : job.attempts > 8
        ? "attempts-exhausted"
        : Date.parse(job.payload.occurredAt) < Date.now() - 89 * 86400_000
          ? "event-expired"
          : null;
    if (stop) {
      await db.query(
        "UPDATE amp_google_signup_exports SET stopped_reason=$2,lease_until=NULL WHERE id=$1 AND lease_id=$3",
        [job.id, stop, lease],
      );
      await db.query("COMMIT");
      return true;
    }
    let receipt: GoogleIngestionReceipt | null = null;
    try {
      const result = await client.signup(job.payload, "ingest");
      if (result.kind === "accepted") receipt = result;
    } catch {
      /* Retry the same event; Google deduplicates its transactionId. */
    }
    await db.query(
      "UPDATE amp_google_signup_exports SET receipt=$2,processing=CASE WHEN $2::jsonb IS NOT NULL THEN 'PROCESSING' ELSE NULL END,available_at=now()+interval '15 minutes',lease_until=NULL WHERE id=$1 AND lease_id=$3 AND receipt IS NULL",
      [job.id, receipt, lease],
    );
    await db.query("COMMIT");
    return true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function diagnoseSignupConversions(
  pool: Pool,
  config: SignupMeasurementConfig,
  client: Pick<GoogleDataManager, "status">,
) {
  const jobs = await pool.query(
    "SELECT id,receipt FROM amp_google_signup_exports WHERE destination_key=$1 AND receipt IS NOT NULL AND processing='PROCESSING' ORDER BY created_at LIMIT 20",
    [googleConversionDestinationKey(config.destination)],
  );
  for (const job of jobs.rows) {
    const result = await client.status(job.receipt);
    await pool.query(
      "UPDATE amp_google_signup_exports SET processing=$2 WHERE id=$1",
      [job.id, result.status],
    );
  }
  return jobs.rowCount;
}
