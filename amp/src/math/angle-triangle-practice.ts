import { article } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";

type Random = (low: number, high: number) => number;
type Case = {
  prompt: string;
  answer: string;
  figure?: SemanticFigure;
  response: ProblemResponse;
  explanation: string[];
  choiceFeedback?: Record<string, string>;
  tags: string[];
};

const choice = { requiredResponseCapability: "single-choice-v1" as const };
export const angleTriangleTemplates: readonly TemplateMetadata[] = [
  {
    id: "angle-pair-measure",
    version: 1,
    title: "Find an unknown angle",
    skillId: "angle-relationships",
    gradeBand: "6–8",
    description:
      "Find an unknown angle from a straight angle, a right angle, vertical angles or a full turn.",
  },
  {
    id: "angle-equation",
    version: 1,
    title: "Write and solve an angle equation",
    skillId: "angle-relationships",
    gradeBand: "6–8",
    description:
      "Write an equation from an angle relationship and solve it for the unknown, or for an angle's measure.",
  },
  {
    id: "triangle-angle-sum",
    version: 1,
    title: "Angles of a triangle",
    skillId: "triangle-angle-theorems",
    gradeBand: "6–8",
    description:
      "Use the 180° angle sum of a triangle to find an unknown angle or the value of $x$.",
  },
  {
    id: "triangle-exterior-angle",
    version: 1,
    title: "Exterior angle of a triangle",
    skillId: "triangle-angle-theorems",
    gradeBand: "6–8",
    description:
      "Use the fact that an exterior angle equals the sum of the two remote interior angles.",
  },
  {
    id: "parallel-lines-angle",
    version: 1,
    title: "Parallel lines and a transversal",
    skillId: "triangle-angle-theorems",
    gradeBand: "6–8",
    description:
      "Find an angle where a transversal crosses two parallel lines, using equal and supplementary pairs.",
  },
  {
    id: "triangle-side-test",
    version: 1,
    title: "Which lengths make a triangle",
    skillId: "triangle-construction",
    gradeBand: "6–8",
    description:
      "Choose the set of three lengths that satisfies the triangle inequality.",
    ...choice,
  },
  {
    id: "triangle-third-side",
    version: 1,
    title: "Possible third sides",
    skillId: "triangle-construction",
    gradeBand: "6–8",
    description:
      "Find the greatest, least or number of whole-number lengths for a triangle's third side.",
  },
  {
    id: "triangle-conditions",
    version: 1,
    title: "Conditions that determine a triangle",
    skillId: "triangle-construction",
    gradeBand: "6–8",
    description:
      "Decide whether given sides and angles determine exactly one triangle, more than one, or none.",
    ...choice,
  },
  {
    id: "cross-section-shape",
    version: 1,
    title: "Name a cross-section",
    skillId: "solid-cross-sections",
    gradeBand: "6–8",
    description:
      "Name the shape where a plane slices a right rectangular prism or pyramid.",
    ...choice,
  },
  {
    id: "cross-section-area",
    version: 1,
    title: "Area of a cross-section",
    skillId: "solid-cross-sections",
    gradeBand: "6–8",
    description:
      "Find the area of a plane section of a right rectangular prism or pyramid from its dimensions.",
  },
];

