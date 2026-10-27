import type { TemplateMetadata } from "./contracts";
import { chainFamily, decimalText, dispatch, money, pick } from "./chain-kit";
import { workModeAxisNoOrder } from "./structured-work-kit";
import { rowsWork, workSurface, type RowSpec } from "./structured-work-rows";
import { defineAxis } from "./variation/axes";

/**
 * Two-credit constructed responses whose rating guides credit the shown
 * work: terms of a recursive sequence, the remainder of a polynomial division
 * by evaluation, the addition rule for two overlapping groups, the average
 * rate of change from a table and the whole number of items a budget or goal
 * allows. Each intermediate result is a labeled exact step graded on the
 * server; credit needs every step.
 */

const capability = "structured-work-v1" as const;
export const regentsWrittenWorkTemplates: readonly TemplateMetadata[] = [
  {
    id: "recursion-term-steps",
    version: 1,
    title: "Show the work: terms of a recursive sequence",
    skillId: "arithmetic-sequences",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Find the next terms of a sequence from its first term and a recursive rule that squares or doubles the previous term, entering each term in order.",
  },
  {
    id: "remainder-steps",
    version: 1,
    title: "Show the work: remainder of a polynomial division",
    skillId: "polynomial-division",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Find the remainder of a cubic divided by a linear factor by naming the value that makes the divisor zero and evaluating the cubic term by term.",
  },
  {
    id: "addition-rule-steps",
    version: 1,
    title: "Show the work: either of two overlapping groups",
    skillId: "probability-addition",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    requiredResponseCapability: capability,
    description:
      "Find the percent in one group or the other from the percent in each and in both, adding the two percents, subtracting the overlap, and finding the percent in neither.",
  },
  {
    id: "average-rate-steps",
    version: 1,
    title: "Show the work: average rate of change from a table",
    skillId: "average-rate-change",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Find the average rate of change of a quantity listed in a table of years between two of them: the change in the quantity, the change in years and the rate rounded to a whole number.",
  },
  {
    id: "budget-items-steps",
    version: 1,
    title: "Show the work: how many items fit a budget or reach a goal",
    skillId: "linear-inequalities",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: capability,
    description:
      "Write the inequality for a fixed amount plus a price per item against a budget or a goal, find the amount left to spend or still needed, and find the greatest or least whole number of items.",
  },
];

const task = (mode: "build" | "fill") =>
  mode === "build"
    ? "Enter each step."
    : "Some steps are filled in. Enter the others.";
const num = (value: string, unit?: string) =>
  ({
    caption: "Number",
    kind: "number" as const,
    value,
    ...(unit ? { unit } : {}),
  }) as const;
const group = (n: number) => n.toLocaleString("en-US");
const texNum = (n: number) => group(n).replace(/,/g, "{,}");

/* ------------------------------------------------------------ recursion */

type RecRule = "square-plus" | "double-square-minus" | "double-plus";
interface RecModel {
  rule: RecRule;
  a1: number;
  k: number;
  last: 3 | 4;
}
const next = (m: RecModel, a: number) =>
  m.rule === "square-plus"
    ? a * a + m.k
    : m.rule === "double-square-minus"
      ? 2 * a * a - m.k
      : 2 * a + m.k;
const ruleTex = (m: RecModel) =>
  m.rule === "square-plus"
    ? `a_n=(a_{n-1})^2+${m.k}`
    : m.rule === "double-square-minus"
      ? `a_n=2(a_{n-1})^2-${m.k}`
      : `a_n=2a_{n-1}+${m.k}`;
