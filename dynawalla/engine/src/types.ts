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

export type LearnerState = {
  readonly pTarget: Fix;
  readonly skills: Readonly<Record<SkillId, SkillState>>;
  readonly bugs: Readonly<Record<string, BugState>>;
  readonly facts: Readonly<Record<FactKey, FactCard>>;
  readonly latency: LatencyStats;
  readonly today: Day;
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

/** The key a `BugState` is stored under: one entry per (skill, bug) pair. */
export function bugKey(skill: SkillId, bug: BugId): string {
  return `${skill}#${bug}`;
}

export function factKey(skill: SkillId, level: number, formId: string): FactKey {
  return `skill:${skill}#L${String(level)}#${formId}`;
}
