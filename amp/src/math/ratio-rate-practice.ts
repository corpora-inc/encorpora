import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";

type Random = (low: number, high: number) => number;
type Rational = { n: number; d: number };
type Choice = { label: string; correct?: true; feedback?: string };
type Case = {
  prompt: string;
  label: string;
  answer: string;
  explanation: string[];
  tags: string[];
  figure?: SemanticFigure;
  /** Choice items keep a fixed, meaningful option order unless `shuffle`. */
  choices?: Choice[];
  shuffle?: boolean;
};

export const ratioRateTemplates: readonly TemplateMetadata[] = [
  {
    id: "unit-rate",
    version: 1,
    title: "Find a unit rate",
    skillId: "unit-rates",
    gradeBand: "6–8",
    description:
      "Find the amount of one quantity for 1 unit of the other by dividing, in whichever direction the question asks.",
  },
  {
    id: "better-buy",
    version: 1,
    requiredResponseCapability: "single-choice-v1",
    title: "Find the better buy",
    skillId: "unit-rates",
    gradeBand: "6–8",
    description:
      "Compare two package prices by their unit prices and choose the lower price per item, or recognize equal unit prices.",
  },
  {
    id: "ratio-table-missing",
    version: 1,
    title: "Complete a ratio table",
    skillId: "ratio-tables",
    gradeBand: "6–8",
    description:
      "Find the missing value in a table of equivalent ratios by scaling the simplest ratio.",
  },
  {
    id: "double-number-line-missing",
    version: 1,
    title: "Read a double number line",
    skillId: "ratio-tables",
    gradeBand: "6–8",
    description:
      "Find a missing value on a double number line by going through the amount for 1 unit.",
  },
  {
    id: "fraction-unit-rate",
    version: 1,
    title: "Unit rates with fractions",
    skillId: "rational-unit-rates",
    gradeBand: "6–8",
    description:
      "Find a unit rate when one or both quantities are fractions by dividing fractions.",
  },
  {
    id: "story-operation-choice",
    version: 1,
    requiredResponseCapability: "single-choice-v1",
    title: "Choose the operation for a story",
    skillId: "multiplicative-stories",
    gradeBand: "3–5",
    description:
      "Choose the equation that models an equal-groups, array or measurement story with an unknown total, group size or number of groups.",
  },
  {
    id: "multiplication-division-story",
    version: 1,
    title: "Solve a multiplication or division story",
    skillId: "multiplicative-stories",
    gradeBand: "3–5",
    description:
      "Decide whether an equal-groups, array or measurement story calls for multiplication or division, and solve it.",
  },
];

const hints: Record<string, string> = {
  "unit-rate":
    "Find which quantity the question puts at 1. Divide the other quantity by it.",
  "better-buy":
    "Find each unit price: divide each total price by its number of items. The lower price for 1 item is the better buy.",
  "ratio-table-missing":
    "Divide a complete column by a common factor to find the simplest ratio. Every column is that ratio multiplied by one number.",
  "double-number-line-missing":
    "Aligned marks show equivalent pairs. Find the amount for 1 unit, then multiply by the number of units asked for.",
  "fraction-unit-rate":
    "Divide the amount by the number of units, even when both are fractions. To divide by a fraction, multiply by its reciprocal.",
  "story-operation-choice":
    "Ask what the story gives: the number of equal groups, the size of each group, or the total. An unknown total means multiply; a known total means divide.",
  "multiplication-division-story":
    "Ask what the story gives: the number of equal groups, the size of each group, or the total. An unknown total means multiply; a known total means divide.",
};

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function q(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d <= 0)
    throw new Error("Expected exact positive-denominator arithmetic");
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const frac = (v: Rational) => `${v.n}${v.d === 1 ? "" : `/${v.d}`}`;
/** Whole cents as a dollar amount: 845 → $8.45, 600 → $6. */
const dollars = (cents: number) =>
  cents % 100 === 0
    ? `$${cents / 100}`
    : `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
/** Always two decimal places, for comparing unit prices: 70 → $0.70. */
const price = (cents: number) =>
  `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
const centsAnswer = (cents: number) =>
  cents % 100 === 0
    ? String(cents / 100)
    : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
/** Singular noun for an amount of at most one: "3/4 mile", "2 miles". */
const amount = (v: Rational, one: string, many: string) =>
  `${frac(v)} ${v.n <= v.d ? one : many}`;
const names = ["Ana", "Ravi", "Mia", "Omar", "Lena", "Kai", "Jo", "Sam"];

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}

/* ---------- Unit rates (6.RP.A.2) ---------- */

