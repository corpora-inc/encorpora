import { nounFor } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemVariant,
  TemplateMetadata,
} from "./contracts";
import type { MultiPartChoiceResponse } from "./multi-part-choice";
import { serializeMultiPart } from "./multi-part-choice";
import {
  axisRecord,
  chooseAxes,
  defineAxis,
  versionGatedAxes,
} from "./variation/axes";

type Random = (low: number, high: number) => number;
type Option = { label: string; feedback?: string };
type Case = {
  prompt: string;
  /** A number answer, or the correct option followed by three distractors. */
  answer: string | Option[];
  explanation: string[];
  tags: string[];
  givens?: RealNumberGivens;
  /** Display order of `answer` options, when the explanation discusses them in that order. */
  order?: number[];
  /** Set when the prompt is not one the legacy hint parser can read. */
  hint?: string;
  /** Response label when a numeric family asks a different question. */
  label?: string;
  parts?: {
    response: MultiPartChoiceResponse;
    correct: readonly string[];
  };
};

const choice = { requiredResponseCapability: "single-choice-v1" as const };
/** Families whose version-2 axis adds a clause surface. Legacy stays the
 * first value and is silent, so a stored version-1 instance still reprints. */
const SCIENTIFIC_VARIANT = new Set([
  "scientific-to-standard",
  "standard-to-scientific",
  "scientific-times-larger",
]);
export const realNumberTemplates: readonly TemplateMetadata[] = [
  ...(
    [
    [
      "classify-real-number",
      "Rational or irrational",
      "irrational-numbers",
      "Identify the one rational or irrational number among roots, repeating decimals, fractions and multiples of $\\pi$.",
      true,
    ],
    [
      "repeating-decimal-to-fraction",
      "Repeating decimals as fractions",
      "irrational-numbers",
      "Write a repeating decimal as a fraction in simplest form by subtracting shifted copies.",
      false,
    ],
    [
      "root-between-integers",
      "Locate a root between whole numbers",
      "approximate-roots",
      "Find the consecutive whole numbers that bound a square or cube root.",
      false,
    ],
    [
      "root-nearest-tenth",
      "Square root to the nearest tenth",
      "approximate-roots",
      "Approximate a square root to the nearest tenth by squaring tenths and the halfway point.",
      false,
    ],
    [
      "compare-irrational-values",
      "Compare irrational numbers",
      "approximate-roots",
      "Order roots, fractions and decimals by placing each between consecutive tenths.",
      true,
    ],
    [
      "solve-square-cube-equation",
      "Solve square and cube equations",
      "approximate-roots",
      "Find every real solution of a square or cube equation, using root symbols when needed.",
      true,
    ],
    [
      "scientific-to-standard",
      "Scientific notation to standard form",
      "scientific-notation",
      "Write a number given in scientific notation in standard form.",
      false,
    ],
    [
      "standard-to-scientific",
      "Standard form to scientific notation",
      "scientific-notation",
      "Write a large or small number in scientific notation.",
      true,
    ],
    [
      "scientific-times-larger",
      "How many times as large",
      "scientific-notation",
      "Compare two numbers in scientific notation by dividing coefficients and subtracting exponents.",
      false,
    ],
    [
      "scientific-operations",
      "Calculate in scientific notation",
      "scientific-notation",
      "Multiply, divide, add or subtract numbers in scientific notation and give the result in scientific notation.",
      true,
    ],
    ] as const
  ).map(([id, title, skillId, description, isChoice]) => ({
    id,
    title,
    skillId,
    description,
    gradeBand: "6–8" as const,
    version: SCIENTIFIC_VARIANT.has(id) ? 2 : 1,
    ...(SCIENTIFIC_VARIANT.has(id) ? { reprintsFrom: 1 as const } : {}),
    ...(isChoice ? choice : {}),
  })),
  {
    id: "choose-unit-size",
    title: "Choose a unit you can picture",
    skillId: "scientific-notation",
    description:
      "Choose the unit that writes a very large or very small measure as a number from 1 up to 1,000, then choose that number.",
    gradeBand: "6–8",
    version: 1,
    requiredResponseCapability: "multi-part-choice-v1",
  },
];

const hints: Record<string, string> = {
  "classify-real-number":
    "A rational number can be written as a fraction of two integers; its decimal ends or repeats. Check each number: is it a perfect square or cube under the root, a fraction, or a decimal that ends or repeats?",
  "repeating-decimal-to-fraction":
    "Call the decimal $x$. Multiply $x$ by a power of 10 that shifts one full repeating block past the decimal point, then subtract so the endless tails cancel.",
  "root-between-integers":
    "Find the perfect squares (or cubes) just below and just above the number under the root. Their roots are the two whole numbers.",
  "root-nearest-tenth":
    "Find the two whole numbers first, then square tenths between them until the number under the root is caught between two squares. Square the halfway point to decide which tenth is nearer.",
  "compare-irrational-values":
    "Place each number between two consecutive tenths: square or cube tenths for a root, divide for a fraction. Numbers in different intervals are ordered by their intervals.",
  "solve-square-cube-equation":
    "Ask which numbers give $p$ when squared (or cubed). A positive number has two square roots, one positive and one negative; every number has exactly one real cube root, with the same sign.",
  "scientific-to-standard":
    "The exponent counts how many places the decimal point moves: right for a positive exponent, left for a negative one. Fill empty places with zeros.",
  "standard-to-scientific":
    "Move the decimal point so exactly one nonzero digit is to its left. The number of places moved is the exponent: positive if the number is 10 or more, negative if it is less than 1.",
  "scientific-times-larger":
    "Divide the larger number by the smaller. Divide the coefficients, and subtract the exponents of the powers of 10.",
  "scientific-operations":
    "Multiply or divide coefficients and combine the powers of 10 with exponent rules. To add or subtract, first write both numbers with the same power of 10. Then adjust the coefficient to be at least 1 and less than 10.",
  "choose-unit-size":
    "Each step to a smaller unit multiplies the number by 1,000. Stop when the number is at least 1 and less than 1,000.",
};

/** Clause surfaces. `exact` is the stored task. A version below `since` is
 * forced back to it, and that draw is left out of the variant record. */
export const realNumberTaskAxes = {
  "standard-to-scientific": {
    task: defineAxis("task", ["exact", "single-digit-estimate"] as const, {
      legacy: "exact",
      silentLegacy: true,
      since: 2,
    }),
  },
  "scientific-times-larger": {
    task: defineAxis(
      "task",
      ["exact", "estimate-first", "estimate-second", "times-as-much"] as const,
      { legacy: "exact", silentLegacy: true, since: 2 },
    ),
  },
  "scientific-to-standard": {
    task: defineAxis("task", ["exact", "display", "product"] as const, {
      legacy: "exact",
      silentLegacy: true,
      since: 2,
    }),
  },
} as const;
type TaskId = keyof typeof realNumberTaskAxes;
type TaskOf<I extends string> = I extends TaskId
  ? (typeof realNumberTaskAxes)[I]["task"]["values"][number]
  : "exact";

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
const pick = <T>(r: Random, values: readonly T[]): T =>
  values[r(0, values.length - 1)]!;
function shuffle<T>(values: T[], r: Random): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = r(0, i);
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
/** TeX for a reduced signed fraction, an integer when the denominator is 1. */
function frac(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  [n, d] = [n / g, d / g];
  if (d === 1) return String(n);
  return `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
}
function fracAnswer(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
}
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));
const intRoot = (n: number, index: 2 | 3) => {
  let k = Math.floor(Math.round(Math.abs(n) ** (1 / index) * 1e6) / 1e6);
  while ((k + 1) ** index <= Math.abs(n)) k++;
  while (k ** index > Math.abs(n)) k--;
  return k;
};
const isCube = (n: number) => intRoot(n, 3) ** 3 === Math.abs(n);
const rootTex = (n: number, index: 2 | 3) =>
  index === 2 ? `\\sqrt{${n}}` : `\\sqrt[3]{${n}}`;
const placeWords: Record<number, string> = {
  [-1]: "tenths",
  [-2]: "hundredths",
  [-3]: "thousandths",
  [-4]: "ten-thousandths",
  [-5]: "hundred-thousandths",
  [-6]: "millionths",
  [-7]: "ten-millionths",
  [-8]: "hundred-millionths",
  [-9]: "billionths",
  0: "ones",
  1: "tens",
  2: "hundreds",
  3: "thousands",
  4: "ten-thousands",
  5: "hundred-thousands",
  6: "millions",
  7: "ten-millions",
  8: "hundred-millions",
  9: "billions",
  10: "ten-billions",
  11: "hundred-billions",
  12: "trillions",
};
const countWords = [
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
const places = (n: number) =>
  `${n <= 10 ? countWords[n] : n} ${n === 1 ? "place" : "places"}`;

// ——— Exact decimals: value = m × 10^e, with no trailing zeros in m. ———
export type Dec = { m: bigint; e: number };
function dec(m: bigint, e = 0): Dec {
  if (m === 0n) return { m, e: 0 };
  while (m % 10n === 0n) {
    m /= 10n;
    e++;
  }
  return { m, e };
}
function parseDec(text: string): Dec {
  const [whole, part = ""] = text.split(".");
  return dec(BigInt(`${whole}${part}`), -part.length);
}
const pow10 = (n: number) => 10n ** BigInt(n);
const mul = (a: Dec, b: Dec) => dec(a.m * b.m, a.e + b.e);
function add(a: Dec, b: Dec): Dec {
  const e = Math.min(a.e, b.e);
  return dec(a.m * pow10(a.e - e) + b.m * pow10(b.e - e), e);
}
const neg = (a: Dec): Dec => ({ m: -a.m, e: a.e });
const shift = (a: Dec, n: number) => dec(a.m, a.e + n);
/** Exact terminating quotient, or null when the decimal would not end. */
function div(a: Dec, b: Dec): Dec | null {
  const scaled = a.m * pow10(18);
  if (scaled % b.m !== 0n) return null;
  return dec(scaled / b.m, a.e - b.e - 18);
}
const same = (a: Dec, b: Dec) => a.m === b.m && a.e === b.e;
const compare = (a: Dec, b: Dec) => {
  const d = add(a, neg(b)).m;
  return d === 0n ? 0 : d > 0n ? 1 : -1;
};
/** Exponent of the leading digit: 307 → 2, 0.0307 → −2. */
const lead = (a: Dec) => String(a.m < 0n ? -a.m : a.m).length - 1 + a.e;
function plain(a: Dec): string {
  const sign = a.m < 0n ? "-" : "",
    digits = String(a.m < 0n ? -a.m : a.m);
  if (a.e >= 0) return sign + digits + "0".repeat(a.e);
  const point = digits.length + a.e;
  return point > 0
    ? `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
    : `${sign}0.${"0".repeat(-point)}${digits}`;
}
/** The same value as a fraction token, so a decimal answer is not a substring. */
function fractionToken(numeral: string): string {
  const neg = numeral.startsWith("-");
  const body = neg ? numeral.slice(1) : numeral;
  if (!body.includes(".")) return numeral;
  const [whole, frac] = body.split(".");
  const digits = `${whole}${frac}`.replace(/^0+/, "") || "0";
  return `${neg ? "-" : ""}${digits}/1${"0".repeat(frac!.length)}`;
}
/** Standard form for prose and prompts: thousands separators from five digits. */
function standardTex(a: Dec): string {
  const [whole, part] = plain(a).split(".");
  const grouped =
    whole!.length >= 5 ? whole!.replace(/\B(?=(\d{3})+$)/g, "{,}") : whole!;
  return part === undefined ? grouped : `${grouped}.${part}`;
}
/** Coefficient and exponent with 1 ≤ coefficient < 10. */
function sciParts(a: Dec): [Dec, number] {
  const n = lead(a);
  return [shift(a, -n), n];
}
const sciTex = (coefficient: Dec, exponent: number) =>
  `${plain(coefficient)} \\times 10^{${exponent}}`;
