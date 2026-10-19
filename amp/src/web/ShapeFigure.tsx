import React from "react";
import {
  bounds,
  facesViewer,
  solidProject,
  SOLID_VIEW,
  type FlatShape,
  type ShapeFigure as Model,
  type ShapeItem,
  type Solid,
} from "../math/shape-figures.js";

const ink = "var(--color-figure-ink)",
  paper = "var(--color-figure-paper)";
/** Pieces of one composite alternate through these fills so seams read. */
export const pieceFills = [
  "var(--color-figure-accent-fill)",
  "var(--color-figure-gold-fill)",
  "var(--color-figure-warm-fill)",
  "var(--color-figure-accent-fill-strong)",
];
type Box = { x: number; y: number; width: number; height: number };
type Transform = {
  unit: number;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
};
const screen = (t: Transform, [x, y]: readonly [number, number]) => ({
  x: t.ox + (x - t.cx) * t.unit,
  y: t.oy - (y - t.cy) * t.unit,
});
const f2 = (n: number) => n.toFixed(2);

/** One flat shape in shape units, drawn through a transform (y up). */
export function FlatPath({
  shape,
  t,
  fill = pieceFills[0]!,
  stroke = ink,
  strokeWidth = 2.5,
  dash,
  className,
  style,
}: {
  shape: FlatShape;
  t: Transform;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth,
    strokeLinejoin: "round" as const,
    strokeDasharray: dash,
    className,
    style,
  };
  if (shape.type === "polygon")
    return (
      <path
        d={`M${shape.points
          .map((p) => {
            const s = screen(t, p);
            return `${f2(s.x)} ${f2(s.y)}`;
          })
          .join(" L")} Z`}
        {...common}
      />
    );
  const c = screen(t, shape.center);
  return (
    <ellipse
      cx={f2(c.x)}
      cy={f2(c.y)}
      rx={f2(shape.radii[0] * t.unit)}
      ry={f2(shape.radii[1] * t.unit)}
      transform={`rotate(${-shape.angle} ${f2(c.x)} ${f2(c.y)})`}
      {...common}
    />
  );
}

/** One scale for every item, so a larger shape looks larger. Each item is
 * centered in its cell below an optional letter. */
export function fitItems(
  groups: readonly (readonly FlatShape[])[],
  cells: readonly Box[],
  pad: number,
  labelSpace: number | readonly number[],
) {
  const space = (i: number) =>
    typeof labelSpace === "number" ? labelSpace : labelSpace[i]!;
  const extents = groups.map((g) => bounds(g));
  const unit = Math.min(
    ...extents.map((b, i) =>
      Math.min(
        (cells[i]!.width - 2 * pad) / Math.max(b.maxX - b.minX, 1e-6),
        (cells[i]!.height - 2 * pad - space(i)) /
          Math.max(b.maxY - b.minY, 1e-6),
      ),
    ),
  );
  return extents.map((b, i): Transform => ({
    unit,
    cx: (b.minX + b.maxX) / 2,
    cy: (b.minY + b.maxY) / 2,
    ox: cells[i]!.x + cells[i]!.width / 2,
    oy: cells[i]!.y + space(i) + (cells[i]!.height - space(i)) / 2,
  }));
}

