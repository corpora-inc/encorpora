import type { TemplateMetadata } from "./contracts";
import { chainFamily, dispatch, gcd, pick } from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type Move,
  type StructuredWorkResponse,
  type WorkGrading,
  type WorkRow,
} from "./structured-work";
import {
  derivationWork,
  tex,
  workModeAxis,
  workSurface,
  type DerivationFill,
  type DerivationModel,
} from "./structured-work-kit";
import { defineAxis, type Random } from "./variation/axes";
import type { ParseOptions } from "./expression";
import type { Surface } from "./variation/compose";

/**
 * Solve and justify: write each line of a solution and name the property
 * that justifies it. The server accepts any valid path: every line must
 * follow from the line before it by the move its reason names, and the last
 * line must give the variable alone with the exact solutions.
 */

const capability = "structured-work-v1" as const;
export const solveJustifyTemplates: readonly TemplateMetadata[] = [
  {
    id: "solve-justify-linear",
    version: 1,
    title: "Solve a linear equation and justify each step",
    skillId: "equation-reasoning",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    requiredResponseCapability: capability,
    description:
      "Write each line of the solution of a linear equation with grouping, variables on both sides or a fraction, and choose the property of equality that justifies each line; or name the reasons for given lines, or put given lines in order.",
  },
  {
    id: "solve-justify-inequality",
    version: 1,
    title: "Solve a linear inequality and justify each step",
    skillId: "linear-inequalities",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: capability,
    description:
      "Solve a linear inequality with grouped terms, writing each line and the property of inequality that justifies it, including reversing the sign when multiplying or dividing by a negative number.",
  },
  {
    id: "solve-justify-formula",
    version: 1,
    title: "Solve a formula for a variable and justify each step",
    skillId: "formula-rearrangement",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    requiredResponseCapability: capability,
    description:
      "Rearrange an area, perimeter, volume, distance, interest or temperature formula to isolate a named variable, typing each line and naming the property of equality used.",
  },
  {
    id: "solve-justify-quadratic",
    version: 2,
    reprintsFrom: 1,
    title: "Solve a quadratic equation by factoring and justify each step",
    skillId: "quadratic-equations",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: capability,
    description:
      "Solve a quadratic equation with integer roots by factoring, or derive the quadratic formula by completing the square, choosing each line and its reason.",
  },
];

/* ------------------------------------------------------------- text */

