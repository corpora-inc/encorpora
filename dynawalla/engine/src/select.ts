/**
 * The selection policy — which eight cards, in which order, and why.
 *
 * `scheduler.ts` holds the seam and the invariants as checkable functions. This
 * file is the thing that has to satisfy them, and it is written so that the
 * satisfying is structural rather than hopeful:
 *
 *   1. **Quotas first, cards second.** A batch's pool composition is decided
 *      before any skill is chosen — repair capped at a quarter, one stretch, a
 *      blocked debut of three when a skill is new. Deciding pools per slot, in
 *      order, is how a batch ends up 60% repair without any single decision
 *      being wrong.
 *   2. **Difficulty is chosen in logit space, never by scanning σ.** The card a
 *      child has an 80% chance on is the level nearest `θ − logit(0.80)`. One
 *      `logit` per slot and one `σ` per *chosen* card, rather than a sigmoid per
 *      candidate per slot — which is the difference between EG-4's 5 ms budget
 *      and a scheduler that gets slower as the curriculum grows.
 *   3. **Every rejection is recorded.** `SelectionTrace.rejected` is written by
 *      the loop that does the rejecting, so Developer Mode's answer to "why this
 *      exercise" cannot drift from the decision (`A-18`, EG-10).
 *
 * ## Cold start
 *
 * There is no placement test. A single grade answer seeds `θ`, and the first
 * twenty cards of a child's life are clamped so that **no card is predicted below
 * `P̂ = 0.55`** — enforced here, by re-choosing the level, and not by hoping the
 * controller stays high. A brand-new learner is the common case on day one.
 */

import {
  BATCH_SIZE,
  BENCH_AFTER_FAILURES,
  COLD_START_ITEMS,
  MIN_DISTINCT_SKILLS,
  COLD_START_MIN_P,
  DEBUT_BLOCK_MIN,
  FLUENCY_BURST_P,
  MAX_PER_OPERATION,
  MAX_REPAIR_PER_BATCH,
  MAX_WINDOW_SHARE_PERCENT,
  NO_REPEAT_WINDOW,
  RETRY_EASIER_BY,
  REVIEW_AFTER_DAYS,
  ROLLING_WINDOW,
  SEED_ABOVE_BAND,
  STALL_MIN_GAIN,
  STALL_SESSIONS,
} from "./constants.ts";
import { isBugActive } from "./bugs.ts";
import { levelGuaranteeing, levelNearest, preferredForm } from "./catalog.ts";
import type { Catalog, LevelMeta, SkillMeta } from "./catalog.ts";
import { P_TARGET_MAX, P_TARGET_MIN, batchIntents, frustrationFloor, targetFor } from "./controller.ts";
import type { CardIntent } from "./controller.ts";
import { isDue, isFactEligible } from "./facts.ts";
import { ZERO, add, sub } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { logit } from "./math/elementary.ts";
import { drawInt } from "./math/rng.ts";
import { predictP } from "./skill.ts";
import { NEW_SKILL_STATE, bugKey, factKey } from "./types.ts";
import type { BugId, Day, LearnerState, SkillId, SkillState } from "./types.ts";
import type { PlannedCard, Pool, SelectionTrace } from "./scheduler.ts";

/**
 * What the engine knows about the session in progress.
 *
 * Deliberately **not** persisted. Every field here is a fact about the last
 * hour — which items have been served, which skills have been failed enough to
 * bench, whether the child is tired — and persisting them is how a state budget
 * starts growing with use. It is rebuilt empty at every launch, which is also the
 * correct behaviour: a bench expires when the session does.
 */
export type SessionContext = {
  readonly day: Day;
  /** Item keys served this session, oldest first. Capped at the rolling window. */
  readonly recentItems: readonly string[];
  /** Skill ids in the same window, for the 40% cap. */
  readonly recentSkills: readonly SkillId[];
  readonly outcomes: readonly boolean[];
  readonly failuresBySkill: Readonly<Record<SkillId, number>>;
  readonly fatigued: boolean;
  /** The one skill allowed a blocked debut this session, once chosen. */
  readonly debutSkill: SkillId | null;
  readonly debutServed: number;
  /** Draws consumed. Part of the trace, so a transcript is replayable. */
  readonly rngCursor: number;
  readonly seed: number;
  /** Cards served this session, for the first-card and last-card rules. */
  readonly served: number;
  /**
   * `P̂` of the last card actually served, or `null` at the start of a session.
   *
   * The "never two consecutive items below `pTarget − 0.20`" rule does not stop
   * at a batch boundary, and the planner only sees the batch it is building — so
   * without this, the last card of one batch and the first of the next were the
   * one pair the rule could not see. Which is also the pair a re-plan produces,
   * so it was not a rare case.
   */
  readonly lastPHat: Fix | null;
  /** Skills whose repair has already been scheduled, so it is not scheduled twice. */
  readonly repairedBugs: readonly string[];
};

export function newSession(seed: number, day: Day, learner?: LearnerState): SessionContext {
  return {
    day,
    // The item window is session-scoped on purpose — two cards of one class on
    // either side of a night's sleep are spaced review, not a re-serve — but the
    // *skill* window is not, because "≤40% of a rolling 50-item window" is a
    // statement about the child's practice and not about their afternoon.
    recentItems: [],
    recentSkills: learner?.recent ?? [],
    outcomes: [],
    failuresBySkill: {},
    fatigued: false,
    debutSkill: null,
    debutServed: 0,
    rngCursor: 0,
    seed,
    served: 0,
    lastPHat: null,
    repairedBugs: [],
  };
}

