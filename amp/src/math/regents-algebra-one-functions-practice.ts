import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  divisors,
  factorPair,
  isSquare,
  quad,
  setTex,
  sgn,
  vertexForm,
  xShift,
} from "./regents-algebra-one-kit";
import { par } from "./regents-kit";

type R = (lo: number, hi: number) => number;
const meta = (
  m: Omit<TemplateMetadata, "version" | "gradeBand">,
): TemplateMetadata => ({ version: 1, gradeBand: "9–12", ...m });
const fail = () => {
  throw new Error("Need three retries");
};

export const functionMissingInputTemplate = meta({
  id: "function-missing-input",
  title: "Choose the input that completes a relation as a function",
  skillId: "function-notation",
  difficultyOffset: 0.25,
  requiredResponseCapability: "single-choice-v1",
  description:
    "A set of ordered pairs has one unknown input. Choose the value that makes the relation a function, or the value that keeps it from being one, using the rule that each input has one output.",
});
export const shiftFunctionNotationTemplate = meta({
  id: "shift-function-notation",
  title: "Write the rule of a shifted function",
  skillId: "function-transformations",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the rule of a function shifted horizontally and vertically, written with $f(x-h)+k$ notation or from an existing vertex-form parabola.",
});
export const radicalFunctionValueTemplate = meta({
  id: "radical-function-value",
  title: "Evaluate a square-root function",
  skillId: "function-evaluation",
  difficultyOffset: 0.3,
  description:
    "Evaluate $f(x)=a\\sqrt{x+b}+c$ at an input whose radicand is a perfect square, including a zero radicand and a negative shift.",
});
export const zerosOfFactoredProductTemplate = meta({
  id: "zeros-of-factored-product",
  title: "Find all zeros of a product containing a difference of squares",
  skillId: "polynomial-zeros",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose all zeros of a product with a linear factor and a difference of squares, factoring the difference first and counting each zero.",
});
export const quadraticNegativeOutputTemplate = meta({
  id: "quadratic-negative-output",
  title: "Find the inputs that give a stated negative output",
  skillId: "quadratic-equations",
  difficultyOffset: 0.45,
  requiredResponseCapability: "single-choice-v1",
  description:
    "For a quadratic function written in standard form, choose the inputs $x$ for which $f(x)$ equals a stated negative number by moving it to the left and factoring.",
});
export const parabolaAxisRuleTemplate = meta({
  id: "parabola-axis-rule",
  title: "Choose the quadratic rule with a given axis of symmetry",
  skillId: "quadratic-graphs",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose, from four standard-form quadratic rules, the one whose axis of symmetry $x=-\\frac{b}{2a}$ is the stated line.",
});
export const quadraticFormulaPositiveTemplate = meta({
  id: "quadratic-formula-positive",
  title: "Choose the quadratic formula solutions of a nonmonic equation",
  skillId: "quadratic-formula",
  difficultyOffset: 0.5,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the quadratic-formula expression for the solutions of $ax^2+bx+c=0$ with $a>1$ and irrational solutions, written in zero form or needing a constant moved first.",
});
export const factorLargeTrinomialTemplate = meta({
  id: "factor-large-trinomial",
  title: "Factor a monic trinomial with a large constant",
  skillId: "factor-quadratics",
  difficultyOffset: 0.45,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the factorization of $x^2+bx+c$ with $|c|$ between 60 and 200, with a negative or positive constant, where several factor pairs share the product.",
});

