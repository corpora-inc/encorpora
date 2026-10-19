import React from "react";
import {
  FlatPath,
  SolidFigure,
  fitItems,
  PolygonMarks,
} from "../web/ShapeFigure";
import { place, type FlatShape, type Pt } from "../math/shape-figures";

const kinds = [
  "polygon-names",
  "solid-parts",
  "quadrilateral-marks",
  "quadrilateral-tree",
] as const;
export type PolygonIllustrationKind = (typeof kinds)[number];
export const isPolygonIllustration = (
  kind: string,
): kind is PolygonIllustrationKind =>
  (kinds as readonly string[]).includes(kind);

const ink = "var(--color-figure-ink)",
  warm = "var(--color-figure-warm)";
const name = { fontSize: 16, fill: ink, textAnchor: "middle" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 440,
  display: "block",
  margin: "0 auto",
} as const;
const poly = (points: Pt[]): FlatShape => ({ type: "polygon", points });
const deg = Math.PI / 180;
const square: Pt[] = [
  [0, 0],
  [1.6, 0],
  [1.6, 1.6],
  [0, 1.6],
];
const rectangle: Pt[] = [
  [0, 0],
  [2.4, 0],
  [2.4, 1.1],
  [0, 1.1],
];
const rhombus: Pt[] = [
  [0, 0],
  [1.6, 0],
  [1.6 + 1.6 * Math.cos(60 * deg), 1.6 * Math.sin(60 * deg)],
  [1.6 * Math.cos(60 * deg), 1.6 * Math.sin(60 * deg)],
];
const parallelogram: Pt[] = [
  [0, 0],
  [2.2, 0],
  [2.2 + 1.1 * Math.cos(60 * deg), 1.1 * Math.sin(60 * deg)],
  [1.1 * Math.cos(60 * deg), 1.1 * Math.sin(60 * deg)],
];
const irregular: Pt[] = [
  [0, 0],
  [2.3, 0.3],
  [1.9, 1.5],
  [-0.3, 1.1],
];

