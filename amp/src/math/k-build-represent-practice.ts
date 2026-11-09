import { createHash } from "node:crypto";
import { count } from "./agreement";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice";
import type { Element, PathOp, Scene } from "./scene/spec";
import { scene as sceneOf } from "./scene/author";
import { storyName } from "./story-kit/names";

/**
 * Kindergarten building and representing (K.G.B.5, K.OA.A.1).
 *
 * K.G.B.5: a shape is its corners (clay balls) joined by straight sides
 * (sticks), closed. Learners plan a stick-and-ball model, judge drawings, and
 * name what is wrong with one. Building on a peg board needs a new answer
 * format and is not here.
 *
 * K.OA.A.1: read a picture or story of joining or taking away as a number
 * sentence, and choose the picture that shows a number sentence. Counters
 * are drawn with scene primitives: a teal group on a mat, a rust group with
 * an arrow coming in, or faded counters with an arrow going out.
 */

const K2 = "K–2" as const;
const scenes = { requiredFigureCapability: "scenes-v1" as const };

export const kBuildRepresentTemplates: readonly TemplateMetadata[] = [
  {
    id: "sticks-and-balls-needed",
    version: 1,
    title: "How many sticks and clay balls",
    skillId: "build-and-draw-shapes",
    gradeBand: K2,
    description:
      "Plan a stick-and-ball model of a triangle, square, rectangle, hexagon or cube: count the sticks (sides) or clay balls (corners) it needs, the sticks still missing from a build, or the balls that join a set of sticks.",
    ...scenes,
    glossarySenses: {
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
  },
  {
    id: "check-the-drawing",
    version: 1,
    title: "Which drawing is a real shape",
    skillId: "build-and-draw-shapes",
    gradeBand: K2,
    description:
      "Choose the one drawing that is a triangle, square, rectangle or hexagon. The others are open, have a curved side, have one side too many or too few, or have corners or sides that do not fit the name. The right drawing is often turned.",
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    glossarySenses: {
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
  },
  {
    id: "drawing-mistake",
    version: 1,
    title: "What is wrong with the drawing",
    skillId: "build-and-draw-shapes",
    gradeBand: K2,
    description:
      "A child drew a triangle, square, rectangle or hexagon. Choose what is wrong: it is not closed, one side is curved, it has the wrong number of sides, or its corners are not square corners. Sometimes nothing is wrong and the shape is only turned.",
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    glossarySenses: {
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
  },
  {
    id: "picture-to-number-sentence",
    version: 1,
    title: "Which number sentence tells about it",
    skillId: "represent-join-separate",
    gradeBand: K2,
    description:
      "Read a picture or a story of joining or taking away within 10, and choose the expression, equation or sentence that tells what happened. Wrong choices use the other operation, give only the total, start from the whole, swap what was taken and what was left, or miscount.",
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
  },
  {
    id: "number-sentence-to-picture",
    version: 1,
    title: "Which picture shows the number sentence",
    skillId: "represent-join-separate",
    gradeBand: K2,
    description:
      "Choose the picture that shows an addition or subtraction expression or equation within 10: two groups joining, some counters leaving, or two colors on a ten frame. Wrong pictures use the other operation, show only the answer, take away the answer or miscount.",
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
  },
];

const metaOf = (id: string) =>
  kBuildRepresentTemplates.find((t) => t.id === id)!;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;

/* ------------------------------------------------------------ assembly */

type Choice = { label: string; correct?: true; feedback?: string };
type Built = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  label?: string;
  variant: string;
  /** Number answer, when there are no choices. */
  answer?: number;
  choices?: Choice[];
  figureChoice?: {
    label: string;
    correct: Candidate;
    distractors: Candidate[];
    /** Lines about the options, given each option's name ("Picture B"). */
    explain: (name: (c: Candidate) => string) => string[];
  };
};
export type Candidate = {
  /** What the picture shows, for screen readers and answer keys. */
  description: string;
  scene: Scene;
  /** Absent on the correct picture. */
  feedback?: string;
};

function finish(
  id: string,
  seed: string,
  r: Random,
  b: Built,
): GeneratedProblem {
  const meta = metaOf(id);
  let response: ProblemResponse;
  let answer: string;
  let explanation = b.explanation;
  let choiceFeedback: Record<string, string> | undefined;
  if (b.choices) {
    const choices = shuffle(r, [...b.choices]);
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error("Need distinct choices with one correct");
    choiceFeedback = {};
    answer = "";
    response = {
      kind: "choice",
      label: b.label ?? "Choose one answer",
      options: choices.map((c, i) => {
        const optionId = `option-${"abcd"[i]}`;
        if (c.correct) answer = optionId;
        else choiceFeedback![optionId] = c.feedback!;
        return { id: optionId, label: c.label };
      }),
    };
  } else if (b.figureChoice) {
    const fc = b.figureChoice;
    const all = [fc.correct, ...fc.distractors];
    if (
      new Set(all.map((c) => JSON.stringify(c.scene.elements))).size !==
        all.length ||
      new Set(all.map((c) => c.description)).size !== all.length
    )
      throw new Error("Need distinct pictures");
    const order = shuffle(r, [...all]);
    const name = (c: Candidate) =>
      `Picture ${figureOptionLetters[order.indexOf(c)]!}`;
    const optionId = (c: Candidate) => figureOptionIds[order.indexOf(c)]!;
    const fcResponse: FigureChoiceResponse = {
      kind: "figure-choice",
      label: fc.label,
      noun: "Picture",
      options: order.map((c) => ({
        id: optionId(c),
        label: c.description,
        scene: c.scene,
      })),
    };
    response = fcResponse;
    answer = optionId(fc.correct);
    choiceFeedback = Object.fromEntries(
      fc.distractors.map((c) => [optionId(c), c.feedback!]),
    );
    explanation = [...b.explanation, ...fc.explain(name)];
  } else {
    if (b.answer === undefined) throw new Error("Need an answer");
    response = { kind: "number", label: b.label ?? "Answer" };
    answer = String(b.answer);
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, meta.version, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: b.prompt,
      skillId: meta.skillId,
      response,
      ...(b.figure ? { figure: b.figure } : {}),
    },
    answer,
    explanation,
    hint: b.hint,
    ...(choiceFeedback ? { choiceFeedback } : {}),
    variant: { id: b.variant },
  };
}

const figure = (scene: Scene): SemanticFigure => ({ kind: "scene", scene });

/* ------------------------------------------------------------ geometry */

type Pt = [number, number];
const round = (v: number) => Math.round(v * 1000) / 1000;
const rotate = (pts: readonly Pt[], deg: number): Pt[] => {
  const t = (deg * Math.PI) / 180,
    c = Math.cos(t),
    s = Math.sin(t);
  return pts.map(([x, y]): Pt => [round(x * c - y * s), round(x * s + y * c)]);
};
const centered = (pts: readonly Pt[]): Pt[] => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]): Pt => [round(x - cx), round(y - cy)]);
};
const regular = (n: number, radius: number, startDeg: number): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => {
    const t = ((startDeg + (360 * i) / n) * Math.PI) / 180;
    return [round(radius * Math.cos(t)), round(radius * Math.sin(t))];
  });
const lerp = (a: Pt, b: Pt, t: number): Pt => [
  round(a[0] + (b[0] - a[0]) * t),
  round(a[1] + (b[1] - a[1]) * t),
];

