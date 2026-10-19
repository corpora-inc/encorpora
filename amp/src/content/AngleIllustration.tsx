import React from "react";
import { SceneFigure } from "../web/scene/SceneFigure";
import { protractor, scene } from "../math/scene/author";
import type { Element, Point, Scene } from "../math/scene/spec";

const kinds = [
  "degree-turns",
  "protractor-scales",
  "line-ray-segment",
  "angle-kinds",
  "symmetry-folds",
] as const;
export type AngleIllustrationKind = (typeof kinds)[number];
export const isAngleIllustration = (
  kind: string,
): kind is AngleIllustrationKind => (kinds as readonly string[]).includes(kind);

const toward = (c: Point, d: number, r: number): Point => [
  c[0] + r * Math.cos((d * Math.PI) / 180),
  c[1] + r * Math.sin((d * Math.PI) / 180),
];
const label = (id: string, at: Point, text: string): Element => ({
  type: "text",
  id,
  at,
  text,
  font: "sans",
  align: [0, -1],
});

/** Lesson models built with the scene framework, drawn revealed. */
export function AngleIllustration({ kind }: { kind: AngleIllustrationKind }) {
  const caption = {
    "degree-turns":
      "A full turn is 360°. A quarter turn is 90° and a half turn is 180°; twelve equal angles are 30° each.",
    "protractor-scales":
      "Ray BA is at 0 on the left, so read the outer scale: angle ABC is 50°. The inner scale's 130 counts from the right.",
    "line-ray-segment":
      "A line has two arrows, a ray has one endpoint and one arrow, and a segment has two endpoints.",
    "angle-kinds":
      "Acute, right, obtuse and straight angles; then parallel lines, which never meet, and perpendicular lines, which meet at a right angle.",
    "symmetry-folds":
      "A rectangle folds onto itself along its 2 lines of symmetry. Folded on a diagonal, its corners do not match.",
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

const scenes: Record<AngleIllustrationKind, () => Scene> = {
  "degree-turns": () =>
    scene(
      ...[90, 180, 30].flatMap((m, i): Element[] => {
        const c: Point = [i * 2.7, 0];
        return [
          {
            type: "arc",
            id: `turn${i}`,
            center: c,
            r: 1,
            from: 0,
            to: m,
            fill: "accent-strong",
            stroke: "ink",
            width: 2.5,
          },
          {
            type: "circle",
            id: `face${i}`,
            center: c,
            r: 1,
            stroke: "ink",
            width: 2,
          },
          ...(i === 2
            ? Array.from({ length: 12 }, (_, k): Element => ({
                type: "segment",
                id: `spoke${k}`,
                from: c,
                to: toward(c, k * 30, 1),
                stroke: "ink",
                width: 1.25,
              }))
            : []),
          {
            type: "text",
            id: `name${i}`,
            at: [c[0], -1.2],
            text: `${m}°`,
            font: "sans",
            bold: true,
            align: [0, -1],
          },
        ];
      }),
    ).build({
      width: 420,
      title: "Quarter turn, half turn and one twelfth of a turn",
    }),
  "protractor-scales": () =>
    scene(
      protractor([180, 130], ["A", "B", "C"]).id("p").element(),
      {
        type: "circle",
        id: "reading",
        center: toward([0, 0], 130, 0.955),
        r: 0.07,
        stroke: "warm",
        width: 2.5,
      },
      {
        type: "text",
        id: "value",
        at: toward([0, 0], 117, 0.42),
        text: "50°",
        font: "sans",
        bold: true,
        color: "warm",
        halo: true,
      },
    ).build({
      width: 420,
      title: "Reading the outer scale from 0 on the left",
    }),
  "line-ray-segment": () =>
    scene(
      ...(
        [
          ["line", "both"],
          ["ray", "end"],
          ["segment", undefined],
        ] as const
      ).flatMap(([name, arrow], i): Element[] => {
        const y = -i * 1.1;
        const left = arrow === "both" ? -0.8 : 0;
        const right = arrow ? 3.8 : 3;
        return [
          {
            type: "segment",
            id: `${name}`,
            from: [left, y],
            to: [right, y],
            stroke: "ink",
            width: 3,
            ...(arrow ? { arrow } : {}),
          },
          { type: "point", id: `${name}A`, at: [0, y], r: 5, color: "ink" },
          { type: "point", id: `${name}B`, at: [3, y], r: 5, color: "ink" },
          {
            type: "text",
            id: `${name}Aname`,
            at: [0, y],
            text: "A",
            bold: true,
            offset: [0, -14],
          },
          {
            type: "text",
            id: `${name}Bname`,
            at: [3, y],
            text: "B",
            bold: true,
            offset: [0, -14],
          },
          {
            type: "text",
            id: `${name}Label`,
            at: [4.4, y],
            text: name === "segment" ? "line segment AB" : `${name} AB`,
            font: "sans",
            align: [-1, 0],
          },
        ];
      }),
    ).build({ width: 420, title: "A line, a ray and a line segment" }),
  "angle-kinds": () =>
    scene(
      ...(
        [
          ["acute", 50, 0],
          ["right", 90, 1.6],
          ["obtuse", 130, 3.6],
          ["straight", 180, 5.6],
        ] as const
      ).flatMap(([name, m, x]): Element[] => {
        const c: Point = [x, 0];
        return [
          {
            type: "segment",
            id: `${name}0`,
            from: c,
            to: toward(c, 0, 1),
            stroke: "ink",
            width: 3,
          },
          {
            type: "segment",
            id: `${name}1`,
            from: c,
            to: toward(c, m, 1),
            stroke: "ink",
            width: 3,
          },
          m === 90
            ? {
                type: "polyline",
                id: `${name}Mark`,
                points: [
                  toward(c, 0, 0.22),
                  [c[0] + 0.22, c[1] + 0.22],
                  toward(c, 90, 0.22),
                ],
                stroke: "ink",
                width: 2,
              }
            : {
                type: "arc",
                id: `${name}Mark`,
                center: c,
                r: 0.3,
                from: 0,
                to: m,
                stroke: "warm",
                width: 2.5,
              },
          label(`${name}Name`, [c[0] + (m === 180 ? 0 : 0.5), -0.25], name),
        ];
      }),
      {
        type: "segment",
        id: "par0",
        from: [0, -1.6],
        to: [2.6, -1.9],
        stroke: "ink",
        width: 3,
      },
      {
        type: "segment",
        id: "par1",
        from: [0, -2.3],
        to: [2.6, -2.6],
        stroke: "ink",
        width: 3,
      },
      label("parName", [1.3, -2.85], "parallel"),
      {
        type: "segment",
        id: "perp0",
        from: [3.9, -2.1],
        to: [6.3, -2.1],
        stroke: "ink",
        width: 3,
      },
      {
        type: "segment",
        id: "perp1",
        from: [5.1, -1.3],
        to: [5.1, -2.8],
        stroke: "ink",
        width: 3,
      },
      {
        type: "polyline",
        id: "perpMark",
        points: [
          [5.32, -2.1],
          [5.32, -1.88],
          [5.1, -1.88],
        ],
        stroke: "ink",
        width: 2,
      },
      label("perpName", [5.1, -2.95], "perpendicular"),
    ).build({
      width: 420,
      title: "Kinds of angles, and parallel and perpendicular lines",
    }),
  "symmetry-folds": () => {
    // The lower-right half of the second rectangle, folded across its
    // diagonal: its corner reflected exactly.
    const a: Point = [3.4, 0],
      b: Point = [6.4, 1.6],
      p: Point = [6.4, 0];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u: Point = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const along = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
    const q: Point = [
      a[0] + 2 * along * u[0] - (p[0] - a[0]),
      a[1] + 2 * along * u[1] - (p[1] - a[1]),
    ];
    return scene(
      {
        type: "polygon",
        id: "whole",
        points: [
          [0, 0],
          [3, 0],
          [3, 1.6],
          [0, 1.6],
        ],
        fill: "accent-fill",
        stroke: "ink",
        width: 2.5,
      },
      {
        type: "segment",
        id: "axis0",
        from: [1.5, -0.25],
        to: [1.5, 1.85],
        stroke: "warm",
        width: 2.5,
        dash: "dash",
      },
      {
        type: "segment",
        id: "axis1",
        from: [-0.25, 0.8],
        to: [3.25, 0.8],
        stroke: "warm",
        width: 2.5,
        dash: "dash",
      },
      label("wholeName", [1.5, -0.45], "2 lines of symmetry"),
      {
        type: "polygon",
        id: "half",
        points: [[3.4, 1.6], b, a],
        fill: "accent-fill",
        stroke: "ink",
        width: 2.5,
      },
      {
        type: "polygon",
        id: "folded",
        points: [a, q, b],
        fill: "accent-strong",
        stroke: "warm",
        width: 2,
      },
      {
        type: "segment",
        id: "diagonal",
        from: a,
        to: b,
        stroke: "ink",
        width: 2,
        dash: "dash",
      },
      label("foldName", [4.9, -0.45], "a diagonal is not"),
    ).build({ width: 420, title: "Lines of symmetry of a rectangle" });
  },
};
