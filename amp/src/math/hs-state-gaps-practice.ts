import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice";

/**
 * High-school state-standard gaps: three-variable systems, quadratic
 * inequalities, conditional logic, cube-root equations, polar graphs and
 * conic sections cut from a cone. Every case keeps a private exact model; only
 * the prompt, shuffled choices and feedback are public.
 */
const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  description,
});

export const hsStateGapTemplates: readonly TemplateMetadata[] = [
  meta(
    "gauss-3x3-solve",
    "Solve a three-variable system by elimination",
    "linear-systems",
    0.9,
    "Solve a 3×3 linear system with an integer solution, choose the row operation that eliminates a variable, finish a back-substitution, or decide whether a system has one, no or infinitely many solutions.",
  ),
  meta(
    "quadratic-inequality-interval",
    "Solve a quadratic inequality",
    "quadratic-equations",
    0.7,
    "Use the zeros and the sign of the leading coefficient to write the solution set of a quadratic inequality in interval notation, including endpoint inclusion, rearranged forms, and no-sign-change cases.",
  ),
  meta(
    "conditional-statements",
    "Conditionals, converses and compound truth values",
    "geometric-proof",
    0.5,
    "Form the converse, inverse and contrapositive of a conditional, choose the equivalent statement, negate a conditional, name a biconditional, and evaluate compound statements from given truth values.",
  ),
  meta(
    "cube-root-equation",
    "Solve equations with cube roots",
    "radical-equations",
    0.4,
    "Solve equations containing a cube root or a cube, handle negative values, and contrast cube roots with square roots when checking candidates.",
  ),
  meta(
    "polar-graph-identify",
    "Identify polar graphs from equations",
    "polar-coordinates",
    0.6,
    "Name a polar curve from its equation, count rose petals, find the greatest distance from the pole, and identify symmetry of a limaçon.",
  ),
  meta(
    "cone-section-name",
    "Name a conic section cut from a cone",
    "conic-sections",
    0.5,
    "Name the figure made by a plane cutting a double cone from the plane's angle with the axis, including degenerate sections through the vertex.",
  ),
];

// --------------------------------------------------------------- shared tools
type Cand = { label: string; feedback: string };
type Choices = NonNullable<Draft["choices"]>;

/** The correct label plus the first three distinct, different wrong labels. */
function choicesOf(correct: string, cands: Cand[]): Choices {
  const seen = new Set([correct]);
  const wrong: Cand[] = [];
  for (const c of cands) {
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    wrong.push(c);
  }
  if (wrong.length < 3)
    throw new Error(
      `Insufficient distinct choices: ${correct} / ${cands.map((c) => c.label).join(" ; ")}`,
    );
  return [
    { label: correct, correct: true },
    ...wrong.slice(0, 3).map(({ label, feedback }) => ({ label, feedback })),
  ];
}

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const nonzero = (r: Random, lo: number, hi: number) => {
  let v = 0;
  while (!v) v = r(lo, hi);
  return v;
};
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const M = (tex: string) => `$${tex}$`;
/** A negative number in parentheses; a positive one stays bare. */
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const mul = (a: number, b: number) => `${par(a)}\\cdot ${par(b)}`;

/** A signed sum of terms: coefficient 0 is omitted, 1 and −1 are implicit. */
function poly(terms: [number, string][]): string {
  let s = "";
  for (const [c, v] of terms) {
    if (!c) continue;
    const mag = Math.abs(c) === 1 && v ? "" : String(Math.abs(c));
    s = s
      ? `${s} ${c < 0 ? "-" : "+"} ${mag}${v}`
      : `${c < 0 ? "-" : ""}${mag}${v}`;
  }
  return s || "0";
}
const fracTex = (n: number, d: number) => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  [n, d] = [n / g, d / g];
  return d === 1 ? `${n}` : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
};

// ============================================================ 1. gauss-3x3
const VARS = ["x", "y", "z"];
const dot = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * b[i]!, 0);
const det3 = (m: number[][]) =>
  m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
  m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
  m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
const eqTex = (row: number[], rhs: number) =>
  `${poly(row.map((c, i) => [c, VARS[i]!]))} = ${rhs}`;
const sysTex = (A: number[][], b: number[]) =>
  `\\begin{cases} ${A.map((row, i) => eqTex(row, b[i]!)).join(" \\\\ ")} \\end{cases}`;
const triple = (t: number[]) => M(`(${t.join(", ")})`);

type System = { A: number[][]; sol: number[]; b: number[] };
/** Independent equations (nonzero determinant) with a small integer solution. */
function makeSystem(
  r: Random,
  fixed?: (A: number[][]) => void,
  limit = 14,
): System {
  for (;;) {
    const A = [0, 1, 2].map(() =>
      [0, 1, 2].map(() => (r(0, 6) === 0 ? 0 : nonzero(r, -3, 3))),
    );
    fixed?.(A);
    const d = det3(A);
    if (!d || Math.abs(d) > limit) continue;
    if (A.some((row) => row.filter(Boolean).length < 2)) continue;
    const sol = [r(-4, 5), r(-4, 5), r(-4, 5)];
    if (new Set(sol).size < 2) continue;
    return { A, sol, b: A.map((row) => dot(row, sol)) };
  }
}

/** Fraction-free elimination written as the equations a learner would see. */
function eliminationSteps(sys: System): string[] {
  const rows = sys.A.map((row, i) => [...row, sys.b[i]!]);
  const show = (row: number[]) => M(eqTex(row.slice(0, 3), row[3]!));
  const steps: string[] = [];
  const reduce = (row: number[]) => {
    const g = row.reduce((s, v) => gcd(s, v), 0) || 1;
    return g > 1 ? row.map((v) => v / g) : row;
  };
  const sub = (a: number[], p: number, b: number[], q: number) =>
    a.map((v, i) => p * v - q * b[i]!);
  if (!rows[0]![0]) {
    const k = rows.findIndex((row) => row[0] !== 0);
    [rows[0], rows[k]] = [rows[k]!, rows[0]!];
    steps.push(`Swap equations so the first has an $x$ term.`);
  }
  const p = rows[0]![0]!;
  for (const i of [1, 2]) {
    const q = rows[i]![0]!;
    if (!q) continue;
    const raw = sub(rows[i]!, p, rows[0]!, q);
    const row = reduce(raw);
    rows[i] = row;
    steps.push(
      `Remove $x$ from equation ${i + 1}: ${p}(equation ${i + 1}) ${q < 0 ? "+" : "−"} ${Math.abs(q)}(equation 1)${row === raw ? "" : ", then divide by the common factor"} gives ${show(row)}.`,
    );
  }
  if (!rows[1]![1]) {
    [rows[1], rows[2]] = [rows[2]!, rows[1]!];
    steps.push("Swap equations 2 and 3 so the second has a $y$ term.");
  }
  const p2 = rows[1]![1]!;
  const q2 = rows[2]![1]!;
  if (q2) {
    const raw = sub(rows[2]!, p2, rows[1]!, q2);
    const row = reduce(raw);
    rows[2] = row;
    steps.push(
      `Remove $y$ from the last equation using the middle equation: ${p2}(last) ${q2 < 0 ? "+" : "−"} ${Math.abs(q2)}(middle)${row === raw ? "" : ", then divide by the common factor"} gives ${show(row)}.`,
    );
  }
  const [x, y, z] = sys.sol;
  steps.push(
    `Solve upward: $z=${z}$, then $y=${y}$ from the middle equation, then $x=${x}$ from equation 1.`,
  );
  return steps;
}

function failedEquation(sys: System, t: number[]) {
  const k = sys.A.findIndex((row, i) => dot(row, t) !== sys.b[i]);
  return `Substituting ${triple(t)} makes equation ${k + 1} equal ${M(String(dot(sys.A[k]!, t)))}, but it must equal ${M(String(sys.b[k]!))}.`;
}

const opTex = (target: number, m: number) =>
  `R_${target + 1} \\to R_${target + 1} ${m < 0 ? "+" : "-"} ${Math.abs(m) === 1 ? "" : Math.abs(m)}R_1`;

const COUNT_LABELS = {
  one: "Exactly one solution",
  none: "No solution",
  many: "Infinitely many solutions",
  two: "Exactly two solutions",
} as const;
type Count = keyof typeof COUNT_LABELS;

