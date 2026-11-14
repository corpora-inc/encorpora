import type { Estimate, Frontier } from "./frontier.js";

/**
 * Reported uncertainty for stored level days and the level a person is shown.
 *
 * Fit on the misspecified synthetic learner in
 * `scripts/frontier/production-calibration.ts` (seed 20261110, quick grid:
 * grades 1–10, ability offsets −2…+3, two replicates, 300 production
 * problems over 180 days), under grade-frontier-v5. The overall readout and
 * the area estimates have different posterior widths (the overall slope is
 * 1.15 a grade, an area's 1.7), so each has its own scale of the posterior
 * sd, chosen at every checkpoint to put 68% ± 4 within 1σ and 95% ± 3 within
 * 2σ. No additive floor is needed once the scales are separate. A factor
 * between checkpoints is log-interpolated in the answer count.
 *
 *   answered   overall   area
 *   20         1.22      1.09
 *   50         1.32      1.22
 *   100        1.24      1.27
 *   300        1.32      1.43
 *
 * sd-cal-v1 (one scale for both, 0.76–0.94, floor 0.2) was fit to
 * grade-frontier-v4 and under-covers v5 (overall 62% within 1σ at 20
 * answers; areas 55% at 300). Scheduling still reads the posterior sd. This
 * scale is not a norm, and the item difficulties underneath it are not
 * fitted to real students.
 */
export const REPORTED_SD_VERSION = "sd-cal-v2";
export const REPORTED_SD_FLOOR = 0;
export type ReportedScope = "overall" | "strand";
/** Checkpoints from the calibration harness, in answer order. */
export const REPORTED_SD_FACTORS: Record<
  ReportedScope,
  readonly (readonly [answered: number, factor: number])[]
> = {
  overall: [
    [20, 1.22],
    [50, 1.32],
    [100, 1.24],
    [300, 1.32],
  ],
  strand: [
    [20, 1.09],
    [50, 1.22],
    [100, 1.27],
    [300, 1.43],
  ],
};

/** The scale applied to a posterior sd after `answered` answers. */
export function reportedFactor(
  answered: number,
  scope: ReportedScope = "overall",
): number {
  const knots = REPORTED_SD_FACTORS[scope];
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

/** The uncertainty to store and show, for the overall readout or an area.
 * `posteriorSd` is what scheduling uses. */
export function reportedSd(
  posteriorSd: number,
  evidence: { answered: number; scope?: ReportedScope },
): number {
  const sd =
    REPORTED_SD_FLOOR +
    reportedFactor(evidence.answered, evidence.scope) * posteriorSd;
  return Math.round(sd * 100) / 100;
}

export function reportEstimate(
  estimate: Estimate,
  scope: ReportedScope = "overall",
): Estimate {
  return {
    ...estimate,
    sd: reportedSd(estimate.sd, { answered: estimate.answered, scope }),
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
        reportEstimate(estimate, "strand"),
      ]),
    ),
  };
}