function unitRateCase(r: Random): Case {
  const mode = r(0, 6);
  if (mode === 0) {
    const b = r(2, 12),
      rate = r(6, 40);
    return forwardRate(
      `A printer prints ${rate * b} pages in ${b} minutes. At this rate, how many pages does it print per minute?`,
      "Pages per minute",
      "1 minute",
      `Divide the pages by the minutes: ${rate * b} ÷ ${b} = ${rate}.`,
      `The printer prints ${rate} pages per minute.`,
      String(rate),
      "printer",
    );
  }
  if (mode === 1) {
    const b = r(3, 15),
      rate = r(18, 45);
    return forwardRate(
      `A car travels ${rate * b} miles on ${b} gallons of gas. How many miles does the car travel per gallon?`,
      "Miles per gallon",
      "1 gallon",
      `Divide the miles by the gallons: ${rate * b} ÷ ${b} = ${rate}.`,
      `The car travels ${rate} miles per gallon.`,
      String(rate),
      "car",
    );
  }
  if (mode === 2) {
    const b = r(3, 9),
      rate = r(18, 50) * 50;
    const name = names[r(0, names.length - 1)]!;
    return forwardRate(
      `${name} earns ${dollars(rate * b)} for ${b} hours of babysitting. How many dollars does ${name} earn per hour?`,
      "Dollars per hour",
      "1 hour",
      `Divide the pay by the hours: ${dollars(rate * b)} ÷ ${b} = ${dollars(rate)}.`,
      `${name} earns ${dollars(rate)} per hour.`,
      centsAnswer(rate),
      "wage",
      rate % 100 ? "decimal-rate" : "whole-rate",
    );
  }
  if (mode === 3) {
    const b = r(2, 8),
      cents = r(79, 499);
    return forwardRate(
      `A ${b}-pound bag of apples costs ${dollars(cents * b)}. What is the price per pound, in dollars?`,
      "Dollars per pound",
      "1 pound",
      `Divide the cost by the pounds: ${dollars(cents * b)} ÷ ${b} = ${dollars(cents)}.`,
      `The apples cost ${dollars(cents)} per pound.`,
      centsAnswer(cents),
      "price",
      cents % 100 ? "decimal-rate" : "whole-rate",
    );
  }
  if (mode === 4) {
    const b = r(2, 9);
    let a = r(b + 1, 4 * b);
    if (a % b === 0) a += 1;
    const rate = q(a, b);
    return forwardRate(
      `A baker uses ${a} cups of flour to make ${b} loaves of bread. How many cups of flour does each loaf use?`,
      "Cups of flour per loaf",
      "1 loaf",
      `Divide the cups by the loaves: ${a} ÷ ${b} = ${a}/${b}${rate.d === b ? "" : ` = ${frac(rate)}`}.`,
      `Each loaf uses ${frac(rate)} cups of flour.`,
      frac(rate),
      "baker",
      "fraction-rate",
    );
  }
  if (mode === 5) {
    const miles = r(2, 6),
      pace = r(7, 15);
    return {
      prompt: `A runner runs ${miles} miles in ${miles * pace} minutes at a steady pace. How many minutes does it take the runner to run 1 mile?`,
      label: "Minutes per mile",
      answer: String(pace),
      explanation: [
        "A unit rate is the amount of one quantity for 1 unit of the other. The question puts 1 mile at the unit, so the minutes are divided among the miles.",
        `Divide the minutes by the miles: ${miles * pace} ÷ ${miles} = ${pace}.`,
        `It takes ${pace} minutes to run 1 mile.`,
      ],
      tags: ["pace", "reverse-order", "whole-rate"],
    };
  }
  const cost = r(2, 6),
    each = r(2, 8);
  return {
    prompt: `At a school store, ${cost * each} pencils cost $${cost}. At this price, how many pencils can be bought for $1?`,
    label: "Pencils per dollar",
    answer: String(each),
    explanation: [
      "A unit rate is the amount of one quantity for 1 unit of the other. The question puts $1 at the unit, so the pencils are divided among the dollars.",
      `Divide the pencils by the dollars: ${cost * each} ÷ ${cost} = ${each}.`,
      `${each} pencils can be bought for $1.`,
    ],
    tags: ["pencils", "reverse-order", "whole-rate"],
  };
}
function forwardRate(
  prompt: string,
  label: string,
  unit: string,
  divide: string,
  final: string,
  answer: string,
  key: string,
  kind = "whole-rate",
): Case {
  return {
    prompt,
    label,
    answer,
    explanation: [
      `A unit rate is the amount of one quantity for 1 unit of the other. Here the unit is ${unit}.`,
      divide,
      final,
    ],
    tags: [key, "statement-order", kind],
  };
}

