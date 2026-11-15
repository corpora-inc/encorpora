import type { Estimate } from "./frontier";

/**
 * The free assessment's level check: after every `LEVEL_CHECK_EVERY`
 * problems used, practice pauses between problems to show the current
 * estimate. The same step spaces the points of the level trend.
 */
export const LEVEL_CHECK_EVERY = 5;

/** Whether the problem just used (answered, or skipped while skips count)
 * brings a level check before the next one. Not at the end of placement or
 * at the limit: the map and the paywall show the level there. */
export function levelCheckDue(
  used: number,
  limits: { free: number; placement: number },
): boolean {
  return (
    used > 0 &&
    used % LEVEL_CHECK_EVERY === 0 &&
    used !== limits.placement &&
    used < limits.free
  );
}

/** Whether a level is measured: at least one answer behind it. Before the
 * first answer every reader draws it as not measured yet (the whole scale,
 * a "?"), whatever estimate a served batch has already stored. The one
 * predicate for every reader (Q-201): a level from a server that predates
 * `answered` counts as measured, since it stored none without answers. */
export function measured(
  estimate: { answered?: number } | null | undefined,
): boolean {
  return (
    !!estimate && (estimate.answered === undefined || estimate.answered > 0)
  );
}

/** Whether a learner has progress to report (a printed progress report is
 * offered): a stored level with at least one answer behind it. Before that
 * there is nothing to report, and no report is offered. */
export function reportable(
  level:
    { overall: { answered?: number } | null | undefined } | null | undefined,
): boolean {
  return !!level && measured(level.overall);
}

/** z for the likely range of an estimate that carries no range of its own
 * (stored before ranges were kept): the same 80% as `LIKELY_MASS`, from its
 * sd as if it were normal. */
export const RANGE_SD_MULTIPLIER = 1.28;
/** The likely range, on the grade axis: the estimate's own (`Estimate.low`,
 * `high`: the posterior's quantiles), else level ± z·sd. */
export function levelRange(
  estimate: Pick<Estimate, "level" | "sd" | "low" | "high">,
) {
  return unclamped(estimate, 0);
}
/** The range's own numbers, kept within `floor`…13. */
function unclamped(
  estimate: Pick<Estimate, "level" | "sd" | "low" | "high">,
  floor: number,
) {
  const clamp = (value: number) => Math.min(13, Math.max(floor, value));
  if (estimate.low != null && estimate.high != null)
    return [clamp(estimate.low), clamp(estimate.high)] as const;
  return [
    clamp(estimate.level - RANGE_SD_MULTIPLIER * estimate.sd),
    clamp(estimate.level + RANGE_SD_MULTIPLIER * estimate.sd),
  ] as const;
}

/** An estimate's level, width and likely range, as a payload carries it: the
 * range only where the estimate has one. */
export function levelAndRange({
  level,
  sd,
  low,
  high,
}: Pick<Estimate, "level" | "sd" | "low" | "high">) {
  return low != null && high != null ? { level, sd, low, high } : { level, sd };
}

/** The top of the curriculum (Precalculus): no answer can bound a level
 * above it, so a range that reaches it is open. */
const TOP_GRADE = 12;
/** The likely range as a person reads it, the one source for both the words
 * and the bar: whole grades, each the half grade either side of its tick
 * (`gradeName` rounds the same way). A range that reaches Precalculus is open
 * above ("Grade 6 and above", drawn to the scale's end); one that reaches
 * kindergarten starts at the scale's start. */
export type ShownRange = {
  from: number;
  to: number;
  openLow: boolean;
  openHigh: boolean;
};
export function shownRange(
  estimate: Pick<Estimate, "level" | "sd" | "low" | "high">,
): ShownRange {
  return shownGrades(levelRange(estimate));
}
/** `shownRange` from a range's numbers. */
export function shownGrades([low, high]: readonly [
  number,
  number,
]): ShownRange {
  const from = Math.min(TOP_GRADE, Math.max(0, Math.round(low)));
  const to = Math.min(TOP_GRADE, Math.max(from, Math.round(high)));
  return { from, to, openLow: from <= 0, openHigh: to >= TOP_GRADE };
}
/** Where a shown range's bar runs on the grade axis: from its first grade's
 * lower half to its last grade's upper half, past the scale's ends where it is
 * open (a chart clamps it to its own ends). */
export function shownSpan(range: ShownRange): readonly [number, number] {
  return [
    range.openLow ? -1 : range.from - 0.5,
    range.openHigh ? 13 : range.to + 0.5,
  ];
}

/** One point of the overall estimate over the session: after `answered`
 * answers (0 is the starting estimate from age alone). */
export type TrendPoint = {
  answered: number;
  level: number;
  sd: number;
  low?: number;
  high?: number;
};

/** The answer counts at which the trend is sampled: 0, every step, and the
 * latest count. */
export function trendCounts(answers: number, step = LEVEL_CHECK_EVERY) {
  const counts: number[] = [];
  for (let n = 0; n <= answers; n += step) counts.push(n);
  if (counts.at(-1) !== answers) counts.push(answers);
  return counts;
}

/** The step for a trend of at most about `points` points: the level-check
 * step, widened in whole steps for a long record. */
export function trendStep(answers: number, points?: number) {
  if (!points || points < 2) return LEVEL_CHECK_EVERY;
  const step = Math.ceil(answers / (points - 1) / LEVEL_CHECK_EVERY);
  return Math.max(1, step) * LEVEL_CHECK_EVERY;
}

/** Rounded curriculum labels for chart ticks and compact navigation. */
export function gradeName(level: number) {
  const g = Math.round(level);
  if (g <= 0) return "K";
  if (g <= 8) return `Grade ${g}`;
  return (
    ["Algebra 1", "Geometry", "Algebra 2", "Precalculus"][g - 9] ?? "College"
  );
}

/** Preserve hundredths in the readout. The estimator grid extends to -1;
 * numeric bounds must include that region rather than exclude its point. */
export function levelDetails(
  estimate: Pick<Estimate, "level" | "sd" | "low" | "high">,
) {
  const [from, to] = unclamped(estimate, -1);
  return {
    point: estimate.level.toFixed(2),
    from: from.toFixed(2),
    to: to.toFixed(2),
  };
}
