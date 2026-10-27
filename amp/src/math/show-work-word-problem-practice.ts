import type { TemplateMetadata } from "./contracts";
import { chainFamily, decimalText, dispatch, pick } from "./chain-kit";
import {
  fieldsWork,
  workModeAxisNoOrder,
  workSurface,
  type FieldStep,
} from "./structured-work-kit";
import { defineAxis } from "./variation/axes";

/**
 * Show the work of a multi-part word problem: each part and each
 * intermediate result is its own labeled step, entered as an exact number
 * or a typed expression or inequality. The steps are the written work a
 * "show or explain how you got your answer" item asks for, in a form the
 * server grades exactly.
 */

const capability = "structured-work-v1" as const;
export const showWorkTemplates: readonly TemplateMetadata[] = [
  {
    id: "show-work-box-cost",
    version: 1,
    title: "Show the work: costs, expressions and a one-time coupon",
    skillId: "variable-expressions",
    gradeBand: "6–8",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Find the cost of a number of boxes, write expressions for the cost of any number of boxes with and without a one-time coupon, and work back from a budget to the number of boxes, entering each step.",
  },
  {
    id: "show-work-percent-count",
    version: 1,
    title: "Show the work: percents of a total, forward and back",
    skillId: "percentages",
    gradeBand: "6–8",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Write a percent as a fraction, find that percent of a total, find the new percent after more are added, and find how many more reach a target percent, entering each step.",
  },
  {
    id: "show-work-rental-plans",
    version: 1,
    title: "Show the work: compare two plans with an inequality",
    skillId: "linear-inequalities",
    gradeBand: "6–8",
    difficultyOffset: 0.4,
    requiredResponseCapability: capability,
    description:
      "Write the cost of each of two plans with a fixed fee and a rate per unit, write the inequality that says one plan costs less or more than the other, and find where the costs are equal, entering each step.",
  },
];

const cents = (n: number) => decimalText(n, 100);
/** Money in prose: "4.50 dollars", "5 dollars". */
const dollars = (c: number) =>
  c === 100
    ? "1 dollar"
    : `${c % 100 === 0 ? c / 100 : (c / 100).toFixed(2)} dollars`;

/* --------------------------------------------------------- box cost */

const boxes = [
  ["A bakery", "boxes of cupcakes", "A teacher"],
  ["A craft store", "boxes of markers", "An art club"],
  ["A farm stand", "boxes of strawberries", "A chef"],
  ["A school store", "packs of pencils", "A coach"],
] as const;
interface BoxModel {
  seller: string;
  item: string;
  buyer: string;
  price: number; // cents
  n: number;
  coupon: number; // cents
  budget: number; // cents
  count: number;
}
const box = chainFamily({
  template: showWorkTemplates[0]!,
  axes: { mode: workModeAxisNoOrder },
  model: (r): BoxModel => {
    const [seller, item, buyer] = pick(r, boxes);
    const price = pick(r, [300, 400, 450, 500, 600, 750, 800]);
    const coupon = pick(r, [100, 150, 200, 250, 300]);
    const count = r(6, 15);
    const n = r(3, 12);
    if (n === count) throw new Error("Need three retry");
    return {
      seller,
      item,
      buyer,
      price,
      n,
      coupon,
      budget: price * count - coupon,
      count,
    };
  },
  render: (m, axes, r) => {
    const p = cents(m.price),
      k = cents(m.coupon);
    const steps: FieldStep[] = [
      {
        label: `Cost of ${m.n} ${m.item}, in dollars`,
        kind: "number",
        value: cents(m.price * m.n),
      },
      {
        label: `Expression for the cost of $c$ ${m.item}, in dollars`,
        kind: "expression",
        value: `${p}c`,
        variables: ["c"],
      },
      {
        label: `Expression for the cost of $c$ ${m.item} with the coupon, in dollars`,
        kind: "expression",
        value: `${p}c-${k}`,
        variables: ["c"],
      },
      {
        label: `Cost of the ${m.item} before the coupon comes off, in dollars`,
        kind: "number",
        value: cents(m.budget + m.coupon),
      },
      {
        label: `Number of ${m.item} ${m.buyer.toLowerCase()} buys`,
        kind: "number",
        value: `${m.count}`,
      },
    ];
    const built = fieldsWork(steps, axes.mode, r, "Your work");
    const task =
      axes.mode === "build"
        ? "Enter each step."
        : "Some steps are filled in. Enter the others.";
    return workSurface(built, {
      prompt: `${m.seller} sells ${m.item} for ${dollars(m.price)} each. A coupon takes ${dollars(m.coupon)} off one purchase and can be used only once. ${m.buyer} spends exactly ${dollars(m.budget)} and uses the coupon. ${task}`,
      hint: `Each of the ${m.item} costs ${dollars(m.price)}, so the cost is ${p} times the number bought. The coupon is taken off once, from the whole purchase, not from each one.`,
      explanation: [
        `${m.n} ${m.item} cost $${m.n}\\times${p}=${cents(m.price * m.n)}$ dollars.`,
        `For $c$ ${m.item} the cost is $${p}c$ dollars.`,
        `The coupon takes ${dollars(m.coupon)} off the whole purchase once: $${p}c-${k}$.`,
        `Before the coupon, the ${m.item} cost $${cents(m.budget)}+${k}=${cents(m.budget + m.coupon)}$ dollars.`,
        `That buys $${cents(m.budget + m.coupon)}\\div${p}=${m.count}$ ${m.item}. Check: $${p}\\times${m.count}-${k}=${cents(m.budget)}$.`,
      ],
    });
  },
  variant: (m) => (m.price % 100 ? "decimal-price" : "whole-price"),
});

