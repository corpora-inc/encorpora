import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { pick, random, shuffle, type Rand } from "./shape-practice.js";
import {
  exponentialGraph,
  growthBars,
  logGraph,
  raceBars,
  raceGraph,
  stepTable,
  valueTable,
} from "./exponential-scenes.js";
import { act, step } from "./scene/author.js";
import { defineAxis } from "./variation/axes.js";
import { generateWithAxes } from "./variation/legacy.js";

/** Surface axes. A model value can be exact (the legacy frames) or a
 * calculator value rounded to the nearest cent, from a percent rate. */
export const exponentialAxes = {
  "exponential-model-value": {
    "number-domain": defineAxis("number-domain", [
      "exact-values",
      "rounded-decimals",
    ]),
  },
  "geometric-sequence-rule": {
    "number-domain": defineAxis("number-domain", [
      "integer-ratios",
      "decimal-ratios",
    ]),
  },
} as const;

/** Exponential growth, geometric sequences and series, and logarithms
 * (Algebra 1 and 2). Every answer is exact; figures carry only givens. */
const definitions: [string, string, string, string, boolean, boolean][] = [
  [
    "exponential-model-value",
    "Use an exponential model",
    "exponential-models",
    "Find a later value of an exponential model from a table, a percent rate, a half-life or a formula.",
    false,
    true,
  ],
  [
    "exponential-model-rule",
    "Choose the exponential rule",
    "exponential-models",
    "Choose $y = a·b$ˣ from a table, a graph through marked points, or a growth or decay story.",
    true,
    true,
  ],
  [
    "linear-or-exponential",
    "Linear or exponential",
    "growth-comparison",
    "Decide from a table or a story whether change is linear, exponential or neither.",
    true,
    true,
  ],
  [
    "exponential-overtakes",
    "When exponential overtakes linear",
    "growth-comparison",
    "Find the first whole input at which an exponential exceeds a linear function, from a graph, a table or two offers.",
    false,
    true,
  ],
  [
    "same-base-equation",
    "Exponential equations with a common base",
    "exponential-equations",
    "Solve exponential equations by writing both sides as powers of one base.",
    false,
    false,
  ],
  [
    "exponential-log-solution",
    "Solve with a logarithm",
    "exponential-equations",
    "Choose the exact logarithmic solution of an exponential equation.",
    true,
    false,
  ],
  [
    "log-equation",
    "Logarithmic equations",
    "exponential-equations",
    "Solve logarithmic equations, rejecting candidates outside the domain.",
    false,
    false,
  ],
  [
    "geometric-series-sum",
    "Sum a geometric series",
    "sequence-sums",
    "Find the sum of finitely many terms of a geometric sequence, listed, described, in sigma notation or in a story.",
    false,
    true,
  ],
  [
    "log-rules-evaluate",
    "Product, quotient and power rules",
    "logarithm-properties",
    "Evaluate sums, differences and multiples of logarithms with the same base.",
    false,
    false,
  ],
  [
    "log-expand",
    "Expand and condense logarithms",
    "logarithm-properties",
    "Choose the expanded or condensed form of a logarithmic expression.",
    true,
    false,
  ],
  [
    "change-of-base",
    "Change of base",
    "logarithm-properties",
    "Evaluate logarithms by changing to a common base.",
    false,
    false,
  ],
  [
    "logarithm-value",
    "Logarithms of reciprocals, roots and decimals",
    "logarithms",
    "Evaluate logarithms that are negative or fractional, and read a logarithm from its graph.",
    false,
    true,
  ],
  [
    "log-exponential-form",
    "Read a logarithm",
    "logarithms",
    "Translate between logarithmic and exponential form, and place a logarithm between whole numbers.",
    true,
    false,
  ],
  [
    "geometric-sequence-rule",
    "Ratios and terms of geometric sequences",
    "geometric-sequences",
    "Find a common ratio, a missing term, or a term from a recursive rule or two given terms.",
    false,
    true,
  ],
];
export const exponentialTemplates: readonly TemplateMetadata[] =
  definitions.map(([id, title, skillId, description, choice, scene]) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: "9–12",
    ...(scene ? { requiredFigureCapability: "scenes-v1" as const } : {}),
    ...(choice
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }));

// ------------------------------------------------------------------ helpers
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** Reduced [numerator, denominator] with a positive denominator. */
function reduce(n: number, d: number): [number, number] {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(Math.abs(n), d) || 1;
  return [n / g, d / g];
}
/** An exact answer string: "7", "-3/2". */
const exact = (n: number, d = 1) => {
  const [a, b] = reduce(n, d);
  return b === 1 ? `${a}` : `${a}/${b}`;
};
/** A signed number in prose: −3. */
const s = (n: number) => String(n).replace("-", "−");
/** A divisor in prose: negatives in parentheses. */
const paren = (n: number) => (n < 0 ? `(${s(n)})` : s(n));
/** A rational in TeX. */
function ftex(n: number, d = 1) {
  const [a, b] = reduce(n, d);
  if (b === 1) return `${a}`;
  return `${a < 0 ? "-" : ""}\\frac{${Math.abs(a)}}{${b}}`;
}
/** q/p, then its lowest terms when they differ. */
function eqFrac(q: number, p: number) {
  const raw = `${q < 0 ? "-" : ""}\\frac{${Math.abs(q)}}{${p}}`,
    low = ftex(q, p);
  return raw === low ? low : `${raw} = ${low}`;
}
/** The log of a base: common logs are written without one. */
const lg = (b: number | string) => (b === 10 ? "\\log" : `\\log_{${b}}`);
/** n as a power of b, or undefined. */
function powerOf(b: number, n: number) {
  for (let k = 0, v = 1; v <= n; k++, v *= b) if (v === n) return k;
  return undefined;
}
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  answer?: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  choices?: Choice[];
  keepOrder?: boolean;
  kind?: "number" | "fraction";
  label?: string;
};
const scene = (sc: import("./scene/spec.js").Scene): SemanticFigure => ({
  kind: "scene",
  scene: sc,
});
/** A decimal growth factor: 20 → "1.2", −20 → "0.8". */
const factor = (percent: number) => String((100 + percent) / 100);

// ---------------------------------------------------------------- generators
/** a·n^t/100^t, exactly, truncated to four places and rounded half-up to cents. */
function centsOfGrowth(a: number, n: number, t: number) {
  const scaled =
    (BigInt(a) * BigInt(n) ** BigInt(t) * 10_000n) / 100n ** BigInt(t);
  return {
    cents: Number((scaled + 50n) / 100n),
    fourPlaces: Number(scaled) / 10_000,
    // A value within the last digits of a tie is redrawn: no half-cent answers.
    tie: scaled % 100n === 50n,
  };
}
const money = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
/** A percent change over whole years, valued with a calculator and rounded. */
function roundedGrowth(r: Rand): Draft {
  const growth = r(0, 1) === 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = growth ? r(2, 9) : r(5, 18);
    const t = r(3, 12);
    const a = 100 * r(5, 120);
    const n = growth ? 100 + p : 100 - p;
    const { cents, fourPlaces, tie } = centsOfGrowth(a, n, t);
    if (tie) continue;
    const f = factor(growth ? p : -p);
    const start = a.toLocaleString("en-US");
    return {
      prompt: growth
        ? `A savings account holds ${start} dollars and earns ${p}% interest, added to the balance at the end of each year. With no withdrawals, how many dollars will it hold after ${t} years? Round to the nearest cent.`
        : `A delivery van is worth ${start} dollars and loses ${p}% of its value each year. How many dollars is it worth after ${t} years? Round to the nearest cent.`,
      answer: money(cents),
      hint: `${growth ? `Growing by ${p}%` : `Losing ${p}%`} each year multiplies the amount by ${f}, the growth factor. Multiply ${start} by ${f} once for each of the ${t} years, using a calculator's power key, and round only at the end.`,
      explanation: [
        growth
          ? `Each year the balance keeps all of itself, 100%, and adds ${p}% more. That is ${100 + p}% of the old balance.`
          : `Each year the van keeps what it did not lose: $100\\% - ${p}\\% = ${100 - p}\\%$ of its old value.`,
        `As a decimal, ${growth ? 100 + p : 100 - p}% is $${growth ? `1 + ${p / 100}` : `1 - ${p / 100}`} = ${f}$. This number, the growth factor, multiplies the amount once each year.`,
        `Multiplying by ${f} once for each of ${t} years is the same as multiplying by $${f}^{${t}}$. The exponent ${t}, the small raised number, counts the years.`,
        `So the amount is $${a} \\times ${f}^{${t}} \\approx ${fourPlaces.toFixed(4)}$. Round only now, so no rounding error builds up.`,
        `${growth ? "The account will hold" : "The van is worth"} ${money(cents)} dollars after ${t} years, to the nearest cent.`,
      ],
      label: "Dollars",
    };
  }
  throw new Error("Need three tie-free rounded values");
}

