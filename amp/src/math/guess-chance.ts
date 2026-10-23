import type { ProblemResponse, TemplateMetadata } from "./contracts";
import { generateProblem, templates } from "./engine";

/** Instances sampled to read a choice family's option count from its answer
 * schema. tests/frontier-guessing.test.ts checks far more seeds against it. */
const SAMPLE_SEEDS = 16;
/** An unregistered choice family is scored as the most guessable choice: two
 * options. Overstating the guess chance only discounts a correct answer. */
const UNKNOWN_CHOICE_GUESS = 1 / 2;

const byId = new Map(templates.map((template) => [template.id, template]));
const cache = new Map<string, number>();

/** Uniform guessing among all permitted answers; multiple selections are sets. */
export function responseGuessChance(response: ProblemResponse): number {
  if (response.kind === "choice") return 1 / response.options.length;
  if (response.kind !== "multi-select") return 0;
  const n = response.options.length,
    k = response.selectionCount;
  if (!Number.isInteger(k) || k < 2 || k >= n) return UNKNOWN_CHOICE_GUESS;
  let combinations = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++)
    combinations = (combinations * (n - i + 1)) / i;
  return 1 / combinations;
}

/** Use the greatest sampled guessing chance when a family's answer forms vary.
 * Typed answers have chance 0, single choices 1/n, and k-of-n selections 1/C(n,k). */
export function guessChance(
  template: Pick<TemplateMetadata, "id" | "requiredResponseCapability">,
): number {
  if (!template.requiredResponseCapability) return 0;
  const known = cache.get(template.id);
  if (known !== undefined) return known;
  let chance = UNKNOWN_CHOICE_GUESS;
  if (byId.has(template.id)) {
    let greatest = 0;
    for (let i = 0; i < SAMPLE_SEEDS; i++) {
      const response = generateProblem(template.id, `guess-chance:${i}`).public
        .response;
      greatest = Math.max(greatest, responseGuessChance(response));
    }
    if (greatest > 0) chance = greatest;
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
