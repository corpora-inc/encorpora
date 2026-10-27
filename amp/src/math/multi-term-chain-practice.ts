import type { TemplateMetadata } from "./contracts";
import { lineTable } from "./scene/author";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  decimalText,
  dispatch,
  dollars,
  gcd,
  money,
  numberSurface,
  pick,
} from "./chain-kit";

/**
 * Chains of three or more terms: unlike fractions, decimals renamed as
 * fractions (or the reverse), prices and counts, rates read from a table, and
 * signed changes. Each family keeps ONE exact model (every term and every
 * intermediate value) and renders the prompt, table, hint and worked steps
 * from it.
 */
export const fractionTermChainTemplate: TemplateMetadata = {
  id: "fraction-term-chain",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  title: "Add and subtract three or four unlike fractions",
  skillId: "fraction-addition",
  gradeBand: "3–5",
  difficultyOffset: 0.65,
  description:
    "Combine three or four fractions and mixed numbers with different denominators, one possibly a decimal, from a table, a story or a written expression.",
};
export const decimalRenameChainTemplate: TemplateMetadata = {
  id: "decimal-rename-chain",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  title: "Rename a fraction or add decimal weights from a table",
  skillId: "decimal-algorithms",
  gradeBand: "6–8",
  difficultyOffset: 0.5,
  description:
    "Subtract a fraction from a decimal, evaluate a decimal minus a mixed number times a whole number, or add, subtract and find a missing decimal weight from a table.",
};
export const priceCountChainTemplate: TemplateMetadata = {
  id: "price-count-chain",
  version: 1,
  title: "Prices and counts for a group",
  skillId: "decimal-arithmetic",
  gradeBand: "3–5",
  difficultyOffset: 0.5,
  description:
    "Add two prices and multiply by the number of people, or multiply each price by its own count and add, giving dollars and cents.",
};
export const dollarRateScaleTemplate: TemplateMetadata = {
  id: "dollar-rate-scale",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  title: "Scale a dollar rate read from a table",
  skillId: "ratio-tables",
  gradeBand: "6–8",
  difficultyOffset: 0.45,
  description:
    "Find the charge for a new number of hours, or the hours for a charge, when a table lists the charge for two numbers of hours at one price per hour.",
};
export const signedChangesSumTemplate: TemplateMetadata = {
  id: "signed-changes-sum",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  title: "Add five to seven signed changes",
  skillId: "signed-addition",
  gradeBand: "6–8",
  difficultyOffset: 0.4,
  description:
    "Read a table of daily gains and losses and find the net change, or the final count from a starting count.",
};

/* ----------------------------------------------------------------- helpers */
type R = (lo: number, hi: number) => number;
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const lcmAll = (ds: number[]) => ds.reduce(lcm, 1);
const coprimeRemainder = (r: R, d: number) => {
  for (let i = 0; i < 40; i++) {
    const rem = r(1, d - 1);
    if (gcd(rem, d) === 1) return rem;
  }
  throw new Error("Need three retries");
};
/** n/d as a fraction in lowest terms, or the whole number. */
const ratioText = (n: number, d: number) => {
  const g = gcd(n, d) || 1;
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
};
const texQ = (n: number, d: number) => {
  const whole = Math.floor(n / d);
  const rest = n - whole * d;
  if (!rest) return String(whole);
  const frac = `\\frac{${rest}}{${d}}`;
  return whole ? `${whole}${frac}` : frac;
};
const cellQ = (n: number, d: number) => {
  const whole = Math.floor(n / d);
  const rest = n - whole * d;
  if (!rest) return String(whole);
  return whole ? `${whole} ${rest}/${d}` : `${rest}/${d}`;
};
const improperTex = (n: number, d: number) => `\\frac{${n}}{${d}}`;
const list = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const figureOf = (rows: string[][], header: "row" | "column" = "row") => ({
  kind: "scene" as const,
  scene: lineTable(rows, { header }).scene(),
});
/** A decimal text for a value in hundredths. */
const hundredths = (v: number) => decimalText(v, 100);
const signed = (v: number) => (v < 0 ? `−${-v}` : `+${v}`);

/* ----------------------------------------------------- fraction term chain */
const fractionAxes = {
  shape: defineAxis("shape", [
    "sum-of-three",
    "whole-minus-three",
    "sum-and-difference",
    "uses-from-start",
    "decimal-among-fractions",
  ] as const),
};
type FractionShape =
  | "sum-of-three"
  | "whole-minus-three"
  | "sum-and-difference"
  | "uses-from-start"
  | "decimal-among-fractions";
