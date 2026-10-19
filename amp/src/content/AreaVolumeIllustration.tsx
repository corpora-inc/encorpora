import React from "react";
import { avColor } from "../web/AreaVolumeFigure";
import { faceArea, netBounds, netFaces } from "../web/area-volume-geometry";

export type AreaVolumeIllustrationKind =
  | "av-triangle-half"
  | "av-polygon-split"
  | "av-prism-net"
  | "av-cube-packing"
  | "av-composite-split"
  | "av-prism-layers"
  | "av-prism-unrolled"
  | "av-cylinder-stack"
  | "av-cone-sphere-cylinder";

type Pt = [number, number];
const label = {
  fontSize: 18,
  fill: "currentColor",
  fontFamily: "Arial, sans-serif",
} as const;
const strong = { ...label, fill: avColor.warm, fontWeight: 700 } as const;
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 460,
  display: "block",
  margin: "0 auto",
} as const;
const captionStyle = { marginTop: 12, lineHeight: 1.6 };
const r2 = (v: number) => Math.round(v * 100) / 100;
const d = (pts: Pt[], close = true) =>
  `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(" L")}${close ? " Z" : ""}`;
const outline = {
  stroke: avColor.line,
  strokeWidth: 2.25,
  strokeLinejoin: "round" as const,
};
const dash = {
  stroke: avColor.warm,
  strokeWidth: 2,
  strokeDasharray: "6 4",
  fill: "none",
};

function Frame({
  kind,
  viewBox,
  description,
  title,
  caption,
  data,
  children,
}: {
  kind: AreaVolumeIllustrationKind;
  viewBox: string;
  description: string;
  title: string;
  caption: string;
  data?: Record<string, string | number>;
  children: React.ReactNode;
}) {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration={kind}
        {...data}
        viewBox={viewBox}
        role="img"
        aria-label={description}
        style={svgStyle}
      >
        <title>{title}</title>
        {children}
      </svg>
      <figcaption style={captionStyle}>{caption}</figcaption>
    </figure>
  );
}

/** Fixed teaching models drawn to scale; data attributes let a reviewer re-measure them. */
export function AreaVolumeIllustration({
  kind,
}: {
  kind: AreaVolumeIllustrationKind;
}) {
  switch (kind) {
    case "av-triangle-half":
      return <TriangleHalf />;
    case "av-polygon-split":
      return <PolygonSplit />;
    case "av-prism-net":
      return <PrismNet />;
    case "av-cube-packing":
      return <CubePacking />;
    case "av-composite-split":
      return <CompositeSplit />;
    case "av-prism-layers":
      return <PrismLayers />;
    case "av-prism-unrolled":
      return <PrismUnrolled />;
    case "av-cylinder-stack":
      return <CylinderStack />;
    case "av-cone-sphere-cylinder":
      return <ConeSphereCylinder />;
  }
}

