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
} from "./exponential-scenes.js";
import { table } from "./scene/author.js";

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
    "Choose y = a·bˣ from a table, a graph through marked points, or a growth or decay story.",
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
function modelValue(r: Rand): Draft {
  const frame = r(0, 3);
  if (frame === 0) {
    const b = pick(r, [2, 3]),
      a = r(2, 6),
      k = b === 2 ? r(5, 7) : r(5, 6);
    const xs = [0, 1, 2, 3],
      ys = xs.map((x) => a * b ** x);
    return {
      prompt: `The table shows an exponential function. If the pattern continues, what is $y$ when $x = ${k}$?`,
      figure: scene(stepTable(xs, ys.map(String), `×${b}`)),
      answer: `${a * b ** k}`,
      hint: `Each row multiplies $y$ by ${b}. From $x = 3$, where $y = ${ys[3]}$, keep multiplying by ${b} until $x = ${k}$.`,
      explanation: [
        `Each time $x$ increases by 1, $y$ is multiplied by ${b}, starting from $y = ${a}$ at $x = 0$. So $y = ${a} \\cdot ${b}^{x}$.`,
        `At $x = ${k}$: $${a} \\cdot ${b}^{${k}} = ${a} \\times ${b ** k} = ${a * b ** k}$.`,
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
        `A ${p}% increase multiplies by $1 + ${p / 100} = ${f}$ each year.`,
        `After ${t} years: $${start} \\times ${f}^{${t}} = ${end}$.`,
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
        `${h * t} ÷ ${h} = ${t}, so the amount halves ${words[t]} times.`,
        `$${m} \\times \\left(\\frac{1}{2}\\right)^{${t}} = \\frac{${m}}{${2 ** t}} = ${m / 2 ** t}$ mg.`,
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
      `$f(${t}) = ${a} \\cdot ${base}^{${t}}$, and $${base}^{${t}} = ${ftex(bn ** t, bd ** t)}$.`,
      `$${a} \\times ${ftex(bn ** t, bd ** t)} = ${value}$.`,
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
          ? table(["x", "y"], xs.map((x, i) => [x, ys[i]!]), {
              headerFont: "math",
            }).scene({ title: "Table of y against x" })
          : exponentialGraph(a, b, [0, 1, 2]),
      ),
      hint: `At $x = 0$ the equation must give ${a}. Then compare $y = ${ys[1]}$ at $x = 1$ with $y = ${ys[2]}$ at $x = 2$: is that an added amount or a factor?`,
      explanation: [
        `At $x = 0$, $y = ${a}$, so the starting value is ${a}.`,
        `Each step in $x$ multiplies $y$ by ${b}: ${ys
          .slice(0, frame === 0 ? 4 : 3)
          .join(", ")}.`,
        `So ${eq(a, b)}.`,
      ],
      choices: [
        { label: eq(a, b), correct: true },
        {
          label: eq(b, a),
          feedback: `This swaps the numbers. At $x = 0$ it gives ${b}, but $y$ starts at ${a}; ${b} is the repeated factor.`,
        },
        {
          label: `$y = ${d}x + ${a}$`,
          feedback: `This line adds ${d} each step. It fits $x = 0$ and $x = 1$, but from $x = 1$ to $x = 2$, $y$ is multiplied by ${b}, not increased by ${d}.`,
        },
        {
          label: eq(a * b, b),
          feedback: `At $x = 0$ this gives ${a * b}, the value at $x = 1$. The starting value is ${a}.`,
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
        `At $x = 0$ there are ${a} thousand cells, so the starting value is ${a}.`,
        `Each hour multiplies the count by ${b}, so after $x$ hours it has been multiplied by $${b}^{x}$.`,
        `${eq(a, b)}.`,
      ],
      choices: [
        { label: eq(a, b), correct: true },
        {
          label: eq(b, a),
          feedback: `At $x = 0$ this gives ${b} thousand, but the colony starts at ${a} thousand.`,
        },
        {
          label: `$y = ${a} + ${b}x$`,
          feedback: `This adds ${b} thousand cells each hour. The colony ${verb}: it is multiplied, not increased by a fixed amount.`,
        },
        {
          label: `$y = ${a}x^{${b}}$`,
          feedback: `Here the hours are the base. In repeated multiplication the number of hours is the exponent.`,
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
      `Losing ${p}% keeps $100\\% - ${p}\\% = ${100 - p}\\%$ each year, a factor of ${keep}.`,
      `Starting from ${shown}: $y = ${value} \\cdot ${keep}^{x}$.`,
    ],
    choices: [
      { label: eq(value, keep), correct: true },
      {
        label: eq(value, lose),
        feedback: `A factor of ${lose} keeps only ${p}% each year. The car loses ${p}%, so it keeps ${100 - p}%.`,
      },
      {
        label: eq(value, grow),
        feedback: `A factor of ${grow} grows the value by ${p}% each year. A loss multiplies by less than 1.`,
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
        table(["x", "y"], xs.map((x, i) => [x, ys[i]!]), {
          headerFont: "math",
        }).scene({ title: "Table of y against x" }),
      ),
      hint: `The $x$-values go up by ${dx} each row. Find how $y$ changes from ${ys[0]} to ${ys[1]} and from ${ys[1]} to ${ys[2]}: compare the differences, then the ratios.`,
      explanation: [
        `Differences in $y$: ${d.map(s).join(", ")}.`,
        kind === "linear"
          ? `Every difference is ${s(d[0]!)} for equal steps in $x$, so the function is linear.`
          : kind === "exponential"
            ? `The differences change, but each $y$ is ${ys[1]! > ys[0]! ? `${ys[1]! / ys[0]!} times` : `1/${ys[0]! / ys[1]!} of`} the one before: equal ratios, so the function is exponential.`
            : `The differences change, and so do the ratios (${ys[1]}/${ys[0]} is not ${ys[2]}/${ys[1]}), so it is neither linear nor exponential.`,
      ],
      choices: kindChoices(kind, {
        linear: `The differences are ${d.map(s).join(", ")}: not all equal, so it is not linear.`,
        exponential: `Equal ratios would mean ${ys[1]}/${ys[0]} = ${ys[2]}/${ys[1]}, which is false here.`,
        neither: `Check again: the ${kind === "linear" ? "differences are all equal" : "ratios are all equal"}.`,
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
      kind === "linear"
        ? `The same ${plant ? `${step} cm` : `${step} dollars`} is added each ${period}: a constant difference, so the model is linear.`
        : kind === "exponential"
          ? `A ${pct}% increase multiplies by ${factor(pct)} each ${period}: a constant ratio, so the model is exponential.`
          : `The amount added grows by the same step each ${period}, so neither the differences nor the ratios are constant. The model is neither linear nor exponential.`,
    ],
    choices: kindChoices(kind, {
      linear:
        kind === "exponential"
          ? `${pct}% of a growing amount is more each ${period}, so the increase is not the same.`
          : `The amount added changes each ${period}, so the differences are not equal.`,
      exponential:
        kind === "linear"
          ? `The same amount is added each ${period}; that is an equal difference, not an equal factor.`
          : `The ${period}ly increases go up by a fixed step, which does not multiply ${what} by one factor.`,
      neither: `Look at the change each ${period}: it ${kind === "linear" ? "adds the same amount" : "multiplies by the same factor"}.`,
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
    `Compare $f(x) = ${m}x + ${c}$ with $g(x) = ${b}^{x}$ at each whole $x$.`,
    `At $x = ${X - 1}$: $f = ${m * (X - 1) + c}$ and $g = ${b ** (X - 1)}$, so $g$ is not yet greater.`,
    `At $x = ${X}$: $f = ${m * X + c}$ and $g = ${b ** X}$, so $g > f$ for the first time. Past this point $g$ multiplies while $f$ only adds ${m}, so $g$ stays ahead.`,
  ];
  if (frame === 0)
    return {
      prompt: `The graph shows $f(x) = ${m}x + ${c}$ and $g(x) = ${b}^{x}$. What is the least whole number $x$ for which $g(x) > f(x)$?`,
      figure: scene(raceGraph(m, c, b, X + 1)),
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
        ),
      ),
      answer: `${X}`,
      hint: `Continue both patterns past day 3: Offer A adds ${m} to its ${c + 3 * m} coins each day, and Offer B doubles its 8 coins each day. Compare the totals day by day.`,
      explanation: [
        `On day $d$, Offer A has $${c} + ${m}d$ coins and Offer B has $2^{d}$.`,
        `Day ${X - 1}: Offer A has ${c + m * (X - 1)} and Offer B has ${2 ** (X - 1)}, so B is not yet ahead.`,
        `Day ${X}: Offer A has ${c + m * X} and Offer B has ${2 ** X}, so B is ahead for the first time. After that B doubles while A adds only ${m}, so B stays ahead.`,
      ],
    };
  const xs = [0, 1, 2, 3];
  return {
    prompt:
      "The table shows $f(x)$, which adds the same amount each step, and $g(x)$, which multiplies by the same factor. If both patterns continue, what is the least whole number $x$ for which $g(x) > f(x)$?",
    figure: scene(
      table(
        [
          { text: "x", font: "math" },
          { text: "f(x)", font: "math" },
          { text: "g(x)", font: "math" },
        ],
        xs.map((x) => [x, m * x + c, 2 ** x]),
      )
        .steps(1, [`+${m}`, `+${m}`, `+${m}`])
        .steps(2, ["×2", "×2", "×2"], "warm")
        .scene({ title: "Values of f and g" }),
    ),
    answer: `${X}`,
    hint: `$f$ adds ${m} each step from ${c + 3 * m}, and $g$ doubles from 8. Extend both columns one row at a time.`,
    explanation: [
      `From the table, $f(x) = ${m}x + ${c}$ and $g(x) = 2^{x}$.`,
      ...steps.slice(1),
    ],
  };
}

function sameBase(r: Rand): Draft {
  const frame = r(0, 3);
  const base = { kind: "fraction" as const, label: "Exact value of x" };
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
        `$${b ** n} = ${b}^{${n}}$, so $${b}^{${side}} = ${b}^{${n}}$.`,
        `Equal powers of the same base have equal exponents: $${side} = ${n}$.`,
        `$x = ${s(n - c)}$.`,
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
        `$${b ** p} = ${b}^{${p}}$ and $${b ** q} = ${b}^{${q}}$, so $${b}^{${p}x} = ${b}^{${q}}$.`,
        `Set the exponents equal: $${p}x = ${q}$.`,
        `$x = ${ftex(q, p)}$.`,
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
        `$\\frac{1}{${b ** n}} = ${b}^{-${n}}$.`,
        `Set the exponents equal: $${k}x - ${c} = -${n}$, so $${k}x = ${s(c - n)}$.`,
        `$x = ${ftex(c - n, k)}$.`,
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
      `$${b ** p} = ${b}^{${p}}$ and $${b ** q} = ${b}^{${q}}$, so $${b}^{${p}(x + 1)} = ${b}^{${q}x}$.`,
      `Set the exponents equal: $${p}x + ${p} = ${q}x$, so $${q - p === 1 ? "" : q - p}x = ${p}$.`,
      `$x = ${ftex(p, q - p)}$.`,
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
        `Divide by ${a}: $${b}^{x} = ${k}$.`,
        `A logarithm names that exponent: $x = ${lg(b)} ${k}$.`,
      ],
      choices: [
        { label: `$x = ${lg(b)} ${k}$`, correct: true },
        {
          label: `$x = \\log_{${k}} ${b}$`,
          feedback: `This asks for the power of ${k} that gives ${b}. The base of the power is ${b}, so the base of the logarithm is ${b}.`,
        },
        {
          label: `$x = ${lg(b)} ${c - a}$`,
          feedback: `${a} multiplies the power, so divide by it; subtracting ${a} does not undo multiplication.`,
        },
        {
          label: `$x = \\frac{${lg(b)} ${c}}{${a}}$`,
          feedback: `Divide by ${a} before taking the logarithm. The log of a product is a sum, so ${a} cannot be divided out of $${lg(b)} ${c}$ afterward.`,
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
        `By the definition of a logarithm, $x + ${h} = ${lg(b)} ${k}$.`,
        `Subtract ${h}: $x = ${lg(b)} ${k} - ${h}$.`,
      ],
      choices: [
        { label: `$x = ${lg(b)} ${k} - ${h}$`, correct: true },
        {
          label: `$x = ${lg(b)} (${k} - ${h})$`,
          feedback: `The ${h} is part of the exponent, not of ${k}. Take the logarithm first, then subtract ${h}.`,
        },
        {
          label: `$x = ${lg(b)} ${k} + ${h}$`,
          feedback: `$x + ${h}$ equals the logarithm, so undo the + ${h} by subtracting.`,
        },
        {
          label: `$x = \\log_{${k}} ${b} - ${h}$`,
          feedback: `The base of the power, ${b}, is the base of the logarithm.`,
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
        `$\\ln$ undoes $e$: $${rate}t = \\ln ${k}$.`,
        `Divide by ${rate}: $t = \\frac{\\ln ${k}}{${rate}}$.`,
      ],
      choices: [
        { label: `$t = \\frac{\\ln ${k}}{${rate}}$`, correct: true },
        {
          label: `$t = \\ln \\frac{${k}}{${rate}}$`,
          feedback: `Divide by ${rate} after taking the logarithm: $${rate}t = \\ln ${k}$.`,
        },
        {
          label: `$t = ${rate}\\ln ${k}$`,
          feedback: `$${rate}t = \\ln ${k}$, so $t$ is $\\ln ${k}$ divided by ${rate}, not multiplied.`,
        },
        {
          label: `$t = \\frac{${k}}{${rate}e}$`,
          feedback: `$e$ is the base of the power. Undo it with $\\ln$; dividing by $e$ does not undo an exponent.`,
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
      `Set $B \\cdot ${f}^{t} = 2B$ and divide by $B$: $${f}^{t} = 2$.`,
      `The exponent that turns ${f} into 2 is $t = \\log_{${f}} 2$, about ${(Math.log(2) / Math.log(1 + pct / 100)).toFixed(1)} years.`,
    ],
    choices: [
      { label: `$\\log_{${f}} 2$`, correct: true },
      {
        label: `$\\log_{2} ${f}$`,
        feedback: `This is the power of 2 that gives ${f}. The repeated factor ${f} is the base.`,
      },
      {
        label: `$\\frac{2}{${f}}$`,
        feedback: `$t$ is an exponent, so solving for it needs a logarithm, not a quotient.`,
      },
      {
        label: `$\\frac{\\log 2}{${rate}}$`,
        feedback: `The yearly factor is ${f}, not ${rate}; this quotient also does not undo the power.`,
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
        `$${lg(b)}(${arg}) = ${n}$ means $${arg} = ${b}^{${n}} = ${b ** n}$.`,
        `$x = ${b ** n} ${c > 0 ? "-" : "+"} ${Math.abs(c)} = ${s(b ** n - c)}$, and $${arg} = ${b ** n} > 0$, so the logarithm is defined.`,
      ],
    };
  }
  if (frame === 1) {
    const options: [number, number, number, number][] = [];
    for (const b of [2, 3, 5, 6, 10])
      for (let n = 1; b ** n <= 1000; n++)
        for (let x = 1; x * x < b ** n; x++)
          if ((b ** n) % x === 0 && b ** n / x - x <= 24)
            options.push([b, n, x, b ** n / x - x]);
    const [b, n, x, d] = pick(r, options);
    const other = -(x + d);
    return {
      prompt: `Solve $${lg(b)} x + ${lg(b)}(x + ${d}) = ${n}$.`,
      answer: `${x}`,
      hint: `Combine the logs into one: $${lg(b)} \\big(x(x + ${d})\\big) = ${n}$, so $x(x + ${d}) = ${b}^{${n}}$. Keep only a solution that makes both logarithms defined.`,
      explanation: [
        `The sum of logs is the log of the product: $x(x + ${d}) = ${b}^{${n}} = ${b ** n}$.`,
        `$x^2 + ${d}x - ${b ** n} = 0$ factors as $(x - ${x})(x + ${x + d}) = 0$, so $x = ${x}$ or $x = ${s(other)}$.`,
        `$${lg(b)} x$ needs $x > 0$, so $x = ${s(other)}$ is rejected. The solution is $x = ${x}$.`,
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
      `The difference of logs is the log of the quotient: $\\frac{x}{x - ${d}} = ${b ** n}$.`,
      `$x = ${b ** n}(x - ${d})$, so $${b ** n - 1}x = ${b ** n * d}$ and $x = ${m * b ** n}$.`,
      `Check the domain: $x = ${m * b ** n}$ and $x - ${d} = ${m}$ are both positive, so both logarithms are defined.`,
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
      `There are ${n} terms, the first is ${a} and the ratio is ${b}.`,
      `$S_{${n}} = \\frac{${a}(${b}^{${n}} - 1)}{${b} - 1} = \\frac{${a} \\times ${b ** n - 1}}{${b - 1}} = ${total}$.`,
    ];
    if (frame === 0)
      return {
        prompt: `Find the sum $${terms.slice(0, 3).join(" + ")} + \\cdots + ${terms.at(-1)}$.`,
        answer: `${total}`,
        hint: `Each term is ${b} times the one before. Count the terms from ${a} to ${terms.at(-1)} first; then use $${grows}$.`,
        explanation: steps,
      };
    if (frame === 2)
      return {
        prompt: `What is $\\sum_{k=1}^{${n}} ${a === 1 ? "" : `${a} \\cdot `}${b}^{k-1}$?`,
        answer: `${total}`,
        hint: `The sum has ${n} terms. $k = 1$ gives ${a}, and each next term multiplies by ${b}.`,
        explanation: [`The terms are ${terms.join(", ")}.`, ...steps],
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
      explanation: steps,
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
      `$r^{${n}} = ${ftex(rn ** n, rd ** n)}$.`,
      `$S_{${n}} = \\frac{${a}\\left(1 - ${ftex(rn ** n, rd ** n)}\\right)}{1 - ${ratio}} = ${ftex(tn, td)}$.`,
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
            (b ** k) % m === 0 &&
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
        `Product rule: $${lg(b)} ${m} + ${lg(b)} ${n} = ${lg(b)} (${m} \\cdot ${n}) = ${lg(b)} ${m * n}$.`,
        `$${m * n} = ${b}^{${k}}$, so the value is ${k}.`,
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
        `Quotient rule: $${lg(b)} ${p} - ${lg(b)} ${q} = ${lg(b)} ${ftex(p, q)}$.`,
        `$${ftex(p, q)} = ${b}^{${flip ? -k : k}}$, so the value is ${s(flip ? -k : k)}.`,
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
      `Power rule: $${p}${lg(b)} ${m} = ${lg(b)} ${m}^{${p}} = ${lg(b)} ${m ** p}$.`,
      `Quotient rule: $${lg(b)} ${m ** p} - ${lg(b)} ${c ** p} = ${lg(b)} ${(m ** p) / c ** p}$.`,
      `$${(m ** p) / c ** p} = ${b}^{${p * j}}$, so the value is ${p * j}.`,
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
        `Quotient rule: $${lg(b)} (x^{${p}}y) - ${lg(b)} z^{${q}}$.`,
        `Product rule: $${lg(b)} x^{${p}} + ${L("y")} - ${lg(b)} z^{${q}}$.`,
        `Power rule: $${p}${L("x")} + ${L("y")} - ${q}${L("z")}$.`,
      ],
      choices: [
        {
          label: `$${p}${L("x")} + ${L("y")} - ${q}${L("z")}$`,
          correct: true,
        },
        {
          label: `$${p}${L("x")} + ${L("y")} + ${q}${L("z")}$`,
          feedback: `$z^{${q}}$ is in the denominator. Dividing subtracts its logarithm.`,
        },
        {
          label: `$${p}(${L("x")} + ${L("y")}) - ${q}${L("z")}$`,
          feedback: `The exponent ${p} belongs to $x$ only, so it multiplies $${L("x")}$ alone.`,
        },
        {
          label: `$${Lp(`${p}x`)} + ${L("y")} - ${Lp(`${q}z`)}$`,
          feedback: `An exponent comes out as a coefficient in front of the log; it does not become a factor inside it.`,
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
        `Power rule: $${lg(b)} x^{${p}} - ${lg(b)} y^{${q}} + ${L("z")}$.`,
        `Sums multiply and differences divide: $${lg(b)} \\dfrac{x^{${p}}z}{y^{${q}}}$.`,
      ],
      choices: [
        { label: `$${lg(b)} \\dfrac{x^{${p}}z}{y^{${q}}}$`, correct: true },
        {
          label: `$${lg(b)} (x^{${p}}y^{${q}}z)$`,
          feedback: `$${q}${L("y")}$ is subtracted, so $y^{${q}}$ divides rather than multiplies.`,
        },
        {
          label: `$${lg(b)} \\dfrac{${p}xz}{${q}y}$`,
          feedback: `A coefficient in front of a log becomes an exponent inside it, not a factor.`,
        },
        {
          label: `$\\dfrac{${lg(b)} (x^{${p}}z)}{${lg(b)} y^{${q}}}$`,
          feedback: `A difference of logs is the log of a quotient, not a quotient of logs.`,
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
      `$\\sqrt{xy^{${k}}} = (xy^{${k}})^{1/2} = x^{1/2}y^{${k}/2}$.`,
      `Product and power rules: $${coef(half)}${L("x")} + ${kHalf}${L("y")}$.`,
    ],
    choices: [
      { label: `$${half}${L("x")} + ${kHalf}${L("y")}$`, correct: true },
      {
        label: `$${half}${L("x")} + ${k}${L("y")}$`,
        feedback: `The square root halves every factor under it, $y^{${k}}$ included.`,
      },
      {
        label: `$2${L("x")} + ${2 * k}${L("y")}$`,
        feedback: `A square root is the power $\\frac{1}{2}$, so it halves the coefficients rather than doubling them.`,
      },
      {
        label: `$${half}${L("x")} \\cdot ${kHalf}${L("y")}$`,
        feedback: `The log of a product is a sum of logs, not a product.`,
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
        `$${b ** p} = ${b}^{${p}}$ and $${arg} = ${b}^{${q}}$.`,
        `$\\log_{${b ** p}} ${arg} = \\frac{\\log_{${b}} ${arg}}{\\log_{${b}} ${b ** p}} = ${eqFrac(q, p)}$.`,
        `Check: $${b ** p}^{${ftex(q, p)}} = ${b}^{${q}} = ${arg}$.`,
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
        `Change of base: $\\log_{${a}} ${c} = \\frac{\\log ${c}}{\\log ${a}}$ and $\\log_{${c}} ${a ** k} = \\frac{\\log ${a ** k}}{\\log ${c}}$.`,
        `$\\log ${c}$ cancels, leaving $\\frac{\\log ${a ** k}}{\\log ${a}} = \\log_{${a}} ${a ** k} = ${k}$.`,
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
        `$\\log_{${b ** p}} x = \\frac{\\log_{${b}} x}{\\log_{${b}} ${b ** p}}$, and $\\log_{${b}} ${b ** p} = ${p}$.`,
        `So $\\log_{${b ** p}} x = ${eqFrac(m, p)}$.`,
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
      `Change of base, read backward: $\\frac{\\log ${b ** k}}{\\log ${b}} = \\log_{${b}} ${b ** k}$.`,
      `$${b ** k} = ${b}^{${k}}$, so the value is ${k}.`,
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
        `$${b ** k} = ${b}^{${k}}$, so $\\frac{1}{${b ** k}} = ${b}^{-${k}}$.`,
        `The logarithm is that exponent: $${lg(b)} \\frac{1}{${b ** k}} = -${k}$.`,
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
        `$${b ** k} = ${b}^{${k}}$, and a ${q === 2 ? "square" : "cube"} root is the power $\\frac{1}{${q}}$.`,
        `$${root} = ${b}^{${k}/${q}}$, so the logarithm is $${ftex(k, q)}$.`,
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
        `The point on the curve has $y = \\log_{${b}} ${at}$.`,
        `$${b}^{${k}} = ${at}$, so $y = ${k}$.`,
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
      `$${value} = 10^{${k}}$.`,
      `So $\\log ${value} = ${s(k)}$.`,
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
          `$\\log_{b} N = p$ means $b^{p} = N$: the base stays the base, and the logarithm is the exponent.`,
          `So $${lg(b)} ${N} = ${p}$ means $${b}^{${p}} = ${N}$.`,
        ],
        choices: [
          { label: `$${b}^{${p}} = ${N}$`, correct: true },
          {
            label: `$${p}^{${b}} = ${N}$`,
            feedback: `The base of the logarithm, ${b}, is the base of the power; the value ${p} is the exponent.`,
          },
          {
            label: `$${N}^{${p}} = ${b}$`,
            feedback: `${N} is the result of the power, not its base.`,
          },
          {
            label: `$${b}^{${N}} = ${p}$`,
            feedback: `The logarithm, ${p}, is the exponent, and ${N} is the result.`,
          },
        ],
      };
    return {
      prompt: `Which equation means the same as $${b}^{${p}} = ${N}$?`,
      hint: `In $${b}^{${p}} = ${N}$, the base of the power becomes the base of the logarithm, and the logarithm equals the exponent. Name each part first.`,
      explanation: [
        `$b^{p} = N$ means $\\log_{b} N = p$: the logarithm is the exponent.`,
        `So $${b}^{${p}} = ${N}$ means $${lg(b)} ${N} = ${p}$.`,
      ],
      choices: [
        { label: `$${lg(b)} ${N} = ${p}$`, correct: true },
        {
          label: `$\\log_{${p}} ${N} = ${b}$`,
          feedback: `The base of the power, ${b}, is the base of the logarithm.`,
        },
        {
          label: `$${lg(b)} ${p} = ${N}$`,
          feedback: `The logarithm equals the exponent ${p}, and its argument is the result ${N}.`,
        },
        {
          label: `$\\log_{${N}} ${b} = ${p}$`,
          feedback: `${N} is the result of the power, so it goes inside the logarithm, not in its base.`,
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
      `$${b}^{${k}} = ${b ** k}$ and $${b}^{${k + 1}} = ${b ** (k + 1)}$.`,
      `${b ** k} < ${N} < ${b ** (k + 1)}, so $${lg(b)} ${N}$ is between ${k} and ${k + 1}.`,
    ],
    choices: pairs.map((lo) =>
      lo === k
        ? { label: `${lo} and ${lo + 1}`, correct: true as const }
        : {
            label: `${lo} and ${lo + 1}`,
            feedback: `$${b}^{${lo}} = ${b ** lo}$ and $${b}^{${lo + 1}} = ${b ** (lo + 1)}$; ${N} is not between them.`,
          },
    ),
    keepOrder: true,
  };
}

function sequenceRule(r: Rand): Draft {
  const frame = r(0, 3);
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
        table(
          [
            { text: "n", font: "math" },
            { text: "a_n", font: "math" },
          ],
          terms.map((t, i) => [i + 1, t]),
        ).scene({ title: "Terms of a geometric sequence" }),
      ),
      answer: exact(rn, rd),
      hint: `Divide a term by the term before it: ${s(terms[1]!)} ÷ ${paren(terms[0]!)}. Check that ${s(terms[2]!)} ÷ ${paren(terms[1]!)} gives the same.`,
      explanation: [
        `$\\frac{${terms[1]}}{${terms[0]}} = ${ftex(rn, rd)}$, $\\frac{${terms[2]}}{${terms[1]}} = ${ftex(rn, rd)}$ and $\\frac{${terms[3]}}{${terms[2]}} = ${ftex(rn, rd)}$.`,
        `Every term is $${ftex(rn, rd)}$ times the one before, so the common ratio is $${ftex(rn, rd)}$.`,
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
        `$\\frac{${third}}{${a}} = ${ftex(rn * rn, rd * rd)} = r^2$, so $r = ${ftex(rn, rd)}$ (the terms are positive).`,
        `The missing term is $${a} \\times ${ftex(rn, rd)} = ${(a * rn) / rd}$.`,
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
        `The terms are ${terms.map(s).join(", ")}.`,
        `Equivalently, $a_{${k}} = ${a} \\cdot ${ratio < 0 ? `(${ratio})` : ratio}^{${k - 1}} = ${terms.at(-1)}$.`,
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
      `$r^3 = \\frac{${a * ratio ** 4}}{${a * ratio}} = ${ratio ** 3}$, so $r = ${ratio}$.`,
      `$a_1 = \\frac{a_2}{r} = \\frac{${a * ratio}}{${ratio}} = ${a}$.`,
    ],
  };
}

const generators: Record<string, (r: Rand) => Draft> = {
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
  const r = random(templateId, seed);
  const d = generators[templateId]!(r);
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