function gaussCase(r: Random): Draft {
  const variant = pick(r, [0, 0, 1, 1, 2, 2, 3] as const);

  if (variant === 0) {
    const sys = makeSystem(r);
    const [a, b, c] = sys.sol as [number, number, number];
    const pool: number[][] = [
      [b, a, c],
      [a, c, b],
      [c, b, a],
      [-a, b, c],
      [a, -b, c],
      [a, b, -c],
      [a + 1, b, c],
      [a, b, c - 1],
    ];
    const cands = shuffle(
      r,
      pool
        .filter((t) => t.some((v, i) => v !== sys.sol[i]))
        .map((t) => ({ label: triple(t), feedback: failedEquation(sys, t) })),
    );
    return {
      prompt: `Solve the system ${M(sysTex(sys.A, sys.b))} Which ordered triple $(x, y, z)$ satisfies all three equations?`,
      answer: "",
      hint: `Use an equation with an $x$ term to remove $x$ from another equation. That leaves two equations in $y$ and $z$; remove one more variable and work back up.`,
      explanation: [
        ...eliminationSteps(sys),
        `Check in every equation: ${sys.A.map((row, i) => `${M(eqTex(row, sys.b[i]!))}`).join("; ")} all hold for ${triple(sys.sol)}.`,
      ],
      choices: choicesOf(triple(sys.sol), cands),
    };
  }

  if (variant === 1) {
    const target = r(1, 2);
    const lead = pick(r, [1, -1, 2, -2, 3] as const);
    const k = pick(r, [1, -1, 2, -2, 3, -3] as const);
    const sys = makeSystem(
      r,
      (A) => {
        A[0]![0] = lead;
        A[target]![0] = k * lead;
        const other = 3 - target;
        if (!A[other]![0]) A[other]![0] = nonzero(r, -3, 3);
      },
      30,
    );
    const a = lead;
    const bcoef = k * a;
    const eliminated = sys.A[target]!.map((v, i) => v - k * sys.A[0]![i]!);
    const eliminatedRhs = sys.b[target]! - k * sys.b[0]!;
    const cands = [-k, a, bcoef, k + 1, k - 1, k + 2, k - 2, 2 * k, k + 3, -a]
      .filter((m) => m !== 0 && m !== k)
      .map((m) => ({
        label: M(opTex(target, m)),
        feedback: `That leaves ${M(`${sys.A[target]![0]! - m * a}x`)} in equation ${target + 1}; the $x$ terms do not cancel.`,
      }));
    return {
      prompt: `In the system ${M(sysTex(sys.A, sys.b))} equations are numbered 1, 2, 3 from the top, and $R_n$ means equation $n$. Which row operation eliminates $x$ from equation ${target + 1} using equation 1?`,
      answer: "",
      hint: `Equation 1 has ${a}x and equation ${target + 1} has ${bcoef}x. Find the multiple of equation 1 whose $x$ term equals ${bcoef}x, then subtract it.`,
      explanation: [
        `Compare $x$ coefficients: $${bcoef}=${mul(k, a)}$, so equation ${target + 1} loses its $x$ term when ${k} times equation 1 is subtracted.`,
        `Subtract ${k} times equation 1 from equation ${target + 1}: the $x$ terms cancel, leaving ${M(eqTex(eliminated, eliminatedRhs))}.`,
        `The operation is ${M(opTex(target, k))}.`,
      ],
      choices: choicesOf(M(opTex(target, k)), cands),
    };
  }

  if (variant === 2) {
    // Three equations whose left sides are dependent, or an independent system.
    const kind = pick(r, ["many", "none", "one", "many", "none"] as const);
    let A: number[][];
    let b: number[];
    let reason: string;
    let short: string;
    if (kind === "one") {
      const sys = makeSystem(r);
      A = sys.A;
      b = sys.b;
      const d = det3(A);
      reason = `The coefficient determinant is ${d}, not 0, so no equation is a combination of the others and the system has exactly one solution, ${triple(sys.sol)}.`;
      short = "Check whether any left side is a sum or multiple of the others.";
    } else {
      const dependent = r(0, 1) === 0;
      const rowA = [0, 1, 2].map(() => nonzero(r, -3, 3));
      let rowB: number[];
      do rowB = [0, 1, 2].map(() => r(-3, 3));
      while (
        rowB.every((v) => !v) ||
        // Independent of rowA: a nonzero cross product.
        [
          rowA[1]! * rowB[2]! - rowA[2]! * rowB[1]!,
          rowA[2]! * rowB[0]! - rowA[0]! * rowB[2]!,
          rowA[0]! * rowB[1]! - rowA[1]! * rowB[0]!,
        ].every((v) => v === 0)
      );
      const rhsA = r(-8, 8);
      const rhsB = r(-8, 8);
      const [p, q] = pick(r, [
        [1, 1],
        [1, -1],
        [2, 1],
        [1, 2],
        [-1, 1],
        [2, -1],
      ] as const);
      const sum = rowA.map((v, i) => p * v + q * rowB[i]!);
      const sumRhs = p * rhsA + q * rhsB;
      const lastRhs = kind === "many" ? sumRhs : sumRhs + nonzero(r, -4, 4);
      const order = shuffle(r, [0, 1, 2]);
      const rows = [rowA, rowB, sum];
      const rhs = [rhsA, rhsB, lastRhs];
      A = order.map((i) => rows[i]!);
      b = order.map((i) => rhs[i]!);
      const pos = (i: number) => order.indexOf(i) + 1;
      const combo = `${p === 1 ? "" : p === -1 ? "−" : p}(equation ${pos(0)}) ${q < 0 ? "−" : "+"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}(equation ${pos(1)})`;
      reason =
        kind === "many"
          ? `${combo} has left side ${M(poly(sum.map((c, i) => [c, VARS[i]!])))} and right side ${sumRhs}, exactly equation ${pos(2)}. That equation adds no new condition, so two independent equations in three unknowns leave a free variable: infinitely many solutions.`
          : `${combo} has left side ${M(poly(sum.map((c, i) => [c, VARS[i]!])))} and right side ${sumRhs}, but equation ${pos(2)} has the same left side with right side ${lastRhs}. Eliminating gives $0=${lastRhs - sumRhs}$, a contradiction, so there is no solution.`;
      short =
        "Try adding or subtracting multiples of two equations to reproduce the third.";
    }
    const feedbackFor = (label: Count): string => {
      if (label === "two")
        return "A linear system has no solution, exactly one, or infinitely many. If two different points satisfy it, every point on the line through them does too.";
      if (kind === "many")
        return label === "one"
          ? "One equation is made from the other two, so there are effectively only two conditions on three unknowns."
          : "The constants agree with the combination of the other two equations, so there is no contradiction.";
      if (kind === "none")
        return label === "one"
          ? "The left sides are dependent, so the equations cannot pin down a single point."
          : "The left sides are dependent, but the constants disagree. A contradiction means no solution, not infinitely many.";
      return label === "none"
        ? "No elimination produces a false statement such as $0=5$; the equations are consistent."
        : "No equation is a combination of the others, so each equation adds a condition and the solution is a single point.";
    };
    const labels = Object.keys(COUNT_LABELS) as Count[];
    const correct: Count = kind;
    return {
      prompt: `How many solutions does the system ${M(sysTex(A, b))} have?`,
      answer: "",
      hint: short,
      explanation: [reason, `The answer is: ${COUNT_LABELS[correct]}.`],
      choices: labels.map((l) =>
        l === correct
          ? { label: COUNT_LABELS[l], correct: true as const }
          : { label: COUNT_LABELS[l], feedback: feedbackFor(l) },
      ),
    };
  }

  // Back-substitution in a reduced system.
  const [x, y, z] = [r(-4, 5), r(-4, 5), nonzero(r, -4, 5)];
  const a = nonzero(r, -3, 3);
  const bb = nonzero(r, -3, 3);
  const c = nonzero(r, -3, 3);
  const p = x + a * y + bb * z;
  const q = y + c * z;
  const eqs = `\\begin{cases} ${poly([
    [1, "x"],
    [a, "y"],
    [bb, "z"],
  ])} = ${p} \\\\ ${poly([
    [1, "y"],
    [c, "z"],
  ])} = ${q} \\\\ z = ${z} \\end{cases}`;
  const yBad = q + c * z;
  const cands: Cand[] = [
    {
      label: triple([p - a * yBad - bb * z, yBad, z]),
      feedback: `Substituting $z=${z}$ into the middle equation means subtracting the $z$ term: $y=${q}-${mul(c, z)}$, not adding it.`,
    },
    {
      label: triple([p - a * y, y, z]),
      feedback:
        "Substitute both $y$ and $z$ into equation 1. The $z$ term must also move to the right side.",
    },
    {
      label: triple([p + a * y + bb * z, y, z]),
      feedback:
        "Terms move to the right side with the opposite sign: subtract $ay$ and $bz$, do not add them.",
    },
    {
      label: triple([p - a * q - bb * z, q, z]),
      feedback:
        "The middle equation is $y$ plus a multiple of $z$. Subtract that multiple before using $y$ in equation 1.",
    },
    {
      label: triple([x, y, -z]),
      feedback:
        "The last equation gives $z$ directly, with its sign. Keep it when substituting upward.",
    },
  ];
  return {
    prompt: `Elimination has reduced a system to ${M(eqs)} Which ordered triple $(x, y, z)$ solves it?`,
    answer: "",
    hint: `The last equation already gives $z=${z}$. Put that value into the middle equation to find $y$, then put both into the first.`,
    explanation: [
      `The last equation gives $z=${z}$.`,
      `Middle equation: $y=${q}-${mul(c, z)}=${y}$.`,
      `First equation: $x=${p}-${mul(a, y)}-${mul(bb, z)}=${x}$.`,
      `The solution is ${triple([x, y, z])}.`,
    ],
    choices: choicesOf(triple([x, y, z]), cands),
  };
}

