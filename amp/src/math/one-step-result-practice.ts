import type { TemplateMetadata } from "./contracts";
import { defineAxis, type Random } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  decimalText,
  dispatch,
  type ChoiceOption,
} from "./chain-kit";
import { shuffled } from "./elementary-gap-kit";

/**
 * "Choose the result of one step": one exact model per family computes the
 * starting object, the single correct step and the slips that make wrong
 * options. Each wrong option is a real slip with its own feedback.
 */
export const equationAfterOneStepTemplate: TemplateMetadata = {
  id: "equation-after-one-step",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Choose the equation after one step",
  skillId: "two-step-equations",
  gradeBand: "6–8",
  difficultyOffset: 0.2,
  description:
    "Choose the equation that results from one inverse step on both sides of a two-step equation: undoing a constant, dividing a grouped equation by its factor, or undoing a fraction coefficient.",
};
export const expressionAfterFirstStepTemplate: TemplateMetadata = {
  id: "expression-after-first-step",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Choose the expression after the first step",
  skillId: "numerical-expressions",
  gradeBand: "3–5",
  difficultyOffset: 0.35,
  description:
    "Choose the expression that results from only the first step of the order of operations on a decimal expression with a bracketed product, or find the first line of a shown simplification that skips the bracket.",
};
export const factorOutChoiceTemplate: TemplateMetadata = {
  id: "factor-out-choice",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Choose the expression with a number factored out",
  skillId: "expression-properties",
  gradeBand: "6–8",
  difficultyOffset: 0.25,
  description:
    "Choose the equivalent expression after a stated number, positive or negative, is factored out of a two-term or three-term linear expression.",
};
export const stepReasonTableTemplate: TemplateMetadata = {
  id: "step-reason-table",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Choose the property behind each step",
  skillId: "equation-reasoning",
  gradeBand: "9–12",
  difficultyOffset: 0.1,
  description:
    "Choose the list of properties that justifies each line of a shown linear equation solution: distributive, addition, subtraction, multiplication and division properties.",
};

/* ---------------------------------------------------------------- helpers */
/** Coefficients and a constant as TeX: [2,-1], ["x","y"], 5 -> 2x-y+5. */
function poly(coefs: number[], vars: string[], konst?: number): string {
  let out = "";
  const add = (c: number, body: string, bare: boolean) => {
    if (c === 0) return;
    const mag = Math.abs(c);
    const text = bare ? String(mag) : `${mag === 1 ? "" : mag}${body}`;
    out += out ? (c < 0 ? "-" : "+") + text : (c < 0 ? "-" : "") + text;
  };
  coefs.forEach((c, i) => add(c, vars[i]!, false));
  if (konst !== undefined) add(konst, "", true);
  return out || "0";
}
const m = (tex: string) => `$${tex}$`;
const mx = (c: number | string) => `$${c}x$`;
const sign = (r: Random) => (r(0, 1) ? 1 : -1);

type Wrong = { label: string; feedback: string };
function finish(
  r: Random,
  prompt: string,
  correct: string,
  wrong: Wrong[],
  hint: string,
  explanation: string[],
) {
  const options: ChoiceOption[] = [
    { label: correct, correct: true },
    ...shuffled(r, wrong).map((w) => ({ ...w })),
  ];
  return choiceSurface(r, { prompt, options, hint, explanation });
}

