import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import { figureOptionIds, type FigureChoiceOption } from "./figure-choice";
import { graph, scene as sceneOf } from "./scene/author";
import type { Element, Scene } from "./scene/spec";
import { serializeSelection } from "./selection-response";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkGrading,
} from "./structured-work";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes";

/**
 * Rigid-motion properties (8.G.A.1): verify by measuring on the coordinate
 * plane that a slide (translation), flip (reflection) or turn (rotation)
 * keeps segment lengths, keeps points on a line, keeps parallel sides
 * parallel and keeps right angles. Every length, slope and truth value is
 * computed from the integer coordinates the problem shows.
 */

const band = "6–8" as const;
const skillId = "rigid-motion-properties";
const senses = {
  image: "image-transformation",
  images: "image-transformation",
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
};
export const rigidMotionChecksTemplates: readonly TemplateMetadata[] = [
  {
    id: "rigid-motion-measure-verify",
    version: 1,
    title: "Measure before and after a slide, flip or turn",
    skillId,
    gradeBand: band,
    description:
      "Measure a segment, three points on a line, two parallel sides or a right angle on the coordinate plane before and after a translation, reflection or rotation, then choose what the measurements show the motion kept.",
    requiredResponseCapability: "structured-work-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "rigid-motion-property-claims",
    version: 1,
    title: "What must stay true after a slide, flip or turn",
    skillId,
    gradeBand: band,
    description:
      "A quadrilateral with one pair of parallel sides is translated, reflected or rotated. Select the statements about lengths, angles, parallel sides, area and the order of the corners that are true of its image.",
    requiredResponseCapability: "multi-select-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "rigid-motion-image-check",
    version: 1,
    title: "Find the figure that could be the image",
    skillId,
    gradeBand: band,
    description:
      "Choose the one graph whose quadrilateral could be the image of a parallelogram after a translation, reflection or rotation. The other graphs change one length, one angle or one pair of parallel sides.",
    requiredResponseCapability: "figure-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "rigid-motion-image-flaw",
    version: 1,
    title: "Decide whether a figure could be the image",
    skillId,
    gradeBand: band,
    description:
      "Decide whether a quadrilateral could be the image of a parallelogram after a translation, reflection or rotation, by choosing the measured fact that settles it: a length, an angle, a parallel pair, or that everything matches.",
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
];
const metaOf = (id: string) =>
  rigidMotionChecksTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------------ geometry */

export type P = readonly [number, number];
type Mirror = "x-axis" | "y-axis" | "y=x" | "y=-x";
type Turn = "ccw90" | "cw90" | "half";
export type Motion =
  | { kind: "translate"; dx: number; dy: number }
  | { kind: "reflect"; line: Mirror }
  | { kind: "rotate"; turn: Turn };
export type MotionClass = "slide" | "flip" | "turn";

const z = (n: number) => (n === 0 ? 0 : n);
/** The motion's effect on a direction (a translation leaves it alone). */
export function linear(m: Motion, [x, y]: P): P {
  if (m.kind === "translate") return [x, y];
  if (m.kind === "reflect")
    return m.line === "x-axis"
      ? [x, z(-y)]
      : m.line === "y-axis"
        ? [z(-x), y]
        : m.line === "y=x"
          ? [y, x]
          : [z(-y), z(-x)];
  return m.turn === "ccw90"
    ? [z(-y), x]
    : m.turn === "cw90"
      ? [y, z(-x)]
      : [z(-x), z(-y)];
}
/** Every center and mirror line passes through the origin. */
export const apply = (m: Motion, p: P): P =>
  m.kind === "translate" ? [p[0] + m.dx, p[1] + m.dy] : linear(m, p);
export const classOf = (m: Motion): MotionClass =>
  m.kind === "translate" ? "slide" : m.kind === "reflect" ? "flip" : "turn";
const motionNoun: Record<MotionClass, string> = {
  slide: "translation",
  flip: "reflection",
  turn: "rotation",
};
const units = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;
/** "translated 3 units right and 2 units down", "reflected over the $x$-axis". */
export function motionPhrase(m: Motion): string {
  if (m.kind === "translate") {
    const parts: string[] = [];
    if (m.dx)
      parts.push(`${units(Math.abs(m.dx))} ${m.dx > 0 ? "right" : "left"}`);
    if (m.dy)
      parts.push(`${units(Math.abs(m.dy))} ${m.dy > 0 ? "up" : "down"}`);
    return `translated ${parts.join(" and ")}`;
  }
  if (m.kind === "reflect")
    return `reflected over ${
      m.line === "x-axis"
        ? "the $x$-axis"
        : m.line === "y-axis"
          ? "the $y$-axis"
          : m.line === "y=x"
            ? "the line $y = x$"
            : "the line $y = -x$"
    }`;
  return m.turn === "half"
    ? "rotated $180^\\circ$ about the origin"
    : `rotated $90^\\circ$ ${m.turn === "ccw90" ? "counterclockwise" : "clockwise"} about the origin`;
}

const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const MIRRORS: readonly Mirror[] = ["x-axis", "y-axis", "y=x", "y=-x"];
const TURNS: readonly Turn[] = ["ccw90", "cw90", "half"];
function motionOfClass(r: Random, c: MotionClass): Motion {
  if (c === "flip") return { kind: "reflect", line: pick(r, MIRRORS) };
  if (c === "turn") return { kind: "rotate", turn: pick(r, TURNS) };
  for (;;) {
    const dx = r(-6, 6),
      dy = r(-6, 6);
    if (Math.abs(dx) + Math.abs(dy) >= 2) return { kind: "translate", dx, dy };
  }
}

const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const scale = (k: number, a: P): P => [k * a[0], k * a[1]];
export const cross = (a: P, b: P) => a[0] * b[1] - a[1] * b[0];
export const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];
export const dist2 = (a: P, b: P) => dot(sub(a, b), sub(a, b));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** A reduced fraction n/d with d > 0. */
export function reduce(n: number, d: number): [number, number] {
  if (d === 0) throw new Error("Vertical segment has no slope");
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  const s = d < 0 ? -1 : 1;
  return [z((s * n) / g), (s * d) / g];
}
const slopeOf = (a: P, b: P) => reduce(b[1] - a[1], b[0] - a[0]);
const fracTex = ([n, d]: [number, number]) =>
  d === 1 ? `${n}` : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
const fracInput = ([n, d]: [number, number]) =>
  d === 1 ? `${n}` : `${n}/${d}`;
const sameFrac = (a: [number, number], b: [number, number]) =>
  a[0] === b[0] && a[1] === b[1];
const isqrt = (n: number) => {
  const s = Math.round(Math.sqrt(n));
  return s * s === n ? s : null;
};
/** Twice the signed area: positive when the corners go counterclockwise. */
export const signedArea2 = (ps: readonly P[]) =>
  ps.reduce((s, p, i) => s + cross(p, ps[(i + 1) % ps.length]!), 0);

