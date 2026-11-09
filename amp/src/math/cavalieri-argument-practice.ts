import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { sceneFigure } from "./geometry-teaching-figures";
import {
  defineGenerate,
  entry,
  multiPartCapability,
  multiPartProblem,
  pick,
  shuffle,
  type Random,
  type Slot,
} from "./multi-part-support";
import { scene as sceneOf } from "./scene/author";
import type { Element, Point } from "./scene/spec";
import { defineAxis } from "./variation/axes";

/**
 * HSG.GMD.A.2: informal Cavalieri arguments for the volume of a sphere and
 * of other solids. Three types:
 *
 * - `cavalieri-sphere-argument` (single choice): justify a step of the
 *   hemisphere–versus–cylinder-minus-cone argument, choose the next step,
 *   find the flaw in a student's argument, or choose the complete one.
 * - `cavalieri-slice-area-check` (multi-part choice): compute both slice
 *   areas at a numeric height and draw the conclusion; for the sphere pair,
 *   the cone–pyramid pair, the hemisphere–cone pair (where the slices differ)
 *   and the closing volume computation.
 * - `cavalieri-other-solids-argument` (single choice): oblique solids, the
 *   cone from the pyramid, the three pyramids of a prism, testing the
 *   principle's hypothesis, a flawed claim, and the principle's statement.
 *
 * Every figure is a side view drawn with scene primitives: a semicircle for
 * the hemisphere, a rectangle with an inscribed triangle for the cylinder
 * with a cone removed, the cutting line at height y and its sections.
 */

const band = "9–12" as const;
const skillId = "cavalieri-principle";
const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
export const cavalieriArgumentTemplates: readonly TemplateMetadata[] = [
  {
    id: "cavalieri-sphere-argument",
    version: 1,
    title: "Argue for the sphere's volume with Cavalieri's principle",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.4,
    ...choice,
    ...scenes,
    description:
      "Work with the argument that a hemisphere of radius $r$ has the volume of a cylinder of radius $r$ and height $r$ with a cone removed: justify a step, choose the next step, find the flaw in a student's argument (including ones whose conclusion is right), or choose the correct and complete argument.",
  },
  {
    id: "cavalieri-slice-area-check",
    version: 1,
    title: "Check the slices: equal areas at a chosen height",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.3,
    ...multiPartCapability,
    ...scenes,
    description:
      "At a numeric height, find the slice areas of a hemisphere and of a cylinder with a cone removed, of a pyramid and a cone with equal bases and heights, or of a hemisphere and a cone whose slices differ, and say what the slices show; or finish the sphere argument's volume computation. Exact multiples of $\\pi$ throughout.",
  },
  {
    id: "cavalieri-other-solids-argument",
    version: 1,
    title: "Cavalieri arguments for oblique solids, cones and pyramids",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.35,
    ...choice,
    ...scenes,
    description:
      "Choose the Cavalieri argument for an oblique cylinder's volume, the reason a cone's slices match a pyramid's, why two of the three pyramids cut from a prism have equal volume, whether slices that match at two heights are enough, the flaw in a claim from equal bases and heights, and the correct statement of the principle.",
  },
];

/* ---------------------------------------------------------------- figures */

type SolidKind =
  | "hemisphere"
  | "cylinder"
  | "cylinder-minus-cone"
  | "cone"
  | "pyramid"
  | "oblique";
interface Drawn {
  kind: SolidKind;
  name: string;
}
/** The x-extents of a solid's section at height y, centered at cx, with
 * radius (half-width) r and height h. */
function section(
  kind: SolidKind,
  cx: number,
  r: number,
  h: number,
  y: number,
): [number, number][] {
  switch (kind) {
    case "hemisphere": {
      const s = Math.sqrt(Math.max(0, r * r - y * y));
      return [[cx - s, cx + s]];
    }
    case "cylinder":
      return [[cx - r, cx + r]];
    case "cylinder-minus-cone": {
      const c = (r * y) / h;
      return [
        [cx - r, cx - c],
        [cx + c, cx + r],
      ];
    }
    case "cone": {
      const s = (r * (h - y)) / h;
      return [[cx - s, cx + s]];
    }
    case "pyramid": {
      const a = 0.35 * r;
      return [[cx - r + ((a + r) * y) / h, cx + r + ((a - r) * y) / h]];
    }
    case "oblique": {
      const lean = 0.7 * r;
      return [[cx - r + (lean * y) / h, cx + r + (lean * y) / h]];
    }
  }
}
function outline(kind: SolidKind, cx: number, r: number, h: number): Element[] {
  const poly = (
    id: string,
    points: Point[],
    fill: "accent-fill" | "warm-fill" = "accent-fill",
  ): Element => ({
    type: "polygon",
    id,
    points,
    fill,
    stroke: "ink",
    width: 2,
  });
  switch (kind) {
    case "hemisphere":
      return [
        poly(
          `${kind}`,
          Array.from({ length: 41 }, (_, i): Point => {
            const t = (Math.PI * i) / 40;
            return [cx + r * Math.cos(t), r * Math.sin(t)];
          }),
        ),
      ];
    case "cylinder":
      return [
        poly(kind, [
          [cx - r, 0],
          [cx + r, 0],
          [cx + r, h],
          [cx - r, h],
        ]),
      ];
    case "cylinder-minus-cone":
      return [
        poly("cyl", [
          [cx - r, 0],
          [cx + r, 0],
          [cx + r, h],
          [cx - r, h],
        ]),
        {
          ...poly(
            "removed",
            [
              [cx, 0],
              [cx + r, h],
              [cx - r, h],
            ],
            "warm-fill",
          ),
          stroke: "warm",
          dash: "dash",
        } as Element,
      ];
    case "cone":
      return [
        poly(kind, [
          [cx - r, 0],
          [cx + r, 0],
          [cx, h],
        ]),
      ];
    case "pyramid":
      return [
        poly(kind, [
          [cx - r, 0],
          [cx + r, 0],
          [cx + 0.35 * r, h],
        ]),
      ];
    case "oblique": {
      const lean = 0.7 * r;
      return [
        poly(kind, [
          [cx - r, 0],
          [cx + r, 0],
          [cx + r + lean, h],
          [cx - r + lean, h],
        ]),
      ];
    }
  }
}
const label = (
  id: string,
  at: Point,
  text: string,
  offset: [number, number] = [0, 0],
  align: [-1 | 0 | 1, -1 | 0 | 1] = [0, 0],
  font: "math" | "sans" = "math",
): Element => ({
  type: "text",
  id,
  at,
  text,
  font,
  size: font === "sans" ? "sm" : "md",
  halo: true,
  offset,
  align,
});

/** Two solids side by side on one ground line, cut by a plane at height y
 * (when given). `marks` adds the hemisphere's right triangle and the
 * removed cone's radius at height y. Labels are the shown values. */