const sci = (a: Dec) => sciTex(...sciParts(a));
/** A bare number stays prose (with a typographic minus); anything else is TeX. */
const math = (tex: string) =>
  /^-?\d+(\.\d+)?$/.test(tex) ? tex.replace("-", "−") : `$${tex}$`;
/** Standard form for prose: commas from five digits. */
const standardText = (a: Dec) => standardTex(a).replaceAll("{,}", ",");
const paren = (n: number) => (n < 0 ? `(${n})` : String(n));

/** A choice written as coefficient × 10^exponent, possibly outside 1 ≤ c < 10. */
type Candidate = { option: Option; coef: string; exp: number };
const written = (c: Dec, e: number, feedback: string): Candidate => ({
  option: { label: `$${sciTex(c, e)}$`, feedback },
  coef: plain(c),
  exp: e,
});
/** Three distractors, misconceptions first, such that neither the answer's
 * coefficient nor its exponent is the odd one out, E − 1, E and E + 1 never
 * share the answer's coefficient, and the answer's rank in exponent order is
 * drawn at random rather than fixed by the error types. */
function chooseDistractors(
  r: Random,
  correct: Candidate,
  pool: Candidate[],
  fallback: Candidate[],
): Candidate[] | null {
  const seen = new Set([correct.option.label]);
  const candidates = [...pool, ...fallback].filter((c) => {
    if (seen.has(c.option.label)) return false;
    seen.add(c.option.label);
    return true;
  });
  const E = correct.exp,
    sameExp = candidates.some((c) => c.exp === E),
    rank = r(0, 3);
  let best: Candidate[] | null = null,
    bestScore = Infinity;
  for (let x = 0; x < candidates.length; x++)
    for (let y = x + 1; y < candidates.length; y++)
      for (let z = y + 1; z < candidates.length; z++) {
        const set = [candidates[x]!, candidates[y]!, candidates[z]!];
        const neighbour = (d: number) =>
          set.some((c) => c.coef === correct.coef && c.exp === E + d);
        if (neighbour(1) && neighbour(-1)) continue;
        if (!set.some((c) => c.coef === correct.coef)) continue;
        const score =
          set.filter((c) => fallback.includes(c)).length * 2 +
          (sameExp && !set.some((c) => c.exp === E) ? 1 : 0) +
          (set.filter((c) => c.exp < E).length === rank ? 0 : 2.5);
        if (score < bestScore) [best, bestScore] = [set, score];
      }
  return best;
}

function coefficient(r: Random, maxDigits: number): Dec {
  const digits = r(1, maxDigits);
  let text = String(r(1, 9));
  for (let i = 1; i < digits; i++)
    text += String(i === digits - 1 ? r(1, 9) : r(0, 9));
  return parseDec(text.length > 1 ? `${text[0]}.${text.slice(1)}` : text);
}

// ——— Rational and irrational numbers ———
type Kind = { tex: string; rational: boolean; reason: string; tag: string };
function rationalKind(r: Random, kind: string): Kind {
  if (kind === "square-root") {
    const k = r(2, 13);
    return {
      tex: `\\sqrt{${k * k}}`,
      rational: true,
      tag: kind,
      reason: `$\\sqrt{${k * k}} = ${k}$ because $${k}^2 = ${k * k}$, and $${k} = \\frac{${k}}{1}$ is a quotient of integers, so it is rational.`,
    };
  }
  if (kind === "cube-root") {
    const k = r(2, 5);
    return {
      tex: `\\sqrt[3]{${k ** 3}}`,
      rational: true,
      tag: kind,
      reason: `$\\sqrt[3]{${k ** 3}} = ${k}$ because $${k}^3 = ${k ** 3}$, so it is rational.`,
    };
  }
  if (kind === "repeating") {
    const two = r(0, 1) === 1;
    let block: number;
    do block = two ? r(10, 98) : r(1, 8);
    while (two && block % 11 === 0);
    const text = two ? String(block).padStart(2, "0") : String(block);
    return {
      tex: `0.\\overline{${text}}`,
      rational: true,
      tag: kind,
      reason: `A decimal that repeats forever is rational: $0.\\overline{${text}} = \\frac{${block}}{${two ? 99 : 9}}${gcd(block, two ? 99 : 9) > 1 ? ` = ${frac(block, two ? 99 : 9)}` : ""}$.`,
    };
  }
  if (kind === "fraction") {
    if (r(0, 2) === 0)
      return {
        tex: "\\frac{22}{7}",
        rational: true,
        tag: "twenty-two-sevenths",
        reason:
          "$\\frac{22}{7}$ is a quotient of integers, so it is rational. It is close to $\\pi$ but not equal to it.",
      };
    let n: number, d: number;
    do {
      d = r(3, 13);
      n = r(1, 3 * d);
    } while (gcd(n, d) !== 1 || n % d === 0 || [2, 4, 5, 8, 10].includes(d));
    return {
      tex: `\\frac{${n}}{${d}}`,
      rational: true,
      tag: kind,
      reason: `$\\frac{${n}}{${d}}$ is a quotient of integers, so it is rational.`,
    };
  }
  if (kind === "terminating") {
    let value: Dec;
    do value = dec(BigInt(r(1, 999)), -r(1, 3));
    while (value.e >= 0);
    const negative = r(0, 2) === 0,
      shown = plain(negative ? neg(value) : value),
      [m, d] = [Number(value.m), 10 ** -value.e];
    return {
      tex: shown,
      rational: true,
      tag: kind,
      reason: `$${shown} = ${negative ? "-" : ""}\\frac{${m}}{${d}}$, a quotient of integers, so it is rational.`,
    };
  }
  const k = r(2, 20);
  return {
    tex: `-${k}`,
    rational: true,
    tag: "integer",
    reason: `$-${k} = \\frac{-${k}}{1}$, so it is rational. Every integer is rational.`,
  };
}
function irrationalKind(r: Random, kind: string): Kind {
  if (kind === "root" || kind === "cube-irrational") {
    const index = kind === "root" ? 2 : 3;
    let n: number;
    do n = r(2, index === 2 ? 99 : 60);
    while (index === 2 ? isSquare(n) : isCube(n));
    const k = intRoot(n, index),
      word = index === 2 ? "square" : "cube";
    return {
      tex: rootTex(n, index),
      rational: false,
      tag: kind,
      reason: `${n} is not a perfect ${word}: $${k}^${index} = ${k ** index} < ${n} < ${(k + 1) ** index} = ${k + 1}^${index}$. The ${word} root of a whole number that is not a perfect ${word} is irrational.`,
    };
  }
  if (kind === "pi") {
    const form = r(0, 2);
    if (form === 0)
      return {
        tex: "\\pi",
        rational: false,
        tag: kind,
        reason:
          "$\\pi$ is irrational: its decimal never ends and never repeats.",
      };
    const k = r(2, 5);
    return form === 1
      ? {
          tex: `${k}\\pi`,
          rational: false,
          tag: kind,
          reason: `$${k}\\pi$ is irrational: if it were a quotient of integers, then $\\pi = ${k}\\pi \\div ${k}$ would be one too.`,
        }
      : {
          tex: `\\frac{\\pi}{${k}}`,
          rational: false,
          tag: kind,
          reason: `$\\frac{\\pi}{${k}}$ is irrational: if it were a quotient of integers, then $\\pi = ${k} \\times \\frac{\\pi}{${k}}$ would be one too.`,
        };
  }
  const d = r(1, 9);
  return {
    tex: `0.${d}0${d}00${d}000${d}\\ldots`,
    rational: false,
    tag: "pattern",
    reason: `In $0.${d}0${d}00${d}000${d}\\ldots$ each run of zeros is one longer than the last, so no block of digits repeats forever. The decimal never ends and never repeats, so it is irrational.`,
  };
}
const patternNote = " (one more 0 each time)";
function classifyCase(r: Random): Case {
  const wantIrrational = r(0, 1) === 0;
  const rationals = [
    "square-root",
    "cube-root",
    "repeating",
    "fraction",
    "terminating",
    "integer",
  ];
  const irrationals = ["root", "cube-irrational", "pi", "pattern"];
  let correct: Kind, others: Kind[];
  if (wantIrrational) {
    correct = irrationalKind(r, pick(r, irrationals));
    // Always include a perfect root and a repeating decimal or fraction: the tempting rationals.
    const kinds = [
      pick(r, ["square-root", "cube-root"]),
      pick(r, ["repeating", "fraction"]),
      pick(r, ["terminating", "integer", "fraction", "repeating"]),
    ];
    if (kinds[2] === kinds[1]) kinds[2] = "terminating";
    others = kinds.map((k) => rationalKind(r, k));
  } else {
    correct = rationalKind(
      r,
      pick(r, ["square-root", "cube-root", "repeating", "fraction"]),
    );
    const kinds = shuffle([...irrationals], r).slice(0, 3);
    others = kinds.map((k) => irrationalKind(r, k));
  }
  const label = (k: Kind) =>
    `${math(k.tex)}${k.tag === "pattern" ? patternNote : ""}`;
  const all = [correct, ...others];
  if (new Set(all.map(label)).size !== 4) return classifyCase(r);
  const order = shuffle([0, 1, 2, 3], r);
  return {
    order,
    prompt: `Which number is ${wantIrrational ? "irrational" : "rational"}?`,
    answer: all.map((k) => ({ label: label(k), feedback: k.reason })),
    explanation: [
      "Integers are the whole numbers and their negatives. A quotient is the answer to a division.",
      "A rational number can be written as a quotient of two integers, $\\frac{a}{b}$ with $b \\neq 0$. Its decimal either ends or repeats forever.",
      "A number that cannot be written this way is irrational: its decimal goes on forever without repeating.",
      ...order.map((i) => all[i]!.reason),
      `The ${wantIrrational ? "irrational" : "rational"} number is ${math(correct.tex)}.`,
    ],
    tags: [
      wantIrrational ? "which-irrational" : "which-rational",
      `answer-${correct.tag}`,
    ],
  };
}