const hints: Record<string, string> = {
  "angle-pair-measure":
    "Name the whole angle the parts fill: a straight line is 180°, a right angle is 90° and a full turn is 360°. Vertical angles are equal. Subtract the known part from the whole.",
  "angle-equation":
    "Write one equation from the relationship: the parts of a straight angle add to 180°, the parts of a right angle add to 90°, adjacent parts add to the whole angle, and vertical angles are equal. Then solve for $x$.",
  "triangle-angle-sum":
    "The three angles of every triangle add to 180°. Write that sum with the given measures and solve for the unknown.",
  "triangle-exterior-angle":
    "The exterior angle and the interior angle beside it form a straight line, so the exterior angle equals the sum of the other two interior angles.",
  "parallel-lines-angle":
    "Slide one crossing along the transversal onto the other: the four angles match. Angles in matching positions are equal; an angle and its neighbor along a line add to 180°.",
  "triangle-side-test":
    "In each set, add the two shorter lengths and compare the sum with the longest. A triangle exists only when the sum is greater.",
  "triangle-third-side":
    "The third side must be shorter than the sum of the other two and longer than their difference.",
  "triangle-conditions":
    "Ask whether the conditions fix the size as well as the shape. Three angles fix only the shape. Check impossible conditions first: angles that add to 180° or more, or two sides that cannot reach across the third.",
  "cross-section-shape":
    "Picture the plane cutting each face it crosses. Each face it meets gives one straight side of the section; count those sides and compare their lengths and directions.",
  "cross-section-area":
    "Find the two dimensions of the section: a slice parallel to a face copies that face. Then use the area formula for the section's shape.",
};

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
function shuffle<T>(r: Random, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = r(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
const norm = (d: number) => ((d % 360) + 360) % 360;

/** "3x + 12" with a typographic minus; coefficient 1 is written x. */
export function linear(a: number, b: number) {
  const ax = a === 1 ? "x" : `${a}x`;
  return b === 0 ? ax : `${ax} ${b < 0 ? "−" : "+"} ${Math.abs(b)}`;
}
/** An angle label: "(3x + 12)°", "4x°" or "57°". */
export const angleLabel = (a: number, b: number) =>
  a === 0 ? `${b}°` : b === 0 ? `${linear(a, b)}°` : `(${linear(a, b)})°`;
const signed = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);
/** A number with a typographic minus. */
const num = (n: number) => (n < 0 ? `−${-n}` : String(n));
/** "3(14) + 12 = 54" for a substitution check. */
const substitute = (a: number, b: number, x: number) =>
  `${a === 1 ? x : `${a}(${x})`}${b === 0 ? "" : ` ${signed(b)}`} = ${a * x + b}`;

/** A linear expression with value `v` at x: coefficient 1–5, constant within ±60. */
function expressionFor(r: Random, x: number, v: number, avoid?: number) {
  for (let tries = 0; tries < 50; tries++) {
    const a = r(1, 5);
    if (a === avoid) continue;
    const b = v - a * x;
    if (Math.abs(b) <= 60) return { a, b };
  }
  return { a: avoid === 1 ? 2 : 1, b: v - (avoid === 1 ? 2 : 1) * x };
}
/** Solve a·x + c = d for x, showing each inverse operation. */
function solveSteps(a: number, c: number, d: number, x: number): string[] {
  const steps: string[] = [];
  const left = c === 0 ? linear(a, 0) : `${linear(a, 0)} ${signed(c)}`;
  steps.push(`Combine like terms: ${left} = ${d}.`);
  if (c !== 0)
    steps.push(
      `${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)} ${c > 0 ? "from" : "to"} both sides: ${linear(a, 0)} = ${num(d - c)}.`,
    );
  if (a !== 1) steps.push(`Divide both sides by ${a}: x = ${(d - c) / a}.`);
  if (a === 1 && c === 0) steps[0] = `So x = ${x}.`;
  return steps;
}

const raySets = [
  ["A", "B", "C", "D"],
  ["E", "F", "G", "H"],
  ["J", "K", "L", "M"],
  ["R", "S", "T", "U"],
] as const;
const vertices = ["O", "P", "Q", "V"] as const;

// ——— Angle relationships ———

type RayFigure = Extract<SemanticFigure, { kind: "angle-rays" }>;
type PairSetup = {
  figure: Omit<RayFigure, "marks">;
  /** Ray index pairs (counterclockwise) with their true measures. */
  name: (from: number, to: number) => string;
};
function rays(
  r: Random,
  directions: number[],
): PairSetup & { letters: string[]; O: string } {
  const letters = [...pick(r, raySets)].slice(0, directions.length);
  const O = pick(r, vertices);
  const turn = r(0, 2) === 0 ? r(1, 35) * 10 : 0;
  const figure = {
    kind: "angle-rays" as const,
    rays: directions.map((d) => norm(d + turn)),
    vertex: O,
    points: letters,
  };
  return {
    figure,
    letters,
    O,
    name: (from, to) => `$\\angle ${letters[from]}${O}${letters[to]}$`,
  };
}

function anglePairCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 0 || mode === 1) {
    // Straight or right angle split by one interior ray.
    const whole = mode === 0 ? 180 : 90;
    const theta = mode === 0 ? r(20, 160) : r(15, 75);
    if (mode === 0 && theta === 90) return anglePairCase(r);
    // Rays: 0 = end of the whole angle, 1 = interior ray, 2 = other end.
    const s = rays(r, [0, theta, whole]);
    const [P, Q, R] = s.letters as [string, string, string];
    const knownFirst = r(0, 1) === 0;
    const known = knownFirst ? whole - theta : theta,
      unknown = whole - known;
    const knownName = knownFirst ? s.name(1, 2) : s.name(0, 1),
      unknownName = knownFirst ? s.name(0, 1) : s.name(1, 2);
    const marks: RayFigure["marks"] = [
      { from: 0, to: 1, label: knownFirst ? "?" : `${known}°` },
      { from: 1, to: 2, label: knownFirst ? `${known}°` : "?" },
    ];
    if (mode === 1)
      marks.unshift({ from: 0, to: 2, label: "90°", right: true });
    const setup =
      mode === 0
        ? `Points $${R}$, $${s.O}$ and $${P}$ lie on a straight line, and ray $${s.O}${Q}$ is drawn from $${s.O}$.`
        : `$\\angle ${P}${s.O}${R}$ is a right angle, and ray $${s.O}${Q}$ lies inside it.`;
    return {
      prompt: `${setup} ${knownName} measures ${known}°. What is the measure of ${unknownName}, in degrees?`,
      answer: String(unknown),
      figure: { ...s.figure, marks },
      response: { kind: "number", label: "Angle measure in degrees" },
      explanation: [
        mode === 0
          ? `$${R}$, $${s.O}$ and $${P}$ lie on a line, so $\\angle ${P}${s.O}${R}$ is a straight angle: 180°. Ray $${s.O}${Q}$ splits it into ${knownName} and ${unknownName}, which do not overlap.`
          : `$\\angle ${P}${s.O}${R}$ is a right angle: 90°. Ray $${s.O}${Q}$ splits it into ${knownName} and ${unknownName}, which do not overlap.`,
        `Adjacent parts add to the whole: ${known}° + ${unknownName} = ${whole}°.`,
        `Subtract: ${unknownName} = ${whole}° − ${known}° = ${unknown}°.`,
        mode === 0
          ? `The two angles are supplementary: ${known}° + ${unknown}° = 180°.`
          : `The two angles are complementary: ${known}° + ${unknown}° = 90°.`,
      ],
      tags: [mode === 0 ? "straight" : "right"],
    };
  }
  if (mode === 2) {
    // Two lines crossing: rays at 0 and theta, and their opposites.
    const theta = r(20, 160);
    if (theta === 90) return anglePairCase(r);
    const s = rays(r, [0, theta, 180, theta + 180]);
    const [P, Q, R, S] = s.letters as [string, string, string, string];
    const start = r(0, 3);
    const measure = (i: number) => (i % 2 === 0 ? theta : 180 - theta);
    const vertical = r(0, 1) === 0;
    const target = vertical ? (start + 2) % 4 : (start + pick(r, [1, 3])) % 4;
    const known = measure(start),
      unknown = measure(target);
    const name = (i: number) => s.name(i, (i + 1) % 4);
    const marks: RayFigure["marks"] = [
      { from: start, to: (start + 1) % 4, label: `${known}°` },
      { from: target, to: (target + 1) % 4, label: "?" },
    ];
    return {
      prompt: `Lines $${P}${R}$ and $${Q}${S}$ cross at $${s.O}$. ${name(start)} measures ${known}°. What is the measure of ${name(target)}, in degrees?`,
      answer: String(unknown),
      figure: { ...s.figure, marks },
      response: { kind: "number", label: "Angle measure in degrees" },
      explanation: vertical
        ? [
            `${name(start)} and ${name(target)} are vertical angles: they sit opposite each other where the lines cross.`,
            `Each of them forms a straight angle with the same angle between them, ${name((start + 1) % 4)}. So each equals 180° minus that angle, and vertical angles are equal.`,
            `${name(target)} = ${known}°.`,
          ]
        : [
            `${name(start)} and ${name(target)} are adjacent, and together they fill one side of line $${[P + R, Q + S][target === (start + 1) % 4 ? start % 2 : (start + 1) % 2]}$: a straight angle.`,
            `They are supplementary: ${known}° + ${name(target)} = 180°.`,
            `${name(target)} = 180° − ${known}° = ${unknown}°.`,
          ],
      tags: [vertical ? "vertical" : "linear-pair"],
    };
  }
  // A full turn split into three angles, each less than 180°.
  let p = 0,
    q = 0;
  do {
    p = r(40, 170);
    q = r(40, 170);
  } while (360 - p - q < 40 || 360 - p - q > 170);
  const s = rays(r, [0, p, p + q]);
  const [P, Q, R] = s.letters as [string, string, string];
  const third = 360 - p - q;
  const marks: RayFigure["marks"] = [
    { from: 0, to: 1, label: `${p}°` },
    { from: 1, to: 2, label: `${q}°` },
    { from: 2, to: 0, label: "?" },
  ];
  return {
    prompt: `Rays $${s.O}${P}$, $${s.O}${Q}$ and $${s.O}${R}$ divide the full turn around $${s.O}$ into three angles. ${s.name(0, 1)} measures ${p}° and ${s.name(1, 2)} measures ${q}°. What is the measure of ${s.name(2, 0)}, in degrees?`,
    answer: String(third),
    figure: { ...s.figure, marks },
    response: { kind: "number", label: "Angle measure in degrees" },
    explanation: [
      `The three angles fill the full turn around $${s.O}$ without overlapping, so they add to 360°.`,
      `${p}° + ${q}° + ${s.name(2, 0)} = 360°, so ${s.name(2, 0)} = 360° − ${p + q}° = ${third}°.`,
    ],
    tags: ["full-turn"],
  };
}

