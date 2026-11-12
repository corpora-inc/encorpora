import { withArticle } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { random, shuffle, type Random } from "./distribution-practice.js";
import {
  serializeMultiPart,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
  type MultiPartSentence,
} from "./multi-part-choice.js";
import { scene } from "./scene/author.js";
import type { Element, Point } from "./scene/spec.js";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes.js";

/**
 * Explaining a proof of the Pythagorean theorem and of its converse
 * (CCSS 8.G.B.6). The rearrangement proof: four copies of a right triangle
 * in a square of side a + b leave a tilted square of side c; slid into two
 * a-by-b rectangles they leave squares of side a and b. The converse: build
 * a right triangle with the same legs; its hypotenuse is √(a² + b²) = c, so
 * the triangles are congruent; and the hinge, whose third side grows as it
 * opens. Each type asks for a decision a written explanation is made of: an
 * area, the equation a picture records, a reason, the next step, a missing
 * piece or a flaw. Every figure is drawn to scale from scene primitives.
 */

const skillId = "pythagorean-theorem";
const band = "6–8" as const;
const figures = {
  requiredFigureCapability: "scenes-v1" as const,
  /** "if-part", "counted as parts": ordinary words, not a part of a whole. */
  glossaryNoLink: ["part", "parts"],
};
const shapeSenses = {
  side: "side",
  sides: "side",
  square: "square-shape",
  squares: "square-shape",
};
const numberSenses = {
  side: "side",
  sides: "side",
  square: "square-number",
  squares: "square-number",
};

export const pythagoreanProofsTemplates: readonly TemplateMetadata[] = [
  {
    id: "pythagorean-proof-area",
    version: 1,
    title: "Areas in the rearrangement proof",
    skillId,
    gradeBand: band,
    description:
      "Four copies of a right triangle with whole-number legs sit in a square whose side is the sum of the legs. Find the area of the tilted square they leave, or of the two squares left when the triangles are slid into two rectangles.",
    glossarySenses: shapeSenses,
    ...figures,
  },
  {
    id: "pythagorean-proof-figure",
    version: 1,
    title: "Read the proof in the picture",
    skillId,
    gradeBand: band,
    description:
      "Choose the equation that counts the big square two ways, the reason the two leftover areas are equal, or the reason the middle shape has right-angle corners.",
    glossarySenses: shapeSenses,
    requiredResponseCapability: "single-choice-v1",
    ...figures,
  },
  {
    id: "pythagorean-proof-steps",
    version: 1,
    title: "Order or complete the proof",
    skillId,
    gradeBand: band,
    description:
      "Put the steps of the two-picture proof or the two-count proof in order, leaving out statements that belong nowhere, or fill two blanks of the written two-count proof.",
    glossarySenses: shapeSenses,
    requiredResponseCapability: "multi-part-choice-v1",
    ...figures,
  },
  {
    id: "pythagorean-proof-flaw",
    version: 1,
    title: "Find the flaw in a proof",
    skillId,
    gradeBand: band,
    description:
      "Say what is wrong with an argument for the Pythagorean theorem: an example used as a proof, a circular step, a square never shown to be one, a triangle area of ab, or a square of a + b written as a² + b².",
    glossarySenses: shapeSenses,
    requiredResponseCapability: "single-choice-v1",
    ...figures,
  },
  {
    id: "pythagorean-converse-proof",
    version: 1,
    title: "The converse and why it holds",
    skillId,
    gradeBand: band,
    description:
      "Pick the converse of the Pythagorean theorem, read the angle of a hinge from its third side, say why the hinge proves the converse, or find the flaw in an argument that uses it.",
    glossarySenses: numberSenses,
    requiredResponseCapability: "single-choice-v1",
    ...figures,
  },
  {
    id: "pythagorean-converse-blanks",
    version: 1,
    title: "Complete the proof of the converse",
    skillId,
    gradeBand: band,
    description:
      "Fill the four blanks of the proof of the converse: the hypotenuse of a right triangle with the same legs, its length, why the two triangles match, and where the right angle is.",
    glossarySenses: numberSenses,
    requiredResponseCapability: "multi-part-choice-v1",
    ...figures,
  },
];

const metaOf = (id: string) =>
  pythagoreanProofsTemplates.find((t) => t.id === id)!;

/** Pythagorean triples used for numbers in the converse items. */
export const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [9, 12, 15],
  [12, 16, 20],
  [20, 21, 29],
];
/** Drawing proportions for figures labeled with letters. */
const SHAPES: readonly (readonly [number, number])[] = [
  [2, 3],
  [3, 4],
  [3, 5],
  [2, 5],
  [4, 5],
  [3, 7],
];
const NAMES = [
  "Ana",
  "Ben",
  "Chen",
  "Dara",
  "Eli",
  "Femi",
  "Gia",
  "Hugo",
  "Iris",
  "Jonah",
  "Kofi",
  "Lena",
] as const;

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

/* ------------------------------------------------------------------ */
/* Problem assembly                                                     */
/* ------------------------------------------------------------------ */

type Choice = { label: string; correct?: true; feedback?: string };
type Built = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure: SemanticFigure;
  /** Number answer (number templates). */
  answer?: string;
  label?: string;
  /** Single choice: exactly one correct; shuffled with the seed. */
  choices?: Choice[];
  /** Multi-part choice: the response and its key (blank id → option id). */
  parts?: { response: MultiPartChoiceResponse; key: Record<string, string> };
  variant: Record<string, string>;
};

function finish(id: string, seed: string, r: Random, built: Built) {
  const meta = metaOf(id);
  let answer = built.answer ?? "";
  let response: ProblemResponse;
  let choiceFeedback: Record<string, string> | undefined;
  if (built.choices) {
    const choices = shuffle(r, [...built.choices]);
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length ||
      choices.some((c) => c.label.length > 120 || (!c.correct && !c.feedback))
    )
      throw new Error(
        `${id}: invalid choices ${choices.map((c) => c.label).join(" | ")}`,
      );
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: built.label ?? "Choose one answer",
      options: choices.map((c, i) => {
        const optionId = `option-${"abcd"[i]}`;
        if (c.correct) answer = optionId;
        else choiceFeedback![optionId] = c.feedback!;
        return { id: optionId, label: c.label };
      }),
    };
  } else if (built.parts) {
    const { response: parts, key } = built.parts;
    for (const blank of parts.blanks)
      if (blank.options.some((o) => o.label.length > 80))
        throw new Error(`${id}: option label over 80 characters`);
    response = parts;
    answer = serializeMultiPart(parts, key);
  } else {
    response = { kind: "number", label: built.label ?? "Answer" };
  }
  const axes = axisRecord(built.variant);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, meta.version, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1 as const,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response,
      figure: built.figure,
    },
    answer,
    explanation: built.explanation,
    hint: built.hint,
    ...(choiceFeedback ? { choiceFeedback } : {}),
    variant: { id: Object.values(built.variant).join("-"), axes },
  } satisfies GeneratedProblem;
}

/* ------------------------------------------------------------------ */
/* Figures                                                              */
/* ------------------------------------------------------------------ */

type V = Point;
const add = (p: V, q: V): V => [p[0] + q[0], p[1] + q[1]];
const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]];
const mul = (p: V, k: number): V => [p[0] * k, p[1] * k];
const len = (p: V) => Math.hypot(p[0], p[1]);
const unit = (p: V): V => mul(p, 1 / (len(p) || 1));
const mid = (p: V, q: V): V => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const deg = (t: number) => (t * 180) / Math.PI;
const dir = (p: V) => deg(Math.atan2(p[1], p[0]));

