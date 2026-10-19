import type {
  AreaVolumeFigure as Model,
  FigureFraction,
} from "../math/area-volume-figures";
import {
  lengthText,
  netBounds,
  netFaces,
  withUnit,
  type NetFace,
} from "./area-volume-geometry";

/** Role colors with print fallbacks; print pages carry no theme variables. */
export const avColor = {
  ink: "var(--color-figure-ink, #174a43)",
  line: "var(--color-figure-accent, #20776d)",
  fill: "var(--color-figure-accent-fill, #d4e9e1)",
  fillStrong: "var(--color-figure-accent-fill-strong, #c5ded6)",
  paper: "var(--color-figure-empty, #f6f2e8)",
  warm: "var(--color-figure-warm, #9c4420)",
  warmFill: "var(--color-figure-warm-fill, #f2d5c3)",
  gold: "var(--color-figure-gold, #9a5c12)",
  goldFill: "var(--color-figure-gold-fill, #fae2b9)",
  guide: "var(--color-figure-axis, #6f8a7d)",
};
const text = {
  fontFamily: "Arial, sans-serif",
  fontSize: 19,
  fill: avColor.ink,
} as const;
const heightText = { ...text, fill: avColor.warm, fontWeight: 700 } as const;
const W = 360;
type Pt = [number, number];
const n = (v: number) => Math.round(v * 100) / 100;
const path = (pts: Pt[], close = true) =>
  `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L")}${close ? " Z" : ""}`;

export function AreaVolumeFigure({ figure }: { figure: Model }) {
  switch (figure.kind) {
    case "measured-polygon":
      return <Polygon figure={figure} />;
    case "rectangular-prism-net":
    case "triangular-prism-net":
    case "square-pyramid-net":
      return <Net figure={figure} />;
    case "fraction-box-prism":
      return <Box figure={figure} />;
    case "extruded-polygon":
      return <Extruded figure={figure} />;
    case "curved-solid":
      return <CurvedSolid figure={figure} />;
  }
}

/** A label beside a segment, pushed along the unit normal (nx, ny) in screen space. */
function EdgeLabel({
  a,
  b,
  nx,
  ny,
  label,
  style = text,
  gap = 9,
}: {
  a: Pt;
  b: Pt;
  nx: number;
  ny: number;
  label: string;
  style?: React.CSSProperties;
  gap?: number;
}) {
  const x = (a[0] + b[0]) / 2 + nx * gap,
    y = (a[1] + b[1]) / 2 + ny * gap;
  return (
    <text
      x={n(x)}
      y={n(y + (ny > 0.4 ? 15 : ny < -0.4 ? -2 : 6))}
      textAnchor={nx > 0.4 ? "start" : nx < -0.4 ? "end" : "middle"}
      style={style}
    >
      {label}
    </text>
  );
}
function RightMark({
  at,
  u,
  v,
  size = 11,
}: {
  at: Pt;
  u: Pt;
  v: Pt;
  size?: number;
}) {
  const p1: Pt = [at[0] + u[0] * size, at[1] + u[1] * size],
    p2: Pt = [p1[0] + v[0] * size, p1[1] + v[1] * size],
    p3: Pt = [at[0] + v[0] * size, at[1] + v[1] * size];
  return (
    <path
      d={path([p1, p2, p3], false)}
      fill="none"
      stroke={avColor.ink}
      strokeWidth={1.5}
    />
  );
}
const unit = (a: Pt, b: Pt): Pt => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};
const shapeName = (k: number) =>
  [
    "",
    "",
    "",
    "Triangle",
    "Quadrilateral",
    "Pentagon",
    "Hexagon",
    "Heptagon",
    "Octagon",
  ][k] ?? `Polygon with ${k} sides`;

/** Fit points (y up) into the view: returns a mapper and the view height. */
function fit(points: Pt[], margin: [number, number], maxH = 200) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const s = Math.min(
    (W - 2 * margin[0]) / (maxX - minX || 1),
    maxH / (maxY - minY || 1),
  );
  const ox = (W - (maxX - minX) * s) / 2;
  const map = (p: readonly number[]): Pt => [
    ox + (p[0]! - minX) * s,
    margin[1] + (maxY - p[1]!) * s,
  ];
  return { map, s, height: (maxY - minY) * s + 2 * margin[1] };
}

