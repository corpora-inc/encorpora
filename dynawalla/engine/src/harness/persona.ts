/**
 * The synthetic children — and the one thing about them that matters most.
 *
 * ## Why this file is not the engine's model with different constants
 *
 * The original reliability gate had the engine computing `σ(θ − b)` while the
 * persona answered from `σ(α − b)` against the **same `b`**. That check passes by
 * construction: the engine's only job is to estimate `α`, and if `b` is shared
 * and the functional form is shared then a converged estimate reproduces the
 * simulator exactly. It measured nothing, and it would have kept measuring
 * nothing for as long as anyone looked at it.
 *
 * The corrected model differs from the engine's in **three** ways, each of which
 * the engine has no way to observe:
 *
 *   1. **Per-child discrimination `a_i`.** The engine's model is a 1PL — every
 *      item discriminates identically. Real children have different slopes, and
 *      `a_i` here ranges over roughly 0.7–1.6.
 *   2. **Item features outside the curriculum's `b`.** Visual load, digit count
 *      and working-memory span shift the *true* difficulty by up to about half a
 *      logit in either direction. The engine sees only `b`.
 *   3. **A structured offset**, for the misspecification persona only: its true
 *      difficulty differs from the engine's `b` by a systematic function of level
 *      and grade, not by noise. Noise averages out of a reliability diagram;
 *      structure does not, which is the point.
 *
 * What this proves and what it does not: EG-5 passing means the engine's
 * predicted probabilities are calibrated **against a response process it does not
 * share**. It does not mean the engine is calibrated against children. Only the
 * `A-02` real-child residual fixture speaks to that, and it is one child's data
 * — a gross-mismatch detector, not a calibration.
 *
 * ## Ability is not fixed
 *
 * Corpán's harness modelled fixed ability, which made three of its eleven ship
 * gates mathematically unsatisfiable under any scheduler and cost two calibration
 * rounds to discover. The synthetic child here **learns from day one**: `α += 0.08`
 * per spaced success, capped at +1.5, with no same-day credit.
 */

import { malRuleOf } from "./catalog.ts";
import type { Catalog, SkillMeta } from "../catalog.ts";
import { ONE, ZERO, add, clamp, fromInt, fromRatio, mul, sub, toRoundedInt } from "../math/fixed.ts";
import type { Fix } from "../math/fixed.ts";
import { exp } from "../math/elementary.ts";
import { sigmoid } from "../math/logistic.ts";
import { bernoulli, draw, fingerprint } from "../math/rng.ts";
import type { BugId, Day, SkillId } from "../types.ts";
import type { PlannedCard } from "../scheduler.ts";

export type PersonaId =
  | "steady-strong"
  | "struggling"
  | "fast-careless"
  | "slow-accurate"
  | "accurate-counter-on"
  | "single-misconception"
  | "returning-lapser"
  | "pure-guesser"
  | "rapid-improver"
  | "fatiguer"
  | "misspecification";

/** The ten behavioural personas. The eleventh is EG-5's instrument, not an outcome. */
export const BEHAVIOURAL_PERSONAS: readonly PersonaId[] = [
  "steady-strong",
  "struggling",
  "fast-careless",
  "slow-accurate",
  "accurate-counter-on",
  "single-misconception",
  "returning-lapser",
  "pure-guesser",
  "rapid-improver",
  "fatiguer",
];

export const ALL_PERSONAS: readonly PersonaId[] = [...BEHAVIOURAL_PERSONAS, "misspecification"];

export type PersonaSpec = {
  readonly id: PersonaId;
  /** Starting ability relative to the skill's own `b̄`. */
  readonly abilityOffset: Fix;
  /** Ability gained per spaced success. */
  readonly growth: Fix;
  /** Probability a would-be-correct answer comes back wrong anyway. */
  readonly slipRate: Fix;
  /** Probability a slip is caught and revised before submitting. */
  readonly reviseRate: Fix;
  /** Median latency in milliseconds at `α = b`. */
  readonly baseLatencyMs: number;
  /** How much slower an item a logit above the child's ability comes back. */
  readonly latencySlope: Fix;
  /** Answers at chance regardless of ability. */
  readonly guessing: boolean;
  /** Carries one mal-rule and applies it wherever the item exercises the step. */
  readonly carriesBug: boolean;
  /** Days absent between runs of active days. Zero means never absent. */
  readonly lapseDays: number;
  readonly activeDaysBeforeLapse: number;
  /** Minutes into a session before fatigue sets in. Zero means never. */
  readonly fatigueAfterMinutes: number;
  /** True difficulty differs from the engine's `b` by a structured offset. */
  readonly misspecified: boolean;
};

