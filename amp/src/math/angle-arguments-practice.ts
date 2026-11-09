import { createHash } from "node:crypto";
import { article } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  serializeMultiPart,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import { serializeSelection } from "./selection-response";
import { scene } from "./scene/author";
import type { Element, Point } from "./scene/spec";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes";

/**
 * Informal arguments about angles (8.G.A.5): why a triangle's angles fill a
 * straight angle, why an exterior angle equals the two remote interior
 * angles, why parallel lines cut by a transversal make equal angles, and why
 * two equal angles make triangles similar. The learner supplies the reason
 * for each step, finds the first wrong step, or chooses the argument that is
 * correct and complete. Every figure is drawn true to its measures; the
 * reasons are graded from the figure's geometry (the oracle recomputes them).
 */

const choice = { requiredResponseCapability: "single-choice-v1" as const };
const parts = { requiredResponseCapability: "multi-part-choice-v1" as const };
const select = { requiredResponseCapability: "multi-select-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const common = {
  version: 1,
  skillId: "triangle-angle-theorems",
  gradeBand: "6–8" as const,
  ...scenes,
};
const angleSenses = {
  glossarySenses: { degree: "degree-angle", degrees: "degree-angle" },
};

export const angleArgumentTemplates: readonly TemplateMetadata[] = [
  {
    id: "triangle-angle-argument",
    title: "Find the flaw in a triangle angle argument",
    description:
      "Find the first wrong step in an argument that a triangle's angles add to 180° or that an exterior angle equals the two remote interior angles, or explain why three copies of a triangle line up along a straight edge.",
    ...common,
    ...choice,
    ...angleSenses,
  },
  {
    id: "triangle-angle-reasons",
    title: "Reasons in the triangle angle arguments",
    description:
      "Choose the reason for each step of the argument that a triangle's angles add to 180°, using a line through one corner parallel to the opposite side, or that an exterior angle equals the two remote interior angles.",
    ...common,
    ...parts,
    ...angleSenses,
  },
  {
    id: "parallel-angle-argument",
    title: "Why parallel lines make equal angles",
    description:
      "Choose the argument or the motion that shows two angles made by parallel lines and a transversal are equal, find the first wrong step in such an argument, or say why the argument fails when the lines are not parallel.",
    ...common,
    ...choice,
    ...angleSenses,
  },
  {
    id: "parallel-angle-reasons",
    title: "Reasons for angles at parallel lines",
    description:
      "Choose the reason for each step of the argument that alternate interior angles are equal or that same-side interior angles add to 180°.",
    ...common,
    ...parts,
    ...angleSenses,
  },
  {
    id: "aa-similarity-argument",
    title: "Two angles are enough for similar triangles",
    description:
      "From two given angles of each triangle, decide whether two triangles are similar and choose the complete argument, or find the first wrong step in a student's argument.",
    ...common,
    ...choice,
    glossarySenses: {
      degree: "degree-angle",
      degrees: "degree-angle",
      similar: "similar-figures",
    },
  },
  {
    id: "aa-similarity-select",
    title: "Which triangles must be similar",
    description:
      "From two angles of a triangle, select every triangle, each given by two angles, that must be similar to it.",
    ...common,
    ...select,
    glossarySenses: {
      degree: "degree-angle",
      degrees: "degree-angle",
      similar: "similar-figures",
    },
  },
];
const metaOf = (id: string) => angleArgumentTemplates.find((t) => t.id === id)!;

export const angleArgumentAxes = {
  "triangle-angle-argument": {
    argument: defineAxis(
      "argument",
      ["sum-flaw", "copies-angle", "copies-line", "exterior-flaw"] as const,
      { weights: [3, 2, 2, 3] },
    ),
  },
  "triangle-angle-reasons": {
    argument: defineAxis("argument", ["sum", "exterior"] as const),
  },
  "parallel-angle-argument": {
    argument: defineAxis(
      "argument",
      ["translation", "half-turn", "flaw", "hypothesis"] as const,
      { weights: [2, 2, 3, 2] },
    ),
  },
  "parallel-angle-reasons": {
    argument: defineAxis("argument", [
      "alternate-interior",
      "same-side-interior",
    ] as const),
  },
  "aa-similarity-argument": {
    argument: defineAxis("argument", ["decide", "flaw"] as const),
  },
  "aa-similarity-select": {
    correct: defineAxis("correct", ["two", "three"] as const),
  },
} as const;

/* ------------------------------------------------------------ geometry */

type V = Point;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const len = (a: V) => Math.hypot(a[0], a[1]);
const unit = (a: V): V => mul(a, 1 / (len(a) || 1));
const rad = (d: number) => (d * Math.PI) / 180;
const dirV = (deg: number): V => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const norm = (d: number) => ((d % 360) + 360) % 360;
const dirOf = (v: V) => norm((Math.atan2(v[1], v[0]) * 180) / Math.PI);
const round = (p: V): V => [
  Math.round(p[0] * 1e6) / 1e6,
  Math.round(p[1] * 1e6) / 1e6,
];
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const deg = (n: number) => `${n}°`;
const texDeg = (n: number) => `${n}^\\circ`;

/** The angle at v between the rays toward p and q, as a counterclockwise
 * sweep of less than 180°. */
function sector(v: V, p: V, q: V): { from: number; to: number } {
  const a = dirOf(sub(p, v)),
    b = dirOf(sub(q, v));
  const ab = norm(b - a);
  return ab <= 180 ? { from: a, to: a + ab } : { from: b, to: b + norm(a - b) };
}

type Paint = "ink" | "accent" | "warm" | "gold";
/** Arcs and an optional label for one angle. Arc ids are `a-<key>-<k>`, the
 * label id `n-<key>`: the oracle reads the vertex and the sweep from them. */
function angleMark(
  key: string,
  v: V,
  sweep: { from: number; to: number },
  o: { arcs?: number; paint?: Paint; label?: string; r?: number } = {},
): Element[] {
  const r0 = o.r ?? 0.62;
  const out: Element[] = Array.from(
    { length: o.arcs ?? 1 },
    (_, k): Element => ({
      type: "arc",
      id: `a-${key}-${k}`,
      center: round(v),
      r: r0 + 0.13 * k,
      from: Math.round(sweep.from * 1e6) / 1e6,
      to: Math.round(sweep.to * 1e6) / 1e6,
      stroke: o.paint ?? "ink",
      width: 2,
    }),
  );
  if (o.label !== undefined) {
    const bis = (sweep.from + sweep.to) / 2;
    const u = dirV(bis);
    const reach = r0 + 0.13 * ((o.arcs ?? 1) - 1) + 0.3;
    out.push({
      type: "text",
      id: `n-${key}`,
      at: round(add(v, mul(u, reach))),
      text: o.label,
      font: "math",
      size: "sm",
      bold: true,
      color: o.paint ?? "ink",
      halo: true,
      align: [0, 0],
      // Out along the bisector, in pixels, to the first spot clear of the
      // sides and of other labels: a narrow angle pushes its label farther.
      place: [6, 12, 18, 24, 32, 40, 50, 62, 76].map(
        (d) =>
          [Math.round(u[0] * d), Math.round(-u[1] * d), 0, 0] as [
            number,
            number,
            0,
            0,
          ],
      ),
    });
  }
  return out;
}
/** A point's name, set off away from `inside`. Its id is `p-<name>` and its
 * anchor is the point itself. */
function pointName(name: string, p: V, inside: V): Element {
  const u = unit(sub(p, inside));
  return {
    type: "text",
    id: `p-${name.replace("′", "p")}`,
    at: round(p),
    text: name,
    font: "math",
    bold: true,
    align: [
      u[0] > 0.3 ? -1 : u[0] < -0.3 ? 1 : 0,
      u[1] > 0.3 ? 1 : u[1] < -0.3 ? -1 : 0,
    ],
    offset: [Math.round(u[0] * 8), Math.round(-u[1] * 8)],
  };
}
const segment = (
  id: string,
  from: V,
  to: V,
  o: { muted?: boolean; width?: number; dash?: boolean } = {},
): Element => ({
  type: "segment",
  id,
  from: round(from),
  to: round(to),
  stroke: o.muted ? "muted" : "ink",
  width: o.width ?? (o.muted ? 1.75 : 2.25),
  ...(o.dash ? { dash: "dash" as const } : {}),
});
/** Chevrons on a line: the mark for "these lines are parallel". */
function parallelMark(id: string, a: V, b: V, t = 0.5): Element {
  const u = unit(sub(b, a)),
    n: V = [-u[1], u[0]],
    tip = add(a, mul(sub(b, a), t));
  return {
    type: "polyline",
    id,
    points: [
      round(add(sub(tip, mul(u, 0.26)), mul(n, 0.2))),
      round(tip),
      round(sub(sub(tip, mul(u, 0.26)), mul(n, 0.2))),
    ],
    stroke: "ink",
    width: 1.75,
  };
}
const lineName = (id: string, text: string, p: V, out: V): Element => ({
  ...pointName(text, p, sub(p, out)),
  id,
});
const build = (title: string, elements: Element[]): SemanticFigure => ({
  kind: "scene",
  scene: scene(...elements).build({ title }),
});

/* --------------------------------------------------------- angle values */

type Tri = { A: number; B: number; C: number };
/** Whole-degree angles in [25°, 110°] summing to 180°, pairwise at least
 * `gap` apart; a right angle in at most about one seed in five. */
function triangleAngles(r: Random, gap: number): Tri {
  for (;;) {
    const B = r(25, 110),
      C = r(25, 110),
      A = 180 - B - C;
    if (A < 25 || A > 110) continue;
    const all = [A, B, C];
    if (Math.abs(A - B) < gap || Math.abs(B - C) < gap || Math.abs(A - C) < gap)
      continue;
    if (all.includes(90) && r(1, 5) !== 1) continue;
    return { A, B, C };
  }
}
/** Triangle with base BC on the x-axis (B at the origin), apex A above; a
 * mirror puts B on the right. */
function trianglePoints(t: Tri, mirror: boolean, base = 8) {
  const s = mirror ? -1 : 1;
  const ab = (base * Math.sin(rad(t.C))) / Math.sin(rad(t.A));
  const B: V = [0, 0],
    C: V = [s * base, 0],
    A: V = [s * ab * Math.cos(rad(t.B)), ab * Math.sin(rad(t.B))];
  return { A, B, C, s };
}

/* -------------------------------------------------------- reason bank */

type Reason =
  | { kind: "AI" | "CO" | "LINE" | "LP"; line: string }
  | {
      kind:
        | "VERT"
        | "SSI"
        | "TRI"
        | "LOOK"
        | "MEAS"
        | "AROUND"
        | "SPLIT"
        | "LPACB"
        | "ALLEQ";
    };
