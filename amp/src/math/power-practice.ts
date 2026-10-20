import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { act, step } from "./scene/author";
import type { Scene } from "./scene/spec";

/** Whole-number powers (6.EE.A.1, with exponents in the order of operations,
 * 6.EE.A.2c): evaluate, find a missing exponent, move between a repeated
 * product and a power, compare powers, and read doubling as a power. Every
 * value stays in mental-math range: no calculator is offered. */
type Random = (low: number, high: number) => number;
type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  answer?: string;
  label?: string;
  choices?: Choice[];
  hint: string;
  explanation: string[];
  figure?: Scene;
  tags: string[];
};

const definitions: [string, string, string, "choice" | "scene" | ""][] = [
  [
    "integer-power",
    "Evaluate powers",
    "Evaluate a whole-number power with a mental-math-sized value: powers of 2 to 2¹⁰, of 3 to 3⁵, of 4 and 5 to the fourth, of 6–9 to the cube, and of 10.",
    "",
  ],
  [
    "power-missing-exponent",
    "Find a missing exponent",
    "Find the exponent that makes a power equal a given whole number, or count the factors of a base in it.",
    "",
  ],
  [
    "power-repeated-product",
    "Powers and repeated products",
    "Match a repeated product to its power, or a power to its repeated product, against swapped, multiplied and added forms.",
    "choice",
  ],
  [
    "power-compare",
    "Compare powers",
    "Decide which of two powers is greater, such as 2⁵ and 5², or a power and the product of its base and exponent.",
    "choice",
  ],
  [
    "power-order-trap",
    "Powers in expressions",
    "Evaluate a product or sum with a power, with and without parentheses: the exponent applies only to what it touches.",
    "",
  ],
  [
    "power-doubling-story",
    "Doubling and tripling as powers",
    "Read repeated doubling or tripling from bars and find a later value as a power of 2 or 3.",
    "scene",
  ],
];
export const powerTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, description, capability]) => ({
    id,
    title,
    description,
    version: 1 as const,
    skillId: "integer-powers",
    gradeBand: "6–8",
    ...(capability === "choice"
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : capability === "scene"
        ? { requiredFigureCapability: "scenes-v1" as const }
        : {}),
  }),
);

// ------------------------------------------------------------------ helpers
const math = (tex: string) => `$${tex}$`;
const pow = (b: number, e: number) => `${b}^{${e}}`;
const product = (b: number, e: number) => Array(e).fill(b).join(" \\cdot ");
const sum = (b: number, e: number) => Array(e).fill(b).join(" + ");
/** 10000 → "10{,}000" in TeX; prose uses "10,000". */
const texNumber = (n: number) => n.toLocaleString("en-US").replace(/,/g, "{,}");
const prose = (n: number) => n.toLocaleString("en-US");
const words = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const factors = (n: number) => `${words[n]} factor${n === 1 ? "" : "s"}`;
function pick<T>(r: Random, items: readonly T[]): T {
  return items[r(0, items.length - 1)]!;
}
function shuffle<T>(r: Random, items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = r(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}
function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let v: number;
    do
      v = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (v >= limit);
    return low + (v % span);
  };
}

/** Powers with exponent 2 or more whose values are sensible without a
 * calculator. Base 2 runs furthest: doubling is the fact pattern to know. */
export const MENTAL_POWERS: readonly [number, number][] = [
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((e) => [2, e] as [number, number]),
  ...[2, 3, 4, 5].map((e) => [3, e] as [number, number]),
  ...[2, 3, 4].map((e) => [4, e] as [number, number]),
  ...[2, 3, 4].map((e) => [5, e] as [number, number]),
  ...[6, 7, 8, 9].flatMap((b) => [2, 3].map((e) => [b, e] as [number, number])),
  ...[2, 3, 4, 5, 6].map((e) => [10, e] as [number, number]),
];