function modelValue(r: Rand, axes: Record<string, string> = {}): Draft {
  const frame = r(0, 3);
  if (axes["number-domain"] === "rounded-decimals") return roundedGrowth(r);
  if (frame === 0) {
    const b = pick(r, [2, 3]),
      a = r(2, 6),
      k = b === 2 ? r(5, 7) : r(5, 6);
    const xs = [0, 1, 2, 3],
      ys = xs.map((x) => a * b ** x);
    return {
      prompt: `The table shows an exponential function. If the pattern continues, what is $y$ when $x = ${k}$?`,
      figure: scene(stepTable(xs, ys, `×${b}`)),
      answer: `${a * b ** k}`,
      hint: `Each row multiplies $y$ by ${b}. From $x = 3$, where $y = ${ys[3]}$, keep multiplying by ${b} until $x = ${k}$.`,
      explanation: [
        `An exponential function multiplies by the same number at each step. Here each time $x$ goes up by 1, $y$ is multiplied by ${b}.`,
        `The starting value, $y$ at $x = 0$, is ${a}. So $y = ${a} \\cdot ${b}^{x}$, where the exponent $x$ counts how many times we multiply by ${b}.`,
        `At $x = ${k}$ we multiply by ${b} ${k} times: $${b}^{${k}} = ${b ** k}$.`,
        `Then $y = ${a} \\times ${b ** k} = ${a * b ** k}$.`,
        `When $x = ${k}$, $y$ is ${a * b ** k}.`,
      ],
    };
  }
  if (frame === 1) {
    const [p, num, den] = pick(r, [
      [10, 11, 10],
      [20, 6, 5],
      [25, 5, 4],
      [50, 3, 2],
    ] as const);
    const t = r(2, 3),
      start = den ** t * r(2, 9),
      end = (start * num ** t) / den ** t;
    const town = r(0, 1) === 0;
    const f = factor(p);
    return {
      prompt: town
        ? `A town has ${start.toLocaleString("en-US")} residents, and its population grows by ${p}% each year. If this continues, how many residents will it have after ${t} years?`
        : `A savings account holds ${start.toLocaleString("en-US")} dollars and earns ${p}% interest, added to the balance at the end of each year. With no withdrawals, how many dollars will it hold after ${t} years?`,
      answer: `${end}`,
      hint: `Growing by ${p}% keeps the whole amount and adds ${p}% of it, so each year multiplies by ${f}. Multiply ${start.toLocaleString("en-US")} by ${f} once for each of the ${t} years.`,
      explanation: [
        `Growing by ${p}% keeps the whole amount, 100%, and adds ${p}% more. That makes ${100 + p}% of the amount.`,
        `As a decimal, ${100 + p}% is $1 + ${p / 100} = ${f}$. This growth factor multiplies the amount once each year.`,
        `After ${t} years we have multiplied by ${f} ${t} times, which is $${f}^{${t}}$.`,
        `So the amount is $${start} \\times ${f}^{${t}} = ${end}$.`,
        `After ${t} years ${town ? `the town will have ${end.toLocaleString("en-US")} residents` : `the account will hold ${end.toLocaleString("en-US")} dollars`}.`,
      ],
    };
  }
  if (frame === 2) {
    const t = r(2, 4),
      h = pick(r, [2, 3, 4, 5, 6, 8, 12]),
      m = 2 ** t * r(5, 50);
    return {
      prompt: `A patient takes a ${m} mg dose of a medicine. The amount in the body halves every ${h} hours. How many milligrams remain after ${h * t} hours?`,
      answer: `${m / 2 ** t}`,
      hint: `First count the halvings: ${h * t} hours ÷ ${h} hours. Then halve ${m} mg that many times.`,
      explanation: [
        `The amount halves once every ${h} hours. ${h} hours is the half-life, the time for half of it to leave the body.`,
        `Count the halvings: ${h * t} ÷ ${h} = ${t}. So the amount halves ${words[t]} times.`,
        `Halving ${t} times means multiplying by $\\frac{1}{2}$ ${t} times, which is $\\left(\\frac{1}{2}\\right)^{${t}} = \\frac{1}{${2 ** t}}$.`,
        `So $${m} \\times \\frac{1}{${2 ** t}} = \\frac{${m}}{${2 ** t}} = ${m / 2 ** t}$.`,
        `After ${h * t} hours, ${m / 2 ** t} mg of the medicine remain.`,
      ],
    };
  }
  const [bn, bd] = pick(r, [
    [2, 1],
    [3, 1],
    [1, 2],
    [2, 3],
    [3, 2],
    [5, 2],
  ] as const);
  const t = r(2, 4),
    a = bd ** t * r(1, 5),
    value = (a * bn ** t) / bd ** t;
  const base = bd === 1 ? `${bn}` : `\\left(\\frac{${bn}}{${bd}}\\right)`;
  const baseText = bd === 1 ? `${bn}` : `${bn}/${bd}`;
  return {
    prompt: `For $f(t) = ${a} \\cdot ${base}^{t}$, what is $f(${t})$?`,
    answer: `${value}`,
    hint: `Replace $t$ with ${t}: raise ${baseText} to the power ${t} first, then multiply by ${a}.`,
    explanation: [
      `$f(${t})$, read "$f$ of ${t}", is the output when the input $t$ is ${t}. So replace $t$ with ${t}: $f(${t}) = ${a} \\cdot ${base}^{${t}}$.`,
      `Do the power first, because exponents come before multiplication. The exponent ${t} means multiply ${baseText} by itself ${t} times: $${base}^{${t}} = ${ftex(bn ** t, bd ** t)}$.`,
      `Then multiply by ${a}: $${a} \\times ${ftex(bn ** t, bd ** t)} = ${value}$.`,
      `So $f(${t}) = ${value}$.`,
    ],
  };
}

function modelRule(r: Rand): Draft {
  const frame = r(0, 3);
  const eq = (a: string | number, b: string | number, v = "x") =>
    `$y = ${a} \\cdot ${b}^{${v}}$`;
  if (frame <= 1) {
    let a: number, b: number;
    do {
      a = frame === 0 ? r(2, 6) : r(2, 5);
      b = r(2, frame === 0 ? 4 : 3);
    } while (a === b);
    const xs = [0, 1, 2, 3],
      ys = xs.map((x) => a * b ** x);
    const d = a * b - a;
    return {
      prompt:
        frame === 0
          ? "The table shows an exponential function. Which equation gives $y$ for every row?"
          : "The graph shows an exponential function through the marked points. Which equation is it?",
      figure: scene(
        frame === 0
          ? valueTable(
              "x",
              ["y"],
              xs.map((x, i) => [x, ys[i]!]),
            ).scene({ title: "Table of y against x" })
          : exponentialGraph(a, b, [0, 1, 2]),
      ),
      hint: `At $x = 0$ the equation must give ${a}. Then compare $y = ${ys[1]}$ at $x = 1$ with $y = ${ys[2]}$ at $x = 2$: is that an added amount or a factor?`,
      explanation: [
        `An exponential rule $y = a \\cdot b^{x}$ has two numbers. The starting value $a$ is $y$ at $x = 0$. The factor $b$ multiplies $y$ at each step.`,
        `At $x = 0$, $y = ${a}$, so the starting value is ${a}. This is because $b^{0} = 1$ for any base.`,
        `Each step of 1 in $x$ multiplies $y$ by ${b}: ${ys
          .slice(0, frame === 0 ? 4 : 3)
          .join(", ")}. So the factor is ${b}.`,
        `The equation is ${eq(a, b)}.`,
      ],
      choices: [
        { label: eq(a, b), correct: true },
        {
          label: eq(b, a),
          feedback: `This swaps the starting value and the factor. At $x = 0$ it gives ${b}, but $y$ starts at ${a}. The number in front is the start, and ${b} is the repeated factor.`,
        },
        {
          label: `$y = ${d}x + ${a}$`,
          feedback: `This is a linear rule: it adds ${d} each step. It fits $x = 0$ and $x = 1$, but from $x = 1$ to $x = 2$, $y$ is multiplied by ${b}, not increased by ${d}. Exponential growth multiplies.`,
        },
        {
          label: eq(a * b, b),
          feedback: `This starts from the value at $x = 1$. At $x = 0$ it gives ${a * b}, but the starting value, $y$ at $x = 0$, is ${a}.`,
        },
      ],
    };
  }
  if (frame === 2) {
    const [b, verb] = pick(r, [
      [2, "doubles"],
      [3, "triples"],
      [4, "quadruples"],
    ] as const);
    let a: number;
    do a = r(2, 9);
    while (a === b);
    return {
      prompt: `A colony of bacteria starts with ${a} thousand cells and ${verb} every hour. Which equation gives the number of cells $y$, in thousands, after $x$ hours?`,
      hint: `Check $x = 0$: the colony has ${a} thousand cells. After each hour the count ${verb}, so ask what happens to $y$ at each step.`,
      explanation: [
        `An exponential rule $y = a \\cdot b^{x}$ starts at $a$ and multiplies by the factor $b$ at each step.`,
        `At $x = 0$ hours there are ${a} thousand cells, so the starting value is ${a}.`,
        `The colony ${verb} every hour, so each hour multiplies the count by ${b}.`,
        `After $x$ hours it has been multiplied by ${b} a total of $x$ times. That is $${b}^{x}$, where the exponent $x$ counts the hours.`,
        `So the number of cells, in thousands, is ${eq(a, b)}.`,
      ],
      choices: [
        { label: eq(a, b), correct: true },
        {
          label: eq(b, a),
          feedback: `This swaps the start and the factor. At $x = 0$ it gives ${b} thousand, but the colony starts at ${a} thousand. The start goes in front, and the factor ${b} is the base of the power.`,
        },
        {
          label: `$y = ${a} + ${b}x$`,
          feedback: `This adds ${b} thousand cells each hour. The colony ${verb}: it is multiplied, not increased by a fixed amount.`,
        },
        {
          label: `$y = ${a}x^{${b}}$`,
          feedback: `Here the hours are the base, the number being multiplied. In repeated multiplication the factor ${b} is the base and the number of hours is the exponent.`,
        },
      ],
    };
  }
  const value = pick(r, [12000, 15000, 18000, 20000, 24000, 30000]),
    p = pick(r, [10, 15, 20, 25, 30]);
  const keep = factor(-p),
    lose = String(p / 100),
    grow = factor(p);
  const shown = value.toLocaleString("en-US");
  return {
    prompt: `A car is worth ${shown} dollars and loses ${p}% of its value each year. Which equation gives its value $y$, in dollars, after $x$ years?`,
    hint: `Losing ${p}% each year leaves the rest of the value: what percent of ${shown} dollars is left after one year?`,
    explanation: [
      `An exponential rule $y = a \\cdot b^{x}$ starts at $a$ and multiplies by the factor $b$ each year.`,
      `Losing ${p}% each year keeps the rest: $100\\% - ${p}\\% = ${100 - p}\\%$ of the value.`,
      `As a decimal, ${100 - p}% is ${keep}. So each year multiplies the value by ${keep}.`,
      `The starting value, at $x = 0$ years, is ${shown} dollars.`,
      `So the value after $x$ years is $y = ${value} \\cdot ${keep}^{x}$.`,
    ],
    choices: [
      { label: eq(value, keep), correct: true },
      {
        label: eq(value, lose),
        feedback: `This uses the percent lost as the factor. A factor of ${lose} keeps only ${p}% each year. The car loses ${p}%, so it keeps ${100 - p}%.`,
      },
      {
        label: eq(value, grow),
        feedback: `This adds ${p}% instead of taking it away. A factor of ${grow} grows the value each year. A loss multiplies by a number less than 1.`,
      },
      {
        label: `$y = ${value} - ${(value * p) / 100}x$`,
        feedback: `This subtracts the same ${((value * p) / 100).toLocaleString("en-US")} dollars every year. ${p}% of a shrinking value is less each year, so the loss is a factor, not a fixed amount.`,
      },
    ],
  };
}

const kindChoices = (
  kind: "linear" | "exponential" | "neither",
  why: Record<"linear" | "exponential" | "neither", string>,
): Choice[] =>
  (
    [
      ["linear", "Linear: equal differences"],
      ["exponential", "Exponential: equal ratios"],
      ["neither", "Neither"],
    ] as const
  ).map(([k, label]) =>
    k === kind ? { label, correct: true } : { label, feedback: why[k] },
  );

