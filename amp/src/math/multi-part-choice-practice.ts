import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import { valueTable } from "./exponential-scenes";
import { graph, scene as sceneOf } from "./scene/author";
import {
  serializeMultiPart,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
  type MultiPartSentence,
  type PartOption,
} from "./multi-part-choice";

/** Families answered by choosing one option for each of several blanks
 * (multi-part-choice-v1): a sentence with blanks, a match table, and
 * labeled slots. */
const parts = { requiredResponseCapability: "multi-part-choice-v1" as const };
export const multiPartChoiceTemplates: readonly TemplateMetadata[] = [
  {
    id: "inline-linear-features",
    version: 1,
    title: "Complete a line’s slope and intercept",
    skillId: "linear-models",
    gradeBand: "6–8",
    ...parts,
    // Lines are drawn on a grid or given as a table of values.
    requiredFigureCapability: "scenes-v1",
    description:
      "Complete a sentence about a line given by a graph, two points or a table, choosing its slope, its $y$-intercept and whether it increases, or $m$ and $b$ in $y = mx + b$.",
  },
  {
    id: "proportional-match-table",
    version: 1,
    title: "Sort relationships as proportional or not",
    skillId: "proportional-relationships",
    gradeBand: "6–8",
    ...parts,
    description:
      "Mark each of four or five equations or sets of pairs as proportional or not proportional, including equations that simplify to $y = kx$ and linear relationships with a nonzero intercept.",
  },
  {
    id: "label-expression-parts",
    version: 1,
    title: "Label the parts of an expression",
    skillId: "variable-expressions",
    gradeBand: "6–8",
    ...parts,
    description:
      "Label the terms, coefficients, exponent, constant term and factors of a linear or quadratic expression, or of a product with a sum as a factor.",
  },
];

const letters = ["a", "b", "c", "d", "e", "f"] as const;
/** Options in their given order, ids by position: an id says nothing about
 * which option is correct once the order is shuffled. */
const optionsOf = (labels: readonly string[]): PartOption[] =>
  labels.map((label, i) => ({ id: letters[i]!, label }));

function problemOf(
  meta: TemplateMetadata,
  seed: string,
  parts: {
    prompt: string;
    response: MultiPartChoiceResponse;
    /** Correct option label for each blank, in blank order. */
    correct: readonly string[];
    figure?: SemanticFigure;
    explanation: string[];
    hint: string;
  },
): GeneratedProblem {
  const key = Object.fromEntries(
    parts.response.blanks.map((b, i) => {
      const option = b.options.find((o) => o.label === parts.correct[i]);
      if (!option) throw new Error(`No correct option for blank ${b.id}`);
      return [b.id, option.id];
    }),
  );
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: parts.prompt,
      skillId: meta.skillId,
      response: parts.response,
      ...(parts.figure ? { figure: parts.figure } : {}),
    },
    answer: serializeMultiPart(parts.response, key),
    explanation: parts.explanation,
    hint: parts.hint,
  };
}
/** The first `count` distinct values, correct one first, then shuffled. */
function pick(
  r: Random,
  candidates: readonly string[],
  count: number,
): string[] {
  const unique = [...new Set(candidates)].slice(0, count);
  if (unique.length < count) throw new Error("Not enough distinct options");
  return shuffle(r, unique);
}

