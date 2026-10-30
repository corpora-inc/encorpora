import type { Pool } from "pg";
import { z } from "zod";
import { lockSignupSharing } from "../advertising/signup-privacy-lock.js";
import { gaSignupContextSchema } from "./ga-signup-context.js";
import { GA_MEASUREMENT_ID } from "./google-analytics.js";

export const gaSignupConfigSchema = z.strictObject({
  enabled: z.boolean(),
  measurementId: z.literal(GA_MEASUREMENT_ID),
  apiSecret: z.string().regex(/^[A-Za-z0-9_-]{10,128}$/),
});
export type GaSignupConfig = z.infer<typeof gaSignupConfigSchema>;

export function gaSignupPayload(
  context: unknown,
  verifiedAt: Date,
  method: string | null,
  now = new Date(),
) {
  const { clientId, sessionId } = gaSignupContextSchema.parse(context);
  if (
    !Number.isFinite(+verifiedAt) ||
    +verifiedAt > +now ||
    +verifiedAt < +now - 72 * 3600000
  )
    throw new Error("invalid_signup_time");
  return {
    client_id: clientId,
    timestamp_micros: +verifiedAt * 1000,
    consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
    // Analytics consent and device/geography inherit from the matching web
    // interaction. Never forward an IP, email, account ID, or learner action.
    events: [
      {
        name: "sign_up",
        params: {
          session_id: sessionId,
          ...(method &&
          [
            "google",
            "apple",
            "microsoft",
            "github",
            "password",
            "passkey",
          ].includes(method)
            ? { method }
            : {}),
        },
      },
    ],
  };
}

const eligible = `SELECT g.*,p.verified_at,p.signup_method FROM amp_ga_signup_exports g
 JOIN amp_parent_followups p ON p.user_id=g.user_id JOIN amp_auth_users u ON u.id=p.user_id
 WHERE g.state='pending' AND g.client_id IS NOT NULL AND p.new_account
 AND u."emailVerified" AND u.email=p.email AND p.verified_at<=clock_timestamp()
 AND p.verified_at>=g.captured_at AND clock_timestamp()<g.captured_at+interval '24 hours'
 AND NOT EXISTS(SELECT 1 FROM amp_ad_collection_withdrawals w WHERE w.account_id='amp|'||g.user_id AND w.provider='google')`;

/** Background-only dispatch. Persist 'sending' BEFORE I/O: a lost HTTP receipt
 * or worker crash becomes uncertain, never an automatic duplicate key event.
 * A 2xx is transport acceptance, not proof of reporting or attribution in GA4. */
export async function deliverGaSignup(
  pool: Pool,
  input: GaSignupConfig,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const config = gaSignupConfigSchema.parse(input);
  if (!config.enabled) return false;
  const candidate = (
    await pool.query(`${eligible} ORDER BY g.created_at LIMIT 1`)
  ).rows[0];
  if (!candidate) return false;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='3s'");
    await db.query("SET LOCAL statement_timeout='15s'");
    await db.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
    await lockSignupSharing(db, `amp|${candidate.user_id}`, true);
    const current = (
      await db.query(`${eligible} AND g.user_id=$1`, [candidate.user_id])
    ).rows[0];
    if (!current) {
      await db.query("COMMIT");
      return true;
    }
    const payload = gaSignupPayload(
      { clientId: current.client_id, sessionId: Number(current.session_id) },
      current.verified_at,
      current.signup_method,
    );
    // Separate committed claim while retaining the privacy lock. No account,
    // learner, or request transaction waits on Google's network response.
    const claimed = await pool.query(
      "UPDATE amp_ga_signup_exports SET state='sending',dispatched_at=clock_timestamp() WHERE user_id=$1 AND state='pending' RETURNING user_id",
      [current.user_id],
    );
    if (!claimed.rowCount) {
      await db.query("COMMIT");
      return true;
    }
    let state = "uncertain",
      status: number | null = null;
    try {
      const url = new URL("https://www.google-analytics.com/mp/collect");
      url.searchParams.set("measurement_id", config.measurementId);
      url.searchParams.set("api_secret", config.apiSecret);
      const response = await fetcher(url, {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      status = response.status;
      state = response.ok
        ? "accepted"
        : status >= 400 && status < 500
          ? "rejected"
          : "uncertain";
      await response.body?.cancel();
    } catch {
      /* Never log request URLs, credentials, or browser identifiers. */
    }
    await db.query(
      "UPDATE amp_ga_signup_exports SET state=$2,http_status=$3,client_id=NULL,session_id=NULL WHERE user_id=$1 AND state='sending'",
      [current.user_id, state, status],
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

export async function purgeGaSignups(pool: Pool) {
  await pool.query(
    "UPDATE amp_ga_signup_exports SET state='uncertain',client_id=NULL,session_id=NULL WHERE state='sending' AND dispatched_at<now()-interval '5 minutes'",
  );
  await pool.query(
    "UPDATE amp_ga_signup_exports SET state='stopped',client_id=NULL,session_id=NULL WHERE state='pending' AND captured_at<now()-interval '24 hours'",
  );
  await pool.query(
    "DELETE FROM amp_ga_signup_exports WHERE created_at<now()-interval '90 days'",
  );
}
