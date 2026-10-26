import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { describeScene, layoutScene, type Layout } from "../math/scene";
import {
  clipLineToGrid,
  draftSlots,
  moveDraftPoint,
  nextSlotLabel,
  onGrid,
  placedCount,
  plotPoints,
  pointLabelText,
  pointPlotScene,
  samePoint,
  toggleDraftPoint,
  type LatticePoint,
  type PointPlotResponse,
} from "../math/point-plot";
import { spokenMath } from "./MathText";
import { SceneSvg } from "./scene/SceneSvg";

/** The math-to-figure-pixel map of the laid-out grid, read from its own
 * gridlines so the overlay always sits exactly on the drawn lattice. */
type Frame = {
  x: (v: number) => number;
  y: (v: number) => number;
  /** Figure pixels per lattice step. */
  cell: number;
};
function frameOf(layout: Layout, response: PointPlotResponse): Frame {
  const xs: [number, number][] = [],
    ys: [number, number][] = [];
  for (const d of layout.items) {
    if (d.k !== "line") continue;
    const m = /^plot\.grid\.([xy])\.(-?[\d.]+)$/.exec(d.id);
    if (!m) continue;
    if (m[1] === "x") xs.push([Number(m[2]), d.x1]);
    else ys.push([Number(m[2]), d.y1]);
  }
  const fit = (pairs: [number, number][]) => {
    pairs.sort((a, b) => a[0] - b[0]);
    const [v0, p0] = pairs[0]!,
      [v1, p1] = pairs.at(-1)!;
    const k = (p1 - p0) / (v1 - v0);
    return (v: number) => p0 + (v - v0) * k;
  };
  const x = fit(xs),
    y = fit(ys);
  return { x, y, cell: Math.abs(x(response.grid.step) - x(0)) };
}

/** The grid is square: as wide as the stage allows, and short enough that
 * the prompt and the whole grid show together without scrolling wherever
 * the stage is tall enough. Below 240 px a phone's stage scrolls instead,
 * keeping cells large enough to tap. */
const MIN_PLOT = 240,
  MAX_PLOT = 560;
function plotWidth(host: HTMLElement) {
  let room = host.clientWidth;
  const stage = host.closest<HTMLElement>(".problem-stage");
  const content = host.closest<HTMLElement>(".problem-content");
  if (stage && content) {
    // Everything above the grid in the problem, its legend line and the
    // content's bottom padding (practice.css) take their share of the height.
    const above =
      host.getBoundingClientRect().top - content.getBoundingClientRect().top;
    const below = 28 + parseFloat(getComputedStyle(content).paddingBottom);
    room = Math.min(room, stage.clientHeight - above - below);
  }
  return Math.max(MIN_PLOT, Math.floor(Math.min(room, MAX_PLOT) / 8) * 8);
}

export type PlotReview = {
  /** The correct points the server returned. */
  answer: LatticePoint[];
  correct: boolean;
};

/** Place points on a coordinate grid: tap or click a lattice point to place
 * one and again to remove it; press and slide to aim with a live coordinate
 * tag, or drag a placed point to move it. The grid itself is focusable:
 * arrow keys move a cursor and Enter or Space places or removes a point.
 * Placed points, the cursor and feedback draw in a layer over the static
 * grid scene, so nothing on the page moves while the learner works. */
