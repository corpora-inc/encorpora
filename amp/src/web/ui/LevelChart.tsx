import type { CSSProperties } from "react";
import { levelRange, type TrendPoint } from "../../learning/level-check";
import styles from "./LevelChart.module.css";

/** A grade estimate as the charts draw it: best guess and uncertainty. */
export type LevelEstimate = { level: number; sd: number };
/** Six grades centred on the grade typical for the learner's age. */
export type LevelScale = { lo: number; hi: number; center: number };
const COLLEGE = 13;

/** At least six grades around the age-typical grade, widened to take in
 * every estimate's likely range, so no band or dot sits off the scale. */
export function levelScale(
  expected: number,
  estimates: readonly LevelEstimate[] = [],
): LevelScale {
  const ranges = estimates.map((estimate) => levelRange(estimate));
  const low = Math.min(expected - 3, ...ranges.map(([from]) => from));
  const high = Math.max(expected + 3, ...ranges.map(([, to]) => to));
  const lo = Math.max(0, Math.min(Math.floor(low), COLLEGE - 6));
  const hi = Math.min(COLLEGE, Math.max(lo + 6, Math.ceil(high)));
  return { lo, hi, center: expected };
}
/** A level's position on the scale, as a fraction from 0 to 1. */
export function scaleAt(scale: LevelScale, level: number) {
  return (
    (Math.min(scale.hi, Math.max(scale.lo, level)) - scale.lo) /
    (scale.hi - scale.lo)
  );
}
const pct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

/** One estimate on the scale: the likely range as a band, the best guess as
 * a dot, the age-typical grade as a tick. `estimated` draws the band
 * dashed for an area without its own answers yet. */
export function LevelTrack({
  estimate,
  scale,
  estimated = false,
  size = "regular",
}: {
  estimate: LevelEstimate;
  scale: LevelScale;
  estimated?: boolean;
  size?: "regular" | "large";
}) {
  const [from, to] = levelRange(estimate);
  const left = scaleAt(scale, from),
    right = scaleAt(scale, to);
  return (
    <span
      className={`${styles.track} ${styles[size]} ${estimated ? styles.estimated : ""}`}
      aria-hidden="true"
    >
      <span
        className={styles.center}
        style={{ left: pct(scaleAt(scale, scale.center)) }}
      />
      <span
        className={styles.range}
        style={{ left: pct(left), width: pct(Math.max(0, right - left)) }}
      />
      <span
        className={styles.dot}
        style={{ left: pct(scaleAt(scale, estimate.level)) }}
      />
    </span>
  );
}

/** The scale's ends and centre, under a column of tracks. */
export function LevelAxis({
  scale,
  name,
}: {
  scale: LevelScale;
  name: (level: number) => string;
}) {
  // The centre label drops when it would crowd an end label.
  const center = scaleAt(scale, scale.center);
  return (
    <span className={styles.axis} aria-hidden="true">
      <span>{name(scale.lo)}</span>
      {center >= 0.25 && center <= 0.75 && (
        <span style={{ left: pct(center) }}>{name(scale.center)}</span>
      )}
      <span>
        {name(scale.hi)}
        {scale.hi < COLLEGE ? "+" : ""}
      </span>
    </span>
  );
}

/** How the overall estimate moved over the run: the best guess as a line
 * and its likely range as a band that narrows with each answer. */
export function LevelTrend({
  points,
  label,
}: {
  points: readonly TrendPoint[];
  /** The trend in words, for assistive technology. */
  label: string;
}) {
  const last = points.at(-1);
  if (!last) return null;
  const ranges = points.map((point) => levelRange(point));
  let low = Math.min(...ranges.map(([from]) => from)),
    high = Math.max(...ranges.map(([, to]) => to));
  if (high - low < 2) {
    const mid = (high + low) / 2;
    low = mid - 1;
    high = mid + 1;
  }
  const span = Math.max(1, last.answered);
  const x = (answered: number) => (answered / span) * 100;
  const y = (level: number) => 36 - ((level - low) / (high - low)) * 32;
  const upper = points.map((p, i) => `${x(p.answered)},${y(ranges[i]![1])}`);
  const lower = points
    .map((p, i) => `${x(p.answered)},${y(ranges[i]![0])}`)
    .reverse();
  const line = points.map((p) => `${x(p.answered)},${y(p.level)}`).join(" ");
  const end: CSSProperties = {
    left: pct(x(last.answered) / 100),
    top: pct(y(last.level) / 40),
  };
  return (
    <span className={styles.trend} role="img" aria-label={label}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <polygon
          className={styles.band}
          points={[...upper, ...lower].join(" ")}
        />
        <polyline className={styles.line} points={line} />
      </svg>
      <span className={styles.trendDot} style={end} aria-hidden="true" />
    </span>
  );
}