function repeatingCase(r: Random): Case {
  const form = r(0, 4);
  let whole = 0,
    pre = "",
    block: string;
  if (form === 0 || form === 3) {
    block = String(r(1, 8));
    if (form === 3) whole = r(1, 3);
  } else if (form === 1) {
    let v: number;
    do v = r(1, 98);
    while (v % 11 === 0);
    block = String(v).padStart(2, "0");
  } else if (form === 2) {
    pre = String(r(0, 9));
    do block = String(r(1, 8));
    while (block === pre);
  } else {
    let v: number;
    do v = r(1, 998);
    while (v % 111 === 0);
    block = String(v).padStart(3, "0");
  }
  const p = block.length,
    s = pre.length;
  const tex = `${whole}.${pre}\\overline{${block}}`;
  const expand = `${whole}.${pre}${block.repeat(Math.ceil(6 / p))}\\ldots`;
  // x = whole.pre(block): 10^(s+p) x − 10^s x = whole.pre.block − whole.pre (as integers).
  const big = Number(`${whole}${pre}${block}`),
    small = Number(`${whole}${pre}`),
    numerator = big - small,
    denominator = 10 ** (s + p) - 10 ** s;
  const shifted = (k: number) => {
    const digits = `${pre}${block.repeat(4)}`;
    const head = `${whole === 0 ? "" : whole}${digits.slice(0, k)}`;
    return `${head === "" ? "0" : String(Number(head))}.${digits.slice(k, k + 6)}\\ldots`;
  };
  const answer = fracAnswer(numerator, denominator);
  const explanation = [
    `Let $x = ${tex} = ${expand}$. The repeating block ${block} has ${p === 1 ? "one digit" : `${countWords[p]} digits`}.`,
  ];
  if (s === 0)
    explanation.push(
      `Multiply by $10^{${p}} = ${10 ** p}$ to shift one block past the decimal point: $${10 ** p}x = ${shifted(p)}$.`,
      `The tails after the decimal point are identical, so subtracting cancels them: $${10 ** p}x - x = ${numerator}$, so $${denominator}x = ${numerator}$.`,
    );
  else
    explanation.push(
      `Multiply by 10 to move the digit before the block left of the point: $10x = ${shifted(1)}$. Multiply by ${10 ** (s + p)} to move one block further: $${10 ** (s + p)}x = ${shifted(s + p)}$.`,
      `Both tails are the same repeating block, so subtracting cancels them: $${10 ** (s + p)}x - 10x = ${big} - ${small}$, so $${denominator}x = ${numerator}$.`,
    );
  const reduced = frac(numerator, denominator);
  explanation.splice(
    1,
    0,
    "Multiplying by 10 moves every digit one place to the left. Shifting by whole repeating blocks makes two numbers with the same endless tail.",
  );
  explanation.push(
    `Divide by ${denominator} to get $x$ alone: $x = \\frac{${numerator}}{${denominator}}${reduced === `\\frac{${numerator}}{${denominator}}` ? "" : ` = ${reduced}`}$.`,
    `As a fraction in simplest form, $${tex}$ is $${reduced}$.`,
  );
  return {
    prompt: `Write $${tex}$ as a fraction in simplest form.`,
    answer,
    explanation,
    tags: [
      s ? "delayed" : `period-${p}`,
      ...(whole ? ["whole-part"] : []),
      gcd(numerator, denominator) > 1 ? "reduce" : "already-reduced",
    ],
  };
}

// ——— Approximating roots ———
function betweenCase(r: Random): Case {
  const index: 2 | 3 = r(0, 2) === 0 ? 3 : 2;
  let n: number;
  do n = r(2, index === 2 ? 300 : 999);
  while (index === 2 ? isSquare(n) : isCube(n));
  const k = intRoot(n, index),
    larger = r(0, 1) === 1,
    word = index === 2 ? "squares" : "cubes",
    root = rootTex(n, index);
  return {
    prompt: `$${root}$ lies between two consecutive whole numbers. What is the ${larger ? "larger" : "smaller"} one?`,
    answer: String(larger ? k + 1 : k),
    explanation: [
      `Find the perfect ${word} on either side of ${n}: $${k}^${index} = ${k ** index}$ and $${k + 1}^${index} = ${(k + 1) ** index}$.`,
      index === 2
        ? `A perfect square is a whole number times itself. The square root of a number is the positive value that, times itself, makes that number.`
        : `A perfect cube is a whole number used as a factor three times. The cube root of a number is the value that, used three times as a factor, makes that number.`,
      `$${k ** index} < ${n} < ${(k + 1) ** index}$. A larger number has a larger ${index === 2 ? "square" : "cube"} root, so $${k} < ${root} < ${k + 1}$.`,
      `So $${root}$ lies between ${k} and ${k + 1}, and the ${larger ? "larger" : "smaller"} whole number is ${larger ? k + 1 : k}.`,
    ],
    tags: [index === 2 ? "square" : "cube", larger ? "larger" : "smaller"],
    givens: { kind: "root", radicand: n, index },
  };
}
/** Tenths as exact strings: 44 → "4.4", 50 → "5.0". */
const tenth = (t: number) => `${Math.floor(t / 10)}.${t % 10}`;
const squared = (t: number, scale: number) =>
  plain(dec(BigInt(t * t), -2 * scale));
export function rootTenths(n: number) {
  const k = intRoot(n, 2),
    t = intRoot(100 * n, 2),
    up = 400 * n > (2 * t + 1) ** 2;
  return { k, t, up, nearest: up ? t + 1 : t };
}
function tenthCase(r: Random): Case {
  let n: number;
  do n = r(2, 200);
  while (isSquare(n));
  const { k, t, up, nearest } = rootTenths(n);
  const mid = 2 * t + 1; // halfway point in twentieths
  const midText = `${tenth(t)}5`,
    midSquare = plain(dec(BigInt(mid * mid * 25), -4));
  return {
    prompt: `Find $\\sqrt{${n}}$ to the nearest tenth.`,
    answer: tenth(nearest),
    explanation: [
      `$\\sqrt{${n}}$, the square root of ${n}, is the positive number that times itself makes ${n}. A bigger number always has a bigger square root.`,
      `First find whole numbers around it. $${k}^2 = ${k * k}$ and $${k + 1}^2 = ${(k + 1) ** 2}$. Since $${k * k} < ${n} < ${(k + 1) ** 2}$, $\\sqrt{${n}}$ is between ${k} and ${k + 1}.`,
      `Now narrow it to tenths by squaring tenths between them: $${tenth(t)}^2 = ${squared(t, 1)}$ and $${tenth(t + 1)}^2 = ${squared(t + 1, 1)}$. Since $${squared(t, 1)} < ${n} < ${squared(t + 1, 1)}$, $\\sqrt{${n}}$ is between ${tenth(t)} and ${tenth(t + 1)}.`,
      `The halfway point is ${midText}, and $${midText}^2 = ${midSquare}$. Since $${n} ${up ? ">" : "<"} ${midSquare}$, $\\sqrt{${n}}$ is ${up ? "above" : "below"} the halfway point, so it is closer to ${tenth(nearest)}.`,
      `To the nearest tenth, $\\sqrt{${n}} \\approx ${tenth(nearest)}$.`,
    ],
    tags: [
      up ? "round-up" : "round-down",
      nearest % 10 === 0 ? "whole-tenth" : "ordinary-tenth",
    ],
    givens: { kind: "root", radicand: n, index: 2 },
  };
}

/** A value in (k, k + 1) that sits strictly inside one interval of a tenth. */
type Value = {
  tex: string;
  /** Interval [d/10, (d + 1)/10) in tenths. */
  tenths: number;
  locate: string;
  kind: string;
};
function valueFor(r: Random, kind: string, k: number): Value | null {
  if (kind === "square" || kind === "cube") {
    const index = kind === "square" ? 2 : 3;
    const low = k ** index + 1,
      high = (k + 1) ** index - 1;
    if (high < low) return null;
    const n = r(low, high);
    // Tenths interval: the greatest t with (t/10)^index ≤ n.
    let t = 10 * k;
    while ((t + 1) ** index <= n * 10 ** index) t++;
    const p = (x: number) => plain(dec(BigInt(x ** index), -index));
    return {
      tex: rootTex(n, index),
      tenths: t,
      kind,
      locate: `$${tenth(t)}^${index} = ${p(t)}$ and $${tenth(t + 1)}^${index} = ${p(t + 1)}$, so $${rootTex(n, index)}$ is between ${tenth(t)} and ${tenth(t + 1)}.`,
    };
  }
  if (kind === "fraction") {
    const d = pick(r, [3, 6, 7, 9, 11, 12]),
      a = r(k * d + 1, (k + 1) * d - 1);
    if (gcd(a, d) !== 1 || (a * 10) % d === 0) return null;
    const t = Math.floor((a * 10) / d),
      thousandths = Math.floor((a * 1000) / d),
      exact = (a * 1000) % d === 0;
    const shown = plain(dec(BigInt(thousandths), -3));
    return {
      tex: `\\frac{${a}}{${d}}`,
      tenths: t,
      kind,
      locate: `$\\frac{${a}}{${d}} = ${a} \\div ${d} = ${shown}${exact ? "" : "\\ldots"}$, so it is between ${tenth(t)} and ${tenth(t + 1)}.`,
    };
  }
  const hundredths = r(k * 100 + 1, (k + 1) * 100 - 1);
  if (hundredths % 10 === 0) return null;
  const t = Math.floor(hundredths / 10),
    shown = plain(dec(BigInt(hundredths), -2));
  return {
    tex: shown,
    tenths: t,
    kind: "decimal",
    locate: `${shown} is between ${tenth(t)} and ${tenth(t + 1)}.`,
  };
}
function compareCase(r: Random): Case {
  const k = r(2, 9),
    greatest = r(0, 1) === 1;
  const kinds = shuffle(
    ["square", "cube", "square", "fraction", "decimal"],
    r,
  ).slice(0, 4);
  if (!kinds.includes("square")) kinds[0] = "square";
  const values: Value[] = [];
  for (const kind of kinds) {
    let value: Value | null = null;
    for (let i = 0; i < 64 && !value; i++) {
      const v = valueFor(r, kind, k);
      if (v && !values.some((w) => w.tenths === v.tenths || w.tex === v.tex))
        value = v;
    }
    if (!value) return compareCase(r);
    values.push(value);
  }
  const ordered = [...values].sort((a, b) => a.tenths - b.tenths);
  const target = greatest ? ordered[3]! : ordered[0]!;
  const others = values.filter((v) => v !== target);
  return {
    order: values.map((v) => (v === target ? 0 : others.indexOf(v) + 1)),
    prompt: `Which number is ${greatest ? "greatest" : "least"}?`,
    answer: [target, ...others].map((v) => ({
      label: math(v.tex),
      feedback: `${v.locate} ${target.locate} So ${math(target.tex)} is ${greatest ? "greater" : "less"}.`,
    })),
    explanation: [
      `Every number here is between ${k} and ${k + 1}. Place each one between consecutive tenths.`,
      `To place a square root, square tenths until you pass the number under the root. To place a fraction, divide its top by its bottom.`,
      ...values.map((v) => v.locate),
      `Each number is in a different tenth, so the order from least to greatest is $${ordered.map((v) => v.tex).join(" < ")}$.`,
      `The ${greatest ? "greatest" : "least"} number is ${math(target.tex)}.`,
    ],
    tags: [
      greatest ? "greatest" : "least",
      ...(kinds.includes("cube") ? ["has-cube-root"] : []),
      ...(kinds.includes("fraction") ? ["has-fraction"] : []),
      `answer-${target.kind}`,
    ],
  };
}

