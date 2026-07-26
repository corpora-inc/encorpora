/**
 * The answer path — everything the engine does with one answered card.
 *
 * This is the function gate EG-4 budgets at **p99 under 1 ms**, and it is the
 * only place the three layers meet. The order matters and is not arbitrary:
 *
 *   1. **Classify the error before weighting it.** A self-corrected answer is a
 *      slip whatever else is true, and a slip never increments a bug. Deciding
 *      the weight first and the kind second is how a careless child ends up
 *      diagnosed with a misconception they do not have.
 *   2. **Layer B never subtracts from θ.** A child with a consistent buggy
 *      procedure is not less able; they are doing something specific and fixable.
 *      An engine that docks θ for it makes the whole model read as "you are bad
 *      at this", which is the failure BKT was rejected for.
 *   3. **Fatigue freezes levels, it does not lower them.** `A-07` asks that
 *      replaying a session with the post-fatigue window excluded yields an
 *      *identical* set of skill levels. That is only true if promotion and
 *      demotion both stop at the fatigue boundary — halving the evidence weight
 *      alone does not get there, because a single tired failure is still a
 *      `consecutiveFailures > 0` and `masteryFor` demotes on one of those.
 *
 * Everything is pure. The caller owns the day number and the wall clock; the
 * engine reads neither.
 */

import {
  EVIDENCE_FULL,
  EVIDENCE_HALVED,
  EVIDENCE_LUCKY_CHOICE,
  FATIGUE_P_TARGET,
  MAX_EVENTS,
  MAX_ROLLUPS,
  ROLLING_WINDOW,
} from "./constants.ts";
import { classifyError, isBugActive, pruneBugs, updateBug } from "./bugs.ts";
import type { ErrorKind } from "./bugs.ts";
import { preferredForm, skillMeta } from "./catalog.ts";
import type { Catalog } from "./catalog.ts";
import { updatePTarget } from "./controller.ts";
import { isFactEligible, latencyZ, observeLatency, ratingFor } from "./facts.ts";
import type { FactScheduler } from "./facts.ts";
import { fsrsScheduler } from "./fsrs.ts";
import { ZERO, mul, sub } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { applyAttempt, propagateToPrerequisite } from "./skill.ts";
import { NEW_SKILL_STATE, bugKey, factKey } from "./types.ts";
import type {
  AttemptOutcome,
  BugId,
  EngineEvent,
  LearnerState,
  SessionRollup,
  SkillId,
  SkillState,
} from "./types.ts";
import type { SessionContext } from "./select.ts";
import { replanReasons } from "./select.ts";
import type { PlannedCard } from "./scheduler.ts";

/** What the app observed. The engine derives everything else from these. */
export type Answer = {
  readonly correct: boolean;
  readonly latencyMs: number;
  /** Answer revisions before submitting. The cleanest slip signal there is. */
  readonly revisions: number;
  /** The mal-rule the wrong answer matched, if exactly one did. */
  readonly misconception?: BugId;
  /** Minutes into this session, for the fatigue detector. */
  readonly minutesElapsed?: number;
};

export type ApplyResult = {
  readonly learner: LearnerState;
  readonly context: SessionContext;
  /** Rules that would be broken by serving the rest of the planned batch. */
  readonly replan: readonly string[];
  /** What the error was, so the app can route Stage 1 / Stage 2 / Stage 3. */
  readonly errorKind: ErrorKind;
  /** True when this answer made a misconception active — the Stage-2 trigger. */
  readonly bugBecameActive: boolean;
  readonly evidenceWeight: Fix;
};

export type ApplyOptions = {
  readonly facts?: FactScheduler;
  /** Record to the Developer-Mode ring. Compiled out in production (`A-18`). */
  readonly devMode?: boolean;
  /**
   * `A-17`: with speed rewards off, **every** latency-derived path is removed —
   * not just the visible one. φ stops moving, the FSRS rating stops reading the
   * clock, and the fatigue detector stops looking at latency.
   */
  readonly speedRewards?: boolean;
};

