import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

type Q = { n: number; d: number };
type Point = [Q, Q];
type Row = { a: number; b: number; c: Q };
type Random = (lo: number, hi: number) => number;
const gcd = (a: number, b: number): number => {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
};
function q(n: number, d = 1): Q {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact finite rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const eq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
const num = (a: Q) =>
  `${a.n < 0 ? "−" : ""}${Math.abs(a.n)}${a.d === 1 ? "" : `/${a.d}`}`;
const operand = (a: Q) => (a.n < 0 ? `(${num(a)})` : num(a));
const pair = (p: Point) => `(${num(p[0])}, ${num(p[1])})`;
const term = (a: number, variable: string) =>
  a === 1 ? variable : a === -1 ? `−${variable}` : `${num(q(a))}${variable}`;
function expression(a: number, b: number): string {
  if (a === 0) return term(b, "y");
  if (b === 0) return term(a, "x");
  return `${term(a, "x")} ${b < 0 ? "−" : "+"} ${term(Math.abs(b), "y")}`;
}
const equation = (r: Row) => `${expression(r.a, r.b)} = ${num(r.c)}`;
const scale = (r: Row, m: number): Row => ({
  a: r.a * m,
  b: r.b * m,
  c: mul(r.c, q(m)),
});
const evaluate = (r: Row, p: Point) =>
  add(mul(q(r.a), p[0]), mul(q(r.b), p[1]));
function random(id: string, seed: string): Random {
  let counter = 0;
  return (lo, hi) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return lo + (value % span);
  };
}
function shuffle<T>(items: T[], r: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = r(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
function line(p: Point, s: Point): Row {
  const a0 = sub(s[1], p[1]),
    b0 = sub(p[0], s[0]);
  const denominator = (a0.d * b0.d) / gcd(a0.d, b0.d);
  let a = a0.n * (denominator / a0.d),
    b = b0.n * (denominator / b0.d);
  const g = gcd(a, b);
  if (g === 0) throw new Error("Two distinct points define a line");
  a /= g;
  b /= g;
  if (a < 0 || (a === 0 && b < 0)) {
    a = -a;
    b = -b;
  }
  return { a, b, c: add(mul(q(a), p[0]), mul(q(b), p[1])) };
}
const small = (value: Q) => Math.abs(value.n) <= 96 && value.d <= 12;
const promptRow = (row: Row) =>
  Math.max(Math.abs(row.a), Math.abs(row.b)) <= 6 &&
  Math.abs(row.c.n) <= 48 &&
  row.c.d <= 4;
function multipliers(
  first: Row,
  second: Row,
  variable: "a" | "b",
): [number, number] {
  const g = gcd(first[variable], second[variable]);
  return [second[variable] / g, -first[variable] / g];
}
/** Check every possible target and row pair before any target is selected. */
function admissible(points: Point[], maxScale: 1 | 2): boolean {
  if (
    points.some((p) =>
      p.some((v) => Math.abs(v.n) > 12 || v.d > 4 || Math.abs(v.n) > 6 * v.d),
    )
  )
    return false;
  const lines: Row[][] = points.map((p, i) =>
    points.map((s, j) => (i === j ? { a: 0, b: 0, c: q(0) } : line(p, s))),
  );
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (j === i) continue;
      const row = lines[i]![j]!;
      for (let m = 1; m <= maxScale; m++) {
        const scaled = scale(row, m);
        if (!promptRow(scaled)) return false;
        for (const p of points) {
          const x = mul(q(scaled.a), p[0]),
            y = mul(q(scaled.b), p[1]);
          if (
            ![x, y, add(x, y), sub(scaled.c, x), sub(scaled.c, y)].every(small)
          )
            return false;
        }
      }
      for (let k = j + 1; k < 4; k++) {
        if (k === i) continue;
        const other = lines[i]![k]!;
        if (row.a * other.b === row.b * other.a) return false;
        for (let m = 1; m <= maxScale; m++)
          for (let n = 1; n <= maxScale; n++) {
            const first = scale(row, m),
              second = scale(other, n);
            for (const variable of ["a", "b"] as const) {
              if (!first[variable] || !second[variable]) continue;
              const [s, t] = multipliers(first, second, variable);
              if (Math.max(Math.abs(s), Math.abs(t)) > 6) return false;
              const f = scale(first, s),
                g = scale(second, t);
              if (
                ![
                  q(f.a),
                  q(f.b),
                  f.c,
                  q(g.a),
                  q(g.b),
                  g.c,
                  q(f.a + g.a),
                  q(f.b + g.b),
                  add(f.c, g.c),
                ].every(small)
              )
                return false;
            }
          }
      }
    }
  }
  return true;
}
function cohort(r: Random): { points: Point[]; maxScale: 1 | 2 } {
  for (let attempt = 0; attempt < 128; attempt++) {
    const d = r(1, 4),
      ox = r(-6, 6),
      oy = r(-6, 6);
    const ux = r(-3, 3),
      uy = r(-3, 3),
      vx = r(-3, 3),
      vy = r(-3, 3);
    if (ux * vy === uy * vx) continue;
    const points: Point[] = [
      [ox, oy],
      [ox + ux, oy + uy],
      [ox + vx, oy + vy],
      [ox + ux + vx, oy + uy + vy],
    ].map(([x, y]) => [q(x!, d), q(y!, d)]);
    if (!admissible(points, 1)) continue;
    return { points, maxScale: admissible(points, 2) ? 2 : 1 };
  }
  // A bounded fallback preserves the same uniform-target construction.
  const d = r(1, 2),
    points: Point[] = [
      [0, 0],
      [3, -2],
      [2, -3],
      [5, -5],
    ].map(([x, y]) => [q(x!, d), q(y!, d)]);
  if (!admissible(points, 1)) throw new Error("Invalid fallback cohort");
  return { points, maxScale: 1 };
}
function uniqueCase(r: Random) {
  const { points, maxScale } = cohort(r);
  const target = r(0, 3);
  const neighbors = shuffle(
    [0, 1, 2, 3].filter((i) => i !== target),
    r,
  );
  const rows = neighbors
    .slice(0, 2)
    .map((i) =>
      scale(
        line(points[target]!, points[i]!),
        r(1, maxScale) * (r(0, 1) ? 1 : -1),
      ),
    ) as [Row, Row];
  return { points, target, rows, solution: points[target]! };
}
function normalizedSystem(rows: Row[]): string {
  return rows
    .map((row) => {
      const g = gcd(row.a, row.b),
        sign = row.a < 0 || (row.a === 0 && row.b < 0) ? -1 : 1;
      return equation({
        a: (row.a / g) * sign,
        b: (row.b / g) * sign,
        c: mul(row.c, q(sign, g)),
      });
    })
    .sort()
    .join("; ");
}
function elimination(first: Row, second: Row) {
  const choices = (["a", "b"] as const)
    .filter((key) => first[key] !== 0 && second[key] !== 0)
    .map((key) => {
      const [m, n] = multipliers(first, second, key);
      return { key, m, n, cost: Math.abs(m) + Math.abs(n) };
    });
  return choices.sort(
    (a, b) => a.cost - b.cost || a.key.localeCompare(b.key),
  )[0]!;
}
const signedSum = (a: Q, b: Q) =>
  `${num(a)} ${b.n < 0 ? "−" : "+"} ${num(q(Math.abs(b.n), b.d))}`;
