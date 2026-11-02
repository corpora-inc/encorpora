import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  decimalText,
  dispatch,
  numberSurface,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { table } from "./scene/author";
import { frac, roundText } from "./regents-kit";
import { sgn } from "./regents-algebra-one-kit";

type R = (lo: number, hi: number) => number;
const meta = (
  m: Omit<TemplateMetadata, "version" | "gradeBand">,
): TemplateMetadata => ({ version: 1, gradeBand: "9–12", ...m });
const fail = () => {
  throw new Error("Need three retries");
};

export const exponentialInitialValueTemplate = meta({
  id: "exponential-initial-value",
  title: "Read the starting value of an exponential model",
  skillId: "exponential-models",
  difficultyOffset: 0.3,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the initial value of an exponential growth or decay model written with a factor, with a percent rate, or with a shifted exponent such as $t+2$.",
});
export const exponentialDecayTableTemplate = meta({
  id: "exponential-decay-table",
  title: "Choose the table of values that shows exponential decay",
  skillId: "growth-comparison",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose which list of values for equally spaced inputs has a constant ratio less than 1, among exponential growth, linear decrease, an accelerating decrease and linear increase.",
});
export const exponentialPassesLinearTemplate = meta({
  id: "exponential-passes-linear",
  title:
    "Find the first whole input where an exponential exceeds a linear function",
  skillId: "growth-comparison",
  difficultyOffset: 0.5,
  description:
    "For an exponential function with a decimal base and a linear function given by their rules, find the least whole number input at which the exponential is greater.",
});
export const twoWayShareTemplate = meta({
  id: "two-way-share",
  title: "Find a conditional or joint percent from a two-way frequency table",
  skillId: "categorical-association",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "From a two-way table of counts, find the percent in one row, one column, or one cell of all, rounded to the nearest percent, and choose among percents that use other denominators.",
});
export const quartileListTemplate = meta({
  id: "quartile-list",
  title: "Find the upper or lower quartile of a listed data set",
  skillId: "signed-data-summaries",
  difficultyOffset: 0.35,
  description:
    "Order a listed set of 8, 10 or 12 whole numbers with repeats, split it at the median, and find the median of the upper or lower half.",
});
export const averageRateTableTemplate = meta({
  id: "average-rate-table-rounded",
  title: "Average rate of change from a table, rounded",
  skillId: "average-rate-change",
  difficultyOffset: 0.5,
  description:
    "From a table with unevenly spaced inputs, find the average rate of change over a stated interval and round it to a whole number or to a tenth.",
});
export const correlationCausationTemplate = meta({
  id: "correlation-causation-choice",
  title: "Decide the correlation and whether it shows causation",
  skillId: "causal-claims",
  difficultyOffset: 0.3,
  requiredResponseCapability: "single-choice-v1",
  description:
    "For a described relationship between two quantities, decide whether the correlation is positive or negative and whether one quantity causes the other, from four combined choices.",
});
export const budgetWholeItemsTemplate = meta({
  id: "budget-whole-items",
  title:
    "Greatest whole number of items that fit a budget after a fixed expense",
  skillId: "linear-inequalities",
  difficultyOffset: 0.4,
  description:
    "Subtract a fixed expense from a budget, divide by a per-item price in dollars and cents, and give the greatest whole number of items that can be bought.",
});
export const absEqualsLinearTemplate = meta({
  id: "abs-equals-linear-unique",
  title:
    "Find where an absolute-value function equals a steeper linear function",
  skillId: "absolute-value-equations",
  difficultyOffset: 0.5,
  description:
    "Solve $k|x-a|+b=cx+d$ with $|c|>k$ by splitting into two cases, checking each solution against the equation, and giving the one that works.",
});

/* ------------------------------------------------ initial value */
const initAxes = {
  form: defineAxis("form", [
    "factor",
    "percent-rate",
    "shifted-exponent",
  ] as const),
};
/** a(b) or a·b, so a whole-number base is not parenthesized. */
const powTerm = (a: number, b: string) =>
  b.includes(".") ? `${a}(${b})` : `${a}\\cdot${b}`;