export type PlanOptions = {
  /** Produce `SelectionTrace`s. The app passes `false` in production (`A-18`). */
  readonly traces?: boolean;
  /** The child's chamber choice biases the pool towards that instrument's maths. */
  readonly preferOperation?: string;
  /** Content exists for the PLAY pool. There is none in V1, so it defaults false. */
  readonly play?: boolean;
  /** The session is ending with this batch — its last card is a confidence card. */
  readonly last?: boolean;
};

export type PlannedBatch = {
  readonly cards: readonly PlannedCard[];
  readonly cursor: number;
};

/**
 * The key the no-repeat window compares on.
 *
 * It is the item's **class** — skill, level and form — and not its seed.
 * Generated exercises have no stable identity, and a child does not experience
 * `43 − 28` and `52 − 37` as the same problem; what they experience as the same
 * problem is the same *kind* of problem three cards apart. The class is also the
 * only identity the engine has, because it does not know what a generator will
 * emit from a seed. The Stage-1 retry and the Stage-2 repair are exempt: coming
 * back to the thing that just broke is the whole point of them, and they carry
 * `followUp` so a gate can tell the difference.
 */
function itemKey(skill: SkillId, level: number, form: string): string {
  return `${skill}#L${String(level)}#${form}`;
}

function stateOf(learner: LearnerState, id: SkillId): SkillState {
  return learner.skills[id] ?? NEW_SKILL_STATE;
}

/**
 * `θ` for a skill, including one the child has no record for.
 *
 * A missing record must **not** read as `θ = 0`. Zero is a perfectly ordinary
 * ability, and against a skill whose `b̄` is −1.4 it says the child is excellent
 * at something they have never seen — which puts the hardest unseen skill at the
 * top of every candidate list. The harness caught this as a struggling child
 * being served 33% of items correctly; the cause was that `coldStart` only seeds
 * skills at or one band above the child's grade, and everything else defaulted to
 * a confident zero.
 *
 * The default here is the cold-start rule applied lazily: two logits below the
 * skill's own difficulty, the same value `coldStart` writes one band up. No
 * record is created, so the state file still costs nothing for a skill nobody has
 * touched.
 */
function thetaOf(learner: LearnerState, skill: SkillMeta): Fix {
  const state = learner.skills[skill.id];
  if (state !== undefined && state.attempts > 0) return state.theta;

  // No attempts on this skill: the estimate is a prior, and **the freshest prior
  // wins**. A skill whose prerequisite the child has practised is not a stranger
  // — the prerequisite is real evidence about this child now, and the cold-start
  // seed is a guess made on day one that may be six months old.
  //
  // Both halves of this were measured. Without the prerequisite fallback, a skill
  // unlocked in month three debuted at `b̄ − 2.0`: a first card the model predicts
  // at 12%. Without preferring the fresher of the two, the day-0 seed outlived its
  // evidence and the reliability diagram's lowest bin read `p̂ = 0.62` against a
  // realised 0.75 — the engine systematically under-predicting the first cards of
  // every newly-reached skill, for the whole of a child's second month onward.
  const seeded = state?.theta ?? add(skill.b, SEED_ABOVE_BAND);
  for (const id of skill.prereqs) {
    const prereq = learner.skills[id];
    if (prereq === undefined || prereq.attempts === 0) continue;
    const inherited = sub(prereq.theta, PREREQ_STEP_DOWN);
    if (inherited > seeded) return inherited;
  }
  return seeded;
}

/** How far below the prerequisite an unseen skill starts. PROVISIONAL. */
const PREREQ_STEP_DOWN: Fix = 500_000 as Fix;

/** A skill is reachable when every direct prerequisite is at least Practiced. */
export function isReachable(learner: LearnerState, skill: SkillMeta): boolean {
  return skill.prereqs.every((id) => {
    const level = stateOf(learner, id).level;
    return level === "practiced" || level === "mastered" || level === "retired";
  });
}

export function reachableSkills(catalog: Catalog, learner: LearnerState): readonly SkillMeta[] {
  return catalog.skills.filter((skill) => isReachable(learner, skill));
}

/** Benched: three failures on one skill ends its session, whatever else is true. */
function isBenched(context: SessionContext, id: SkillId): boolean {
  return (context.failuresBySkill[id] ?? 0) >= BENCH_AFTER_FAILURES;
}

/**
 * The pool a skill is eligible for, in priority order, or `null`.
 *
 * A skill is in exactly one pool per slot. The order is the one
 * ADAPTIVE_LEARNING.md lists, and the quota planner below is what stops the first
 * pool in the order from taking the whole batch.
 */
/**
 * Facts about the learner that every candidate in a batch needs and none of them
 * changes. Computed once per batch: `poolsFor` runs per skill per slot, so
 * anything recomputed inside it is paid `skills × slots` times, and the whole
 * point of choosing difficulty in logit space was not to pay that.
 */
export type PlanFacts = {
  /** Skills with at least one attempt. Below three, the frontier is widened. */
  readonly warmSkills: number;
  readonly anyPracticed: boolean;
};

export function planFacts(learner: LearnerState): PlanFacts {
  let warmSkills = 0;
  let anyPracticed = false;
  for (const state of Object.values(learner.skills)) {
    if (state.attempts > 0) warmSkills += 1;
    if (state.level !== "new") anyPracticed = true;
  }
  return { warmSkills, anyPracticed };
}