type Box = { x0: number; x1: number; y0: number; y1: number };
const boxOf = (ps: readonly P[]): Box => ({
  x0: Math.min(...ps.map((p) => p[0])),
  x1: Math.max(...ps.map((p) => p[0])),
  y0: Math.min(...ps.map((p) => p[1])),
  y1: Math.max(...ps.map((p) => p[1])),
});
/** Bounding boxes at least one unit apart, so both figures read clearly. */
export const apart = (a: readonly P[], b: readonly P[]) => {
  const p = boxOf(a),
    q = boxOf(b);
  return (
    q.x0 >= p.x1 + 1 || p.x0 >= q.x1 + 1 || q.y0 >= p.y1 + 1 || p.y0 >= q.y1 + 1
  );
};
const inside = (ps: readonly P[], lo: number, hi: number) =>
  ps.every(([x, y]) => x >= lo && x <= hi && y >= lo && y <= hi);

/** Place a shape (offsets from its first corner) so the original sits in
 * [−8, 8] and its image in [−10, 10], their boxes apart. The motion class is
 * fixed; a translation is redrawn on each try. */
function place(
  r: Random,
  shape: readonly P[],
  c: MotionClass,
): { orig: P[]; image: P[]; motion: Motion } | null {
  const b = boxOf(shape);
  if (b.x1 - b.x0 > 16 || b.y1 - b.y0 > 16) return null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const motion = motionOfClass(r, c);
    const ox = r(-8 - b.x0, 8 - b.x1),
      oy = r(-8 - b.y0, 8 - b.y1);
    const orig = shape.map((p) => add(p, [ox, oy]));
    const image = orig.map((p) => apply(motion, p));
    if (inside(image, -10, 10) && apart(orig, image))
      return { orig, image, motion };
  }
  return null;
}
/** A draw that cannot be used: the dispatcher redraws from a salted seed. */
function need(what: string): never {
  throw new Error(`Need ${what}`);
}

/* ------------------------------------------------------------ text */

const num = (n: number) => `${n}`;
/** "$A(1, -2)$" */
export const ptTex = (name: string, p: P) =>
  `$${name}(${num(p[0])}, ${num(p[1])})$`;
/** Plain text for screen readers: "P(1, −2)". */
const ptText = (name: string, p: P) =>
  `${name}(${String(p[0]).replace("-", "−")}, ${String(p[1]).replace("-", "−")})`;
const listTex = (names: readonly string[], ps: readonly P[]) => {
  const items = ps.map((p, i) => ptTex(names[i]!, p));
  return items.length === 2
    ? `${items[0]} and ${items[1]}`
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
};
const primed = (names: readonly string[]) => names.map((n) => `${n}'`);
const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);
/** "(4 - 1)^2 + (6 - 2)^2" style change: the differences of a segment. */
const changeOf = (a: P, b: P) => sub(b, a);

/* ------------------------------------------------------------ figures */

/** A coordinate plane around the given points, by default with the origin
 * in view (every mirror line and center of turning passes through it). */
function plane(points: readonly P[], origin = true) {
  const b = boxOf(origin ? [...points, [0, 0]] : points);
  const x: [number, number] = [b.x0 - 1, b.x1 + 1],
    y: [number, number] = [b.y0 - 1, b.y1 + 1];
  const span = Math.max(x[1] - x[0], y[1] - y[0]);
  return graph({
    x,
    y,
    grid: 1,
    tick: span > 16 ? 4 : span > 9 ? 2 : 1,
    aspect: 1,
    axisNames: ["x", "y"],
  });
}
type GraphB = ReturnType<typeof graph>;
function outline(
  g: GraphB,
  ps: readonly P[],
  names: readonly (string | false)[] | null,
  color: "accent" | "warm",
  closed: boolean,
  dash?: "dash" | "dot",
): GraphB {
  const n = ps.length;
  for (let i = 0; i < (closed ? n : n - 1); i++)
    g = g.segment([...ps[i]!], [...ps[(i + 1) % n]!], {
      color,
      ...(dash ? { dash } : {}),
    });
  if (names)
    ps.forEach((p, i) => {
      const label = names[i];
      g = g.point(p[0], p[1], label === false ? undefined : label, { color });
    });
  return g;
}
const sceneFigure = (g: GraphB, extra: Element[] = []): SemanticFigure => ({
  kind: "scene",
  scene: sceneOf(g, ...extra).build({ width: 300, maxHeight: 300 }),
});

/* ------------------------------------------------------------ assembly */

function finish(
  id: string,
  seed: string,
  built: {
    prompt: string;
    response: ProblemResponse;
    answer: string;
    hint: string;
    explanation: string[];
    figure?: SemanticFigure;
    choiceFeedback?: Record<string, string>;
    workGrading?: WorkGrading;
    variant: string;
    /** The drawn axis values (chooseAxes), saved with the instance. */
    axes: object;
  },
): GeneratedProblem {
  const meta = metaOf(id);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, meta.version, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response: built.response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer: built.answer,
    explanation: built.explanation,
    hint: built.hint,
    ...(built.choiceFeedback ? { choiceFeedback: built.choiceFeedback } : {}),
    ...(built.workGrading ? { workGrading: built.workGrading } : {}),
    variant: {
      id: built.variant,
      axes: axisRecord(built.axes as Record<string, string>),
    },
  };
}

type Claim = { label: string; correct?: true; feedback?: string };
function uniqueLabels(claims: readonly Claim[]) {
  if (
    claims.filter((c) => c.correct).length !== 1 ||
    new Set(claims.map((c) => c.label)).size !== claims.length
  )
    need("one correct claim among distinct claims");
}

/* ================================================== measure and verify */

const motionAxis = defineAxis("motion", ["slide", "flip", "turn"] as const);
export const measureAxes = {
  check: defineAxis("check", [
    "segment-length",
    "line-to-line",
    "parallel-lines",
    "right-angle",
  ] as const),
  motion: motionAxis,
} as const;
type Check = (typeof measureAxes)["check"]["values"][number];

type WorkRowSpec =
  | { label: string; kind: "number"; value: string }
  | { label: string; kind: "choice"; claims: Claim[] };

/** Rows of numbers then one claim chosen from a shuffled bank; graded field
 * by field (numbers as exact values, so 2/3 and 4/6 are the same slope). */