// ================================================== 2. quadratic inequality
type Op = "<" | "≤" | ">" | "≥";
const opTexOf = (op: Op) =>
  ({ "<": "<", "≤": "\\le", ">": ">", "≥": "\\ge" })[op];
const holds = (v: number, op: Op) =>
  op === "<" ? v < 0 : op === "≤" ? v <= 0 : op === ">" ? v > 0 : v >= 0;
const isClosed = (op: Op) => op === "≤" || op === "≥";

type IntervalSet = {
  shape: "between" | "outside";
  closed: boolean;
  p: number;
  q: number;
};
const setTex = ({ shape, closed, p, q }: IntervalSet) =>
  M(
    shape === "between"
      ? `${closed ? "[" : "("}${p}, ${q}${closed ? "]" : ")"}`
      : `(-\\infty, ${p}${closed ? "]" : ")"} \\cup ${closed ? "[" : "("}${q}, \\infty)`,
  );
const inSet = ({ shape, closed, p, q }: IntervalSet, t: number) => {
  const inside = closed ? t >= p && t <= q : t > p && t < q;
  const edge = t === p || t === q;
  return shape === "between"
    ? inside
    : closed
      ? t <= p || t >= q
      : !edge && !inside;
};

function quadraticInequalityCase(r: Random): Draft {
  const variant = pick(r, [0, 0, 1, 2, 3, 3] as const);
  const op = pick(r, ["<", "≤", ">", "≥"] as const);
  const opT = opTexOf(op);

  if (variant === 3) {
    // The graph never crosses the x-axis, or touches it once.
    const a = nonzero(r, -3, 3);
    const h = r(-5, 5);
    const k = r(0, 1) === 0 ? 0 : Math.sign(a) * r(1, 9);
    const B = -2 * a * h;
    const C = a * h * h + k;
    const g = (t: number) => a * t * t + B * t + C;
    const key = [holds(g(h), op), holds(g(h + 1), op)].join();
    const all = M("(-\\infty, \\infty)");
    const none = "No real solution";
    const point = M(`\\{${h}\\}`);
    const except = M(`(-\\infty, ${h}) \\cup (${h}, \\infty)`);
    const correct =
      key === "true,true"
        ? all
        : key === "false,false"
          ? none
          : key === "true,false"
            ? point
            : except;
    const member = (label: string, t: number) =>
      label === all
        ? true
        : label === none
          ? false
          : label === point
            ? t === h
            : t !== h;
    const describe = (label: string) => {
      const t = [h, h + 1].find((v) => member(label, v) !== holds(g(v), op))!;
      return `Test $x=${t}$: the inequality is ${holds(g(t), op) ? "true" : "false"} there, but this choice ${member(label, t) ? "includes" : "excludes"} it.`;
    };
    const expr = poly([
      [a, "x^2"],
      [B, "x"],
      [C, ""],
    ]);
    return {
      prompt: `Solve ${M(`${expr} ${opT} 0`)} over the real numbers. Choose the solution set.`,
      answer: "",
      hint: `The parabola for ${M(expr)} opens ${a > 0 ? "upward" : "downward"}. Decide whether it reaches the $x$-axis, touches it once, or never gets there; the discriminant $b^2-4ac$ tells you.`,
      explanation: [
        `Discriminant: $${par(B)}^2-4\\cdot ${par(a)}\\cdot ${par(C)}=${B * B - 4 * a * C}$.`,
        k === 0
          ? `It is 0, so the only real zero is $x=${h}$, where the expression equals 0. Everywhere else it has the sign of the leading coefficient ${a}, ${a > 0 ? "positive" : "negative"}.`
          : `It is negative, so there are no real zeros. The parabola opens ${a > 0 ? "up" : "down"} and stays ${a > 0 ? "above" : "below"} the $x$-axis: the expression is ${a > 0 ? "positive" : "negative"} for every real $x$.`,
        `Compare with ${M(`${opT} 0`)}. The solution set: ${correct}.`,
      ],
      choices: choicesOf(
        correct,
        [all, none, point, except].map((label) => ({
          label,
          feedback: describe(label),
        })),
      ),
    };
  }

  // Two real zeros.
  const a =
    variant === 1
      ? -pick(r, [1, 2, 3] as const)
      : pick(r, [1, 1, 2, 3] as const);
  let p: number, q: number;
  do {
    p = r(-6, 5);
    q = r(-5, 6);
  } while (q - p < 1 || q - p > 9);
  const Bc = -a * (p + q);
  const Cc = a * p * q;
  const rearranged = variant === 2;
  const lhs = rearranged
    ? poly([
        [a, "x^2"],
        [Bc, "x"],
      ])
    : poly([
        [a, "x^2"],
        [Bc, "x"],
        [Cc, ""],
      ]);
  const rhs = rearranged ? -Cc : 0;
  const value = (t: number) => a * (t - p) * (t - q);
  const truth = (t: number) => holds(value(t), op);
  // Inside the zeros the expression has the sign opposite to a.
  const insideHolds = holds(a > 0 ? -1 : 1, op);
  const closed = isClosed(op);
  const correctSet: IntervalSet = {
    shape: insideHolds ? "between" : "outside",
    closed,
    p,
    q,
  };
  const other = (s: IntervalSet): IntervalSet => ({
    ...s,
    shape: s.shape === "between" ? "outside" : "between",
  });
  const sets: IntervalSet[] = [
    other(correctSet),
    { ...correctSet, closed: !closed },
    { ...correctSet, p: -q, q: -p },
    { ...other(correctSet), closed: !closed },
  ];
  if (rearranged && Bc % a === 0 && Bc !== 0) {
    const z = [0, -Bc / a].sort((u, v) => u - v);
    sets.push({ ...correctSet, p: z[0]!, q: z[1]! });
  }
  const span = [p, q, -p, -q, 0, -Bc / a].filter(Number.isInteger) as number[];
  const lo = Math.min(...span) - 1;
  const hi = Math.max(...span) + 1;
  const cands: Cand[] = [];
  for (const s of sets) {
    let t: number | undefined;
    for (let v = lo; v <= hi; v++)
      if (inSet(s, v) !== truth(v)) {
        t = v;
        break;
      }
    if (t === undefined) continue;
    cands.push({
      label: setTex(s),
      feedback: `Test $x=${t}$: the inequality is ${truth(t) ? "true" : "false"} there, but this choice ${inSet(s, t) ? "includes" : "excludes"} it.`,
    });
  }
  const unit = `${a > 0 ? "opens upward" : "opens downward"}`;
  const factor = (z: number) =>
    z === 0 ? "x" : `(x ${z < 0 ? "+" : "-"} ${Math.abs(z)})`;
  const zeros = `${a === 1 ? "" : a === -1 ? "-" : a}${factor(p)}${factor(q)}`;
  return {
    prompt: `Solve ${M(`${lhs} ${opT} ${rhs}`)}. Write the solution set in interval notation.`,
    answer: "",
    hint: rearranged
      ? `Move every term to one side so the other side is 0. The related parabola ${unit} when its leading coefficient is ${a > 0 ? "positive" : "negative"}; find its zeros, then decide where it is ${op === "<" || op === "≤" ? "below" : "above"} the axis.`
      : `The parabola for ${M(lhs)} ${unit}. Find where it crosses the $x$-axis, then decide whether it is ${op === "<" || op === "≤" ? "below" : "above"} the axis between those points or outside them.`,
    explanation: [
      rearranged
        ? `Subtract ${par(rhs)} from both sides: ${M(
            `${poly([
              [a, "x^2"],
              [Bc, "x"],
              [Cc, ""],
            ])} ${opT} 0`,
          )}.`
        : `Compare the expression with 0 after finding its zeros.`,
      `Factor: ${M(
        `${poly([
          [a, "x^2"],
          [Bc, "x"],
          [Cc, ""],
        ])} = ${zeros}`,
      )}, so the zeros are $x=${p}$ and $x=${q}$.`,
      `The leading coefficient ${a} is ${a > 0 ? "positive, so the parabola opens up and is below the axis between the zeros and above it outside" : "negative, so the parabola opens down and is above the axis between the zeros and below it outside"}.`,
      `${closed ? "The inequality includes equality, so the zeros belong to the solution set" : "The inequality is strict, so the zeros are excluded"}. The solution set is ${setTex(correctSet)}.`,
    ],
    choices: choicesOf(setTex(correctSet), cands),
  };
}