function Cell({ box, label }: { box: Box; label?: string }) {
  return (
    <g>
      <rect
        x={box.x + 3}
        y={box.y + 3}
        width={box.width - 6}
        height={box.height - 6}
        rx={10}
        fill="none"
        stroke="var(--color-figure-grid)"
        strokeWidth={1.25}
      />
      {label && (
        <text
          x={box.x + 12}
          y={box.y + 25}
          style={{ fontSize: 19, fontWeight: 700, fill: ink }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function Item({ item, t }: { item: ShapeItem; t: Transform }) {
  return (
    <g data-item={item.label ?? "shape"}>
      {item.pieces.map((p, i) => (
        <FlatPath
          key={i}
          shape={p}
          t={t}
          fill={pieceFills[item.pieces.length === 1 ? 0 : i % 3]!}
        />
      ))}
      {item.marks &&
        item.pieces.map((p, i) =>
          p.type === "polygon" ? (
            <PolygonMarks
              key={`m${i}`}
              points={p.points}
              t={t}
              parallel={item.marks === "parallel"}
            />
          ) : null,
        )}
    </g>
  );
}

/** Standard marks measured from the vertices: a small square at each right
 * angle, matching tick marks on sides of equal length, and matching arrows
 * on parallel sides. */
export function PolygonMarks({
  points,
  t,
  parallel,
}: {
  points: readonly (readonly [number, number])[];
  t: Transform;
  parallel: boolean;
}) {
  const n = points.length;
  const S = points.map((p) => screen(t, p));
  const length = (i: number) => {
    const a = points[i]!,
      b = points[(i + 1) % n]!;
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  const dir = (i: number) => {
    const a = S[i]!,
      b = S[(i + 1) % n]!,
      l = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  const paths: string[] = [];
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    paths.push(`M${f2(a.x)} ${f2(a.y)} L${f2(b.x)} ${f2(b.y)}`);
  // Right angles.
  for (let i = 0; i < n; i++) {
    const v = S[i]!,
      a = dir((i + n - 1) % n),
      b = dir(i);
    const back = { x: -a.x, y: -a.y };
    if (Math.abs(back.x * b.x + back.y * b.y) > 1e-3) continue;
    const m = 10;
    paths.push(
      `M${f2(v.x + back.x * m)} ${f2(v.y + back.y * m)} L${f2(v.x + (back.x + b.x) * m)} ${f2(v.y + (back.y + b.y) * m)} L${f2(v.x + b.x * m)} ${f2(v.y + b.y * m)}`,
    );
  }
  // Equal sides: one tick for the first group, two for the second.
  const group: number[] = Array(n).fill(0);
  let groups = 0;
  for (let i = 0; i < n; i++) {
    if (group[i]) continue;
    const same = [...Array(n).keys()].filter(
      (j) => !group[j] && Math.abs(length(j) - length(i)) <= 1e-3 * length(i),
    );
    if (same.length < 2) continue;
    groups++;
    for (const j of same) group[j] = groups;
  }
  for (let i = 0; i < n; i++) {
    if (!group[i]) continue;
    const a = S[i]!,
      b = S[(i + 1) % n]!,
      d = dir(i),
      normal = { x: -d.y, y: d.x };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    for (let k = 0; k < group[i]!; k++) {
      const off = (k - (group[i]! - 1) / 2) * 5;
      const c = { x: mid.x + d.x * off, y: mid.y + d.y * off };
      line(
        { x: c.x - normal.x * 6, y: c.y - normal.y * 6 },
        { x: c.x + normal.x * 6, y: c.y + normal.y * 6 },
      );
    }
  }
  // Parallel sides: arrows that point the same way on both sides of a pair.
  let pairs = 0;
  for (let i = 0; i < (parallel ? n : 0); i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const u = dir(i),
        v = dir(j);
      if (Math.abs(u.x * v.y - u.y * v.x) > 1e-3) continue;
      pairs++;
      for (const side of [i, j]) {
        const a = S[side]!,
          b = S[(side + 1) % n]!,
          d0 = dir(side),
          d = d0.x * u.x + d0.y * u.y > 0 ? d0 : { x: -d0.x, y: -d0.y },
          normal = { x: -d.y, y: d.x };
        const at = {
          x: (a.x + b.x) / 2 + d0.x * 17,
          y: (a.y + b.y) / 2 + d0.y * 17,
        };
        for (let k = 0; k < pairs; k++) {
          const tip = {
            x: at.x + d.x * (3 + k * 5),
            y: at.y + d.y * (3 + k * 5),
          };
          line(
            {
              x: tip.x - d.x * 6 + normal.x * 5,
              y: tip.y - d.y * 6 + normal.y * 5,
            },
            tip,
          );
          line(
            {
              x: tip.x - d.x * 6 - normal.x * 5,
              y: tip.y - d.y * 6 - normal.y * 5,
            },
            tip,
          );
        }
      }
    }
  return (
    <path
      data-marks="sides-angles"
      d={paths.join(" ")}
      fill="none"
      stroke={ink}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function grid(count: number): { width: number; height: number; cells: Box[] } {
  if (count === 1)
    return {
      width: 320,
      height: 230,
      cells: [{ x: 0, y: 0, width: 320, height: 230 }],
    };
  if (count === 4)
    return {
      width: 320,
      height: 300,
      cells: [0, 1, 2, 3].map((i) => ({
        x: (i % 2) * 160,
        y: Math.floor(i / 2) * 150,
        width: 160,
        height: 150,
      })),
    };
  const w = count === 2 ? 160 : 120;
  return {
    width: w * count,
    height: 180,
    cells: Array.from({ length: count }, (_, i) => ({
      x: i * w,
      y: 0,
      width: w,
      height: 180,
    })),
  };
}

const kindWord = (s: FlatShape) =>
  s.type === "ellipse"
    ? "a round shape"
    : `a closed shape with ${s.points.length} straight sides`;

export function ShapeFigure({ figure }: { figure: Model }) {
  switch (figure.kind) {
    case "plane-shapes": {
      const { width, height, cells } = grid(figure.items.length);
      const labelled = figure.items.some((i) => i.label);
      const ts = fitItems(
        figure.items.map((i) => i.pieces),
        cells,
        16,
        labelled ? 22 : 0,
      );
      const single = figure.items.length === 1;
      const aria = single
        ? figure.items[0]!.pieces.length === 1
          ? `A flat shape: ${kindWord(figure.items[0]!.pieces[0]!)}.`
          : `${figure.items[0]!.pieces.length} flat pieces fitted together edge to edge with no gaps.`
        : `${figure.items.length} flat shapes${labelled ? `, labeled ${figure.items.map((i) => i.label).join(", ")}` : ""}, drawn at the same scale.`;
      return (
        <svg
          className="figure shape-figure"
          data-kind={figure.kind}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={aria}
        >
          {!single &&
            cells.map((c, i) => (
              <Cell key={i} box={c} label={figure.items[i]!.label} />
            ))}
          {figure.items.map((item, i) => (
            <Item key={i} item={item} t={ts[i]!} />
          ))}
        </svg>
      );
    }
    case "shape-puzzle": {
      // The target spans the top; candidates share one row at the same scale.
      const count = figure.candidates.length;
      const target: Box = { x: 0, y: 0, width: 330, height: 140 };
      const cells: Box[] = figure.candidates.map((_, i) => ({
        x: (330 / count) * i,
        y: 140,
        width: 330 / count,
        height: 130,
      }));
      const outline: FlatShape = { type: "polygon", points: figure.outline };
      const [tt, ...ct] = fitItems(
        [[outline], ...figure.candidates.map((c) => c.pieces)],
        [target, ...cells],
        12,
        [0, ...cells.map(() => 20)],
      );
      // The candidates use the same scale; their letters sit in a corner.
      return (
        <svg
          className="figure shape-figure"
          data-kind={figure.kind}
          viewBox="0 0 330 270"
          role="img"
          aria-label={`A larger shape outlined with a dashed line, filled by ${figure.placed.length} ${figure.placed.length === 1 ? "piece" : "pieces"} except for one empty space. ${figure.candidates.length} loose pieces, labeled ${figure.candidates.map((c) => c.label).join(", ")}, are drawn at the same scale.`}
        >
          <FlatPath
            shape={outline}
            t={tt!}
            fill={paper}
            stroke={ink}
            strokeWidth={2}
            dash="7 5"
          />
          {figure.placed.map((p, i) => (
            <FlatPath key={i} shape={p} t={tt!} fill={pieceFills[0]!} />
          ))}
          {figure.candidates.map((c, i) => (
            <g key={c.label}>
              <Cell box={cells[i]!} label={c.label} />
              <Item item={c} t={ct[i]!} />
            </g>
          ))}
        </svg>
      );
    }
    case "solid-shape":
      return <SolidFigure solid={figure.solid} />;
  }
}

type P3 = [number, number, number];
/** Faces facing the viewer are filled; hidden edges are dashed on top. */
export function SolidFigure({
  solid,
  width = 320,
  height = 240,
  at,
  overlay,
}: {
  solid: Solid;
  width?: number;
  height?: number;
  /** Draw inside a larger drawing at this offset instead of as a figure. */
  at?: { x: number; y: number };
  /** Annotations placed with the solid's own projection (world x, y, z). */
  overlay?: (
    point: (x: number, y: number, z: number) => { x: number; y: number },
  ) => React.ReactNode;
}) {
  const parts = solidParts(solid);
  const all = parts.extent;
  const minX = Math.min(...all.map((p) => p.x)),
    maxX = Math.max(...all.map((p) => p.x)),
    minY = Math.min(...all.map((p) => p.y)),
    maxY = Math.max(...all.map((p) => p.y));
  const unit = Math.min(
    (width - 2 * Math.min(24, width * 0.1)) / (maxX - minX),
    (height - 2 * Math.min(20, height * 0.1)) / (maxY - minY),
  );
  const ox = width / 2 - ((minX + maxX) / 2) * unit,
    oy = height / 2 - ((minY + maxY) / 2) * unit;
  const s = (p: { x: number; y: number }) =>
    `${f2(ox + p.x * unit)} ${f2(oy + p.y * unit)}`;
  const point = (x: number, y: number, z: number) => {
    const p = solidProject(x, y, z);
    return { x: ox + p.x * unit, y: oy + p.y * unit };
  };
  const body = (
    <>
      {parts.draw({ s, unit, ox, oy })}
      {overlay?.(point)}
    </>
  );
  if (at) return <g transform={`translate(${at.x} ${at.y})`}>{body}</g>;
  return (
    <svg
      className="figure shape-figure"
      data-kind="solid-shape"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={parts.aria}
    >
      {body}
    </svg>
  );
}

type Draw = (v: {
  s: (p: { x: number; y: number }) => string;
  unit: number;
  ox: number;
  oy: number;
}) => React.ReactNode;
const hidden = {
  fill: "none",
  stroke: ink,
  strokeWidth: 1.6,
  strokeDasharray: "6 5",
  strokeOpacity: 0.6,
};
const visible = {
  fill: "none",
  stroke: ink,
  strokeWidth: 2.5,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

function solidParts(solid: Solid): {
  extent: { x: number; y: number }[];
  aria: string;
  draw: Draw;
} {
  const P = (p: P3) => solidProject(p[0], p[1], p[2]);
  const sinE = Math.sin(SOLID_VIEW.elevation),
    cosE = Math.cos(SOLID_VIEW.elevation);
  if (solid.type === "sphere") {
    const r = solid.radius;
    return {
      extent: [
        { x: -r, y: -r },
        { x: r, y: r },
      ],
      aria: "A solid round shape, the same distance across in every direction.",
      draw: ({ s, unit, ox, oy }) => {
        const ry = r * sinE * unit,
          rx = r * unit;
        return (
          <g>
            <circle
              cx={ox}
              cy={oy}
              r={rx}
              fill="var(--color-figure-accent-fill)"
              stroke={ink}
              strokeWidth={2.5}
            />
            <path
              d={`M${s({ x: -r, y: 0 })} A${f2(rx)} ${f2(ry)} 0 0 1 ${s({ x: r, y: 0 })}`}
              {...hidden}
            />
            <path
              d={`M${s({ x: -r, y: 0 })} A${f2(rx)} ${f2(ry)} 0 0 0 ${s({ x: r, y: 0 })}`}
              {...visible}
              strokeWidth={1.8}
            />
          </g>
        );
      },
    };
  }
  const h = solid.height;
  if (solid.base.type === "ellipse") {
    const [cx, cy] = solid.base.center,
      r = solid.base.radii[0];
    const base = P([cx, cy, 0]),
      top = P([cx, cy, h]);
    const ry = r * sinE;
    const cone = solid.type === "pyramid";
    const extent = [
      { x: base.x - r, y: base.y + ry },
      { x: base.x + r, y: base.y - ry },
      { x: top.x - (cone ? 0 : r), y: top.y - (cone ? 0 : ry) },
      { x: top.x + (cone ? 0 : r), y: top.y + (cone ? 0 : ry) },
    ];
    if (!cone)
      return {
        extent,
        aria: "A solid with two flat circular ends joined by a curved surface, standing on one end.",
        draw: ({ s, unit }) => {
          const a = `${f2(r * unit)} ${f2(ry * unit)}`;
          const L = (p: { x: number; y: number }, dx: number) =>
            s({ x: p.x + dx, y: p.y });
          return (
            <g>
              <path
                d={`M${L(top, -r)} L${L(base, -r)} A${a} 0 0 0 ${L(base, r)} L${L(top, r)} Z`}
                fill="var(--color-figure-accent-fill)"
              />
              <path
                d={`M${L(top, -r)} A${a} 0 1 0 ${L(top, r)} A${a} 0 1 0 ${L(top, -r)} Z`}
                fill="var(--color-figure-accent-fill-strong)"
                {...{ stroke: ink, strokeWidth: 2.5 }}
              />
              <path
                d={`M${L(base, -r)} A${a} 0 0 1 ${L(base, r)}`}
                {...hidden}
              />
              <path
                d={`M${L(top, -r)} L${L(base, -r)} A${a} 0 0 0 ${L(base, r)} L${L(top, r)}`}
                {...visible}
              />
            </g>
          );
        },
      };
    // Tangent lines from the apex touch the base ellipse slightly behind its
    // center; the front arc between them is visible.
    const H = h * cosE;
    const ty = -(ry * ry) / H,
      tx = r * Math.sqrt(1 - (ry * ry) / (H * H));
    return {
      extent,
      aria: "A solid with a flat circular base, a curved surface and one point at the top.",
      draw: ({ s, unit }) => {
        const a = `${f2(r * unit)} ${f2(ry * unit)}`;
        const left = s({ x: base.x - tx, y: base.y + ty }),
          right = s({ x: base.x + tx, y: base.y + ty });
        return (
          <g>
            <path
              d={`M${s(top)} L${left} A${a} 0 1 0 ${right} Z`}
              fill="var(--color-figure-accent-fill)"
            />
            <path d={`M${left} A${a} 0 0 1 ${right}`} {...hidden} />
            <path
              d={`M${s(top)} L${left} A${a} 0 1 0 ${right} Z`}
              {...visible}
            />
          </g>
        );
      },
    };
  }
  const base = solid.base.points as [number, number][];
  // Counterclockwise from above, so side normals point outward.
  const ccw =
    base.reduce(
      (a, p, i) =>
        a +
        p[0] * base[(i + 1) % base.length]![1] -
        base[(i + 1) % base.length]![0] * p[1],
      0,
    ) > 0
      ? base
      : [...base].reverse();
  const n = ccw.length;
  const bottom = ccw.map(([x, y]) => [x, y, 0] as P3);
  const apex: P3 = [
    ccw.reduce((a, p) => a + p[0], 0) / n,
    ccw.reduce((a, p) => a + p[1], 0) / n,
    h,
  ];
  const topRing = ccw.map(([x, y]) => [x, y, h] as P3);
  type Face = { points: P3[]; normal: P3; fill: string };
  const cross = (a: P3, b: P3): P3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const faces: Face[] = [];
  const edges: { a: P3; b: P3; faces: number[] }[] = [];
  const edge = (a: P3, b: P3, f: number) => {
    const found = edges.find(
      (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
    );
    if (found) found.faces.push(f);
    else edges.push({ a, b, faces: [f] });
  };
  const sideFill = (normal: P3) =>
    normal[0] < -1e-9
      ? "var(--color-figure-accent-fill)"
      : "var(--color-figure-empty)";
  faces.push({
    points: [...bottom].reverse(),
    normal: [0, 0, -1],
    fill: "none",
  });
  bottom.forEach((p, i) => edge(p, bottom[(i + 1) % n]!, 0));
  if (solid.type === "prism") {
    faces.push({
      points: topRing,
      normal: [0, 0, 1],
      fill: "var(--color-figure-accent-fill-strong)",
    });
    topRing.forEach((p, i) => edge(p, topRing[(i + 1) % n]!, 1));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const normal = cross(sub(bottom[j]!, bottom[i]!), [0, 0, 1]);
      const f = faces.length;
      faces.push({
        points: [bottom[i]!, bottom[j]!, topRing[j]!, topRing[i]!],
        normal,
        fill: sideFill(normal),
      });
      edge(bottom[i]!, bottom[j]!, f);
      edge(topRing[i]!, topRing[j]!, f);
      edge(bottom[i]!, topRing[i]!, f);
      edge(bottom[j]!, topRing[j]!, f);
    }
  } else
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const normal = cross(sub(bottom[j]!, bottom[i]!), sub(apex, bottom[i]!));
      const f = faces.length;
      faces.push({
        points: [bottom[i]!, bottom[j]!, apex],
        normal,
        fill: sideFill(normal),
      });
      edge(bottom[i]!, bottom[j]!, f);
      edge(bottom[i]!, apex, f);
      edge(bottom[j]!, apex, f);
    }
  const shown = faces.map((f) => facesViewer(f.normal));
  const kind =
    solid.type === "prism"
      ? `A solid with ${n + 2} flat faces: two ${n}-sided ends and ${n} rectangular sides.`
      : `A solid with a ${n}-sided base and ${n} triangular faces meeting at a point.`;
  return {
    extent: [...bottom, ...(solid.type === "prism" ? topRing : [apex])].map(P),
    aria: `${kind} Hidden edges are dashed.`,
    draw: ({ s }) => {
      const path = (pts: P3[]) => `M${pts.map((p) => s(P(p))).join(" L")}`;
      return (
        <g>
          {faces.map((f, i) =>
            shown[i] ? (
              <path key={i} d={`${path(f.points)} Z`} fill={f.fill} />
            ) : null,
          )}
          <path
            d={edges
              .filter((e) => !e.faces.some((f) => shown[f]))
              .map((e) => path([e.a, e.b]))
              .join(" ")}
            {...hidden}
          />
          <path
            d={edges
              .filter((e) => e.faces.some((f) => shown[f]))
              .map((e) => path([e.a, e.b]))
              .join(" ")}
            {...visible}
          />
        </g>
      );
    },
  };
}