function pairFigure(o: {
  left: Drawn;
  right: Drawn;
  r: number;
  h: number;
  y?: number;
  marks?: boolean;
  labels: { r?: string; h?: string; y?: string };
  title: string;
  note?: string;
}): SemanticFigure {
  const { r, h, y } = o;
  const gap = 0.7 * r;
  const lean = o.left.kind === "oblique" || o.right.kind === "oblique";
  const cx1 = 0,
    cx2 = 2 * r + gap + (lean ? 0.35 * r : 0);
  const right = cx2 + r + (o.right.kind === "oblique" ? 0.7 * r : 0);
  const elements: Element[] = [
    {
      type: "segment",
      id: "ground",
      from: [cx1 - r - 0.25 * r, 0],
      to: [right + 0.25 * r, 0],
      stroke: "ink",
      width: 1.5,
    },
    ...outline(o.left.kind, cx1, r, h).map(
      (e, i) => ({ ...e, id: `l${i}` }) as Element,
    ),
    ...outline(o.right.kind, cx2, r, h).map(
      (e, i) => ({ ...e, id: `r${i}` }) as Element,
    ),
    label("ln", [cx1, 0], o.left.name, [0, 8], [0, -1], "sans"),
    label("rn", [cx2, 0], o.right.name, [0, 8], [0, -1], "sans"),
  ];
  if (y !== undefined) {
    elements.push({
      type: "segment",
      id: "plane",
      from: [cx1 - r - 0.2 * r, y],
      to: [right + 0.2 * r, y],
      stroke: "gold",
      width: 1.5,
      dash: "dash",
    });
    const cuts = [
      ...section(o.left.kind, cx1, r, h, y),
      ...section(o.right.kind, cx2, r, h, y),
    ];
    cuts.forEach(([a, b], i) => {
      if (b - a > 1e-6)
        elements.push({
          type: "segment",
          id: `cut${i}`,
          from: [a, y],
          to: [b, y],
          stroke: "gold",
          width: 4,
        });
    });
    if (o.labels.y)
      elements.push({
        type: "brace",
        id: "ybrace",
        from: [cx1 - r - 0.2 * r, 0],
        to: [cx1 - r - 0.2 * r, y],
        label: o.labels.y,
        stroke: "accent",
      });
  }
  if (o.labels.h)
    elements.push({
      type: "brace",
      id: "hbrace",
      from: [right + 0.2 * r, h],
      to: [right + 0.2 * r, 0],
      label: o.labels.h,
      stroke: "accent",
    });
  if (o.labels.r) {
    const left = o.left.kind;
    if (o.marks && y !== undefined && left === "hemisphere") {
      const s = Math.sqrt(r * r - y * y);
      elements.push(
        {
          type: "segment",
          id: "hyp",
          from: [cx1, 0],
          to: [cx1 + s, y],
          stroke: "accent",
          width: 2,
          dash: "dash",
        },
        {
          type: "segment",
          id: "leg",
          from: [cx1, 0],
          to: [cx1, y],
          stroke: "accent",
          width: 2,
          dash: "dash",
        },
        {
          type: "polyline",
          id: "sq",
          points: [
            [cx1, y - 0.09 * r],
            [cx1 + 0.09 * r, y - 0.09 * r],
            [cx1 + 0.09 * r, y],
          ],
          stroke: "accent",
          width: 1.5,
        },
        label("hr", [cx1 + s / 2, y / 2], o.labels.r, [8, 4], [-1, -1]),
      );
    } else
      elements.push(
        {
          type: "segment",
          id: "lr",
          from: [cx1, 0],
          to: [cx1 + r, 0],
          stroke: "accent",
          width: 2,
        },
        label("lrl", [cx1 + r / 2, 0], o.labels.r, [0, -6], [0, 1]),
      );
    if (o.right.kind === "cylinder-minus-cone" || o.right.kind === "cylinder")
      elements.push(
        {
          type: "segment",
          id: "rr",
          from: [cx2, h],
          to: [cx2 + r, h],
          stroke: "accent",
          width: 2,
        },
        label("rrl", [cx2 + r / 2, h], o.labels.r, [0, -6], [0, 1]),
      );
    if (o.marks && y !== undefined && o.right.kind === "cylinder-minus-cone")
      elements.push(
        {
          type: "segment",
          id: "inner",
          from: [cx2, y],
          to: [cx2 + (r * y) / h, y],
          stroke: "warm",
          width: 2,
          dash: "dash",
        },
        label(
          "il",
          [cx2 + (r * y) / (2 * h), y],
          o.labels.y ?? "y",
          [0, 6],
          [0, -1],
        ),
      );
  }
  return sceneFigure(
    sceneOf(...elements).build({
      title: o.title,
      ...(o.note ? { note: o.note } : {}),
    }),
  );
}

/** The standard pair: hemisphere and cylinder with a cone removed, radius
 * and height r, cut at height y. */
function spherePair(
  r: number,
  y: number,
  labels: { r: string; y: string },
  marks = true,
) {
  return pairFigure({
    left: { kind: "hemisphere", name: "hemisphere" },
    right: { kind: "cylinder-minus-cone", name: "cylinder minus cone" },
    r,
    h: r,
    y,
    marks,
    labels,
    title: `A hemisphere of radius ${labels.r} beside a cylinder of radius ${labels.r} and height ${labels.r} with a cone removed, both cut by a plane at height ${labels.y}`,
    note: "Side view. The removed cone is shaded with a dashed edge; the cut sections are drawn heavy.",
  });
}

/* ------------------------------------------------------------- problems */

type Opt = { label: string; correct?: true; feedback?: string };
function choiceProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: {
    prompt: string;
    options: Opt[];
    hint: string;
    explanation: string[];
    figure?: SemanticFigure;
  },
): GeneratedProblem {
  const options = shuffle(r, [...built.options]);
  if (
    options.length !== 4 ||
    options.filter((o) => o.correct).length !== 1 ||
    new Set(options.map((o) => o.label)).size !== 4
  )
    throw new Error(`${meta.id}: four distinct options, one correct`);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const shown = options.map((o, i) => {
    const id = `option-${"abcd"[i]}`;
    if (o.correct) answer = id;
    else choiceFeedback[id] = o.feedback!;
    return { id, label: o.label };
  });
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response: { kind: "choice", label: "Choose one answer", options: shown },
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer,
    hint: built.hint,
    explanation: built.explanation,
    choiceFeedback,
  };
}

/* -------------------------------------------- 1. the sphere's argument */

const SETUP =
  "A hemisphere of radius $r$ stands on its flat face. Beside it stands a cylinder of radius $r$ and height $r$ with a cone removed: the cone's tip is at the center of the cylinder's base, and its base is the cylinder's top.";
/** The reference argument, steps S1–S6. */
export const STEPS = [
  "Set the hemisphere beside the cylinder with the cone removed; both have height $r$.",
  "At height $y$ the hemisphere's slice is a circle of radius $\\sqrt{r^2-y^2}$, with area $\\pi(r^2-y^2)$.",
  "At height $y$ the other slice is a ring with radii $r$ and $y$, with area $\\pi r^2-\\pi y^2$.",
  "The two slices have equal area at every height $y$, and both solids have height $r$.",
  "By Cavalieri's principle, the two solids have equal volume.",
  "So the hemisphere's volume is $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$, and the sphere's is $\\frac43\\pi r^3$.",
] as const;
const stepsText = (k: number) =>
  STEPS.slice(0, k)
    .map((s, i) => `Step ${i + 1}: ${s}`)
    .join(" ");

const sphereAxes = {
  task: defineAxis(
    "task",
    [
      "justify-inner",
      "justify-slice",
      "justify-principle",
      "justify-volume",
      "next-step",
      "flaw-cylinder",
      "flaw-inverted-cone",
      "flaw-linear-radius",
      "flaw-heights",
      "flaw-two-heights",
      "complete",
    ] as const,
    { weights: [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1] },
  ),
};
type SphereTask = (typeof sphereAxes.task.values)[number];

/** The full argument for the explanation's last line. */
const REFERENCE = [
  "The reference argument: at height $y$ the hemisphere's slice has radius $\\sqrt{r^2-y^2}$ by the Pythagorean theorem, so its area is $\\pi(r^2-y^2)$.",
  "The cone's radius equals its height at every level, so the ring has inner radius $y$ and area $\\pi r^2-\\pi y^2=\\pi(r^2-y^2)$.",
  "The slices are equal at every height and both solids have height $r$, so Cavalieri's principle gives equal volumes: $\\pi r^2\\cdot r-\\frac13\\pi r^2\\cdot r=\\frac23\\pi r^3$. The sphere is two hemispheres, $\\frac43\\pi r^3$.",
];

function sphereProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  task: SphereTask,
): GeneratedProblem {
  // The figure is drawn to one scale; its labels stay symbolic.
  const R = pick(r, [4, 5, 6, 8, 10]);
  const Y = Math.round(R * (0.3 + 0.1 * r(0, 5)) * 10) / 10;
  const figure = spherePair(R, Y, { r: "r", y: "y" });
  const done = (o: {
    prompt: string;
    options: Opt[];
    hint: string;
    explanation: string[];
  }) => choiceProblem(meta, seed, r, { ...o, figure });

  switch (task) {
    case "justify-inner":
      return done({
        prompt: `${SETUP} Step 3 of the argument says the slice of the cylinder with the cone removed, at height $y$, is a ring with inner radius $y$. Which reason justifies that inner radius?`,
        options: [
          {
            label:
              "The cone's radius is $r$ at height $r$ and grows at the same rate as the height, so it is $y$ at height $y$.",
            correct: true,
          },
          {
            label:
              "The sphere's radius is $r$, so every circle in the figure has a radius tied to $r$.",
            feedback:
              "The sphere's radius belongs to the other solid. The ring's inner edge is the cone's edge, so its radius comes from the cone.",
          },
          {
            label: "Every slice of a cone is the same circle as its base.",
            feedback:
              "That describes a cylinder. A cone's slices shrink toward its tip, which here is at the bottom.",
          },
          {
            label:
              "The cone's radius shrinks by 1 for each unit of height, starting from $r$ at the bottom.",
            feedback:
              "That is a cone with its tip at the top. This cone's tip is at the bottom center, so its radius grows from 0 to $r$.",
          },
        ],
        hint: "Step 3's inner circle is the edge of the removed cone. Its tip is at height 0 and its radius is $r$ at height $r$. How wide is it at height $y$?",
        explanation: [
          "The ring's inner circle is where the plane cuts the removed cone.",
          "The cone's tip is at the center of the base, and its radius is $r$ at height $r$. By similar triangles its radius over its height is $\\frac{r}{r}=1$ at every level, so at height $y$ its radius is $y$.",
          "So the ring has outer radius $r$, inner radius $y$, and area $\\pi r^2-\\pi y^2$.",
        ],
      });
    case "justify-slice":
      return done({
        prompt: `${SETUP} Step 2 of the argument says the hemisphere's slice at height $y$ has radius $\\sqrt{r^2-y^2}$. Why?`,
        options: [
          {
            label:
              "A sphere radius to the slice's edge is the hypotenuse of a right triangle with legs $y$ and the slice radius.",
            correct: true,
          },
          {
            label:
              "The radius shrinks by $y$ as the slice rises, so it is $r-y$.",
            feedback:
              "The radius does not shrink at a steady rate: a sphere is round, not cone-shaped. And $r-y$ is not $\\sqrt{r^2-y^2}$.",
          },
          {
            label:
              "Every slice of the hemisphere is a great circle, so its radius is $r$.",
            feedback:
              "Only the bottom slice, at $y=0$, is a great circle. Higher slices are smaller.",
          },
          {
            label: "The area formula $\\pi r^2$ gives the radius.",
            feedback:
              "The area formula needs the radius first; it cannot be the reason for it.",
          },
        ],
        hint: "In Step 2, join the hemisphere's center to the edge of the slice at height $y$. That segment is $r$ long. Which right triangle does it make?",
        explanation: [
          "Join the center of the flat face to a point on the edge of the slice. That segment is a radius of the sphere, so its length is $r$.",
          "It is the hypotenuse of a right triangle whose legs are the height $y$ and the slice's radius $s$. By the Pythagorean theorem, $s^2+y^2=r^2$, so $s=\\sqrt{r^2-y^2}$.",
          "The slice's area is $\\pi s^2=\\pi(r^2-y^2)$.",
        ],
      });
    case "justify-principle":
      return done({
        prompt: `${SETUP} ${stepsText(5).replace(/^.*?(Step 4)/, "$1")} Which fact lets the argument go from Step 4 to Step 5?`,
        options: [
          {
            label:
              "Cavalieri's principle: solids of the same height with equal slice areas at every height have equal volumes.",
            correct: true,
          },
          {
            label:
              "Solids with the same base area and the same height have equal volumes.",
            feedback:
              "That is false: a cone and a cylinder can share a base and a height. The slices must match at every height.",
          },
          {
            label: "Solids with the same height have equal volumes.",
            feedback:
              "That is false: height alone says nothing about how much space a solid fills.",
          },
          {
            label: "Congruent solids have equal volumes.",
            feedback:
              "That fact is true, but these solids are not congruent: one is round, the other has a hole.",
          },
        ],
        hint: "Step 4 compares slices at every height and the heights of the solids. Which principle turns that comparison into a statement about volumes?",
        explanation: [
          "Step 4 says the slices have equal area at every height and the solids have the same height.",
          "Cavalieri's principle says exactly that this is enough: two solids of the same height whose slices at every height have equal areas have equal volumes.",
          "Equal bases and heights are not enough, height alone is not, and the solids are not congruent.",
        ],
      });
    case "justify-volume":
      return done({
        prompt: `${SETUP} Step 6 computes the volume of the cylinder with the cone removed as $\\pi r^3-\\frac13\\pi r^3$. Why?`,
        options: [
          {
            label:
              "The cylinder's volume is $Bh=\\pi r^2\\cdot r$; the cone has the same base and height, so its volume is $\\frac13Bh$.",
            correct: true,
          },
          {
            label:
              "The cylinder's volume is $\\pi r^2\\cdot r$, and the cone's volume is also $\\pi r^2\\cdot r$.",
            feedback:
              "A cone holds one third of the cylinder with the same base and height, not all of it.",
          },
          {
            label:
              "The cylinder's volume is $2\\pi r\\cdot r$, its curved surface area.",
            feedback:
              "$2\\pi r\\cdot r$ is the area of the curved side, not the space inside. Volume is base area times height.",
          },
          {
            label:
              "The cone's volume is half the cylinder's, $\\frac12\\pi r^2\\cdot r$.",
            feedback:
              "A cone is one third, not one half, of the cylinder with the same base and height.",
          },
        ],
        hint: "Step 6 subtracts two volumes. The cylinder and the removed cone share a base of area $\\pi r^2$ and the height $r$. What is each volume?",
        explanation: [
          "The cylinder has base area $B=\\pi r^2$ and height $r$, so its volume is $Bh=\\pi r^2\\cdot r=\\pi r^3$.",
          "The removed cone has the same base and height, so its volume is $\\frac13Bh=\\frac13\\pi r^3$.",
          "What is left is $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$, the hemisphere's volume.",
        ],
      });
    case "next-step": {
      const k = r(2, 5);
      // The closing volume needs Step 5, which is never shown before it,
      // so it is the one true statement that cannot come next. (After
      // Steps 1–3, Step 5 already follows from the two slice areas.)
      const later =
        k < 5
          ? [
              {
                label: STEPS[5]!,
                feedback:
                  "That statement is true, but it comes later: it uses Cavalieri's principle to make the volumes equal, which has not been stated yet.",
              },
            ]
          : [];
      const false1: Opt = {
        label:
          "At height $y$ the hemisphere's slice is a circle of radius $r$.",
        feedback:
          "Only the bottom slice has radius $r$. Higher slices are smaller.",
      };
      const false2: Opt = {
        label:
          "So the hemisphere's volume is $\\pi r^3$, the cylinder's volume.",
        feedback:
          "The cone was removed from the cylinder; the hemisphere matches what is left, not the whole cylinder.",
      };
      const false3: Opt = {
        label: "At height $y$ the ring's inner radius is $r-y$.",
        feedback:
          "The cone's tip is at the bottom, so its radius grows with the height: it is $y$, not $r-y$.",
      };
      const pool = [...later.slice(0, 1), false1, false2, false3].slice(0, 3);
      return done({
        prompt: `${SETUP} The argument so far: ${stepsText(k)} Which statement comes next?`,
        options: [{ label: STEPS[k]!, correct: true }, ...pool],
        hint: `Step ${k} is the last one shown. Which statement uses Steps 1 to ${k} and nothing that has not been shown yet?`,
        explanation: [
          "Each step of an argument may use only the steps above it.",
          `After Step ${k}, the next step is: ${STEPS[k]!}`,
          k === 2
            ? "Step 4 compares the two slice areas, so both must be found first."
            : k === 3
              ? "Both slice areas are found, so the argument can now say they are equal at every height. Cavalieri's principle needs that first."
              : k === 4
                ? "The slices are equal at every height and the heights match, which is exactly what Cavalieri's principle needs."
                : "The volumes are equal, so the hemisphere's volume is the cylinder's minus the cone's.",
        ],
      });
    }
    case "flaw-cylinder":
      return done({
        prompt:
          "A student argues: Step 1: Compare a hemisphere of radius $r$ with a cylinder of radius $r$ and height $r$. Step 2: At every height $y$, each solid's slice is a circle of radius $r$. Step 3: By Cavalieri's principle, the volumes are equal. Step 4: So the hemisphere's volume is $\\pi r^3$. Which step is wrong, and why?",
        options: [
          {
            label:
              "Step 2: the hemisphere's slice at height $y$ has radius $\\sqrt{r^2-y^2}$, not $r$.",
            correct: true,
          },
          {
            label: "Step 1: the cylinder should have height $2r$.",
            feedback:
              "The hemisphere is $r$ tall, so a comparison solid must also be $r$ tall. Height $2r$ would break Cavalieri's principle.",
          },
          {
            label:
              "Step 3: Cavalieri's principle needs the solids to be congruent.",
            feedback:
              "Cavalieri's principle needs equal heights and equal slice areas at every height, not congruent solids.",
          },
          {
            label: "Nothing is wrong; the hemisphere's volume is $\\pi r^3$.",
            feedback:
              "The hemisphere fits inside that cylinder with room to spare, so its volume is less than $\\pi r^3$.",
          },
        ],
        hint: "Check Step 2 at a height near the top, such as $y$ close to $r$. Is the hemisphere's slice there still as wide as the cylinder's?",
        explanation: [
          "Step 2 is false for the hemisphere. Its slice at height $y$ has radius $\\sqrt{r^2-y^2}$, which shrinks to 0 at the top.",
          "So the slices are not equal, Cavalieri's principle does not apply, and $\\pi r^3$ is too big: it is the whole cylinder.",
          "The fix is to remove a cone from the cylinder, so that its slices are rings of area $\\pi r^2-\\pi y^2=\\pi(r^2-y^2)$.",
          ...REFERENCE.slice(2),
        ],
      });
    case "flaw-inverted-cone":
      return done({
        prompt:
          "A student argues: Step 1: Remove from a cylinder of radius $r$ and height $r$ a cone whose tip is at the center of the top and whose base is the bottom. Step 2: A hemisphere of radius $r$ has slice area $\\pi(r^2-y^2)$ at height $y$. Step 3: The ring at height $y$ has inner radius $y$, so its area is $\\pi r^2-\\pi y^2$. Step 4: The slices match, so by Cavalieri's principle the hemisphere's volume is $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$. Which step is wrong, and why?",
        options: [
          {
            label:
              "Step 3: with the tip on top, the inner radius at height $y$ is $r-y$, so the slices are not equal.",
            correct: true,
          },
          {
            label:
              "Nothing is wrong: the conclusion is correct, so the argument is correct.",
            feedback:
              "A correct conclusion does not make an argument correct. With this cone the slices differ, so Cavalieri's principle cannot be used.",
          },
          {
            label:
              "Step 2: the hemisphere's slice area should be $\\pi(r-y)^2$.",
            feedback:
              "Step 2 is right: the slice radius is $\\sqrt{r^2-y^2}$ by the Pythagorean theorem.",
          },
          {
            label: "Step 4: the cone should be subtracted twice.",
            feedback: "One cone is removed, so its volume is subtracted once.",
          },
        ],
        hint: "In Step 1 the cone's tip is at the top. How wide is that cone at height $y$: $y$, or something else?",
        explanation: [
          "With the tip at the top center and the base at the bottom, the cone is $r$ wide at height 0 and 0 wide at height $r$. At height $y$ its radius is $r-y$, not $y$.",
          "So the ring's area is $\\pi r^2-\\pi(r-y)^2$, which equals $\\pi(r^2-y^2)$ only at $y=\\frac r2$. The slices are not equal at every height, so Cavalieri's principle does not apply.",
          "The conclusion $\\frac23\\pi r^3$ happens to be right, because removing either cone leaves the same volume. A right answer does not make the argument right.",
          ...REFERENCE.slice(1),
        ],
      });
    case "flaw-linear-radius":
      return done({
        prompt:
          "A student argues: Step 1: Set a hemisphere of radius $r$ beside a cylinder of radius $r$ and height $r$ with a cone removed, tip at the center of the base. Step 2: The hemisphere's slice at height $y$ has radius $r-y$, so its area is $\\pi(r-y)^2$. Step 3: The ring at height $y$ has area $\\pi r^2-\\pi y^2$. Step 4: These areas differ, so Cavalieri's principle cannot give the hemisphere's volume. Which step is wrong, and why?",
        options: [
          {
            label:
              "Step 2: the slice radius is $\\sqrt{r^2-y^2}$ by the Pythagorean theorem, so the areas are equal after all.",
            correct: true,
          },
          {
            label: "Step 3: the ring's inner radius should be $r-y$ to match.",
            feedback:
              "Step 3 is right: this cone's tip is at the bottom, so its radius at height $y$ is $y$.",
          },
          {
            label: "Step 4: Cavalieri's principle only needs equal bases.",
            feedback:
              "Equal bases are not enough: the slices must match at every height.",
          },
          {
            label:
              "Nothing is wrong; Cavalieri's principle does not apply here.",
            feedback:
              "It does apply. Step 2 uses the wrong slice radius; with the right one the slices are equal.",
          },
        ],
        hint: "Test Step 2 at $y=0$ and near $y=r$, and then at a middle height. Does a radius of $r-y$ fit a round solid?",
        explanation: [
          "Step 2 is wrong. A sphere radius to the slice's edge is the hypotenuse of a right triangle with legs $y$ and the slice radius, so the slice radius is $\\sqrt{r^2-y^2}$, not $r-y$.",
          "With the correct radius the hemisphere's slice has area $\\pi(r^2-y^2)$, which equals the ring's area $\\pi r^2-\\pi y^2$ at every height.",
          ...REFERENCE.slice(2),
        ],
      });
    case "flaw-heights":
      return done({
        prompt:
          "A student argues: Step 1: Set a hemisphere of radius $r$ beside a cylinder of radius $r$ and height $2r$ with a cone of the same base and height removed, tip at the center of the base. Step 2: Both solids stand on circles of radius $r$. Step 3: By Cavalieri's principle, the two solids have equal volume. Step 4: So the hemisphere's volume is $2\\pi r^3-\\frac23\\pi r^3=\\frac43\\pi r^3$. Which step is wrong, and why?",
        options: [
          {
            label:
              "Step 3: the heights differ, $r$ and $2r$, so the slices cannot be equal at every height.",
            correct: true,
          },
          {
            label: "Step 2: the bases have different areas.",
            feedback:
              "Step 2 is true: both bottoms are circles of radius $r$, with area $\\pi r^2$.",
          },
          {
            label:
              "Nothing is wrong; the hemisphere's volume is $\\frac43\\pi r^3$.",
            feedback:
              "$\\frac43\\pi r^3$ is the whole sphere's volume. The hemisphere has half of that.",
          },
          {
            label:
              "Step 4: the cone's volume should be $\\frac12\\pi r^2\\cdot 2r$.",
            feedback:
              "A cone's volume is $\\frac13Bh$. The cone was not the problem: the solids have different heights.",
          },
        ],
        hint: "Compare the heights in Step 1. Between heights $r$ and $2r$, what is the hemisphere's slice, and what is the other solid's?",
        explanation: [
          "Cavalieri's principle needs two solids of the same height with equal slices at every height.",
          "Between heights $r$ and $2r$ the hemisphere has no slice at all, while the other solid still does. So Step 3 applies the principle to solids it does not fit.",
          "The conclusion is wrong too: $\\frac43\\pi r^3$ is the volume of the whole sphere. With a cylinder of height $r$ the argument gives $\\frac23\\pi r^3$.",
        ],
      });
    case "flaw-two-heights":
      return done({
        prompt:
          "A student argues: Step 1: Set a hemisphere of radius $r$ beside a cylinder of radius $r$ and height $r$ with a cone removed, tip at the center of the base. Step 2: At $y=0$ both slices have area $\\pi r^2$. Step 3: At $y=r$ both slices have area 0. Step 4: The slices match, so by Cavalieri's principle the hemisphere's volume is $\\frac23\\pi r^3$. Which step is wrong, and why?",
        options: [
          {
            label:
              "Step 4: equal slices at two heights are not enough; the slices must be equal at every height.",
            correct: true,
          },
          {
            label: "Step 3: at $y=r$ the slices are not both 0.",
            feedback:
              "Step 3 is true: the hemisphere ends in a point, and the ring at $y=r$ has inner and outer radius $r$.",
          },
          {
            label:
              "Nothing is wrong; two matching slices determine the volume.",
            feedback:
              "Two slices say nothing about the heights between them. A cone and a different solid can match at the bottom and top and still differ.",
          },
          {
            label:
              "Step 1: the cone must be removed from the hemisphere, not the cylinder.",
            feedback:
              "The cone is removed from the cylinder so that its slices become rings matching the hemisphere's slices.",
          },
        ],
        hint: "Steps 2 and 3 check two heights. What does Cavalieri's principle need about the heights in between?",
        explanation: [
          "Cavalieri's principle needs equal slice areas at every height. Steps 2 and 3 check only $y=0$ and $y=r$.",
          "The slices are in fact equal at every height, $\\pi(r^2-y^2)$ for both, but the student never showed it. So Step 4's conclusion, though right, is not justified.",
          ...REFERENCE.slice(0, 2),
        ],
      });
    case "complete":
      return done({
        prompt: `${SETUP} Which argument correctly and completely shows that the hemisphere's volume is $\\frac23\\pi r^3$?`,
        options: [
          {
            label:
              "Equal slices $\\pi(r^2-y^2)$ at every $y$ and equal heights, so by Cavalieri's principle $V=\\pi r^3-\\frac13\\pi r^3$.",
            correct: true,
          },
          {
            label:
              "At $y=0$ both slices have area $\\pi r^2$, so the volumes are equal: $\\pi r^3-\\frac13\\pi r^3$.",
            feedback:
              "One matching slice is not enough. The slices must be equal at every height.",
          },
          {
            label:
              "The slices are equal at every height, so the hemisphere's volume is the cylinder's, $\\pi r^3$.",
            feedback:
              "The hemisphere matches the cylinder with the cone removed, not the whole cylinder.",
          },
          {
            label:
              "Both have base area $\\pi r^2$ and height $r$, so they have equal volume: $\\pi r^3-\\frac13\\pi r^3$.",
            feedback:
              "Equal bases and heights are not enough for Cavalieri's principle: a cone and a cylinder share both.",
          },
        ],
        hint: "To reach $\\frac23\\pi r^3$, a complete argument needs the slice areas at a general height $y$, the matching heights, and the volume of the right solid. Which choice has all three?",
        explanation: [...REFERENCE],
      });
  }
}

