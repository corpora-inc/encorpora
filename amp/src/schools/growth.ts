import { levelSdSql } from "./student-sd.js";

/**
 * A stored level day has settled when its reported sd (sd-cal-v1) is at most
 * this. Chosen by the growth-recovery study, seed 20261110: see
 * `docs/engine/growth.md`.
 */
export const SETTLED_SD = 0.6;

export type GrowthDay = {
  /** Days since the window opened. Any one origin is fine. */
  day: number;
  level: number;
  /** Reported sd on that level day. */
  sd: number;
};

export type TermGrowth = { mu: number; sd: number };

/**
 * Growth across a window: the weighted least-squares pace of the level on
 * settled days (weights 1/sd²), times the window's elapsed days. The sd is
 * that pace's classical standard error, `elapsed / √Sxx`.
 *
 * Null when the estimate has not settled on two different days. That is no
 * figure, not a zero.
 */
export function termGrowth(
  days: readonly GrowthDay[],
  elapsed: number,
  settledSd = SETTLED_SD,
): TermGrowth | null {
  if (!(elapsed > 0)) return null;
  let n = 0;
  let sw = 0;
  let swx = 0;
  let swy = 0;
  let swxx = 0;
  let swxy = 0;
  for (const point of days) {
    if (!(point.sd > 0) || point.sd > settledSd) continue;
    const weight = 1 / (point.sd * point.sd);
    n += 1;
    sw += weight;
    swx += weight * point.day;
    swy += weight * point.level;
    swxx += weight * point.day * point.day;
    swxy += weight * point.day * point.level;
  }
  if (n < 2 || !(sw > 0)) return null;
  const sxx = swxx - (swx * swx) / sw;
  if (!(sxx > 0)) return null;
  const sxy = swxy - (swx * swy) / sw;
  return { mu: (sxy / sxx) * elapsed, sd: elapsed / Math.sqrt(sxx) };
}

/**
 * `ARRAY[mu, sd]` for one learner over a date window, or null. `learner`,
 * `from` and `to` are SQL expressions. `from` and `to` are dates; elapsed
 * days are `to - from`, and each day's x is days after `from`.
 */
export const growthArraySql = ({
  learner,
  from,
  to,
}: {
  learner: string;
  from: string;
  to: string;
}) =>
  `(SELECT CASE WHEN n < 2 OR sxx <= 0 OR elapsed <= 0 THEN NULL
       ELSE ARRAY[(sxy / sxx) * elapsed, elapsed / sqrt(sxx)] END
     FROM (
       SELECT n, elapsed,
              swxx - swx * swx / sw AS sxx,
              swxy - swx * swy / sw AS sxy
       FROM (
         SELECT count(*)::int AS n,
                (${to}::date - ${from}::date)::float8 AS elapsed,
                sum(w) AS sw, sum(w * x) AS swx, sum(w * y) AS swy,
                sum(w * x * x) AS swxx, sum(w * x * y) AS swxy
         FROM (
           SELECT (d.day - ${from}::date)::float8 AS x,
                  d.overall_level::float8 AS y,
                  1.0 / power(${levelSdSql("d")}, 2) AS w
           FROM amp_level_days d
           WHERE d.learner_id=${learner}
             AND d.day >= ${from}::date AND d.day <= ${to}::date
             AND ${levelSdSql("d")} > 0
             AND ${levelSdSql("d")} <= ${SETTLED_SD}
           -- Each day's x and w once: pulled up, each sum recomputed them,
           -- five powers and five window offsets a day. Same sums, same order.
           OFFSET 0
         ) points
       ) sums
       WHERE sw > 0
     ) fit)`;