/** One strategic first move for b^e that builds from a smaller power. */
function buildHint(b: number, e: number): string {
  if (b === 10)
    return `Each factor of 10 puts one more zero after the 1. Count the factors in ${math(pow(10, e))}.`;
  if (e === 2)
    return `${math(pow(b, 2))} is two factors of ${b}: ${math(product(b, 2))}.`;
  if (e === 3)
    return `Build from the square: ${math(`${pow(b, 3)} = ${pow(b, 2)} \\cdot ${b}`)}. Find ${math(pow(b, 2))}, then multiply by ${b} once more.`;
  if (b === 2 && e >= 6)
    return `Start from a power you know, ${math("2^5 = 32")}, and double once for each extra factor of 2: ${math(`2^{${e}} = 2^5 \\cdot 2^{${e - 5}}`)}.`;
  if (e % 2 === 0)
    return `Split the factors into two equal halves: ${math(`${pow(b, e)} = ${pow(b, e / 2)} \\cdot ${pow(b, e / 2)}`)}. Find ${math(pow(b, e / 2))}, then multiply it by itself.`;
  return `Peel off one factor: ${math(`${pow(b, e)} = ${pow(b, e - 1)} \\cdot ${b}`)}. Find ${math(pow(b, e - 1))} as ${math(`${pow(b, (e - 1) / 2)} \\cdot ${pow(b, (e - 1) / 2)}`)}, then multiply by ${b}.`;
}
/** The worked build-up of b^e, ending in its value. */
function buildSteps(b: number, e: number): string {
  if (e === 2) return math(`${product(b, 2)} = ${texNumber(b * b)}`);
  if (b === 10) return math(`${pow(10, e)} = ${texNumber(10 ** e)}`);
  if (e === 3)
    return math(
      `${pow(b, 2)} \\cdot ${b} = ${b * b} \\cdot ${b} = ${texNumber(b ** 3)}`,
    );
  if (b === 2 && e >= 6)
    return math(
      `2^5 \\cdot 2^{${e - 5}} = 32 \\cdot ${2 ** (e - 5)} = ${texNumber(2 ** e)}`,
    );
  if (e % 2 === 0) {
    const half = b ** (e / 2);
    return math(
      `${pow(b, e / 2)} \\cdot ${pow(b, e / 2)} = ${half} \\cdot ${half} = ${texNumber(b ** e)}`,
    );
  }
  const half = b ** ((e - 1) / 2);
  return math(
    `${pow(b, (e - 1) / 2)} \\cdot ${pow(b, (e - 1) / 2)} \\cdot ${b} = ${half} \\cdot ${half} \\cdot ${b} = ${texNumber(b ** e)}`,
  );
}

// ---------------------------------------------------------------- generators
function evaluate(r: Random): Draft {
  const roll = r(1, 100);
  let b: number, e: number;
  if (roll <= 5) [b, e] = [r(2, 10), 0];
  else if (roll <= 10) [b, e] = [r(2, 10), 1];
  else [b, e] = pick(r, MENTAL_POWERS);
  const value = b ** e;
  const frame = r(0, 2);
  const prompt =
    frame === 0
      ? `What is ${math(pow(b, e))}?`
      : frame === 1
        ? `Evaluate ${math(pow(b, e))}.`
        : `Find the value of ${math(pow(b, e))}.`;
  const hint =
    e === 0
      ? `Walk down the pattern: ${math(`${pow(b, 3)} = ${texNumber(b ** 3)}`)}, then ${math(`${pow(b, 2)} = ${b * b}`)}. Each step down divides by ${b}. Keep going down to the exponent 0.`
      : e === 1
        ? `The exponent counts the factors of ${b}. ${math(pow(b, 1))} has just one.`
        : buildHint(b, e);
  const explanation =
    e === 0
      ? [
          `Going down from ${math(`${pow(b, 2)} = ${b * b}`)} to ${math(`${pow(b, 1)} = ${b}`)} divides by ${b}.`,
          `One more step down divides by ${b} again: ${math(`${pow(b, 0)} = ${b} \\div ${b} = 1`)}.`,
        ]
      : e === 1
        ? [
            `${math(pow(b, 1))} is a single factor of ${b}.`,
            `${math(`${pow(b, 1)} = ${b}`)}.`,
          ]
        : [
            `${math(pow(b, e))} means ${factors(e)} of ${b}: ${math(product(b, e))}.`,
            `${buildSteps(b, e)}.`,
          ];
  return {
    prompt,
    answer: String(value),
    hint,
    explanation,
    tags: [
      e === 0
        ? "zero"
        : e === 1
          ? "one"
          : b === 2
            ? "base-two"
            : b === 10
              ? "base-ten"
              : "other",
    ],
  };
}