/* ------------------------------------------------------- equation, 1 step */
const equationAxes = {
  form: defineAxis("form", [
    "undo-constant",
    "divide-grouped",
    "undo-fraction",
  ] as const),
  ask: defineAxis("ask", ["named-step", "inverse-of-term"] as const),
};
interface EquationModel {
  a: number; // multiplier, factor or denominator
  b: number; // signed constant
  c: number;
  q: number;
}
function equationModel(
  r: Random,
  ax: { form: string; ask: string },
): EquationModel {
  const b = sign(r) * r(1, 12);
  if (ax.form === "undo-constant") {
    const a = r(2, 9);
    const x = r(2, 12);
    return { a, b, c: a * x + b, q: x };
  }
  if (ax.form === "divide-grouped") {
    const k = r(2, 9);
    const q = r(2, 9);
    return { a: k, b, c: k * q, q };
  }
  const d = r(2, 7);
  const s = r(1, 9);
  const c = s + b;
  if (c === 0) throw new Error("Need three retries");
  return { a: d, b, c, q: s };
}
export const equationAfterOneStep = chainFamily({
  template: equationAfterOneStepTemplate,
  axes: equationAxes,
  model: equationModel,
  variant: () => "equation-step",
  render: (e, ax, r) => {
    const { a, b, c } = e;
    const move = b > 0 ? "Subtract" : "Add";
    const sb = Math.abs(b);
    const lead =
      ax.form === "undo-constant"
        ? `${m(poly([a], ["x"], b) + "=" + c)}`
        : ax.form === "divide-grouped"
          ? m(`${a}(${poly([1], ["x"], b)})=${c}`)
          : m(`\\frac{x}{${a}}${b < 0 ? "-" : "+"}${sb}=${c}`);
    let step: string;
    let correct: string;
    let wrong: Wrong[];
    let hint: string;
    let why: string[];
    if (ax.form === "undo-constant") {
      step =
        ax.ask === "named-step"
          ? `${move} ${m(String(sb))} ${b > 0 ? "from" : "to"} both sides of ${lead}.`
          : `Take the one step that removes the constant term ${m(String(b))} from the left side of ${lead}.`;
      correct = m(`${a}x=${c - b}`);
      wrong = [
        {
          label: m(`${a}x=${c + b}`),
          feedback: `The right side was changed the wrong way: ${b > 0 ? `${sb} was added to` : `${sb} was taken from`} ${m(String(c))}. Do the same operation, ${b > 0 ? "subtract" : "add"} ${m(String(sb))}, on both sides.`,
        },
        {
          label: m(`${a}x=${c}`),
          feedback: `The constant was removed from the left side only. Do the same to the right side, ${m(String(c))}.`,
        },
        {
          label: m(`${poly([a], ["x"], 2 * b)}=${c + b}`),
          feedback: `This ${b > 0 ? "adds" : "subtracts"} ${m(String(sb))} instead of undoing it, so the left constant doubles. Use the opposite operation to make it 0.`,
        },
        {
          label: m(`x=${c - b}`),
          feedback: `Dividing by ${m(String(a))} is a second step, and ${mx(a)} was not divided. Do only the one step asked for.`,
        },
      ];
      hint = `The left side has ${mx(a)} and the constant ${m(String(b))}. Use the opposite of that constant on both sides, and leave the ${mx(a)} alone.`;
      why = [
        `An equation is like a balance: both sides have the same value. Whatever you do to one side, do to the other, so it stays balanced.`,
        `The constant term, ${m(String(b))}, is the number with no ${m("x")} beside it.`,
        `${b > 0 ? "Subtracting" : "Adding"} ${m(String(sb))} undoes it, so ${move.toLowerCase()} ${m(String(sb))} ${b > 0 ? "from" : "to"} both sides: $${poly([a], ["x"], b)}${b > 0 ? "-" : "+"}${sb}=${c}${b > 0 ? "-" : "+"}${sb}$.`,
        `On the left the constant becomes 0, leaving $${a}x$. On the right, $${c}${b > 0 ? "-" : "+"}${sb}=${c - b}$.`,
      ];
    } else if (ax.form === "divide-grouped") {
      const q = c / a;
      step =
        ax.ask === "named-step"
          ? `Divide both sides of ${lead} by ${m(String(a))}.`
          : `Take the one step that undoes the multiplication by ${m(String(a))} outside the parentheses in ${lead}.`;
      correct = m(`${poly([1], ["x"], b)}=${q}`);
      wrong = [
        {
          label: m(`${poly([1], ["x"], b)}=${c}`),
          feedback: `Both sides must be divided by ${m(String(a))}: the right side ${m(String(c))} becomes ${m(String(q))}.`,
        },
        {
          label: m(`${poly([a], ["x"], b)}=${q}`),
          feedback: `Only the right side was divided by ${m(String(a))}. The whole left side must be divided too.`,
        },
        {
          label: m(`${poly([1], ["x"], b)}=${c - a}`),
          feedback: `Dividing by ${m(String(a))} is not subtracting ${m(String(a))}. Divide the right side, ${m(String(c))}, by ${m(String(a))}.`,
        },
        {
          label: m(`x=${q - b}`),
          feedback: `This also removes the ${m(String(b))} from the left side. That is a second step, and the question asks for one.`,
        },
      ];
      hint = `The factor ${m(String(a))} multiplies the whole group ${m(poly([1], ["x"], b))}. Divide both sides of the equation by ${m(String(a))}, and keep the group together.`;
      why = [
        `An equation is like a balance: both sides have the same value. Whatever you do to one side, do to the other, so it stays balanced.`,
        `${m(`${a}(${poly([1], ["x"], b)})`)} means ${a} times the whole group in the parentheses.`,
        `Dividing undoes multiplying, so divide both sides by ${m(String(a))}: $\\frac{${a}(${poly([1], ["x"], b)})}{${a}}=\\frac{${c}}{${a}}$.`,
        `On the left, ${a} divided by ${a} is 1, so only the group is left. On the right, $${c}\\div ${a}=${q}$.`,
      ];
    } else {
      step =
        ax.ask === "named-step"
          ? `Multiply both sides of ${lead} by ${m(String(a))}.`
          : `Take the one step that undoes the division by ${m(String(a))} in ${lead}.`;
      correct = m(`${poly([1], ["x"], a * b)}=${a * c}`);
      wrong = [
        {
          label: m(`${poly([1], ["x"], b)}=${a * c}`),
          feedback: `Every term is multiplied by ${m(String(a))}, including the ${m(String(b))}, which becomes ${m(String(a * b))}.`,
        },
        {
          label: m(`${poly([1], ["x"], a * b)}=${c}`),
          feedback: `The right side must be multiplied by ${m(String(a))} too: ${m(String(c))} becomes ${m(String(a * c))}.`,
        },
        {
          label: m(`${poly([1], ["x"], a * b)}=${c + a}`),
          feedback: `Multiplying by ${m(String(a))} is not adding ${m(String(a))}. Multiply the right side ${m(String(c))} by ${m(String(a))}.`,
        },
        {
          label: m(
            `\\frac{x}{${a}}${a * b < 0 ? "-" : "+"}${Math.abs(a * b)}=${a * c}`,
          ),
          feedback: `The fraction term was not multiplied, so the division by ${m(String(a))} is still there.`,
        },
      ];
      hint = `The term ${m("x")} is divided by ${m(String(a))}. Multiply every term on both sides, including ${m(String(b))} and ${m(String(c))}, by ${m(String(a))}.`;
      why = [
        `An equation is like a balance: both sides have the same value. Whatever you do to one side, do to the other, so it stays balanced.`,
        `${m(`\\frac{x}{${a}}`)} means ${m("x")} divided by ${a}. Multiplying undoes dividing, so multiply both sides by ${a}.`,
        `The ${a} must multiply every term on the left, not only ${m(`\\frac{x}{${a}}`)}: $${a}\\left(\\frac{x}{${a}}${b < 0 ? "-" : "+"}${sb}\\right)=${a}\\cdot ${c < 0 ? `(${c})` : c}$.`,
        `Multiply each term (distribute): ${m(`${a}\\cdot\\frac{x}{${a}}=x`)}, ${m(`${a}\\cdot ${sb}=${a * sb}`)} and ${m(`${a}\\cdot ${c < 0 ? `(${c})` : c}=${a * c}`)}.`,
      ];
    }
    return finish(r, `${step} Which equation results?`, correct, wrong, hint, [
      ...why,
      `The question asks for one step only, so stop here. The resulting equation is ${correct}.`,
    ]);
  },
});