function equationCase(r: Random): Case {
  const form = pick(r, [
    "square-perfect",
    "square-perfect",
    "square-fraction",
    "square-irrational",
    "cube-positive",
    "cube-negative",
    "cube-irrational",
  ] as const);
  const index = form.startsWith("square") ? 2 : 3;
  let p: string, root: string, n: number, d: number;
  // p = n/d; root = positive (or real) root's TeX
  if (form === "square-perfect") {
    const k = r(3, 15);
    [n, d, p, root] = [k * k, 1, String(k * k), String(k)];
  } else if (form === "square-fraction") {
    let a: number, b: number;
    do {
      b = r(2, 10);
      a = r(1, b - 1);
    } while (gcd(a, b) !== 1);
    [n, d] = [a * a, b * b];
    [p, root] = [`\\frac{${n}}{${d}}`, `\\frac{${a}}{${b}}`];
  } else if (form === "square-irrational") {
    do n = r(2, 99);
    while (isSquare(n));
    [d, p, root] = [1, String(n), `\\sqrt{${n}}`];
  } else if (form === "cube-irrational") {
    do n = r(2, 99);
    while (isCube(n));
    [d, p, root] = [1, String(n), `\\sqrt[3]{${n}}`];
  } else {
    const k = r(2, 9),
      sign = form === "cube-negative" ? -1 : 1;
    [n, d, p, root] = [
      sign * k ** 3,
      1,
      String(sign * k ** 3),
      String(sign * k),
    ];
  }
  const power = (tex: string) => (/^\d+$/.test(tex) ? tex : `(${tex})`);
  const negate = (tex: string) =>
    tex.startsWith("-") ? tex.slice(1) : `-${tex}`;
  const both = (tex: string) => `$x = ${tex}$ or $x = ${negate(tex)}$`;
  const one = (tex: string) => `$x = ${tex}$`;
  const split = frac(n, d * index);
  const misread = `$${p}$ divided by ${index}`;
  let options: Option[];
  const pText = math(p);
  if (index === 2)
    options = [
      { label: both(root) },
      {
        label: one(root),
        feedback: `$${root}$ is one solution, but $(${negate(root)})^2 = ${p}$ too: a positive number has two square roots.`,
      },
      {
        label: one(split),
        feedback: `$x^2$ means $x \\times x$, not $2x$. ${misread} is not a number whose square is ${pText}.`,
      },
      {
        label: both(split),
        feedback: `$x^2$ means $x \\times x$, not $2x$. The solutions are numbers whose square is ${pText}.`,
      },
    ];
  else
    options = [
      { label: one(root) },
      {
        label: both(root.startsWith("-") ? negate(root) : root),
        feedback: `Cubing keeps the sign: $${power(negate(root))}^3$ is ${n < 0 ? "positive" : "negative"}, so it cannot equal ${pText}. There is exactly one real cube root.`,
      },
      {
        label: one(split),
        feedback: `$x^3$ means $x \\times x \\times x$, not $3x$. ${misread} is not a number whose cube is ${pText}.`,
      },
      form === "cube-negative"
        ? {
            label: one(negate(root)),
            feedback: `$${negate(root)}$ cubed is positive: $${negate(root)}^3 = ${-n}$. A negative number has a negative cube root.`,
          }
        : {
            label: both(split),
            feedback: `$x^3$ means $x \\times x \\times x$, not $3x$. The solution is the number whose cube is ${pText}.`,
          },
    ];
  const explanation =
    index === 2
      ? [
          `A solution is a number whose square is ${pText}.`,
          `Squaring a number means multiplying it by itself.`,
          form === "square-irrational"
            ? `${n} is not a perfect square, so write its positive square root with the root symbol: $(\\sqrt{${n}})^2 = ${n}$.`
            : `$${power(root)}^2 = ${p}$.`,
          `The opposite works too, because the product of two negative numbers is positive: $(${negate(root)})^2 = ${p}$.`,
          `No other number works, so $x = ${root}$ or $x = ${negate(root)}$.`,
        ]
      : [
          `A solution is a number whose cube is ${pText}.`,
          `Cubing a number means using it as a factor three times.`,
          form === "cube-irrational"
            ? `${n} is not a perfect cube, so write its cube root with the root symbol: $(\\sqrt[3]{${n}})^3 = ${n}$.`
            : `$${power(root)}^3 = ${paren(Number(root))} \\times ${paren(Number(root))} \\times ${paren(Number(root))} = ${p}$.`,
          `Cubing keeps the sign, and larger numbers have larger cubes, so no other real number has cube ${pText}. The only solution is $x = ${root}$.`,
        ];
  return {
    prompt: `Find all real solutions of $x^${index} = ${p}$.`,
    answer: options,
    explanation,
    tags: [form],
  };
}

// ——— Scientific notation ———
function powerValue(r: Random): { c: Dec; n: number; value: Dec } {
  const c = coefficient(r, 4);
  let n: number;
  do n = r(-7, 9);
  while (n === 0);
  return { c, n, value: shift(c, n) };
}
function shiftSentence(c: Dec, n: number) {
  return n > 0
    ? `Multiplying by $10^{${n}}$ multiplies by 10 ${n === 1 ? "once" : `${countWords[n] ?? n} times`}. Each time, every digit moves one place to the left, so the decimal point moves ${places(n)} to the right.`
    : `Multiplying by $10^{${n}}$ divides by 10 ${n === -1 ? "once" : `${countWords[-n] ?? -n} times`}. Each time, every digit moves one place to the right, so the decimal point moves ${places(-n)} to the left.`;
}
function toStandardCase(r: Random): Case {
  const { c, n, value } = powerValue(r);
  const digitsAfter = Math.max(0, -c.e);
  return {
    prompt: `Write $${sciTex(c, n)}$ in standard form.`,
    answer: plain(value),
    explanation: [
      shiftSentence(c, n),
      `Standard form means the number written out with ordinary digits, with no power of 10.`,
      `Move the point, and fill any empty places with zeros so each digit keeps its new place: $${sciTex(c, n)} = ${standardTex(value)}$.`,
      `Check: the leading digit ${String(c.m)[0]} is now in the ${placeWords[n]} place, and that place has value $10^{${n}}$.`,
      `In standard form, $${sciTex(c, n)}$ is ${standardText(value)}.`,
    ],
    tags: [
      n > 0 ? "positive-exponent" : "negative-exponent",
      n > 0 && n < digitsAfter ? "no-zeros-added" : "zeros-added",
      digitsAfter === 0 ? "one-digit" : "several-digits",
    ],
    givens: {
      kind: "power-of-ten",
      digits: String(c.m),
      exponent: n,
      toStandard: true,
    },
  };
}
function toScientificCase(r: Random): Case {
  const { c, n, value } = powerValue(r);
  const correct = sciTex(c, n);
  // Each distractor is a documented error; three are chosen at random so position never cues the answer.
  const pool: Candidate[] = [
    written(
      c,
      -n,
      `The sign of the exponent is reversed. ${n > 0 ? "A number of 10 or more has a positive exponent." : "A positive number less than one has a negative exponent."}`,
    ),
    written(
      c,
      n + 1,
      n > 0
        ? "This counts every digit of the whole number. Count only the places the decimal point moves: one fewer than the number of digits before the point."
        : "This counts only the zeros after the decimal point. Count the places the point moves to land just after the first nonzero digit.",
    ),
    written(
      c,
      n - 1,
      `$${sciTex(c, n - 1)}$ is ${standardText(shift(c, n - 1))}, one tenth of the given number. Count the places the decimal point moves again.`,
    ),
    written(
      c,
      -n - 1,
      `Both the count and the sign are off. ${n > 0 ? "A number of 10 or more has a positive exponent" : "A positive number less than one has a negative exponent"}, and its size is the number of places the decimal point moves.`,
    ),
    written(
      shift(c, 1),
      n - 1,
      `This has the right value, but its coefficient ${plain(shift(c, 1))} is 10 or more. In scientific notation the coefficient is at least 1 and less than 10.`,
    ),
    written(
      shift(c, -1),
      n + 1,
      `This has the right value, but its coefficient ${plain(shift(c, -1))} is less than 1. In scientific notation the coefficient is at least 1 and less than 10.`,
    ),
  ];
  const picked = chooseDistractors(
    r,
    written(c, n, ""),
    shuffle(pool, r),
    [],
  )!.map((d) => d.option);
  return {
    prompt: `Write ${standardText(value)} in scientific notation.`,
    answer: [{ label: `$${correct}$` }, ...picked],
    explanation: [
      "Scientific notation writes a number as $a \\times 10^{n}$. The coefficient $a$ is at least 1 and less than 10, and the exponent $n$ is an integer.",
      `Move the decimal point so one nonzero digit is to its left: ${standardText(value)} becomes ${plain(c)}. The digits stay in the same order; only zeros at the front or the end, which just held places, drop away.`,
      n > 0
        ? `The point moved ${places(n)} to the left, so ${plain(c)} must be multiplied by $10^{${n}}$ to restore the value.`
        : `The point moved ${places(-n)} to the right, so ${plain(c)} must be multiplied by $10^{${n}}$, which divides by $10^{${-n}}$, to restore the value.`,
      `$${standardTex(value)} = ${correct}$.`,
      `In scientific notation, ${standardText(value)} is $${correct}$.`,
    ],
    tags: [n > 0 ? "large" : "small"],
    givens: {
      kind: "power-of-ten",
      digits: String(c.m),
      exponent: n,
      toStandard: false,
    },
  };
}
const nice = [
  "1",
  "1.2",
  "1.5",
  "2",
  "2.4",
  "2.5",
  "3",
  "3.2",
  "3.6",
  "4",
  "4.5",
  "4.8",
  "5",
  "6",
  "6.4",
  "7.5",
  "8",
  "9",
].map(parseDec);
function timesCase(r: Random): Case {
  for (;;) {
    const a = pick(r, nice),
      b = pick(r, nice),
      k = r(1, 8),
      n = r(-9, 12 - k),
      m = n + k;
    const ratio = div(a, b);
    if (!ratio) continue;
    const answer = shift(ratio, k);
    if (compare(answer, dec(1n)) <= 0 || answer.e < -2) continue;
    if (same(a, b) && r(0, 2)) continue;
    const A = sciTex(a, m),
      B = sciTex(b, n);
    return {
      prompt: `How many times as large as $${B}$ is $${A}$?`,
      answer: plain(answer),
      explanation: [
        `Divide $${A}$ by $${B}$: $\\frac{${A}}{${B}} = \\frac{${plain(a)}}{${plain(b)}} \\times \\frac{10^{${m}}}{10^{${n}}}$.`,
        `"How many times as large" asks what to multiply one number by to get the other, so divide.`,
        `Dividing powers of 10 subtracts the exponents, because the bottom's factors of 10 cancel some of the top's.`,
        `$\\frac{${plain(a)}}{${plain(b)}} = ${plain(ratio)}$ and $\\frac{10^{${m}}}{10^{${n}}} = 10^{${m} - ${paren(n)}} = 10^{${k}}$.`,
        `$${plain(ratio)} \\times 10^{${k}} = ${standardTex(answer)}$, so $${A}$ is ${standardTex(answer).replaceAll("{,}", ",")} times as large as $${B}$.`,
      ],
      tags: [
        compare(ratio, dec(1n)) < 0
          ? "ratio-below-one"
          : same(a, b)
            ? "same-coefficient"
            : "ratio-above-one",
        n < 0 ? "negative-exponents" : "positive-exponents",
        answer.e < 0 ? "decimal-answer" : "whole-answer",
      ],
    };
  }
}

