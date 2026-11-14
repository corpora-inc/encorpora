import { useLayoutEffect, useRef, type CSSProperties } from "react";
import {
  likelyRange,
  percent,
  scaleAt,
  scaleGrades,
  shortGrade,
  type Estimate,
  type RangeScale,
} from "./scale";
import styles from "./LevelRange.module.css";

/**
 * One estimate as an error bar on a shared scale: the likely range as a
 * band, the best guess as a dot. `band` paints the learner's own grade (or a
 * class's course) behind it; `estimated` draws a range with too little work
 * behind it dashed and hollow. Gridlines at each whole grade line up with
 * the bars above and below and with the `LevelAxis` under them. The hue is
 * the nearest `[data-strand]`'s, or the primary colour.
 *
 * With no estimate (`null`: nothing answered yet) the bar is not yet
 * measured: the range spans the whole scale and the dot carries a "?".
 * `moving` lets that dot drift along the scale while the range breathes
 * (never under reduced motion). The same element takes the first estimate,
 * so the range and dot glide from the whole scale to it, at the same size.
 */
export function LevelBar({
  estimate,
  scale,
  band,
  estimated = false,
  size = "regular",
  gridlines = true,
  moving = false,
}: {
  /** Null before the first answer: not yet measured. */
  estimate: Estimate | null;
  scale: RangeScale;
  band?: readonly [from: number, to: number] | null;
  estimated?: boolean;
  size?: "regular" | "large";
  gridlines?: boolean;
  /** Not yet measured: the dot drifts and the range breathes. */
  moving?: boolean;
}) {
  const unmeasured = !estimate;
  const [from, to] = estimate ? likelyRange(estimate) : [scale.lo, scale.hi];
  const left = scaleAt(scale, from),
    right = scaleAt(scale, to);
  const at = estimate ? scaleAt(scale, estimate.level) : 0.5;
  return (
    <span
      className={[
        styles.bar,
        styles[size],
        estimated && !unmeasured ? styles.estimated : "",
        unmeasured ? styles.unmeasured : "",
        unmeasured && moving ? styles.moving : "",
      ].join(" ")}
      aria-hidden="true"
      // Stable hooks for the browser checks (module class names are hashed).
      data-level-bar=""
      data-estimated={(estimated && !unmeasured) || undefined}
      data-unmeasured={unmeasured || undefined}
    >
      {gridlines &&
        scaleGrades(scale).map((g) => (
          <span
            key={g}
            className={styles.gridline}
            style={{ left: percent(scaleAt(scale, g)) }}
          />
        ))}
      {band && !unmeasured && (
        <span
          className={styles.ownBand}
          style={{
            left: percent(scaleAt(scale, band[0])),
            width: percent(scaleAt(scale, band[1]) - scaleAt(scale, band[0])),
          }}
        />
      )}
      <span className={styles.rail} />
      <span
        className={styles.range}
        style={
          {
            left: percent(left),
            width: percent(Math.max(0, right - left)),
            // Densest at the best guess, fading toward the range's ends.
            "--peak": percent(
              right > left ? (at - left) / (right - left) : 0.5,
            ),
          } as CSSProperties
        }
      />
      {/* The dot rides in a full-width track, so a drift is one transform
          of the track and the dot's own position still glides. */}
      <span className={styles.track}>
        <span
          className={styles.dot}
          data-level-dot=""
          style={{ left: percent(at) }}
        >
          {unmeasured && (
            <span className={styles.mark} data-level-mark="">
              ?
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

/**
 * In a column of learners where others are measured, one with no answers
 * yet: no bar (a range would claim a place on a scale fitted to the others),
 * only a calm "?" pill where the bar would be, at the bar's own height.
 */
export function LevelNotStarted({
  label,
  size = "regular",
}: {
  /** What it says, in the space's words: "Not started". */
  label: string;
  size?: "regular" | "large";
}) {
  return (
    <span
      className={`${styles.bar} ${styles[size]} ${styles.notStarted}`}
      data-level-not-started=""
    >
      <span className={styles.pill}>
        <span className={styles.pillMark} aria-hidden="true">
          ?
        </span>
        {label}
      </span>
    </span>
  );
}

/** The order labels claim their place: both ends, then every other grade
 * back from the end, then the rest. */
function labelPriority(count: number) {
  const last = count - 1;
  const order = [0, last];
  for (let i = last - 2; i > 0; i -= 2) order.push(i);
  for (let i = last - 1; i > 0; i -= 2) order.push(i);
  return [...new Set(order)].filter((i) => i >= 0);
}

/** Whole grades under a column of bars. Every label sits under its grade;
 * where two would touch, the one with the lower claim gives way, so the ends
 * always show and the rest thin out evenly as the column narrows. */
export function LevelAxis({ scale }: { scale: RangeScale }) {
  const grades = scaleGrades(scale);
  const last = grades.length - 1;
  const axis = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = axis.current;
    if (!element) return;
    const fit = () => {
      const labels = [...element.children] as HTMLElement[];
      for (const label of labels) label.style.visibility = "";
      const kept: DOMRect[] = [];
      for (const index of labelPriority(labels.length)) {
        const label = labels[index]!;
        const box = label.getBoundingClientRect();
        if (kept.some((b) => box.left < b.right + 8 && box.right + 8 > b.left))
          label.style.visibility = "hidden";
        else kept.push(box);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scale.lo, scale.hi]);
  return (
    <span className={styles.axisFrame} aria-hidden="true">
      <span className={styles.axis} ref={axis}>
        {grades.map((g, index) => (
          <span
            key={g}
            className={styles.axisLabel}
            data-level-axis-label=""
            data-end={
              index === 0 ? "start" : index === last ? "end" : undefined
            }
            style={{ left: percent(scaleAt(scale, g)) }}
          >
            {shortGrade(g)}
          </span>
        ))}
      </span>
    </span>
  );
}
