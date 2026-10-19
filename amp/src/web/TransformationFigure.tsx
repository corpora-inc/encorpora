import React from "react";
import type {
  CoordinateGeometryFigure,
  SimilarTrianglesFigure,
} from "../math/contracts.js";

/** Role tokens with print fallbacks: printed pages carry no theme variables. */
const ink = "var(--color-figure-ink, #174a43)",
  grid = "var(--color-figure-grid, #d6dfd6)",
  paper = "var(--color-figure-paper, #fffdf7)",
  accent = "var(--color-figure-accent, #20776d)",
  accentFill = "var(--color-figure-accent-fill, #d4e9e1)",
  warm = "var(--color-figure-warm, #9c4420)",
  warmFill = "var(--color-figure-warm-fill, #f2d5c3)";
const halo = {
  paintOrder: "stroke" as const,
  stroke: paper,
  strokeWidth: 4,
  strokeLinejoin: "round" as const,
};
/** Inline, so page-level text rules cannot enlarge the scale labels. */
const tick = { fontSize: 12, fill: ink, fontStyle: "normal" } as const;
const signed = (v: number) => (v < 0 ? `−${-v}` : String(v));

/** Pixel layout of a coordinate window: one unit is the same length on both axes. */
export function coordinateLayout(
  f: Pick<CoordinateGeometryFigure, "xMin" | "xMax" | "yMin" | "yMax">,
  box = { left: 28, top: 18, width: 276, height: 210 },
) {
  const unit = Math.min(
    box.width / (f.xMax - f.xMin),
    box.height / (f.yMax - f.yMin),
  );
  const ox = box.left + (box.width - unit * (f.xMax - f.xMin)) / 2,
    oy = box.top + (box.height - unit * (f.yMax - f.yMin)) / 2;
  return {
    unit,
    x: (v: number) => ox + (v - f.xMin) * unit,
    y: (v: number) => oy + (f.yMax - v) * unit,
  };
}
const range = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, i) => min + i);

export function describeCoordinateFigure(f: CoordinateGeometryFigure) {
  const shapes = f.shapes.map((s) => {
    const name = s.vertices.map((v) => v.label).join("");
    const kind = !s.closed
      ? s.vertices.length === 2
        ? "Segment"
        : "Points"
      : s.vertices.length === 3
        ? "Triangle"
        : s.vertices.length === 4
          ? "Quadrilateral"
          : "Polygon";
    return `${s.role === "image" ? `Image ${kind.toLowerCase()}` : kind} ${name}, ${s.role === "image" ? "dashed" : "solid"} outline: ${s.vertices.map((v) => `${v.label} at (${signed(v.x)}, ${signed(v.y)})`).join(", ")}.`;
  });
  return `Coordinate grid with equal unit squares on both axes. ${shapes.join(" ")}${f.rays ? " Rays from the origin pass through each vertex and its image." : ""}`;
}