function measureWork(r: Random, rows: WorkRowSpec[]) {
  const choiceRows = rows.filter((x) => x.kind === "choice");
  if (choiceRows.length !== 1) need("one claim row");
  const claims = shuffle(r, [...(choiceRows[0] as { claims: Claim[] }).claims]);
  uniqueLabels(claims);
  const ids = ["a", "b", "c", "d"];
  const correctId = ids[claims.findIndex((c) => c.correct)]!;
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Your measurements",
    layout: "steps",
    mode: "build",
    banks: [
      {
        id: "claims",
        label: "What the measurements show",
        options: claims.map((c, i) => ({ id: ids[i]!, label: c.label })),
      },
    ],
    rows: rows.map((row, i) => ({
      id: `r${i + 1}`,
      label: row.label,
      fields: [
        row.kind === "number"
          ? { kind: "number" as const, label: "Number", maxLength: 8 }
          : { kind: "choice" as const, label: "Claim", bank: "claims" },
      ],
    })),
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: rows.map((row) => [
      row.kind === "number"
        ? { kind: "number" as const, value: row.value }
        : { kind: "choice" as const, accept: [correctId] },
    ]),
  };
  const answer = JSON.stringify(
    rows.map((row) => [row.kind === "number" ? row.value : correctId]),
  );
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, workGrading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Answer key is not canonical: ${answer}`);
  if (!gradeStructuredWork(response, workGrading, answer))
    throw new Error(`Answer key is not credited: ${answer}`);
  return { response, workGrading, answer };
}

const SLANTED: readonly P[] = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
];
const DIRECTIONS: readonly P[] = [
  [1, 0],
  [1, 1],
  [2, 1],
  [1, 2],
  [3, 1],
  [1, 3],
];
const AXIS_STEPS: readonly P[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const quarter = (v: P): P => [z(-v[1]), v[0]];
const signs = (r: Random, v: P): P => [
  r(0, 1) ? v[0] : z(-v[0]),
  r(0, 1) ? v[1] : z(-v[1]),
];
const smallStep = (r: Random) => pick(r, [-3, -2, -1, 1, 2, 3]);

/** An L's two legs, written for a learner: "3 across and 4 up". */
function legsText(a: P, b: P): string {
  const [dx, dy] = changeOf(a, b);
  const across = dx === 0 ? "" : `${Math.abs(dx)} ${dx > 0 ? "right" : "left"}`;
  const upDown = dy === 0 ? "" : `${Math.abs(dy)} ${dy > 0 ? "up" : "down"}`;
  return [across, upDown].filter(Boolean).join(" and ");
}
/** A length worked from coordinates, as one explanation sentence. */
function lengthStep(n1: string, n2: string, a: P, b: P): string {
  const [dx, dy] = changeOf(a, b);
  const d2 = dx * dx + dy * dy;
  const root = isqrt(d2)!;
  if (dx === 0 || dy === 0)
    return `From $${n1}$ to $${n2}$ go ${legsText(a, b)}, along one grid line, so $${n1}${n2} = ${root}$.`;
  return `From $${n1}$ to $${n2}$ go ${legsText(a, b)}. These are the legs of a right triangle, so by the Pythagorean theorem $${n1}${n2} = \\sqrt{${Math.abs(dx)}^2 + ${Math.abs(dy)}^2} = \\sqrt{${d2}} = ${root}$.`;
}
/** A slope worked from coordinates. */
function slopeStep(n1: string, n2: string, a: P, b: P): string {
  const [dx, dy] = changeOf(a, b);
  return `Slope of $${n1}${n2}$: the change in $y$ over the change in $x$ is $\\frac{${b[1]} - ${paren(a[1])}}{${b[0]} - ${paren(a[0])}} = \\frac{${dy}}{${dx}} = ${fracTex(reduce(dy, dx))}$.`;
}

function measureVerify(seed: string, salt: string): GeneratedProblem {
  const id = "rigid-motion-measure-verify";
  const axes = chooseAxes(id, seed, measureAxes);
  const r = random(id, salt);
  const check: Check = axes.check;
  const c = axes.motion;
  if (check === "segment-length") {
    const d: P = r(0, 1)
      ? signs(r, pick(r, SLANTED))
      : scale(r(3, 9), pick(r, AXIS_STEPS));
    const placed = place(r, [[0, 0], d], c) ?? need("a placement");
    const [A, B] = placed.orig as [P, P];
    const [A2, B2] = placed.image as [P, P];
    const m = placed.motion;
    const L = isqrt(dist2(A, B))!;
    const L2 = isqrt(dist2(A2, B2));
    if (L2 !== L) throw new Error("A rigid motion changed a length");
    const axis = d[0] === 0 || d[1] === 0;
    const word = motionNoun[c];
    const claims: Claim[] = [
      {
        label: `$A'B' = AB$. A ${word} keeps the length of every segment.`,
        correct: true,
      },
      {
        label: axis
          ? `They are equal only because $AB$ is ${d[1] === 0 ? "horizontal" : "vertical"}; a slanted segment would change length.`
          : `They are equal only because the legs of $AB$ are ${Math.abs(d[0])} and ${Math.abs(d[1])}; other segments would change length.`,
      },
      {
        label:
          c === "slide"
            ? "Only translations keep lengths; reflections and rotations change them."
            : c === "flip"
              ? "They are equal only because the mirror line passes through the origin."
              : "They are equal only because the turn was about the origin.",
      },
      { label: "$A'B' = AB$, so $A'B'$ is the same segment as $AB$." },
    ];
    const built = measureWork(r, [
      { label: "Length of $AB$", kind: "number", value: `${L}` },
      { label: "Length of $A'B'$", kind: "number", value: `${L}` },
      { label: "What the two lengths show", kind: "choice", claims },
    ]);
    return finish(id, seed, {
      prompt: `Segment $AB$ has endpoints ${listTex(["A", "B"], [A, B])}. It is ${motionPhrase(m)}. Its image is $A'B'$, with endpoints ${listTex(["A'", "B'"], [A2, B2])}. Measure both segments, then choose what the measurements show.`,
      ...built,
      figure: sceneFigure(
        outline(
          outline(plane([A, B, A2, B2]), [A, B], ["A", "B"], "accent", false),
          [A2, B2],
          ["A′", "B′"],
          "warm",
          false,
          "dash",
        ),
      ),
      hint: `Start at $A(${A[0]}, ${A[1]})$ and count how far right or left, and how far up or down, you go to reach $B$. Make the same count from $A'$ to $B'$. Compute each length from those counts; do not judge by eye.`,
      explanation: [
        `A rigid motion is a translation (slide), a reflection (flip) or a rotation (turn). Measure the segment before and after to see what this ${word} kept.`,
        lengthStep("A", "B", A, B),
        lengthStep("A'", "B'", A2, B2),
        `Both lengths are ${L}. The ${word} moved the segment without stretching it, like tracing paper that is lifted and set down. This is true of every segment, not only this one, and $A'B'$ is a new segment in a new place with the same length.`,
      ],
      variant: `${check}-${c}`,
      axes,
    });
  }
  if (check === "line-to-line") {
    const v: P = [smallStep(r), smallStep(r)];
    const k = r(2, 3);
    const placed = place(r, [[0, 0], v, scale(k, v)], c) ?? need("a placement");
    const [P0, Q0, R0] = placed.orig as [P, P, P];
    const [P1, Q1, R1] = placed.image as [P, P, P];
    const m = placed.motion;
    const before = slopeOf(P0, Q0);
    const s1 = slopeOf(P1, Q1),
      s2 = slopeOf(Q1, R1);
    if (!sameFrac(s1, s2)) throw new Error("Image points left their line");
    const changed = !sameFrac(before, s1);
    const claims: Claim[] = [
      {
        label:
          "The slopes are equal, so $P'$, $Q'$ and $R'$ lie on one line. The line through $P$, $Q$ and $R$ went to a line.",
        correct: true,
      },
      {
        label: changed
          ? `The slope changed from $${fracTex(before)}$ to $${fracTex(s1)}$, so the points no longer lie on one line.`
          : "The points stay on one line only because the slope did not change.",
      },
      {
        label:
          k === 2
            ? "They lie on one line only because $Q$ is the midpoint of $PR$."
            : "They lie on one line only because $QR$ is twice as long as $PQ$.",
      },
      { label: "Only a translation is sure to take a line to a line." },
    ];
    const built = measureWork(r, [
      { label: "Slope of $P'Q'$", kind: "number", value: fracInput(s1) },
      { label: "Slope of $Q'R'$", kind: "number", value: fracInput(s2) },
      { label: "What the two slopes show", kind: "choice", claims },
    ]);
    return finish(id, seed, {
      prompt: `Points ${listTex(["P", "Q", "R"], [P0, Q0, R0])} lie on one line. They are ${motionPhrase(m)}, to ${listTex(["P'", "Q'", "R'"], [P1, Q1, R1])}. Find the slopes of $P'Q'$ and $Q'R'$, then choose what they show.`,
      ...built,
      figure: sceneFigure(
        outline(
          outline(
            plane([P0, R0, P1, R1]),
            [P0, Q0, R0],
            ["P", "Q", "R"],
            "accent",
            false,
          ),
          [P1, Q1, R1],
          ["P′", "Q′", "R′"],
          "warm",
          false,
          "dash",
        ),
      ),
      hint: `Slope is the change in $y$ divided by the change in $x$. From $P'(${P1[0]}, ${P1[1]})$ to $Q'$, find both changes. Do the same from $Q'$ to $R'$, then compare the two slopes.`,
      explanation: [
        `The slope of a segment is its change in $y$ divided by its change in $x$. Three points lie on one line exactly when the slope from the first to the second equals the slope from the second to the third.`,
        slopeStep("P'", "Q'", P1, Q1),
        slopeStep("Q'", "R'", Q1, R1),
        changed
          ? `Both slopes are $${fracTex(s1)}$, so $P'$, $Q'$ and $R'$ lie on one line. The slope itself changed from $${fracTex(before)}$, because the line turned, but the line stayed a line.`
          : `Both slopes are $${fracTex(s1)}$, so $P'$, $Q'$ and $R'$ lie on one line. Here the slope is the same as before, $${fracTex(before)}$, but a turn that changed it would still keep the points on one line.`,
      ],
      variant: `${check}-${c}`,
      axes,
    });
  }
  if (check === "parallel-lines") {
    const v: P = [smallStep(r), smallStep(r)];
    const m1 = r(1, 3),
      m2 = r(1, 3);
    const w: P = [r(-4, 4), r(-4, 4)];
    if (cross(v, w) < 3) need("a wide trapezoid on the left of AB");
    const A: P = [0, 0],
      B = scale(m1, v),
      D = w,
      C = add(w, scale(m2, v));
    const placed = place(r, [A, B, C, D], c) ?? need("a placement");
    const [A0, B0, C0, D0] = placed.orig as [P, P, P, P];
    const [A1, B1, C1, D1] = placed.image as [P, P, P, P];
    const m = placed.motion;
    const s1 = slopeOf(A1, B1),
      s2 = slopeOf(D1, C1);
    if (!sameFrac(s1, s2)) throw new Error("Parallel sides lost");
    const before = slopeOf(A0, B0);
    const changed = !sameFrac(before, s1);
    const claims: Claim[] = [
      {
        label:
          "The slopes are equal, so $A'B' \\parallel D'C'$. Parallel lines went to parallel lines.",
        correct: true,
      },
      {
        label: changed
          ? "$A'B'$ and $D'C'$ are not parallel to $AB$ and $DC$, so the parallel sides were not kept."
          : "The sides stay parallel only because the slopes did not change.",
      },
      {
        label:
          "Only translations keep lines parallel; reflections and rotations break parallel sides.",
      },
      {
        label: "The slopes are equal, so $A'B'$ and $D'C'$ are the same line.",
      },
    ];
    const built = measureWork(r, [
      { label: "Slope of $A'B'$", kind: "number", value: fracInput(s1) },
      { label: "Slope of $D'C'$", kind: "number", value: fracInput(s2) },
      { label: "What the two slopes show", kind: "choice", claims },
    ]);
    const names = ["A", "B", "C", "D"];
    return finish(id, seed, {
      prompt: `In quadrilateral $ABCD$, side $AB$ is parallel to side $DC$, with ${listTex(names, [A0, B0, C0, D0])}. It is ${motionPhrase(m)}, to make $A'B'C'D'$ with ${listTex(primed(names), [A1, B1, C1, D1])}. Find the slopes of $A'B'$ and $D'C'$, then choose what they show.`,
      ...built,
      figure: sceneFigure(
        outline(
          outline(
            plane([A0, B0, C0, D0, A1, B1, C1, D1]),
            [A0, B0, C0, D0],
            names,
            "accent",
            true,
          ),
          [A1, B1, C1, D1],
          ["A′", "B′", "C′", "D′"],
          "warm",
          true,
          "dash",
        ),
      ),
      hint: `Two lines are parallel when they have the same slope. Find the change in $y$ over the change in $x$ from $A'(${A1[0]}, ${A1[1]})$ to $B'$, and from $D'$ to $C'$.`,
      explanation: [
        `Two lines on a coordinate plane are parallel (they never meet) when they have the same slope: the same change in $y$ for each change in $x$.`,
        slopeStep("A'", "B'", A1, B1),
        slopeStep("D'", "C'", D1, C1),
        `Both slopes are $${fracTex(s1)}$, so $A'B' \\parallel D'C'$: the ${motionNoun[c]} took the parallel sides $AB$ and $DC$ to parallel sides.`,
        changed
          ? `The slope changed from $${fracTex(before)}$ because the figure turned or flipped. What is kept is that the two sides stay parallel to each other, not that they stay parallel to where they were.`
          : `Here the slope is still $${fracTex(before)}$. A motion that turned the sides would change both slopes together, and they would still be parallel to each other.`,
      ],
      variant: `${check}-${c}`,
      axes,
    });
  }
  // right angle
  const axisLegs = r(0, 1) === 0;
  let dir: P = axisLegs ? [1, 0] : pick(r, DIRECTIONS.slice(1));
  for (let t = r(0, 3); t > 0; t--) dir = quarter(dir);
  const unit2 = dot(dir, dir);
  const maxK = Math.floor(8 / Math.sqrt(unit2));
  if (maxK < 1) need("legs that fit");
  const s = r(axisLegs ? 2 : 1, Math.max(axisLegs ? 2 : 1, maxK)),
    t = r(axisLegs ? 2 : 1, Math.max(axisLegs ? 2 : 1, maxK));
  if (s * s * unit2 > 64 || t * t * unit2 > 64) need("legs at most 8 long");
  const BA = scale(s, dir),
    BC = scale(t, quarter(dir));
  const placed = place(r, [BA, [0, 0], BC], c) ?? need("a placement");
  const [A0, B0, C0] = placed.orig as [P, P, P];
  const [A1, B1, C1] = placed.image as [P, P, P];
  const m = placed.motion;
  const ab = dist2(A1, B1),
    bc = dist2(B1, C1),
    ac = dist2(A1, C1);
  if (ab + bc !== ac || dot(sub(A1, B1), sub(C1, B1)) !== 0)
    throw new Error("Right angle lost");
  const legsOnGrid = dir[0] === 0 || dir[1] === 0;
  const turnText =
    m.kind === "rotate"
      ? m.turn === "half"
        ? "No. The $180^\\circ$ turn added $180^\\circ$, so $\\angle A'B'C'$ now measures $270^\\circ$."
        : "No. The $90^\\circ$ turn added $90^\\circ$, so $\\angle A'B'C'$ now measures $180^\\circ$."
      : m.kind === "reflect"
        ? "No. The flip opened the angle the other way, so $\\angle A'B'C'$ now measures $270^\\circ$."
        : "No. The slide moved $\\angle A'B'C'$ to a new place, so it is no longer a right angle.";
  const claims: Claim[] = [
    {
      label:
        "Yes. $A'B'^2 + B'C'^2 = A'C'^2$, so by the converse of the Pythagorean theorem, $\\angle A'B'C'$ is a right angle.",
      correct: true,
    },
    { label: turnText },
    {
      label: legsOnGrid
        ? "Yes, because every angle of every image is a right angle."
        : "Yes, but only because the legs lie along grid lines.",
    },
    {
      label:
        "No. $A'B' + B'C'$ is not equal to $A'C'$, so the angle is not a right angle.",
    },
  ];
  const built = measureWork(r, [
    {
      label: "$A'B'^2$, the square of the length $A'B'$",
      kind: "number",
      value: `${ab}`,
    },
    {
      label: "$B'C'^2$, the square of the length $B'C'$",
      kind: "number",
      value: `${bc}`,
    },
    {
      label: "$A'C'^2$, the square of the length $A'C'$",
      kind: "number",
      value: `${ac}`,
    },
    { label: "Is $\\angle A'B'C'$ a right angle?", kind: "choice", claims },
  ]);
  const sq = (n1: string, n2: string, a: P, b: P) => {
    const [dx, dy] = changeOf(a, b);
    return `$${n1}${n2}^2 = ${paren(dx)}^2 + ${paren(dy)}^2 = ${dx * dx + dy * dy}$`;
  };
  return finish(id, seed, {
    prompt: `Triangle $ABC$ has a right angle at $B$, with ${listTex(["A", "B", "C"], [A0, B0, C0])}. It is ${motionPhrase(m)}, to make triangle $A'B'C'$ with ${listTex(["A'", "B'", "C'"], [A1, B1, C1])}. Find the square of each side length of $A'B'C'$, then decide whether $\\angle A'B'C'$ is a right angle.`,
    ...built,
    figure: sceneFigure(
      outline(
        outline(
          plane([A0, B0, C0, A1, B1, C1]),
          [A0, B0, C0],
          ["A", "B", "C"],
          "accent",
          true,
        ),
        [A1, B1, C1],
        ["A′", "B′", "C′"],
        "warm",
        true,
        "dash",
      ),
    ),
    hint: `For each side, find the change in $x$ and the change in $y$ between its corners, starting with $A'(${A1[0]}, ${A1[1]})$ and $B'$. Square both changes and add. Then compare the two shorter results with the longest.`,
    explanation: [
      `The square of a side length is (change in $x$)$^2$ + (change in $y$)$^2$, by the Pythagorean theorem: in a right triangle, the squares of the two legs add up to the square of the longest side.`,
      `${sq("A'", "B'", A1, B1)}, ${sq("B'", "C'", B1, C1)} and ${sq("A'", "C'", A1, C1)}.`,
      `$${ab} + ${bc} = ${ac}$. The converse of the Pythagorean theorem says that when the squares of two sides add up to the square of the third, the angle across from the third side is a right angle. So $\\angle A'B'C'$ is a right angle.`,
      `The right angle at $B$ went to a right angle at $B'$. A ${motionNoun[c]} keeps every angle's measure; it does not add its own turn to the angle.`,
    ],
    variant: `${check}-${c}`,
    axes,
  });
}

