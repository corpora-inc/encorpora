import { eraseAccountAdClicks } from "../advertising/click-evidence.js";
import { acquisitionToken } from "../advertising/acquisition.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { signupIntentSchema, type SignupIntent } from "./contracts.js";
export const signupCookie = "amp.parent-signup";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function intentToken(cookie: string | null | undefined) {
  const found = (cookie ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${signupCookie}=`));
  const value =
    found.length === 1 ? found[0]!.slice(signupCookie.length + 1) : "";
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function createSignupIntent(
  pool: Pool,
  intent: SignupIntent,
  cookie?: string,
) {
  const token = randomBytes(32).toString("hex");
  const clickToken = acquisitionToken({ cookie });
  await pool.query(
    `INSERT INTO amp_parent_signup_intents(token_hash,context,expires_at,acquisition_journey_id)
    VALUES ($1,$2,now()+interval '30 minutes',(SELECT id FROM amp_ad_click_journeys WHERE token_digest=$3 AND expires_at>now() AND account_id IS NULL))`,
    [
      hash(token),
      signupIntentSchema.parse(intent),
      clickToken ? hash(clickToken) : null,
    ],
  );
  return token;
}
/** Called by successful account/session creation, never from a client email. */
export async function completeSignup(
  pool: Pool,
  cookie: string | null | undefined,
  userId: string,
) {
  const token = intentToken(cookie);
  if (!token) return;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `amp|${userId}`,
    ]);
    const pending = (
      await db.query(
        "SELECT context,acquisition_journey_id,created_at FROM amp_parent_signup_intents WHERE token_hash=$1 AND expires_at>now() AND used_by IS NULL FOR UPDATE",
        [hash(token)],
      )
    ).rows[0];
    if (!pending) {
      await db.query("COMMIT");
      return;
    }
    const intent = signupIntentSchema.parse(pending.context);
    const journey = pending.acquisition_journey_id
      ? (
          await db.query(
            "SELECT id FROM amp_ad_click_journeys WHERE id=$1 AND expires_at>now() AND (account_id IS NULL OR account_id=$2) FOR UPDATE",
            [pending.acquisition_journey_id, `amp|${userId}`],
          )
        ).rows[0]?.id
      : null;
    const inserted = await db.query(
      `INSERT INTO amp_parent_followups(user_id,email,program,campaign,newsletter,notice_version,unsubscribe_token,acquisition_journey_id,new_account,entry_label)
      SELECT id,email,$2,$3,$4,$5,$6,$7,("createdAt">=$8),$9 FROM amp_auth_users WHERE id=$1
      ON CONFLICT(user_id) DO NOTHING RETURNING user_id`,
      [
        userId,
        intent.program ?? null,
        intent.campaign ?? null,
        intent.newsletter,
        intent.notice,
        randomBytes(32).toString("hex"),
        journey ?? null,
        pending.created_at,
        intent.entry ?? null,
      ],
    );
    if (inserted.rowCount) {
      await db.query(
        "UPDATE amp_ad_click_journeys SET account_id=$2 WHERE id=$1 AND account_id IS NULL",
        [pending.acquisition_journey_id, `amp|${userId}`],
      );
      for (const stage of ["welcome", "reminder"])
        await db.query(
          "INSERT INTO amp_parent_followup_outbox(id,user_id,stage) VALUES ($1,$2,$3)",
          [randomUUID(), userId, stage],
        );
    } else if (intent.newsletter) {
      // A fresh explicit opt-in changes the subscription, never restarts the trial sequence.
      await db.query(
        "UPDATE amp_parent_followups SET newsletter=true,unsubscribed_at=NULL WHERE user_id=$1",
        [userId],
      );
    }
    const withdrawals = await db.query(
      "SELECT provider FROM amp_ad_collection_withdrawals WHERE account_id=$1",
      [`amp|${userId}`],
    );
    for (const row of withdrawals.rows)
      await eraseAccountAdClicks(db, `amp|${userId}`, row.provider);
    // A sign-in never restarts the sequence or overrides an unsubscribe.
    await db.query(
      "UPDATE amp_parent_signup_intents SET used_by=$2 WHERE token_hash=$1",
      [hash(token), userId],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function unsubscribe(pool: Pool, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  await pool.query(
    `WITH stopped AS (UPDATE amp_parent_followups SET unsubscribed_at=COALESCE(unsubscribed_at,now()),newsletter=false WHERE unsubscribe_token=$1 RETURNING user_id)
    UPDATE amp_parent_followup_outbox SET stopped_at=now(),stopped_reason='unsubscribed',lease_until=NULL
    WHERE user_id IN (SELECT user_id FROM stopped) AND accepted_at IS NULL AND stopped_at IS NULL`,
    [token],
  );
}

/** Verification is an observed identity event, never a practice or paid event. */
export async function markSignupVerified(pool: Pool, userId: string) {
  await pool.query(
    `UPDATE amp_parent_followups p SET verified_at=COALESCE(p.verified_at,now())
    FROM amp_auth_users u WHERE p.user_id=$1 AND u.id=p.user_id AND u."emailVerified" AND u.email=p.email`,
    [userId],
  );
}

/** Parent-selected demo context, not a confirmed child's age or a learner profile. */
export async function recordParentAssessmentStart(
  pool: Pool,
  accountId: string,
  birthYear: number,
) {
  if (!accountId.startsWith("amp|")) return;
  await pool.query(
    "INSERT INTO amp_parent_assessment_entries(id,user_id,selected_birth_year) VALUES($1,$2,$3)",
    [randomUUID(), accountId.slice(4), birthYear],
  );
}