const growthBodies = [
  { noun: "population of a town", unit: "people", name: "P", time: "years" },
  { noun: "value of an investment", unit: "dollars", name: "V", time: "years" },
  {
    noun: "number of members of a club",
    unit: "members",
    name: "M",
    time: "years",
  },
] as const;
const decayBodies = [
  {
    noun: "amount of medicine in a patient's blood",
    unit: "milligrams",
    name: "A",
    time: "hours",
  },
  {
    noun: "value of a delivery van",
    unit: "dollars",
    name: "V",
    time: "years",
  },
  {
    noun: "amount of a chemical in a pond",
    unit: "grams",
    name: "C",
    time: "days",
  },
] as const;
interface InitModel {
  a: number;
  decay: boolean;
  b: [number, number]; // factor numerator / denominator
  k: number;
  body: number;
  rate: [number, number];
}
function initModel(r: R, ax: { form: string }): InitModel {
  const decay = r(0, 1) === 1;
  const a = pick(r, [
    20, 25, 40, 50, 80, 100, 120, 150, 200, 250, 400,
  ] as const);
  if (ax.form === "shifted-exponent") {
    const k = r(1, 3);
    const b: [number, number] = decay
      ? [1, 2]
      : pick(r, [
          [2, 1],
          [3, 1],
        ] as Array<[number, number]>);
    const aa = a * 4;
    return { a: aa, decay, b, k, body: r(0, 2), rate: [0, 1] };
  }
  const factors: Array<[number, number]> = decay
    ? [
        [9, 10],
        [8, 10],
        [75, 100],
        [85, 100],
        [95, 100],
      ]
    : [
        [105, 100],
        [108, 100],
        [11, 10],
        [12, 10],
        [125, 100],
        [15, 10],
      ];
  const b = pick(r, factors);
  return {
    a,
    decay,
    b,
    k: 0,
    body: r(0, 2),
    rate: [Math.abs(b[0] - b[1]), b[1]],
  };
}
export const exponentialInitialValue = chainFamily({
  template: exponentialInitialValueTemplate,
  axes: initAxes,
  model: initModel,
  variant: (m) => `${m.decay ? "decay" : "growth"}`,
  render: (m, ax, r) => {
    const body = m.decay ? decayBodies[m.body]! : growthBodies[m.body]!;
    const bText = decimalText(m.b[0], m.b[1]);
    const rateText = decimalText(m.rate[0], m.rate[1]);
    const value = (n: number, d: number) => `$${decimalText(n, d)}$`;
    let rule: string;
    const options: ChoiceOption[] = [];
    let correctText: string;
    const T = body.time;
    if (ax.form === "factor") {
      rule = `${body.name}(t) = ${powTerm(m.a, bText)}^t`;
      correctText = value(m.a, 1);
      options.push(
        {
          label: value(m.b[0], m.b[1]),
          feedback: `${bText} is the factor that multiplies the amount each ${T.slice(0, -1)}. The initial value is the amount at $t=0$.`,
        },
        {
          label: value(m.a * m.b[0], m.b[1] * 1),
          feedback: `${decimalText(m.a * m.b[0], m.b[1])} is the amount after 1 ${T.slice(0, -1)}, at $t=1$. The initial value is at $t=0$.`,
        },
        {
          label: value(m.a * m.b[0] * m.b[0], m.b[1] * m.b[1]),
          feedback: `${decimalText(m.a * m.b[0] * m.b[0], m.b[1] * m.b[1])} is the amount after 2 ${T}, at $t=2$. The initial value is at $t=0$.`,
        },
        {
          label: value(Math.abs(m.a * (m.b[0] - m.b[1])), m.b[1]),
          feedback: `${decimalText(Math.abs(m.a * (m.b[0] - m.b[1])), m.b[1])} is the ${m.decay ? "decrease" : "increase"} during the first ${T.slice(0, -1)}, not the amount at $t=0$.`,
        },
      );
    } else if (ax.form === "percent-rate") {
      rule = `${body.name}(t) = ${m.a}(1 ${m.decay ? "-" : "+"} ${rateText})^t`;
      correctText = value(m.a, 1);
      options.push(
        {
          label: value(m.rate[0], m.rate[1]),
          feedback: `${rateText} is the rate of ${m.decay ? "decrease" : "increase"} each ${T.slice(0, -1)}. The initial value is the number in front of the parentheses.`,
        },
        {
          label: value(m.b[0], m.b[1]),
          feedback: `${bText} is the factor $1 ${m.decay ? "-" : "+"} ${rateText}$. The initial value is the amount at $t=0$.`,
        },
        {
          label: value(m.a * m.b[0], m.b[1]),
          feedback: `${decimalText(m.a * m.b[0], m.b[1])} is the amount after 1 ${T.slice(0, -1)}, at $t=1$.`,
        },
        {
          label: value(m.a * m.rate[0], m.rate[1]),
          feedback: `${decimalText(m.a * m.rate[0], m.rate[1])} is the ${m.decay ? "decrease" : "increase"} during the first ${T.slice(0, -1)}, ${rateText} of ${m.a}, not the amount at $t=0$.`,
        },
      );
    } else {
      rule = `${body.name}(t) = ${powTerm(m.a, bText)}^{t + ${m.k}}`;
      const init = m.a * (m.b[0] / m.b[1]) ** m.k;
      const fx = (v: number) => `$${decimalText(Math.round(v * 1000), 1000)}$`;
      correctText = fx(init);
      options.push(
        {
          label: value(m.a, 1),
          feedback: `${m.a} is the number in front, but the exponent is $t+${m.k}$, so at $t=0$ the factor is $${bText}^{${m.k}}$, not 1.`,
        },
        {
          label: fx(m.a * (m.b[0] / m.b[1])),
          feedback: `The exponent at $t=0$ is ${m.k}, not 1. Raise the factor to the power ${m.k}.`,
        },
        {
          label: fx((m.b[0] / m.b[1]) ** m.k),
          feedback: `$${bText}^{${m.k}}$ is only part of the value; it multiplies the number ${m.a} in front.`,
        },
        {
          label: fx(m.a + m.k),
          feedback:
            "The exponent multiplies factors; it is not added to the amount.",
        },
      );
    }
    return choiceSurface(r, {
      prompt: `The ${body.noun} after $t$ ${T} is modeled by $${rule}$. What is its initial value, in ${body.unit}?`,
      label: "Choose the initial value",
      options: [{ label: correctText, correct: true }, ...options],
      hint:
        ax.form === "shifted-exponent"
          ? `The initial value is the value at $t=0$. Substitute $t=0$ into the exponent $t + ${m.k}$ and evaluate $${bText}$ to that power before multiplying by ${m.a}.`
          : `The initial value is the value when $t=0$. Substitute $t=0$ into $${rule}$ and decide what the factor becomes when raised to the power 0.`,
      explanation:
        ax.form === "shifted-exponent"
          ? [
              `The initial value is the amount at the start, when no time has passed: $t = 0$.`,
              `Set $t=0$: $${body.name}(0) = ${m.a}\\cdot${bText}^{${m.k}}$. The exponent here is not 0, so the factor does not drop out.`,
              `$${bText}^{${m.k}} = ${decimalText(Math.round(1000 * (m.b[0] / m.b[1]) ** m.k), 1000)}$.`,
              `$${body.name}(0) = ${m.a}\\cdot${decimalText(Math.round(1000 * (m.b[0] / m.b[1]) ** m.k), 1000)} = ${correctText.slice(1, -1)}$.`,
              `The initial value is ${correctText}.`,
            ]
          : [
              `The initial value is the amount at the start, when no time has passed: $t = 0$.`,
              `Set $t=0$: $${body.name}(0) = ${m.a}(${ax.form === "factor" ? bText : `1 ${m.decay ? "-" : "+"} ${rateText}`})^0$.`,
              "The exponent, the small raised number, counts how many times to multiply by the factor. A power of 0 means multiply zero times, so it equals 1.",
              `So $${body.name}(0) = ${m.a} \\cdot 1 = ${m.a}$. In $a\\cdot b^t$ form, the number in front is always the starting amount.`,
              `The initial value is ${m.a}.`,
            ],
    });
  },
});