/** A math-font label set off from `at` toward `out` by `px` pixels. */
function tag(id: string, text: string, at: V, out: V, px = 8): Element {
  const u = unit(out);
  return {
    type: "text",
    id,
    at,
    text,
    font: "math",
    size: "md",
    halo: true,
    align: [
      u[0] > 0.3 ? -1 : u[0] < -0.3 ? 1 : 0,
      u[1] > 0.3 ? 1 : u[1] < -0.3 ? -1 : 0,
    ],
    offset: [u[0] * px, -u[1] * px],
  };
}
/** A label at the middle of side pq, on the side away from `inside`. */
function sideTag(id: string, text: string, p: V, q: V, inside: V): Element {
  const m = mid(p, q);
  const n = unit([-(q[1] - p[1]), q[0] - p[0]]);
  const away =
    n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) >= 0 ? n : mul(n, -1);
  return tag(id, text, m, away);
}
const poly = (
  id: string,
  points: V[],
  fill: "accent-fill" | "warm-fill" | "gold-fill" | "none",
  width = 2,
): Element => ({
  type: "polygon",
  id,
  points,
  fill,
  stroke: "ink",
  width,
});
/** A right-angle square at v between the directions toward p and q. */
function rightMark(id: string, v: V, p: V, q: V, size: number): Element {
  const u = unit(sub(p, v)),
    w = unit(sub(q, v));
  return {
    type: "polyline",
    id,
    points: [
      add(v, mul(u, size)),
      add(v, mul(add(u, w), size)),
      add(v, mul(w, size)),
    ],
    stroke: "ink",
    width: 1.5,
  };
}
/** Unit grid lines over [x0, x0 + n] × [y0, y0 + n] as one path. */
function grid(id: string, x0: number, y0: number, n: number): Element {
  const d: (["M", number, number] | ["L", number, number])[] = [];
  for (let k = 1; k < n; k++) {
    d.push(["M", x0 + k, y0], ["L", x0 + k, y0 + n]);
    d.push(["M", x0, y0 + k], ["L", x0 + n, y0 + k]);
  }
  return { type: "path", id, d, stroke: "grid", width: 1 };
}

type Labels = { a: string; b: string; c?: string; side?: string };

/** Arrangement 1: four triangles at the corners of a square of side a + b,
 * each side split a then b going around, leaving a tilted square. */
function arrangementOne(
  p: string,
  a: number,
  b: number,
  at: V,
  labels: Labels,
  o: { grid?: boolean; gold?: boolean } = {},
): Element[] {
  const s = a + b;
  const P = (x: number, y: number): V => [at[0] + x, at[1] + y];
  const c0 = P(s / 2, s / 2);
  const q1 = P(a, 0),
    q2 = P(s, a),
    q3 = P(b, s),
    q4 = P(0, b);
  const out: Element[] = [
    poly(`${p}mid`, [q1, q2, q3, q4], "accent-fill"),
    poly(`${p}t1`, [P(0, 0), q1, q4], "warm-fill"),
    poly(`${p}t2`, [q1, P(s, 0), q2], "warm-fill"),
    poly(`${p}t3`, [q2, P(s, s), q3], "warm-fill"),
    poly(`${p}t4`, [q3, P(0, s), q4], "warm-fill"),
  ];
  // The unit grid reads over the fills; the outline is drawn last.
  if (o.grid) out.push(grid(`${p}grid`, at[0], at[1], s));
  out.push(
    {
      type: "polygon",
      id: `${p}box`,
      points: [P(0, 0), P(s, 0), P(s, s), P(0, s)],
      fill: "none",
      stroke: "ink",
      width: 2.5,
    },
    sideTag(`${p}la`, labels.a, P(0, 0), q1, c0),
    sideTag(`${p}lb`, labels.b, q1, P(s, 0), c0),
    sideTag(`${p}lb2`, labels.b, P(0, 0), q4, c0),
    sideTag(`${p}la2`, labels.a, q4, P(0, s), c0),
  );
  if (labels.c)
    out.push(tag(`${p}lc`, labels.c, mid(q1, q4), sub(c0, mid(q1, q4)), 8));
  if (labels.side)
    out.push({
      type: "brace",
      id: `${p}side`,
      from: P(0, s),
      to: P(s, s),
      gap: 6,
      label: labels.side,
    });
  if (o.gold) {
    out.push(
      {
        type: "segment",
        id: `${p}gold`,
        from: P(0, 0),
        to: P(s, 0),
        stroke: "gold",
        width: 5,
      },
      {
        type: "arc",
        id: `${p}alpha`,
        center: q1,
        r: Math.min(a, b) * 0.32,
        from: dir(sub(q4, q1)),
        to: 180,
        stroke: "accent",
        width: 2,
      },
      {
        type: "arc",
        id: `${p}beta`,
        center: q1,
        r: Math.min(a, b) * 0.32,
        from: 0,
        to: dir(sub(q2, q1)),
        stroke: "warm",
        width: 2,
      },
      {
        type: "arc",
        id: `${p}corner`,
        center: q1,
        r: Math.min(a, b) * 0.22,
        from: dir(sub(q2, q1)),
        to: dir(sub(q4, q1)),
        stroke: "gold",
        width: 2,
      },
    );
  }
  return out;
}

/** Arrangement 2: the same four triangles as two a-by-b rectangles in
 * opposite corners, leaving an a-by-a and a b-by-b square. */
function arrangementTwo(
  p: string,
  a: number,
  b: number,
  at: V,
  labels: Labels,
  o: { grid?: boolean } = {},
): Element[] {
  const s = a + b;
  const P = (x: number, y: number): V => [at[0] + x, at[1] + y];
  const c0 = P(s / 2, s / 2);
  const out: Element[] = [
    poly(`${p}sa`, [P(0, 0), P(a, 0), P(a, a), P(0, a)], "accent-fill"),
    poly(`${p}sb`, [P(a, a), P(s, a), P(s, s), P(a, s)], "accent-fill"),
    poly(`${p}t1`, [P(a, 0), P(s, 0), P(s, a)], "warm-fill"),
    poly(`${p}t2`, [P(a, 0), P(s, a), P(a, a)], "warm-fill"),
    poly(`${p}t3`, [P(0, a), P(a, a), P(a, s)], "warm-fill"),
    poly(`${p}t4`, [P(0, a), P(a, s), P(0, s)], "warm-fill"),
  ];
  if (o.grid) out.push(grid(`${p}grid`, at[0], at[1], s));
  out.push(
    {
      type: "polygon",
      id: `${p}box`,
      points: [P(0, 0), P(s, 0), P(s, s), P(0, s)],
      fill: "none",
      stroke: "ink",
      width: 2.5,
    },
    sideTag(`${p}la`, labels.a, P(0, 0), P(a, 0), c0),
    sideTag(`${p}lb`, labels.b, P(a, 0), P(s, 0), c0),
    sideTag(`${p}la2`, labels.a, P(0, 0), P(0, a), c0),
    sideTag(`${p}lb2`, labels.b, P(0, a), P(0, s), c0),
  );
  if (labels.side)
    out.push({
      type: "brace",
      id: `${p}side`,
      from: P(0, s),
      to: P(s, s),
      gap: 6,
      label: labels.side,
    });
  return out;
}

const figureOf = (
  title: string,
  elements: Element[],
  note?: string,
): SemanticFigure => ({
  kind: "scene",
  scene: scene(...elements).build({ title, ...(note ? { note } : {}) }),
});

/** A right triangle with legs a (across) and b (up), its right angle at `at`. */
function rightTriangle(
  p: string,
  a: number,
  b: number,
  at: V,
  labels: { a: string; b: string; c: string },
): Element[] {
  const O = at,
    A = add(at, [a, 0]),
    B = add(at, [0, b]);
  const g: V = [(O[0] + A[0] + B[0]) / 3, (O[1] + A[1] + B[1]) / 3];
  return [
    poly(`${p}tri`, [O, A, B], "warm-fill", 2.5),
    rightMark(`${p}rt`, O, A, B, Math.min(a, b) * 0.14),
    sideTag(`${p}la`, labels.a, O, A, g),
    sideTag(`${p}lb`, labels.b, O, B, g),
    sideTag(`${p}lc`, labels.c, A, B, g),
  ];
}
/** A triangle with sides a, b and c (c longest, a² + b² = c²) drawn with c
 * along the bottom and no right-angle mark. */
function plainTriangle(
  p: string,
  a: number,
  b: number,
  c: number,
  at: V,
  labels: { a: string; b: string; c: string },
): Element[] {
  const P0 = at,
    Q = add(at, [c, 0]),
    R = add(at, [(a * a) / c, (a * b) / c]);
  const g: V = [(P0[0] + Q[0] + R[0]) / 3, (P0[1] + Q[1] + R[1]) / 3];
  return [
    poly(`${p}tri`, [P0, Q, R], "none", 2.5),
    sideTag(`${p}lc`, labels.c, P0, Q, g),
    sideTag(`${p}la`, labels.a, P0, R, g),
    sideTag(`${p}lb`, labels.b, R, Q, g),
  ];
}