/* ================================================== property claims */

export const claimsAxes = { motion: motionAxis } as const;
type Statement = { label: string; truth: boolean; row: number };

/** Angle at the middle corner, in whole degrees (45, 90 or 135 here). */
export const angleAt = (a: P, b: P, c: P) => {
  const u = sub(a, b),
    v = sub(c, b);
  return Math.round(
    (Math.atan2(Math.abs(cross(u, v)), dot(u, v)) * 180) / Math.PI,
  );
};
const parallel = (a: P, b: P, c: P, d: P) => cross(sub(b, a), sub(d, c)) === 0;

function propertyClaims(seed: string, salt: string): GeneratedProblem {
  const id = "rigid-motion-property-claims";
  const axes = chooseAxes(id, seed, claimsAxes);
  const r = random(id, salt);
  const c = axes.motion;
  const m1 = r(3, 7);
  const k = r(3, 5);
  const isParallelogram = r(1, 10) <= 4;
  const cx = isParallelogram ? 0 : pick(r, [-k, 0, k]);
  const m2 = isParallelogram ? m1 : r(2, 7);
  const A: P = [0, 0],
    B: P = [m1, 0],
    C = add(B, [cx, k]),
    D = sub(C, [m2, 0]);
  const AD = sub(D, A);
  const lengthAD = isqrt(dot(AD, AD));
  if (lengthAD === null) need("a whole-number side AD");
  if (!isParallelogram && m2 === m1)
    need("a trapezoid that is not a parallelogram");
  const placed = place(r, [A, B, C, D], c) ?? need("a placement");
  const [A0, B0, C0, D0] = placed.orig as [P, P, P, P];
  const [A1, B1, C1, D1] = placed.image as [P, P, P, P];
  const m = placed.motion;
  const angle = angleAt(A0, B0, C0);
  if (![45, 90, 135].includes(angle)) throw new Error("Unexpected angle");
  // Truth comes from the image's coordinates.
  const imageAD = Math.sqrt(dist2(A1, D1));
  const imageAngle = angleAt(A1, B1, C1);
  const imageAngleC = angleAt(B1, C1, D1);
  const taxicab = Math.abs(AD[0]) + Math.abs(AD[1]);
  const lengthRow: Statement =
    AD[0] !== 0 && AD[1] !== 0
      ? { label: `$A'D' = ${taxicab}$`, truth: imageAD === taxicab, row: 2 }
      : (() => {
          const off = m1 + (r(0, 1) ? 1 : -1);
          return {
            label: `$A'B' = ${off}$`,
            truth: Math.sqrt(dist2(A1, B1)) === off,
            row: 2,
          };
        })();
  let wrongAngle: Statement;
  if (m.kind === "reflect")
    wrongAngle =
      angle === 90
        ? { label: "$m\\angle A'B'C' = 270^\\circ$", truth: false, row: 4 }
        : {
            label: `$m\\angle A'B'C' = ${180 - angle}^\\circ$`,
            truth: imageAngle === 180 - angle,
            row: 4,
          };
  else if (m.kind === "rotate" && m.turn !== "half") {
    const v = pick(
      r,
      [angle + 90, angle - 90].filter((x) => x > 0),
    );
    wrongAngle = {
      label: `$m\\angle A'B'C' = ${v}^\\circ$`,
      truth: imageAngle === v,
      row: 4,
    };
  } else
    wrongAngle =
      angle === 90
        ? { label: "$m\\angle A'B'C' = 180^\\circ$", truth: false, row: 4 }
        : {
            label: `$m\\angle B'C'D' = ${angle}^\\circ$`,
            truth: imageAngleC === angle,
            row: 4,
          };
  const always: Statement[] = [
    { label: `$A'D' = ${lengthAD}$`, truth: imageAD === lengthAD, row: 1 },
    lengthRow,
    {
      label: `$m\\angle A'B'C' = ${angle}^\\circ$`,
      truth: imageAngle === angle,
      row: 3,
    },
    wrongAngle,
    {
      label: "$A'B' \\parallel D'C'$",
      truth: parallel(A1, B1, D1, C1),
      row: 5,
    },
  ];
  const extras: Statement[] = [
    {
      label: "$A'D' \\parallel B'C'$",
      truth: parallel(A1, D1, B1, C1),
      row: 6,
    },
    { label: "$A'B' \\parallel AB$", truth: parallel(A1, B1, A0, B0), row: 7 },
    {
      label:
        "Going $A' \\to B' \\to C' \\to D'$ turns the same way as going $A \\to B \\to C \\to D$",
      truth:
        Math.sign(signedArea2([A1, B1, C1, D1])) ===
        Math.sign(signedArea2([A0, B0, C0, D0])),
      row: 8,
    },
    {
      label: "$A'B'C'D'$ has the same area as $ABCD$",
      truth:
        Math.abs(signedArea2([A1, B1, C1, D1])) ===
        Math.abs(signedArea2([A0, B0, C0, D0])),
      row: 9,
    },
  ];
  // Six statements: rows 1–5 and one motion-dependent or area row (the spec
  // lists five fixed rows plus two extras, which would make seven).
  const chosen = r(1, 10) <= 3 ? extras[3]! : pick(r, extras.slice(0, 3));
  const all = shuffle(r, [...always, chosen]);
  const trueCount = all.filter((s) => s.truth).length;
  if (trueCount < 2 || trueCount > 4) need("two to four true statements");
  const optionIds = [
    "option-a",
    "option-b",
    "option-c",
    "option-d",
    "option-e",
    "option-f",
  ];
  const response: ProblemResponse = {
    kind: "multi-select",
    label: `Choose ${trueCount} true statements`,
    options: all.map((s, i) => ({ id: optionIds[i]!, label: s.label })),
    selectionCount: trueCount,
  };
  const answer = serializeSelection(
    all.flatMap((s, i) => (s.truth ? [optionIds[i]!] : [])),
  );
  const names = ["A", "B", "C", "D"];
  // The marked angle at B: from ray BC around to ray BA (which points left).
  const toC = (Math.atan2(C0[1] - B0[1], C0[0] - B0[0]) * 180) / Math.PI;
  const mid = ((toC + 180) / 2) * (Math.PI / 180);
  const arc: Element = {
    type: "arc",
    center: [B0[0], B0[1]],
    r: 0.8,
    from: toC,
    to: 180,
    stroke: "ink",
    width: 1.5,
  };
  const mark: Element = {
    type: "text",
    at: [B0[0] + 1.7 * Math.cos(mid), B0[1] + 1.7 * Math.sin(mid)],
    text: `${angle}°`,
    size: "sm",
    halo: true,
  };
  const figure = sceneFigure(
    outline(
      outline(
        plane([A0, B0, C0, D0, A1, B1, C1, D1]),
        [A0, B0, C0, D0],
        names,
        "accent",
        true,
      ),
      [A1, B1, C1, D1],
      ["A′", "B′", "C′", "D′"],
      "warm",
      true,
      "dash",
    ),
    [arc, mark],
  );
  const word = motionNoun[c];
  const why = (s: Statement): string => {
    switch (s.row) {
      case 1:
        return `${s.label} is true: a ${word} keeps every length, and $AD = ${lengthAD}$ (from $A$ to $D$ go ${legsText(A0, D0)}).`;
      case 2:
        return `${s.label} is false: ${AD[0] !== 0 && AD[1] !== 0 ? `${taxicab} adds the two legs; by the Pythagorean theorem $A'D' = ${lengthAD}$.` : `$A'B' = AB = ${m1}$, and a ${word} never changes a length.`}`;
      case 3:
        return `${s.label} is true: a ${word} keeps every angle's measure.`;
      case 4:
        return s.label.includes("B'C'D'")
          ? `${s.label} is false: that is the angle at $C'$, not at $B'$. Because $AB \\parallel DC$, the angles at $B$ and $C$ add to $180^\\circ$, so $m\\angle B'C'D' = ${180 - angle}^\\circ$.`
          : `${s.label} is false: a ${word} does not add its own turn to an angle or open it the other way. The angle at $B'$ still measures $${angle}^\\circ$.`;
      case 5:
        return `${s.label} is true: $AB$ and $DC$ are parallel, and a ${word} keeps parallel lines parallel to each other.`;
      case 6:
        return s.truth
          ? `${s.label} is true: $ABCD$ is a parallelogram, so $AD \\parallel BC$, and that pair stays parallel.`
          : `${s.label} is false: $AD$ and $BC$ were not parallel (only one pair of sides of $ABCD$ is parallel), and a ${word} does not make them parallel.`;
      case 7:
        return s.truth
          ? `${s.label} is true here: $AB$ is horizontal, and this ${word} leaves $A'B'$ horizontal too.`
          : `${s.label} is false: this ${word} turns $AB$, which is horizontal, so that $A'B'$ is vertical. Parallel to each other is kept; parallel to where it was is not.`;
      case 8:
        return s.truth
          ? `${s.label} is true: only a reflection reverses the order the corners go around.`
          : `${s.label} is false: a reflection reverses the order, so the letters go around the other way.`;
      default:
        return `${s.label} is true: a ${word} keeps every length and angle, so the area stays the same.`;
    }
  };
  return finish(id, seed, {
    prompt: `Quadrilateral $ABCD$ has $AB \\parallel DC$, with ${listTex(names, [A0, B0, C0, D0])}, and $m\\angle ABC = ${angle}^\\circ$. It is ${motionPhrase(m)}, to make $A'B'C'D'$ with ${listTex(primed(names), [A1, B1, C1, D1])}. Which statements are true?`,
    response,
    answer,
    figure,
    hint: `A ${word} cannot change a length, an angle's measure or whether two lines are parallel. Check every other claim with the coordinates: for example, find $A'D'$ from $A'(${A1[0]}, ${A1[1]})$ and $D'$.`,
    explanation: [
      `A rigid motion, such as this ${word}, keeps every length, every angle's measure and every pair of parallel lines. Slopes, positions and the order the corners go around can change, so check those with the coordinates.`,
      ...all.map(why),
    ],
    variant: c,
    axes,
  });
}