function linearOrExponential(r: Rand): Draft {
  const kind = pick(r, ["linear", "exponential", "neither"] as const);
  if (r(0, 1) === 0) {
    const start = r(0, 1),
      dx = pick(r, [1, 1, 2]);
    const xs = [0, 1, 2, 3, 4].map((i) => start + i * dx);
    let ys: number[];
    if (kind === "linear") {
      const m = pick(r, [-5, -4, -3, 2, 3, 4, 5, 6, 7, 8, 9]),
        c = r(m < 0 ? 25 : 1, m < 0 ? 40 : 20);
      ys = [0, 1, 2, 3, 4].map((i) => c + m * i);
    } else if (kind === "exponential") {
      const b = pick(r, [2, 3]),
        a = r(1, 5);
      ys = [0, 1, 2, 3, 4].map((i) => a * b ** i);
      if (r(0, 1)) ys.reverse();
    } else {
      const c = r(1, 9),
        k = r(1, 3);
      ys = [0, 1, 2, 3, 4].map((i) => k * i * i + c);
    }
    const d = ys.slice(1).map((y, i) => y - ys[i]!);
    return {
      prompt: "Which kind of function does the table show?",
      figure: scene(
        valueTable(
          "x",
          ["y"],
          xs.map((x, i) => [x, ys[i]!]),
        ).scene({ title: "Table of y against x" }),
      ),
      hint: `The $x$-values go up by ${dx} each row. Find how $y$ changes from ${ys[0]} to ${ys[1]} and from ${ys[1]} to ${ys[2]}: compare the differences, then the ratios.`,
      explanation: [
        `A linear function adds the same amount each step: equal differences. An exponential function multiplies by the same number each step: equal ratios.`,
        `The $x$-values go up by the same step, ${dx}, so we can compare the $y$-values row to row.`,
        `Subtract each $y$ from the next. The differences are ${d.map(s).join(", ")}.`,
        kind === "linear"
          ? `Every difference is ${s(d[0]!)}, so the same amount is added each step.`
          : kind === "exponential"
            ? `The differences change. But each $y$ is ${ys[1]! > ys[0]! ? `${ys[1]! / ys[0]!} times` : `1/${ys[0]! / ys[1]!} of`} the one before, so the ratios are equal.`
            : `The differences change. The ratios change too: ${ys[1]}/${ys[0]} is not ${ys[2]}/${ys[1]}.`,
        kind === "linear"
          ? `The table shows a linear function.`
          : kind === "exponential"
            ? `The table shows an exponential function.`
            : `The table shows neither a linear nor an exponential function.`,
      ],
      choices: kindChoices(kind, {
        linear: `Linear means equal differences. Here the differences are ${d.map(s).join(", ")}, which are not all equal.`,
        exponential: `Exponential means equal ratios, each $y$ divided by the one before. Here ${ys[1]}/${ys[0]} and ${ys[2]}/${ys[1]} are not equal.`,
        neither: `A pattern is there: the ${kind === "linear" ? "differences between rows are all equal, which makes it linear" : "ratios between rows are all equal, which makes it exponential"}.`,
      }),
      keepOrder: true,
    };
  }
  const plant = r(0, 1) === 0;
  const start = plant ? r(4, 20) : 10 * r(5, 30),
    step = plant ? r(2, 6) : 5 * r(2, 8),
    pct = pick(r, [2, 3, 5, 8, 10]);
  const unit = plant ? "cm" : "dollars",
    period = plant ? "week" : "month";
  const what = plant ? "the plant's height" : "the balance";
  const story =
    kind === "linear"
      ? plant
        ? `A plant is ${start} cm tall and grows ${step} cm each week.`
        : `A savings jar holds ${start} dollars, and ${step} dollars are added each month.`
      : kind === "exponential"
        ? plant
          ? `A plant is ${start} cm tall, and its height grows by ${pct}% each week.`
          : `An account holds ${start} dollars and earns ${pct}% interest each month.`
        : plant
          ? `A plant is ${start} cm tall. It grows 1 cm in the first week, 2 cm in the second, 3 cm in the third, and so on.`
          : `A savings jar holds ${start} dollars. Each month, ${step} dollars more are added than the month before: ${step}, then ${2 * step}, then ${3 * step}.`;
  return {
    prompt: `${story} Which kind of function models ${what} over time?`,
    hint: `Track ${what} from one ${period} to the next, starting at ${start} ${unit}: is the same amount added each ${period}, or is it multiplied by the same factor each ${period}?`,
    explanation: [
      `A linear model adds the same amount each ${period}. An exponential model multiplies by the same number, the factor, each ${period}.`,
      kind === "linear"
        ? `Here the same ${plant ? `${step} cm` : `${step} dollars`} is added each ${period}. The difference from one ${period} to the next never changes.`
        : kind === "exponential"
          ? `Here a ${pct}% increase keeps the whole amount and adds ${pct}% of it. That multiplies by ${factor(pct)} each ${period}, so the ratio never changes.`
          : `Here the amount added grows each ${period}, so the differences change. The ratios change too, because no single factor gives this pattern.`,
      kind === "linear"
        ? `So ${what} is modeled by a linear function.`
        : kind === "exponential"
          ? `So ${what} is modeled by an exponential function.`
          : `So ${what} is modeled by neither a linear nor an exponential function.`,
    ],
    choices: kindChoices(kind, {
      linear:
        kind === "exponential"
          ? `Linear would add the same amount each ${period}. But ${pct}% of a growing amount is more each ${period}, so the increase is not the same.`
          : `Linear would add the same amount each ${period}. Here the amount added changes, so the differences are not equal.`,
      exponential:
        kind === "linear"
          ? `Exponential would multiply by the same factor. Here the same amount is added each ${period}, which is an equal difference.`
          : `Exponential would multiply by the same factor. Here the increases go up by a fixed step, which no single factor produces.`,
      neither: `There is a steady pattern: each ${period} ${kind === "linear" ? "adds the same amount, which is linear" : "multiplies by the same factor, which is exponential"}.`,
    }),
    keepOrder: true,
  };
}

/** Least whole x with b^x > m·x + c, starting below the line at x = 0. */
const crossing = (m: number, c: number, b: number) => {
  let x = 0;
  while (b ** x <= m * x + c) x++;
  return x;
};
function overtakes(r: Rand): Draft {
  const frame = r(0, 2);
  let m: number, c: number, b: number, X: number;
  do {
    b = frame === 0 ? pick(r, [2, 2, 3]) : 2;
    m = b === 2 ? r(4, 30) : r(5, 40);
    c = r(2, 40);
    X = crossing(m, c, b);
  } while (
    (frame === 0 && (X < (b === 2 ? 4 : 3) || X > 8)) ||
    (frame > 0 && (X < 5 || X > 9))
  );
  const steps = [
    `$f(x) = ${m}x + ${c}$ is linear: it adds ${m} each time $x$ goes up by 1. $g(x) = ${b}^{x}$ is exponential: it multiplies by ${b} each time.`,
    `Adding wins at first, but multiplying grows faster and faster. So try each whole $x$ and compare the two outputs.`,
    `At $x = ${X - 1}$: $f = ${m * (X - 1) + c}$ and $g = ${b ** (X - 1)}$. Here $g$ is not yet greater.`,
    `At $x = ${X}$: $f = ${m * X + c}$ and $g = ${b ** X}$. Now $g > f$ for the first time.`,
    `After this, $g$ keeps multiplying by ${b} while $f$ only adds ${m}, so $g$ stays ahead.`,
    `The least whole number with $g(x) > f(x)$ is $x = ${X}$.`,
  ];
  if (frame === 0)
    return {
      prompt: `The graph shows $f(x) = ${m}x + ${c}$ and $g(x) = ${b}^{x}$. What is the least whole number $x$ for which $g(x) > f(x)$?`,
      figure: scene(raceGraph(m, c, b, b === 2 ? 10 : 7)),
      answer: `${X}`,
      hint: `At $x = 0$, $f(0) = ${c}$ and $g(0) = 1$. Step $x$ up by 1 and compare $${m}x + ${c}$ with $${b}^{x}$ each time.`,
      explanation: steps,
    };
  const days = [0, 1, 2, 3];
  if (frame === 1)
    return {
      prompt: `Offer A starts with ${c} coins and adds ${m} coins each day. Offer B starts with 1 coin and doubles each day. The bars show both totals for days 0 to 3. On which day is Offer B's total first greater than Offer A's?`,
      figure: scene(
        raceBars(
          days,
          { label: "Offer A", values: days.map((d) => c + m * d) },
          { label: "Offer B", values: days.map((d) => 2 ** d) },
          "Day",
          [
            step(
              `Offer A adds ${m} coins each day.`,
              act.highlight("race.series.0"),
            ),
            step(
              "Offer B doubles each day: its gains are 1, 2, 4, and keep doubling.",
              act.highlight("race.series.1"),
            ),
          ],
        ),
      ),
      answer: `${X}`,
      hint: `Continue both patterns past day 3: Offer A adds ${m} to its ${c + 3 * m} coins each day, and Offer B doubles its 8 coins each day. Compare the totals day by day.`,
      explanation: [
        `Offer A adds the same ${m} coins each day, so on day $d$ it has $${c} + ${m}d$ coins. That is linear growth.`,
        `Offer B doubles each day, so on day $d$ it has $2^{d}$ coins. The exponent $d$ counts the doublings. That is exponential growth.`,
        `Keep both patterns going past day 3 and compare the totals day by day.`,
        `Day ${X - 1}: Offer A has ${c + m * (X - 1)} and Offer B has ${2 ** (X - 1)}, so B is not yet ahead.`,
        `Day ${X}: Offer A has ${c + m * X} and Offer B has ${2 ** X}, so B is ahead for the first time.`,
        `After that B doubles while A adds only ${m}, so B stays ahead. Offer B's total is first greater on day ${X}.`,
      ],
    };
  const xs = [0, 1, 2, 3];
  return {
    prompt:
      "The table shows $f(x)$, which adds the same amount each step, and $g(x)$, which multiplies by the same factor. If both patterns continue, what is the least whole number $x$ for which $g(x) > f(x)$?",
    figure: scene(
      valueTable(
        "x",
        ["f(x)", "g(x)"],
        xs.map((x) => [x, m * x + c, 2 ** x]),
      )
        .changes(0, [`+${m}`, `+${m}`, `+${m}`])
        .changes(1, ["×2", "×2", "×2"], "warm")
        .scene({ title: "Values of f and g" }),
    ),
    answer: `${X}`,
    hint: `$f$ adds ${m} each step from ${c + 3 * m}, and $g$ doubles from 8. Extend both columns one row at a time.`,
    explanation: [
      `From the table, $f$ starts at ${c} and adds ${m} each step, so $f(x) = ${m}x + ${c}$. $g$ starts at 1 and doubles, so $g(x) = 2^{x}$.`,
      ...steps.slice(1),
    ],
  };
}