/* ------------------------------------------------ decay table */
const tableAxes = {
  spacing: defineAxis("spacing", ["one-step", "two-step"] as const),
};
interface DecayModel {
  num: number;
  den: number;
  k: number;
}
function decayModel(r: R): DecayModel {
  const [num, den] = pick(r, [
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
    [2, 5],
  ] as Array<[number, number]>);
  return { num, den, k: r(1, 6) };
}
const csv = (v: number[]) => `$${v.join(",\\ ")}$`;
export const exponentialDecayTable = chainFamily({
  template: exponentialDecayTableTemplate,
  axes: tableAxes,
  model: decayModel,
  variant: (m) => `ratio-${m.num}-${m.den}`,
  render: (m, ax, r) => {
    const decay = [0, 1, 2, 3].map((i) => m.k * m.den ** (3 - i) * m.num ** i);
    const start = decay[0]!;
    const growth = [...decay].reverse();
    const d1 = Math.max(1, Math.floor(start / 5));
    const linear = [0, 1, 2, 3].map((i) => start - i * d1);
    const d2 = Math.max(1, Math.floor(start / 8));
    const accelerating = [0, 1, 3, 6].map((t) => start - t * d2);
    const last = decay[3]!;
    const e = Math.max(1, Math.floor(last / 2));
    const rising = [0, 1, 2, 3].map((i) => last + i * e);
    const geometric = (v: number[]) =>
      v[1]! * v[1]! === v[0]! * v[2]! && v[2]! * v[2]! === v[1]! * v[3]!;
    if (
      linear.some((v) => v <= 0) ||
      accelerating.some((v) => v <= 0) ||
      geometric(accelerating) ||
      geometric(linear) ||
      geometric(rising)
    )
      fail();
    const xs = ax.spacing === "one-step" ? "0, 1, 2, 3" : "0, 2, 4, 6";
    const perStep =
      ax.spacing === "one-step"
        ? "each time $x$ increases by 1"
        : "each time $x$ increases by 2";
    return choiceSurface(r, {
      prompt: `Each choice lists the values of $y$ for $x = ${xs}$, in order. Which choice shows exponential decay?`,
      label: "Choose the table",
      options: [
        { label: csv(decay), correct: true },
        {
          label: csv(growth),
          feedback: `Each value is ${m.den / m.num === Math.floor(m.den / m.num) ? `${m.den / m.num} times` : `$\\frac{${m.den}}{${m.num}}$ times`} the one before, a constant ratio greater than 1. This is exponential growth.`,
        },
        {
          label: csv(linear),
          feedback: `The values drop by the same amount, ${d1}, ${perStep}. A constant difference is linear, not exponential.`,
        },
        {
          label: csv(accelerating),
          feedback: `The drops ${d2}, ${2 * d2}, ${3 * d2} keep growing and the ratios are not constant, so this is neither linear nor exponential.`,
        },
        {
          label: csv(rising),
          feedback: `The values increase by ${e} ${perStep}. They are not decreasing, so this is not decay.`,
        },
      ],
      hint: `Exponential decay has a constant ratio less than 1 between values at equal steps. Several lists start at ${start}, for $x = ${xs}$: for each list, divide the second value by the first and the third by the second, and look for equal quotients less than 1.`,
      explanation: [
        `Exponential decay means the values shrink by the same factor at each equal step. Each value is the same fraction of the one before, less than 1.`,
        `So divide each value by the one before it. That quotient is called the ratio.`,
        `In ${csv(decay)} the ratios are $${decay[1]}\\div${decay[0]}$, $${decay[2]}\\div${decay[1]}$ and $${decay[3]}\\div${decay[2]}$. All equal $\\frac{${m.num}}{${m.den}}$, which is less than 1.`,
        `Compare the others. A constant difference, the same amount subtracted each time, is linear. Values that grow are not decay.`,
        `The list that shows exponential decay is ${csv(decay)}.`,
      ],
    });
  },
});