function angleEquationCase(r: Random): Case {
  const mode = r(0, 3),
    x = r(3, 30),
    askAngle = r(0, 2) === 0;
  if (mode === 2) {
    // Vertical angles: equal expressions.
    const v = r(40, 140);
    if (v === 90) return angleEquationCase(r);
    const e1 = expressionFor(r, x, v),
      e2 = expressionFor(r, x, v, e1.a);
    if (e1.a === e2.a) return angleEquationCase(r);
    const s = rays(r, [0, v, 180, v + 180]);
    const [P, Q, R, S] = s.letters as [string, string, string, string];
    // Angles 0 and 2 both measure v; they are vertical angles.
    const first = r(0, 1) * 2,
      second = (first + 2) % 4;
    const name = (i: number) => s.name(i, (i + 1) % 4);
    const L1 = angleLabel(e1.a, e1.b),
      L2 = angleLabel(e2.a, e2.b);
    const [hi, lo] = e1.a > e2.a ? [e1, e2] : [e2, e1];
    const steps = [
      `${name(first)} and ${name(second)} are vertical angles, so they are equal: ${linear(e1.a, e1.b)} = ${linear(e2.a, e2.b)}.`,
      `Subtract $${linear(lo.a, 0)}$ from both sides: ${linear(hi.a - lo.a, hi.b)} = ${num(lo.b)}.`,
      ...(hi.b !== 0
        ? [
            `${hi.b > 0 ? "Subtract" : "Add"} ${Math.abs(hi.b)} ${hi.b > 0 ? "from" : "to"} both sides: ${linear(hi.a - lo.a, 0)} = ${num(lo.b - hi.b)}.`,
          ]
        : []),
      ...(hi.a - lo.a !== 1
        ? [`Divide both sides by ${hi.a - lo.a}: x = ${x}.`]
        : []),
      `Check: ${substitute(e1.a, e1.b, x)} and ${substitute(e2.a, e2.b, x)}.`,
    ];
    if (askAngle) steps.push(`So ${name(first)} measures ${v}°.`);
    return {
      prompt: `Lines $${P}${R}$ and $${Q}${S}$ cross at $${s.O}$. ${name(first)} measures ${L1} and ${name(second)} measures ${L2}. ${askAngle ? `What is the measure of ${name(first)}, in degrees?` : "What is the value of $x$?"}`,
      answer: String(askAngle ? v : x),
      figure: {
        ...s.figure,
        marks: [
          { from: first, to: (first + 1) % 4, label: L1 },
          { from: second, to: (second + 1) % 4, label: L2 },
        ],
      },
      response: {
        kind: "number",
        label: askAngle ? "Angle measure in degrees" : "Value of $x$",
      },
      explanation: steps,
      tags: ["vertical", askAngle ? "ask-angle" : "ask-x"],
    };
  }
  // Two adjacent parts of a straight angle, a right angle or a given angle.
  const whole =
    mode === 0 ? 180 : mode === 1 ? 90 : r(10, 17) * 10 + pick(r, [0, 5]);
  const v1 = r(mode === 1 ? 30 : 40, whole - (mode === 1 ? 30 : 40));
  if (mode !== 1 && Math.abs(v1 - whole / 2) < 3) return angleEquationCase(r);
  const v2 = whole - v1;
  const e1 = expressionFor(r, x, v1),
    e2 = expressionFor(r, x, v2);
  const s = rays(r, [0, v2, whole]);
  const [P, Q, R] = s.letters as [string, string, string];
  // Ray 0→1 is the angle of measure v2; ray 1→2 is v1.
  const first = s.name(1, 2),
    second = s.name(0, 1);
  const L1 = angleLabel(e1.a, e1.b),
    L2 = angleLabel(e2.a, e2.b);
  const marks: RayFigure["marks"] = [
    { from: 1, to: 2, label: L1 },
    { from: 0, to: 1, label: L2 },
  ];
  if (mode === 1) marks.unshift({ from: 0, to: 2, label: "90°", right: true });
  if (mode === 3) marks.unshift({ from: 0, to: 2, label: `${whole}°` });
  const setup =
    mode === 0
      ? `Points $${R}$, $${s.O}$ and $${P}$ lie on a straight line, and ray $${s.O}${Q}$ is drawn from $${s.O}$.`
      : mode === 1
        ? `$\\angle ${P}${s.O}${R}$ is a right angle, and ray $${s.O}${Q}$ lies inside it.`
        : `Ray $${s.O}${Q}$ lies inside $\\angle ${P}${s.O}${R}$, which measures ${whole}°.`;
  const relation =
    mode === 0
      ? `The two angles fill the straight angle $\\angle ${P}${s.O}${R}$, so they add to 180°`
      : mode === 1
        ? `The two angles fill the right angle $\\angle ${P}${s.O}${R}$, so they add to 90°`
        : `The two adjacent angles fill $\\angle ${P}${s.O}${R}$, so they add to ${whole}°`;
  const steps = [
    `${relation}: (${linear(e1.a, e1.b)}) + (${linear(e2.a, e2.b)}) = ${whole}.`,
    ...solveSteps(e1.a + e2.a, e1.b + e2.b, whole, x),
    `Check: ${substitute(e1.a, e1.b, x)} and ${substitute(e2.a, e2.b, x)}; ${v1} + ${v2} = ${whole}.`,
  ];
  if (askAngle) steps.push(`So ${first} measures ${v1}°.`);
  return {
    prompt: `${setup} ${first} measures ${L1} and ${second} measures ${L2}. ${askAngle ? `What is the measure of ${first}, in degrees?` : "What is the value of $x$?"}`,
    answer: String(askAngle ? v1 : x),
    figure: { ...s.figure, marks },
    response: {
      kind: "number",
      label: askAngle ? "Angle measure in degrees" : "Value of $x$",
    },
    explanation: steps,
    tags: [
      ["straight", "right", "vertical", "adjacent"][mode]!,
      askAngle ? "ask-angle" : "ask-x",
    ],
  };
}

// ——— Triangle angle theorems ———

const triangleNames = [
  ["A", "B", "C"],
  ["D", "E", "F"],
  ["P", "Q", "R"],
  ["J", "K", "L"],
  ["X", "Y", "Z"],
] as const;
const after: Record<string, string> = {
  C: "D",
  F: "G",
  R: "S",
  L: "M",
  Z: "W",
};
/** Three angles in [lo, hi] adding to 180°. */
function triangleAngles(
  r: Random,
  lo = 20,
  hi = 120,
): [number, number, number] {
  for (;;) {
    const a = r(lo, hi),
      b = r(lo, hi),
      c = 180 - a - b;
    if (c >= lo && c <= hi) return [a, b, c];
  }
}