const goods = [
  { key: "bars", one: "granola bar", many: "granola bars", low: 40, high: 150 },
  { key: "juice", one: "juice box", many: "juice boxes", low: 30, high: 120 },
  { key: "pencils", one: "pencil", many: "pencils", low: 15, high: 60 },
  { key: "cereal", one: "ounce", many: "ounces", low: 12, high: 45 },
] as const;
function betterBuyCase(r: Random): Case {
  const good = goods[r(0, goods.length - 1)]!;
  const small = good.key === "cereal" ? 2 * r(4, 9) : r(3, 8),
    large = good.key === "cereal" ? small + 2 * r(2, 8) : small + r(2, 8);
  // Equal unit prices about 1 time in 8; otherwise a bulk or small-pack win.
  const outcome = [
    "same",
    "large",
    "large",
    "large",
    "large",
    "small",
    "small",
    "small",
  ][r(0, 7)]!;
  let pSmall = 0,
    pLarge = 0;
  for (let tries = 0; ; tries++) {
    pSmall = r(good.low, good.high);
    const gap = Math.max(2, Math.ceil(pSmall / 20));
    if (outcome === "same") pLarge = pSmall;
    else if (outcome === "small")
      pLarge = r(pSmall + gap, Math.max(pSmall + gap, good.high + gap));
    else {
      // The large pack still costs more in all, so "lower total" misleads;
      // a discount of at most 30% keeps the comparison close.
      const floor = Math.max(
        Math.floor((small * pSmall) / large) + 1,
        Math.ceil(pSmall * 0.7),
      );
      if (floor > pSmall - gap) {
        pLarge = pSmall;
        continue;
      }
      pLarge = r(floor, pSmall - gap);
    }
    if (small * pSmall !== large * pLarge) break;
    if (tries > 50) throw new Error("No distinct package prices");
  }
  const largeFirst = r(0, 1) === 1;
  const stores = largeFirst
    ? [
        { n: large, p: pLarge, size: "large" },
        { n: small, p: pSmall, size: "small" },
      ]
    : [
        { n: small, p: pSmall, size: "small" },
        { n: large, p: pLarge, size: "large" },
      ];
  const pack = (n: number) =>
    good.key === "cereal"
      ? `${[8, 11, 18].includes(n) || (n >= 80 && n < 90) ? "an" : "a"} ${n}-ounce box of cereal`
      : `a pack of ${n} ${good.many}`;
  const prompt = `Store A sells ${pack(stores[0]!.n)} for ${price(stores[0]!.n * stores[0]!.p)}. Store B sells ${pack(stores[1]!.n)} for ${price(stores[1]!.n * stores[1]!.p)}. Which is the better buy, with the lower price per ${good.one}?`;
  const unitLine = (s: (typeof stores)[number], name: string) =>
    `${name}: ${price(s.n * s.p)} ÷ ${s.n} = ${price(s.p)} per ${good.one}.`;
  const [a, b] = stores as [(typeof stores)[0], (typeof stores)[0]];
  const both = `Find the price of 1 ${good.one}: ${price(a.p)} at Store A and ${price(b.p)} at Store B.`;
  const winner = a.p < b.p ? "A" : a.p > b.p ? "B" : "same";
  const explanation = [
    `Compare unit prices: the price of 1 ${good.one} at each store.`,
    unitLine(a, "Store A"),
    unitLine(b, "Store B"),
    winner === "same"
      ? `Both stores charge ${price(a.p)} per ${good.one}, so neither is a better buy.`
      : `${price(Math.min(a.p, b.p))} is less than ${price(Math.max(a.p, b.p))}, so Store ${winner} has the better buy.`,
  ];
  const feedback = (store: "A" | "B") => {
    const mine = store === "A" ? a : b,
      other = store === "A" ? b : a;
    if (winner === "same")
      return `Store ${store} is not cheaper per ${good.one}. ${both} They are equal.`;
    if (mine.n * mine.p < other.n * other.p)
      return `Store ${store} costs less in all, but it sells less. ${both}`;
    return `A bigger package is not always cheaper per ${good.one}. ${both}`;
  };
  const choices: Choice[] = [
    winner === "A"
      ? { label: "Store A", correct: true }
      : { label: "Store A", feedback: feedback("A") },
    winner === "B"
      ? { label: "Store B", correct: true }
      : { label: "Store B", feedback: feedback("B") },
    winner === "same"
      ? { label: `The same price per ${good.one}`, correct: true }
      : {
          label: `The same price per ${good.one}`,
          feedback: `${both} They are different.`,
        },
  ];
  return {
    prompt,
    label: "Choose one answer",
    answer: "",
    explanation,
    tags: [
      good.key,
      outcome === "same"
        ? "same"
        : outcome === "large"
          ? "bulk-better"
          : "small-better",
      `winner-${winner}`,
    ],
    choices,
  };
}