/* ------------------------------------------------ passes linear */
interface PassModel {
  a: number;
  B: number; // base in tenths
  c: number;
  d: number;
  n: number;
}
function passModel(r: R): PassModel {
  const a = r(2, 5);
  const B = pick(r, [12, 15, 18, 20, 25] as const);
  const c = r(2, 15);
  const d = r(a, a + 14);
  // exact comparison a*B^x/10^x > c*x + d using BigInt
  const f = (x: number) => BigInt(a) * BigInt(B) ** BigInt(x);
  const g = (x: number) => BigInt(c * x + d) * 10n ** BigInt(x);
  let n = -1;
  for (let x = 0; x <= 40; x++)
    if (f(x) > g(x)) {
      n = x;
      break;
    }
  if (n < 3 || n > 12) fail();
  const num = (x: number) => a * (B / 10) ** x;
  const lin = (x: number) => c * x + d;
  if (
    Math.abs(num(n) - lin(n)) < 0.5 ||
    Math.abs(num(n - 1) - lin(n - 1)) < 0.5
  )
    fail();
  return { a, B, c, d, n };
}
export const exponentialPassesLinear = chainFamily({
  template: exponentialPassesLinearTemplate,
  axes: {
    order: defineAxis("order", ["exponential-first", "linear-first"] as const),
  },
  model: passModel,
  variant: (m) => `crosses-at-${m.n < 7 ? "early" : "late"}`,
  render: (m, ax) => {
    const base = decimalText(m.B, 10);
    const f = base.includes(".")
      ? `f(x) = ${m.a}(${base})^x`
      : `f(x) = ${m.a}\\cdot${base}^x`;
    const g = `g(x) = ${m.c}x + ${m.d}`;
    const bv = m.B / 10;
    const fv = (x: number) => m.a * bv ** x;
    const lv = (x: number) => m.c * x + m.d;
    const probe = Math.max(1, m.n - 1);
    return numberSurface({
      prompt:
        ax.order === "exponential-first"
          ? `Two functions are given by $${f}$ and $${g}$. What is the least whole number $x$ for which $f(x) > g(x)$?`
          : `Two functions are given by $${g}$ and $${f}$. What is the least whole number $x$ for which $f(x) > g(x)$?`,
      answer: String(m.n),
      label: "Least whole number",
      hint: `Make a table of both rules, $${m.a}\\cdot${base}^x$ and $${m.c}x + ${m.d}$, for increasing whole values of $x$. The exponential multiplies by ${base} each step while the line adds ${m.c}; find the first row where the exponential is greater.`,
      explanation: [
        `$f$ is exponential: it multiplies by the same factor each step. $g$ is linear: it adds the same amount each step.`,
        `Multiplying eventually beats adding, so $f$ will pass $g$. Find the first whole number where it does by checking values in a table.`,
        `At $x=${m.n - 1}$: $f \\approx ${roundText(fv(m.n - 1), 2)}$ and $g = ${lv(m.n - 1)}$, so $f(x) \\le g(x)$ there.`,
        `At $x=${m.n}$: $f \\approx ${roundText(fv(m.n), 2)}$ and $g = ${lv(m.n)}$, so $f(x) > g(x)$.`,
        `After that, the gap $f - g$ keeps growing, so $f$ stays above $g$.`,
        `The least whole number $x$ with $f(x) > g(x)$ is ${m.n}.`,
      ],
    });
  },
});