/* ------------------------------------------------------ percent count */

const totals = [
  {
    total: 50,
    things: "states",
    person: "Aaron",
    verb: "has visited",
    more: "visit",
  },
  {
    total: 40,
    things: "national parks on a list",
    person: "Maya",
    verb: "has hiked in",
    more: "hike in",
  },
  {
    total: 20,
    things: "books on a reading list",
    person: "Leo",
    verb: "has read",
    more: "read",
  },
  {
    total: 25,
    things: "museums in a city",
    person: "Priya",
    verb: "has toured",
    more: "tour",
  },
] as const;
interface PercentModel {
  total: number;
  things: string;
  person: string;
  verb: string;
  more: string;
  percent: number;
  extra: number;
  target: number;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const percentCount = chainFamily({
  template: showWorkTemplates[1]!,
  axes: { mode: workModeAxisNoOrder },
  model: (r): PercentModel => {
    const t = pick(r, totals);
    const step = 100 / t.total; // percent per item: 2, 2.5, 5 or 4
    const have = r(2, Math.floor(t.total * 0.5));
    const percent = have * step;
    if (!Number.isInteger(percent)) throw new Error("Need three retry");
    const extra = r(2, Math.max(3, Math.floor(t.total * 0.2)));
    const target =
      r(have + extra + 2, Math.min(t.total, have + extra + 12)) * step;
    if (!Number.isInteger(target) || target >= 100)
      throw new Error("Need three retry");
    return { ...t, percent, extra, target };
  },
  render: (m, axes, r) => {
    const have = (m.percent * m.total) / 100;
    const after = have + m.extra;
    const need = (m.target * m.total) / 100;
    const g = gcd(m.percent, 100);
    const steps: FieldStep[] = [
      {
        label: `${m.percent}% written as a fraction`,
        kind: "number",
        value: `${m.percent / g}/${100 / g}`,
        fraction: true,
      },
      {
        label: `Number of ${m.things} ${m.person} ${m.verb}`,
        kind: "number",
        value: `${have}`,
      },
      {
        label: `Number after ${m.extra} more`,
        kind: "number",
        value: `${after}`,
      },
      {
        label: `Percent of the ${m.total} after ${m.extra} more`,
        kind: "number",
        value: decimalText(after * 100, m.total),
        unit: "%",
      },
      {
        label: `Number that is ${m.target}% of ${m.total}`,
        kind: "number",
        value: `${need}`,
      },
      {
        label: `More needed to reach exactly ${m.target}%`,
        kind: "number",
        value: `${need - after}`,
      },
    ];
    const built = fieldsWork(steps, axes.mode, r, "Your work");
    const task =
      axes.mode === "build"
        ? "Enter each step."
        : "Some steps are filled in. Enter the others.";
    return workSurface(built, {
      prompt: `${m.person} ${m.verb} ${m.percent}% of the ${m.total} ${m.things}. This year ${m.person} will ${m.more} ${m.extra} more. ${task}`,
      hint: `${m.percent}% means ${m.percent} out of every 100. To find ${m.percent}% of ${m.total}, multiply ${m.total} by that fraction.`,
      explanation: [
        `$${m.percent}\\%=\\frac{${m.percent}}{100}=\\frac{${m.percent / g}}{${100 / g}}$.`,
        `$\\frac{${m.percent / g}}{${100 / g}}\\times${m.total}=${have}$.`,
        `$${have}+${m.extra}=${after}$.`,
        `$\\frac{${after}}{${m.total}}=${decimalText(after, m.total)}=${decimalText(after * 100, m.total)}\\%$.`,
        `$${m.target}\\%$ of $${m.total}$ is $${decimalText(m.target, 100)}\\times${m.total}=${need}$.`,
        `$${need}-${after}=${need - after}$ more.`,
      ],
    });
  },
  variant: (m) => `total-${m.total}`,
});

/* ------------------------------------------------------ rental plans */

const rentals = [
  ["rents cars", "mile", "miles", "m"],
  ["rents moving trucks", "mile", "miles", "m"],
  ["rents bikes", "hour", "hours", "h"],
  ["rents kayaks", "hour", "hours", "h"],
] as const;
interface RentalModel {
  what: string;
  unit: string;
  units: string;
  v: string;
  feeA: number; // cents
  rateA: number;
  feeB: number;
  rateB: number;
  ask: "less" | "more";
}
const rental = chainFamily({
  template: showWorkTemplates[2]!,
  axes: {
    mode: workModeAxisNoOrder,
    ask: defineAxis("ask", ["less", "more"] as const),
  },
  model: (r, axes): RentalModel => {
    const [what, unit, units, v] = pick(r, rentals);
    const rateB = pick(r, [15, 20, 25, 30, 40]);
    const rateA = rateB + pick(r, [5, 10, 15, 20]);
    const equal = pick(r, [40, 50, 60, 80, 100, 120, 150]);
    const feeA = pick(r, [1500, 1995, 2000, 2500, 2999, 3000]);
    const feeB = feeA + (rateA - rateB) * equal;
    if (feeB > 9900) throw new Error("Need three retry");
    return { what, unit, units, v, feeA, rateA, feeB, rateB, ask: axes.ask };
  },
  render: (m, axes, r) => {
    const A = `${cents(m.feeA)}+${cents(m.rateA)}${m.v}`;
    const B = `${cents(m.feeB)}+${cents(m.rateB)}${m.v}`;
    const op = m.ask === "less" ? "<" : ">";
    const equal = (m.feeB - m.feeA) / (m.rateA - m.rateB);
    const steps: FieldStep[] = [
      {
        label: `Cost of plan A for $${m.v}$ ${m.units}, in dollars`,
        kind: "expression",
        value: A,
        variables: [m.v],
      },
      {
        label: `Cost of plan B for $${m.v}$ ${m.units}, in dollars`,
        kind: "expression",
        value: B,
        variables: [m.v],
      },
      {
        label: `Inequality that is true when plan A costs ${m.ask} than plan B`,
        kind: "expression",
        value: `${A}${op}${B}`,
        match: "sides",
        relations: true,
        inequality: true,
        variables: [m.v],
        maxLength: 28,
      },
      {
        label: `Number of ${m.units} at which the plans cost the same`,
        kind: "number",
        value: `${equal}`,
      },
    ];
    const built = fieldsWork(steps, axes.mode, r, "Your work");
    const task =
      axes.mode === "build"
        ? "Enter each step."
        : "Some steps are filled in. Enter the others.";
    return workSurface(built, {
      prompt: `A company ${m.what} on two plans. Plan A costs ${dollars(m.feeA)} plus ${dollars(m.rateA)} per ${m.unit}. Plan B costs ${dollars(m.feeB)} plus ${dollars(m.rateB)} per ${m.unit}. Let $${m.v}$ be the number of ${m.units}. ${task}`,
      hint: `Each plan's cost is its fixed fee plus its rate times $${m.v}$. Plan A starts at ${dollars(m.feeA)} and adds ${dollars(m.rateA)} for each ${m.unit}.`,
      explanation: [
        `Plan A: $${A}$ dollars.`,
        `Plan B: $${B}$ dollars.`,
        `Plan A costs ${m.ask} than plan B when $${A}${op}${B}$.`,
        `The costs are equal when $${A}=${B}$: $${cents(m.rateA - m.rateB)}${m.v}=${cents(m.feeB - m.feeA)}$, so $${m.v}=${equal}$.`,
      ],
    });
  },
  variant: (m) => m.ask,
});

export const showWorkGenerate = dispatch(showWorkTemplates, {
  "show-work-box-cost": (seed) => box.generate(seed).problem,
  "show-work-percent-count": (seed) => percentCount.generate(seed).problem,
  "show-work-rental-plans": (seed) => rental.generate(seed).problem,
});
export const showWorkCases = {
  "show-work-box-cost": box.generate,
  "show-work-percent-count": percentCount.generate,
  "show-work-rental-plans": rental.generate,
};
