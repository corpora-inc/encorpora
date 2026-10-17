import { createHash, randomBytes } from "node:crypto";

/** Anonymous placement before an account exists. A trial learner belongs to
 * the synthetic account `trial:<id>`; real parent accounts are `issuer|sub`,
 * so the two can never collide. */
export const TRIAL_PREFIX = "trial:";
/** Independent answers a trial may record before the paywall. */
export const TRIAL_ATTEMPTS = 20;
/** Unadopted trials and their answers are deleted after this. */
export const TRIAL_DAYS = 14;

export const isTrialAccount = (accountId: string) =>
  accountId.startsWith(TRIAL_PREFIX);
export const newTrialToken = () => randomBytes(32).toString("base64url");
export const trialTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Deletes expired, unadopted trials. Their learner rows cascade to every
 * answer, problem and evidence record. Returns the number removed. */
export async function purgeExpiredTrials(pool: {
  query: (sql: string) => Promise<{ rowCount: number | null }>;
}): Promise<number> {
  const result = await pool.query(
    `WITH gone AS (
       DELETE FROM amp_trials WHERE adopted_at IS NULL AND expires_at<=now()
       RETURNING learner_id, id
     )
     DELETE FROM amp_learners l USING gone
     WHERE l.id=gone.learner_id AND l.account_id='trial:'||gone.id`,
  );
  return result.rowCount ?? 0;
}