type Op = "multiply" | "divide" | "add" | "subtract";
function operationCase(r: Random): Case {
  const op = pick(r, ["multiply", "divide", "add", "subtract"] as const);
  for (;;) {
    let a = coefficient(r, op === "add" || op === "subtract" ? 3 : 2),
      b = coefficient(r, op === "add" || op === "subtract" ? 3 : 2),
      p = r(-8, 9),
      q = r(-8, 9);
    if (op === "divide") {
      b = pick(
        r,
        nice.filter((x) => x.m !== 1n),
      );
      a = coefficient(r, 2);
    }
    if (op === "add" || op === "subtract") {
      q = p - r(0, 3);
      if (op === "subtract" && p === q && compare(a, b) <= 0) continue;
    }
    const x = shift(a, p),
      y = shift(b, q);
    const result =
      op === "multiply"
        ? mul(x, y)
        : op === "divide"
          ? div(x, y)
          : op === "add"
            ? add(x, y)
            : add(x, neg(y));
    if (!result || result.m <= 0n) continue;
    const [C, E] = sciParts(result);
    if (E < -18 || E > 18 || String(C.m).length > 4) continue;
    const symbol = {
      multiply: "\\times",
      divide: "\\div",
      add: "+",
      subtract: "-",
    }[op];
    const X = sciTex(a, p),
      Y = sciTex(b, q);
    const candidate = (value: Dec, feedback: string) =>
      written(...sciParts(value), feedback);
    const pool: Candidate[] = [];
    const offer = (value: Dec | null, feedback: string) => {
      if (value && value.m > 0n) pool.push(candidate(value, feedback));
    };
    let explanation: string[], adjusted: boolean;
    if (op === "multiply" || op === "divide") {
      const coef = op === "multiply" ? mul(a, b) : div(a, b)!;
      const exponent = op === "multiply" ? p + q : p - q;
      const s = lead(coef);
      adjusted = s !== 0;
      explanation = [
        op === "multiply"
          ? `Regroup the factors: $(${X}) \\times (${Y}) = (${plain(a)} \\times ${plain(b)}) \\times (10^{${p}} \\times 10^{${q}})$.`
          : `Divide coefficients and powers of 10 separately: $\\frac{${X}}{${Y}} = \\frac{${plain(a)}}{${plain(b)}} \\times \\frac{10^{${p}}}{10^{${q}}}$.`,
        op === "multiply"
          ? `The order of factors does not change a product, so the coefficients and the powers of 10 can be multiplied separately.`
          : `The coefficient is the number in front of the power of 10. Each part divides on its own, then the two results combine.`,
        op === "multiply"
          ? `Multiplying powers of 10 adds the exponents, because each exponent counts factors of 10. $${plain(a)} \\times ${plain(b)} = ${plain(coef)}$ and $10^{${p}} \\times 10^{${q}} = 10^{${p} + ${paren(q)}} = 10^{${exponent}}$.`
          : `Dividing powers of 10 subtracts the exponents, because the divisor's factors of 10 cancel. $\\frac{${plain(a)}}{${plain(b)}} = ${plain(coef)}$ and $\\frac{10^{${p}}}{10^{${q}}} = 10^{${p} - ${paren(q)}} = 10^{${exponent}}$.`,
        s === 0
          ? `The coefficient ${plain(coef)} is already at least 1 and less than 10, so the result is $${sciTex(C, E)}$.`
          : s > 0
            ? `${plain(coef)} is 10 or more: $${plain(coef)} = ${plain(C)} \\times 10^{1}$. So $${plain(coef)} \\times 10^{${exponent}} = ${plain(C)} \\times 10^{${exponent + 1}}$.`
            : `${plain(coef)} is less than 1: $${plain(coef)} = ${plain(C)} \\times 10^{-1}$. So $${plain(coef)} \\times 10^{${exponent}} = ${plain(C)} \\times 10^{${exponent - 1}}$.`,
      ];
      if (s !== 0)
        offer(
          shift(C, exponent),
          `The coefficient was rewritten as $${plain(C)}$, but the exponent was not changed to match. Rewriting $${plain(coef)}$ as $${plain(C)}$ ${s > 0 ? "divides" : "multiplies"} it by 10, so the exponent must ${s > 0 ? "increase" : "decrease"} by 1.`,
        );
      if (op === "multiply") {
        if (p * q !== p + q)
          offer(
            shift(C, p * q + s),
            "The exponents were multiplied. When powers of 10 are multiplied, their exponents are added.",
          );
        offer(
          shift(add(a, b), p + q),
          "The coefficients were added. In a product, the coefficients are multiplied.",
        );
        if ((p < 0 || q < 0) && Math.abs(p) + Math.abs(q) !== p + q)
          offer(
            shift(C, Math.abs(p) + Math.abs(q) + s),
            "A negative exponent lost its sign. Add the exponents with their signs.",
          );
      } else {
        if (p + q !== p - q)
          offer(
            shift(C, p + q + s),
            "The exponents were added. When powers of 10 are divided, the exponent of the divisor is subtracted.",
          );
        if (q - p !== p - q)
          offer(
            shift(C, q - p + s),
            "The exponents were subtracted in the wrong order. Subtract the divisor's exponent from the dividend's.",
          );
        offer(
          shift(mul(a, b), p - q),
          "The coefficients were multiplied. In a quotient, the coefficients are divided.",
        );
      }
    } else {
      const sign = op === "add" ? 1 : -1;
      const yAligned = shift(b, q - p);
      const sum = add(a, sign > 0 ? yAligned : neg(yAligned));
      adjusted = lead(sum) !== 0;
      explanation = [
        p === q
          ? `Both numbers have the power $10^{${p}}$, so ${op === "add" ? "add" : "subtract"} the coefficients.`
          : `Write both numbers with the power $10^{${p}}$: $${Y} = ${plain(yAligned)} \\times 10^{${p}}$. The exponent rises from ${math(String(q))} to ${math(String(p))}, so the decimal point moves ${places(p - q)} to the left, giving ${plain(yAligned)}.`,
        `Coefficients can be added or subtracted only when the powers of 10 match, like adding tens to tens.`,
        `$${plain(a)} ${symbol} ${plain(yAligned)} = ${plain(sum)}$, so the result is $${plain(sum)} \\times 10^{${p}}$.`,
        lead(sum) === 0
          ? `The coefficient ${plain(sum)} is already at least 1 and less than 10: the result is $${sciTex(C, E)}$.`
          : `Adjust the coefficient to be at least 1 and less than 10: $${plain(sum)} \\times 10^{${p}} = ${sciTex(C, E)}$.`,
      ];
      const raw = add(a, sign > 0 ? b : neg(b));
      if (p !== q)
        offer(
          shift(raw, p),
          `The coefficients were combined although the powers of 10 differ. First rewrite both numbers with the same power of 10.`,
        );
      if (q !== 0)
        offer(
          shift(raw, p + q),
          "The exponents were added. Adding or subtracting numbers does not add their exponents; match the powers of 10 first.",
        );
      if (p !== q)
        offer(
          shift(raw, q),
          "The coefficients were combined using the smaller power of 10 without rewriting the other number first.",
        );
      if (p !== q) {
        offer(
          shift(result, q - p),
          `The coefficients were matched and combined correctly, but the result was given the smaller power, $10^{${q}}$, instead of $10^{${p}}$.`,
        );
        const wrongWay = shift(b, p - q);
        offer(
          shift(add(a, sign > 0 ? wrongWay : neg(wrongWay)), p),
          `The decimal point of ${plain(b)} moved the wrong way. When the exponent is raised to ${math(String(p))}, the coefficient must get smaller, not larger.`,
        );
      }
      if (lead(sum) !== 0)
        offer(
          shift(C, p),
          `The coefficient was rewritten as $${plain(C)}$, but the exponent was not changed to match the factor of 10 it absorbed.`,
        );
    }
    const correct = candidate(result, "");
    const fallback = [2, -2, 1, -1].map((f) =>
      candidate(
        shift(result, f),
        `This is $10^{${Math.abs(f)}}$ times too ${f > 0 ? "large" : "small"}. Recheck how the exponents combine.`,
      ),
    );
    const best = chooseDistractors(r, correct, shuffle(pool, r), fallback);
    if (!best) continue;
    const options: Option[] = [correct.option, ...best.map((c) => c.option)];
    if (options.length < 4) continue;
    return {
      prompt: `Find $(${X}) ${symbol} (${Y})$. Write the answer in scientific notation.`,
      answer: options,
      explanation: [
        ...explanation,
        `Check the form: ${plain(C)} is at least 1 and less than 10, so the answer is $${sciTex(C, E)}$.`,
      ],
      tags: [op, adjusted ? "adjust" : "no-adjust"],
    };
  }
}