/* ------------------------------------------------------------------ */
/* pythagorean-proof-area                                               */
/* ------------------------------------------------------------------ */

export const areaAxes = {
  variant: defineAxis("variant", ["middle-square", "two-squares"] as const),
} as const;

function proofArea(seed: string): GeneratedProblem {
  const id = "pythagorean-proof-area";
  const axes = chooseAxes(id, seed, areaAxes);
  const r = random(id, seed);
  const a = r(2, 7);
  const b = r(a + 1, Math.min(12, 15 - a));
  const s = a + b;
  const big = s * s,
    one = (a * b) / 2,
    four = 2 * a * b,
    leftover = a * a + b * b;
  const labels = { a: `${a}`, b: `${b}`, side: `${s}` };
  const wrong = `Common slips give ${big}, the whole square, or ${four}, the four triangles, or ${big - a * b}, which takes away only two triangles. The side length, ${s}, is not an area.`;
  if (axes.variant === "middle-square") {
    return finish(id, seed, r, {
      prompt: `Four copies of a right triangle with legs ${a} and ${b} sit inside a square of side ${s}, leaving a tilted square in the middle. What is the area of the tilted square?`,
      label: "Area of the tilted square",
      answer: `${leftover}`,
      figure: figureOf(
        `Four right triangles with legs ${a} and ${b} in a square of side ${s}`,
        arrangementOne("f", a, b, [0, 0], labels, { grid: true }),
        `The square is drawn on a unit grid. Each side is split into ${a} and ${b}, and a triangle sits at each corner. The uncovered middle is a tilted square.`,
      ),
      hint: `Find the area of the whole square of side ${s}. Then take away the four triangles; each is half of ${withArticle(a)} by ${b} rectangle.`,
      explanation: [
        `The big square has side $${a} + ${b} = ${s}$, so its area is $${s}^2 = ${big}$.`,
        `Each triangle is half of ${withArticle(a)} by ${b} rectangle, so its area is $\\tfrac{1}{2} \\times ${a} \\times ${b} = ${one}$. The four triangles cover $4 \\times ${one} = ${four}$.`,
        `The tilted square is the part the triangles leave uncovered: $${big} - ${four} = ${leftover}$.`,
        `Check: $${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${leftover}$. The tilted square's area equals the two leg lengths squared and added.`,
        wrong,
      ],
      variant: { variant: axes.variant },
    });
  }
  return finish(id, seed, r, {
    prompt: `Four copies of a right triangle with legs ${a} and ${b} are slid into two rectangles inside a square of side ${s}. What is the total area of the two squares left uncovered?`,
    label: "Total area of the two squares",
    answer: `${leftover}`,
    figure: figureOf(
      `Four right triangles with legs ${a} and ${b} as two rectangles in a square of side ${s}`,
      arrangementTwo("f", a, b, [0, 0], labels, { grid: true }),
      `The square is drawn on a unit grid. The rectangles fill opposite corners and leave a square of side ${a} and a square of side ${b} uncovered.`,
    ),
    hint: `Two triangles with legs ${a} and ${b} fit together as ${withArticle(a)} by ${b} rectangle. Which two squares do the rectangles leave uncovered?`,
    explanation: [
      `Each pair of triangles makes ${withArticle(a)} by ${b} rectangle. The two rectangles fill opposite corners of the square of side ${s}.`,
      `They leave a square of side ${a} and a square of side ${b} uncovered.`,
      `Their areas are $${a}^2 = ${a * a}$ and $${b}^2 = ${b * b}$, so together $${a * a} + ${b * b} = ${leftover}$.`,
      `Check: the whole square is $${s}^2 = ${big}$, the four triangles cover $4 \\times \\tfrac{1}{2} \\times ${a} \\times ${b} = ${four}$, and $${big} - ${four} = ${leftover}$.`,
      `In the first arrangement the same triangles leave the tilted square of side $c$, the hypotenuse. Same square, same triangles, same leftover area: $c^2 = ${a}^2 + ${b}^2$. That is the proof.`,
      wrong,
    ],
    variant: { variant: axes.variant },
  });
}

/* ------------------------------------------------------------------ */
/* pythagorean-proof-figure                                             */
/* ------------------------------------------------------------------ */

export const figureAxes = {
  variant: defineAxis("variant", ["equation", "leftovers", "corner"] as const),
} as const;

const letters = { a: "a", b: "b", c: "c", side: "a + b" };

function proofFigure(seed: string): GeneratedProblem {
  const id = "pythagorean-proof-figure";
  const axes = chooseAxes(id, seed, figureAxes);
  const r = random(id, seed);
  const [a, b] = pick(r, SHAPES);
  const variant = { variant: axes.variant };
  if (axes.variant === "equation") {
    const squareFirst = r(0, 1) === 1;
    const eq = (whole: string, parts: string) =>
      squareFirst ? `$${whole} = ${parts}$` : `$${parts} = ${whole}$`;
    return finish(id, seed, r, {
      prompt:
        "The area of the large square is counted two ways: as a square of side $a + b$, and as four triangles plus the middle square. Which equation records this?",
      figure: figureOf(
        "Four right triangles in a square of side a + b",
        arrangementOne("f", a, b, [0, 0], letters),
        "Each triangle has legs a and b and hypotenuse c. The uncovered middle is a tilted square with sides c.",
      ),
      choices: [
        {
          label: eq("(a + b)^2", "4 \\cdot \\tfrac{1}{2}ab + c^2"),
          correct: true,
        },
        {
          label: eq("(a + b)^2", "4ab + c^2"),
          feedback:
            "Each triangle is half of an $a$ by $b$ rectangle, so its area is $\\tfrac{1}{2}ab$, not $ab$.",
        },
        {
          label: eq("a^2 + b^2", "4 \\cdot \\tfrac{1}{2}ab + c^2"),
          feedback:
            "A square of side $a + b$ has area $(a + b)^2$. That is not $a^2 + b^2$: the square also holds two $a$ by $b$ rectangles.",
        },
        {
          label: eq("(a + b)^2", "4 \\cdot \\tfrac{1}{2}ab + c"),
          feedback:
            "The middle square has side $c$, so its area is $c^2$. The letter $c$ alone is a length, not an area.",
        },
      ],
      hint: "Each triangle is half of an $a$ by $b$ rectangle. Find one triangle's area and the middle square's area first.",
      explanation: [
        "Counted as one square, the big square has side $a + b$, so its area is $(a + b)^2$.",
        "Counted as parts, it is four triangles and the middle square. Each triangle is half of an $a$ by $b$ rectangle, so it has area $\\tfrac{1}{2}ab$. The middle square has side $c$, so its area is $c^2$.",
        "Both counts measure the same area: $(a + b)^2 = 4 \\cdot \\tfrac{1}{2}ab + c^2$.",
        "The other equations use $ab$ for a triangle, $a^2 + b^2$ for the big square, or $c$ for the middle square's area.",
      ],
      variant: {
        ...variant,
        order: squareFirst ? "square-first" : "parts-first",
      },
    });
  }
  if (axes.variant === "leftovers") {
    const elements = [
      ...arrangementOne("f", a, b, [0, 0], letters),
      ...arrangementTwo("g", a, b, [a + b + 2.5, 0], letters),
    ];
    return finish(id, seed, r, {
      prompt:
        "The same four triangles are placed two ways inside the same square of side $a + b$. Why must the tilted square left in the first picture have the same area as the two squares left in the second picture together?",
      figure: figureOf(
        "The same four right triangles placed two ways in a square of side a + b",
        elements,
        "On the left, the triangles sit at the corners and leave a tilted square with sides c. On the right, they form two rectangles and leave a square of side a and a square of side b.",
      ),
      choices: [
        {
          label:
            "The big square is the same and the same four triangles are removed, so what is left has the same area both times.",
          correct: true,
        },
        {
          label: "Because $a^2 + b^2 = c^2$.",
          feedback:
            "That is the rule being proved. A proof cannot use its own conclusion as a reason.",
        },
        {
          label: "Because the leftover parts are the same shape.",
          feedback:
            "They are not the same shape: one tilted square against two squares. Only their areas match.",
        },
        {
          label: "Because each triangle has area $\\tfrac{1}{2}ab$.",
          feedback:
            "That is true, but it does not compare the two leftovers. The reason is that the same area is taken from the same square.",
        },
      ],
      hint: "Both pictures start with a square of side $a + b$. Compare what is taken away in each picture.",
      explanation: [
        "Both pictures use the same big square, of side $a + b$.",
        "Both take away the same four triangles, so the same area, $4 \\cdot \\tfrac{1}{2}ab$, is covered each time.",
        "The same area minus the same amount leaves the same amount. So the tilted square's area $c^2$ equals $a^2 + b^2$, the two squares together.",
        "The leftovers have different shapes. Saying $a^2 + b^2 = c^2$ would use the conclusion as its own reason.",
      ],
      variant,
    });
  }
  return finish(id, seed, r, {
    prompt:
      "In the picture, the middle shape has four sides of length $c$. Look along the gold side of the big square. Why is each corner of the middle shape a right angle?",
    figure: figureOf(
      "Four right triangles in a square of side a + b, with one side gold",
      arrangementOne("f", a, b, [0, 0], letters, { gold: true }),
      "The middle shape has sides c. Along the gold bottom side, three angles meet at one point: an acute angle of one triangle, a corner of the middle shape, and an acute angle of the next triangle.",
    ),
    choices: [
      {
        label:
          "The two acute angles add to $90^\\circ$, so the corner on the straight side is $180^\\circ - 90^\\circ = 90^\\circ$.",
        correct: true,
      },
      {
        label: "Because its four sides are equal.",
        feedback:
          "A rhombus has four equal sides without right angles. Equal sides alone do not make the corners square.",
      },
      {
        label:
          "Because the triangles are right triangles, so every angle in the picture is $90^\\circ$.",
        feedback:
          "Each triangle has only one right angle. Its other two angles are acute.",
      },
      {
        label: "Because the large shape is a square.",
        feedback:
          "The outer square's corners are not the middle shape's corners. Each middle corner sits on a straight side.",
      },
    ],
    hint: "Three angles sit side by side along the gold side, which is straight. What do the two acute angles of one right triangle add to?",
    explanation: [
      "Along the gold side, three angles fill a straight angle of $180^\\circ$: an acute angle of one triangle, a corner of the middle shape, and an acute angle of the next triangle.",
      "The two acute angles are the two acute angles of the same right triangle. A triangle's angles add to $180^\\circ$ and the right angle takes $90^\\circ$, so the acute angles add to $90^\\circ$.",
      "So the middle corner is $180^\\circ - 90^\\circ = 90^\\circ$. Every corner works the same way, so the middle shape is a square with area $c^2$.",
      "Equal sides alone would allow a rhombus. The outer square's corners are not the middle corners.",
    ],
    variant,
  });
}