/* ----------------------------------------------- expression, first step */
const expressionAxes = {
  ask: defineAxis("ask", ["first-step-result", "first-wrong-line"] as const),
};
interface ExpressionModel {
  inner: "sum" | "difference";
  a: number; // tenths
  b: number; // tenths
  c: number; // tenths
  d: number;
  error: "bracket-line-2" | "bracket-line-3" | "arithmetic-line-4";
  slip: number;
}
function expressionModel(r: Random, ax: { ask: string }): ExpressionModel {
  const inner = r(0, 1) ? "sum" : "difference";
  // One first-step item in three uses whole numbers, the rest tenths.
  const whole = ax.ask === "first-step-result" && r(0, 2) === 0;
  const unit = whole ? 10 : 1;
  const c = whole ? 10 * r(1, 3) : r(5, 30);
  const d = r(2, 9);
  const p = c * d;
  let a: number;
  let b: number;
  if (inner === "sum") {
    b = whole ? unit * r(1, 5) : r(10, 40);
    a = b + p + (whole ? unit * r(1, 6) : r(10, 60));
  } else {
    b = p + (whole ? unit * r(1, 4) : r(5, 40));
    a = whole ? unit * r(1, 8) : r(10, 80);
  }
  const error = (
    ["bracket-line-2", "bracket-line-3", "arithmetic-line-4"] as const
  )[r(0, 2)]!;
  return { inner, a, b, c, d, error, slip: r(1, 9) };
}
const dt = (tenths: number) => decimalText(tenths, 10);
export const expressionAfterFirstStep = chainFamily({
  template: expressionAfterFirstStepTemplate,
  axes: expressionAxes,
  model: expressionModel,
  variant: (e) => `inner-${e.inner}`,
  render: (e, ax, r) => {
    const { a, b, c, d, inner } = e;
    const p = c * d;
    const out = inner === "sum" ? "-" : "+";
    const op = inner === "sum" ? "+" : "-";
    const times = `${dt(c)}\\times ${d}`;
    const original = `${dt(a)}${out}(${dt(b)}${op}${times})`;
    const innerValue = inner === "sum" ? b + p : b - p;
    if (ax.ask === "first-step-result") {
      const s = inner === "sum" ? b + c : b - c;
      const left = inner === "sum" ? a - b : a + b;
      const correct = m(`${dt(a)}${out}(${dt(b)}${op}${dt(p)})`);
      const wrong: Wrong[] = [
        {
          label: m(`${dt(a)}${out}${dt(s)}\\times ${d}`),
          feedback: `Inside the parentheses, multiplication comes before ${inner === "sum" ? "addition" : "subtraction"}. ${m(times)} is the first step.`,
        },
        {
          label: m(`${dt(a)}${out}${dt(innerValue)}`),
          feedback: `This does two steps: the multiplication and then the ${inner === "sum" ? "addition" : "subtraction"} inside the parentheses. The question asks for only the first step.`,
        },
        {
          label: m(`${dt(left)}${op}${times}`),
          feedback: `This works left to right outside the parentheses first. The parentheses come first, so start inside them.`,
        },
        {
          label: m(`${dt(a)}${out}(${dt(b)}${op}${dt(p * 10)})`),
          feedback: `${m(times)} is ${dt(p)}, not ${dt(p * 10)}: the decimal point moved one place. Tenths times a whole number is still tenths.`,
        },
      ];
      return finish(
        r,
        `Do only the first step of the order of operations on ${m(original)}. Which expression do you get?`,
        correct,
        wrong,
        `Look inside the parentheses at ${dt(b)} ${op} ${dt(c)} × ${d}. Decide which operation is done first, and rewrite only that part.`,
        [
          `The order of operations is the agreed order for working out an expression, so everyone gets the same answer.`,
          `Work inside the parentheses first. Inside them, multiply before you ${inner === "sum" ? "add" : "subtract"}.`,
          `So the first step is the multiplication: $${times}=${dt(p)}$.`,
          `Replace only that part and copy everything else: ${correct}.`,
          `The expression after the first step is ${correct}.`,
        ],
      );
    }
    // first-wrong-line: whole-number work with a shown student solution.
    const wa = Math.round(a / 10) + 40;
    const wb = Math.round(b / 10) + 2;
    const wc = Math.max(2, Math.round(c / 10));
    const wd = Math.min(6, d);
    const P = wc * wd;
    const Q = wb + P;
    const S = wb + wc;
    const T = S * wd;
    if (wa - Q < 0 || wa - T < 0) throw new Error("Need three retries");
    const R = wa - Q;
    const L1 = `${wa}-(${wb}+${wc}\\times ${wd})`;
    let lines: string[];
    let bad: number;
    if (e.error === "bracket-line-2") {
      lines = [`${wa}-${S}\\times ${wd}`, `${wa}-${T}`, `${wa - T}`];
      bad = 2;
    } else if (e.error === "bracket-line-3") {
      lines = [`${wa}-(${wb}+${P})`, `${wa - wb}+${P}`, `${wa - wb + P}`];
      bad = 3;
    } else {
      lines = [`${wa}-(${wb}+${P})`, `${wa}-${Q}`, `${R + e.slip}`];
      bad = 4;
    }
    const options: Wrong[] = [
      { label: "Line 2", feedback: "" },
      { label: "Line 3", feedback: "" },
      { label: "Line 4", feedback: "" },
    ];
    const fb = (n: number) =>
      n < bad
        ? `Line ${n} follows from the line before it by one correct step, so the first mistake comes later.`
        : `Line ${bad} already has a mistake, so Line ${n} is not the first line with one.`;
    const correct = `Line ${bad}`;
    const wrong: Wrong[] = [
      ...options
        .filter((o) => o.label !== correct)
        .map((o) => ({
          label: o.label,
          feedback: fb(Number(o.label.slice(-1))),
        })),
      {
        label: "No line has a mistake",
        feedback: `Redo Line ${bad} from the line before it. Your result will not match what the student wrote.`,
      },
    ];
    const work = [L1, ...lines]
      .map((l, i) => `Line ${i + 1}: ${m(l)}.`)
      .join(" ");
    const why =
      e.error === "bracket-line-2"
        ? [
            `The order of operations says: work inside the parentheses first, and inside them multiply before you add.`,
            `So the first step is ${wc} × ${wd} = ${P}, and Line 2 should be ${m(`${wa}-(${wb}+${P})`)}.`,
            `Line 2 added ${wb} and ${wc} first, which skips the multiplication inside the parentheses. That is the first mistake.`,
          ]
        : e.error === "bracket-line-3"
          ? [
              `The order of operations says: work inside the parentheses first, and inside them multiply before you add.`,
              `Line 2 is correct: it replaces ${wc} × ${wd} with ${P}.`,
              `Line 3 should finish the parentheses: ${wb} + ${P} = ${Q}, giving ${m(`${wa}-${Q}`)}.`,
              `Instead it took ${wb} away from ${wa} and left ${P} outside the parentheses, so the parentheses were broken apart. That is the first mistake.`,
            ]
          : [
              `The order of operations says: work inside the parentheses first, and inside them multiply before you add.`,
              `Lines 2 and 3 are correct: ${wc} × ${wd} = ${P}, then ${wb} + ${P} = ${Q}.`,
              `The subtraction ${m(`${wa}-${Q}`)} is ${R}, but Line 4 shows ${R + e.slip}. That is the first mistake.`,
            ];
    return finish(
      r,
      `A student simplifies ${m(L1)}. ${work} Which line is the first to contain a mistake?`,
      correct,
      wrong,
      `Redo the work yourself from ${m(L1)}. Inside the parentheses, which comes first: ${wb} + ${wc} or ${wc} × ${wd}? Then compare each line with yours.`,
      [...why, `The first line with a mistake is ${correct}.`],
    );
  },
});