/* ---------- exact rationals ---------- */
type Q = { n: number; d: number };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
function q(n: number, d = 1): Q {
  if (d === 0) throw new Error("Zero denominator");
  const g = gcd(n, d) || 1,
    s = d < 0 ? -1 : 1;
  return { n: (s * n) / g + 0, d: (s * d) / g };
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const neg = (a: Q) => q(-a.n, a.d);
const inv = (a: Q) => q(a.d, a.n);
/** Bare TeX of a rational: "-3", "\\frac{2}{3}", "-\\frac{1}{2}". */
const texOf = (v: Q) =>
  v.d === 1
    ? `${v.n}`
    : `${v.n < 0 ? "-" : ""}\\frac{${Math.abs(v.n)}}{${v.d}}`;
/** A value as learners read it: a whole number in plain text with a true
 * minus sign (print and screen both typeset it), a fraction in TeX. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const math = (v: Q) => (v.d === 1 ? signed(v.n) : `$${texOf(v)}$`);
/** A signed integer inside a formula: parentheses around negatives. */
const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const pair = (x: number, y: number) => `(${x}, ${y})`;
/** A point in prose, outside TeX: "(−3, 4)". */
const point = (x: number, y: number) => `(${signed(x)}, ${signed(y)})`;
const parenQ = (v: Q) => (v.n < 0 ? `(${texOf(v)})` : texOf(v));

/* ---------- complete a line's features (grade 8) ---------- */
const slopeChoices: Q[] = [
  ...[1, 2, 3].flatMap((n) => [q(n), q(-n)]),
  ...[
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 2],
  ].flatMap(([n, d]) => [q(n!, d!), q(-n!, d!)]),
];
type Source = "graph" | "points" | "table";
/** A −6..6 grid with the line through A and B drawn and both points named. */
function lineScene(a: readonly [number, number], b: readonly [number, number]) {
  const plot = graph({
    x: [-6, 6],
    y: [-6, 6],
    grid: 1,
    tick: 1,
    aspect: 1,
    axisNames: ["x", "y"],
  })
    .id("plot")
    .line({ through: [[...a], [...b]] }, { color: "accent" })
    .point(a[0], a[1], "A", { color: "ink" })
    .point(b[0], b[1], "B", { color: "ink" });
  return sceneOf(plot).build({
    title: "A line through points A and B on a coordinate grid",
    width: 420,
    maxHeight: 420,
  });
}
function inlineLinearFeatures(seed: string): GeneratedProblem {
  const meta = multiPartChoiceTemplates[0]!;
  const r = random(meta.id, seed);
  const m = slopeChoices[r(0, slopeChoices.length - 1)]!;
  let b = r(1, 5) * (r(0, 1) ? 1 : -1);
  const source: Source = (["graph", "points", "table"] as const)[r(0, 2)]!;
  const form = r(0, 1) ? "features" : "equation";
  const y = (x: number) => add(mul(m, q(x)), q(b));
  // Lattice points of the line in a window that leaves room for labels.
  const lattice = (limit: number) =>
    Array.from({ length: 2 * limit + 1 }, (_, i) => i - limit)
      .filter((x) => (x * m.n) % m.d === 0)
      .map((x) => [x, y(x).n] as const)
      .filter(([, v]) => Math.abs(v) <= limit);
  let points: (readonly [number, number])[] = [];
  let figure: SemanticFigure | undefined;
  let given: string;
  if (source === "table") {
    // Four rows, evenly spaced; half the tables skip x = 0.
    const step = m.d * (m.d === 1 && r(0, 1) ? 2 : 1);
    const start = step * (r(0, 1) ? r(-2, -1) : r(1, 2));
    points = [0, 1, 2, 3].map((i) => {
      const x = start + i * step;
      return [x, y(x).n] as const;
    });
    figure = {
      kind: "scene",
      scene: valueTable(
        "x",
        ["y"],
        points.map(([x, v]) => [x, v]),
      ).scene({ title: "A table of four points on a line" }),
    };
    given = "The table shows four points on a line.";
  } else {
    // Two lattice points; the graph keeps them inside −5..5.
    let candidates = lattice(5);
    while (candidates.length < 3) {
      b = b > 0 ? b - 1 || -1 : b + 1 || 1;
      candidates = lattice(5);
    }
    const offAxis = candidates.filter(([x]) => x !== 0);
    // Two of three items give no point on the y-axis.
    const pool = r(0, 2) && offAxis.length >= 2 ? offAxis : candidates;
    const i = r(0, pool.length - 1);
    let j = r(0, pool.length - 2);
    if (j >= i) j++;
    points = [pool[Math.min(i, j)]!, pool[Math.max(i, j)]!];
    if (source === "graph") {
      figure = { kind: "scene", scene: lineScene(points[0]!, points[1]!) };
      given = `The graph shows a line through $A${pair(...points[0]!)}$ and $B${pair(...points[1]!)}$.`;
    } else
      given = `A line passes through the points ${point(...points[0]!)} and ${point(...points[1]!)}.`;
  }
  const [p1, p2] = [points[0]!, points.at(-1)!];
  const onAxis = points.find(([x]) => x === 0);
  // Slope distractors: opposite sign, run over rise, the intercept.
  const slopeLabels = pick(
    r,
    [m, neg(m), inv(m), q(b), neg(inv(m)), add(m, q(1)), add(m, q(-1))].map(
      math,
    ),
    4,
  );
  // Intercept distractors: opposite sign, the first listed y-value, the
  // x-intercept, the slope.
  const interceptLabels = pick(
    r,
    [
      q(b),
      q(-b),
      ...(p1[0] !== 0 ? [q(p1[1])] : []),
      q(-b * m.d, m.n),
      m,
      q(b + 1),
      q(b - 1),
    ].map(math),
    4,
  );
  const directions = ["increases", "decreases", "stays the same"];
  const direction = m.n > 0 ? "increases" : "decreases";
  const blanks: MultiPartBlank[] =
    form === "features"
      ? [
          { id: "slope", label: "the slope", options: optionsOf(slopeLabels) },
          {
            id: "int",
            label: "the $y$-intercept",
            options: optionsOf(interceptLabels),
          },
          {
            id: "dir",
            label: "the direction of change",
            options: optionsOf(directions),
          },
        ]
      : [
          { id: "m", label: "$m$", options: optionsOf(slopeLabels) },
          { id: "b", label: "$b$", options: optionsOf(interceptLabels) },
        ];
  const sentence: MultiPartSentence =
    form === "features"
      ? [
          { text: "The slope of the line is " },
          { blank: "slope" },
          { text: ", its $y$-intercept is " },
          { blank: "int" },
          { text: ", and as $x$ increases, $y$ " },
          { blank: "dir" },
          { text: "." },
        ]
      : [
          { text: "In the line’s equation $y = mx + b$, $m =$ " },
          { blank: "m" },
          { text: " and $b =$ " },
          { blank: "b" },
          { text: "." },
        ];
  const dy = p2[1] - p1[1],
    dx = p2[0] - p1[0];
  const steps = [
    `The slope is the change in $y$ divided by the change in $x$. From ${point(...p1)} to ${point(...p2)}: $m = \\frac{${p2[1]} - ${paren(p1[1])}}{${p2[0]} - ${paren(p1[0])}} = ${dx === 1 ? dy : `\\frac{${dy}}{${dx}}`}${dx === 1 || (dx === m.d && dy === m.n && dy > 0) ? "" : ` = ${texOf(m)}`}$.`,
    onAxis
      ? `The point ${point(...onAxis)} is on the $y$-axis, so the $y$-intercept is $b = ${b}$.`
      : `Substitute ${point(...p1)} into $y = mx + b$: $${p1[1]} = ${texOf(m)} \\cdot ${paren(p1[0])} + b$, so $b = ${p1[1]} - ${parenQ(mul(m, q(p1[0])))} = ${b}$.`,
    form === "features"
      ? `The slope is ${m.n > 0 ? "positive" : "negative"}, so $y$ ${direction} as $x$ increases.`
      : `The equation is $y = ${texOf(m) === "1" ? "" : texOf(m) === "-1" ? "-" : texOf(m)}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}$.`,
  ];
  const hint =
    source === "graph"
      ? `Read where the line crosses the $y$-axis for the $y$-intercept. For the slope, count the rise and the run from $A${pair(...p1)}$ to $B${pair(...p2)}$.`
      : source === "table"
        ? `Take the rows for $x = ${p1[0]}$ and $x = ${p2[0]}$: the slope is the change in $y$ divided by the change in $x$. Then work back to $x = 0$ to find the $y$-intercept.`
        : `Divide the change in $y$ by the change in $x$ from ${point(...p1)} to ${point(...p2)} for the slope. Then put one point and the slope into $y = mx + b$ to find $b$.`;
  return problemOf(meta, seed, {
    prompt: `${given} Complete the sentence about the line.`,
    response: {
      kind: "multi-part-choice",
      label: "Choose an option for each blank",
      layout: "inline",
      blanks,
      sentence,
    },
    correct:
      form === "features"
        ? [math(m), math(q(b)), direction]
        : [math(m), math(q(b))],
    ...(figure ? { figure } : {}),
    explanation: steps,
    hint,
  });
}