/* ------------------------------------------------ two-way share */
const tableContexts = [
  {
    title: "Survey of students",
    rows: ["Juniors", "Seniors"],
    cols: ["Has a job", "No job"],
    who: "students",
    rowNoun: ["juniors", "seniors"],
    colPhrase: ["have a job", "do not have a job"],
  },
  {
    title: "Customers of a shop",
    rows: ["Adults", "Teens"],
    cols: ["Bought online", "Bought in store"],
    who: "customers",
    rowNoun: ["adults", "teens"],
    colPhrase: ["bought online", "bought in store"],
  },
  {
    title: "Members of a gym",
    rows: ["Morning", "Evening"],
    cols: ["Uses classes", "Uses weights"],
    who: "members",
    rowNoun: ["morning members", "evening members"],
    colPhrase: ["use classes", "use weights"],
  },
  {
    title: "Commuters",
    rows: ["City", "Suburb"],
    cols: ["Takes a train", "Drives"],
    who: "commuters",
    rowNoun: ["city commuters", "suburb commuters"],
    colPhrase: ["take a train", "drive"],
  },
] as const;
const shareAxes = {
  kind: defineAxis("kind", [
    "conditional-row",
    "conditional-column",
    "joint",
  ] as const),
};
interface ShareModel {
  ctx: number;
  k: [[number, number], [number, number]];
  i: number;
  j: number;
}
function shareModel(r: R): ShareModel {
  const k: [[number, number], [number, number]] = [
    [r(14, 70), r(14, 70)],
    [r(14, 70), r(14, 70)],
  ];
  return { ctx: r(0, tableContexts.length - 1), k, i: r(0, 1), j: r(0, 1) };
}
export const twoWayShare = chainFamily({
  template: twoWayShareTemplate,
  axes: shareAxes,
  model: shareModel,
  variant: (m) => `cell-${m.i}-${m.j}`,
  render: (m, ax, r) => {
    const c = tableContexts[m.ctx]!;
    const row = [m.k[0][0] + m.k[0][1], m.k[1][0] + m.k[1][1]];
    const col = [m.k[0][0] + m.k[1][0], m.k[0][1] + m.k[1][1]];
    const n = row[0]! + row[1]!;
    const cell = m.k[m.i]![m.j]!;
    const pct = (a: number, b: number) => (100 * a) / b;
    const [num, den] =
      ax.kind === "joint"
        ? [cell, n]
        : ax.kind === "conditional-row"
          ? [cell, row[m.i]!]
          : [cell, col[m.j]!];
    const p = pct(num, den);
    const frac = p - Math.floor(p);
    if (frac > 0.38 && frac < 0.62) fail();
    if (frac < 0.04 || frac > 0.96) fail();
    const rounded = Math.round(p);
    const label = (v: number) => `$${v}\\%$`;
    const cands: Array<[number, string]> = [
      [
        Math.round(pct(cell, n)),
        `${cell} out of the table total ${n}, not out of the group named in the question.`,
      ],
      [
        Math.round(pct(cell, row[m.i]!)),
        `${cell} out of the row total ${row[m.i]}: the question is about a different group.`,
      ],
      [
        Math.round(pct(cell, col[m.j]!)),
        `${cell} out of the column total ${col[m.j]}: the question is about a different group.`,
      ],
      [
        100 - rounded,
        "This is the percent of the group that is not in the category asked about.",
      ],
      [
        Math.round(pct(row[m.i]!, n)),
        `${row[m.i]} is the whole row, which includes both columns.`,
      ],
    ];
    if (ax.kind === "joint") {
      cands[0] = [
        Math.round(pct(cell, row[m.i]!)),
        `${cell} out of the row total ${row[m.i]}: the question asks for the share of everyone surveyed.`,
      ];
      cands[1] = [
        Math.round(pct(cell, col[m.j]!)),
        `${cell} out of the column total ${col[m.j]}: the question asks for the share of everyone surveyed.`,
      ];
      cands[2] = [
        Math.round(pct(col[m.j]!, n)),
        `${col[m.j]} is the whole column, which includes both rows.`,
      ];
    }
    const seen = new Set([rounded]);
    const wrong = cands.filter(([v]) => {
      if (seen.has(v) || v <= 0 || v >= 100) return false;
      seen.add(v);
      return true;
    });
    if (wrong.length < 3) fail();
    const rowName = c.rowNoun[m.i]!;
    const colPhrase = c.colPhrase[m.j]!;
    const question =
      ax.kind === "joint"
        ? `What percent of all ${n} ${c.who} surveyed are ${rowName} who ${colPhrase}?`
        : ax.kind === "conditional-row"
          ? `What percent of the ${rowName} ${colPhrase}?`
          : `Of the ${c.who} who ${colPhrase}, what percent are ${rowName}?`;
    const scene = table({
      id: "t",
      title: c.title,
      columns: [c.cols[0], c.cols[1], "Total"],
      rows: [
        { label: c.rows[0], cells: [m.k[0][0], m.k[0][1], row[0]!] },
        { label: c.rows[1], cells: [m.k[1][0], m.k[1][1], row[1]!] },
        { label: "Total", cells: [col[0]!, col[1]!, n] },
      ],
      sums: true,
    }).scene({});
    const surface = choiceSurface(r, {
      prompt: `The table shows the counts for ${n} ${c.who}. ${question} Round to the nearest percent.`,
      label: "Choose the percent",
      options: [
        { label: label(rounded), correct: true },
        ...wrong.map(([v, feedback]) => ({ label: label(v), feedback })),
      ],
      hint:
        ax.kind === "joint"
          ? `Find the count for ${rowName} who ${colPhrase}: it is ${cell}. Divide it by the number of all ${c.who} in the table, ${n}, then convert to a percent.`
          : `In the table of ${n} ${c.who}, find the count for ${rowName} who ${colPhrase}: it is ${cell}. Divide it by the total of the group the question is about (${ax.kind === "conditional-row" ? `the ${rowName} row, ${row[m.i]}` : `the column of ${c.who} who ${colPhrase}, ${col[m.j]}`}), then convert to a percent.`,
      explanation: [
        `A two-way table counts people by two features at once. Each cell holds the count that has both features.`,
        `A percent is a part out of a whole. The part is the cell for the people asked about: ${cell}.`,
        ax.kind === "joint"
          ? `The whole is everyone surveyed, the table total: ${den} ${c.who}.`
          : `The whole is only the group named after "of": ${den} ${c.who}. Use that row or column total, not the table total.`,
        `Divide part by whole: $${cell}\\div${den} \\approx ${roundText(p / 100, 4)}$. Multiply by 100 to get a percent: ${roundText(p, 1)}%.`,
        `Rounded to the nearest percent, the answer is ${rounded}%.`,
      ],
    });
    return surface && { ...surface, figure: { kind: "scene", scene } };
  },
});