function poolsFor(
  catalog: Catalog,
  learner: LearnerState,
  context: SessionContext,
  skill: SkillMeta,
  facts: PlanFacts,
): readonly Pool[] {
  const state = stateOf(learner, skill.id);
  const pools: Pool[] = [];

  const hasActiveBug = skill.misconceptions.some((bug) => isBugActive(learner.bugs[bugKey(skill.id, bug)]));
  // Fatigue stops repair outright. Being handed a second, weirder problem after
  // getting one wrong is a plausible way to lose a child at the best of times;
  // doing it to a tired one is the version that ends the session for good.
  if (hasActiveBug && !context.fatigued) pools.push("REPAIR");

  if (state.consecutiveFailures >= 2 && skill.prereqs.length > 0) {
    const weakest = weakestPrereq(catalog, learner, skill);
    if (weakest !== null && !isBenched(context, weakest)) pools.push("PREREQ");
  }

  if (dueFactLevel(learner, context, skill) !== null) pools.push("DUE_FACT");

  if (state.attempts === 0) {
    if (!context.fatigued) pools.push("NEW");
    // A child's first sessions have no frontier at all: every skill has zero
    // attempts, so every skill is NEW, one blocked debut per session is allowed,
    // and a 24-card session collapses onto one skill. The frontier therefore
    // widens to include unseen skills until the child has a batch's worth of them
    // in flight. Until then a batch of eight simply cannot be built from touched
    // skills, and the interleaving rules — three distinct skills, at most three of
    // one operation — are arithmetically unsatisfiable without it.
    if (facts.warmSkills < BATCH_SIZE) pools.push("FRONTIER");
  } else if (state.level === "mastered" && context.day - state.lastSeenDay >= REVIEW_AFTER_DAYS) {
    pools.push("REVIEW_SKILL");
  } else if (state.level === "retired") {
    // Retired skills leave the normal pools entirely. That is the whole point of
    // the state: a child who is good at times tables should stop getting times
    // tables. They come back only through REVIEW_SKILL's day threshold above.
  } else {
    pools.push("FRONTIER");
    if (isFluencyCandidate(state, skill)) pools.push("FLUENCY");
    if (state.level === "practiced" || state.level === "mastered") pools.push("CHALLENGE");
  }

  return pools;
}

/** Low φ with high θ: can do it, still counting. Bursts, never harder problems. */
function isFluencyCandidate(state: SkillState, skill: SkillMeta): boolean {
  return state.attempts > 0 && !isFactEligible(state.phi) && state.theta >= skill.b;
}

function weakestPrereq(catalog: Catalog, learner: LearnerState, skill: SkillMeta): SkillId | null {
  let weakest: SkillId | null = null;
  let lowest: Fix = ZERO;
  for (const id of skill.prereqs) {
    if (catalog.byId.get(id) === undefined) continue;
    const theta = stateOf(learner, id).theta;
    if (weakest === null || theta < lowest) {
      weakest = id;
      lowest = theta;
    }
  }
  return weakest;
}

/** The level of this skill whose fact card is due, if any. */
function dueFactLevel(learner: LearnerState, context: SessionContext, skill: SkillMeta): number | null {
  for (let level = 0; level < skill.levels.length; level++) {
    const meta = skill.levels[level];
    if (meta === undefined) continue;
    for (const form of meta.forms) {
      if (!form.enumerable) continue;
      const card = learner.facts[factKey(skill.id, level, form.id)];
      if (card !== undefined && isDue(card, context.day)) return level;
    }
  }
  return null;
}

/**
 * How many slots each pool gets, before any skill is chosen.
 *
 * The repair cap is `A-12` and it is arithmetic, not a check after the fact: two
 * of eight is 25%. The debut block is 3 consecutive cards, and it is the only
 * thing in this file allowed to break the interleaving rule — a brand-new skill
 * introduced one card at a time between two others is a skill nobody learns.
 */
export function poolQuota(
  catalog: Catalog,
  learner: LearnerState,
  context: SessionContext,
  size: number,
): Map<Pool, number> {
  const quota = new Map<Pool, number>();
  const bump = (pool: Pool, count: number): void => {
    if (count > 0) quota.set(pool, (quota.get(pool) ?? 0) + count);
  };

  const facts = planFacts(learner);
  const eligible = reachableSkills(catalog, learner).filter((skill) => !isBenched(context, skill.id));
  const has = (pool: Pool): number =>
    eligible.filter((skill) => poolsFor(catalog, learner, context, skill, facts).includes(pool)).length;

  const repairSlots = Math.min(MAX_REPAIR_PER_BATCH, Math.floor((size * 25) / 100), has("REPAIR"));
  bump("REPAIR", repairSlots);
  bump("PREREQ", Math.min(1, has("PREREQ")));
  bump("DUE_FACT", Math.min(2, has("DUE_FACT")));

  // A debut is all-or-nothing: three cards or none. Two guided cards is not a
  // blocked debut, it is an interleaving violation with a friendly name.
  const debutAvailable =
    context.debutSkill === null && !context.fatigued && has("NEW") > 0 && size >= DEBUT_BLOCK_MIN + 2;
  if (debutAvailable) bump("NEW", DEBUT_BLOCK_MIN);

  bump("FLUENCY", Math.min(1, has("FLUENCY")));
  bump("REVIEW_SKILL", Math.min(1, has("REVIEW_SKILL")));

  let used = 0;
  for (const count of quota.values()) used += count;
  const rest = Math.max(0, size - used);
  const frontier = has("FRONTIER");
  if (frontier > 0) {
    bump("FRONTIER", rest);
  } else {
    // No frontier at all — every reachable skill is new, mastered or benched.
    // Whatever pool has candidates takes the remainder rather than the batch
    // coming back short, because a short batch is a child staring at nothing.
    const fallback: Pool[] = ["CHALLENGE", "REVIEW_SKILL", "DUE_FACT", "FLUENCY", "NEW", "PREREQ"];
    const target = fallback.find((pool) => has(pool) > 0);
    if (target !== undefined) bump(target, rest);
  }

  return quota;
}

/** Pools in the order slots are handed out. The debut block stays contiguous. */
const SLOT_ORDER: readonly Pool[] = [
  "FRONTIER",
  "DUE_FACT",
  "REPAIR",
  "PREREQ",
  "FLUENCY",
  "REVIEW_SKILL",
  "NEW",
  "CHALLENGE",
  "PLAY",
];