export function PointPlotInput({
  response,
  value,
  onChange,
  locked,
  review,
}: {
  response: PointPlotResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  review: PlotReview | null;
}) {
  const g = response.grid;
  const host = useRef<HTMLDivElement>(null);
  const layer = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const spec = JSON.stringify(response);
  // Measured before paint, again for each problem (its prompt may be taller)
  // and when the stage itself resizes; never while the learner works.
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const next = plotWidth(element);
      setWidth((current) => (current === next ? current : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const stage = element.closest(".problem-stage");
    if (stage) observer.observe(stage);
    return () => observer.disconnect();
  }, [spec]);
  const scene = useMemo(
    () => (width ? pointPlotScene(response, { width }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, width],
  );
  const layout = useMemo(() => (scene ? layoutScene(scene) : null), [scene]);
  const frame = useMemo(
    () => (layout ? frameOf(layout, response) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, spec],
  );
  const label = useMemo(() => (scene ? describeScene(scene) : ""), [scene]);

  const slots = draftSlots(response, value);
  const placed = slots.filter((p): p is LatticePoint => p !== null);
  const origin: LatticePoint = [
    Math.min(g.xMax, Math.max(g.xMin, 0)),
    Math.min(g.yMax, Math.max(g.yMin, 0)),
  ];
  const [cursor, setCursor] = useState<LatticePoint>(origin);
  const [keyboard, setKeyboard] = useState(false);
  const [focused, setFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  type Drag = {
    pointer: number;
    mode: "new" | "move" | "full";
    from?: LatticePoint;
    at: LatticePoint;
  };
  const [drag, setDrag] = useState<Drag | null>(null);
  // Instructions name the pointer the device has; read once, before paint.
  const [coarse] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );
  // A new problem starts with the cursor at the origin and nothing in hand.
  useLayoutEffect(() => {
    setCursor(origin);
    setDrag(null);
    setAnnouncement("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const labelOf = (p: LatticePoint) => {
    if (!response.ordered) return undefined;
    const i = slots.findIndex((q) => q !== null && samePoint(q, p));
    return i >= 0 ? response.pointLabels?.[i] : undefined;
  };
  const named = (p: LatticePoint, label?: string) =>
    `${label ? `${label} ` : ""}${pointLabelText(p)}`;
  function place(p: LatticePoint) {
    const was = placed.find((q) => samePoint(q, p));
    if (!was && placed.length >= response.pointCount) {
      setAnnouncement(
        `All ${response.pointCount} points are placed. Remove one to place another.`,
      );
      return;
    }
    const next = toggleDraftPoint(response, value, p);
    setAnnouncement(
      was
        ? `Removed ${named(p, labelOf(p))}.`
        : `Placed ${named(p, nextSlotLabel(response, value))}. ${placedCount(response, next)} of ${response.pointCount} placed.`,
    );
    onChange(next);
  }

  /** The nearest lattice point to a pointer, or null well outside the grid. */
  function latticeAt(clientX: number, clientY: number): LatticePoint | null {
    const svg = layer.current,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix || !frame) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    const toMath = (px: number, map: (v: number) => number) =>
      (px - map(0)) / (map(1) - map(0));
    const mx = toMath(pt.x, frame.x),
      my = toMath(pt.y, frame.y);
    const slack = 0.6 * g.step;
    if (
      mx < g.xMin - slack ||
      mx > g.xMax + slack ||
      my < g.yMin - slack ||
      my > g.yMax + slack
    )
      return null;
    const snap = (v: number, min: number, max: number) =>
      Math.min(
        max,
        Math.max(min, Math.round((v - min) / g.step) * g.step + min),
      );
    return [snap(mx, g.xMin, g.xMax), snap(my, g.yMin, g.yMax)];
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (locked || event.button !== 0) return;
    const at = latticeAt(event.clientX, event.clientY);
    setKeyboard(false);
    if (!at) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const holding = placed.find((q) => samePoint(q, at));
    setDrag({
      pointer: event.pointerId,
      mode: holding
        ? "move"
        : placed.length >= response.pointCount
          ? "full"
          : "new",
      from: holding,
      at,
    });
    setCursor(at);
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag || drag.pointer !== event.pointerId) return;
    const at = latticeAt(event.clientX, event.clientY);
    if (at && !samePoint(at, drag.at)) {
      setDrag({ ...drag, at });
      setCursor(at);
    }
  }
  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!drag || drag.pointer !== event.pointerId) return;
    setDrag(null);
    if (locked) return;
    if (drag.mode === "move" && drag.from) {
      if (samePoint(drag.from, drag.at)) place(drag.from);
      else if (!placed.some((q) => samePoint(q, drag.at))) {
        const label = labelOf(drag.from);
        onChange(moveDraftPoint(response, value, drag.from, drag.at));
        setAnnouncement(
          `Moved ${label ? `${label} ` : ""}to ${pointLabelText(drag.at)}.`,
        );
      }
      return;
    }
    if (drag.mode === "new" && !placed.some((q) => samePoint(q, drag.at)))
      place(drag.at);
    if (drag.mode === "full") place(drag.at);
  }
  function keyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (locked) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const move = moves[event.key];
    setKeyboard(true);
    if (move) {
      event.preventDefault();
      const next: LatticePoint = [
        Math.min(g.xMax, Math.max(g.xMin, cursor[0] + move[0] * g.step)),
        Math.min(g.yMax, Math.max(g.yMin, cursor[1] + move[1] * g.step)),
      ];
      setCursor(next);
      const here = placed.find((q) => samePoint(q, next));
      setAnnouncement(
        `${pointLabelText(next)}${here ? `, ${labelOf(here) ? `${labelOf(here)}, ` : ""}placed` : ""}`,
      );
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      place(cursor);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (placed.some((q) => samePoint(q, cursor))) {
        event.preventDefault();
        place(cursor);
      }
    } else if (event.key === "Home") {
      event.preventDefault();
      setCursor(origin);
      setAnnouncement(pointLabelText(origin));
    }
  }

  // What the layer shows: placed points, moved by a drag in progress.
  const shown: (LatticePoint | null)[] = slots.map((p) =>
    p && drag?.mode === "move" && drag.from && samePoint(p, drag.from)
      ? drag.at
      : p,
  );
  const shownPoints = shown.filter((p): p is LatticePoint => p !== null);
  const ghost =
    drag && drag.mode === "new" && !placed.some((q) => samePoint(q, drag.at))
      ? drag.at
      : null;
  const tagAt = drag ? drag.at : keyboard && focused && !locked ? cursor : null;
  const tagLabel =
    drag?.mode === "new"
      ? nextSlotLabel(response, value)
      : drag?.mode === "move" && drag.from
        ? labelOf(drag.from)
        : undefined;

  const R = 7;
  const answer = review?.answer ?? [];
  const showAnswer =
    review &&
    !(
      review.correct &&
      (response.connect === "line" || response.connect === "curve")
    ) &&
    answer.length;
  return (
    <div
      className="point-plot"
      ref={host}
      data-state={review ? (review.correct ? "correct" : "review") : "edit"}
    >
      <div
        className="point-plot-canvas"
        style={
          layout
            ? {
                maxWidth: layout.width,
                aspectRatio: `${layout.width} / ${layout.height}`,
              }
            : { aspectRatio: "1 / 1" }
        }
      >
        {layout && frame && (
          <>
            <SceneSvg layout={layout} label={label} kind="point-plot" />
            <svg
              ref={layer}
              className="point-plot-layer"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="application"
              aria-roledescription="coordinate grid"
              aria-label={`${spokenMath(response.label)}. Grid from ${g.xMin} to ${g.xMax} across and ${g.yMin} to ${g.yMax} up. Arrow keys move, Enter places or removes a point.`}
              aria-disabled={locked || undefined}
              tabIndex={locked ? -1 : 0}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={keyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                setDrag(null);
              }}
            >
              {showAnswer && (
                <g className="point-plot-answer" aria-hidden="true">
                  {response.connect === "line" && answer.length >= 2 && (
                    <Line
                      frame={frame}
                      grid={g}
                      p={answer[0]!}
                      q={answer[1]!}
                      dashed
                    />
                  )}
                  {response.connect === "polygon" && (
                    <Path
                      frame={frame}
                      points={answer}
                      closed={answer.length > 2}
                      dashed
                    />
                  )}
                  {answer.map((p, i) => (
                    <circle
                      key={`a${i}`}
                      className="point-plot-ring"
                      cx={frame.x(p[0])}
                      cy={frame.y(p[1])}
                      r={R + 5}
                    />
                  ))}
                  {response.ordered &&
                    answer.map((p, i) => (
                      <Tag
                        key={`al${i}`}
                        frame={frame}
                        at={p}
                        text={response.pointLabels?.[i] ?? ""}
                        className="point-plot-answer-tag"
                        below
                      />
                    ))}
                </g>
              )}
              <g aria-hidden="true">
                {response.connect === "line" && shownPoints.length >= 2 && (
                  <Line
                    frame={frame}
                    grid={g}
                    p={shownPoints[0]!}
                    q={shownPoints[1]!}
                  />
                )}
                {response.connect === "polygon" && (
                  <Path
                    frame={frame}
                    slots={shown}
                    closed={shown.length > 2 && shown.every((p) => p)}
                  />
                )}
                {shown.map((p, i) =>
                  p ? (
                    <circle
                      key={`${i}:${p[0]},${p[1]}`}
                      className="point-plot-dot"
                      cx={frame.x(p[0])}
                      cy={frame.y(p[1])}
                      r={R}
                    />
                  ) : null,
                )}
                {response.ordered &&
                  shown.map((p, i) =>
                    p ? (
                      <Tag
                        key={`l${i}`}
                        frame={frame}
                        at={p}
                        text={response.pointLabels?.[i] ?? ""}
                        className="point-plot-label"
                      />
                    ) : null,
                  )}
                {ghost && (
                  <circle
                    className="point-plot-ghost"
                    cx={frame.x(ghost[0])}
                    cy={frame.y(ghost[1])}
                    r={R}
                  />
                )}
                {drag?.mode === "full" && (
                  <circle
                    className="point-plot-blocked"
                    cx={frame.x(drag.at[0])}
                    cy={frame.y(drag.at[1])}
                    r={R}
                  />
                )}
                {tagAt && !drag && (
                  <rect
                    className="point-plot-cursor"
                    x={frame.x(tagAt[0]) - 13}
                    y={frame.y(tagAt[1]) - 13}
                    width={26}
                    height={26}
                    rx={6}
                  />
                )}
                {tagAt && (
                  <Tag
                    frame={frame}
                    at={tagAt}
                    text={`${tagLabel ? `${tagLabel} ` : ""}${pointLabelText(tagAt)}`}
                    className="point-plot-coordinate"
                    above
                  />
                )}
              </g>
            </svg>
          </>
        )}
      </div>
      <p
        className="point-plot-legend"
        aria-hidden={review ? undefined : "true"}
      >
        {review ? (
          <>
            <span className="point-plot-key point-plot-key-dot" />
            Your points
            {showAnswer ? (
              <>
                <span className="point-plot-key point-plot-key-ring" />
                Correct
              </>
            ) : null}
          </>
        ) : (
          `${coarse ? "Tap" : "Click"} to place, ${coarse ? "tap" : "click"} again to remove`
        )}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