function triangleSumCase(r: Random): Case {
  const names = [...pick(r, triangleNames)] as [string, string, string];
  const [A, B, C] = names;
  const algebra = r(0, 2) === 0;
  if (!algebra) {
    const right = r(0, 4) === 0;
    let angles = triangleAngles(r);
    if (right) {
      const a = r(20, 70);
      angles = shuffle(r, [90, a, 90 - a]) as [number, number, number];
    }
    const missing = r(0, 2);
    const known = [0, 1, 2].filter((i) => i !== missing);
    const k1 = angles[known[0]!]!,
      k2 = angles[known[1]!]!;
    const labels = angles.map((a, i) => (i === missing ? "?" : `${a}°`)) as [
      string,
      string,
      string,
    ];
    return {
      prompt: `In triangle $${A}${B}${C}$, $\\angle ${names[known[0]!]}$ measures ${k1}° and $\\angle ${names[known[1]!]}$ measures ${k2}°. What is the measure of $\\angle ${names[missing]}$, in degrees?`,
      answer: String(angles[missing]),
      figure: {
        kind: "triangle-angles",
        angles,
        vertices: names,
        labels,
      },
      response: { kind: "number", label: "Angle measure in degrees" },
      explanation: [
        `The three angles of a triangle add to 180°: ${k1}° + ${k2}° + $\\angle ${names[missing]}$ = 180°.`,
        `Add the known angles: ${k1}° + ${k2}° = ${k1 + k2}°.`,
        `Subtract from 180°: $\\angle ${names[missing]}$ = 180° − ${k1 + k2}° = ${angles[missing]}°.`,
      ],
      tags: ["numeric", right ? "right" : "no-right", `missing-${missing}`],
    };
  }
  const x = r(5, 30);
  const angles = triangleAngles(r, 45, 95);
  const exprs = angles.map((v) => expressionFor(r, x, v));
  // Keep at least one expression with a constant, so the sum needs collecting.
  if (exprs.every((e) => e.b === 0)) return triangleSumCase(r);
  const labels = exprs.map((e) => angleLabel(e.a, e.b)) as [
    string,
    string,
    string,
  ];
  const ask = r(0, 3);
  const askAngle = ask < 3 ? null : r(0, 2);
  const A1 = exprs.reduce((s, e) => s + e.a, 0),
    B1 = exprs.reduce((s, e) => s + e.b, 0);
  const steps = [
    `The three angles of a triangle add to 180°: ${exprs.map((e) => `(${linear(e.a, e.b)})`).join(" + ")} = 180.`,
    ...solveSteps(A1, B1, 180, x),
    `Check: ${exprs.map((e) => substitute(e.a, e.b, x)).join(", ")}; ${angles.join(" + ")} = 180.`,
  ];
  if (askAngle !== null)
    steps.push(
      `So $\\angle ${names[askAngle]}$ measures ${angles[askAngle]}°.`,
    );
  return {
    prompt: `In triangle $${A}${B}${C}$, $\\angle ${A}$ measures ${labels[0]}, $\\angle ${B}$ measures ${labels[1]} and $\\angle ${C}$ measures ${labels[2]}. ${askAngle === null ? "What is the value of $x$?" : `What is the measure of $\\angle ${names[askAngle]}$, in degrees?`}`,
    answer: String(askAngle === null ? x : angles[askAngle]),
    figure: { kind: "triangle-angles", angles, vertices: names, labels },
    response: {
      kind: "number",
      label: askAngle === null ? "Value of $x$" : "Angle measure in degrees",
    },
    explanation: steps,
    tags: ["algebra", askAngle === null ? "ask-x" : "ask-angle"],
  };
}

function exteriorCase(r: Random): Case {
  const names = [...pick(r, triangleNames)] as [string, string, string];
  const [A, B, C] = names;
  const D = after[C]!;
  const angles = triangleAngles(r, 20, 120);
  const ext = 180 - angles[1];
  const exteriorName = `$\\angle ${C}${B}${D}$`;
  const setup = `In triangle $${A}${B}${C}$, side $${A}${B}$ is extended past $${B}$ to point $${D}$.`;
  const mode = r(0, 3);
  if (mode <= 1) {
    const labels = [`${angles[0]}°`, null, `${angles[2]}°`] as [
      string | null,
      string | null,
      string | null,
    ];
    if (mode === 0)
      return {
        prompt: `${setup} $\\angle ${A}$ measures ${angles[0]}° and $\\angle ${C}$ measures ${angles[2]}°. What is the measure of ${exteriorName}, in degrees?`,
        answer: String(ext),
        figure: {
          kind: "triangle-angles",
          angles,
          vertices: names,
          labels,
          exterior: { point: D, label: "?" },
        },
        response: { kind: "number", label: "Angle measure in degrees" },
        explanation: [
          `${exteriorName} and $\\angle ${A}${B}${C}$ form a straight angle along line $${A}${D}$, so ${exteriorName} = 180° − $\\angle ${B}$.`,
          `The triangle's angles add to 180°, so $\\angle ${B}$ = 180° − ($\\angle ${A}$ + $\\angle ${C}$). Then ${exteriorName} = $\\angle ${A}$ + $\\angle ${C}$.`,
          `${exteriorName} = ${angles[0]}° + ${angles[2]}° = ${ext}°.`,
        ],
        tags: ["find-exterior"],
      };
    const findA = r(0, 1) === 0;
    const known = findA ? 2 : 0,
      target = findA ? 0 : 2;
    const tl = [...labels] as typeof labels;
    tl[target] = "?";
    return {
      prompt: `${setup} ${exteriorName} measures ${ext}° and $\\angle ${names[known]}$ measures ${angles[known]}°. What is the measure of $\\angle ${names[target]}$, in degrees?`,
      answer: String(angles[target]),
      figure: {
        kind: "triangle-angles",
        angles,
        vertices: names,
        labels: tl,
        exterior: { point: D, label: `${ext}°` },
      },
      response: { kind: "number", label: "Angle measure in degrees" },
      explanation: [
        `An exterior angle equals the sum of the two interior angles that are not next to it: ${exteriorName} = $\\angle ${A}$ + $\\angle ${C}$.`,
        `${ext}° = ${findA ? `$\\angle ${A}$ + ${angles[2]}°` : `${angles[0]}° + $\\angle ${C}$`}.`,
        `$\\angle ${names[target]}$ = ${ext}° − ${angles[known]}° = ${angles[target]}°.`,
      ],
      tags: ["find-remote"],
    };
  }
  const x = r(4, 25);
  if (
    angles[0] < 40 ||
    angles[2] < 40 ||
    angles[0] > 90 ||
    angles[2] > 90 ||
    angles[1] < 50
  )
    return exteriorCase(r);
  const ea = expressionFor(r, x, angles[0]),
    ec = expressionFor(r, x, angles[2]),
    ee = expressionFor(r, x, ext);
  const a = ea.a + ec.a - ee.a,
    c = ea.b + ec.b - ee.b;
  if (a <= 0 || (ea.b === 0 && ec.b === 0 && ee.b === 0))
    return exteriorCase(r);
  const L = [angleLabel(ea.a, ea.b), null, angleLabel(ec.a, ec.b)] as [
    string | null,
    string | null,
    string | null,
  ];
  const LE = angleLabel(ee.a, ee.b);
  return {
    prompt: `${setup} $\\angle ${A}$ measures ${L[0]}, $\\angle ${C}$ measures ${L[2]} and ${exteriorName} measures ${LE}. What is the value of $x$?`,
    answer: String(x),
    figure: {
      kind: "triangle-angles",
      angles,
      vertices: names,
      labels: L,
      exterior: { point: D, label: LE },
    },
    response: { kind: "number", label: "Value of $x$" },
    explanation: [
      `An exterior angle equals the sum of the two remote interior angles: (${linear(ea.a, ea.b)}) + (${linear(ec.a, ec.b)}) = ${linear(ee.a, ee.b)}.`,
      `Collect the $x$-terms on the left and the numbers on the right: ${linear(a, 0)} = ${num(-c)}.`,
      ...(a !== 1
        ? [`Divide both sides by ${a}: x = ${x}.`]
        : [`So x = ${x}.`]),
      `Check: ${substitute(ea.a, ea.b, x)} and ${substitute(ec.a, ec.b, x)}; ${angles[0]} + ${angles[2]} = ${ext}, and ${substitute(ee.a, ee.b, x)}.`,
    ],
    tags: ["algebra"],
  };
}