const r = fromRatio;

export const PERSONAS: Readonly<Record<PersonaId, PersonaSpec>> = {
  "steady-strong": base({ id: "steady-strong", abilityOffset: r(6, 10), growth: r(8, 100), slipRate: r(2, 100) }),
  struggling: base({
    id: "struggling",
    abilityOffset: r(-9, 10),
    growth: r(6, 100),
    slipRate: r(6, 100),
    baseLatencyMs: 11_000,
  }),
  "fast-careless": base({
    id: "fast-careless",
    abilityOffset: r(7, 10),
    growth: r(8, 100),
    slipRate: r(18, 100),
    reviseRate: r(35, 100),
    baseLatencyMs: 3_200,
  }),
  "slow-accurate": base({
    id: "slow-accurate",
    abilityOffset: r(4, 10),
    growth: r(8, 100),
    slipRate: r(1, 100),
    baseLatencyMs: 21_000,
  }),
  // High ability, permanently slow: the child who can do it and is still
  // counting. Layer F must never accumulate a long-interval card for them.
  "accurate-counter-on": base({
    id: "accurate-counter-on",
    abilityOffset: r(9, 10),
    growth: r(8, 100),
    slipRate: r(2, 100),
    baseLatencyMs: 26_000,
  }),
  "single-misconception": base({
    id: "single-misconception",
    abilityOffset: r(4, 10),
    growth: r(8, 100),
    slipRate: r(3, 100),
    carriesBug: true,
  }),
  "returning-lapser": base({
    id: "returning-lapser",
    abilityOffset: r(3, 10),
    growth: r(8, 100),
    slipRate: r(4, 100),
    lapseDays: 21,
    activeDaysBeforeLapse: 14,
  }),
  "pure-guesser": base({ id: "pure-guesser", abilityOffset: r(-25, 10), growth: ZERO, guessing: true, baseLatencyMs: 2_400 }),
  "rapid-improver": base({ id: "rapid-improver", abilityOffset: r(-6, 10), growth: r(24, 100), slipRate: r(4, 100) }),
  // Two minutes, not nine: the harness's own latency model produces a three-minute
  // session, so an onset the child never reaches models nothing.
  fatiguer: base({ id: "fatiguer", abilityOffset: r(5, 10), growth: r(8, 100), slipRate: r(3, 100), fatigueAfterMinutes: 1 }),
  misspecification: base({ id: "misspecification", abilityOffset: r(4, 10), growth: r(8, 100), slipRate: r(3, 100), misspecified: true }),
};

function base(spec: Partial<PersonaSpec> & { id: PersonaId }): PersonaSpec {
  return {
    abilityOffset: ZERO,
    growth: r(8, 100),
    slipRate: r(3, 100),
    reviseRate: r(15, 100),
    baseLatencyMs: 8_000,
    latencySlope: r(45, 100),
    guessing: false,
    carriesBug: false,
    lapseDays: 0,
    activeDaysBeforeLapse: 0,
    fatigueAfterMinutes: 0,
    misspecified: false,
    ...spec,
  };
}

/** Ability never rises more than this above where the child started. */
export const ABILITY_CAP: Fix = fromRatio(15, 10);

/**
 * Where a child of the harness's nominal grade sits on the difficulty scale.
 *
 * **This replaced a modelling error worth writing down**, because it is the same
 * error the program's own documents warn about in a different costume. Ability
 * started as a per-skill offset from each skill's own `b̄` — `α_s = b_s + offset`
 * — which is not a struggling child, it is a child for whom *every* item in the
 * curriculum is equally hard. A constant offset of −1.2 caps the child's success
 * probability at `σ(−1.2) = 0.23` on the easiest item in the entire graph, so
 * `A-08`'s "realised accuracy stays in [0.68, 0.85]" was unsatisfiable under any
 * scheduler. Corpán shipped three gates with that property; this is the same
 * mistake found by running it rather than by reasoning about it.
 *
 * Ability is therefore a **scalar on the item-difficulty scale**, and skills
 * differ in difficulty rather than the child differing per skill. A struggling
 * child does grade-1 work well and grade-3 work badly, which is what "struggling"
 * means and what the scheduler has to find.
 */