const recursion = chainFamily({
  template: regentsWrittenWorkTemplates[0]!,
  axes: {
    mode: workModeAxisNoOrder,
    rule: defineAxis("rule", [
      "square-plus",
      "double-square-minus",
      "double-plus",
    ] as const),
    last: defineAxis("last", ["3", "4"] as const),
  },
  model: (r, axes): RecModel => {
    const rule = axes.rule;
    const a1 = rule === "double-plus" ? r(2, 9) : r(2, 6);
    const k = r(1, 6);
    const last = axes.last === "3" ? 3 : 4;
    // A fourth term of a squaring rule would have 7 or more digits.
    if (last === 4 && rule !== "double-plus" && a1 > 4)
      throw new Error("Need three retry");
    return { rule, a1, k, last };
  },
  render: (m, axes, r) => {
    const terms = [m.a1];
    for (let i = 2; i <= m.last; i++) terms.push(next(m, terms[i - 2]!));
    const rows: RowSpec[] = [];
    for (let i = 2; i <= m.last; i++)
      rows.push({
        label: `The term $a_${i}$`,
        fields: [num(`${terms[i - 1]}`)],
      });
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const prev = (i: number) => terms[i - 2]!;
    const sub = (i: number) => {
      const p = prev(i);
      return m.rule === "double-plus"
        ? `2\\cdot${p}+${m.k}`
        : m.rule === "square-plus"
          ? `${p}^2+${m.k}`
          : `2\\cdot${p}^2-${m.k}`;
    };
    return workSurface(built, {
      prompt: `A sequence has $a_1=${m.a1}$ and $${ruleTex(m)}$ for $n\\ge2$. Find $a_${m.last}$, showing each term you need. ${task(axes.mode)}`,
      hint: `Each term comes from the one before it. Put $a_1=${m.a1}$ into $${ruleTex(m)}$ to get $a_2$, then put $a_2$ into the rule to get $a_3$. ${m.rule === "double-plus" ? `Double first, then add ${m.k}` : m.rule === "square-plus" ? `Square first, then add ${m.k}` : `Square first, then double and subtract ${m.k}`}.`,
      explanation: [
        ...terms.slice(1).map((t, i) => `$a_${i + 2}=${sub(i + 2)}=${t}$.`),
        `So $a_${m.last}=${terms[m.last - 1]}$.`,
      ],
    });
  },
  variant: (m) => `${m.rule}-term-${m.last}`,
});

/* ---------------------------------------------------------- remainder */

interface RemModel {
  coefficients: [number, number, number, number]; // a x^3 + b x^2 + c x + d
  root: number; // divisor is x - root
}
const polyText = (c: number[]) => {
  let out = "";
  c.forEach((v, i) => {
    if (v === 0) return;
    const d = c.length - 1 - i;
    const body =
      d === 0
        ? `${Math.abs(v)}`
        : `${Math.abs(v) === 1 ? "" : Math.abs(v)}x${d === 1 ? "" : `^${d}`}`;
    out += v < 0 ? `-${body}` : out ? `+${body}` : body;
  });
  return out;
};
const remainder = chainFamily({
  template: regentsWrittenWorkTemplates[1]!,
  axes: {
    mode: workModeAxisNoOrder,
    divisor: defineAxis("divisor", ["x-minus", "x-plus"] as const),
  },
  model: (r, axes): RemModel => {
    const a = pick(r, [1, 2, 3, 4, -1, -2, -3]);
    const b = pick(r, [0, 0, 1, 2, 3, -1, -2, -3]);
    const c = pick(r, [0, 1, 2, 3, 4, 5, -1, -2, -3, -4, -5]);
    const d = pick(r, [1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5]);
    const magnitude = r(1, 3);
    const root = axes.divisor === "x-minus" ? magnitude : -magnitude;
    return { coefficients: [a, b, c, d], root };
  },
  render: (m, axes, r) => {
    const [a, b, c, d] = m.coefficients;
    const x = m.root;
    const high = a * x ** 3 + b * x ** 2;
    const low = c * x + d;
    const f = high + low;
    const divisor = x > 0 ? `x-${x}` : `x+${-x}`;
    const rows: RowSpec[] = [
      {
        label: `The value of $x$ that makes $${divisor}$ equal to 0`,
        fields: [num(`${x}`)],
      },
      {
        label:
          b === 0
            ? `The value of $${polyText([a, 0, 0, 0])}$ at that $x$`
            : `The value of $${polyText([a, b, 0, 0])}$ at that $x$`,
        fields: [num(`${high}`)],
      },
      {
        label:
          c === 0
            ? `The value of $${d < 0 ? `-${-d}` : d}$ at that $x$`
            : `The value of $${polyText([c, d])}$ at that $x$`,
        fields: [num(`${low}`)],
      },
      { label: "The remainder", fields: [num(`${f}`)] },
    ];
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const fx = polyText([a, b, c, d]);
    const at = (v: number) => (v < 0 ? `(${v})` : `${v}`);
    return workSurface(built, {
      prompt: `Given $f(x)=${fx}$, find the remainder when $f(x)$ is divided by $${divisor}$. ${task(axes.mode)}`,
      hint: `By the remainder theorem, the remainder of dividing by $${divisor}$ is $f$ at the value of $x$ that makes $${divisor}$ zero. Substitute ${x} for $x$ in each term of $f(x)=${fx}$ and keep each sign.`,
      explanation: [
        `$${divisor}=0$ when $x=${x}$, so the remainder is $f(${x})$.`,
        `$${polyText([a, b, 0, 0]) || "0"}$ at $x=${x}$: $${a}\\cdot${at(x)}^3${b ? `${b < 0 ? "-" : "+"}${Math.abs(b)}\\cdot${at(x)}^2` : ""}=${high}$.`,
        `$${polyText([c, d]) || "0"}$ at $x=${x}$: $${c}\\cdot${at(x)}${d < 0 ? "-" : "+"}${Math.abs(d)}=${low}$.`,
        `$f(${x})=${high}${low < 0 ? "-" : "+"}${Math.abs(low)}=${f}$, so the remainder is ${f}.`,
      ],
    });
  },
  variant: (m) => (m.root > 0 ? "x-minus" : "x-plus"),
});