const positionWords = [
  "above the line and right of the transversal",
  "above the line and left of the transversal",
  "below the line and left of the transversal",
  "below the line and right of the transversal",
];
type Relation = {
  name: string;
  equal: boolean;
  pairs: [number, number, number, number][];
};
/** [crossing, position, crossing, position]; crossing 0 is the upper line. */
const relations: Relation[] = [
  {
    name: "corresponding angles",
    equal: true,
    pairs: [0, 1, 2, 3].map((p) => [0, p, 1, p]),
  },
  {
    name: "alternate interior angles",
    equal: true,
    pairs: [
      [0, 3, 1, 1],
      [0, 2, 1, 0],
    ],
  },
  {
    name: "alternate exterior angles",
    equal: true,
    pairs: [
      [0, 0, 1, 2],
      [0, 1, 1, 3],
    ],
  },
  {
    name: "same-side interior angles",
    equal: false,
    pairs: [
      [0, 3, 1, 0],
      [0, 2, 1, 1],
    ],
  },
  {
    name: "vertical angles",
    equal: true,
    pairs: [0, 1].flatMap((c) => [
      [c, 0, c, 2] as [number, number, number, number],
      [c, 1, c, 3] as [number, number, number, number],
    ]),
  },
  {
    name: "a linear pair",
    equal: false,
    pairs: [0, 1].flatMap((c) =>
      [0, 1, 2, 3].map(
        (p) => [c, p, c, (p + 1) % 4] as [number, number, number, number],
      ),
    ),
  },
];

function parallelCase(r: Random): Case {
  const theta = r(35, 145);
  if (theta === 90) return parallelCase(r);
  const lines = pick(r, [
    ["m", "n", "t"],
    ["p", "q", "t"],
    ["a", "b", "c"],
    ["j", "k", "l"],
  ] as const);
  const [m, n, t] = lines;
  const measure = (position: number) =>
    position % 2 === 0 ? theta : 180 - theta;
  const algebra = r(0, 2) === 0;
  const twoStep = !algebra && r(0, 3) === 0;
  let relation: Relation | null = null,
    pair: [number, number, number, number];
  if (twoStep) {
    // Different crossings, different positions, not a named pair.
    const named = new Set(
      relations.flatMap((rel) => rel.pairs.map((p) => p.join())),
    );
    do pair = [0, r(0, 3), 1, r(0, 3)];
    while (named.has(pair.join()));
  } else {
    relation = algebra
      ? pick(r, relations.slice(0, 4))
      : pick(r, relations.slice(0, 5).concat(relations.slice(0, 4)));
    pair = pick(r, relation.pairs);
  }
  if (r(0, 1)) pair = [pair[2], pair[3], pair[0], pair[1]];
  const [c1, p1, c2, p2] = pair;
  const where = (c: number, p: number) =>
    `at line $${c === 0 ? m : n}$, ${positionWords[p]}`;
  const given = measure(p1),
    unknown = measure(p2);
  const equal = p1 % 2 === p2 % 2;
  const setup = `Lines $${m}$ and $${n}$ are parallel, and line $${t}$ crosses both.`;
  if (!algebra) {
    const explanation: string[] = [];
    if (relation)
      explanation.push(
        `The marked angles are ${relation.name}.`,
        relation.name === "vertical angles"
          ? "Vertical angles are equal."
          : relation.name === "a linear pair"
            ? `They lie side by side along one line, so they add to 180°.`
            : relation.equal
              ? `Because $${m}$ and $${n}$ are parallel, sliding one crossing along $${t}$ onto the other matches its angles exactly, so ${relation.name} are equal.`
              : `Because $${m}$ and $${n}$ are parallel, same-side interior angles add to 180°: each one forms a straight angle with an angle equal to the other.`,
      );
    else
      explanation.push(
        `Because $${m}$ and $${n}$ are parallel, sliding the crossing at line $${c1 === 0 ? m : n}$ along $${t}$ onto the crossing at line $${c2 === 0 ? m : n}$ matches every angle. So the angle ${where(c2, p1)} also measures ${given}°.`,
        `The angle marked $x$° lies next to that angle along a line, so the two add to 180°.`,
      );
    explanation.push(
      equal
        ? `x = ${given}.`
        : `x + ${given} = 180, so x = 180 − ${given} = ${unknown}.`,
    );
    return {
      prompt: `${setup} One marked angle measures ${given}°. What is the value of $x$?`,
      answer: String(unknown),
      figure: {
        kind: "parallel-transversal",
        angle: theta,
        lines: [m, n, t],
        marks: [
          { crossing: c1 as 0 | 1, position: p1, label: `${given}°` },
          { crossing: c2 as 0 | 1, position: p2, label: "x°" },
        ],
      },
      response: { kind: "number", label: "Value of $x$" },
      explanation,
      tags: [
        "numeric",
        relation
          ? relation.name.replace(/^a /, "").replaceAll(" ", "-")
          : "two-step",
        equal ? "equal" : "supplementary",
      ],
    };
  }
  const x = r(4, 30);
  const e1 = expressionFor(r, x, given),
    e2 = expressionFor(r, x, unknown, equal ? e1.a : undefined);
  if (equal && e1.a === e2.a) return parallelCase(r);
  const L1 = angleLabel(e1.a, e1.b),
    L2 = angleLabel(e2.a, e2.b);
  const explanation = [
    `The marked angles are ${relation!.name}, so they are ${equal ? "equal" : "supplementary"}.`,
  ];
  if (equal) {
    const [hi, lo] = e1.a > e2.a ? [e1, e2] : [e2, e1];
    explanation.push(
      `Write the equation: ${linear(e1.a, e1.b)} = ${linear(e2.a, e2.b)}.`,
      `Subtract $${linear(lo.a, 0)}$ from both sides: ${linear(hi.a - lo.a, hi.b)} = ${num(lo.b)}.`,
      ...(hi.b !== 0
        ? [
            `${hi.b > 0 ? "Subtract" : "Add"} ${Math.abs(hi.b)} ${hi.b > 0 ? "from" : "to"} both sides: ${linear(hi.a - lo.a, 0)} = ${num(lo.b - hi.b)}.`,
          ]
        : []),
      ...(hi.a - lo.a !== 1
        ? [`Divide both sides by ${hi.a - lo.a}: x = ${x}.`]
        : []),
    );
  } else
    explanation.push(
      `Write the equation: (${linear(e1.a, e1.b)}) + (${linear(e2.a, e2.b)}) = 180.`,
      ...solveSteps(e1.a + e2.a, e1.b + e2.b, 180, x),
    );
  explanation.push(
    `Check: ${substitute(e1.a, e1.b, x)} and ${substitute(e2.a, e2.b, x)}.`,
  );
  return {
    prompt: `${setup} The marked angles measure ${L1} and ${L2}. What is the value of $x$?`,
    answer: String(x),
    figure: {
      kind: "parallel-transversal",
      angle: theta,
      lines: [m, n, t],
      marks: [
        { crossing: c1 as 0 | 1, position: p1, label: L1 },
        { crossing: c2 as 0 | 1, position: p2, label: L2 },
      ],
    },
    response: { kind: "number", label: "Value of $x$" },
    explanation,
    tags: [
      "algebra",
      relation!.name.replace(/^a /, "").replaceAll(" ", "-"),
      equal ? "equal" : "supplementary",
    ],
  };
}

// ——— Triangle construction ———

const units = [
  ["cm", "centimeters", "square centimeters"],
  ["mm", "millimeters", "square millimeters"],
  ["m", "meters", "square meters"],
  ["ft", "feet", "square feet"],
] as const;
const ids = ["option-a", "option-b", "option-c", "option-d"] as const;