/** Short reason texts: each completes "… because". */
export function reasonText(x: Reason): string {
  switch (x.kind) {
    case "AI":
      return `they are alternate interior angles along transversal $${x.line}$`;
    case "CO":
      return `they are corresponding angles along transversal $${x.line}$`;
    case "LINE":
      return `together they fill a straight angle along line $${x.line}$`;
    case "LP":
      return `they form a linear pair, a straight angle along line $${x.line}$`;
    case "VERT":
      return "they are vertical angles, opposite each other at a crossing";
    case "SSI":
      return "same-side interior angles between parallel lines add to 180°";
    case "TRI":
      return "the three angles of any triangle add to 180°";
    case "LOOK":
      return "they look the same size in the figure";
    case "MEAS":
      return "a protractor gives them the same measure";
    case "AROUND":
      return "the angles all the way around a point add to 360°";
    case "SPLIT":
      return "ray $CE$ splits $\\angle ACD$ into exactly these two angles";
    case "LPACB":
      return "$\\angle ACD$ and $\\angle ACB$ form a linear pair along $BD$";
    case "ALLEQ":
      return "all eight angles are equal because $p \\parallel q$";
  }
}
/** Why a reason fails, in one plain sentence, for feedback and explanations. */
function whyNot(x: Reason): string {
  switch (x.kind) {
    case "AI":
      return `Alternate interior angles along $${x.line}$ are a different pair: they sit between the parallel lines on opposite sides of $${x.line}$.`;
    case "CO":
      return `Corresponding angles along $${x.line}$ sit in matching positions at the two crossings of $${x.line}$; these angles do not.`;
    case "VERT":
      return "Vertical angles share a corner and sit across from each other where two lines cross; these angles do not.";
    case "SSI":
      return "Same-side interior angles add to 180°; they are not a reason for this step.";
    case "TRI":
      return "The 180° sum of a triangle is not a reason here: it is what the argument sets out to prove, or it is about other angles.";
    case "LOOK":
      return "Looking the same in a drawing proves nothing: drawings can mislead.";
    case "MEAS":
      return "Measuring one figure shows only that figure, not every triangle or every pair of lines.";
    case "AROUND":
      return "Angles around a point add to 360°, but these angles do not go all the way around a point.";
    case "LINE":
      return `These angles do not fill a straight angle along line $${x.line}$.`;
    case "LP":
      return `These angles are not a linear pair along line $${x.line}$.`;
    case "SPLIT":
      return "That ray splits a different angle.";
    case "LPACB":
      return "That linear pair is true, but it is about $\\angle ACB$, not about the two parts of $\\angle ACD$.";
    case "ALLEQ":
      return "Parallel lines make two sizes of angle, not one: neighbors along a line add to 180°.";
  }
}
function optionsFor(
  r: Random,
  correct: Reason,
  must: Reason[],
  pool: Reason[],
): Reason[] {
  const need = 3 - must.length;
  const extra = shuffle(r, [...pool]).slice(0, need);
  return shuffle(r, [correct, ...must, ...extra]);
}

/* ------------------------------------------------------------- finish */

type Built = {
  prompt: string;
  figure: SemanticFigure;
  hint: string;
  explanation: string[];
  variant: string;
};
function problemId(id: string, seed: string) {
  return createHash("sha256")
    .update(JSON.stringify([id, 1, seed]))
    .digest("hex");
}
type Choice = { label: string; correct?: boolean; feedback?: string };
function finishChoice(
  id: string,
  seed: string,
  r: Random,
  built: Built & { choices: Choice[]; keepOrder?: boolean; label?: string },
): GeneratedProblem {
  const choices = built.choices;
  if (
    choices.filter((c) => c.correct).length !== 1 ||
    new Set(choices.map((c) => c.label)).size !== choices.length ||
    choices.some((c) => c.label.length > 120)
  )
    throw new Error(`${id}: invalid choices`);
  if (!built.keepOrder) shuffle(r, choices);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((c, i) => {
    const optionId = `option-${"abcd"[i]}`;
    if (c.correct) answer = optionId;
    else choiceFeedback[optionId] = c.feedback!;
    return { id: optionId, label: c.label };
  });
  return {
    public: {
      id: problemId(id, seed),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: metaOf(id).skillId,
      response: {
        kind: "choice",
        label: built.label ?? "Choose one answer",
        options,
      },
      figure: built.figure,
    },
    answer,
    explanation: built.explanation,
    hint: built.hint,
    choiceFeedback,
    variant: { id: built.variant },
  };
}
type Part = { id: string; label: string; options: string[]; correct: string };
function finishParts(
  id: string,
  seed: string,
  built: Built & { parts: Part[]; label: string },
): GeneratedProblem {
  const key: Record<string, string> = {};
  const blanks: MultiPartBlank[] = built.parts.map((p) => {
    if (
      new Set(p.options).size !== p.options.length ||
      p.options.filter((o) => o === p.correct).length !== 1 ||
      p.options.some((o) => o.length > 80) ||
      p.label.length > 120
    )
      throw new Error(`${id}: invalid part ${p.id}`);
    const options = p.options.map((label, i) => ({
      id: "abcdef"[i]!,
      label,
    }));
    key[p.id] = options.find((o) => o.label === p.correct)!.id;
    return { id: p.id, label: p.label, options };
  });
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: built.label,
    layout: "slots",
    blanks,
  };
  return {
    public: {
      id: problemId(id, seed),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: metaOf(id).skillId,
      response,
      figure: built.figure,
    },
    answer: serializeMultiPart(response, key),
    explanation: built.explanation,
    hint: built.hint,
    variant: { id: built.variant },
  };
}

/* ====================================================== triangle figures */

type Mode = "colors" | "neutral";
/** Triangle ABC with line DE through A (parallel to BC), angles 1, 2, 3 at A. */
function sumFigure(t: Tri, mirror: boolean, mode: Mode, marked: boolean) {
  const { A, B, C, s } = trianglePoints(t, mirror);
  const xs = [A[0], B[0], C[0]];
  const left = Math.min(...xs) - 1.4,
    right = Math.max(...xs) + 1.4;
  const D: V = [s > 0 ? left : right, A[1]],
    E: V = [s > 0 ? right : left, A[1]];
  const centroid: V = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  const colors = mode === "colors";
  const elements: Element[] = [
    segment("s-AB", A, B),
    segment("s-BC", B, C),
    segment("s-CA", C, A),
    segment("l-DE", D, E, { muted: true }),
    ...(marked
      ? [parallelMark("pm-DE", D, E, 0.85), parallelMark("pm-BC", B, C, 0.5)]
      : []),
    ...angleMark("1", A, sector(A, D, B), {
      label: "1",
      paint: colors ? "warm" : "ink",
    }),
    ...angleMark("2", A, sector(A, B, C), {
      label: "2",
      paint: colors ? "gold" : "ink",
      arcs: colors ? 3 : 1,
      r: 0.5,
    }),
    ...angleMark("3", A, sector(A, C, E), {
      label: "3",
      paint: colors ? "accent" : "ink",
      arcs: colors ? 2 : 1,
    }),
    ...angleMark("B", B, sector(B, A, C), { paint: colors ? "warm" : "ink" }),
    ...angleMark("C", C, sector(C, A, B), {
      paint: colors ? "accent" : "ink",
      arcs: colors ? 2 : 1,
    }),
    pointName("A", A, [A[0], A[1] - 1]),
    pointName("B", B, centroid),
    pointName("C", C, centroid),
    pointName("D", D, add(D, [s, 0])),
    pointName("E", E, add(E, [-s, 0])),
  ];
  return build(
    marked
      ? "Triangle ABC with line DE through A parallel to BC; angles 1, 2 and 3 at A"
      : "Triangle ABC with a line DE through A; angles 1, 2 and 3 at A",
    elements,
  );
}
/** Triangle ABC, BC extended to D, ray CE parallel to AB; angles 4 and 5 at C. */
function exteriorFigure(t: Tri, mirror: boolean, mode: Mode) {
  const { A, B, C, s } = trianglePoints(t, mirror);
  const D: V = [C[0] + s * 3.2, 0];
  const E: V = add(C, mul(dirV(mirror ? 180 - t.B : t.B), 3.4));
  const centroid: V = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  const colors = mode === "colors";
  const elements: Element[] = [
    segment("s-AB", A, B),
    segment("s-BC", B, C),
    segment("s-CA", C, A),
    segment("l-CD", C, D, { muted: true }),
    segment("l-CE", C, E, { muted: true }),
    parallelMark("pm-AB", B, A, 0.55),
    parallelMark("pm-CE", C, E, 0.55),
    ...angleMark("A", A, sector(A, B, C), {
      paint: colors ? "accent" : "ink",
      arcs: colors ? 2 : 1,
    }),
    ...angleMark("B", B, sector(B, A, C), { paint: colors ? "warm" : "ink" }),
    ...angleMark("4", C, sector(C, A, E), {
      label: "4",
      paint: colors ? "accent" : "ink",
      arcs: colors ? 2 : 1,
    }),
    ...angleMark("5", C, sector(C, E, D), {
      label: "5",
      paint: colors ? "warm" : "ink",
      r: 0.8,
    }),
    pointName("A", A, centroid),
    pointName("B", B, centroid),
    pointName("C", C, [C[0], C[1] + 1]),
    pointName("D", D, sub(D, [s, 0])),
    pointName("E", E, C),
  ];
  return build(
    "Triangle ABC with side BC extended to D and ray CE parallel to AB; angles 4 and 5 at C",
    elements,
  );
}
/** Three copies: ABC, its half-turn about the midpoint of AB (A, B, C′) and
 * about the midpoint of AC (A, C, B′). C′, A and B′ lie on one line. */
function copiesFigure(t: Tri, mirror: boolean) {
  const { A, B, C } = trianglePoints(t, mirror, 7);
  const Cp = sub(add(A, B), C),
    Bp = sub(add(A, C), B);
  const centroid: V = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  const elements: Element[] = [
    {
      type: "polygon",
      id: "copy-2",
      points: [round(A), round(B), round(Cp)],
      fill: "warm-fill",
      stroke: "muted",
      width: 1.75,
    },
    {
      type: "polygon",
      id: "copy-3",
      points: [round(A), round(C), round(Bp)],
      fill: "gold-fill",
      stroke: "muted",
      width: 1.75,
    },
    {
      type: "polygon",
      id: "copy-1",
      points: [round(A), round(B), round(C)],
      fill: "accent-fill",
      stroke: "ink",
      width: 2.5,
    },
    ...angleMark("1", A, sector(A, Cp, B), { label: "1", paint: "warm" }),
    ...angleMark("2", A, sector(A, B, C), {
      label: "2",
      paint: "gold",
      arcs: 3,
      r: 0.5,
    }),
    ...angleMark("3", A, sector(A, C, Bp), {
      label: "3",
      paint: "accent",
      arcs: 2,
    }),
    ...angleMark("B", B, sector(B, A, C), { paint: "warm" }),
    ...angleMark("C", C, sector(C, A, B), { paint: "accent", arcs: 2 }),
    pointName("A", A, [A[0], A[1] - 1]),
    pointName("B", B, centroid),
    pointName("C", C, centroid),
    pointName("C′", Cp, A),
    pointName("B′", Bp, A),
  ];
  return build(
    "Triangle ABC and two copies turned halfway around the midpoints of AB and AC; angles 1, 2 and 3 meet at A",
    elements,
  );
}

/* ================================================ triangle angle reasons */

const SUM_PROMPT_LEAD =
  "Line $DE$ is drawn through $A$ parallel to $BC$, so angle 2 is $\\angle A$ itself.";

