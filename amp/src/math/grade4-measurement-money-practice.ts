import { createHash } from "node:crypto";
import { article, count } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, rational, type Random } from "./distribution-practice";
import { multiPartProblem, type Slot } from "./multi-part-support";
import { table } from "./scene/author";
import { CENTS, type MoneyItem } from "./time-money-models";

/* Grade-4 measurement and money (MM-1 through MM-10).
 * Elapsed intervals, conversion tables, smaller-to-larger renames, a
 * measurement-scale fraction, tool choice, decimal add/subtract through
 * hundredths, and decimal money stories. Each item is one exact model.
 * Denominator 100 is not used on the measurement line: the rational-line
 * figure allows denominators only through 12, and a hundred-part scale
 * is not readable. The Florida rename axis omits grams to kilograms,
 * meters to kilometers and milliliters to liters. */

type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  answer?: string;
  responseLabel?: string;
  choices?: Choice[];
  fraction?: boolean;
};
type Built = { variant: string; problem: GeneratedProblem };

const choice = { requiredResponseCapability: "single-choice-v1" as const };
const multiPart = {
  requiredResponseCapability: "multi-part-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};

const metadata = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  extra: Partial<TemplateMetadata> = {},
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "3–5",
  difficultyOffset,
  description,
  ...extra,
});

export const grade4MeasurementMoneyTemplates: readonly TemplateMetadata[] = [
  metadata(
    "elapsed-time-intervals",
    "Elapsed time that crosses an hour",
    "unit-conversion",
    0.35,
    "Find the end time after one duration or two activities, to the minute, including intervals that cross an hour and noon.",
    choice,
  ),
  metadata(
    "conversion-table-slots",
    "Complete a conversion table",
    "unit-conversion",
    0.4,
    "Fill a missing number in each column of a table that renames feet and inches, kilograms and grams, hours and minutes, or liters and milliliters.",
    multiPart,
  ),
  metadata(
    "unit-rename-larger",
    "Rename a smaller unit as a larger unit",
    "unit-conversion",
    0.3,
    "Rename a length, weight, capacity or time in a smaller unit as a whole number of a larger unit. A Florida axis omits grams to kilograms, meters to kilometers and milliliters to liters.",
  ),
  metadata(
    "measurement-line-fraction-story",
    "Distance on a measurement line",
    "unit-conversion",
    0.45,
    "Read the distance between two marks on a measurement number line as a fraction of a mile, using one grade-4 denominator.",
  ),
  metadata(
    "measuring-tool-choice",
    "Choose a measuring tool",
    "unit-conversion",
    0.1,
    "Choose the ruler, balance, thermometer, measuring cup or scale that measures the attribute in the question.",
    choice,
  ),
  metadata(
    "decimal-sum-difference",
    "Add or subtract decimals to hundredths",
    "decimal-money-operations",
    0.4,
    "Add or subtract decimals through hundredths, including a tenth written beside a hundredth, with no thousandths.",
  ),
  metadata(
    "money-decimal-story",
    "Decimal money stories",
    "decimal-money-operations",
    0.5,
    "Add or subtract dollars and cents, make change from a whole bill or a bill plus quarters, multiply or divide a cents price in two steps, or find the fewest coins.",
  ),
  metadata(
    "money-model-decimal",
    "Bills and coins as a decimal",
    "decimal-money-operations",
    0.35,
    "Total the bills in one set and ten mixed coins in the other, and write the amount in dollars and cents.",
  ),
];

const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;
function shuffle<T>(r: Random, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
const need = (condition: boolean, what: string) => {
  if (!condition) throw new Error(`Need ${what}`);
};

/** Dollars and cents, or tenths, from an integer number of hundredths. */
function places(cents: number, digits: 1 | 2): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");
  return digits === 1 ? `${whole}.${frac[0]}` : `${whole}.${frac}`;
}
const dollars = (cents: number) => places(cents, 2);
/** Learner-facing money. `$` is TeX, so amounts are words:
 *  685 is "6.85 dollars", 100 is "1 dollar", 25 is "25 cents".
 *  The number field still expects `6.85`. */
function money(cents: number): string {
  const whole = Math.floor(cents / 100);
  const extra = cents % 100;
  if (whole === 0) return count(extra, "cent");
  if (extra === 0) return count(whole, "dollar");
  return `${dollars(cents)} dollars`;
}
const ENTER = "Enter the amount in dollars and cents, such as 2.35.";
const commas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const counted = (n: number, noun: string) =>
  count(n, noun).replace(/^\d+/, commas(n));
const oneOf = (plural: string) =>
  plural === "feet"
    ? "foot"
    : plural === "inches"
      ? "inch"
      : plural.replace(/s$/, "");