function sideTestCase(r: Random): Case {
  const [u] = pick(r, units);
  const c = r(8, 20);
  const triples: { sides: [number, number, number]; sum: number }[] = [];
  const used = new Set<number>();
  /** Two shorter sides a ≤ b ≤ c with a + b = sum and a ≥ 2. */
  const add = (sum: number) => {
    const lo = Math.max(2, sum - c),
      hi = Math.floor(sum / 2);
    const free = Array.from(
      { length: Math.max(0, hi - lo + 1) },
      (_, i) => lo + i,
    ).filter((a) => !used.has(a * 100 + sum));
    if (!free.length) return false;
    const a = pick(r, free);
    used.add(a * 100 + sum);
    triples.push({ sides: [a, sum - a, c], sum });
    return true;
  };
  const twoDegenerate = r(0, 3) === 0;
  const plan = [
    r(c + 1, c + Math.min(6, c - 2)),
    c,
    twoDegenerate ? c : r(c - 4, c - 1),
    r(c - 5, c - 1),
  ];
  for (const sum of plan) if (!add(sum)) return sideTestCase(r);
  const order = shuffle(r, [0, 1, 2, 3]);
  const shown = triples.map((t) =>
    shuffle(r, [...t.sides])
      .map((s) => `${s} ${u}`)
      .join(", "),
  );
  const options = order.map((k, i) => ({ id: ids[i]!, label: shown[k]! }));
  const answer = ids[order.indexOf(0)]!;
  const verdict = (t: (typeof triples)[number]) => {
    const [a, b] = t.sides;
    return t.sum > c
      ? `${a} + ${b} = ${t.sum}, which is greater than ${c}: a triangle exists.`
      : t.sum === c
        ? `${a} + ${b} = ${c}: the two shorter sides only reach the length of the longest, so they lie flat along it and no triangle forms.`
        : `${a} + ${b} = ${t.sum}, which is less than ${c}: the two shorter sides cannot reach across the longest side.`;
  };
  const feedback: Record<string, string> = {};
  order.forEach((k, i) => {
    if (k !== 0) feedback[ids[i]!] = verdict(triples[k]!);
  });
  return {
    prompt: "Which set of three lengths can be the side lengths of a triangle?",
    answer,
    response: { kind: "choice", label: "Choose one set", options },
    choiceFeedback: feedback,
    explanation: [
      `In every set the longest length is ${c} ${u}. Three lengths form a triangle only when the two shorter ones add to more than the longest.`,
      ...order.map((k, i) => `Choice ${"ABCD"[i]}: ${verdict(triples[k]!)}`),
      `Only ${shown[0]} works.`,
    ],
    tags: [twoDegenerate ? "two-degenerate" : "one-degenerate"],
  };
}

function thirdSideCase(r: Random): Case {
  const [u, plural] = pick(r, units);
  let a = r(3, 25),
    b = r(3, 25);
  if (a === b) b = a + r(1, 6);
  const ask = r(0, 2);
  const lo = Math.abs(a - b),
    hi = a + b;
  const answer = ask === 0 ? hi - 1 : ask === 1 ? lo + 1 : hi - lo - 1;
  const question = [
    `What is the greatest possible length of the third side, in ${plural}?`,
    `What is the least possible length of the third side, in ${plural}?`,
    "How many different lengths are possible for the third side?",
  ][ask]!;
  return {
    prompt: `Two sides of a triangle measure ${a} ${u} and ${b} ${u}. The third side is a whole number of ${plural}. ${question}`,
    answer: String(answer),
    response: {
      kind: "number",
      label: ask === 2 ? "Number of lengths" : `Length in ${plural}`,
    },
    explanation: [
      `Call the third side $s$. Each side must be shorter than the other two together.`,
      `s < ${a} + ${b} = ${hi}, so $s$ is less than ${hi}.`,
      `The longer given side, ${Math.max(a, b)}, must be less than ${Math.min(a, b)} + s, so s > ${Math.max(a, b)} − ${Math.min(a, b)} = ${lo}.`,
      ask === 0
        ? `The greatest whole number less than ${hi} is ${hi - 1}.`
        : ask === 1
          ? `The least whole number greater than ${lo} is ${lo + 1}.`
          : `The whole numbers from ${lo + 1} through ${hi - 1} work: ${hi - 1} − ${lo + 1} + 1 = ${answer} lengths.`,
    ],
    tags: [["greatest", "least", "count"][ask]!],
  };
}

const conditionOptions = [
  { id: "option-a", label: "Exactly one triangle" },
  { id: "option-b", label: "More than one triangle" },
  { id: "option-c", label: "No triangle" },
];
function conditionsCase(r: Random): Case {
  const [u] = pick(r, units);
  const kind = pick(r, [
    "aaa",
    "aaa-bad",
    "sss",
    "sss-bad",
    "sas",
    "asa",
    "aas-bad",
    "aa",
  ] as const);
  let condition = "",
    verdict: 0 | 1 | 2 = 0;
  let reason: string[] = [];
  if (kind === "aaa" || kind === "aaa-bad") {
    let angles = triangleAngles(r, 25, 110);
    if (kind === "aaa-bad") {
      const shift = pick(r, [-20, -10, -5, 5, 10, 20]);
      angles = [angles[0], angles[1], angles[2] + shift];
    }
    const sum = angles[0] + angles[1] + angles[2];
    condition = `angles of ${angles[0]}°, ${angles[1]}° and ${angles[2]}°`;
    verdict = sum === 180 ? 1 : 2;
    reason =
      sum === 180
        ? [
            `${angles.join("° + ")}° = 180°, so these angles fit a triangle.`,
            "Angles fix the shape but not the size: enlarging a triangle keeps its angles. So infinitely many triangles of different sizes work.",
          ]
        : [
            `${angles.join("° + ")}° = ${sum}°, but the angles of every triangle add to 180°. No triangle has these angles.`,
          ];
  } else if (kind === "sss" || kind === "sss-bad") {
    const c = r(7, 18);
    const sum = kind === "sss" ? r(c + 1, c + 8) : r(c - 3, c);
    const lo = Math.max(2, sum - c),
      hi = Math.floor(sum / 2);
    if (lo > hi) return conditionsCase(r);
    const a = r(lo, hi),
      b = sum - a;
    const sides = shuffle(r, [a, b, c]);
    condition = `sides of ${sides[0]} ${u}, ${sides[1]} ${u} and ${sides[2]} ${u}`;
    verdict = sum > c ? 0 : 2;
    reason =
      sum > c
        ? [
            `The two shorter sides add to ${a} + ${b} = ${sum}, more than the longest side, ${c}. So the sides can close up.`,
            "Three side lengths fix the triangle: any two triangles with these sides match exactly. Exactly one triangle works.",
          ]
        : [
            `The two shorter sides add to ${a} + ${b} = ${sum}, which is not more than the longest side, ${c}. They cannot meet above the longest side, so no triangle exists.`,
          ];
  } else if (kind === "sas") {
    const a = r(3, 15),
      b = r(3, 15),
      angle = r(2, 16) * 10 + pick(r, [0, 5]);
    if (angle >= 170) return conditionsCase(r);
    condition = `sides of ${a} ${u} and ${b} ${u} with ${article(angle)} ${angle}° angle between them`;
    verdict = 0;
    reason = [
      `Draw the ${angle}° angle and mark ${a} ${u} along one ray and ${b} ${u} along the other. The third side must join those two points.`,
      "There is only one way to join them, so the conditions determine exactly one triangle.",
    ];
  } else if (kind === "asa") {
    const [p, q] = triangleAngles(r, 25, 110);
    const side = r(3, 15);
    condition = `angles of ${p}° and ${q}° with a ${side} ${u} side between them`;
    verdict = 0;
    reason = [
      `${p}° + ${q}° = ${p + q}°, which is less than 180°, so the rays drawn at the ends of the ${side} ${u} side meet.`,
      "They meet at exactly one point, so the conditions determine exactly one triangle.",
    ];
  } else if (kind === "aas-bad") {
    const p = r(60, 120),
      q = r(180 - p, 150);
    const side = r(3, 15);
    condition = `angles of ${p}° and ${q}° and a ${side} ${u} side`;
    verdict = 2;
    reason = [
      `${p}° + ${q}° = ${p + q}°. The third angle would be 180° − ${p + q}°, which is not positive.`,
      "Two angles of a triangle must add to less than 180°, so no triangle exists.",
    ];
  } else {
    const [p, q] = triangleAngles(r, 25, 110);
    condition = `two angles of ${p}° and ${q}°`;
    verdict = 1;
    reason = [
      `The third angle must be 180° − ${p}° − ${q}° = ${180 - p - q}°, so the shape is fixed.`,
      "No length is given, so the triangle can be any size. More than one triangle works.",
    ];
  }
  const answer = conditionOptions[verdict]!.id;
  const feedback: Record<string, string> = {};
  conditionOptions.forEach((o, i) => {
    if (i !== verdict) feedback[o.id] = reason.join(" ");
  });
  return {
    prompt: `A triangle must have ${condition}. How many different triangles meet these conditions? Triangles with the same size and shape count as one.`,
    answer,
    response: {
      kind: "choice",
      label: "Choose one",
      options: conditionOptions,
    },
    choiceFeedback: feedback,
    explanation: [
      ...reason,
      `Answer: ${conditionOptions[verdict]!.label.toLowerCase()}.`,
    ],
    tags: [kind, ["one", "many", "none"][verdict]!],
  };
}

