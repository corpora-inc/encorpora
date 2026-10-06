import { getSkill } from "../learning/curriculum";
import { REVIEW_DAYS } from "../learning/engine";
import { evidenceSkillIds, type AttemptEvidence, type LearnerState } from "../learning/types";

/** The focus loop never ends; every LAP answers it marks a lap with a small recap. */
export const LAP = 10;
const DAY = 86_400_000;

/** A skill practised this lap. `growth` names a change this lap made, in the Growth page's words:
 * `rooted` (it newly reached three different correct answers in a row, "Taking root") or
 * `remembered` (a second delayed review confirmed it, "Remembered"). */
export interface LapSkill { id: string; title: string; growth?: "rooted" | "remembered" }
export interface LapRecap {
  /** The lap's answers, oldest first: true for correct. Set-aside answers are left out. */
  answers: boolean[];
  correct: number;
  /** One to three skills, changes first, then the most practised. */
  skills: LapSkill[];
  /** Consecutive days with practice (application/growth.ts). */
  streak: number;
}

/** Distinct tasks answered independently since the last assisted or wrong answer (engine.ts's rule). */
function distinctSinceError(history: readonly AttemptEvidence[]): number {
  const since = history.slice(history.map(a => !a.independent).lastIndexOf(true) + 1);
  return new Set(since.map(a => a.variant)).size;
}

/**
 * The recap of the lap that just ended: the learner's last `size` answers, from durable evidence
 * only, so local practice and AI-authored activities count alike. Pure and cheap (no replay): a
 * skill is newly "taking root" when it is provisional now but was not before the lap, and newly
 * "remembered" when it is retained at review stage 2 and that stage was reached during the lap (the
 * engine schedules the next review REVIEW_DAYS[2] days after the review that reaches stage 2).
 */
export function lapRecap(learner: Pick<LearnerState, "attempts" | "progress"> | undefined, streak: number, size = LAP): LapRecap | undefined {
  const lap = (learner?.attempts ?? []).slice(-size).filter(a => !a.excluded);
  if (!learner || !lap.length) return undefined;
  const lapIds = new Set(lap.map(a => a.id));
  const start = Date.parse(lap[0]!.at);
  const counts = new Map<string, { n: number; last: number }>();
  lap.forEach((a, i) => {
    for (const id of evidenceSkillIds(a)) if (getSkill(id)) counts.set(id, { n: (counts.get(id)?.n ?? 0) + 1, last: i });
  });
  const growthOf = (id: string): LapSkill["growth"] => {
    const p = learner.progress[id];
    if (!p) return undefined;
    const reached = p.nextReviewAt ? Date.parse(p.nextReviewAt) - REVIEW_DAYS[2] * DAY : NaN;
    if (p.retention === "retained" && p.reviewStage === 2 && reached >= start) return "remembered";
    if (p.concept !== "provisional") return undefined;
    const before = learner.attempts.filter(a => !a.excluded && !lapIds.has(a.id) && evidenceSkillIds(a).includes(id));
    return distinctSinceError(before) < 3 ? "rooted" : undefined;
  };
  const rank = { remembered: 0, rooted: 1 } as const;
  const skills = [...counts].map(([id, c]) => ({ id, title: getSkill(id)!.title, growth: growthOf(id), ...c }))
    .sort((x, y) => (x.growth ? rank[x.growth] : 2) - (y.growth ? rank[y.growth] : 2) || y.n - x.n || y.last - x.last)
    .slice(0, 3)
    .map(({ id, title, growth }) => (growth ? { id, title, growth } : { id, title }));
  const answers = lap.map(a => a.correct);
  return { answers, correct: answers.filter(Boolean).length, skills, streak };
}