/* ------------------------------------------------------------------ */
/* pythagorean-proof-steps                                              */
/* ------------------------------------------------------------------ */

export const STEPS_TWO_PICTURES = [
  "Four triangles in a square of side $a + b$ leave a tilted square of side $c$.",
  "The same four, as two $a$ by $b$ rectangles, leave squares of sides $a$ and $b$.",
  "Same square, same four triangles: the leftover areas are equal.",
  "So $c^2 = a^2 + b^2$.",
] as const;
export const STEPS_TWO_COUNTS = [
  "Four triangles in a square of side $a + b$ leave a middle square of side $c$.",
  "First count the big square as one square: $(a + b)^2 = a^2 + 2ab + b^2$.",
  "Count it again as parts: $4 \\cdot \\tfrac{1}{2}ab + c^2 = 2ab + c^2$.",
  "The two counts are equal: $a^2 + 2ab + b^2 = 2ab + c^2$.",
  "Subtract $2ab$ from both counts: $a^2 + b^2 = c^2$.",
] as const;
export const STEP_DECOYS = [
  "Measure the hypotenuse and check that it equals $a + b$.",
  "Since $a^2 + b^2 = c^2$, the middle square has side $c$.",
] as const;

/** The written two-count proof, blank by blank, in reading order. */
const PROOF_BLANKS = [
  {
    id: "corner",
    label: "the corner of the middle shape",
    before:
      "Four copies of the right triangle sit in a square of side $a + b$. Each corner of the middle shape is ",
    correct:
      "$180^\\circ - 90^\\circ = 90^\\circ$, as the acute angles add to $90^\\circ$",
    wrong: [
      "$90^\\circ$, because its four sides are equal",
      "$90^\\circ$, because the big shape is a square",
      "$180^\\circ - 45^\\circ - 45^\\circ = 90^\\circ$",
    ],
  },
  {
    id: "mid",
    label: "the area of the middle square",
    before: ", so it is a square of side $c$, with area ",
    correct: "$c^2$",
    wrong: ["$c$", "$4c$", "$(a + b)^2$"],
  },
  {
    id: "tri",
    label: "the area of the four triangles",
    before:
      ". The four triangles have area $4 \\cdot \\tfrac{1}{2}ab$, which is ",
    correct: "$2ab$",
    wrong: ["$4ab$", "$\\tfrac{1}{2}ab$", "$(a + b)^2$"],
  },
  {
    id: "end",
    label: "the last step",
    before:
      ". Counting the big square both ways gives $a^2 + 2ab + b^2 = 2ab + c^2$, so ",
    correct: "$a^2 + b^2 = c^2$",
    wrong: ["$a + b = c$", "$(a + b)^2 = c^2$", "$2ab = c^2$"],
  },
] as const;
const BLANK_HINTS: Record<string, string> = {
  corner:
    "At a corner of the middle shape, two acute angles of the right triangle sit beside it on a straight side of $180^\\circ$. What do those two acute angles add to?",
  mid: "The middle shape is a square of side $c$. A square's area is its side times itself.",
  tri: "One triangle is half of an $a$ by $b$ rectangle. Work out $4 \\cdot \\tfrac{1}{2}ab$.",
  end: "Both counts contain $2ab$. Take $2ab$ away from each count and see what is left.",
};

export const stepsAxes = {
  variant: defineAxis("variant", [
    "order-two-pictures",
    "order-two-counts",
    "fill-blanks",
  ] as const),
} as const;

const optionIds = ["a", "b", "c", "d", "e", "f"] as const;