// ============================================================ 3. conditionals
type Fact = {
  a: string;
  b: string;
  na: string;
  nb: string;
  /** Whether the converse is also true. */
  converse: boolean;
  /** For a false converse: a case where the hypothesis fails but the conclusion holds. */
  counter?: string;
};
const FACTS: readonly Fact[] = [
  {
    a: "a quadrilateral is a square",
    b: "the quadrilateral is a rectangle",
    na: "a quadrilateral is not a square",
    nb: "the quadrilateral is not a rectangle",
    converse: false,
    counter: "A rectangle that is not a square is a counterexample.",
  },
  {
    a: "two angles are vertical angles",
    b: "the two angles are congruent",
    na: "two angles are not vertical angles",
    nb: "the two angles are not congruent",
    converse: false,
    counter:
      "Two congruent angles that are not vertical angles are a counterexample.",
  },
  {
    a: "a number is divisible by 6",
    b: "the number is even",
    na: "a number is not divisible by 6",
    nb: "the number is not even",
    converse: false,
    counter: "The number 4 is even but not divisible by 6.",
  },
  {
    a: "a triangle is equilateral",
    b: "the triangle is isosceles",
    na: "a triangle is not equilateral",
    nb: "the triangle is not isosceles",
    converse: false,
    counter:
      "An isosceles triangle that is not equilateral is a counterexample.",
  },
  {
    a: "an integer ends in 0",
    b: "the integer is divisible by 5",
    na: "an integer does not end in 0",
    nb: "the integer is not divisible by 5",
    converse: false,
    counter: "The integer 15 is divisible by 5 but does not end in 0.",
  },
  {
    a: "a quadrilateral is a rhombus",
    b: "the diagonals of the quadrilateral are perpendicular",
    na: "a quadrilateral is not a rhombus",
    nb: "the diagonals of the quadrilateral are not perpendicular",
    converse: false,
    counter:
      "A kite that is not a rhombus has perpendicular diagonals, so it is a counterexample.",
  },
  {
    a: "a triangle has three congruent sides",
    b: "the triangle has three congruent angles",
    na: "a triangle does not have three congruent sides",
    nb: "the triangle does not have three congruent angles",
    converse: true,
  },
  {
    a: "a polygon is a hexagon",
    b: "the polygon has six sides",
    na: "a polygon is not a hexagon",
    nb: "the polygon does not have six sides",
    converse: true,
  },
  {
    a: "an angle is a right angle",
    b: "the angle measures 90°",
    na: "an angle is not a right angle",
    nb: "the angle does not measure 90°",
    converse: true,
  },
  {
    a: "a whole number is a multiple of 10",
    b: "the number is divisible by both 2 and 5",
    na: "a whole number is not a multiple of 10",
    nb: "the number is not divisible by both 2 and 5",
    converse: true,
  },
];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const ifThen = (a: string, b: string) => `If ${a}, then ${b}.`;

// Compound statements over P, Q, R.
type F =
  | { k: "var"; n: "P" | "Q" | "R" }
  | { k: "not"; a: F }
  | { k: "and" | "or" | "imp" | "iff"; a: F; b: F };
const v = (n: "P" | "Q" | "R"): F => ({ k: "var", n });
const not = (a: F): F => ({ k: "not", a });
const bin = (k: "and" | "or" | "imp" | "iff", a: F, b: F): F => ({ k, a, b });
const [P, Q, R] = [v("P"), v("Q"), v("R")] as const;
const POOL: F[] = [
  bin("and", P, Q),
  bin("or", P, Q),
  bin("imp", P, Q),
  bin("imp", Q, P),
  bin("or", not(P), Q),
  not(bin("and", P, Q)),
  bin("imp", not(P), Q),
  bin("and", P, not(Q)),
  bin("and", not(P), not(Q)),
  bin("imp", bin("or", P, Q), R),
  bin("imp", bin("and", P, Q), R),
  bin("imp", P, bin("imp", Q, R)),
  bin("iff", P, Q),
  bin("iff", Q, R),
  bin("or", bin("and", P, R), Q),
  not(bin("or", P, R)),
  bin("imp", P, bin("or", Q, R)),
  bin("and", bin("imp", P, Q), R),
  bin("imp", R, bin("and", P, Q)),
  bin("imp", not(Q), bin("and", P, R)),
];
type Env = Record<"P" | "Q" | "R", boolean>;
const ev = (f: F, e: Env): boolean =>
  f.k === "var"
    ? e[f.n]
    : f.k === "not"
      ? !ev(f.a, e)
      : f.k === "and"
        ? ev(f.a, e) && ev(f.b, e)
        : f.k === "or"
          ? ev(f.a, e) || ev(f.b, e)
          : f.k === "imp"
            ? !ev(f.a, e) || ev(f.b, e)
            : ev(f.a, e) === ev(f.b, e);
const SYM = {
  and: "\\land",
  or: "\\lor",
  imp: "\\to",
  iff: "\\leftrightarrow",
};
const fTex = (f: F, top = true): string =>
  f.k === "var"
    ? f.n
    : f.k === "not"
      ? `\\neg ${f.a.k === "var" ? f.a.n : `(${fTex(f.a)})`}`
      : top
        ? `${fTex(f.a, false)} ${SYM[f.k]} ${fTex(f.b, false)}`
        : `(${fTex(f.a, true)} ${SYM[f.k]} ${fTex(f.b, true)})`;
const tf = (b: boolean) => (b ? "true" : "false");
function whyF(f: F, e: Env): string {
  const t = (g: F) => `${M(fTex(g, true))} is ${tf(ev(g, e))}`;
  if (f.k === "var") return `${M(f.n)} is ${tf(e[f.n])}.`;
  if (f.k === "not")
    return `${t(f.a)}, and a negation reverses the truth value, so ${M(fTex(f))} is ${tf(ev(f, e))}.`;
  const rule = {
    and: "A conjunction is true only when both parts are true.",
    or: "A disjunction is false only when both parts are false.",
    imp: "A conditional is false only when its hypothesis is true and its conclusion is false.",
    iff: "A biconditional is true exactly when both parts have the same truth value.",
  }[f.k];
  return `${t(f.a)} and ${t(f.b)}. ${rule} So ${M(fTex(f))} is ${tf(ev(f, e))}.`;
}