/** "3x", "-x", "x" — a coefficient on a letter, in input syntax. */
const coef = (a: number, v: string) =>
  a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`;
/** a·v + b in input syntax, dropping zero parts. */
function lin(a: number, b: number, v = "x"): string {
  if (a === 0) return `${b}`;
  const head = coef(a, v);
  return b === 0 ? head : `${head}${b < 0 ? "-" : "+"}${Math.abs(b)}`;
}
/** "(x+3)" or "(x-3)". */
const group = (b: number, v = "x") => `(${lin(1, b, v)})`;
const nonzero = (r: Random, lo: number, hi: number) => {
  for (;;) {
    const n = r(lo, hi);
    if (n !== 0) return n;
  }
};

const equality = [
  { id: "ad", label: "Addition property of equality", move: "add" },
  { id: "su", label: "Subtraction property of equality", move: "subtract" },
  { id: "mu", label: "Multiplication property of equality", move: "multiply" },
  { id: "di", label: "Division property of equality", move: "divide" },
  { id: "dp", label: "Distributive property", move: "distribute" },
  { id: "cl", label: "Combine like terms", move: "combine" },
  { id: "co", label: "Commutative property", move: "commute" },
  { id: "sy", label: "Symmetric property of equality", move: "symmetric" },
] as const satisfies readonly { id: string; label: string; move: Move }[];
const inequality = [
  { id: "ad", label: "Addition property of inequality", move: "add" },
  { id: "su", label: "Subtraction property of inequality", move: "subtract" },
  {
    id: "mu",
    label: "Multiplication property of inequality",
    move: "multiply",
  },
  { id: "di", label: "Division property of inequality", move: "divide" },
  { id: "dp", label: "Distributive property", move: "distribute" },
  { id: "cl", label: "Combine like terms", move: "combine" },
  { id: "co", label: "Commutative property", move: "commute" },
] as const satisfies readonly { id: string; label: string; move: Move }[];
const quadraticReasons = [
  { id: "ad", label: "Addition property of equality", move: "add" },
  { id: "su", label: "Subtraction property of equality", move: "subtract" },
  { id: "di", label: "Division property of equality", move: "divide" },
  { id: "fa", label: "Factoring", move: "factor" },
  { id: "zp", label: "Zero-product property", move: "zero-product" },
  { id: "dp", label: "Distributive property", move: "distribute" },
  { id: "cl", label: "Combine like terms", move: "combine" },
  { id: "sy", label: "Symmetric property of equality", move: "symmetric" },
] as const satisfies readonly { id: string; label: string; move: Move }[];
const reasonLabel = (
  bank: readonly { id: string; label: string }[],
  id: string,
) => bank.find((x) => x.id === id)!.label;

const linearLine: ParseOptions = {
  variables: ["x"],
  relations: true,
  requireRelation: true,
};
const quadraticLine: ParseOptions = {
  variables: ["x"],
  relations: true,
  requireRelation: true,
  compound: true,
  powers: true,
};

/** What each reason does, in a short plain clause (issue #1781). */
const MEANING: Record<string, string> = {
  ad: "adding the same amount to both sides",
  su: "subtracting the same amount from both sides",
  mu: "multiplying both sides by the same nonzero number",
  di: "dividing both sides by the same nonzero number",
  dp: "multiplying a number outside brackets by each term inside",
  cl: "adding terms that have the same variable part",
  co: "swapping the order of two terms, which never changes a sum",
  sy: "swapping the two sides, which keeps them equal",
  fa: "rewriting the expression as a product of brackets",
  zp: "using the fact that a product is 0 only when one of its factors is 0",
};

/** Shared rendering of a derivation: prompt by mode, worked explanation. */
function render(
  m: DerivationModel & { bank: readonly { id: string; label: string }[] },
  mode: "build" | "fill" | "order",
  fill: DerivationFill,
  r: Random,
  copy: {
    task: string;
    hint: string;
    check: string;
  },
) {
  const startTex = `$${tex(m.start, m.line)}$`;
  const prompt =
    mode === "build"
      ? `${copy.task} Write each step on its own line and choose the reason for it.`
      : mode === "fill"
        ? fill === "reasons"
          ? `${copy.task} The lines of a solution are shown. Choose the reason for each line.`
          : `${copy.task} Some lines of a solution are shown. Write the missing lines and choose their reasons.`
        : `${copy.task} The lines of a solution are shown out of order. Put them in order.`;
  const built = derivationWork(
    m,
    mode,
    fill,
    r,
    mode === "order" ? "Order the steps" : "Your solution",
  );
  const inequality = m.bank.some((x) => x.label.endsWith("of inequality"));
  const explanation = [
    `Start from ${startTex}.`,
    "Each line must follow from the line before it by a rule that keeps it true. That rule is the line's reason.",
    ...m.path.flatMap(([line, reason]) => [
      `$${tex(line, m.line)}$ — ${reasonLabel(m.bank, reason)}.`,
      `${reasonLabel(m.bank, reason)} means ${MEANING[reason] ?? "a rule that keeps the statement true"}${inequality && (reason === "mu" || reason === "di") ? "; with a negative number the inequality sign reverses" : ""}.`,
    ]),
    copy.check,
    "Other valid orders of steps are also correct: each line must follow from the line before it by the reason you name.",
  ];
  return workSurface(built, { prompt, hint: copy.hint, explanation });
}

const fillAxis = defineAxis("fill", ["reasons", "alternate"] as const);

/* ----------------------------------------------------------- linear */

type LinearForm = "grouped" | "both-sides" | "grouped-both" | "fraction";
interface LinearModel extends DerivationModel {
  form: LinearForm;
  bank: typeof equality;
  /** Private values for tests and review. */
  given: Record<string, number>;
}

function linearModel(r: Random, form: LinearForm): LinearModel {
  const s = r(-6, 12);
  const base = {
    variable: "x",
    line: linearLine,
    reasons: [...equality],
    bank: equality,
    solution: [`${s}`],
    form,
  };
  if (form === "grouped") {
    const a = pick(r, [2, 3, 4, 5, 6, -2, -3, -4]);
    const b = nonzero(r, -9, 9);
    let c = nonzero(r, -9, 9);
    if (a * b + c === 0) c += c > 0 ? 1 : -1;
    const d = a * (s + b) + c;
    const k = a * b + c;
    return {
      ...base,
      start: `${a}${group(b)}${c < 0 ? "-" : "+"}${Math.abs(c)}=${d}`,
      path: [
        [`${lin(a, a * b)}${c < 0 ? "-" : "+"}${Math.abs(c)}=${d}`, "dp"],
        [`${lin(a, k)}=${d}`, "cl"],
        [`${coef(a, "x")}=${d - k}`, k > 0 ? "su" : "ad"],
        [`x=${s}`, "di"],
      ],
      given: { a, b, c, d, s },
    };
  }
  if (form === "both-sides") {
    const c = nonzero(r, -5, 6);
    const a = c + pick(r, [2, 3, 4, 5]);
    const b = nonzero(r, -12, 12);
    const d = (a - c) * s + b;
    return {
      ...base,
      start: `${lin(a, b)}=${lin(c, d)}`,
      path: [
        [`${lin(a - c, b)}=${d}`, c > 0 ? "su" : "ad"],
        [`${coef(a - c, "x")}=${d - b}`, b > 0 ? "su" : "ad"],
        [`x=${s}`, "di"],
      ],
      given: { a, b, c, d, s },
    };
  }
  if (form === "grouped-both") {
    const c = pick(r, [2, 3, 4]);
    const a = c + pick(r, [1, 2, 3]);
    const b = nonzero(r, -6, 6);
    // a(x + b) = c(x + e): e from the solution.
    // a(s + b) = c(s + e) → c·e = a(s + b) − c·s; keep e whole.
    const num = a * (s + b) - c * s;
    if (num % c !== 0 || num === 0 || num / c === b)
      throw new Error("Need three retry");
    const e = num / c;
    const ab = a * b,
      ce = c * e;
    return {
      ...base,
      start: `${a}${group(b)}=${c}${group(e)}`,
      path: [
        [`${lin(a, ab)}=${lin(c, ce)}`, "dp"],
        [`${lin(a - c, ab)}=${ce}`, "su"],
        [`${coef(a - c, "x")}=${ce - ab}`, ab > 0 ? "su" : "ad"],
        ...(a - c === 1 ? [] : ([[`x=${s}`, "di"]] as [string, string][])),
      ],
      given: { a, b, c, e, s },
    };
  }
  // (x + b)/a + d = c: undo the addition, the division, then the addition.
  const a = pick(r, [2, 3, 4, 5, 6]);
  const b = nonzero(r, -9, 9);
  const d = nonzero(r, -9, 9);
  if ((s + b) % a !== 0 || s + b === 0) throw new Error("Need three retry");
  const q = (s + b) / a;
  const c = q + d;
  return {
    ...base,
    start: `${group(b)}/${a}${d < 0 ? "-" : "+"}${Math.abs(d)}=${c}`,
    path: [
      [`${group(b)}/${a}=${q}`, d > 0 ? "su" : "ad"],
      [`${lin(1, b)}=${a * q}`, "mu"],
      [`x=${s}`, b > 0 ? "su" : "ad"],
    ],
    given: { a, b, c, d, s },
  };
}

const linearAxes = {
  mode: workModeAxis,
  fill: fillAxis,
  form: defineAxis("form", [
    "grouped",
    "both-sides",
    "grouped-both",
    "fraction",
  ] as const),
};
const linear = chainFamily({
  template: solveJustifyTemplates[0]!,
  axes: linearAxes,
  model: (r, axes) => linearModel(r, axes.form),
  render: (m, axes, r) => {
    const startTex = `$${tex(m.start, m.line)}$`;
    const g = m.given;
    const hint =
      m.form === "grouped"
        ? `In ${startTex}, either distribute the $${g.a}$ over $${tex(lin(1, g.b!), { variables: ["x"] })}$ first, or first undo the ${g.c! < 0 ? "subtraction" : "addition"} of $${Math.abs(g.c!)}$ on the left. Name the property each time.`
        : m.form === "both-sides"
          ? `In ${startTex}, gather the $x$-terms on one side first: ${g.c! > 0 ? `subtract $${coef(g.c!, "x")}$ from` : `add $${coef(-g.c!, "x")}$ to`} both sides.`
          : m.form === "grouped-both"
            ? `In ${startTex}, distribute the $${g.a}$ and the $${g.c}$ first; then gather the $x$-terms on the left.`
            : `In ${startTex}, the ${g.d! < 0 ? "subtraction" : "addition"} of $${Math.abs(g.d!)}$ happens last. Undo it first, then undo the division by $${g.a}$.`;
    const check = `Check: substituting $x=${g.s}$ makes both sides of ${startTex} equal.`;
    return render(m, axes.mode, axes.fill, r, {
      task: `Solve ${startTex}.`,
      hint,
      check,
    });
  },
  variant: (m) => m.form,
});

/* ------------------------------------------------------- inequality */

type InequalityForm = "grouped" | "grouped-both" | "grouped-right";
const ops = ["<", ">", "<=", ">="] as const;
const flip = (op: (typeof ops)[number]) =>
  op === "<" ? ">" : op === ">" ? "<" : op === "<=" ? ">=" : "<=";
interface InequalityModel extends DerivationModel {
  form: InequalityForm;
  bank: typeof inequality;
  given: Record<string, number>;
  op: (typeof ops)[number];
  flips: boolean;
}
function inequalityModel(r: Random, form: InequalityForm): InequalityModel {
  const s = r(-6, 10);
  const op = pick(r, ops);
  const base = {
    variable: "x",
    line: linearLine,
    reasons: [...inequality],
    bank: inequality,
    form,
    op,
    inequality: true,
  };
  if (form === "grouped") {
    const a = pick(r, [2, 3, 4, 5, -2, -3, -4]);
    const b = nonzero(r, -8, 8);
    const c = a * (s + b);
    const final = a < 0 ? flip(op) : op;
    return {
      ...base,
      start: `${a}${group(b)}${op}${c}`,
      path: [
        [`${lin(a, a * b)}${op}${c}`, "dp"],
        [`${coef(a, "x")}${op}${c - a * b}`, a * b > 0 ? "su" : "ad"],
        [`x${final}${s}`, "di"],
      ],
      solution: [`x${final}${s}`],
      given: { a, b, c, s },
      flips: a < 0,
    };
  }
  if (form === "grouped-right") {
    // p·x + q op r + a(x + b) + t·x: group and like terms on the right, the
    // variable on both sides, and a negative coefficient to divide by.
    const p = pick(r, [-1, -2, -3, -4, -5]);
    const a = pick(r, [2, 3, 4]);
    const t = pick(r, [1, 2]);
    const b = nonzero(r, -5, 5);
    const q = nonzero(r, -9, 9);
    const k = p - a - t; // negative
    // k·s = (r + a·b) − q at the boundary.
    const rr = k * s + q - a * b;
    if (rr === 0 || Math.abs(rr) > 40) throw new Error("Need three retry");
    const final = flip(op);
    const head = `${lin(p, q)}${op}${rr}`;
    return {
      ...base,
      start: `${head}+${a}${group(b)}+${coef(t, "x")}`,
      path: [
        [`${head}+${lin(a, a * b)}+${coef(t, "x")}`, "dp"],
        [`${lin(p, q)}${op}${lin(a + t, rr + a * b)}`, "cl"],
        [`${lin(k, q)}${op}${rr + a * b}`, "su"],
        [`${coef(k, "x")}${op}${rr + a * b - q}`, q > 0 ? "su" : "ad"],
        [`x${final}${s}`, "di"],
      ],
      solution: [`x${final}${s}`],
      given: { p, q, r: rr, a, b, t, s },
      flips: true,
    };
  }
  // a(x + b) + c op d·x + e, with a − d of either sign.
  const a = pick(r, [2, 3, 4, 5]);
  const d = pick(
    r,
    [a - 3, a - 2, a + 1, a + 2].filter((x) => x !== 0),
  );
  const b = nonzero(r, -6, 6);
  const c = nonzero(r, -9, 9);
  const k = a * b + c;
  const e = (a - d) * s + k;
  const final = a - d < 0 ? flip(op) : op;
  if (k === 0) throw new Error("Need three retry");
  return {
    ...base,
    start: `${a}${group(b)}${c < 0 ? "-" : "+"}${Math.abs(c)}${op}${lin(d, e)}`,
    path: [
      [
        `${lin(a, a * b)}${c < 0 ? "-" : "+"}${Math.abs(c)}${op}${lin(d, e)}`,
        "dp",
      ],
      [`${lin(a, k)}${op}${lin(d, e)}`, "cl"],
      [`${lin(a - d, k)}${op}${e}`, d > 0 ? "su" : "ad"],
      [`${coef(a - d, "x")}${op}${e - k}`, k > 0 ? "su" : "ad"],
      ...(a - d === 1 ? [] : ([[`x${final}${s}`, "di"]] as [string, string][])),
    ],
    solution: [`x${final}${s}`],
    given: { a, b, c, d, e, s },
    flips: a - d < 0,
  };
}
const inequalityFamily = chainFamily({
  template: solveJustifyTemplates[1]!,
  axes: {
    mode: workModeAxis,
    fill: fillAxis,
    form: defineAxis("form", [
      "grouped",
      "grouped-both",
      "grouped-right",
    ] as const),
  },
  model: (r, axes) => inequalityModel(r, axes.form),
  render: (m, axes, r) => {
    const startTex = `$${tex(m.start, m.line)}$`;
    const g = m.given;
    const hint =
      m.form === "grouped"
        ? `In ${startTex}, distribute the $${g.a}$ first. When you divide by $${g.a}$, ${g.a! < 0 ? "remember what dividing by a negative number does to the inequality sign" : "the sign stays as it is because the number is positive"}.`
        : m.form === "grouped-right"
          ? `In ${startTex}, distribute the $${g.a}$ on the right and combine its like terms first. Then gather the $x$-terms on the left and watch the sign of the coefficient you divide by.`
          : `In ${startTex}, distribute the $${g.a}$ and combine the constants, then gather the $x$-terms on the left. Watch the sign of the coefficient you divide by.`;
    const finalLine = m.path.at(-1)![0];
    const check = m.flips
      ? `Dividing by a negative number reverses the inequality sign, so the solution is $${tex(finalLine, m.line)}$.`
      : `The final divisor is positive, so the sign is unchanged: $${tex(finalLine, m.line)}$.`;
    return render(m, axes.mode, axes.fill, r, {
      task: `Solve ${startTex}.`,
      hint,
      check,
    });
  },
  variant: (m) => `${m.form}${m.flips ? "-reverse" : ""}`,
});

/* ---------------------------------------------------------- formulas */

interface FormulaCase {
  id: string;
  context: string;
  start: string;
  target: string;
  variables: string[];
  positive: string[];
  path: [string, string][];
  solution: string;
  hint: string;
}
const formulas: FormulaCase[] = [
  {
    id: "parallelogram-height",
    context:
      "The area $A$ of a parallelogram with base $b$ and height $h$ is $A=bh$.",
    start: "A=bh",
    target: "h",
    variables: ["A", "b", "h"],
    positive: ["A", "b", "h"],
    path: [
      ["A/b=h", "di"],
      ["h=A/b", "sy"],
    ],
    solution: "A/b",
    hint: "In $A=bh$, the height $h$ is multiplied by $b$. Undo that multiplication on both sides.",
  },
  {
    id: "triangle-height",
    context:
      "The area $A$ of a triangle with base $b$ and height $h$ is $A=\\frac{1}{2}bh$.",
    start: "A=(1/2)bh",
    target: "h",
    variables: ["A", "b", "h"],
    positive: ["A", "b", "h"],
    path: [
      ["2A=bh", "mu"],
      ["2A/b=h", "di"],
      ["h=2A/b", "sy"],
    ],
    solution: "2A/b",
    hint: "In $A=\\frac{1}{2}bh$, first clear the fraction $\\frac{1}{2}$ by multiplying both sides by 2.",
  },
  {
    id: "triangle-base",
    context:
      "The area $A$ of a triangle with base $b$ and height $h$ is $A=\\frac{1}{2}bh$.",
    start: "A=(1/2)bh",
    target: "b",
    variables: ["A", "b", "h"],
    positive: ["A", "b", "h"],
    path: [
      ["2A=bh", "mu"],
      ["2A/h=b", "di"],
      ["b=2A/h", "sy"],
    ],
    solution: "2A/h",
    hint: "In $A=\\frac{1}{2}bh$, first clear the fraction $\\frac{1}{2}$ by multiplying both sides by 2.",
  },
  {
    id: "rectangle-width",
    context:
      "The perimeter $P$ of a rectangle with length $L$ and width $W$ is $P=2L+2W$.",
    start: "P=2L+2W",
    target: "W",
    variables: ["P", "L", "W"],
    positive: ["P", "L", "W"],
    path: [
      ["P-2L=2W", "su"],
      ["(P-2L)/2=W", "di"],
      ["W=(P-2L)/2", "sy"],
    ],
    solution: "(P-2L)/2",
    hint: "In $P=2L+2W$, the term $2W$ has $2L$ added to it. Remove $2L$ from both sides first.",
  },
  {
    id: "prism-height",
    context:
      "The volume $V$ of a rectangular prism with length $L$, width $W$ and height $h$ is $V=LWh$.",
    start: "V=LWh",
    target: "h",
    variables: ["V", "L", "W", "h"],
    positive: ["V", "L", "W", "h"],
    path: [
      ["V/(LW)=h", "di"],
      ["h=V/(LW)", "sy"],
    ],
    solution: "V/(LW)",
    hint: "In $V=LWh$, the height $h$ is multiplied by both $L$ and $W$. Divide both sides by the product $LW$.",
  },
  {
    id: "distance-time",
    context:
      "An object moving at a steady rate $r$ for a time $t$ travels a distance $d=rt$.",
    start: "d=rt",
    target: "t",
    variables: ["d", "r", "t"],
    positive: ["d", "r", "t"],
    path: [
      ["d/r=t", "di"],
      ["t=d/r", "sy"],
    ],
    solution: "d/r",
    hint: "In $d=rt$, the time $t$ is multiplied by the rate $r$. Undo that on both sides.",
  },
  {
    id: "interest-rate",
    context:
      "Simple interest $I$ on a principal $p$ at an annual rate $r$ for $t$ years is $I=prt$.",
    start: "I=prt",
    target: "r",
    variables: ["I", "p", "r", "t"],
    positive: ["I", "p", "r", "t"],
    path: [
      ["I/(pt)=r", "di"],
      ["r=I/(pt)", "sy"],
    ],
    solution: "I/(pt)",
    hint: "In $I=prt$, the rate $r$ is multiplied by $p$ and by $t$. Divide both sides by their product.",
  },
  {
    id: "celsius",
    context:
      "A temperature of $C$ degrees Celsius is $F=\\frac{9}{5}C+32$ degrees Fahrenheit.",
    start: "F=(9/5)C+32",
    target: "C",
    variables: ["F", "C"],
    positive: [],
    path: [
      ["F-32=(9/5)C", "su"],
      ["(5/9)(F-32)=C", "mu"],
      ["C=(5/9)(F-32)", "sy"],
    ],
    solution: "(5/9)(F-32)",
    hint: "In $F=\\frac{9}{5}C+32$, the 32 is added last. Undo it first by subtracting 32 from both sides.",
  },
];
interface FormulaModel extends DerivationModel {
  case: FormulaCase;
  bank: typeof equality;
}
const formulaFamily = chainFamily({
  template: solveJustifyTemplates[2]!,
  axes: { mode: workModeAxis, fill: fillAxis },
  model: (r, axes): FormulaModel => {
    // An ordering needs three lines or more.
    const c = pick(
      r,
      axes.mode === "order"
        ? formulas.filter((f) => f.path.length >= 3)
        : formulas,
    );
    const line: ParseOptions = {
      variables: c.variables,
      relations: true,
      requireRelation: true,
    };
    return {
      case: c,
      start: c.start,
      variable: c.target,
      line,
      reasons: [...equality],
      bank: equality,
      path: c.path,
      solution: [c.solution],
      positive: c.positive,
    };
  },
  render: (m, axes, r) =>
    render(m, axes.mode, axes.fill, r, {
      task: `${m.case.context} Solve the formula for $${m.case.target}$.`,
      hint: m.case.hint,
      check: `Check: substitute the result for $${m.case.target}$ into $${tex(m.start, m.line)}$; both sides are equal for every positive value of the other letters.`,
    }),
  variant: (m) => m.case.id,
});

/* --------------------------------------------------------- quadratic */

type QuadraticForm = "standard" | "move-constant" | "common-factor";
interface QuadraticModel extends DerivationModel {
  kind: "factor";
  form: QuadraticForm;
  bank: typeof quadraticReasons;
  roots: [number, number];
}
/** x² + bx + c in input syntax. */
const quad = (k: number, b: number, c: number) =>
  `${k === 1 ? "" : k}x^2${b === 0 ? "" : `${b < 0 ? "-" : "+"}${Math.abs(b) === 1 ? "" : Math.abs(b)}x`}${c === 0 ? "" : `${c < 0 ? "-" : "+"}${Math.abs(c)}`}`;
function quadraticModel(r: Random, form: QuadraticForm): QuadraticModel {
  const r1 = nonzero(r, -9, 9);
  let r2 = nonzero(r, -9, 9);
  if (r2 === r1) r2 = r1 > 0 ? -r1 : r1 - 1 || 2;
  const [lo, hi] = r1 < r2 ? [r1, r2] : [r2, r1];
  const b = -(lo + hi),
    c = lo * hi;
  const factored = `${group(-lo)}${group(-hi)}=0`;
  const zero = `${lin(1, -lo)}=0 or ${lin(1, -hi)}=0`;
  const solved = `x=${lo} or x=${hi}`;
  const solveReason = lo > 0 ? "ad" : "su";
  const base = {
    kind: "factor" as const,
    variable: "x",
    line: quadraticLine,
    reasons: [...quadraticReasons],
    bank: quadraticReasons,
    solution: [`${lo}`, `${hi}`],
    form,
    roots: [lo, hi] as [number, number],
  };
  if (form === "standard")
    return {
      ...base,
      start: `${quad(1, b, c)}=0`,
      path: [
        [factored, "fa"],
        [zero, "zp"],
        [solved, solveReason],
      ],
    };
  if (form === "move-constant")
    return {
      ...base,
      start: `${quad(1, b, 0)}=${-c}`,
      path: [
        [`${quad(1, b, c)}=0`, c > 0 ? "ad" : "su"],
        [factored, "fa"],
        [zero, "zp"],
        [solved, solveReason],
      ],
    };
  const k = pick(r, [2, 3]);
  if (Math.abs(k * c) > 99 || Math.abs(k * b) > 99)
    throw new Error("Need three retry");
  return {
    ...base,
    start: `${quad(k, k * b, k * c)}=0`,
    path: [
      [`${quad(1, b, c)}=0`, "di"],
      [factored, "fa"],
      [zero, "zp"],
      [solved, solveReason],
    ],
  };
}
/* ------------------------------------ quadratic formula derivation */
/** The derivation grader accepts a solved numeric variable, not a radical
 * formula in a and b. Lines are choices (proof layout) so the key still grades. */
const formulaReasons = [
  { id: "da", label: "Divide both sides by the leading coefficient" },
  { id: "su", label: "Do the same thing to both sides" },
  { id: "cs", label: "Add the square of half the linear coefficient" },
  { id: "fa", label: "Factor a perfect square" },
  { id: "cf", label: "Use a common denominator" },
  { id: "sr", label: "Take square roots of both sides, with both signs" },
] as const;
const formulaReasonIds = ["da", "su", "cs", "fa", "sr", "su"] as const;
type FormulaPiece = "numeric" | "letters" | "match";
interface GeneralModel {
  kind: "general";
  piece: FormulaPiece;
  a: number;
  b: number;
  c: number;
}
type SolveModel = QuadraticModel | GeneralModel;
const rq = (n: number, d = 1) => {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g };
};
const rqTex = (q: { n: number; d: number }) => {
  if (q.d === 1) return `${q.n}`;
  const body = `\\frac{${Math.abs(q.n)}}{${q.d}}`;
  return q.n < 0 ? `-${body}` : body;
};
const math = (body: string) => `$${body}$`;
function signedTerm(n: number, d: number, body: string, first: boolean) {
  const q = rq(n, d);
  if (q.n === 0) return "";
  const mag =
    q.d === 1
      ? `${Math.abs(q.n) === 1 && body ? "" : Math.abs(q.n)}${body}`
      : `\\frac{${Math.abs(q.n)}}{${q.d}}${body}`;
  if (first) return q.n < 0 ? `-${mag}` : mag;
  return `${q.n < 0 ? "-" : "+"}${mag}`;
}
function xPlus(n: number, d: number) {
  const q = rq(n, d);
  if (q.n === 0) return "x";
  if (q.d === 1) return `x${q.n < 0 ? "" : "+"}${q.n}`;
  const mag = `\\frac{${Math.abs(q.n)}}{${q.d}}`;
  return q.n < 0 ? `x-${mag}` : `x+${mag}`;
}
function sqShift(n: number, d: number) {
  const q = rq(n, d);
  if (q.n === 0) return "x^2";
  const inside =
    q.d === 1
      ? `${q.n < 0 ? "-" : "+"}${Math.abs(q.n)}`
      : `${q.n < 0 ? "-" : "+"}\\frac{${Math.abs(q.n)}}{${q.d}}`;
  return `\\left(x${inside}\\right)^2`;
}
const letterLines = [
  math("x^2+\\frac{b}{a}x+\\frac{c}{a}=0"),
  math("x^2+\\frac{b}{a}x=-\\frac{c}{a}"),
  math(
    "x^2+\\frac{b}{a}x+\\frac{b^2}{4a^2}=-\\frac{c}{a}+\\frac{b^2}{4a^2}",
  ),
  math("\\left(x+\\frac{b}{2a}\\right)^2=\\frac{b^2-4ac}{4a^2}"),
  math("x+\\frac{b}{2a}=\\pm\\frac{\\sqrt{b^2-4ac}}{2a}"),
  math("x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}"),
];
const letterDistractors: [string, string][] = [
  ["a4", math("\\left(x+\\frac{b}{2a}\\right)^2=\\frac{b^2-4c}{4a^2}")],
  ["b4", math("\\left(x+\\frac{b}{2a}\\right)^2=\\frac{b^2-4ac}{4a}")],
  ["c4", math("\\left(x+\\frac{b}{a}\\right)^2=\\frac{b^2-4ac}{4a^2}")],
  ["a5", math("x+\\frac{b}{2a}=\\frac{\\sqrt{b^2-4ac}}{2a}")],
  ["b5", math("x+\\frac{b}{2a}=\\pm\\frac{\\sqrt{b^2-4ac}}{4a^2}")],
  ["a6", math("x=-b\\pm\\frac{\\sqrt{b^2-4ac}}{2a}")],
];
function numericLines(a: number, b: number, c: number): string[] {
  const disc = b * b - 4 * a * c;
  const den2 = 2 * a;
  const den4 = 4 * a * a;
  const head = -b;
  const radical =
    head === 0
      ? `\\pm\\sqrt{${disc}}`
      : `${head < 0 ? "-" : ""}${Math.abs(head)}\\pm\\sqrt{${disc}}`;
  return [
    math(`x^2${signedTerm(b, a, "x", false)}${signedTerm(c, a, "", false)}=0`),
    math(`x^2${signedTerm(b, a, "x", false)}=${signedTerm(-c, a, "", true)}`),
    math(
      `x^2${signedTerm(b, a, "x", false)}${signedTerm(b * b, den4, "", false)}=${signedTerm(-c, a, "", true)}${signedTerm(b * b, den4, "", false)}`,
    ),
    math(`${sqShift(b, den2)}=${rqTex(rq(disc, den4))}`),
    math(`${xPlus(b, den2)}=\\pm\\frac{\\sqrt{${disc}}}{${den2}}`),
    math(`x=\\frac{${radical}}{${den2}}`),
  ];
}
function numericDistractors(a: number, b: number, c: number, lines: string[]) {
  const disc = b * b - 4 * a * c;
  const den2 = 2 * a;
  const den4 = 4 * a * a;
  const head = -b;
  const partial =
    head < 0
      ? `x=-${Math.abs(head)}\\pm\\frac{\\sqrt{${disc}}}{${den2}}`
      : `x=${head}\\pm\\frac{\\sqrt{${disc}}}{${den2}}`;
  const raw: [string, string][] = [
    ["a4", math(`${sqShift(b, den2)}=${rqTex(rq(b * b - 4 * c, den4))}`)],
    ["b4", math(`${sqShift(b, den2)}=${rqTex(rq(disc, 4 * a))}`)],
    ["c4", math(`${sqShift(b, a)}=${rqTex(rq(disc, den4))}`)],
    ["a5", math(`${xPlus(b, den2)}=\\frac{\\sqrt{${disc}}}{${den2}}`)],
    ["b5", math(`${xPlus(b, den2)}=\\pm\\frac{\\sqrt{${disc}}}{${den4}}`)],
    ["a6", math(partial)],
  ];
  const used = new Set(lines);
  return raw
    .filter(([, label]) => !used.has(label))
    .map(([id, label]) => ({ id, label }));
}
function isSquare(n: number) {
  const s = Math.round(Math.sqrt(n));
  return s * s === n;
}
function numericCoeffs(r: Random): { a: number; b: number; c: number } {
  for (let i = 0; i < 40; i++) {
    const a = pick(r, [2, 3, 5]);
    const b = r(-9, 9);
    const c = r(-9, 9);
    if (b === 0 || c === 0) continue;
    const disc = b * b - 4 * a * c;
    if (disc <= 0 || isSquare(disc)) continue;
    return { a, b, c };
  }
  throw new Error("Need three retry");
}
const chainClaims: WorkGrading = {
  mode: "proof",
  goal: "l6",
  claims: {
    l1: { da: [[]] },
    l2: { su: [["l1"]] },
    l3: { cs: [["l2"]] },
    l4: { fa: [["l3"]], cf: [["l3"]] },
    l5: { sr: [["l4"]] },
    l6: { su: [["l5"]] },
  },
};
function formulaSurface(
  m: GeneralModel,
  mode: "build" | "fill" | "order",
  fill: DerivationFill,
  r: Random,
): Surface {
  const match = m.piece === "match";
  const lines = match || m.piece === "letters" ? letterLines : numericLines(m.a, m.b, m.c);
  const shown = m.piece === "letters" ? letterLines : numericLines(m.a, m.b, m.c);
  const distractors = match
    ? letterDistractors.map(([id, label]) => ({ id, label }))
    : m.piece === "letters"
      ? letterDistractors.map(([id, label]) => ({ id, label }))
      : numericDistractors(m.a, m.b, m.c, lines);
  if (distractors.length < 3) throw new Error("Need three retry");
  const statements = [
    ...lines.map((label, i) => ({ id: `l${i + 1}`, label })),
    ...distractors,
  ];
  if (
    statements.length > 12 ||
    new Set(statements.map((s) => s.label)).size !== statements.length ||
    new Set(statements.map((s) => s.id)).size !== statements.length
  )
    throw new Error("Need three retry");
  const path: [string, string][] = match
    ? [["l4", "fa"]]
    : formulaReasonIds.map((reason, i) => [`l${i + 1}`, reason]);
  const grading: WorkGrading = match
    ? { mode: "proof", goal: "l4", claims: { l4: { fa: [[]], cf: [[]] } } }
    : chainClaims;
  const givenRow = (i: number) =>
    !match && fill === "alternate" && (path.length - 1 - i) % 2 === 1;
  const rows: WorkRow[] = path.map(([line, reason], i) => {
    const showLine = mode === "order" || (mode === "fill" && !match && (fill === "reasons" || givenRow(i)));
    const showReason =
      mode === "order" || (mode === "fill" && (match || givenRow(i)));
    return {
      id: `r${i + 1}`,
      fields: [
        {
          kind: "choice" as const,
          label: "Line",
          bank: "lines",
          ...(showLine ? { given: line } : {}),
        },
        {
          kind: "choice" as const,
          label: "Reason",
          bank: "reasons",
          ...(showReason ? { given: reason } : {}),
        },
      ],
    };
  });
  const banks = [
    { id: "lines", label: "Line", options: statements },
    {
      id: "reasons",
      label: "Reason",
      options: formulaReasons.map(({ id, label }) => ({ id, label })),
    },
  ];
  const start =
    m.piece === "letters"
      ? math("ax^2+bx+c=0")
      : math(`${quad(m.a, m.b, m.c)}=0`);
  const goalTex = "A solved equation for $x$.";
  const base = {
    kind: "structured-work" as const,
    label: match ? "Choose the matching line" : "Your solution",
    layout: "proof" as const,
    mode,
    start,
    goal: goalTex,
    banks,
  };
  let response: StructuredWorkResponse;
  let answer: string;
  if (mode === "order") {
    const renumber = (order: WorkRow[]) => {
      const display = new Map(order.map((row, j) => [row.id, `r${j + 1}`]));
      return {
        shown: order.map((row) => ({ ...row, id: display.get(row.id)! })),
        key: JSON.stringify(rows.map((row) => display.get(row.id)!)),
      };
    };
    let found: { shown: WorkRow[]; key: string } | undefined;
    for (let i = 0; i < 60 && !found; i++) {
      const out = renumber(shuffle(r, [...rows]));
      const shownKey = JSON.stringify(out.shown.map((row) => row.id));
      const trial: StructuredWorkResponse = { ...base, rows: out.shown };
      if (
        !gradeStructuredWork(trial, grading, shownKey) &&
        gradeStructuredWork(trial, grading, out.key)
      )
        found = out;
    }
    if (!found) throw new Error("Need three retry");
    response = { ...base, rows: found.shown };
    answer = found.key;
  } else {
    response = { ...base, rows };
    answer = JSON.stringify(
      path.map(([line, reason], i) => {
        const row = rows[i]!;
        return [
          row.fields[0]!.given ? "" : line,
          row.fields[1]!.given ? "" : reason,
        ];
      }),
    );
  }
  const broken = structuralProblem(response);
  if (broken) throw new Error(broken);
  if (!gradingFits(response, grading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Answer key is not canonical: ${answer}`);
  if (!gradeStructuredWork(response, grading, answer))
    throw new Error("Answer key is not credited");
  const equation = start;
  const prompt = match
    ? `Line 4 of completing the square on ${equation} is ${shown[3]}. Which line of the general derivation is it an instance of? Choose that line and its reason.`
    : m.piece === "letters"
      ? `Solve ${equation}, $a \\ne 0$, by completing the square. Choose each line and its reason.`
      : `Solve ${equation} by completing the square. Choose each line and its reason.`;
  const hint = match
    ? `Line 4 of completing the square on ${equation} is ${shown[3]}. A finished square set equal to one fraction is the step that uses a common denominator.`
    : `Start from ${equation}. Divide by the leading coefficient first, then move the constant. Add the square of half the new $x$ coefficient.`;
  const explanation = match
    ? [
        `${lines[3]} is the finished square, with the right side over one denominator.`,
        "That is the general line $\\left(x+\\frac{b}{2a}\\right)^2=\\frac{b^2-4ac}{4a^2}$.",
        "Factoring the square and combining the right side are the two reasons for that line.",
      ]
    : [
        `Start from ${equation}. Divide by the leading coefficient first.`,
        "Move the constant, then add the square of half the linear coefficient.",
        "Factor the square and write the right side over one denominator.",
        "Take both square roots, then move the extra term.",
        "The first part, $-\\frac{b}{2a}$, is the axis. The rest is half the gap between the zeros.",
        "Under the root: positive means two real zeros, zero means one, and negative means none.",
      ];
  return {
    prompt,
    hint,
    explanation,
    response,
    answer,
    workGrading: grading,
  };
}
const quadraticFamily = chainFamily({
  template: solveJustifyTemplates[3]!,
  axes: {
    mode: workModeAxis,
    fill: fillAxis,
    form: defineAxis("form", [
      "standard",
      "move-constant",
      "common-factor",
    ] as const),
    family: defineAxis(
      "family",
      ["factoring", "general-coefficients"] as const,
      { legacy: "factoring", silentLegacy: true, since: 2 },
    ),
    piece: defineAxis("piece", ["numeric", "letters", "match"] as const, {
      legacy: "numeric",
      silentLegacy: true,
      since: 2,
      weights: [5, 1, 2],
    }),
  },
  model: (r, axes): SolveModel => {
    if (axes.family !== "general-coefficients")
      return quadraticModel(r, axes.form);
    const piece: FormulaPiece =
      axes.mode === "order" && axes.piece === "match" ? "numeric" : axes.piece;
    if (piece === "letters")
      return { kind: "general", piece, a: 0, b: 0, c: 0 };
    return { kind: "general", piece, ...numericCoeffs(r) };
  },
  render: (m, axes, r) => {
    if (m.kind === "general")
      return formulaSurface(m, axes.mode, axes.fill, r);
    const startTex = `$${tex(m.start, m.line)}$`;
    const [lo, hi] = m.roots;
    const c = lo * hi,
      b = -(lo + hi);
    const hint =
      m.form === "move-constant"
        ? `Get 0 on one side of ${startTex} first: ${c > 0 ? "add" : "subtract"} $${Math.abs(c)}$ ${c > 0 ? "to" : "from"} both sides. Then factor.`
        : m.form === "common-factor"
          ? `Every coefficient of ${startTex} has a common factor. Divide both sides by it, then factor.`
          : `To factor ${startTex}, look for two numbers whose product is $${c}$ and whose sum is $${b}$.`;
    return render(m, axes.mode, axes.fill, r, {
      task: `Solve ${startTex} by factoring.`,
      hint,
      check: `Check: $x=${lo}$ and $x=${hi}$ each make ${startTex} true.`,
    });
  },
  variant: (m) => (m.kind === "general" ? `general-${m.piece}` : m.form),
});

export const solveJustifyGenerate = dispatch(solveJustifyTemplates, {
  "solve-justify-linear": (seed) => linear.generate(seed).problem,
  "solve-justify-inequality": (seed) => inequalityFamily.generate(seed).problem,
  "solve-justify-formula": (seed) => formulaFamily.generate(seed).problem,
  "solve-justify-quadratic": (seed) => {
    const problem = quadraticFamily.generate(seed).problem;
    const axes = { ...(problem.variant?.axes ?? {}) };
    if (axes.family === "factoring") delete axes.family;
    if (!axes.family || axes.piece === "numeric") delete axes.piece;
    return problem.variant
      ? { ...problem, variant: { ...problem.variant, axes } }
      : problem;
  },
});
/** Generators with axis control, for tests and lesson examples. */
export const solveJustifyCases = {
  "solve-justify-linear": linear.generate,
  "solve-justify-inequality": inequalityFamily.generate,
  "solve-justify-formula": formulaFamily.generate,
  "solve-justify-quadratic": quadraticFamily.generate,
};