/* ------------------------------------------------ quartile */
const quartileAxes = {
  ask: defineAxis("ask", ["upper-quartile", "lower-quartile"] as const),
};
const median = (v: number[]) => {
  const s = [...v].sort((p, q) => p - q);
  const h = s.length >> 1;
  return s.length % 2 ? s[h]! : (s[h - 1]! + s[h]!) / 2;
};
export const quartileList = chainFamily({
  template: quartileListTemplate,
  axes: quartileAxes,
  model: (r: R) => {
    const n = pick(r, [8, 10, 12] as const);
    const values = Array.from({ length: n }, () => r(2, 40));
    if (new Set(values).size === n) fail();
    return { values };
  },
  variant: (m) => `n-${m.values.length}`,
  render: (m, ax) => {
    const sorted = [...m.values].sort((p, q) => p - q);
    const half = sorted.length / 2;
    const upper = ax.ask === "upper-quartile";
    const part = upper ? sorted.slice(half) : sorted.slice(0, half);
    const q = median(part);
    return numberSurface({
      prompt: `A data set has ${m.values.length} values: ${m.values.join(", ")}. The ${upper ? "upper" : "lower"} quartile is the median of the ${upper ? "upper" : "lower"} half of the ordered data. What is the ${upper ? "upper" : "lower"} quartile?`,
      answer: String(q),
      label: upper ? "Upper quartile" : "Lower quartile",
      hint: `Put the ${m.values.length} values in order from least, ${sorted[0]}, to greatest, ${sorted[sorted.length - 1]}, repeating any value that appears more than once. Split the list into two halves of ${half} values and look at the ${upper ? "upper" : "lower"} half.`,
      explanation: [
        `The median is the middle value of an ordered list. Quartiles split the data into quarters; the ${upper ? "upper" : "lower"} quartile is the median of the ${upper ? "upper" : "lower"} half.`,
        `Order the values from least to greatest: ${sorted.join(", ")}.`,
        `Split the list into two equal halves${sorted.length % 2 ? ", leaving out the middle value" : ""}. The ${upper ? "upper" : "lower"} half is ${part.join(", ")}.`,
        part.length % 2
          ? `This half has ${part.length} values, an odd number, so its median is the middle one: ${q}.`
          : `This half has ${part.length} values, an even number, so its median is the mean (average) of the two middle values: $(${part[part.length / 2 - 1]}+${part[part.length / 2]})\\div2=${q}$.`,
        `The ${upper ? "upper" : "lower"} quartile is ${q}.`,
      ],
    });
  },
});

/* ------------------------------------------------ average rate */
const rateAxes = {
  context: defineAxis("context", ["population-growth", "value-decay"] as const),
};
interface RateModel {
  years: number[];
  values: number[];
  i: number;
  j: number;
}
function rateModel(r: R, ax: { context: string }): RateModel {
  if (ax.context === "population-growth") {
    const start = r(1_000_000, 4_000_000);
    const years = [1980, 1990, 2000, 2010, 2020];
    let v = start;
    const values = years.map(() => (v += r(20_000, 400_000)));
    const i = r(0, 1);
    const j = r(3, 4);
    const rate = (values[j]! - values[i]!) / (years[j]! - years[i]!);
    const f = rate - Math.floor(rate);
    if (f > 0.35 && f < 0.65) fail();
    return { years, values, i, j };
  }
  const years = [0, 1, 3, 6, 8];
  let v = r(12000, 30000);
  const values = years.map((_, k) => (k === 0 ? v : (v -= r(500, 3000))));
  const i = r(0, 1);
  const j = r(3, 4);
  const rate = (values[j]! - values[i]!) / (years[j]! - years[i]!);
  const tenth = Math.abs(rate * 10) - Math.floor(Math.abs(rate * 10));
  if (tenth > 0.35 && tenth < 0.65) fail();
  if (rate * 10 === Math.round(rate * 10)) fail();
  return { years, values, i, j };
}
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const averageRateTable = chainFamily({
  template: averageRateTableTemplate,
  axes: rateAxes,
  model: rateModel,
  variant: (m) =>
    m.values[m.j]! > m.values[m.i]! ? "increasing" : "decreasing",
  render: (m, ax) => {
    const pop = ax.context === "population-growth";
    const dy = m.years[m.j]! - m.years[m.i]!;
    const dv = m.values[m.j]! - m.values[m.i]!;
    const rate = dv / dy;
    const answer = pop ? String(Math.round(rate)) : roundText(rate, 1);
    const scene = table({
      id: "t",
      columns: [pop ? "Population" : "Value ($)"],
      corner: "Year",
      rows: m.years.map((y, k) => ({
        label: String(y),
        cells: [group(m.values[k]!)],
      })),
    }).scene({});
    return {
      ...numberSurface({
        prompt: pop
          ? `The table shows the population of a city. What is the average rate of change in the population from ${m.years[m.i]} to ${m.years[m.j]}, in people per year, to the nearest whole number?`
          : `The table shows the value, in dollars, of a delivery van at different ages in years. What is the average rate of change in its value from year ${m.years[m.i]} to year ${m.years[m.j]}, in dollars per year, to the nearest tenth?`,
        answer,
        label: pop
          ? "Average rate (people per year)"
          : "Average rate (dollars per year)",
        hint: `Subtract the value in ${pop ? "" : "year "}${m.years[m.i]} (${group(m.values[m.i]!)}) from the value in ${pop ? "" : "year "}${m.years[m.j]} (${group(m.values[m.j]!)}), and divide by the number of years between ${m.years[m.i]} and ${m.years[m.j]}.`,
        explanation: [
          `The average rate of change is the total change divided by the time it took. It tells how much the ${pop ? "population" : "value"} changed per year, on average.`,
          `The change in the ${pop ? "population" : "value"} is end minus start: $${m.values[m.j]}-${m.values[m.i]}=${dv}$.`,
          `The change in time is $${m.years[m.j]}-${m.years[m.i]}=${dy}$ years.`,
          `Divide: $${dv}\\div${dy} \\approx ${answer}$, rounded to the nearest whole number.`,
          `The average rate of change is about ${answer} ${pop ? "people" : "dollars"} per year.`,
        ],
      }),
      figure: { kind: "scene" as const, scene },
    };
  },
});

