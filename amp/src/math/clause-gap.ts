import type { GeneratedProblem } from "./contracts.js";
import { buildAdditionClause } from "./clause-gap-addition.js";
import { buildMoreClause } from "./clause-gap-more.js";
import { clauseRandom, type ClauseCtx } from "./clause-gap-kit.js";
import { forcingLegacySurfaces } from "./number-domain-axes.js";
import { chooseAxes, defineAxis } from "./variation/axes.js";

/** Clause tasks added to an existing problem type. `legacy` keeps the
 * generator that shipped before the clause, byte for byte. */
const families: Record<string, { tasks: readonly string[]; weights: readonly number[] }> = {
  "add-ones-regroup": { tasks: ["add-tens", "blocks-to-stack"], weights: [8, 2, 2] },
  "three-addend-story": { tasks: ["which-equation"], weights: [8, 2] },
  "add-within-20": { tasks: ["near-double", "within-10-fluency"], weights: [8, 2, 2] },
  "subtract-within-20": { tasks: ["within-10-fluency"], weights: [8, 2] },
  "number-line-hops": { tasks: ["length-story", "from-zero"], weights: [8, 2, 2] },
  "add-several-two-digit": { tasks: ["tens-then-ones"], weights: [8, 2] },
  "add-with-regrouping": { tasks: ["blocks-to-stack"], weights: [8, 2] },
  "subtract-with-regrouping": { tasks: ["open-which"], weights: [8, 2] },
  "make-ten-fact": { tasks: ["all-one-digit-sums"], weights: [8, 2] },
  "related-subtraction": { tasks: ["all-one-digit-sums"], weights: [8, 2] },
  "add-three-digit": { tasks: ["round-and-adjust"], weights: [8, 2] },
  "subtract-three-digit": { tasks: ["count-up"], weights: [8, 2] },
  "add-multidigit": { tasks: ["stack-work"], weights: [8, 2] },
  "subtract-multidigit": { tasks: ["stack-work"], weights: [8, 2] },
  "number-bond-missing": { tasks: ["two-ways"], weights: [8, 2] },
  "ten-frame-complement": { tasks: ["record"], weights: [8, 2] },
  "money-total-dollars": { tasks: ["write-with-symbols"], weights: [8, 2] },
  "order-lengths": { tasks: ["full-order"], weights: [8, 2] },
  "staar-nested-grouping": { tasks: ["brace-nesting"], weights: [8, 2] },
};

function build(ctx: ClauseCtx): GeneratedProblem {
  if (additionIds.has(ctx.id)) return buildAdditionClause(ctx);
  if (moreIds.has(ctx.id)) return buildMoreClause(ctx);
  throw new Error(`No clause builder for ${ctx.id}`);
}

const additionIds = new Set([
  "add-ones-regroup",
  "three-addend-story",
  "add-within-20",
  "subtract-within-20",
  "number-line-hops",
  "add-several-two-digit",
  "add-with-regrouping",
  "subtract-with-regrouping",
  "make-ten-fact",
  "related-subtraction",
  "add-three-digit",
  "subtract-three-digit",
  "add-multidigit",
  "subtract-multidigit",
  "number-bond-missing",
  "ten-frame-complement",
]);
const moreIds = new Set(["money-total-dollars", "order-lengths", "staar-nested-grouping"]);

function axisOf(id: string) {
  const family = families[id]!;
  return {
    clause: defineAxis("clause", ["legacy", ...family.tasks], {
      legacy: "legacy",
      weights: family.weights,
      silentLegacy: true,
      since: 2,
    }),
  };
}

/** The clause variant for this seed, or null when the draw stays on the
 * pre-clause generator. Version 1 and legacy-surface reprints stay null. */
export function clauseVariantProblem(
  id: string,
  seed: string,
): GeneratedProblem | null {
  if (!families[id] || forcingLegacySurfaces()) return null;
  const task = chooseAxes(id, seed, axisOf(id)).clause;
  if (task === "legacy") return null;
  return build({ id, task, seed, r: clauseRandom(id, seed) });
}

/** A named clause task, for tests. Ignores the production draw. */
export function forcedClause(
  id: string,
  task: string,
  seed: string,
): GeneratedProblem {
  if (!families[id]?.tasks.includes(task))
    throw new Error(`No clause ${id}/${task}`);
  return build({ id, task, seed, r: clauseRandom(`${id}:${task}`, seed) });
}
