import type { TemplateMetadata } from "./contracts";
import { generateProblem, templates } from "./engine";

/** Instances sampled to read a choice family's option count from its answer
 * schema. tests/guess-chance.test.ts checks far more seeds against it. */
const SAMPLE_SEEDS = 16;
/** An unregistered choice family is scored as the most guessable choice: two
 * options. Overstating the guess chance only discounts a correct answer. */
const UNKNOWN_CHOICE_GUESS = 1 / 2;

const byId = new Map(templates.map((template) => [template.id, template]));
const cache = new Map<string, number>();

/** Chance that a blind guess is graded correct on this family: 0 for a typed
 * answer, 1/k for a single choice among k options. When instances differ in
 * option count the smallest count wins, so the chance is never understated. */
export function guessChance(
  template: Pick<TemplateMetadata, "id" | "requiredResponseCapability">,
): number {
  if (template.requiredResponseCapability !== "single-choice-v1") return 0;
  const known = cache.get(template.id);
  if (known !== undefined) return known;
  let chance = UNKNOWN_CHOICE_GUESS;
  if (byId.has(template.id)) {
    let fewest = Infinity;
    for (let i = 0; i < SAMPLE_SEEDS; i++) {
      const response = generateProblem(template.id, `guess-chance:${i}`).public
        .response;
      if (response.kind === "choice")
        fewest = Math.min(fewest, response.options.length);
    }
    if (Number.isFinite(fewest) && fewest >= 2) chance = 1 / fewest;
  }
  cache.set(template.id, chance);
  return chance;
}

/** `guessChance` by template id, for the frontier estimator. Unknown ids are
 * typed answers; the estimator ignores them anyway (they have no grade). */
export function guessChanceOf(templateId: string): number {
  const template = byId.get(templateId);
  return template ? guessChance(template) : 0;
}