function proofSteps(seed: string): GeneratedProblem {
  const id = "pythagorean-proof-steps";
  const axes = chooseAxes(id, seed, stepsAxes);
  const r = random(id, seed);
  const [a, b] = pick(r, SHAPES);
  if (axes.variant !== "fill-blanks") {
    const twoPictures = axes.variant === "order-two-pictures";
    const steps: readonly string[] = twoPictures
      ? STEPS_TWO_PICTURES
      : STEPS_TWO_COUNTS;
    const decoys: string[] = twoPictures
      ? [...STEP_DECOYS]
      : [STEP_DECOYS[r(0, 1)]!];
    let pool: string[];
    do pool = shuffle(r, [...steps, ...decoys]);
    while (
      steps.every(
        (step, i) =>
          i === 0 || pool.indexOf(step) > pool.indexOf(steps[i - 1]!),
      )
    );
    const options = pool.map((label, i) => ({ id: optionIds[i]!, label }));
    const blanks: MultiPartBlank[] = steps.map((_, i) => ({
      id: `s${i + 1}`,
      label: `Step ${i + 1}`,
      options,
    }));
    const key = Object.fromEntries(
      steps.map((step, i) => [
        `s${i + 1}`,
        options.find((o) => o.label === step)!.id,
      ]),
    );
    const figure = twoPictures
      ? figureOf(
          "The same four right triangles placed two ways in a square of side a + b",
          [
            ...arrangementOne("f", a, b, [0, 0], letters),
            ...arrangementTwo("g", a, b, [a + b + 2.5, 0], letters),
          ],
          "On the left, triangles with legs a and b leave a tilted square with sides c. On the right, they form two rectangles and leave squares of sides a and b.",
        )
      : figureOf(
          "Four right triangles in a square of side a + b",
          arrangementOne("f", a, b, [0, 0], letters),
          "Each triangle has legs a and b and hypotenuse c. The uncovered middle is a square with sides c.",
        );
    const why: Record<string, string> = {
      [STEP_DECOYS[0]]:
        "measuring checks one drawing, not every right triangle, and the hypotenuse is shorter than $a + b$",
      [STEP_DECOYS[1]]: "it uses $a^2 + b^2 = c^2$, the result being proved",
    };
    return finish(id, seed, r, {
      prompt: twoPictures
        ? `Put the ${steps.length} steps of the proof that uses two pictures in order. Not every statement is used.`
        : `Put the ${steps.length} steps of the proof that counts the big square two ways in order. Not every statement is used.`,
      parts: {
        response: {
          kind: "multi-part-choice",
          label: "Choose the statement for each step",
          layout: "slots",
          blanks,
        },
        key,
      },
      figure,
      hint: twoPictures
        ? `Start with what is built first: four triangles in a square of side $a + b$. Each of the ${steps.length} steps must use the one before it.`
        : `Start by placing the four triangles in the square of side $a + b$. Then count its area once, count it again, and compare: ${steps.length} steps in all.`,
      explanation: [
        ...steps.map((step, i) => `Step ${i + 1}: ${step}`),
        twoPictures
          ? "Step 2 rearranges the triangles from step 1. Step 3 compares the two leftovers, so it needs both pictures. Step 4 names the leftover areas."
          : "The first step builds the picture. The second and third count its area twice, the fourth sets the counts equal, and the fifth takes $2ab$ from both.",
        ...decoys.map((d) => `“${d}” belongs nowhere: ${why[d]}.`),
      ],
      variant: { variant: axes.variant },
    });
  }
  const chosen = shuffle(r, [0, 1, 2, 3]).slice(0, 2).sort();
  const sentence: MultiPartSentence = [];
  let text = "";
  const blanks: MultiPartBlank[] = [];
  const key: Record<string, string> = {};
  PROOF_BLANKS.forEach((part, i) => {
    text += part.before;
    if (chosen.includes(i)) {
      sentence.push({ text });
      text = "";
      sentence.push({ blank: part.id });
      const labels = shuffle(r, [part.correct, ...part.wrong]);
      const options = labels.map((label, k) => ({ id: optionIds[k]!, label }));
      blanks.push({ id: part.id, label: part.label, options });
      key[part.id] = options.find((o) => o.label === part.correct)!.id;
    } else text += part.correct;
  });
  sentence.push({ text: `${text}.` });
  const first = PROOF_BLANKS[chosen[0]!]!.id;
  return finish(id, seed, r, {
    prompt:
      "Complete this proof of the Pythagorean theorem for a right triangle with legs $a$ and $b$ and hypotenuse $c$.",
    parts: {
      response: {
        kind: "multi-part-choice",
        label: "Choose an answer for each blank",
        layout: "inline",
        blanks,
        sentence,
      },
      key,
    },
    figure: figureOf(
      "Four right triangles in a square of side a + b",
      arrangementOne("f", a, b, [0, 0], letters),
      "Each triangle has legs a and b and hypotenuse c. The uncovered middle is a square with sides c.",
    ),
    hint: BLANK_HINTS[first]!,
    explanation: [
      "Each corner of the middle shape sits on a straight side, between the two acute angles of a right triangle. They add to $90^\\circ$, so the corner is $180^\\circ - 90^\\circ = 90^\\circ$.",
      "So the middle shape is a square of side $c$, and its area is $c^2$.",
      "Each triangle is half of an $a$ by $b$ rectangle, so four of them cover $4 \\cdot \\tfrac{1}{2}ab = 2ab$.",
      "As one square the area is $(a + b)^2 = a^2 + 2ab + b^2$. As parts it is $2ab + c^2$. Taking $2ab$ from both leaves $a^2 + b^2 = c^2$.",
    ],
    variant: {
      variant: axes.variant,
      blanks: chosen.map((i) => PROOF_BLANKS[i]!.id).join("-"),
    },
  });
}

/* ------------------------------------------------------------------ */
/* pythagorean-proof-flaw                                               */
/* ------------------------------------------------------------------ */

export const flawAxes = {
  flaw: defineAxis("flaw", [
    "example",
    "circular",
    "unproved-square",
    "triangle-area",
    "expansion",
  ] as const),
} as const;

const SOUND = "Nothing is wrong. Every step follows from the one before.";

function proofFlaw(seed: string): GeneratedProblem {
  const id = "pythagorean-proof-flaw";
  const axes = chooseAxes(id, seed, flawAxes);
  const r = random(id, seed);
  const name = pick(r, NAMES);
  const [da, db] = pick(r, SHAPES);
  const square = figureOf(
    `${name}'s drawing: four right triangles in a square of side a + b`,
    arrangementOne("f", da, db, [0, 0], letters),
    "Each triangle has legs a and b and hypotenuse c. The middle shape has sides c.",
  );
  const ask = (argument: string) =>
    `${name} wrote this argument for a right triangle with legs $a$ and $b$ and hypotenuse $c$.\n${argument}\nWhat is wrong with the argument?`;
  const flaw = axes.flaw;
  if (flaw === "example") {
    const [a, b, c] = pick(r, TRIPLES.slice(0, 4));
    return finish(id, seed, r, {
      prompt: ask(
        `“I drew a right triangle with legs ${a} and ${b}. The hypotenuse measures ${c}, and $${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c} = ${c}^2$. So $a^2 + b^2 = c^2$ for every right triangle.”`,
      ),
      figure: figureOf(
        `${name}'s drawing: a right triangle with legs ${a} and ${b} and hypotenuse ${c}.`,
        rightTriangle("f", a, b, [0, 0], {
          a: `${a}`,
          b: `${b}`,
          c: `${c}`,
        }),
      ),
      choices: [
        {
          label:
            "Checking one triangle does not show the rule for every right triangle. A proof must work for any legs $a$ and $b$.",
          correct: true,
        },
        {
          label: `A triangle with sides ${a}, ${b} and ${c} is not a right triangle.`,
          feedback: `It is a right triangle, and the arithmetic is right: $${a * a} + ${b * b} = ${c * c}$. The trouble is that it is only one example.`,
        },
        {
          label: `The hypotenuse should be $${a} + ${b} = ${a + b}$.`,
          feedback: `The hypotenuse is shorter than the two legs put end to end. It measures ${c}, not ${a + b}.`,
        },
        {
          label: "Nothing is wrong. Checking an example proves the rule.",
          feedback:
            "An example can agree with a rule that still fails for other triangles. A proof has to cover every right triangle.",
        },
      ],
      hint: `${name} checked legs ${a} and ${b}. Ask whether one checked triangle shows the rule for every possible pair of legs.`,
      explanation: [
        `The check is correct: $${a}^2 + ${b}^2 = ${c * c} = ${c}^2$.`,
        "But it shows the rule for one triangle only. A rule about every right triangle needs an argument that works for any legs $a$ and $b$.",
        "The rearrangement proof does that: it uses letters, so it covers every right triangle at once.",
      ],
      variant: { flaw },
    });
  }
  const banks: Record<
    Exclude<typeof flaw, "example">,
    {
      argument: string;
      right: string;
      wrong: [[string, string], [string, string]];
      hint: string;
      why: string[];
    }
  > = {
    circular: {
      argument:
        "“Four triangles in a square of side $a + b$ leave a middle shape with sides $c$. By the Pythagorean theorem, its area is $a^2 + b^2$. Its area is also $c^2$, so $a^2 + b^2 = c^2$.”",
      right:
        "It uses the Pythagorean theorem, the rule it is trying to prove, as a reason.",
      wrong: [
        [
          "The middle shape does not have sides of length $c$.",
          "Each side of the middle shape is the hypotenuse of a triangle, so it does have length $c$.",
        ],
        [
          "Its area should be $c$, not $c^2$.",
          "A square of side $c$ has area $c^2$. The letter $c$ alone is a length.",
        ],
      ],
      hint: `Check each reason ${name} gives. Can a proof of $a^2 + b^2 = c^2$ use that same rule as one of its reasons?`,
      why: [
        "The second sentence gives the Pythagorean theorem as its reason, and that is the rule being proved.",
        "An argument that assumes its conclusion proves nothing. The real proof finds the middle area from the big square: $(a + b)^2 - 2ab$.",
      ],
    },
    "unproved-square": {
      argument:
        "“The middle shape has four sides of length $c$, so it is a square with area $c^2$. Counting the big square two ways, $a^2 + 2ab + b^2 = 2ab + c^2$, so $a^2 + b^2 = c^2$.”",
      right:
        "Four equal sides do not make a square. The proof must show each corner is a right angle.",
      wrong: [
        [
          "The sides of the middle shape are not all $c$.",
          "They are all $c$: each is the hypotenuse of one of the four copies.",
        ],
        [
          "A square with side $c$ has area $4c$.",
          "$4c$ is the distance around the square. Its area is $c^2$.",
        ],
      ],
      hint: `Check what ${name} says makes the middle shape a square. What does a square need besides 4 equal sides?`,
      why: [
        "A rhombus also has four equal sides, and its corners need not be right angles.",
        "The fix: on each side of the big square, the two acute angles of a right triangle add to $90^\\circ$, so each middle corner is $180^\\circ - 90^\\circ = 90^\\circ$.",
      ],
    },
    "triangle-area": {
      argument:
        "“Each triangle has area $ab$. So $(a + b)^2 = 4ab + c^2$, which gives $c^2 = a^2 + b^2 - 2ab$.”",
      right:
        "A right triangle with legs $a$ and $b$ is half of an $a$ by $b$ rectangle, so its area is $\\tfrac{1}{2}ab$.",
      wrong: [
        [
          "$(a + b)^2$ should be $a^2 + b^2$.",
          "$(a + b)^2$ is right as the big square's area. Writing it as $a^2 + b^2$ would add a second mistake.",
        ],
        [
          "The four triangles do not fit inside the square.",
          "They fit exactly: each side of the square is $a$ then $b$.",
        ],
      ],
      hint: `Check the area ${name} uses for one triangle, and the $4ab$ for all four. Which rectangle is one triangle half of?`,
      why: [
        "The first step is wrong: a right triangle with legs $a$ and $b$ covers half of an $a$ by $b$ rectangle, so its area is $\\tfrac{1}{2}ab$.",
        "With the right area, $(a + b)^2 = 4 \\cdot \\tfrac{1}{2}ab + c^2 = 2ab + c^2$, and the proof ends with $a^2 + b^2 = c^2$.",
      ],
    },
    expansion: {
      argument:
        "“$(a + b)^2 = a^2 + b^2$, and the four triangles have area $2ab$, so $a^2 + b^2 = 2ab + c^2$.”",
      right:
        "$(a + b)^2$ is $a^2 + 2ab + b^2$: a square of side $a + b$ also holds two $a$ by $b$ rectangles.",
      wrong: [
        [
          "The four triangles have area $4ab$.",
          "Each triangle is $\\tfrac{1}{2}ab$, so four of them are $2ab$, as the argument says.",
        ],
        [
          "The middle square's area is $(a + b)^2$.",
          "$(a + b)^2$ is the whole big square. The middle square has side $c$.",
        ],
      ],
      hint: `Check ${name}'s first equation. Split each side of a square of side $a + b$ into $a$ and $b$, and count the 4 pieces inside.`,
      why: [
        "The first equation is wrong: a square of side $a + b$ splits into a square $a^2$, a square $b^2$ and two $a$ by $b$ rectangles.",
        "So $(a + b)^2 = a^2 + 2ab + b^2$. With that, the counts give $a^2 + 2ab + b^2 = 2ab + c^2$, so $a^2 + b^2 = c^2$.",
      ],
    },
  };
  const bank = banks[flaw];
  return finish(id, seed, r, {
    prompt: ask(bank.argument),
    figure: square,
    choices: [
      { label: bank.right, correct: true },
      { label: bank.wrong[0][0], feedback: bank.wrong[0][1] },
      { label: bank.wrong[1][0], feedback: bank.wrong[1][1] },
      {
        label: SOUND,
        feedback:
          "A confident argument can still have a gap. One step here is assumed instead of shown.",
      },
    ],
    hint: bank.hint,
    explanation: bank.why,
    variant: { flaw },
  });
}