/* ------------------------------------------------------- addition rule */

const groups = [
  {
    whole: "students at a school",
    verb: "speak",
    a: "English",
    b: "Mandarin",
    tail: "fluently",
  },
  {
    whole: "members of a club",
    verb: "play",
    a: "soccer",
    b: "basketball",
    tail: "",
  },
  {
    whole: "people in a town",
    verb: "own",
    a: "a bicycle",
    b: "a car",
    tail: "",
  },
  {
    whole: "customers at a cafe",
    verb: "order",
    a: "coffee",
    b: "a pastry",
    tail: "",
  },
] as const;
interface AddModel {
  group: (typeof groups)[number];
  a: number;
  b: number;
  both: number;
  ask: "either" | "neither";
}
const addition = chainFamily({
  template: regentsWrittenWorkTemplates[2]!,
  axes: {
    mode: workModeAxisNoOrder,
    ask: defineAxis("ask", ["either", "neither"] as const),
  },
  model: (r, axes): AddModel => {
    const both = r(6, 30);
    const a = both + r(10, 50);
    const b = both + r(5, 40);
    if (a + b - both >= 96) throw new Error("Need three retry");
    return { group: pick(r, groups), a, b, both, ask: axes.ask };
  },
  render: (m, axes, r) => {
    const g = m.group;
    const sum = m.a + m.b;
    const either = sum - m.both;
    const rows: RowSpec[] = [
      {
        label: `The percents who ${g.verb} ${g.a} and who ${g.verb} ${g.b}, added`,
        fields: [num(`${sum}`, "%")],
      },
      {
        label: `The percent who ${g.verb} ${g.a} or ${g.b}`,
        fields: [num(`${either}`, "%")],
      },
      ...(m.ask === "neither"
        ? [
            {
              label: `The percent who ${g.verb} neither`,
              fields: [num(`${100 - either}`, "%")],
            } satisfies RowSpec,
          ]
        : []),
    ];
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const tail = g.tail ? ` ${g.tail}` : "";
    return workSurface(built, {
      prompt: `In a survey of ${g.whole}, ${m.a}% ${g.verb} ${g.a}${tail}, ${m.b}% ${g.verb} ${g.b}${tail}, and ${m.both}% ${g.verb} both. Find the percent who ${g.verb} ${m.ask === "either" ? `${g.a} or ${g.b}` : "neither"}. ${task(axes.mode)}`,
      hint: `The ${m.both}% who ${g.verb} both are counted in the ${m.a}% and again in the ${m.b}%. Add the two percents, then take that overlap away once.`,
      explanation: [
        `$${m.a}+${m.b}=${sum}$, which counts the ${m.both}% in both groups twice.`,
        `$${sum}-${m.both}=${either}$, so ${either}% ${g.verb} ${g.a} or ${g.b}.`,
        ...(m.ask === "neither"
          ? [
              `The rest, $100-${either}=${100 - either}$, ${g.verb} neither: ${100 - either}%.`,
            ]
          : []),
      ],
    });
  },
  variant: (m) => m.ask,
});

/* ------------------------------------------------------- average rate */