/* ================================================== image check */

const W: readonly P[] = [
  [0, 5],
  [3, 4],
  [-3, 4],
  [4, 3],
  [-4, 3],
];
export type Candidate = "image" | "angle" | "length" | "parallel";
export const imageCheckAxes = {
  motion: defineAxis("motion", ["slide", "flip", "turn"] as const, {
    weights: [5, 9, 6],
  }),
} as const;
export const imageFlawAxes = {
  candidate: defineAxis("candidate", [
    "image",
    "angle",
    "length",
    "parallel",
  ] as const),
  motion: motionAxis,
} as const;

/** Sorted squared sides then sorted squared diagonals: equal for congruent
 * quadrilaterals with corresponding corners in order. */
export const signature = (q: readonly P[]) => {
  const sides = q
    .map((p, i) => dist2(p, q[(i + 1) % 4]!))
    .sort((a, b) => a - b);
  const diagonals = [dist2(q[0]!, q[2]!), dist2(q[1]!, q[3]!)].sort(
    (a, b) => a - b,
  );
  return JSON.stringify([sides, diagonals]);
};

interface Parallelograms {
  orig: P[];
  motion: Motion;
  a: number;
  a2: number;
  w: P;
  w2: P;
  candidates: Record<Candidate, P[]>;
}
function parallelograms(r: Random, c: MotionClass): Parallelograms {
  const a = r(4, 8);
  const w = pick(r, W);
  const w2 = pick(
    r,
    W.filter((v) => Math.abs(v[0]) !== Math.abs(w[0])),
  );
  const a2 = a + (r(0, 1) ? 1 : -1);
  const shape: P[] = [[0, 0], [a, 0], [a + w[0], w[1]], w];
  const placed = place(r, shape, c) ?? need("a placement");
  const m = placed.motion;
  const L = (v: P) => linear(m, v);
  const [P1] = placed.image as [P];
  const build = (side: number, leg: P): P[] => {
    const q = add(P1, L([side, 0]));
    return [P1, q, add(q, L(leg)), add(P1, L(leg))];
  };
  const candidates: Record<Candidate, P[]> = {
    image: placed.image,
    angle: build(a, w2),
    length: build(a2, w),
    parallel: [
      placed.image[0]!,
      placed.image[1]!,
      add(placed.image[2]!, L([0, 1])),
      placed.image[3]!,
    ],
  };
  for (const q of Object.values(candidates))
    if (!inside(q, -10, 10) || !apart(placed.orig, q))
      need("candidates that fit beside ABCD");
  const sigs = Object.values(candidates).map(signature);
  if (new Set(sigs).size !== 4) need("four different candidates");
  const original = signature(placed.orig);
  for (const kind of ["angle", "length", "parallel"] as const)
    if (signature(candidates[kind]) === original)
      need("decoys that are not congruent");
  if (signature(candidates.image) !== original)
    throw new Error("The image is not congruent");
  return { orig: placed.orig, motion: m, a, a2, w, w2, candidates };
}
const vecTex = (v: P) => `(${v[0]}, ${v[1]})`;
const isRight = (q: readonly P[]) =>
  dot(sub(q[1]!, q[0]!), sub(q[3]!, q[0]!)) === 0;