/* ------------------------------------------------------------------ */
/* pythagorean-converse-proof                                           */
/* ------------------------------------------------------------------ */

export const converseAxes = {
  variant: defineAxis("variant", [
    "identify",
    "hinge-read",
    "hinge-why",
    "flaw",
  ] as const),
  direction: defineAxis("direction", ["wider", "narrower"] as const),
  flaw: defineAxis("flaw", ["wrong-side", "adding", "backwards"] as const),
} as const;

/** Legs a and b hinged at the origin, opened to `angle` degrees, with the
 * right-angle position drawn faintly behind. */
function hinge(
  a: number,
  b: number,
  angle: number,
  third: string,
  c: number,
  extra: number[] = [],
): Element[] {
  const t = (angle * Math.PI) / 180;
  const O: V = [0, 0],
    A: V = [a, 0],
    B: V = [b * Math.cos(t), b * Math.sin(t)],
    R: V = [0, b];
  const out: Element[] = [
    {
      type: "segment",
      id: "ghostleg",
      from: O,
      to: R,
      stroke: "muted",
      width: 1.5,
      dash: "dash",
    },
    {
      type: "segment",
      id: "ghostside",
      from: A,
      to: R,
      stroke: "muted",
      width: 1.5,
      dash: "dash",
    },
    sideTag("ghostlabel", `${c}`, A, R, B),
    rightMark("ghostmark", O, A, R, Math.min(a, b) * 0.1),
  ];
  extra.forEach((deg2, k) => {
    const u = (deg2 * Math.PI) / 180;
    const tip: V = [b * Math.cos(u), b * Math.sin(u)];
    for (const [part, from] of [
      ["leg", O],
      ["side", A],
    ] as const)
      out.push({
        type: "segment",
        id: `other${k}${part}`,
        from,
        to: tip,
        stroke: "muted",
        width: 1.5,
        dash: "dot",
      });
  });
  out.push(
    {
      type: "segment",
      id: "third",
      from: A,
      to: B,
      stroke: "accent",
      width: 2.5,
      dash: "dash",
    },
    { type: "segment", id: "legA", from: O, to: A, stroke: "ink", width: 3 },
    { type: "segment", id: "legB", from: O, to: B, stroke: "ink", width: 3 },
    { type: "point", id: "pin", at: O, r: 4 },
    {
      type: "arc",
      id: "open",
      center: O,
      r: Math.min(a, b) * 0.22,
      from: 0,
      to: angle,
      stroke: "gold",
      width: 2,
    },
    tag("la", `${a}`, mid(O, A), [0, -1]),
    tag("lb", `${b}`, mid(O, B), [-Math.sin(t), Math.cos(t)]),
    angle === 90
      ? sideTag("lthird", third, A, B, O)
      : sideTag("lthird", third, A, B, R),
  );
  return out;
}

/** The hinge angle whose third side is d, from the law of cosines. */
const hingeAngle = (a: number, b: number, d: number) =>
  deg(Math.acos((a * a + b * b - d * d) / (2 * a * b)));