function slotPools(quota: Map<Pool, number>, size: number): Pool[] {
  const remaining = new Map(quota);
  const take = (pool: Pool): boolean => {
    const left = remaining.get(pool) ?? 0;
    if (left <= 0) return false;
    remaining.set(pool, left - 1);
    return true;
  };

  const slots: Pool[] = [];
  // The debut block is placed first and contiguously, one card in from the start:
  // the first card of a session is a confidence card and a brand-new skill is not
  // that.
  const debut = remaining.get("NEW") ?? 0;
  const debutAt = debut > 0 ? 1 : -1;

  for (let index = 0; index < size; index++) {
    if (debutAt >= 0 && index >= debutAt && index < debutAt + debut) {
      take("NEW");
      slots.push("NEW");
      continue;
    }
    const pool = SLOT_ORDER.find((candidate) => candidate !== "NEW" && (remaining.get(candidate) ?? 0) > 0);
    if (pool === undefined) {
      slots.push("FRONTIER");
      continue;
    }
    take(pool);
    slots.push(pool);
  }
  return slots;
}

type Candidate = {
  readonly skill: SkillMeta;
  readonly level: number;
  readonly b: Fix;
  readonly miss: Fix;
  readonly penalty: number;
};

/**
 * Choose one card.
 *
 * The scoring is: distance from the difficulty this slot asked for, in logits,
 * plus penalties in the same unit for every sequence rule the choice would
 * strain. Expressing an interleaving penalty as "worth 3 logits of difficulty
 * miss" is a judgement call, and it is written here as one number per rule rather
 * than as a cascade of `if`s, so the trade can be read and argued with.
 */
const PENALTY_SAME_SKILL_ADJACENT = 4_000_000;
const PENALTY_OPERATION_FULL = 3_000_000;
const PENALTY_WINDOW_SHARE = 2_000_000;
const PENALTY_SECOND_ADJACENT = 1_000_000;
const BONUS_PREFERRED_OPERATION = 250_000;

/**
 * Below this many reachable skills the 40% window cap cannot be met at all — two
 * skills are 50% each — so it degrades to a preference. The number is 3 because
 * that is the point at which the cap becomes arithmetically satisfiable.
 */
const MIN_ALTERNATIVES_FOR_WINDOW_CAP = 3;

/** Repeating a skill while the batch is short of its three distinct ones. */
const PENALTY_TOO_FEW_SKILLS = 5_000_000;

/**
 * How much of the constraint set is being applied.
 *
 * The constraints can conflict: on day one a child has six reachable skills, one
 * level each is near their ability, and a six-card no-repeat window excludes all
 * six. The first version returned an empty batch, and the session ended after one
 * card — a bug that is invisible in a unit test and obvious the moment a
 * simulated child tries to have a session.
 *
 * So the constraints relax in a **stated order**, one step at a time, and the
 * trace records which step produced the card. The order is the order of harm: the
 * no-repeat window costs a child a repeated problem class, the frustration floor
 * costs them a hard card, the window share costs them variety. Serving nothing
 * costs them the session, and is worse than all three.
 */
export type Relaxation = 0 | 1 | 2 | 3;

export const RELAXATION_NAMES: readonly string[] = [
  "all constraints",
  "no-repeat window dropped",
  "…and the two-hard-in-a-row filter dropped",
  "…and the 40% window cap dropped",
];