/* ---------- Ratio tables and double number lines (6.RP.A.3) ---------- */

const tables = [
  ["Flour (cups)", "Sugar (cups)", "flour to sugar, in cups"],
  ["Blue beads", "White beads", "blue beads to white beads in a necklace"],
  ["Laps", "Minutes", "laps run to minutes at a steady pace"],
  ["Tickets", "Cost ($)", "tickets to their cost in dollars"],
  ["Red paint (L)", "White paint (L)", "red paint to white paint, in liters"],
] as const;
function ratioTableCase(r: Random): Case {
  const context = tables[r(0, tables.length - 1)]!;
  let p: number, s: number;
  do {
    p = r(1, 9);
    s = r(1, 9);
  } while (p === s || gcd(p, s) !== 1);
  const columns = r(3, 4);
  const set = new Set<number>();
  while (set.size < columns) set.add(r(1, 12));
  const multipliers = [...set].sort((x, y) => x - y);
  const missing = r(0, columns - 1),
    row = r(0, 1);
  const top = multipliers.map((m) => m * p),
    bottom = multipliers.map((m) => m * s);
  const target = multipliers[missing]!;
  const answer = row === 0 ? top[missing]! : bottom[missing]!;
  // A complete column that shows the common factor, for the explanation.
  const known = multipliers
    .map((m, i) => ({ m, i }))
    .filter((c) => c.i !== missing);
  const witness = known.find((c) => c.m > 1) ?? known[0]!;
  const others = known.filter((c) => c.m !== target);
  const viaSimplest = !others.some((c) => target % c.m === 0);
  const [topLabel, bottomLabel] = [context[0], context[1]];
  const name = (label: string) => label.replace(/ \(.*\)$/, "").toLowerCase();
  const explanation = [
    witness.m === 1
      ? `The column ${top[witness.i]} and ${bottom[witness.i]} is already the simplest ratio, ${p} : ${s}: its numbers have no common factor.`
      : `Divide a complete column by its common factor to find the simplest ratio: ${top[witness.i]} ÷ ${witness.m} = ${p} and ${bottom[witness.i]} ÷ ${witness.m} = ${s}, so the ratio is ${p} : ${s}.`,
    `Every column is ${p} : ${s} multiplied by the same number. In the column with the question mark, the ${row === 0 ? `${name(bottomLabel)} entry is ${bottom[missing]} = ${target} × ${s}` : `${name(topLabel)} entry is ${top[missing]} = ${target} × ${p}`}.`,
    `So the ${row === 0 ? `${name(topLabel)} entry is ${target} × ${p} = ${answer}` : `${name(bottomLabel)} entry is ${target} × ${s} = ${answer}`}.`,
    `The missing number is ${answer}.`,
  ];
  const cells = (values: number[], r0: number) =>
    values.map((v, i) => (i === missing && row === r0 ? null : v));
  return {
    prompt: `The table shows equivalent ratios of ${context[2]}. What number belongs in the cell with the question mark?`,
    label: "Missing number",
    answer: String(answer),
    explanation,
    tags: [
      ["flour", "beads", "laps", "tickets", "paint"][tables.indexOf(context)]!,
      row === 0 ? "missing-top" : "missing-bottom",
      viaSimplest ? "via-simplest" : "whole-multiple",
      `columns-${columns}`,
      multipliers.includes(1) ? "simplest-shown" : "simplest-hidden",
    ],
    figure: {
      kind: "ratio-table",
      rows: [
        { label: topLabel, values: cells(top, 0) },
        { label: bottomLabel, values: cells(bottom, 1) },
      ],
    },
  };
}