function sumReasons(r: Random, seed: string, t: Tri, mirror: boolean) {
  const AI_AB: Reason = { kind: "AI", line: "AB" },
    AI_AC: Reason = { kind: "AI", line: "AC" },
    CO_AB: Reason = { kind: "CO", line: "AB" },
    CO_AC: Reason = { kind: "CO", line: "AC" },
    LINE_DE: Reason = { kind: "LINE", line: "DE" };
  const s1 = optionsFor(
    r,
    AI_AB,
    [AI_AC, CO_AB],
    [{ kind: "VERT" }, { kind: "LOOK" }],
  );
  const s2 = optionsFor(
    r,
    AI_AC,
    [AI_AB, CO_AC],
    [{ kind: "VERT" }, { kind: "MEAS" }],
  );
  const s3 = optionsFor(
    r,
    LINE_DE,
    [{ kind: "TRI" }, { kind: "SSI" }, { kind: "AROUND" }],
    [],
  );
  const side = mirror ? "right" : "left";
  return finishParts("triangle-angle-reasons", seed, {
    prompt: `${SUM_PROMPT_LEAD} Choose the reason for each step of the argument that $\\angle A + \\angle B + \\angle C = 180^\\circ$. After step 3, replacing $\\angle 1$ with $\\angle B$ and $\\angle 3$ with $\\angle C$ gives the sum.`,
    label: "Choose the reason for each step",
    figure: sumFigure(t, mirror, "colors", true),
    parts: [
      {
        id: "s1",
        label: "Step 1: $\\angle 1 = \\angle B$ because",
        options: s1.map(reasonText),
        correct: reasonText(AI_AB),
      },
      {
        id: "s2",
        label: "Step 2: $\\angle 3 = \\angle C$ because",
        options: s2.map(reasonText),
        correct: reasonText(AI_AC),
      },
      {
        id: "s3",
        label:
          "Step 3: $\\angle 1 + \\angle 2 + \\angle 3 = 180^\\circ$ because",
        options: s3.map(reasonText),
        correct: reasonText(LINE_DE),
      },
    ],
    hint: `$DE$ is parallel to $BC$, so sides $AB$ and $AC$ each cross both lines. Angle 1 is on the ${side} of $A$: follow side $AB$ from it down to $\\angle B$ and name that pair.`,
    explanation: [
      "Line $DE$ is parallel to $BC$. Sides $AB$ and $AC$ each cross both lines, so each is a transversal, a line that crosses two other lines.",
      "Step 1: $\\angle 1$ and $\\angle B$ lie between the parallel lines, on opposite sides of transversal $AB$. They are alternate interior angles, so they are equal.",
      "Step 2: $\\angle 3$ and $\\angle C$ are alternate interior angles along transversal $AC$, so they are equal too.",
      "Step 3: angles 1, 2 and 3 sit side by side at $A$ and fill the straight angle along line $DE$. A straight angle is 180°, so they add to 180°.",
      "Replace $\\angle 1$ with $\\angle B$, $\\angle 2$ with $\\angle A$, and $\\angle 3$ with $\\angle C$: $\\angle B + \\angle A + \\angle C = 180^\\circ$.",
      'The reason "the angles of a triangle add to 180°" cannot be used in step 3: it is the fact the argument sets out to prove.',
    ],
    variant: "sum",
  });
}

function exteriorReasons(r: Random, seed: string, t: Tri, mirror: boolean) {
  const AI_AC: Reason = { kind: "AI", line: "AC" },
    CO_AC: Reason = { kind: "CO", line: "AC" },
    AI_BD: Reason = { kind: "AI", line: "BD" },
    CO_BD: Reason = { kind: "CO", line: "BD" };
  const s1 = optionsFor(r, AI_AC, [CO_AC, AI_BD, { kind: "VERT" }], []);
  const s2 = optionsFor(r, CO_BD, [AI_BD, CO_AC, { kind: "LOOK" }], []);
  const s3 = optionsFor(
    r,
    { kind: "SPLIT" },
    [{ kind: "TRI" }, { kind: "LPACB" }, { kind: "AROUND" }],
    [],
  );
  return finishParts("triangle-angle-reasons", seed, {
    prompt:
      "Side $BC$ is extended past $C$ to $D$, and ray $CE$ is drawn through $C$ parallel to $AB$. Choose the reason for each step of the argument that the exterior angle $\\angle ACD$ equals $\\angle A + \\angle B$.",
    label: "Choose the reason for each step",
    figure: exteriorFigure(t, mirror, "colors"),
    parts: [
      {
        id: "s1",
        label: "Step 1: $\\angle 4 = \\angle A$ because",
        options: s1.map(reasonText),
        correct: reasonText(AI_AC),
      },
      {
        id: "s2",
        label: "Step 2: $\\angle 5 = \\angle B$ because",
        options: s2.map(reasonText),
        correct: reasonText(CO_BD),
      },
      {
        id: "s3",
        label: "Step 3: $\\angle ACD = \\angle 4 + \\angle 5$ because",
        options: s3.map(reasonText),
        correct: reasonText({ kind: "SPLIT" }),
      },
    ],
    hint: `Ray $CE$ is parallel to $AB$. Side $AC$ crosses both, and so does line $BD$. Ask which of those two lines joins $\\angle 4$ to $\\angle A$, and whether the two angles sit on the same side of it.`,
    explanation: [
      "Ray $CE$ is parallel to side $AB$. Side $AC$ and line $BD$ each cross both, so each is a transversal, a line that crosses two other lines.",
      "Step 1: $\\angle 4$ and $\\angle A$ lie between $AB$ and $CE$, on opposite sides of transversal $AC$. They are alternate interior angles, so they are equal.",
      "Step 2: $\\angle 5$ and $\\angle B$ sit in matching positions where line $BD$ crosses $AB$ and $CE$. They are corresponding angles, so they are equal.",
      "Step 3: ray $CE$ lies inside $\\angle ACD$ and splits it into $\\angle 4$ and $\\angle 5$, so $\\angle ACD = \\angle 4 + \\angle 5$.",
      "Replace the parts: $\\angle ACD = \\angle A + \\angle B$. The exterior angle equals the sum of the two angles of the triangle that are not next to it.",
      "Check: $\\angle ACD$ and $\\angle C$ fill a straight angle along $BD$, and so do $\\angle A + \\angle B$ and $\\angle C$, because the triangle's angles add to 180°.",
    ],
    variant: "exterior",
  });
}

function triangleAngleReasons(seed: string, salt: string): GeneratedProblem {
  const id = "triangle-angle-reasons";
  const r = random(id, salt);
  const axes = chooseAxes(id, seed, angleArgumentAxes[id]);
  const t = triangleAngles(r, 8);
  const mirror = r(0, 1) === 1;
  const p =
    axes.argument === "sum"
      ? sumReasons(r, seed, t, mirror)
      : exteriorReasons(r, seed, t, mirror);
  return { ...p, variant: { id: p.variant!.id, axes: axisRecord(axes) } };
}

/* ============================================ triangle angle argument */

const STEP_LABELS = ["Step 1", "Step 2", "Step 3", "No step is wrong"] as const;
type Flawed = {
  steps: [string, string, string];
  /** 0 when every step is correct, else the first wrong step. */
  flaw: 0 | 1 | 2 | 3;
  /** Why each step is right or wrong, in order. */
  notes: [string, string, string];
};
function flawChoices(f: Flawed): Choice[] {
  return STEP_LABELS.map((label, i) => {
    const step = i + 1;
    const correct = f.flaw === 0 ? i === 3 : step === f.flaw;
    return {
      label,
      ...(correct ? { correct: true } : {}),
      feedback:
        i === 3
          ? `One step is wrong. ${f.notes[f.flaw - 1]}`
          : step < f.flaw || f.flaw === 0
            ? `Step ${step} is correct. ${f.notes[i]}`
            : `Step ${step} comes after the first wrong step. Look earlier: ${f.notes[f.flaw - 1]}`,
    };
  });
}
const stepsText = (steps: readonly string[]) =>
  steps.map((s, i) => `Step ${i + 1}: ${s}`).join(" ");
/** Pick a flaw position 1–3 uniformly (or none one time in five), then a
 * template at that position. */
function flawAt<T extends string>(
  r: Random,
  byPosition: Record<1 | 2 | 3, readonly T[]>,
): { position: 0 | 1 | 2 | 3; flaw: T | "none" } {
  if (r(1, 5) === 1) return { position: 0, flaw: "none" };
  const positions = ([1, 2, 3] as const).filter((p) => byPosition[p].length);
  const position = pick(r, positions);
  return { position, flaw: pick(r, byPosition[position]) };
}

type SumFlaw =
  "assumed" | "wrong-pair" | "vertical" | "look" | "circular" | "same-side";
function sumFlaw(r: Random, seed: string, t: Tri, mirror: boolean) {
  const { position, flaw } = flawAt<SumFlaw>(r, {
    1: ["assumed"],
    2: ["wrong-pair", "vertical", "look"],
    3: ["circular", "same-side"],
  });
  const second = r(0, 1) === 1; // which claim of step 2 carries the flaw
  const claim = (n: 1 | 3, angle: "B" | "C", reason: Reason) =>
    `$\\angle ${n} = \\angle ${angle}$ because ${reasonText(reason)}`;
  const AI_AB: Reason = { kind: "AI", line: "AB" },
    AI_AC: Reason = { kind: "AI", line: "AC" };
  const bad: Reason =
    flaw === "vertical"
      ? { kind: "VERT" }
      : r(0, 1)
        ? { kind: "LOOK" }
        : { kind: "MEAS" };
  let first = claim(1, "B", AI_AB),
    other = claim(3, "C", AI_AC);
  let note2 =
    "$\\angle 1$ and $\\angle B$ are alternate interior angles along $AB$, and $\\angle 3$ and $\\angle C$ are alternate interior angles along $AC$.";
  if (flaw === "wrong-pair") {
    if (second) other = claim(3, "B", AI_AC);
    else first = claim(1, "C", AI_AB);
    note2 = second
      ? "Along $AC$, $\\angle 3$ pairs with $\\angle C$, not $\\angle B$: the claim names the wrong angle."
      : "Along $AB$, $\\angle 1$ pairs with $\\angle B$, not $\\angle C$: the claim names the wrong angle.";
  } else if (flaw === "vertical" || flaw === "look") {
    if (second) other = claim(3, "C", bad);
    else first = claim(1, "B", bad);
    note2 = whyNot(bad);
  }
  const step1 =
    flaw === "assumed"
      ? "Draw a line $DE$ through $A$; it looks parallel to $BC$, so it is parallel."
      : "Draw line $DE$ through $A$ parallel to $BC$.";
  const sumReason: Reason =
    flaw === "circular"
      ? { kind: "TRI" }
      : flaw === "same-side"
        ? { kind: "SSI" }
        : { kind: "LINE", line: "DE" };
  const step3 = `$\\angle 1 + \\angle 2 + \\angle 3 = 180^\\circ$ because ${reasonText(sumReason)}. Replacing $\\angle 1$ and $\\angle 3$ gives $\\angle A + \\angle B + \\angle C = 180^\\circ$.`;
  const f: Flawed = {
    steps: [step1, `${first}, and ${other}.`, step3],
    flaw: position,
    notes: [
      flaw === "assumed"
        ? "A line that only looks parallel may not be: the argument must draw $DE$ parallel to $BC$, and the figure shows no parallel marks."
        : "Through $A$ there is exactly one line parallel to $BC$, so this line can always be drawn.",
      note2,
      flaw === "circular"
        ? "It uses the 180° sum of a triangle, the very fact being proved."
        : flaw === "same-side"
          ? "These angles are not same-side interior angles; they fill a straight angle along $DE$."
          : "Angles 1, 2 and 3 fill the straight angle along $DE$, so they add to 180°.",
    ],
  };
  const answerLine =
    f.flaw === 0
      ? "Every step is correct, so the answer is No step is wrong."
      : `The first wrong step is step ${f.flaw}.`;
  return finishChoice("triangle-angle-argument", seed, r, {
    prompt: `A student argues that the angles of triangle $ABC$ add to 180°. ${stepsText(f.steps)} In which step does the argument first go wrong?`,
    figure: sumFigure(t, mirror, "neutral", flaw !== "assumed"),
    choices: flawChoices(f),
    keepOrder: true,
    hint: "Check the steps in order. Is $DE$ drawn parallel to $BC$? Is each reason a true fact about these angles? Does any reason use the 180° sum that the argument is trying to prove?",
    explanation: [
      "A correct argument needs every step true and every reason true for those exact angles. A reason may not use the fact being proved.",
      `Step 1: ${f.notes[0]}`,
      `Step 2: ${f.notes[1]}`,
      `Step 3: ${f.notes[2]}`,
      answerLine,
    ],
    variant: `sum-${flaw}`,
  });
}

