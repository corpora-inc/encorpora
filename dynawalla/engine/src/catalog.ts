/**
 * What the scheduler is allowed to know about the curriculum.
 *
 * The engine does not import `dynawalla/curriculum` — `boundary.test.ts` fails
 * the build if it ever does — so the shape of the graph arrives as data. That is
 * not a purity ritual: the simulation harness needs a graph with seventy skills
 * and six domains to exercise the interleaving and window rules, and the M2 app
 * has three. If the scheduler read the real graph directly, the harness could
 * only ever test the scheduler against the content that happens to exist.
 *
 * Everything here is what a *selection* decision needs and nothing else. There is
 * no prompt, no renderer, no locale key and no answer schema in a `SkillMeta`,
 * because the engine never draws anything and never judges anything.
 *
 * `levels` is ordered easiest-first and the scheduler relies on it. A catalog
 * that is not ordered is a bug the constructor rejects, rather than a subtly
 * wrong difficulty search nobody notices.
 */

import type { Fix } from "./math/fixed.ts";
import type { BugId, SkillId } from "./types.ts";

/**
 * One level of one skill.
 *
 * `guarantees` is the list of mal-rules whose broken step this level's generator
 * parameters *force* an item to exercise. It is what makes a repair item a repair
 * rather than another card: the child's own level will usually hand back a
 * problem with no zero in it at all, which tests nothing about the step that just
 * broke. Curriculum knowledge, so it arrives as data.
 */
export type LevelMeta = {
  /** `b_item` — the node's own `b̄` plus the generator's parameter offset. */
  readonly b: Fix;
  readonly guarantees: readonly BugId[];
  /**
   * The forms this level can be asked in. A form that is a closed list of `k`
   * options carries a guess floor; free entry carries none.
   */
  readonly forms: readonly FormMeta[];
};

export type FormMeta = {
  readonly id: string;
  /** `c` in `P = c + (1−c)·σ(θ−b)`. Zero for free entry, `1/k` for a k-way choice. */
  readonly guessFloor: Fix;
  /**
   * Whether an item of this form is an *enumerable fact* — one of the ~180 things
   * a fluent child recalls rather than computes. Only these get FSRS cards
   * (ADR-0008); `34 + 29` is computed, and scheduling it as a memory item is a
   * category error.
   */
  readonly enumerable: boolean;
};

export type SkillMeta = {
  readonly id: SkillId;
  /** `b̄_s` — the node's own contribution, used for the mastery decision. */
  readonly b: Fix;
  /** Easiest first. Enforced by `catalogOf`. */
  readonly levels: readonly LevelMeta[];
  /** Direct prerequisites. The 0.15× residual propagates to these. */
  readonly prereqs: readonly SkillId[];
  /** The tag the interleaving rule groups on — `add`, `sub`, `mul`, `div`. */
  readonly operation: string;
  /** Nominal grade. Cold start seeds one band above at `b̄ − 2.0`. */
  readonly gradeNominal: number;
  readonly misconceptions: readonly BugId[];
};

export type Catalog = {
  readonly skills: readonly SkillMeta[];
  /** By id. Built once; the scheduler looks skills up per slot. */
  readonly byId: ReadonlyMap<SkillId, SkillMeta>;
  /** Direct dependents, so a residual can propagate and a frontier can be found. */
  readonly dependents: ReadonlyMap<SkillId, readonly SkillId[]>;
};

/**
 * Build a catalog, rejecting the two shapes that would make selection quietly
 * wrong rather than loudly broken.
 *
 * Skills are sorted by id in **code-unit** order, never `localeCompare`: this
 * ordering decides ties, ICU collation varies by locale and by ICU version, and
 * EG-2 claims byte-identical transcripts on a device.
 */
export function catalogOf(skills: readonly SkillMeta[]): Catalog {
  const sorted = [...skills].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<SkillId, SkillMeta>();
  for (const skill of sorted) {
    if (byId.has(skill.id)) throw new RangeError(`catalogOf: duplicate skill ${skill.id}`);
    if (skill.levels.length === 0) throw new RangeError(`catalogOf: ${skill.id} has no levels`);
    for (let i = 1; i < skill.levels.length; i++) {
      const previous = skill.levels[i - 1];
      const current = skill.levels[i];
      if (previous === undefined || current === undefined) continue;
      if (current.b < previous.b) {
        throw new RangeError(`catalogOf: ${skill.id} level ${String(i)} is easier than level ${String(i - 1)}`);
      }
    }
    for (const level of skill.levels) {
      if (level.forms.length === 0) throw new RangeError(`catalogOf: ${skill.id} has a level with no form`);
    }
    byId.set(skill.id, skill);
  }

  const dependents = new Map<SkillId, SkillId[]>();
  for (const skill of sorted) {
    for (const prereq of skill.prereqs) {
      if (!byId.has(prereq)) throw new RangeError(`catalogOf: ${skill.id} requires missing ${prereq}`);
      const list = dependents.get(prereq) ?? [];
      list.push(skill.id);
      dependents.set(prereq, list);
    }
  }

  return { skills: sorted, byId, dependents };
}

export function skillMeta(catalog: Catalog, id: SkillId): SkillMeta | undefined {
  return catalog.byId.get(id);
}

/** The level whose `b` is closest to a target, by index. Ties take the easier. */
export function levelNearest(skill: SkillMeta, bTarget: Fix): number {
  let best = 0;
  let bestMiss = -1;
  for (let i = 0; i < skill.levels.length; i++) {
    const level = skill.levels[i];
    if (level === undefined) continue;
    const miss = level.b > bTarget ? level.b - bTarget : bTarget - level.b;
    if (bestMiss < 0 || miss < bestMiss) {
      bestMiss = miss;
      best = i;
    }
  }
  return best;
}

/** The first level that forces an item to exercise a mal-rule's broken step. */
export function levelGuaranteeing(skill: SkillMeta, bug: BugId): number | null {
  for (let i = 0; i < skill.levels.length; i++) {
    if (skill.levels[i]?.guarantees.includes(bug) === true) return i;
  }
  return null;
}

/** The free-entry form if the level has one, else the form with the lowest floor. */
export function preferredForm(level: LevelMeta): FormMeta {
  let best = level.forms[0];
  if (best === undefined) throw new RangeError("preferredForm: level has no form");
  for (const form of level.forms) {
    if (form.guessFloor < best.guessFloor) best = form;
  }
  return best;
}