interface Part {
  sign: 1 | -1;
  /** The value n/d, improper, in the form the story states it. */
  n: number;
  d: number;
  decimal?: boolean;
}
interface FractionModel {
  shape: FractionShape;
  parts: Part[];
  context: number;
  /** Common denominator and the exact result as a numerator over it. */
  common: number;
  total: number;
}
const sumCombos = [
  [2, 4, 8],
  [3, 4, 6],
  [2, 3, 6],
  [4, 6, 12],
  [3, 6, 12],
  [2, 3, 4],
  [4, 8, 2],
] as const;
const exprCombos = [
  [12, 5, 10],
  [4, 6, 9],
  [8, 3, 6],
  [6, 10, 15],
  [4, 5, 10],
] as const;
function fractionModel(r: R, ax: { shape: FractionShape }): FractionModel {
  const shape = ax.shape;
  const parts: Part[] = [];
  const mixed = (d: number, lo: number, hi: number, sign: 1 | -1): Part => ({
    sign,
    n: r(lo, hi) * d + coprimeRemainder(r, d),
    d,
  });
  const proper = (d: number, sign: 1 | -1): Part => ({
    sign,
    n: coprimeRemainder(r, d),
    d,
  });
  if (shape === "sum-of-three") {
    for (const d of pick(r, sumCombos)) parts.push(mixed(d, 1, 4, 1));
  } else if (shape === "whole-minus-three") {
    parts.push({ sign: 1, n: r(8, 12), d: 1 });
    for (const d of pick(r, sumCombos)) parts.push(mixed(d, 1, 2, -1));
  } else if (shape === "sum-and-difference") {
    const [d1, d2, d3] = pick(r, exprCombos);
    parts.push(proper(d1, 1), proper(d2, 1), proper(d3, -1));
  } else if (shape === "uses-from-start") {
    parts.push({ sign: 1, n: r(3, 6), d: 1 });
    const dens = [16, 8, 4, pick(r, [16, 8, 4] as const)];
    for (let i = dens.length - 1; i > 0; i--) {
      const j = r(0, i);
      [dens[i], dens[j]] = [dens[j]!, dens[i]!];
    }
    for (const d of dens) parts.push(proper(d, -1));
  } else {
    const [d1, d2] = [
      pick(r, [2, 4, 5] as const),
      pick(r, [2, 4, 10] as const),
    ];
    const decimalDen = pick(r, [2, 4, 5, 10] as const);
    const decimal = mixed(decimalDen, 0, 2, 1);
    decimal.decimal = true;
    const fractions = [mixed(d1, 0, 2, 1), mixed(d2, 0, 2, 1)];
    const at = r(0, 2);
    parts.push(...fractions);
    parts.splice(at, 0, decimal);
    if (new Set(parts.map((p) => p.d)).size < 2)
      throw new Error("Need three retries");
  }
  const common = lcmAll(parts.map((p) => p.d));
  const total = parts.reduce((s, p) => s + (p.sign * p.n * common) / p.d, 0);
  if (total <= 0 || common > 60 || total / common > 40)
    throw new Error("Need three retries");
  // Every partial result stays positive, so the story makes sense.
  let running = 0;
  for (const p of parts) {
    running += (p.sign * p.n * common) / p.d;
    if (running < 0) throw new Error("Need three retries");
  }
  return { shape, parts, context: r(0, 2), common, total };
}
const walkContexts = [
  {
    intro:
      "The table shows how many miles a hiker walked on each of three days.",
    col: "Day",
    row: "Miles",
    heads: ["Mon", "Tue", "Wed"],
    ask: "How many miles did the hiker walk in all?",
    what: "distances",
    unit: "miles",
  },
  {
    intro:
      "The table shows how many yards of ribbon were used for each of three banners.",
    col: "Banner",
    row: "Yards",
    heads: ["1", "2", "3"],
    ask: "How many yards of ribbon were used in all?",
    what: "lengths",
    unit: "yards",
  },
  {
    intro:
      "The table shows how many inches of rain fell on each of three days.",
    col: "Day",
    row: "Inches",
    heads: ["Sat", "Sun", "Mon"],
    ask: "How many inches of rain fell in all?",
    what: "amounts",
    unit: "inches",
  },
];
const leftContexts = [
  {
    start: "A bakery had {W} pies.",
    intro: "The table shows how many pies were served at each of three times.",
    col: "Time",
    row: "Pies served",
    heads: ["Lunch", "Snack", "Dinner"],
    ask: "How many pies are left?",
    unit: "pies",
  },
  {
    start: "A coil of rope was {W} meters long.",
    intro:
      "The table shows how many meters were cut off for each of three jobs.",
    col: "Job",
    row: "Meters cut",
    heads: ["1", "2", "3"],
    ask: "How many meters of rope are left?",
    unit: "meters",
  },
  {
    start: "A tank held {W} gallons of paint.",
    intro: "The table shows how many gallons were used on each of three days.",
    col: "Day",
    row: "Gallons used",
    heads: ["Mon", "Tue", "Wed"],
    ask: "How many gallons of paint are left?",
    unit: "gallons",
  },
];
const useContexts = [
  {
    holder: "A carton held",
    stuff: "milk",
    unit: "gallons",
    one: "a gallon",
    ask: "How many gallons of milk are left?",
  },
  {
    holder: "A bag held",
    stuff: "flour",
    unit: "cups",
    one: "a cup",
    ask: "How many cups of flour are left?",
  },
  {
    holder: "A can held",
    stuff: "paint",
    unit: "quarts",
    one: "a quart",
    ask: "How many quarts of paint are left?",
  },
];
const rideContexts = [
  {
    who: "A cyclist rode",
    unit: "miles",
    ask: "How many miles did the cyclist ride in all?",
  },
  {
    who: "A runner jogged",
    unit: "miles",
    ask: "How many miles did the runner jog in all?",
  },
  {
    who: "A boat traveled",
    unit: "miles",
    ask: "How many miles did the boat travel in all?",
  },
];
const FRACTION_ENTRY =
  " Enter the answer as a fraction, a decimal or a whole number.";