const lines = [
  {
    key: "train",
    top: "Miles",
    bottom: "Hours",
    lead: "A train travels at a constant speed. The double number line shows its distance and time.",
    rate: [4, 16],
    rateStep: 5,
    askTop: (t: number) =>
      `How many miles does the train travel in ${t} ${t === 1 ? "hour" : "hours"}?`,
    askBottom: (v: number) =>
      `How many hours does it take the train to travel ${v} miles?`,
    perOne: "miles in 1 hour",
    labels: ["Miles", "Hours"],
    topWord: "miles",
    bottomWord: ["hour", "hours"],
  },
  {
    key: "grapes",
    top: "Cost ($)",
    bottom: "Pounds",
    lead: "Grapes cost the same amount for every pound. The double number line shows cost and weight.",
    rate: [2, 6],
    rateStep: 1,
    askTop: (t: number) =>
      `How many dollars ${t === 1 ? "does" : "do"} ${t} ${t === 1 ? "pound" : "pounds"} of grapes cost?`,
    askBottom: (v: number) => `How many pounds of grapes cost $${v}?`,
    perOne: "dollars for 1 pound",
    labels: ["Dollars", "Pounds"],
    topWord: "dollars",
    bottomWord: ["pound", "pounds"],
  },
  {
    key: "reading",
    top: "Pages",
    bottom: "Minutes",
    lead: "Jo reads at a steady pace. The double number line shows pages read and minutes.",
    rate: [2, 4],
    rateStep: 1,
    askTop: (t: number) =>
      `How many pages does Jo read in ${t} ${t === 1 ? "minute" : "minutes"}?`,
    askBottom: (v: number) =>
      `How many minutes does it take Jo to read ${v} pages?`,
    perOne: "pages in 1 minute",
    labels: ["Pages", "Minutes"],
    topWord: "pages",
    bottomWord: ["minute", "minutes"],
  },
  {
    key: "rice",
    top: "Water (cups)",
    bottom: "Rice (cups)",
    lead: "A rice recipe uses the same ratio of water to rice in every batch. The double number line shows cups of each.",
    rate: [2, 3],
    rateStep: 1,
    askTop: (t: number) =>
      `How many cups of water go with ${t} ${t === 1 ? "cup" : "cups"} of rice?`,
    askBottom: (v: number) =>
      `How many cups of rice go with ${v} cups of water?`,
    perOne: "cups of water for 1 cup of rice",
    labels: ["Cups of water", "Cups of rice"],
    topWord: "cups of water",
    bottomWord: ["cup of rice", "cups of rice"],
  },
] as const;
function doubleLineCase(r: Random): Case {
  const context = lines[r(0, lines.length - 1)]!;
  const rate = r(context.rate[0], context.rate[1]) * context.rateStep;
  let given: number, target: number;
  do {
    given = r(2, 10);
    target = r(2, 12);
  } while (
    target === given ||
    // Distinct marks stay at least a sixth of the line apart.
    6 * Math.abs(target - given) < Math.max(target, given)
  );
  const findBottom = r(0, 3) === 0;
  const answer = findBottom ? target : rate * target;
  const cols = [
    { b: 0, t: 0 },
    { b: given, t: rate * given },
    { b: target, t: rate * target },
  ].sort((x, y) => x.b - y.b);
  const [one, many] = context.bottomWord;
  const unit = (n: number) => `${n} ${n === 1 ? one : many}`;
  const explanation = [
    `Aligned marks show equivalent pairs: ${rate * given} ${context.topWord} go with ${unit(given)}.`,
    `Find the ${context.perOne}: ${rate * given} ÷ ${given} = ${rate}.`,
    findBottom
      ? `Each ${one} adds ${rate} ${context.topWord}, so divide: ${rate * target} ÷ ${rate} = ${target}.`
      : `Multiply by the number of ${many}: ${rate} × ${target} = ${rate * target}.`,
    findBottom
      ? `The answer is ${unit(target)}.`
      : `The answer is ${rate * target} ${context.topWord}.`,
  ];
  return {
    prompt: `${context.lead} ${findBottom ? context.askBottom(rate * target) : context.askTop(target)}`,
    label: context.labels[findBottom ? 1 : 0],
    answer: String(answer),
    explanation,
    tags: [
      context.key,
      findBottom ? "find-bottom" : "find-top",
      target > given ? "scale-up" : "scale-down",
      target % given === 0 ? "whole-factor" : "through-one",
    ],
    figure: {
      kind: "double-number-line",
      top: {
        label: context.top,
        denominator: 1,
        numerators: cols.map((c) =>
          !findBottom && c.b === target ? null : c.t,
        ),
      },
      bottom: {
        label: context.bottom,
        denominator: 1,
        numerators: cols.map((c) =>
          findBottom && c.b === target ? null : c.b,
        ),
      },
    },
  };
}

/* ---------- Unit rates with fractions (7.RP.A.1) ---------- */

