import React from "react";
import {
  isoFit,
  isoPoint,
  type GeometryFigure as Model,
} from "../math/geometry-figures.js";

const ink = "var(--color-figure-ink)",
  accent = "var(--color-figure-accent)",
  warm = "var(--color-figure-warm)",
  paper = "var(--color-figure-paper)";
type Point = { x: number; y: number };
type Projector = (x: number, y: number, z: number) => Point;
const path = (points: Point[]) =>
  `M${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L")} Z`;
const segment = (a: Point, b: Point) =>
  `M${a.x.toFixed(2)} ${a.y.toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;

/** The three faces of a box that face the viewer, optionally ruled into unit
 * squares. Faces are painted back to front, so boxes nearer the viewer must
 * be drawn after boxes behind them. */
export function IsoBox({
  at = [0, 0, 0],
  size: [l, w, h],
  project,
  grid,
  className,
}: {
  at?: [number, number, number];
  size: [number, number, number];
  project: Projector;
  grid: boolean;
  className?: string;
}) {
  const [x0, y0, z0] = at,
    x1 = x0 + l,
    y1 = y0 + w,
    z1 = z0 + h;
  const p = (x: number, y: number, z: number) => project(x, y, z);
  const lines: string[] = [];
  if (grid) {
    for (let i = 1; i < l; i++) {
      lines.push(segment(p(x0 + i, y0, z1), p(x0 + i, y1, z1)));
      lines.push(segment(p(x0 + i, y1, z0), p(x0 + i, y1, z1)));
    }
    for (let j = 1; j < w; j++) {
      lines.push(segment(p(x0, y0 + j, z1), p(x1, y0 + j, z1)));
      lines.push(segment(p(x1, y0 + j, z0), p(x1, y0 + j, z1)));
    }
    for (let k = 1; k < h; k++) {
      lines.push(segment(p(x0, y1, z0 + k), p(x1, y1, z0 + k)));
      lines.push(segment(p(x1, y0, z0 + k), p(x1, y1, z0 + k)));
    }
  }
  return (
    <g className={className}>
      <path
        data-face="top"
        d={path([p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)])}
        fill="var(--color-figure-accent-fill-strong)"
      />
      <path
        data-face="front-left"
        d={path([p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)])}
        fill="var(--color-figure-accent-fill)"
      />
      <path
        data-face="front-right"
        d={path([p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)])}
        fill="var(--color-figure-empty)"
      />
      {lines.length > 0 && (
        <path
          d={lines.join(" ")}
          fill="none"
          stroke={accent}
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      )}
      <path
        d={[
          path([p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)]),
          segment(p(x0, y1, z0), p(x1, y1, z0)),
          segment(p(x1, y1, z0), p(x1, y0, z0)),
          segment(p(x0, y1, z0), p(x0, y1, z1)),
          segment(p(x1, y1, z0), p(x1, y1, z1)),
          segment(p(x1, y0, z0), p(x1, y0, z1)),
        ].join(" ")}
        fill="none"
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A label beside an edge, on the side away from the solid's center. */
function EdgeLabel({
  a,
  b,
  center,
  text,
  edge,
}: {
  a: Point;
  b: Point;
  center: Point;
  text: string;
  edge: string;
}) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let nx = -(b.y - a.y) / length,
    ny = (b.x - a.x) / length;
  if (nx * (mid.x - center.x) + ny * (mid.y - center.y) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const unknown = text === "?";
  return (
    <text
      data-edge={edge}
      x={mid.x + nx * 10}
      y={mid.y + ny * 10}
      textAnchor={nx < -0.3 ? "end" : nx > 0.3 ? "start" : "middle"}
      dominantBaseline={ny > 0.3 ? "hanging" : ny < -0.3 ? "auto" : "central"}
      style={{
        fontSize: 21,
        fontWeight: unknown ? 700 : 400,
        fill: unknown ? warm : ink,
        stroke: paper,
        strokeWidth: 5,
        paintOrder: "stroke",
      }}
    >
      {text}
    </text>
  );
}

const frame = { width: 320, height: 250, pad: 14 };
/** Horizontal room for an EdgeLabel beside a solid: its 10px offset plus a
 * conservative 0.62em per character at 21px, so the label stays in the view
 * box with any print font. */
const labelRoom = (...texts: string[]) =>
  14 + Math.max(...texts.map((t) => t.length)) * 21 * 0.62;
export function GeometryFigure({ figure }: { figure: Model }) {
  switch (figure.kind) {
    case "cube-prism": {
      const { length: l, width: w, height: h } = figure;
      const { unit, origin } = isoFit(l, w, h, frame);
      return (
        <svg
          className="figure geometry-figure"
          data-kind={figure.kind}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          role="img"
          aria-label={`A rectangular prism built from unit cubes: ${l} cubes long, ${w} cubes wide and ${h} cubes high. Some cubes are hidden behind the visible faces.`}
        >
          <IsoBox
            size={[l, w, h]}
            grid
            project={(x, y, z) => isoPoint(x, y, z, unit, origin)}
          />
        </svg>
      );
    }
    case "box-prism": {
      const given = [figure.length, figure.width, figure.height];
      const known = given.filter((e) => e !== null).map((e) => e!.value);
      // A missing edge is drawn at a neutral length so the picture cannot
      // reveal the answer; the label says the drawing is not to scale.
      const neutral = Math.max(
        2,
        Math.min(10, Math.round(Math.sqrt(known[0]! * known[1]!))),
      );
      const [l, w, h] = given.map((e) => e?.value ?? neutral) as [
        number,
        number,
        number,
      ];
      const text = (e: (typeof given)[number]) =>
        e ? `${e.value} ${e.unit}` : "?";
      // Height is labelled left of the solid, width right of it.
      const { unit, origin } = isoFit(l, w, h, {
        ...frame,
        pad: 34,
        padLeft: Math.max(34, labelRoom(text(figure.height))),
        padRight: Math.max(34, labelRoom(text(figure.width))),
      });
      const p = (x: number, y: number, z: number) =>
        isoPoint(x, y, z, unit, origin);
      const center = p(l / 2, w / 2, h / 2);
      const missing = given.some((e) => e === null);
      return (
        <svg
          className="figure geometry-figure"
          data-kind={figure.kind}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          role="img"
          aria-label={`A rectangular prism. Length ${text(figure.length)}, width ${text(figure.width)}, height ${text(figure.height)}.${missing ? " The edge marked ? is unknown; the drawing is not to scale." : ""}`}
        >
          <IsoBox size={[l, w, h]} grid={false} project={p} />
          <EdgeLabel
            edge="length"
            a={p(0, w, 0)}
            b={p(l, w, 0)}
            center={center}
            text={text(figure.length)}
          />
          <EdgeLabel
            edge="width"
            a={p(l, 0, 0)}
            b={p(l, w, 0)}
            center={center}
            text={text(figure.width)}
          />
          <EdgeLabel
            edge="height"
            a={p(0, w, 0)}
            b={p(0, w, h)}
            center={center}
            text={text(figure.height)}
          />
        </svg>
      );
    }
    case "composite-prism": {
      const [a, b] = figure.parts as [
        { length: number; height: number },
        { length: number; height: number },
      ];
      const w = figure.width,
        l = a.length + b.length,
        h = Math.max(a.height, b.height);
      const cm = (n: number) => `${n} cm`;
      // One height is labelled left of the solid; the other and the width right.
      const { unit, origin } = isoFit(l, w, h, {
        ...frame,
        pad: 34,
        padLeft: Math.max(34, labelRoom(cm(a.height))),
        padRight: Math.max(34, labelRoom(cm(b.height), cm(w))),
      });
      const p = (x: number, y: number, z: number) =>
        isoPoint(x, y, z, unit, origin);
      const center = p(l / 2, w / 2, h / 2);
      return (
        <svg
          className="figure geometry-figure"
          data-kind={figure.kind}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          role="img"
          aria-label={`A solid made of two rectangular prisms side by side, both ${cm(w)} deep. Taller prism: ${cm(a.length)} long and ${cm(a.height)} high. Shorter prism: ${cm(b.length)} long and ${cm(b.height)} high.`}
        >
          <IsoBox size={[a.length, w, a.height]} grid={false} project={p} />
          <IsoBox
            at={[a.length, 0, 0]}
            size={[b.length, w, b.height]}
            grid={false}
            project={p}
          />
          <EdgeLabel
            edge="left-length"
            a={p(0, 0, a.height)}
            b={p(a.length, 0, a.height)}
            center={center}
            text={cm(a.length)}
          />
          <EdgeLabel
            edge="right-length"
            a={p(a.length, w, 0)}
            b={p(l, w, 0)}
            center={center}
            text={cm(b.length)}
          />
          <EdgeLabel
            edge="left-height"
            a={p(0, w, 0)}
            b={p(0, w, a.height)}
            center={center}
            text={cm(a.height)}
          />
          <EdgeLabel
            edge="right-height"
            a={p(l, 0, 0)}
            b={p(l, 0, b.height)}
            center={center}
            text={cm(b.height)}
          />
          <EdgeLabel
            edge="width"
            a={p(l, 0, 0)}
            b={p(l, w, 0)}
            center={center}
            text={cm(w)}
          />
        </svg>
      );
    }
    case "quadrant-grid":
      return <QuadrantGrid figure={figure} />;
  }
}

type GridPoint = Extract<Model, { kind: "quadrant-grid" }>["points"][number];
/** Each label takes the diagonal grid cell beside its point. Cells already
 * holding a label are avoided first, then cells with another point on a
 * corner, so a label never sits nearer a different point. */
function placeLabels(points: readonly GridPoint[], size: number) {
  const used = new Set<string>();
  const directions = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const;
  return points.map((p) => {
    const cost = ([dx, dy]: readonly [number, number]) => {
      const cell = `${p.x + (dx - 1) / 2},${p.y + (dy - 1) / 2}`;
      const corners = [
        [p.x + dx, p.y],
        [p.x, p.y + dy],
        [p.x + dx, p.y + dy],
      ];
      return (
        (used.has(cell) ? 100 : 0) +
        (p.x + dx < 0 || p.x + dx > size || p.y + dy > size ? 50 : 0) +
        (p.y + dy < 0 ? 1 : 0) +
        corners.filter(([cx, cy]) =>
          points.some((q) => q.x === cx && q.y === cy),
        ).length
      );
    };
    const [dx, dy] = directions.reduce((best, d) =>
      cost(d) < cost(best) ? d : best,
    );
    used.add(`${p.x + (dx - 1) / 2},${p.y + (dy - 1) / 2}`);
    return { p, dx, dy };
  });
}

/** Grid geometry shared by the figure and the coordinate lesson model. */
export function quadrantLayout(size: number) {
  const left = 48,
    bottom = 246,
    span = 214,
    step = span / size;
  return {
    step,
    x: (n: number) => left + n * step,
    y: (n: number) => bottom - n * step,
  };
}
export function QuadrantGrid({
  figure,
  children,
  hidePoints = false,
}: {
  figure: Extract<Model, { kind: "quadrant-grid" }>;
  children?: React.ReactNode;
  hidePoints?: boolean;
}) {
  const { size } = figure;
  const { x, y, step } = quadrantLayout(size);
  const ticks = Array.from({ length: size + 1 }, (_, i) => i);
  // The axes overshoot the grid by at most 10px, so on a small grid with wide
  // steps the arrowheads and the y label stay inside the view box.
  const end = size + Math.min(0.55, 10 / step);
  return (
    <svg
      className="figure geometry-figure"
      data-kind={figure.kind}
      viewBox="0 0 300 290"
      role="img"
      aria-label={`First-quadrant grid from 0 to ${size} on both axes, one unit per gridline. ${figure.points.map((p) => `Point ${p.label} at (${p.x}, ${p.y})`).join("; ")}.`}
    >
      {ticks.slice(1).map((n) => (
        <path
          key={n}
          d={`${segment({ x: x(n), y: y(0) }, { x: x(n), y: y(size) })} ${segment({ x: x(0), y: y(n) }, { x: x(size), y: y(n) })}`}
          stroke="var(--color-figure-grid)"
          strokeWidth={1.25}
        />
      ))}
      <path
        d={`${segment({ x: x(0), y: y(0) }, { x: x(end), y: y(0) })} ${segment({ x: x(0), y: y(0) }, { x: x(0), y: y(end) })}`}
        stroke={ink}
        strokeWidth={2.5}
      />
      <path
        d={`M${x(end) + 8} ${y(0)} l-11 -6 v12 Z M${x(0)} ${y(end) - 8} l-6 11 h12 Z`}
        fill={ink}
      />
      {ticks.map((n) => (
        <g key={n} style={{ fontSize: step < 26 ? 17 : 19, fill: ink }}>
          <text x={x(n)} y={y(0) + 24} textAnchor="middle">
            {n}
          </text>
          {n > 0 && (
            <text x={x(0) - 10} y={y(n) + 6} textAnchor="end">
              {n}
            </text>
          )}
        </g>
      ))}
      <text
        x={x(end) + 4}
        y={y(0) - 12}
        textAnchor="middle"
        style={{ fontSize: 19, fontStyle: "italic", fill: ink }}
      >
        x
      </text>
      <text
        x={x(0) + 16}
        y={y(end) - 2}
        textAnchor="middle"
        style={{ fontSize: 19, fontStyle: "italic", fill: ink }}
      >
        y
      </text>
      {children}
      {!hidePoints &&
        placeLabels(figure.points, size).map(({ p, dx, dy }) => {
          return (
            <g key={p.label} data-point={p.label}>
              <circle
                cx={x(p.x)}
                cy={y(p.y)}
                r={6}
                fill={warm}
                stroke={paper}
                strokeWidth={1.5}
              />
              <text
                x={x(p.x) + dx * 9}
                y={y(p.y) - dy * 9}
                textAnchor={dx > 0 ? "start" : "end"}
                dominantBaseline={dy > 0 ? "auto" : "hanging"}
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  fill: warm,
                  stroke: paper,
                  strokeWidth: 5,
                  paintOrder: "stroke",
                }}
              >
                {p.label}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