/* ---------- proportional or not (grade 7) ---------- */
type Row = { label: string; proportional: boolean; why: string };
const term = (k: number, v = "x") =>
  k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`;
const proportionalRows: ((r: Random) => Row)[] = [
  (r) => {
    const k = r(2, 9);
    return {
      label: `$y = ${k}x$`,
      proportional: true,
      why: `It has the form $y = kx$ with $k = ${k}$.`,
    };
  },
  (r) => {
    const k = r(2, 6);
    return {
      label: `$y = \\frac{x}{${k}}$`,
      proportional: true,
      why: `Dividing by ${k} is multiplying by $\\frac{1}{${k}}$, so $y = \\frac{1}{${k}}x$.`,
    };
  },
  (r) => {
    const [n, d] = [
      [2, 3],
      [3, 4],
      [3, 2],
      [5, 2],
    ][r(0, 3)]!;
    return {
      label: `$y = \\frac{${n}}{${d}}x$`,
      proportional: true,
      why: `It has the form $y = kx$ with $k = \\frac{${n}}{${d}}$.`,
    };
  },
  (r) => {
    const k = r(2, 5),
      c = r(1, 4);
    return {
      label: `$y = ${k}(x + ${c}) - ${k * c}$`,
      proportional: true,
      why: `It simplifies to $y = ${k}x + ${k * c} - ${k * c} = ${k}x$.`,
    };
  },
  (r) => {
    const a = r(2, 4),
      k = r(2, 4);
    return {
      label: `$${a}y = ${a * k}x$`,
      proportional: true,
      why: `Dividing both sides by ${a} gives $y = ${k}x$.`,
    };
  },
  (r) => {
    const k = r(2, 6),
      xs = shuffle(r, [1, 2, 3, 4, 5])
        .slice(0, 3)
        .sort((a, b) => a - b);
    return {
      label: xs.map((x) => point(x, k * x)).join(", "),
      proportional: true,
      why: `Every pair has $\\frac{y}{x} = ${k}$.`,
    };
  },
];
const otherRows: ((r: Random) => Row)[] = [
  (r) => {
    const k = r(2, 9),
      c = r(1, 9);
    return {
      label: `$y = ${k}x + ${c}$`,
      proportional: false,
      why: `When $x = 0$, $y = ${c}$, not 0, so the line misses the origin.`,
    };
  },
  (r) => {
    const k = r(2, 9),
      c = r(1, 9);
    return {
      label: `$y = ${k}x - ${c}$`,
      proportional: false,
      why: `When $x = 0$, $y = -${c}$, not 0, so the line misses the origin.`,
    };
  },
  (r) => {
    const k = r(2, 5),
      c = r(1, 4);
    return {
      label: `$y = ${k}(x + ${c})$`,
      proportional: false,
      why: `It simplifies to $y = ${k}x + ${k * c}$; when $x = 0$, $y = ${k * c}$.`,
    };
  },
  (r) => {
    const k = r(1, 3);
    return {
      label: `$y = ${term(k, "x^2")}$`,
      proportional: false,
      why: `$\\frac{y}{x} = ${term(k)}$ changes with $x$: $x = 1$ gives $y = ${k}$ and $x = 2$ gives $y = ${4 * k}$, not twice as much.`,
    };
  },
  (r) => {
    const k = [6, 12, 18, 24][r(0, 3)]!;
    return {
      label: `$y = \\frac{${k}}{x}$`,
      proportional: false,
      why: `As $x$ doubles, $y$ halves, so $\\frac{y}{x}$ is not constant.`,
    };
  },
  (r) => {
    const k = r(2, 4),
      c = r(1, 5),
      xs = [1, 2, 3];
    return {
      label: xs.map((x) => point(x, k * x + c)).join(", "),
      proportional: false,
      why: `$\\frac{${k + c}}{1} \\ne \\frac{${2 * k + c}}{2}$, so the ratio $\\frac{y}{x}$ is not constant.`,
    };
  },
];
function proportionalMatchTable(seed: string): GeneratedProblem {
  const meta = multiPartChoiceTemplates[1]!;
  const r = random(meta.id, seed);
  const count = r(4, 5);
  const yes = r(1, count - 1);
  const draw = (makers: ((r: Random) => Row)[], n: number) =>
    shuffle(r, [...makers])
      .slice(0, n)
      .map((make) => make(r));
  const rows = shuffle(r, [
    ...draw(proportionalRows, yes),
    ...draw(otherRows, count - yes),
  ]);
  if (new Set(rows.map((row) => row.label)).size !== rows.length)
    throw new Error("Rows must differ");
  const columns = optionsOf(["Proportional", "Not proportional"]);
  return problemOf(meta, seed, {
    prompt:
      "Decide whether each relationship between $x$ and $y$ is proportional.",
    response: {
      kind: "multi-part-choice",
      label: "Choose one column in each row",
      layout: "table",
      rowHeader: "Relationship",
      blanks: rows.map((row, i) => ({
        id: `r${i + 1}`,
        label: row.label,
        options: columns,
      })),
    },
    correct: rows.map((row) =>
      row.proportional ? "Proportional" : "Not proportional",
    ),
    hint: `A proportional relationship can be written as $y = kx$: every pair has the same ratio $\\frac{y}{x}$, and $x = 0$ gives $y = 0$. Start with ${rows[0]!.label}: simplify it, or compare its ratios, before you decide.`,
    explanation: [
      "Proportional means $y = kx$ for one constant $k$: the ratio $\\frac{y}{x}$ never changes and the graph is a line through the origin.",
      ...rows.map(
        (row) =>
          `${row.label}: ${row.proportional ? "proportional" : "not proportional"}. ${row.why}`,
      ),
    ],
  });
}

/* ---------- label the parts of an expression (grade 6) ---------- */
function distinct(
  r: Random,
  count: number,
  lo: number,
  hi: number,
  not: number[] = [],
) {
  const values = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(
    (v) => !not.includes(v),
  );
  return shuffle(r, values).slice(0, count);
}
function labelExpressionParts(seed: string): GeneratedProblem {
  const meta = multiPartChoiceTemplates[2]!;
  const r = random(meta.id, seed);
  const form = r(0, 2);
  const slot = (id: string, label: string, pool: readonly string[]) => ({
    id,
    label,
    options: optionsOf(pool),
  });
  if (form === 0) {
    // ax + by + c: coefficients, a term and the constant.
    const [a, b, c] = distinct(r, 3, 2, 9) as [number, number, number];
    const [u, v] = (
      [
        ["x", "y"],
        ["m", "n"],
        ["p", "q"],
      ] as const
    )[r(0, 2)]!;
    const expression = `${a}${u} + ${b}${v} + ${c}`;
    // One shared pool of tiles, as a drag-into-slots item has.
    const pool = shuffle(r, [
      `${a}`,
      `${b}`,
      `${c}`,
      `$${u}$`,
      `$${a}${u}$`,
      `$${b}${v}$`,
    ]);
    return problemOf(meta, seed, {
      prompt: `Label the parts of the expression $${expression}$.`,
      response: {
        kind: "multi-part-choice",
        label: "Choose the part that matches each label",
        layout: "slots",
        blanks: [
          slot("coef", `the coefficient of $${u}$`, pool),
          slot("term", `the term containing $${v}$`, pool),
          slot("const", "the constant term", pool),
          slot("count", "the number of terms", ["2", "3", "4"]),
        ],
      },
      correct: [`${a}`, `$${b}${v}$`, `${c}`, "3"],
      hint: `The terms of $${expression}$ are the parts joined by $+$. A coefficient is the number that multiplies a variable, and the constant term has no variable.`,
      explanation: [
        `The terms are the parts joined by $+$: $${a}${u}$, $${b}${v}$ and ${c}, so there are 3 terms.`,
        `The coefficient of $${u}$ is the number multiplying it: ${a}.`,
        `The term containing $${v}$ is the whole term $${b}${v}$; its coefficient is ${b}.`,
        `The constant term has no variable: ${c}.`,
      ],
    });
  }
  if (form === 1) {
    // ax² + bx + c: the exponent is not a coefficient.
    const [a, b, c] = distinct(r, 3, 3, 9) as [number, number, number];
    const expression = `${a}x^2 + ${b}x + ${c}`;
    const pool = shuffle(r, [`${a}`, `${b}`, `${c}`, "2", "$x^2$", `$${b}x$`]);
    return problemOf(meta, seed, {
      prompt: `Label the parts of the expression $${expression}$.`,
      response: {
        kind: "multi-part-choice",
        label: "Choose the part that matches each label",
        layout: "slots",
        blanks: [
          slot("coefsq", "the coefficient of $x^2$", pool),
          slot("power", `the exponent in $${a}x^2$`, pool),
          slot("coef", "the coefficient of $x$", pool),
          slot("const", "the constant term", pool),
        ],
      },
      correct: [`${a}`, "2", `${b}`, `${c}`],
      hint: `In the term $${a}x^2$, the coefficient multiplies the power and the exponent says how many factors of $x$ there are. The constant term of $${expression}$ has no variable.`,
      explanation: [
        `The terms are $${a}x^2$, $${b}x$ and ${c}.`,
        `In $${a}x^2$, the coefficient is ${a} and the exponent is 2: $${a}x^2 = ${a} \\cdot x \\cdot x$.`,
        `The coefficient of $x$ is ${b}, from the term $${b}x$.`,
        `The constant term has no variable: ${c}.`,
      ],
    });
  }
  // a(x + c): a product whose second factor is a sum.
  const [a, c] = distinct(r, 2, 2, 9) as [number, number];
  const v = ["x", "n", "k"][r(0, 2)]!;
  const expression = `${a}(${v} + ${c})`;
  return problemOf(meta, seed, {
    prompt: `Label the parts of the expression $${expression}$.`,
    response: {
      kind: "multi-part-choice",
      label: "Choose the part that matches each label",
      layout: "slots",
      blanks: [
        slot(
          "whole",
          "the kind of expression",
          shuffle(r, ["sum", "product", "quotient", "difference"]),
        ),
        slot(
          "sum",
          "the factor that is a sum",
          shuffle(r, [`${a}`, `$${v} + ${c}$`, `$${v}$`, `${c}`]),
        ),
        slot("count", "the number of terms in the sum", ["1", "2", "3"]),
      ],
    },
    correct: ["product", `$${v} + ${c}$`, "2"],
    hint: `In $${expression}$, the number ${a} written next to the parentheses multiplies them. Decide what the last operation is, then look inside the parentheses.`,
    explanation: [
      `$${expression}$ means $${a} \\cdot (${v} + ${c})$: the last operation is multiplication, so it is a product of two factors, ${a} and $(${v} + ${c})$.`,
      `The factor $(${v} + ${c})$ is a sum.`,
      `That sum has 2 terms, $${v}$ and ${c}.`,
    ],
  });
}

export function generateMultiPartChoiceProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  switch (templateId) {
    case "inline-linear-features":
      return inlineLinearFeatures(seed);
    case "proportional-match-table":
      return proportionalMatchTable(seed);
    case "label-expression-parts":
      return labelExpressionParts(seed);
  }
  throw new Error(`Unknown multi-part choice family ${templateId}`);
}
