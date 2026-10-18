import type { TemplateMetadata } from "../../src/math/contracts";

export function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
function hash(id: string): number {
  let value = 2166136261;
  for (const char of id)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 0x100000000;
}
export type Population = {
  name: string;
  start: number;
  ability: number;
  uneven: number;
  learning: number;
  forgetting: number;
  slip: number;
  guess: number;
  noise: number;
  jump: number;
  difficultyOffset?: number;
  highSchoolScale?: number;
};
export const developmentPopulations: readonly Population[] = [
  {
    name: "steady",
    start: 4,
    ability: 4,
    uneven: 0.4,
    learning: 0.006,
    forgetting: 0.002,
    slip: 0.04,
    guess: 0.02,
    noise: 0.8,
    jump: 0,
  },
  {
    name: "outside-learning",
    start: 4,
    ability: 4,
    uneven: 0.5,
    learning: 0.012,
    forgetting: 0.003,
    slip: 0.05,
    guess: 0.03,
    noise: 0.9,
    jump: 2,
  },
  {
    name: "regression",
    start: 6,
    ability: 6,
    uneven: 0.6,
    learning: 0.005,
    forgetting: 0.008,
    slip: 0.05,
    guess: 0.02,
    noise: 1,
    jump: -2,
  },
];
/** Different abilities, heterogeneity and response noise, as well as new seeds. */
export const evaluationPopulations: readonly Population[] = [
  {
    name: "early-uneven",
    start: 4,
    ability: 2,
    uneven: 1,
    learning: 0.02,
    forgetting: 0.004,
    slip: 0.09,
    guess: 0.04,
    noise: 1.1,
    jump: 0,
  },
  {
    name: "advanced-jump",
    start: 6,
    ability: 8,
    uneven: 0.9,
    learning: 0.01,
    forgetting: 0.003,
    slip: 0.07,
    guess: 0.01,
    noise: 0.7,
    jump: 2,
  },
  {
    name: "uneven-loss",
    start: 7,
    ability: 7,
    uneven: 1.2,
    learning: 0.008,
    forgetting: 0.01,
    slip: 0.1,
    guess: 0.05,
    noise: 1.2,
    jump: -2,
  },
];
// Independent response family: a probit curve with template perturbations.
// It deliberately does not call the estimator's logistic probability/calibration.
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
export function syntheticProbability(
  template: TemplateMetadata,
  grade: number,
  ability: number,
  population: Population,
): number {
  const ruler =
    grade >= 9 ? 8 + (grade - 8) * (population.highSchoolScale ?? 1) : grade;
  const difficulty =
    ruler -
    0.4 +
    (hash(template.id) - 0.5) * 0.7 +
    (population.difficultyOffset ?? 0);
  const width = population.noise * (0.85 + 0.3 * hash(`${template.id}:width`));
  const guess = template.requiredResponseCapability
    ? Math.max(0.2, population.guess)
    : population.guess;
  return (
    guess +
    (1 - guess - population.slip) * normalCdf((ability - difficulty) / width)
  );
}
export class SyntheticLearner {
  private levels = new Map<string, number>();
  private last = new Map<string, number>();
  private random: () => number;
  constructor(
    readonly population: Population,
    readonly jumpAt: number,
    seed: number,
  ) {
    this.random = randomSource(seed);
  }
  ability(strand: string, attempt: number): number {
    const base =
      this.population.ability + this.population.uneven * (2 * hash(strand) - 1);
    const level = this.levels.get(strand) ?? base;
    const elapsedDays = (attempt - (this.last.get(strand) ?? 0)) / 6;
    const jump = attempt >= this.jumpAt ? this.population.jump : 0;
    return Math.max(
      -0.5,
      Math.min(12.5, level - elapsedDays * this.population.forgetting + jump),
    );
  }
  answer(
    template: TemplateMetadata,
    strand: string,
    grade: number,
    attempt: number,
  ) {
    const ability = this.ability(strand, attempt);
    const probability = syntheticProbability(
      template,
      grade,
      ability,
      this.population,
    );
    const correct = this.random() < probability;
    // Learning and forgetting happen in the learner, independently of the estimator.
    const jump = attempt >= this.jumpAt ? this.population.jump : 0;
    const gain =
      this.population.learning * (0.5 + 2 * probability * (1 - probability));
    this.levels.set(strand, ability - jump + gain);
    this.last.set(strand, attempt);
    return { correct, probability, ability };
  }
}

/** Deliberately misspecified ruler: diagnose assumptions, never tune to these. */
export const stressPopulations: readonly Population[] = [
  { ...developmentPopulations[0]!, name: "harder-items", difficultyOffset: 1 },
  { ...developmentPopulations[0]!, name: "easier-items", difficultyOffset: -1 },
  {
    ...evaluationPopulations[2]!,
    name: "compressed-secondary",
    ability: 9,
    start: 9,
    highSchoolScale: 0.6,
  },
];