/* ---------------------------------------------- 2. check the slices */

const sliceAxes = {
  pair: defineAxis(
    "pair",
    ["sphere", "pyramid-cone", "hemisphere-cone", "sphere-volume"] as const,
    { weights: [3, 3, 2, 2] },
  ),
};
const PYTHAGOREAN: readonly [number, number][] = [
  [5, 3],
  [5, 4],
  [10, 6],
  [10, 8],
  [13, 5],
  [13, 12],
  [15, 9],
  [17, 8],
];
/** (h, y, B) with every slice area an integer. h = 10 uses y = 2, 8 and B a
 * multiple of 25 (the spec's y = 5 is half the height, where two wrong
 * answers coincide). */
const PYRAMIDS: readonly { h: number; y: number; B: readonly number[] }[] = [
  { h: 12, y: 4, B: [36, 45, 63, 72, 90] },
  { h: 12, y: 8, B: [36, 45, 63, 72, 90] },
  { h: 10, y: 2, B: [25, 50, 75, 100] },
  { h: 10, y: 8, B: [25, 50, 75, 100] },
  { h: 8, y: 2, B: [32, 48, 64, 80] },
  { h: 8, y: 6, B: [32, 48, 64, 80] },
  { h: 6, y: 2, B: [27, 36, 45, 54] },
  { h: 6, y: 4, B: [27, 36, 45, 54] },
  { h: 15, y: 5, B: [36, 45, 63, 81] },
  { h: 15, y: 10, B: [36, 45, 63, 81] },
];