/** The math-unit box around drawn elements. */
function extent(
  elements: readonly Element[],
): [number, number, number, number] {
  const xs: number[] = [],
    ys: number[] = [];
  const add = ([x, y]: readonly [number, number], pad = 0) => {
    xs.push(x - pad, x + pad);
    ys.push(y - pad, y + pad);
  };
  for (const e of elements)
    if (e.type === "circle") add(e.center, e.r);
    else if (e.type === "rect") {
      add(e.at);
      add([e.at[0] + e.size[0], e.at[1] + e.size[1]]);
    } else if (e.type === "segment" || e.type === "arrow") {
      add(e.from);
      add(e.to);
    } else if (e.type === "polygon" || e.type === "polyline")
      e.points.forEach((p) => add(p));
    else if (e.type === "path")
      for (const op of e.d)
        for (let i = 1; i + 1 < op.length; i += 2)
          add([op[i] as number, op[i + 1] as number]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
/** Give every picture the same invisible canvas, at least `min` units wide
 * and tall, so all of them draw at one scale and size never cues an answer. */
function onCanvas(
  lists: Element[][],
  min: [number, number] = [0, 0],
): Element[][] {
  const boxes = lists.map(extent);
  let x0 = Math.min(...boxes.map((b) => b[0])),
    y0 = Math.min(...boxes.map((b) => b[1])),
    x1 = Math.max(...boxes.map((b) => b[2])),
    y1 = Math.max(...boxes.map((b) => b[3]));
  const growW = Math.max(0, min[0] - (x1 - x0)) / 2,
    growH = Math.max(0, min[1] - (y1 - y0)) / 2;
  x0 -= growW;
  x1 += growW;
  y0 -= growH;
  y1 += growH;
  const canvas: Element = {
    type: "rect",
    id: "canvas",
    at: [round(x0), round(y0)],
    size: [round(x1 - x0), round(y1 - y0)],
    fill: "none",
  };
  return lists.map((list) => [canvas, ...list]);
}

/* ============================================================ K.G.B.5 */

export const SHAPES = ["triangle", "square", "rectangle", "hexagon"] as const;
export type ShapeName = (typeof SHAPES)[number];
export const SIDES: Record<ShapeName, number> = {
  triangle: 3,
  square: 4,
  rectangle: 4,
  hexagon: 6,
};

/** A shape drawn the usual way: flat on its bottom side, wider than tall. */
function usual(shape: ShapeName, r: Random): Pt[] {
  switch (shape) {
    case "triangle":
      return centered(
        pick(r, [
          [
            [-1.2, -0.7],
            [1.2, -0.7],
            [0, 1.38],
          ],
          [
            [-1.4, -0.8],
            [1.4, -0.8],
            [0.5, 1.2],
          ],
          [
            [-1.2, -0.9],
            [1.2, -0.9],
            [-1.2, 1],
          ],
        ] as Pt[][]),
      );
    case "square":
      return [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
    case "rectangle":
      return [
        [-1.5, -0.8],
        [1.5, -0.8],
        [1.5, 0.8],
        [-1.5, 0.8],
      ];
    case "hexagon":
      return regular(6, 1.3, 0);
  }
}
/** The turns that make a shape look unusual: a square on its corner, a tall
 * rectangle, a triangle pointing down or sideways, a hexagon on a point. */
const UNUSUAL: Record<ShapeName, number[]> = {
  triangle: [180, 90, 270, 150, 200],
  square: [45, 25, 35],
  rectangle: [90, 20, 30, 110],
  hexagon: [30, 15],
};
const turnWords = (shape: ShapeName, turn: number): string => {
  if (turn === 0) return "";
  if (shape === "square")
    return turn === 45 ? ", standing on a corner" : ", turned";
  if (shape === "rectangle")
    return turn === 90 ? ", taller than it is wide" : ", tilted";
  if (shape === "triangle")
    return turn === 180
      ? ", pointing down"
      : turn === 90 || turn === 270
        ? ", pointing sideways"
        : ", turned";
  return turn === 30 ? ", standing on a corner" : ", turned";
};

export type Flaw = "open" | "curved" | "count" | "corners" | "unequal";
type Drawing = {
  /** "closed" polygon, "open" polyline, or "curved" path. */
  elements: Element[];
  description: string;
  /** Number of sides drawn, counting a curved side. */
  sides: number;
};

const stroke = { stroke: "ink" as const, width: 3 };

function closedDrawing(pts: Pt[], description: string): Drawing {
  return {
    elements: [
      { type: "polygon", id: "drawing", points: pts, fill: "none", ...stroke },
    ],
    description,
    sides: pts.length,
  };
}
function openDrawing(pts: Pt[], description: string): Drawing {
  // Every side, then the last side stops 20% short of the start: a gap.
  const end = lerp(pts[pts.length - 1]!, pts[0]!, 0.8);
  return {
    elements: [
      {
        type: "polyline",
        id: "drawing",
        points: [...pts, end],
        fill: "none",
        ...stroke,
      },
    ],
    description,
    sides: pts.length,
  };
}
function curvedDrawing(pts: Pt[], at: number, description: string): Drawing {
  const n = pts.length;
  const a = pts[at]!,
    b = pts[(at + 1) % n]!;
  const mid = lerp(a, b, 0.5);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // Bulge away from the center.
  let nx = -(b[1] - a[1]) / len,
    ny = (b[0] - a[0]) / len;
  if (nx * mid[0] + ny * mid[1] < 0) {
    nx = -nx;
    ny = -ny;
  }
  const ctrl: Pt = [
    round(mid[0] + nx * 0.9 * len),
    round(mid[1] + ny * 0.9 * len),
  ];
  const ordered = [...pts.slice(at + 1), ...pts.slice(0, at + 1)];
  // Start just after the curved side, walk the straight sides, then curve back.
  const d: PathOp[] = [["M", ordered[0]![0], ordered[0]![1]]];
  for (const p of ordered.slice(1)) d.push(["L", p[0], p[1]]);
  d.push(["Q", ctrl[0], ctrl[1], ordered[0]![0], ordered[0]![1]]);
  d.push(["Z"]);
  return {
    elements: [{ type: "path", id: "drawing", d, fill: "none", ...stroke }],
    description,
    sides: n,
  };
}

/** A shape with one side too many or too few. */
function countPoints(shape: ShapeName, r: Random): Pt[] {
  if (shape === "triangle") {
    // The top corner cut off: 4 sides.
    const [a, b, c] = usual("triangle", r) as [Pt, Pt, Pt];
    return centered([a, b, lerp(b, c, 0.72), lerp(a, c, 0.72)]);
  }
  if (shape === "hexagon")
    return r(0, 1) ? regular(5, 1.3, 90) : regular(7, 1.3, 90);
  const base = usual(shape, r);
  // One corner cut off: 5 sides.
  const [a, b, c, d] = base as [Pt, Pt, Pt, Pt];
  return centered([a, b, lerp(b, c, 0.62), lerp(c, d, 0.4), d]);
}

/** A drawing of `shape` with the flaw (or none), turned by `turn`. */
export function drawShape(
  shape: ShapeName,
  flaw: Flaw | null,
  turn: number,
  r: Random,
): Drawing {
  const n = SIDES[shape];
  const base = usual(shape, r);
  const how = turnWords(shape, turn);
  switch (flaw) {
    case null: {
      const what =
        shape === "square"
          ? "A closed shape with 4 straight sides of the same length and 4 square corners"
          : shape === "rectangle"
            ? "A closed shape with 4 straight sides and 4 square corners, 2 sides longer than the other 2"
            : `A closed shape with ${n} straight sides`;
      return closedDrawing(rotate(base, turn), `${what}${how}.`);
    }
    case "open":
      return openDrawing(
        rotate(base, turn),
        `A shape with ${n} straight sides that does not close: there is a gap at one corner.`,
      );
    case "curved":
      return curvedDrawing(
        rotate(base, turn),
        r(0, n - 1),
        `A closed shape with ${count(n - 1, "straight side")} and 1 curved side.`,
      );
    case "count": {
      const pts = rotate(countPoints(shape, r), turn);
      return closedDrawing(
        pts,
        `A closed shape with ${pts.length} straight sides.`,
      );
    }
    case "corners": {
      // A square leans into a rhombus; a rectangle into a parallelogram.
      const pts =
        shape === "square"
          ? centered([
              [0, 0],
              [2, 0],
              [2 + 2 * Math.cos(1.13), 2 * Math.sin(1.13)],
              [2 * Math.cos(1.13), 2 * Math.sin(1.13)],
            ])
          : centered([
              [0, 0],
              [3, 0],
              [3.8, 1.5],
              [0.8, 1.5],
            ]);
      return closedDrawing(
        rotate(pts, turn),
        shape === "square"
          ? "A closed shape with 4 straight sides of the same length that lean; its corners are not square corners."
          : "A closed shape with 4 straight sides that lean; its corners are not square corners.",
      );
    }
    case "unequal":
      return closedDrawing(
        rotate(
          [
            [-1.5, -0.75],
            [1.5, -0.75],
            [1.5, 0.75],
            [-1.5, 0.75],
          ],
          turn,
        ),
        "A closed shape with 4 straight sides and 4 square corners; 2 sides are twice as long as the other 2.",
      );
  }
}

const shapeRule: Record<ShapeName, string> = {
  triangle: "A triangle has 3 straight sides and 3 corners, and it closes.",
  square:
    "A square has 4 straight sides that are all the same length and 4 square corners, and it closes.",
  rectangle:
    "A rectangle has 4 straight sides and 4 square corners, and it closes.",
  hexagon: "A hexagon has 6 straight sides and 6 corners, and it closes.",
};

/** The flaws a decoy of `shape` can show. */
const decoyFlaws = (shape: ShapeName): Flaw[] =>
  shape === "square"
    ? ["open", "curved", "count", "corners", "unequal"]
    : shape === "rectangle"
      ? ["open", "curved", "count", "corners"]
      : ["open", "curved", "count"];

const flawReason = (shape: ShapeName, flaw: Flaw, d: Drawing): string =>
  ({
    open: "It does not close: there is a gap at one corner. A shape must close.",
    curved:
      "One side is curved. Every side of a shape like this must be straight.",
    count: `It has ${d.sides} sides. A ${shape} has ${SIDES[shape]}.`,
    corners: `Its corners are not square corners. A ${shape} needs 4 square corners.`,
    unequal:
      "Its sides are not all the same length. A square needs 4 sides of the same length.",
  })[flaw];

const flawFeedback = (shape: ShapeName, flaw: Flaw): string =>
  ({
    open: `This drawing has a gap, so it is not closed. A ${shape} closes.`,
    curved: `This drawing has a curved side. A ${shape} has only straight sides.`,
    count: `Count the sides of this drawing: it does not have ${SIDES[shape]}. A ${shape} has ${SIDES[shape]} sides.`,
    corners: `The corners of this drawing lean, so they are not square corners. A ${shape} needs 4 square corners.`,
    unequal:
      "Two sides of this drawing are longer than the other two. A square has 4 sides of the same length.",
  })[flaw];

const OPTION = { width: 220, maxHeight: 200 } as const;
const PROBLEM = { width: 260, maxHeight: 240 } as const;

function checkTheDrawing(seed: string, r: Random): GeneratedProblem {
  const v = random("check-the-drawing:variant", seed);
  const shape = SHAPES[v(0, SHAPES.length - 1)]!;
  const unusual = v(1, 10) <= 6;
  const turn = unusual ? pick(r, UNUSUAL[shape]) : 0;
  const right = drawShape(shape, null, turn, r);
  const flaws = shuffle(r, decoyFlaws(shape)).slice(0, 3);
  const decoyTurns = [0, 0, 20, 45, 90, 180];
  const decoys = flaws.map((flaw) => ({
    flaw,
    drawing: drawShape(shape, flaw, pick(r, decoyTurns), r),
  }));
  const drawn = onCanvas([
    right.elements,
    ...decoys.map((d) => d.drawing.elements),
  ]);
  const toCandidate = (
    d: Drawing,
    at: number,
    feedback?: string,
  ): Candidate => ({
    description: d.description,
    scene: sceneOf(...drawn[at]!).build(OPTION),
    ...(feedback ? { feedback } : {}),
  });
  const correct = toCandidate(right, 0);
  const distractors = decoys.map((d, i) =>
    toCandidate(d.drawing, i + 1, flawFeedback(shape, d.flaw)),
  );
  return finish("check-the-drawing", seed, r, {
    prompt: `Which drawing is a ${shape}?`,
    hint: `Check each drawing three ways. Does it close? Are all its sides straight? Does it have ${SIDES[shape]} sides, as a ${shape} does?`,
    explanation: [
      shapeRule[shape],
      "Check each drawing: does it close, are all its sides straight, and does it have the right number of sides and corners?",
      "Turning a shape does not change it. A turned shape keeps its name.",
    ],
    variant: `${shape}-${unusual ? "turned" : "usual"}`,
    figureChoice: {
      label: `Choose the drawing that is a ${shape}`,
      correct,
      distractors,
      explain: (name) => [
        ...decoys.map(
          (d, i) =>
            `${name(distractors[i]!)}: ${flawReason(shape, d.flaw, d.drawing)}`,
        ),
        `${name(correct)} closes, has only straight sides and fits every rule for a ${shape}${turn ? ", even though it is turned" : ""}. It is the ${shape}.`,
      ],
    },
  });
}

const MISTAKE_TEXT = {
  open: "It is not closed.",
  curved: "One side is curved.",
  corners: "The corners are not square corners.",
  turned: "It is turned the wrong way.",
} as const;

function drawingMistake(seed: string, r: Random): GeneratedProblem {
  const v = random("drawing-mistake:variant", seed);
  const shape = SHAPES[v(0, SHAPES.length - 1)]!;
  const nothing = v(1, 4) === 1;
  const n = SIDES[shape];
  const flawPool: Flaw[] =
    shape === "square" || shape === "rectangle"
      ? ["open", "curved", "count", "corners"]
      : ["open", "curved", "count"];
  const flaw: Flaw | null = nothing
    ? null
    : flawPool[v(0, flawPool.length - 1)]!;
  const turn = nothing ? pick(r, UNUSUAL[shape]) : pick(r, [0, 0, 20, 90, 180]);
  const drawing = drawShape(shape, flaw, turn, r);
  const name = storyName((k) => r(0, k - 1));
  const wrongCount =
    flaw === "count"
      ? drawing.sides
      : shape === "hexagon"
        ? pick(r, [5, 7])
        : n + 1;
  const textOf = (f: Flaw | "turned" | "nothing"): string =>
    f === "nothing"
      ? `Nothing is wrong. It is a ${shape}.`
      : f === "count"
        ? `It has ${wrongCount} sides, not ${n}.`
        : MISTAKE_TEXT[f as keyof typeof MISTAKE_TEXT];
  const feedbackOf = (f: Flaw | "turned" | "nothing"): string =>
    f === "nothing"
      ? flaw === "count"
        ? `Count the sides again: there are ${drawing.sides}, and a ${shape} has ${n}.`
        : flaw === "open"
          ? `Look at every corner: there is a gap, so the drawing is not closed.`
          : flaw === "curved"
            ? "Look at every side: one of them bends, so it is not straight."
            : "Look at the corners: they lean, so they are not square corners."
      : f === "turned"
        ? `A shape can be turned any way. Turning does not change a ${shape} into another shape.`
        : f === "open"
          ? "Follow the drawing all the way around: it comes back to where it started, so it is closed."
          : f === "curved"
            ? "Every side of this drawing is straight."
            : f === "count"
              ? `Count the sides of the drawing: there are ${drawing.sides}, not ${wrongCount}.`
              : `The corners of this drawing are square corners.`;
  let options: (Flaw | "turned" | "nothing")[];
  if (flaw === null) {
    options = ["nothing", "turned", ...shuffle(r, [...flawPool]).slice(0, 2)];
  } else {
    // A curved side or a cut corner also spoils a square corner, so the
    // corner choice is left out there: exactly one choice is true.
    const others = shuffle(
      r,
      flawPool.filter(
        (f) =>
          f !== flaw &&
          !(f === "corners" && (flaw === "curved" || flaw === "count")),
      ),
    ).slice(0, 2);
    options = [flaw, "nothing", ...others];
  }
  const correctKey = flaw ?? "nothing";
  const choices: Choice[] = options.map((f) =>
    f === correctKey
      ? { label: textOf(f), correct: true }
      : { label: textOf(f), feedback: feedbackOf(f) },
  );
  const steps =
    flaw === null
      ? [
          shapeRule[shape],
          `Go around ${name}'s drawing: it closes, every side is straight, and there are ${n} sides.`,
          `It is turned, but turning does not change a ${shape}. Nothing is wrong.`,
        ]
      : [
          shapeRule[shape],
          flaw === "open"
            ? "Follow the sides around: the last side stops before it reaches the start. There is a gap."
            : flaw === "curved"
              ? "Look at each side: one side bends. It is curved, not straight."
              : flaw === "count"
                ? `Count the sides: there are ${drawing.sides}, not ${n}.`
                : "Look at the corners: the sides lean, so the corners are not square corners.",
          flaw === "open"
            ? `It is not closed, so it is not yet a ${shape}. Join the gap and it is.`
            : flaw === "curved"
              ? `With a curved side it is not a ${shape}. Make that side straight and it is.`
              : flaw === "count"
                ? `With ${drawing.sides} sides it is not a ${shape}.`
                : `Without square corners it is not a ${shape}.`,
        ];
  return finish("drawing-mistake", seed, r, {
    prompt: `${name} drew a ${shape}. What is wrong with ${name}'s drawing?`,
    hint: `${name}'s drawing should be a ${shape}. Check three things: does it close, are all its sides straight, and does it have ${n} sides?`,
    explanation: steps,
    figure: figure(
      sceneOf(...drawing.elements).build({
        ...PROBLEM,
        title: `${name}'s drawing`,
        note: drawing.description,
      }),
    ),
    variant: `${shape}-${flaw ?? "nothing"}`,
    choices,
  });
}

/* ---------- sticks and clay balls ---------- */

const OBJECTS: Record<ShapeName, readonly string[]> = {
  rectangle: ["window", "door", "book", "picture frame"],
  square: ["cracker", "napkin", "floor tile"],
  triangle: ["yield sign", "sail", "sandwich half"],
  hexagon: ["honeycomb cell", "hexagon tile"],
};
const CUBE_OBJECTS = ["toy block", "number cube"] as const;

const STICK = { stroke: "accent" as const, width: 6 };
const ball = (id: string, at: Pt): Element => ({
  type: "circle",
  id,
  center: at,
  r: 0.15,
  fill: "warm",
  stroke: "ink",
  width: 1.5,
});

/** A shape for a stick model, flat on its bottom side. */
function modelPoints(shape: ShapeName): Pt[] {
  switch (shape) {
    case "triangle":
      return [
        [-1.2, -0.7],
        [1.2, -0.7],
        [0, 1.38],
      ];
    case "square":
      return [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
    case "rectangle":
      return [
        [-1.6, -0.8],
        [1.6, -0.8],
        [1.6, 0.8],
        [-1.6, 0.8],
      ];
    case "hexagon":
      return regular(6, 1.3, 0);
  }
}
/** The 8 corners and 12 edges of a see-through cube, drawn at a slant. */
const CUBE_CORNERS: Pt[] = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [0.9, 0.7],
  [2.9, 0.7],
  [2.9, 2.7],
  [0.9, 2.7],
];
/** Bottom square (front and back edges, two sides), top square, 4 posts. */
const CUBE_BOTTOM: [number, number][] = [
  [0, 1],
  [4, 5],
  [0, 4],
  [1, 5],
];
const CUBE_TOP: [number, number][] = [
  [3, 2],
  [7, 6],
  [3, 7],
  [2, 6],
];
const CUBE_POSTS: [number, number][] = [
  [0, 3],
  [1, 2],
  [4, 7],
  [5, 6],
];

function stickModel(
  pts: Pt[],
  edges: [number, number][],
  options: { balls: boolean; gapAtCorners?: boolean },
): Element[] {
  const sticks: Element[] = edges.map(([i, j], k): Element => {
    const a = pts[i]!,
      b = pts[j]!;
    const [from, to]: [Pt, Pt] = options.gapAtCorners
      ? [lerp(a, b, 0.12), lerp(a, b, 0.88)]
      : [a, b];
    return { type: "segment", id: `stick${k}`, from, to, ...STICK };
  });
  const balls = options.balls ? pts.map((p, k) => ball(`ball${k}`, p)) : [];
  return [...sticks, ...balls];
}
const ring = (n: number): [number, number][] =>
  Array.from({ length: n }, (_, i): [number, number] => [i, (i + 1) % n]);

function sticksAndBalls(seed: string, r: Random): GeneratedProblem {
  const v = random("sticks-and-balls-needed:variant", seed);
  const variant = (["plan", "finish", "join"] as const)[v(0, 2)]!;
  const cube = v(1, 20) <= 3;
  const name = storyName((k) => r(0, k - 1));
  if (cube) return cubeSticks(seed, r, variant, name);
  const shape = SHAPES[v(0, SHAPES.length - 1)]!;
  const n = SIDES[shape];
  const pts = modelPoints(shape);
  const corners = `${n} corners`;
  if (variant === "plan") {
    const object = pick(r, OBJECTS[shape]);
    const asks = r(0, 1) ? "sticks" : "clay balls";
    const elements: Element[] = [
      {
        type: "polygon",
        id: "outline",
        points: pts,
        fill: "accent-fill",
        stroke: "ink",
        width: 2.5,
      },
    ];
    return finish("sticks-and-balls-needed", seed, r, {
      prompt: `${name} builds a model of a ${object} with sticks and clay balls. The picture shows the shape of the ${object}. How many ${asks} does ${name} need?`,
      hint:
        asks === "sticks"
          ? `Each side of the ${object} is one stick. Count the sides of the shape.`
          : `Each corner of the ${object} is one clay ball. Count the corners of the shape.`,
      explanation: [
        `The ${object} is a ${shape}: ${count(n, "straight side")} and ${corners}.`,
        "A model uses one stick for each side and one clay ball for each corner.",
        asks === "sticks"
          ? `Count the sides: ${n}. ${name} needs ${count(n, "stick")}.`
          : `Count the corners: ${n}. ${name} needs ${count(n, "clay ball")}.`,
        "Try it at home with toothpicks and balls of dough.",
      ],
      figure: figure(
        sceneOf(...elements).build({
          ...PROBLEM,
          title: `The shape of the ${object}`,
          note: `A ${shape} outline.`,
        }),
      ),
      label: asks,
      answer: n,
      variant: `plan-${shape}`,
    });
  }
  if (variant === "finish") {
    const placed = r(1, n - 1);
    // Which sides are already built: a run starting at a random corner.
    const start = r(0, n - 1);
    const edges = ring(n).filter((_, i) => (i - start + n) % n < placed);
    const elements = stickModel(pts, edges, { balls: true });
    const missing = n - placed;
    return finish("sticks-and-balls-needed", seed, r, {
      prompt: `${name} is building a ${shape} with sticks and clay balls. All the clay balls are placed. How many more sticks are needed to finish the ${shape}?`,
      hint: `Look at the ${shape} ${name} is building. Find two clay balls next to each other with no stick between them, and count those gaps.`,
      explanation: [
        `A ${shape} has ${corners}, so it has ${n} clay balls. Count them: ${n}.`,
        `Count the sticks already placed: ${placed}.`,
        `Find the clay balls next to each other with no stick between them: ${count(missing, "gap")}. So ${count(missing, "more stick")} ${missing === 1 ? "is" : "are"} needed.`,
        `Check: $${placed} + ${missing} = ${n}$, one stick for each side.`,
      ],
      figure: figure(
        sceneOf(...elements).build({
          ...PROBLEM,
          title: `${name}'s ${shape}, not finished`,
          note: `Clay balls at all the corners of a ${shape}. Some sides have sticks and some do not.`,
        }),
      ),
      label: "more sticks",
      answer: missing,
      variant: `finish-${shape}`,
    });
  }
  const elements = stickModel(pts, ring(n), {
    balls: false,
    gapAtCorners: true,
  });
  return finish("sticks-and-balls-needed", seed, r, {
    prompt: `${name} has ${n} sticks for a ${shape}. How many clay balls does ${name} need to join them?`,
    hint: `${name}'s ${n} sticks go around the ${shape}. One clay ball joins 2 sticks at each corner, so count the corners.`,
    explanation: [
      `The ${n} sticks go around the ${shape}, one stick for each side.`,
      "Two sticks meet at each corner, and one clay ball joins them there.",
      `A ${shape} has ${corners}, so ${name} needs ${count(n, "clay ball")}.`,
      "A closed shape always has as many corners as sides.",
    ],
    figure: figure(
      sceneOf(...elements).build({
        ...PROBLEM,
        title: `${name}'s sticks for a ${shape}`,
        note: `Sticks laid out as a ${shape}, with an empty space at each corner.`,
      }),
    ),
    label: "clay balls",
    answer: n,
    variant: `join-${shape}`,
  });
}

function cubeSticks(
  seed: string,
  r: Random,
  variant: "plan" | "finish" | "join",
  name: string,
): GeneratedProblem {
  const all = [...CUBE_BOTTOM, ...CUBE_TOP, ...CUBE_POSTS];
  const build = (title: string, note: string, elements: Element[]) =>
    figure(sceneOf(...elements).build({ ...PROBLEM, title, note }));
  if (variant === "plan") {
    const object = pick(r, CUBE_OBJECTS);
    const asks = r(0, 1) ? "sticks" : "clay balls";
    const answer = asks === "sticks" ? 12 : 8;
    return finish("sticks-and-balls-needed", seed, r, {
      prompt: `${name} builds a model of a ${object} with sticks and clay balls. The ${object} is a cube. The picture shows a finished model of a cube. How many ${asks} does ${name} need?`,
      hint:
        asks === "sticks"
          ? "Count the sticks in parts: the square on the bottom, the square on top, then the posts that stand at the corners."
          : "Count the clay balls in parts: the corners of the square on the bottom, then the corners of the square on top.",
      explanation:
        asks === "sticks"
          ? [
              "A cube model is a square on the bottom, a square on top, and a post at each corner.",
              "The bottom square has 4 sticks, and the top square has 4 sticks.",
              "There are 4 posts. $4 + 4 + 4 = 12$.",
              `${name} needs 12 sticks.`,
            ]
          : [
              "A cube model is a square on the bottom and a square on top, joined by posts.",
              "The bottom square has 4 corners, and the top square has 4 corners.",
              `$4 + 4 = 8$. ${name} needs 8 clay balls.`,
            ],
      figure: build(
        "A stick-and-ball model of a cube",
        "A see-through model of a cube made of sticks and clay balls, with nothing hidden.",
        stickModel(CUBE_CORNERS, all, { balls: true }),
      ),
      label: asks,
      answer,
      variant: "plan-cube",
    });
  }
  if (variant === "finish") {
    const posts = r(0, 1) === 1;
    const placed = posts ? [...CUBE_BOTTOM, ...CUBE_POSTS] : CUBE_BOTTOM;
    const missing = 12 - placed.length;
    return finish("sticks-and-balls-needed", seed, r, {
      prompt: `${name} is building a cube with sticks and clay balls. All 8 clay balls are placed. How many more sticks are needed to finish the cube?`,
      hint: "All 8 clay balls of the cube are placed. A cube model is a square on the bottom, a square on top and a post at each corner. Find which of those parts still have no sticks.",
      explanation: [
        "A cube model needs 12 sticks: 4 for a square on the bottom, 4 for a square on top, and 4 posts, one at each corner.",
        posts
          ? "The bottom square and the 4 posts are built: 8 sticks are placed."
          : "Only the bottom square is built: 4 sticks are placed.",
        `$12 - ${placed.length} = ${missing}$, so ${missing} more sticks are needed.`,
        posts
          ? "Those 4 sticks make the square on top."
          : "Those 8 sticks make the 4 posts and the square on top.",
      ],
      figure: build(
        `${name}'s cube, not finished`,
        "Clay balls at every corner of a cube. Some edges have sticks and some do not.",
        stickModel(CUBE_CORNERS, placed, { balls: true }),
      ),
      label: "more sticks",
      answer: missing,
      variant: "finish-cube",
    });
  }
  return finish("sticks-and-balls-needed", seed, r, {
    prompt: `${name} has 12 sticks for a cube. How many clay balls does ${name} need to join them?`,
    hint: `${name}'s 12 sticks make a square on the bottom, a square on top and 4 posts. A clay ball goes at each corner where sticks meet.`,
    explanation: [
      "The 12 sticks make a square on the bottom, a square on top, and 4 posts.",
      "Each corner of the cube needs 1 clay ball to join the sticks that meet there.",
      "The bottom square has 4 corners and the top square has 4 corners. $4 + 4 = 8$.",
      `${name} needs 8 clay balls.`,
    ],
    figure: build(
      `${name}'s sticks for a cube`,
      "The sticks of a cube model laid out, with an empty space at each corner.",
      stickModel(CUBE_CORNERS, all, { balls: false, gapAtCorners: true }),
    ),
    label: "clay balls",
    answer: 8,
    variant: "join-cube",
  });
}

/* ============================================================ K.OA.A.1 */

/** Counters: teal (`accent`) is the first group, rust (`warm`) joins it, and
 * faded (`empty`, dashed) counters are leaving. */
const R = 0.38;
type Group = { count: number; kind: "first" | "joining" | "leaving" | "plain" };
const counterStyle = {
  first: { fill: "accent" as const, stroke: "ink" as const, width: 1.5 },
  plain: { fill: "accent" as const, stroke: "ink" as const, width: 1.5 },
  joining: { fill: "warm" as const, stroke: "ink" as const, width: 1.5 },
  leaving: {
    fill: "empty" as const,
    stroke: "muted" as const,
    width: 1.5,
    dash: "dash" as const,
  },
};
/** One block of counters in rows of five, top row first, left edge at x0. */
function block(
  g: Group,
  x0: number,
  prefix: string,
): { elements: Element[]; right: number; top: number; bottom: number } {
  const cols = Math.min(g.count, 5);
  const rows = Math.ceil(g.count / 5);
  const elements: Element[] = Array.from(
    { length: g.count },
    (_, i): Element => ({
      type: "circle",
      id: `${prefix}${i}`,
      center: [round(x0 + 0.5 + (i % 5)), round(-0.5 - Math.floor(i / 5))],
      r: R,
      ...counterStyle[g.kind],
    }),
  );
  return { elements, right: x0 + cols, top: 0, bottom: -rows };
}

export type CounterPicture =
  | { kind: "join"; first: number; second: number }
  | { kind: "take"; stay: number; leave: number }
  | { kind: "all"; count: number }
  | { kind: "frame"; first: number; second: number; crossed: number };

/** A counter picture as scene elements. */
function counterElements(p: CounterPicture): Element[] {
  return onCanvas([pictureElements(p)], [7, 2.6])[0]!;
}
function pictureElements(p: CounterPicture): Element[] {
  if (p.kind === "frame") return frameElements(p);
  const main: Group =
    p.kind === "join"
      ? { count: p.first, kind: "first" }
      : p.kind === "take"
        ? { count: p.stay, kind: "first" }
        : { count: p.count, kind: "plain" };
  const a = block(main, 0, "c");
  const mat: Element = {
    type: "rect",
    id: "mat",
    at: [-0.35, a.bottom - 0.35],
    size: [a.right + 0.7, -a.bottom + 0.7],
    radius: 10,
    fill: "none",
    stroke: "muted",
    width: 1.5,
  };
  if (p.kind === "all") return [mat, ...a.elements];
  const other: Group =
    p.kind === "join"
      ? { count: p.second, kind: "joining" }
      : { count: p.leave, kind: "leaving" };
  const x1 = a.right + 1.9;
  const b = block(other, x1, p.kind === "join" ? "j" : "l");
  const arrow: Element =
    p.kind === "join"
      ? {
          type: "arrow",
          id: "move",
          from: [x1 - 0.15, 0.55],
          to: [a.right + 0.45, 0.55],
          stroke: "ink",
          width: 2,
        }
      : {
          type: "arrow",
          id: "move",
          from: [a.right + 0.45, 0.55],
          to: [x1 - 0.15, 0.55],
          stroke: "ink",
          width: 2,
        };
  return [mat, ...a.elements, ...b.elements, arrow];
}

/** A ten frame: `first` teal then `second` rust in fill order; the last
 * `crossed` filled counters are faded and crossed out. */
function frameElements(
  p: Extract<CounterPicture, { kind: "frame" }>,
): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < 10; i++)
    out.push({
      type: "rect",
      id: `slot${i}`,
      at: [i % 5, -1 - Math.floor(i / 5)],
      size: [1, 1],
      fill: "paper",
      stroke: "ink",
      width: 1.5,
    });
  const filled = p.first + p.second;
  for (let i = 0; i < filled; i++) {
    const center: Pt = [round((i % 5) + 0.5), round(-0.5 - Math.floor(i / 5))];
    const crossed = i >= filled - p.crossed;
    const kind = crossed ? "leaving" : i < p.first ? "first" : "joining";
    out.push({
      type: "circle",
      id: `f${i}`,
      center,
      r: 0.36,
      ...counterStyle[kind],
    });
    if (crossed) {
      const d = 0.3;
      out.push(
        {
          type: "segment",
          id: `x${i}a`,
          from: [center[0] - d, center[1] - d],
          to: [center[0] + d, center[1] + d],
          stroke: "ink",
          width: 2,
        },
        {
          type: "segment",
          id: `x${i}b`,
          from: [center[0] - d, center[1] + d],
          to: [center[0] + d, center[1] - d],
          stroke: "ink",
          width: 2,
        },
      );
    }
  }
  return out;
}

export function describePicture(p: CounterPicture): string {
  switch (p.kind) {
    case "join":
      return `A group of ${count(p.first, "teal counter")} with ${count(p.second, "rust counter")} moving in to join it.`;
    case "take":
      return `${count(p.stay + p.leave, "counter")} at first: ${p.stay} ${p.stay === 1 ? "stays" : "stay"} in the group and ${p.leave} faded ${p.leave === 1 ? "counter moves" : "counters move"} away.`;
    case "all":
      return `A group of ${count(p.count, "counter")}, all one color, with nothing moving.`;
    case "frame":
      return p.crossed
        ? `A ten frame with ${count(p.first + p.second, "counter")}; ${p.crossed} of them ${p.crossed === 1 ? "is" : "are"} crossed out.`
        : p.second
          ? `A ten frame with ${count(p.first, "teal counter")} and then ${count(p.second, "rust counter")}.`
          : `A ten frame with ${count(p.first, "counter")}, all one color.`;
  }
}

const COUNTER_FIGURE = { width: 320, maxHeight: 200 } as const;
const COUNTER_OPTION = { width: 264, maxHeight: 180 } as const;

/** Things for the `words` variant: noun, a joining verb and a leaving verb. */
const THINGS = [
  { one: "dog", many: "dogs", come: "come", leave: "run away" },
  { one: "fish", many: "fish", come: "swim over", leave: "swim away" },
  { one: "bird", many: "birds", come: "fly over", leave: "fly away" },
  { one: "apple", many: "apples", come: "are added", leave: "are eaten" },
  { one: "star", many: "stars", come: "come out", leave: "fade away" },
  { one: "house", many: "houses", come: "are built", leave: "are taken down" },
] as const;
type Thing = (typeof THINGS)[number];
const things = (n: number, t: Thing) => `${n} ${n === 1 ? t.one : t.many}`;
/** "2 more dogs", "1 more dog". */
const moreThings = (n: number, t: Thing) =>
  `${n} more ${n === 1 ? t.one : t.many}`;
const isAre = (n: number) => (n === 1 ? "is" : "are");
/** "1 more comes", "2 more come"; a passive verb keeps its "is/are". */
const verb = (n: number, v: string) =>
  n !== 1
    ? v
    : v.startsWith("are ")
      ? `is ${v.slice(4)}`
      : v.replace(/^(\w+)/, (w) =>
          /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`,
        );

/** Stories told with no counts drawn. */
type Story = {
  join: (a: number, b: number, name: string) => string;
  leave: (t: number, r: number, name: string) => string;
};
const n1 = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
const STORIES: readonly Story[] = [
  {
    join: (a, b) =>
      `${n1(a, "duck is", "ducks are")} on the pond. ${n1(b, "more duck comes", "more ducks come")}.`,
    leave: (t, r) =>
      `${n1(t, "duck is", "ducks are")} on the pond. ${n1(r, "duck swims", "ducks swim")} away.`,
  },
  {
    join: (a, b) =>
      `${n1(a, "bird sits", "birds sit")} in a tree. ${n1(b, "more bird flies", "more birds fly")} over to the tree.`,
    leave: (t, r) =>
      `${n1(t, "bird sits", "birds sit")} in a tree. ${n1(r, "bird flies", "birds fly")} away.`,
  },
  {
    join: (a, b) =>
      `${n1(a, "frog is", "frogs are")} in the pond. ${n1(b, "more frog hops", "more frogs hop")} in.`,
    leave: (t, r) =>
      `${n1(t, "frog is", "frogs are")} in the pond. ${n1(r, "frog hops", "frogs hop")} out.`,
  },
  {
    join: (a, b) =>
      `${n1(a, "kid is", "kids are")} at the slide. ${n1(b, "more kid joins", "more kids join")} them.`,
    leave: (t, r) =>
      `${n1(t, "kid is", "kids are")} at the slide. ${n1(r, "kid goes", "kids go")} home.`,
  },
  {
    join: (a, b, name) =>
      `${name} has ${n1(a, "apple", "apples")}. ${name}'s friend gives ${name} ${n1(b, "more apple", "more apples")}.`,
    leave: (t, r, name) =>
      `${n1(t, "apple is", "apples are")} in the bowl. ${name} eats ${r}.`,
  },
  {
    join: (a, b, name) =>
      `${name} has ${n1(a, "sticker", "stickers")}. ${name} gets ${b} more.`,
    leave: (t, r, name) =>
      `${name} has ${n1(t, "sticker", "stickers")}. ${name} gives away ${r}.`,
  },
];