const turnsSameWay = (p: readonly P[], q: readonly P[]) =>
  Math.sign(signedArea2(p)) === Math.sign(signedArea2(q));

/** One line per candidate: the first measurement that rules it out, or why it matches. */
function verdict(set: Parallelograms, q: readonly P[], who: string): string {
  const [, B, , D] = set.orig as [P, P, P, P];
  const pq = Math.sqrt(dist2(q[0]!, q[1]!));
  if (pq !== set.a)
    return `${who}: $PQ = ${pq}$ but $AB = ${set.a}$, so a length changed.`;
  const ps = sub(q[3]!, q[0]!),
    sr = sub(q[2]!, q[3]!);
  const pqv = sub(q[1]!, q[0]!);
  if (cross(pqv, sr) !== 0)
    return `${who}: from $P$ to $Q$ the change is $${vecTex(pqv)}$, but from $S$ to $R$ it is $${vecTex(sr)}$. These do not point the same way, so $SR$ is not parallel to $PQ$, though $DC \\parallel AB$.`;
  const qs = dist2(q[1]!, q[3]!),
    bd = dist2(B, D);
  if (qs !== bd)
    return `${who}: $PQ = ${set.a}$ and $PS = ${Math.sqrt(dot(ps, ps))}$ match $AB$ and $AD$, but $QS^2 = ${qs}$ while $BD^2 = ${bd}$, so the angle at $P$ differs from the angle at $A$.`;
  const flipped = !turnsSameWay(set.orig, q);
  return `${who}: $PQ = ${set.a}$, $PS = ${Math.sqrt(dot(ps, ps))}$, $PQ \\parallel SR$ and $QS^2 = BD^2 = ${bd}$, so every length, angle and parallel pair matches $ABCD$.${flipped ? " It is a mirror image: the letters go around the other way, and a reflection is still a rigid motion." : ""}`;
}