const fractionTermChain = chainFamily({
  template: fractionTermChainTemplate,
  axes: fractionAxes,
  model: fractionModel,
  variant: (m) => m.shape,
  render: (m) => {
    const L = m.common;
    const ps = m.parts;
    const answer = ratioText(m.total, L);
    const t = m.total;
    const resultLine = () => {
      const g = gcd(t, L);
      const whole = Math.floor(t / L);
      return t % L === 0
        ? `The result is $${t / L}$.`
        : whole
          ? `In lowest terms the result is $\\frac{${t / g}}{${L / g}}$, or $${texQ(t, L)}$ as a mixed number.`
          : `In lowest terms the result is $\\frac{${t / g}}{${L / g}}$.`;
    };
    const rewriteLine = (rename: (p: Part) => string) =>
      `Rewrite every term with the common denominator $${L}$: ${list(ps.map(rename))}.`;
    const toL = (p: Part) => (p.n * L) / p.d;
    const sumLine = () => {
      const first = `${toL(ps[0]!)}`;
      const rest = ps
        .slice(1)
        .map((p) => ` ${p.sign > 0 ? "+" : "-"} ${toL(p)}`)
        .join("");
      return `Combine the numerators: $\\frac{${first}${rest}}{${L}}=\\frac{${t}}{${L}}$.`;
    };
    const dens = [...new Set(ps.filter((p) => p.d > 1).map((p) => p.d))];
    const denList = list(dens.map(String));
    const baseHint = `The denominators are ${denList}, so rewrite every term with a common denominator such as ${L} before you combine them.`;

    if (m.shape === "sum-of-three") {
      const c = walkContexts[m.context]!;
      const surface = numberSurface({
        prompt: `${c.intro} ${c.ask}${FRACTION_ENTRY}`,
        answer,
        hint: baseHint,
        explanation: [
          rewriteLine((p) => `$${texQ(p.n, p.d)}=${improperTex(toL(p), L)}$`),
          sumLine(),
          resultLine(),
        ],
        fraction: true,
        label: `Answer (${c.unit})`,
      });
      return {
        ...surface,
        figure: figureOf(
          [
            [c.col, ...c.heads],
            [c.row, ...ps.map((p) => cellQ(p.n, p.d))],
          ],
          "column",
        ),
      };
    }
    if (m.shape === "whole-minus-three") {
      const c = leftContexts[m.context]!;
      const surface = numberSurface({
        prompt: `${c.start.replace("{W}", String(ps[0]!.n))} ${c.intro} ${c.ask}${FRACTION_ENTRY}`,
        answer,
        hint: `Start from ${ps[0]!.n}. The three amounts have denominators ${denList}, so rewrite each with a common denominator such as ${L} and take them away one at a time or all together.`,
        explanation: [
          rewriteLine((p) => `$${texQ(p.n, p.d)}=${improperTex(toL(p), L)}$`),
          sumLine(),
          resultLine(),
        ],
        fraction: true,
        label: `Answer (${c.unit})`,
      });
      return {
        ...surface,
        figure: figureOf(
          [
            [c.col, ...c.heads],
            [c.row, ...ps.slice(1).map((p) => cellQ(p.n, p.d))],
          ],
          "column",
        ),
      };
    }
    if (m.shape === "sum-and-difference") {
      const [a, b, c] = ps as [Part, Part, Part];
      const f = (p: Part) => improperTex(p.n, p.d);
      return numberSurface({
        prompt: `What is the value of $${f(a)}+${f(b)}-${f(c)}$?${FRACTION_ENTRY}`,
        answer,
        hint: `The denominators are ${denList}. Find a number that all three divide into, such as ${L}, and rewrite $${f(a)}$, $${f(b)}$ and $${f(c)}$ with it.`,
        explanation: [
          rewriteLine((p) => `$${f(p)}=${improperTex(toL(p), L)}$`),
          sumLine(),
          resultLine(),
        ],
        fraction: true,
        label: "Answer (fraction, decimal, or whole number)",
      });
    }
    if (m.shape === "uses-from-start") {
      const c = useContexts[m.context]!;
      const uses = ps.slice(1);
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday"];
      const usesText = list(
        uses.map((p, i) => `${days[i]} $\\frac{${p.n}}{${p.d}}$ of ${c.one}`),
      );
      return numberSurface({
        prompt: `${c.holder} ${ps[0]!.n} ${c.unit} of ${c.stuff}. It was used over four days: ${usesText}. ${c.ask}${FRACTION_ENTRY}`,
        answer,
        hint: `The four amounts used have denominators ${denList}. Rewrite them all with ${L} as the denominator, add the uses, and take that total away from ${ps[0]!.n}.`,
        explanation: [
          rewriteLine((p) =>
            p.d === 1
              ? `$${p.n}=${improperTex(toL(p), L)}$`
              : `$${improperTex(p.n, p.d)}=${improperTex(toL(p), L)}$`,
          ),
          sumLine(),
          resultLine(),
        ],
        fraction: true,
        label: `Answer (${c.unit})`,
      });
    }
    const c = rideContexts[m.context]!;
    const shown = (p: Part) =>
      p.decimal ? decimalText(p.n, p.d) : `$${texQ(p.n, p.d)}$`;
    const dec = ps.find((p) => p.decimal)!;
    const decText = decimalText(dec.n, dec.d);
    return numberSurface({
      prompt: `${c.who} ${shown(ps[0]!)} ${c.unit}, then ${shown(ps[1]!)} ${c.unit}, then ${shown(ps[2]!)} ${c.unit}. ${c.ask}${FRACTION_ENTRY}`,
      answer,
      hint: `One distance is the decimal ${decText}. Write it as a fraction, ${dec.n} over ${dec.d}, so all three distances are fractions, then use a common denominator such as ${L}.`,
      explanation: [
        `Write ${decText} as a fraction: $${decText}=${improperTex(dec.n, dec.d)}$.`,
        rewriteLine((p) => `$${texQ(p.n, p.d)}=${improperTex(toL(p), L)}$`),
        sumLine(),
        resultLine(),
      ],
      fraction: true,
      label: `Answer (${c.unit})`,
    });
  },
});