/* ------------------------------------------------------------- factor out */
const factorAxes = {
  shape: defineAxis("shape", [
    "two-terms-plus",
    "two-terms-minus",
    "three-terms",
    "negative-factor",
  ] as const),
};
interface FactorModel {
  g: number;
  inner: number[]; // x, (y,) constant
  vars: string[];
}
function factorModel(r: Random, ax: { shape: string }): FactorModel {
  const g = ax.shape === "negative-factor" ? -r(2, 9) : r(2, 9);
  if (ax.shape === "three-terms") {
    const inner = [r(1, 6), sign(r) * r(1, 6), sign(r) * r(1, 9)];
    return { g, inner, vars: ["x", "y"] };
  }
  const k = r(1, 9);
  const inner = [
    r(1, 7),
    ax.shape === "two-terms-minus" || ax.shape === "negative-factor" ? -k : k,
  ];
  if (ax.shape === "negative-factor" && r(0, 1)) inner[1] = k;
  return { g, inner, vars: ["x"] };
}
const lin = (v: number[], vars: string[]) =>
  poly(v.slice(0, -1), vars, v[v.length - 1]);
export const factorOutChoice = chainFamily({
  template: factorOutChoiceTemplate,
  axes: factorAxes,
  model: factorModel,
  variant: (f) =>
    f.g < 0
      ? "negative-factor"
      : f.vars.length > 1
        ? "three-terms"
        : f.inner[1]! < 0
          ? "two-terms-minus"
          : "two-terms-plus",
  render: (f, _ax, r) => {
    const { g, inner, vars } = f;
    const orig = inner.map((c) => c * g);
    const label = (v: number[]) => m(`${g}(${lin(v, vars)})`);
    const last = inner.length - 1;
    const withAt = (i: number, value: number) =>
      inner.map((c, j) => (j === i ? value : c));
    const wrong: Wrong[] = [
      {
        label: label(withAt(last, orig[last]!)),
        feedback: `The last term, ${orig[last]}, was copied without dividing by ${g}. Every term inside the parentheses is divided by ${g}.`,
      },
      {
        label: label(withAt(0, orig[0]!)),
        feedback: `The first term was copied without dividing by ${g}. Every term inside the parentheses is divided by ${g}.`,
      },
      {
        label: label(withAt(last, -inner[last]!)),
        feedback: `The sign of the last term flipped. ${orig[last]} divided by ${g} is ${inner[last]}, so its sign inside the parentheses is ${inner[last]! < 0 ? "minus" : "plus"}.`,
      },
      {
        label: label(withAt(last, inner[last]! + (inner[last]! > 0 ? 1 : -1))),
        feedback: `${orig[last]} divided by ${g} is ${inner[last]}, not ${inner[last]! + (inner[last]! > 0 ? 1 : -1)}.`,
      },
    ];
    if (vars.length > 1)
      wrong.push({
        label: label(withAt(1, orig[1]!)),
        feedback: `The middle term was copied without dividing by ${g}. Every term inside the parentheses is divided by ${g}.`,
      });
    const expr = lin(orig, vars);
    const correct = label(inner);
    return finish(
      r,
      `Factor ${m(String(g))} out of ${m(expr)}. Which expression is equivalent?`,
      correct,
      wrong,
      `Divide each term of ${m(expr)} by ${m(String(g))}: start with ${m(String(orig[0]))} and ${m(String(orig[last]))}. The quotients go inside the parentheses.`,
      [
        `Factoring out ${m(String(g))} means writing ${m(expr)} as ${m(String(g))} times a group in parentheses.`,
        `A term is one part of the expression between the plus and minus signs. Each term must be ${m(String(g))} times something.`,
        `So divide each term by ${m(String(g))}: ${orig.map((c, i) => `$${c}\\div ${g < 0 ? `(${g})` : g}=${inner[i]}$`).join(", ")}.`,
        `Write those results inside the parentheses, after ${m(String(g))}: ${correct}.`,
        `Check by multiplying ${m(String(g))} by each term inside (distributing). You get back ${m(expr)}.`,
        `So the equivalent expression is ${correct}.`,
      ],
    );
  },
});