function TriangleHalf() {
  const s = 32,
    ox = 30,
    oy = 200;
  const P = (x: number, y: number): Pt => [ox + x * s, oy - y * s];
  // Base 8 and height 5 with the apex above x = 2; the copy is the triangle
  // turned 180° about the midpoint of its right side, (5, 2.5).
  const tri: Pt[] = [P(0, 0), P(8, 0), P(2, 5)];
  const copy: Pt[] = [P(10, 5), P(2, 5), P(8, 0)];
  return (
    <Frame
      kind="av-triangle-half"
      viewBox="0 0 400 250"
      title="Two copies of a triangle make a parallelogram"
      description="A triangle with base 8 and height 5, and a copy turned halfway around, together fill a parallelogram with base 8 and height 5. The parallelogram's area is 40, so each triangle's area is 20."
      caption="The copy is the triangle turned halfway around the middle of its right side. Together they fill a parallelogram with base 8 and height 5, area 8 × 5 = 40, so each triangle has area 40 ÷ 2 = 20."
      data={{
        "data-base": 8,
        "data-height": 5,
        "data-scale": s,
        "data-triangle": tri.flat().join(","),
        "data-copy": copy.flat().join(","),
      }}
    >
      <path
        d={d(copy)}
        fill={avColor.goldFill}
        stroke={avColor.gold}
        strokeWidth={2}
        strokeDasharray="7 4"
      />
      <path d={d(tri)} fill={avColor.fill} {...outline} />
      <line
        x1={P(2, 5)[0]}
        y1={P(2, 5)[1]}
        x2={P(2, 0)[0]}
        y2={P(2, 0)[1]}
        {...dash}
      />
      <path
        d={d(
          [
            P(2, 0.35),
            [P(2, 0)[0] + 11, P(2, 0.35)[1]],
            [P(2, 0)[0] + 11, P(2, 0)[1]],
          ],
          false,
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <text
        x={P(2, 2.5)[0] - 8}
        y={P(2, 2.5)[1]}
        textAnchor="end"
        style={strong}
      >
        5
      </text>
      <text x={P(4, 0)[0]} y={oy + 24} textAnchor="middle" style={label}>
        base 8
      </text>
      <text
        x={P(6.6, 3.1)[0]}
        y={P(6.6, 3.1)[1]}
        textAnchor="middle"
        style={label}
      >
        copy
      </text>
    </Frame>
  );
}

function PolygonSplit() {
  const s = 30,
    ox = 50,
    oy = 170;
  const P = (x: number, y: number): Pt => [ox + x * s, oy - y * s];
  const lower: Pt[] = [P(0, 0), P(10, 0), P(7, 4)];
  const upper: Pt[] = [P(0, 0), P(7, 4), P(1, 4)];
  return (
    <Frame
      kind="av-polygon-split"
      viewBox="0 0 400 215"
      title="A diagonal splits a trapezoid into two triangles"
      description="A trapezoid with parallel sides 10 and 6 and height 4 is split by a diagonal into two triangles: one with base 10 and height 4, area 20, and one with base 6 and height 4, area 12. Total area 32."
      caption="Both triangles reach across the same height, 4. The lower one has base 10 and area 1/2 × 10 × 4 = 20; the upper one has base 6 and area 1/2 × 6 × 4 = 12. The trapezoid's area is 20 + 12 = 32."
      data={{
        "data-bottom": 10,
        "data-top": 6,
        "data-height": 4,
        "data-scale": s,
        "data-lower": lower.flat().join(","),
        "data-upper": upper.flat().join(","),
      }}
    >
      <path d={d(lower)} fill={avColor.fill} {...outline} />
      <path d={d(upper)} fill={avColor.goldFill} {...outline} />
      <line
        x1={P(1, 4)[0]}
        y1={P(1, 4)[1]}
        x2={P(1, 0)[0]}
        y2={P(1, 0)[1]}
        {...dash}
      />
      <text
        x={P(1, 2)[0] - 8}
        y={P(1, 2)[1] + 6}
        textAnchor="end"
        style={strong}
      >
        4
      </text>
      <text x={P(5, 0)[0]} y={oy + 24} textAnchor="middle" style={label}>
        10
      </text>
      <text
        x={P(4, 4)[0]}
        y={P(4, 4)[1] - 10}
        textAnchor="middle"
        style={label}
      >
        6
      </text>
      <text
        x={P(6.3, 1.3)[0]}
        y={P(6.3, 1.3)[1]}
        textAnchor="middle"
        style={label}
      >
        20
      </text>
      <text x={P(3, 3)[0]} y={P(3, 3)[1]} textAnchor="middle" style={label}>
        12
      </text>
    </Frame>
  );
}

function PrismNet() {
  const faces = netFaces({
    kind: "rectangular-prism-net",
    unit: "cm",
    length: 5,
    width: 3,
    height: 2,
  });
  const b = netBounds(faces);
  const s = 24,
    ox = (400 - (b.maxX - b.minX) * s) / 2,
    oy = 20;
  const P = (p: readonly number[]): Pt => [ox + p[0]! * s, oy + p[1]! * s];
  const fills = {
    "pair-a": avColor.fill,
    "pair-b": avColor.goldFill,
    "pair-c": avColor.warmFill,
  } as Record<string, string>;
  return (
    <Frame
      kind="av-prism-net"
      viewBox={`0 0 400 ${r2((b.maxY - b.minY) * s + 2 * oy)}`}
      title="The net of a 5 by 3 by 2 box"
      description="The net of a rectangular prism 5 long, 3 wide and 2 tall: top and bottom faces 5 by 3 with area 15, front and back faces 5 by 2 with area 10, and two end faces 3 by 2 with area 6. Surface area 62."
      caption="Each face shows its area. Matching faces share a color: top and bottom 5 × 3 = 15, front and back 5 × 2 = 10, the ends 3 × 2 = 6. Surface area: 2 × 15 + 2 × 10 + 2 × 6 = 62."
      data={{
        "data-length": 5,
        "data-width": 3,
        "data-height": 2,
        "data-scale": s,
      }}
    >
      {faces.map((f) => {
        const pts = f.points.map(P);
        const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length,
          cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
        return (
          <g key={f.id} data-face={f.id} data-area={faceArea(f)}>
            <path d={d(pts)} fill={fills[f.role]} {...outline} />
            <text x={r2(cx)} y={r2(cy + 6)} textAnchor="middle" style={label}>
              {faceArea(f)}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

/** Cabinet oblique box with an optional cube grid; returns SVG elements. */
function obliqueBox(
  L: number,
  D: number,
  H: number,
  e: number | null,
  s: number,
  ox: number,
  oy: number,
  key: string,
) {
  const k = 0.5 * Math.cos(Math.PI / 5.14),
    m = 0.5 * Math.sin(Math.PI / 5.14);
  const P = (x: number, y: number, z: number): Pt => [
    ox + (x + z * k) * s,
    oy - (y + z * m) * s,
  ];
  const front = [P(0, 0, 0), P(L, 0, 0), P(L, H, 0), P(0, H, 0)];
  const top = [P(0, H, 0), P(L, H, 0), P(L, H, D), P(0, H, D)];
  const side = [P(L, 0, 0), P(L, 0, D), P(L, H, D), P(L, H, 0)];
  const lines: React.ReactNode[] = [];
  if (e)
    for (const [count, at] of [
      [L / e, (t: number) => [P(t, 0, 0), P(t, H, 0), P(t, H, D)]],
      [H / e, (t: number) => [P(0, t, 0), P(L, t, 0), P(L, t, D)]],
      [D / e, (t: number) => [P(0, H, t), P(L, H, t), P(L, 0, t)]],
    ] as const)
      for (let i = 1; i < Math.round(count); i++)
        lines.push(
          <path
            key={`${key}${count}-${i}`}
            d={d(at(i * e) as Pt[], false)}
            fill="none"
            stroke={avColor.line}
            strokeWidth={1}
          />,
        );
  return (
    <g key={key}>
      <path d={d(top)} fill={avColor.paper} />
      <path d={d(side)} fill={avColor.fillStrong} />
      <path d={d(front)} fill={avColor.fill} />
      {lines}
      {[top, side, front].map((f, i) => (
        <path key={i} d={d(f)} fill="none" {...outline} />
      ))}
    </g>
  );
}
function CubePacking() {
  return (
    <Frame
      kind="av-cube-packing"
      viewBox="0 0 420 220"
      title="Half-unit cubes fill a unit cube and a prism"
      description="Left: a cube with edges of 1 unit made of 8 small cubes with edges of one half. Right: a prism 2 and a half by 1 and a half by 1 made of 5 by 3 by 2, which is 30, half-unit cubes."
      caption="Left: 2 × 2 × 2 = 8 cubes with edges of 1/2 fill one unit cube, so each is 1/8 of a cubic unit. Right: a prism 2 1/2 long, 1 1/2 deep and 1 tall holds 5 × 3 × 2 = 30 of them: 30 × 1/8 = 15/4, the same as 5/2 × 3/2 × 1."
      data={{
        "data-edge": "1/2",
        "data-unit-cubes": 8,
        "data-prism": "5/2,3/2,1",
        "data-prism-cubes": 30,
      }}
    >
      {obliqueBox(1, 1, 1, 0.5, 80, 24, 170, "unit")}
      <text x={64} y={198} textAnchor="middle" style={label}>
        1
      </text>
      {obliqueBox(2.5, 1.5, 1, 0.5, 64, 180, 170, "prism")}
      <text x={180 + 1.25 * 64} y={198} textAnchor="middle" style={label}>
        2½
      </text>
      <text x={172} y={170 - 32 + 6} textAnchor="end" style={label}>
        1
      </text>
      <text
        x={180 + 2.5 * 64 + 34}
        y={170 - 10}
        textAnchor="start"
        style={label}
      >
        1½
      </text>
    </Frame>
  );
}

function CompositeSplit() {
  const s = 13;
  const L = (ox: number): Pt[] =>
    (
      [
        [0, 0],
        [10, 0],
        [10, 4],
        [6, 4],
        [6, 9],
        [0, 9],
      ] as Pt[]
    ).map(([x, y]) => [ox + x * s, 175 - y * s]);
  const P = (ox: number, x: number, y: number): Pt => [ox + x * s, 175 - y * s];
  const A = 30,
    B = 240;
  return (
    <Frame
      kind="av-composite-split"
      viewBox="0 0 420 210"
      title="Add the parts or subtract the missing piece"
      description="Left: an L-shape with bottom 10, left side 9, top 6 and right side 4, split by a horizontal line into a 10 by 4 rectangle and a 6 by 5 rectangle, areas 40 and 30. Right: the same L completed to a 10 by 9 rectangle, area 90, minus the missing 4 by 5 corner, area 20. Both give 70."
      caption="Split: 10 × 4 + 6 × 5 = 40 + 30 = 70. Subtract: 10 × 9 − 4 × 5 = 90 − 20 = 70. The inner edges come from the outer ones: 10 − 6 = 4 across and 9 − 4 = 5 up."
      data={{ "data-shape": "0,0 10,0 10,4 6,4 6,9 0,9", "data-scale": s }}
    >
      <path
        d={d([P(A, 0, 0), P(A, 10, 0), P(A, 10, 4), P(A, 0, 4)])}
        fill={avColor.fill}
        {...outline}
      />
      <path
        d={d([P(A, 0, 4), P(A, 6, 4), P(A, 6, 9), P(A, 0, 9)])}
        fill={avColor.goldFill}
        {...outline}
      />
      <text
        x={P(A, 5, 2)[0]}
        y={P(A, 2, 2)[1] + 6}
        textAnchor="middle"
        style={label}
      >
        40
      </text>
      <text
        x={P(A, 3, 6.5)[0]}
        y={P(A, 3, 6.5)[1] + 6}
        textAnchor="middle"
        style={label}
      >
        30
      </text>
      <path
        d={d([P(B, 6, 4), P(B, 10, 4), P(B, 10, 9), P(B, 6, 9)])}
        fill={avColor.warmFill}
        stroke={avColor.warm}
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <path d={d(L(B))} fill={avColor.fill} {...outline} />
      <text
        x={P(B, 3, 4.5)[0]}
        y={P(B, 3, 4.5)[1] + 6}
        textAnchor="middle"
        style={label}
      >
        90 − 20
      </text>
      <text
        x={P(B, 8, 6.5)[0]}
        y={P(B, 8, 6.5)[1] + 6}
        textAnchor="middle"
        style={strong}
      >
        20
      </text>
      {[A, B].map((o) => (
        <g key={o}>
          <text x={P(o, 5, 0)[0]} y={196} textAnchor="middle" style={label}>
            10
          </text>
          <text
            x={o - 6}
            y={P(o, 0, 4.5)[1] + 6}
            textAnchor="end"
            style={label}
          >
            9
          </text>
        </g>
      ))}
    </Frame>
  );
}

/** An L-shaped prism face, bottom 8, left 6, top 3, right 2. */
const LFACE: Pt[] = [
  [0, 0],
  [8, 0],
  [8, 2],
  [3, 2],
  [3, 6],
  [0, 6],
];
function extruded(
  face: Pt[],
  z0: number,
  z1: number,
  s: number,
  ox: number,
  oy: number,
  key: string,
) {
  const k = 0.5 * Math.cos(Math.PI / 5.14),
    m = 0.5 * Math.sin(Math.PI / 5.14);
  const P = (x: number, y: number, z: number): Pt => [
    ox + (x + z * k) * s,
    oy - (y + z * m) * s,
  ];
  const edges = face.map((p, i) => [p, face[(i + 1) % face.length]!] as const);
  const sides = edges
    .map(([a, b]) => ({ a, b, up: b[0] < a[0], right: b[1] > a[1] }))
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
  return (
    <g key={key}>
      {sides.map(({ a, b, right }, i) => (
        <path
          key={i}
          d={d([
            P(a[0], a[1], z0),
            P(b[0], b[1], z0),
            P(b[0], b[1], z1),
            P(a[0], a[1], z1),
          ])}
          fill={right ? avColor.fillStrong : avColor.paper}
          {...outline}
          strokeWidth={1.5}
        />
      ))}
      <path
        d={d(face.map(([x, y]) => P(x, y, z0)))}
        fill={avColor.fill}
        {...outline}
        strokeWidth={1.75}
      />
    </g>
  );
}
function PrismLayers() {
  const s = 22;
  return (
    <Frame
      kind="av-prism-layers"
      viewBox="0 0 420 230"
      title="A prism is a stack of copies of its face"
      description="An L-shaped prism 4 units deep pulled apart into 4 layers, each 1 unit deep. The L-shaped face has area 28, so each layer holds 28 unit cubes and the prism holds 28 times 4, which is 112."
      caption="Each layer is a copy of the L-shaped face, 1 unit deep: 8 × 2 + 3 × 4 = 16 + 12 = 28 unit cubes. Four layers hold 28 × 4 = 112 cubic units."
      data={{
        "data-face": LFACE.map((p) => p.join(",")).join(" "),
        "data-depth": 4,
        "data-layers": 4,
      }}
    >
      {[3, 2, 1, 0].map((layer) =>
        extruded(
          LFACE,
          layer * 1.5,
          layer * 1.5 + 1,
          s,
          30,
          200,
          `layer${layer}`,
        ),
      )}
      <text x={30 + 4 * s} y={222} textAnchor="middle" style={label}>
        8
      </text>
      <text x={22} y={200 - 3 * s + 6} textAnchor="end" style={label}>
        6
      </text>
    </Frame>
  );
}

function PrismUnrolled() {
  const widths = LFACE.map((p, i) => {
    const q = LFACE[(i + 1) % LFACE.length]!;
    return Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
  });
  const s = 12,
    depth = 4,
    x0 = 70,
    y0 = 150;
  let x = x0;
  return (
    <Frame
      kind="av-prism-unrolled"
      viewBox="0 0 420 220"
      title="The side faces unroll into one rectangle"
      description="The six side faces of an L-shaped prism 4 units deep, laid end to end: widths 8, 2, 5, 4, 3 and 6, one for each edge of the L. Together they form a rectangle 28 long, the perimeter, and 4 wide, area 112."
      caption="One side face for each edge of the L: 8 + 2 + 5 + 4 + 3 + 6 = 28, the perimeter. Laid end to end they make a rectangle 28 × 4 = 112. Add the front and back faces, 2 × 28 = 56, for a surface area of 168."
      data={{
        "data-widths": widths.join(","),
        "data-depth": depth,
        "data-face": LFACE.map((p) => p.join(",")).join(" "),
      }}
    >
      <path
        d={d(LFACE.map(([px, py]) => [20 + px * 12, 90 - py * 12] as Pt))}
        fill={avColor.fill}
        {...outline}
      />
      <text x={20 + 4 * 12} y={110} textAnchor="middle" style={label}>
        face
      </text>
      {widths.map((w, i) => {
        const left = x;
        x += w * s;
        return (
          <g key={i} data-strip={w}>
            <rect
              x={left}
              y={y0}
              width={w * s}
              height={depth * s}
              fill={i % 2 ? avColor.goldFill : avColor.fillStrong}
              {...outline}
            />
            <text
              x={left + (w * s) / 2}
              y={y0 - 8}
              textAnchor="middle"
              style={label}
            >
              {w}
            </text>
          </g>
        );
      })}
      <text
        x={x0 - 8}
        y={y0 + (depth * s) / 2 + 6}
        textAnchor="end"
        style={label}
      >
        4
      </text>
      <text
        x={(x0 + x) / 2}
        y={y0 + depth * s + 24}
        textAnchor="middle"
        style={strong}
      >
        perimeter 28
      </text>
    </Frame>
  );
}

function CylinderStack() {
  const R = 54,
    ry = 16,
    layer = 18,
    gap = 8,
    cx = 120,
    base = 196;
  const slab = (i: number) => {
    const bottom = base - i * (layer + gap),
      top = bottom - layer;
    return (
      <g key={i} data-layer={i + 1}>
        <path
          d={`M${cx - R} ${top} L${cx - R} ${bottom} A${R} ${ry} 0 0 0 ${cx + R} ${bottom} L${cx + R} ${top} Z`}
          fill={avColor.fill}
          {...outline}
          strokeWidth={1.75}
        />
        <ellipse
          cx={cx}
          cy={top}
          rx={R}
          ry={ry}
          fill={avColor.fillStrong}
          {...outline}
          strokeWidth={1.75}
        />
      </g>
    );
  };
  return (
    <Frame
      kind="av-cylinder-stack"
      viewBox="0 0 400 240"
      title="A cylinder is a stack of circles"
      description="A cylinder with radius 3 and height 5 pulled apart into 5 layers, each 1 unit tall. Each layer's base is a circle of area 9 pi, so the cylinder's volume is 9 pi times 5, which is 45 pi."
      caption="Each layer 1 unit tall holds a circle of area π × 3² = 9π. Five layers: 9π × 5 = 45π cubic units."
      data={{ "data-radius": 3, "data-height": 5, "data-layers": 5 }}
    >
      {[0, 1, 2, 3, 4].map(slab)}
      <text x={cx + R + 20} y={base - 2 * (layer + gap) - 4} style={label}>
        5 layers of 9π
      </text>
      <text x={cx + R + 20} y={base - 2 * (layer + gap) + 22} style={strong}>
        9π × 5 = 45π
      </text>
    </Frame>
  );
}

function ConeSphereCylinder() {
  const R = 42,
    ry = 12,
    h = 84,
    top = 40,
    bottom = top + h;
  const solids = [
    { name: "cone", x: 70, volume: "18π" },
    { name: "sphere", x: 200, volume: "36π" },
    { name: "cylinder", x: 330, volume: "54π" },
  ];
  const dashed = {
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeDasharray: "4 4",
    fill: "none",
  };
  return (
    <Frame
      kind="av-cone-sphere-cylinder"
      viewBox="0 0 400 190"
      title="Cone, sphere and cylinder: 1 to 2 to 3"
      description="A cone, a sphere and a cylinder, each with radius 3 and height 6. Their volumes are 18 pi, 36 pi and 54 pi, in the ratio 1 to 2 to 3."
      caption="All three have radius 3 and height 6. The cylinder holds π × 3² × 6 = 54π. The cone holds 1/3 of it, 18π; the sphere holds 2/3 of it, 36π = 4/3 × 27π. Their volumes are in the ratio 1 : 2 : 3."
      data={{ "data-radius": 3, "data-height": 6, "data-volumes": "18,36,54" }}
    >
      {solids.map(({ name, x, volume }) => (
        <g key={name} data-solid={name} data-volume={volume}>
          {name === "cone" && (
            <>
              <path
                d={`M${x} ${top} L${x + R} ${bottom} A${R} ${ry} 0 0 1 ${x - R} ${bottom} Z`}
                fill={avColor.fill}
                {...outline}
              />
              <path
                d={`M${x - R} ${bottom} A${R} ${ry} 0 0 1 ${x + R} ${bottom}`}
                {...dashed}
              />
            </>
          )}
          {name === "sphere" && (
            <>
              <circle
                cx={x}
                cy={(top + bottom) / 2}
                r={R}
                fill={avColor.fill}
                {...outline}
              />
              <path
                d={`M${x - R} ${(top + bottom) / 2} A${R} ${ry} 0 0 1 ${x + R} ${(top + bottom) / 2}`}
                {...dashed}
              />
              <path
                d={`M${x - R} ${(top + bottom) / 2} A${R} ${ry} 0 0 0 ${x + R} ${(top + bottom) / 2}`}
                fill="none"
                stroke={avColor.line}
                strokeWidth={1.25}
              />
            </>
          )}
          {name === "cylinder" && (
            <>
              <path
                d={`M${x - R} ${top} L${x - R} ${bottom} A${R} ${ry} 0 0 0 ${x + R} ${bottom} L${x + R} ${top} Z`}
                fill={avColor.fill}
                {...outline}
              />
              <ellipse
                cx={x}
                cy={top}
                rx={R}
                ry={ry}
                fill={avColor.fillStrong}
                {...outline}
              />
              <path
                d={`M${x - R} ${bottom} A${R} ${ry} 0 0 1 ${x + R} ${bottom}`}
                {...dashed}
              />
            </>
          )}
          <text x={x} y={bottom + 34} textAnchor="middle" style={label}>
            {name}
          </text>
          <text x={x} y={bottom + 56} textAnchor="middle" style={strong}>
            {volume}
          </text>
        </g>
      ))}
    </Frame>
  );
}