/* ----------------------------------------------------- decimal rename chain */
const decimalAxes = {
  shape: defineAxis("shape", [
    "fraction-to-decimal",
    "decimal-minus-product",
    "table-add-subtract",
    "table-missing-weight",
  ] as const),
};
type DecimalShape =
  | "fraction-to-decimal"
  | "decimal-minus-product"
  | "table-add-subtract"
  | "table-missing-weight";
interface DecimalModel {
  shape: DecimalShape;
  /** Hundredths (decimals and weights). */
  a: number;
  b: number;
  c: number;
  /** Fraction or mixed number p/q (fraction-to-decimal, decimal-minus-product). */
  whole: number;
  num: number;
  den: number;
  times: number;
  plus: boolean;
  context: number;
}
const weightContexts = [
  {
    stuff: "scrap metal",
    unit: "kilograms",
    place: "A recycling yard",
    total: "A bin of scrap metal",
  },
  {
    stuff: "recycled paper",
    unit: "pounds",
    place: "A school",
    total: "A bin of recycled paper",
  },
  {
    stuff: "compost",
    unit: "kilograms",
    place: "A community garden",
    total: "A bin of compost",
  },
];
const weightDays = ["Mon", "Tue", "Wed"];
function decimalModel(r: R, ax: { shape: DecimalShape }): DecimalModel {
  const base: DecimalModel = {
    shape: ax.shape,
    a: 0,
    b: 0,
    c: 0,
    whole: 0,
    num: 0,
    den: 1,
    times: 1,
    plus: false,
    context: r(0, weightContexts.length - 1),
  };
  if (ax.shape === "fraction-to-decimal") {
    const den = pick(r, [2, 4, 5, 10, 20, 25] as const);
    const num = coprimeRemainder(r, den);
    const whole = r(0, 1);
    const frac = (whole * den + num) * (100 / den);
    const plus = r(0, 3) === 0;
    const a = plus ? r(10, 200) : frac + r(5, 150);
    return { ...base, a, whole, num, den, plus, b: frac };
  }
  if (ax.shape === "decimal-minus-product") {
    const den = pick(r, [2, 4, 5] as const);
    const whole = r(1, 4);
    const num = coprimeRemainder(r, den);
    const times = r(2, 6);
    const product = (whole * den + num) * times * (100 / den);
    const a = r(60, 3000);
    return {
      ...base,
      a: Math.round(a / 10) * 10,
      whole,
      num,
      den,
      times,
      b: product,
    };
  }
  const a = r(210, 899);
  const b = r(210, 899);
  const c = r(110, Math.min(a + b - 100, 799));
  return { ...base, a, b, c };
}
const decimalRenameChain = chainFamily({
  template: decimalRenameChainTemplate,
  axes: decimalAxes,
  model: decimalModel,
  variant: (m) => m.shape,
  render: (m) => {
    const ctx = weightContexts[m.context]!;
    const dec = hundredths;
    if (m.shape === "fraction-to-decimal") {
      const mixedTexVal = texQ(m.whole * m.den + m.num, m.den);
      const asDecimal = hundredths(m.b);
      const op = m.plus ? "+" : "-";
      const result = m.plus ? m.a + m.b : m.a - m.b;
      return numberSurface({
        prompt: `Evaluate $${dec(m.a)}${op}${mixedTexVal}$. Enter the answer as a decimal.`,
        answer: dec(result),
        hint: `The fraction $${mixedTexVal}$ has denominator ${m.den}. Write it as a decimal first: divide ${m.whole * m.den + m.num} by ${m.den}. Then ${m.plus ? "add" : "subtract"} the two decimals.`,
        explanation: [
          `Rename the fraction as a decimal: $${mixedTexVal}=${asDecimal}$.`,
          `${m.plus ? "Add" : "Subtract"} with the decimal points lined up: $${dec(m.a)}${op}${asDecimal}=${dec(result)}$.`,
          `The value is $${dec(result)}$.`,
        ],
      });
    }
    if (m.shape === "decimal-minus-product") {
      const mixedVal = texQ(m.whole * m.den + m.num, m.den);
      const productValue = m.b;
      const result = m.a - productValue;
      const improper = `\\frac{${m.whole * m.den + m.num}}{${m.den}}`;
      return numberSurface({
        prompt: `Evaluate $${dec(m.a)}-${mixedVal}\\times ${m.times}$. Enter the answer as a decimal.`,
        answer: dec(result),
        hint: `Multiply before you subtract: find $${mixedVal}\\times ${m.times}$ first. Write $${mixedVal}$ as the improper fraction $${improper}$, or as a decimal, to multiply by ${m.times}.`,
        explanation: [
          `Multiplication comes before subtraction: $${mixedVal}\\times ${m.times}=${improper}\\times ${m.times}=${dec(productValue)}$.`,
          `Subtract the product from ${dec(m.a)}: $${dec(m.a)}-${dec(productValue)}=${dec(result)}$.`,
          `The value is $${dec(result)}$${result < 0 ? ", a negative number because the product is larger" : ""}.`,
        ],
      });
    }
    const unit = ctx.unit;
    if (m.shape === "table-add-subtract") {
      const result = m.a + m.b - m.c;
      const surface = numberSurface({
        prompt: `${ctx.place} collects ${ctx.stuff}. The table shows the weight added on Monday and on Tuesday and the weight taken away on Wednesday. How many ${unit} of ${ctx.stuff} are left? Enter the answer as a decimal.`,
        answer: dec(result),
        hint: `Add the two weights that were added, ${dec(m.a)} and ${dec(m.b)}, lining up the decimal points. Then take away ${dec(m.c)}.`,
        explanation: [
          `Add the weights collected on the first two days: $${dec(m.a)}+${dec(m.b)}=${dec(m.a + m.b)}$.`,
          `Take away Wednesday's weight: $${dec(m.a + m.b)}-${dec(m.c)}=${dec(result)}$.`,
          `The amount left is ${dec(result)} ${unit}.`,
        ],
        label: `Answer (${unit})`,
      });
      return {
        ...surface,
        figure: figureOf(
          [
            ["Day", "Mon (added)", "Tue (added)", "Wed (taken away)"],
            [`Weight (${unit})`, dec(m.a), dec(m.b), dec(m.c)],
          ],
          "column",
        ),
      };
    }
    const total = m.a + m.b + m.c;
    const surface = numberSurface({
      prompt: `${ctx.total} was filled over three days and weighs ${dec(total)} ${unit} in all. The table shows the weight added on Monday and on Tuesday. How many ${unit} were added on Wednesday? Enter the answer as a decimal.`,
      answer: dec(m.c),
      hint: `The three days add to ${dec(total)}. Add the two known weights ${dec(m.a)} and ${dec(m.b)}, then subtract that sum from ${dec(total)}.`,
      explanation: [
        `The first two days added $${dec(m.a)}+${dec(m.b)}=${dec(m.a + m.b)}$.`,
        `Subtract from the total: $${dec(total)}-${dec(m.a + m.b)}=${dec(m.c)}$.`,
        `The weight added on Wednesday is ${dec(m.c)} ${unit}.`,
      ],
      label: `Answer (${unit})`,
    });
    return {
      ...surface,
      figure: figureOf(
        [
          ["Day", ...weightDays],
          [`Weight (${unit})`, dec(m.a), dec(m.b), "?"],
        ],
        "column",
      ),
    };
  },
});

