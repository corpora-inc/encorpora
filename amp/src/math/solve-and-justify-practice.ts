import type { TemplateMetadata } from "./contracts";
import { chainFamily, dispatch, pick } from "./chain-kit";
import type { Move } from "./structured-work";
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
    version: 1,
    title: "Solve a quadratic equation by factoring and justify each step",
    skillId: "quadratic-equations",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: capability,
    description:
      "Solve a quadratic equation with integer roots by moving every term to one side, factoring, using the zero-product property and solving each factor, typing each line and naming its reason.",
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
  const explanation = [
    `Start from ${startTex}.`,
    ...m.path.map(
      ([line, reason]) =>
        `$${tex(line, m.line)}$ — ${reasonLabel(m.bank, reason)}.`,
    ),
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
  },
  model: (r, axes) => quadraticModel(r, axes.form),
  render: (m, axes, r) => {
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
  variant: (m) => m.form,
});

export const solveJustifyGenerate = dispatch(solveJustifyTemplates, {
  "solve-justify-linear": (seed) => linear.generate(seed).problem,
  "solve-justify-inequality": (seed) => inequalityFamily.generate(seed).problem,
  "solve-justify-formula": (seed) => formulaFamily.generate(seed).problem,
  "solve-justify-quadratic": (seed) => quadraticFamily.generate(seed).problem,
});
/** Generators with axis control, for tests and lesson examples. */
export const solveJustifyCases = {
  "solve-justify-linear": linear.generate,
  "solve-justify-inequality": inequalityFamily.generate,
  "solve-justify-formula": formulaFamily.generate,
  "solve-justify-quadratic": quadraticFamily.generate,
};
