import { useId, useState, type PointerEvent } from "react";
import type {
  StandingCurve,
  StandingGrid,
} from "../../../../schools/standing-contracts";
import { gradeName, signed } from "./format";
import styles from "./Standing.module.css";

const WIDTH = 1000;
/** Headroom above the tallest curve, in the plot's own 0–100 units. */
const TOP = 90;

/** Where a grade from their own sits across the plot, 0–100%. */
export const across = (grid: StandingGrid, x: number) =>
  ((Math.min(grid.to, Math.max(grid.from, x)) - grid.from) /
    (grid.to - grid.from)) *
  100;

/** The tallest point of any curve that shares a scale. */
export const peakOf = (curves: readonly StandingCurve[]) =>
  Math.max(
    1e-6,
    ...curves.flatMap((curve) => [
      Math.max(...curve.density),
      Math.max(...curve.typical),
    ]),
  );

function path(grid: StandingGrid, values: readonly number[], top: number) {
  const span = grid.to - grid.from;
  const points = values.map((value, index) => {
    const x = ((index * grid.step) / span) * WIDTH;
    const y = 100 - (Math.min(value, top) / top) * TOP;
    return `${x.toFixed(1)},${y.toFixed(2)}`;
  });
  return points;
}

/**
 * One group's curve: the mixture of its students' curves on "grades from their
 * own", filled, with the student's own grade as a pale band, the national
 * typical spread as a dashed reference, and where the median sits (95%) as a
 * shaded column. Every size is fixed by its frame, so nothing moves when the
 * data arrives or a pointer passes over it.
 */
export function CurvePlot({
  grid,
  curve,
  top,
  size = "large",
  bandLabel,
  label,
  hover = false,
}: {
  grid: StandingGrid;
  curve: StandingCurve;
  /** The density at the plot's top, shared by curves drawn together. */
  top: number;
  size?: "large" | "compact";
  /** Over the grade band; none on a compact row. */
  bandLabel?: string;
  label: string;
  hover?: boolean;
}) {
  const id = useId();
  const [at, setAt] = useState<number | null>(null);
  const line = path(grid, curve.density, top);
  const area = `M0,100 L${line.join(" L")} L${WIDTH},100 Z`;
  const typical = path(grid, curve.typical, top);
  const middle = curve.middle;
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    const x = grid.from + share * (grid.to - grid.from);
    setAt(Math.round(x / grid.step) * grid.step);
  };
  // Of these students, the expected share within half a grade of the pointer.
  const near =
    at === null
      ? 0
      : curve.density.reduce((sum, value, index) => {
          const x = grid.from + index * grid.step;
          return Math.abs(x - at) <= 0.5 + 1e-9 ? sum + value : sum;
        }, 0) * grid.step;
  return (
    <div
      className={styles.plot}
      data-size={size}
      role="img"
      aria-label={label}
      onPointerMove={hover ? move : undefined}
      onPointerLeave={hover ? () => setAt(null) : undefined}
    >
      <span
        className={styles.gradeBand}
        style={{
          left: `${across(grid, -0.5)}%`,
          width: `${across(grid, 0.5) - across(grid, -0.5)}%`,
        }}
        aria-hidden="true"
      >
        {bandLabel && <span>{bandLabel}</span>}
      </span>
      {middle && (
        <span
          className={styles.middleBand}
          style={{
            left: `${across(grid, middle.low)}%`,
            width: `max(2px, ${across(grid, middle.high) - across(grid, middle.low)}%)`,
          }}
          aria-hidden="true"
        />
      )}
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} 100`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className={styles.fillTop} />
            <stop offset="1" className={styles.fillBottom} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id}-fill)`} />
        {curve.typical.some((value) => value > 0) && (
          <polyline
            className={styles.typical}
            points={typical.join(" ")}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          className={styles.line}
          points={line.join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {middle && (
        <span
          className={styles.medianLine}
          style={{ left: `${across(grid, middle.median)}%` }}
          aria-hidden="true"
        />
      )}
      {at !== null && (
        <>
          <span
            className={styles.crosshair}
            style={{ left: `${across(grid, at)}%` }}
            aria-hidden="true"
          />
          <span
            className={styles.readout}
            data-edge={
              across(grid, at) < 20
                ? "start"
                : across(grid, at) > 80
                  ? "end"
                  : undefined
            }
            style={{ left: `${across(grid, at)}%` }}
            aria-hidden="true"
          >
            <strong>
              {at === 0 ? "Their grade" : `${signed(at)} grades`}
            </strong>
            {Math.round(near * 100)}% of students within half a grade
          </span>
        </>
      )}
    </div>
  );
}

/** Whole-grade ticks under a plot: every grade on a narrow axis, every other
 * on a wide one. One rostered grade adds the grade itself underneath. */
export function GradeAxis({
  grid,
  grade,
}: {
  grid: StandingGrid;
  /** The one rostered grade, when there is one. */
  grade?: number | null;
}) {
  const span = grid.to - grid.from;
  const every = span > 16 ? 4 : span > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let x = Math.ceil(grid.from); x <= grid.to; x++)
    if (x % every === 0) ticks.push(x);
  // On a narrow axis every other tick steps aside (Standing.module.css).
  const minor = (x: number) => (x / every) % 2 !== 0;
  return (
    <div className={styles.axis} aria-hidden="true">
      {ticks.map((x) => (
        <span
          key={x}
          data-minor={minor(x) ? "" : undefined}
          style={{ left: `${across(grid, x)}%` }}
          data-edge={
            across(grid, x) < 3 ? "start" : across(grid, x) > 97 ? "end" : undefined
          }
        >
          <b>{x === 0 ? "0" : signed(x, 0)}</b>
          {grade !== null && grade !== undefined && (
            <i>
              {x + grade > 13 ? (
                ""
              ) : (
                <>
                  <small>Gr </small>
                  {gradeName(x + grade)}
                </>
              )}
            </i>
          )}
        </span>
      ))}
    </div>
  );
}

/** What each mark is, under the chart. */
export function CurveLegend({ typical = true }: { typical?: boolean }) {
  return (
    <p className={styles.legend}>
      <span>
        <i data-key="curve" aria-hidden="true" />
        Students, with their uncertainty
      </span>
      <span>
        <i data-key="median" aria-hidden="true" />
        Median, 95% range
      </span>
      {typical && (
        <span>
          <i data-key="typical" aria-hidden="true" />
          Typical national spread
        </span>
      )}
    </p>
  );
}