const texFraction = (answer: string) => {
  const [n, d] = answer.split("/");
  return d ? `\\frac{${n}}{${d}}` : answer;
};

function toProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  d: Draft,
): GeneratedProblem {
  const base = {
    id: createHash("sha256")
      .update(JSON.stringify([meta.id, 1, seed]))
      .digest("hex"),
    templateId: meta.id,
    templateVersion: 1 as const,
    seed,
    prompt: d.prompt,
    skillId: meta.skillId,
    ...(d.figure ? { figure: d.figure } : {}),
  };
  if (!d.choices)
    return {
      public: {
        ...base,
        response: d.fraction
          ? { kind: "fraction", label: d.responseLabel ?? "Fraction" }
          : { kind: "number", label: d.responseLabel ?? "Answer" },
      },
      answer: d.answer!,
      explanation: d.explanation,
      hint: d.hint,
    };
  const choices = shuffle(r, d.choices);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((c, i) => {
    const id = `option-${"abcd"[i]}`;
    if (c.correct) answer = id;
    else choiceFeedback[id] = c.feedback!;
    return { id, label: c.label };
  });
  return {
    public: {
      ...base,
      response: { kind: "choice", label: "Choose one answer", options },
    },
    answer,
    explanation: d.explanation,
    hint: d.hint,
    choiceFeedback,
  };
}

/* ------------------------------------------------------------------ */
/* Elapsed time                                                        */
/* ------------------------------------------------------------------ */

