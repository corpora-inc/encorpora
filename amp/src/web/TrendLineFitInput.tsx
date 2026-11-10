import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { layoutScene, type Layout } from "../math/scene";
import {
  initialTrendPoints,
  normalizeTrendLine,
  throughTrendPoints,
  trendLineScene,
  trendPoints,
  type TrendLine,
  type TrendPoint,
  type TrendLineFitResponse,
} from "../math/trend-line-fit";
import { SceneSvg } from "./scene/SceneSvg";

/** Read the scene's own coordinate transform; data, handles and feedback
 * share one grid. The static layout never includes the moving line. */
function frameOf(layout: Layout) {
  const axis = (name: string) => {
    const lines = layout.items
      .flatMap((p) => {
        const match = new RegExp(`^trend\\.grid\\.${name}\\.(-?[\\d.]+)$`).exec(
          p.id,
        );
        return match && p.k === "line"
          ? [[Number(match[1]), name === "x" ? p.x1 : p.y1]]
          : [];
      })
      .sort((a, b) => a[0]! - b[0]!);
    const first = lines[0]!,
      last = lines.at(-1)!;
    const scale = (last[1]! - first[1]!) / (last[0]! - first[0]!);
    return {
      at: (v: number) => first[1]! + (v - first[0]!) * scale,
      from: (v: number) => first[0]! + (v - first[1]!) / scale,
    };
  };
  return { x: axis("x"), y: axis("y") };
}
const short = (n: number) => String(Math.round(n * 100) / 100);
export function TrendLineFitInput({
  response: r,
  value,
  onChange,
  locked,
  answer,
}: {
  response: TrendLineFitResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  answer?: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("");
  const drag = useRef<{
    pointer: number;
    index: number;
    start: [number, number];
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const id = useId(),
    g = r.grid;
  useLayoutEffect(() => {
    if (!value) setMessage("");
  }, [value]);
  useLayoutEffect(() => {
    const measure = () =>
      setWidth(Math.min(520, Math.floor(host.current!.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host.current!);
    return () => observer.disconnect();
  }, []);
  const layout = useMemo(
    () => layoutScene(trendLineScene(r, { width })),
    [r, width],
  );
  const frame = useMemo(() => frameOf(layout), [layout]);
  const points = trendPoints(r, value) ?? initialTrendPoints(r);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const fitted = throughTrendPoints(points);
  const reference = answer ? trendPoints(r, answer) : null;
  const good = reference ? throughTrendPoints(reference) : null;
  const resolved = answer !== undefined;
  const spoken = `Line through (${points[0].join(", ")}) and (${points[1].join(", ")}). Slope ${short(fitted.m)}: ${short(fitted.m)} vertical units per horizontal unit.`;
  function move(index: number, target: TrendPoint) {
    if (locked) return;
    const current = pointsRef.current;
    const snap = (v: number, min: number, max: number, step: number) =>
      Math.max(min, Math.min(max, min + Math.round((v - min) / step) * step));
    const p: TrendPoint = [
      snap(target[0], g.xMin, g.xMax, g.xStep),
      snap(target[1], g.yMin, g.yMax, g.yStep),
    ];
    if (p[0] === current[1 - index]![0]) {
      setMessage("Choose two different horizontal values.");
      return;
    }
    // Preserve handle identity by forbidding a crossing; select the other
    // handle to move the other end. Server normalization accepts either order.
    if (
      (index === 0 && p[0] > current[1][0]) ||
      (index === 1 && p[0] < current[0][0])
    ) {
      setMessage("Keep handle 1 to the left of handle 2.");
      return;
    }
    setMessage("");
    const next: [TrendPoint, TrendPoint] = [...current];
    next[index] = p;
    pointsRef.current = next;
    onChange(JSON.stringify(next));
  }
  function nudge(dx: number, dy: number) {
    const p = pointsRef.current[selected]!;
    move(selected, [p[0] + dx * g.xStep, p[1] + dy * g.yStep]);
  }
  function key(e: KeyboardEvent, index = selected) {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const d = deltas[e.key];
    if (!d || locked) return;
    e.preventDefault();
    const p = pointsRef.current[index]!;
    move(index, [p[0] + d[0] * g.xStep, p[1] + d[1] * g.yStep]);
  }
  function pointerMove(e: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointer !== e.pointerId || locked) return;
    if (
      !active.moved &&
      Math.hypot(e.clientX - active.start[0], e.clientY - active.start[1]) < 4
    )
      return;
    active.moved = true;
    const box = canvas.current!.getBoundingClientRect();
    move(active.index, [
      frame.x.from(((e.clientX - box.left) * layout.width) / box.width),
      frame.y.from(((e.clientY - box.top) * layout.height) / box.height),
    ]);
  }
  const lineElement = (line: TrendLine, className: string) => (
    <line
      className={className}
      x1={frame.x.at(g.xMin)}
      y1={frame.y.at(line.m * g.xMin + line.b)}
      x2={frame.x.at(g.xMax)}
      y2={frame.y.at(line.m * g.xMax + line.b)}
    />
  );
  return (
    <div className="trend-fit" ref={host} data-resolved={resolved || undefined}>
      {/* Both lines share one cell, so the taller keeps its room when the
          line is graded and nothing below it moves. */}
      <p className="trend-instructions">
        <span hidden={resolved || undefined}>
          Drag a square handle, or select one and use the arrows.
        </span>
        <span hidden={!resolved || undefined}>
          Compare the lines and the vertical gaps from the dots.
        </span>
      </p>
      <div
        className="trend-canvas"
        ref={canvas}
        style={{
          width: layout.width,
          aspectRatio: `${layout.width} / ${layout.height}`,
        }}
      >
        <SceneSvg
          layout={layout}
          kind="trend-line-fit"
          label={`Scatter plot. Horizontal axis: ${g.xLabel}. Vertical axis: ${g.yLabel}. ${r.data.length} data points; a data table follows the controls.`}
        />
        <svg
          className="trend-overlay"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          <defs>
            <clipPath id={id}>
              <rect
                x={frame.x.at(g.xMin)}
                y={frame.y.at(g.yMax)}
                width={frame.x.at(g.xMax) - frame.x.at(g.xMin)}
                height={frame.y.at(g.yMin) - frame.y.at(g.yMax)}
              />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id})`}>
            {good &&
              r.data.map(([x, y], i) => (
                <g key={i}>
                  {value && (
                    <line
                      className="trend-residual student"
                      x1={frame.x.at(x) - 1.5}
                      x2={frame.x.at(x) - 1.5}
                      y1={frame.y.at(y)}
                      y2={frame.y.at(fitted.m * x + fitted.b)}
                    />
                  )}
                  <line
                    className="trend-residual good"
                    x1={frame.x.at(x) + 1.5}
                    x2={frame.x.at(x) + 1.5}
                    y1={frame.y.at(y)}
                    y2={frame.y.at(good.m * x + good.b)}
                  />
                </g>
              ))}
            {(!resolved || value) && lineElement(fitted, "trend-student-line")}
            {good && lineElement(good, "trend-good-line")}
          </g>
        </svg>
        {!resolved &&
          points.map((p, i) => (
            <button
              key={i}
              type="button"
              className="trend-handle"
              data-selected={selected === i}
              disabled={locked}
              aria-label={`Handle ${i + 1}: ${g.xLabel} ${p[0]}, ${g.yLabel} ${p[1]}. Arrow keys move one step.`}
              style={{
                left: `${(100 * frame.x.at(p[0])) / layout.width}%`,
                top: `${(100 * frame.y.at(p[1])) / layout.height}%`,
              }}
              onFocus={() => setSelected(i)}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => key(e, i)}
              onPointerDown={(e) => {
                if (locked || (e.pointerType === "mouse" && e.button !== 0))
                  return;
                setSelected(i);
                e.currentTarget.focus({ preventScroll: true });
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = {
                  pointer: e.pointerId,
                  index: i,
                  start: [e.clientX, e.clientY],
                  moved: false,
                };
                setDragging(true);
              }}
              onPointerMove={pointerMove}
              onPointerUp={(e) => {
                if (drag.current?.pointer === e.pointerId) {
                  pointerMove(e);
                  drag.current = null;
                  setDragging(false);
                }
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDragging(false);
              }}
              onLostPointerCapture={() => {
                drag.current = null;
                setDragging(false);
              }}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        {dragging && !resolved && (
          <output className="trend-coordinate">
            Handle {selected + 1}: ({points[selected]!.join(", ")})
          </output>
        )}
      </div>
      <div
        className="trend-legend"
        aria-label="Line key"
        style={{ visibility: resolved ? "visible" : "hidden" }}
        aria-hidden={!resolved || undefined}
      >
        <span>
          <i className="trend-key-student" />
          Your line
        </span>
        <span>
          <i className="trend-key-good" />
          One good fit
        </span>
      </div>
      <div className="trend-tool-space">
        <div
          className="trend-tools"
          style={{ visibility: resolved ? "hidden" : "visible" }}
          aria-hidden={resolved || undefined}
        >
          <div
            className="trend-select"
            role="group"
            aria-label="Choose a handle"
          >
            {points.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={selected === i}
                disabled={locked}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => key(e, i)}
              >
                Handle {i + 1}
                <small>({p.join(", ")})</small>
              </button>
            ))}
          </div>
          <div
            className="trend-nudges"
            role="group"
            aria-label={`Move handle ${selected + 1}`}
            onKeyDown={(e) => key(e)}
          >
            {(
              [
                [-1, 0, "Left", "←"],
                [0, 1, "Up", "↑"],
                [0, -1, "Down", "↓"],
                [1, 0, "Right", "→"],
              ] as const
            ).map(([dx, dy, name, symbol]) => (
              <button
                key={name}
                type="button"
                aria-label={`Move ${name.toLowerCase()}`}
                disabled={
                  locked ||
                  (dx < 0
                    ? points[selected]![0] <=
                      (selected === 0 ? g.xMin : points[0][0] + g.xStep)
                    : dx > 0
                      ? points[selected]![0] >=
                        (selected === 1 ? g.xMax : points[1][0] - g.xStep)
                      : dy < 0
                        ? points[selected]![1] <= g.yMin
                        : points[selected]![1] >= g.yMax)
                }
                onClick={() => nudge(dx, dy)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
        {resolved && (
          <p className="trend-review-note">
            Each stick shows the vertical gap from a dot to a line. A good fit
            keeps these gaps small along the whole cloud. Other nearby lines can
            also be good fits.
          </p>
        )}
      </div>
      <p className="trend-status" role="status" aria-live="polite">
        {resolved
          ? null
          : message ||
            `Slope: ${short(fitted.m)}. Arrows move ${g.xStep} across or ${g.yStep} up.`}
        <span className="sr-only">
          {" "}
          {spoken}
          {good ? ` One good fit has slope ${short(good.m)}.` : ""}
        </span>
      </p>
      <details className="trend-table">
        <summary>Data table ({r.data.length} dots)</summary>
        <table>
          <thead>
            <tr>
              <th>{g.xLabel}</th>
              <th>{g.yLabel}</th>
            </tr>
          </thead>
          <tbody>
            {r.data.map(([x, y], i) => (
              <tr key={i}>
                <td>{x}</td>
                <td>
                  {y}
                  {good && (
                    <span className="sr-only">
                      .{" "}
                      {value
                        ? `Vertical gap to your line: ${short(Math.abs(y - fitted.m * x - fitted.b))}. `
                        : ""}
                      Vertical gap to the good line:{" "}
                      {short(Math.abs(y - good.m * x - good.b))}.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function TrendLineFitAnswer({
  response,
  value,
  onChange,
  locked,
  sending,
  submit,
}: {
  response: TrendLineFitResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  sending: boolean;
  submit: () => void;
}) {
  return (
    <form
      className="trend-answer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && normalizeTrendLine(response, value)) submit();
      }}
    >
      <button
        type="button"
        className="secondary"
        disabled={locked || !value}
        onClick={() => onChange("")}
      >
        Reset
      </button>
      <button
        type="submit"
        className="choice-submit"
        disabled={locked || normalizeTrendLine(response, value) === null}
        aria-busy={sending}
      >
        Check line
      </button>
    </form>
  );
}
