/**
 * The scheduler seam, its trace type, and the invariants a batch has to satisfy.
 *
 * The selection policy itself lands at PR-5.6. What is here is the shape it has to
 * fit and the rules it has to obey — expressed as checkable functions rather than
 * as prose, because gate EG-6 requires every anti-frustration and anti-stagnation
 * rule to be its own named test, and a rule that only exists inside a scheduler
 * implementation cannot be one.
 *
 * The anti-stagnation half is not polish. Tripling practice on one problem type
 * (3 → 9 problems) had **no effect** on 1-week or 4-week test scores. Without the
 * window cap and the Retired state, a child who is good at times tables gets times
 * tables for ever — which is the difference between a tutor and a treadmill.
 */

import {
  BENCH_AFTER_FAILURES,
  DEBUT_BLOCK_MAX,
  DEBUT_BLOCK_MIN,
  FATIGUE_ACCURACY_DROP_POINTS,
  FATIGUE_INDICATORS_REQUIRED,
  MAX_CONSECUTIVE_SAME_SKILL,
  MAX_PER_OPERATION,
  MAX_REPAIR_FRACTION_PERCENT,
  MAX_WINDOW_SHARE_PERCENT,
  MIN_DISTINCT_SKILLS,
  NO_REPEAT_WINDOW,
  ROLLING_WINDOW,
} from "./constants.ts";
import { frustrationFloor } from "./controller.ts";
import type { CardIntent } from "./controller.ts";
import type { Fix } from "./math/fixed.ts";
import type { LearnerState, SkillId } from "./types.ts";

/** The nine pools a card can come from. */
export type Pool =
  | "REPAIR"
  | "PREREQ"
  | "DUE_FACT"
  | "FRONTIER"
  | "NEW"
  | "FLUENCY"
  | "REVIEW_SKILL"
  | "CHALLENGE"
  | "PLAY";

export const REPAIR_POOLS: readonly Pool[] = ["REPAIR"];

/**
 * Produced by the **same code path that made the decision**, so the explanation in
 * Developer Mode can never drift from the behaviour. Compiled out in production.
 */
export type SelectionTrace = {
  readonly cardId: string;
  readonly skillId: SkillId;
  readonly pool: Pool;
  readonly bTarget: Fix;
  readonly bActual: Fix;
  readonly pHat: Fix;
  readonly pTargetBand: readonly [Fix, Fix];
  readonly reasons: readonly string[];
  readonly rejected: readonly string[];
  readonly rngDraws: number;
  readonly seed: number;
};

export type PlannedCard = {
  readonly cardId: string;
  readonly skillId: SkillId;
  readonly level: number;
  readonly formId: string;
  readonly seed: number;
  readonly pool: Pool;
  readonly intent: CardIntent;
  readonly pHat: Fix;
  /** A tag the interleaving rule groups on — `add`, `sub`, `mul`, `div`. */
  readonly operation: string;
  /** Identifies the exact item, for the no-repeat window. */
  readonly itemKey: string;
  readonly trace?: SelectionTrace;
};

export type AppliedResult = {
  readonly card: PlannedCard;
  readonly correct: boolean;
};

/**
 * The engine's whole public surface to the app. Both methods are pure: the state
 * goes in and a new state comes out, with no persistence and no clock behind them.
 */
export type Scheduler = {
  readonly name: string;
  nextExercises(state: LearnerState, count: number): readonly PlannedCard[];
  applyResult(state: LearnerState, result: AppliedResult): LearnerState;
};

export type Violation = {
  readonly rule: string;
  readonly detail: string;
};

/**
 * Interleaving: within any batch of 8, ≤2 consecutive from one skill, ≤3 from one
 * operation, ≥3 distinct skills once ≥3 are reachable.
 *
 * Interleaved practice *impairs* in-session performance while roughly **doubling**
 * next-day test scores. That trade-off is surfaced in Developer Mode precisely so
 * nobody "fixes" the deliberately depressed in-session accuracy.
 *
 * The one exception: a brand-new skill gets a blocked debut of 3–4 consecutive
 * guided items.
 */
export function checkInterleaving(
  batch: readonly PlannedCard[],
  options: { readonly reachableSkills: number; readonly debutSkill?: SkillId } = { reachableSkills: 0 },
): Violation[] {
  const violations: Violation[] = [];
  if (batch.length === 0) return violations;

  let run = 1;
  for (let i = 1; i < batch.length; i++) {
    const current = batch[i];
    const previous = batch[i - 1];
    if (current === undefined || previous === undefined) continue;
    if (current.skillId !== previous.skillId) {
      run = 1;
      continue;
    }
    run += 1;
    const isDebut = options.debutSkill !== undefined && current.skillId === options.debutSkill;
    const limit = isDebut ? DEBUT_BLOCK_MAX : MAX_CONSECUTIVE_SAME_SKILL;
    if (run > limit) {
      violations.push({
        rule: "max-consecutive-same-skill",
        detail: `${String(run)} consecutive cards from ${current.skillId} (limit ${String(limit)})`,
      });
      run = 0;
    }
  }

  // The blocked-debut exception has to cover the operation rule as well as the
  // consecutive-skill rule. ADAPTIVE_LEARNING.md states it against the latter, but
  // four consecutive cards of one skill are necessarily four cards of one
  // operation, so counting them against a limit of three would make the stated
  // 3-4 card debut unsatisfiable. The debut cards are therefore excluded from the
  // operation count, and only while the debut is itself within its stated length.
  const debutCards =
    options.debutSkill === undefined ? 0 : batch.filter((card) => card.skillId === options.debutSkill).length;
  const legitimateDebut = debutCards >= DEBUT_BLOCK_MIN && debutCards <= DEBUT_BLOCK_MAX;

  const perOperation = new Map<string, number>();
  for (const card of batch) {
    if (legitimateDebut && card.skillId === options.debutSkill) continue;
    perOperation.set(card.operation, (perOperation.get(card.operation) ?? 0) + 1);
  }
  for (const [operation, count] of perOperation) {
    if (count > MAX_PER_OPERATION) {
      violations.push({
        rule: "max-per-operation",
        detail: `${String(count)} cards of operation ${operation} (limit ${String(MAX_PER_OPERATION)})`,
      });
    }
  }

  const distinct = new Set(batch.map((card) => card.skillId)).size;
  if (options.reachableSkills >= MIN_DISTINCT_SKILLS && distinct < MIN_DISTINCT_SKILLS && !legitimateDebut) {
    violations.push({
      rule: "min-distinct-skills",
      detail: `${String(distinct)} distinct skills with ${String(options.reachableSkills)} reachable`,
    });
  }

  const repair = batch.filter((card) => REPAIR_POOLS.includes(card.pool)).length;
  if (repair * 100 > batch.length * MAX_REPAIR_FRACTION_PERCENT) {
    violations.push({
      rule: "max-repair-share",
      detail: `${String(repair)}/${String(batch.length)} repair cards (limit ${String(MAX_REPAIR_FRACTION_PERCENT)}%)`,
    });
  }

  return violations;
}