function sameBase(r: Rand): Draft {
  const frame = r(0, 3);
  const base = { kind: "fraction" as const, label: "Exact value of $x$" };
  if (frame === 0) {
    const b = pick(r, [2, 3, 5]),
      n = b === 2 ? r(3, 7) : b === 3 ? r(2, 5) : r(2, 4);
    let c: number;
    do c = r(-4, 4);
    while (c === 0);
    const side = `x ${c > 0 ? "+" : "-"} ${Math.abs(c)}`;
    return {
      ...base,
      prompt: `Solve $${b}^{${side}} = ${b ** n}$.`,
      answer: exact(n - c),
      hint: `Write ${b ** n} as a power of ${b}. Then the exponents must be equal: $${side}$ equals that power.`,
      explanation: [
        `The unknown $x$ sits in the exponent, the small raised number. To reach it, write both sides as powers of the same base, ${b}.`,
        `Multiply ${b} by itself until you reach ${b ** n}: $${b ** n} = ${b}^{${n}}$. So the equation is $${b}^{${side}} = ${b}^{${n}}$.`,
        `Two powers of the same base are equal only when their exponents are equal. So $${side} = ${n}$.`,
        `${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)} ${c > 0 ? "from" : "to"} both sides: $x = ${s(n - c)}$.`,
        `The solution is $x = ${s(n - c)}$.`,
      ],
    };
  }
  const b = pick(r, [2, 3]);
  const exps = b === 2 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4];
  if (frame === 1) {
    let p: number, q: number;
    do {
      p = pick(r, b === 2 ? [2, 3, 4] : [2, 3]);
      q = pick(r, exps);
    } while (q === p || q % p === 0);
    return {
      ...base,
      prompt: `Solve $${b ** p}^{x} = ${b ** q}$.`,
      answer: exact(q, p),
      hint: `${b ** p} and ${b ** q} are both powers of one prime base. Rewrite each side with that base, then set the exponents equal.`,
      explanation: [
        `The unknown $x$ is in the exponent. To reach it, write both sides as powers of one base, ${b}.`,
        `$${b ** p} = ${b}^{${p}}$ and $${b ** q} = ${b}^{${q}}$.`,
        `A power of a power multiplies the exponents: $(${b}^{${p}})^{x} = ${b}^{${p}x}$. So the equation is $${b}^{${p}x} = ${b}^{${q}}$.`,
        `Two powers of the same base are equal only when their exponents are equal: $${p}x = ${q}$.`,
        `Divide both sides by ${p}. The solution is $x = ${ftex(q, p)}$.`,
      ],
    };
  }
  if (frame === 2) {
    const k = r(2, 4),
      c = r(1, 6),
      n = pick(r, b === 2 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]);
    return {
      ...base,
      prompt: `Solve $${b}^{${k}x - ${c}} = \\frac{1}{${b ** n}}$.`,
      answer: exact(c - n, k),
      hint: `$\\frac{1}{${b ** n}}$ is the reciprocal of ${b ** n}: write it as ${b} to a negative power, then set the exponents equal.`,
      explanation: [
        `The unknown $x$ is in the exponent. To reach it, write the right side as a power of ${b} too.`,
        `$${b ** n} = ${b}^{${n}}$. A negative exponent means "one over": $${b}^{-${n}} = \\frac{1}{${b}^{${n}}}$. So $\\frac{1}{${b ** n}} = ${b}^{-${n}}$.`,
        `Two powers of the same base are equal only when their exponents are equal: $${k}x - ${c} = -${n}$.`,
        `Add ${c} to both sides: $${k}x = ${s(c - n)}$. Then divide by ${k}.`,
        `The solution is $x = ${ftex(c - n, k)}$.`,
      ],
    };
  }
  let p: number, q: number;
  do {
    p = pick(r, exps.slice(0, -1));
    q = pick(r, exps);
  } while (q <= p || b ** q > 81 || b ** p < 2);
  return {
    ...base,
    prompt: `Solve $${b ** p}^{x + 1} = ${b ** q}^{x}$.`,
    answer: exact(p, q - p),
    hint: `Rewrite ${b ** p} and ${b ** q} as powers of one prime base, multiply out the exponents, then solve the linear equation in $x$.`,
    explanation: [
      `The unknown $x$ is in the exponents. To reach it, write both bases as powers of one base, ${b}: $${b ** p} = ${b}^{${p}}$ and $${b ** q} = ${b}^{${q}}$.`,
      `A power of a power multiplies the exponents. So the left side is $${b}^{${p === 1 ? "x + 1" : `${p}(x + 1)`}}$ and the right side is $${b}^{${q}x}$.`,
      `Two powers of the same base are equal only when their exponents are equal: $${p === 1 ? "x + 1" : `${p}(x + 1)`} = ${q}x$.`,
      `${p === 1 ? "" : `Multiply out the bracket: $${p}x + ${p} = ${q}x$. `}Subtract $${p === 1 ? "" : p}x$ from both sides: $${q - p === 1 ? "" : q - p}x = ${p}$.`,
      `The solution is $x = ${ftex(p, q - p)}$.`,
    ],
  };
}

function logSolution(r: Rand): Draft {
  const frame = r(0, 3);
  const nonPower = (b: number) => {
    let k: number;
    do k = r(3, 20);
    while (powerOf(b, k) !== undefined);
    return k;
  };
  if (frame === 0) {
    const b = pick(r, [2, 3, 5, 10]),
      k = nonPower(b),
      a = r(2, 9),
      c = a * k;
    return {
      prompt: `Which is the exact solution of $${a} \\cdot ${b}^{x} = ${c}$?`,
      hint: `Divide both sides by ${a} first, so the power $${b}^{x}$ stands alone. Then ask: ${b} to what power is the result?`,
      explanation: [
        `The unknown $x$ is in the exponent. First get the power $${b}^{x}$ alone on one side.`,
        `${a} multiplies the power, so divide both sides by ${a}: $${b}^{x} = ${k}$.`,
        `${k} is not a whole-number power of ${b}, so we name the exponent with a logarithm. $${lg(b)} ${k}$ means "the power of ${b} that gives ${k}".`,
        `The exact solution is $x = ${lg(b)} ${k}$.`,
      ],
      choices: [
        { label: `$x = ${lg(b)} ${k}$`, correct: true },
        {
          label: `$x = \\log_{${k}} ${b}$`,
          feedback: `This swaps the base and the result. It asks for the power of ${k} that gives ${b}. The base of the power is ${b}, so the base of the logarithm is ${b}.`,
        },
        {
          label: `$x = ${lg(b)} ${c - a}$`,
          feedback: `This subtracts ${a}, but ${a} multiplies the power. Undo multiplying by dividing both sides by ${a}.`,
        },
        {
          label: `$x = \\frac{${lg(b)} ${c}}{${a}}$`,
          feedback: `This takes the logarithm before removing ${a}. The log of a product is a sum, not a product, so ${a} cannot be divided out of $${lg(b)} ${c}$ afterward. Divide by ${a} first.`,
        },
      ],
    };
  }
  if (frame === 1) {
    const b = pick(r, [2, 3, 5, 10]),
      k = nonPower(b),
      h = r(1, 6);
    return {
      prompt: `Which is the exact solution of $${b}^{x + ${h}} = ${k}$?`,
      hint: `The exponent $x + ${h}$ is the power of ${b} that gives ${k}. Write that exponent as a logarithm, then undo the + ${h}.`,
      explanation: [
        `A logarithm names an exponent: $${lg(b)} ${k}$ means "the power of ${b} that gives ${k}".`,
        `Here the whole exponent $x + ${h}$ is the power of ${b} that gives ${k}. So $x + ${h} = ${lg(b)} ${k}$.`,
        `To get $x$ alone, subtract ${h} from both sides: $x = ${lg(b)} ${k} - ${h}$.`,
        `The exact solution is $x = ${lg(b)} ${k} - ${h}$.`,
      ],
      choices: [
        { label: `$x = ${lg(b)} ${k} - ${h}$`, correct: true },
        {
          label: `$x = ${lg(b)} (${k} - ${h})$`,
          feedback: `This subtracts ${h} from ${k}, but the ${h} is part of the exponent, not of ${k}. Write the exponent as a logarithm first, then subtract ${h}.`,
        },
        {
          label: `$x = ${lg(b)} ${k} + ${h}$`,
          feedback: `This is a sign error. $x + ${h}$ equals the logarithm, so undo the + ${h} by subtracting ${h}, not adding it.`,
        },
        {
          label: `$x = \\log_{${k}} ${b} - ${h}$`,
          feedback: `This swaps the base and the result. The base of the power, ${b}, is the base of the logarithm, and ${k} goes inside.`,
        },
      ],
    };
  }
  if (frame === 2) {
    const rate = pick(r, [2, 3, 4, 5]),
      k = pick(r, [3, 5, 6, 7, 10, 12, 20]);
    return {
      prompt: `Which is the exact solution of $e^{${rate}t} = ${k}$?`,
      hint: `Take the natural logarithm of both sides; $\\ln e^{${rate}t}$ is just the exponent $${rate}t$.`,
      explanation: [
        `$e$ is a special number, about 2.718. $\\ln$, the natural logarithm, is the logarithm with base $e$.`,
        `$\\ln$ undoes a power of $e$: $\\ln e^{${rate}t} = ${rate}t$. So take $\\ln$ of both sides: $${rate}t = \\ln ${k}$.`,
        `$${rate}t$ means ${rate} times $t$, so divide both sides by ${rate}: $t = \\frac{\\ln ${k}}{${rate}}$.`,
        `The exact solution is $t = \\frac{\\ln ${k}}{${rate}}$.`,
      ],
      choices: [
        { label: `$t = \\frac{\\ln ${k}}{${rate}}$`, correct: true },
        {
          label: `$t = \\ln \\frac{${k}}{${rate}}$`,
          feedback: `This divides ${k} by ${rate} inside the logarithm. But ${rate} multiplies $t$ in the exponent. Take $\\ln$ first to get $${rate}t = \\ln ${k}$, then divide by ${rate}.`,
        },
        {
          label: `$t = ${rate}\\ln ${k}$`,
          feedback: `This multiplies by ${rate} instead of dividing. $${rate}t = \\ln ${k}$, so $t$ is $\\ln ${k}$ divided by ${rate}.`,
        },
        {
          label: `$t = \\frac{${k}}{${rate}e}$`,
          feedback: `This treats $e$ as a factor. $e$ is the base of the power, so undo it with $\\ln$. Dividing by $e$ does not undo an exponent.`,
        },
      ],
    };
  }
  const pct = pick(r, [3, 4, 5, 6, 8, 10]),
    f = factor(pct),
    rate = String(pct / 100);
  return {
    prompt: `An account grows by ${pct}% each year, so a balance $B$ becomes $B \\cdot ${f}^{t}$ after $t$ years. Which expression gives the exact number of years for the balance to double?`,
    hint: `Doubling means $B \\cdot ${f}^{t} = 2B$, so $B$ cancels: ${f} to what power is 2?`,
    explanation: [
      `To double, the balance must become $2B$, twice the start. So set $B \\cdot ${f}^{t} = 2B$.`,
      `Divide both sides by $B$: $${f}^{t} = 2$. The starting amount does not matter.`,
      `The unknown $t$ is an exponent. A logarithm names it: $\\log_{${f}} 2$ means "the power of ${f} that gives 2".`,
      `The exact time to double is $t = \\log_{${f}} 2$ years, about ${(Math.log(2) / Math.log(1 + pct / 100)).toFixed(1)} years.`,
    ],
    choices: [
      { label: `$\\log_{${f}} 2$`, correct: true },
      {
        label: `$\\log_{2} ${f}$`,
        feedback: `This swaps the base and the result: it is the power of 2 that gives ${f}. The repeated factor ${f} is the base of the logarithm.`,
      },
      {
        label: `$\\frac{2}{${f}}$`,
        feedback: `This divides as if $t$ multiplied ${f}. But $t$ is an exponent, so solving for it needs a logarithm, not a quotient.`,
      },
      {
        label: `$\\frac{\\log 2}{${rate}}$`,
        feedback: `This uses the rate ${rate} in place of the yearly factor ${f}. The balance is multiplied by ${f}, and the time is $\\log_{${f}} 2$.`,
      },
    ],
  };
}

