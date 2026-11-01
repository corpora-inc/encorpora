import type {
  GeneratedProblem,
  ProblemResponse,
  TemplateMetadata,
} from "./contracts";
import { pointPlotGuessChance } from "./point-plot";
import { multiPartGuessChance } from "./multi-part-choice";
import { figureChoiceGuessChance } from "./figure-choice";
import { structuredWorkGuessChance } from "./structured-work";
import { generateProblem, templates } from "./engine";
import { historicalTemplates } from "./historical-templates";

/** Instances sampled to read a choice family's option count from its answer
 * schema. tests/frontier-guessing.test.ts checks far more seeds against it. */
const SAMPLE_SEEDS = 16;
const STRUCTURED_SEEDS = 128;
/** Floors for variable multi-part families whose high-guessability variants
 * are rarer than the deterministic sample. Keep these in sync with the
 * generator-variation audit in frontier-guessing.test.ts. */
const MULTI_PART_GUESS_FLOOR: Readonly<Record<string, number>> = {
  "circle-estimate-blanks": 1 / 8,
  "round-decimal-blanks": 1 / 8,
  "quotient-remainder-blanks": 1 / 8,
  "unit-rate-pair-blanks": 1 / 8,
  "decimal-mixed-number-blanks": 1 / 48,
  "round-place-blanks": 1 / 36,
  "round-addends-sum": 1 / 36,
  "expanded-decimal-slots": 1 / 54,
};
/** An unregistered choice family is scored as the most guessable choice: two
 * options. Overstating the guess chance only discounts a correct answer. */
const UNKNOWN_CHOICE_GUESS = 1 / 2;

const byId = new Map(
  [...templates, ...historicalTemplates].map((template) => [
    template.id,
    template,
  ]),
);
const cache = new Map<string, number>();

/** Uniform guessing among all permitted answers; multiple selections are sets.
 * Structured work needs its private rule to count valid orders and proofs
 * (`problemGuessChance`); from the public response alone it is unknown. */
export function responseGuessChance(response: ProblemResponse): number {
  if (response.kind === "structured-work") return UNKNOWN_CHOICE_GUESS;
  if (response.kind === "choice") return 1 / response.options.length;
  if (response.kind === "point-plot") return pointPlotGuessChance(response);
  if (response.kind === "multi-part-choice")
    return multiPartGuessChance(response);
  if (response.kind === "figure-choice")
    return figureChoiceGuessChance(response);
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
    // Structured work mixes typed steps (never guessed) with orderings and
    // proofs built from banks; sample more, and a family whose every
    // sampled instance has a typed field cannot be guessed.
    const structured =
      template.requiredResponseCapability === "structured-work-v1";
    // The sample can miss rare, more guessable variants in these generators.
    let greatest = MULTI_PART_GUESS_FLOOR[template.id] ?? 0;
    for (let i = 0; i < (structured ? STRUCTURED_SEEDS : SAMPLE_SEEDS); i++)
      greatest = Math.max(
        greatest,
        problemGuessChance(generateProblem(template.id, `guess-chance:${i}`)),
      );
    if (greatest > 0 || structured) chance = greatest;
  }
  cache.set(template.id, chance);
  return chance;
}

/** One instance's guessing chance, using its private rule where needed. */
export function problemGuessChance(problem: GeneratedProblem): number {
  const response = problem.public.response;
  if (response.kind === "structured-work")
    return problem.workGrading
      ? structuredWorkGuessChance(response, problem.workGrading)
      : UNKNOWN_CHOICE_GUESS;
  return responseGuessChance(response);
}

/** `guessChance` by template id, for the frontier estimator. Unknown ids are
 * typed answers; the estimator ignores them anyway (they have no grade). */
export function guessChanceOf(templateId: string): number {
  const template = byId.get(templateId);
  return template ? guessChance(template) : 0;
}
