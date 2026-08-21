/**
 * `SkillNode` — one row of the curriculum graph.
 *
 * Fields follow CURRICULUM.md. Two of them are load-bearing in ways that are easy
 * to miss:
 *
 * - **Grade is not in the id.** It is `gradeBand`, because Singapore, CCSS and the
 *   English national curriculum agree on the spine and disagree on timing by 1–2
 *   years. Progression gates on prerequisites, never on grade.
 * - **Difficulty is not in the id.** `b` is a pure function of generator parameters;
 *   `difficulty.levels` stores the *expected* per-level value so gate CG-9 can
 *   recompute it from the params and fail on drift.
 */

import type { Rational } from "../math/rational.ts";
import type { CapabilityTag, FamilyId, FormId, LocKey, MalRuleId, RepId, SkillId } from "./ids.ts";

export type SkillStatus = "draft" | "active" | "deprecated";

export type EdgeKind = "requires" | "extends" | "supports" | "contrasts";

export type Edge = {
  readonly kind: EdgeKind;
  readonly to: SkillId;
};

export type GradeBand = {
  readonly earliest: number;
  readonly nominal: number;
  readonly latest: number;
};

/**
 * Where the node sits in its strand. Authored here rather than quoted from a
 * framework; provisional until the M4 domain PRs exercise all four.
 */
export type StrandRole = "spine" | "bridge" | "fluency" | "application";

/** NRC proficiency emphasis, 0–3 per strand. Integers: no floats in this package. */
export type Proficiency = {
  readonly conceptual: 0 | 1 | 2 | 3;
  readonly procedural: 0 | 1 | 2 | 3;
  readonly strategic: 0 | 1 | 2 | 3;
  readonly adaptive: 0 | 1 | 2 | 3;
};

/**
 * What kind of knowing this node claims. CG-13 (the choice-laundering ban) reads
 * this: a `conceptual` or `reasoning` node may not bind a choice-only generator.
 */
export type Classification = "conceptual" | "procedural" | "reasoning" | "fluency";

/** Median-latency target for fluency, in whole milliseconds. */
export type FluencyTarget = { readonly p50Ms: number };

export type GeneratorBinding = {
  readonly family: FamilyId;
  readonly familyRev: number;
  /** One parameter object per level, validated by the family's `paramSchema`. */
  readonly params: readonly unknown[];
  readonly forms: readonly FormId[];
  readonly minVariants: number;
  /**
   * How many problems the level has **in the world**, one entry per level.
   *
   * Declared only where the answer is a small finite number that no generator
   * work can change: there are thirty-six additions within ten, and there is no
   * thirty-seventh. CG-10's variant-space floor of 975 is derived from a model of
   * generators that do *not* close — it asks whether a 40-item practice run would
   * repeat itself, and treats a repeat as evidence of a shallow draw. On a closed
   * fact set the repeat is not evidence of anything: it is retrieval practice,
   * which is the entire pedagogy of a fluency row, and a floor of 975 would
   * forbid teaching number facts at all.
   *
   * So this replaces the floor for the levels that declare it, and it is not a
   * waiver. CG-10 checks the *measured* distinct count against the declared size,
   * so a generator that can reach a thirty-seventh addition within ten fails the
   * gate — which is the claim the row is really making, and the one worth
   * checking. CG-7 checks that a level does not declare `minVariants` above its
   * own set, and `numberFacts.test.ts` pins the sizes from the other side by
   * enumerating the sets and asserting the generator reaches every member.
   *
   * Omitted means the ordinary floor applies. A level that could be widened and
   * simply has not been must never carry this field.
   *
   * ## `null` for a level that is not closed, and why the array is not sparse
   *
   * Closure is a property of a **level**, not of a row, and the first row to need
   * that said so is `dw.alg.equality.missing-addend`: `4 + ☐ = 9` draws both numbers
   * 1..9, so L0 is the eighty-one single-digit missing addends and there is no
   * eighty-second — while L1 and L2 are two- and three-digit and have 7,400 and
   * 19,800 problems measured, far above CG-10's floor. Declaring the row closed at
   * every level to get L0 exempted would be a false claim about two levels that must
   * clear the floor and do; leaving L0 on the floor keeps a grade-1 row draft for a
   * reason that is not true of it.
   *
   * So an entry may be `null`, meaning "this level takes the ordinary floor". CG-7
   * still requires one entry per level — a short array would silently leave the last
   * levels on the floor while the row read as though they were exempt, which is the
   * failure the length check was added for — so the shape of the row is written out
   * rather than inferred from an omission.
   */
  readonly closedFactSet?: readonly (number | null)[];
  /** Capabilities the generated items assume the child already has (gate CG-6). */
  readonly consumes: readonly CapabilityTag[];
};

export type Difficulty = {
  /** `b_skill`: the node's own contribution, before generator parameters. */
  readonly b: Rational;
  /** Expected item difficulty per level. Recomputed and checked by CG-9. */
  readonly levels: readonly Rational[];
};

export type ProbeSpec = {
  readonly level: number;
  readonly seed: number;
  readonly purpose: "entry" | "promotion" | "repair";
};

/** Standards are stored as **codes only** — never framework prose (ADR-0010, M-18). */
export type StandardsCodes = {
  readonly ccss?: readonly string[];
  readonly sg?: readonly string[];
  readonly uk?: readonly string[];
};

export type SkillNode = {
  readonly id: SkillId;
  readonly rev: number;
  readonly status: SkillStatus;
  /** Set on a deprecated node that a new id replaced. Never reuse an id. */
  readonly supersededBy?: SkillId;

  /** Locale keys, never English literals. */
  readonly title: LocKey;
  readonly learnerGoal: LocKey;

  readonly domain: string;
  readonly cluster: string;
  readonly bigIdeas: readonly LocKey[];
  readonly gradeBand: GradeBand;
  readonly strandRole: StrandRole;
  readonly proficiency: Proficiency;
  readonly classification: Classification;
  readonly fluencyTarget?: FluencyTarget;

  readonly prereqs: readonly Edge[];
  readonly difficulty: Difficulty;
  readonly misconceptions: readonly MalRuleId[];
  readonly contrastsWith?: readonly SkillId[];
  readonly representations: {
    readonly required: readonly RepId[];
    readonly optional: readonly RepId[];
  };
  readonly generator: GeneratorBinding;
  readonly probes: readonly ProbeSpec[];
  readonly provides: readonly CapabilityTag[];
  readonly standards?: StandardsCodes;
};
