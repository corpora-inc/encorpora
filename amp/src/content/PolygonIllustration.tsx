import React from "react";
import { SceneFigure } from "../web/scene/SceneFigure";
import { scene } from "../math/scene/author";
import type { Element, Point, Scene } from "../math/scene/spec";
import type { FlatShape } from "../math/scene/components/shapes";
import { project } from "../math/scene/components/solid";
import { place, type Pt } from "../math/shape-figures";

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

/** Exact lesson models, built as scenes and drawn revealed. */
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
      data-lesson-illustration={kind}
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <SceneFigure scene={scenes[kind]()} reveal kind={kind} />
      <figcaption style={{ fontSize: "0.875rem", marginTop: 8 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

const named = (
  id: string,
  at: Point,
  items: [string, Pt[]][],
  marks?: "sides-angles" | "parallel",
): Element => ({
  type: "shapes",
  id,
  at,
  cells: false,
  items: items.map(([caption, points]) => ({
    pieces: [poly(points)],
    caption,
    ...(marks ? { marks } : {}),
  })),
});
const octagon = place(
  Array.from(
    { length: 8 },
    (_, i) =>
      [
        Math.cos(((45 * i + 22.5) * Math.PI) / 180),
        Math.sin(((45 * i + 22.5) * Math.PI) / 180),
      ] as Pt,
  ),
  0,
);

const scenes: Record<PolygonIllustrationKind, () => Scene> = {
  "polygon-names": () =>
    scene(
      named(
        "top",
        [0, 0],
        [
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
        ],
      ),
      named(
        "bottom",
        [0, -3.4],
        [
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
          ["octagon", octagon],
        ],
      ),
    ).build({ width: 420, title: "Polygons named by their sides" }),
  "solid-parts": () => {
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
    const v = project(corner[0], corner[1], 0),
      e = project((corner[0] + next[0]) / 2, (corner[1] + next[1]) / 2, 0),
      f = project((corner[0] + next[0]) / 2, (corner[1] + next[1]) / 2, 1.15);
    const label = (
      id: string,
      at: Point,
      text: string,
      align: [-1 | 0 | 1, -1 | 0 | 1],
    ): Element => ({
      type: "text",
      id,
      at,
      text,
      font: "sans",
      bold: true,
      color: "warm",
      halo: true,
      align,
    });
    return scene(
      {
        type: "solid",
        id: "prism",
        solid: { type: "prism", base: poly(base), height: 1.6 },
      },
      { type: "point", id: "vertex", at: v, r: 6, color: "warm" },
      {
        type: "segment",
        id: "vertexLead",
        from: v,
        to: [v[0] - 0.45, v[1] - 0.3],
        stroke: "warm",
        width: 2,
      },
      label("vertexName", [v[0] - 0.5, v[1] - 0.32], "vertex", [1, -1]),
      {
        type: "segment",
        id: "edgeLead",
        from: e,
        to: [e[0] + 0.25, e[1] - 0.4],
        stroke: "warm",
        width: 2,
      },
      label("edgeName", [e[0] + 0.27, e[1] - 0.43], "edge", [0, -1]),
      label("faceName", f, "face", [0, 0]),
    ).build({ width: 360, title: "A face, an edge and a vertex of a prism" });
  },
  "quadrilateral-marks": () =>
    scene({
      ...named(
        "marks",
        [0, 0],
        [
          ["rectangle", rectangle],
          ["rhombus", rhombus],
          ["square", square],
          ["quadrilateral", parallelogram],
        ],
        "sides-angles",
      ),
    } as Element).build({
      width: 420,
      title: "Right-angle and equal-side marks",
    }),
  "quadrilateral-tree": () => {
    const nodes: [string, Pt[], Point][] = [
      ["quadrilateral", irregular, [0, 0]],
      ["parallelogram", parallelogram, [0, -3]],
      ["rectangle", rectangle, [-3, -6]],
      ["rhombus", rhombus, [3, -6]],
      ["square", square, [0, -9]],
    ];
    const links: [number, number][] = [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 4],
    ];
    return scene(
      ...links.map(([a, b]): Element => ({
        type: "segment",
        id: `link${a}${b}`,
        from: [nodes[a]![2][0], nodes[a]![2][1] - 1.55],
        to: [nodes[b]![2][0], nodes[b]![2][1] + 1.05],
        stroke: "grid",
        width: 2,
      })),
      ...nodes.map(([caption, points, at], i) =>
        named(`node${i}`, at, [[caption, points]], "parallel"),
      ),
    ).build({
      width: 420,
      maxHeight: 560,
      title: "The quadrilateral family tree",
    });
  },
};