const DEFAULT_FACTS = fsrsScheduler();

/**
 * A correct answer that came back implausibly fast on a closed list is worth
 * 0.3, not 1. Fast is measured against the child's own baseline, so a quick
 * ten-year-old and a deliberate six-year-old are not held to one clock.
 */
function isLuckyLooking(context: SessionContext, learner: LearnerState, card: PlannedCard, answer: Answer): boolean {
  if (!answer.correct || card.formId === "") return false;
  const z = latencyZ(learner.latency, answer.latencyMs);
  return z < LUCKY_Z && context.served > 0;
}

/** More than a standard deviation faster than this child's own median. */
const LUCKY_Z: Fix = -1_000_000 as Fix;

function evidenceWeightFor(
  learner: LearnerState,
  context: SessionContext,
  card: PlannedCard,
  answer: Answer,
  kind: ErrorKind,
  fromChoice: boolean,
): Fix {
  if (context.fatigued) return EVIDENCE_HALVED;
  if (!answer.correct && kind === "unclassified" && (learner.skills[card.skillId]?.consecutiveFailures ?? 0) === 0) {
    // Stage 1 VERIFY: a first, unexplained error is worth half. It is far more
    // often a mis-tap than a discovery about the child.
    return EVIDENCE_HALVED;
  }
  if (fromChoice && isLuckyLooking(context, learner, card, answer)) return EVIDENCE_LUCKY_CHOICE;
  return EVIDENCE_FULL;
}

function clampRing<T>(items: readonly T[], cap: number): readonly T[] {
  return items.length <= cap ? items : items.slice(items.length - cap);
}

function rollupWith(
  rollups: readonly SessionRollup[],
  day: number,
  correct: boolean,
  latencyMs: number,
  fatigued: boolean,
): readonly SessionRollup[] {
  const last = rollups[rollups.length - 1];
  const seconds = Math.round(latencyMs / 1000);
  if (last !== undefined && last.day === day) {
    const updated: SessionRollup = {
      ...last,
      served: last.served + 1,
      correct: last.correct + (correct ? 1 : 0),
      seconds: last.seconds + seconds,
      fatiguedCards: last.fatiguedCards + (fatigued ? 1 : 0),
    };
    return [...rollups.slice(0, -1), updated];
  }
  const fresh: SessionRollup = {
    day,
    served: 1,
    correct: correct ? 1 : 0,
    minutes: 0,
    seconds,
    fatiguedCards: fatigued ? 1 : 0,
  };
  return clampRing([...rollups, fresh], MAX_ROLLUPS);
}

/**
 * Apply one answered card.
 *
 * `remaining` is the rest of the planned batch; it is read only to decide whether
 * to throw it away. Passing it in rather than storing it keeps the engine's state
 * free of anything the app already owns.
 */