type ExteriorFlaw =
  "wrong-pair" | "wrong-reason" | "look" | "remote-minus" | "near-angle";
function exteriorFlaw(r: Random, seed: string, t: Tri, mirror: boolean) {
  const { position, flaw } = flawAt<ExteriorFlaw>(r, {
    1: [],
    2: ["wrong-pair", "wrong-reason", "look"],
    3: ["remote-minus", "near-angle"],
  });
  const AI_AC: Reason = { kind: "AI", line: "AC" },
    CO_BD: Reason = { kind: "CO", line: "BD" };
  const lookFirst = r(0, 1) === 1;
  const first = `$\\angle 4 = \\angle A$ because ${reasonText(flaw === "wrong-reason" ? { kind: "CO", line: "AC" } : flaw === "look" && lookFirst ? { kind: "LOOK" } : AI_AC)}`;
  const second = `$\\angle 5 = \\angle ${flaw === "wrong-pair" ? "A" : "B"}$ because ${reasonText(flaw === "look" && !lookFirst ? { kind: "LOOK" } : CO_BD)}`;
  const note2 =
    flaw === "wrong-pair"
      ? "$\\angle 5$ pairs with $\\angle B$ along line $BD$, not with $\\angle A$."
      : flaw === "wrong-reason"
        ? "$\\angle 4 = \\angle A$ is true, but they are alternate interior angles along $AC$, not corresponding angles."
        : flaw === "look"
          ? whyNot({ kind: "LOOK" })
          : "$\\angle 4$ and $\\angle A$ are alternate interior angles along $AC$, and $\\angle 5$ and $\\angle B$ are corresponding angles along $BD$.";
  const step3 =
    flaw === "remote-minus"
      ? "So $\\angle ACD = 180^\\circ - \\angle A$, because $\\angle ACD$ and $\\angle A$ form a straight angle."
      : flaw === "near-angle"
        ? "So $\\angle ACD = \\angle 4 + \\angle 5 = \\angle A + \\angle C$, because ray $CE$ splits $\\angle ACD$ into $\\angle 4$ and $\\angle 5$."
        : "So $\\angle ACD = \\angle 4 + \\angle 5 = \\angle A + \\angle B$, because ray $CE$ splits $\\angle ACD$ into $\\angle 4$ and $\\angle 5$.";
  const f: Flawed = {
    steps: [
      "Draw ray $CE$ through $C$ parallel to $AB$, and extend side $BC$ past $C$ to $D$.",
      `${first}, and ${second}.`,
      step3,
    ],
    flaw: position,
    notes: [
      "Through $C$ there is exactly one line parallel to $AB$, and a side can always be extended.",
      note2,
      flaw === "remote-minus"
        ? "$\\angle ACD$ makes a straight angle with $\\angle ACB$, the angle next to it, not with $\\angle A$. So $\\angle ACD = 180^\\circ - \\angle C$."
        : flaw === "near-angle"
          ? "$\\angle 5$ equals $\\angle B$, so the sum is $\\angle A + \\angle B$, not $\\angle A + \\angle C$."
          : "Ray $CE$ splits $\\angle ACD$ into $\\angle 4$ and $\\angle 5$, so the exterior angle is $\\angle A + \\angle B$.",
    ],
  };
  return finishChoice("triangle-angle-argument", seed, r, {
    prompt: `A student argues that the exterior angle $\\angle ACD$ of triangle $ABC$ equals $\\angle A + \\angle B$. ${stepsText(f.steps)} In which step does the argument first go wrong?`,
    figure: exteriorFigure(t, mirror, "neutral"),
    choices: flawChoices(f),
    keepOrder: true,
    hint: `Check step 2 claim by claim: does $\\angle 4$ pair with $\\angle A$ along $AC$ and $\\angle 5$ with $\\angle B$ along $BD$? Then check the sum in step 3 against $\\angle 4 + \\angle 5$.`,
    explanation: [
      "A correct argument needs every step true and every reason true for those exact angles.",
      `Step 1: ${f.notes[0]}`,
      `Step 2: ${f.notes[1]}`,
      `Step 3: ${f.notes[2]}`,
      f.flaw === 0
        ? "Every step is correct, so the answer is No step is wrong."
        : `The first wrong step is step ${f.flaw}.`,
    ],
    variant: `exterior-${flaw}`,
  });
}

function copiesArgument(
  r: Random,
  seed: string,
  t: Tri,
  mirror: boolean,
  form: "copies-angle" | "copies-line",
) {
  const figure = copiesFigure(t, mirror);
  const lead =
    "Triangle $ABC$ is copied twice: one copy is turned halfway around the midpoint of $AB$, the other halfway around the midpoint of $AC$. The copies add the corners $C'$ and $B'$ beside $A$.";
  if (form === "copies-angle") {
    const correct =
      "$C'B' \\parallel BC$ and $AB$ is a transversal, so $\\angle 1$ and $\\angle B$ are alternate interior angles.";
    const pool: Choice[] = [
      {
        label:
          "$C'B' \\parallel BC$ and $AB$ is a transversal, so $\\angle 1$ and $\\angle B$ are corresponding angles.",
        feedback:
          "They are on opposite sides of $AB$, between the parallel lines: that makes them alternate interior angles, not corresponding angles.",
      },
      {
        label:
          "$\\angle 1$ and $\\angle B$ are vertical angles where two lines cross, so they are equal.",
        feedback:
          "Vertical angles share a corner. $\\angle 1$ is at $A$ and $\\angle B$ is at $B$.",
      },
      {
        label:
          "The three angles at $A$ make a straight line, so they add to 180°, so $\\angle 1$ equals $\\angle B$.",
        feedback:
          "This uses the 180° sum the picture is meant to explain. It also does not say why $\\angle 1$ is $\\angle B$ rather than another angle.",
      },
      {
        label:
          "$\\angle 1$ and $\\angle B$ look the same size in the figure, so they must be equal.",
        feedback:
          "Looking the same in a drawing proves nothing: the argument must give a reason.",
      },
    ];
    return finishChoice("triangle-angle-argument", seed, r, {
      prompt: `${lead} The three angles at $A$ appear to fill a straight line. Which argument shows that $\\angle 1$ must equal $\\angle B$, using line $C'B'$ and a transversal?`,
      figure,
      choices: [
        { label: correct, correct: true },
        ...shuffle(r, pool).slice(0, 3),
      ],
      hint: `Line $C'B'$ runs through $A$ parallel to $BC$. Side $AB$ crosses both lines; $\\angle 1$ is at $A$ and $\\angle B$ is at $B$. Are they on the same side of $AB$?`,
      explanation: [
        "Each copy was turned halfway around (a half-turn), which moves side $BC$ to a parallel line through $A$. So line $C'B'$ is parallel to $BC$.",
        "Side $AB$ crosses both parallel lines, so $AB$ is a transversal.",
        "$\\angle 1$ (at $A$) and $\\angle B$ lie between the parallel lines, on opposite sides of $AB$. They are alternate interior angles, so they are equal.",
        "So $\\angle 1 = \\angle B$. In the same way $\\angle 3 = \\angle C$ along transversal $AC$.",
        "Angles 1, 2 and 3 fill the straight angle at $A$, so $\\angle B + \\angle A + \\angle C = 180^\\circ$.",
      ],
      variant: "copies-angle",
    });
  }
  const correct =
    "Each half-turn sends $BC$ to a parallel line through $A$, and only one line through $A$ is parallel to $BC$.";
  const pool: Choice[] = [
    {
      label:
        "The three angles at $A$ add to 180°, so the top edge must be a straight line.",
      feedback:
        "This assumes the 180° sum, which the straight edge is supposed to show.",
    },
    {
      label:
        "The three copies are congruent to each other, so the top edge must be straight.",
      feedback:
        "The copies are congruent, but that alone does not make two edges line up.",
    },
    {
      label:
        "Each copy turned exactly 180°, so its edges keep going in a straight line.",
      feedback:
        "The 180° is the amount of turning, not the angle at the top. What matters is that each turned side is parallel to $BC$.",
    },
    {
      label:
        "The sides of every triangle are straight, so the top edge must be straight too.",
      feedback:
        "Each side is straight, but two sides could still meet at a bend.",
    },
  ];
  return finishChoice("triangle-angle-argument", seed, r, {
    prompt: `${lead} Why is the top edge $C'AB'$ one straight line, rather than two edges that only look straight?`,
    figure,
    choices: [
      { label: correct, correct: true },
      ...shuffle(r, pool).slice(0, 3),
    ],
    hint: `A half-turn turns every segment to point the opposite way. Where does side $BC$ land in the copy turned about the midpoint of $AB$, and which way does it point?`,
    explanation: [
      "A half-turn turns a figure 180° about a point. It sends every line to a line parallel to it.",
      "The half-turn about the midpoint of $AB$ sends $B$ to $A$, so it sends side $BC$ to segment $AC'$: a line through $A$ parallel to $BC$.",
      "The half-turn about the midpoint of $AC$ sends $C$ to $A$, so it sends $BC$ to segment $B'A$: also a line through $A$ parallel to $BC$.",
      "Through $A$ there is only one line parallel to $BC$. So $AC'$ and $AB'$ lie on that one line, and $C'AB'$ is straight.",
      "Angles 1, 2 and 3 are copies of $\\angle B$, $\\angle A$ and $\\angle C$, and they fill the straight angle along $C'AB'$. So $\\angle A + \\angle B + \\angle C = 180^\\circ$.",
    ],
    variant: "copies-line",
  });
}

function triangleAngleArgument(seed: string, salt: string): GeneratedProblem {
  const id = "triangle-angle-argument";
  const r = random(id, salt);
  const axes = chooseAxes(id, seed, angleArgumentAxes[id]);
  const t = triangleAngles(r, 8);
  const mirror = r(0, 1) === 1;
  const a = axes.argument;
  const p =
    a === "sum-flaw"
      ? sumFlaw(r, seed, t, mirror)
      : a === "exterior-flaw"
        ? exteriorFlaw(r, seed, t, mirror)
        : copiesArgument(r, seed, t, mirror, a);
  return { ...p, variant: { id: p.variant!.id, axes: axisRecord(axes) } };
}

/* ======================================================= parallel lines */

/** Crossings: p (upper) and q (lower) crossed by t. Angles 1–4 at p and 5–8
 * at q, numbered clockwise from the upper-left region. */