function conditionalCase(r: Random): Draft {
  const variant = pick(r, [0, 0, 1, 2, 3, 3, 4] as const);

  if (variant === 3) {
    const env: Env = { P: r(0, 1) === 1, Q: r(0, 1) === 1, R: r(0, 1) === 1 };
    const wantTrue = r(0, 1) === 1;
    const matching = shuffle(
      r,
      POOL.filter((f) => ev(f, env) === wantTrue),
    );
    const rest = shuffle(
      r,
      POOL.filter((f) => ev(f, env) !== wantTrue),
    );
    if (!matching.length || rest.length < 3)
      throw new Error("Insufficient compound statements");
    const [good] = matching;
    const others = rest.slice(0, 3);
    const given = `$P$ is ${tf(env.P)}, $Q$ is ${tf(env.Q)} and $R$ is ${tf(env.R)}`;
    const label = (f: F) => M(fTex(f));
    return {
      prompt: `Suppose ${given}. Which of these statements is ${wantTrue ? "true" : "false"}?`,
      answer: "",
      hint: `Replace each letter by its given truth value and evaluate the smaller parts first, working outward. Remember: a conditional is false only when its hypothesis is true and its conclusion is false.`,
      explanation: [
        `Evaluate each statement when ${given}.`,
        ...[good!, ...others].map((f) => `${whyF(f, env)}`),
        `The ${wantTrue ? "true" : "false"} statement is ${label(good!)}.`,
      ],
      choices: choicesOf(
        label(good!),
        others.map((f) => ({
          label: label(f),
          feedback: `${whyF(f, env)} The question asks for a ${wantTrue ? "true" : "false"} statement.`,
        })),
      ),
    };
  }

  if (variant === 2) {
    const f = pick(
      r,
      FACTS.filter((x) => x.converse),
    );
    const swap = r(0, 1) === 1;
    const [pp, qq] = swap ? [f.b, f.a] : [f.a, f.b];
    const lab = (tex: string, words: string) => `${M(tex)} (${words})`;
    return {
      prompt: `Let $P$ be “${pp}” and $Q$ be “${qq}”. Both $P \\to Q$ and its converse $Q \\to P$ are true. Which single statement says exactly this?`,
      answer: "",
      hint: `A biconditional joins a conditional and its converse. Compare the connective in each choice with “if ... then” in both directions.`,
      explanation: [
        `$P \\to Q$ says $P$ is enough for $Q$. $Q \\to P$ says $Q$ is enough for $P$.`,
        `Together they say $P$ and $Q$ are true together or false together: $P \\leftrightarrow Q$, read “$P$ if and only if $Q$”.`,
      ],
      choices: choicesOf(
        lab("P \\leftrightarrow Q", "$P$ if and only if $Q$"),
        [
          {
            label: lab("P \\land Q", "$P$ and $Q$ are both true"),
            feedback:
              "A conjunction claims both statements are true. The conditionals only link them; they do not say either one is true.",
          },
          {
            label: lab("P \\lor Q", "$P$ or $Q$ is true"),
            feedback:
              "A disjunction claims at least one is true. It does not say that $P$ forces $Q$ or that $Q$ forces $P$.",
          },
          {
            label: lab("P \\to \\neg Q", "if $P$ then not $Q$"),
            feedback:
              "This contradicts $P \\to Q$: when $P$ is true, $Q$ must be true, not false.",
          },
        ],
      ),
    };
  }

  const f = pick(r, variant === 1 ? FACTS.filter((x) => !x.converse) : FACTS);
  const orig = ifThen(f.a, f.b);
  const converse = ifThen(f.b, f.a);
  const inverse = ifThen(f.na, f.nb);
  const contra = ifThen(f.nb, f.na);
  const mixed = ifThen(f.b, f.na);

  if (variant === 4) {
    const correct = `${cap(f.a)} and ${f.nb}.`;
    return {
      prompt: `Which statement is the negation of “${orig}”?`,
      answer: "",
      hint: `The conditional is false in exactly one situation: the hypothesis holds and the conclusion fails. Describe that situation.`,
      explanation: [
        `A conditional is false only when its hypothesis is true and its conclusion is false.`,
        `So its negation says the hypothesis is true and the conclusion is false: “${correct}”`,
        `Symbolically, $\\neg(P \\to Q)$ is equivalent to $P \\land \\neg Q$.`,
      ],
      choices: choicesOf(correct, [
        {
          label: ifThen(f.a, f.nb),
          feedback:
            "This is another conditional, not the opposite of the original. The original can be true while this one is also true, whenever the hypothesis never occurs.",
        },
        {
          label: inverse,
          feedback:
            "That is the inverse. It is equivalent to the converse and is not the negation of the original statement.",
        },
        {
          label: `${cap(f.na)} and ${f.nb}.`,
          feedback:
            "Negating both parts does not negate the conditional. The conditional fails only when the hypothesis is true and the conclusion is false.",
        },
      ]),
    };
  }

  if (variant === 1) {
    return {
      prompt: `The statement “${orig}” is true. Which of these statements must also be true?`,
      answer: "",
      hint: `A statement and its contrapositive always have the same truth value. Negate both parts of “${orig}” and reverse their order.`,
      explanation: [
        `Swap hypothesis and conclusion, then negate both: this gives the contrapositive.`,
        `The contrapositive “${contra}” is logically equivalent to the original, so it is true whenever the original is.`,
        `The converse and inverse are not equivalent to the original. ${f.counter}`,
      ],
      choices: choicesOf(contra, [
        {
          label: converse,
          feedback: `That is the converse, which can be false when the original is true. ${f.counter}`,
        },
        {
          label: inverse,
          feedback: `That is the inverse, which has the same truth value as the converse and fails for the same reason. ${f.counter}`,
        },
        {
          label: mixed,
          feedback:
            "This keeps the conclusion unnegated and negates the original hypothesis. It is neither the contrapositive nor equivalent to the original.",
        },
      ]),
    };
  }

  const target = pick(r, ["converse", "inverse", "contrapositive"] as const);
  const forms = { converse, inverse, contrapositive: contra };
  const how = {
    converse: "Swap the hypothesis and the conclusion.",
    inverse:
      "Negate both the hypothesis and the conclusion, keeping their order.",
    contrapositive: "Swap the hypothesis and the conclusion and negate both.",
  };
  const names = ["converse", "inverse", "contrapositive"] as const;
  return {
    prompt: `Which statement is the ${target} of “${orig}”?`,
    answer: "",
    hint: `The hypothesis is “${f.a}” and the conclusion is “${f.b}”. ${how[target]}`,
    explanation: [
      `Hypothesis: “${f.a}”. Conclusion: “${f.b}”.`,
      `${how[target]} The ${target} is “${forms[target]}”`,
    ],
    choices: choicesOf(forms[target], [
      ...names
        .filter((n) => n !== target)
        .map((n) => ({
          label: forms[n],
          feedback: `That is the ${n}. ${how[n]} The ${target} needs: ${how[target].toLowerCase()}`,
        })),
      {
        label: mixed,
        feedback:
          "This negates only the hypothesis of the swapped statement, so it matches none of the three standard forms.",
      },
    ]),
  };
}