const tex = (s: string) => `$${s}$`;

export const PICTURE_VARIANTS = [
  "join-expr",
  "take-expr",
  "join-eq",
  "take-eq",
  "story",
  "words",
] as const;

function pictureToSentence(seed: string, r: Random): GeneratedProblem {
  const v = random("picture-to-number-sentence:variant", seed);
  const variant = PICTURE_VARIANTS[v(0, PICTURE_VARIANTS.length - 1)]!;
  const join =
    variant === "join-expr" || variant === "join-eq"
      ? true
      : variant === "take-expr" || variant === "take-eq"
        ? false
        : v(0, 1) === 1;
  const id = "picture-to-number-sentence";
  const label = "Choose one answer";
  const feedback = {
    wrongOpJoin:
      "Minus means some go away. In this one more come in, so the sentence uses plus.",
    wrongOpTake:
      "Plus means more come in. In this one some go away, so the sentence uses minus.",
  };
  if (variant === "words") {
    const t = pick(r, THINGS);
    if (join) {
      const a = r(1, 9),
        b = r(1, 10 - a);
      if (a === b) throw new Error("Need two different groups");
      const c = a + b;
      const big = Math.max(a, b),
        small = Math.min(a, b);
      const joined = `${moreThings(b, t)} ${verb(b, t.come)}`;
      const whole =
        c + b <= 10
          ? `${things(c, t)}. ${joined}. ${things(c + b, t)}.`
          : `${things(a, t)}. ${joined}. ${things(c - 1, t)}.`;
      const choices: Choice[] = [
        {
          label: `${things(a, t)}. ${joined}. ${things(c, t)}.`,
          correct: true,
        },
        {
          label: `${things(big, t)}. ${things(small, t)} ${verb(small, t.leave)}. ${things(big - small, t)} ${isAre(big - small)} left.`,
          feedback: `In the picture more ${t.many} come in. Some going away would be taking away.`,
        },
        {
          label: whole,
          feedback:
            c + b <= 10
              ? `It starts with ${things(c, t)}, but ${c} is how many there are after they join. The picture starts with ${a}.`
              : `Count again: $${a} + ${b} = ${c}$, not ${c - 1}.`,
        },
        {
          label: `${things(a, t)}. ${joined}. ${things(c + 1, t)}.`,
          feedback: `Count again: $${a} + ${b} = ${c}$, not ${c + 1}.`,
        },
      ];
      return finish(id, seed, r, {
        prompt: `Each teal counter and each rust counter is a ${t.one}. Which one tells what happened?`,
        hint: `Say the picture out loud: first there ${isAre(a)} ${things(a, t)}. What happens in the middle: do more come, or do some go away?`,
        explanation: [
          `First there ${isAre(a)} ${count(a, "teal counter")}: ${things(a, t)}.`,
          `The arrow shows ${count(b, "rust counter")} coming in: ${joined}.`,
          `Now count them all: ${c}. So it tells ${things(a, t)}, then ${joined}, then ${things(c, t)}.`,
        ],
        figure: figure(
          sceneOf(
            ...counterElements({ kind: "join", first: a, second: b }),
          ).build({
            ...COUNTER_FIGURE,
            title: `${t.many[0]!.toUpperCase()}${t.many.slice(1)} shown as counters`,
            note: describePicture({ kind: "join", first: a, second: b }),
          }),
        ),
        variant: "words-join",
        label,
        choices,
      });
    }
    const total = r(3, 10),
      leave = r(1, total - 1),
      stay = total - leave;
    if (stay === leave)
      throw new Error("Need what stays and what leaves to differ");
    const miss = stay >= 2 && r(0, 1) ? stay - 1 : stay + 1;
    const went = `${things(leave, t)} ${verb(leave, t.leave)}`;
    const left = `${things(stay, t)} ${isAre(stay)} left`;
    const choices: Choice[] = [
      { label: `${things(total, t)}. ${went}. ${left}.`, correct: true },
      {
        label: `${things(total, t)}. ${moreThings(leave, t)} ${verb(leave, t.come)}. ${things(total + leave, t)}.`,
        feedback: `In the picture some ${t.many} go away. More coming in would be adding.`,
      },
      {
        label: `${things(total, t)}. ${things(stay, t)} ${verb(stay, t.leave)}. ${things(leave, t)} ${isAre(leave)} left.`,
        feedback: `This swaps them: ${leave} went away and ${stay} stayed.`,
      },
      {
        label: `${things(total, t)}. ${went}. ${things(miss, t)} ${isAre(miss)} left.`,
        feedback: `Count what stays again: ${stay}, not ${miss}.`,
      },
    ];
    return finish(id, seed, r, {
      prompt: `Each counter is a ${t.one}. Which one tells what happened?`,
      hint: `Say the picture out loud: first there are ${things(total, t)}, the solid ones and the faded ones. What happens in the middle?`,
      explanation: [
        `At first there are ${total} counters, solid and faded: ${things(total, t)}.`,
        `The arrow shows the faded ${leave === 1 ? "one" : "ones"} going away: ${went}.`,
        `${things(stay, t)} ${stay === 1 ? "stays" : "stay"}. So it tells ${things(total, t)}, then ${went}, then ${left}.`,
      ],
      figure: figure(
        sceneOf(...counterElements({ kind: "take", stay, leave })).build({
          ...COUNTER_FIGURE,
          title: `${t.many[0]!.toUpperCase()}${t.many.slice(1)} shown as counters`,
          note: describePicture({ kind: "take", stay, leave }),
        }),
      ),
      variant: "words-take",
      label,
      choices,
    });
  }
  const equation =
    variant === "join-eq" || variant === "take-eq" || variant === "story";
  const name = storyName((k) => r(0, k - 1));
  let choices: Choice[];
  let explanation: string[];
  let pictureFigure: SemanticFigure | undefined;
  let prompt: string;
  let hint: string;
  if (join) {
    // join-eq and story: a ≥ b, a + b ≤ 9; join-expr: a + b ≤ 10.
    let a: number, b: number;
    if (equation) {
      a = r(1, 8);
      b = r(1, Math.min(a, 9 - a));
      if (b < 1) throw new Error("Need a second group");
    } else {
      a = r(1, 9);
      b = r(1, 10 - a);
    }
    const c = a + b;
    if (equation) {
      const third =
        c + b <= 10
          ? {
              label: tex(`${c} + ${b} = ${c + b}`),
              feedback: `${c} is how many there are after they join. The first part is ${a}.`,
            }
          : {
              label: tex(`${a} + ${b} = ${c - 1}`),
              feedback: `Count all of them again: ${a} and ${b} make ${c}, not ${c - 1}.`,
            };
      choices = [
        { label: tex(`${a} + ${b} = ${c}`), correct: true },
        {
          label: tex(`${a} - ${b} = ${a - b}`),
          feedback: feedback.wrongOpJoin,
        },
        {
          label: tex(`${a} + ${b} = ${c + 1}`),
          feedback: `Count all of them again: ${a} and ${b} make ${c}, not ${c + 1}.`,
        },
        third,
      ];
    } else {
      const [x, y] = a >= b ? [a, b] : [b, a];
      choices = [
        { label: tex(`${a} + ${b}`), correct: true },
        { label: tex(`${x} - ${y}`), feedback: feedback.wrongOpJoin },
        {
          label: String(c),
          feedback: `${c} is how many there are in all. A number sentence also shows the 2 groups and that they join.`,
        },
        {
          label: tex(`${c} + ${b}`),
          feedback: `${c} is the whole group after they join. The first part is ${a}.`,
        },
      ];
    }
    if (variant === "story") {
      const story = pick(r, STORIES);
      prompt = `${story.join(a, b, name)} Which number sentence tells the story?`;
      const more = `${b} more ${b === 1 ? "comes" : "come"}`;
      hint = `The story starts with ${a}. Then ${more}. Do more come, or do some go away? More coming is plus.`;
      explanation = [
        `The story starts with ${a}.`,
        `Then ${more}. More coming in is joining, so it is plus: ${tex(`${a} + ${b}`)}.`,
        `Put together, there are ${c}. So ${tex(`${a} + ${b} = ${c}`)}.`,
      ];
    } else {
      prompt = equation
        ? "Which number sentence tells about this picture?"
        : "Which one shows this picture?";
      hint = `Count the teal group first: ${count(a, "counter")}. Then look at the arrow: do more come in, or do some go away?`;
      explanation = [
        `Count the teal group: ${a}.`,
        `Count the rust group: ${b}.`,
        `The arrow shows the rust group coming in. Put together is plus: ${tex(`${a} + ${b}`)}.`,
        ...(equation
          ? [`Count all of them: ${c}. So ${tex(`${a} + ${b} = ${c}`)}.`]
          : []),
      ];
      pictureFigure = figure(
        sceneOf(
          ...counterElements({ kind: "join", first: a, second: b }),
        ).build({
          ...COUNTER_FIGURE,
          title: "Counters joining a group",
          note: describePicture({ kind: "join", first: a, second: b }),
        }),
      );
    }
  } else {
    const total = equation ? r(3, 10) : r(2, 10);
    const leave = r(1, total - 1);
    const stay = total - leave;
    if (equation && stay === leave)
      throw new Error("Need what stays and what leaves to differ");
    if (equation) {
      const miss = stay >= 2 ? stay - 1 : stay + 1;
      choices = [
        { label: tex(`${total} - ${leave} = ${stay}`), correct: true },
        {
          label: tex(`${total} - ${stay} = ${leave}`),
          feedback: `This swaps them: ${leave} went away and ${stay} stayed.`,
        },
        {
          label: tex(`${total} + ${leave} = ${total + leave}`),
          feedback: feedback.wrongOpTake,
        },
        {
          label: tex(`${total} - ${leave} = ${miss}`),
          feedback: `Count what stays again: ${stay}, not ${miss}.`,
        },
      ];
    } else {
      choices = [
        { label: tex(`${total} - ${leave}`), correct: true },
        { label: tex(`${total} + ${leave}`), feedback: feedback.wrongOpTake },
        stay !== leave
          ? {
              label: tex(`${total} - ${stay}`),
              feedback: `${stay} is how many stayed. Take away the ${leave} that went away.`,
            }
          : {
              label: tex(`${leave} - ${total}`),
              feedback: `Start with all ${total}, then take away ${leave}.`,
            },
        {
          label: String(stay),
          feedback: `${stay} is how many are left. A number sentence also shows how many there were and how many went away.`,
        },
      ];
    }
    if (variant === "story") {
      const story = pick(r, STORIES);
      prompt = `${story.leave(total, leave, name)} Which number sentence tells the story?`;
      const away = `${leave} ${leave === 1 ? "goes" : "go"} away`;
      hint = `The story starts with ${total}. Then ${away}. Do more come, or do some go away? Going away is minus.`;
      explanation = [
        `The story starts with ${total}.`,
        `Then ${away}. Some leaving is taking away, so it is minus: ${tex(`${total} - ${leave}`)}.`,
        `${stay} ${stay === 1 ? "is" : "are"} left. So ${tex(`${total} - ${leave} = ${stay}`)}.`,
      ];
    } else {
      prompt = equation
        ? "Which number sentence tells about this picture?"
        : "Which one shows this picture?";
      hint = `Count every counter, the solid ones and the faded ones: ${total}. Then look at the arrow: do more come in, or do some go away?`;
      explanation = [
        `Count all that were there, the solid ones and the faded ones: ${total}.`,
        `The faded ones are going away: ${leave}.`,
        `Some go away, so it is minus: ${tex(`${total} - ${leave}`)}.`,
        ...(equation
          ? [
              `Count what stays: ${stay}. So ${tex(`${total} - ${leave} = ${stay}`)}.`,
            ]
          : []),
      ];
      pictureFigure = figure(
        sceneOf(...counterElements({ kind: "take", stay, leave })).build({
          ...COUNTER_FIGURE,
          title: "Counters leaving a group",
          note: describePicture({ kind: "take", stay, leave }),
        }),
      );
    }
  }
  return finish(id, seed, r, {
    prompt,
    hint,
    explanation,
    ...(pictureFigure ? { figure: pictureFigure } : {}),
    variant: variant === "story" ? `story-${join ? "join" : "take"}` : variant,
    label,
    choices,
  });
}

