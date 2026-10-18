import {
  strandEstimate,
  targetGrade,
  type Frontier,
} from "../learning/frontier";
import { templates } from "../math/engine";
import { skills } from "../curriculum/catalog";
import { templateGrade } from "./mixed-practice";
import { teachingMaterial } from "./trial-material";
import type { PoolClient } from "pg";
import type { Outcome } from "./repository";
import { TRIAL_ATTEMPTS } from "./trials";

export const TEACHING_ATTEMPTS = 4;
export type TrialProgress = {
  phase: "placement" | "lesson" | "teaching" | "complete";
  templateId: string | null;
  placementAnswered: number;
  totals: { independent: number; assisted: number };
  before: { correct: number; answered: number };
  after: {
    correct: number;
    answered: number;
    assisted: number;
    independentCorrect: number;
  };
};

/** Choose a family actually attempted, prioritizing independent errors. The
 * latest such error stays near the learner's observed frontier. */
export function trialProgress(
  attempts: Outcome[],
  templateId: string | null,
  started: boolean,
): TrialProgress {
  const placement = attempts.slice(0, TRIAL_ATTEMPTS);
  const selected =
    templateId ??
    [...placement].reverse().find((a) => !a.correct && !a.assisted)
      ?.templateId ??
    placement.at(-1)?.templateId ??
    null;
  const before = placement.filter(
    (a) => a.templateId === selected && !a.assisted,
  );
  const after = attempts.slice(TRIAL_ATTEMPTS);
  return {
    phase:
      placement.length < TRIAL_ATTEMPTS
        ? "placement"
        : !started
          ? "lesson"
          : after.length < TEACHING_ATTEMPTS
            ? "teaching"
            : "complete",
    templateId: selected,
    placementAnswered: placement.length,
    totals: {
      independent: attempts.filter((a) => !a.assisted).length,
      assisted: attempts.filter((a) => a.assisted).length,
    },
    before: {
      correct: before.filter((a) => a.correct).length,
      answered: before.length,
    },
    after: {
      correct: after.filter((a) => a.correct).length,
      answered: after.length,
      assisted: after.filter((a) => a.assisted).length,
      independentCorrect: after.filter((a) => a.correct && !a.assisted).length,
    },
  };
}

export async function readTrialProgress(
  db: PoolClient,
  learnerId: string,
  frontier: () => Promise<Frontier>,
): Promise<TrialProgress | null> {
  const trial = await db.query(
    `SELECT t.teaching_template_id,t.teaching_started_at FROM amp_trials t JOIN amp_learners l ON l.id=t.learner_id
     WHERE t.learner_id=$1 AND l.account_id='trial:'||t.id AND t.adopted_at IS NULL AND t.expires_at>now()`,
    [learnerId],
  );
  if (!trial.rowCount) return null;
  const attempts = await db.query(
    "SELECT a.outcome,i.content->'public' AS problem FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id AND i.learner_id=a.learner_id WHERE a.learner_id=$1 ORDER BY a.evidence_sequence",
    [learnerId],
  );
  const placement = attempts.rows.slice(0, TRIAL_ATTEMPTS);
  let selected = trial.rows[0].teaching_template_id;
  if (!selected && placement.length >= TRIAL_ATTEMPTS) {
    const nodes = new Map(skills.map((s) => [s.id, s]));
    const estimate = await frontier();
    const distance = (template: (typeof templates)[number]) =>
      templateGrade(template, nodes) -
      targetGrade(
        strandEstimate(estimate, nodes.get(template.skillId)?.strand ?? "math"),
      );
    const reachable = templates.filter((template) => distance(template) <= 1);
    const candidates = [
      ...new Set([
        ...[...placement]
          .reverse()
          .filter((r) => !r.outcome.correct && !r.outcome.assisted)
          .map((r) => r.outcome.templateId),
        ...[...placement].reverse().map((r) => r.outcome.templateId),
        ...[...reachable]
          .sort((a, b) => Math.abs(distance(a)) - Math.abs(distance(b)))
          .map((t) => t.id),
      ]),
    ];
    const issued = await db.query(
      "SELECT content->'public' AS problem FROM amp_instances WHERE learner_id=$1 AND NOT COALESCE((content->>'trialTeaching')::boolean,false)",
      [learnerId],
    );
    selected = candidates.find(
      (id) =>
        reachable.some((t) => t.id === id) &&
        teachingMaterial(
          id,
          learnerId,
          issued.rows.map((r) => r.problem),
        ),
    );
    if (!selected)
      throw Object.assign(
        new Error("No trial lesson is available at this level"),
        { statusCode: 409 },
      );
  }
  return trialProgress(
    attempts.rows.map((row) => row.outcome),
    selected ?? null,
    !!trial.rows[0].teaching_started_at,
  );
}

/** Only a random analytics id and a fixed event name enter the event table. */
export async function recordTrialEvent(
  db: PoolClient,
  learnerId: string,
  event:
    | "trial_started"
    | "placement_done"
    | "teaching_done"
    | "paywall"
    | "purchase",
) {
  await db.query(
    `INSERT INTO amp_trial_events(trial_id,event)
    SELECT analytics_id,$2 FROM amp_trials WHERE learner_id=$1
    ON CONFLICT DO NOTHING`,
    [learnerId, event],
  );
}
