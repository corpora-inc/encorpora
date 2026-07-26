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