// ============================================================ 4. cube roots
const cbrtTex = (inner: string) => `\\sqrt[3]{${inner}}`;
function cubeRootCase(r: Random): Draft {
  const variant = pick(r, [0, 0, 1, 1, 2, 3] as const);
  const xv = (x: number) => M(`x = ${x}`);
  const frChoice = (n: number, d: number) => M(`x = ${fracTex(n, d)}`);

  if (variant === 0) {
    let a: number, b: number, c: number, x: number;
    do {
      a = nonzero(r, -4, 5);
      x = r(-6, 6);
      c = nonzero(r, -3, 3);
      b = c ** 3 - a * x;
    } while (Math.abs(b) > 40);
    const rad = poly([
      [a, "x"],
      [b, ""],
    ]);
    const cands: Cand[] = [
      {
        label: frChoice(c - b, a),
        feedback: `That sets the radicand equal to ${c} instead of cubing: $\\sqrt[3]{N}=${c}$ means $N=${par(c)}^3=${c ** 3}$.`,
      },
      {
        label: frChoice(c * c - b, a),
        feedback: `Undoing a cube root needs a cube, not a square: the radicand is $${par(c)}^3=${c ** 3}$.`,
      },
      {
        label: frChoice(-(c ** 3) - b, a),
        feedback: `Cubing ${c} gives ${c ** 3}, keeping its sign. Do not change it before solving for $x$.`,
      },
      {
        label: frChoice(c ** 3 + b, a),
        feedback: `Subtract $${b}$ from both sides (or add its opposite) to undo the constant; its sign does not stay.`,
      },
    ];
    cands.push(
      {
        label: xv(x + 1),
        feedback: `Substitute $x=${x + 1}$: the radicand is ${a * (x + 1) + b}, whose cube root is not ${c}.`,
      },
      {
        label: xv(x - 1),
        feedback: `Substitute $x=${x - 1}$: the radicand is ${a * (x - 1) + b}, whose cube root is not ${c}.`,
      },
      {
        label: xv(x + 2),
        feedback: `Substitute $x=${x + 2}$: the radicand is ${a * (x + 2) + b}, whose cube root is not ${c}.`,
      },
    );
    if (c < 0)
      cands.unshift({
        label: "No real solution",
        feedback: `A real cube root can be negative: $\\sqrt[3]{-8}=-2$. The equation has a real solution.`,
      });
    return {
      prompt: `Solve ${M(`${cbrtTex(rad)} = ${c}`)} for real $x$.`,
      answer: "",
      hint: `Cube both sides to remove the cube root. The right side ${c} becomes a single number; then solve the linear equation in $x$.`,
      explanation: [
        `Cube both sides: ${M(`${rad} = ${par(c)}^3 = ${c ** 3}`)}.`,
        `Solve: ${M(`${poly([[a, "x"]])} = ${c ** 3 - b}`)}, so ${xv(x)}.`,
        `Check: ${M(`${cbrtTex(String(c ** 3))} = ${c}`)}. Cubing is reversible for every real number, so no check can reject a solution.`,
      ],
      choices: choicesOf(xv(x), cands),
    };
  }

  if (variant === 1) {
    let x: number, s: number, d: number, b: number;
    do {
      x = r(-8, 8);
      s = nonzero(r, -3, 3);
      d = nonzero(r, -6, 6);
      b = s ** 3 - x;
    } while (b === 0 || Math.abs(b) > 40);
    const c = s + d;
    const rad = poly([
      [1, "x"],
      [b, ""],
    ]);
    const cands: Cand[] = [
      {
        label: xv(c ** 3 - b),
        feedback: `The ${d < 0 ? "subtracted" : "added"} ${Math.abs(d)} sits outside the cube root. Move it to the right side first; only then cube.`,
      },
      {
        label: xv((c + d) ** 3 - b),
        feedback: `Undo ${d < 0 ? "subtracting" : "adding"} ${Math.abs(d)} with the opposite operation: ${d < 0 ? "add" : "subtract"} it on the right side.`,
      },
      {
        label: xv(s - b),
        feedback: `Cube the isolated root ${s}: the radicand is $${par(s)}^3=${s ** 3}$, not ${s}.`,
      },
      {
        label: xv(s ** 3 + b),
        feedback: `Move $${b}$ to the other side with the opposite sign when solving for $x$.`,
      },
    ];
    cands.push(
      {
        label: xv(x + 1),
        feedback: `Substitute $x=${x + 1}$: the cube root is not ${s}, so the equation fails.`,
      },
      {
        label: xv(x - 1),
        feedback: `Substitute $x=${x - 1}$: the cube root is not ${s}, so the equation fails.`,
      },
      {
        label: xv(x + 2),
        feedback: `Substitute $x=${x + 2}$: the cube root is not ${s}, so the equation fails.`,
      },
    );
    return {
      prompt: `Solve ${M(`${cbrtTex(rad)} ${d < 0 ? "-" : "+"} ${Math.abs(d)} = ${c}`)} for real $x$.`,
      answer: "",
      hint: `First isolate the cube root: undo the ${d < 0 ? "subtraction" : "addition"} of ${Math.abs(d)} on both sides. Then cube both sides.`,
      explanation: [
        `Isolate the root: ${M(`${cbrtTex(rad)} = ${c} ${d < 0 ? "+" : "-"} ${Math.abs(d)} = ${s}`)}.`,
        `Cube both sides: ${M(`${rad} = ${par(s)}^3 = ${s ** 3}`)}.`,
        `${b < 0 ? "Add" : "Subtract"} ${Math.abs(b)} on both sides: ${xv(x)}.`,
      ],
      choices: choicesOf(xv(x), cands),
    };
  }

  if (variant === 2) {
    let a: number, b: number, x: number;
    do {
      a = pick(r, [1, 2, 3, 4, 5, -1, -2] as const);
      x = nonzero(r, -4, 4);
      b = r(-20, 20);
    } while (!b);
    const c = a * x ** 3 + b;
    const set = (...vals: number[]) =>
      M(`\\{${[...new Set(vals)].sort((u, w) => u - w).join(", ")}\\}`);
    const raw = (c - b) / a;
    const cands: Cand[] = [
      {
        label: set(x, -x),
        feedback: `Unlike $x^2$, an odd power takes each real value once: $${par(-x)}^3=${-(x ** 3)}$, which is not $${x ** 3}$. Only one value works.`,
      },
      {
        label: set(-x),
        feedback: `Check the sign: $${par(-x)}^3=${-(x ** 3)}$, but the equation needs $x^3=${x ** 3}$.`,
      },
      {
        label: Number.isInteger(raw)
          ? set(raw)
          : M(`\\{${fracTex(c - b, a)}\\}`),
        feedback: `That is the value of $x^3$. The last step is the cube root of it.`,
      },
      {
        label: set(x + 1),
        feedback: `Check by substituting: $${par(x + 1)}^3$ does not give $${x ** 3}$.`,
      },
      {
        label: set(x - 1),
        feedback: `Check by substituting: $${par(x - 1)}^3$ does not give $${x ** 3}$.`,
      },
      {
        label: set(2 * x),
        feedback: `Check by substituting: $${par(2 * x)}^3$ does not give $${x ** 3}$.`,
      },
    ];
    return {
      prompt: `Find all real solutions of ${M(
        `${poly([
          [a, "x^3"],
          [b, ""],
        ])} = ${c}`,
      )}. Choose the complete solution set.`,
      answer: "",
      hint: `Isolate $x^3$ first: undo the constant, then the coefficient ${a}. Then take the cube root of both sides.`,
      explanation: [
        `Subtract $${b}$: ${M(`${poly([[a, "x^3"]])} = ${c - b}`)}.`,
        `Divide by ${a}: ${M(`x^3 = ${raw}`)}.`,
        `Take the cube root: ${M(`x = ${cbrtTex(String(raw))} = ${x}`)}. A cube has one real cube root, so the solution set is ${set(x)}.`,
      ],
      choices: choicesOf(set(x), cands),
    };
  }

  let c: number, b: number, x: number;
  do {
    c = -r(1, 4);
    b = nonzero(r, -9, 9);
    x = c ** 3 - b;
  } while (!x);
  const rad = poly([
    [1, "x"],
    [b, ""],
  ]);
  return {
    prompt: `To solve ${M(`${cbrtTex(rad)} = ${c}`)} a student cubes both sides and gets $x=${x}$. Which statement is correct?`,
    answer: "",
    hint: `Substitute the candidate into the original equation: find the number under the cube root, then its cube root, and compare with ${c}.`,
    explanation: [
      `Substitute $x=${x}$: ${M(`${cbrtTex(`${x}${b < 0 ? "-" : "+"}${Math.abs(b)}`)} = ${cbrtTex(String(c ** 3))} = ${c}`)}.`,
      `It satisfies the original equation, so it is a solution. Cubing is one-to-one on real numbers, so cubing both sides cannot create false solutions; the extraneous candidates of square-root equations come from squaring, which loses sign.`,
    ],
    choices: choicesOf(
      `$x=${x}$ is a solution, because $\\sqrt[3]{${c ** 3}}=${c}$.`,
      [
        {
          label: `$x=${x}$ is extraneous, because a cube root cannot equal a negative number.`,
          feedback: `A real cube root can be negative: $\\sqrt[3]{${c ** 3}}=${c}$, since $${par(c)}^3=${c ** 3}$.`,
        },
        {
          label: `$x=${x}$ is extraneous, because cubing both sides can add false solutions, as squaring can.`,
          feedback:
            "Squaring can add false solutions because $a^2=b^2$ allows $a=-b$. Cubing is one-to-one, so $a^3=b^3$ forces $a=b$.",
        },
        {
          label: `The equation has two solutions, $x=${x}$ and $x=${-x}$.`,
          feedback: `Only one value works: $\\sqrt[3]{${-x}${b < 0 ? "-" : "+"}${Math.abs(b)}}$ is not ${c}.`,
        },
      ],
    ),
  };
}

// ================================================================== 5. polar
const trig = (f: "sin" | "cos", n: number) =>
  `\\${f}${n === 1 ? "\\theta" : `(${n}\\theta)`}`;
const TYPES = [
  {
    key: "pole-circle",
    name: "A circle centered at the pole",
    form: "$r=a$",
  },
  {
    key: "axis-circle",
    name: "A circle that passes through the pole",
    form: "$r=a\\cos\\theta$ or $r=a\\sin\\theta$",
  },
  {
    key: "line",
    name: "A line through the pole",
    form: "$\\theta=\\alpha$",
  },
  {
    key: "rose",
    name: "A rose",
    form: "$r=a\\cos(n\\theta)$ or $r=a\\sin(n\\theta)$ with $n\\ge2$",
  },
  {
    key: "cardioid",
    name: "A cardioid",
    form: "$r=a+a\\cos\\theta$ or $r=a+a\\sin\\theta$ (the two constants are equal)",
  },
  {
    key: "loop",
    name: "A limaçon with an inner loop",
    form: "$r=a+b\\cos\\theta$ or $r=a+b\\sin\\theta$ with $a<b$",
  },
] as const;