type Crossings = {
  P: V;
  Q: V;
  /** Direction of t going up, in degrees (0, 180). */
  phi: number;
  /** Directions of p and q (pointing right). */
  dp: number;
  dq: number;
};
const REGION = ["UL", "UR", "LR", "LL"] as const;
/** The sector of numbered angle n (1–8). */
function region(c: Crossings, n: number) {
  const at = n <= 4 ? c.P : c.Q;
  const d = n <= 4 ? c.dp : c.dq;
  const up = c.phi,
    down = c.phi + 180;
  const which = REGION[(n - 1) % 4]!;
  const s =
    which === "UL"
      ? { from: up, to: d + 180 }
      : which === "UR"
        ? { from: d, to: up }
        : which === "LR"
          ? { from: down, to: d + 360 }
          : { from: d + 180, to: down };
  const from = norm(s.from);
  return { at, from, to: from + norm(s.to - s.from) };
}
const measureOf = (c: Crossings, n: number) => {
  const s = region(c, n);
  return Math.round(s.to - s.from);
};
function crossings(r: Random, tilt = 0): Crossings {
  const theta = r(35, 75);
  const phi = r(0, 1) ? theta : 180 - theta;
  const H = 3;
  const Q: V = [0, 0];
  const P = add(Q, mul(dirV(phi), H / Math.sin(rad(phi))));
  return { P, Q, phi, dp: tilt, dq: 0 };
}
function parallelFigure(
  c: Crossings,
  o: { marked: boolean; measures?: Record<number, number> },
) {
  const xs = [c.P[0], c.Q[0]];
  const left = Math.min(...xs) - 3.4,
    right = Math.max(...xs) + 3.4;
  const onLine = (at: V, d: number, x: number): V => [
    x,
    at[1] + Math.tan(rad(d)) * (x - at[0]),
  ];
  const p0 = onLine(c.P, c.dp, left),
    p1 = onLine(c.P, c.dp, right),
    q0 = onLine(c.Q, c.dq, left),
    q1 = onLine(c.Q, c.dq, right);
  const u = dirV(c.phi);
  const t0 = sub(c.Q, mul(u, 1.7)),
    t1 = add(c.P, mul(u, 1.7));
  const elements: Element[] = [
    segment("l-p", p0, p1),
    segment("l-q", q0, q1),
    segment("l-t", t0, t1),
    ...(o.marked
      ? [parallelMark("pm-p", p0, p1, 0.1), parallelMark("pm-q", q0, q1, 0.1)]
      : []),
    lineName("ln-p", "p", p1, [1, 0]),
    lineName("ln-q", "q", q1, [1, 0]),
    lineName("ln-t", "t", t1, u),
  ];
  for (let n = 1; n <= 8; n++) {
    const s = region(c, n);
    const bis = (s.from + s.to) / 2;
    const half = rad((s.to - s.from) / 2);
    const reach = Math.max(0.78, 0.42 / Math.sin(half));
    elements.push({
      type: "text",
      id: `n-${n}`,
      at: round(add(s.at, mul(dirV(bis), reach))),
      text: String(n),
      font: "math",
      size: "sm",
      bold: true,
      color: "accent",
      halo: true,
      align: [0, 0],
    });
    const m = o.measures?.[n];
    if (m !== undefined)
      elements.push({
        type: "text",
        id: `m-${n}`,
        at: round(add(s.at, mul(dirV(bis), reach + 1.05))),
        text: deg(m),
        size: "sm",
        bold: true,
        color: "warm",
        halo: true,
        align: [0, 0],
      });
  }
  return build(
    o.marked
      ? "Parallel lines p and q crossed by line t, with eight numbered angles"
      : "Lines p and q crossed by line t, with eight numbered angles",
    elements,
  );
}
/** The corresponding partner (same position at the other crossing). */
const partner = (n: number) => (n <= 4 ? n + 4 : n - 4);
/** The vertical partner (across the same crossing). */
const across = (n: number) => (n % 4 === 1 || n % 4 === 2 ? n + 2 : n - 2);
const PARALLEL_LEAD =
  "Lines $p$ and $q$ are parallel, and line $t$ crosses both.";
type AnglePair = readonly [number, number];
const CORRESPONDING: readonly AnglePair[] = [
  [1, 5],
  [2, 6],
  [3, 7],
  [4, 8],
];
const ALTERNATE: readonly AnglePair[] = [
  [3, 5],
  [4, 6],
];
const SAME_SIDE: readonly AnglePair[] = [
  [3, 6],
  [4, 5],
];
const ordered = (
  r: Random,
  pair: readonly [number, number],
): [number, number] => (r(0, 1) ? [pair[0], pair[1]] : [pair[1], pair[0]]);
const lineAt = (n: number) => (n <= 4 ? "p" : "q");

function translationArgument(r: Random, seed: string) {
  const c = crossings(r);
  const [a, b] = ordered(r, pick(r, CORRESPONDING));
  const from = lineAt(a),
    to = lineAt(b);
  const A = `$\\angle ${a}$`,
    B = `$\\angle ${b}$`,
    same = `$\\angle ${a} = \\angle ${b}$`;
  const correct = `Slide along $t$ to the other crossing: $${from}$ stays parallel, so it lands on $${to}$, and ${A} lands on ${B}.`;
  const always: Choice[] = [
    {
      label: `Any two lines crossed by transversal $t$ make the same angles with it, so ${same}.`,
      feedback:
        "This drops the hypothesis. Lines that are not parallel make different angles with $t$.",
    },
    {
      label: `Slide $${from}$ straight ${from === "p" ? "down" : "up"} onto $${to}$; parallel lines match, so ${A} and ${B} match.`,
      feedback: `That slide moves $t$ off itself, so it does not carry ${A} onto ${B}. Slide along $t$ instead.`,
    },
  ];
  const maybe: Choice[] = [
    {
      label: `${A} and ${B} are vertical angles, and vertical angles are always equal.`,
      feedback: `Vertical angles share a crossing. ${A} is at line $${from}$ and ${B} is at line $${to}$.`,
    },
    {
      label: `Turn the figure 180° about the crossing on $${from}$; that carries ${A} onto ${B}.`,
      feedback: `A half-turn about that crossing carries ${A} onto $\\angle ${across(a)}$, the angle across from it, not onto ${B}.`,
    },
  ];
  return finishChoice("parallel-angle-argument", seed, r, {
    prompt: `${PARALLEL_LEAD} Which argument shows that ${same}?`,
    figure: parallelFigure(c, { marked: true }),
    choices: [{ label: correct, correct: true }, ...always, pick(r, maybe)],
    hint: `${A} is at line $${from}$ and ${B} is at line $${to}$, in matching positions. Which slide of the whole figure keeps $t$ on itself and moves one crossing onto the other?`,
    explanation: [
      `${A} and ${B} sit in matching positions where $t$ crosses $${from}$ and $${to}$: they are corresponding angles.`,
      `Slide the whole figure along $t$ until the crossing on $${from}$ reaches the crossing on $${to}$. Line $t$ lands on itself.`,
      `A slide keeps every line pointing the same way, so $${from}$ lands on a line through the other crossing that is parallel to $${from}$. Only one such line exists, and it is $${to}$.`,
      `So ${A} lands exactly on ${B}. A slide does not change any angle, so ${same}.`,
      `Without $p \\parallel q$ the slid copy of $${from}$ would miss $${to}$, and the angles could differ.`,
    ],
    variant: "translation",
  });
}

function halfTurnArgument(r: Random, seed: string) {
  const c = crossings(r);
  const [a, b] = ordered(r, pick(r, ALTERNATE));
  const A = `$\\angle ${a}$`,
    B = `$\\angle ${b}$`;
  const choices: Choice[] = [
    {
      label:
        "A half-turn about the midpoint of $t$ between the crossings, so $t$ lands on itself and $p$ on $q$",
      correct: true,
    },
    {
      label:
        "A slide along $t$ from one crossing to the other, so $t$ lands on itself",
      feedback: `A slide along $t$ carries ${A} onto $\\angle ${partner(a)}$, its corresponding angle, not onto ${B}.`,
    },
    {
      label:
        "A reflection across line $t$, so $t$ stays in place and each angle flips over",
      feedback: `A reflection across $t$ keeps ${A} at the same crossing, so it cannot land on ${B}.`,
    },
    {
      label:
        "A reflection across the line halfway between $p$ and $q$, so $p$ and $q$ swap",
      feedback: `That reflection moves $t$ to a different line, so ${A} does not land on any of the eight angles.`,
    },
  ];
  return finishChoice("parallel-angle-argument", seed, r, {
    prompt: `${PARALLEL_LEAD} Which motion of the whole figure takes ${A} onto ${B} and so shows they are equal?`,
    figure: parallelFigure(c, { marked: true }),
    choices,
    hint: `${A} and ${B} lie between $p$ and $q$ on opposite sides of $t$. A motion that lands ${A} on ${B} must swap the two crossings and turn the angle to face the other way.`,
    explanation: [
      `${A} and ${B} lie between the parallel lines on opposite sides of $t$: they are alternate interior angles.`,
      "Turn the whole figure halfway around (180°) about the midpoint $M$ of the part of $t$ between the crossings. The two crossings swap places, and $t$ lands on itself.",
      "A half-turn sends every line to a parallel line. So $p$ lands on the line through the lower crossing parallel to $p$, which is $q$.",
      `Each ray now points the opposite way, so ${A} lands exactly on ${B}. A half-turn does not change angles, so $\\angle ${a} = \\angle ${b}$.`,
      `A slide along $t$ would carry ${A} onto $\\angle ${partner(a)}$ instead.`,
    ],
    variant: "half-turn",
  });
}

type ParallelFlaw =
  "name-1" | "all-equal" | "look-1" | "name-2" | "swap" | "look-2" | "circular";