function logEquation(r: Rand): Draft {
  const frame = r(0, 2);
  if (frame === 0) {
    const b = pick(r, [2, 3, 5, 10]),
      n = b === 2 ? r(2, 6) : b === 10 ? r(1, 3) : r(1, 4);
    let c: number;
    do c = r(-9, 9);
    while (c === 0);
    const arg = `x ${c > 0 ? "+" : "-"} ${Math.abs(c)}`;
    return {
      prompt: `Solve $${lg(b)}(${arg}) = ${n}$.`,
      answer: `${b ** n - c}`,
      hint: `Rewrite the logarithm as a power: $${arg} = ${b}^{${n}}$.`,
      explanation: [
        `A logarithm is an exponent. $${lg(b)}(${arg}) = ${n}$ says ${b} is the base and ${n} is the exponent: $${b}^{${n}} = ${arg}$.${b === 10 ? " A log with no base written has base 10." : ""}`,
        `So rewrite it as a power: $${arg} = ${b}^{${n}} = ${b ** n}$.`,
        `${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)} ${c > 0 ? "from" : "to"} both sides: $x = ${b ** n} ${c > 0 ? "-" : "+"} ${Math.abs(c)} = ${s(b ** n - c)}$.`,
        `Check: a logarithm needs a positive input. Here $${arg} = ${b ** n}$, which is positive.`,
        `The solution is $x = ${s(b ** n - c)}$.`,
      ],
    };
  }
  if (frame === 1) {
    const options: [number, number, number, number][] = [];
    for (const b of [2, 3, 5, 6, 10])
      for (let n = 1; b ** n <= 1000; n++)
        for (let x = 1; x * x < b ** n; x++)
          if (b ** n % x === 0 && b ** n / x - x <= 24)
            options.push([b, n, x, b ** n / x - x]);
    const [b, n, x, d] = pick(r, options);
    const other = -(x + d);
    return {
      prompt: `Solve $${lg(b)} x + ${lg(b)}(x + ${d}) = ${n}$.`,
      answer: `${x}`,
      hint: `Combine the logs into one: $${lg(b)} \\big(x(x + ${d})\\big) = ${n}$, so $x(x + ${d}) = ${b}^{${n}}$. Keep only a solution that makes both logarithms defined.`,
      explanation: [
        `Adding two logs with the same base gives the log of the product, the result of multiplying: $${lg(b)} \\big(x(x + ${d})\\big) = ${n}$.`,
        `A logarithm is an exponent, so rewrite it as a power: $x(x + ${d}) = ${b}^{${n}} = ${b ** n}$.`,
        `Multiply out and move ${b ** n} to the left: $x^2 + ${d === 1 ? "" : d}x - ${b ** n} = 0$.`,
        `This factors as $(x - ${x})(x + ${x + d}) = 0$. A product is 0 only when a factor is 0, so $x = ${x}$ or $x = ${s(other)}$.`,
        `A logarithm needs a positive input, so $${lg(b)} x$ needs $x > 0$. That rejects $x = ${s(other)}$.`,
        `The solution is $x = ${x}$.`,
      ],
    };
  }
  const b = pick(r, [2, 3, 4, 5]),
    n = b <= 3 ? r(1, 2) : 1,
    m = r(1, 6),
    d = m * (b ** n - 1);
  return {
    prompt: `Solve $${lg(b)} x - ${lg(b)}(x - ${d}) = ${n}$.`,
    answer: `${m * b ** n}`,
    hint: `Combine into one logarithm: $${lg(b)} \\frac{x}{x - ${d}} = ${n}$, so $\\frac{x}{x - ${d}} = ${b}^{${n}}$.`,
    explanation: [
      `Subtracting two logs with the same base gives the log of the quotient, the result of dividing: $${lg(b)} \\frac{x}{x - ${d}} = ${n}$.`,
      `A logarithm is an exponent, so rewrite it as a power: $\\frac{x}{x - ${d}} = ${b}^{${n}} = ${b ** n}$.`,
      `Multiply both sides by $x - ${d}$ to clear the fraction: $x = ${b ** n}(x - ${d})$.`,
      `Multiply out: $x = ${b ** n}x - ${b ** n * d}$. Collect the $x$ terms: $${b ** n - 1 === 1 ? "" : b ** n - 1}x = ${b ** n * d}$, so $x = ${m * b ** n}$.`,
      `Check: a logarithm needs a positive input. $x = ${m * b ** n}$ and $x - ${d} = ${m}$ are both positive.`,
      `The solution is $x = ${m * b ** n}$.`,
    ],
  };
}

function seriesSum(r: Rand): Draft {
  const frame = r(0, 3);
  const sum = (a: number, rn: number, rd: number, n: number) =>
    reduce(a * (rn ** n - rd ** n) * rd, rd ** (n - 1) * (rn - rd) * rd);
  const formula = `S_n = \\frac{a_1(1 - r^n)}{1 - r}`,
    grows = `S_n = \\frac{a_1(r^n - 1)}{r - 1}`;
  if (frame === 0 || frame === 2 || frame === 3) {
    const b = pick(r, [2, 3]),
      a = r(2, 5),
      n = b === 2 ? r(5, 8) : r(5, 6);
    const terms = Array.from({ length: n }, (_, i) => a * b ** i);
    const total = (a * (b ** n - 1)) / (b - 1);
    const steps = [
      `Each term is ${b} times the one before, so this is a geometric series: a sum where each term multiplies the last by the same ratio.`,
      `The first term is $a_1 = ${a}$, the ratio is $r = ${b}$, and there are $n = ${n}$ terms: ${terms.join(", ")}.`,
      `The sum of the first $n$ terms is $${grows}$. It works because multiplying the sum by $r$ shifts every term one place, and subtracting cancels all but two terms.`,
      `Substitute: $S_{${n}} = \\frac{${a}(${b}^{${n}} - 1)}{${b} - 1} = \\frac{${a} \\times ${b ** n - 1}}{${b - 1}} = ${total}$.`,
      `Check by adding: $${terms.join(" + ")} = ${total}$.`,
    ];
    if (frame === 0)
      return {
        prompt: `Find the sum $${terms.slice(0, 3).join(" + ")} + \\cdots + ${terms.at(-1)}$.`,
        answer: `${total}`,
        hint: `Each term is ${b} times the one before. Count the terms from ${a} to ${terms.at(-1)} first; then use $${grows}$.`,
        explanation: [...steps, `The sum is ${total}.`],
      };
    if (frame === 2)
      return {
        prompt: `What is $\\sum_{k=1}^{${n}} ${a === 1 ? "" : `${a} \\cdot `}${b}^{k-1}$?`,
        answer: `${total}`,
        hint: `The sum has ${n} terms. $k = 1$ gives ${a}, and each next term multiplies by ${b}.`,
        explanation: [
          `$\\sum$, the capital Greek letter sigma, means "add up". Put $k = 1, 2, \\ldots, ${n}$ into $${a === 1 ? "" : `${a} \\cdot `}${b}^{k-1}$ and add the results.`,
          ...steps,
          `The value of the sum is ${total}.`,
        ],
      };
    return {
      prompt: `A jar starts empty. On day 1, ${plural(a, "coin")} ${a === 1 ? "goes" : "go"} in. Each day after that, ${b} times as many coins go in as the day before. The bars show each day's coins. How many coins are in the jar after day ${n}?`,
      figure: scene(
        growthBars(
          terms.map((_, i) => i + 1),
          terms,
          "Day",
        ),
      ),
      answer: `${total}`,
      hint: `The daily amounts ${a}, ${a * b}, ${a * b * b}, … form a geometric sequence with ratio ${b}. Add all ${n} days, or use $${grows}$.`,
      explanation: [...steps, `After day ${n}, the jar holds ${total} coins.`],
    };
  }
  // A described sequence, sometimes with ratio 1/2.
  const half = r(0, 1) === 1;
  const n = r(4, 7),
    rn = half ? 1 : pick(r, [2, 3]),
    rd = half ? 2 : 1,
    a = half ? 2 ** (n - 1) * r(1, 3) : r(2, 9);
  const [tn, td] = sum(a, rn, rd, n);
  const ratio = ftex(rn, rd);
  return {
    prompt: `A geometric sequence has first term ${a} and common ratio $${ratio}$. What is the sum of its first ${n} terms?`,
    answer: exact(tn, td),
    hint: `Use $${formula}$ with $a_1 = ${a}$, $r = ${ratio}$ and $n = ${n}$; work out $r^{${n}}$ first.`,
    explanation: [
      `A geometric sequence multiplies each term by the same number, the common ratio $r$. Here $a_1 = ${a}$, the first term, and $r = ${ratio}$.`,
      `The sum of the first $n$ terms is $${formula}$. It works because multiplying the sum by $r$ shifts every term one place, and subtracting cancels all but two terms.`,
      `Work out the power first: $r^{${n}} = ${ftex(rn ** n, rd ** n)}$.`,
      `Substitute: $S_{${n}} = \\frac{${a}\\left(1 - ${ftex(rn ** n, rd ** n)}\\right)}{1 - ${ratio}} = ${ftex(tn, td)}$.`,
      `The sum of the first ${n} terms is $${ftex(tn, td)}$.`,
    ],
  };
}

function logRules(r: Rand): Draft {
  const frame = r(0, 2);
  if (frame === 0) {
    const options: [number, number, number, number][] = [];
    for (const b of [6, 10, 12, 15])
      for (const k of [1, 2])
        for (let m = 2; m * m <= b ** k; m++)
          if (
            b ** k % m === 0 &&
            powerOf(b, m) === undefined &&
            powerOf(b, b ** k / m) === undefined
          )
            options.push([b, k, m, b ** k / m]);
    const [b, k, m, n] = pick(r, options);
    return {
      prompt: `What is $${lg(b)} ${m} + ${lg(b)} ${n}$?`,
      answer: `${k}`,
      hint: `Adding logs with the same base multiplies their arguments: ${m} × ${n}. Then ask which power of ${b} that product is.`,
      explanation: [
        `A logarithm answers one question: what power of the base gives this number? Here the base is ${b}.`,
        `Adding two logs with the same base gives the log of the product, the result of multiplying. This is the product rule, and it works because multiplying powers adds their exponents.`,
        `So $${lg(b)} ${m} + ${lg(b)} ${n} = ${lg(b)} (${m} \\cdot ${n}) = ${lg(b)} ${m * n}$.`,
        `${k === 1 ? `${b} to the power 1 is ${b}` : `$${b}^{${k}} = ${m * n}$`}, so $${lg(b)} ${m * n} = ${k}$.`,
        `The value of $${lg(b)} ${m} + ${lg(b)} ${n}$ is ${k}.`,
      ],
    };
  }
  if (frame === 1) {
    const b = pick(r, [2, 3, 5]);
    let n: number;
    do n = pick(r, [3, 5, 6, 7, 10, 11]);
    while (powerOf(b, n) !== undefined);
    let k: number;
    do k = r(1, 4);
    while (n * b ** k > 2000);
    const m = n * b ** k,
      flip = r(0, 3) === 0;
    const [p, q] = flip ? [n, m] : [m, n];
    return {
      prompt: `What is $${lg(b)} ${p} - ${lg(b)} ${q}$?`,
      answer: `${flip ? -k : k}`,
      hint: `Subtracting logs with the same base divides their arguments: ${p} ÷ ${q}. Write that quotient as a power of ${b}.`,
      explanation: [
        `A logarithm answers one question: what power of the base gives this number? Here the base is ${b}.`,
        `Subtracting two logs with the same base gives the log of the quotient, the result of dividing. This is the quotient rule.`,
        `So $${lg(b)} ${p} - ${lg(b)} ${q} = ${lg(b)} \\frac{${p}}{${q}} = ${lg(b)} ${ftex(p, q)}$.`,
        flip
          ? `$${q / p} = ${b}^{${k}}$, and a negative exponent means "one over". So $${ftex(p, q)} = ${b}^{-${k}}$.`
          : `Multiply ${b} by itself: $${b}^{${k}} = ${p / q}$.`,
        `So the power of ${b} is ${s(flip ? -k : k)}. The value of $${lg(b)} ${p} - ${lg(b)} ${q}$ is ${s(flip ? -k : k)}.`,
      ],
    };
  }
  const b = pick(r, [2, 3, 5]),
    p = pick(r, [2, 3]),
    j = r(1, 2);
  let c: number;
  do c = pick(r, [2, 3, 5, 7]);
  while (c === b || c * b ** j > 75 || c ** p > 343);
  const m = c * b ** j;
  return {
    prompt: `What is $${p}${lg(b)} ${m} - ${lg(b)} ${c ** p}$?`,
    answer: `${p * j}`,
    hint: `Move the ${p} inside as an exponent: $${p}${lg(b)} ${m} = ${lg(b)} ${m}^{${p}}$. Then the difference of logs is the log of a quotient.`,
    explanation: [
      `A logarithm answers one question: what power of the base gives this number? Here the base is ${b}.`,
      `A number in front of a log can move inside as an exponent. This is the power rule: $${p}${lg(b)} ${m} = ${lg(b)} ${m}^{${p}} = ${lg(b)} ${m ** p}$.`,
      `Subtracting two logs with the same base gives the log of the quotient, the result of dividing: $${lg(b)} ${m ** p} - ${lg(b)} ${c ** p} = ${lg(b)} \\frac{${m ** p}}{${c ** p}}$.`,
      `Divide: $\\frac{${m ** p}}{${c ** p}} = ${m ** p / c ** p}$, and $${m ** p / c ** p} = ${b}^{${p * j}}$.`,
      `So the value of the expression is ${p * j}.`,
    ],
  };
}