function chooseCard(
  catalog: Catalog,
  learner: LearnerState,
  context: SessionContext,
  pool: Pool,
  intent: CardIntent,
  slot: number,
  batchSoFar: readonly PlannedCard[],
  options: PlanOptions,
  facts: PlanFacts,
  relax: Relaxation = 0,
): { card: PlannedCard | null; rejected: string[] } {
  const rejected: string[] = [];
  const pStar = targetFor(context.fatigued ? FLUENCY_BURST_P : learner.pTarget, intent);
  const effectiveP = pool === "FLUENCY" ? FLUENCY_BURST_P : pStar;
  const offset = logit(effectiveP);

  const previous = batchSoFar[batchSoFar.length - 1];
  const secondPrevious = batchSoFar[batchSoFar.length - 2];
  const previousPHat = previous?.pHat ?? context.lastPHat;
  const operationCounts = new Map<string, number>();
  for (const card of batchSoFar) operationCounts.set(card.operation, (operationCounts.get(card.operation) ?? 0) + 1);

  const rolling = [...context.recentSkills, ...batchSoFar.map((card) => card.skillId)].slice(-ROLLING_WINDOW);
  const windowCounts = new Map<SkillId, number>();
  for (const id of rolling) windowCounts.set(id, (windowCounts.get(id) ?? 0) + 1);

  // Two constraints are **hard filters** rather than penalties, because they are
  // stated as invariants and a penalty is only a preference. Both are expressed
  // in logit space so they cost an integer comparison rather than a sigmoid:
  // `P̂ < floor` is exactly `b > θ − logit(floor)`.
  const floorOffset = logit(frustrationFloor(learner.pTarget));
  // The blocked debut is exempt, as it is from the interleaving rules. A skill
  // the child has never seen is by definition one they cannot yet do; three
  // guided items is how it is introduced, and refusing to introduce anything the
  // child is not already good at is a scheduler that never teaches anything.
  const previousWasHard = pool !== "NEW" && previousPHat !== null && previousPHat < frustrationFloor(learner.pTarget);
  const alternatives = new Set(
    catalog.skills.filter((skill) => isReachable(learner, skill) && !isBenched(context, skill.id)).map((skill) => skill.id),
  ).size;

  let best: Candidate | null = null;
  let bestScore = 0;
  for (const skill of catalog.skills) {
    if (!isReachable(learner, skill)) continue;
    if (isBenched(context, skill.id)) {
      rejected.push(`${skill.id}: benched after ${String(BENCH_AFTER_FAILURES)} failures`);
      continue;
    }
    const pools = poolsFor(catalog, learner, context, skill, facts);
    if (!pools.includes(pool)) continue;

    const theta = thetaOf(learner, skill);
    const target = pool === "NEW" ? skill.levels[0]?.b ?? ZERO : sub(theta, offset);
    const pinned = pool === "NEW" ? 0 : pool === "DUE_FACT" ? dueFactLevel(learner, context, skill) : null;

    // A skill offers its nearest level that is **still available** rather than its
    // nearest level full stop. One candidate per skill means a batch of eight
    // needs eight eligible skills, and a child three weeks in has six — so the
    // policy was relaxing a constraint on three cards in every ten. Two levels of
    // one skill are different work; two draws of one level are the thing the
    // no-repeat window exists to stop.
    const taken = (level: number): boolean => {
      const key = itemKey(skill.id, level, preferredForm(skill.levels[level] as LevelMeta).id);
      if (batchSoFar.some((card) => card.itemKey === key)) return true;
      return relax < 1 && context.recentItems.slice(-NO_REPEAT_WINDOW).includes(key);
    };

    let level = pinned ?? levelNearest(skill, target);
    if (pinned === null && taken(level)) {
      let best = -1;
      let bestMiss = -1;
      for (let candidate = 0; candidate < skill.levels.length; candidate++) {
        const at = skill.levels[candidate];
        if (at === undefined || taken(candidate)) continue;
        const miss = at.b > target ? at.b - target : target - at.b;
        if (bestMiss < 0 || miss < bestMiss) {
          bestMiss = miss;
          best = candidate;
        }
      }
      if (best < 0) {
        rejected.push(`${skill.id}: every level is in this batch or the no-repeat window`);
        continue;
      }
      level = best;
    } else if (pinned !== null && taken(level)) {
      rejected.push(`${skill.id}#L${String(level)}: already in this batch or the no-repeat window`);
      continue;
    }

    const meta = skill.levels[level];
    if (meta === undefined) continue;
    const key = itemKey(skill.id, level, preferredForm(meta).id);

    // Never two consecutive items below `pTarget − 0.20`. Enforced by refusing
    // to *choose* the second one, not by noticing afterwards.
    if (relax < 2 && previousWasHard && meta.b > sub(theta, floorOffset)) {
      rejected.push(`${key}: would be a second consecutive card below pTarget − 0.20`);
      continue;
    }

    let penalty = 0;
    // The exemption belongs to the NEW pool and to nothing else. Extending it to
    // "any card of the skill currently debuting" let a FRONTIER card continue a
    // debut block into the next batch — a run of four and four cards of one
    // operation, in a batch that contained no NEW card at all and so did not look
    // like a debut to anything checking it.
    const isDebutCard = pool === "NEW";
    if (previous?.skillId === skill.id && !isDebutCard) {
      penalty += secondPrevious?.skillId === skill.id ? PENALTY_SAME_SKILL_ADJACENT : PENALTY_SECOND_ADJACENT;
    }
    if ((operationCounts.get(skill.operation) ?? 0) >= MAX_PER_OPERATION && !isDebutCard) {
      // A hard filter once there is somewhere else to go. As a penalty it lost to
      // a near-perfect difficulty match and produced batches of four cards of one
      // operation and two distinct skills — a compliant-looking batch that is
      // exactly the blocked practice interleaving exists to prevent.
      if (relax < 3 && alternatives > MAX_PER_OPERATION) {
        rejected.push(`${skill.id}: operation ${skill.operation} already has ${String(MAX_PER_OPERATION)} cards`);
        continue;
      }
      penalty += PENALTY_OPERATION_FULL;
    }
    // Three distinct skills once three are reachable. Repeating a skill already
    // in the batch is penalised while the batch is short of them.
    const distinct = new Set(batchSoFar.map((entry) => entry.skillId));
    if (
      !isDebutCard &&
      distinct.has(skill.id) &&
      distinct.size < MIN_DISTINCT_SKILLS &&
      alternatives >= MIN_DISTINCT_SKILLS
    ) {
      penalty += PENALTY_TOO_FEW_SKILLS;
    }
    const share = windowCounts.get(skill.id) ?? 0;
    if (share * 100 >= rolling.length * MAX_WINDOW_SHARE_PERCENT && rolling.length >= 10) {
      // ≤40% of a rolling 50-item window from one skill. A hard exclusion once
      // there is somewhere else to go, and a penalty when there is not: with two
      // reachable skills the rule is arithmetically unsatisfiable, and refusing
      // to serve anything is worse than serving the same skill.
      if (relax < 3 && alternatives >= MIN_ALTERNATIVES_FOR_WINDOW_CAP) {
        rejected.push(`${skill.id}: already ${String(share)} of the last ${String(rolling.length)} cards`);
        continue;
      }
      penalty += PENALTY_WINDOW_SHARE;
    }
    if (options.preferOperation === skill.operation) penalty -= BONUS_PREFERRED_OPERATION;

    const miss = (meta.b > target ? meta.b - target : target - meta.b) as Fix;
    const score = miss + penalty;
    if (best === null || score < bestScore) {
      if (best !== null) rejected.push(`${best.skill.id}#L${String(best.level)}: a nearer card exists`);
      best = { skill, level, b: meta.b, miss, penalty };
      bestScore = score;
    } else {
      rejected.push(`${skill.id}#L${String(level)}: ${String(score - bestScore)} further from target`);
    }
  }

  if (best === null) return { card: null, rejected };

  const chosen = coldStartFloor(learner, best, slot);
  if (relax > 0) rejected.unshift(`relaxed to: ${RELAXATION_NAMES[relax] ?? String(relax)}`);
  const meta = chosen.skill.levels[chosen.level];
  if (meta === undefined) return { card: null, rejected };
  const form = preferredForm(meta);
  const theta = thetaOf(learner, chosen.skill);
  const pHat = predictP(theta, meta.b, form.guessFloor);

  const seed = drawInt(context.seed, context.rngCursor + slot, 0x7fff_ffff);
  const card: PlannedCard = {
    cardId: `${chosen.skill.id}#L${String(chosen.level)}#${String(seed)}`,
    skillId: chosen.skill.id,
    level: chosen.level,
    formId: form.id,
    seed,
    pool,
    intent,
    pHat,
    operation: chosen.skill.operation,
    itemKey: itemKey(chosen.skill.id, chosen.level, form.id),
    ...(relax > 0 ? { relaxed: relax } : {}),
    ...(options.traces === true
      ? {
          trace: {
            cardId: `${chosen.skill.id}#L${String(chosen.level)}#${String(seed)}`,
            skillId: chosen.skill.id,
            pool,
            bTarget: sub(theta, offset),
            bActual: meta.b,
            pHat,
            pTargetBand: [P_TARGET_MIN, P_TARGET_MAX] as readonly [Fix, Fix],
            reasons: reasonsFor(pool, intent, chosen, learner, slot),
            rejected: rejected.slice(0, 8),
            rngDraws: 1,
            seed,
          } satisfies SelectionTrace,
        }
      : {}),
  };
  return { card, rejected };
}