/** Lattice shapes drawn to an exact, equal scale on both axes. */
export function CoordinateGeometry({
  figure: f,
  className = "figure geometry-figure",
  children,
  description,
  style,
}: {
  figure: CoordinateGeometryFigure;
  className?: string;
  style?: React.CSSProperties;
  /** Extra layers drawn above the grid in the same coordinates (animations). */
  children?: (layout: ReturnType<typeof coordinateLayout>) => React.ReactNode;
  description?: string;
}) {
  const layout = coordinateLayout(f),
    { unit, x, y } = layout;
  const step = [1, 2, 5, 10].find((s) => s * unit >= 22) ?? 10;
  const ticks = (min: number, max: number) =>
    range(min, max).filter((v) => v % step === 0);
  const given = f.shapes.filter((s) => s.role === "given");
  const images = f.shapes.filter((s) => s.role === "image");
  return (
    <svg
      data-kind={f.kind}
      data-unit={unit}
      className={className}
      style={style}
      viewBox="0 0 320 250"
      // An empty description marks a layer inside a figure that is already labeled.
      role={description === "" ? "presentation" : "img"}
      aria-label={
        description === ""
          ? undefined
          : (description ?? describeCoordinateFigure(f))
      }
    >
      {range(f.xMin, f.xMax).map((v) => (
        <line
          key={`x${v}`}
          x1={x(v)}
          x2={x(v)}
          y1={y(f.yMin)}
          y2={y(f.yMax)}
          stroke={v === 0 ? ink : grid}
          strokeWidth={v === 0 ? 1.6 : 0.8}
        />
      ))}
      {range(f.yMin, f.yMax).map((v) => (
        <line
          key={`y${v}`}
          x1={x(f.xMin)}
          x2={x(f.xMax)}
          y1={y(v)}
          y2={y(v)}
          stroke={v === 0 ? ink : grid}
          strokeWidth={v === 0 ? 1.6 : 0.8}
        />
      ))}
      {/* Scale labels sit along the window's edges, clear of the shapes. */}
      <g style={{ fontSize: 12, fill: ink }}>
        {ticks(f.xMin + 1, f.xMax).map((v) => (
          <text
            key={`tx${v}`}
            x={x(v)}
            y={y(f.yMin) + 14}
            textAnchor="middle"
            style={tick}
          >
            {signed(v)}
          </text>
        ))}
        {ticks(f.yMin, f.yMax).map((v) => (
          <text
            key={`ty${v}`}
            x={x(f.xMin) - 5}
            y={y(v) + 4}
            textAnchor="end"
            style={tick}
          >
            {signed(v)}
          </text>
        ))}
        <text
          x={x(f.xMax) + 4}
          y={y(0) + 4}
          style={{ fontSize: 14, fontStyle: "italic", fill: ink }}
        >
          x
        </text>
        <text
          x={x(0)}
          y={y(f.yMax) - 5}
          textAnchor="middle"
          style={{ fontSize: 14, fontStyle: "italic", fill: ink }}
        >
          y
        </text>
      </g>
      {f.rays &&
        given.flatMap((s, si) =>
          s.vertices.map((v, i) => {
            const image = images[si]?.vertices[i];
            const far =
              image && Math.hypot(image.x, image.y) > Math.hypot(v.x, v.y)
                ? image
                : v;
            const length = Math.hypot(far.x, far.y);
            const reach = (length + 0.8) / length;
            return (
              <line
                key={`ray${si}${i}`}
                data-ray={v.label}
                x1={x(0)}
                y1={y(0)}
                x2={x(far.x * reach)}
                y2={y(far.y * reach)}
                stroke={ink}
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity="0.75"
              />
            );
          }),
        )}
      {(["outline", "marks"] as const).map((pass) =>
        f.shapes.map((s, si) => {
          const image = s.role === "image";
          const stroke = image ? warm : accent;
          const points = s.vertices.map((v) => `${x(v.x)},${y(v.y)}`).join(" ");
          const cx =
              s.vertices.reduce((a, v) => a + v.x, 0) / s.vertices.length,
            cy = s.vertices.reduce((a, v) => a + v.y, 0) / s.vertices.length;
          return (
            <g
              key={`${pass}${si}`}
              data-shape={pass === "marks" ? s.role : undefined}
            >
              {pass === "outline" &&
                (s.closed ? (
                  <polygon
                    points={points}
                    fill={image ? warmFill : accentFill}
                    fillOpacity="0.6"
                    stroke={stroke}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeDasharray={image ? "7 5" : undefined}
                  />
                ) : (
                  <polyline
                    points={points}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2.5"
                    strokeDasharray={image ? "7 5" : undefined}
                  />
                ))}
              {pass === "marks" &&
                s.vertices.map((v) => {
                  // Labels sit outside the shape, away from its center.
                  let dx = v.x - cx,
                    dy = v.y - cy;
                  if (!s.closed && s.vertices.length === 2) {
                    const other = s.vertices.find((w) => w !== v)!;
                    dx = v.x - other.x;
                    dy = v.y - other.y;
                  }
                  const len = Math.hypot(dx, dy) || 1;
                  return (
                    <g key={v.label}>
                      <circle
                        data-vertex={v.label}
                        data-x={v.x}
                        data-y={v.y}
                        cx={x(v.x)}
                        cy={y(v.y)}
                        r="3.5"
                        fill={stroke}
                      />
                      <text
                        x={x(v.x) + (dx / len) * 14}
                        y={y(v.y) - (dy / len) * 14 + 5}
                        textAnchor="middle"
                        style={{
                          ...halo,
                          fontSize: 15,
                          fontWeight: 700,
                          fill: ink,
                        }}
                      >
                        {v.label}
                      </text>
                    </g>
                  );
                })}
            </g>
          );
        }),
      )}
      {children?.(layout)}
    </svg>
  );
}

/** Vertices of a triangle with sides [v0v1, v1v2, v2v0], v0 at the origin, v1 on the x-axis. */
export function triangleFromSides([c, a, b]: readonly number[]) {
  const cosA = (c! * c! + b! * b! - a! * a!) / (2 * c! * b!);
  return [
    { x: 0, y: 0 },
    { x: c!, y: 0 },
    { x: b! * cosA, y: b! * Math.sqrt(1 - cosA * cosA) },
  ];
}
/** The ratio of the second triangle to the first, from the first pair of stated sides. */
export function similarityRatio(f: SimilarTrianglesFigure) {
  const [first, second] = f.triangles as [
    SimilarTrianglesFigure["triangles"][number],
    SimilarTrianglesFigure["triangles"][number],
  ];
  const i = second.sides.findIndex((s) => typeof s === "number");
  return (second.sides[i] as number) / (first.sides[i] as number);
}
export function describeSimilarTriangles(f: SimilarTrianglesFigure) {
  const [first, second] = f.triangles;
  const sides = (t: (typeof f.triangles)[number]) =>
    t.sides
      .map((s, i) => {
        const name = `${t.vertices[i]}${t.vertices[(i + 1) % 3]}`;
        return s === null
          ? null
          : s === "?"
            ? `${name} unknown`
            : `${name} = ${s} ${f.unit}`;
      })
      .filter(Boolean)
      .join(", ");
  return `Similar triangles drawn to scale. Triangle ${first!.vertices.join("")}: ${sides(first!)}. Triangle ${second!.vertices.join("")}: ${sides(second!)}. Equal numbers of arcs mark corresponding angles: ${first!.vertices.map((v, i) => `${v} and ${second!.vertices[i]}`).join(", ")}.`;
}

