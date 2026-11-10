import type { CSSProperties } from "react";
import { gradeName } from "../../../learning/level-check";
import { likelyRange, percent, shortGrade } from "./scale";
import styles from "./LevelRange.module.css";

/** One point of the estimate's path: after `answered` answers (0 is the
 * starting estimate). */
export type PathPoint = { answered: number; level: number; sd: number };

/**
 * How the overall estimate moved as the answers came in: the best guess as a
 * line, its likely range as a band that narrows with evidence (and can widen
 * again after a surprise). The vertical axis fits the band; whole grades are
 * gridlines.
 */
export function LevelPath({
  points,
  state = "ready",
}: {
  points: readonly PathPoint[] | null;
  /** While the path loads its space shows a wait; a failure says so there. */
  state?: "ready" | "loading" | "failed";
}) {
  if (!points || points.length < 2 || state !== "ready")
    return (
      <div
        className={`${styles.path} ${state === "failed" ? "" : "amp-skeleton"}`}
        aria-busy={state !== "failed"}
      >
        {state === "failed" && (
          <p className={styles.pathFailed}>
            Your level’s history didn’t load. Refresh to try again.
          </p>
        )}
      </div>
    );
  const first = points[0]!;
  const last = points.at(-1)!;
  const ranges = points.map((point) => likelyRange(point));
  let lo = Math.floor(Math.min(...ranges.map(([from]) => from)));
  let hi = Math.ceil(Math.max(...ranges.map(([, to]) => to)));
  while (hi - lo < 3) {
    if (lo > 0) lo -= 1;
    if (hi - lo < 3 && hi < 13) hi += 1;
    if (lo === 0 && hi === 13) break;
  }
  const span = Math.max(1, last.answered);
  const x = (answered: number) => (answered / span) * 100;
  const y = (level: number) =>
    ((hi - Math.min(hi, Math.max(lo, level))) / (hi - lo)) * 100;
  const upper = points.map((p, i) => `${x(p.answered)},${y(ranges[i]![1])}`);
  const lower = points
    .map((p, i) => `${x(p.answered)},${y(ranges[i]![0])}`)
    .reverse();
  const line = points.map((p) => `${x(p.answered)},${y(p.level)}`).join(" ");
  const every = hi - lo > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let g = hi; g >= lo; g -= every) ticks.push(g);
  const end: CSSProperties = {
    left: percent(x(last.answered) / 100),
    top: percent(y(last.level) / 100),
  };
  const [startFrom, startTo] = ranges[0]!;
  const [nowFrom, nowTo] = ranges.at(-1)!;
  return (
    <div
      className={styles.path}
      role="img"
      aria-label={`Best guess over ${last.answered} problems, from ${gradeName(first.level)} to ${gradeName(last.level)}. The likely range went from ${gradeName(startFrom)}–${gradeName(startTo)} to ${gradeName(nowFrom)}–${gradeName(nowTo)}.`}
    >
      <div className={styles.pathPlot}>
        {ticks.map((g) => (
          <span
            key={g}
            className={styles.pathLine}
            style={{ top: percent(y(g) / 100) }}
            aria-hidden="true"
          >
            <span className={styles.pathLabel}>{shortGrade(g)}</span>
          </span>
        ))}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            className={styles.pathBand}
            points={[...upper, ...lower].join(" ")}
          />
          <polyline className={styles.pathGuess} points={line} />
        </svg>
        <span className={styles.pathDot} style={end} aria-hidden="true" />
      </div>
      <div className={styles.pathAxis} aria-hidden="true">
        <span>Start</span>
        <span>
          {last.answered} {last.answered === 1 ? "problem" : "problems"}
        </span>
      </div>
    </div>
  );
}
