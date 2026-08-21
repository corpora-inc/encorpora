/**
 * A synthetic curriculum for the harness.
 *
 * The engine cannot import `dynawalla/curriculum` and should not want to: the M2
 * app ships three active skills, and three skills cannot exercise "at least three
 * distinct skills per batch", "at most 40% of a rolling 50-item window from one
 * skill", or "a Mastered skill unfailed for 21 days is Retired". A scheduler
 * tested only against the content that happens to exist is a scheduler tested
 * against nothing.
 *
 * So the harness builds a graph with the *shape* V1 is planned to have — six
 * domains, a spine of prerequisites per domain, four levels a skill, a mal-rule
 * per domain and a mixture of free-entry and choice forms — and the real
 * curriculum is checked against the real gates in `dynawalla/curriculum`.
 *
 * Everything here is a pure function of an index. There is no randomness in the
 * graph: two runs of the harness must build the same curriculum or EG-2 means
 * nothing.
 */

import { catalogOf } from "../catalog.ts";
import type { Catalog, FormMeta, LevelMeta, SkillMeta } from "../catalog.ts";
import { fromRatio } from "../math/fixed.ts";
import type { Fix } from "../math/fixed.ts";
import { skillId } from "./ids.ts";

const DOMAINS = ["ns", "add", "mul", "div", "frac", "alg"] as const;
const OPERATIONS: Record<(typeof DOMAINS)[number], string> = {
  ns: "count",
  add: "add",
  mul: "mul",
  div: "div",
  frac: "frac",
  alg: "alg",
};

/** Skills per domain. Twelve × six is seventy-two — the V1 target is 160. */
export const PER_DOMAIN = 12;
export const LEVELS_PER_SKILL = 4;

const FREE_ENTRY: FormMeta = { id: "free-entry", guessFloor: fromRatio(0, 1), enumerable: false };
const FREE_ENTRY_FACT: FormMeta = { id: "free-entry", guessFloor: fromRatio(0, 1), enumerable: true };
const CHOICE_4: FormMeta = { id: "choice-4", guessFloor: fromRatio(1, 4), enumerable: false };

/**
 * `b` for a skill: it rises across the domain's spine and across levels.
 *
 * Hundredths of a logit, so the whole table is integers. The spread is roughly
 * −1.4 to +3.6 across skills and levels together, which is the range the real
 * curriculum's one populated domain shows: `subtract-multidigit` sits at
 * `b̄ = −0.50` with levels to `+1.20`, and `subtract-across-zero` at `0.00` with
 * levels to `+2.75`. An earlier draft used a step half again as large, which put
 * the top of the graph five and a half logits above the bottom — further than a
 * child can travel in 180 days, so `A-08`'s "one Practiced skill per ten active
 * days" was failing on the shape of the synthetic graph rather than on anything
 * the scheduler did.
 */
function skillB(position: number): Fix {
  return fromRatio(-140 + position * 25, 100);
}

function levelB(base: Fix, level: number): Fix {
  return (base + fromRatio(level * 45, 100)) as Fix;
}

export function harnessCatalog(): Catalog {
  const skills: SkillMeta[] = [];
  DOMAINS.forEach((domain, domainIndex) => {
    for (let step = 0; step < PER_DOMAIN; step++) {
      const id = skillId(`dw.${domain}.s${String(step).padStart(2, "0")}`);
      const base = skillB(step + domainIndex);
      const levels: LevelMeta[] = [];
      for (let level = 0; level < LEVELS_PER_SKILL; level++) {
        // Level 0 of every third skill is an enumerable fact — the bounded set
        // Layer F schedules. Level 1 of every fourth is a four-way choice, so the
        // guess floor and the "a choice item can never advance past Practiced"
        // rule are both exercised.
        const forms: FormMeta[] =
          level === 0 && step % 3 === 0
            ? [FREE_ENTRY_FACT]
            : level === 1 && step % 4 === 0
              ? [FREE_ENTRY, CHOICE_4]
              : [FREE_ENTRY];
        levels.push({
          b: levelB(base, level),
          // The hardest two levels of each skill are the ones whose parameters
          // *force* the step the domain's mal-rule breaks — the repair item comes
          // from there and not from wherever the child was standing.
          guarantees: level >= 2 ? [`mis.${domain}.core`] : [],
          forms,
        });
      }
      skills.push({
        id,
        b: base,
        levels,
        prereqs: step === 0 ? [] : [skillId(`dw.${domain}.s${String(step - 1).padStart(2, "0")}`)],
        operation: OPERATIONS[domain],
        gradeNominal: 1 + Math.floor(step / 3),
        misconceptions: [`mis.${domain}.core`],
      });
    }
  });
  return catalogOf(skills);
}

/** The mal-rule a skill can exhibit, for the bug-carrying personas. */
export function malRuleOf(id: string): string {
  const domain = id.split(".")[1] ?? "add";
  return `mis.${domain}.core`;
}