/* ------------------------------------------------ correlation / causation */
const relationships = [
  {
    text: "the number of miles a car is driven and the amount of gasoline it has used",
    sign: "positive",
    cause: true,
  },
  {
    text: "the outdoor temperature on winter days and the amount of heating oil a house uses",
    sign: "negative",
    cause: true,
  },
  {
    text: "daily ice cream sales and the number of sunburns treated at a beach each day",
    sign: "positive",
    cause: false,
  },
  {
    text: "the number of firefighters sent to a fire and the amount of damage it causes",
    sign: "positive",
    cause: false,
  },
  {
    text: "the height of a mountain hike and the air pressure at the top",
    sign: "negative",
    cause: true,
  },
  {
    text: "the hours a phone has been charging and the battery percentage",
    sign: "positive",
    cause: true,
  },
  {
    text: "children's shoe sizes and their scores on a reading test",
    sign: "positive",
    cause: false,
  },
  {
    text: "the number of hours a generator has run and the fuel left in its tank",
    sign: "negative",
    cause: true,
  },
  {
    text: "the number of storks nesting in towns and the number of babies born there",
    sign: "positive",
    cause: false,
  },
  {
    text: "the number of coats sold each week and the number of swimmers at a public pool",
    sign: "negative",
    cause: false,
  },
] as const;
export const correlationCausation = chainFamily({
  template: correlationCausationTemplate,
  axes: {},
  model: (r: R) => ({ rel: r(0, relationships.length - 1) }),
  variant: (m) =>
    `${relationships[m.rel]!.sign}-${relationships[m.rel]!.cause ? "causal" : "not-causal"}`,
  render: (m, _ax, r) => {
    const rel = relationships[m.rel]!;
    const label = (sign: string, cause: boolean) =>
      `${sign[0]!.toUpperCase() + sign.slice(1)} correlation; ${cause ? "one causes the other" : "neither causes the other"}`;
    const other = rel.sign === "positive" ? "negative" : "positive";
    return choiceSurface(r, {
      prompt: `A study measures ${rel.text}. Which statement best describes the relationship?`,
      label: "Choose the statement",
      options: [
        { label: label(rel.sign, rel.cause), correct: true },
        {
          label: label(other, rel.cause),
          feedback: `As one quantity increases the other ${rel.sign === "positive" ? "also increases, so the correlation is positive" : "decreases, so the correlation is negative"}.`,
        },
        {
          label: label(rel.sign, !rel.cause),
          feedback: rel.cause
            ? "A change in one quantity directly produces the change in the other here, so this is causation."
            : "A third factor, such as the season, the size of the event or age, explains why both quantities move together. Correlation alone does not show that one causes the other.",
        },
        {
          label: label(other, !rel.cause),
          feedback: `Both parts are wrong: the correlation is ${rel.sign}, and ${rel.cause ? "one quantity does cause the other" : "a hidden factor, not one quantity, explains the pattern"}.`,
        },
      ],
      hint: `Picture a scatter plot of ${rel.text}. Ask two separate questions: when one goes up, does the other go up or down? And does a change in one directly produce a change in the other, or could something else drive both?`,
      explanation: [
        `A correlation is a pattern where two quantities change together. It is positive when both rise together and negative when one rises as the other falls.`,
        `Here the two quantities move ${rel.sign === "positive" ? "in the same direction" : "in opposite directions"}, so the correlation is ${rel.sign}.`,
        `Causation means a change in one quantity directly produces the change in the other. A correlation alone does not prove that.`,
        rel.cause
          ? "In this situation one quantity directly produces the change in the other, so the relationship is causal."
          : "Here a third factor drives both, so neither causes the other. They only move together.",
        `The best description is: ${rel.sign} correlation; ${rel.cause ? "one causes the other" : "neither causes the other"}.`,
      ],
    });
  },
});

/* ------------------------------------------------ budget */
const budgetContexts = [
  {
    who: "A student",
    fixed: "an entry ticket",
    item: "a ride ticket",
    plural: "ride tickets",
  },
  { who: "A club", fixed: "a booth fee", item: "a plant", plural: "plants" },
  {
    who: "A family",
    fixed: "a parking fee",
    item: "a snack",
    plural: "snacks",
  },
  {
    who: "A band",
    fixed: "a studio deposit",
    item: "an hour of recording time",
    plural: "hours of recording time",
  },
] as const;
export const budgetWholeItems = chainFamily({
  template: budgetWholeItemsTemplate,
  axes: { fit: defineAxis("fit", ["leftover", "exact-fit"] as const) },
  model: (r: R, ax) => {
    const priceCents = r(125, 650);
    const items = r(4, 18);
    const fixedCents = r(300, 2500);
    const extra = ax.fit === "exact-fit" ? 0 : r(1, priceCents - 1);
    const budget = fixedCents + items * priceCents + extra;
    return {
      priceCents,
      items,
      fixedCents,
      budget,
      ctx: r(0, budgetContexts.length - 1),
    };
  },
  variant: (m) =>
    m.budget - m.fixedCents === m.items * m.priceCents
      ? "exact-fit"
      : "leftover",
  render: (m) => {
    const c = budgetContexts[m.ctx]!;
    const dollars = (v: number) =>
      v % 100 === 0 ? String(v / 100) : (v / 100).toFixed(2);
    const left = m.budget - m.fixedCents;
    return numberSurface({
      prompt: `${c.who} has $${dollars(m.budget)}$ dollars. After paying ${c.fixed} of $${dollars(m.fixedCents)}$ dollars, the rest is spent on ${c.plural} that cost $${dollars(m.priceCents)}$ dollars each. What is the greatest whole number of ${c.plural} that can be bought?`,
      answer: String(m.items),
      label: `Greatest number of ${c.plural}`,
      hint: `First find how much is left after the fixed cost of $${dollars(m.fixedCents)}$ dollars. Then ask how many whole times $${dollars(m.priceCents)}$ dollars fits into what is left.`,
      explanation: [
        `Pay the fixed cost first, because it is paid once no matter how many ${c.plural} are bought.`,
        `Money left after ${c.fixed}: $${dollars(m.budget)}-${dollars(m.fixedCents)}=${dollars(left)}$ dollars.`,
        `Let $n$ be the number of ${c.plural}. They cost $${dollars(m.priceCents)}n$, and that may be at most what is left: $${dollars(m.priceCents)}n \\le ${dollars(left)}$.`,
        `Divide both sides by ${dollars(m.priceCents)}: $n \\le ${roundText(left / m.priceCents, 3)}$.`,
        `Only whole ${c.plural} can be bought, so round down, never up. Rounding up would cost more than the money left.`,
        `The greatest whole number is ${m.items}.`,
      ],
    });
  },
});