const places = [
  {
    what: "population",
    noun: "A town's population",
    be: "was",
    unit: "people",
  },
  {
    what: "enrollment",
    noun: "A college's enrollment",
    be: "was",
    unit: "students",
  },
  {
    what: "annual visitors",
    noun: "A park's annual visitors",
    be: "were",
    unit: "visitors",
  },
] as const;
interface RateModel {
  place: (typeof places)[number];
  step: 5 | 10;
  start: number;
  values: number[];
  from: number; // index in values
  to: number;
}
const rate = chainFamily({
  template: regentsWrittenWorkTemplates[3]!,
  axes: {
    mode: workModeAxisNoOrder,
    span: defineAxis("span", ["whole-table", "inner-years"] as const),
  },
  model: (r, axes): RateModel => {
    const step = pick(r, [5, 10] as const);
    const start = pick(r, [2010, 2020]) - 4 * step;
    const values = [r(900_000, 1_400_000)];
    for (let i = 1; i < 5; i++)
      values.push(values[i - 1]! + r(-90_000, 160_000));
    const from = axes.span === "whole-table" ? 0 : 1;
    const to = axes.span === "whole-table" ? 4 : 3;
    const years = (to - from) * step;
    const change = values[to]! - values[from]!;
    const quotient = change / years;
    // The rounding is unambiguous: no rate within 0.1 of a half.
    const fraction = Math.abs(quotient) % 1;
    if (Math.abs(fraction - 0.5) < 0.1 || change === 0)
      throw new Error("Need three retry");
    return { place: pick(r, places), step, start, values, from, to };
  },
  render: (m, axes, r) => {
    const year = (i: number) => m.start + i * m.step;
    const change = m.values[m.to]! - m.values[m.from]!;
    const years = (m.to - m.from) * m.step;
    const answer = Math.round(change / years);
    const rows: RowSpec[] = [
      {
        label: `Change in the ${m.place.what} from ${year(m.from)} to ${year(m.to)}`,
        fields: [num(`${change}`)],
      },
      {
        label: `Number of years from ${year(m.from)} to ${year(m.to)}`,
        fields: [num(`${years}`)],
      },
      {
        label: `Average rate of change per year, rounded to the nearest integer`,
        fields: [num(`${answer}`)],
      },
    ];
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const table = m.values.map((v, i) => `${year(i)}: ${group(v)}`).join("; ");
    return workSurface(built, {
      prompt: `${m.place.noun} ${m.place.be} recorded every ${m.step} years (${table}). Find the average rate of change of the ${m.place.what} per year between ${year(m.from)} and ${year(m.to)}, rounded to the nearest integer. ${task(axes.mode)}`,
      hint: `The average rate of change is the change in the ${m.place.what} divided by the change in years. Use only the values for ${year(m.from)} and ${year(m.to)}, and subtract the earlier from the later.`,
      explanation: [
        `Change: $${texNum(m.values[m.to]!)}-${texNum(m.values[m.from]!)}=${change < 0 ? "-" : ""}${texNum(Math.abs(change))}$.`,
        `Years: $${year(m.to)}-${year(m.from)}=${years}$.`,
        `Rate: $\\frac{${change < 0 ? "-" : ""}${texNum(Math.abs(change))}}{${years}}=${decimalText(Math.round((change / years) * 1000), 1000)}$ about, which rounds to ${answer} ${m.place.unit} per year.`,
      ],
    });
  },
  variant: (m) => (m.to - m.from === 4 ? "whole-table" : "inner-years"),
});

/* ---------------------------------------------------- budget or goal */

const spends = [
  {
    who: "Abby",
    fixed: "food coupons",
    item: "ride tickets",
    cost: 225,
    limit: 2000,
    fee: 850,
  },
  {
    who: "Marcus",
    fixed: "an entry pass",
    item: "game tokens",
    cost: 150,
    limit: 1800,
    fee: 600,
  },
  {
    who: "Lena",
    fixed: "a booth fee",
    item: "craft kits",
    cost: 275,
    limit: 3000,
    fee: 1250,
  },
] as const;
interface BudgetModel {
  who: string;
  fixed: string;
  item: string;
  cost: number; // cents per item
  fee: number; // cents
  limit: number; // cents
  goal: boolean;
}
const dollarText = (cents: number) =>
  cents % 100 === 0 ? `${cents / 100}` : decimalText(cents, 100);
