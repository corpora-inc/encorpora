import type { GradeBand } from "../curriculum/types";
import type { TemplateMetadata } from "../math/contracts";

/** Shared coordinate system, not an equivalence between school courses. */
export const gradeNumber: Record<GradeBand, number> = {
  K: 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "algebra-1": 9,
  geometry: 10,
  "algebra-2": 11,
  precalculus: 12,
};
export type ItemCalibration = {
  /** Ability at the midpoint between the guess floor and slip ceiling. */
  difficulty: number;
  discrimination: number;
  guess: number;
  slip: number;
};
type Node = { gradeBand?: GradeBand; prerequisites?: readonly string[] };
const coarse = { "K–2": 1, "3–5": 4, "6–8": 7, "9–12": 10 } as const;
export function templateGrade(
  template: TemplateMetadata,
  nodes: ReadonlyMap<string, Node>,
): number {
  const band = nodes.get(template.skillId)?.gradeBand;
  return band ? gradeNumber[band] : coarse[template.gradeBand];
}

/** Editorial starting assumptions. No learner-data fit or efficacy claim.
 * Version keys prevent silently applying an override to a revised generator. */
export const editorialCalibration: Readonly<
  Record<string, { offset: number; discrimination: number }>
> = {
  "count-objects@1": { offset: -0.1, discrimination: 1.8 },
  "multiply-facts@1": { offset: -0.1, discrimination: 1.8 },
  "linear-equation@1": { offset: 0.1, discrimination: 1.6 },
  "divide-fractions@1": { offset: 0.1, discrimination: 1.6 },
};
export function gradeCalibration(grade: number): ItemCalibration {
  return {
    difficulty: grade - 0.5,
    discrimination: 1.7,
    guess: 0.04,
    slip: 0.04,
  };
}
/** New template IDs get a conservative default automatically. Direct prerequisite
 * count is a bounded proxy for skill depth, not an inferred learning outcome. */
export function templateCalibration(
  template: TemplateMetadata,
  nodes: ReadonlyMap<string, Node>,
): ItemCalibration {
  const base = gradeCalibration(templateGrade(template, nodes));
  const entry = editorialCalibration[`${template.id}@${template.version}`];
  const depth = Math.min(
    4,
    nodes.get(template.skillId)?.prerequisites?.length ?? 0,
  );
  return {
    ...base,
    difficulty: base.difficulty + (entry?.offset ?? depth * 0.04),
    discrimination: entry?.discrimination ?? 1.7,
    // A four-option response has a larger chance floor than free response.
    guess:
      template.requiredResponseCapability === "single-choice-v1"
        ? 0.25
        : base.guess,
  };
}
export function itemSuccess(theta: number, item: ItemCalibration): number {
  return (
    item.guess +
    (1 - item.guess - item.slip) /
      (1 + Math.exp(-item.discrimination * (theta - item.difficulty)))
  );
}
/** Local Bernoulli Fisher information, averaged over a normal approximation
 * to the posterior. Five quadrature points keep per-candidate work bounded. */
export function itemInformation(
  estimate: { level: number; sd: number },
  item: ItemCalibration,
): number {
  const weights = [0.0545, 0.2442, 0.4026, 0.2442, 0.0545];
  return weights.reduce((total, weight, i) => {
    const p = itemSuccess(estimate.level + (i - 2) * estimate.sd, item);
    const logistic = (p - item.guess) / (1 - item.guess - item.slip);
    const derivative =
      item.discrimination *
      (1 - item.guess - item.slip) *
      logistic *
      (1 - logistic);
    return total + (weight * derivative ** 2) / (p * (1 - p));
  }, 0);
}