/* ------------------------------------------------ abs equals linear */
export const absEqualsLinear = chainFamily({
  template: absEqualsLinearTemplate,
  axes: { slope: defineAxis("slope", ["positive", "negative"] as const) },
  model: (r: R, ax) => {
    const k = r(1, 2);
    const mag = r(k + 1, k + 3);
    const c = ax.slope === "positive" ? mag : -mag;
    const a = r(-6, 6);
    const b = r(-5, 5);
    const x0 = r(-8, 8);
    if (x0 === a) fail();
    const d = k * Math.abs(x0 - a) + b - c * x0;
    if (d === 0) fail();
    return { k, c, a, b, d, x0 };
  },
  variant: (m) => (m.x0 > m.a ? "right-branch" : "left-branch"),
  render: (m) => {
    const inside = m.a === 0 ? "x" : `x ${sgn(-m.a)} ${Math.abs(m.a)}`;
    const coefX = m.c === 1 ? "" : m.c === -1 ? "-" : String(m.c);
    const f = `f(x) = ${m.k === 1 ? "" : m.k}|${inside}|${m.b === 0 ? "" : ` ${sgn(m.b)} ${Math.abs(m.b)}`}`;
    const g = `g(x) = ${coefX}x ${sgn(m.d)} ${Math.abs(m.d)}`;
    const rest = m.d - m.b;
    const inner = m.x0 - m.a;
    const xA = (m.d - m.b + m.k * m.a) / (m.k - m.c);
    const xB = (m.d - m.b - m.k * m.a) / (-m.k - m.c);
    return numberSurface({
      prompt: `Let $${f}$ and $${g}$. For what value of $x$ does $f(x) = g(x)$?`,
      answer: String(m.x0),
      label: "Answer",
      hint: `Set the two rules equal, $${f.slice(7)} = ${g.slice(7)}$. The absolute value equals $${inside}$ when that expression is positive and its opposite when it is negative, so solve both cases and check each solution in the original equation.`,
      explanation: [
        `The absolute value $|a|$ is the distance of $a$ from 0, so it is never negative. $|5| = 5$ and $|-5| = 5$.`,
        `Set the rules equal, then get the absolute value alone: $${m.k === 1 ? "" : m.k}|${inside}| = ${coefX}x${rest === 0 ? "" : ` ${sgn(rest)} ${Math.abs(rest)}`}$.`,
        `$|${inside}|$ equals $${inside}$ when that is 0 or more, and its opposite when it is negative. So solve two cases and check each.`,
        `If $${inside}\\ge0$ the absolute value is $${inside}$: $${m.k === 1 ? "" : m.k}(${inside}) = ${coefX}x${rest === 0 ? "" : ` ${sgn(rest)} ${Math.abs(rest)}`}$ gives $x = ${frac(m.d - m.b + m.k * m.a, m.k - m.c)}$, which ${xA >= m.a ? "satisfies" : "does not satisfy"} $x \\ge ${m.a}$.`,
        `If $${inside}<0$ the absolute value is the opposite, $-(${inside})$: this gives $x = ${frac(m.d - m.b - m.k * m.a, -m.k - m.c)}$, which ${xB < m.a ? "satisfies" : "does not satisfy"} $x < ${m.a}$.`,
        `A case's answer counts only if it fits that case's condition. Check: $f(${m.x0}) = ${m.k * Math.abs(inner) + m.b}$ and $g(${m.x0}) = ${m.c * m.x0 + m.d}$.`,
        `So $f(x) = g(x)$ when $x=${m.x0}$.`,
      ],
    });
  },
});

export const regentsAlgebraOneDataTemplates = [
  exponentialInitialValueTemplate,
  exponentialDecayTableTemplate,
  exponentialPassesLinearTemplate,
  twoWayShareTemplate,
  quartileListTemplate,
  averageRateTableTemplate,
  correlationCausationTemplate,
  budgetWholeItemsTemplate,
  absEqualsLinearTemplate,
];
export const regentsAlgebraOneDataGenerate = dispatch(
  regentsAlgebraOneDataTemplates,
  {
    "exponential-initial-value": (s) =>
      exponentialInitialValue.generate(s).problem,
    "exponential-decay-table": (s) => exponentialDecayTable.generate(s).problem,
    "exponential-passes-linear": (s) =>
      exponentialPassesLinear.generate(s).problem,
    "two-way-share": (s) => twoWayShare.generate(s).problem,
    "quartile-list": (s) => quartileList.generate(s).problem,
    "average-rate-table-rounded": (s) => averageRateTable.generate(s).problem,
    "correlation-causation-choice": (s) =>
      correlationCausation.generate(s).problem,
    "budget-whole-items": (s) => budgetWholeItems.generate(s).problem,
    "abs-equals-linear-unique": (s) => absEqualsLinear.generate(s).problem,
  },
);