function imageCheck(seed: string, salt: string): GeneratedProblem {
  const id = "rigid-motion-image-check";
  const axes = chooseAxes(id, seed, imageCheckAxes);
  const r = random(id, salt);
  const set = parallelograms(r, axes.motion);
  const kinds = shuffle(r, [
    "image",
    "angle",
    "length",
    "parallel",
  ] as Candidate[]);
  const names = ["A", "B", "C", "D"];
  // Each card is fitted to its own quadrilateral so the grid stays readable.
  const options: FigureChoiceOption[] = kinds.map((k, i) => {
    const q = set.candidates[k];
    const g = outline(plane(q, false), q, ["P", "Q", "R", "S"], "warm", true);
    return {
      id: figureOptionIds[i]!,
      label: `Quadrilateral PQRS with corners ${ptText("P", q[0]!)}, ${ptText("Q", q[1]!)}, ${ptText("R", q[2]!)} and ${ptText("S", q[3]!)}.`,
      scene: sceneOf(g).build({ width: 280, maxHeight: 280 }),
    };
  });
  const letter = (i: number) => "ABCD"[i]!;
  const correct = kinds.indexOf("image");
  const answer = figureOptionIds[correct]!;
  const feedback: Record<Candidate, string> = {
    image: "",
    length: `That figure has a side of length ${set.a2}, but $AB = ${set.a}$. A slide, flip or turn keeps every length.`,
    parallel:
      "One corner of that figure moved: its side $SR$ is not parallel to $PQ$, but $DC$ is parallel to $AB$. A slide, flip or turn keeps parallel sides parallel.",
    angle:
      "That figure has the right side lengths, but its diagonal $QS$ is not as long as $BD$, so its angles differ from those of $ABCD$. A slide, flip or turn keeps every angle.",
  };
  const choiceFeedback = Object.fromEntries(
    kinds.flatMap((k, i): [string, string][] =>
      k === "image" ? [] : [[figureOptionIds[i]!, feedback[k]]],
    ),
  );
  const [A, B, C, D] = set.orig as [P, P, P, P];
  return finish(id, seed, {
    prompt: `Parallelogram $ABCD$ has ${listTex(names, [A, B, C, D])}. Exactly one graph shows a quadrilateral $PQRS$ that could be the image of $ABCD$ after a slide, flip or turn, with $P$, $Q$, $R$ and $S$ the images of $A$, $B$, $C$ and $D$. Which graph is it?`,
    response: {
      kind: "figure-choice",
      label: "Choose the graph",
      noun: "Graph",
      options,
    },
    answer,
    choiceFeedback,
    figure: sceneFigure(
      outline(plane(set.orig, false), set.orig, names, "accent", true),
    ),
    hint: `Do not trust your eye. $AB$ runs from $A(${A[0]}, ${A[1]})$ to $B(${B[0]}, ${B[1]})$; compare its length with $PQ$ in each graph. Then check that $SR$ is parallel to $PQ$, and compare the diagonal $QS$ with $BD$.`,
    explanation: [
      `A slide, flip or turn keeps every length, every angle and every pair of parallel sides. In $ABCD$, $AB = ${set.a}$, $AD = 5$, $AB \\parallel DC$ and $BD^2 = ${dist2(B, D)}$. A diagonal joins opposite corners; when the sides match, it pins down the angles.`,
      ...kinds.map((k, i) =>
        verdict(set, set.candidates[k], `Graph ${letter(i)}`),
      ),
      `Only one quadrilateral keeps every length, angle and parallel pair of $ABCD$, so it is the only one that could be the image.`,
    ],
    variant: axes.motion,
    axes,
  });
}