// ——— Cross-sections ———

type Plane = Extract<SemanticFigure, { kind: "solid-section" }>["plane"];
/** The slicing plane in words; edges are named by their lengths. */
function planeText(
  plane: Plane,
  d: { l: number; w: number; u: string },
): string {
  const edge = (e: number) => `the ${e} ${d.u} edges of the base`;
  return {
    "parallel-base": "parallel to its base",
    "perpendicular-front": `perpendicular to its base and parallel to ${edge(d.l)}`,
    "perpendicular-side": `perpendicular to its base and parallel to ${edge(d.w)}`,
    "perpendicular-diagonal":
      "perpendicular to its base, through two vertical edges that are not on the same face",
    corner:
      "through the three vertices next to one corner, cutting off that corner",
    "through-apex": `perpendicular to its base, through the apex, and parallel to ${edge(d.l)}`,
    "off-apex": `perpendicular to its base and parallel to ${edge(d.l)}, but not through the apex`,
  }[plane];
}
const shapeOptions = ["Rectangle", "Square", "Triangle", "Trapezoid"] as const;
function distinctDims(r: Random) {
  for (;;) {
    const l = r(5, 14),
      w = r(3, 10),
      h = r(4, 12);
    if (new Set([l, w, h]).size === 3 && l * l + w * w !== h * h)
      return { l, w, h };
  }
}

function sectionShapeCase(r: Random): Case {
  // Targets: rectangle, triangle, trapezoid, square.
  const target = r(0, 3);
  const square = target === 3 ? r(0, 2) : -1;
  const plane: Plane =
    square >= 0
      ? square === 1
        ? "perpendicular-front"
        : "parallel-base"
      : target === 0
        ? pick(r, [
            "parallel-base",
            "perpendicular-front",
            "perpendicular-side",
            "perpendicular-diagonal",
            "parallel-base",
          ] as const)
        : target === 1
          ? pick(r, ["corner", "through-apex"] as const)
          : "off-apex";
  const solid =
    square >= 0
      ? square === 2
        ? "pyramid"
        : "prism"
      : (["through-apex", "off-apex"] as Plane[]).includes(plane)
        ? "pyramid"
        : plane === "parallel-base"
          ? pick(r, ["prism", "pyramid"] as const)
          : "prism";
  let { l, w, h } = distinctDims(r);
  if (square === 0 || square === 2) w = l;
  if (square === 1) h = l;
  const [u, plural] = pick(r, units);
  const solidName =
    solid === "prism" ? "right rectangular prism" : "right rectangular pyramid";
  const dims =
    solid === "prism"
      ? `${l} ${u} long, ${w} ${u} wide and ${h} ${u} tall`
      : `${h} ${u} tall, with a base ${l} ${u} long and ${w} ${u} wide`;
  void plural;
  const shape =
    target === 0
      ? "Rectangle"
      : target === 1
        ? "Triangle"
        : target === 2
          ? "Trapezoid"
          : "Square";
  const fourSides = (a: number, b: number) =>
    a === b
      ? "All four sides are equal, so it is a square."
      : "Its sides are unequal, so it is not a square.";
  const reason: Record<Plane, string[]> = {
    "parallel-base":
      solid === "prism"
        ? [
            `A slice parallel to the base meets the four side faces in segments that copy the base's edges: ${l} ${u} and ${w} ${u}.`,
            `The section is a copy of the base: ${l} ${u} by ${w} ${u}, with four right angles. ${fourSides(l, w)}`,
          ]
        : [
            `A slice parallel to the base meets the four slanted faces. Each cut is parallel to a base edge, so the section has four right angles, like the base.`,
            `It is a smaller copy of the base with the same proportions, ${l} to ${w}. ${fourSides(l, w)}`,
          ],
    "perpendicular-front": [
      `The slice stands straight up from the base, parallel to the ${l} ${u} edges, so it is parallel to the faces that contain those edges and copies them: ${l} ${u} wide and ${h} ${u} tall.`,
      `The section has four right angles. ${fourSides(l, h)}`,
    ],
    "perpendicular-side": [
      `The slice stands straight up from the base, parallel to the ${w} ${u} edges, so it is parallel to the faces that contain those edges and copies them: ${w} ${u} wide and ${h} ${u} tall.`,
      `The section has four right angles. ${fourSides(w, h)}`,
    ],
    "perpendicular-diagonal": [
      `The slice contains two opposite vertical edges, each ${h} ${u} tall, and crosses the top and bottom along a diagonal of the base.`,
      `The vertical edges are perpendicular to the diagonals, so the section has four right angles: a rectangle. Its width is the base diagonal, which differs from ${h}, so it is not a square.`,
    ],
    corner: [
      "The plane meets exactly three faces, those that share the corner it cuts off.",
      "Each face it meets contributes one straight side, so the section has three sides: a triangle.",
    ],
    "through-apex": [
      "The slice stands up from the base and passes through the apex. It crosses the base along one segment and meets two slanted faces along segments that rise to the apex.",
      "Those three segments form a triangle.",
    ],
    "off-apex": [
      `The slice stands up from the base, parallel to the ${l} ${u} edges, but misses the apex. It crosses the base along a segment ${l} ${u} long, rises along two slanted faces on slanted segments, and crosses a third slanted face along a shorter horizontal segment.`,
      "The two horizontal sides are parallel and unequal, joined by two slanted sides, so the section is a trapezoid that is not a rectangle.",
    ],
  };
  const options = shapeOptions.map((label, i) => ({ id: ids[i]!, label }));
  const answer = ids[shapeOptions.indexOf(shape)]!;
  const feedback: Record<string, string> = {};
  options.forEach((o) => {
    if (o.id !== answer)
      feedback[o.id] =
        o.label === "Square"
          ? `A square needs four equal sides. ${reason[plane].join(" ")}`
          : o.label === "Rectangle" && shape === "Square"
            ? `It is a rectangle, but all four sides are equal, so the most specific name is square. ${reason[plane].join(" ")}`
            : reason[plane].join(" ");
  });
  return {
    prompt: `A ${solidName} is ${dims}. A plane slices it ${planeText(plane, { l, w, u })}. What is the most specific name for the shape of the cross-section?`,
    answer,
    figure: {
      kind: "solid-section",
      solid,
      length: l,
      width: w,
      height: h,
      plane,
      unit: u,
    },
    response: { kind: "choice", label: "Choose the shape", options },
    choiceFeedback: feedback,
    explanation: [
      "A cross-section is the flat shape where a plane cuts through a solid. Each face the plane crosses adds one straight side.",
      ...reason[plane],
    ],
    tags: [solid, plane, shape.toLowerCase()],
  };
}