function Line({
  frame,
  grid,
  p,
  q,
  dashed = false,
}: {
  frame: Frame;
  grid: PointPlotResponse["grid"];
  p: LatticePoint;
  q: LatticePoint;
  dashed?: boolean;
}) {
  const ends = clipLineToGrid(grid, p, q);
  if (!ends) return null;
  const [a, b] = ends;
  return (
    <line
      className={dashed ? "point-plot-answer-line" : "point-plot-line"}
      x1={frame.x(a[0])}
      y1={frame.y(a[1])}
      x2={frame.x(b[0])}
      y2={frame.y(b[1])}
    />
  );
}
/** Segments between consecutive filled slots, closed when every slot is. */
function Path({
  frame,
  slots,
  points,
  closed,
  dashed = false,
}: {
  frame: Frame;
  slots?: (LatticePoint | null)[];
  points?: LatticePoint[];
  closed: boolean;
  dashed?: boolean;
}) {
  const list = slots ?? points ?? [];
  const segments: [LatticePoint, LatticePoint][] = [];
  for (let i = 0; i + 1 < list.length; i++)
    if (list[i] && list[i + 1]) segments.push([list[i]!, list[i + 1]!]);
  if (closed && list.length > 2 && list[0] && list.at(-1))
    segments.push([list.at(-1)!, list[0]!]);
  return (
    <>
      {segments.map(([a, b], i) => (
        <line
          key={i}
          className={dashed ? "point-plot-answer-line" : "point-plot-line"}
          x1={frame.x(a[0])}
          y1={frame.y(a[1])}
          x2={frame.x(b[0])}
          y2={frame.y(b[1])}
        />
      ))}
    </>
  );
}
/** A small label beside a point, on a paper backing so gridlines never
 * cross it. Above for the live coordinate, otherwise up and to the right. */