function missingExponent(r: Random): Draft {
  const [b, e] = pick(r, MENTAL_POWERS);
  const value = b ** e;
  const frame = r(0, 1);
  const prompt =
    frame === 0
      ? `If ${math(`${b}^n = ${texNumber(value)}`)}, what is ${math("n")}?`
      : `How many factors of ${b} multiply to make ${prose(value)}?`;
  const hint =
    b === 10
      ? `Each factor of 10 adds one zero. Count the zeros in ${prose(value)}.`
      : `Divide ${prose(value)} by ${b} again and again until you reach 1. Count the divisions.`;
  return {
    prompt,
    answer: String(e),
    label: frame === 0 ? "Exponent n" : "Number of factors",
    hint,
    explanation: [
      `${math(`${product(b, e)} = ${texNumber(value)}`)}: that is ${factors(e)} of ${b}.`,
      frame === 0
        ? `So ${math(`${b}^{${e}} = ${texNumber(value)}`)} and ${math(`n = ${e}`)}.`
        : `So ${prose(value)} is ${math(pow(b, e))}: ${e} factors.`,
    ],
    tags: [frame === 0 ? "equation" : "count", b === 2 ? "base-two" : "other"],
  };
}

function repeatedProduct(r: Random): Draft {
  if (r(0, 1) === 0) {
    // A product of equal factors → its power.
    let b: number, e: number;
    do {
      b = r(2, 9);
      e = r(3, 6);
    } while (b === e || b === e - 1 || b ** e === e ** b);
    return {
      prompt: `Which power equals ${math(product(b, e))}?`,
      choices: [
        { label: math(pow(b, e)), correct: true },
        {
          label: math(pow(e, b)),
          feedback: `${math(pow(e, b))} is ${factors(b)} of ${e}. The repeated factor, ${b}, is the base; the exponent counts how many there are.`,
        },
        {
          label: math(`${b} \\cdot ${e}`),
          feedback: `${math(`${b} \\cdot ${e}`)} is ${e} copies of ${b} added, not multiplied. A power multiplies the copies.`,
        },
        {
          label: math(pow(b, e - 1)),
          feedback: `This counts the multiplication signs. There are ${e - 1} signs but ${factors(e)} of ${b}.`,
        },
      ],
      hint: `Count how many times ${b} appears as a factor. The repeated factor is the base; the count is the exponent.`,
      explanation: [
        `The factor ${b} appears ${words[e]} times.`,
        `${factors(e)[0]!.toUpperCase()}${factors(e).slice(1)} of ${b} is written ${math(pow(b, e))}.`,
      ],
      tags: ["to-power"],
    };
  }
  // A power → its repeated product.
  let b: number, e: number;
  do {
    b = r(2, 6);
    e = r(2, 5);
  } while (b === e || b ** e === e ** b);
  return {
    prompt: `Which product equals ${math(pow(b, e))}?`,
    choices: [
      { label: math(product(b, e)), correct: true },
      {
        label: math(product(e, b)),
        feedback: `This is ${factors(b)} of ${e}, which is ${math(pow(e, b))}. In ${math(pow(b, e))} the base ${b} is the factor, and ${e} counts the factors.`,
      },
      {
        label: math(`${b} \\cdot ${e}`),
        feedback: `${math(`${b} \\cdot ${e}`)} multiplies the base by the exponent. The exponent ${e} says how many factors of ${b} to multiply.`,
      },
      {
        label: math(sum(b, e)),
        feedback: `This adds ${e} copies of ${b}. A power multiplies them.`,
      },
    ],
    hint: `The exponent ${e} says how many factors of ${b} to write. Multiply them; don't add.`,
    explanation: [
      `In ${math(pow(b, e))} the base is ${b} and the exponent is ${e}.`,
      `Write ${factors(e)} of ${b}: ${math(`${pow(b, e)} = ${product(b, e)}`)}.`,
    ],
    tags: ["to-product"],
  };
}

