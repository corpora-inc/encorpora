/**
 * Layer S — skill proficiency.
 *
 *   P    = c + (1 − c)·σ(θ_s − b_item)      c = guess floor: 0 free entry, 1/k choice
 *   θ_s += U(n_s)·w·(y′ − P)                U(n) = 0.9 / (1 + 0.06n)
 *
 * with asymmetric credit (×1.0 correct, ×0.7 incorrect) so one mis-tap never
 * craters a child, and 0.15× of the residual propagating to direct prerequisites.
 *
 * Every function here is pure: state in, state out, no clock, no randomness. The
 * caller owns the day number, which is why `Day` is a parameter and not a lookup.
 */

import {
  CREDIT_CORRECT,
  CREDIT_INCORRECT,
  FLUENCY_RATE,
  MASTERED_MARGIN,
  MASTERED_MIN_ATTEMPTS,
  PRACTICED_MARGIN,
  PRACTICED_MIN_ATTEMPTS,
  PREREQ_PROPAGATION,
  RETIREMENT_DAYS,
  UPDATE_RATE_DECAY,
  UPDATE_RATE_NUMERATOR,
} from "./constants.ts";
import { ONE, ZERO, add, div, fromInt, mul, sub } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { sigmoid } from "./math/logistic.ts";
import { NEW_SKILL_STATE } from "./types.ts";
import type { AttemptOutcome, Day, MasteryLevel, SkillState } from "./types.ts";

/**
 * `P = c + (1 − c)·σ(θ − b)`.
 *
 * The guess floor is what stops a 4-way choice item being read as evidence of
 * knowing something: a child who knows nothing still gets a quarter of them right,
 * so the model must expect that before it updates on it.
 */
export function predictP(theta: Fix, itemDifficulty: Fix, guessFloor: Fix): Fix {
  const base = sigmoid(sub(theta, itemDifficulty));
  return add(guessFloor, mul(sub(ONE, guessFloor), base));
}

/** `U(n) = 0.9 / (1 + 0.06n)` — the update shrinks as evidence accumulates. */
export function updateRate(attempts: number): Fix {
  if (attempts < 0) throw new RangeError("updateRate: negative attempt count");
  return div(UPDATE_RATE_NUMERATOR, add(ONE, mul(UPDATE_RATE_DECAY, fromInt(attempts))));
}

export type SkillUpdate = {
  readonly state: SkillState;
  /** The residual `U·w·(y′ − P)` that was applied. Prerequisites take 0.15× of it. */
  readonly delta: Fix;
  readonly predicted: Fix;
};

/**
 * Apply one answered card to a skill.
 *
 * `skillDifficulty` is the node's own `b̄`, used only for the mastery decision —
 * θ is meaningless without something to compare it to, and comparing it to the
 * item that happened to be served would make promotion depend on the draw.
 */
export function applyAttempt(
  state: SkillState,
  outcome: AttemptOutcome,
  skillDifficulty: Fix,
  today: Day,
): SkillUpdate {
  const predicted = predictP(state.theta, outcome.itemDifficulty, outcome.guessFloor);
  const observed = outcome.correct ? ONE : ZERO;
  const credit = outcome.correct ? CREDIT_CORRECT : CREDIT_INCORRECT;
  const weight = mul(credit, outcome.evidenceWeight);
  const delta = mul(mul(updateRate(state.attempts), weight), sub(observed, predicted));

  const attempts = state.attempts + 1;
  const correct = state.correct + (outcome.correct ? 1 : 0);
  const consecutiveFailures = outcome.correct ? 0 : state.consecutiveFailures + 1;

  const moved: SkillState = {
    ...state,
    theta: add(state.theta, delta),
    phi: updateFluency(state.phi, outcome),
    attempts,
    correct,
    consecutiveFailures,
    freeEntryEvidence: state.freeEntryEvidence || (outcome.correct && !outcome.fromChoice),
    lastSeenDay: today,
    lastFailureDay: outcome.correct ? state.lastFailureDay : today,
  };

  return { state: promote(moved, skillDifficulty, today), delta, predicted };
}

/**
 * φ tracks *fluency*, not correctness: it rises on a fast correct answer and falls
 * on a slow one. It never gates promotion — A-05 says no skill promotion is ever
 * denied on latency alone — so it exists to route a child to short fluency bursts
 * rather than to harder problems.
 */
function updateFluency(phi: Fix, outcome: AttemptOutcome): Fix {
  if (!outcome.correct) return phi;
  const fluent = outcome.latencyMs <= FLUENT_LATENCY_MS ? ONE : ZERO;
  return add(phi, mul(FLUENCY_RATE, sub(fluent, phi)));
}

/** PROVISIONAL: the latency below which an answer counts as recalled, not computed. */
export const FLUENT_LATENCY_MS = 4000;

/**
 * Decide the mastery level.
 *
 * Two rules here are not knobs:
 *  - a choice item can never advance a skill past Practiced, so `freeEntryEvidence`
 *    is required for Mastered;
 *  - latency never blocks a promotion, so φ appears nowhere in this function.
 */
export function promote(state: SkillState, skillDifficulty: Fix, today: Day): SkillState {
  const level = masteryFor(state, skillDifficulty, today);
  if (level === state.level) return state;
  return {
    ...state,
    level,
    masteredSinceDay: level === "mastered" && state.level !== "mastered" ? today : state.masteredSinceDay,
  };
}

export function masteryFor(state: SkillState, skillDifficulty: Fix, today: Day): MasteryLevel {
  const mastered =
    state.attempts >= MASTERED_MIN_ATTEMPTS &&
    state.theta >= add(skillDifficulty, MASTERED_MARGIN) &&
    state.consecutiveFailures === 0 &&
    state.freeEntryEvidence;

  if (mastered) {
    // Retirement only applies to a skill that is *already* mastered. Retiring one
    // at the moment it is promoted would hide it from the pools on the strength of
    // day stamps that predate its mastery.
    const alreadyMastered = state.level === "mastered" || state.level === "retired";
    const quietSince = Math.max(state.masteredSinceDay, state.lastFailureDay);
    const retired = alreadyMastered && today - quietSince >= RETIREMENT_DAYS;
    return retired ? "retired" : "mastered";
  }
  if (state.level === "retired" || state.level === "mastered") {
    // Demotion needs a real failure, not a quiet day.
    return state.consecutiveFailures > 0 ? "practiced" : state.level;
  }
  const practiced = state.attempts >= PRACTICED_MIN_ATTEMPTS && state.theta >= add(skillDifficulty, PRACTICED_MARGIN);
  return practiced ? "practiced" : "new";
}

/**
 * A prerequisite gets 0.15× of the residual. Nothing else about it changes: it was
 * not practised, so its attempt count, its streak and its mastery level are not
 * evidence of anything new.
 */
export function propagateToPrerequisite(state: SkillState, delta: Fix): SkillState {
  return { ...state, theta: add(state.theta, mul(PREREQ_PROPAGATION, delta)) };
}

/** Seed a skill at cold start. One grade question, no placement test. */
export function seedSkill(theta: Fix, today: Day): SkillState {
  return { ...NEW_SKILL_STATE, theta, lastSeenDay: today, lastFailureDay: today, masteredSinceDay: today };
}