function Tag({
  frame,
  at,
  text,
  className,
  above = false,
  below = false,
}: {
  frame: Frame;
  at: LatticePoint;
  text: string;
  className: string;
  above?: boolean;
  below?: boolean;
}) {
  const x = frame.x(at[0]),
    y = frame.y(at[1]);
  // The live coordinate sits above; a placed point's label up and to the
  // right; an answer's label down and to the left, so the two never meet.
  const anchor = above ? "middle" : below ? "end" : "start";
  const tx = above ? x : below ? x - 10 : x + 10,
    ty = above ? y - 18 : below ? y + 24 : y - 10;
  return (
    <text
      className={`point-plot-tag ${className}`}
      x={tx}
      y={ty}
      textAnchor={anchor}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

/** The answer dock for a point plot: which points are placed, Clear and
 * Check. Its size depends only on the problem, never on the draft. */
export function PointPlotAnswer({
  response,
  value,
  onChange,
  locked,
  busy,
  resolved,
  submit,
}: {
  response: PointPlotResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  busy: boolean;
  /** The problem has an outcome; Check is replaced by the feedback sheet. */
  resolved: boolean;
  submit: () => void;
}) {
  const slots = draftSlots(response, value);
  const count = slots.filter((p) => p !== null).length;
  const complete = count === response.pointCount;
  const chips = Array.from(
    { length: response.pointCount },
    (_, i) => slots[i] ?? null,
  );
  return (
    <form
      className="point-plot-form"
      aria-label={spokenMath(response.label)}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!busy && !resolved && complete) submit();
      }}
    >
      <ol
        className="point-plot-chips"
        aria-label="Placed points"
        style={{ "--plot-points": response.pointCount } as CSSProperties}
      >
        {chips.map((p, i) => (
          <li key={i} className={p ? "filled" : "empty"}>
            {response.ordered && (
              <span className="point-plot-chip-label">
                {response.pointLabels?.[i]}
              </span>
            )}
            <span className="point-plot-chip-value">
              {p ? pointLabelText(p) : "—"}
              {!p && <span className="sr-only">not placed</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="point-plot-count" role="status" aria-live="polite">
        {count} of {response.pointCount} placed
      </p>
      <div className="point-plot-actions">
        <button
          type="button"
          className="secondary point-plot-clear"
          disabled={locked || count === 0}
          onClick={() => onChange("")}
        >
          Clear
        </button>
        <button
          className="choice-submit point-plot-check"
          type="submit"
          disabled={busy || resolved || !complete}
          aria-busy={busy}
        >
          Check
        </button>
      </div>
    </form>
  );
}

/** The learner's and correct points for the feedback overlay. */
export function plotReview(
  response: PointPlotResponse,
  answer: string,
  correct: boolean,
): PlotReview {
  return {
    answer: plotPoints(answer).filter((p) => onGrid(response.grid, p)),
    correct,
  };
}