/* ----------------------------------------------------------- step reasons */
const reasonAxes = {
  form: defineAxis("form", [
    "two-step",
    "fraction-coefficient",
    "distribute-first",
  ] as const),
};
interface ReasonModel {
  form: "two-step" | "fraction-coefficient" | "distribute-first";
  a: number;
  b: number;
  x: number;
}
function reasonModel(r: Random, ax: { form: string }): ReasonModel {
  const b = sign(r) * r(1, 9);
  return {
    form: ax.form as ReasonModel["form"],
    a: ax.form === "fraction-coefficient" ? r(2, 6) : r(2, 9),
    b,
    x: ax.form === "fraction-coefficient" ? r(1, 9) : r(2, 9),
  };
}
const R = {
  dist: "Distributive property",
  add: "Addition property of equality",
  sub: "Subtraction property of equality",
  mul: "Multiplication property of equality",
  div: "Division property of equality",
};
const swap: Record<string, string> = {
  [R.add]: R.sub,
  [R.sub]: R.add,
  [R.mul]: R.div,
  [R.div]: R.mul,
  [R.dist]: "Commutative property",
};
export const stepReasonTable = chainFamily({
  template: stepReasonTableTemplate,
  axes: reasonAxes,
  model: reasonModel,
  variant: (e) => `reasons-${e.form}`,
  render: (e, _ax, r) => {
    const { a, b, x } = e;
    const move = (n: number) => (n > 0 ? R.sub : R.add);
    let lines: string[];
    let reasons: string[];
    if (e.form === "two-step") {
      const c = a * x + b;
      lines = [`${poly([a], ["x"], b)}=${c}`, `${a}x=${c - b}`, `x=${x}`];
      reasons = [move(b), R.div];
    } else if (e.form === "fraction-coefficient") {
      const c = x + b;
      if (c === 0) throw new Error("Need three retries");
      lines = [
        `\\frac{x}{${a}}${b < 0 ? "-" : "+"}${Math.abs(b)}=${c}`,
        `\\frac{x}{${a}}=${c - b}`,
        `x=${a * (c - b)}`,
      ];
      reasons = [move(b), R.mul];
    } else {
      const c = a * (x + b);
      lines = [
        `${a}(${poly([1], ["x"], b)})=${c}`,
        `${poly([a], ["x"], a * b)}=${c}`,
        `${a}x=${c - a * b}`,
        `x=${x}`,
      ];
      reasons = [R.dist, move(a * b), R.div];
    }
    const show = (rs: string[]) =>
      rs.map((t, i) => `${i + 1}: ${t}`).join("; ");
    const correct = show(reasons);
    const variants: string[][] = [];
    reasons.forEach((t, i) => {
      const next = [...reasons];
      next[i] = swap[t]!;
      variants.push(next);
    });
    variants.push([...reasons].reverse());
    const wrongLabels = shuffled(r, variants).map((v) => show(v));
    const feedback = (label: string) => {
      const rs = label.split("; ").map((p) => p.replace(/^\d+: /, ""));
      const i = rs.findIndex((s, k) => s !== reasons[k]);
      return `Step ${i + 1} is not named correctly. Compare line ${i + 1} with line ${i + 2} and name what was done to get from one to the other.`;
    };
    const work = lines.map((l, i) => `Line ${i + 1}: ${m(l)}.`).join(" ");
    const wrong = wrongLabels
      .filter((l) => l !== correct && l.length <= 120)
      .map((label) => ({ label, feedback: feedback(label) }));
    if (correct.length > 120) throw new Error("Need three retries");
    return finish(
      r,
      `A solution of ${m(lines[0]!)} is shown. ${work} Which list gives the property that justifies each step, from one line to the next?`,
      correct,
      wrong,
      `Compare ${m(lines[0]!)} with the line after it: what was done to both sides, or to the group, to get ${m(lines[1]!)}? Then do the same for each later pair of lines.`,
      [
        ...reasons.map(
          (t, i) =>
            `Step ${i + 1}, from $${lines[i]}$ to $${lines[i + 1]}$: ${t}.`,
        ),
        `Only one list names these properties in this order.`,
      ],
    );
  },
});

export const oneStepResultTemplates = [
  equationAfterOneStepTemplate,
  expressionAfterFirstStepTemplate,
  factorOutChoiceTemplate,
  stepReasonTableTemplate,
] as const;
export const oneStepResultGenerate = dispatch(oneStepResultTemplates, {
  "equation-after-one-step": (seed) =>
    equationAfterOneStep.generate(seed).problem,
  "expression-after-first-step": (seed) =>
    expressionAfterFirstStep.generate(seed).problem,
  "factor-out-choice": (seed) => factorOutChoice.generate(seed).problem,
  "step-reason-table": (seed) => stepReasonTable.generate(seed).problem,
});