/* ------------------------------------------------------ price and count chain */
const priceAxes = {
  shape: defineAxis("shape", [
    "one-each-for-group",
    "separate-counts",
  ] as const),
};
interface PriceModel {
  shape: "one-each-for-group" | "separate-counts";
  /** Cents. */
  first: number;
  second: number;
  people: number;
  others: number;
  context: number;
}
const goods = [
  { a: "ticket", as: "tickets", b: "drink", bs: "drinks", where: "the fair" },
  {
    a: "notebook",
    as: "notebooks",
    b: "pen",
    bs: "pens",
    where: "the school store",
  },
  {
    a: "sandwich",
    as: "sandwiches",
    b: "juice",
    bs: "juices",
    where: "the cafe",
  },
  {
    a: "puzzle",
    as: "puzzles",
    b: "card game",
    bs: "card games",
    where: "the toy shop",
  },
] as const;
function priceModel(r: R, ax: { shape: PriceModel["shape"] }): PriceModel {
  const people = r(12, 24);
  const others = r(8, 20);
  if (people === others && ax.shape === "separate-counts")
    throw new Error("Need three retries");
  return {
    shape: ax.shape,
    first: 5 * r(70, 260),
    second: 5 * r(30, 160),
    people,
    others,
    context: r(0, goods.length - 1),
  };
}
const priceCountChain = chainFamily({
  template: priceCountChainTemplate,
  axes: priceAxes,
  model: priceModel,
  variant: (m) => m.shape,
  render: (m) => {
    const g = goods[m.context]!;
    const d = (cents: number) => dollars(cents);
    if (m.shape === "one-each-for-group") {
      const each = m.first + m.second;
      const total = each * m.people;
      return numberSurface({
        prompt: `At ${g.where}, a ${g.a} costs ${money(m.first)} and a ${g.b} costs ${money(m.second)}. Each of ${m.people} people buys one ${g.a} and one ${g.b}. How much do they spend in all? Enter the answer in dollars.`,
        answer: d(total),
        hint: `Find what one person spends first: add ${d(m.first)} and ${d(m.second)}. Then think about ${m.people} people each spending that amount.`,
        explanation: [
          `One person spends $${d(m.first)}+${d(m.second)}=${d(each)}$ dollars.`,
          `${m.people} people spend $${m.people}\\times ${d(each)}=${d(total)}$ dollars.`,
          `They spend ${money(total)} in all.`,
        ],
        label: "Answer (dollars)",
      });
    }
    const costA = m.first * m.people;
    const costB = m.second * m.others;
    const total = costA + costB;
    return numberSurface({
      prompt: `At ${g.where}, a ${g.a} costs ${money(m.first)} and a ${g.b} costs ${money(m.second)}. A group buys ${m.people} ${g.as} and ${m.others} ${g.bs}. How much do they spend in all? Enter the answer in dollars.`,
      answer: d(total),
      hint: `The two kinds cost different amounts. Multiply ${d(m.first)} by ${m.people} for the ${g.as}, and ${d(m.second)} by ${m.others} for the ${g.bs}, then combine.`,
      explanation: [
        `The ${g.as} cost $${m.people}\\times ${d(m.first)}=${d(costA)}$ dollars.`,
        `The ${g.bs} cost $${m.others}\\times ${d(m.second)}=${d(costB)}$ dollars.`,
        `Together: $${d(costA)}+${d(costB)}=${d(total)}$ dollars.`,
      ],
      label: "Answer (dollars)",
    });
  },
});