function logExpand(r: Rand): Draft {
  const frame = r(0, 2);
  const b = pick(r, [2, 3, 5, 10]);
  const L = (v: string) => `${lg(b)} ${v}`;
  const Lp = (v: string) => `${lg(b)}(${v})`;
  const coef = (k: number | string) => (k === 1 ? "" : `${k}`);
  if (frame === 0) {
    let p: number, q: number;
    do {
      p = r(2, 4);
      q = r(2, 4);
    } while (p === q);
    return {
      prompt: `Which expression is equivalent to $${lg(b)} \\frac{x^{${p}}y}{z^{${q}}}$ for positive $x$, $y$ and $z$?`,
      hint: `Split the quotient first, then the product: the log of $\\frac{x^{${p}}y}{z^{${q}}}$ is the log of $x^{${p}}y$ minus the log of $z^{${q}}$. Bring each exponent, ${p} and ${q}, down in front.`,
      explanation: [
        `Three rules turn one log into several. They come from how exponents work, since a logarithm is an exponent.`,
        `The log of a quotient, a division, is a difference of logs: $${lg(b)} (x^{${p}}y) - ${lg(b)} z^{${q}}$.`,
        `The log of a product, a multiplication, is a sum of logs: $${lg(b)} x^{${p}} + ${L("y")} - ${lg(b)} z^{${q}}$.`,
        `An exponent inside a log comes out in front as a multiplier: $${p}${L("x")} + ${L("y")} - ${q}${L("z")}$.`,
        `So the equivalent expression is $${p}${L("x")} + ${L("y")} - ${q}${L("z")}$.`,
      ],
      choices: [
        {
          label: `$${p}${L("x")} + ${L("y")} - ${q}${L("z")}$`,
          correct: true,
        },
        {
          label: `$${p}${L("x")} + ${L("y")} + ${q}${L("z")}$`,
          feedback: `This adds the log of $z$, but $z^{${q}}$ is in the denominator. Dividing inside a log means subtracting its logarithm.`,
        },
        {
          label: `$${p}(${L("x")} + ${L("y")}) - ${q}${L("z")}$`,
          feedback: `This spreads the exponent ${p} over $y$ as well. The exponent belongs to $x$ only, so it multiplies $${L("x")}$ alone.`,
        },
        {
          label: `$${Lp(`${p}x`)} + ${L("y")} - ${Lp(`${q}z`)}$`,
          feedback: `This keeps the exponent inside as a multiplier. An exponent comes out in front of the log as a coefficient, the number multiplying the log.`,
        },
      ],
    };
  }
  if (frame === 1) {
    let p: number, q: number;
    do {
      p = r(2, 4);
      q = r(2, 4);
    } while (p === q);
    return {
      prompt: `Which single logarithm equals $${p}${L("x")} - ${q}${L("y")} + ${L("z")}$ for positive $x$, $y$ and $z$?`,
      hint: `First move the coefficients ${p} and ${q} inside as exponents. Then a sum of logs multiplies and a difference divides.`,
      explanation: [
        `To condense means to write several logs as one. Use the log rules backward. They come from how exponents work, since a logarithm is an exponent.`,
        `A coefficient, the number multiplying a log, moves inside as an exponent: $${lg(b)} x^{${p}} - ${lg(b)} y^{${q}} + ${L("z")}$.`,
        `A sum of logs is the log of a product, so $x^{${p}}$ and $z$ multiply. A difference of logs is the log of a quotient, so $y^{${q}}$ divides.`,
        `Together: $${lg(b)} \\dfrac{x^{${p}}z}{y^{${q}}}$.`,
        `The single logarithm is $${lg(b)} \\dfrac{x^{${p}}z}{y^{${q}}}$.`,
      ],
      choices: [
        { label: `$${lg(b)} \\dfrac{x^{${p}}z}{y^{${q}}}$`, correct: true },
        {
          label: `$${lg(b)} (x^{${p}}y^{${q}}z)$`,
          feedback: `This multiplies all three, ignoring the minus sign. $${q}${L("y")}$ is subtracted, so $y^{${q}}$ divides rather than multiplies.`,
        },
        {
          label: `$${lg(b)} \\dfrac{${p}xz}{${q}y}$`,
          feedback: `This keeps the coefficients as multipliers. A coefficient in front of a log becomes an exponent inside it: $${p}${L("x")} = ${lg(b)} x^{${p}}$.`,
        },
        {
          label: `$\\dfrac{${lg(b)} (x^{${p}}z)}{${lg(b)} y^{${q}}}$`,
          feedback: `This divides two logs. A difference of logs is the log of a quotient, one log with a fraction inside, not a quotient of logs.`,
        },
      ],
    };
  }
  const k = pick(r, [3, 5, 7]);
  const half = `\\frac{1}{2}`,
    kHalf = `\\frac{${k}}{2}`;
  return {
    prompt: `Which expression is equivalent to $${lg(b)} \\sqrt{xy^{${k}}}$ for positive $x$ and $y$?`,
    hint: `A square root is the power $\\frac{1}{2}$ of everything under it: write $\\sqrt{xy^{${k}}}$ as $x^{1/2}y^{${k}/2}$ first.`,
    explanation: [
      `A square root is the same as the power $\\frac{1}{2}$. So $\\sqrt{xy^{${k}}} = (xy^{${k}})^{1/2}$.`,
      `A power of a product applies to each factor, and a power of a power multiplies the exponents: $x^{1/2}y^{${k}/2}$.`,
      `The log of a product is a sum of logs: $${lg(b)} x^{1/2} + ${lg(b)} y^{${k}/2}$.`,
      `An exponent inside a log comes out in front as a multiplier: $${coef(half)}${L("x")} + ${kHalf}${L("y")}$.`,
      `So the equivalent expression is $${half}${L("x")} + ${kHalf}${L("y")}$.`,
    ],
    choices: [
      { label: `$${half}${L("x")} + ${kHalf}${L("y")}$`, correct: true },
      {
        label: `$${half}${L("x")} + ${k}${L("y")}$`,
        feedback: `This halves only the $x$ part. The square root is the power $\\frac{1}{2}$ of everything under it, so $y^{${k}}$ becomes $y^{${k}/2}$ too.`,
      },
      {
        label: `$2${L("x")} + ${2 * k}${L("y")}$`,
        feedback: `This treats the square root as squaring. A square root is the power $\\frac{1}{2}$, so it halves the coefficients rather than doubling them.`,
      },
      {
        label: `$${half}${L("x")} \\cdot ${kHalf}${L("y")}$`,
        feedback: `This multiplies the two logs. The log of a product is a sum of logs, not a product of logs.`,
      },
    ],
  };
}