function polarCase(r: Random): Draft {
  const variant = pick(r, [0, 0, 1, 2, 3] as const);

  if (variant === 0) {
    const t = pick(r, TYPES);
    const a = r(2, 8);
    const s = pick(r, ["-", ""] as const);
    const fn = pick(r, ["sin", "cos"] as const);
    const eq: Record<(typeof TYPES)[number]["key"], string> = {
      "pole-circle": `r = ${a}`,
      "axis-circle": `r = ${s}${a} ${trig(fn, 1)}`,
      line: `\\theta = ${pick(r, ["\\frac{\\pi}{6}", "\\frac{\\pi}{4}", "\\frac{\\pi}{3}", "\\frac{2\\pi}{3}"] as const)}`,
      rose: `r = ${a} ${trig(fn, r(2, 5))}`,
      cardioid: `r = ${a} ${r(0, 1) ? "+" : "-"} ${a} ${trig(fn, 1)}`,
      loop: `r = ${a} ${r(0, 1) ? "+" : "-"} ${a + r(1, 4)} ${trig(fn, 1)}`,
    };
    const others = shuffle(
      r,
      TYPES.filter((x) => x.key !== t.key),
    );
    return {
      prompt: `Which description matches the graph of ${M(eq[t.key])}?`,
      answer: "",
      hint: `Look at how $\\theta$ appears. A constant $r$, a constant $\\theta$, $r$ equal to a trigonometric function of $\\theta$, and $r$ equal to a constant plus a trigonometric term each give a different family.`,
      explanation: [
        `Equation: ${M(eq[t.key])}.`,
        `${t.name} has equations of the form ${t.form}. This equation has that form.`,
      ],
      choices: choicesOf(
        t.name,
        others.map((x) => ({
          label: x.name,
          feedback: `${x.name} has equations of the form ${x.form}. This equation has a different form.`,
        })),
      ),
    };
  }

  if (variant === 1) {
    const n = r(2, 7);
    const a = r(2, 9);
    const fn = pick(r, ["sin", "cos"] as const);
    const sign = pick(r, ["-", ""] as const);
    const petals = n % 2 ? n : 2 * n;
    const label = (k: number) => `${k} petals`;
    const cands: Cand[] = [
      {
        label: label(n % 2 ? 2 * n : n),
        feedback:
          n % 2
            ? `For an odd $n$ the rose has $n$ petals, not $2n$. Each petal is traced twice as $\\theta$ goes from $0$ to $2\\pi$.`
            : `For an even $n$ the rose has $2n$ petals, not $n$.`,
      },
      {
        label: label(a),
        feedback: `The coefficient ${a} is the length of each petal, not the number of petals.`,
      },
      {
        label: label(n + 1),
        feedback: `The petal count is determined by whether $n=${n}$ is odd or even, not by adding 1.`,
      },
      {
        label: label(n * a),
        feedback: `The coefficient ${a} sets the petal length and does not change the count.`,
      },
      {
        label: label(petals + 1),
        feedback: `The count is exactly $n$ for odd $n$ and $2n$ for even $n$; it is never one more.`,
      },
      {
        label: label(petals + 2),
        feedback: `The count is exactly $n$ for odd $n$ and $2n$ for even $n$; it is never two more.`,
      },
    ];
    return {
      prompt: `How many petals does the graph of ${M(`r = ${sign}${a} ${trig(fn, n)}`)} have?`,
      answer: "",
      hint: `The count depends only on the multiplier ${n} of $\\theta$: look at whether it is odd or even. The coefficient ${a} does not change the count.`,
      explanation: [
        `The equation has the form $r=a\\${fn}(n\\theta)$ with $n=${n}$.`,
        n % 2
          ? `For odd $n$, a rose has $n$ petals. Here $n=${n}$ is odd, so there are ${petals} petals.`
          : `For even $n$, a rose has $2n$ petals. Here $n=${n}$ is even, so there are ${petals} petals.`,
      ],
      choices: choicesOf(label(petals), cands),
    };
  }

  if (variant === 2) {
    const roseCase = r(0, 3) === 0;
    if (roseCase) {
      const n = r(2, 6);
      const a = r(2, 9);
      const fn = pick(r, ["sin", "cos"] as const);
      const sign = pick(r, ["-", ""] as const);
      return {
        prompt: `What is the greatest distance from the pole to a point on the graph of ${M(`r = ${sign}${a} ${trig(fn, n)}`)}?`,
        answer: "",
        hint: `The trigonometric factor ranges from $-1$ to $1$. Distance from the pole is $|r|$, so find the largest $|r|$ can be.`,
        explanation: [
          `${M(trig(fn, n))} takes every value from $-1$ to $1$, so $r$ ranges from $-${a}$ to ${a}.`,
          `Distance from the pole is $|r|$, whose largest value is ${a}.`,
        ],
        choices: choicesOf(String(a), [
          {
            label: String(n),
            feedback: `${n} is the multiplier of $\\theta$, which affects the number of petals, not their length.`,
          },
          {
            label: String(a * n),
            feedback: `The multiplier ${n} changes the number of petals, not how far each reaches.`,
          },
          {
            label: String(2 * a),
            feedback: `$r$ only ranges between $-${a}$ and ${a}$; distance is not doubled.`,
          },
          {
            label: String(a + n),
            feedback: `The multiplier ${n} does not add to the petal length.`,
          },
          {
            label: String(a + 1),
            feedback: `$\\${fn}$ never exceeds 1 in size, so $|r|$ never exceeds ${a}.`,
          },
          {
            label: String(a + 2),
            feedback: `$\\${fn}$ never exceeds 1 in size, so $|r|$ never exceeds ${a}.`,
          },
          {
            label: String(a + 3),
            feedback: `$\\${fn}$ never exceeds 1 in size, so $|r|$ never exceeds ${a}.`,
          },
        ]),
      };
    }
    const a = r(1, 8);
    const b = r(1, 8);
    const fn = pick(r, ["sin", "cos"] as const);
    const s = pick(r, ["+", "-"] as const);
    const small = Math.abs(a - b);
    return {
      prompt: `What is the greatest distance from the pole to a point on the graph of ${M(`r = ${a} ${s} ${b}${trig(fn, 1)}`)}?`,
      answer: "",
      hint: `The term $${b}\\${fn}\\theta$ ranges from $-${b}$ to $${b}$. Decide which end of that range makes $|r|$ largest when added to ${a}.`,
      explanation: [
        `${M(trig(fn, 1))} ranges from $-1$ to $1$, so $${b}\\${fn}\\theta$ ranges from $-${b}$ to $${b}$.`,
        `$r=${a}${s}${b}\\${fn}\\theta$ is largest in size when the trigonometric term adds fully to ${a}, giving $|r|=${a}+${b}=${a + b}$.`,
        `The other end gives $r=${a - b}$, whose distance ${small} is smaller.`,
      ],
      choices: choicesOf(String(a + b), [
        {
          label: String(a),
          feedback: `$r=${a}$ only when the trigonometric term is 0. It can add up to ${b} more.`,
        },
        {
          label: String(b),
          feedback: `The term $${b}\\${fn}\\theta$ reaches ${b}, but the constant ${a} adds to it.`,
        },
        {
          label: String(small),
          feedback: `That is the distance when the trigonometric term works against ${a}. The greatest distance comes from the other extreme.`,
        },
        {
          label: String(a + b + 1),
          feedback: `$\\${fn}\\theta$ is never more than 1, so $r$ never exceeds ${a + b}.`,
        },
      ]),
    };
  }

  // Symmetry of a limaçon or cardioid.
  const a = r(1, 8);
  const b = r(1, 8);
  const fn = pick(r, ["sin", "cos"] as const);
  const s = pick(r, ["+", "-"] as const);
  const AXIS = "The polar axis (the $x$-axis)";
  const VERT = "The line $\\theta=\\frac{\\pi}{2}$ (the $y$-axis)";
  const correct = fn === "cos" ? AXIS : VERT;
  return {
    prompt: `The graph of ${M(`r = ${a} ${s} ${b}${trig(fn, 1)}`)} is symmetric about which of these?`,
    answer: "",
    hint: `Test a symmetry by replacing $\\theta$ with $-\\theta$ (reflection in the polar axis) or with $\\pi-\\theta$ (reflection in the line $\\theta=\\frac{\\pi}{2}$) and see whether the equation stays the same.`,
    explanation: [
      fn === "cos"
        ? `$\\cos(-\\theta)=\\cos\\theta$, so replacing $\\theta$ by $-\\theta$ leaves $r=${a}${s}${b}\\cos\\theta$ unchanged: the graph is symmetric about the polar axis.`
        : `$\\sin(\\pi-\\theta)=\\sin\\theta$, so replacing $\\theta$ by $\\pi-\\theta$ leaves $r=${a}${s}${b}\\sin\\theta$ unchanged: the graph is symmetric about the line $\\theta=\\frac{\\pi}{2}$.`,
      `The other tests change the equation, so they are not symmetries of this graph.`,
    ],
    choices: choicesOf(correct, [
      {
        label: fn === "cos" ? VERT : AXIS,
        feedback:
          fn === "cos"
            ? "Replacing $\\theta$ by $\\pi-\\theta$ turns $\\cos\\theta$ into $-\\cos\\theta$, which changes the equation."
            : "Replacing $\\theta$ by $-\\theta$ turns $\\sin\\theta$ into $-\\sin\\theta$, which changes the equation.",
      },
      {
        label: "The pole (the origin)",
        feedback:
          "Symmetry about the pole needs the equation to stay the same when $r$ is replaced by $-r$. That changes the constant term here.",
      },
      {
        label: "None of these",
        feedback:
          "One reflection test leaves this equation unchanged, so the graph has that symmetry.",
      },
    ]),
  };
}