const equal = "They are equal";
function compare(r: Random): Draft {
  if (r(0, 9) < 6) {
    // a^b against b^a.
    const [a, b] = pick(r, [
      [2, 3],
      [2, 4],
      [2, 5],
      [2, 6],
      [3, 4],
      [3, 5],
    ] as const);
    const [x, y] = r(0, 1) ? [a, b] : [b, a];
    const left = x ** y,
      right = y ** x;
    const greater =
      left === right ? null : left > right ? pow(x, y) : pow(y, x);
    const winner = left === right ? equal : math(greater!);
    const options = [math(pow(x, y)), math(pow(y, x)), equal];
    return {
      prompt: `Which is greater, ${math(pow(x, y))} or ${math(pow(y, x))}?`,
      choices: options.map((label) =>
        label === winner
          ? { label, correct: true }
          : {
              label,
              feedback:
                label === equal
                  ? `Swapping the base and exponent usually changes the value. Work out ${math(`${pow(x, y)} = ${left}`)} and ${math(`${pow(y, x)} = ${right}`)}.`
                  : `Work out both: ${math(`${pow(x, y)} = ${left}`)} and ${math(`${pow(y, x)} = ${right}`)}.`,
            },
      ),
      hint: `Write each power as its factors: ${math(pow(x, y))} is ${factors(y)} of ${x}, and ${math(pow(y, x))} is ${factors(x)} of ${y}. Multiply both out.`,
      explanation: [
        `${math(`${pow(x, y)} = ${product(x, y)} = ${left}`)}.`,
        `${math(`${pow(y, x)} = ${product(y, x)} = ${right}`)}.`,
        left === right
          ? `Both are ${left}, so they are equal.`
          : `${Math.max(left, right)} > ${Math.min(left, right)}, so ${math(greater!)} is greater.`,
      ],
      tags: [left === right ? "equal" : "swap"],
    };
  }
  // b^e against b·e: the classic misreading of an exponent.
  const [b, e] = pick(r, [
    [2, 2],
    [2, 3],
    [3, 3],
    [2, 4],
    [3, 4],
    [4, 3],
    [5, 3],
    [3, 2],
    [4, 2],
    [5, 2],
  ] as const);
  const power = b ** e,
    times = b * e;
  const winner =
    power === times
      ? equal
      : power > times
        ? math(pow(b, e))
        : math(`${b} \\cdot ${e}`);
  const options = [math(pow(b, e)), math(`${b} \\cdot ${e}`), equal];
  return {
    prompt: `Which is greater, ${math(pow(b, e))} or ${math(`${b} \\cdot ${e}`)}?`,
    choices: options.map((label) =>
      label === winner
        ? { label, correct: true }
        : {
            label,
            feedback: `${math(pow(b, e))} multiplies ${factors(e)} of ${b}: ${math(`${product(b, e)} = ${power}`)}, while ${math(`${b} \\cdot ${e} = ${times}`)}.`,
          },
    ),
    hint: `${math(pow(b, e))} is not ${b} times ${e}. Write it as ${factors(e)} of ${b} and multiply.`,
    explanation: [
      `${math(`${pow(b, e)} = ${product(b, e)} = ${power}`)}, and ${math(`${b} \\cdot ${e} = ${times}`)}.`,
      power === times
        ? `Both are ${power}, so they are equal.`
        : `${power} > ${times}, so ${math(pow(b, e))} is greater.`,
    ],
    tags: [power === times ? "equal" : "times"],
  };
}