/** A multiple of π as TeX: 16π, π, 64/3 π. */
export function piTex(n: number, d = 1, unit = ""): string {
  const g = gcdOf(n, d);
  const [p, q] = [n / g, d / g];
  const body =
    q === 1 ? (p === 1 ? "\\pi" : `${p}\\pi`) : `\\frac{${p}}{${q}}\\pi`;
  return `$${body}$${unit ? ` ${unit}` : ""}`;
}
const gcdOf = (a: number, b: number): number => (b ? gcdOf(b, a % b) : a);

function sliceProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  pair: (typeof sliceAxes.pair.values)[number],
): GeneratedProblem {
  const done = (b: {
    prompt: string;
    slots: Slot[];
    figure: SemanticFigure;
    hint: string;
    explanation: string[];
  }) =>
    multiPartProblem(meta, seed, r, {
      ...b,
      layout: "slots",
      label: "Choose an answer for each part",
    });
  const cm2 = "cm²";

  if (pair === "sphere") {
    let R: number, y: number;
    if (r(0, 4) < 3) [R, y] = pick(r, PYTHAGOREAN);
    else {
      R = r(4, 12);
      const ys = Array.from({ length: R - 1 }, (_, i) => i + 1).filter(
        (v) => 2 * v !== R,
      );
      y = pick(r, ys);
    }
    const area = R * R - y * y;
    const lin = (R - y) ** 2;
    const full = R * R,
      cone = y * y;
    const areaText = (n: number) => piTex(n, 1, cm2);
    return done({
      prompt: `A hemisphere of radius ${R} cm stands beside a cylinder of radius ${R} cm and height ${R} cm with a cone removed. The cone's tip is at the center of the cylinder's base, and its base is the cylinder's top. A plane at height ${y} cm cuts both solids.`,
      slots: [
        {
          id: "hemi",
          label: "Area of the hemisphere's slice",
          correct: areaText(area),
          wrong: [areaText(lin), areaText(full), areaText(cone)],
        },
        {
          id: "ring",
          label: "Area of the ring-shaped slice of the other solid",
          correct: areaText(area),
          wrong: [areaText(full), areaText(lin), areaText(cone)],
        },
        {
          id: "means",
          label: "What the two slices show",
          correct:
            "Equal here; if equal at every height, Cavalieri gives equal volumes",
          wrong: [
            "The slices are equal, so the two solids are congruent",
            "One equal slice is enough to conclude equal volumes",
            "The slices differ, so the volumes differ",
          ],
        },
      ],
      figure: spherePair(R, y, { r: `${R}`, y: `${y}` }),
      hint: `For the hemisphere, draw the radius of ${R} cm to the edge of the slice at height ${y} cm: a right triangle. For the ring, how wide is the removed cone at height ${y} cm?`,
      explanation: [
        `The hemisphere's slice: a radius of ${R} to the slice's edge is the hypotenuse of a right triangle with leg ${y}, so the slice radius squared is $${R}^2-${y}^2=${area}$. The area is ${piTex(area, 1, cm2)}.`,
        `The ring: the cone's radius equals its height, so at height ${y} the inner radius is ${y}. The area is $\\pi\\cdot${R}^2-\\pi\\cdot${y}^2=${full}\\pi-${cone}\\pi=${area}\\pi$ ${cm2}.`,
        `The slices are equal at this height. The same algebra, $\\pi(r^2-y^2)=\\pi r^2-\\pi y^2$, works at every height, and both solids are ${R} cm tall, so Cavalieri's principle gives equal volumes. Equal slices do not make the solids congruent, and one height alone would not be enough.`,
        `So the hemisphere's volume is $\\pi\\cdot${R}^3-\\frac13\\pi\\cdot${R}^3=\\frac23\\pi\\cdot${R}^3$, the formula $\\frac23\\pi r^3$.`,
      ],
    });
  }

  if (pair === "pyramid-cone") {
    const P = pick(r, PYRAMIDS);
    const B = pick(r, P.B);
    const { h, y } = P;
    const k = h - y;
    const key = (B * k * k) / (h * h);
    const linear = (B * k) / h;
    const apex = (B * y * y) / (h * h);
    for (const v of [key, linear, apex])
      if (!Number.isInteger(v)) throw new Error("Need integer slice areas");
    const text = (n: number) => `${n} ${cm2}`;
    const bank = [text(linear), text(apex), text(B)];
    return done({
      prompt: `A pyramid and a cone each have base area ${B} cm² and height ${h} cm. A plane parallel to their bases cuts both at height ${y} cm above the bases.`,
      slots: [
        {
          id: "pyr",
          label: "Area of the pyramid's slice",
          correct: text(key),
          wrong: bank,
        },
        {
          id: "cone",
          label: "Area of the cone's slice",
          correct: text(key),
          wrong: bank,
        },
        {
          id: "means",
          label: "What follows",
          correct:
            "Equal at every height, so the cone's volume is the pyramid's: $\\frac13Bh$",
          wrong: [
            "Equal here, so the cone and the pyramid are congruent",
            "A circle and a polygon can never have equal areas",
            "Equal slice areas mean equal surface areas",
          ],
        },
      ],
      figure: pairFigure({
        left: { kind: "pyramid", name: "pyramid" },
        right: { kind: "cone", name: "cone" },
        r: 4,
        h: 5,
        y: (5 * y) / h,
        labels: { y: `${y}`, h: `${h}` },
        title: `A pyramid and a cone, each with base area ${B} square centimeters and height ${h} centimeters, cut by a plane at height ${y} centimeters`,
        note: "Side view, not to scale.",
      }),
      hint: `At height ${y} cm the slice is a shrunken copy of the base, ${k} cm below the tip of a solid ${h} cm tall. If lengths shrink by a factor, how does the area of ${B} cm² shrink?`,
      explanation: [
        `Each slice is a scaled copy of its base. Its distance from the tip is $${h}-${y}=${k}$, out of ${h}, so every length is multiplied by $\\frac{${k}}{${h}}$.`,
        `Areas scale by the square of that factor: $${B}\\cdot\\left(\\frac{${k}}{${h}}\\right)^2=${key}$ cm². This holds for the pyramid and for the cone alike.`,
        `Scaling the area by $\\frac{${k}}{${h}}$ only gives ${linear} cm², measuring from the base instead of the tip gives ${apex} cm², and ${B} cm² is the base itself.`,
        "The same reasoning works at every height, and the heights are equal, so Cavalieri's principle gives the cone the pyramid's volume, $\\frac13Bh$. Shapes and surface areas are not compared.",
      ],
    });
  }

  if (pair === "hemisphere-cone") {
    const R = pick(r, [4, 6, 8, 10, 12]);
    const y = R / 2;
    const sq = R * R;
    const text = (n: number) => piTex(n, 1, cm2);
    // One bank in one shuffled order for both blanks.
    const bank = shuffle(r, [
      text(sq),
      text(sq / 4),
      text((3 * sq) / 4),
      text(sq / 2),
    ]);
    return done({
      prompt: `A hemisphere of radius ${R} cm and a cone of radius ${R} cm and height ${R} cm stand on the same plane. Both have base area $${sq}\\pi$ cm² and height ${R} cm. A parallel plane cuts both at height ${y} cm.`,
      slots: [
        {
          id: "hemi",
          label: "Area of the hemisphere's slice",
          correct: text((3 * sq) / 4),
          fixed: bank,
        },
        {
          id: "cone",
          label: "Area of the cone's slice",
          correct: text(sq / 4),
          fixed: bank,
        },
        {
          id: "means",
          label: "Does Cavalieri's principle show equal volumes?",
          correct: "No: the slices differ at this height",
          wrong: [
            "Yes: they have the same base area and the same height",
            "Yes: their slices are equal at the bottom and at the top",
            "No: Cavalieri's principle applies only to prisms",
          ],
        },
      ],
      figure: pairFigure({
        left: { kind: "hemisphere", name: "hemisphere" },
        right: { kind: "cone", name: "cone" },
        r: R,
        h: R,
        y,
        labels: { r: `${R}`, y: `${y}` },
        title: `A hemisphere and a cone, each of radius ${R} and height ${R}, cut by a plane at height ${y}`,
      }),
      hint: `At height ${y} cm, use a right triangle with hypotenuse ${R} for the hemisphere's slice. The cone's tip is at height ${R}, so how far below the tip is the slice?`,
      explanation: [
        `The hemisphere's slice has radius squared $${R}^2-${y}^2=${(3 * sq) / 4}$, so its area is ${text((3 * sq) / 4)}.`,
        `The cone's slice is ${y} cm below the tip of a cone ${R} cm tall, so its radius is $${R}\\cdot\\frac{${y}}{${R}}=${y}$ and its area is ${text(sq / 4)}.`,
        `The slices differ at this height, so Cavalieri's principle does not apply. Equal bases and heights, or equal slices at the bottom and top only, are not enough. The principle applies to any solids, not only prisms.`,
        `Indeed the volumes differ: the hemisphere holds $\\frac23\\pi r^3$ and the cone $\\frac13\\pi r^3$.`,
      ],
    });
  }

  // The closing computation of the sphere argument.
  const R = pick(r, [3, 4, 5, 6, 8, 9, 10, 12]);
  const c = R ** 3;
  const v = (n: number, d = 1) => piTex(n, d, "cm³");
  return done({
    prompt: `In the sphere argument, a hemisphere of radius ${R} cm has the same volume as a cylinder of radius ${R} cm and height ${R} cm with a cone of the same base and height removed. Finish the computation.`,
    slots: [
      {
        id: "cyl",
        label: "Volume of the cylinder",
        correct: v(c),
        wrong: [v(2 * c), v(c, 3), v(4 * c, 3)],
      },
      {
        id: "cone",
        label: "Volume of the removed cone",
        correct: v(c, 3),
        wrong: [v(c), v(c, 2), v(2 * c, 3)],
      },
      {
        id: "hemi",
        label: "Volume of the hemisphere",
        correct: v(2 * c, 3),
        wrong: [v(c), v(4 * c, 3), v(c, 3)],
      },
      {
        id: "sphere",
        label: "Volume of the whole sphere",
        correct: v(4 * c, 3),
        wrong: [v(2 * c, 3), v(2 * c), v(c)],
      },
    ],
    figure: pairFigure({
      left: { kind: "hemisphere", name: "hemisphere" },
      right: { kind: "cylinder-minus-cone", name: "cylinder minus cone" },
      r: R,
      h: R,
      labels: { r: `${R}` },
      title: `A hemisphere of radius ${R} beside a cylinder of radius ${R} and height ${R} with a cone removed`,
    }),
    hint: `The cylinder and the cone share base area $\\pi\\cdot${R}^2$ and height ${R} cm. Find each volume, then subtract, then think about how many hemispheres make a sphere.`,
    explanation: [
      `The cylinder: base area times height, $\\pi\\cdot${R}^2\\cdot${R}=${c}\\pi$ cm³.`,
      `The cone: one third of that, ${v(c, 3)}. Not all of it, and not one half.`,
      `The hemisphere equals what is left: $${c}\\pi-${piTex(c, 3).replaceAll("$", "")}=${piTex(2 * c, 3).replaceAll("$", "")}$ cm³.`,
      `A sphere is two hemispheres: $2\\cdot${piTex(2 * c, 3).replaceAll("$", "")}=${piTex(4 * c, 3).replaceAll("$", "")}$ cm³, which is $\\frac43\\pi r^3$ with $r=${R}$.`,
    ],
  });
}

