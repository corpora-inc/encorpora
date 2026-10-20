import React from "react";
import { SceneFigure } from "../web/scene/SceneFigure";
import { scene } from "../math/scene/author";
import type { Element, Point, Scene } from "../math/scene/spec";
import type { FlatShape } from "../math/scene/components/shapes";
import { place, type Pt } from "../math/shape-figures";

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
const circle = (r: number): FlatShape => ({
  type: "ellipse",
  center: [0, 0],
  radii: [r, r],
  angle: 0,
});
const name = (id: string, at: Point, text: string): Element => ({
  type: "text",
  id,
  at,
  text,
  font: "sans",
  align: [0, -1],
});

/** Exact lesson models, built as scenes and drawn revealed. */
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

const scenes: Record<ShapeIllustrationKind, () => Scene> = {
  "flat-shape-names": () => {
    const row = (
      id: string,
      at: Point,
      items: [string, FlatShape][],
    ): Element => ({
      type: "shapes",
      id,
      at,
      cells: false,
      items: items.map(([caption, shape]) => ({ pieces: [shape], caption })),
    });
    return scene(
      row(
        "top",
        [0, 0],
        [
          ["triangle", poly(regular(3, 1, -90))],
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
        ],
      ),
      row(
        "bottom",
        [0, -3.1],
        [
          ["hexagon", poly(regular(6, 1, 0))],
          ["circle", circle(0.95)],
          ["square", poly(square(1.1))],
        ],
      ),
    ).build({ width: 420, title: "Flat shapes, named" });
  },
  "solid-shape-names": () =>
    scene(
      ...(
        [
          [
            "cube",
            {
              type: "prism",
              base: poly(place(square(2), 30)),
              height: 2,
            },
          ],
          ["cylinder", { type: "prism", base: circle(1), height: 2.2 }],
          ["cone", { type: "pyramid", base: circle(1), height: 2.4 }],
          ["sphere", { type: "sphere", radius: 1.2 }],
        ] as const
      ).flatMap(([label, solid], i): Element[] => [
        {
          type: "solid",
          id: label,
          at: [i * 3, label === "sphere" ? 0.9 : 0],
          solid,
        },
        name(`${label}Name`, [i * 3, -0.8], label),
      ]),
    ).build({ width: 420, title: "Solid shapes, named" }),
  "compose-outline": () => {
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
        return p.map(
          ([x, y]) => [x + (m[0] - c[0]) * k, y + (m[1] - c[1]) * k] as Pt,
        );
      });
    const fills = ["accent-fill", "gold-fill", "warm-fill"] as const;
    const pieces = (id: string, ps: Pt[][], at: Pt): Element[] =>
      ps.map((p, j) => ({
        type: "polygon",
        id: `${id}${j}`,
        points: p.map(([x, y]) => [x + at[0], y + at[1]] as Point),
        fill: fills[j % 3],
        stroke: "ink",
        width: 2.5,
      }));
    const arrow = (id: string, y: number): Element => ({
      type: "segment",
      id,
      from: [3.1, y],
      to: [4, y],
      stroke: "warm",
      width: 3,
      arrow: "end",
    });
    return scene(
      ...pieces("halfApart", apart(halves, [1, 1], 0.45), [0, 0]),
      arrow("arrow0", 1),
      ...pieces("half", halves, [5, 0]),
      ...pieces("wedgeApart", apart(wedges, [0, 0], 0.5), [1, -2.6]),
      arrow("arrow1", -2.6),
      ...pieces("wedge", wedges, [6, -2.6]),
    ).build({ width: 400, title: "Pieces slide together into a larger shape" });
  },
  "count-around": () => {
    const points: Point[] = [
      [0, 0],
      [3, 0],
      [3.6, 1.6],
      [1.6, 2.7],
      [-0.4, 1.5],
    ];
    const c: Point = [1.56, 1.16];
    return scene(
      {
        type: "polygon",
        id: "shape",
        points,
        fill: "accent-fill",
        stroke: "ink",
        width: 2.5,
      },
      ...points.map((p, i): Element => {
        const q = points[(i + 1) % points.length]!;
        const m: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const d = Math.hypot(m[0] - c[0], m[1] - c[1]);
        return {
          type: "text",
          id: `side${i}`,
          at: [
            m[0] + ((m[0] - c[0]) / d) * 0.35,
            m[1] + ((m[1] - c[1]) / d) * 0.35,
          ],
          text: String(i + 1),
          font: "sans",
          bold: true,
          color: "warm",
        };
      }),
      { type: "point", id: "start", at: [0, 0], r: 7, color: "warm" },
    ).build({ width: 360, title: "Counting sides once around" });
  },
};