/* ------------------------------------------------ missing input */
const missingAxes = {
  ask: defineAxis("ask", ["makes-function", "breaks-function"] as const),
};
interface MissingModel {
  pairs: Array<[number, number]>;
  newOut: number;
  unused: number[];
  repeated: boolean;
}
function missingModel(r: R): MissingModel {
  const count = r(3, 4);
  const inputs = shuffle(r, [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]);
  const used = inputs.slice(0, count);
  const outs = shuffle(
    r,
    Array.from({ length: 13 }, (_, i) => i - 6),
  );
  const repeated = r(0, 2) === 0;
  const outputs = outs.slice(0, count);
  if (repeated) outputs[count - 1] = outputs[0]!;
  const newOut = outs.slice(count).find((o) => !outputs.includes(o));
  if (newOut === undefined) fail();
  return {
    pairs: used.map((x, i) => [x, outputs[i]!]),
    newOut: newOut!,
    unused: inputs.slice(count, count + 4),
    repeated,
  };
}
export const functionMissingInput = chainFamily({
  template: functionMissingInputTemplate,
  axes: missingAxes,
  model: missingModel,
  variant: (m) => (m.repeated ? "repeated-output" : "distinct-outputs"),
  render: (m, a, r) => {
    const display = shuffle(r, [
      ...m.pairs.map(([x, y]) => `(${x}, ${y})`),
      `(k, ${m.newOut})`,
    ]);
    const set = `\\{${display.join(", ")}\\}`;
    const makes = a.ask === "makes-function";
    const used = m.pairs.map(([x]) => x);
    const conflict = (k: number) => {
      const y = m.pairs.find(([x]) => x === k)![1];
      return `With $k=${k}$ the input ${k} would have two outputs, ${y} and ${m.newOut}, so the relation is not a function.`;
    };
    const fine = (k: number) =>
      `With $k=${k}$ the input ${k} appears once, so every input still has exactly one output.`;
    const pool = makes ? used.slice(0, 3) : m.unused.slice(0, 3);
    const answerK = makes ? m.unused[0]! : used[0]!;
    return choiceSurface(r, {
      prompt: `The relation $${set}$ has an unknown input $k$. ${makes ? "Which value of $k$ makes the relation a function?" : "Which value of $k$ means the relation is not a function?"}`,
      label: "Choose the value",
      options: [
        { label: `$${answerK}$`, correct: true },
        ...pool.map((k) => ({
          label: `$${k}$`,
          feedback: makes ? conflict(k) : fine(k),
        })),
      ],
      hint: `A function gives each input one output. The given inputs are ${used.join(", ")}, with outputs ${m.pairs.map(([, y]) => y).join(", ")}; the pair with $k$ has output ${m.newOut}. Compare $k$ with the inputs already used.`,
      explanation: [
        `The pairs already use the inputs ${used.join(", ")}.`,
        makes
          ? `If $k$ equals one of them, that input would have the output ${m.newOut} and also its own output, so the relation would not be a function. A value that is not already an input adds a new input with one output.`
          : `If $k$ is a new input, every input has exactly one output. If $k$ repeats a used input, that input has the output ${m.newOut} and also its own output, which differs.`,
        `So $k=${answerK}$ ${makes ? "makes" : "keeps"} the relation ${makes ? "a function" : "from being a function"}.`,
      ],
    });
  },
});