const budget = chainFamily({
  template: regentsWrittenWorkTemplates[4]!,
  axes: {
    mode: workModeAxisNoOrder,
    limit: defineAxis("limit", ["budget", "goal"] as const),
  },
  model: (r, axes): BudgetModel => {
    const s = pick(r, spends);
    const cost = s.cost + pick(r, [-25, 0, 25, 50]);
    const fee = s.fee + pick(r, [-100, 0, 150, 300]);
    const limit = s.limit + pick(r, [0, 500, 1000]);
    const left = limit - fee;
    if (left <= 0 || left % cost === 0) throw new Error("Need three retry");
    const quotient = left / cost;
    if (Math.abs((quotient % 1) - 0.5) < 0.05)
      throw new Error("Need three retry");
    return { ...s, cost, fee, limit, goal: axes.limit === "goal" };
  },
  render: (m, axes, r) => {
    const left = m.limit - m.fee;
    const n = m.goal ? Math.ceil(left / m.cost) : Math.floor(left / m.cost);
    const rel = m.goal ? "\\ge" : "\\le";
    const inequality = `${dollarText(m.fee)}+${dollarText(m.cost)}n${m.goal ? ">=" : "<="}${dollarText(m.limit)}`;
    const rows: RowSpec[] = [
      {
        label: m.goal
          ? `Inequality for $n$ ${m.item}: the total is at least the goal`
          : `Inequality for $n$ ${m.item}: the total is at most the budget`,
        fields: [
          {
            caption: "Inequality",
            kind: "expression",
            value: inequality,
            match: "sides",
            relations: true,
            inequality: true,
            variables: ["n"],
            maxLength: 24,
          },
        ],
      },
      {
        label: m.goal
          ? "Dollars still needed after the fixed amount"
          : "Dollars left for the items after the fixed amount",
        fields: [num(dollarText(left), "dollars")],
      },
      {
        label: m.goal
          ? `Least whole number of ${m.item}`
          : `Greatest whole number of ${m.item}`,
        fields: [num(`${n}`)],
      },
    ];
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const prompt = m.goal
      ? `${m.who} has already earned ${money(m.fee)} toward a goal of ${money(m.limit)} and earns ${money(m.cost)} for each of $n$ ${m.item} sold. Find the least whole number of ${m.item} that reaches the goal. ${task(axes.mode)}`
      : `${m.who} has ${money(m.limit)} to spend. ${m.who} pays ${money(m.fee)} for ${m.fixed} and then buys $n$ ${m.item} at ${money(m.cost)} each. Find the greatest whole number of ${m.item} ${m.who} can buy. ${task(axes.mode)}`;
    return workSurface(built, {
      prompt,
      hint: m.goal
        ? `The total is the amount already earned plus ${money(m.cost)} times $n$, and it must reach ${money(m.limit)}. Subtract what is already earned to see how much is still needed, then decide whether to round up or down.`
        : `The total spent is ${money(m.fee)} plus ${money(m.cost)} times $n$, and it cannot be more than ${money(m.limit)}. Subtract the fixed amount first, then divide by the price and round down.`,
      explanation: [
        `The total is $${dollarText(m.fee)}+${dollarText(m.cost)}n$, so $${dollarText(m.fee)}+${dollarText(m.cost)}n${rel}${dollarText(m.limit)}$.`,
        `$${dollarText(m.limit)}-${dollarText(m.fee)}=${dollarText(left)}$ dollars, so $${dollarText(m.cost)}n${rel}${dollarText(left)}$.`,
        `Dividing by ${dollarText(m.cost)} gives $n${rel}${(left / m.cost).toFixed(2)}$ to the nearest hundredth. ${m.goal ? "Fewer items fall short of the goal, so the least whole number" : "More items go over the budget, so the greatest whole number"} is ${n}.`,
      ],
    });
  },
  variant: (m) => (m.goal ? "goal" : "budget"),
});

export const regentsWrittenWorkGenerate = dispatch(
  regentsWrittenWorkTemplates,
  {
    "recursion-term-steps": (seed) => recursion.generate(seed).problem,
    "remainder-steps": (seed) => remainder.generate(seed).problem,
    "addition-rule-steps": (seed) => addition.generate(seed).problem,
    "average-rate-steps": (seed) => rate.generate(seed).problem,
    "budget-items-steps": (seed) => budget.generate(seed).problem,
  },
);
export const regentsWrittenWorkCases = {
  "recursion-term-steps": recursion.generate,
  "remainder-steps": remainder.generate,
  "addition-rule-steps": addition.generate,
  "average-rate-steps": rate.generate,
  "budget-items-steps": budget.generate,
};
