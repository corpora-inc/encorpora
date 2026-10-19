import React from "react";
import {
  FlatPath,
  SolidFigure,
  fitItems,
  pieceFills,
} from "../web/ShapeFigure";
import {
  place,
  type FlatShape,
  type Pt,
  type Solid,
} from "../math/shape-figures";

const kinds = [
  "flat-shape-names",
  "solid-shape-names",
  "compose-outline",
  "count-around",
] as const;
export type ShapeIllustrationKind = (typeof kinds)[number];
export const isShapeIllustration = (
  kind: string,
): kind is ShapeIllustrationKind => (kinds as readonly string[]).includes(kind);

const ink = "var(--color-figure-ink)",
  warm = "var(--color-figure-warm)";
const name = { fontSize: 17, fill: ink, textAnchor: "middle" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 420,
  display: "block",
  margin: "0 auto",
} as const;
const poly = (points: Pt[]): FlatShape => ({ type: "polygon", points });
const regular = (n: number, r: number, start: number): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = ((start + (360 * i) / n) * Math.PI) / 180;
    return [r * Math.cos(t), r * Math.sin(t)] as Pt;
  });
const square = (s: number): Pt[] => [
  [-s / 2, -s / 2],
  [s / 2, -s / 2],
  [s / 2, s / 2],
  [-s / 2, s / 2],
];

