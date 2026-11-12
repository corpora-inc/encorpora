import type { Estimate, Frontier } from "./frontier.js";

/**
 * Reported uncertainty for stored level days and the level a person is shown.
 *
 * Fit on the misspecified synthetic learner in
 * `scripts/frontier/production-calibration.ts` (seed 20261110, grades 1–10,
 * ability offsets −2…+3, two replicates, 300 production problems over 180
 * days). A single scale of the posterior sd cannot put both the overall
 * estimate and the strand estimates inside 68% ± 4 at 1σ and 95% ± 3 at 2σ
 * at every checkpoint: at 100 answers a strand's posterior sd is about twice
 * the overall sd, and the overall interval is the one that is too narrow.
 * An additive floor widens that narrower interval more. The factor then
 * depends on the answer count, log-interpolated between the checkpoints the
 * harness records.
 *
 *   answered   factor
 *   20         0.76
 *   50         0.83
 *   100        0.94
 *   300        0.90
 *   floor      0.20 grades
 *
 * Scheduling still reads the posterior sd. This scale is not a norm, and the
 * item difficulties underneath it are not fitted to real students.
 */
export const REPORTED_SD_VERSION = "sd-cal-v1";
export const REPORTED_SD_FLOOR = 0.2;
/** Checkpoints from the calibration harness, in answer order. */
export const REPORTED_SD_FACTORS: readonly [
  answered: number,
  factor: number,
][] = [
  [20, 0.76],
  [50, 0.83],
  [100, 0.94],
  [300, 0.9],
];

/** The scale applied to a posterior sd after `answered` answers. */
export function reportedFactor(answered: number): number {
  const knots = REPORTED_SD_FACTORS;
  const first = knots[0]!;
  if (answered <= first[0]) return first[1];
  const last = knots[knots.length - 1]!;
  if (answered >= last[0]) return last[1];
  for (let index = 1; index < knots.length; index++) {
    const [leftN, leftK] = knots[index - 1]!;
    const [rightN, rightK] = knots[index]!;
    if (answered <= rightN) {
      const t = Math.log(answered / leftN) / Math.log(rightN / leftN);
      return leftK + (rightK - leftK) * t;
    }
  }
  return last[1];
}

/** The uncertainty to store and show. `posteriorSd` is what scheduling uses. */
export function reportedSd(
  posteriorSd: number,
  evidence: { answered: number },
): number {
  const sd =
    REPORTED_SD_FLOOR + reportedFactor(evidence.answered) * posteriorSd;
  return Math.round(sd * 100) / 100;
}

export function reportEstimate(estimate: Estimate): Estimate {
  return {
    ...estimate,
    sd: reportedSd(estimate.sd, { answered: estimate.answered }),
  };
}

/** A copy whose overall and strand widths are the reported ones. `adaptive`
 * stays the posterior: selection reads it, and this copy is for display. */
export function reportFrontier(frontier: Frontier): Frontier {
  return {
    ...frontier,
    overall: reportEstimate(frontier.overall),
    strands: Object.fromEntries(
      Object.entries(frontier.strands).map(([id, estimate]) => [
        id,
        reportEstimate(estimate),
      ]),
    ),
  };
}