function checkLine(row: Row, p: Point, name: string): string {
  const x = mul(q(row.a), p[0]),
    y = mul(q(row.b), p[1]);
  const products = [
    row.a ? `${operand(q(row.a))} × ${operand(p[0])}` : "",
    row.b ? `${operand(q(row.b))} × ${operand(p[1])}` : "",
  ]
    .filter(Boolean)
    .join(" + ");
  const total = evaluate(row, p);
  return `Check the ${name} equation: ${products}${row.a && row.b ? ` = ${signedSum(x, y)}` : ""} = ${num(total)}${eq(total, row.c) ? `, matching ${num(row.c)}` : `, not ${num(row.c)}`}.`;
}
function uniqueSteps(rows: [Row, Row], solution: Point): string[] {
  const steps: string[] = [];
  let known: 0 | 1;
  const directIndex = rows.findIndex((row) => row.a === 0 || row.b === 0);
  if (directIndex >= 0) {
    const row = rows[directIndex]!;
    known = row.a === 0 ? 1 : 0;
    const coefficient = known === 0 ? row.a : row.b,
      variable = known === 0 ? "x" : "y";
    steps.push(
      `The ${directIndex === 0 ? "first" : "second"} equation contains only ${variable}: ${equation(row)}. ${coefficient === 1 ? `It gives ${variable} = ${num(solution[known])}` : `Divide both sides by ${num(q(coefficient))}: ${variable} = ${operand(row.c)} ÷ ${operand(q(coefficient))} = ${num(solution[known])}`}.`,
    );
  } else {
    const { key, m, n } = elimination(...rows),
      first = scale(rows[0], m),
      second = scale(rows[1], n);
    known = key === "a" ? 1 : 0;
    const variable = known === 0 ? "x" : "y",
      coefficient = known === 0 ? first.a + second.a : first.b + second.b,
      constant = add(first.c, second.c);
    steps.push(
      `Eliminate ${key === "a" ? "x" : "y"} by making its coefficients opposites. ${m === 1 ? `Keep the first equation: ${equation(first)}` : `Multiply every term in the first equation by ${num(q(m))}: ${equation(first)}`}.`,
    );
    steps.push(
      `${n === 1 ? "Keep the second equation" : `Multiply every term in the second equation by ${num(q(n))}`}: ${equation(second)}.`,
    );
    steps.push(
      `Add corresponding sides of the two equations. The ${key === "a" ? "x" : "y"} terms cancel: ${term(coefficient, variable)} = ${signedSum(first.c, second.c)} = ${num(constant)}. Keep an original equation to recover the other coordinate.`,
    );
    if (coefficient !== 1)
      steps.push(
        `Divide both sides by ${num(q(coefficient))}: ${variable} = ${operand(constant)} ÷ ${operand(q(coefficient))} = ${num(solution[known])}.`,
      );
  }
  const other = (1 - known) as 0 | 1,
    variable = other === 0 ? "x" : "y",
    knownVariable = known === 0 ? "x" : "y";
  const rowIndex = rows.findIndex((row) => (other === 0 ? row.a : row.b) !== 0),
    row = rows[rowIndex]!;
  const coefficient = other === 0 ? row.a : row.b,
    knownCoefficient = known === 0 ? row.a : row.b;
  const product = mul(q(knownCoefficient), solution[known]),
    remainder = sub(row.c, product);
  if (knownCoefficient !== 0) {
    steps.push(
      `Substitute ${knownVariable} = ${num(solution[known])} in the original ${rowIndex === 0 ? "first" : "second"} equation, ${equation(row)}. Its ${knownVariable} term is ${num(q(knownCoefficient))} × ${operand(solution[known])} = ${num(product)}.`,
    );
    steps.push(
      `${product.n < 0 ? "Add" : "Subtract"} ${num(q(Math.abs(product.n), product.d))} ${product.n < 0 ? "to" : "from"} both sides: ${term(coefficient, variable)} = ${num(row.c)} ${product.n < 0 ? "+" : "−"} ${num(q(Math.abs(product.n), product.d))} = ${num(remainder)}.`,
    );
  } else
    steps.push(
      `The original ${rowIndex === 0 ? "first" : "second"} equation contains only ${variable}: ${equation(row)}.`,
    );
  if (coefficient !== 1)
    steps.push(
      `Divide both sides by ${num(q(coefficient))}: ${variable} = ${operand(remainder)} ÷ ${operand(q(coefficient))} = ${num(solution[other])}.`,
    );
  steps.push(
    `Write x first and y second: ${pair(solution)}.`,
    checkLine(rows[0], solution, "first"),
    checkLine(rows[1], solution, "second"),
  );
  return steps;
}
export const linearSystemTemplates: readonly TemplateMetadata[] = [
  {
    id: "linear-system-pair",
    title: "Solve for both coordinates",
    description:
      "Find the exact ordered pair satisfying two linear equations, including fractional coordinates and axis-aligned lines.",
  },
  {
    id: "linear-system-solution-count",
    title: "Count a linear system’s solutions",
    description:
      "Distinguish one, no, and infinitely many shared ordered pairs in two linear equations.",
  },
].map((t) => ({
  ...t,
  version: 1,
  skillId: "linear-systems",
  gradeBand: "6–8",
  requiredResponseCapability: "single-choice-v1",
}));
const countLabels = [
  "Exactly one ordered pair",
  "No ordered pairs",
  "Infinitely many ordered pairs",
];
function generateCase(
  templateId: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; systemKey: string } {
  const metadata = linearSystemTemplates.find((t) => t.id === templateId);
  if (!metadata)
    throw new Error(`Unknown linear-system template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed),
    isPair = templateId === "linear-system-pair";
  const outcome = isPair ? 0 : r(0, 2);
  const tags: string[] = [
    outcome === 0 ? "unique" : outcome === 1 ? "none" : "infinite",
  ];
  let rows: [Row, Row], explanation: string[], hint: string;
  let candidates: { label: string; correct: boolean; feedback: string }[];
  if (outcome === 0) {
    const data = uniqueCase(r);
    rows = data.rows;
    const [x, y] = data.solution;
    tags.push(
      x.n === 0 && y.n === 0
        ? "origin"
        : x.n === 0
          ? "y-axis"
          : y.n === 0
            ? "x-axis"
            : `quadrant:${x.n > 0 ? (y.n > 0 ? 1 : 4) : y.n > 0 ? 2 : 3}`,
    );
    tags.push(`fractional-coordinates:${Number(x.d > 1) + Number(y.d > 1)}`);
    if (rows.some((row) => row.a === 0 || row.b === 0))
      tags.push("axis-aligned");
    else {
      const { m, n } = elimination(...rows);
      if (Math.abs(m) > 1 && Math.abs(n) > 1) tags.push("scale-both");
    }
    explanation = uniqueSteps(rows, data.solution);
    hint =
      "An ordered pair lists x first and y second. The same pair must make both equations true. Isolate a variable, or multiply whole equations to make one pair of coefficients opposites and add the equations.";
    candidates = isPair
      ? data.points.map((point, i) => ({
          label: pair(point),
          correct: i === data.target,
          feedback: `${checkLine(rows[0], point, "first")} ${checkLine(rows[1], point, "second")} A solution must satisfy both equations.`,
        }))
      : countLabels.map((label, i) => ({
          label,
          correct: i === 0,
          feedback: `The equations fix x = ${num(x)} and y = ${num(y)}. ${pair(data.solution)} satisfies both, so there is exactly one shared pair.`,
        }));
    if (!isPair)
      explanation.push(
        "Both coordinates are fixed, and the checks satisfy both equations. There is exactly one ordered-pair solution.",
      );
  } else {
    const direction = r(0, 3);
    const a = direction === 0 ? 0 : r(1, 3) * (r(0, 1) ? 1 : -1);
    const b = direction === 1 ? 0 : r(1, 3) * (r(0, 1) ? 1 : -1);
    const denominator = r(1, 4),
      base: Row = { a, b, c: q(r(-12, 12), denominator) };
    const m = r(1, 2) * (r(0, 1) ? 1 : -1),
      n = r(1, 2) * (r(0, 1) ? 1 : -1);
    const first = scale(base, m),
      second = scale(base, n);
    if (outcome === 1)
      second.c = add(second.c, q(r(1, 6) * (r(0, 1) ? 1 : -1), denominator));
    rows = [first, second];
    tags.push(
      m * n < 0 ? "negative-proportionality" : "positive-proportionality",
    );
    if (!a || !b) tags.push("axis-aligned", !a ? "horizontal" : "vertical");
    else tags.push("oblique");
    if (equation(first) === equation(second)) tags.push("duplicate-equations");
    else if (outcome === 2) tags.push("differently-written");
    const { m: s, n: t } = elimination(first, second),
      scaledFirst = scale(first, s),
      scaledSecond = scale(second, t),
      remaining = add(scaledFirst.c, scaledSecond.c);
    explanation = [
      `${s === 1 ? "Keep the first equation" : `Multiply every term in the first equation by ${num(q(s))}`}: ${equation(scaledFirst)}.`,
      `${t === 1 ? "Keep the second equation" : `Multiply every term in the second equation by ${num(q(t))}`}: ${equation(scaledSecond)}.`,
      `Add corresponding sides. The variable terms cancel: 0 = ${signedSum(scaledFirst.c, scaledSecond.c)} = ${num(remaining)}.`,
      outcome === 1
        ? `Zero does not equal ${num(remaining)}. This contradiction means no pair can satisfy both original equations. Their lines are parallel and distinct.`
        : `The equality 0 = 0 is true. The second equation is a nonzero multiple of the first, so both describe the same line, ${equation(first)}. Every pair on that line satisfies both equations. There are infinitely many such pairs; pairs off that line are not solutions.`,
    ];
    hint =
      "Scale whole equations so one pair of variable coefficients are opposites, then add. A false numerical equality means no shared pairs. If both variable terms cancel to a true equality, retain an original equation: its line contains the solutions.";
    candidates = countLabels.map((label, i) => ({
      label,
      correct: i === outcome,
      feedback:
        outcome === 1
          ? `Combining the equations gives 0 = ${num(remaining)}, which is false. There is no shared pair.`
          : `The equations describe the same line. Infinitely many pairs on that line work, but pairs off the line do not.`,
    }));
  }
  const options = shuffle(candidates, r).map((candidate, i) => ({
    ...candidate,
    id: `option-${i + 1}`,
  }));
  return {
    tags,
    systemKey: normalizedSystem(rows),
    problem: {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([templateId, 1, seed]))
          .digest("hex"),
        templateId,
        templateVersion: 1,
        seed,
        skillId: metadata.skillId,
        prompt: `${isPair ? "Which ordered pair (x, y) satisfies" : "How many ordered pairs (x, y) satisfy"} both equations for real x and y: ${equation(rows[0])}; ${equation(rows[1])}?`,
        response: {
          kind: "choice",
          label: isPair
            ? "Choose the ordered pair"
            : "Choose the number of solutions",
          options: options.map(({ id, label }) => ({ id, label })),
        },
      },
      answer: options.find((option) => option.correct)!.id,
      hint,
      explanation,
      choiceFeedback: Object.fromEntries(
        options
          .filter((option) => !option.correct)
          .map((option) => [option.id, option.feedback]),
      ),
    },
  };
}
export const generateLinearSystemProblem = (
  templateId: string,
  seed: string,
): GeneratedProblem => generateCase(templateId, seed).problem;
/** Private worksheet selection metadata; never sent in the public problem. */
export const linearSystemPrintCase = (templateId: string, seed: string) =>
  generateCase(templateId, seed);