export const ABILITY_ANCHOR: Fix = fromRatio(9, 10);

export type Child = {
  readonly spec: PersonaSpec;
  readonly seed: number;
  /** Per-child discrimination. The engine's model has no such parameter. */
  readonly discrimination: Fix;
  /** Current ability per skill, and the day each last earned growth. */
  ability: Record<SkillId, Fix>;
  creditedOn: Record<SkillId, Day>;
  /** Counter for the child's own draw stream, so every draw is reproducible. */
  cursor: number;
};

export function newChild(spec: PersonaSpec, seed: number, catalog: Catalog): Child {
  // 0.7 to 1.6, from the child's own seed. A 1PL engine cannot represent this and
  // is not told it.
  const discrimination = add(fromRatio(7, 10), mul(draw(seed, 7), fromRatio(9, 10)));
  const start = add(ABILITY_ANCHOR, spec.abilityOffset);
  const ability: Record<SkillId, Fix> = {};
  for (const skill of catalog.skills) ability[skill.id] = start;
  return { spec, seed, discrimination, ability, creditedOn: {}, cursor: 0 };
}

/**
 * The features the engine cannot see.
 *
 * Derived from a fingerprint of the item class, so they are stable for a given
 * `(skill, level)` and uncorrelated with anything the engine reads. Each is a
 * centred value in roughly ±0.5, weighted below.
 */
function unobservedShift(skill: SkillMeta, level: number): Fix {
  const hash = fingerprint(`${skill.id}#${String(level)}`);
  const visual = sub(((hash % 1_000_000) as Fix), fromRatio(1, 2));
  const digits = sub((((hash >>> 7) % 1_000_000) as Fix), fromRatio(1, 2));
  const span = sub((((hash >>> 17) % 1_000_000) as Fix), fromRatio(1, 2));
  return add(add(mul(visual, fromRatio(35, 100)), mul(digits, fromRatio(45, 100))), mul(span, fromRatio(30, 100)));
}

/**
 * The structured misspecification. Not noise: a systematic function of the
 * level index and the nominal grade, which is what a real `b()` being wrong
 * looks like — the curriculum author under-rating late levels and over-rating
 * early grades, consistently.
 */
function structuredOffset(skill: SkillMeta, level: number): Fix {
  return add(mul(fromInt(level - 1), fromRatio(30, 100)), mul(fromInt(skill.gradeNominal - 3), fromRatio(-25, 100)));
}

export function trueDifficulty(child: Child, skill: SkillMeta, level: number): Fix {
  const meta = skill.levels[level];
  if (meta === undefined) return skill.b;
  const shifted = add(meta.b, unobservedShift(skill, level));
  return child.spec.misspecified ? add(shifted, structuredOffset(skill, level)) : shifted;
}

export type PersonaAnswer = {
  readonly correct: boolean;
  readonly latencyMs: number;
  readonly revisions: number;
  readonly misconception?: BugId;
  /** The true probability the child had. Not visible to the engine; EG-5 reads it. */
  readonly truthP: Fix;
};

/** How often a wrong answer accidentally equals a mal-rule's output. */
export const ACCIDENTAL_MATCH_RATE: Fix = fromRatio(6, 100);

/**
 * Answer one card.
 *
 * Fatigue is modelled as an ability penalty and a latency multiplier rather than
 * as a flat accuracy drop, so the engine's fatigue detector has to find it from
 * the same two signals a real one would.
 */