/* ------------------------------------------------ shifted function */
const shiftAxes = {
  form: defineAxis("form", ["function-notation", "vertex-form"] as const),
};
interface ShiftModel {
  h: number; // horizontal shift, positive = right
  k: number; // vertical shift, positive = up
  p: number; // existing horizontal offset for vertex form: f(x) = (x - p)^2 + q
  q: number;
}
function shiftModel(r: R): ShiftModel {
  const h = r(1, 6) * (r(0, 1) ? 1 : -1);
  const k = r(1, 6) * (r(0, 1) ? 1 : -1);
  if (Math.abs(h) === Math.abs(k)) fail();
  return { h, k, p: r(-5, 5), q: r(-6, 6) };
}
export const shiftFunctionNotation = chainFamily({
  template: shiftFunctionNotationTemplate,
  axes: shiftAxes,
  model: shiftModel,
  variant: (m) => `${m.h > 0 ? "right" : "left"}-${m.k > 0 ? "up" : "down"}`,
  render: (m, a, r) => {
    const dirH = m.h > 0 ? "right" : "left";
    const dirK = m.k > 0 ? "up" : "down";
    const move = `${Math.abs(m.h)} unit${Math.abs(m.h) === 1 ? "" : "s"} to the ${dirH} and ${Math.abs(m.k)} unit${Math.abs(m.k) === 1 ? "" : "s"} ${dirK}`;
    if (a.form === "function-notation") {
      const rule = (dx: number, dy: number) =>
        `$g(x) = f(${xShift(-dx)})${dy === 0 ? "" : ` ${sgn(dy)} ${Math.abs(dy)}`}$`;
      return choiceSurface(r, {
        prompt: `The graph of $g$ is the graph of $f$ shifted ${move}. Which equation defines $g$?`,
        label: "Choose the equation",
        options: [
          { label: rule(m.h, m.k), correct: true },
          {
            label: rule(-m.h, m.k),
            feedback: `Inside the function the shift runs the opposite way: moving ${dirH} by ${Math.abs(m.h)} is $x ${m.h > 0 ? "-" : "+"} ${Math.abs(m.h)}$.`,
          },
          {
            label: rule(m.h, -m.k),
            feedback: `Outside the function the shift matches its direction: moving ${dirK} by ${Math.abs(m.k)} ${m.k > 0 ? "adds" : "subtracts"} ${Math.abs(m.k)}.`,
          },
          {
            label: rule(m.k, m.h),
            feedback:
              "The horizontal amount belongs inside the parentheses with $x$ and the vertical amount outside; this swaps the two.",
          },
          {
            label: rule(-m.h, -m.k),
            feedback:
              "Both shifts are reversed here. Inside the function the horizontal shift is the opposite of the direction; outside, the vertical shift is in the direction of the move.",
          },
        ],
        hint: `Treat the two moves separately. The horizontal move (${dirH}, ${Math.abs(m.h)}) changes the input $x$. The vertical move (${dirK}, ${Math.abs(m.k)}) changes the output. Decide which part sits inside the parentheses.`,
        explanation: [
          `To shift ${dirH} by ${Math.abs(m.h)}, replace $x$ with $${xShift(-m.h)}$: the graph of $f(${xShift(-m.h)})$ is $f$ moved ${dirH}.`,
          `To shift ${dirK} by ${Math.abs(m.k)}, ${m.k > 0 ? "add" : "subtract"} ${Math.abs(m.k)} ${m.k > 0 ? "to" : "from"} the output.`,
          `Together: ${rule(m.h, m.k)}.`,
        ],
      });
    }
    const f = vertexForm(-m.p, m.q);
    const rule = (dx: number, dy: number) =>
      `$g(x) = ${vertexForm(-m.p - dx, m.q + dy)}$`;
    return choiceSurface(r, {
      prompt: `The function $f(x) = ${f}$ is shifted ${move} to form $g$. Which equation defines $g$?`,
      label: "Choose the equation",
      options: [
        { label: rule(m.h, m.k), correct: true },
        {
          label: rule(-m.h, m.k),
          feedback: `Moving ${dirH} by ${Math.abs(m.h)} changes $x$ to $${xShift(-m.h)}$, so the number added to $x$ ${m.h > 0 ? "decreases" : "increases"} by ${Math.abs(m.h)}.`,
        },
        {
          label: rule(m.h, -m.k),
          feedback: `The vertical shift is ${dirK} by ${Math.abs(m.k)}, so the constant term ${m.k > 0 ? "increases" : "decreases"} by ${Math.abs(m.k)}.`,
        },
        {
          label: rule(m.k, m.h),
          feedback:
            "The horizontal amount changes the number inside the parentheses and the vertical amount changes the constant outside; this swaps the two.",
        },
        {
          label: rule(m.h, 0),
          feedback:
            "The vertical shift is missing: the constant term must change as well.",
        },
      ],
      hint: `In $f(x) = ${f}$ the number inside the parentheses sets the horizontal position and the constant sets the vertical position. Change each by the matching shift, remembering the horizontal direction is reversed inside.`,
      explanation: [
        `Replace $x$ by $${xShift(-m.h)}$ to move ${dirH} by ${Math.abs(m.h)}: the squared part becomes $${vertexForm(-m.p - m.h, 0)}$.`,
        `Change the constant by ${m.k > 0 ? "+" : "-"}${Math.abs(m.k)} for the vertical shift of ${Math.abs(m.k)} ${dirK}.`,
        `${rule(m.h, m.k)}.`,
      ],
    });
  },
});