function parallelFlaw(r: Random, seed: string) {
  const c = crossings(r);
  const fact = pick(r, ["alternate", "same-side", "corresponding"] as const);
  let a: number, b: number;
  if (fact === "corresponding") {
    a = pick(r, [1, 2, 7, 8]);
    b = partner(a);
  } else
    [a, b] = ordered(r, pick(r, fact === "alternate" ? ALTERNATE : SAME_SIDE));
  const middle = fact === "corresponding" ? across(a) : partner(a);
  const lookOk = fact !== "same-side";
  const { position, flaw } = flawAt<ParallelFlaw>(r, {
    1: ["name-1", "all-equal", "look-1"],
    2: lookOk ? ["name-2", "swap", "look-2"] : ["name-2", "swap"],
    3: ["circular"],
  });
  const T: Reason = { kind: "CO", line: "t" };
  const AIt: Reason = { kind: "AI", line: "t" };
  const eq = (x: number, y: number) => `$\\angle ${x} = \\angle ${y}$`;
  const sum = (x: number, y: number) =>
    `$\\angle ${x} + \\angle ${y} = 180^\\circ$`;
  const look: Reason = r(0, 1) ? { kind: "LOOK" } : { kind: "MEAS" };
  // Valid chain.
  const firstReason: Reason = fact === "corresponding" ? { kind: "VERT" } : T;
  const secondReason: Reason =
    fact === "alternate"
      ? { kind: "VERT" }
      : fact === "same-side"
        ? { kind: "LP", line: "t" }
        : AIt;
  const wrongName = (x: Reason): Reason =>
    x.kind === "CO"
      ? AIt
      : x.kind === "VERT"
        ? T
        : x.kind === "AI"
          ? T
          : { kind: "SSI" };
  let r1 = firstReason,
    r2 = secondReason;
  let claim2 = fact === "same-side" ? sum(middle, b) : eq(middle, b);
  if (flaw === "name-1") r1 = wrongName(firstReason);
  if (flaw === "all-equal") r1 = { kind: "ALLEQ" };
  if (flaw === "look-1") r1 = look;
  if (flaw === "name-2") r2 = wrongName(secondReason);
  if (flaw === "look-2") r2 = look;
  if (flaw === "swap") {
    if (fact === "alternate") {
      claim2 = sum(middle, b);
      r2 = { kind: "LP", line: "t" };
    } else if (fact === "same-side") {
      claim2 = eq(middle, b);
      r2 = { kind: "VERT" };
    } else {
      claim2 = sum(middle, b);
      r2 = { kind: "SSI" };
    }
  }
  const target = fact === "same-side" ? sum(a, b) : eq(a, b);
  const targetReason: Reason =
    fact === "alternate" ? AIt : fact === "same-side" ? { kind: "SSI" } : T;
  const steps: [string, string, string] = [
    `${eq(a, middle)} because ${reasonText(r1)}.`,
    `${claim2} because ${reasonText(r2)}.`,
    flaw === "circular"
      ? `So ${target}, because ${reasonText(targetReason)}.`
      : `So ${target}.`,
  ];
  const relationName = (x: number, y: number) =>
    across(x) === y
      ? "vertical angles"
      : partner(x) === y
        ? "corresponding angles"
        : "a linear pair along $t$";
  const valid1 = `${eq(a, middle)} is true: they are ${fact === "corresponding" ? "vertical angles" : "corresponding angles along $t$"}.`;
  const valid2 =
    fact === "alternate"
      ? `${eq(middle, b)} is true: they are vertical angles.`
      : fact === "same-side"
        ? `${sum(middle, b)} is true: they form a linear pair along $t$.`
        : `${eq(middle, b)} is true: they are alternate interior angles along $t$.`;
  const note1 =
    flaw === "name-1"
      ? `${eq(a, middle)} is true, but the reason names the wrong pair: they are ${relationName(a, middle)}.`
      : flaw === "all-equal"
        ? whyNot({ kind: "ALLEQ" })
        : flaw === "look-1"
          ? whyNot(look)
          : valid1;
  const note2 =
    flaw === "name-2"
      ? `The claim is true, but the reason names the wrong pair: they are ${fact === "same-side" ? "a linear pair along $t$" : fact === "alternate" ? "vertical angles" : "alternate interior angles along $t$"}.`
      : flaw === "swap"
        ? fact === "same-side"
          ? `$\\angle ${middle}$ and $\\angle ${b}$ form a linear pair: they add to 180°. They are not equal unless both are right angles.`
          : `$\\angle ${middle}$ and $\\angle ${b}$ are equal, not a pair that adds to 180°.`
        : flaw === "look-2"
          ? whyNot(look)
          : valid2;
  const note3 =
    flaw === "circular"
      ? "The reason is the very fact the argument is trying to show, so it proves nothing."
      : `${target} follows from steps 1 and 2 by replacing $\\angle ${middle}$.`;
  const f: Flawed = { steps, flaw: position, notes: [note1, note2, note3] };
  return finishChoice("parallel-angle-argument", seed, r, {
    prompt: `${PARALLEL_LEAD} A student argues that ${target}. ${stepsText(steps)} In which step does the argument first go wrong?`,
    figure: parallelFigure(c, { marked: true }),
    choices: flawChoices(f),
    keepOrder: true,
    hint: `Find $\\angle ${a}$ and $\\angle ${middle}$ in the figure first. Name how they sit, then check the reason step 1 gives for them, and do the same for step 2.`,
    explanation: [
      "A correct argument needs every step true and every reason true for those exact angles. A reason may not be the fact being proved.",
      `Step 1: ${note1}`,
      `Step 2: ${note2}`,
      `Step 3: ${note3}`,
      f.flaw === 0
        ? "Every step is correct, so the answer is No step is wrong."
        : `The first wrong step is step ${f.flaw}.`,
    ],
    variant: `flaw-${fact}-${flaw}`,
  });
}

function hypothesisArgument(r: Random, seed: string) {
  const d = r(12, 20) * (r(0, 1) ? 1 : -1);
  const c = crossings(r, d);
  const [a, b] = ordered(r, pick(r, CORRESPONDING));
  const ma = measureOf(c, a),
    mb = measureOf(c, b);
  if (
    ma === mb ||
    [1, 2, 5, 6].some((n) => measureOf(c, n) < 25 || measureOf(c, n) > 155)
  )
    throw new Error("Need two different, readable measures");
  const A = `$\\angle ${a}$`,
    B = `$\\angle ${b}$`;
  const pool: Choice[] = [
    {
      label:
        "Nothing is wrong: corresponding angles are always equal, whatever the lines.",
      feedback:
        "Corresponding angles are equal only when the two lines are parallel. The figure shows two different measures.",
    },
    {
      label: `${A} and ${B} are alternate interior angles, not corresponding angles.`,
      feedback: `${A} and ${B} sit in matching positions at the two crossings, so they are corresponding angles. The name is right; the hypothesis is missing.`,
    },
    {
      label:
        "Line $t$ would have to be perpendicular to $p$ and $q$ for the angles to match.",
      feedback:
        "No such rule exists. Any transversal works, but only when the lines it crosses are parallel.",
    },
    {
      label:
        "The angles are really equal, and the figure is just drawn a little badly.",
      feedback:
        "The figure is drawn true to its measures, and the measures differ. Nothing says $p \\parallel q$.",
    },
  ];
  return finishChoice("parallel-angle-argument", seed, r, {
    prompt: `Line $t$ crosses lines $p$ and $q$. A student says: "$\\angle ${a} = \\angle ${b}$ because corresponding angles are equal." What is wrong?`,
    figure: parallelFigure(c, {
      marked: false,
      measures: { [a]: ma, [b]: mb },
    }),
    choices: [
      {
        label:
          "Corresponding angles are equal only for parallel lines. Nothing says $p \\parallel q$, and the measures differ.",
        correct: true,
      },
      ...shuffle(r, pool).slice(0, 3),
    ],
    hint: `The figure marks ${A} as ${deg(ma)}. Before using "corresponding angles are equal", check what that fact needs: are $p$ and $q$ marked parallel?`,
    explanation: [
      `${A} and ${B} are corresponding angles: they sit in matching positions where $t$ crosses $p$ and $q$.`,
      "Corresponding angles are equal when the lines are parallel. That condition is called the hypothesis of the fact.",
      "Nothing here says $p \\parallel q$: the lines have no parallel marks, and they lean toward each other.",
      `Sliding along $t$ does not carry $p$ onto $q$ here, and the measures show it: ${A} is ${deg(ma)} but ${B} is ${deg(mb)}.`,
      "So the student used the fact without its hypothesis.",
    ],
    variant: "hypothesis",
  });
}

function parallelAngleArgument(seed: string, salt: string): GeneratedProblem {
  const id = "parallel-angle-argument";
  const r = random(id, salt);
  const axes = chooseAxes(id, seed, angleArgumentAxes[id]);
  const p =
    axes.argument === "translation"
      ? translationArgument(r, seed)
      : axes.argument === "half-turn"
        ? halfTurnArgument(r, seed)
        : axes.argument === "flaw"
          ? parallelFlaw(r, seed)
          : hypothesisArgument(r, seed);
  return { ...p, variant: { id: p.variant!.id, axes: axisRecord(axes) } };
}

function parallelAngleReasons(seed: string, salt: string): GeneratedProblem {
  const id = "parallel-angle-reasons";
  const r = random(id, salt);
  const axes = chooseAxes(id, seed, angleArgumentAxes[id]);
  const c = crossings(r);
  const alternate = axes.argument === "alternate-interior";
  const [a, b] = ordered(r, pick(r, alternate ? ALTERNATE : SAME_SIDE));
  const m = partner(a);
  const CO: Reason = { kind: "CO", line: "t" },
    AI: Reason = { kind: "AI", line: "t" },
    LPt: Reason = { kind: "LP", line: "t" },
    VERT: Reason = { kind: "VERT" },
    SSI: Reason = { kind: "SSI" },
    AROUND: Reason = { kind: "AROUND" };
  const first = optionsFor(
    r,
    CO,
    [AI, SSI],
    alternate ? [VERT, { kind: "LP", line: "q" }] : [VERT, AROUND],
  );
  const second = alternate
    ? optionsFor(r, VERT, [CO, AI, { kind: "LP", line: lineAt(b) }], [])
    : optionsFor(r, LPt, [VERT, SSI, AROUND], []);
  const target = alternate
    ? `$\\angle ${a} = \\angle ${b}$`
    : `$\\angle ${a} + \\angle ${b} = 180^\\circ$`;
  return finishParts(id, seed, {
    prompt: `${PARALLEL_LEAD} Choose the reason for each step of the argument that ${target}. The argument then replaces $\\angle ${m}$ with $\\angle ${a}$.`,
    label: "Choose the reason for each step",
    figure: parallelFigure(c, { marked: true }),
    parts: [
      {
        id: "s1",
        label: `Step 1: $\\angle ${a} = \\angle ${m}$ because`,
        options: first.map(reasonText),
        correct: reasonText(CO),
      },
      {
        id: "s2",
        label: alternate
          ? `Step 2: $\\angle ${m} = \\angle ${b}$ because`
          : `Step 2: $\\angle ${m} + \\angle ${b} = 180^\\circ$ because`,
        options: second.map(reasonText),
        correct: reasonText(alternate ? VERT : LPt),
      },
    ],
    hint: `$\\angle ${a}$ is at line $${lineAt(a)}$ and $\\angle ${m}$ is at line $${lineAt(m)}$, in the same position. Then compare $\\angle ${m}$ with $\\angle ${b}$: they share a crossing.`,
    explanation: [
      `Step 1: $\\angle ${a}$ and $\\angle ${m}$ sit in matching positions where $t$ crosses $p$ and $q$. They are corresponding angles, so they are equal: sliding along $t$ carries one onto the other.`,
      alternate
        ? `Step 2: $\\angle ${m}$ and $\\angle ${b}$ sit across from each other at the same crossing. They are vertical angles, so they are equal.`
        : `Step 2: $\\angle ${m}$ and $\\angle ${b}$ sit side by side at the same crossing, and together they fill a straight angle along $t$. They form a linear pair, so they add to 180°.`,
      alternate
        ? `Replace $\\angle ${m}$ with $\\angle ${a}$: $\\angle ${a} = \\angle ${b}$. Alternate interior angles are equal.`
        : `Replace $\\angle ${m}$ with $\\angle ${a}$: $\\angle ${a} + \\angle ${b} = 180^\\circ$. Same-side interior angles add to 180°.`,
      alternate
        ? 'The reason "alternate interior angles" cannot be used in step 1: that is the fact being proved.'
        : 'The reason "same-side interior angles add to 180°" cannot be used: that is the fact being proved.',
    ],
    variant: axes.argument,
  });
}

/* ========================================================= AA similarity */

const LETTERS = ["A", "B", "C"] as const;
const LETTERS2 = ["D", "E", "F"] as const;
type Angles3 = [number, number, number];
const sameSet = (x: readonly number[], y: readonly number[]) =>
  [...x].sort((m, n) => m - n).join() === [...y].sort((m, n) => m - n).join();

/** Two triangles: ABC with angles abc, DEF with angles def (both drawn true),
 * DEF scaled, turned by a multiple of 30° and flipped in half the seeds.
 * Given angles are written in their arcs; the rest are "?" when `ask`. */