/** One teaching step written from this problem's own givens; never the answer. */
function hintFor(id: string, c: Case): string {
  if (c.hint) return c.hint;
  const first = c.explanation[0]!;
  const options = typeof c.answer === "string" ? [] : c.answer;
  switch (id) {
    case "classify-real-number":
      return `Test ${options[1]!.label}: can it be written as a quotient of two integers, or as a decimal that ends or repeats? Test each option the same way.`;
    case "repeating-decimal-to-fraction":
      return `${first} Multiply $x$ by the power of 10 that shifts one whole block, then subtract $x$ so the repeating tails cancel.`;
    case "root-between-integers":
      return `${first.split(":")[0]}. The root lies between their roots.`;
    case "root-nearest-tenth": {
      const n = /\\sqrt\{(\d+)\}/.exec(c.prompt)![1]!;
      return `Which two perfect squares is ${n} between? Their roots bound the answer. Then square the tenths between those roots, and compare ${n} with the square of the halfway point.`;
    }
    case "standard-to-scientific": {
      const written = /^Write (.+) in scientific notation\.$/.exec(
        c.prompt,
      )![1]!;
      return `Move the decimal point in ${written} until exactly one nonzero digit is to its left. The number of places moved, and the direction, give the power of 10.`;
    }
    case "scientific-to-standard": {
      const coefficient = /^Write \$([\d.]+) \\times/.exec(c.prompt)![1]!;
      return `${first} Start from ${coefficient}, and write zeros in any empty places.`;
    }
    case "scientific-times-larger":
      return `${first.split(":")[0]}. Divide the decimal parts and the powers of 10 separately.`;
    default:
      return first;
  }
}

const sciLabel = (coef: number, exp: number) => `${coef} \\times 10^{${exp}}`;
/** Round a positive standard numeral to one significant digit. The second
 * digit is never 5, so the three wrong readings stay distinct. */
export function singleDigitEstimateOf(numeral: string): {
  correct: string;
  wrong: [string, string, string];
  coef: number;
  exp: number;
} {
  const value = parseDec(numeral.replaceAll(",", "").replaceAll("{,}", ""));
  if (value.m <= 0n) throw new Error("Estimate needs a positive number");
  const digits = String(value.m).split("").map(Number);
  const exp = lead(value);
  const second = digits[1];
  if (second === undefined || second === 5)
    throw new Error(`No undisputed second digit in ${numeral}`);
  let coef = digits[0]!;
  let outExp = exp;
  if (second >= 6) {
    coef += 1;
    if (coef === 10) {
      coef = 1;
      outExp += 1;
    }
  }
  const correct = sciLabel(coef, outExp);
  const wrongWay =
    second >= 6
      ? sciLabel(digits[0]!, exp)
      : digits[0] === 9
        ? sciLabel(1, exp + 1)
        : sciLabel(digits[0]! + 1, exp);
  const counted = sciLabel(coef, exp + 1);
  const place =
    exp < 0
      ? sciLabel(coef, Math.abs(outExp))
      : counted === correct
        ? sciLabel(digits[0]!, exp + 1)
        : counted;
  let two = digits[0]! * 10 + second;
  if (digits.length >= 3 && digits[2]! >= 5) two += 1;
  const kept =
    two === 100 ? sciLabel(10, exp) : sciLabel(two, exp - 1);
  const wrong = [wrongWay, place, kept] as [string, string, string];
  if (new Set([correct, ...wrong]).size !== 4)
    throw new Error(`Estimate choices collide for ${numeral}`);
  return { correct, wrong, coef, exp: outExp };
}

const numeralFrom = (digits: number[], exp: number) =>
  standardText(dec(BigInt(digits.join("")), exp - (digits.length - 1)));

const ESTIMATE_CONTEXTS: readonly {
  min: number;
  max: number;
  line: (numeral: string) => string;
}[] = [
  {
    min: 5,
    max: 9,
    line: (n) =>
      `The population of a country was about ${n}. Estimate it as a single digit times a power of 10.`,
  },
  {
    min: 3,
    max: 9,
    line: (n) =>
      `A trip is about ${n} km. Estimate the distance as a single digit times a power of 10.`,
  },
  {
    min: 2,
    max: 8,
    line: (n) =>
      `A ship has a mass of about ${n} kg. Estimate the mass as a single digit times a power of 10.`,
  },
  {
    min: -9,
    max: -4,
    line: (n) =>
      `A cell is about ${n} m across. Estimate its width as a single digit times a power of 10.`,
  },
  {
    min: -6,
    max: -3,
    line: (n) =>
      `An insect has a mass of about ${n} kg. Estimate the mass as a single digit times a power of 10.`,
  },
];

function singleDigitEstimateCase(r: Random): Case {
  for (let attempt = 0; attempt < 40; attempt++) {
    const nineUp = r(0, 9) === 0;
    const context = pick(r, ESTIMATE_CONTEXTS);
    const exp = nineUp ? r(3, 9) : r(context.min, context.max);
    const digits = nineUp
      ? [9, 7]
      : (() => {
          const sig = r(3, 4);
          const leadDigit = r(1, 9);
          const second = r(0, 1) === 1 ? r(6, 9) : r(1, 4);
          const rest: number[] = [leadDigit, second];
          while (rest.length < sig)
            rest.push(rest.length === sig - 1 ? r(1, 9) : r(0, 9));
          return rest;
        })();
    let estimate: ReturnType<typeof singleDigitEstimateOf>;
    try {
      estimate = singleDigitEstimateOf(numeralFrom(digits, exp));
    } catch {
      continue;
    }
    if (estimate.exp === 0 || estimate.exp < -9 || estimate.exp > 12) continue;
    const numeral = numeralFrom(digits, exp);
    const rounded = shift(dec(BigInt(estimate.coef)), estimate.exp);
    const second = digits[1]!;
    return {
      prompt: (nineUp ? ESTIMATE_CONTEXTS[1]! : context).line(numeral),
      answer: [
        { label: `$${estimate.correct}$` },
        ...estimate.wrong.map((label) => ({
          label: `$${label}$`,
          feedback:
            label === estimate.wrong[0]
              ? second >= 6
                ? "The next digit was cut off. A digit of 6 or more rounds the first digit up."
                : "The first digit was rounded up. A next digit of 4 or less leaves it as it is."
              : label === estimate.wrong[1]
                ? exp < 0
                  ? "The exponent lost its minus sign. A small number has a negative power of 10."
                  : "That counts every digit. The exponent is the place of the first digit, one less than the count."
                : "Scientific estimates use one digit, not two. Shift until the front number is below 10.",
        })),
      ],
      explanation: [
        `The first nonzero digit of ${numeral} is in the ${placeWords[exp] ?? "counted"} place, worth $10^{${exp}}$.`,
        second >= 6
          ? estimate.exp === exp
            ? `The next digit is ${second}, which is 6 or more, so the first digit rounds up to ${estimate.coef}.`
            : `The next digit is ${second}, so 9 rounds up to 10. Write that as $1 \\times 10^{${estimate.exp}}$.`
          : `The next digit is ${second}, which is 4 or less, so the first digit stays ${estimate.coef}.`,
        `The single-digit estimate is $${estimate.correct} = ${standardTex(rounded)}$.`,
        `Check by sliding that digit ${places(Math.abs(estimate.exp))} from the ones place.`,
      ],
      hint: `In ${numeral}, find the place of the first nonzero digit. The next digit is ${second}. Use it only to round that first digit up or to leave it.`,
      tags: [
        nineUp ? "nine-up" : second >= 6 ? "round-up" : "round-down",
        exp < 0 ? "estimate-small" : "estimate-large",
        "single-digit-estimate",
      ],
      givens: {
        kind: "power-of-ten",
        digits: String(estimate.coef),
        exponent: estimate.exp,
        toStandard: false,
      },
    };
  }
  throw new Error("Could not build a single-digit estimate");
}

/** Pairs whose ratio has at most one decimal place: a divides 10b. */
export const singleDigitRatioPairs: readonly [number, number][] = [
  1, 2, 4, 5, 8,
].flatMap((a) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter((b) => (10 * b) % a === 0)
    .map((b) => [a, b] as [number, number]),
);

/** Value of a one-digit estimate, and how many times as large the second is. */
export function timesEstimate(
  a: number,
  m: number,
  b: number,
  n: number,
): { first: string; second: string; times: string } {
  if (!(n >= m)) throw new Error("The second estimate must be at least as large");
  if ((10 * b) % a !== 0) throw new Error("Ratio has more than one decimal place");
  const gap = n - m;
  if ((b * 10 ** gap) % a !== 0) throw new Error("Times as large is not exact");
  return {
    first: plain(shift(dec(BigInt(a)), m)),
    second: plain(shift(dec(BigInt(b)), n)),
    times: String((b * 10 ** gap) / a),
  };
}

const RATIO_SCENES: readonly {
  min: number;
  max: number;
  first: (n: string) => string;
  second: (n: string) => string;
  ask: string;
}[] = [
  {
    min: 5,
    max: 9,
    first: (n) => `The population of one country is about ${n}`,
    second: (n) => `the population of the world is about ${n}`,
    ask: "as the first population is the second",
  },
  {
    min: 3,
    max: 9,
    first: (n) => `One flight is about ${n} km`,
    second: (n) => `another flight is about ${n} km`,
    ask: "as the first flight is the second",
  },
  {
    min: 2,
    max: 8,
    first: (n) => `One ship has a mass of about ${n} kg`,
    second: (n) => `another ship has a mass of about ${n} kg`,
    ask: "as the first mass is the second",
  },
  {
    min: -8,
    max: -3,
    first: (n) => `One cell is about ${n} m across`,
    second: (n) => `another cell is about ${n} m across`,
    ask: "as the first width is the second",
  },
];

function dressDigit(r: Random, digit: number, exp: number): string {
  const sig = r(3, 4);
  const digits = [digit, pick(r, [1, 2, 3, 4])];
  while (digits.length < sig)
    digits.push(digits.length === sig - 1 ? r(1, 9) : r(0, 9));
  return numeralFrom(digits, exp);
}