/* ------------------------------------------------------- dollar rate scaling */
const rateAxes = {
  ask: defineAxis("ask", ["charge-for-hours", "hours-for-charge"] as const),
};
interface RateModel {
  ask: "charge-for-hours" | "hours-for-charge";
  /** Cents per hour. */
  rate: number;
  h1: number;
  h2: number;
  target: number;
  context: number;
}
const rentals = [
  { what: "A bike shop", item: "a bike", unit: "hours" },
  { what: "A boat dock", item: "a kayak", unit: "hours" },
  { what: "A study center", item: "a study room", unit: "hours" },
];
function rateModel(r: R, ax: { ask: RateModel["ask"] }): RateModel {
  const h1 = r(2, 4);
  const h2 = h1 + r(1, 3);
  return {
    ask: ax.ask,
    rate: 25 * r(13, 44),
    h1,
    h2,
    target: r(7, 12),
    context: r(0, rentals.length - 1),
  };
}
const dollarRateScale = chainFamily({
  template: dollarRateScaleTemplate,
  axes: rateAxes,
  model: rateModel,
  variant: (m) => m.ask,
  render: (m) => {
    const c = rentals[m.context]!;
    const d = dollars;
    const figure = figureOf(
      [
        ["Hours", String(m.h1), String(m.h2)],
        ["Charge (dollars)", d(m.h1 * m.rate), d(m.h2 * m.rate)],
      ],
      "column",
    );
    const unitStep = `Find the charge for 1 hour: divide ${d(m.h1 * m.rate)} by ${m.h1}.`;
    if (m.ask === "charge-for-hours") {
      return {
        ...numberSurface({
          prompt: `${c.what} charges the same price for each hour a customer uses ${c.item}. The table shows the charge for ${m.h1} hours and for ${m.h2} hours. What is the charge for ${m.target} hours? Enter the answer in dollars.`,
          answer: d(m.target * m.rate),
          hint: `${unitStep} Then use that price for ${m.target} hours.`,
          explanation: [
            `Each hour costs $${d(m.h1 * m.rate)}\\div ${m.h1}=${d(m.rate)}$ dollars. Check: $${m.h2}\\times ${d(m.rate)}=${d(m.h2 * m.rate)}$, as in the table.`,
            `${m.target} hours cost $${m.target}\\times ${d(m.rate)}=${d(m.target * m.rate)}$ dollars.`,
          ],
          label: "Answer (dollars)",
        }),
        figure,
      };
    }
    return {
      ...numberSurface({
        prompt: `${c.what} charges the same price for each hour a customer uses ${c.item}. The table shows the charge for ${m.h1} hours and for ${m.h2} hours. A customer pays ${money(m.target * m.rate)}. For how many hours is that?`,
        answer: String(m.target),
        hint: `${unitStep} Then count how many of those hourly prices make up ${d(m.target * m.rate)}.`,
        explanation: [
          `Each hour costs $${d(m.h1 * m.rate)}\\div ${m.h1}=${d(m.rate)}$ dollars.`,
          `The customer paid $${d(m.target * m.rate)}$ dollars, so the number of hours is $${d(m.target * m.rate)}\\div ${d(m.rate)}=${m.target}$.`,
        ],
        label: "Answer (hours)",
      }),
      figure,
    };
  },
});