/* ------------------------------------------------ radical value */
const radicalAxes = {
  form: defineAxis("form", ["plain", "scaled"] as const),
};
interface RadicalModel {
  a: number;
  b: number;
  c: number;
  s: number;
}
function radicalModel(r: R, ax: { form: "plain" | "scaled" }): RadicalModel {
  return {
    a: ax.form === "plain" ? 1 : r(2, 4),
    b: r(-8, 9) || 3,
    c: r(-6, 6),
    s: r(0, 9),
  };
}
export const radicalFunctionValue = chainFamily({
  template: radicalFunctionValueTemplate,
  axes: radicalAxes,
  model: radicalModel,
  variant: (m) =>
    m.s === 0 ? "zero-radicand" : m.a === 1 ? "plain" : "scaled",
  render: (m) => {
    const x = m.s * m.s - m.b;
    const rad = `\\sqrt{${xShift(m.b)}}`;
    const f = `${m.a === 1 ? "" : m.a}${rad}${m.c === 0 ? "" : ` ${sgn(m.c)} ${Math.abs(m.c)}`}`;
    const value = m.a * m.s + m.c;
    return numberSurface({
      prompt: `The function $f$ is defined by $f(x) = ${f}$. What is $f(${x})$?`,
      answer: String(value),
      label: "Answer",
      hint: `Replace $x$ with ${x} inside the radicand $${xShift(m.b)}$ and simplify the radicand first, before taking the square root.`,
      explanation: [
        `Substitute: $f(${x}) = ${m.a === 1 ? "" : m.a}\\sqrt{${par(x)} ${sgn(m.b)} ${Math.abs(m.b)}}${m.c === 0 ? "" : ` ${sgn(m.c)} ${Math.abs(m.c)}`}$.`,
        `The radicand is $${x + m.b}$, and $\\sqrt{${x + m.b}} = ${m.s}$.`,
        `$f(${x}) = ${m.a === 1 ? "" : `${m.a}\\cdot`}${m.s}${m.c === 0 ? "" : ` ${sgn(m.c)} ${Math.abs(m.c)}`} = ${value}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ zeros of product */
const zerosAxes = {
  form: defineAxis("form", [
    "x-times-difference",
    "binomial-times-difference",
  ] as const),
};
interface ZerosModel {
  k: number;
  m: number;
  lead: number;
}
function zerosModel(r: R, ax: { form: string }): ZerosModel {
  const k = r(2, 9);
  const m = ax.form === "x-times-difference" ? 0 : r(1, 9);
  if (m === k) fail();
  return { k, m, lead: r(0, 2) === 0 ? r(2, 4) : 1 };
}
export const zerosOfFactoredProduct = chainFamily({
  template: zerosOfFactoredProductTemplate,
  axes: zerosAxes,
  model: zerosModel,
  variant: (m) => (m.m === 0 ? "zero-among-zeros" : "extra-binomial"),
  render: (m, _a, r) => {
    const sq = m.k * m.k;
    const first = m.m === 0 ? "x" : `(x ${sgn(m.m)} ${m.m})`;
    const lead = m.lead === 1 ? "" : String(m.lead);
    const f = `${lead}${first}(x^2 - ${sq})`;
    const z = m.m === 0 ? 0 : -m.m;
    const correct = [z, -m.k, m.k];
    const opts: Array<[number[], string]> =
      m.m === 0
        ? [
            [
              [-m.k, m.k],
              "The factor $x$ gives the zero $x=0$ as well. Count it with the zeros of $x^2-" +
                sq +
                "$.",
            ],
            [
              [0, sq],
              `Solving $x^2=${sq}$ gives $x=\\pm${m.k}$, not $x=${sq}$.`,
            ],
            [
              [0, m.k],
              `$x^2=${sq}$ has two solutions, $${m.k}$ and $-${m.k}$.`,
            ],
            [
              [-sq, 0, sq],
              `The solutions of $x^2=${sq}$ are the square roots, $\\pm${m.k}$, not $\\pm${sq}$.`,
            ],
          ]
        : [
            [
              [m.m, -m.k, m.k],
              `The factor $(x ${sgn(m.m)} ${m.m})$ is zero when $x=${-m.m}$, the opposite of ${m.m}.`,
            ],
            [
              [-m.k, m.k],
              `The factor $(x ${sgn(m.m)} ${m.m})$ also gives a zero, $x=${-m.m}$.`,
            ],
            [
              [-m.m, -sq, sq],
              `Solving $x^2=${sq}$ gives $x=\\pm${m.k}$, not $x=\\pm${sq}$.`,
            ],
            [
              [-m.m, m.k],
              `$x^2=${sq}$ has two solutions, $${m.k}$ and $-${m.k}$.`,
            ],
          ];
    return choiceSurface(r, {
      prompt: `What are all the zeros of $f(x) = ${f}$?`,
      label: "Choose the set of zeros",
      options: [
        { label: `$${setTex(correct)}$`, correct: true },
        ...opts.map(([values, feedback]) => ({
          label: `$${setTex(values)}$`,
          feedback,
        })),
      ],
      hint: `A product is zero when a factor is zero. Set ${m.m === 0 ? "$x$" : `$x ${sgn(m.m)} ${m.m}$`} equal to zero, then factor $x^2 - ${sq}$ as a difference of squares and set each factor equal to zero.`,
      explanation: [
        `Factor the difference of squares: $x^2 - ${sq} = (x - ${m.k})(x + ${m.k})$, so $f(x) = ${lead}${first}(x - ${m.k})(x + ${m.k})$.`,
        `Each factor gives a zero: ${m.m === 0 ? "$x=0$" : `$x=${-m.m}$`}, $x=${m.k}$ and $x=-${m.k}$.`,
        `The zeros are $${setTex(correct)}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ negative output */
interface NegativeOutputModel {
  r1: number;
  r2: number;
  p: number;
  q: number;
  n: number;
}
function negativeOutputModel(r: R): NegativeOutputModel {
  const r1 = r(-8, 4);
  const r2 = r1 + r(4, 10);
  const d = r2 - r1;
  const s = r(1, d - 1);
  if ((d - s) % 2) fail();
  const n = (d * d - s * s) / 4;
  const mid = (r1 + r2) / 2;
  if (!Number.isInteger(mid + s / 2)) fail();
  return { r1, r2, p: mid - s / 2, q: mid + s / 2, n };
}
export const quadraticNegativeOutput = chainFamily({
  template: quadraticNegativeOutputTemplate,
  axes: {},
  model: negativeOutputModel,
  variant: (m) =>
    m.p < 0 && m.q < 0
      ? "both-negative"
      : m.p > 0
        ? "both-positive"
        : "mixed-signs",
  render: (m, _a, r) => {
    const b = -(m.r1 + m.r2);
    const c = m.r1 * m.r2;
    const f = quad(1, b, c);
    const mid = (m.r1 + m.r2) / 2;
    return choiceSurface(r, {
      prompt: `For the function $f(x) = ${f}$, which values of $x$ satisfy $f(x) = -${m.n}$?`,
      label: "Choose the set of inputs",
      options: [
        { label: `$${setTex([m.p, m.q])}$`, correct: true },
        {
          label: `$${setTex([m.r1, m.r2])}$`,
          feedback: `These are the inputs where $f(x)=0$. The output asked for is $-${m.n}$, so the equation is $${f} = -${m.n}$.`,
        },
        {
          label: `$${setTex([-m.p, -m.q])}$`,
          feedback:
            "A factor such as $x - 3$ is zero at $x = 3$, not at $x = -3$. These values have the wrong signs.",
        },
        {
          label: `$${setTex([mid])}$`,
          feedback:
            "This is the input of the vertex, halfway between the zeros. It gives the least output, not an output of the stated value.",
        },
        {
          label: `$${setTex([-m.n])}$`,
          feedback: `The number $-${m.n}$ is the output $f(x)$, not the input $x$.`,
        },
      ],
      hint: `Write the equation $${f} = -${m.n}$ and add ${m.n} to both sides so the right side is 0. Then factor the trinomial that results.`,
      explanation: [
        `Set $${f} = -${m.n}$ and add ${m.n}: $${quad(1, b, c + m.n)} = 0$.`,
        `Factor: $(${xShift(-m.p)})(${xShift(-m.q)}) = 0$, because $${m.p}$ and $${m.q}$ multiply to $${m.p * m.q}$ and add to $${m.p + m.q}$.`,
        `The inputs are $x=${m.p}$ and $x=${m.q}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ axis rule */
interface AxisRuleModel {
  a: number;
  h: number;
  c: number;
}
function axisRuleModel(r: R): AxisRuleModel {
  const h = r(1, 7) * (r(0, 1) ? 1 : -1);
  return { a: pick(r, [1, 1, 2, 3, -1, -2] as const), h, c: r(-9, 9) };
}
export const parabolaAxisRule = chainFamily({
  template: parabolaAxisRuleTemplate,
  axes: {},
  model: axisRuleModel,
  variant: (m) => (m.h < 0 ? "axis-left" : "axis-right"),
  render: (m, _a, r) => {
    const rule = (b: number) => `$y = ${quad(m.a, b, m.c)}$`;
    const b = -2 * m.a * m.h;
    return choiceSurface(r, {
      prompt: `Which function has an axis of symmetry of $x = ${m.h}$?`,
      label: "Choose the function",
      options: [
        { label: rule(b), correct: true },
        {
          label: rule(-b),
          feedback: `The axis is $x = -\\frac{b}{2a}$. This rule has the opposite $b$, so its axis is $x = ${-m.h}$.`,
        },
        {
          label: rule(-m.a * m.h),
          feedback:
            "The axis is $-\\frac{b}{2a}$. This rule has half the needed $b$, so its axis is half as far from the $y$-axis.",
        },
        {
          label: rule(2 * b),
          feedback:
            "The axis is $-\\frac{b}{2a}$. This rule has twice the needed $b$, so its axis is twice as far from the $y$-axis.",
        },
        {
          label: rule(-2 * m.h),
          feedback:
            "The coefficient $a$ is part of the formula $-\\frac{b}{2a}$. Ignoring it gives the wrong axis.",
        },
      ],
      hint: `For $y = ax^2 + bx + c$ the axis of symmetry is $x = -\\frac{b}{2a}$. Work out which $b$ gives $x = ${m.h}$ when the leading coefficient is ${m.a}.`,
      explanation: [
        `For a rule $y = ax^2 + bx + c$ the axis is $x = -\\frac{b}{2a}$.`,
        `With $a = ${m.a}$ and the axis $x = ${m.h}$: $-\\frac{b}{${2 * m.a}} = ${m.h}$, so $b = ${b}$.`,
        `The function is ${rule(b)}.`,
      ],
    });
  },
});

/* ------------------------------------------------ quadratic formula */
const qfAxes = {
  form: defineAxis("form", ["zero-form", "constant-on-right"] as const),
};
interface QfModel {
  a: number;
  b: number;
  c: number;
}
function qfModel(r: R): QfModel {
  const a = r(2, 5);
  const b = r(-9, 9) || 4;
  const c = r(-6, 6) || -2;
  const d = b * b - 4 * a * c;
  if (d <= 0 || isSquare(d)) fail();
  return { a, b, c };
}
export const quadraticFormulaPositive = chainFamily({
  template: quadraticFormulaPositiveTemplate,
  axes: qfAxes,
  model: qfModel,
  variant: (m) => (m.c < 0 ? "negative-constant" : "positive-constant"),
  render: (m, ax, r) => {
    const { a, b, c } = m;
    const d = b * b - 4 * a * c;
    const sol = (neg: number, disc: number, den: number) =>
      `$x = \\frac{${neg} \\pm \\sqrt{${disc}}}{${den}}$`;
    const eq =
      ax.form === "zero-form"
        ? `${quad(a, b, c)} = 0`
        : `${quad(a, b, 0)} = ${-c}`;
    return choiceSurface(r, {
      prompt: `Which expression gives the solutions of $${eq}$?`,
      label: "Choose the solutions",
      options: [
        { label: sol(-b, d, 2 * a), correct: true },
        {
          label: sol(b, d, 2 * a),
          feedback:
            "The formula begins with $-b$, the opposite of the coefficient of $x$. This uses $b$ itself.",
        },
        ...(b * b + 4 * a * c > 0
          ? [
              {
                label: sol(-b, b * b + 4 * a * c, 2 * a),
                feedback:
                  "Inside the radical the discriminant is $b^2 - 4ac$. This one has the wrong sign on $4ac$.",
              },
            ]
          : []),
        {
          label: sol(-b, d, a),
          feedback:
            "The denominator of the quadratic formula is $2a$, not $a$.",
        },
        ...(b * b - 4 * c > 0
          ? [
              {
                label: sol(-b, b * b - 4 * c, 2 * a),
                feedback:
                  "The discriminant is $b^2 - 4ac$; this leaves out the factor $a$ in $4ac$.",
              },
            ]
          : []),
      ],
      hint:
        ax.form === "zero-form"
          ? `Identify $a=${a}$, $b=${b}$ and $c=${c}$ in $${eq}$, then put them in $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$, taking care with the signs.`
          : `First move ${-c} to the left side so the equation equals 0, then read $a=${a}$, $b=${b}$ and the new constant, and use the quadratic formula.`,
      explanation: [
        ax.form === "zero-form"
          ? `Here $a=${a}$, $b=${b}$ and $c=${c}$.`
          : `Move ${-c} to the left: $${quad(a, b, c)} = 0$, so $a=${a}$, $b=${b}$ and $c=${c}$.`,
        `The discriminant is $b^2-4ac = ${b * b} - 4(${a})(${par(c)}) = ${d}$.`,
        `$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} = \\frac{${-b} \\pm \\sqrt{${d}}}{${2 * a}}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ factor large */
const factorAxes = {
  constant: defineAxis("constant", ["negative", "positive"] as const),
};
interface FactorModel {
  m: number;
  n: number;
}
function factorModel(r: R): FactorModel {
  const m = r(8, 24);
  const n = r(3, 10);
  const prod = m * n;
  if (prod < 60 || prod > 200 || m <= n) fail();
  return { m, n };
}
export const factorLargeTrinomial = chainFamily({
  template: factorLargeTrinomialTemplate,
  axes: factorAxes,
  model: factorModel,
  variant: (m) => `product-${m.m * m.n >= 120 ? "large" : "medium"}`,
  render: (m, ax, r) => {
    const neg = ax.constant === "negative";
    const prod = m.m * m.n;
    const trinomial = neg
      ? quad(1, -(m.m - m.n), -prod)
      : quad(1, -(m.m + m.n), prod);
    const key = neg ? factorPair(-m.m, m.n) : factorPair(-m.m, -m.n);
    // Another factor pair with the same product and the same kind of signs.
    const other = divisors(prod)
      .filter((d) => d !== m.n && d !== m.m && d < prod / d)
      .map((d) => [prod / d, d] as const)
      .find(([big]) => big !== m.m);
    const options: Array<{ label: string; feedback: string }> = neg
      ? [
          {
            label: `$${factorPair(m.m, -m.n)}$`,
            feedback: `The signs are reversed: this expands to a middle term of $+${m.m - m.n}x$, not $-${m.m - m.n}x$.`,
          },
          {
            label: `$${factorPair(-m.m, -m.n)}$`,
            feedback: `Two negative numbers multiply to a positive constant. The constant here is $-${prod}$.`,
          },
          {
            label: `$${factorPair(m.m, m.n)}$`,
            feedback: `Two positive numbers multiply to a positive constant and add to a positive middle term. This trinomial has a negative constant and a negative middle term.`,
          },
        ]
      : [
          {
            label: `$${factorPair(m.m, m.n)}$`,
            feedback: `Two positive numbers add to a positive middle term. The middle term here is $-${m.m + m.n}x$.`,
          },
          {
            label: `$${factorPair(-m.m, m.n)}$`,
            feedback: `A negative and a positive number multiply to a negative constant. The constant here is $+${prod}$.`,
          },
          {
            label: `$${factorPair(m.m, -m.n)}$`,
            feedback: `A negative and a positive number multiply to a negative constant. The constant here is $+${prod}$.`,
          },
        ];
    if (other) {
      const [big, small] = other;
      options.push({
        label: `$${neg ? factorPair(-big, small) : factorPair(-big, -small)}$`,
        feedback: `The numbers ${big} and ${small} multiply to ${prod}, but they ${neg ? "differ by" : "add to"} ${neg ? big - small : big + small}, not ${neg ? m.m - m.n : m.m + m.n}.`,
      });
    }
    return choiceSurface(r, {
      prompt: `Which expression is equivalent to $${trinomial}$?`,
      label: "Choose the factorization",
      options: [{ label: `$${key}$`, correct: true }, ...options],
      hint: neg
        ? `Look for two numbers whose product is $-${prod}$ and whose sum is $-${m.m - m.n}$. List the factor pairs of ${prod} and check which pair differs by ${m.m - m.n}.`
        : `Look for two numbers whose product is $${prod}$ and whose sum is $-${m.m + m.n}$. List the factor pairs of ${prod} and check which pair adds to ${m.m + m.n}.`,
      explanation: [
        neg
          ? `Find two numbers with product $-${prod}$ and sum $-${m.m - m.n}$. The factor pair ${m.m} and ${m.n} differs by ${m.m - m.n}, so the numbers are $-${m.m}$ and $${m.n}$.`
          : `Find two numbers with product $${prod}$ and sum $-${m.m + m.n}$. The pair ${m.m} and ${m.n} adds to ${m.m + m.n}, so both numbers are negative: $-${m.m}$ and $-${m.n}$.`,
        `Then $${trinomial} = ${key}$.`,
        `Check by expanding: the product of the constants is ${neg ? "-" : ""}${prod} and their sum is ${neg ? -(m.m - m.n) : -(m.m + m.n)}.`,
      ],
    });
  },
});

export const regentsAlgebraOneFunctionTemplates = [
  functionMissingInputTemplate,
  shiftFunctionNotationTemplate,
  radicalFunctionValueTemplate,
  zerosOfFactoredProductTemplate,
  quadraticNegativeOutputTemplate,
  parabolaAxisRuleTemplate,
  quadraticFormulaPositiveTemplate,
  factorLargeTrinomialTemplate,
];
export const regentsAlgebraOneFunctionGenerate = dispatch(
  regentsAlgebraOneFunctionTemplates,
  {
    "function-missing-input": (s) => functionMissingInput.generate(s).problem,
    "shift-function-notation": (s) => shiftFunctionNotation.generate(s).problem,
    "radical-function-value": (s) => radicalFunctionValue.generate(s).problem,
    "zeros-of-factored-product": (s) =>
      zerosOfFactoredProduct.generate(s).problem,
    "quadratic-negative-output": (s) =>
      quadraticNegativeOutput.generate(s).problem,
    "parabola-axis-rule": (s) => parabolaAxisRule.generate(s).problem,
    "quadratic-formula-positive": (s) =>
      quadraticFormulaPositive.generate(s).problem,
    "factor-large-trinomial": (s) => factorLargeTrinomial.generate(s).problem,
  },
);
