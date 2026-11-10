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
import { clauseTasks, forcedClause } from "./clause-gap";
import { historicalTemplates } from "./historical-templates";

/** Instances sampled to read a choice family's option count from its answer
 * schema. tests/frontier-guessing.test.ts checks far more seeds against it. */
const SAMPLE_SEEDS = 16;
const STRUCTURED_SEEDS = 128;
const CLAUSE_SEEDS = 64;
/** Floors for variable-response families whose high-guessability variants
 * are rarer than the deterministic sample. Keep these in sync with the
 * generator-variation audit in frontier-guessing.test.ts. */
const MULTI_PART_GUESS_FLOOR: Readonly<Record<string, number>> = {
  // Clause choices can have three options after duplicate distractors are removed.
  "graphical-solution-table": 1 / 3,
  // A rate of two leaves 3, 3 and 4 choices in the ordered-pair slots.
  "dependent-variable-value": 1 / 36,
  // Four reusable slots can share a tray with only four distinct cards.
  "tile-then-multiply": 1 / 256,
  // Split rectangles use four reusable slots and at least five distinct cards.
  "split-tiled-count": 1 / 625,
  "circle-estimate-blanks": 1 / 8,
  "round-decimal-blanks": 1 / 8,
  "quotient-remainder-blanks": 1 / 8,
  "unit-rate-pair-blanks": 1 / 8,
  "decimal-mixed-number-blanks": 1 / 48,
  "round-place-blanks": 1 / 36,
  "round-addends-sum": 1 / 36,
  "expanded-decimal-slots": 1 / 54,
  // Answers given before these families moved to cards were inline picks
  // with fewer combinations; the estimator rescores them with today's value.
  "square-root-solutions-slots": 1 / 16,
  "dilation-rule-slots": 1 / 16,
  "budget-inequality-slots": 1 / 36,
  // Two factors among three or four choices, or three multiples among four or five.
  "factor-pairs-select": 1 / 3,
  "multiples-select": 1 / 4,
  // Two identical wrong bounds collapse to one: 4 shares × 3 bounds × 4 checks.
  "whole-sharing-fraction": 1 / 48,
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
// The server build computes every family once and inlines the table here
// (scripts/build-server.ts). Without it, as under tsx and in tests, each family
// is computed on first use. Sampling a family takes up to 2 s of CPU, too long
// to pay on a request thread.
declare const __AMP_GUESS_CHANCES__:
  Readonly<Record<string, number>> | undefined;
const built =
  typeof __AMP_GUESS_CHANCES__ === "undefined"
    ? []
    : Object.entries(__AMP_GUESS_CHANCES__);
const cache = new Map<string, number>(built);

/** Families whose guessing chance came from the build. Zero in a compiled
 * server means requests are paying to compute them. */
export const builtGuessChances = built.length;

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
  template: Pick<
    TemplateMetadata,
    "id" | "requiredResponseCapability" | "requiredResponseCapabilities"
  >,
): number {
  const known = cache.get(template.id);
  if (known !== undefined) return known;
  let chance =
    template.requiredResponseCapability || template.requiredResponseCapabilities?.length
      ? UNKNOWN_CHOICE_GUESS
      : 0;
  if (byId.has(template.id)) {
    // Admission capabilities describe what old clients can receive, not all
    // current answer forms. Even a typed family can have choice clauses.
    // Structured work mixes typed steps (never guessed) with orderings and
    // proofs built from banks; sample more, and a family whose every
    // sampled instance has a typed field cannot be guessed.
    const structured =
      template.requiredResponseCapability === "structured-work-v1" ||
      template.requiredResponseCapabilities?.includes("structured-work-v1");
    // The sample can miss rare, more guessable variants in these generators.
    let greatest = MULTI_PART_GUESS_FLOOR[template.id] ?? 0;
    for (let i = 0; i < (structured ? STRUCTURED_SEEDS : SAMPLE_SEEDS); i++)
      greatest = Math.max(
        greatest,
        problemGuessChance(generateProblem(template.id, `guess-chance:${i}`)),
      );
    // Clause tasks are drawn by weight, so a rare one can miss the sample.
    // Sample each task directly; card trays vary by seed, so sample each task well.
    for (const task of clauseTasks(template.id))
      for (let i = 0; i < CLAUSE_SEEDS; i++)
        greatest = Math.max(
          greatest,
          problemGuessChance(
            forcedClause(template.id, task, `guess-chance:${task}:${i}`),
          ),
        );
    chance = greatest;
  }
  cache.set(template.id, chance);
  return chance;
}

/** Inline every family's chance, including zero, so typed families do not
 * pay for schema sampling on a production request. */
export function guessChanceTable(
  families: Iterable<TemplateMetadata> = byId.values(),
): Record<string, number> {
  return Object.fromEntries(
    [...families].map((t) => [t.id, guessChance(t)] as const),
  );
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