/**
 * The anti-frustration rules that are properties of a *sequence*: no identical item
 * within 6 cards, never two consecutive items below `pTarget − 0.20`, never more
 * than 2 failures in any window of 5 without a `pTarget + 0.10` card, a skill
 * benched after 3 failures, and never ending a session on a failure.
 */
export function checkSequence(
  cards: readonly PlannedCard[],
  outcomes: readonly boolean[],
  pTarget: Fix,
  options: { readonly sessionEnded: boolean } = { sessionEnded: false },
): Violation[] {
  const violations: Violation[] = [];
  const floor = frustrationFloor(pTarget);

  cards.forEach((card, index) => {
    const earlier = cards.slice(Math.max(0, index - NO_REPEAT_WINDOW), index);
    if (earlier.some((other) => other.itemKey === card.itemKey)) {
      violations.push({
        rule: "no-repeat-window",
        detail: `${card.itemKey} re-served within ${String(NO_REPEAT_WINDOW)} cards`,
      });
    }
    const previous = index > 0 ? cards[index - 1] : undefined;
    if (previous !== undefined && card.pHat < floor && previous.pHat < floor) {
      violations.push({ rule: "no-two-hard-in-a-row", detail: `cards ${String(index - 1)} and ${String(index)}` });
    }
  });

  for (let end = 5; end <= outcomes.length; end++) {
    const fiveCards = outcomes.slice(end - 5, end);
    const failures = fiveCards.filter((correct) => !correct).length;
    if (failures <= 2) continue;
    const relief = cards.slice(end - 5, end).some((card) => card.intent === "confidence");
    if (!relief) {
      violations.push({
        rule: "failure-relief",
        detail: `${String(failures)} failures in cards ${String(end - 5)}..${String(end - 1)} with no confidence card`,
      });
    }
  }

  const failuresBySkill = new Map<SkillId, number>();
  cards.forEach((card, index) => {
    if (outcomes[index] === false) {
      const count = (failuresBySkill.get(card.skillId) ?? 0) + 1;
      failuresBySkill.set(card.skillId, count);
      const laterSameSkill = cards.slice(index + 1).some((other) => other.skillId === card.skillId);
      if (count >= BENCH_AFTER_FAILURES && laterSameSkill) {
        violations.push({ rule: "bench-after-failures", detail: `${card.skillId} served after ${String(count)} failures` });
      }
    }
  });

  if (options.sessionEnded && outcomes.length > 0 && outcomes.at(-1) === false) {
    violations.push({ rule: "never-end-on-failure", detail: "the session's last card was failed" });
  }

  const perSkill = new Map<SkillId, number>();
  const recent = cards.slice(-ROLLING_WINDOW);
  for (const card of recent) perSkill.set(card.skillId, (perSkill.get(card.skillId) ?? 0) + 1);
  for (const [skill, count] of perSkill) {
    if (recent.length >= ROLLING_WINDOW && count * 100 > recent.length * MAX_WINDOW_SHARE_PERCENT) {
      violations.push({
        rule: "max-window-share",
        detail: `${skill} is ${String(count)}/${String(recent.length)} of the rolling window`,
      });
    }
  }

  return violations;
}

export type FatigueSignals = {
  /** Latency EWMA is rising while accuracy holds. */
  readonly latencyRising: boolean;
  /** Accuracy in this third of the session, in points. */
  readonly accuracyNowPoints: number;
  readonly accuracyFirstThirdPoints: number;
  readonly minutesElapsed: number;
  /** The child's own typical session length, in minutes. */
  readonly personalSessionMinutes: number;
};

/**
 * Fatigue is an **anti-punitive** mechanism, not a difficulty one: two indicators
 * and the engine halves the evidence weight, raises `pTarget` to 0.90, stops
 * introducing skills and stops scheduling repair. Assertion A-07 is that replaying
 * a session with the post-fatigue window excluded yields an identical set of skill
 * levels — zero demotions attributable to tiredness.
 */
export function detectFatigue(signals: FatigueSignals): boolean {
  let indicators = 0;
  if (signals.latencyRising) indicators += 1;
  if (signals.accuracyFirstThirdPoints - signals.accuracyNowPoints >= FATIGUE_ACCURACY_DROP_POINTS) indicators += 1;
  if (signals.minutesElapsed > signals.personalSessionMinutes) indicators += 1;
  return indicators >= FATIGUE_INDICATORS_REQUIRED;
}