// =================================================================== 6. cone
const CURVES = ["A circle", "An ellipse", "A parabola", "A hyperbola"] as const;
function coneCase(r: Random): Draft {
  const variant = pick(r, [0, 0, 1, 2, 3] as const);
  const alpha = r(25, 65);
  const setup = `The sides of a double cone make an angle of ${alpha}° with its axis.`;
  const planeAngle = `The plane makes an angle $\\beta$ with the axis ($0^\\circ$ means parallel to the axis, $90^\\circ$ means perpendicular).`;
  const classOf = (beta: number) =>
    beta === 90 ? 0 : beta > alpha ? 1 : beta === alpha ? 2 : 3;
  const betaFor = (cls: number) =>
    cls === 0
      ? 90
      : cls === 1
        ? r(alpha + 5, 85)
        : cls === 2
          ? alpha
          : r(5, alpha - 10);
  const why = (cls: number, beta: number) =>
    [
      `$\\beta=90^\\circ$: a plane perpendicular to the axis cuts every generator at the same distance from the vertex, giving a circle.`,
      `$\\beta=${beta}^\\circ$ is greater than ${alpha}° but less than $90^\\circ$, so the plane cuts every side line of one nappe in a closed curve: an ellipse.`,
      `$\\beta=${beta}^\\circ$ equals ${alpha}°, so the plane is parallel to a side line of the cone and cuts only one nappe in an open curve: a parabola.`,
      `$\\beta=${beta}^\\circ$ is less than ${alpha}°, so the plane is steeper than the sides and cuts both nappes: a hyperbola.`,
    ][cls]!;
  const rule = `Compare $\\beta$ with the side angle ${alpha}°: $\\beta=90^\\circ$ gives a circle, $\\alpha<\\beta<90^\\circ$ an ellipse, $\\beta=\\alpha$ a parabola, and $\\beta<\\alpha$ a hyperbola.`;

  if (variant === 0) {
    const cls = pick(r, [0, 1, 1, 2, 3, 3] as const);
    const beta = betaFor(cls);
    return {
      prompt: `${setup} A plane that does not pass through the vertex cuts the cone at ${beta}° to the axis. What curve is the intersection?`,
      answer: "",
      hint: `The side angle is ${alpha}° and the plane's angle with the axis is ${beta}°. Compare the two angles: a plane steeper than the sides, as steep as them, or flatter than them cuts different curves.`,
      explanation: [
        rule,
        why(cls, beta),
        `The curve is ${CURVES[cls]!.toLowerCase()}.`,
      ],
      choices: choicesOf(
        CURVES[cls]!,
        CURVES.map((c, i) => ({
          label: c,
          feedback: `${why(classOf(beta), beta)} That is not ${c.toLowerCase()}.`,
        })).filter((_, i) => i !== cls),
      ),
    };
  }

  if (variant === 1) {
    const cases: { text: string; cls: number }[] = [
      {
        text: "A plane perpendicular to the axis cuts one nappe of a double cone and does not pass through the vertex.",
        cls: 0,
      },
      {
        text: "A plane is parallel to one side line of a double cone and does not pass through the vertex.",
        cls: 2,
      },
      {
        text: "A plane parallel to the axis of a double cone does not pass through the vertex.",
        cls: 3,
      },
      {
        text: "A plane cuts only one nappe of a double cone in a closed curve, but is not perpendicular to the axis.",
        cls: 1,
      },
    ];
    const c = pick(r, cases);
    const reason = [
      "A plane perpendicular to the axis cuts every side line at the same height, so the section is a circle.",
      "A plane that slants across one nappe and cuts every side line there makes a closed oval, an ellipse; it is a circle only when perpendicular to the axis.",
      "A plane parallel to a side line cuts only one nappe and is open: a parabola.",
      "A plane steeper than the sides, such as one parallel to the axis, cuts both nappes in two open branches: a hyperbola.",
    ];
    return {
      prompt: `${c.text} What curve is the intersection?`,
      answer: "",
      hint: `Decide whether the plane is perpendicular to the axis, parallel to a side line, or steeper than the sides, and whether the curve is closed or has two branches.`,
      explanation: [
        reason[c.cls]!,
        `The curve is ${CURVES[c.cls]!.toLowerCase()}.`,
      ],
      choices: choicesOf(
        CURVES[c.cls]!,
        CURVES.filter((_, i) => i !== c.cls).map((label) => ({
          label,
          feedback: `The plane's position gives a different curve. ${reason[c.cls]}`,
        })),
      ),
    };
  }

  if (variant === 2) {
    const kind = pick(r, ["point", "line", "lines"] as const);
    const beta =
      kind === "point"
        ? r(alpha + 5, 85)
        : kind === "line"
          ? alpha
          : r(5, alpha - 10);
    const names = {
      point: ["A single point", "an ellipse"],
      line: ["A single line", "a parabola"],
      lines: ["Two intersecting lines", "a hyperbola"],
    } as const;
    const text = {
      point: `$\\beta=${beta}^\\circ$ is greater than ${alpha}°: only the vertex lies on the plane.`,
      line: `$\\beta=${beta}^\\circ$ equals ${alpha}°: the plane touches the cone along exactly one side line.`,
      lines: `$\\beta=${beta}^\\circ$ is less than ${alpha}°: the plane contains two side lines through the vertex.`,
    };
    const counter = {
      point: `An ellipse is the section when the plane misses the vertex. This plane passes through the vertex, so the ellipse shrinks to a point.`,
      line: `A parabola is the section when the plane misses the vertex. Through the vertex it collapses to one line.`,
      lines: `A hyperbola is the section when the plane misses the vertex. Through the vertex its two branches become two lines.`,
    };
    const labels = [names.point[0], names.line[0], names.lines[0]];
    const cands: Cand[] = [
      ...labels
        .filter((l) => l !== names[kind][0])
        .map((label) => ({
          label,
          feedback: `The number of side lines contained in the plane decides it. ${text[kind]}`,
        })),
      {
        label: cap(names[kind][1]),
        feedback: counter[kind],
      },
    ];
    return {
      prompt: `${setup} A plane passes through the vertex and makes an angle of ${beta}° with the axis. What is the intersection?`,
      answer: "",
      hint: `The plane passes through the vertex, so the section is a degenerate conic. Compare the plane's angle ${beta}° with the side angle ${alpha}°.`,
      explanation: [
        `Through the vertex the section is a point, a line or two lines. A plane steeper than the sides contains two side lines; one parallel to a side contains one; a flatter plane touches only the vertex.`,
        text[kind],
        `The intersection is ${names[kind][0].toLowerCase()}.`,
      ],
      choices: choicesOf(names[kind][0], cands),
    };
  }

  const target = r(0, 3);
  const betas = [0, 1, 2, 3].map((c) => betaFor(c));
  const lab = (b: number) => `${b}°`;
  const verb = ["a circle", "an ellipse", "a parabola", "a hyperbola"][target]!;
  return {
    prompt: `${setup} A plane that does not pass through the vertex cuts the cone. ${planeAngle} For which value of $\\beta$ is the intersection ${verb}?`,
    answer: "",
    hint: `Compare each choice with the side angle ${alpha}°. The angle that equals it, exceeds it, is smaller than it, or is $90^\\circ$ each gives a different curve.`,
    explanation: [
      rule,
      `For ${verb}, the angle must ${["be exactly $90^\\circ$", `be between ${alpha}° and 90°`, `equal ${alpha}°`, `be less than ${alpha}°`][target]}. The matching choice is ${lab(betas[target]!)}.`,
    ],
    choices: choicesOf(
      lab(betas[target]!),
      betas
        .map((b, i) => ({
          label: lab(b),
          feedback: `${why(i, b)} That gives ${["a circle", "an ellipse", "a parabola", "a hyperbola"][i]}, not ${verb}.`,
          i,
        }))
        .filter((c) => c.i !== target),
    ),
  };
}

// -------------------------------------------------------------------- dispatch
export function generateHsStateGapProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const template = hsStateGapTemplates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const build: Record<string, (r: Random) => Draft> = {
    "gauss-3x3-solve": gaussCase,
    "quadratic-inequality-interval": quadraticInequalityCase,
    "conditional-statements": conditionalCase,
    "cube-root-equation": cubeRootCase,
    "polar-graph-identify": polarCase,
    "cone-section-name": coneCase,
  };
  return assemble(template, seed, r, build[templateId]!(r));
}
