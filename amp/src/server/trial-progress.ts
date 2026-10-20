import type { PoolClient } from "pg";
import type { SkillEvidence } from "./evidence";
import type { Outcome } from "./repository";
import type { TrialLimits } from "./trials";
import { SKIP_USES_FREE_PROBLEM } from "../learning/skip";

/** Placement, then adaptive practice with lessons, hints and review, until
 * the free allowance is used. One engine: the mixed-practice planner. */
export type TrialProgress = {
  phase: "placement" | "practice" | "complete";
  free: number;
  placement: number;
  remaining: number;
  /** `answered` counts the problems used: answers, and skips while
   * SKIP_USES_FREE_PROBLEM holds. `skipped` counts every skip. */
  totals: {
    answered: number;
    correct: number;
    assisted: number;
    skipped: number;
  };
};

export function trialProgress(
  attempts: Pick<Outcome, "correct" | "assisted">[],
  limits: TrialLimits,
  skipped = 0,
): TrialProgress {
  const answered = attempts.length + (SKIP_USES_FREE_PROBLEM ? skipped : 0);
  return {
    phase:
      answered < limits.placement
        ? "placement"
        : answered < limits.free
          ? "practice"
          : "complete",
    free: limits.free,
    placement: limits.placement,
    remaining: Math.max(0, limits.free - answered),
    totals: {
      answered,
      correct: attempts.filter((a) => a.correct).length,
      assisted: attempts.filter((a) => a.assisted).length,
      skipped,
    },
  };
}

/** Skills that were missed (wrong or answered with help) and are now
 * review-ready: four of the last five answered correctly without help,
 * including the latest. Skills that were never missed are not counted. */
export function masteredSkills(evidence: readonly SkillEvidence[]): string[] {
  return evidence
    .filter(
      (skill) =>
        skill.status === "review-ready" &&
        skill.attempts > skill.independentCorrect,
    )
    .map((skill) => skill.skillId);
}

/** Whether this learner is a live, unadopted anonymous trial. */
export async function isLiveTrial(db: PoolClient, learnerId: string) {
  const trial = await db.query(
    `SELECT 1 FROM amp_trials t JOIN amp_learners l ON l.id=t.learner_id
     WHERE t.learner_id=$1 AND l.account_id='trial:'||t.id AND t.adopted_at IS NULL AND t.expires_at>now()`,
    [learnerId],
  );
  return !!trial.rowCount;
}

/** Skipped problems, which are never attempts. */
export async function countSkips(db: PoolClient, learnerId: string) {
  const result = await db.query(
    "SELECT count(*)::int AS n FROM amp_instances WHERE learner_id=$1 AND (content->>'skipped')::boolean",
    [learnerId],
  );
  return (result.rows[0]?.n as number) ?? 0;
}

/** Persisted-answer milestones: problems used, as the trial counts them. */
export async function recordTrialMilestones(
  db: PoolClient,
  learnerId: string,
  limits: TrialLimits,
) {
  const result = await db.query(
    `SELECT (SELECT count(*)::int FROM amp_attempts a WHERE a.learner_id=t.learner_id) AS answered
    FROM amp_trials t WHERE t.learner_id=$1 AND t.adopted_at IS NULL AND t.expires_at>now()`,
    [learnerId],
  );
  const used =
    result.rows[0] &&
    result.rows[0].answered +
      (SKIP_USES_FREE_PROBLEM ? await countSkips(db, learnerId) : 0);
  if (used === limits.placement)
    await recordTrialEvent(db, learnerId, "placement_done");
}

/** Only a random analytics id and a fixed event name enter the event table. */
export async function recordTrialEvent(
  db: PoolClient,
  learnerId: string,
  event: "trial_started" | "placement_done" | "paywall" | "purchase",
) {
  await db.query(
    `INSERT INTO amp_trial_events(trial_id,event)
    SELECT analytics_id,$2 FROM amp_trials WHERE learner_id=$1
    ON CONFLICT DO NOTHING`,
    [learnerId, event],
  );
}
