import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import { estimateFrontier, strandLevel } from "../src/learning/frontier";
import { PLACEMENT_ATTEMPTS } from "../src/learning/placement";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { generateProblem, templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import type { TemplateMetadata } from "../src/math/contracts";
import type { Outcome } from "../src/server/repository";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const byId = new Map(templates.map((template) => [template.id, template]));
const gradeOf = (id: string) => templateGrade(byId.get(id)!, nodes);
const strandOf = (id: string) => nodes.get(byId.get(id)!.skillId)!.strand;
const october = Date.parse("2026-10-19T12:00:00Z");

// Synthetic learners use their own response family, not the estimator's:
// a probit curve with per-family difficulty noise. On a choice item a learner
// who does not know the answer picks one of the k options at random.
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const density = Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const tail =
    density *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - tail : tail;
}
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 0x100000000;
}
function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

type Run = {
  /** |overall estimate − true level| after placement. */
  overallError: number;
  /** Mean |strand estimate − true level| over the strands placement visited. */
  strandError: number;
  /** The visited strand estimated furthest above the true level, in grades. */
  worstOverestimate: number;
  /** Mean strand error over the strands where placement asked a choice item;
   * null when it asked none. */
  choiceStrandError: number | null;
  /** Answers until the overall estimate is within a grade and stays there;
   * PLACEMENT_ATTEMPTS + 1 when placement ends without settling. */
  toPlace: number;
  choiceShare: number;
};
/** One placement: the production planner and estimator, one problem per
 * request as the app asks for them, PLACEMENT_ATTEMPTS answers. */
function place(options: {
  level: number;
  start: number;
  seed: number;
  catalog: readonly TemplateMetadata[];
  guessOf: (templateId: string) => number;
}): Run {
  const random = randomSource(options.seed * 7919 + 17);
  const attempts: Outcome[] = [];
  const errors: number[] = [];
  let choices = 0;
  const choiceStrands = new Set<string>();
  let frontier = estimateFrontier({
    start: options.start,
    observations: attempts,
    gradeOf,
    strandOf,
    guessOf: options.guessOf,
    now: october,
  });
  for (let i = 0; i < PLACEMENT_ATTEMPTS; i++) {
    const at = october + i * 60000;
    const key = `sim:${options.level}:${options.start}:${options.seed}`;
    const [choice] = planMixedPractice({
      templates: options.catalog,
      skills,
      attempts,
      evidence: projectSkillEvidence(attempts),
      frontier,
      count: 1,
      seed: `${key}:${i}`,
      now: at,
      learnerKey: key,
    });
    const template = choice!.template;
    const response = generateProblem(template.id, `${key}:${i}`).public
      .response;
    const guess =
      response.kind === "choice" ? 1 / response.options.length : 0.03;
    if (response.kind === "choice") {
      choices++;
      choiceStrands.add(choice!.strand);
    }
    const difficulty = gradeOf(template.id) - 0.4 + (hash(template.id) - 0.5);
    const knows = normalCdf((options.level - difficulty) / 0.8);
    const correct = random() < guess + (1 - guess - 0.03) * knows;
    attempts.push({
      id: `${key}:${i}`,
      problemId: `${key}:p${i}`,
      requestId: `${key}:r${i}`,
      skillId: template.skillId,
      templateId: template.id,
      response: "",
      correct,
      assisted: false,
      explanation: [],
      answer: "",
      createdAt: new Date(at).toISOString(),
    });
    frontier = estimateFrontier({
      start: options.start,
      observations: attempts,
      gradeOf,
      strandOf,
      guessOf: options.guessOf,
      now: at,
    });
    errors.push(Math.abs(frontier.overall.level - options.level));
  }
  let toPlace = PLACEMENT_ATTEMPTS + 1;
  for (let n = PLACEMENT_ATTEMPTS; n >= 1 && errors[n - 1]! <= 1; n--)
    toPlace = n;
  const strands = Object.keys(frontier.strands);
  const errorOf = (strand: string) =>
    Math.abs(strandLevel(frontier, strand) - options.level);
  return {
    choiceStrandError: choiceStrands.size
      ? [...choiceStrands].reduce((sum, s) => sum + errorOf(s), 0) /
        choiceStrands.size
      : null,
    overallError: errors.at(-1)!,
    strandError:
      strands.reduce(
        (sum, strand) =>
          sum + Math.abs(strandLevel(frontier, strand) - options.level),
        0,
      ) / strands.length,
    worstOverestimate: Math.max(
      0,
      ...strands.map((strand) => strandLevel(frontier, strand) - options.level),
    ),
    toPlace,
    choiceShare: choices / PLACEMENT_ATTEMPTS,
  };
}

/** Learners from below kindergarten to grade 8.5, each starting from an age
 * two grades below, at, or two grades above their true level. */
export function simulatePlacement(options: {
  catalog: readonly TemplateMetadata[];
  guessOf: (templateId: string) => number;
  seeds?: readonly number[];
}) {
  const { catalog, guessOf } = options;
  const runs: Run[] = [];
  for (const level of [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5])
    for (const offset of [-2, 0, 2])
      for (const seed of options.seeds ?? [1, 2, 3, 4, 5, 6]) {
        const start = Math.max(0, Math.min(12, Math.round(level) + offset));
        runs.push(place({ level, start, seed, catalog, guessOf }));
      }
  const mean = (pick: (run: Run) => number | null) => {
    const values = runs.map(pick).filter((value) => value !== null);
    const total = values.reduce((sum, value) => sum + value, 0);
    return Math.round((total / values.length) * 1000) / 1000;
  };
  return {
    learners: runs.length,
    overallError: mean((run) => run.overallError),
    strandError: mean((run) => run.strandError),
    worstOverestimate: mean((run) => run.worstOverestimate),
    choiceStrandError: mean((run) => run.choiceStrandError),
    toPlace: mean((run) => run.toPlace),
    choiceShare: mean((run) => run.choiceShare),
  };
}
