/**
 * The learner model's data types.
 *
 * Three layers (ADAPTIVE_LEARNING.md): **S** skill proficiency, **F** fact memory,
 * **B** misconception tracking. They are separate because the unit differs —
 * `34 + 29` is computed, not recalled — and merging them is the mistake that makes
 * spaced repetition degenerate into random practice.
 *
 * Every state record is **bounded by construction**: fixed fields, no arrays that
 * grow with use, no free-form strings. That is what makes the 100 KB budget in
 * gate EG-3 a property of the shape rather than a hope about usage.
 *
 * The engine does not import the curriculum. Ids are opaque strings here, so a
 * curriculum change cannot force an engine rebuild and the two CI filters stay
 * independent.
 */

import type { Fix } from "./math/fixed.ts";

export type SkillId = string;
export type BugId = string;
/** `skill:<id>#L<level>#<formId>` — a class of item, never an instance (ADR-0008). */
export type FactKey = string;

/** Whole days since an arbitrary epoch. The engine never reads a clock (EG-1). */
export type Day = number;

export type MasteryLevel = "new" | "practiced" | "mastered" | "retired";

/** 24 bytes packed: 2 fixed-point scalars, 4 small counters, 2 day stamps, 2 flags. */
export type SkillState = {
  /** θ: can do it. */
  readonly theta: Fix;
  /** φ: does it without counting. Never gates promotion (A-05). */
  readonly phi: Fix;
  readonly attempts: number;
  readonly correct: number;
  readonly consecutiveFailures: number;
  readonly level: MasteryLevel;
  /**
   * Whether any correct answer came from free entry rather than a closed list.
   * A choice item can never advance a skill past Practiced.
   */
  readonly freeEntryEvidence: boolean;
  readonly lastSeenDay: Day;
  readonly lastFailureDay: Day;
  readonly masteredSinceDay: Day;
};

/** 12 bytes: one decayed count and one raw count. Sparse, hard-capped. */
export type BugState = {
  /** β ← 0.9·β + 1{bug fired}. Active at β ≥ 2.2. */
  readonly beta: Fix;
  readonly firings: number;
};

/** 20 bytes. The FSRS card; the scheduler that advances it is a seam, not code here. */
export type FactCard = {
  readonly stability: Fix;
  readonly difficulty: Fix;
  readonly dueDay: Day;
  readonly reps: number;
  readonly lapses: number;
};

export type Rating = "again" | "hard" | "good" | "easy";

/** What the engine is told about one answered card. */
export type AttemptOutcome = {
  readonly correct: boolean;
  readonly latencyMs: number;
  /** Answer revisions before submitting. >0 then correct is a slip, never a bug. */
  readonly revisions: number;
  /** `b` of the item that was served. */
  readonly itemDifficulty: Fix;
  /** `c`: 0 for free entry, 1/k for a k-way choice. */
  readonly guessFloor: Fix;
  readonly fromChoice: boolean;
  /** The mal-rule the answer matched, if exactly one did. */
  readonly misconception?: BugId;
  /** 1 normally; 0.5 when fatigued or on a first unclassified error; 0.3 for a lucky-looking choice. */
  readonly evidenceWeight: Fix;
};

export type LatencyStats = {
  /** Seconds, fixed-point. Seconds rather than milliseconds keeps the variance small. */
  readonly meanS: Fix;
  readonly varianceS2: Fix;
  readonly count: number;
};

/**
 * One day's totals. 64 B × 180 days daily, older collapsed monthly — the parent
 * report reads these, the model does not.
 */
export type SessionRollup = {
  readonly day: Day;
  readonly served: number;
  readonly correct: number;
  readonly minutes: number;
  /** Sum of latencies in whole seconds, so a mean can be recovered without a float. */
  readonly seconds: number;
  readonly fatiguedCards: number;
};

/**
 * One entry of the Developer-Mode ring. 32 B, FIFO, capped, and **not** an input
 * to any model update — it exists for the explanation, the parent report and a
 * future recalibration, and nothing reads it back into `θ`.
 */
export type EngineEvent = {
  readonly day: Day;
  readonly skillId: SkillId;
  readonly level: number;
  readonly pool: string;
  readonly pHat: Fix;
  readonly correct: boolean;
  readonly latencyMs: number;
};

export type LearnerState = {
  readonly pTarget: Fix;
  readonly skills: Readonly<Record<SkillId, SkillState>>;
  readonly bugs: Readonly<Record<string, BugState>>;
  readonly facts: Readonly<Record<FactKey, FactCard>>;
  readonly latency: LatencyStats;
  readonly today: Day;
  /**
   * Cards answered in this learner's whole history. The cold-start rule — no card
   * in the first 20 below `P̂ = 0.55` — is a claim about the child, not about the
   * session, so a child who quits after six cards and comes back tomorrow is
   * still inside their first twenty.
   */
  readonly answered: number;
  /**
   * The last 50 skills served, oldest first.
   *
   * Persisted, because the rule it exists for is stated over a **rolling 50-item
   * window** and a child's session is 16 to 24 cards — so a window held only in
   * session state spans a fraction of the rule and the "≤40% from any one skill"
   * cap could never be enforced as written. Fifty dictionary-referenced ids cost
   * about 150 bytes.
   */
  readonly recent: readonly SkillId[];
  /** Oldest first, capped at `MAX_ROLLUPS`. */
  readonly rollups: readonly SessionRollup[];
  /** Oldest first, capped at `MAX_EVENTS`. Developer Mode only. */
  readonly events: readonly EngineEvent[];
};

export const NEW_SKILL_STATE: SkillState = {
  theta: 0 as Fix,
  phi: 0 as Fix,
  attempts: 0,
  correct: 0,
  consecutiveFailures: 0,
  level: "new",
  freeEntryEvidence: false,
  lastSeenDay: 0,
  lastFailureDay: 0,
  masteredSinceDay: 0,
};

export const NEW_BUG_STATE: BugState = { beta: 0 as Fix, firings: 0 };

export const NEW_FACT_CARD: FactCard = {
  stability: 0 as Fix,
  difficulty: 0 as Fix,
  dueDay: 0,
  reps: 0,
  lapses: 0,
};

/** The key a `BugState` is stored under: one entry per (skill, bug) pair. */
export function bugKey(skill: SkillId, bug: BugId): string {
  return `${skill}#${bug}`;
}

export function factKey(skill: SkillId, level: number, formId: string): FactKey {
  return `skill:${skill}#L${String(level)}#${formId}`;
}
