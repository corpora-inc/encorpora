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
 */
export function LevelBar({
  estimate,
  scale,
  band,
  estimated = false,
  size = "regular",
  gridlines = true,
}: {
  estimate: Estimate;
  scale: RangeScale;
  band?: readonly [from: number, to: number] | null;
  estimated?: boolean;
  size?: "regular" | "large";
  gridlines?: boolean;
}) {
  const [from, to] = likelyRange(estimate);
  const left = scaleAt(scale, from),
    right = scaleAt(scale, to);
  return (
    <span
      className={`${styles.bar} ${styles[size]} ${estimated ? styles.estimated : ""}`}
      aria-hidden="true"
    >
      {gridlines &&
        scaleGrades(scale).map((g) => (
          <span
            key={g}
            className={styles.gridline}
            style={{ left: percent(scaleAt(scale, g)) }}
          />
        ))}
      {band && (
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
              right > left
                ? (scaleAt(scale, estimate.level) - left) / (right - left)
                : 0.5,
            ),
          } as CSSProperties
        }
      />
      <span
        className={styles.dot}
        style={{ left: percent(scaleAt(scale, estimate.level)) }}
      />
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