export const SENTENCE_VARIANTS = ["join-pic", "take-pic", "frame-pic"] as const;

function sentenceToPicture(seed: string, r: Random): GeneratedProblem {
  const v = random("number-sentence-to-picture:variant", seed);
  const variant = SENTENCE_VARIANTS[v(0, SENTENCE_VARIANTS.length - 1)]!;
  const withEquals = variant !== "frame-pic" && v(0, 1) === 1;
  type Card = { p: CounterPicture; feedback?: string };
  const make = (p: CounterPicture, feedback?: string): Card => ({
    p,
    ...(feedback ? { feedback } : {}),
  });
  /** Every card on one shared canvas, so all draw at the same scale. */
  const cards = (correct: Card, wrong: Card[]): [Candidate, Candidate[]] => {
    const all = [correct, ...wrong];
    const drawn = onCanvas(
      all.map((c) => pictureElements(c.p)),
      [7, 2.6],
    );
    const out = all.map((c, i): Candidate => ({
      description: describePicture(c.p),
      scene: sceneOf(...drawn[i]!).build(COUNTER_OPTION),
      ...(c.feedback ? { feedback: c.feedback } : {}),
    }));
    return [out[0]!, out.slice(1)];
  };
  if (variant === "take-pic") {
    const total = r(3, 10),
      leave = r(1, total - 1),
      stay = total - leave;
    if (stay === leave)
      throw new Error("Need what stays and what leaves to differ");
    const sentence = withEquals
      ? `${total} - ${leave} = ${stay}`
      : `${total} - ${leave}`;
    const [correct, distractors] = cards(make({ kind: "take", stay, leave }), [
      make(
        { kind: "join", first: total, second: leave },
        `This picture shows ${leave} more coming in. That is plus, not minus.`,
      ),
      make(
        { kind: "take", stay: leave, leave: stay },
        `This picture takes away ${stay}, the number that should be left. ${tex(sentence)} takes away ${leave}.`,
      ),
      make(
        { kind: "all", count: stay },
        `This picture shows only what is left, ${stay}. It does not show the ${total} at the start or the ${leave} going away.`,
      ),
    ]);
    return finish("number-sentence-to-picture", seed, r, {
      prompt: `Which picture shows ${tex(sentence)}?`,
      hint: `Minus means some go away. Find a picture that starts with ${total} counters, then count the faded ones going away.`,
      explanation: [
        `Read the sentence: ${total} take away ${leave}. Minus means some go away.`,
        `Find a picture with ${total} counters in all: ${count(leave, "counter")} going away and ${stay} staying.`,
      ],
      variant: "take-pic",
      figureChoice: {
        label: "Choose the picture",
        correct,
        distractors,
        explain: (name) => [
          `${name(distractors[0]!)} shows counters coming in. That is plus.`,
          `${name(distractors[1]!)} shows ${stay} going away, not ${leave}.`,
          `${name(distractors[2]!)} shows only what is left, ${stay}.`,
          `${name(correct)} starts with ${total} counters, and ${leave} go away. It shows ${tex(sentence)}.`,
        ],
      },
    });
  }
  const a = r(1, 9),
    b = r(1, 10 - a),
    c = a + b;
  const sentence = withEquals ? `${a} + ${b} = ${c}` : `${a} + ${b}`;
  // One too many in the second group, or one too few when the frame is full.
  const miss: [number, number] =
    c < 10 ? [a, b + 1] : b >= 2 ? [a, b - 1] : [a - 1, b];
  if (variant === "join-pic") {
    const minus: CounterPicture =
      a > b
        ? { kind: "take", stay: a - b, leave: b }
        : a < b
          ? { kind: "take", stay: b - a, leave: a }
          : { kind: "take", stay: a, leave: b };
    const [correct, distractors] = cards(
      make({ kind: "join", first: a, second: b }),
      [
        make(
          minus,
          "This picture shows counters going away. That is minus, not plus.",
        ),
        make(
          { kind: "all", count: c },
          `This picture shows only the ${c} in all. It does not show the 2 groups of ${a} and ${b} coming together.`,
        ),
        make(
          { kind: "join", first: miss[0], second: miss[1] },
          `Count each group again. ${tex(sentence)} needs ${a} and ${b}.`,
        ),
      ],
    );
    return finish("number-sentence-to-picture", seed, r, {
      prompt: `Which picture shows ${tex(sentence)}?`,
      hint: `Plus means 2 groups come together. Find a picture with a group of ${a} and ${b} more coming in.`,
      explanation: [
        `Read the sentence: ${a} plus ${b}. Plus means 2 groups are put together.`,
        `Find a group of ${a}, and ${b} more coming in to join it.`,
      ],
      variant: "join-pic",
      figureChoice: {
        label: "Choose the picture",
        correct,
        distractors,
        explain: (name) => [
          `${name(distractors[0]!)} shows counters going away. That is minus.`,
          `${name(distractors[1]!)} shows only ${c}. It does not show the 2 groups.`,
          `${name(distractors[2]!)} shows ${miss[0]} and ${miss[1]}, not ${a} and ${b}.`,
          `${name(correct)} shows ${count(a, "teal counter")} with ${count(b, "rust counter")} coming in. It shows ${tex(sentence)}.`,
        ],
      },
    });
  }
  // frame-pic
  const big = Math.max(a, b),
    small = Math.min(a, b);
  const minus: CounterPicture =
    a !== b
      ? { kind: "frame", first: big, second: 0, crossed: small }
      : { kind: "frame", first: c, second: 0, crossed: b };
  const [correct, distractors] = cards(
    make({ kind: "frame", first: a, second: b, crossed: 0 }),
    [
      make(
        minus,
        "This ten frame has counters crossed out. Crossing out is taking away, which is minus.",
      ),
      make(
        { kind: "frame", first: c, second: 0, crossed: 0 },
        `This ten frame shows only the ${c} in all, in one color. It does not show the 2 parts, ${a} and ${b}.`,
      ),
      make(
        { kind: "frame", first: miss[0], second: miss[1], crossed: 0 },
        `Count each color again. ${tex(sentence)} needs ${a} teal and ${b} rust.`,
      ),
    ],
  );
  return finish("number-sentence-to-picture", seed, r, {
    prompt: `Which ten frame shows ${tex(sentence)}?`,
    hint: `Plus means 2 parts go together. Look for a ten frame with ${count(a, "counter")} of one color, then ${b} of the other color.`,
    explanation: [
      `Read the sentence: ${a} plus ${b}. Plus means 2 parts are put together.`,
      `Find a ten frame with ${count(a, "counter")} of one color and then ${b} of the other color, and nothing crossed out.`,
    ],
    variant: "frame-pic",
    figureChoice: {
      label: "Choose the ten frame",
      correct,
      distractors,
      explain: (name) => [
        `${name(distractors[0]!)} has counters crossed out. That is minus.`,
        `${name(distractors[1]!)} shows ${c} in one color. It does not show the 2 parts.`,
        `${name(distractors[2]!)} shows ${miss[0]} and ${miss[1]}, not ${a} and ${b}.`,
        `${name(correct)} shows ${a} teal and then ${b} rust. It shows ${tex(sentence)}.`,
      ],
    },
  });
}

/* ------------------------------------------------------------ dispatch */

const generators: Record<
  string,
  (seed: string, r: Random) => GeneratedProblem
> = {
  "sticks-and-balls-needed": sticksAndBalls,
  "check-the-drawing": checkTheDrawing,
  "drawing-mistake": drawingMistake,
  "picture-to-number-sentence": pictureToSentence,
  "number-sentence-to-picture": sentenceToPicture,
};

export function generateKBuildRepresent(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate) throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  // A draw that cannot make a valid item is redrawn from a salted stream; the
  // variant comes from the seed alone and never changes.
  for (let attempt = 0; attempt < 60; attempt++)
    try {
      return generate(
        seed,
        random(templateId, attempt ? `${seed}#${attempt}` : seed),
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  throw new Error(`${templateId}: no instance for ${seed}`);
}