function properFraction(r: Random, low = 2, high = 8): Rational {
  const d = r(low, high);
  let n = r(1, d - 1);
  while (gcd(n, d) !== 1) n = r(1, d - 1);
  return { n, d };
}
function fractionRateCase(r: Random): Case {
  const mode = r(0, 3);
  let a: Rational, c: Rational;
  if (mode === 2) {
    // Cheese: a whole-dollar price for a fraction of a pound.
    c = properFraction(r, 2, 6);
    const k = r(1, 4);
    a = { n: k * c.n, d: 1 };
    const rate = q(a.n * c.d, c.n);
    const name = names[r(0, names.length - 1)]!;
    return fractionCase({
      prompt: `${name} buys ${frac(c)} pound of cheese for $${a.n}. What is the price of 1 pound of cheese, in dollars?`,
      label: "Dollars per pound",
      a,
      c,
      rate,
      top: "Cost ($)",
      bottom: "Pounds",
      divide: "Divide the cost by the pounds",
      unitName: ["pound", "pounds"],
      final: `The cheese costs $${frac(rate)} per pound.`,
      tags: ["cheese", "whole-amount"],
    });
  }
  do {
    a = properFraction(r, 2, 8);
    c = properFraction(r, 2, 8);
  } while (
    a.n * c.d === c.n * a.d ||
    q(a.n * c.d, a.d * c.n).d > 12 ||
    q(a.n * c.d, a.d * c.n).n > 60
  );
  const rate = q(a.n * c.d, a.d * c.n);
  const name = names[r(0, names.length - 1)]!;
  if (mode === 0)
    return fractionCase({
      prompt: `${name} walks ${amount(a, "mile", "miles")} in ${frac(c)} hour. At this rate, how many miles does ${name} walk in 1 hour?`,
      label: "Miles per hour",
      a,
      c,
      rate,
      top: "Miles",
      bottom: "Hours",
      divide: "Divide the miles by the hours",
      unitName: ["hour", "hours"],
      final: `${name} walks ${amount(rate, "mile", "miles")} per hour.`,
      tags: ["walk", "both-fractions"],
    });
  if (mode === 1)
    return fractionCase({
      prompt: `A recipe uses ${frac(a)} cup of sugar for every ${frac(c)} cup of flour. How many cups of sugar does it use for 1 cup of flour?`,
      label: "Cups of sugar per cup of flour",
      a,
      c,
      rate,
      top: "Sugar (cups)",
      bottom: "Flour (cups)",
      divide: "Divide the sugar by the flour",
      unitName: ["cup of flour", "cups of flour"],
      final: `The recipe uses ${amount(rate, "cup", "cups")} of sugar for 1 cup of flour.`,
      tags: ["recipe", "both-fractions"],
    });
  // A whole job: the part done and the time are both fractions.
  return fractionCase({
    prompt: `${name} mows ${frac(a)} of a lawn in ${frac(c)} hour. At this rate, how many lawns does ${name} mow in 1 hour?`,
    label: "Lawns per hour",
    a,
    c,
    rate,
    top: "Lawns",
    bottom: "Hours",
    divide: "Divide the part of the lawn by the hours",
    unitName: ["hour", "hours"],
    final: `${name} mows ${amount(rate, "lawn", "lawns")} per hour.`,
    tags: ["lawn", "both-fractions"],
  });
}
function fractionCase(input: {
  prompt: string;
  label: string;
  a: Rational;
  c: Rational;
  rate: Rational;
  top: string;
  bottom: string;
  divide: string;
  unitName: [string, string];
  final: string;
  tags: string[];
}): Case {
  const { a, c, rate } = input;
  const flip = q(c.d, c.n);
  const product = `${a.n * c.d}/${a.d * c.n}`;
  return {
    prompt: input.prompt,
    label: input.label,
    answer: frac(rate),
    explanation: [
      `A unit rate is the amount for 1 ${input.unitName[0]}. ${input.divide}: ${frac(a)} ÷ ${frac(c)}.`,
      `Dividing by ${frac(c)} is the same as multiplying by its reciprocal, ${frac(flip)}: ${frac(a)} × ${frac(flip)} = ${product}${frac(rate) === product ? "" : ` = ${frac(rate)}`}.`,
      c.n === 1
        ? `Check: 1 ${input.unitName[0]} is ${c.d} copies of ${frac(c)} ${input.unitName[0]}, so the amount is ${c.d} × ${frac(a)} = ${frac(rate)}.`
        : `Check: ${frac(c)} × ${frac(rate)} = ${frac(q(c.n * rate.n, c.d * rate.d))}, which matches the amount given.`,
      input.final,
    ],
    tags: [
      ...input.tags,
      c.n === 1 ? "unit-fraction-time" : "nonunit-fraction-time",
      rate.d === 1 ? "whole-answer" : "fraction-answer",
    ],
    // Exact marks: the top line counts in a.d-ths, the bottom in c.d-ths.
    figure: {
      kind: "double-number-line",
      top: { label: input.top, denominator: a.d, numerators: [0, a.n, null] },
      bottom: {
        label: input.bottom,
        denominator: c.d,
        numerators: [0, c.n, c.d],
      },
    },
  };
}

/* ---------- Multiplicative stories (3.OA.A.3) ---------- */