function sectionAreaCase(r: Random): Case {
  const [u, plural, squares] = pick(r, units);
  const plane = pick(r, [
    "parallel-base",
    "perpendicular-front",
    "perpendicular-side",
    "through-apex",
    "pyramid-half",
  ] as const);
  const l = r(3, 15),
    w = r(2, 12),
    h = r(3, 15);
  // Equal base edges would leave "parallel to the l edges" ambiguous.
  if (l === w) return sectionAreaCase(r);
  if (plane === "through-apex" && (l * h) % 2) return sectionAreaCase(r);
  if (plane === "pyramid-half" && (l % 2 || w % 2)) return sectionAreaCase(r);
  const solid =
    plane === "through-apex" || plane === "pyramid-half" ? "pyramid" : "prism";
  void plural;
  const prompt =
    solid === "prism"
      ? `A right rectangular prism is ${l} ${u} long, ${w} ${u} wide and ${h} ${u} tall. A plane slices it ${planeText(plane as Plane, { l, w, u })}. What is the area of the cross-section, in ${squares}?`
      : plane === "through-apex"
        ? `A right rectangular pyramid is ${h} ${u} tall, with a base ${l} ${u} long and ${w} ${u} wide. A plane slices it ${planeText("through-apex", { l, w, u })}. What is the area of the cross-section, in ${squares}?`
        : `A right rectangular pyramid is ${h} ${u} tall, with a base ${l} ${u} long and ${w} ${u} wide. A plane slices it parallel to its base, halfway between the base and the apex. What is the area of the cross-section, in ${squares}?`;
  let answer: number, explanation: string[];
  if (plane === "parallel-base") {
    answer = l * w;
    explanation = [
      `A slice parallel to the base copies the base: a ${l} ${u} by ${w} ${u} rectangle.`,
      `Area = ${l} × ${w} = ${answer} ${squares}.`,
    ];
  } else if (plane === "perpendicular-front") {
    answer = l * h;
    explanation = [
      `A vertical slice parallel to the ${l} ${u} edges of the base copies the faces that contain those edges: ${l} ${u} long and ${h} ${u} tall.`,
      `Area = ${l} × ${h} = ${answer} ${squares}.`,
    ];
  } else if (plane === "perpendicular-side") {
    answer = w * h;
    explanation = [
      `A vertical slice parallel to the ${w} ${u} edges of the base copies the faces that contain those edges: ${w} ${u} wide and ${h} ${u} tall.`,
      `Area = ${w} × ${h} = ${answer} ${squares}.`,
    ];
  } else if (plane === "through-apex") {
    answer = (l * h) / 2;
    explanation = [
      `The slice passes through the apex and the center of the base, parallel to the ${l} ${u} edge. It is a triangle whose base crosses the whole pyramid: ${l} ${u}.`,
      `Its top vertex is the apex, straight above the base's center, so the triangle's height is the pyramid's height, ${h} ${u}.`,
      `Area = ½ × ${l} × ${h} = ${answer} ${squares}.`,
    ];
  } else {
    answer = (l / 2) * (w / 2);
    explanation = [
      `Halfway up, the plane meets every slanted edge at its midpoint. Each side of the section joins two midpoints, so it is half as long as the base edge below it.`,
      `The section is a ${l / 2} ${u} by ${w / 2} ${u} rectangle.`,
      `Area = ${l / 2} × ${w / 2} = ${answer} ${squares}, one quarter of the base area ${l * w}.`,
    ];
  }
  return {
    prompt,
    answer: String(answer),
    figure: {
      kind: "solid-section",
      solid,
      length: l,
      width: w,
      height: h,
      plane: plane === "pyramid-half" ? "parallel-base" : plane,
      unit: u,
    },
    response: { kind: "number", label: `Area in ${squares}` },
    explanation,
    tags: [solid, plane],
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "angle-pair-measure": anglePairCase,
  "angle-equation": angleEquationCase,
  "triangle-angle-sum": triangleSumCase,
  "triangle-exterior-angle": exteriorCase,
  "parallel-lines-angle": parallelCase,
  "triangle-side-test": sideTestCase,
  "triangle-third-side": thirdSideCase,
  "triangle-conditions": conditionsCase,
  "cross-section-shape": sectionShapeCase,
  "cross-section-area": sectionAreaCase,
};

/** The first explanation step that works from this problem's stated numbers
 * without stating the answer; otherwise the template's teaching step with the givens. */
function instanceHint(id: string, c: Case): string {
  const values = (text: string): string[] =>
    text.replaceAll("−", "-").match(/(?<![\w.])-?\d+(?:\.\d+)?/g) ?? [];
  const given = new Set(values(c.prompt));
  const list = (v: string[]) =>
    v.length > 1 ? `${v.slice(0, -1).join(", ")} and ${v.at(-1)}` : v[0]!;
  switch (id) {
    case "parallel-lines-angle":
      return `Name the marked pair first: corresponding, alternate interior, or same-side interior angles? Equal pairs share the ${list([...given].filter((v) => !/^[a-z]$/.test(v)))}° measure; same-side interior angles add to 180°.`;
    case "triangle-conditions":
      return `Test the given parts, ${list([...given])}: do two angles leave room for a third, and are the two shorter sides together longer than the longest? If a triangle exists, ask whether these parts fix its size and shape.`;
    case "triangle-side-test": {
      const longest = /longest length is (\d+)/.exec(c.explanation[0]!)![1]!;
      return `Every set has the same longest length, ${longest}. In each set, add the two shorter lengths and compare the sum with ${longest}.`;
    }
    case "cross-section-shape":
      return `Each face the plane crosses adds one straight side to the cross-section. Decide which faces it crosses, then read each side's length from the dimensions ${list([...given])}.`;
  }
  const answer: string | null = c.response.kind === "choice" ? null : c.answer;
  for (const step of c.explanation) {
    const named = values(step);
    if (
      named.some((v) => given.has(v)) &&
      !(answer !== null && named.includes(answer) && !given.has(answer))
    )
      return step;
  }
  const stated = [...given].filter((v) => !c.explanation[0]!.includes(v));
  return stated.length
    ? `${c.explanation[0]} Use the given ${stated.length === 1 ? "value" : "values"} ${stated.join(" and ")}.`
    : hints[id]!;
}

export function angleTrianglePrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = angleTriangleTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown angle/triangle template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const c = builders[id]!(random(id, seed));
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response: c.response,
      ...(c.figure ? { figure: c.figure } : {}),
    },
    answer: c.answer,
    explanation: c.explanation,
    hint: instanceHint(id, c),
    ...(c.choiceFeedback ? { choiceFeedback: c.choiceFeedback } : {}),
  };
  return {
    problem,
    tags: c.tags,
    caseKey: JSON.stringify([c.prompt, c.figure ?? null, c.response]),
  };
}
export const generateAngleTriangleProblem = (
  id: string,
  seed: string,
): GeneratedProblem => angleTrianglePrintCase(id, seed).problem;