const hm = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${count(h, "hour")} ${count(m, "minute")}`;
  if (h) return count(h, "hour");
  return count(m, "minute");
};
function formatTime(mins: number): string {
  const t = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(t / 60);
  const m = t % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
}
const hourOf = (mins: number) => Math.floor(mins / 60);

type Activity = { name: string; verb: "lasts" | "takes"; the?: boolean };
const lead = (activity: Activity) =>
  activity.the ? `the ${activity.name}` : activity.name;
const sentence = (activity: Activity) => {
  const text = `${lead(activity)} ${activity.verb}`;
  return text[0]!.toUpperCase() + text.slice(1);
};
const PAIRS: readonly (readonly [Activity, Activity])[] = [
  [
    { name: "art class", verb: "lasts" },
    { name: "sharing time", verb: "takes" },
  ],
  [
    { name: "reading session", verb: "lasts", the: true },
    { name: "cleanup time", verb: "takes" },
  ],
  [
    { name: "soccer practice", verb: "lasts" },
    { name: "stretching", verb: "takes" },
  ],
  [
    { name: "hike", verb: "lasts", the: true },
    { name: "snack break", verb: "takes" },
  ],
];
const ALONE: readonly Activity[] = PAIRS.map((pair) => pair[0]);

function elapsed(meta: TemplateMetadata, seed: string, r: Random): Built {
  const two = r(0, 1) === 0;
  const noon = r(0, 9) < 3;
  let startHour = 8;
  let startMin = 0;
  let durations: number[] = [];
  if (noon) {
    startHour = r(10, 11);
    startMin = r(0, 59);
    const start0 = startHour * 60 + startMin;
    const gap = 12 * 60 - start0;
    if (two) {
      const d1 = r(15, 50);
      let d2 = r(15, 50);
      if (d1 + d2 < gap) d2 = gap - d1 + r(0, 15);
      durations = [d1, d2];
    } else {
      const extra = r(1, 40);
      let total = 60 + extra;
      if (total < gap) total = Math.ceil((gap - extra) / 60) * 60 + extra;
      durations = [total];
    }
  } else if (r(0, 1) === 1) {
    startHour = r(13, 15);
    startMin = r(0, 50);
    durations = two ? [60 - startMin + r(5, 25), r(10, 35)] : [60 + r(1, 50)];
  } else {
    startHour = r(8, 9);
    startMin = r(0, 30);
    durations = two ? [60 - startMin + r(1, 15), r(10, 25)] : [60 + r(1, 30)];
  }
  const start = startHour * 60 + startMin;
  const total = durations.reduce((sum, part) => sum + part, 0);
  const end = start + total;
  const crossedHour = hourOf(end) !== hourOf(start);
  const crossedNoon = start < 12 * 60 && end >= 12 * 60;
  if (
    !crossedHour ||
    crossedNoon !== noon ||
    end >= 20 * 60 ||
    durations.some((d) => d < 1)
  )
    throw new Error("Need a usable interval");
  const period = start < 12 * 60 ? "morning" : "afternoon";
  const [first, second] = pick(r, PAIRS);
  const activity = two ? first : pick(r, ALONE);
  const prompt = two
    ? `The clock shows when ${lead(first)} starts, in the ${period}. ${sentence(first)} ${hm(durations[0]!)}. Then ${lead(second)} ${second.verb} ${hm(durations[1]!)}. What time does ${lead(second)} end?`
    : `The clock shows when ${lead(activity)} starts, in the ${period}. ${sentence(activity)} ${hm(durations[0]!)}. What time does ${lead(activity)} end?`;
  const correct = formatTime(end);
  need(
    !prompt.includes(correct),
    "an end time that is not written in the prompt",
  );
  const slips: [number, string][] = [
    [
      end - durations[durations.length - 1]!,
      two
        ? "That stops before the second activity. Add both times."
        : "That leaves off part of the duration. Add the hours and the minutes.",
    ],
    [start - total, "The end comes after the start. Add the duration."],
    [
      end + 60,
      "That is one hour later than the end. Check the hour after the minutes add up.",
    ],
    [
      end - 60,
      "That is one hour earlier than the end. Check the hour after the minutes add up.",
    ],
    [
      end + 12 * 60,
      "That is the same clock time in the other half of the day.",
    ],
  ];
  const seen = new Set([correct]);
  const choices: Choice[] = [{ label: correct, correct: true }];
  for (const [mins, feedback] of slips) {
    const label = formatTime(mins);
    if (seen.has(label)) continue;
    seen.add(label);
    choices.push({ label, feedback });
    if (choices.length === 4) break;
  }
  for (let extra = 2; choices.length < 4; extra++) {
    if (extra > 400) throw new Error("Need four distinct times");
    const label = formatTime(end + extra);
    if (seen.has(label)) continue;
    seen.add(label);
    choices.push({
      label,
      feedback: "Add the duration to the start time on the clock again.",
    });
  }
  const figure: SemanticFigure = {
    kind: "clock",
    hour: startHour % 12 || 12,
    minute: startMin,
  };
  const hint = two
    ? `${sentence(first)} ${hm(durations[0]!)}. Then ${lead(second)} ${second.verb} ${hm(durations[1]!)}. Start at the time on the clock and add both.`
    : `${sentence(activity)} ${hm(durations[0]!)}. Start at the time on the clock and add the hours and the minutes.`;
  const steps = durations.map((part, i) => {
    const at = start + durations.slice(0, i + 1).reduce((s, n) => s + n, 0);
    return `Add ${hm(part)}: ${formatTime(at)}.`;
  });
  return {
    variant: `${two ? "two" : "one"}-${noon ? "noon" : "day"}`,
    problem: toProblem(meta, seed, r, {
      prompt,
      hint,
      figure,
      explanation: [
        `The clock shows ${formatTime(start)}, in the ${period}.`,
        ...steps,
        `The end time is ${correct}.`,
      ],
      choices,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Conversion table                                                    */
/* ------------------------------------------------------------------ */

const TABLE_PAIRS = [
  { large: "feet", small: "inches", factor: 12, max: 8 },
  { large: "kilograms", small: "grams", factor: 1000, max: 6 },
  { large: "hours", small: "minutes", factor: 60, max: 6 },
  { large: "liters", small: "milliliters", factor: 1000, max: 5 },
] as const;

function wrongLabels(correct: number, candidates: number[]): string[] {
  const pool = [
    ...candidates,
    correct + 2,
    correct + 3,
    correct * 2 + 1,
    correct + 11,
  ];
  const seen = new Set([String(correct)]);
  const out: string[] = [];
  for (const n of pool) {
    if (!Number.isInteger(n) || n <= 0 || n > 100_000) continue;
    const label = String(n);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length === 3) return out;
  }
  throw new Error("Need three distinct wrong table values");
}

function conversion(meta: TemplateMetadata, seed: string, r: Random): Built {
  const pair = pick(r, TABLE_PAIRS);
  const used = new Set<number>();
  const larges: number[] = [];
  while (larges.length < 3) {
    const n = r(2, pair.max);
    if (used.has(n)) continue;
    used.add(n);
    larges.push(n);
  }
  const [large0, large1, large2] = larges as [number, number, number];
  const small = larges.map((n) => n * pair.factor);
  const figure: SemanticFigure = {
    kind: "scene",
    scene: table({
      columns: [pair.large, pair.small],
      corner: "Row",
      rows: [
        { label: "1", cells: [commas(large0), commas(small[0]!)] },
        { label: "2", cells: [null, commas(small[1]!)] },
        { label: "3", cells: [commas(large2), null] },
      ],
    }).scene(),
  };
  const slots: Slot[] = [
    {
      id: "r2large",
      label: `Row 2, ${pair.large}`,
      correct: String(large1),
      wrong: wrongLabels(large1, [
        large1 + 1,
        large1 * 10,
        large1 + pair.factor,
        small[1]!,
        large0,
      ]),
    },
    {
      id: "r3small",
      label: `Row 3, ${pair.small}`,
      correct: String(small[2]!),
      wrong: wrongLabels(small[2]!, [
        large2,
        large2 * 10,
        large2 + pair.factor,
        small[2]! + large2,
        small[0]!,
      ]),
    },
  ];
  const largeOne = oneOf(pair.large);
  const smallOne = oneOf(pair.small);
  const prompt = `The table matches ${pair.large} with ${pair.small}. The first row shows ${counted(large0, largeOne)}. Fill in the two blanks.`;
  const problem = multiPartProblem(meta, seed, r, {
    prompt,
    layout: "slots",
    label: "Fill the blanks",
    slots,
    figure,
    hint: `The first row shows ${counted(large0, largeOne)}. Each row uses the same match between ${pair.large} and ${pair.small}.`,
    explanation: [
      `The first row shows ${counted(large0, largeOne)} and ${counted(small[0]!, smallOne)}, so 1 ${largeOne} is ${counted(pair.factor, smallOne)}.`,
      `Row 2 shows ${counted(small[1]!, smallOne)}. Divide by ${commas(pair.factor)}: ${counted(large1, largeOne)}.`,
      `Row 3 shows ${counted(large2, largeOne)}. Multiply by ${commas(pair.factor)}: ${counted(small[2]!, smallOne)}.`,
    ],
  });
  return { variant: pair.large, problem };
}

/* ------------------------------------------------------------------ */
/* Smaller unit to larger unit                                         */
/* ------------------------------------------------------------------ */

type Rename = {
  small: string;
  large: string;
  factor: number;
  max: number;
  /** False on the Florida axis: grams, meters to kilometers, milliliters. */
  florida: boolean;
};
const RENAMES: readonly Rename[] = [
  { small: "inch", large: "foot", factor: 12, max: 12, florida: true },
  { small: "foot", large: "yard", factor: 3, max: 15, florida: true },
  { small: "ounce", large: "pound", factor: 16, max: 10, florida: true },
  { small: "cup", large: "quart", factor: 4, max: 12, florida: true },
  { small: "quart", large: "gallon", factor: 4, max: 8, florida: true },
  { small: "minute", large: "hour", factor: 60, max: 8, florida: true },
  { small: "centimeter", large: "meter", factor: 100, max: 12, florida: true },
  {
    small: "millimeter",
    large: "centimeter",
    factor: 10,
    max: 20,
    florida: true,
  },
  { small: "gram", large: "kilogram", factor: 1000, max: 9, florida: false },
  { small: "meter", large: "kilometer", factor: 1000, max: 9, florida: false },
  { small: "milliliter", large: "liter", factor: 1000, max: 6, florida: false },
];

function renameLarger(meta: TemplateMetadata, seed: string, r: Random): Built {
  const market = r(0, 1) === 0 ? "florida" : "core";
  const pool = RENAMES.filter((pair) => market === "core" || pair.florida);
  const pair = pick(r, pool);
  let result = r(2, pair.max);
  if (result === pair.factor) result = result === pair.max ? 2 : result + 1;
  const input = pair.factor * result;
  // The noun is the plural of the larger unit. The answer is the number alone.
  const noun = count(2, pair.large).replace(/^\d+ /, "");
  return {
    variant: `${market}-${pair.small}-${pair.large}`,
    problem: toProblem(meta, seed, r, {
      prompt: `${counted(input, pair.small)} is how many ${noun}?`,
      answer: String(result),
      responseLabel: `Number of ${noun}`,
      hint: `1 ${pair.large} is ${counted(pair.factor, pair.small)}. Divide ${commas(input)} by ${commas(pair.factor)}.`,
      explanation: [
        `1 ${pair.large} is ${counted(pair.factor, pair.small)}.`,
        `${commas(input)} ÷ ${commas(pair.factor)} = ${result}.`,
        `${counted(input, pair.small)} is ${counted(result, pair.large)}.`,
      ],
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Measurement-scale fraction                                          */
/* ------------------------------------------------------------------ */

const LINE_DENOMS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

function lineStory(meta: TemplateMetadata, seed: string, r: Random): Built {
  const denominator = pick(r, LINE_DENOMS);
  const maxWhole = r(2, 3);
  const steps = maxWhole * denominator;
  const a = r(0, steps - 2);
  const b = r(a + 1, steps);
  const answer = rational(b - a, denominator);
  const prompt = "How far is the walk from $A$ to $B$, in miles?";
  const figure: SemanticFigure = {
    kind: "rational-line",
    denominator,
    maxWhole,
    points: [
      { numerator: a, label: "A" },
      { numerator: b, label: "B" },
    ],
    unit: "miles",
  };
  return {
    variant: `d${denominator}`,
    problem: toProblem(meta, seed, r, {
      prompt,
      answer,
      fraction: true,
      responseLabel: "Distance in miles",
      figure,
      hint: `Each mile on the line is split into ${denominator} equal steps. Count the steps from $A$ to $B$ and write that count over ${denominator}.`,
      explanation: [
        `Each mile on the trail is split into ${denominator} equal steps.`,
        `$A$ is ${count(a, "step")} from 0 and $B$ is ${count(b, "step")} from 0.`,
        `The walk is ${count(b - a, "step")}, which is $${texFraction(answer)}$ ${Number(answer) === 1 ? "mile" : "miles"}.`,
      ],
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Measuring tool                                                      */
/* ------------------------------------------------------------------ */

const TOOLS = [
  {
    id: "ruler",
    label: "ruler",
    prompt: "Which tool should you use to measure the length of a book?",
    hint: "A book has a length. Choose the tool that measures length.",
    why: "A ruler measures length.",
  },
  {
    id: "balance",
    label: "balance",
    prompt:
      "Which tool should you use to compare the mass of a rock with known masses?",
    hint: "Known masses sit on one side. Choose the tool that compares masses.",
    why: "A balance compares a mass with known masses.",
  },
  {
    id: "thermometer",
    label: "thermometer",
    prompt: "Which tool should you use to measure the temperature of the room?",
    hint: "The room has a temperature. Choose the tool that measures temperature.",
    why: "A thermometer measures temperature.",
  },
  {
    id: "cup",
    label: "measuring cup",
    prompt: "Which tool should you use to measure the juice in a pitcher?",
    hint: "Juice fills a pitcher. Choose the tool that measures liquid.",
    why: "A measuring cup measures liquid volume.",
  },
  {
    id: "scale",
    label: "scale",
    prompt:
      "Which tool should you use to measure the weight of a person in pounds?",
    hint: "The question asks for pounds. Choose the tool that shows weight as a number.",
    why: "A scale shows weight as a number of pounds.",
  },
] as const;

function toolChoice(meta: TemplateMetadata, seed: string, r: Random): Built {
  const key = pick(r, TOOLS);
  const wrong = shuffle(
    r,
    TOOLS.filter((tool) => tool.id !== key.id),
  ).slice(0, 3);
  const choices: Choice[] = [
    { label: key.label, correct: true },
    ...wrong.map((tool) => ({
      label: tool.label,
      feedback: `${tool.why} This question asks for a different kind of measure.`,
    })),
  ];
  return {
    variant: key.id,
    problem: toProblem(meta, seed, r, {
      prompt: key.prompt,
      hint: key.hint,
      choices,
      explanation: [key.why, `The tool is the ${key.label}.`],
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Decimal addition and subtraction                                    */
/* ------------------------------------------------------------------ */

function hundredths(r: Random): number {
  let cents = r(11, 1499);
  if (cents % 10 === 0) cents += 1;
  return cents;
}
function tenths(r: Random): number {
  return r(2, 150) * 10;
}

function decimalSum(meta: TemplateMetadata, seed: string, r: Random): Built {
  const subtract = r(0, 9) < 6;
  const unlike = r(0, 4) < 2;
  let left: { cents: number; digits: 1 | 2 };
  let right: { cents: number; digits: 1 | 2 };
  if (unlike) {
    const tenthsFirst = r(0, 1) === 0;
    const a = { cents: tenths(r), digits: 1 as const };
    const b = { cents: hundredths(r), digits: 2 as const };
    left = tenthsFirst ? a : b;
    right = tenthsFirst ? b : a;
  } else {
    left = { cents: hundredths(r), digits: 2 };
    right = { cents: hundredths(r), digits: 2 };
  }
  if (subtract && left.cents < right.cents) [left, right] = [right, left];
  // A tenth is always a whole ten hundredths, so it cannot equal a hundredths
  // amount. Adding 10 hundredths and still showing one decimal place would lie.
  if (subtract && left.cents === right.cents)
    throw new Error("Need unequal decimals");
  const shownL = places(left.cents, left.digits);
  const shownR = places(right.cents, right.digits);
  const op = subtract ? "-" : "+";
  const value = subtract ? left.cents - right.cents : left.cents + right.cents;
  const answer = dollars(value);
  const prompt = `What is $${shownL} ${op} ${shownR}$?`;
  const leaked = new RegExp(
    `(?<![\\d.])${answer.replace(".", "\\.")}(?![\\d])`,
  );
  need(!leaked.test(prompt), "a sum that is not already written");
  return {
    variant: `${subtract ? "sub" : "add"}-${unlike ? "unlike" : "like"}`,
    problem: toProblem(meta, seed, r, {
      prompt,
      answer,
      hint: `Line up the decimal points in $${shownL} ${op} ${shownR}$. Write a tenth as hundredths before you ${subtract ? "subtract" : "add"}.`,
      explanation: [
        `$${shownL}$ is ${dollars(left.cents)} and $${shownR}$ is ${dollars(right.cents)}.`,
        `$${dollars(left.cents)} ${op} ${dollars(right.cents)} = ${answer}$.`,
        `The result is ${answer}.`,
      ],
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Money stories                                                       */
/* ------------------------------------------------------------------ */

function fewestCoins(cents: number): number {
  let left = cents;
  let pieces = 0;
  for (const value of [25, 10, 5, 1]) {
    pieces += Math.floor(left / value);
    left %= value;
  }
  return pieces;
}

/** A payment is one or more bills of 1, 5, 10 or 20 dollars, and sometimes
 * quarters on a bill that does not cover by itself. */
type Tender = { cents: number; phrase: string; quarters: number };

const namedBill = (dollars: number) =>
  `${article(dollars)} ${dollars}-dollar bill`;
const oneBill = namedBill(1);
const fiveBill = namedBill(5);
const tenBill = namedBill(10);
const twentyBill = namedBill(20);
const twoOnes = "two 1-dollar bills";

/** Whole-bill handfuls. Each total is at most the next single bill. */
const WHOLE_TENDERS: readonly Tender[] = [
  { cents: 100, phrase: oneBill, quarters: 0 },
  { cents: 200, phrase: twoOnes, quarters: 0 },
  { cents: 500, phrase: fiveBill, quarters: 0 },
  { cents: 600, phrase: `${fiveBill} and ${oneBill}`, quarters: 0 },
  { cents: 700, phrase: `${fiveBill} and ${twoOnes}`, quarters: 0 },
  { cents: 1000, phrase: tenBill, quarters: 0 },
  { cents: 1100, phrase: `${tenBill} and ${oneBill}`, quarters: 0 },
  { cents: 1200, phrase: `${tenBill} and ${twoOnes}`, quarters: 0 },
  { cents: 1500, phrase: `${tenBill} and ${fiveBill}`, quarters: 0 },
  { cents: 2000, phrase: twentyBill, quarters: 0 },
  { cents: 2100, phrase: `${twentyBill} and ${oneBill}`, quarters: 0 },
  { cents: 2500, phrase: `${twentyBill} and ${fiveBill}`, quarters: 0 },
  { cents: 3000, phrase: `${twentyBill} and ${tenBill}`, quarters: 0 },
];

/** Bills that can take 1–3 quarters when the bills alone fall short. */
const QUARTER_BASES: readonly { cents: number; phrase: string }[] = [
  { cents: 100, phrase: oneBill },
  { cents: 200, phrase: twoOnes },
  { cents: 500, phrase: fiveBill },
  { cents: 600, phrase: `${fiveBill} and ${oneBill}` },
  { cents: 1000, phrase: tenBill },
  { cents: 1500, phrase: `${tenBill} and ${fiveBill}` },
  { cents: 2000, phrase: twentyBill },
];

function nextBill(cost: number): number {
  const bill = [100, 500, 1000, 2000].find((value) => value > cost);
  need(bill !== undefined, "a bill above the cost");
  return bill!;
}

function wholeTenders(cost: number): Tender[] {
  const ceiling = nextBill(cost);
  return WHOLE_TENDERS.filter(
    (tender) => tender.cents > cost && tender.cents <= ceiling,
  );
}

/** Quarters only when they leave less change, in fewer coins, than any whole-bill payment. */
function quarterTenders(cost: number): Tender[] {
  const whole = wholeTenders(cost);
  need(whole.length > 0, "a bill above the cost");
  const bestChange = Math.min(...whole.map((tender) => tender.cents - cost));
  const bestCoins = fewestCoins(bestChange);
  const ceiling = nextBill(cost);
  const out: Tender[] = [];
  for (const base of QUARTER_BASES) {
    if (base.cents > cost) continue;
    for (const quarters of [1, 2, 3]) {
      const paid = base.cents + quarters * 25;
      if (paid <= cost || paid > ceiling) continue;
      const change = paid - cost;
      if (change >= bestChange || fewestCoins(change) >= bestCoins) continue;
      const coins = quarters === 1 ? "a quarter" : count(quarters, "quarter");
      out.push({
        cents: paid,
        phrase: `${base.phrase} and ${coins}`,
        quarters,
      });
    }
  }
  return out;
}

function payTender(r: Random, cost: number): Tender {
  const whole = wholeTenders(cost);
  need(whole.length > 0, "a bill above the cost");
  const withQuarters = quarterTenders(cost);
  if (withQuarters.length > 0 && r(0, 1) === 0) return pick(r, withQuarters);
  return pick(r, whole);
}

function paymentIs(pay: Tender): string {
  const named = `${pay.phrase[0]!.toUpperCase()}${pay.phrase.slice(1)}`;
  const plural = pay.phrase.startsWith("two") || pay.phrase.includes(" and ");
  return `${named} ${plural ? "are" : "is"} ${money(pay.cents)}.`;
}

const worked = (left: number, op: string, right: number, value: number) =>
  `$${dollars(left)} ${op} ${dollars(right)} = ${dollars(value)}$.`;

function moneyStory(meta: TemplateMetadata, seed: string, r: Random): Built {
  const roll = r(0, 9);
  if (roll <= 1) {
    let a = r(125, 875);
    let b = r(125, 875);
    if (a % 100 === 0) a += 15;
    if (b % 100 === 0) b += 25;
    const answer = dollars(a + b);
    return {
      variant: "add",
      problem: toProblem(meta, seed, r, {
        prompt: `A book costs ${money(a)} and a pen costs ${money(b)}. What is the total cost? ${ENTER}`,
        answer,
        responseLabel: "Dollars",
        hint: `The book costs ${money(a)} and the pen costs ${money(b)}. Add the dollars and the cents.`,
        explanation: [
          `Add the two prices.`,
          worked(a, "+", b, a + b),
          `The total cost is ${money(a + b)}.`,
        ],
      }),
    };
  }
  if (roll <= 3) {
    let cost = r(155, 840);
    if (cost % 100 === 0) cost += 15;
    const pay = payTender(r, cost);
    const answer = dollars(pay.cents - cost);
    return {
      variant: "change",
      problem: toProblem(meta, seed, r, {
        prompt: `A snack costs ${money(cost)}. You pay with ${pay.phrase}. How much change do you get back? ${ENTER}`,
        answer,
        responseLabel: "Dollars",
        hint: `The snack costs ${money(cost)}. ${paymentIs(pay)} Subtract the cost from the payment.`,
        explanation: [
          `Change is the payment minus the cost.`,
          worked(pay.cents, "-", cost, pay.cents - cost),
          `You get ${money(pay.cents - cost)} back.`,
        ],
      }),
    };
  }
  if (roll <= 6 && r(0, 1) === 0) {
    const friends = r(2, 5);
    const eachItems = r(2, 3);
    let price = r(15, 85);
    if (price % 5 === 0 && price % 10 === 0) price += 3;
    const items = eachItems * friends;
    const share = eachItems * price;
    const answer = dollars(share);
    return {
      variant: "times-divide",
      problem: toProblem(meta, seed, r, {
        prompt: `Markers cost ${money(price)} each. The club buys ${count(items, "marker")}, and ${count(friends, "friend")} split the cost equally. How much does each friend pay? ${ENTER}`,
        answer,
        responseLabel: "Dollars",
        hint: `Markers cost ${money(price)} each. The club buys ${count(items, "marker")} and ${count(friends, "friend")} split that cost. Find the total, then divide.`,
        explanation: [
          `${count(items, "marker")} at ${money(price)} each cost ${money(items * price)}.`,
          `$${dollars(items * price)} \\div ${friends} = ${dollars(share)}$.`,
          `Each friend pays ${money(share)}.`,
        ],
      }),
    };
  }
  if (roll <= 6) {
    const n = r(2, 8);
    const price = r(15, 95);
    const cost = n * price;
    const pay = payTender(r, cost);
    const answer = dollars(pay.cents - cost);
    return {
      variant: "times-change",
      problem: toProblem(meta, seed, r, {
        prompt: `Each sticker costs ${money(price)}. You buy ${count(n, "sticker")} and pay with ${pay.phrase}. How much change do you get back? ${ENTER}`,
        answer,
        responseLabel: "Dollars",
        hint: `Each sticker costs ${money(price)} and you buy ${count(n, "sticker")}. ${paymentIs(pay)} Find the total cost, then subtract it from the payment.`,
        explanation: [
          `${count(n, "sticker")} at ${money(price)} each cost ${money(cost)}.`,
          worked(pay.cents, "-", cost, pay.cents - cost),
          `You get ${money(pay.cents - cost)} back.`,
        ],
      }),
    };
  }
  let cents = r(11, 99);
  if ([25, 10, 5, 1].includes(cents)) cents += 3;
  const pieces = fewestCoins(cents);
  return {
    variant: "fewest",
    problem: toProblem(meta, seed, r, {
      prompt: `You need ${money(cents)} in quarters, dimes, nickels, and pennies. What is the fewest number of coins that make that amount?`,
      answer: String(pieces),
      responseLabel: "Number of coins",
      hint: `Start with ${money(cents)}. Use the largest coin that fits, then count the coins.`,
      explanation: [
        `Start with ${money(cents)}.`,
        `Take the largest coin that fits each time: quarters, then dimes, nickels, and pennies.`,
        `That uses ${count(pieces, "coin")}.`,
      ],
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Bills and coins                                                     */
/* ------------------------------------------------------------------ */

function moneyModel(meta: TemplateMetadata, seed: string, r: Random): Built {
  const useFive = r(0, 3) === 0;
  const billCount = useFive ? 1 : r(1, 3);
  const bills: MoneyItem[] = useFive
    ? ["five"]
    : Array.from({ length: billCount }, () => "dollar" as const);
  const extra = [0, 0, 0, 0];
  for (let i = 0; i < 6; i++) extra[r(0, 3)]!++;
  const quarters = 1 + extra[0]!;
  const dimes = 1 + extra[1]!;
  const nickels = 1 + extra[2]!;
  const pennies = 1 + extra[3]!;
  const coins: MoneyItem[] = [
    ...Array.from({ length: quarters }, () => "quarter" as const),
    ...Array.from({ length: dimes }, () => "dime" as const),
    ...Array.from({ length: nickels }, () => "nickel" as const),
    ...Array.from({ length: pennies }, () => "penny" as const),
  ];
  const billPhrase = useFive
    ? fiveBill
    : billCount === 1
      ? oneBill
      : count(billCount, "one-dollar bill");
  const billCents = bills.reduce((sum, item) => sum + CENTS[item], 0);
  const total = billCents + coins.reduce((sum, item) => sum + CENTS[item], 0);
  const answer = dollars(total);
  const figure: SemanticFigure = {
    kind: "money-sets",
    sets: [
      { label: "A", items: bills },
      { label: "B", items: coins },
    ],
  };
  return {
    variant: useFive ? "five-plus-coins" : `dollars-${billCount}`,
    problem: toProblem(meta, seed, r, {
      prompt: `Set A shows ${billPhrase}. Set B shows the coins. How much money is there in all? ${ENTER}`,
      answer,
      responseLabel: "Dollars",
      figure,
      hint: `Set A shows ${billPhrase}. Add those bills, then add the value of each coin in set B.`,
      explanation: [
        `Set A shows ${billPhrase}, worth ${money(billCents)}.`,
        `Set B shows ${count(quarters, "quarter")}, ${count(dimes, "dime")}, ${count(nickels, "nickel")}, and ${count(pennies, "penny")}.`,
        worked(billCents, "+", total - billCents, total),
        `The total is ${money(total)}.`,
      ],
    }),
  };
}

const builders: Record<
  string,
  (meta: TemplateMetadata, seed: string, r: Random) => Built
> = {
  "elapsed-time-intervals": elapsed,
  "conversion-table-slots": conversion,
  "unit-rename-larger": renameLarger,
  "measurement-line-fraction-story": lineStory,
  "measuring-tool-choice": toolChoice,
  "decimal-sum-difference": decimalSum,
  "money-decimal-story": moneyStory,
  "money-model-decimal": moneyModel,
};

/** Private model: the variant is for tests; only the public problem is served. */
export function grade4MeasurementMoneyCase(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = grade4MeasurementMoneyTemplates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  let last = "";
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return build(meta, seed, r);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
      last = error.message;
    }
  }
  throw new Error(`${templateId}: no instance for ${seed} (${last})`);
}

export function generateGrade4MeasurementMoneyProblem(
  templateId: string,
  seed: string,
) {
  return grade4MeasurementMoneyCase(templateId, seed).problem;
}

export const grade4MeasurementMoneyGlossary: Record<
  string,
  { senses?: Record<string, string>; noLink?: string[] }
> = {
  "elapsed-time-intervals": {
    senses: { unit: "unit", units: "unit" },
  },
  "conversion-table-slots": {
    senses: { unit: "unit", units: "unit" },
  },
  "unit-rename-larger": {
    senses: { unit: "unit", units: "unit" },
  },
  "measurement-line-fraction-story": {
    senses: {
      unit: "unit",
      units: "unit",
      fraction: "fraction",
      fractions: "fraction",
      denominator: "denominator",
      denominators: "denominator",
      "number line": "number-line",
      "number lines": "number-line",
    },
  },
  "measuring-tool-choice": {
    senses: {
      balance: "balance-scale",
      balances: "balance-scale",
      length: "length",
      lengths: "length",
      weight: "weight",
      weights: "weight",
      mass: "mass",
      unit: "unit",
      units: "unit",
    },
    noLink: ["scale", "scales"],
  },
  "decimal-sum-difference": {
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      "decimal point": "decimal-point",
      "decimal points": "decimal-point",
    },
  },
  "money-decimal-story": {
    senses: {
      change: "change-money",
      difference: "difference-subtract",
      differences: "difference-subtract",
      coin: "coin",
      coins: "coin",
      "decimal point": "decimal-point",
      "decimal points": "decimal-point",
    },
    noLink: ["quarter", "quarters"],
  },
  "money-model-decimal": {
    senses: { coin: "coin", coins: "coin" },
    noLink: ["quarter", "quarters"],
  },
};
