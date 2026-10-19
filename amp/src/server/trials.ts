import { createHash, randomBytes } from "node:crypto";
import { RETENTION } from "../privacy/retention-periods.js";

/** Anonymous practice before an account exists. A trial learner belongs to
 * the synthetic account `trial:<id>`; real parent accounts are `issuer|sub`,
 * so the two can never collide. */
export const TRIAL_PREFIX = "trial:";
/** Free problems a trial may answer before the paywall (`AMP_FREE_PROBLEMS`). */
export const DEFAULT_FREE_PROBLEMS = 100;
/** Placement answers that open the free run; the rest is adaptive practice. */
export const PLACEMENT_PROBLEMS = 20;
/** Unadopted trials and their answers are deleted after this. */
export const TRIAL_DAYS = RETENTION.unsavedTrialDays;

export type TrialLimits = { free: number; placement: number };
/** Placement is the first fifth of the allowance, capped at twenty, so a
 * small test allowance still exercises placement, the map and practice. */
export function trialLimits(free = DEFAULT_FREE_PROBLEMS): TrialLimits {
  return {
    free,
    placement: Math.min(PLACEMENT_PROBLEMS, Math.max(1, Math.floor(free / 5))),
  };
}
/** Parses `AMP_FREE_PROBLEMS`: unset means the default; anything else must
 * be a whole number from 1 to 1000. */
export function freeProblemsSetting(value: string | undefined): number {
  if (value === undefined || value === "") return DEFAULT_FREE_PROBLEMS;
  if (!/^\d{1,4}$/.test(value) || +value < 1 || +value > 1000)
    throw new Error("AMP_FREE_PROBLEMS must be a whole number from 1 to 1000");
  return +value;
}

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