export function applyResult(
  catalog: Catalog,
  learner: LearnerState,
  context: SessionContext,
  card: PlannedCard,
  answer: Answer,
  remaining: readonly PlannedCard[] = [],
  options: ApplyOptions = {},
): ApplyResult {
  const meta = skillMeta(catalog, card.skillId);
  if (meta === undefined) throw new RangeError(`applyResult: no skill ${card.skillId}`);
  const level = meta.levels[card.level];
  if (level === undefined) throw new RangeError(`applyResult: ${card.skillId} has no level ${String(card.level)}`);
  const form = level.forms.find((entry) => entry.id === card.formId) ?? preferredForm(level);
  const fromChoice = form.guessFloor > ZERO;
  const speedRewards = options.speedRewards !== false;

  const kind = classifyError({
    correct: answer.correct,
    latencyMs: answer.latencyMs,
    revisions: answer.revisions,
    itemDifficulty: level.b,
    guessFloor: form.guessFloor,
    fromChoice,
    evidenceWeight: EVIDENCE_FULL,
    ...(answer.misconception === undefined ? {} : { misconception: answer.misconception }),
  });

  const evidenceWeight = evidenceWeightFor(learner, context, card, answer, kind, fromChoice);
  const outcome: AttemptOutcome = {
    correct: answer.correct,
    // With speed rewards off the model is told a neutral latency, which is what
    // removes *every* latency-derived path rather than the visible ones.
    latencyMs: speedRewards ? answer.latencyMs : NEUTRAL_LATENCY_MS,
    revisions: answer.revisions,
    itemDifficulty: level.b,
    guessFloor: form.guessFloor,
    fromChoice,
    evidenceWeight,
    ...(answer.misconception === undefined ? {} : { misconception: answer.misconception }),
  };

  const before = learner.skills[card.skillId] ?? NEW_SKILL_STATE;
  const update = applyAttempt(before, outcome, meta.b, context.day);
  // Fatigue freezes the level. Not the estimate — the *level*, which is what
  // `A-07` is asserted against.
  const moved: SkillState = context.fatigued ? { ...update.state, level: before.level } : update.state;

  const skills: Record<SkillId, SkillState> = { ...learner.skills, [card.skillId]: moved };
  for (const prereq of meta.prereqs) {
    const state = skills[prereq] ?? NEW_SKILL_STATE;
    skills[prereq] = propagateToPrerequisite(state, update.delta);
  }

  const bugs = { ...learner.bugs };
  let bugBecameActive = false;
  if (kind === "misconception" && answer.misconception !== undefined && !context.fatigued) {
    const key = bugKey(card.skillId, answer.misconception);
    const wasActive = isBugActive(bugs[key]);
    bugs[key] = updateBug(bugs[key], true);
    bugBecameActive = !wasActive && isBugActive(bugs[key]);
  } else if (answer.correct) {
    // Decay on an **opportunity**, not on any correct answer.
    //
    // `β ← 0.9·β + 1{bug fired}` counts firings against chances to fire. A
    // borrow-across-zero mal-rule cannot fire on an item with no zero in it, so
    // decaying β for getting one of those right is decaying it for evidence that
    // does not exist — and it is most of the evidence, because the scheduler
    // serves easier items far more often than the ones that force the step.
    // Measured: with the decay on every correct answer, recall inside six firings
    // was 20/28 against the 0.85 the acceptance item asks for, because β never
    // reached 2.2 between two chances to fire.
    for (const bug of level.guarantees) {
      const key = bugKey(card.skillId, bug);
      if (bugs[key] !== undefined) bugs[key] = updateBug(bugs[key], false);
    }
  }

  const latency = speedRewards ? observeLatency(learner.latency, answer.latencyMs) : learner.latency;

  const facts = { ...learner.facts };
  const scheduler = options.facts ?? DEFAULT_FACTS;
  if (form.enumerable && isFactEligible(moved.phi)) {
    const key = factKey(card.skillId, card.level, form.id);
    const rating = ratingFor(answer.correct, outcome.latencyMs, learner.latency);
    const existing = facts[key];
    facts[key] =
      existing === undefined
        ? scheduler.create(context.day)
        : scheduler.review(existing, rating.rating, context.day, rating.capInterval && speedRewards);
  }

  const nextContext: SessionContext = {
    ...context,
    recentItems: clampRing([...context.recentItems, card.itemKey], ROLLING_WINDOW),
    // Follow-ups are excluded here for the same reason they are excluded from
    // `LearnerState.recent`: the 40% cap is about allocation, and a retry is not
    // an allocation. Keeping them in the session window but out of the persisted
    // one made the planner's denominator larger than the rule's, so it under-read
    // every share it was supposed to cap.
    recentSkills:
      card.followUp === undefined
        ? clampRing([...context.recentSkills, card.skillId], ROLLING_WINDOW)
        : context.recentSkills,
    outcomes: clampRing([...context.outcomes, answer.correct], ROLLING_WINDOW),
    failuresBySkill: answer.correct
      ? context.failuresBySkill
      : { ...context.failuresBySkill, [card.skillId]: (context.failuresBySkill[card.skillId] ?? 0) + 1 },
    served: context.served + 1,
    lastPHat: card.pHat,
    debutServed: card.pool === "NEW" ? context.debutServed + 1 : context.debutServed,
    debutSkill: card.pool === "NEW" ? (context.debutSkill ?? card.skillId) : context.debutSkill,
    repairedBugs:
      card.pool === "REPAIR" && !context.repairedBugs.includes(card.skillId)
        ? [...context.repairedBugs, card.skillId]
        : context.repairedBugs,
  };

  const events: readonly EngineEvent[] =
    options.devMode === true
      ? clampRing(
          [
            ...learner.events,
            {
              day: context.day,
              skillId: card.skillId,
              level: card.level,
              pool: card.pool,
              pHat: card.pHat,
              correct: answer.correct,
              latencyMs: answer.latencyMs,
            },
          ],
          MAX_EVENTS,
        )
      : learner.events;

  const nextLearner: LearnerState = {
    ...learner,
    // Fatigue raises the target and stops it moving with the child's misses: the
    // point is to make the rest of the session easy, not to chase a tired child's
    // accuracy downward.
    pTarget: context.fatigued ? FATIGUE_P_TARGET : updatePTarget(learner.pTarget, answer.correct),
    skills,
    bugs: pruneBugs(bugs),
    facts,
    latency,
    answered: learner.answered + 1,
    // Only freely-chosen cards count towards the rolling window. A Stage-1 retry
    // and a Stage-2 repair are the *same* skill by construction — that is what
    // they are for — so counting them would make the corrective model itself the
    // reason the 40% cap is breached, and the cap would be measuring the child's
    // errors rather than the scheduler's allocation.
    recent:
      card.followUp === undefined
        ? clampRing([...learner.recent, card.skillId], ROLLING_WINDOW)
        : learner.recent,
    rollups: rollupWith(learner.rollups, context.day, answer.correct, answer.latencyMs, context.fatigued),
    events,
  };

  return {
    learner: nextLearner,
    context: nextContext,
    replan: replanReasons(nextLearner, nextContext, remaining),
    errorKind: kind,
    bugBecameActive,
    evidenceWeight,
  };
}