/**
 * The cold-start floor: within a child's first twenty cards ever, re-choose the
 * level until the model predicts at least `P̂ = 0.55`.
 *
 * Applied to the *chosen* candidate rather than to the candidate set, because the
 * skill was picked for a reason — the point is that the first twenty are easy,
 * not that they are from a different skill.
 */
function coldStartFloor(learner: LearnerState, candidate: Candidate, slot: number): Candidate {
  if (learner.answered + slot >= COLD_START_ITEMS) return candidate;
  const theta = thetaOf(learner, candidate.skill);
  for (let level = candidate.level; level >= 0; level--) {
    const meta = candidate.skill.levels[level];
    if (meta === undefined) continue;
    const form = preferredForm(meta);
    if (predictP(theta, meta.b, form.guessFloor) >= COLD_START_MIN_P) {
      return { ...candidate, level, b: meta.b };
    }
  }
  return { ...candidate, level: 0, b: candidate.skill.levels[0]?.b ?? candidate.b };
}

function reasonsFor(
  pool: Pool,
  intent: CardIntent,
  candidate: Candidate,
  learner: LearnerState,
  slot: number,
): readonly string[] {
  const reasons = [`pool ${pool}`, `intent ${intent}`];
  if (learner.answered + slot < COLD_START_ITEMS) reasons.push("cold start: first 20 cards floored at P̂ 0.55");
  if (candidate.penalty > 0) reasons.push(`accepted a ${String(candidate.penalty)} interleaving penalty`);
  if (candidate.penalty < 0) reasons.push("matches the chamber's operation");
  reasons.push(`level ${String(candidate.level)} is nearest the target difficulty`);
  return reasons;
}

/**
 * Plan a batch.
 *
 * Slots are filled left to right so that each choice can see the ones before it —
 * that is what makes "at most two consecutive from one skill" a property of the
 * construction rather than a check afterwards. A slot with no candidate is
 * dropped rather than filled with something worse; a short batch is visible and a
 * wrong card is not.
 */
export function planBatch(
  catalog: Catalog,
  learner: LearnerState,
  context: SessionContext,
  size: number = BATCH_SIZE,
  options: PlanOptions = {},
): PlannedBatch {
  if (size <= 0) throw new RangeError("planBatch: empty batch");
  const facts = planFacts(learner);
  // "Never more than 2 failures in any window of 5 without forcing a
  // `pTarget + 0.10` card." That is an instruction to the planner, not a
  // description of an outcome, and it was the one anti-frustration rule with no
  // implementation: `batchIntents` puts a confidence card at the start and end of
  // a *session*, which does nothing for a bad run in the middle of one. The
  // relief is forced into the next slot planned after the run.
  const lastFive = context.outcomes.slice(-5);
  const needsRelief = lastFive.length >= 5 && lastFive.filter((correct) => !correct).length > 2;
  const intents = batchIntents(size, {
    first: context.served === 0 || needsRelief,
    last: options.last === true,
    anyPracticed: facts.anyPracticed,
  });
  const pools = slotPools(poolQuota(catalog, learner, context, size), size);

  const cards: PlannedCard[] = [];
  let working = context;
  for (let slot = 0; slot < size; slot++) {
    const pool = pools[slot] ?? "FRONTIER";
    const intent = intents[slot] ?? "steady";
    let card: PlannedCard | null = null;
    for (let relax: Relaxation = 0; relax <= 3 && card === null; relax = (relax + 1) as Relaxation) {
      card = chooseCard(catalog, learner, working, pool, intent, slot, cards, options, facts, relax).card;
      if (card === null && pool !== "FRONTIER") {
        card = chooseCard(catalog, learner, working, "FRONTIER", intent, slot, cards, options, facts, relax).card;
      }
    }
    if (card === null) continue;
    cards.push(card);
    if (card.pool === "NEW") {
      working = {
        ...working,
        debutSkill: working.debutSkill ?? card.skillId,
        debutServed: working.debutServed + 1,
      };
    }
  }

  return { cards, cursor: context.rngCursor + size };
}