function changeOfBase(r: Rand): Draft {
  const frame = r(0, 3);
  const base = { kind: "fraction" as const, label: "Exact value" };
  if (frame === 0) {
    const b = pick(r, [2, 3, 5]),
      p = pick(r, [2, 3]);
    let q: number;
    do q = r(-3, 6);
    while (q === 0 || q % p === 0 || b ** Math.abs(q) > 729 || b ** p > 125);
    const arg = q > 0 ? `${b ** q}` : `\\frac{1}{${b ** -q}}`;
    return {
      ...base,
      prompt: `What is $\\log_{${b ** p}} ${arg}$?`,
      answer: exact(q, p),
      hint: `Write ${b ** p} and $${arg}$ as powers of one base, then divide: $\\log_{${b ** p}} ${arg} = \\frac{\\log ${arg}}{\\log ${b ** p}}$ in any base.`,
      explanation: [
        `$\\log_{${b ** p}} ${arg}$ asks: ${b ** p} to what power gives $${arg}$? Neither is a simple power of the other, so use a smaller base, ${b}.`,
        `Write both as powers of ${b}: $${b ** p} = ${b}^{${p}}$ and $${arg} = ${b}^{${q}}$.${q < 0 ? ` A negative exponent means "one over".` : ""}`,
        `The change-of-base rule says a log equals a quotient of logs in any one base: $\\log_{${b ** p}} ${arg} = \\frac{\\log_{${b}} ${arg}}{\\log_{${b}} ${b ** p}}$.`,
        `In base ${b} those logs are just the exponents ${q} and ${p}, so the value is $${eqFrac(q, p)}$.`,
        `Check: $${b ** p}^{${ftex(q, p)}} = ${b}^{${q}} = ${arg}$.`,
        `So $\\log_{${b ** p}} ${arg} = ${ftex(q, p)}$.`,
      ],
    };
  }
  if (frame === 1) {
    const a = pick(r, [2, 3, 5]);
    let c: number;
    do c = pick(r, [3, 5, 6, 7, 10, 11]);
    while (c === a);
    const k = a === 5 ? r(2, 4) : r(2, 5);
    return {
      ...base,
      prompt: `What is $\\log_{${a}} ${c} \\cdot \\log_{${c}} ${a ** k}$?`,
      answer: `${k}`,
      hint: `Write each factor as a quotient of logs in one base: $\\frac{\\log ${c}}{\\log ${a}} \\cdot \\frac{\\log ${a ** k}}{\\log ${c}}$. What cancels?`,
      explanation: [
        `The change-of-base rule writes any log as a quotient of logs in one shared base. Here use base 10, written $\\log$ with no base.`,
        `So $\\log_{${a}} ${c} = \\frac{\\log ${c}}{\\log ${a}}$ and $\\log_{${c}} ${a ** k} = \\frac{\\log ${a ** k}}{\\log ${c}}$.`,
        `Multiply the two fractions. $\\log ${c}$ is on top of one and the bottom of the other, so it cancels.`,
        `That leaves $\\frac{\\log ${a ** k}}{\\log ${a}}$, which is $\\log_{${a}} ${a ** k}$ by the same rule read backward.`,
        `$${a}^{${k}} = ${a ** k}$, so the value of the product is ${k}.`,
      ],
    };
  }
  if (frame === 2) {
    const b = pick(r, [2, 3]),
      p = pick(r, [2, 3]),
      m = r(2, 20);
    return {
      ...base,
      prompt: `If $\\log_{${b}} x = ${m}$, what is $\\log_{${b ** p}} x$?`,
      answer: exact(m, p),
      hint: `Change to base ${b}: $\\log_{${b ** p}} x = \\frac{\\log_{${b}} x}{\\log_{${b}} ${b ** p}}$.`,
      explanation: [
        `We know the log of $x$ in base ${b}, so rewrite the new log in base ${b}.`,
        `The change-of-base rule writes a log as a quotient of logs in one base: $\\log_{${b ** p}} x = \\frac{\\log_{${b}} x}{\\log_{${b}} ${b ** p}}$.`,
        `The top is given: $\\log_{${b}} x = ${m}$. The bottom is ${p}, because $${b}^{${p}} = ${b ** p}$.`,
        `So $\\log_{${b ** p}} x = ${eqFrac(m, p)}$.`,
        `The value of $\\log_{${b ** p}} x$ is $${ftex(m, p)}$.`,
      ],
    };
  }
  const b = pick(r, [2, 3, 5, 7]),
    k = b <= 3 ? r(2, 6) : r(2, 3);
  return {
    ...base,
    prompt: `What is $\\frac{\\log ${b ** k}}{\\log ${b}}$?`,
    answer: `${k}`,
    hint: `A quotient of logs in the same base is one logarithm: $\\frac{\\log ${b ** k}}{\\log ${b}} = \\log_{${b}} ${b ** k}$.`,
    explanation: [
      `$\\log$ with no base written means base 10. The change-of-base rule says a quotient of logs in one base is a single log.`,
      `The bottom number becomes the new base: $\\frac{\\log ${b ** k}}{\\log ${b}} = \\log_{${b}} ${b ** k}$.`,
      `$\\log_{${b}} ${b ** k}$ asks: ${b} to what power is ${b ** k}? Multiply ${b} by itself: $${b}^{${k}} = ${b ** k}$.`,
      `So the value of the quotient is ${k}.`,
    ],
  };
}

function logValue(r: Rand): Draft {
  const frame = r(0, 3);
  const base = { kind: "fraction" as const, label: "Exact value" };
  if (frame === 0) {
    const b = pick(r, [2, 3, 4, 5, 10]);
    let k: number;
    do k = r(b === 10 ? 1 : 2, 4);
    while (b ** k > 1000);
    return {
      ...base,
      prompt: `What is $${lg(b)} \\frac{1}{${b ** k}}$?`,
      answer: `${-k}`,
      hint: `$\\frac{1}{${b ** k}}$ is a reciprocal, so the exponent is negative. First write ${b ** k} as a power of ${b}.`,
      explanation: [
        `A logarithm is an exponent. $${lg(b)} \\frac{1}{${b ** k}}$ asks: ${b} to what power gives $\\frac{1}{${b ** k}}$?${b === 10 ? " A log with no base written has base 10." : ""}`,
        `First, $${b ** k} = ${b}^{${k}}$.`,
        `A negative exponent means "one over": $${b}^{-${k}} = \\frac{1}{${b}^{${k}}}$. So $\\frac{1}{${b ** k}} = ${b}^{-${k}}$.`,
        `The logarithm is that exponent. So $${lg(b)} \\frac{1}{${b ** k}} = -${k}$.`,
      ],
    };
  }
  if (frame === 1) {
    const b = pick(r, [2, 3, 5]),
      q = pick(r, [2, 3]);
    let k: number;
    do k = r(1, 4);
    while (k % q === 0 || b ** k > 81);
    const root = q === 2 ? `\\sqrt{${b ** k}}` : `\\sqrt[3]{${b ** k}}`;
    return {
      ...base,
      prompt: `What is $${lg(b)} ${root}$?`,
      answer: exact(k, q),
      hint: `Write the root as a fractional power, and ${b ** k} as a power of ${b}. Then multiply the exponents.`,
      explanation: [
        `A logarithm is an exponent. $${lg(b)} ${root}$ asks: ${b} to what power gives $${root}$?`,
        `First, $${b ** k} = ${b}^{${k}}$${k === 1 ? `, the power 1` : ""}.`,
        `A ${q === 2 ? "square" : "cube"} root is the same as the power $\\frac{1}{${q}}$, because ${q === 2 ? "two" : "three"} equal factors of it multiply back to the number.`,
        `A power of a power multiplies the exponents: $${root} = (${b}^{${k}})^{1/${q}} = ${b}^{${k}/${q}}$.`,
        `So $${lg(b)} ${root} = ${ftex(k, q)}$.`,
      ],
    };
  }
  if (frame === 2) {
    const b = pick(r, [2, 3]),
      k = b === 2 ? pick(r, [2, 3, 4]) : pick(r, [1, 2]),
      at = b ** k;
    return {
      ...base,
      prompt: `The graph shows $y = \\log_{${b}} x$. What is $y$ where the dashed line $x = ${at}$ meets the curve?`,
      figure: scene(logGraph(b, at, b === 2 ? 17 : 10)),
      answer: `${k}`,
      hint: `On this curve, $y$ is the power of ${b} that gives $x$. Ask: ${b} to what power is ${at}?`,
      explanation: [
        `On the graph of $y = \\log_{${b}} x$, each $y$ is the power of ${b} that gives $x$.`,
        `The dashed line meets the curve where $x = ${at}$, so $y = \\log_{${b}} ${at}$.`,
        `Ask: ${b} to what power is ${at}? ${k === 1 ? `${b} to the power 1 is ${b}` : `$${b}^{${k}} = ${at}$`}.`,
        `So the curve meets the dashed line at $y = ${k}$.`,
      ],
    };
  }
  const k = pick(r, [-4, -3, -2, -1, 2, 3, 4, 5, 6]);
  const value = k < 0 ? `0.${"0".repeat(-k - 1)}1` : `1${"0".repeat(k)}`;
  return {
    ...base,
    prompt: `What is $\\log ${value}$?`,
    answer: `${k}`,
    hint: `$\\log$ with no base means base 10. Write ${value} as a power of 10 by counting ${k < 0 ? "the places after the decimal point" : "its zeros"}.`,
    explanation: [
      `$\\log$ with no base written means base 10. So $\\log ${value}$ asks: 10 to what power is ${value}?`,
      k < 0
        ? `${value} has ${-k} places after the decimal point, so it is $\\frac{1}{${10 ** -k}}$.`
        : `${value} is 1 followed by ${k} zeros, so it is ${k} tens multiplied together.`,
      k < 0
        ? `A negative exponent means "one over": $\\frac{1}{${10 ** -k}} = 10^{${k}}$.`
        : `So $${value} = 10^{${k}}$.`,
      `The logarithm is that exponent. So $\\log ${value} = ${s(k)}$.`,
    ],
  };
}

function logForm(r: Rand): Draft {
  const frame = r(0, 2);
  if (frame <= 1) {
    let b: number, p: number;
    do {
      b = pick(r, [2, 3, 4, 5, 10]);
      p = r(2, 4);
    } while (b === p || b ** p > 1000 || p ** b === b ** p);
    const N = b ** p;
    if (frame === 0)
      return {
        prompt: `Which equation means the same as $${lg(b)} ${N} = ${p}$?`,
        hint: `A logarithm is an exponent. In $${lg(b)} ${N} = ${p}$, name the base, the exponent and the result, then write the power.`,
        explanation: [
          `A logarithm is an exponent. $${lg(b)} ${N} = ${p}$ is read "the log base ${b} of ${N} is ${p}". It says ${p} is the power of ${b} that gives ${N}.`,
          `In general $\\log_{b} N = p$ means $b^{p} = N$. The base stays the base, and the logarithm becomes the exponent.`,
          `So $${lg(b)} ${N} = ${p}$ means $${b}^{${p}} = ${N}$.`,
          `The equation with the same meaning is $${b}^{${p}} = ${N}$.`,
        ],
        choices: [
          { label: `$${b}^{${p}} = ${N}$`, correct: true },
          {
            label: `$${p}^{${b}} = ${N}$`,
            feedback: `This swaps the base and the exponent. The base of the logarithm, ${b}, is the base of the power, and the value ${p} is the exponent.`,
          },
          {
            label: `$${N}^{${p}} = ${b}$`,
            feedback: `This uses ${N} as the base. ${N} is the result of the power, the number the logarithm is taken of.`,
          },
          {
            label: `$${b}^{${N}} = ${p}$`,
            feedback: `This swaps the exponent and the result. The logarithm, ${p}, is the exponent, and ${N} is the result.`,
          },
        ],
      };
    return {
      prompt: `Which equation means the same as $${b}^{${p}} = ${N}$?`,
      hint: `In $${b}^{${p}} = ${N}$, the base of the power becomes the base of the logarithm, and the logarithm equals the exponent. Name each part first.`,
      explanation: [
        `A logarithm is an exponent. $\\log_{b} N$ means "the power of $b$ that gives $N$".`,
        `In $${b}^{${p}} = ${N}$, the base is ${b}, the exponent is ${p}, and the result is ${N}.`,
        `In general $b^{p} = N$ means $\\log_{b} N = p$. The base stays the base, and the logarithm equals the exponent.`,
        `So $${b}^{${p}} = ${N}$ means $${lg(b)} ${N} = ${p}$.${b === 10 ? " A log with no base written has base 10." : ""}`,
      ],
      choices: [
        { label: `$${lg(b)} ${N} = ${p}$`, correct: true },
        {
          label: `$\\log_{${p}} ${N} = ${b}$`,
          feedback: `This swaps the base and the exponent. The base of the power, ${b}, is the base of the logarithm, and the exponent ${p} is the value.`,
        },
        {
          label: `$${lg(b)} ${p} = ${N}$`,
          feedback: `This swaps the exponent and the result. The logarithm equals the exponent ${p}, and the number inside it is the result ${N}.`,
        },
        {
          label: `$\\log_{${N}} ${b} = ${p}$`,
          feedback: `This uses ${N} as the base. ${N} is the result of the power, so it goes inside the logarithm, not in its base.`,
        },
      ],
    };
  }
  const b = pick(r, [2, 3, 10]),
    k = b === 10 ? r(1, 3) : b === 3 ? r(1, 4) : r(1, 6);
  let N: number;
  do N = r(b ** k + 1, b ** (k + 1) - 1);
  while (powerOf(b, N) !== undefined);
  const pairs = [k - 1, k, k + 1, k + 2].filter((v) => v >= 0).slice(0, 4);
  while (pairs.length < 4) pairs.push(pairs.at(-1)! + 1);
  return {
    prompt: `Between which two consecutive whole numbers is $${lg(b)} ${N}$?`,
    hint: `List powers of ${b}: ${b}, ${b * b}, ${b ** 3}, … until you pass ${N}. The logarithm lies between the two exponents on either side of ${N}.`,
    explanation: [
      `A logarithm is an exponent. $${lg(b)} ${N}$ is the power of ${b} that gives ${N}.${b === 10 ? " A log with no base written has base 10." : ""}`,
      `${N} is not a whole-number power of ${b}, so find the powers just below and just above it.`,
      `$${b}^{${k}} = ${b ** k}$ and $${b}^{${k + 1}} = ${b ** (k + 1)}$.`,
      `${b ** k} < ${N} < ${b ** (k + 1)}. Bigger powers give bigger results, so the exponent is between ${k} and ${k + 1}.`,
      `So $${lg(b)} ${N}$ is between ${k} and ${k + 1}.`,
    ],
    choices: pairs.map((lo) =>
      lo === k
        ? { label: `${lo} and ${lo + 1}`, correct: true as const }
        : {
            label: `${lo} and ${lo + 1}`,
            feedback: `Check these powers: $${b}^{${lo}} = ${b ** lo}$ and $${b}^{${lo + 1}} = ${b ** (lo + 1)}$. ${N} is not between them, so the logarithm is not between ${lo} and ${lo + 1}.`,
          },
    ),
    keepOrder: true,
  };
}