/** Exact models: every shape is drawn from its true vertices. */
export function ShapeIllustration({ kind }: { kind: ShapeIllustrationKind }) {
  const caption = {
    "flat-shape-names":
      "Each shape keeps its name when it is turned or resized: the square standing on a corner is still a square.",
    "solid-shape-names":
      "Solid shapes take up space. Dashed lines are edges hidden at the back.",
    "compose-outline":
      "Two triangles make a square; six triangles make a hexagon. The name comes from the outside edge.",
    "count-around":
      "Start at the dot and count each side once going around: 5 sides, so 5 corners.",
  }[kind];
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      {kind === "flat-shape-names" ? (
        <FlatNames />
      ) : kind === "solid-shape-names" ? (
        <SolidNames />
      ) : kind === "compose-outline" ? (
        <Compose />
      ) : (
        <CountAround />
      )}
      <figcaption style={{ fontSize: "0.875rem", marginTop: 8 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

function FlatNames() {
  const shapes: [string, FlatShape][] = [
    ["triangle", poly(place(regular(3, 1, -90), 0))],
    ["square", poly(place(square(1.5), 45))],
    [
      "rectangle",
      poly(
        place(
          [
            [-1.1, -0.5],
            [1.1, -0.5],
            [1.1, 0.5],
            [-1.1, 0.5],
          ],
          20,
        ),
      ),
    ],
    ["hexagon", poly(regular(6, 1, 0))],
    [
      "circle",
      { type: "ellipse", center: [0, 0], radii: [0.95, 0.95], angle: 0 },
    ],
    ["square", poly(square(1.1))],
  ];
  const cells = shapes.map((_, i) => ({
    x: (i % 3) * 120,
    y: Math.floor(i / 3) * 125,
    width: 120,
    height: 100,
  }));
  const ts = fitItems(
    shapes.map(([, s]) => [s]),
    cells,
    12,
    0,
  );
  return (
    <svg
      viewBox="0 0 360 250"
      role="img"
      aria-label="A triangle pointing down, a square standing on a corner, a tilted rectangle, a hexagon, a circle and an upright square, each named"
      data-lesson-illustration="flat-shape-names"
      style={svgStyle}
    >
      {shapes.map(([label, s], i) => (
        <g key={i}>
          <FlatPath shape={s} t={ts[i]!} />
          <text x={cells[i]!.x + 60} y={cells[i]!.y + 118} style={name}>
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function SolidNames() {
  const circle = (r: number): FlatShape => ({
    type: "ellipse",
    center: [0, 0],
    radii: [r, r],
    angle: 0,
  });
  const solids: [string, Solid][] = [
    ["cube", { type: "prism", base: poly(place(square(2), 30)), height: 2 }],
    ["cylinder", { type: "prism", base: circle(1), height: 2.2 }],
    ["cone", { type: "pyramid", base: circle(1), height: 2.4 }],
    ["sphere", { type: "sphere", radius: 1.2 }],
  ];
  return (
    <svg
      viewBox="0 0 360 140"
      role="img"
      aria-label="A cube, a cylinder, a cone and a sphere, each named"
      data-lesson-illustration="solid-shape-names"
      style={svgStyle}
    >
      {solids.map(([label, solid], i) => (
        <g key={label}>
          <SolidFigure
            solid={solid}
            width={90}
            height={110}
            at={{ x: i * 90, y: 0 }}
          />
          <text x={i * 90 + 45} y={132} style={name}>
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Compose() {
  const halves: Pt[][] = [
    [
      [0, 0],
      [2, 0],
      [2, 2],
    ],
    [
      [0, 0],
      [2, 2],
      [0, 2],
    ],
  ];
  const hex = regular(6, 1, 0);
  const wedges: Pt[][] = hex.map((v, i) => [[0, 0], v, hex[(i + 1) % 6]!]);
  // Apart: each piece slides out from the center of its whole.
  const apart = (pieces: Pt[][], c: Pt, k: number) =>
    pieces.map((p) => {
      const m = p.reduce(
        (a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length],
        [0, 0],
      );
      const d: Pt = [(m[0] - c[0]) * k, (m[1] - c[1]) * k];
      return p.map(([x, y]) => [x + d[0], y + d[1]] as Pt);
    });
  const groups = [
    apart(halves, [1, 1], 0.45).map(poly),
    halves.map(poly),
    apart(wedges, [0, 0], 0.5).map(poly),
    wedges.map(poly),
  ];
  const cells = [0, 1, 2, 3].map((i) => ({
    x: (i % 2) * 200,
    y: Math.floor(i / 2) * 125,
    width: 160,
    height: 115,
  }));
  const ts = fitItems(groups, cells, 10, 0);
  return (
    <svg
      viewBox="0 0 360 250"
      role="img"
      aria-label="Two triangles slide together into a square; six triangles slide together into a hexagon"
      data-lesson-illustration="compose-outline"
      style={svgStyle}
    >
      {groups.map((g, i) => (
        <g key={i}>
          {g.map((p, j) => (
            <FlatPath key={j} shape={p} t={ts[i]!} fill={pieceFills[j % 3]!} />
          ))}
        </g>
      ))}
      {[0, 1].map((row) => (
        <path
          key={row}
          d={`M166 ${row * 125 + 57} h22 m-8 -7 l8 7 l-8 7`}
          fill="none"
          stroke={warm}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function CountAround() {
  const points: Pt[] = [
    [0, 0],
    [3, 0],
    [3.6, 1.6],
    [1.6, 2.7],
    [-0.4, 1.5],
  ];
  const shape = poly(points);
  const [t] = fitItems(
    [[shape]],
    [{ x: 0, y: 0, width: 360, height: 220 }],
    30,
    0,
  );
  const s = (p: Pt) => ({
    x: t!.ox + (p[0] - t!.cx) * t!.unit,
    y: t!.oy - (p[1] - t!.cy) * t!.unit,
  });
  const center = s([1.56, 1.16]);
  return (
    <svg
      viewBox="0 0 360 220"
      role="img"
      aria-label="A five-sided shape with its sides numbered 1 to 5, starting from a marked corner"
      data-lesson-illustration="count-around"
      style={svgStyle}
    >
      <FlatPath shape={shape} t={t!} />
      {points.map((p, i) => {
        const a = s(p),
          b = s(points[(i + 1) % points.length]!);
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const d = Math.hypot(m.x - center.x, m.y - center.y);
        return (
          <text
            key={i}
            x={m.x + ((m.x - center.x) / d) * 18}
            y={m.y + ((m.y - center.y) / d) * 18 + 6}
            style={{ ...name, fontSize: 19, fontWeight: 700, fill: warm }}
          >
            {i + 1}
          </text>
        );
      })}
      <circle cx={s(points[0]!).x} cy={s(points[0]!).y} r={7} fill={warm} />
    </svg>
  );
}