type Unknown = "product" | "size" | "groups";
type Story = {
  statement: string;
  question: string;
  find: string;
  groups: number;
  size: number;
  total: number;
  groupWord: [string, string];
  itemWord: string;
  unknown: Unknown;
  context: string;
};
function story(r: Random): Story {
  const name = names[r(0, names.length - 1)]!;
  let groups: number, size: number;
  do {
    groups = r(2, 10);
    size = r(2, 10);
  } while (groups === size || groups * size > 100);
  const total = groups * size;
  const unknown = (["product", "size", "groups"] as const)[r(0, 2)]!;
  const context = r(0, 3);
  const g = groups,
    s = size,
    t = total;
  const pick = (
    rows: Record<Unknown, [string, string, string]>,
    groupWord: [string, string],
    itemWord: string,
    key: string,
  ): Story => {
    const [statement, question, find] = rows[unknown];
    return {
      statement,
      question,
      find,
      groups: g,
      size: s,
      total: t,
      groupWord,
      itemWord,
      unknown,
      context: key,
    };
  };
  if (context === 0)
    return pick(
      {
        product: [
          `${name} fills ${g} bags with ${s} apples in each bag.`,
          "How many apples are in the bags in all?",
          "the total number of apples",
        ],
        size: [
          `${name} packs ${t} apples equally into ${g} bags.`,
          "How many apples go in each bag?",
          "the number of apples in each bag",
        ],
        groups: [
          `${name} packs ${t} apples into bags, with ${s} apples in each bag.`,
          `How many bags does ${name} fill?`,
          "the number of bags",
        ],
      },
      ["bag", "bags"],
      "apples",
      "equal-groups",
    );
  if (context === 1)
    return pick(
      {
        product: [
          `${name} sets up ${g} rows of chairs with ${s} chairs in each row.`,
          "How many chairs are there in all?",
          "the total number of chairs",
        ],
        size: [
          `${name} sets up ${t} chairs in ${g} equal rows.`,
          "How many chairs are in each row?",
          "the number of chairs in each row",
        ],
        groups: [
          `${name} sets up ${t} chairs in rows of ${s} chairs.`,
          "How many rows are there?",
          "the number of rows",
        ],
      },
      ["row", "rows"],
      "chairs",
      "array",
    );
  if (context === 2)
    return pick(
      {
        product: [
          `${name} cuts a ribbon into ${g} pieces that are each ${s} centimeters long, with none left over.`,
          "How long was the ribbon, in centimeters?",
          "the length of the ribbon",
        ],
        size: [
          `${name} cuts a ${t}-centimeter ribbon into ${g} pieces of equal length.`,
          "How long is each piece, in centimeters?",
          "the length of each piece",
        ],
        groups: [
          `${name} cuts a ${t}-centimeter ribbon into pieces that are each ${s} centimeters long.`,
          `How many pieces does ${name} cut?`,
          "the number of pieces",
        ],
      },
      ["piece", "pieces"],
      "centimeters",
      "length",
    );
  return pick(
    {
      product: [
        `${name} fills ${g} jugs with ${s} liters of water each.`,
        "How many liters of water is that in all?",
        "the total number of liters",
      ],
      size: [
        `${name} pours ${t} liters of water equally into ${g} jugs.`,
        "How many liters go in each jug?",
        "the number of liters in each jug",
      ],
      groups: [
        `${name} pours ${t} liters of water into jugs that each hold ${s} liters, filling every jug.`,
        `How many jugs does ${name} fill?`,
        "the number of jugs",
      ],
    },
    ["jug", "jugs"],
    "liters",
    "volume",
  );
}
/** The numbers a story states, in the order an equation uses them. */
function storyNumbers(s: Story): [number, number] {
  return s.unknown === "product"
    ? [s.groups, s.size]
    : s.unknown === "size"
      ? [s.total, s.groups]
      : [s.total, s.size];
}
function storyExplanation(s: Story): string[] {
  const g = `${s.groups} ${s.groupWord[1]}`,
    size = `${s.size} ${s.itemWord}`;
  const answer =
    s.unknown === "product"
      ? s.total
      : s.unknown === "size"
        ? s.size
        : s.groups;
  if (s.unknown === "product")
    return [
      `The story gives the number of equal groups (${g}) and the size of each group (${size}). The total is unknown.`,
      `Putting equal groups together is multiplication: ${s.groups} × ${s.size} = ${s.total}.`,
      `The answer is ${s.total} ${s.itemWord}.`,
    ];
  if (s.unknown === "size")
    return [
      `The story gives the total (${s.total} ${s.itemWord}) and the number of equal groups (${g}). The size of each group is unknown.`,
      `Splitting a total into a known number of equal groups is division: ${s.total} ÷ ${s.groups} = ${s.size}.`,
      `Check: ${s.groups} × ${s.size} = ${s.total}. The answer is ${answer} ${s.itemWord}.`,
    ];
  return [
    `The story gives the total (${s.total} ${s.itemWord}) and the size of each group (${size}). The number of groups is unknown.`,
    `Finding how many groups of ${s.size} make ${s.total} is division: ${s.total} ÷ ${s.size} = ${s.groups}.`,
    `Check: ${s.groups} × ${s.size} = ${s.total}. The answer is ${answer} ${s.groupWord[1]}.`,
  ];
}
function storyCase(r: Random): Case {
  const s = story(r);
  const answer =
    s.unknown === "product"
      ? s.total
      : s.unknown === "size"
        ? s.size
        : s.groups;
  return {
    prompt: `${s.statement} ${s.question}`,
    label:
      s.unknown === "groups"
        ? `Number of ${s.groupWord[1]}`
        : s.itemWord === "centimeters"
          ? "Centimeters"
          : s.itemWord === "liters"
            ? "Liters"
            : `Number of ${s.itemWord}`,
    answer: String(answer),
    explanation: storyExplanation(s),
    tags: [s.context, s.unknown],
  };
}
function storyChoiceCase(r: Random): Case {
  const s = story(r);
  const [x, y] = storyNumbers(s);
  const big = Math.max(x, y),
    small = Math.min(x, y);
  const product = s.unknown === "product";
  const correctOp = product ? "×" : "÷";
  const options: [string, string, string][] = [
    [
      "+",
      `${x} + ${y} = ?`,
      product
        ? `Adding ${x} and ${y} counts one group and one more amount. There are ${x} equal groups of ${y}, so multiply.`
        : `The total ${x} is already known. Adding makes a larger total; the story asks how the ${x} is split, so divide.`,
    ],
    [
      "−",
      `${big} − ${small} = ?`,
      product
        ? `Subtracting takes an amount away. The story puts ${x} equal groups of ${y} together, so multiply.`
        : `Subtracting ${y} once removes one group. Splitting all ${x} into equal parts is division.`,
    ],
    [
      "×",
      `${x} × ${y} = ?`,
      `${x} × ${y} makes a total larger than ${x}. Here ${x} is the total, so divide it.`,
    ],
    [
      "÷",
      `${big} ÷ ${small} = ?`,
      `Division splits a known total. Here the total is unknown: ${x} equal groups of ${y} are put together, so multiply.`,
    ],
  ];
  return {
    prompt: `${s.statement} Which equation can be used to find ${s.find}?`,
    label: "Choose one answer",
    answer: "",
    explanation: [
      ...storyExplanation(s).slice(0, 2),
      `${options.find(([op]) => op === correctOp)![1]} models the story.`,
    ],
    tags: [s.context, s.unknown],
    choices: options.map(([op, label, feedback]) =>
      op === correctOp ? { label, correct: true } : { label, feedback },
    ),
    shuffle: true,
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "unit-rate": unitRateCase,
  "better-buy": betterBuyCase,
  "ratio-table-missing": ratioTableCase,
  "double-number-line-missing": doubleLineCase,
  "fraction-unit-rate": fractionRateCase,
  "story-operation-choice": storyChoiceCase,
  "multiplication-division-story": storyCase,
};
const fractionResponses = new Set(["unit-rate", "fraction-unit-rate"]);

export function ratioRatePrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = ratioRateTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown ratio and rate template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const c = builders[id]!(r);
  let answer = c.answer;
  let response: GeneratedProblem["public"]["response"] = {
    kind: fractionResponses.has(id) ? "fraction" : "number",
    label: c.label,
  };
  let choiceFeedback: Record<string, string> | undefined;
  if (c.choices) {
    const choices = [...c.choices];
    if (c.shuffle)
      for (let i = choices.length - 1; i > 0; i--) {
        const j = r(0, i);
        [choices[i], choices[j]] = [choices[j]!, choices[i]!];
      }
    choiceFeedback = {};
    const options = choices.map((choice, index) => {
      const optionId = `option-${"abcd"[index]}`;
      if (choice.correct) answer = optionId;
      else choiceFeedback![optionId] = choice.feedback!;
      return { id: optionId, label: choice.label };
    });
    response = { kind: "choice", label: c.label, options };
  }
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response,
      ...(c.figure ? { figure: c.figure } : {}),
    },
    answer,
    explanation: c.explanation,
    hint: hints[id]!,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
  // The prompt and figure state every given, so they identify the case.
  return {
    problem,
    tags: c.tags,
    caseKey: JSON.stringify([c.prompt, c.figure ?? null]),
  };
}
export const generateRatioRateProblem = (
  id: string,
  seed: string,
): GeneratedProblem => ratioRatePrintCase(id, seed).problem;