function estimateTimesCase(
  r: Random,
  task: "estimate-first" | "estimate-second" | "times-as-much",
): Case {
  const scene = pick(
    r,
    RATIO_SCENES.filter((s) => s.max - s.min >= 1),
  );
  const gap = r(1, Math.min(4, scene.max - scene.min));
  const [a, b] = pick(r, singleDigitRatioPairs);
  const m = r(scene.min, scene.max - gap);
  const n = m + gap;
  const first = dressDigit(r, a, m);
  const second = dressDigit(r, b, n);
  const result = timesEstimate(a, m, b, n);
  const ratioTenths = (10 * b) / a;
  const ratio =
    ratioTenths % 10 === 0 ? String(ratioTenths / 10) : (ratioTenths / 10).toFixed(1);
  const pow = 10 ** gap;
  if (task !== "times-as-much") {
    const which = task === "estimate-first";
    const numeral = which ? first : second;
    const answer = which ? result.first : result.second;
    return {
      prompt: `${which ? scene.first(numeral) : scene.second(numeral)[0]!.toUpperCase() + scene.second(numeral).slice(1)}. Estimate it as a single digit times a power of 10. Write that estimate as an ordinary number.`,
      answer,
      label: "Estimated number",
      explanation: [
        `The first nonzero digit of ${numeral} is ${which ? a : b}, and the next digit is 4 or less, so it does not round up.`,
        `That digit sits in the ${placeWords[which ? m : n]} place, so the estimate is $${which ? a : b} \\times 10^{${which ? m : n}}$.`,
        `As an ordinary number, $${which ? a : b} \\times 10^{${which ? m : n}} = ${standardTex(parseDec(answer))}$.`,
      ],
      hint: `Write ${fractionToken(numeral)} with its first nonzero digit ${which ? a : b} kept, because the next digit is 4 or less. Its place tells you how many zeros follow.`,
      tags: [task, m < 0 ? "estimate-small" : "estimate-large"],
    };
  }
  return {
    prompt: `${scene.first(first)}, estimated as $${a} \\times 10^{${m}}$. ${scene.second(second)[0]!.toUpperCase()}${scene.second(second).slice(1)}, estimated as $${b} \\times 10^{${n}}$. About how many times as large ${scene.ask}?`,
    answer: result.times,
    explanation: [
      `Divide the estimates $${b} \\times 10^{${n}}$ and $${a} \\times 10^{${m}}$.`,
      `The digits give $${b} \\div ${a} = ${ratio}$. The powers of 10 give $10^{${n}} \\div 10^{${m}} = 10^{${gap}}$.`,
      `$${ratio} \\times ${pow} = ${result.times}$. The answer is an ordinary number, not a power of 10.`,
      `The digits alone give ${ratio}. Multiplying the digits gives ${a * b}. Adding the exponents makes a huge power of 10, not ${result.times}.`,
    ],
    hint: `Divide the estimates $${b} \\times 10^{${n}}$ and $${a} \\times 10^{${m}}$. Divide the front digits, then subtract the exponents of 10.`,
    tags: ["times-as-much", gap === 1 ? "one-place" : "several-places"],
  };
}

const SUPER_DIGIT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const superExp = (n: number) =>
  `${n < 0 ? "⁻" : "⁺"}${String(Math.abs(n))
    .padStart(2, "0")
    .split("")
    .map((d) => SUPER_DIGIT[Number(d)])
    .join("")}`;
/** Calculator styles the clause names. The exponent keeps its sign. */
export function calculatorDisplayText(
  coefficient: string,
  exp: number,
  style: number,
): string {
  const abs = String(Math.abs(exp));
  const padded = abs.padStart(2, "0");
  const sign = exp < 0 ? "-" : "";
  switch (style % 5) {
    case 0:
      return `${coefficient}E${exp}`;
    case 1:
      return `${coefficient}E${sign}${padded}`;
    case 2:
      return `${coefficient}e${exp}`;
    case 3:
      return `${coefficient} ${superExp(exp)}`;
    default:
      return `${coefficient}E${exp < 0 ? "-" : "+"}${padded}`;
  }
}

function calculatorDisplayCase(r: Random): Case {
  const c = coefficient(r, 4);
  const negative = r(0, 1) === 1;
  const n = negative ? -r(3, 9) : r(6, 12);
  const shown = calculatorDisplayText(plain(c), n, r(0, 4));
  const value = shift(c, n);
  return {
    prompt: `A calculator shows \`${shown}\`. What number is this?`,
    answer: plain(value),
    explanation: [
      `A calculator writes $E$ for "times ten to the power." \`${shown}\` means $${sciTex(c, n)}$.`,
      `The number after $E$ is the exponent, sign included. Move the decimal point ${places(Math.abs(n))} to the ${n < 0 ? "left" : "right"}.`,
      `$${sciTex(c, n)} = ${standardTex(value)}$.`,
      `Losing the minus sign would point the other way. $E$ is not subtraction, and it is not a power on ${plain(c)} itself.`,
    ],
    hint: `The display \`${shown}\` uses $E$ for times ten to the power that follows. Keep the sign of that power, then slide the decimal point.`,
    tags: [negative ? "display-small" : "display-large", "calculator-display"],
    givens: {
      kind: "power-of-ten",
      digits: String(c.m),
      exponent: n,
      toStandard: true,
    },
  };
}

const FACTOR_PAIRS = [
  ["1.2", "5"],
  ["1.25", "4"],
  ["1.5", "2"],
  ["1.5", "4"],
  ["1.5", "6"],
  ["2", "3"],
  ["2", "4"],
  ["2.5", "2"],
  ["2.5", "4"],
  ["3", "2"],
  ["3", "3"],
  ["3.5", "2"],
  ["4", "2"],
  ["4.5", "2"],
  ["6", "1.5"],
] as const;

function calculatorProductCase(r: Random): Case {
  for (let attempt = 0; attempt < 30; attempt++) {
    const divide = r(0, 1) === 1;
    const [left, right] = pick(r, FACTOR_PAIRS).map(parseDec) as [Dec, Dec];
    const forward = divide ? div(left, right) : mul(left, right);
    const raw = forward ?? (divide ? div(right, left) : null);
    if (!raw) continue;
    const swapped = divide && !forward;
    const dividend = swapped ? right : left;
    const divisor = swapped ? left : right;
    const [coef, extra] = sciParts(raw);
    const target = divide ? -r(7, 9) : r(10, 12);
    const span = target - extra;
    const expB = r(2, 6);
    const expA = divide ? span + expB : span - expB;
    const A = shift(dividend, expA);
    const B = shift(divisor, expB);
    const value = shift(coef, target);
    const shown = calculatorDisplayText(plain(coef), target, r(0, 4));
    return {
      prompt: divide
        ? `A calculator divides ${standardText(A)} by ${standardText(B)} and shows \`${shown}\`. Write the quotient in standard form.`
        : `A calculator multiplies ${standardText(A)} by ${standardText(B)} and shows \`${shown}\`. Write the product in standard form.`,
      answer: plain(value),
      explanation: [
        divide
          ? `Divide the front digits and subtract the exponents: $${sci(A)} \\div ${sci(B)} = ${sciTex(coef, target)}$.`
          : `Multiply the front digits and add the exponents: $${sci(A)} \\times ${sci(B)} = ${sciTex(coef, target)}$.`,
        `The display \`${shown}\` is that result. $E$ means times ten to the power ${target}.`,
        `In standard form, $${sciTex(coef, target)} = ${standardTex(value)}$.`,
      ],
      hint: divide
        ? `The calculator divides ${standardText(A)} by ${standardText(B)} and shows \`${shown}\`. Divide the front digits and subtract the exponents. Then write the result with ordinary digits.`
        : `The calculator multiplies ${standardText(A)} by ${standardText(B)} and shows \`${shown}\`. Multiply the front digits and add the exponents. Then write the result with ordinary digits.`,
      tags: [
        divide ? "display-quotient" : "display-product",
        "calculator-display",
      ],
      givens: {
        kind: "power-of-ten",
        digits: String(coef.m),
        exponent: target,
        toStandard: true,
      },
    };
  }
  throw new Error("Could not build a calculator product");
}

const LADDERS = {
  length: ["km", "m", "mm", "µm", "nm"],
  mass: ["t", "kg", "g", "mg"],
  time: ["s", "ms", "µs", "ns"],
  data: ["TB", "GB", "MB", "KB", "B"],
} as const;
const UNIT_NAME: Record<string, string> = {
  km: "kilometers",
  m: "meters",
  mm: "millimeters",
  µm: "micrometers",
  nm: "nanometers",
  t: "tonnes",
  kg: "kilograms",
  g: "grams",
  mg: "milligrams",
  s: "seconds",
  ms: "milliseconds",
  µs: "microseconds",
  ns: "nanoseconds",
  TB: "terabytes",
  GB: "gigabytes",
  MB: "megabytes",
  KB: "kilobytes",
  B: "bytes",
};
const LADDER_NOTE: Record<keyof typeof LADDERS, string> = {
  length:
    "One kilometer is $10^{3}$ m. One millimeter is $10^{-3}$ m. One micrometer is $10^{-6}$ m. One nanometer is $10^{-9}$ m.",
  mass: "One tonne is $10^{3}$ kg. One gram is $10^{-3}$ kg. One milligram is $10^{-6}$ kg.",
  time: "One millisecond is $10^{-3}$ s. One microsecond is $10^{-6}$ s. One nanosecond is $10^{-9}$ s.",
  data: "One kilobyte is $10^{3}$ bytes. One megabyte is $10^{6}$ bytes. One gigabyte is $10^{9}$ bytes. One terabyte is $10^{12}$ bytes.",
};
const UNIT_CONTEXTS: readonly {
  ladder: keyof typeof LADDERS;
  unit: string;
  per: string;
  values: readonly string[];
  tell: (given: string, unit: string) => string;
}[] = [
  {
    ladder: "length",
    unit: "mm",
    per: "/yr",
    values: ["20", "25", "40", "50", "80", "100"],
    tell: (g, u) => `The Atlantic seafloor spreads about ${g} ${u} per year.`,
  },
  {
    ladder: "length",
    unit: "mm",
    per: "/month",
    values: ["2", "2.5", "3", "4"],
    tell: (g, u) => `A fingernail grows about ${g} ${u} per month.`,
  },
  {
    ladder: "length",
    unit: "µm",
    per: "",
    values: ["1", "2", "5", "8", "10"],
    tell: (g, u) => `A bacterium is about ${g} ${u} long.`,
  },
  {
    ladder: "length",
    unit: "nm",
    per: "",
    values: ["2", "20", "50", "80", "200", "300"],
    tell: (g, u) => `A virus is about ${g} ${u} across.`,
  },
  {
    ladder: "length",
    unit: "km",
    per: "",
    values: ["5", "10", "21.1", "42.2"],
    tell: (g, u) => `A race is about ${g} ${u} long.`,
  },
  {
    ladder: "mass",
    unit: "t",
    per: "",
    values: ["5", "8", "10", "20", "40"],
    tell: (g, u) => `A truck has a mass of about ${g} ${u}.`,
  },
  {
    ladder: "mass",
    unit: "mg",
    per: "",
    values: ["1", "2", "5", "10", "50", "100"],
    tell: (g, u) => `A grain of sand has a mass of about ${g} ${u}.`,
  },
  {
    ladder: "time",
    unit: "ms",
    per: "",
    values: ["1", "2", "5", "10", "50", "100", "500"],
    tell: (g, u) => `A camera shutter stays open for about ${g} ${u}.`,
  },
  {
    ladder: "data",
    unit: "MB",
    per: "",
    values: ["2", "3", "4", "5", "8"],
    tell: (g, u) => `A photo uses about ${g} ${u}.`,
  },
  {
    ladder: "data",
    unit: "GB",
    per: "",
    values: ["64", "128", "256", "512"],
    tell: (g, u) => `A phone stores about ${g} ${u}.`,
  },
];
const inRange = (d: Dec) =>
  compare(d, dec(1n)) >= 0 && compare(d, dec(1000n)) < 0;