/* --------------------------------------- 3. other solids and the principle */

const otherAxes = {
  task: defineAxis("task", [
    "oblique-argument",
    "oblique-stack",
    "cone-reason",
    "cone-follows",
    "three-pyramids",
    "hypothesis",
    "flaw",
    "statement",
  ] as const),
};
type OtherTask = (typeof otherAxes.task.values)[number];

/** The prism cut into three pyramids, in an oblique view. */
function prismFigure(): SemanticFigure {
  const A: Point = [0, 0],
    B: Point = [4.2, 0],
    C: Point = [1.4, 1.3];
  const up = (p: Point): Point => [p[0], p[1] + 3.4];
  const [D, E, F] = [up(A), up(B), up(C)];
  const edge = (id: string, p: Point, q: Point, hidden = false): Element => ({
    type: "segment",
    id,
    from: p,
    to: q,
    stroke: "ink",
    width: 2,
    ...(hidden ? { dash: "dash" as const } : {}),
  });
  const cut = (id: string, p: Point, q: Point): Element => ({
    type: "segment",
    id,
    from: p,
    to: q,
    stroke: "accent",
    width: 2,
    dash: "dash",
  });
  const name = (
    id: string,
    p: Point,
    t: string,
    dx: number,
    dy: number,
  ): Element => ({
    type: "text",
    id,
    at: p,
    text: t,
    font: "math",
    bold: true,
    offset: [dx, dy],
    align: [0, 0],
  });
  return sceneFigure(
    sceneOf(
      edge("ab", A, B),
      edge("bc", B, C, true),
      edge("ca", C, A, true),
      edge("de", D, E),
      edge("ef", E, F),
      edge("fd", F, D),
      edge("ad", A, D),
      edge("be", B, E),
      edge("cf", C, F, true),
      cut("bd", B, D),
      cut("cd", C, D),
      cut("bf", B, F),
      name("na", A, "A", -10, 8),
      name("nb", B, "B", 10, 8),
      name("nc", C, "C", 10, 6),
      name("nd", D, "D", -10, -8),
      name("ne", E, "E", 10, -8),
      name("nf", F, "F", 0, -12),
    ).build({
      title: "Triangular prism ABC–DEF cut into three pyramids",
      note: "Dashed colored segments BD, CD and BF are the cuts. The pyramids are D-ABC, D-BCF and B-DEF.",
    }),
  );
}

function otherProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  task: OtherTask,
): GeneratedProblem {
  const done = (b: {
    prompt: string;
    options: Opt[];
    hint: string;
    explanation: string[];
    figure: SemanticFigure;
  }) => choiceProblem(meta, seed, r, b);
  const stacks = pairFigure({
    left: { kind: "cylinder", name: "right cylinder" },
    right: { kind: "oblique", name: "oblique cylinder" },
    r: 3,
    h: 6,
    y: 2.4,
    labels: { r: "r", h: "h", y: "y" },
    title:
      "A right cylinder and an oblique cylinder of the same radius and height, cut by a plane at height y",
  });
  const conePyramid = pairFigure({
    left: { kind: "pyramid", name: "pyramid" },
    right: { kind: "cone", name: "cone" },
    r: 4,
    h: 5,
    y: 2,
    labels: { y: "y", h: "h" },
    title:
      "A pyramid and a cone with the same base area and height, cut by a plane at height y",
    note: "Side view, not to scale.",
  });
  const hemiCone = pairFigure({
    left: { kind: "hemisphere", name: "hemisphere" },
    right: { kind: "cone", name: "cone" },
    r: 5,
    h: 5,
    y: 2,
    labels: { r: "r", y: "y" },
    title:
      "A hemisphere and a cone, each of radius r and height r, cut by a plane at height y",
  });

  switch (task) {
    case "oblique-argument":
      return done({
        prompt:
          "An oblique cylinder has base radius $r$ and height $h$, measured straight up between its bases. Which argument shows that its volume is $\\pi r^2h$?",
        options: [
          {
            label:
              "Slices parallel to the base are circles of radius $r$, as in a right cylinder of height $h$; by Cavalieri, $\\pi r^2h$.",
            correct: true,
          },
          {
            label:
              "It is the right cylinder turned on its side, so the two are congruent.",
            feedback:
              "Leaning is not turning: the oblique cylinder has a different shape, so it is not congruent to the right one.",
          },
          {
            label:
              "Its volume is $\\pi r^2$ times the length of its slanted side.",
            feedback:
              "The slanted side is longer than the height. Cavalieri's principle compares slices at the same heights, so the height $h$ is what counts.",
          },
          {
            label:
              "Its curved surface is larger, so its volume is larger than $\\pi r^2h$.",
            feedback:
              "Surface area and volume are different measures. Every slice is still a circle of radius $r$, so the volume is the same.",
          },
        ],
        figure: stacks,
        hint: "Slice both cylinders at the same height $y$ between $0$ and $h$. What shape is each slice, and how does its area compare with the base's, $\\pi r^2$?",
        explanation: [
          "Compare the oblique cylinder with a right cylinder of radius $r$ and height $h$.",
          "Every slice parallel to the base, in either solid, is a circle of radius $r$ with area $\\pi r^2$, and the two solids have the same height $h$.",
          "By Cavalieri's principle they have equal volumes, so the oblique cylinder holds $\\pi r^2h$. The slanted length and the surface area do not enter, and the solids are not congruent.",
        ],
      });
    case "oblique-stack": {
      const R = r(3, 9),
        H = r(5, 12),
        S = H + r(2, 5);
      return done({
        prompt: `A stack of identical coins of radius ${R} cm is ${H} cm tall. It is pushed so that it leans: its slanted side is now ${S} cm long, and its height is still ${H} cm. Which quantity stays the same, and so keeps the volume at $${R * R * H}\\pi$ cm³?`,
        options: [
          {
            label: `The area of every horizontal slice, $${R * R}\\pi$ cm²`,
            correct: true,
          },
          {
            label: `The length of its side, ${H} cm`,
            feedback: `The side is now ${S} cm long. Its length changes; the slices do not.`,
          },
          {
            label: "The angle between its side and the table, $90^\\circ$",
            feedback:
              "The side now leans, so it meets the table at less than $90^\\circ$. The volume stays the same because the slices stay the same.",
          },
          {
            label: "Nothing: leaning changes the volume too",
            feedback:
              "The stack holds the same coins, and each coin is a slice of the same area. Cavalieri's principle keeps the volume.",
          },
        ],
        figure: stacks,
        hint: `Each coin is a slice of radius ${R} cm. Pushing the stack moves the coins sideways. Which measurement of each coin changes?`,
        explanation: [
          `Each coin is a horizontal slice of radius ${R} cm, with area $\\pi\\cdot${R}^2=${R * R}\\pi$ cm². Pushing the stack slides the coins but does not change them.`,
          `The leaning stack and the straight one have the same height, ${H} cm, and equal slices at every height. By Cavalieri's principle their volumes are equal: $${R * R}\\pi\\cdot${H}=${R * R * H}\\pi$ cm³.`,
          `The side grows from ${H} cm to ${S} cm and no longer meets the table at a right angle; the volume does not change.`,
        ],
      });
    }
    case "cone-reason":
      return done({
        prompt:
          "A cone and a pyramid have the same base area $B$ and the same height $h$. Which reason shows that their slices at each height $y$ above the base have equal areas?",
        options: [
          {
            label:
              "Each slice is its base scaled by $\\frac{h-y}{h}$, so both slice areas are $B\\left(\\frac{h-y}{h}\\right)^2$.",
            correct: true,
          },
          {
            label: "Both slices are circles.",
            feedback:
              "The pyramid's slices are polygons like its base. The areas match because both scale the same way.",
          },
          {
            label: "Both slices have area $B$ at every height.",
            feedback:
              "That describes prisms and cylinders. Cones and pyramids narrow toward the tip.",
          },
          {
            label:
              "Both areas are $B\\cdot\\frac{h-y}{h}$, since lengths scale by $\\frac{h-y}{h}$.",
            feedback:
              "Areas scale by the square of the length factor, so the slice area is $B\\left(\\frac{h-y}{h}\\right)^2$.",
          },
        ],
        figure: conePyramid,
        hint: "A slice at height $y$ is $h-y$ below the tip of a solid $h$ tall. If every length shrinks by a factor, what happens to the area?",
        explanation: [
          "A slice at height $y$ is a copy of the base, shrunk toward the tip. Its distance from the tip is $h-y$ out of $h$, so every length is multiplied by $\\frac{h-y}{h}$.",
          "Areas are multiplied by the square of the factor: $B\\left(\\frac{h-y}{h}\\right)^2$. This is true for the cone and for the pyramid, whatever the shape of the base.",
          "So the slices have equal areas at every height, and Cavalieri's principle gives equal volumes.",
        ],
      });
    case "cone-follows":
      return done({
        prompt:
          "A cone and a pyramid have the same base area $B$ and the same height $h$, and their slices have equal areas at every height. What follows?",
        options: [
          {
            label: "The cone's volume equals the pyramid's: $\\frac13Bh$.",
            correct: true,
          },
          {
            label: "The cone and the pyramid are congruent.",
            feedback:
              "A round solid and a solid with flat faces cannot be congruent. Equal slices give equal volumes, not equal shapes.",
          },
          {
            label: "The cone's volume is $Bh$, like a prism's.",
            feedback:
              "A prism's slices all have area $B$. These slices shrink, and the volume is the pyramid's, $\\frac13Bh$.",
          },
          {
            label: "The cone has the larger volume, because its base is round.",
            feedback:
              "The base areas are equal, and so is every slice. Roundness does not add volume.",
          },
        ],
        figure: conePyramid,
        hint: "The slices of the cone and of the pyramid with base $B$ and height $h$ match at every height. Which principle applies, and what is a pyramid's volume?",
        explanation: [
          "Equal heights and equal slice areas at every height are exactly the hypothesis of Cavalieri's principle, so the volumes are equal.",
          "A pyramid's volume is $\\frac13Bh$, so the cone's is $\\frac13Bh$ too. With a circular base of radius $r$, $B=\\pi r^2$ and the cone's volume is $\\frac13\\pi r^2h$.",
        ],
      });
    case "three-pyramids": {
      const ends = r(0, 1) === 0;
      return done({
        prompt: ends
          ? "A right triangular prism $ABC$–$DEF$, with $D$ above $A$, $E$ above $B$ and $F$ above $C$, has a base with three different side lengths. It is cut into three pyramids: $D$-$ABC$, $D$-$BCF$ and $B$-$DEF$. Why do $D$-$ABC$ and $B$-$DEF$ have equal volumes?"
          : "A right triangular prism $ABC$–$DEF$, with $D$ above $A$, $E$ above $B$ and $F$ above $C$, has a base with three different side lengths. It is cut into three pyramids: $D$-$ABC$, $D$-$BCF$ and $B$-$DEF$. Why do $D$-$BCF$ and $B$-$DEF$, written $D$-$BEF$, have equal volumes?",
        options: ends
          ? [
              {
                label:
                  "Their bases $ABC$ and $DEF$ are congruent and their heights are equal, so Cavalieri gives equal volumes.",
                correct: true,
              },
              {
                label: "They are congruent pyramids.",
                feedback:
                  "With three different side lengths, the tip above $A$ and the tip below $E$ sit over different corners, so the pyramids are not congruent.",
              },
              {
                label: "They share a face, so they have equal volumes.",
                feedback:
                  "They share only the edge $\\overline{BD}$, and sharing a face would not make volumes equal anyway.",
              },
              {
                label: "Each is half of the prism.",
                feedback: "The prism is cut into three pyramids, not two.",
              },
            ]
          : [
              {
                label:
                  "Bases $BCF$ and $BEF$ are congruent halves of face $BCFE$ and tip $D$ is shared, so Cavalieri gives equal volumes.",
                correct: true,
              },
              {
                label: "They are congruent pyramids.",
                feedback:
                  "Their bases match, but the tip $D$ sits differently over each one, so congruence is not shown. Equal bases and heights are what count.",
              },
              {
                label: "They share a face, so they have equal volumes.",
                feedback:
                  "They do share face $BDF$, but sharing a face says nothing about volume: what matters is equal bases and equal heights.",
              },
              {
                label: "Each is half of the prism.",
                feedback: "The prism is cut into three pyramids, not two.",
              },
            ],
        figure: prismFigure(),
        hint: ends
          ? "Look at the bases $ABC$ and $DEF$ and at how far each tip is from its base. What do slices at equal distances from the bases have in common?"
          : "Look at the bases $BCF$ and $BEF$ on face $BCFE$. How far is the shared tip $D$ from that face?",
        explanation: [
          ends
            ? "The bases $ABC$ and $DEF$ are the prism's two ends, so they are congruent. Each pyramid's tip lies on the other end, so both heights equal the prism's height."
            : "The diagonal $\\overline{BF}$ cuts the parallelogram $BCFE$ into congruent triangles $BCF$ and $BEF$. Both pyramids have tip $D$, so their heights are the same distance from $D$ to that face.",
          "Two pyramids with congruent bases and equal heights have slices of equal area at every height: each slice is the base scaled by the same factor. By Cavalieri's principle they have equal volumes.",
          "So all three pyramids have equal volumes, and each is one third of the prism: a pyramid's volume is $\\frac13Bh$.",
        ],
      });
    }
    case "hypothesis":
      return done({
        prompt:
          "A hemisphere of radius $r$ and a cone of radius $r$ and height $r$ stand on one plane. At $y=0$ both slices have area $\\pi r^2$, and at $y=r$ both have area 0. Does Cavalieri's principle show that they have equal volumes?",
        options: [
          {
            label:
              "No: at $y=\\frac r2$ the slices are $\\frac34\\pi r^2$ and $\\frac14\\pi r^2$, so they are not equal at every height.",
            correct: true,
          },
          {
            label: "Yes: they have the same base area and the same height.",
            feedback:
              "Equal bases and heights are not enough: the slices must match at every height.",
          },
          {
            label: "Yes: their slices are equal at the bottom and at the top.",
            feedback:
              "Two heights say nothing about the heights between them. At $y=\\frac r2$ the slices differ.",
          },
          {
            label: "No: Cavalieri's principle applies only to prisms.",
            feedback:
              "Cavalieri's principle applies to any solids. It fails here because the slices differ.",
          },
        ],
        figure: hemiCone,
        hint: "The slices match at $y=0$ and $y=r$. Compute both slice areas halfway up, at $y=\\frac r2$: a right triangle for the hemisphere, and the distance below the tip for the cone.",
        explanation: [
          "The hemisphere's slice at height $y$ has area $\\pi(r^2-y^2)$. The cone's slice is $r-y$ below its tip, so its area is $\\pi(r-y)^2$.",
          "At $y=\\frac r2$ these are $\\frac34\\pi r^2$ and $\\frac14\\pi r^2$. The slices are not equal at every height, so the principle does not apply.",
          "In fact the volumes differ: $\\frac23\\pi r^3$ and $\\frac13\\pi r^3$.",
        ],
      });
    case "flaw": {
      const prismCase = r(0, 1) === 0;
      return done({
        prompt: prismCase
          ? "A student says: a pyramid and a prism with the same base area $B$ and the same height $h$ have equal volumes, by Cavalieri's principle. What is wrong?"
          : "A student says: a cone of radius $r$ and height $r$ has the same base area and height as a hemisphere of radius $r$, so by Cavalieri's principle they have equal volumes. What is wrong?",
        options: prismCase
          ? [
              {
                label:
                  "Cavalieri needs equal slices at every height; the pyramid's slices shrink to 0, the prism's stay $B$.",
                correct: true,
              },
              {
                label:
                  "Cavalieri's principle applies only to solids of the same shape.",
                feedback:
                  "The principle compares slices, not shapes: different shapes can have equal volumes.",
              },
              {
                label: "Nothing is wrong.",
                feedback:
                  "The pyramid holds $\\frac13Bh$ and the prism $Bh$, so the claim is false.",
              },
              {
                label: "The bases must also have the same perimeter.",
                feedback:
                  "Perimeters do not matter to Cavalieri's principle. Slice areas at every height do.",
              },
            ]
          : [
              {
                label:
                  "Cavalieri needs equal slices at every height; here they are $\\pi(r^2-y^2)$ and $\\pi(r-y)^2$.",
                correct: true,
              },
              {
                label: "The cone's height should be $2r$.",
                feedback:
                  "A cone of height $2r$ has a different height from the hemisphere, so the principle would not apply at all.",
              },
              {
                label:
                  "Cavalieri's principle applies only to solids of the same shape.",
                feedback:
                  "The principle compares slices, not shapes: different shapes can have equal volumes.",
              },
              {
                label: "Nothing is wrong.",
                feedback:
                  "The hemisphere holds $\\frac23\\pi r^3$ and the cone $\\frac13\\pi r^3$, so the claim is false.",
              },
            ],
        figure: prismCase ? conePyramid : hemiCone,
        hint: prismCase
          ? "Slice the pyramid and the prism halfway up, at $y=\\frac h2$. Are the two slices the same size?"
          : "Slice the cone and the hemisphere halfway up, at $y=\\frac r2$. Are the two slices the same size?",
        explanation: prismCase
          ? [
              "Cavalieri's principle needs equal slice areas at every height, not only equal bases and heights.",
              "The prism's slices all have area $B$. The pyramid's slice at height $y$ has area $B\\left(\\frac{h-y}{h}\\right)^2$, which shrinks to 0 at the tip.",
              "So the principle does not apply, and the volumes differ: $\\frac13Bh$ and $Bh$.",
            ]
          : [
              "Cavalieri's principle needs equal slice areas at every height, not only equal bases and heights.",
              "The hemisphere's slice at height $y$ has area $\\pi(r^2-y^2)$; the cone's has area $\\pi(r-y)^2$. Halfway up these are $\\frac34\\pi r^2$ and $\\frac14\\pi r^2$.",
              "So the principle does not apply, and the volumes differ: $\\frac23\\pi r^3$ and $\\frac13\\pi r^3$.",
            ],
      });
    }
    case "statement":
      return done({
        prompt: "Which is a correct statement of Cavalieri's principle?",
        options: [
          {
            label:
              "Two solids of the same height whose slices at every height have equal areas have equal volumes.",
            correct: true,
          },
          {
            label:
              "Two solids of the same height whose bases have equal areas have equal volumes.",
            feedback:
              "Equal bases are not enough: a cone and a cylinder can share a base and a height.",
          },
          {
            label:
              "Two solids of the same height whose slices at every height have equal perimeters have equal volumes.",
            feedback:
              "Perimeter is a length, not an area. Slices with equal perimeters can have different areas.",
          },
          {
            label:
              "Two solids of the same height whose slices at every height have equal areas have equal surface areas.",
            feedback:
              "The principle is about volume. An oblique cylinder has the volume of the right cylinder with the same base and height, but more curved surface.",
          },
        ],
        figure: stacks,
        hint: "Cavalieri's principle has three parts: the same height, slices parallel to the base, and one measure equal at every height. Which measure, and what follows?",
        explanation: [
          "Cavalieri's principle: if two solids have the same height and their slices at every height have equal areas, the solids have equal volumes.",
          "Equal bases are not enough, perimeters are not areas, and the conclusion is about volume, not surface area.",
        ],
      });
  }
}

/* ---------------------------------------------------------------- generate */

export const cavalieriArgumentGenerate = defineGenerate(
  cavalieriArgumentTemplates,
  {
    "cavalieri-sphere-argument": entry(sphereAxes, ({ meta, seed, r, axes }) =>
      sphereProblem(meta, seed, r, axes.task),
    ),
    "cavalieri-slice-area-check": entry(sliceAxes, ({ meta, seed, r, axes }) =>
      sliceProblem(meta, seed, r, axes.pair),
    ),
    "cavalieri-other-solids-argument": entry(
      otherAxes,
      ({ meta, seed, r, axes }) => otherProblem(meta, seed, r, axes.task),
    ),
  },
);