function Polygon({
  figure: f,
}: {
  figure: Extract<Model, { kind: "measured-polygon" }>;
}) {
  const all: Pt[] = [
    ...f.vertices,
    ...f.heights.flatMap((h) => [h.from, h.to]),
    ...f.guides.flatMap((g) => [g.from, g.to]),
  ] as Pt[];
  const { map, height } = fit(all, [62, 34]);
  const pts = f.vertices.map(map);
  const labels = f.sides.flatMap((v, i) => {
    if (v === null) return [];
    const a = pts[i]!,
      b = pts[(i + 1) % pts.length]!;
    // Counterclockwise in y-up coordinates is clockwise on screen, so the
    // outward normal of edge direction (ux, uy) is (−uy, ux).
    const [ux, uy] = unit(a, b);
    return [
      <EdgeLabel
        key={`s${i}`}
        a={a}
        b={b}
        nx={-uy}
        ny={ux}
        label={withUnit(v, f.unit)}
      />,
    ];
  });
  const centroid: Pt = [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
  const description = `${shapeName(f.vertices.length)} drawn to scale. ${
    f.sides.some((v) => v !== null)
      ? `Labeled sides: ${f.sides
          .filter((v): v is number => v !== null)
          .map((v) => withUnit(v, f.unit))
          .join(", ")}.`
      : ""
  }${f.sides.some((v) => v === null) && f.sides.some((v) => v !== null) ? ` ${f.sides.filter((v) => v === null).length} unlabeled ${f.sides.filter((v) => v === null).length === 1 ? "side" : "sides"}.` : ""}${f.heights
    .map(
      (h) =>
        ` A dashed height of ${withUnit(h.value, f.unit)} meets ${h.to[1] === 0 && f.guides.length ? "the extended base" : "the opposite side"} at a right angle.`,
    )
    .join(
      "",
    )}${f.rightAngles.length ? ` ${f.rightAngles.length === 1 ? "One corner is a right angle" : `${f.rightAngles.length} corners are right angles`}.` : ""}`;
  return (
    <svg
      className="figure area-volume-figure"
      data-kind={f.kind}
      viewBox={`0 0 ${W} ${n(height)}`}
      role="img"
      aria-label={description}
    >
      {f.guides.map((g, i) => {
        const [a, b] = [map(g.from), map(g.to)];
        return (
          <line
            key={`g${i}`}
            x1={n(a[0])}
            y1={n(a[1])}
            x2={n(b[0])}
            y2={n(b[1])}
            stroke={avColor.guide}
            strokeWidth={1.75}
            strokeDasharray="6 5"
          />
        );
      })}
      <path
        d={path(pts)}
        fill={avColor.fill}
        stroke={avColor.line}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {f.rightAngles.map((i) => {
        const at = pts[i]!;
        return (
          <RightMark
            key={`r${i}`}
            at={at}
            u={unit(at, pts[(i + 1) % pts.length]!)}
            v={unit(at, pts[(i + pts.length - 1) % pts.length]!)}
          />
        );
      })}
      {f.heights.map((h, i) => {
        const [top, foot] = [map(h.from), map(h.to)];
        const up = unit(foot, top);
        // The mark faces the shape. The label sits inside the shape beside an
        // inner height, and away from the shape beside an outer one.
        const side: Pt = centroid[0] >= foot[0] ? [1, 0] : [-1, 0];
        const across: Pt = Math.abs(up[1]) > 0.9 ? side : [-up[1], up[0]];
        const outer = f.guides.some(
          (g) => g.from[0] === h.to[0] && g.from[1] === h.to[1],
        );
        const toward = outer ? -1 : 1;
        return (
          <g key={`h${i}`}>
            <line
              x1={n(top[0])}
              y1={n(top[1])}
              x2={n(foot[0])}
              y2={n(foot[1])}
              stroke={avColor.warm}
              strokeWidth={2.25}
              strokeDasharray="7 5"
            />
            <RightMark at={foot} u={up} v={across} />
            <EdgeLabel
              a={top}
              b={foot}
              nx={toward * across[0]}
              ny={toward * across[1]}
              gap={7}
              label={withUnit(h.value, f.unit)}
              style={heightText}
            />
          </g>
        );
      })}
      {labels}
    </svg>
  );
}

const roleFill: Record<NetFace["role"], string> = {
  "pair-a": avColor.fill,
  "pair-b": avColor.goldFill,
  "pair-c": avColor.warmFill,
  base: avColor.goldFill,
  lateral: avColor.fill,
  end: avColor.goldFill,
};
function Net({
  figure: f,
}: {
  figure: Extract<
    Model,
    {
      kind:
        "rectangular-prism-net" | "triangular-prism-net" | "square-pyramid-net";
    }
  >;
}) {
  const faces = netFaces(f);
  const b = netBounds(faces);
  const s = Math.min((W - 110) / (b.maxX - b.minX), 250 / (b.maxY - b.minY));
  const ox = (W - (b.maxX - b.minX) * s) / 2,
    oy = 30;
  const map = (p: readonly number[]): Pt => [
    ox + (p[0]! - b.minX) * s,
    oy + (p[1]! - b.minY) * s,
  ];
  const height = (b.maxY - b.minY) * s + 2 * oy;
  const face = (id: string) => faces.find((x) => x.id === id)!.points.map(map);
  const labels: React.ReactNode[] = [];
  const u = f.unit;
  let description: string;
  if (f.kind === "rectangular-prism-net") {
    const back = face("back"),
      left = face("left");
    labels.push(
      <EdgeLabel
        key="l"
        a={back[0]!}
        b={back[1]!}
        nx={0}
        ny={-1}
        label={withUnit(f.length, u)}
      />,
      <EdgeLabel
        key="w"
        a={left[0]!}
        b={left[3]!}
        nx={-1}
        ny={0}
        label={withUnit(f.width, u)}
      />,
      <EdgeLabel
        key="h"
        a={left[3]!}
        b={left[2]!}
        nx={0}
        ny={1}
        label={withUnit(f.height, u)}
      />,
    );
    description = `Net of a rectangular prism: six rectangles in three matching pairs, ${withUnit(f.length, u)} by ${withUnit(f.width, u)}, ${withUnit(f.length, u)} by ${withUnit(f.height, u)}, and ${withUnit(f.width, u)} by ${withUnit(f.height, u)}. Dashed lines are folds.`;
  } else if (f.kind === "triangular-prism-net") {
    const left = face("left"),
      right = face("right"),
      middle = face("middle"),
      tri = face("end-top");
    const foot: Pt = [tri[2]![0], tri[0]![1]];
    labels.push(
      <EdgeLabel
        key="s0"
        a={left[3]!}
        b={left[2]!}
        nx={0}
        ny={1}
        label={withUnit(f.sides[0], u)}
      />,
      <EdgeLabel
        key="s1"
        a={right[3]!}
        b={right[2]!}
        nx={0}
        ny={1}
        label={withUnit(f.sides[1], u)}
      />,
      <EdgeLabel
        key="L"
        a={left[0]!}
        b={left[3]!}
        nx={-1}
        ny={0}
        label={withUnit(f.length, u)}
      />,
      <EdgeLabel
        key="b"
        a={middle[0]!}
        b={middle[1]!}
        nx={0}
        ny={1}
        gap={6}
        label={withUnit(f.base, u)}
      />,
      <g key="t">
        <line
          x1={n(tri[2]![0])}
          y1={n(tri[2]![1])}
          x2={n(foot[0])}
          y2={n(foot[1])}
          stroke={avColor.warm}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <RightMark
          at={foot}
          u={[0, -1]}
          v={[tri[2]![0] > (tri[0]![0] + tri[1]![0]) / 2 ? -1 : 1, 0]}
          size={8}
        />
        {/* Beside the triangle, clear of its slanted sides. */}
        {tri[2]![0] > (tri[0]![0] + tri[1]![0]) / 2 ? (
          <text
            x={n(tri[0]![0] - 6)}
            y={n((tri[2]![1] + foot[1]) / 2 + 6)}
            textAnchor="end"
            style={heightText}
          >
            {withUnit(f.height, u)}
          </text>
        ) : (
          <text
            x={n(tri[1]![0] + 6)}
            y={n((tri[2]![1] + foot[1]) / 2 + 6)}
            textAnchor="start"
            style={heightText}
          >
            {withUnit(f.height, u)}
          </text>
        )}
      </g>,
    );
    description = `Net of a triangular prism: three rectangles ${withUnit(f.length, u)} long and ${withUnit(f.sides[0], u)}, ${withUnit(f.base, u)} and ${withUnit(f.sides[1], u)} wide, with a triangle on each end of the middle rectangle. Each triangle has base ${withUnit(f.base, u)} and dashed height ${withUnit(f.height, u)}. Dashed lines between faces are folds.`;
  } else {
    const base = face("base"),
      north = face("north");
    const foot: Pt = [north[2]![0], north[0]![1]];
    labels.push(
      <EdgeLabel
        key="s"
        a={base[3]!}
        b={base[2]!}
        nx={0}
        ny={-1}
        gap={8}
        label={withUnit(f.side, u)}
      />,
      <g key="t">
        <line
          x1={n(north[2]![0])}
          y1={n(north[2]![1])}
          x2={n(foot[0])}
          y2={n(foot[1])}
          stroke={avColor.warm}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <RightMark at={foot} u={[0, -1]} v={[1, 0]} size={8} />
        <text
          x={n(north[0]![0] - 6)}
          y={n((north[2]![1] + foot[1]) / 2 + 6)}
          textAnchor="end"
          style={heightText}
        >
          {withUnit(f.slant, u)}
        </text>
      </g>,
    );
    description = `Net of a square pyramid: a square base with side ${withUnit(f.side, u)} and four matching triangles, each with base ${withUnit(f.side, u)} and dashed height ${withUnit(f.slant, u)}. Dashed lines are folds.`;
  }
  // Folds are the hinge edges; the outline is every edge that is not shared.
  return (
    <svg
      className="figure area-volume-figure"
      data-kind={f.kind}
      viewBox={`0 0 ${W} ${n(height)}`}
      role="img"
      aria-label={description}
    >
      {faces.map((x) => (
        <path
          key={x.id}
          d={path(x.points.map(map))}
          fill={roleFill[x.role]}
          stroke={avColor.line}
          strokeWidth={2.25}
          strokeLinejoin="round"
        />
      ))}
      {faces.flatMap((x) =>
        x.hinge
          ? [
              <line
                key={`f${x.id}`}
                x1={n(map(x.hinge[0])[0])}
                y1={n(map(x.hinge[0])[1])}
                x2={n(map(x.hinge[1])[0])}
                y2={n(map(x.hinge[1])[1])}
                stroke={avColor.paper}
                strokeWidth={2.5}
              />,
              <line
                key={`d${x.id}`}
                x1={n(map(x.hinge[0])[0])}
                y1={n(map(x.hinge[0])[1])}
                x2={n(map(x.hinge[1])[0])}
                y2={n(map(x.hinge[1])[1])}
                stroke={avColor.line}
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />,
            ]
          : [],
      )}
      {labels}
    </svg>
  );
}

/** Cabinet oblique projection: depth recedes up and to the right at half scale. */
const DEPTH = 0.5,
  ANGLE = (35 * Math.PI) / 180;
function oblique(s: number, ox: number, oy: number) {
  return (x: number, y: number, z: number): Pt => [
    ox + (x + z * DEPTH * Math.cos(ANGLE)) * s,
    oy - (y + z * DEPTH * Math.sin(ANGLE)) * s,
  ];
}
const value = (f: FigureFraction | null) => (f ? f.n / f.d : null);
function Box({ figure: f }: { figure: Extract<Model, { kind: "fraction-box-prism" }> }) {
  // A missing edge is drawn at the length its volume implies only in the
  // problem's own numbers; here it is drawn at a neutral size and labeled "?".
  const known = [value(f.length), value(f.width), value(f.height)].filter(
    (v): v is number => v !== null,
  );
  const fallback = known.reduce((a, b) => a + b, 0) / known.length;
  const L = value(f.length) ?? fallback,
    D = value(f.width) ?? fallback,
    H = value(f.height) ?? fallback;
  const spanX = L + D * DEPTH * Math.cos(ANGLE),
    spanY = H + D * DEPTH * Math.sin(ANGLE);
  const s = Math.min((W - 150) / spanX, 190 / spanY);
  const ox = (W - spanX * s) / 2 - 10,
    oy = 26 + spanY * s;
  const P = oblique(s, ox, oy);
  const front: Pt[] = [P(0, 0, 0), P(L, 0, 0), P(L, H, 0), P(0, H, 0)];
  const top: Pt[] = [P(0, H, 0), P(L, H, 0), P(L, H, D), P(0, H, D)];
  const side: Pt[] = [P(L, 0, 0), P(L, 0, D), P(L, H, D), P(L, H, 0)];
  const grid: React.ReactNode[] = [];
  if (f.cubeEdge) {
    const e = f.cubeEdge.n / f.cubeEdge.d;
    const lines = (count: number, at: (k: number) => [Pt, Pt], key: string) => {
      for (let k = 1; k < count; k++) {
        const [a, b] = at(k * e);
        grid.push(
          <line
            key={`${key}${k}`}
            x1={n(a[0])}
            y1={n(a[1])}
            x2={n(b[0])}
            y2={n(b[1])}
            stroke={avColor.line}
            strokeWidth={1}
            opacity={0.75}
          />,
        );
      }
    };
    const [cl, cd, ch] = [
      Math.round(L / e),
      Math.round(D / e),
      Math.round(H / e),
    ];
    lines(cl, (x) => [P(x, 0, 0), P(x, H, 0)], "fx");
    lines(ch, (y) => [P(0, y, 0), P(L, y, 0)], "fy");
    lines(cl, (x) => [P(x, H, 0), P(x, H, D)], "tx");
    lines(cd, (z) => [P(0, H, z), P(L, H, z)], "tz");
    lines(cd, (z) => [P(L, 0, z), P(L, H, z)], "sz");
    lines(ch, (y) => [P(L, y, 0), P(L, y, D)], "sy");
  }
  const hidden: [Pt, Pt][] = [
    [P(0, 0, D), P(L, 0, D)],
    [P(0, 0, D), P(0, H, D)],
    [P(0, 0, D), P(0, 0, 0)],
  ];
  const u = f.unit;
  const description = `Rectangular prism drawn to scale${f.cubeEdge ? `, packed with cubes whose edges are ${withUnit(f.cubeEdge, u)}` : ""}. Length ${withUnit(f.length, u)}, width ${withUnit(f.width, u)}, height ${withUnit(f.height, u)}.${[f.length, f.width, f.height].includes(null) ? " The edge marked ? is unknown." : ""}`;
  const slant: Pt = [Math.cos(ANGLE), -Math.sin(ANGLE)];
  return (
    <svg
      className="figure area-volume-figure"
      data-kind={f.kind}
      viewBox={`0 0 ${W} ${n(oy + 40)}`}
      role="img"
      aria-label={description}
    >
      {hidden.map(([a, b], i) => (
        <line
          key={`h${i}`}
          x1={n(a[0])}
          y1={n(a[1])}
          x2={n(b[0])}
          y2={n(b[1])}
          stroke={avColor.guide}
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
      ))}
      <path d={path(top)} fill={avColor.paper} stroke="none" />
      <path d={path(side)} fill={avColor.fillStrong} stroke="none" />
      <path d={path(front)} fill={avColor.fill} stroke="none" />
      {grid}
      {[top, side, front].map((face, i) => (
        <path
          key={`o${i}`}
          d={path(face)}
          fill="none"
          stroke={avColor.line}
          strokeWidth={2.25}
          strokeLinejoin="round"
        />
      ))}
      <EdgeLabel
        a={front[0]!}
        b={front[1]!}
        nx={0}
        ny={1}
        label={withUnit(f.length, u)}
      />
      <EdgeLabel
        a={front[0]!}
        b={front[3]!}
        nx={-1}
        ny={0}
        label={withUnit(f.height, u)}
      />
      <EdgeLabel
        a={side[0]!}
        b={side[1]!}
        nx={slant[1] * -1}
        ny={slant[0]}
        gap={10}
        label={withUnit(f.width, u)}
      />
    </svg>
  );
}

function Extruded({
  figure: f,
}: {
  figure: Extract<Model, { kind: "extruded-polygon" }>;
}) {
  const xs = f.face.map((p) => p[0]),
    ys = f.face.map((p) => p[1]);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const w = Math.max(...xs) - minX,
    h = Math.max(...ys) - minY;
  const spanX = w + f.depth * DEPTH * Math.cos(ANGLE),
    spanY = h + f.depth * DEPTH * Math.sin(ANGLE);
  const s = Math.min((W - 130) / spanX, 200 / spanY);
  const ox = (W - spanX * s) / 2,
    oy = 30 + spanY * s;
  const P0 = oblique(s, ox, oy);
  const P = (x: number, y: number, z: number) => P0(x - minX, y - minY, z);
  const k = f.face.length;
  const edges = f.face.map((p, i) => [p, f.face[(i + 1) % k]!] as const);
  // Visible side faces point up (+y) or right (+x); draw far ones first.
  const lateral = edges
    .map(([a, b], i) => ({ a, b, i, up: b[0] < a[0], right: b[1] > a[1] }))
    .filter((e) => e.up || e.right)
    .sort((p, q) =>
      p.right !== q.right
        ? p.right
          ? -1
          : 1
        : p.right
          ? p.a[0] - q.a[0]
          : p.a[1] - q.a[1],
    );
  const front = f.face.map(([x, y]) => P(x, y, 0));
  const labels = edges.flatMap(([a, b], i) => {
    const v = f.sides[i];
    if (v === undefined || v === null) return [];
    // Edges facing up or right are hidden behind their side faces, so their
    // labels sit beside the matching back edge instead.
    const back = b[0] < a[0] || b[1] > a[1] ? f.depth : 0;
    const [A, B] = [P(a[0], a[1], back), P(b[0], b[1], back)];
    const [ux, uy] = unit(A, B);
    return [
      <EdgeLabel
        key={`s${i}`}
        a={A}
        b={B}
        nx={-uy}
        ny={ux}
        gap={9}
        label={withUnit(v, f.unit)}
      />,
    ];
  });
  // The depth is labeled on the receding edge at the lowest right corner.
  const corner = f.face.reduce((best, p) =>
    p[0] > best[0] || (p[0] === best[0] && p[1] < best[1]) ? p : best,
  );
  const d0 = P(corner[0], corner[1], 0),
    d1 = P(corner[0], corner[1], f.depth);
  const description = `Right prism drawn to scale. Its front face is a polygon with ${k} sides and right-angle corners${
    f.sides.some((v) => v !== null)
      ? `; labeled edges ${f.sides
          .filter((v): v is number => v !== null)
          .map((v) => withUnit(v, f.unit))
          .join(", ")}`
      : ""
  }${f.sides.some((v) => v === null) ? `, with ${f.sides.filter((v) => v === null).length} unlabeled` : ""}. Depth ${withUnit(f.depth, f.unit)}.`;
  return (
    <svg
      className="figure area-volume-figure"
      data-kind={f.kind}
      viewBox={`0 0 ${W} ${n(oy + 40)}`}
      role="img"
      aria-label={description}
    >
      {lateral.map(({ a, b, i, right }) => (
        <path
          key={`l${i}`}
          d={path([
            P(a[0], a[1], 0),
            P(b[0], b[1], 0),
            P(b[0], b[1], f.depth),
            P(a[0], a[1], f.depth),
          ])}
          fill={right ? avColor.fillStrong : avColor.paper}
          stroke={avColor.line}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ))}
      <path
        d={path(front)}
        fill={avColor.fill}
        stroke={avColor.line}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {labels}
      <EdgeLabel
        a={d0}
        b={d1}
        nx={Math.sin(ANGLE)}
        ny={Math.cos(ANGLE)}
        gap={8}
        label={withUnit(f.depth, f.unit)}
      />
    </svg>
  );
}

function CurvedSolid({
  figure: f,
}: {
  figure: Extract<Model, { kind: "curved-solid" }>;
}) {
  const r = f.radius ?? f.diameter! / 2;
  const isBall = f.solid === "sphere" || f.solid === "hemisphere";
  // A missing height is drawn at a neutral size; its label is “?”.
  const h = isBall ? 0 : (f.height ?? Math.max(r * 1.6, 2));
  const spanX = 2 * r,
    spanY =
      f.solid === "sphere"
        ? 2 * r
        : f.solid === "hemisphere"
          ? r + 0.3 * r
          : h + 0.6 * r;
  const s = Math.min(170 / spanX, 190 / spanY);
  const R = r * s,
    ry = R * 0.3;
  const cx = 150;
  const top =
    (f.solid === "cylinder" ? 30 : 8) + (f.solid === "cylinder" ? ry : 0);
  const radiusLabel =
    f.radius !== null
      ? `r = ${withUnit(f.radius, f.unit)}`
      : `d = ${withUnit(f.diameter, f.unit)}`;
  const heightLabel = `h = ${withUnit(f.height, f.unit)}`;
  const dashed = {
    stroke: avColor.ink,
    strokeWidth: 1.5,
    strokeDasharray: "5 4",
    fill: "none",
  } as const;
  const outline = {
    stroke: avColor.line,
    strokeWidth: 2.5,
    fill: "none",
  } as const;
  const arc = (y: number, sweep: 0 | 1) =>
    `M${n(cx - R)} ${n(y)} A${n(R)} ${n(ry)} 0 0 ${sweep} ${n(cx + R)} ${n(y)}`;
  /** The radius or diameter on the circle at y; its label sits at labelY. */
  const dimension = (y: number, labelY: number | "beside") => (
    <g>
      <line
        x1={n(f.radius !== null ? cx : cx - R)}
        y1={n(y)}
        x2={n(cx + R)}
        y2={n(y)}
        stroke={avColor.warm}
        strokeWidth={2}
      />
      <circle cx={cx} cy={n(y)} r={3} fill={avColor.ink} />
      {labelY === "beside" ? (
        <text x={n(cx + R + 8)} y={n(y + 6)} style={heightText}>
          {radiusLabel}
        </text>
      ) : (
        <text x={cx} y={n(labelY)} textAnchor="middle" style={heightText}>
          {radiusLabel}
        </text>
      )}
    </g>
  );
  const heightDimension = (from: number, to: number) => (
    <g>
      <line
        x1={n(cx + R + 18)}
        y1={n(from)}
        x2={n(cx + R + 18)}
        y2={n(to)}
        stroke={avColor.warm}
        strokeWidth={2}
      />
      <line
        x1={n(cx + R + 12)}
        y1={n(from)}
        x2={n(cx + R + 24)}
        y2={n(from)}
        stroke={avColor.warm}
        strokeWidth={2}
      />
      <line
        x1={n(cx + R + 12)}
        y1={n(to)}
        x2={n(cx + R + 24)}
        y2={n(to)}
        stroke={avColor.warm}
        strokeWidth={2}
      />
      <text x={n(cx + R + 30)} y={n((from + to) / 2 + 6)} style={heightText}>
        {heightLabel}
      </text>
    </g>
  );
  let body: React.ReactNode, viewH: number, description: string;
  const size =
    f.radius !== null
      ? `radius ${withUnit(f.radius, f.unit)}`
      : `diameter ${withUnit(f.diameter, f.unit)}`;
  if (f.solid === "cylinder") {
    const bottom = top + h * s;
    body = (
      <>
        <path
          d={`M${n(cx - R)} ${n(top)} L${n(cx - R)} ${n(bottom)} A${n(R)} ${n(ry)} 0 0 0 ${n(cx + R)} ${n(bottom)} L${n(cx + R)} ${n(top)} Z`}
          fill={avColor.fill}
          stroke="none"
        />
        <ellipse
          cx={cx}
          cy={n(top)}
          rx={n(R)}
          ry={n(ry)}
          fill={avColor.fillStrong}
          {...{ stroke: avColor.line, strokeWidth: 2.5 }}
        />
        <path d={arc(bottom, 1)} {...dashed} />
        <path
          d={`M${n(cx - R)} ${n(top)} L${n(cx - R)} ${n(bottom)} A${n(R)} ${n(ry)} 0 0 0 ${n(cx + R)} ${n(bottom)} L${n(cx + R)} ${n(top)}`}
          {...outline}
        />
        {dimension(top, top - ry - 8)}
        {heightDimension(top, bottom)}
      </>
    );
    viewH = bottom + ry + 24;
    description = `Cylinder with ${size} and height ${withUnit(f.height, f.unit)}${f.height === null ? " (unknown)" : ""}. The hidden back edge of the bottom circle is dashed.`;
  } else if (f.solid === "cone") {
    const apex = 16,
      base = apex + h * s;
    body = (
      <>
        <path
          d={`M${cx} ${apex} L${n(cx + R)} ${n(base)} A${n(R)} ${n(ry)} 0 0 1 ${n(cx - R)} ${n(base)} Z`}
          fill={avColor.fill}
          stroke="none"
        />
        <path
          d={`M${n(cx - R)} ${n(base)} A${n(R)} ${n(ry)} 0 0 1 ${n(cx + R)} ${n(base)}`}
          {...dashed}
        />
        <path
          d={`M${cx} ${apex} L${n(cx + R)} ${n(base)} A${n(R)} ${n(ry)} 0 0 1 ${n(cx - R)} ${n(base)} Z`}
          {...outline}
        />
        <line
          x1={cx}
          y1={apex}
          x2={cx}
          y2={n(base)}
          {...dashed}
          stroke={avColor.warm}
          strokeWidth={2}
        />
        <RightMark at={[cx, base]} u={[0, -1]} v={[-1, 0]} size={9} />
        {heightDimension(apex, base)}
        {dimension(base, base + ry + 20)}
      </>
    );
    viewH = base + ry + 30;
    description = `Cone with ${size} and height ${withUnit(f.height, f.unit)}. The dashed height runs from the tip to the center of the circular base at a right angle. The hidden back edge of the base is dashed.`;
  } else if (f.solid === "sphere") {
    const cy = 26 + R;
    body = (
      <>
        <circle
          cx={cx}
          cy={n(cy)}
          r={n(R)}
          fill={avColor.fill}
          {...{ stroke: avColor.line, strokeWidth: 2.5 }}
        />
        <path d={arc(cy, 1)} {...dashed} />
        <path
          d={arc(cy, 0)}
          stroke={avColor.line}
          strokeWidth={1.5}
          fill="none"
        />
        {dimension(cy, "beside")}
      </>
    );
    viewH = cy + R + 24;
    description = `Sphere with ${size}. The dashed curve is the hidden back half of the circle around its middle.`;
  } else {
    const cy = 26 + R;
    body = (
      <>
        <path
          d={`M${n(cx - R)} ${n(cy)} A${n(R)} ${n(R)} 0 0 1 ${n(cx + R)} ${n(cy)} A${n(R)} ${n(ry)} 0 0 1 ${n(cx - R)} ${n(cy)} Z`}
          fill={avColor.fill}
          stroke="none"
        />
        <path
          d={`M${n(cx - R)} ${n(cy)} A${n(R)} ${n(ry)} 0 0 1 ${n(cx + R)} ${n(cy)}`}
          {...dashed}
        />
        <path
          d={`M${n(cx - R)} ${n(cy)} A${n(R)} ${n(R)} 0 0 1 ${n(cx + R)} ${n(cy)} A${n(R)} ${n(ry)} 0 0 1 ${n(cx - R)} ${n(cy)}`}
          {...outline}
        />
        {dimension(cy, "beside")}
      </>
    );
    viewH = cy + ry + 30;
    description = `Hemisphere, half of a sphere, with ${size} across its flat circular face.`;
  }
  return (
    <svg
      className="figure area-volume-figure"
      data-kind={f.kind}
      viewBox={`0 0 ${W} ${n(viewH)}`}
      role="img"
      aria-label={description}
    >
      {body}
    </svg>
  );
}
export { lengthText };