function twoTriangles(
  r: Random,
  abc: Angles3,
  def: Angles3,
  shownABC: readonly number[],
  shownDEF: readonly number[],
) {
  const place = (
    angles: Angles3,
    names: readonly string[],
    shown: readonly number[],
    scale: number,
    turn: number,
    flip: boolean,
    shift: V,
    paint: Paint,
  ): { elements: Element[]; right: number } => {
    const base = 4 * scale;
    const ab = (base * Math.sin(rad(angles[2]))) / Math.sin(rad(angles[0]));
    const raw: V[] = [
      [ab * Math.cos(rad(angles[1])), ab * Math.sin(rad(angles[1]))],
      [0, 0],
      [base, 0],
    ];
    // Vertices in name order: first name at raw[0] (apex), then the base.
    const turned = raw.map((p) => {
      const q: V = flip ? [-p[0], p[1]] : p;
      const c = Math.cos(rad(turn)),
        s = Math.sin(rad(turn));
      return [q[0] * c - q[1] * s, q[0] * s + q[1] * c] as V;
    });
    const minX = Math.min(...turned.map((p) => p[0])),
      minY = Math.min(...turned.map((p) => p[1]));
    const pts = turned.map((p) => add(sub(p, [minX, minY]), shift));
    const centroid: V = [
      (pts[0]![0] + pts[1]![0] + pts[2]![0]) / 3,
      (pts[0]![1] + pts[1]![1] + pts[2]![1]) / 3,
    ];
    const out: Element[] = [
      {
        type: "polygon",
        id: `t-${names.join("")}`,
        points: pts.map(round),
        fill: paint === "accent" ? "accent-fill" : "warm-fill",
        stroke: "ink",
        width: 2.25,
      },
    ];
    names.forEach((name, i) => {
      const v = pts[i]!,
        p = pts[(i + 1) % 3]!,
        q = pts[(i + 2) % 3]!;
      const known = shown.includes(i);
      out.push(
        ...angleMark(name, v, sector(v, p, q), {
          paint,
          r: 0.55,
          label: known ? deg(angles[i]!) : "?",
        }),
        pointName(name, v, centroid),
      );
    });
    return { elements: out, right: Math.max(...pts.map((p) => p[0])) };
  };
  // Scale factor of DEF; never 1, and never so small that its angle labels
  // crowd together on a phone.
  const scale = pick(r, [0.75, 0.8, 1.25, 1.5]);
  const first = place(
    abc,
    LETTERS,
    shownABC,
    1,
    pick(r, [0, 30, 330]),
    false,
    [0, 0],
    "accent",
  );
  const second = place(
    def,
    LETTERS2,
    shownDEF,
    scale,
    pick(r, [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]),
    r(0, 1) === 1,
    [first.right + 2.4, 0],
    "warm",
  );
  return build(
    "Triangles ABC and DEF with two angle measures written in each",
    [...first.elements, ...second.elements],
  );
}
type AACase = {
  abc: Angles3;
  def: Angles3;
  shownABC: [number, number];
  shownDEF: [number, number];
  similar: boolean;
};
/** Angles in [25°, 110°] pairwise ≥ 10° apart; each triangle shows two
 * angles, sharing exactly one measure with the other's shown pair. */
function aaCase(r: Random, similar: boolean, minShift = 5): AACase {
  for (;;) {
    const t = triangleAngles(r, 10);
    const abc: Angles3 = [t.A, t.B, t.C];
    const hiddenABC = r(0, 2);
    const shownABC = [0, 1, 2].filter((i) => i !== hiddenABC) as [
      number,
      number,
    ];
    let def: Angles3;
    if (similar) {
      def = shuffle(r, [...abc]) as Angles3;
      // DEF shows the measure ABC hides and one of ABC's shown measures.
      const hiddenValue = abc[hiddenABC]!;
      const sharedValue = abc[pick(r, shownABC)]!;
      const iHidden = def.indexOf(hiddenValue),
        iShared = def.indexOf(sharedValue);
      const shownDEF = [iHidden, iShared].sort() as [number, number];
      return { abc, def, shownABC, shownDEF, similar };
    }
    // Not similar: keep one shown measure, change the other two by ±d.
    const keep = pick(r, shownABC);
    const others = [0, 1, 2].filter((i) => i !== keep);
    const dd = r(minShift, 20);
    const changed: Angles3 = [...abc];
    changed[others[0]!] = abc[others[0]!]! + dd;
    changed[others[1]!] = abc[others[1]!]! - dd;
    if (changed.some((x) => x < 25 || x > 110)) continue;
    if (sameSet(changed, abc)) continue;
    const vals = [...changed];
    if (
      Math.abs(vals[0]! - vals[1]!) < 5 ||
      Math.abs(vals[1]! - vals[2]!) < 5 ||
      Math.abs(vals[0]! - vals[2]!) < 5
    )
      continue;
    def = shuffle(r, changed) as Angles3;
    const keptValue = abc[keep]!;
    if (def.filter((x) => x === keptValue).length !== 1) continue;
    const iKeep = def.indexOf(keptValue);
    const otherDEF = pick(
      r,
      [0, 1, 2].filter((i) => i !== iKeep && !abc.includes(def[i]!)),
    );
    if (otherDEF === undefined) continue;
    const shownDEF = [iKeep, otherDEF].sort() as [number, number];
    // Exactly one shown measure in common.
    const sa = shownABC.map((i) => abc[i]!),
      sd = shownDEF.map((i) => def[i]!);
    if (sa.filter((x) => sd.includes(x)).length !== 1) continue;
    return { abc, def, shownABC, shownDEF, similar };
  }
}
const givenText = (
  names: readonly string[],
  angles: Angles3,
  shown: readonly number[],
) =>
  shown
    .map((i) => `$\\angle ${names[i]} = ${texDeg(angles[i]!)}$`)
    .join(" and ");
const thirdIndex = (shown: readonly number[]) =>
  [0, 1, 2].find((i) => !shown.includes(i))!;
const listDeg = (x: readonly number[]) =>
  `${x.slice(0, -1).map(deg).join(", ")} and ${deg(x.at(-1)!)}`;
/** Pairs ABC vertex i with the DEF vertex of the same measure. */
function correspondence(k: AACase) {
  return [0, 1, 2].map((i) => k.def.indexOf(k.abc[i]!));
}

function aaDecide(r: Random, seed: string) {
  const similar = r(0, 1) === 1;
  const k = aaCase(r, similar);
  const ti = thirdIndex(k.shownABC),
    tj = thirdIndex(k.shownDEF);
  const shared = k.shownABC
    .map((i) => k.abc[i]!)
    .find((x) => k.shownDEF.map((j) => k.def[j]!).includes(x))!;
  const sa = k.shownABC.map((i) => k.abc[i]!),
    sd = k.shownDEF.map((j) => k.def[j]!);
  const third = (names: readonly string[], i: number, x: number) =>
    `$\\angle ${names[i]} = ${texDeg(x)}$`;
  const prompt = `In $\\triangle ABC$, ${givenText(LETTERS, k.abc, k.shownABC)}. In $\\triangle DEF$, ${givenText(LETTERS2, k.def, k.shownDEF)}. Are the triangles similar? Choose the argument that is correct and complete.`;
  let correct: string;
  let pool: Choice[];
  if (similar) {
    correct = `Yes. The third angles are ${deg(k.abc[ti]!)} and ${deg(k.def[tj]!)}, so all three angles match, which makes the triangles similar.`;
    pool = [
      {
        label: `Yes. They share ${article(shared)} ${deg(shared)} angle, and one pair of equal angles is enough for similar.`,
        feedback:
          "One equal angle is not enough: two triangles can share one angle and have different shapes. Find the third angles and compare all three.",
      },
      {
        label: `No. The given angles ${deg(sa[0]!)} and ${deg(sa[1]!)} do not match ${deg(sd[0]!)} and ${deg(sd[1]!)}, so the shapes differ.`,
        feedback:
          "The given angles are different pairs. The angle sum gives each third angle, and then all three match.",
      },
      {
        label:
          "We cannot tell whether they are similar without knowing the side lengths.",
        feedback:
          "Angles are enough: once all three angles match, a dilation and rigid motions map one triangle onto the other.",
      },
      {
        label:
          "No. The triangles are different sizes, so they cannot be similar to each other.",
        feedback:
          "Similar triangles may have different sizes. Similar means the same shape; equal size is congruent.",
      },
    ];
  } else {
    correct = `No. The angles are ${k.abc.map(deg).join(", ")} and ${k.def.map(deg).join(", ")}, which do not all match, so they are not similar.`;
    pool = [
      {
        label: `Yes. Both triangles have ${article(shared)} ${deg(shared)} angle, so they must be similar to each other.`,
        feedback:
          "One equal angle is not enough. The third angles show the other two angles differ.",
      },
      {
        label:
          "Yes. Once two angles are given in each, the third angles always match too.",
        feedback:
          "The third angle is fixed by the two given in the same triangle, not by another triangle's angles. Compute each one.",
      },
      {
        label:
          "We cannot tell whether they are similar without knowing the side lengths.",
        feedback:
          "Angles are enough to decide: the triangles do not have the same three angles, so they are not similar.",
      },
      {
        label:
          "Yes. One triangle is a dilation of the other, because it is the bigger one.",
        feedback:
          "Being bigger does not make a triangle a dilation of another. A dilation keeps every angle, and these angles differ.",
      },
    ];
  }
  if (correct.length > 120) throw new Error("Need a shorter argument");
  const corr = correspondence(k);
  return finishChoice("aa-similarity-argument", seed, r, {
    prompt,
    figure: twoTriangles(r, k.abc, k.def, k.shownABC, k.shownDEF),
    choices: [
      { label: correct, correct: true },
      ...shuffle(r, pool).slice(0, 3),
    ],
    hint: `Each triangle shows two angles. Find the third angle of $\\triangle ABC$: $180 - ${sa[0]} - ${sa[1]}$. Then do the same for $\\triangle DEF$ and compare all three.`,
    explanation: [
      "The angles of a triangle add to 180°, so two angles fix the third.",
      `In $\\triangle ABC$: ${third(LETTERS, ti, k.abc[ti]!)}, because $180 - ${sa[0]} - ${sa[1]} = ${k.abc[ti]}$.`,
      `In $\\triangle DEF$: ${third(LETTERS2, tj, k.def[tj]!)}, because $180 - ${sd[0]} - ${sd[1]} = ${k.def[tj]}$.`,
      similar
        ? `The angles of $\\triangle ABC$ are ${listDeg(k.abc)}, and so are those of $\\triangle DEF$. They match: $\\angle A = \\angle ${LETTERS2[corr[0]!]}$, $\\angle B = \\angle ${LETTERS2[corr[1]!]}$, $\\angle C = \\angle ${LETTERS2[corr[2]!]}$.`
        : `The angles of $\\triangle ABC$ are ${listDeg(k.abc)}; those of $\\triangle DEF$ are ${listDeg(k.def)}. They do not all match.`,
      similar
        ? "A dilation can make $\\triangle ABC$ the size of $\\triangle DEF$ without changing its angles, and slides, turns and flips then place it on $\\triangle DEF$. So the triangles are similar."
        : "Dilations and rigid motions never change an angle, so no sequence of them maps one triangle onto the other. The triangles are not similar.",
    ],
    variant: `decide-${similar ? "similar" : "not-similar"}`,
  });
}