/**
 * May another repair item be injected right now?
 *
 * `A-12` caps repair at a quarter of any batch, and the planner honours that for
 * the cards it plans. The Stage-2 repair item is *injected* after a wrong answer,
 * outside any batch — so without this the child can be handed four repair items
 * in eight cards while every individual batch is compliant. Measured at 5 of 8 on
 * the 180-day pilot.
 *
 * The cap is read over the last batch's worth of served cards, which is the
 * window a child experiences.
 */
export function repairAllowed(servedPools: readonly string[]): boolean {
  // The window is `BATCH_SIZE − 1`, so that serving one more still leaves at most
  // `MAX_REPAIR_PER_BATCH` in any eight consecutive cards.
  const recent = servedPools.slice(-(BATCH_SIZE - 1));
  return recent.filter((pool) => pool === "REPAIR").length < MAX_REPAIR_PER_BATCH;
}

/**
 * May this planned card be served *now*?
 *
 * A batch is planned eight cards ahead, and the window it was planned against
 * moves while it is being served: a Stage-1 retry gets injected, a re-plan
 * discards a tail, the controller climbs. Most of that makes the plan safer, but
 * not all of it, and the two sequence rules are stated as absolutes — "never
 * re-serve an identical item within 6 cards", "never two consecutive items below
 * `pTarget − 0.20`". A planner that *tries* satisfies neither.
 *
 * So the caller checks each card at the moment it is served and drops an
 * inadmissible one. It is two comparisons; the planner has already made it rare.
 */
export function admissible(
  learner: LearnerState,
  context: SessionContext,
  card: PlannedCard,
  servedPools: readonly string[] = [],
): boolean {
  // The repair cap binds planned repair cards as well as injected ones. A batch
  // may legitimately carry two, and an injected repair between two batches makes
  // three in eight — compliant batch by compliant batch, and not what `A-12` says.
  if (card.pool === "REPAIR" && !repairAllowed(servedPools)) return false;

  // The 40% window cap, at serve time. The planner checks it against the window as
  // it stood when the batch was planned, and eight cards later that window has
  // moved — which is how a batch that was compliant when planned put a skill at
  // 21 of the last 50 by the time its tail was served.
  if (card.followUp === undefined && (card.relaxed ?? 0) < 3) {
    const rolling = context.recentSkills.slice(-ROLLING_WINDOW);
    const share = rolling.filter((id) => id === card.skillId).length;
    if (rolling.length >= ROLLING_WINDOW && share * 100 >= rolling.length * MAX_WINDOW_SHARE_PERCENT) return false;
  }
  // The frustration rule binds a follow-up too. A Stage-1 retry is offered as
  // relief, and relief that is itself below the floor is not relief — the child
  // is better served by simply moving on.
  const floor = frustrationFloor(learner.pTarget);
  if (context.lastPHat !== null && context.lastPHat < floor && card.pHat < floor) return false;
  // The no-repeat window does not: coming back to what just broke is the point of
  // a follow-up, and a relaxed card has already recorded that obeying every rule
  // left nothing to serve.
  if (card.followUp !== undefined || (card.relaxed ?? 0) > 0) return true;
  return !context.recentItems.slice(-NO_REPEAT_WINDOW).includes(card.itemKey);
}

/**
 * The Stage-1 VERIFY retry: the same skill, one card, at `b = θ_s − 0.8`.
 *
 * Not "one level easier" — that was the fixed ladder's approximation and it is
 * wrong in both directions, because a level is a curriculum step and 0.8 logits
 * is a statement about this child. If no level is that easy the easiest one is
 * served, which is the honest answer to "make it easier than anything I have".
 */
export function retryCard(
  catalog: Catalog,
  learner: LearnerState,
  context: SessionContext,
  card: PlannedCard,
): PlannedCard | null {
  const skill = catalog.byId.get(card.skillId);
  if (skill === undefined) return null;
  if (isBenched(context, card.skillId)) return null;
  const theta = thetaOf(learner, skill);
  // `b = θ − 0.8` is the document's retry, and read literally it is **not relief
  // for the child who needs it most**. `θ − 0.8` is a fixed `P̂ = 0.69` whatever
  // the controller is doing; a struggling child's `pTarget` climbs to 0.87, so the
  // card offered after a failure came back *harder* than their average card.
  // Measured: realised accuracy for the struggling persona sat at 0.67 against
  // `A-08`'s 0.68 floor, with the retry cards dragging the mean down.
  //
  // A retry is a confidence card — it carries `intent: "confidence"` — so it is
  // served at the confidence intent's difficulty, `pTarget + 0.10`, or at
  // `θ − 0.8`, whichever is easier. The document's number becomes the floor under
  // the relief rather than the whole of it.
  const confidence = logit(targetFor(learner.pTarget, "confidence"));
  const easier = confidence > RETRY_EASIER_BY ? confidence : RETRY_EASIER_BY;
  const level = levelNearest(skill, sub(theta, easier));
  const meta = skill.levels[level];
  if (meta === undefined) return null;
  const form = preferredForm(meta);
  const seed = drawInt(context.seed, context.rngCursor + 977, 0x7fff_ffff);
  return {
    cardId: `${skill.id}#L${String(level)}#${String(seed)}`,
    skillId: skill.id,
    level,
    formId: form.id,
    seed,
    pool: "FRONTIER",
    intent: "confidence",
    pHat: predictP(theta, meta.b, form.guessFloor),
    operation: skill.operation,
    itemKey: itemKey(skill.id, level, form.id),
    followUp: "retry",
  };
}

/**
 * The Stage-2 repair item: the level whose parameters *guarantee* the step the
 * mal-rule breaks, not the level the child happened to be standing on.
 *
 * `null` when the curriculum binds no such level — which routes the caller back
 * to Stage 1 rather than serving a repair that repairs nothing.
 */
