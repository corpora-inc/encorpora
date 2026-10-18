import type { TemplateMetadata } from "../../src/math/contracts";
import {
  itemSuccess,
  type ItemCalibration,
} from "../../src/learning/item-calibration";
import {
  randomSource,
  syntheticProbability,
  type Population,
} from "./synthetic-learner";
type Trial = { ability: number; correct: boolean; probability: number };
function loss(item: ItemCalibration, trials: readonly Trial[]) {
  return (
    -trials.reduce((sum, trial) => {
      const p = itemSuccess(trial.ability, item);
      return sum + Math.log(trial.correct ? p : 1 - p);
    }, 0) / trials.length
  );
}
/** Offline diagnostic only. Synthetic fits are never loaded by the API.
 * Fixed known abilities identify the scale; real-data fitting requires an
 * independently anchored ability scale and a held-out learner split. */
export function fitSyntheticItem(
  template: TemplateMetadata,
  grade: number,
  initial: ItemCalibration,
  population: Population,
  seed: number,
) {
  const random = randomSource(seed);
  const sample = (heldOut: boolean): Trial[] =>
    Array.from({ length: 400 }, () => {
      const ability =
        grade + (heldOut ? random() + random() - 1 : random() * 2 - 1) * 3;
      const probability = syntheticProbability(
        template,
        grade,
        ability,
        population,
      );
      return { ability, probability, correct: random() < probability };
    });
  const training = sample(false);
  const validation = sample(true);
  let fitted = initial,
    bestLoss = loss(initial, training);
  for (let offset = -8; offset <= 8; offset++) {
    for (const discrimination of [0.8, 1.2, 1.6, 2, 2.4, 2.8]) {
      const candidate = {
        ...initial,
        difficulty: initial.difficulty + offset / 10,
        discrimination,
      };
      const candidateLoss = loss(candidate, training);
      if (candidateLoss < bestLoss) {
        fitted = candidate;
        bestLoss = candidateLoss;
      }
    }
  }
  return {
    id: template.id,
    version: template.version,
    fitted,
    trainingCount: training.length,
    validationCount: validation.length,
    trainingLoss: bestLoss,
    initialValidationLoss: loss(initial, validation),
    initialProbabilityError:
      validation.reduce(
        (sum, t) =>
          sum + Math.abs(itemSuccess(t.ability, initial) - t.probability),
        0,
      ) / validation.length,
    fittedProbabilityError:
      validation.reduce(
        (sum, t) =>
          sum + Math.abs(itemSuccess(t.ability, fitted) - t.probability),
        0,
      ) / validation.length,
    fittedValidationLoss: loss(fitted, validation),
  };
}