type AAFlaw = "arith" | "one-pair" | "mismatch" | "congruent" | "sides";
function aaFlaw(r: Random, seed: string) {
  const { position, flaw } = flawAt<AAFlaw>(r, {
    1: ["arith"],
    2: ["one-pair", "mismatch"],
    3: ["congruent", "sides"],
  });
  const similar =
    flaw === "mismatch"
      ? false
      : flaw === "none"
        ? r(0, 1) === 1
        : flaw === "arith"
          ? r(0, 1) === 1
          : true;
  const k = aaCase(r, similar, flaw === "mismatch" ? 10 : 5);
  const ti = thirdIndex(k.shownABC),
    tj = thirdIndex(k.shownDEF);
  const sa = k.shownABC.map((i) => k.abc[i]!),
    sd = k.shownDEF.map((j) => k.def[j]!);
  const slip = r(0, 1) ? 10 : -10;
  const shownThird = flaw === "arith" ? k.abc[ti]! + slip : k.abc[ti]!;
  const step1 = `By the angle sum, $\\angle ${LETTERS[ti]} = 180^\\circ - ${texDeg(sa[0]!)} - ${texDeg(sa[1]!)} = ${texDeg(shownThird)}$ and $\\angle ${LETTERS2[tj]} = 180^\\circ - ${texDeg(sd[0]!)} - ${texDeg(sd[1]!)} = ${texDeg(k.def[tj]!)}$.`;
  const corr = correspondence(k);
  const match = `$\\angle A = \\angle ${LETTERS2[corr[0]!]}$, $\\angle B = \\angle ${LETTERS2[corr[1]!]}$ and $\\angle C = \\angle ${LETTERS2[corr[2]!]}$`;
  const shared = sa.find((x) => sd.includes(x))!;
  const sharedABC = LETTERS[k.abc.indexOf(shared)]!,
    sharedDEF = LETTERS2[k.def.indexOf(shared)]!;
  const image = (i: number) => LETTERS2[corr[i]!]!;
  const simTex = `$\\triangle ABC \\sim \\triangle ${image(0)}${image(1)}${image(2)}$`;
  let step2: string, step3: string;
  // The two DEF angles closest to ABC's unmatched ones, for "about the same".
  if (similar) {
    step2 =
      flaw === "one-pair"
        ? `$\\angle ${sharedABC} = \\angle ${sharedDEF} = ${texDeg(shared)}$, so one pair of angles matches, and that is enough.`
        : `So ${match}: all three pairs of angles match.`;
    step3 =
      flaw === "congruent"
        ? `Three pairs of equal angles make the triangles congruent: $\\triangle ABC \\cong \\triangle ${image(0)}${image(1)}${image(2)}$.`
        : flaw === "sides"
          ? "But the sides are different lengths, so the triangles are not similar."
          : `Three pairs of equal angles make the triangles similar: ${simTex}.`;
  } else {
    const restA = k.abc.filter((x) => x !== shared),
      restD = k.def.filter((x) => x !== shared);
    const straight = [
        [restA[0]!, restD[0]!],
        [restA[1]!, restD[1]!],
      ] as const,
      crossed = [
        [restA[0]!, restD[1]!],
        [restA[1]!, restD[0]!],
      ] as const;
    const spread = (ps: readonly (readonly [number, number])[]) =>
      Math.max(...ps.map(([x, y]) => Math.abs(x - y)));
    const pairs = spread(straight) <= spread(crossed) ? straight : crossed;
    step2 =
      flaw === "mismatch"
        ? `Both have ${deg(shared)}, ${pairs.map(([x, y]) => `${deg(x)} is about the same as ${deg(y)}`).join(", and ")}, so all three angles match.`
        : `$\\triangle ABC$ has angles ${listDeg(k.abc)}, but $\\triangle DEF$ has ${listDeg(k.def)}, so they do not all match.`;
    step3 =
      flaw === "mismatch"
        ? "Three pairs of equal angles make the triangles similar."
        : "Dilations and rigid motions keep every angle, so no sequence of them maps one onto the other: the triangles are not similar.";
  }
  const steps: [string, string, string] = [step1, step2, step3];
  const notes: [string, string, string] = [
    flaw === "arith"
      ? `$180 - ${sa[0]} - ${sa[1]} = ${k.abc[ti]}$, not ${shownThird}.`
      : `$180 - ${sa[0]} - ${sa[1]} = ${k.abc[ti]}$ and $180 - ${sd[0]} - ${sd[1]} = ${k.def[tj]}$.`,
    flaw === "one-pair"
      ? "One equal angle is not enough: the argument must compare all three angles."
      : flaw === "mismatch"
        ? "Angles that are only close are not equal. The angles do not all match."
        : similar
          ? "All three pairs of angles match."
          : "The angle lists differ, so the angles do not all match.",
    flaw === "congruent"
      ? "Equal angles give the same shape, not the same size: the triangles are similar, not congruent."
      : flaw === "sides"
        ? "Similar triangles may have sides of different lengths. Matching angles make them similar."
        : similar
          ? "Matching angles mean a dilation and rigid motions map one onto the other, so the triangles are similar."
          : "Dilations and rigid motions keep angles, so triangles with different angles are not similar.",
  ];
  const f: Flawed = { steps, flaw: position, notes };
  return finishChoice("aa-similarity-argument", seed, r, {
    prompt: `In $\\triangle ABC$, ${givenText(LETTERS, k.abc, k.shownABC)}. In $\\triangle DEF$, ${givenText(LETTERS2, k.def, k.shownDEF)}. A student argues about whether the triangles are similar. ${stepsText(steps)} In which step does the argument first go wrong?`,
    figure: twoTriangles(r, k.abc, k.def, k.shownABC, k.shownDEF),
    choices: flawChoices(f),
    keepOrder: true,
    hint: `Redo step 1 yourself: $180 - ${sa[0]} - ${sa[1]}$ for $\\triangle ABC$. Then check whether step 2 compares all three angles, and whether step 3 says similar or congruent.`,
    explanation: [
      "Two triangles are similar exactly when all three pairs of angles match. A correct argument finds each third angle, compares all three, and concludes similar, not congruent.",
      `Step 1: ${notes[0]}`,
      `Step 2: ${notes[1]}`,
      `Step 3: ${notes[2]}`,
      f.flaw === 0
        ? "Every step is correct, so the answer is No step is wrong."
        : `The first wrong step is step ${f.flaw}.`,
    ],
    variant: `flaw-${flaw}`,
  });
}

function aaSimilarityArgument(seed: string, salt: string): GeneratedProblem {
  const id = "aa-similarity-argument";
  const r = random(id, salt);
  const axes = chooseAxes(id, seed, angleArgumentAxes[id]);
  const p = axes.argument === "decide" ? aaDecide(r, seed) : aaFlaw(r, seed);
  return { ...p, variant: { id: p.variant!.id, axes: axisRecord(axes) } };
}

function aaSimilaritySelect(seed: string, salt: string): GeneratedProblem {
  const id = "aa-similarity-select";
  const r = random(id, salt);
  const axes = chooseAxes(id, seed, angleArgumentAxes[id]);
  const t = triangleAngles(r, 10);
  const abc: Angles3 = [t.A, t.B, t.C];
  const count = axes.correct === "two" ? 2 : 3;
  const pairs = shuffle(r, [
    [abc[0], abc[1]],
    [abc[0], abc[2]],
    [abc[1], abc[2]],
  ]).slice(0, count);
  const good = pairs.map(
    (p) => (r(0, 1) ? [p[0], p[1]] : [p[1], p[0]]) as [number, number],
  );
  const bad: [number, number][] = [];
  for (let guard = 0; bad.length < 5 - count && guard < 200; guard++) {
    const keep = abc[r(0, 1)]!;
    const near = abc[r(0, 2)]!;
    const x = near + r(5, 15) * (r(0, 1) ? 1 : -1);
    if (x < 20 || x > 140 || abc.includes(x) || keep + x >= 175) continue;
    const pair: [number, number] = r(0, 1) ? [keep, x] : [x, keep];
    if ([...good, ...bad].some((p) => sameSet(p, pair))) continue;
    bad.push(pair);
  }
  if (bad.length !== 5 - count)
    throw new Error("Need five different triangles");
  const items = shuffle(r, [
    ...good.map((p) => ({ p, ok: true })),
    ...bad.map((p) => ({ p, ok: false })),
  ]);
  const options = items.map((item, i) => ({
    id: `option-${"abcde"[i]}`,
    label: `A triangle with angles of ${deg(item.p[0])} and ${deg(item.p[1])}`,
  }));
  const correctIds = items.flatMap((item, i) =>
    item.ok ? [options[i]!.id] : [],
  );
  const third = 180 - abc[0] - abc[1];
  const lines = items.map((item, i) => {
    const z = 180 - item.p[0] - item.p[1];
    return `Option ${"ABCDE"[i]}: the third angle is $180 - ${item.p[0]} - ${item.p[1]} = ${z}$, so its angles are ${listDeg([item.p[0], item.p[1], z])}${item.ok ? ", the same three angles: similar." : ", not the same three: not similar."}`;
  });
  const figure = build(
    "Triangle ABC with two angle measures written",
    (() => {
      const { A, B, C } = trianglePoints(
        { A: abc[0], B: abc[1], C: abc[2] },
        false,
        6,
      );
      const pts = [A, B, C];
      const centroid: V = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
      const out: Element[] = [
        {
          type: "polygon",
          id: "t-ABC",
          points: pts.map(round),
          fill: "accent-fill",
          stroke: "ink",
          width: 2.25,
        },
      ];
      pts.forEach((v, i) => {
        out.push(
          ...angleMark(
            LETTERS[i]!,
            v,
            sector(v, pts[(i + 1) % 3]!, pts[(i + 2) % 3]!),
            {
              paint: "accent",
              r: 0.55,
              label: i === 2 ? "?" : deg(abc[i]!),
            },
          ),
          pointName(LETTERS[i]!, v, centroid),
        );
      });
      return out;
    })(),
  );
  return {
    public: {
      id: problemId(id, seed),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: `$\\triangle ABC$ has $\\angle A = ${texDeg(abc[0])}$ and $\\angle B = ${texDeg(abc[1])}$. Each choice gives two angles of another triangle. Select every triangle that must be similar to $\\triangle ABC$.`,
      skillId: metaOf(id).skillId,
      response: {
        kind: "multi-select",
        label: `Choose ${count} triangles`,
        options,
        selectionCount: count,
      },
      figure,
    },
    answer: serializeSelection(correctIds),
    hint: `First find the third angle of $\\triangle ABC$: $180 - ${abc[0]} - ${abc[1]}$. A triangle is similar to it when its three angles are the same three.`,
    explanation: [
      `Two angles fix the third: $\\angle C = 180 - ${abc[0]} - ${abc[1]} = ${third}$. So $\\triangle ABC$ has angles ${listDeg(abc)}.`,
      "A triangle is similar to $\\triangle ABC$ exactly when its three angles are those same three: a dilation and rigid motions then map one onto the other.",
      ...lines,
      "An angle that is only close to one of the three does not count: the angles must be equal.",
    ],
    variant: { id: `select-${axes.correct}`, axes: axisRecord(axes) },
  };
}

/* ------------------------------------------------------------ dispatch */

const generators: Record<
  string,
  (seed: string, salt: string) => GeneratedProblem
> = {
  "triangle-angle-argument": triangleAngleArgument,
  "triangle-angle-reasons": triangleAngleReasons,
  "parallel-angle-argument": parallelAngleArgument,
  "parallel-angle-reasons": parallelAngleReasons,
  "aa-similarity-argument": aaSimilarityArgument,
  "aa-similarity-select": aaSimilaritySelect,
};

export function generateAngleArgument(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown angle argument template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  for (let attempt = 0; attempt < 60; attempt++)
    try {
      return generate(seed, attempt ? `${seed}#${attempt}` : seed);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  throw new Error(`${templateId}: no instance for ${seed}`);
}
