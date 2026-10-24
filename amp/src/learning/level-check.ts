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

/** Display envelope around a provisional estimate, not a norm-referenced
 * confidence interval. Surprise reserves can widen the overall uncertainty. */
export const RANGE_SD_MULTIPLIER = 1.64;
export function levelRange(estimate: Pick<Estimate, "level" | "sd">) {
  const clamp = (value: number) => Math.min(13, Math.max(0, value));
  return [
    clamp(estimate.level - RANGE_SD_MULTIPLIER * estimate.sd),
    clamp(estimate.level + RANGE_SD_MULTIPLIER * estimate.sd),
  ] as const;
}

/** One point of the overall estimate over the session: after `answered`
 * answers (0 is the starting estimate from age alone). */
export type TrendPoint = { answered: number; level: number; sd: number };

/** The answer counts at which the trend is sampled: 0, every step, and the
 * latest count. */
export function trendCounts(answers: number, step = LEVEL_CHECK_EVERY) {
  const counts: number[] = [];
  for (let n = 0; n <= answers; n += step) counts.push(n);
  if (counts.at(-1) !== answers) counts.push(answers);
  return counts;
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
export function levelDetails(estimate: Pick<Estimate, "level" | "sd">) {
  const from = Math.max(-1, estimate.level - RANGE_SD_MULTIPLIER * estimate.sd);
  const to = Math.min(13, estimate.level + RANGE_SD_MULTIPLIER * estimate.sd);
  return {
    point: estimate.level.toFixed(2),
    from: from.toFixed(2),
    to: to.toFixed(2),
  };
}