/** Two similar triangles side by side, true shape and true relative size. */
export function SimilarTriangles({
  figure: f,
  className = "figure geometry-figure",
  style,
}: {
  figure: SimilarTrianglesFigure;
  className?: string;
  style?: React.CSSProperties;
}) {
  const k = similarityRatio(f);
  const base = triangleFromSides(f.triangles[0]!.sides as number[]);
  const shapes = [base, base.map((p) => ({ x: p.x * k, y: p.y * k }))];
  const extent = shapes.map((s) => ({
    minX: Math.min(...s.map((p) => p.x)),
    maxX: Math.max(...s.map((p) => p.x)),
    maxY: Math.max(...s.map((p) => p.y)),
  }));
  // The gap keeps the facing vertex labels of the two triangles well apart.
  const gap = 80,
    width = 300 - gap,
    height = 140;
  const totalWidth = extent.reduce((a, e) => a + e.maxX - e.minX, 0);
  const px = Math.min(
    width / totalWidth,
    height / Math.max(...extent.map((e) => e.maxY)),
  );
  const baseline = 176;
  let left = 30;
  const placed = shapes.map((s, t) => {
    const e = extent[t]!;
    const pts = s.map((p) => ({
      x: left + (p.x - e.minX) * px,
      y: baseline - p.y * px,
    }));
    left += (e.maxX - e.minX) * px + gap;
    return pts;
  });
  // Fit the frame to the drawing: flat triangles get no empty band above them.
  const top = Math.min(...placed.flat().map((p) => p.y)) - 34,
    bottom = baseline + 34;
  return (
    <svg
      data-kind={f.kind}
      className={className}
      style={style}
      viewBox={`0 ${top} 360 ${bottom - top}`}
      role="img"
      aria-label={describeSimilarTriangles(f)}
    >
      {placed.map((pts, t) => {
        const tri = f.triangles[t]!;
        const cx = (pts[0]!.x + pts[1]!.x + pts[2]!.x) / 3,
          cy = (pts[0]!.y + pts[1]!.y + pts[2]!.y) / 3;
        const stroke = t === 0 ? accent : warm;
        return (
          <g key={t} data-triangle={tri.vertices.join("")}>
            <polygon
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={t === 0 ? accentFill : warmFill}
              fillOpacity="0.6"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {pts.map((p, i) => {
              const prev = pts[(i + 2) % 3]!,
                next = pts[(i + 1) % 3]!;
              const a1 = Math.atan2(next.y - p.y, next.x - p.x),
                a2 = Math.atan2(prev.y - p.y, prev.x - p.x);
              let sweep = a2 - a1;
              while (sweep < 0) sweep += 2 * Math.PI;
              const flag = sweep > Math.PI ? 0 : 1;
              const shortest = Math.min(
                Math.hypot(next.x - p.x, next.y - p.y),
                Math.hypot(prev.x - p.x, prev.y - p.y),
              );
              const r0 = Math.max(6, Math.min(12, shortest * 0.22));
              const arcs = Array.from({ length: i + 1 }, (_, j) => {
                const r = r0 + j * 3.5;
                const s = {
                    x: p.x + r * Math.cos(a1),
                    y: p.y + r * Math.sin(a1),
                  },
                  e = { x: p.x + r * Math.cos(a2), y: p.y + r * Math.sin(a2) };
                return (
                  <path
                    key={j}
                    d={`M${s.x} ${s.y} A${r} ${r} 0 0 ${flag} ${e.x} ${e.y}`}
                    fill="none"
                    stroke={ink}
                    strokeWidth="1.2"
                  />
                );
              });
              const dx = p.x - cx,
                dy = p.y - cy,
                len = Math.hypot(dx, dy) || 1;
              return (
                <g key={i} data-angle={i + 1}>
                  {arcs}
                  <text
                    x={p.x + (dx / len) * 15}
                    y={p.y + (dy / len) * 15 + 5}
                    textAnchor="middle"
                    style={{
                      ...halo,
                      fontSize: 15,
                      fontWeight: 700,
                      fill: ink,
                    }}
                  >
                    {tri.vertices[i]}
                  </text>
                </g>
              );
            })}
            {tri.sides.map((side, i) => {
              if (side === null) return null;
              const a = pts[i]!,
                b = pts[(i + 1) % 3]!;
              const mx = (a.x + b.x) / 2,
                my = (a.y + b.y) / 2;
              const dx = mx - cx,
                dy = my - cy,
                len = Math.hypot(dx, dy) || 1;
              return (
                <text
                  key={`s${i}`}
                  data-side={`${tri.vertices[i]}${tri.vertices[(i + 1) % 3]}`}
                  data-length={side}
                  x={mx + (dx / len) * 16}
                  y={my + (dy / len) * 16 + 5}
                  textAnchor="middle"
                  style={{ ...halo, fontSize: 14, fill: ink }}
                >
                  {side === "?" ? "?" : `${side} ${f.unit}`}
                </text>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