function converseProof(seed: string): GeneratedProblem {
  const id = "pythagorean-converse-proof";
  const axes = chooseAxes(id, seed, converseAxes);
  const r = random(id, seed);
  const [a, b, c] = pick(r, TRIPLES);
  const name = pick(r, NAMES);
  if (axes.variant === "identify") {
    return finish(id, seed, r, {
      prompt:
        "The Pythagorean theorem says: if a triangle has a right angle, and $c$ is the side across from it, then $a^2 + b^2 = c^2$. Which statement is its converse, the statement with the if-part and the then-part swapped?",
      figure: figureOf(
        "A right triangle with legs a and b and hypotenuse c across from the right angle.",
        rightTriangle("f", 3, 4, [0, 0], { a: "a", b: "b", c: "c" }),
      ),
      choices: [
        {
          label:
            "If a triangle has sides $a$, $b$, $c$ with $a^2 + b^2 = c^2$, then it has a right angle across from $c$.",
          correct: true,
        },
        {
          label:
            "If a triangle has a right angle across from $c$, then $a^2 + b^2 = c^2$.",
          feedback:
            "That is the theorem itself. The converse starts from $a^2 + b^2 = c^2$ and ends with the right angle.",
        },
        {
          label: "If a triangle has no right angle, then $a^2 + b^2 \\ne c^2$.",
          feedback:
            "This puts “not” into both parts of the theorem but keeps their order. The converse swaps the two parts.",
        },
        {
          label:
            "If $a^2 + b^2 \\ne c^2$, then the triangle has no right angle.",
          feedback:
            "This swaps the parts and also puts “not” into both. The converse only swaps them.",
        },
      ],
      hint: "The theorem ends with $a^2 + b^2 = c^2$. Find its if-part and its then-part; the converse starts with what the theorem ends with.",
      explanation: [
        "The theorem's if-part is “a triangle has a right angle across from $c$”. Its then-part is “$a^2 + b^2 = c^2$”.",
        "The converse swaps them: if $a^2 + b^2 = c^2$, then the triangle has a right angle across from $c$.",
        "Swapping the parts makes a new statement, so the converse needs its own proof.",
      ],
      variant: { variant: axes.variant },
    });
  }
  if (axes.variant === "hinge-read") {
    const wider = axes.direction === "wider";
    const options: number[] = [];
    for (let d = c - 3; d <= c + 3; d++)
      if (d !== c && d > b - a && d < a + b && d > c === wider) options.push(d);
    const d = pick(r, options);
    const angle = hingeAngle(a, b, d);
    return finish(id, seed, r, {
      prompt: `Two rods of lengths ${a} and ${b} are joined at a hinge. When the hinge is a right angle, the third side is exactly ${c}. The third side now measures ${d}. What does that tell you about the angle at the hinge?`,
      figure: figureOf(
        `Rods of lengths ${a} and ${b} joined at a hinge, with a third side of ${d}`,
        hinge(a, b, angle, `${d}`, c),
        `The third side is dashed. Faintly behind is the right-angle position, where the third side is ${c}.`,
      ),
      choices: [
        {
          label: "The angle is greater than $90^\\circ$.",
          ...(d > c
            ? { correct: true as const }
            : {
                feedback: `A wider opening makes the third side longer than ${c}. Here it is ${d}, shorter, so the hinge is narrower.`,
              }),
        },
        {
          label: "The angle is less than $90^\\circ$.",
          ...(d < c
            ? { correct: true as const }
            : {
                feedback: `A narrower opening makes the third side shorter than ${c}. Here it is ${d}, longer, so the hinge is wider.`,
              }),
        },
        {
          label: "The angle is exactly $90^\\circ$.",
          feedback: `Only a right angle gives a third side of exactly ${c}. A third side of ${d} means a different angle.`,
        },
        {
          label: "It cannot be determined.",
          feedback:
            "Two fixed rods and the third side settle the angle: each opening gives exactly one third-side length.",
        },
      ],
      hint: `Compare ${d} with ${c}, the third side at a right angle. Does opening the hinge wider make the third side longer or shorter?`,
      explanation: [
        `At a right angle the third side is exactly ${c}, because $${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c} = ${c}^2$.`,
        "Opening the hinge wider makes the third side longer. Closing it makes the third side shorter.",
        d > c
          ? `${d} is longer than ${c}, so the hinge is open wider than a right angle: the angle is greater than $90^\\circ$.`
          : `${d} is shorter than ${c}, so the hinge is closed tighter than a right angle: the angle is less than $90^\\circ$.`,
        `Check with squares: $${d}^2 = ${d * d}$, which is ${d > c ? "more" : "less"} than $${a}^2 + ${b}^2 = ${c * c}$.`,
      ],
      variant: { variant: axes.variant, direction: axes.direction },
    });
  }
  if (axes.variant === "hinge-why") {
    return finish(id, seed, r, {
      prompt: `Rods of lengths ${a} and ${b} are joined at a hinge. As the hinge opens from nearly closed to nearly flat, the third side grows from nearly ${b - a} to nearly ${a + b}. Why does this show that a triangle with sides ${a}, ${b} and ${c} must have a right angle?`,
      figure: figureOf(
        `Rods of lengths ${a} and ${b} joined at a hinge, open to a right angle`,
        hinge(a, b, 90, `${c}`, c, [55, 125]).filter(
          (e) => e.id !== "ghostlabel" && e.id !== "ghostside",
        ),
        `At the right angle the third side is ${c}. A narrower and a wider opening are drawn faintly.`,
      ),
      choices: [
        {
          label: `The third side gets longer the wider the hinge opens, so only one opening gives exactly ${c}: the right angle.`,
          correct: true,
        },
        {
          label: `Because ${c} is the longest side.`,
          feedback:
            "Every triangle has a longest side, and most have no right angle. Being longest is not enough.",
        },
        {
          label: `Because $${a}^2 + ${b}^2 = ${c}^2$ is the Pythagorean theorem.`,
          feedback:
            "The theorem starts from a right angle. Here the right angle is what must be shown, so the theorem alone cannot give it.",
        },
        {
          label: `Because any triangle with sides ${a} and ${b} is a right triangle.`,
          feedback: `Sides ${a} and ${b} can make many triangles, one for each opening of the hinge. Only one of them has a right angle.`,
        },
      ],
      hint: `At a right angle the third side is ${c}. Ask how many openings of the hinge give a third side of exactly ${c}.`,
      explanation: [
        `At a right angle the third side is $\\sqrt{${a}^2 + ${b}^2} = \\sqrt{${c * c}} = ${c}$.`,
        `Opening the hinge wider always makes the third side longer, from nearly ${b - a} up to nearly ${a + b}. So each length appears at exactly one opening.`,
        `A triangle with sides ${a}, ${b} and ${c} is the hinge at the one opening with third side ${c}. That opening is the right angle, so the triangle has a right angle across from the side ${c}.`,
      ],
      variant: { variant: axes.variant },
    });
  }
  const flaw = axes.flaw;
  const plain = (sides: string) =>
    figureOf(
      `${name}'s triangle, with sides ${sides} and no angles marked.`,
      plainTriangle("f", a, b, c, [0, 0], {
        a: `${a}`,
        b: `${b}`,
        c: `${c}`,
      }),
    );
  if (flaw === "wrong-side") {
    const x = c * c + a * a;
    return finish(id, seed, r, {
      prompt: `${name} tests a triangle with sides ${c}, ${a} and ${b}: “$${c}^2 + ${a}^2 = ${x}$ and $${b}^2 = ${b * b}$. They are not equal, so it is not a right triangle.” What is wrong with this argument?`,
      figure: plain(`${c}, ${a} and ${b}`),
      choices: [
        {
          label: `The longest side must play $c$: $${a}^2 + ${b}^2 = ${c}^2$, so it is a right triangle.`,
          correct: true,
        },
        {
          label: "The arithmetic is wrong.",
          feedback: `The arithmetic is right: $${c * c} + ${a * a} = ${x}$. The wrong side was used as $c$.`,
        },
        {
          label: `A triangle cannot have sides ${c}, ${a} and ${b}.`,
          feedback: `It can: ${a} + ${b} is more than ${c}, so the sides close up into a triangle.`,
        },
        {
          label: "Nothing is wrong. The two numbers are not equal.",
          feedback: `They were the wrong two numbers to compare. The longest side, ${c}, must be squared alone.`,
        },
      ],
      hint: `Find the longest of ${c}, ${a} and ${b}. Which side must be squared on its own?`,
      explanation: [
        `The converse compares the square of the longest side with the sum of the squares of the other two. The longest side is ${c}.`,
        `$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c} = ${c}^2$.`,
        `They are equal, so the triangle has a right angle, across from the side ${c}. ${name} squared ${c} with a shorter side instead.`,
      ],
      variant: { variant: axes.variant, flaw },
    });
  }
  if (flaw === "adding") {
    return finish(id, seed, r, {
      prompt: `${name} tests a triangle with sides ${a}, ${b} and ${c}: “$${a} + ${b} = ${a + b}$, which is not ${c}, so it is not a right triangle.” What is wrong with this argument?`,
      figure: plain(`${a}, ${b} and ${c}`),
      choices: [
        {
          label: `The converse compares squares, not sides: $${a * a} + ${b * b} = ${c * c}$, so it is a right triangle.`,
          correct: true,
        },
        {
          label: `In a right triangle, $${a} + ${b}$ should equal ${c}.`,
          feedback: `In any triangle the two shorter sides add to more than the longest. So $${a} + ${b}$ is never ${c}.`,
        },
        {
          label: `The right angle is across from the side ${b}.`,
          feedback: `The right angle is across from the longest side, ${c}.`,
        },
        {
          label: "Nothing is wrong. The two numbers are not equal.",
          feedback:
            "Adding the sides is the wrong test. The converse compares squares.",
        },
      ],
      hint: `Square each of ${a}, ${b} and ${c} before you compare them.`,
      explanation: [
        "The converse is about squares: compare $a^2 + b^2$ with $c^2$, where $c$ is the longest side.",
        `$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}$, and $${c}^2 = ${c * c}$.`,
        `They are equal, so the triangle has a right angle across from the side ${c}. Adding the sides does not test anything.`,
      ],
      variant: { variant: axes.variant, flaw },
    });
  }
  return finish(id, seed, r, {
    prompt: `${name} wants to show that a triangle with sides ${a}, ${b} and ${c} has a right angle: “The triangle is a right triangle, so $${a}^2 + ${b}^2 = ${c}^2$. So it has a right angle.” What is wrong with this argument?`,
    figure: plain(`${a}, ${b} and ${c}`),
    choices: [
      {
        label:
          "It assumes the right angle at the start. The equation is what is known; the right angle is what must be shown.",
        correct: true,
      },
      {
        label: `$${a}^2 + ${b}^2 \\ne ${c}^2$.`,
        feedback: `The equation is true: $${a * a} + ${b * b} = ${c * c}$. The trouble is the order of the reasoning.`,
      },
      {
        label: `The right angle is across from the side ${b}.`,
        feedback: `The right angle is across from the longest side, ${c}.`,
      },
      {
        label: "Nothing is wrong. The triangle does have a right angle.",
        feedback:
          "The conclusion is true, but the argument assumes it at the start. That proves nothing.",
      },
    ],
    hint: `List what ${name} knows at the start: the sides ${a}, ${b} and ${c}. Is the right angle known yet, or is it the goal?`,
    explanation: [
      `What is known is the side lengths, and $${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c} = ${c}^2$.`,
      "What must be shown is the right angle. Starting with “the triangle is a right triangle” assumes the goal.",
      `The converse goes the other way: the equation gives the right angle, across from the side ${c}.`,
    ],
    variant: { variant: axes.variant, flaw },
  });
}

