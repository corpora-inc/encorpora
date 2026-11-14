import type { AgeAnchor, Estimate, Frontier } from "./frontier.js";

/**
 * Reported uncertainty for stored level days and the level a person is shown:
 * 0.20 grades plus a factor of the posterior sd, the factor by the
 * estimate's own answer count (an area's own answers, not the learner's
 * total), log-interpolated between the knots and held flat outside them. For
 * an age-anchored learner the shown overall level can sit off the estimate
 * (`reportFrontier`), and its shown width adds that distance / 1.64, so the
 * shown range always holds the estimate's own; an area shows a blend of the
 * overall and its own estimate, and the same blend of their widths.
 *
 *   own answers   overall   area
 *   10 or fewer   1.01      0.85
 *   20 or more    0.80      0.95
 *
 * sd-cal-v2, fit so the estimate ± 1.64 × this width covers the truth 90% of
 * the time, by each estimate's own answers, on synthetic learners: children
 * drawn from national norms and adults (`scripts/frontier/
 * early-anchor-simulation.ts`, seed 1) and the misspecified grid
 * (`production-calibration.ts`, seed 20261110). Validated on seed 2 and seed
 * 20261115 (docs/adaptive-evidence.md).
 * sd-cal-v1 (0.76–0.94 by the learner's total answers) under-covered areas,
 * which production reads by their own count. Scheduling still reads the
 * posterior sd. This scale is not a norm, and the item difficulties
 * underneath it are not fitted to real students.
 */
export const REPORTED_SD_VERSION = "sd-cal-v2";
export const REPORTED_SD_FLOOR = 0.2;
export type ReportedScope = "overall" | "area";
/** Knots in own answers. */
export const REPORTED_SD_FACTORS: Record<
  ReportedScope,
  readonly (readonly [answered: number, factor: number])[]
> = {
  overall: [
    [10, 1.01],
    [20, 0.8],
  ],
  area: [
    [10, 0.85],
    [20, 0.95],
  ],
};

/** The scale applied to a posterior sd after `answered` own answers. */
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

/** The uncertainty to store and show for the overall readout or an area.
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

/** The shown width when the shown level sits `shift` off the estimate. */
export function shownWidth(reported: number, shift: number): number {
  return Math.round((reported + Math.abs(shift) / 1.64) * 100) / 100;
}

/** How far the shown overall level of an age-anchored learner may be from
 * their age band, from 0 to 1 (shown as estimated): a share that grows with
 * every answer and is whole after `startingAnswers`. */
export function startingWeight(answered: number, anchor: AgeAnchor): number {
  return Math.min(1, Math.max(0, answered / anchor.startingAnswers));
}

const hundredths = (value: number) => Math.round(value * 100) / 100;

/** The shown overall level: inside the age band it is the estimate; outside
 * it, the band's edge plus `weight` of the way on to the estimate. */
export function shownLevel(
  level: number,
  weight: number,
  anchor: AgeAnchor,
): number {
  const inside = Math.min(
    anchor.level + anchor.band,
    Math.max(anchor.level - anchor.band, level),
  );
  return hundredths(inside + weight * (level - inside));
}

/** An area's shown level: the overall shown level, plus the share of the
 * area's difference from the overall estimate that its own answers carry. An
 * area with few answers of its own sits near the learner's overall level,
 * and its width is the same blend of the overall shown width and its own. */
export function shownAreaLevel(
  area: Estimate,
  overall: { estimate: number; shown: number },
  anchor: AgeAnchor,
): number {
  const share = Math.min(1, area.answered / anchor.areaAnswers);
  return hundredths(overall.shown + share * (area.level - overall.estimate));
}

/** A copy for display: overall and area levels as shown (`shownLevel`,
 * `shownAreaLevel`, for an age-anchored learner) and widths as reported.
 * `adaptive` stays the posterior: selection reads it, and this copy is for
 * display. */
export function reportFrontier(frontier: Frontier): Frontier {
  const reported = {
    ...frontier,
    overall: reportEstimate(frontier.overall),
    strands: Object.fromEntries(
      Object.entries(frontier.strands).map(([id, estimate]) => [
        id,
        reportEstimate(estimate, "area"),
      ]),
    ),
  };
  const anchor = frontier.anchor;
  if (!anchor) return reported;
  const level = shownLevel(
    frontier.overall.level,
    startingWeight(frontier.overall.answered, anchor),
    anchor,
  );
  const overall = {
    ...reported.overall,
    level,
    sd: shownWidth(reported.overall.sd, level - frontier.overall.level),
  };
  return {
    ...reported,
    overall,
    strands: Object.fromEntries(
      Object.entries(frontier.strands).map(([id, estimate]) => {
        // A blend of the overall shown estimate and the area's own, so its
        // width blends the same way.
        const share = Math.min(1, estimate.answered / anchor.areaAnswers);
        return [
          id,
          {
            ...reported.strands[id]!,
            level: shownAreaLevel(
              estimate,
              { estimate: frontier.overall.level, shown: level },
              anchor,
            ),
            sd: hundredths(
              (1 - share) * overall.sd + share * reported.strands[id]!.sd,
            ),
          },
        ];
      }),
    ),
  };
}