const partOptions = (labels: string[], r: Random) =>
  shuffle([...labels], r).map((label, i) => ({
    id: "abcd"[i]!,
    label,
  }));

function chooseUnitCase(r: Random): Case {
  const context = pick(r, UNIT_CONTEXTS);
  const units = LADDERS[context.ladder] as readonly string[];
  const uIdx = units.indexOf(context.unit);
  const value = parseDec(pick(r, context.values));
  const offsets = [-3, -2, -1, 1, 2, 3].filter(
    (off) => uIdx + off >= 0 && uIdx + off < units.length,
  );
  const off = pick(r, offsets);
  const gIdx = uIdx + off;
  const given = shift(value, 3 * off);
  const [coef, exp] = sciParts(given);
  if (compare(coef, dec(1n)) < 0 || compare(coef, dec(10n)) >= 0)
    throw new Error("Given value is not normalized");
  const hits = units.filter((_, i) => inRange(shift(value, 3 * (i - uIdx))));
  if (hits.length !== 1 || hits[0] !== context.unit)
    throw new Error("The ladder does not have exactly one readable unit");
  const chosen = [uIdx];
  const add = (i: number) => {
    if (i >= 0 && i < units.length && !chosen.includes(i)) chosen.push(i);
  };
  add(uIdx > 0 ? uIdx - 1 : uIdx + 2);
  add(uIdx + 1 < units.length ? uIdx + 1 : uIdx - 2);
  add(gIdx);
  for (let i = 0; chosen.length < 4 && i < units.length; i++) add(i);
  const unitLabels = chosen.map(
    (i) => `${units[i]}${context.per}`,
  );
  const numberLabels = [
    plain(value),
    plain(shift(value, -3)),
    plain(shift(value, 3)),
    plain(given),
    plain(shift(value, -6)),
    plain(shift(value, 6)),
  ].filter((label, i, all) => all.indexOf(label) === i);
  if (unitLabels.length !== 4 || new Set(unitLabels).size !== 4)
    throw new Error("Unit choices are not four distinct units");
  if (numberLabels.length < 4) throw new Error("Need four number choices");
  const numbers = numberLabels.slice(0, 4);
  const unitOptions = partOptions(unitLabels, r);
  const numberOptions = partOptions(numbers, r);
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose the unit and the number",
    layout: "slots",
    blanks: [
      {
        id: "unit",
        label: "Unit that writes this as a number from 1 up to 1,000",
        options: unitOptions,
      },
      {
        id: "value",
        label: "The measure written in that unit",
        options: numberOptions,
      },
    ],
  };
  const givenName = UNIT_NAME[units[gIdx]!]!;
  // Choice labels include 10 and 2.5. Spell those so the hint cannot contain them.
  const coefText = plain(coef).includes(".")
    ? `digits ${plain(coef).replace(".", " and ")}`
    : plain(coef);
  const expText =
    exp === 10 ? "ten" : exp === -10 ? "negative ten" : String(exp);
  return {
    prompt: `${context.tell(`$${sciTex(coef, exp)}$`, givenName)} Each step on this ladder is 1,000: ${units.join(", ")}. ${LADDER_NOTE[context.ladder]}`,
    answer: serializeMultiPart(response, {
      unit: unitOptions.find((o) => o.label === `${context.unit}${context.per}`)!.id,
      value: numberOptions.find((o) => o.label === plain(value))!.id,
    }),
    parts: {
      response,
      correct: [`${context.unit}${context.per}`, plain(value)],
    },
    explanation: [
      `The measure is given as $${sciTex(coef, exp)}$ ${givenName}.`,
      off > 0
        ? `Each step to a smaller unit multiplies by 1,000. After ${off === 1 ? "one step" : `${off} steps`}, the number is ${plain(value)}.`
        : `Each step to a larger unit divides by 1,000. After ${-off === 1 ? "one step" : `${-off} steps`}, the number is ${plain(value)}.`,
      `${plain(value)} ${nounFor(Number(plain(value)), UNIT_NAME[context.unit]!.replace(/ies$/, "y").replace(/s$/, ""))} is at least 1 and under 1,000. One step past that is ${plain(shift(value, off > 0 ? 3 : -3))}, which is the wrong size to picture.`,
      `Check backward: ${plain(value)} ${nounFor(Number(plain(value)), UNIT_NAME[context.unit]!.replace(/ies$/, "y").replace(/s$/, ""))} returns to $${sciTex(coef, exp)}$ ${units[gIdx]!}.`,
    ],
    hint: `The measure starts as ${coefText} times ten to the power ${expText}, in ${givenName}. Each step on the ladder changes the number by a factor of 1,000. Stop at the step whose number is at least 1 and under 1,000.`,
    tags: [context.ladder, "choose-unit-size"],
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "classify-real-number": classifyCase,
  "repeating-decimal-to-fraction": repeatingCase,
  "root-between-integers": betweenCase,
  "root-nearest-tenth": tenthCase,
  "compare-irrational-values": compareCase,
  "solve-square-cube-equation": equationCase,
  "scientific-to-standard": toStandardCase,
  "standard-to-scientific": toScientificCase,
  "scientific-times-larger": timesCase,
  "scientific-operations": operationCase,
};
const labels: Record<string, string> = {
  "classify-real-number": "Number",
  "repeating-decimal-to-fraction": "Fraction",
  "root-between-integers": "Whole number",
  "root-nearest-tenth": "Nearest tenth",
  "compare-irrational-values": "Number",
  "solve-square-cube-equation": "Solutions",
  "scientific-to-standard": "Standard form",
  "standard-to-scientific": "Scientific notation",
  "scientific-times-larger": "Times as large",
  "scientific-operations": "Scientific notation",
};

function taskFor(id: string, seed: string): string {
  if (!(id in realNumberTaskAxes)) return "exact";
  return chooseAxes(id, seed, realNumberTaskAxes[id as TaskId]).task;
}
function buildCase(id: string, r: Random, task: string): Case {
  if (id === "choose-unit-size") return chooseUnitCase(r);
  if (task === "single-digit-estimate") return singleDigitEstimateCase(r);
  if (
    task === "estimate-first" ||
    task === "estimate-second" ||
    task === "times-as-much"
  )
    return estimateTimesCase(r, task);
  if (task === "display") return calculatorDisplayCase(r);
  if (task === "product") return calculatorProductCase(r);
  const build = builders[id];
  if (!build) throw new Error(`Unknown real-number template ${id}`);
  return build(r);
}

export function realNumberPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = realNumberTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown real-number template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const task = taskFor(id, seed);
  const r = random(id, seed);
  const c = buildCase(id, r, task);
  // A version below `since` forces the legacy task and is recorded by
  // `versionGatedAxes`. Stamp that stored version so the reprint matches.
  const templateVersion = versionGatedAxes().some((axis) => axis.id === "task")
    ? 1
    : metadata.version;
  const variant: ProblemVariant | undefined =
    task === "exact"
      ? undefined
      : { id: task, axes: axisRecord({ task }) };
  const base = {
    id: createHash("sha256")
      .update(JSON.stringify([id, 1, seed]))
      .digest("hex"),
    templateId: id,
    templateVersion,
    seed,
    skillId: metadata.skillId,
    prompt: c.prompt,
  };
  const withVariant = <T extends GeneratedProblem>(problem: T): T =>
    variant ? { ...problem, variant } : problem;
  if (c.parts) {
    return {
      problem: withVariant({
        public: { ...base, response: c.parts.response },
        answer: c.answer as string,
        explanation: c.explanation,
        hint: hintFor(id, c),
      }),
      tags: c.tags,
      caseKey: c.prompt,
    };
  }
  if (typeof c.answer === "string") {
    const kind = id === "repeating-decimal-to-fraction" ? "fraction" : "number";
    return {
      problem: withVariant({
        public: {
          ...base,
          response: { kind, label: c.label ?? labels[id]! },
        },
        answer: c.answer,
        explanation: c.explanation,
        hint: hintFor(id, c),
      }),
      tags: c.tags,
      caseKey: c.prompt,
    };
  }
  const [correct, ...distractors] = c.answer;
  const order = c.order
    ? c.order.map((i) => c.answer[i] as Option)
    : shuffle([correct!, ...distractors], r);
  const options = order.map((o, i) => ({
    id: `option-${"abcd"[i]}`,
    label: o.label,
  }));
  const answer = options[order.indexOf(correct!)]!.id;
  return {
    problem: withVariant({
      public: {
        ...base,
        response: { kind: "choice", label: labels[id]!, options },
      },
      answer,
      explanation: c.explanation,
      hint: hintFor(id, c),
      choiceFeedback: Object.fromEntries(
        order
          .map((o, i) => [options[i]!.id, o.feedback] as const)
          .filter(([optionId]) => optionId !== answer)
          .map(([optionId, feedback]) => [optionId, feedback ?? hints[id]!]),
      ),
    }),
    tags: c.tags,
    caseKey: JSON.stringify([
      c.prompt,
      [...options.map((o) => o.label)].sort(),
    ]),
  };
}
export const generateRealNumberProblem = (
  id: string,
  seed: string,
): GeneratedProblem => realNumberPrintCase(id, seed).problem;

/** Structured givens of a lesson example, for its animation. Never an answer. */
export type RealNumberGivens =
  | { kind: "root"; radicand: number; index: 2 | 3 }
  | {
      kind: "power-of-ten";
      digits: string;
      exponent: number;
      toStandard: boolean;
    };
export function realNumberGivens(
  id: string,
  seed: string,
): RealNumberGivens | undefined {
  if (!realNumberTemplates.some((t) => t.id === id)) return undefined;
  return buildCase(id, random(id, seed), taskFor(id, seed)).givens;
}