/* ------------------------------------------------------------------ */
/* pythagorean-converse-blanks                                          */
/* ------------------------------------------------------------------ */

export const converseBlanksAxes = {
  form: defineAxis("form", ["numbers", "letters"] as const),
} as const;

function converseBlanks(seed: string): GeneratedProblem {
  const id = "pythagorean-converse-blanks";
  const axes = chooseAxes(id, seed, converseBlanksAxes);
  const r = random(id, seed);
  const numbers = axes.form === "numbers";
  const [ta, tb, tc] = numbers ? pick(r, TRIPLES) : ([3, 4, 5] as const);
  const A = numbers ? `${ta}` : "$a$",
    B = numbers ? `${tb}` : "$b$",
    C = numbers ? `${tc}` : "$c$";
  const m = (tex: string) => `$${tex}$`;
  const sa = numbers ? `${ta}` : "a",
    sb = numbers ? `${tb}` : "b",
    sc = numbers ? `${tc}` : "c";
  const blanks = [
    {
      id: "hyp",
      label: "the hypotenuse of the new triangle",
      correct: m(`\\sqrt{${sa}^2 + ${sb}^2}`),
      wrong: [m(`${sa} + ${sb}`), m(`${sa}^2 + ${sb}^2`)],
    },
    {
      id: "equals",
      label: "the length it equals",
      correct: numbers ? `${tc}` : m("c"),
      wrong: numbers ? [`${tc * tc}`, `${ta + tb}`] : [m("c^2"), m("a + b")],
    },
    {
      id: "same",
      label: "what the two triangles are",
      correct: "congruent, the same size and shape",
      wrong: [
        "both right triangles",
        "equal in area only",
        "the same shape, but not the same size",
      ],
    },
    {
      id: "where",
      label: "where the right angle is",
      correct: `across from the side ${C}`,
      wrong: [
        `across from the side ${A}`,
        `between the sides ${A} and ${C}`,
        `between the sides ${B} and ${C}`,
      ],
    },
  ];
  const sentence: MultiPartSentence = [
    {
      text: `A triangle has sides ${A}, ${B} and ${C}, and $${sa}^2 + ${sb}^2 = ${sc}^2$. Build a right triangle with legs ${A} and ${B}. By the Pythagorean theorem, its hypotenuse is `,
    },
    { blank: "hyp" },
    { text: ", which equals " },
    { blank: "equals" },
    {
      text: ". The two triangles have the same three side lengths, so they are ",
    },
    { blank: "same" },
    { text: ". So the first triangle has a right angle " },
    { blank: "where" },
    { text: "." },
  ];
  const key: Record<string, string> = {};
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an answer for each blank",
    layout: "inline",
    sentence,
    blanks: blanks.map((blank) => {
      const options = shuffle(r, [blank.correct, ...blank.wrong]).map(
        (label, k) => ({ id: optionIds[k]!, label }),
      );
      key[blank.id] = options.find((o) => o.label === blank.correct)!.id;
      return { id: blank.id, label: blank.label, options };
    }),
  };
  const elements = [
    ...plainTriangle("f", ta, tb, tc, [0, 0], { a: sa, b: sb, c: sc }),
    ...rightTriangle("g", ta, tb, [tc + 0.4 * tc, 0], {
      a: sa,
      b: sb,
      c: "?",
    }),
  ];
  return finish(id, seed, r, {
    prompt: numbers
      ? `Complete the proof that a triangle with sides ${ta}, ${tb} and ${tc} has a right angle.`
      : "Complete the proof that a triangle with sides $a$, $b$ and $c$, where $a^2 + b^2 = c^2$, has a right angle.",
    parts: { response, key },
    figure: figureOf(
      "A triangle with no angles marked, and a right triangle built beside it",
      elements,
      numbers
        ? `The first triangle has sides ${ta}, ${tb} and ${tc}. The right triangle has legs ${ta} and ${tb} and an unknown hypotenuse.`
        : "The first triangle has sides a, b and c. The right triangle has legs a and b and an unknown hypotenuse.",
    ),
    hint: numbers
      ? `The new right triangle has legs ${ta} and ${tb}. Find its hypotenuse with the Pythagorean theorem: square the legs, add, and take the square root.`
      : "The new right triangle has legs $a$ and $b$. By the Pythagorean theorem, its hypotenuse squared is $a^2 + b^2$. Compare that with what you are told about $c$.",
    explanation: numbers
      ? [
          `The new triangle has legs ${ta} and ${tb} and a right angle. By the Pythagorean theorem, its hypotenuse is $\\sqrt{${ta}^2 + ${tb}^2} = \\sqrt{${ta * ta} + ${tb * tb}} = \\sqrt{${tc * tc}} = ${tc}$.`,
          `So its sides are ${ta}, ${tb} and ${tc}, the same three lengths as the first triangle.`,
          "Triangles with the same three side lengths are congruent: the same size and shape, so their angles match too.",
          `The new triangle's right angle is across from its hypotenuse, ${tc}. So the first triangle has a right angle across from the side ${tc}.`,
        ]
      : [
          "The new triangle has legs $a$ and $b$ and a right angle. By the Pythagorean theorem, its hypotenuse is $\\sqrt{a^2 + b^2}$.",
          "We are told $a^2 + b^2 = c^2$, so the hypotenuse is $\\sqrt{c^2} = c$.",
          "The two triangles have sides $a$, $b$ and $c$, so they are congruent: the same size and shape, with matching angles.",
          "The new triangle's right angle is across from its hypotenuse $c$. So the first triangle has a right angle across from the side $c$.",
        ],
    variant: { form: axes.form },
  });
}

/* ------------------------------------------------------------------ */

const generators: Record<string, (seed: string) => GeneratedProblem> = {
  "pythagorean-proof-area": proofArea,
  "pythagorean-proof-figure": proofFigure,
  "pythagorean-proof-steps": proofSteps,
  "pythagorean-proof-flaw": proofFlaw,
  "pythagorean-converse-proof": converseProof,
  "pythagorean-converse-blanks": converseBlanks,
};

export function generatePythagoreanProofs(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown Pythagorean proof template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  return generate(seed);
}