function imageFlaw(seed: string, salt: string): GeneratedProblem {
  const id = "rigid-motion-image-flaw";
  const axes = chooseAxes(id, seed, imageFlawAxes);
  const r = random(id, salt);
  const set = parallelograms(r, axes.motion);
  const kind: Candidate = axes.candidate;
  const q = set.candidates[kind];
  const [A, B, C, D] = set.orig as [P, P, P, P];
  const angleDecoy = set.candidates.angle;
  const rightForm = (set.w[0] === 0) !== (set.w2[0] === 0);
  const actual = {
    pq: Math.sqrt(dist2(q[0]!, q[1]!)),
    qs: dist2(q[1]!, q[3]!),
    srParallel: cross(sub(q[1]!, q[0]!), sub(q[2]!, q[3]!)) === 0,
    right: isRight(q),
  };
  const bd = dist2(B, D);
  const claims: (Claim & { truth: boolean })[] = [
    {
      label: `No. $PQ = ${set.a2}$ but $AB = ${set.a}$.`,
      truth: actual.pq === set.a2,
    },
    rightForm
      ? set.w2[0] === 0
        ? {
            label:
              "No. $\\angle SPQ$ is a right angle but $\\angle DAB$ is not.",
            truth: actual.right && !isRight(set.orig),
          }
        : {
            label:
              "No. $\\angle SPQ$ is not a right angle but $\\angle DAB$ is.",
            truth: !actual.right && isRight(set.orig),
          }
      : {
          label: `No. $PQ$ and $PS$ match $AB$ and $AD$, but $QS^2 = ${dist2(angleDecoy[1]!, angleDecoy[3]!)}$ while $BD^2 = ${bd}$.`,
          truth:
            actual.pq === set.a &&
            dist2(q[0]!, q[3]!) === 25 &&
            actual.qs === dist2(angleDecoy[1]!, angleDecoy[3]!) &&
            actual.qs !== bd,
        },
    { label: "No. $SR$ is not parallel to $PQ$.", truth: !actual.srParallel },
    {
      label:
        "Yes. Every side length, every angle and every parallel pair of $ABCD$ matches $PQRS$.",
      truth: signature(q) === signature(set.orig),
    },
  ];
  if (claims.filter((x) => x.truth).length !== 1)
    need("exactly one true statement");
  const wanted: Record<Candidate, number> = {
    length: 0,
    angle: 1,
    parallel: 2,
    image: 3,
  };
  if (!claims[wanted[kind]]!.truth) throw new Error("Wrong statement is true");
  const order = shuffle(r, [0, 1, 2, 3]);
  const ids = ["option-a", "option-b", "option-c", "option-d"];
  const why = [
    `Measure $PQ$: it is ${actual.pq}, not ${set.a2}. Compare it with $AB = ${set.a}$.`,
    rightForm
      ? `Check the corner at $P$ against the corner at $A$: ${actual.right ? "$\\angle SPQ$ is a right angle" : "$\\angle SPQ$ is not a right angle"}, and ${isRight(set.orig) ? "$\\angle DAB$ is one too" : "$\\angle DAB$ is not one either"}.`
      : `Compute $QS^2$ from the coordinates: it is ${actual.qs}, not ${dist2(angleDecoy[1]!, angleDecoy[3]!)}.`,
    `Compare the changes from $P$ to $Q$ and from $S$ to $R$: they point the same way, so $SR$ is parallel to $PQ$.`,
    kind === "length"
      ? `Not everything matches: $PQ = ${actual.pq}$ but $AB = ${set.a}$.`
      : kind === "parallel"
        ? "Not everything matches: $SR$ is not parallel to $PQ$, but $DC$ is parallel to $AB$."
        : `Not everything matches: $QS^2 = ${actual.qs}$ but $BD^2 = ${bd}$, so the angle at $P$ is not the angle at $A$.`,
  ];
  const options = order.map((i, j) => ({
    id: ids[j]!,
    label: claims[i]!.label,
  }));
  const answer = ids[order.indexOf(wanted[kind])]!;
  const choiceFeedback = Object.fromEntries(
    order.flatMap((i, j): [string, string][] =>
      i === wanted[kind] ? [] : [[ids[j]!, why[i]!]],
    ),
  );
  const names = ["A", "B", "C", "D"];
  const figure = sceneFigure(
    outline(
      outline(plane([...set.orig, ...q]), set.orig, names, "accent", true),
      q,
      ["P", "Q", "R", "S"],
      "warm",
      true,
    ),
  );
  return finish(id, seed, {
    prompt: `Parallelogram $ABCD$ has ${listTex(names, [A, B, C, D])}. Quadrilateral $PQRS$ has ${listTex(["P", "Q", "R", "S"], q)}. Could $PQRS$ be the image of $ABCD$ after a slide, flip or turn, with $P$, $Q$, $R$ and $S$ the images of $A$, $B$, $C$ and $D$? Choose the statement that settles it.`,
    response: { kind: "choice", label: "Choose one statement", options },
    answer,
    choiceFeedback,
    figure,
    hint: `Measure, do not eyeball. Find $AB$ from $A(${A[0]}, ${A[1]})$ to $B(${B[0]}, ${B[1]})$ and $PQ$ from $P(${q[0]![0]}, ${q[0]![1]})$ to $Q$. Then check one angle and one parallel pair.`,
    explanation: [
      `A slide, flip or turn keeps every length, every angle and every pair of parallel sides. In $ABCD$: $AB = ${set.a}$, $AD = 5$, $DC \\parallel AB$ and $BD^2 = ${bd}$ (the diagonal from $B$ to $D$).`,
      verdict(set, q, "$PQRS$"),
      kind === "image"
        ? "So $PQRS$ could be the image: the statement that everything matches is the true one."
        : `So $PQRS$ cannot be the image, and the statement that names this mismatch settles it.`,
      ...[0, 1, 2, 3]
        .filter((i) => i !== wanted[kind])
        .map(
          (i) =>
            `${["The length statement", "The angle statement", "The parallel statement", "The statement that everything matches"][i]} is false here. ${why[i]}`,
        ),
    ],
    variant: `${kind}-${axes.motion}`,
    axes,
  });
}

/* ------------------------------------------------------------ dispatch */

const generators: Record<
  string,
  (seed: string, salt: string) => GeneratedProblem
> = {
  "rigid-motion-measure-verify": measureVerify,
  "rigid-motion-property-claims": propertyClaims,
  "rigid-motion-image-check": imageCheck,
  "rigid-motion-image-flaw": imageFlaw,
};
export const rigidMotionChecksAxes = {
  "rigid-motion-measure-verify": measureAxes,
  "rigid-motion-property-claims": claimsAxes,
  "rigid-motion-image-check": imageCheckAxes,
  "rigid-motion-image-flaw": imageFlawAxes,
} as const;

export function generateRigidMotionChecks(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate) throw new Error(`Unknown rigid-motion template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  for (let attempt = 0; attempt < 200; attempt++)
    try {
      return generate(seed, attempt ? `${seed}#${attempt}` : seed);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  throw new Error(`${templateId}: no instance for ${seed}`);
}
export type { Scene };