/** Exact models: every shape is drawn from its true vertices. */
export function PolygonIllustration({
  kind,
}: {
  kind: PolygonIllustrationKind;
}) {
  const caption = {
    "polygon-names":
      "Uneven sides and inward corners do not change the name: count the sides.",
    "solid-parts":
      "A rectangular prism has 6 faces, 12 edges and 8 vertices. Dashed edges are hidden at the back.",
    "quadrilateral-marks":
      "Small squares mark right angles; matching ticks mark equal sides. The last shape is a quadrilateral that is none of the three.",
    "quadrilateral-tree":
      "Each shape belongs to every category above it: a square is a rectangle, a rhombus, a parallelogram and a quadrilateral.",
  }[kind];
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      {kind === "polygon-names" ? (
        <Names />
      ) : kind === "solid-parts" ? (
        <Parts />
      ) : kind === "quadrilateral-marks" ? (
        <Marks />
      ) : (
        <Tree />
      )}
      <figcaption style={{ fontSize: "0.875rem", marginTop: 8 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

function Names() {
  const shapes: [string, Pt[]][] = [
    [
      "triangle",
      [
        [0, 0],
        [2.2, 0.4],
        [0.6, 1.6],
      ],
    ],
    ["quadrilateral", irregular],
    [
      "pentagon",
      [
        [0, 0],
        [1.6, 0],
        [1.9, 1.2],
        [0.9, 0.7],
        [-0.2, 1.4],
      ],
    ],
    [
      "hexagon",
      [
        [0, 0],
        [1.2, -0.3],
        [2.1, 0.4],
        [1.9, 1.4],
        [0.8, 1.7],
        [-0.2, 1],
      ],
    ],
    [
      "octagon",
      place(
        Array.from(
          { length: 8 },
          (_, i) =>
            [
              Math.cos((45 * i + 22.5) * deg),
              Math.sin((45 * i + 22.5) * deg),
            ] as Pt,
        ),
        0,
      ),
    ],
  ];
  const cells = shapes.map((_, i) => ({
    x: i < 3 ? i * 140 : 70 + (i - 3) * 140,
    y: i < 3 ? 0 : 125,
    width: 140,
    height: 100,
  }));
  const ts = fitItems(
    shapes.map(([, p]) => [poly(p)]),
    cells,
    14,
    0,
  );
  return (
    <svg
      viewBox="0 0 420 250"
      role="img"
      aria-label="An irregular triangle, quadrilateral, pentagon with an inward corner, hexagon and octagon, each named"
      data-lesson-illustration="polygon-names"
      style={svgStyle}
    >
      {shapes.map(([label, p], i) => (
        <g key={label}>
          <FlatPath shape={poly(p)} t={ts[i]!} />
          <text x={cells[i]!.x + 70} y={cells[i]!.y + 118} style={name}>
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Parts() {
  const base = place(
    [
      [-1.4, -0.8],
      [1.4, -0.8],
      [1.4, 0.8],
      [-1.4, 0.8],
    ],
    25,
  );
  // The front corner of the base, and the corner to its right.
  const corner = base.reduce((a, p) => (p[1] < a[1] ? p : a));
  const next = base[(base.indexOf(corner) + 1) % 4]!;
  const label = { fontSize: 16, fontWeight: 700, fill: warm };
  return (
    <svg
      viewBox="0 0 420 240"
      role="img"
      aria-label="A rectangular prism with one face, one edge and one vertex labeled"
      data-lesson-illustration="solid-parts"
      style={svgStyle}
    >
      <SolidFigure
        solid={{ type: "prism", base: poly(base), height: 1.6 }}
        width={300}
        height={200}
        at={{ x: 60, y: 20 }}
        overlay={(at) => {
          const v = at(corner[0], corner[1], 0),
            e = at((corner[0] + next[0]) / 2, (corner[1] + next[1]) / 2, 0),
            f = at((corner[0] + next[0]) / 2, (corner[1] + next[1]) / 2, 1.15);
          return (
            <g>
              <path
                d={`M${v.x} ${v.y} L${v.x - 30} ${v.y + 22} M${e.x} ${e.y} L${e.x + 18} ${e.y + 26}`}
                stroke={warm}
                strokeWidth={2}
              />
              <circle cx={v.x} cy={v.y} r={6} fill={warm} />
              <text x={v.x - 34} y={v.y + 38} textAnchor="end" style={label}>
                vertex
              </text>
              <text x={e.x + 22} y={e.y + 42} textAnchor="middle" style={label}>
                edge
              </text>
              <text x={f.x} y={f.y + 6} textAnchor="middle" style={label}>
                face
              </text>
            </g>
          );
        }}
      />
    </svg>
  );
}

function Marks() {
  const shapes: [string, Pt[]][] = [
    ["rectangle", rectangle],
    ["rhombus", rhombus],
    ["square", square],
    ["quadrilateral", parallelogram],
  ];
  const cells = shapes.map((_, i) => ({
    x: (i % 2) * 210,
    y: Math.floor(i / 2) * 135,
    width: 210,
    height: 105,
  }));
  const ts = fitItems(
    shapes.map(([, p]) => [poly(p)]),
    cells,
    12,
    0,
  );
  return (
    <svg
      viewBox="0 0 420 270"
      role="img"
      aria-label="A rectangle with 4 right angles, a rhombus with 4 equal sides, a square with both, and a slanted quadrilateral with neither"
      data-lesson-illustration="quadrilateral-marks"
      style={svgStyle}
    >
      {shapes.map(([label, p], i) => (
        <g key={label}>
          <FlatPath shape={poly(p)} t={ts[i]!} />
          <PolygonMarks points={p} t={ts[i]!} parallel={false} />
          <text x={cells[i]!.x + 105} y={cells[i]!.y + 124} style={name}>
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Tree() {
  const nodes: { label: string; points: Pt[]; x: number; y: number }[] = [
    { label: "quadrilateral", points: irregular, x: 210, y: 0 },
    { label: "parallelogram", points: parallelogram, x: 210, y: 125 },
    { label: "rectangle", points: rectangle, x: 100, y: 250 },
    { label: "rhombus", points: rhombus, x: 320, y: 250 },
    { label: "square", points: square, x: 210, y: 375 },
  ];
  const links: [number, number][] = [
    [0, 1],
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 4],
  ];
  const cells = nodes.map((n) => ({
    x: n.x - 80,
    y: n.y,
    width: 160,
    height: 86,
  }));
  const ts = fitItems(
    nodes.map((n) => [poly(n.points)]),
    cells,
    8,
    0,
  );
  return (
    <svg
      viewBox="0 0 420 485"
      role="img"
      aria-label="A tree: quadrilateral contains parallelogram; parallelogram contains rectangle and rhombus; square is under both rectangle and rhombus"
      data-lesson-illustration="quadrilateral-tree"
      style={svgStyle}
    >
      {links.map(([a, b]) => (
        <path
          key={`${a}-${b}`}
          d={`M${nodes[a]!.x} ${nodes[a]!.y + 108} L${nodes[b]!.x} ${nodes[b]!.y + 2}`}
          stroke="var(--color-figure-grid)"
          strokeWidth={2}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={n.label}>
          <FlatPath shape={poly(n.points)} t={ts[i]!} />
          <PolygonMarks points={n.points} t={ts[i]!} parallel />
          <text x={n.x} y={n.y + 102} style={name}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
