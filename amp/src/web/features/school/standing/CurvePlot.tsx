import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type {
  StandingCurve,
  StandingGrid,
} from "../../../../schools/standing-contracts";
import { usePopover } from "../../../ui/popover-owner";
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

/** Where to name a curve on itself: the point where it stands furthest
 * above the other curve, so the name sits on a stretch only its own line
 * occupies (and not on the faint tails). */
function apart(
  grid: StandingGrid,
  values: readonly number[],
  other: readonly number[],
  top: number,
) {
  const tallest = Math.max(...values);
  let at = -1;
  values.forEach((value, index) => {
    if (value < tallest * 0.25) return;
    // Clear of the grade band and its median, which carry their own labels.
    if (Math.abs(grid.from + index * grid.step) < 0.75) return;
    const gap = value - (other[index] ?? 0);
    if (at < 0 || gap > values[at]! - (other[at] ?? 0)) at = index;
  });
  if (at < 0) return null;
  const span = grid.to - grid.from;
  return {
    x: ((at * grid.step) / span) * 100,
    y: 100 - (Math.min(values[at]!, top) / top) * TOP,
    /** Outward from the grade band: left of it, the name goes left. */
    side:
      grid.from + at * grid.step > 0 ? ("end" as const) : ("start" as const),
  };
}

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
  name,
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
  /** The group's name, written on its own curve (a large plot). */
  name?: string;
  hover?: boolean;
}) {
  const id = useId();
  const [at, setAt] = useState<number | null>(null);
  const line = path(grid, curve.density, top);
  const area = `M0,100 L${line.join(" L")} L${WIDTH},100 Z`;
  const typical = path(grid, curve.typical, top);
  const middle = curve.middle;
  // Each curve is named where it is drawn, where it stands furthest from
  // the other curve: the group's and the national spread's never share a
  // stretch of line.
  const showTypical = curve.typical.some((value) => value > 0);
  const named = size === "large" && name;
  const own = named ? apart(grid, curve.density, curve.typical, top) : null;
  const national =
    named && showTypical
      ? apart(grid, curve.typical, curve.density, top)
      : null;
  // The readout is the app's one open popover (ui/popover-owner): a mouse
  // shows it while it hovers; a finger taps or drags it to a grade and it
  // stays until a tap elsewhere, a scroll, Escape or a second tap there.
  const plot = useRef<HTMLDivElement>(null);
  const pressedWith = useRef("mouse");
  usePopover(at !== null, {
    contains: (node) => !!plot.current?.contains(node),
    anchor: () => plot.current,
    close: () => setAt(null),
  });
  const gradeAt = (event: { clientX: number; currentTarget: Element }) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    const x = grid.from + share * (grid.to - grid.from);
    return Math.round(x / grid.step) * grid.step;
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    // A finger only scrubs once a tap has opened the readout.
    if (event.pointerType === "mouse" || at !== null) setAt(gradeAt(event));
  };
  const tap = (event: MouseEvent<HTMLDivElement>) => {
    if (pressedWith.current === "mouse" || event.detail === 0) return;
    const x = gradeAt(event);
    setAt(at === x ? null : x);
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
      ref={plot}
      onPointerDown={
        hover
          ? (event) => {
              pressedWith.current = event.pointerType;
            }
          : undefined
      }
      onPointerMove={hover ? move : undefined}
      onClick={hover ? tap : undefined}
      // A finger lifting also "leaves": only a mouse leaving puts it away.
      onPointerLeave={
        hover
          ? (event) => event.pointerType === "mouse" && setAt(null)
          : undefined
      }
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
        {showTypical && (
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
      {own && <CurveName at={own}>{name}</CurveName>}
      {national && (
        <CurveName at={national} curve="national">
          National spread
        </CurveName>
      )}
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
            data-tip-open=""
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
            <strong>{at === 0 ? "Their grade" : `${signed(at)} grades`}</strong>
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
            across(grid, x) < 3
              ? "start"
              : across(grid, x) > 97
                ? "end"
                : undefined
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

/** What the one unlabelled mark is, under the chart: each curve carries
 * its own name where it is drawn (CurvePlot), so only the median needs a key. */
export function CurveLegend(_props: { typical?: boolean } = {}) {
  return (
    <p className={styles.legend}>
      <span>
        <i data-key="median" aria-hidden="true" />
        Median, 95% range
      </span>
    </p>
  );
}

/** A curve's name beside the point where only its own line runs, outward
 * from the middle, and moved back inside the plot when a narrow one would
 * put it past an edge. */
function CurveName({
  at,
  curve,
  children,
}: {
  at: { x: number; y: number; side: "start" | "end" };
  curve?: "national";
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const label = ref.current;
    const plot = label?.offsetParent as HTMLElement | null;
    if (!label || !plot) return;
    const fit = () => {
      label.style.setProperty("--shift", "0px");
      const box = label.getBoundingClientRect();
      const frame = plot.getBoundingClientRect();
      const next =
        box.right > frame.right
          ? frame.right - box.right
          : box.left < frame.left
            ? frame.left - box.left
            : 0;
      label.style.setProperty("--shift", `${next}px`);
      setShift(next);
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(plot);
    return () => watch.disconnect();
  }, [at.x, at.side, children]);
  return (
    <span
      ref={ref}
      className={styles.curveName}
      data-curve={curve}
      data-side={at.side}
      style={
        {
          left: `${at.x}%`,
          "--y": at.y,
          "--shift": `${shift}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