/* ------------------------------------------------------------ signed changes */
const changeAxes = {
  ask: defineAxis("ask", ["net-change", "final-count"] as const),
};
interface ChangeModel {
  ask: "net-change" | "final-count";
  changes: number[];
  start: number;
  context: number;
}
const changeContexts = [
  { thing: "books on a library cart", noun: "books" },
  { thing: "players on a team roster", noun: "players" },
  { thing: "cars in a small lot", noun: "cars" },
];
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function changeModel(r: R, ax: { ask: ChangeModel["ask"] }): ChangeModel {
  const n = r(5, 7);
  const changes: number[] = [];
  for (let i = 0; i < n; i++) changes.push((r(0, 1) ? 1 : -1) * r(2, 18));
  const net = changes.reduce((s, v) => s + v, 0);
  if (changes.every((v) => v > 0) || changes.every((v) => v < 0))
    throw new Error("Need three retries");
  const start = r(25, 70);
  if (ax.ask === "final-count" && start + net < 0)
    throw new Error("Need three retries");
  return {
    ask: ax.ask,
    changes,
    start,
    context: r(0, changeContexts.length - 1),
  };
}
const signedChangesSum = chainFamily({
  template: signedChangesSumTemplate,
  axes: changeAxes,
  model: changeModel,
  variant: (m) => `${m.ask}-${m.changes.length}-days`,
  render: (m) => {
    const c = changeContexts[m.context]!;
    const n = m.changes.length;
    const net = m.changes.reduce((s, v) => s + v, 0);
    const gains = m.changes.filter((v) => v > 0);
    const losses = m.changes.filter((v) => v < 0);
    const gainSum = gains.reduce((s, v) => s + v, 0);
    const lossSum = losses.reduce((s, v) => s + v, 0);
    const figure = figureOf(
      [
        ["Day", ...dayNames.slice(0, n)],
        ["Change", ...m.changes.map(signed)],
      ],
      "column",
    );
    const steps = [
      `The gains are ${list(gains.map((v) => `+${v}`))}, which add to $+${gainSum}$.`,
      `The losses are ${list(losses.map((v) => `−${-v}`))}, which add to $-${-lossSum}$.`,
      `The net change is $${gainSum}+(${lossSum})=${net}$.`,
    ];
    if (m.ask === "net-change") {
      return {
        ...numberSurface({
          prompt: `The table shows how the number of ${c.thing} changed on each of ${n} days. What was the net change over the ${n} days?`,
          answer: String(net),
          hint: `Add all ${n} changes, not just the first two. Group the gains together and the losses together, then combine the two totals.`,
          explanation: steps,
          label: `Net change (${c.noun})`,
        }),
        figure,
      };
    }
    return {
      ...numberSurface({
        prompt: `There were ${m.start} ${c.noun} at the start. The table shows how the number of ${c.thing} changed on each of ${n} days. How many ${c.noun} were there after ${n} days?`,
        answer: String(m.start + net),
        hint: `Start from ${m.start}. Find the net change of all ${n} days by grouping the gains and the losses, then apply it to ${m.start}.`,
        explanation: [
          ...steps,
          `Start with ${m.start} and apply the net change: $${m.start}${net < 0 ? `+(${net})` : `+${net}`}=${m.start + net}$.`,
        ],
        label: `Answer (${c.noun})`,
      }),
      figure,
    };
  },
});

export const multiTermChainTemplates = [
  fractionTermChainTemplate,
  decimalRenameChainTemplate,
  priceCountChainTemplate,
  dollarRateScaleTemplate,
  signedChangesSumTemplate,
] as const;
export const multiTermChainFamilies = {
  "fraction-term-chain": fractionTermChain,
  "decimal-rename-chain": decimalRenameChain,
  "price-count-chain": priceCountChain,
  "dollar-rate-scale": dollarRateScale,
  "signed-changes-sum": signedChangesSum,
};
export const multiTermChainGenerate = dispatch(multiTermChainTemplates, {
  "fraction-term-chain": (s) => fractionTermChain.generate(s).problem,
  "decimal-rename-chain": (s) => decimalRenameChain.generate(s).problem,
  "price-count-chain": (s) => priceCountChain.generate(s).problem,
  "dollar-rate-scale": (s) => dollarRateScale.generate(s).problem,
  "signed-changes-sum": (s) => signedChangesSum.generate(s).problem,
});