function orderTrap(r: Random): Draft {
  const form = r(0, 3);
  const verb = r(0, 1) ? "What is" : "Evaluate";
  const ask = (tex: string) =>
    verb === "What is" ? `What is ${math(tex)}?` : `Evaluate ${math(tex)}.`;
  if (form === 0) {
    // a · b^e: the exponent belongs to b alone.
    const e = r(0, 3) ? 2 : 3;
    const a = r(2, 5),
      b = e === 2 ? r(2, 9) : r(2, 4);
    const v = a * b ** e;
    return {
      prompt: ask(`${a} \\cdot ${pow(b, e)}`),
      answer: String(v),
      hint: `The exponent belongs to ${b} alone. Find ${math(pow(b, e))} first, then multiply by ${a}.`,
      explanation: [
        `Powers come before multiplication: ${math(`${pow(b, e)} = ${b ** e}`)}.`,
        `Not ${math(`(${a} \\cdot ${b})^{${e}}`)}: the exponent applies only to ${b}.`,
        `${math(`${a} \\cdot ${b ** e} = ${v}`)}.`,
      ],
      tags: ["times-power"],
    };
  }
  if (form === 1) {
    // (a · b)^2: the parentheses come first.
    let a: number, b: number;
    do {
      a = r(2, 5);
      b = r(2, 6);
    } while (a * b > 12);
    const v = (a * b) ** 2;
    return {
      prompt: ask(`(${a} \\cdot ${b})^2`),
      answer: String(v),
      hint: `Parentheses first: find ${math(`${a} \\cdot ${b}`)}, then square that product.`,
      explanation: [
        `Inside the parentheses: ${math(`${a} \\cdot ${b} = ${a * b}`)}.`,
        `The exponent squares the whole product, not just ${b}.`,
        `${math(`${a * b}^2 = ${a * b} \\cdot ${a * b} = ${v}`)}.`,
      ],
      tags: ["power-of-product"],
    };
  }
  if (form === 2) {
    // a + b^2.
    const a = r(1, 9),
      b = r(2, 9);
    const v = a + b * b;
    return {
      prompt: ask(`${a} + ${pow(b, 2)}`),
      answer: String(v),
      hint: `Square ${b} before you add: the exponent is on ${b}, not on ${a} + ${b}.`,
      explanation: [
        `Powers come before addition: ${math(`${pow(b, 2)} = ${b * b}`)}.`,
        `${math(`${a} + ${b * b} = ${v}`)}.`,
      ],
      tags: ["plus-power"],
    };
  }
  // (a + b)^2, which is not a^2 + b^2.
  let a: number, b: number;
  do {
    a = r(1, 7);
    b = r(2, 7);
  } while (a + b > 12 || a === b);
  const v = (a + b) ** 2;
  return {
    prompt: ask(`(${a} + ${b})^2`),
    answer: String(v),
    hint: `Parentheses first: add ${a} and ${b}, then square the sum. Squaring each number separately gives a different value.`,
    explanation: [
      `Inside the parentheses: ${math(`${a} + ${b} = ${a + b}`)}.`,
      `${math(`${a + b}^2 = ${a + b} \\cdot ${a + b} = ${v}`)}, which is not ${math(`${a}^2 + ${b}^2 = ${a * a + b * b}`)}.`,
      `So ${math(`(${a} + ${b})^2 = ${v}`)}.`,
    ],
    tags: ["power-of-sum"],
  };
}

