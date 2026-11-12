import { DEFAULT_FRONTIER_POLICY } from "./frontier-policy.js";

/** The misspecified learner the production-calibration harness and the demo
 * school both draw answers from. It is not the estimator's likelihood.
 *
 * - Each catalog item's true difficulty is its catalog grade plus N(0, 0.5²).
 * - Each learner has their own slip in [0.03, 0.15] and guess in [0, 0.25].
 * - True working grade rises by Uniform(0, 1.5) grades across a 180-day term.
 * Guess spans a typed answer (0) through a four-choice item (0.25). The slope
 * stays the production discrimination, so the misspecification is the
 * difficulty, the slip, the guess, and the drift. */
export const MISSPECIFIED_RESPONSE = {
  itemSd: 0.5,
  slipMin: 0.03,
  slipMax: 0.15,
  guessMin: 0,
  guessMax: 0.25,
  growthMin: 0,
  growthMax: 1.5,
  termDays: 180,
  discrimination: DEFAULT_FRONTIER_POLICY.response.discrimination,
} as const;

/** P(correct) for the misspecified learner at one item. */
export function misspecifiedSuccessProbability(input: {
  theta: number;
  catalogGrade: number;
  itemOffset: number;
  slip: number;
  guess: number;
}): number {
  const difficulty = input.catalogGrade + input.itemOffset;
  const latent =
    1 /
    (1 +
      Math.exp(
        -MISSPECIFIED_RESPONSE.discrimination * (input.theta - difficulty),
      ));
  const { guess, slip } = input;
  return guess + (1 - guess) * (1 - slip) * latent;
}