/** A recursive rule with a decimal ratio; terms are listed until the one asked. */
function decimalRecursion(r: Rand): Draft {
  const ratio = pick(r, [0.5, 1.5, 2.5, -0.5, -1.5, -2.5] as const);
  const k = r(4, 6);
  const a = 2 ** (k - 1) * r(1, 4);
  const terms = Array.from({ length: k }, (_, i) => a * ratio ** i);
  const text = ratio < 0 ? `-${-ratio}` : `${ratio}`;
  return {
    kind: "fraction",
    label: "Exact value",
    prompt: `A sequence has $a_1 = ${a}$ and $a_n = ${text}a_{n-1}$ for $n \\ge 2$. What is $a_{${k}}$?`,
    answer: `${terms.at(-1)}`,
    hint: `Each term is ${text.replace("-", "−")} times the one before. Starting from ${a}, multiply by ${text.replace("-", "−")} once for each step from $a_1$ to $a_{${k}}$, keeping the sign and the decimal.`,
    explanation: [
      `$a_n$ names term number $n$ of the sequence. The rule $a_n = ${text}a_{n-1}$ says each term is ${text.replace("-", "−")} times the term before it.`,
      `Start at $a_1 = ${a}$ and multiply by ${text.replace("-", "−")} each step.${ratio < 0 ? " A negative ratio flips the sign every step." : ""}`,
      `The terms are ${terms.map(s).join(", ")}.`,
      `Check with a power: from $a_1$ to $a_{${k}}$ is ${k - 1} steps, so $a_{${k}} = ${a} \\cdot ${ratio < 0 ? `(${ratio})` : ratio}^{${k - 1}} = ${terms.at(-1)}$.`,
      `So $a_{${k}} = ${terms.at(-1)}$.`,
    ],
  };
}

function sequenceRule(r: Rand, axes: Record<string, string> = {}): Draft {
  const frame = r(0, 3);
  if (axes["number-domain"] === "decimal-ratios") return decimalRecursion(r);
  const base = { kind: "fraction" as const, label: "Exact value" };
  if (frame === 0) {
    const [rn, rd] = pick(r, [
      [2, 1],
      [3, 1],
      [-2, 1],
      [-3, 1],
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 2],
    ] as const);
    const a = rd ** 3 * r(1, 3) * (rd === 1 ? r(1, 4) : 1);
    const terms = [0, 1, 2, 3].map((i) => (a * rn ** i) / rd ** i);
    return {
      ...base,
      prompt:
        "The table shows the first four terms of a geometric sequence. What is its common ratio?",
      figure: scene(
        valueTable(
          "n",
          ["a_n"],
          terms.map((t, i) => [i + 1, t]),
        ).scene({ title: "Terms of a geometric sequence" }),
      ),
      answer: exact(rn, rd),
      hint: `Divide a term by the term before it: ${s(terms[1]!)} ÷ ${paren(terms[0]!)}. Check that ${s(terms[2]!)} ÷ ${paren(terms[1]!)} gives the same.`,
      explanation: [
        `In a geometric sequence each term is the one before times the same number. That number is the common ratio.`,
        `To find it, divide a term by the term before it.`,
        `$\\frac{${terms[1]}}{${terms[0]}} = ${ftex(rn, rd)}$, $\\frac{${terms[2]}}{${terms[1]}} = ${ftex(rn, rd)}$ and $\\frac{${terms[3]}}{${terms[2]}} = ${ftex(rn, rd)}$.`,
        `Every quotient is the same, as it must be. The common ratio is $${ftex(rn, rd)}$.`,
      ],
    };
  }
  if (frame === 1) {
    const [rn, rd] = pick(r, [
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [3, 2],
      [5, 2],
    ] as const);
    const a = rd * rd * r(1, rd === 1 ? 6 : 3),
      third = (a * rn * rn) / (rd * rd);
    return {
      ...base,
      prompt: `The numbers ${a}, ?, ${third} are consecutive terms of a geometric sequence with positive terms. What is the missing term?`,
      answer: `${(a * rn) / rd}`,
      hint: `${third} is ${a} multiplied by the ratio twice, so ${third} ÷ ${a} is the ratio squared. Find the ratio, then multiply ${a} by it once.`,
      explanation: [
        `In a geometric sequence each term is the one before times the same number $r$, the common ratio.`,
        `Going from ${a} to ${third} multiplies by $r$ twice, so $${a} \\cdot r^2 = ${third}$.`,
        `Divide: $r^2 = \\frac{${third}}{${a}} = ${ftex(rn * rn, rd * rd)}$. The terms are positive, so take the positive square root: $r = ${ftex(rn, rd)}$.`,
        `The missing term is one step after ${a}: $${a} \\times ${ftex(rn, rd)} = ${(a * rn) / rd}$.`,
        `The missing term is ${(a * rn) / rd}.`,
      ],
    };
  }
  if (frame === 2) {
    const ratio = pick(r, [2, 3, -2, -3]),
      a = r(1, 6),
      k = r(4, 6);
    const terms = Array.from({ length: k }, (_, i) => a * ratio ** i);
    return {
      ...base,
      prompt: `A sequence has $a_1 = ${a}$ and $a_n = ${ratio}a_{n-1}$ for $n \\ge 2$. What is $a_{${k}}$?`,
      answer: `${terms.at(-1)}`,
      hint: `Each term is ${s(ratio)} times the one before. Start at ${a} and multiply by ${s(ratio)} once for each step from $a_1$ to $a_{${k}}$.`,
      explanation: [
        `$a_n$ names term number $n$. The rule $a_n = ${ratio}a_{n-1}$ says each term is ${s(ratio)} times the term before it.`,
        `Start at $a_1 = ${a}$ and multiply by ${s(ratio)} each step.${ratio < 0 ? " A negative ratio flips the sign every step." : ""}`,
        `The terms are ${terms.map(s).join(", ")}.`,
        `Check with a power: from $a_1$ to $a_{${k}}$ is ${k - 1} steps, so $a_{${k}} = ${a} \\cdot ${ratio < 0 ? `(${ratio})` : ratio}^{${k - 1}} = ${terms.at(-1)}$.`,
        `So $a_{${k}} = ${terms.at(-1)}$.`,
      ],
    };
  }
  const ratio = pick(r, [2, 3, -2]),
    a = r(1, 6);
  return {
    ...base,
    prompt: `A geometric sequence has $a_2 = ${a * ratio}$ and $a_5 = ${a * ratio ** 4}$. What is $a_1$?`,
    answer: `${a}`,
    hint: `From $a_2$ to $a_5$ is three steps, so ${s(a * ratio ** 4)} ÷ ${paren(a * ratio)} is the ratio cubed. Find the ratio, then step back once from $a_2$.`,
    explanation: [
      `In a geometric sequence each term is the one before times the common ratio $r$.`,
      `From $a_2$ to $a_5$ is three steps, so $a_5 = a_2 \\cdot r^3$.`,
      `Divide: $r^3 = \\frac{${a * ratio ** 4}}{${a * ratio}} = ${ratio ** 3}$. The cube root of ${ratio ** 3} is ${ratio}, so $r = ${ratio}$.`,
      `$a_1$ is one step before $a_2$, so divide by $r$: $a_1 = \\frac{${a * ratio}}{${ratio}} = ${a}$.`,
      `So $a_1 = ${a}$.`,
    ],
  };
}

const generators: Record<
  string,
  (r: Rand, axes?: Record<string, string>) => Draft
> = {
  "exponential-model-value": modelValue,
  "exponential-model-rule": modelRule,
  "linear-or-exponential": linearOrExponential,
  "exponential-overtakes": overtakes,
  "same-base-equation": sameBase,
  "exponential-log-solution": logSolution,
  "log-equation": logEquation,
  "geometric-series-sum": seriesSum,
  "log-rules-evaluate": logRules,
  "log-expand": logExpand,
  "change-of-base": changeOfBase,
  "logarithm-value": logValue,
  "log-exponential-form": logForm,
  "geometric-sequence-rule": sequenceRule,
};

export function generateExponentialProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = exponentialTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown exponential template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const axes = (
    exponentialAxes as Record<
      string,
      Record<string, ReturnType<typeof defineAxis>>
    >
  )[templateId];
  return axes
    ? generateWithAxes(templateId, seed, axes, (values) =>
        exponentialProblem(templateId, seed, meta, values),
      )
    : exponentialProblem(templateId, seed, meta, {});
}
function exponentialProblem(
  templateId: string,
  seed: string,
  meta: TemplateMetadata,
  axes: Record<string, string>,
): GeneratedProblem {
  const r = random(templateId, seed);
  const d = generators[templateId]!(r, axes);
  let answer = d.answer ?? "";
  let response: GeneratedProblem["public"]["response"] = {
    kind: d.kind ?? "number",
    label: d.label ?? "Answer",
  };
  let choiceFeedback: Record<string, string> | undefined;
  if (d.choices) {
    const choices = [...d.choices];
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error(`Ambiguous choices: ${templateId}/${seed}`);
    if (!d.keepOrder) shuffle(r, choices);
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: "Choose one answer",
      options: choices.map((c, i) => {
        const id = `option-${"abcd"[i]}`;
        if (c.correct) answer = id;
        else choiceFeedback![id] = c.feedback!;
        return { id, label: c.label };
      }),
    };
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt: d.prompt,
      skillId: meta.skillId,
      response,
      ...(d.figure ? { figure: d.figure } : {}),
    },
    answer,
    hint: d.hint,
    explanation: d.explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}