const stories = [
  {
    base: 2,
    axis: "Folds",
    unit: "layers",
    label: "Layers",
    max: 8,
    text: (n: number) =>
      `Folding a sheet of paper in half doubles its layers. The bars show the layers after 0 to 3 folds. How many layers are there after ${n} folds?`,
    per: "fold",
  },
  {
    base: 2,
    axis: "Hours",
    unit: "cells",
    label: "Cells",
    max: 10,
    text: (n: number) =>
      `One cell splits into two every hour, so the number of cells doubles each hour. The bars show the cells at hours 0 to 3. How many cells are there after ${n} hours?`,
    per: "hour",
  },
  {
    base: 3,
    axis: "Day",
    unit: "people",
    label: "People",
    max: 6,
    text: (n: number) =>
      `On day 0, one person learns a secret. Each day, everyone who learned it the day before tells 3 new people. The bars show how many new people learn it on days 0 to 3. How many new people learn it on day ${n}?`,
    per: "day",
  },
] as const;
/** Doubling (or tripling) bars over steps 0–3: the givens only. */
export function growthBars(base: number, axis: string): Scene {
  const xs = [0, 1, 2, 3];
  return {
    v: 1,
    title: `Values multiplied by ${base} at each step, steps 0 to 3`,
    elements: [
      {
        type: "bars",
        id: "grow",
        categories: xs.map(String),
        series: [{ values: xs.map((x) => base ** x), color: "accent" }],
        axisName: axis,
      },
    ],
    steps: [
      step(
        `Each bar is ${base} times the one before: one more factor of ${base} per step.`,
        ...xs.map((x) => act.highlight(`grow.series.0.bar.${x}`)),
      ),
      step(
        `Step 3 shows ${math(`${base}^3 = ${base ** 3}`)}. Keep multiplying by ${base} to reach the step asked.`,
        act.highlight("grow.series.0.value.3"),
      ),
    ],
  };
}
function doublingStory(r: Random): Draft {
  const s = pick(r, stories);
  const n = r(4, s.max);
  const v = s.base ** n;
  return {
    prompt: s.text(n),
    answer: String(v),
    label: s.label,
    figure: growthBars(s.base, s.axis),
    hint: `One factor of ${s.base} per ${s.per}, so step ${n} is ${math(pow(s.base, n))}. Start from the last bar, ${math(`${s.base}^3 = ${s.base ** 3}`)}, and multiply by ${s.base} for each ${s.per} after it.`,
    explanation: [
      `Each ${s.per} multiplies by ${s.base}, so after ${n} the count is ${factors(n)} of ${s.base}: ${math(pow(s.base, n))}.`,
      `${math(`${pow(s.base, n)} = ${s.base}^3 \\cdot ${pow(s.base, n - 3)} = ${s.base ** 3} \\cdot ${s.base ** (n - 3)} = ${texNumber(v)}`)} ${s.unit}.`,
    ],
    tags: [s.unit],
  };
}

const generators: Record<string, (r: Random) => Draft> = {
  "integer-power": evaluate,
  "power-missing-exponent": missingExponent,
  "power-repeated-product": repeatedProduct,
  "power-compare": compare,
  "power-order-trap": orderTrap,
  "power-doubling-story": doublingStory,
};

export function powerPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[] } {
  const meta = powerTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown power template ${id}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const d = generators[id]!(r);
  let answer = d.answer ?? "";
  let response: GeneratedProblem["public"]["response"] = {
    kind: "number",
    label: d.label ?? "Answer",
  };
  let choiceFeedback: Record<string, string> | undefined;
  if (d.choices) {
    const choices = [...d.choices];
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error(`Ambiguous choices: ${id}/${seed}`);
    shuffle(r, choices);
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: "Choose one answer",
      options: choices.map((c, i) => {
        const option = `option-${"abcd"[i]}`;
        if (c.correct) answer = option;
        else choiceFeedback![option] = c.feedback!;
        return { id: option, label: c.label };
      }),
    };
  }
  return {
    tags: d.tags,
    problem: {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([id, meta.version, seed]))
          .digest("hex"),
        templateId: id,
        templateVersion: meta.version,
        seed,
        prompt: d.prompt,
        skillId: meta.skillId,
        response,
        ...(d.figure
          ? { figure: { kind: "scene" as const, scene: d.figure } }
          : {}),
      },
      answer,
      hint: d.hint,
      explanation: d.explanation,
      ...(choiceFeedback ? { choiceFeedback } : {}),
    },
  };
}
export const generatePowerProblem = (id: string, seed: string) =>
  powerPrintCase(id, seed).problem;