export function repairCard(
  catalog: Catalog,
  learner: LearnerState,
  context: SessionContext,
  card: PlannedCard,
  bug: BugId,
): PlannedCard | null {
  // The child's own skill first, then the easiest reachable one anywhere that
  // forces the step. A mal-rule fires on items that merely *happen* to have the
  // structure — the curriculum measured borrow-across-zero firing on 155 of 4,000
  // `subtract-multidigit` items, a skill whose levels never ask for a zero — so
  // repairing inside the skill the child was on would hand back a problem with no
  // zero in it at all, which tests nothing about the step that just broke.
  const own = catalog.byId.get(card.skillId);
  const skill =
    own !== undefined && levelGuaranteeing(own, bug) !== null
      ? own
      : // Reachability is deliberately **not** required here. The prerequisite
        // graph is a claim about what a child is ready for; a mal-rule that has
        // fired three times is evidence that they are already attempting the
        // step and getting it wrong. Refusing to show them the item that isolates
        // it, because a prerequisite is not formally Practiced, would be the
        // graph overruling the child.
        catalog.skills.find(
          (candidate) => levelGuaranteeing(candidate, bug) !== null && !isBenched(context, candidate.id),
        );
  if (skill === undefined) return null;
  if (isBenched(context, skill.id)) return null;
  const level = levelGuaranteeing(skill, bug);
  if (level === null) return null;
  const meta = skill.levels[level];
  if (meta === undefined) return null;
  const form = preferredForm(meta);
  const theta = thetaOf(learner, skill);
  const seed = drawInt(context.seed, context.rngCursor + 1531, 0x7fff_ffff);
  return {
    cardId: `${skill.id}#L${String(level)}#${String(seed)}`,
    skillId: skill.id,
    level,
    formId: form.id,
    seed,
    pool: "REPAIR",
    intent: "steady",
    pHat: predictP(theta, meta.b, form.guessFloor),
    operation: skill.operation,
    itemKey: itemKey(skill.id, level, form.id),
    followUp: "repair",
  };
}

/**
 * Should the rest of the planned batch be thrown away?
 *
 * ADAPTIVE_LEARNING.md is explicit that the batch is **re-planned on any
 * invariant trip** rather than served to completion, because a correction that
 * lands one batch late reads to the child as the app randomly getting easy and
 * then hard. Every reason returned here is a rule from that document, named.
 */
export function replanReasons(
  learner: LearnerState,
  context: SessionContext,
  remaining: readonly PlannedCard[],
): readonly string[] {
  const reasons: string[] = [];
  if (remaining.length === 0) return reasons;

  // The invariant is "never **two consecutive** items below `pTarget − 0.20`",
  // not "never one". Re-planning on a single hard card throws the batch away
  // after almost every wrong answer — the controller rises, one planned card
  // falls under the new floor, and the child gets a fresh batch whose first slot
  // is the same best candidate as before. Measured: a re-plan on every card and a
  // session that was three repeats of one skill.
  const floor = frustrationFloor(learner.pTarget);
  const next = remaining[0];
  const justServedHard = context.lastPHat !== null && context.lastPHat < floor;
  if (next !== undefined && next.pHat < floor && justServedHard) {
    reasons.push("the next planned card would be a second consecutive item below pTarget − 0.20");
  }
  for (let i = 1; i < remaining.length; i++) {
    const current = remaining[i];
    const previous = remaining[i - 1];
    if (current !== undefined && previous !== undefined && current.pHat < floor && previous.pHat < floor) {
      reasons.push("two consecutive planned cards are below pTarget − 0.20");
      break;
    }
  }

  const lastFive = context.outcomes.slice(-5);
  const failures = lastFive.filter((correct) => !correct).length;
  if (failures > 2 && !remaining.some((card) => card.intent === "confidence")) {
    reasons.push("more than two failures in five with no confidence card left in the batch");
  }

  const benched = remaining.filter((card) => isBenched(context, card.skillId));
  if (benched.length > 0) reasons.push(`${String(benched.length)} planned cards are from a benched skill`);

  const repairNeeded = remaining.every((card) => card.pool !== "REPAIR");
  const activeBug = Object.entries(learner.bugs).some(([key, state]) => {
    if (!isBugActive(state)) return false;
    const skillId = key.slice(0, key.lastIndexOf("#"));
    return !context.repairedBugs.includes(key) && remaining.some((card) => card.skillId === skillId);
  });
  if (repairNeeded && activeBug) reasons.push("a misconception became active and no repair is planned");

  return reasons;
}

/**
 * Anti-stagnation: three sessions with `θ` improving by less than 0.3 means the
 * scheduler **goes around** — the stuck skill comes back in a different form
 * rather than in more of the same.
 *
 * Tripling practice on one problem type (3 → 9 problems) had no effect on 1-week
 * or 4-week test scores. This is the rule that stops the engine doing it anyway.
 */
export function isStalled(history: readonly Fix[]): boolean {
  if (history.length < STALL_SESSIONS + 1) return false;
  const span = history.slice(-(STALL_SESSIONS + 1));
  const first = span[0];
  const last = span[span.length - 1];
  if (first === undefined || last === undefined) return false;
  return sub(last, first) < STALL_MIN_GAIN;
}

/** A different form of the same level, for the go-around. `null` if there is one form. */
export function alternateForm(skill: SkillMeta, level: number, current: string): string | null {
  const meta = skill.levels[level];
  if (meta === undefined) return null;
  const other = meta.forms.find((form) => form.id !== current);
  return other?.id ?? null;
}

/** Every consecutive-same-skill run in a batch, for the interleaving assertion. */
export function longestRun(cards: readonly PlannedCard[]): number {
  let longest = 0;
  let run = 0;
  let previous: SkillId | null = null;
  for (const card of cards) {
    run = card.skillId === previous ? run + 1 : 1;
    previous = card.skillId;
    if (run > longest) longest = run;
  }
  return longest;
}