/** The latency the model is told when speed rewards are off. Exactly the baseline. */
export const NEUTRAL_LATENCY_MS = 8000;

/**
 * Fold the fatigue verdict into the session.
 *
 * Separate from `applyResult` because the indicators are the app's observations —
 * minutes elapsed, the child's own typical session length — and mixing an
 * observation channel into the update path is how a pure function acquires a
 * clock.
 */
export function withFatigue(context: SessionContext, fatigued: boolean): SessionContext {
  return context.fatigued === fatigued ? context : { ...context, fatigued };
}

/** Accuracy over the session's first third, in points, for the fatigue detector. */
export function accuracyPoints(outcomes: readonly boolean[], from: number, to: number): number {
  const slice = outcomes.slice(from, to);
  if (slice.length === 0) return 100;
  return Math.round((slice.filter(Boolean).length * 100) / slice.length);
}

/** θ across every touched skill, for the anti-stagnation stall check. */
export function totalTheta(learner: LearnerState): Fix {
  let total: Fix = ZERO;
  for (const state of Object.values(learner.skills)) total = (total + state.theta) as Fix;
  return total;
}

/** Mean absolute residual `|y − P̂|`, exposed so calibration is measurable. */
export function residual(predicted: Fix, correct: boolean): Fix {
  const observed = (correct ? 1_000_000 : 0) as Fix;
  return (predicted > observed ? sub(predicted, observed) : sub(observed, predicted)) as Fix;
}

/** Scale a fixed-point value by a whole percentage. Used by the report. */
export function percentOf(value: Fix, percent: number): Fix {
  return mul(value, ((percent * 10_000) as Fix));
}