export function answerCard(
  child: Child,
  catalog: Catalog,
  card: PlannedCard,
  guessFloor: Fix,
  minutesElapsed: number,
): PersonaAnswer {
  const skill = catalog.byId.get(card.skillId);
  if (skill === undefined) throw new RangeError(`answerCard: no skill ${card.skillId}`);
  const spec = child.spec;
  child.cursor += 1;
  const at = child.cursor;

  const tired = spec.fatigueAfterMinutes > 0 && minutesElapsed >= spec.fatigueAfterMinutes;
  const ability = sub(child.ability[card.skillId] ?? ABILITY_ANCHOR, tired ? fromRatio(7, 10) : ZERO);
  const difficulty = trueDifficulty(child, skill, card.level);

  const logistic = sigmoid(mul(child.discrimination, sub(ability, difficulty)));
  const truthP = spec.guessing
    ? add(guessFloor, fromRatio(3, 100))
    : add(guessFloor, mul(sub(ONE, guessFloor), logistic));

  let correct = bernoulli(child.seed, at, truthP);
  let revisions = 0;
  let misconception: BugId | undefined;

  const guarantees = skill.levels[card.level]?.guarantees ?? [];
  if (spec.carriesBug && guarantees.length > 0 && bernoulli(child.seed, at + 1_000_003, fromRatio(85, 100))) {
    // The bug fires on the items whose structure demands the broken step, and it
    // beats ability: that is what makes it a misconception rather than a weakness.
    correct = false;
    misconception = malRuleOf(card.skillId);
  }

  if (correct && bernoulli(child.seed, at + 2_000_003, spec.slipRate)) {
    if (bernoulli(child.seed, at + 3_000_003, spec.reviseRate)) {
      // Caught it. Revisions > 0 then correct is the cleanest slip signal there
      // is, and the engine must never read it as a bug.
      revisions = 1;
    } else {
      correct = false;
    }
  }

  if (!correct && misconception === undefined) {
    // A wrong answer sometimes *equals* a buggy procedure's output by accident —
    // the curriculum measured 155 of 4,000 items firing borrow-across-zero on
    // their own. EG-9's false-positive leg is meaningless without it.
    if (bernoulli(child.seed, at + 4_000_003, ACCIDENTAL_MATCH_RATE)) {
      misconception = malRuleOf(card.skillId);
    }
  }

  const latencyMs = latencyFor(child, ability, difficulty, at, tired);
  return { correct, latencyMs, revisions, truthP, ...(misconception === undefined ? {} : { misconception }) };
}

/**
 * Latency: a median that rises with `(b − α)`, times a per-answer multiplier in
 * roughly 0.6–1.6. Modelled in the ability domain rather than sampled
 * independently, so the "slow but correct" and "fast and wrong" shapes the engine
 * has to discriminate are produced by the child's state and not stipulated.
 */
function latencyFor(child: Child, ability: Fix, difficulty: Fix, at: number, tired: boolean): number {
  const spec = child.spec;
  const gap = clamp(sub(difficulty, ability), fromInt(-3), fromInt(3));
  const stretch = exp(mul(spec.latencySlope, gap));
  const jitter = add(fromRatio(6, 10), draw(child.seed, at + 5_000_003));
  const tiredness = tired ? fromRatio(18, 10) : ONE;
  const scaled = mul(mul(mul(fromInt(spec.baseLatencyMs), stretch), jitter), tiredness);
  return Math.max(400, Math.min(120_000, toRoundedInt(scaled)));
}

/**
 * Credit a spaced success. **No same-day credit** — a child who gets the same
 * class right four times in one session has not learned four times.
 */
export function creditSuccess(child: Child, skill: SkillMeta, day: Day): void {
  if (child.creditedOn[skill.id] === day) return;
  child.creditedOn[skill.id] = day;
  const start = add(ABILITY_ANCHOR, child.spec.abilityOffset);
  const current = child.ability[skill.id] ?? start;
  child.ability[skill.id] = clamp(add(current, child.spec.growth), start, add(start, ABILITY_CAP));
}

/** Ability decays a little while a child is away. */
export function decayAway(child: Child, catalog: Catalog, days: number): void {
  const loss = mul(fromRatio(1, 100), fromInt(days));
  const start = add(ABILITY_ANCHOR, child.spec.abilityOffset);
  for (const skill of catalog.skills) {
    const current = child.ability[skill.id] ?? start;
    child.ability[skill.id] = clamp(sub(current, loss), sub(start, fromRatio(5, 10)), add(start, ABILITY_CAP));
  }
}

/** Is this an active day for the persona's attendance pattern? */
export function isActiveDay(spec: PersonaSpec, day: Day): boolean {
  if (spec.lapseDays === 0) return true;
  const cycle = spec.activeDaysBeforeLapse + spec.lapseDays;
  return day % cycle < spec.activeDaysBeforeLapse;
}
