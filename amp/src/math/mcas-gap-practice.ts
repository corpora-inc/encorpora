import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice";
import { serializeSelection } from "./selection-response";

/**
 * Round-2 problem types for the Massachusetts MCAS 2025 released items whose
 * task is not yet practiced: "select all that apply" statement sets graded as
 * an exact set by the existing multi-select-v1 protocol, and a few single-choice
 * descriptions. Every template is new and attached to an existing skill; no
 * existing template changes. Money is written in words: "$" opens a math span.
 *
 * Each statement carries a truth value computed from the numbers it states, so
 * the keyed answer is the set of statements whose own arithmetic holds.
 */
const multi = { requiredResponseCapability: "multi-select-v1" } as const;
const single = { requiredResponseCapability: "single-choice-v1" } as const;
const meta = (
  id: string,
  title: string,
  skillId: string,
  gradeBand: TemplateMetadata["gradeBand"],
  difficultyOffset: number,
  description: string,
  extra: Partial<TemplateMetadata>,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand,
  difficultyOffset,
  description,
  ...extra,
});

export const mcasGapTemplates: readonly TemplateMetadata[] = [
  meta(
    "mcas-true-fact-equations",
    "Select the true multiplication and division equations",
    "missing-factor",
    "3–5",
    0.3,
    "Select every true equation among six multiplication and division facts, with quotients on the left and facts of tens.",
    multi,
  ),
  meta(
    "mcas-round-hundred-select",
    "Select the numbers that round to a hundred",
    "round-whole-numbers",
    "3–5",
    0.25,
    "Select every price or count that rounds to a stated hundred, including values just above and below the halfway point.",
    multi,
  ),
  meta(
    "mcas-prime-factor-select",
    "Select every prime number or factor",
    "factors-multiples",
    "3–5",
    0.3,
    "Select the prime numbers among five whole numbers, or the factors of a number among six candidates that include multiples.",
    multi,
  ),
  meta(
    "mcas-comparison-equations-select",
    "Select the equations that fit a comparison story",
    "multiplicative-comparison",
    "3–5",
    0.3,
    "Select every equation that finds an unknown amount when a quantity is a number of times as many as another or a number more than another.",
    multi,
  ),
  meta(
    "mcas-true-product-equations",
    "Judge products of a three-digit number and a one-digit number",
    "whole-multiplication",
    "3–5",
    0.35,
    "Select the equations whose stated product of a three-digit number and a one-digit number is correct, with errors from missed regrouping and place value.",
    multi,
  ),
  meta(
    "mcas-prism-range-select",
    "Select two prisms by their combined volume",
    "prism-volume",
    "3–5",
    0.4,
    "Find the volume of five prisms from their edge lengths and select the two whose combined volume is in a stated range or equals a stated total.",
    multi,
  ),
  meta(
    "mcas-ratio-statements-select",
    "Select the true ratio statements",
    "ratios",
    "6–8",
    0.2,
    "Select the true part-to-part, part-to-whole and whole-to-part ratio statements for a set of counted objects, including equivalent forms.",
    multi,
  ),
  meta(
    "mcas-true-quotient-equations",
    "Judge quotients with a two-digit divisor",
    "whole-division",
    "6–8",
    0.3,
    "Select the true division equations among five whose dividends have three or four digits and whose divisors have two digits.",
    multi,
  ),
  meta(
    "mcas-cube-prism-statements",
    "Select true statements about a prism of fractional cubes",
    "fractional-prism-volume",
    "6–8",
    0.4,
    "Select the true statements about the cubes, count and volume of a prism packed with cubes whose edge is a unit fraction.",
    multi,
  ),
  meta(
    "mcas-statistical-question-select",
    "Select the statistical questions",
    "statistical-questions",
    "6–8",
    0.2,
    "Select every statistical question among five questions about one setting: those that expect different answers from different people or times.",
    multi,
  ),
  meta(
    "mcas-fraction-rate-select",
    "Select the true rates in miles per hour",
    "rational-unit-rates",
    "6–8",
    0.4,
    "Judge six stated speeds, from distances and times written as fractions and mixed numbers over three days, and select the three that are correct.",
    multi,
  ),
  meta(
    "mcas-negative-fraction-forms",
    "Select the expressions equal to a negative fraction",
    "signed-multiplication",
    "6–8",
    0.35,
    "Select every expression equal to a stated improper fraction among placements of negative signs in the numerator, denominator and front.",
    multi,
  ),
  meta(
    "mcas-markup-price-select",
    "Select the true selling prices after a percent change",
    "percent-change",
    "6–8",
    0.35,
    "Select the items whose stated selling price is the cost increased or decreased by a stated percent.",
    multi,
  ),
  meta(
    "mcas-rational-irrational-select",
    "Select the rational numbers among radicals and sums with pi",
    "irrational-numbers",
    "6–8",
    0.4,
    "Select the rational numbers among five radical expressions, or the expressions with a rational value among sums and products of pi and roots.",
    multi,
  ),
  meta(
    "mcas-sci-notation-select",
    "Select the true scientific-notation equations",
    "scientific-notation",
    "6–8",
    0.35,
    "Select the true equations that write a digit times a power of ten, positive or negative, as a standard numeral.",
    multi,
  ),
  meta(
    "mcas-table-intercept-select",
    "Select the tables with a smaller or larger y-intercept",
    "compare-functions",
    "6–8",
    0.45,
    "Find the y-intercept of six linear tables, whether or not x = 0 is listed, and select those below or above the y-intercept of a stated function.",
    multi,
  ),
  meta(
    "mcas-quadratic-zeros-select",
    "Select the values that make a quadratic zero",
    "quadratic-equations",
    "9–12",
    0.3,
    "Select the two values of x that make a factored, standard-form or non-monic quadratic expression equal to zero.",
    multi,
  ),
  meta(
    "mcas-congruence-statement-select",
    "Select the corresponding parts of congruent triangles",
    "congruence-criteria",
    "9–12",
    0.3,
    "From a triangle congruence statement, select the true statements about corresponding sides and angles, including statements written with scrambled letters.",
    multi,
  ),
  meta(
    "mcas-circle-equation-select",
    "Select the true statements about a circle from its equation",
    "circle-equations",
    "9–12",
    0.35,
    "From the equation of a circle, select the true statements about its center, radius, diameter, points on it and the origin.",
    multi,
  ),
  meta(
    "mcas-cylinder-scaling-select",
    "Select how scaling a cylinder changes its volume",
    "curved-solid-volume",
    "9–12",
    0.4,
    "Select the true statements about the factor by which a cylinder's volume changes when its radius, its height or both are multiplied.",
    multi,
  ),
  meta(
    "mcas-circle-radius-distance",
    "The distance from a circle's center to a point on it",
    "circle-measurement",
    "6–8",
    0.1,
    "Give the distance from the center of a circle to a point on the circle from its radius, its diameter or the distance to another point on the circle.",
    single,
  ),
  meta(
    "mcas-parenthesized-product-statement",
    "Describe a parenthesized expression in words",
    "numerical-expressions",
    "3–5",
    0.2,
    "Choose the statement that describes a product or quotient with a sum or difference in parentheses, without evaluating it.",
    single,
  ),
  meta(
    "mcas-slope-sign-description",
    "Decide the sign of a slope from how the variables change",
    "slope",
    "6–8",
    0.2,
    "Decide whether a linear function's slope is positive, negative, zero or undefined from a description of how the output changes as the input changes.",
    single,
  ),
  meta(
    "mcas-rotational-symmetry",
    "Decide which figure has rotational symmetry",
    "polygon-symmetries",
    "9–12",
    0.25,
    "Choose the named figure that a rotation of less than a full turn about its center maps onto itself, or the one that does not have this symmetry.",
    single,
  ),
  meta(
    "mcas-product-factor-size",
    "Decide whether a product is greater than a factor",
    "fraction-multiplication",
    "3–5",
    0.2,
    "Choose the product that is greater than, less than or equal to a fraction factor from the size of the other factor, without multiplying.",
    single,
  ),
];

/* ---------------------------------------------------------------------- */
/* Shared helpers                                                          */
/* ---------------------------------------------------------------------- */

type Option = {
  label: string;
  holds: boolean;
  why: string;
  /** Numeric expression for tests that re-evaluate a claim independently. */
  js?: string;
};
type Built = {
  variant: string;
  prompt: string;
  hint: string;
  /** The candidate pool; `total` options with `k` true ones are drawn. */
  pool: Option[];
  total: number;
  k: number;
  /** Plural noun for the response label, e.g. "true equations". */
  noun: string;
  lead?: string[];
  tail?: string[];
  figure?: GeneratedProblem["public"]["figure"];
  /** Keep the pool's own order instead of shuffling the options. */
  ordered?: boolean;
  model?: unknown;
};

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** TeX number with grouped thousands: 1{,}250. */
const tc = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}");
/** Plain-text number with commas: 1,250. */
const pc = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const times = "\\times";
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

type Fr = readonly [number, number];
const fr = (n: number, d: number): Fr => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const fmul = (a: Fr, b: Fr) => fr(a[0] * b[0], a[1] * b[1]);
const fdiv = (a: Fr, b: Fr) => fr(a[0] * b[1], a[1] * b[0]);
const feq = (a: Fr, b: Fr) => a[0] === b[0] && a[1] === b[1];
/** TeX for a fraction or whole number; a sign goes in front. */
const ftex = (f: Fr): string => {
  const [n, d] = f;
  const body = d === 1 ? `${Math.abs(n)}` : `\\frac{${Math.abs(n)}}{${d}}`;
  return n < 0 ? `-${body}` : body;
};
/** TeX for a positive value as a mixed number: 2\frac{1}{2}. */
const mixed = (f: Fr): string => {
  const [n, d] = f;
  const w = Math.floor(n / d);
  const rest = n - w * d;
  if (rest === 0) return `${w}`;
  return w === 0 ? `\\frac{${rest}}{${d}}` : `${w}\\frac{${rest}}{${d}}`;
};

/** Draw `total` options holding exactly `k` true statements, in shuffled order. */
function drawOptions(r: Random, built: Built): Option[] {
  const seen = new Set<string>();
  const unique = built.pool.filter((o) => {
    if (seen.has(o.label)) return false;
    seen.add(o.label);
    return true;
  });
  const yes = unique.filter((o) => o.holds);
  const no = unique.filter((o) => !o.holds);
  if (yes.length < built.k || no.length < built.total - built.k)
    throw new Error("Need three retry: not enough statements");
  const drawn = [
    ...shuffle(r, yes).slice(0, built.k),
    ...shuffle(r, no).slice(0, built.total - built.k),
  ];
  return built.ordered
    ? drawn.sort((a, b) => unique.indexOf(a) - unique.indexOf(b))
    : shuffle(r, drawn);
}

/**
 * Choose one form per category so that exactly `k` categories show a true
 * statement. A category lists the forms it can show; a form's truth is
 * computed from the numbers it states.
 */
function fromCategories(r: Random, cats: Option[][], k: number): Option[] {
  for (let attempt = 0; attempt < 30; attempt++) {
    const order = shuffle(
      r,
      cats.map((_, i) => i),
    );
    const want = new Set(order.slice(0, k));
    const chosen: Option[] = [];
    let ok = true;
    for (let i = 0; i < cats.length && ok; i++) {
      const forms = cats[i]!.filter((f) => f.holds === want.has(i));
      if (!forms.length) ok = false;
      else chosen.push(pick(r, forms));
    }
    if (ok) return chosen;
  }
  throw new Error("Need three retry: no category assignment");
}

function assembleSelect(
  template: TemplateMetadata,
  seed: string,
  built: Built,
  options: Option[],
): GeneratedProblem {
  const ids = options.map((_, i) => `option-${"abcdefgh"[i]}`);
  const correct = options
    .map((o, i) => (o.holds ? ids[i]! : ""))
    .filter(Boolean);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([template.id, 1, seed]))
        .digest("hex"),
      templateId: template.id,
      templateVersion: 1,
      seed,
      skillId: template.skillId,
      prompt: built.prompt,
      response: {
        kind: "multi-select",
        label: `Choose ${built.k} ${built.noun}`,
        selectionCount: built.k,
        options: options.map((o, i) => ({ id: ids[i]!, label: o.label })),
      },
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer: serializeSelection(correct),
    hint: built.hint,
    explanation: [
      ...(built.lead ?? []),
      ...options.map(
        (o) =>
          `${o.label.replace(/\.$/, "")}: ${o.holds ? "true" : "false"}. ${o.why}`,
      ),
      ...(built.tail ?? []),
    ],
  };
}

/** One shared guard: a problem or hint never quotes a true statement verbatim. */
function leaks(built: Built, options: Option[]): boolean {
  const text = `${built.prompt}\n${built.hint}`;
  return options.some((o) => o.holds && text.includes(o.label));
}

type Choice = { label: string; correct?: true; feedback?: string };
type Single = {
  variant: string;
  prompt: string;
  hint: string;
  explanation: string[];
  choices: Choice[];
  figure?: GeneratedProblem["public"]["figure"];
  model?: unknown;
};

/* ---------------------------------------------------------------------- */
/* Whole-number equations and number properties                            */
/* ---------------------------------------------------------------------- */

/** An equation x op y = z whose truth is computed from its own numbers. */
function equation(op: "mul" | "div", x: number, y: number, z: number): Option {
  const sym = op === "mul" ? times : "\\div";
  const holds = op === "mul" ? x * y === z : x === y * z;
  const label = `$${tc(x)}${sym}${tc(y)}=${tc(z)}$`;
  if (op === "mul")
    return {
      label,
      holds,
      js: `${x}*${y}===${z}`,
      why: holds
        ? `$${tc(x)}${times}${tc(y)}=${tc(z)}$.`
        : `$${tc(x)}${times}${tc(y)}=${tc(x * y)}$, not $${tc(z)}$.`,
    };
  return {
    label,
    holds,
    js: `${x}===${y}*${z}`,
    why: holds
      ? `Check by multiplying: $${tc(y)}${times}${tc(z)}=${tc(x)}$.`
      : `Check by multiplying: $${tc(y)}${times}${tc(z)}=${tc(y * z)}$, not $${tc(x)}$.`,
  };
}

function trueFactEquations(r: Random): Built {
  const variant = pick(r, ["facts", "tens"] as const);
  const used = new Set<number>();
  const slots: { a: number; b: number; p: number }[] = [];
  while (slots.length < 6) {
    const a = r(2, 9);
    const b = r(2, 9);
    const scaled = variant === "tens" ? b * 10 : b;
    const p = a * scaled;
    if (used.has(p) || a === b) continue;
    used.add(p);
    slots.push({ a, b: scaled, p });
  }
  const ops = shuffle(r, [
    "div",
    "div",
    "div",
    "mul",
    "mul",
    pick(r, ["div", "mul"] as const),
  ] as ("div" | "mul")[]);
  const truth = shuffle(r, [true, true, true, false, false, false]);
  const pool = slots.map(({ a, b, p }, i) => {
    const op = ops[i]!;
    const first = r(0, 1) ? a : b;
    const second = first === a ? b : a;
    if (op === "mul") {
      const wrong = [
        p + first,
        p - first,
        p + second,
        p - second,
        p + 10,
        p - 10,
      ].filter((v) => v > 0 && v !== p);
      return equation("mul", first, second, truth[i]! ? p : pick(r, wrong));
    }
    const wrong = [
      second + 1,
      second - 1,
      second + 2,
      second - 2,
      second * 2,
    ].filter((v) => v > 0 && v !== second);
    return equation("div", p, first, truth[i]! ? second : pick(r, wrong));
  });
  const s = slots[0]!;
  return {
    variant,
    prompt: "Choose the 3 equations that are true.",
    hint: `Test one equation at a time. For a division such as $${tc(s.p)}\\div${tc(s.a)}=\\square$, ask what number times ${tc(s.a)} makes ${tc(s.p)}. For a multiplication, work out the product and compare.`,
    pool,
    total: 6,
    k: 3,
    noun: "true equations",
    model: slots,
  };
}

const roundHundred = (n: number) => Math.floor((n + 50) / 100) * 100;
function roundSelect(r: Random): Built {
  const variant = pick(r, ["three-digit", "four-digit", "halfway"] as const);
  const H = variant === "four-digit" ? r(12, 88) * 100 : r(2, 9) * 100;
  const noun = variant === "four-digit" ? "fans" : "dollars";
  const values: number[] = [];
  const add = (n: number) => {
    if (n > 0 && !values.includes(n)) values.push(n);
  };
  if (variant === "halfway") add(H - 50);
  while (values.length < 2) add(H + r(-49, 49));
  const trues = [...values];
  add(variant === "halfway" ? H + 50 : H + 50 + r(0, 14));
  add(H - 51 - r(0, 14));
  add(H + (r(0, 1) ? 1 : -1) * r(110, 260));
  const pool = values.map((n) => {
    const to = roundHundred(n);
    const lower = Math.floor(n / 100) * 100;
    const tens = Math.floor(n / 10) % 10;
    return {
      label: `${pc(n)} ${noun}`,
      holds: to === H,
      js: `Math.floor((${n}+50)/100)*100===${H}`,
      why: `${pc(n)} lies between ${pc(lower)} and ${pc(lower + 100)}. Its tens digit is ${tens}, so it rounds ${tens >= 5 ? "up" : "down"} to ${pc(to)}.`,
    };
  });
  if (trues.length !== 2) throw new Error("Need three retry");
  return {
    variant,
    prompt:
      variant === "four-digit"
        ? `A stadium reports attendance at five games. Which 2 attendance counts round to ${pc(H)} fans when rounded to the nearest hundred?`
        : `A store lists the prices of five items in whole dollars. Which 2 prices round to ${pc(H)} dollars when rounded to the nearest hundred dollars?`,
    hint: `Look at the tens digit of each number. A tens digit of 5 or more rounds the hundreds up, and 4 or less keeps them. Then see which numbers land on ${pc(H)}.`,
    pool,
    total: 5,
    k: 2,
    noun: variant === "four-digit" ? "attendance counts" : "prices",
    model: { H, values },
  };
}

const smallestFactor = (n: number) => {
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return p;
  return n;
};
const isPrime = (n: number) => n > 1 && smallestFactor(n) === n;
function primeFactorSelect(r: Random): Built {
  const variant = pick(r, ["primes", "factors"] as const);
  if (variant === "primes") {
    const primes = [
      11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79,
      83, 89, 97,
    ];
    const composites = [
      21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93, 95, 99,
    ];
    const nums = [
      ...shuffle(r, [...primes]).slice(0, 3),
      ...shuffle(r, [...composites]).slice(0, 4),
    ];
    const pool = nums.map((n) => {
      const p = smallestFactor(n);
      return {
        label: `${n}`,
        holds: isPrime(n),
        js: `${n}`,
        why:
          p === n
            ? `No whole number from 2 to ${n - 1} divides ${n} evenly, so ${n} is prime.`
            : `${n} is divisible by ${p}: $${n}=${p}${times}${n / p}$, so ${n} is composite.`,
      };
    });
    return {
      variant,
      prompt:
        "A prime number is a whole number greater than 1 whose only factors are 1 and itself. Which 2 of these numbers are prime?",
      hint: "Test each number for small factors: is it even, does it end in 0 or 5, do its digits add to a multiple of 3, or is it a multiple of 7? A number with a factor other than 1 and itself is not prime.",
      pool,
      total: 5,
      k: 2,
      noun: "prime numbers",
      model: nums,
    };
  }
  const N = pick(r, [48, 54, 60, 64, 72, 80, 90, 96]);
  const divisors: number[] = [];
  for (let d = 2; d < N; d++) if (N % d === 0) divisors.push(d);
  const nonDivisors: number[] = [];
  for (let d = 3; d < N; d++) if (N % d !== 0 && d > N / 8) nonDivisors.push(d);
  const nums = [
    ...shuffle(r, [...divisors]).slice(0, 3),
    ...shuffle(r, [...nonDivisors]).slice(0, 2),
    N * 2,
  ];
  const pool = nums.map((d) => {
    const q = Math.floor(N / d);
    return {
      label: `${d}`,
      holds: N % d === 0,
      js: `${N}%${d}===0`,
      why:
        N % d === 0
          ? `$${N}\\div${d}=${N / d}$ with no remainder, so ${d} is a factor of ${N}.`
          : d > N
            ? `${d} is larger than ${N}, so it is a multiple of ${N}, not a factor.`
            : `$${d}${times}${q}=${d * q}$ and $${d}${times}${q + 1}=${d * (q + 1)}$, so ${N} is skipped and ${d} is not a factor.`,
    };
  });
  return {
    variant,
    prompt: `A factor of ${N} is a whole number that divides ${N} with no remainder. Which 3 of these numbers are factors of ${N}?`,
    hint: `A number is a factor of ${N} when ${N} divided by it leaves no remainder. Check each number by dividing, or by looking for a whole number that multiplies with it to make ${N}.`,
    pool,
    total: 6,
    k: 3,
    noun: "factors",
    model: { N, nums },
  };
}

type EqCandidate = { text: string; left: number; right: number };
function comparisonEquations(r: Random): Built {
  const variant = pick(r, ["times", "more"] as const);
  const m = r(3, 9);
  const a = r(6, 15);
  const [big, small] = pick(r, [
    ["students", "chaperones"],
    ["tickets", "coupons"],
    ["red beads", "gold beads"],
    ["pages", "pictures"],
  ] as const);
  const N = variant === "times" ? m * a : a + m;
  const t = (
    left: string,
    right: string,
    l: number,
    rr: number,
  ): EqCandidate => ({
    text: `$${left}=${right}$`,
    left: l,
    right: rr,
  });
  const cands: EqCandidate[] =
    variant === "times"
      ? [
          t("n", `${m}${times}${a}`, N, m * a),
          t("n", `${a}${times}${m}`, N, a * m),
          t(`${a}${times}${m}`, "n", a * m, N),
          t(`n\\div${m}`, `${a}`, N / m, a),
          t(`n\\div${a}`, `${m}`, N / a, m),
          t("n", `${a}+${m}`, N, a + m),
          t("n", `${a}\\div${m}`, N, a / m),
          t(`n${times}${m}`, `${a}`, N * m, a),
          t(`${a}\\div n`, `${m}`, a / N, m),
          t(`n-${m}`, `${a}`, N - m, a),
        ]
      : [
          t("n", `${a}+${m}`, N, a + m),
          t(`${a}+${m}`, "n", a + m, N),
          t(`n-${a}`, `${m}`, N - a, m),
          t(`n-${m}`, `${a}`, N - m, a),
          t(`${m}+${a}`, "n", m + a, N),
          t("n", `${a}${times}${m}`, N, a * m),
          t("n", `${a}-${m}`, N, a - m),
          t(`n+${a}`, `${m}`, N + a, m),
          t(`n\\div${a}`, `${m}`, N / a, m),
          t(`${m}-${a}`, "n", m - a, N),
        ];
  const pool = cands.map((c) => ({
    label: c.text,
    holds: near(c.left, c.right),
    js: `${c.left}===${c.right}`,
    why: `With $n=${N}$ the left side is ${Number(c.left.toFixed(3))} and the right side is ${Number(c.right.toFixed(3))}.`,
  }));
  const story =
    variant === "times"
      ? `There are ${m} times as many ${big} as ${small}.`
      : `There are ${m} more ${big} than ${small}.`;
  return {
    variant,
    prompt: `A group has ${a} ${small}. ${story} Let $n$ be the number of ${big}. Which 3 equations can be used to find $n$?`,
    hint:
      variant === "times"
        ? `“${m} times as many” means the ${big} come in ${m} groups the size of the ${small}. Write the multiplication, then think of the division equations that say the same thing.`
        : `“${m} more” means the ${big} are the ${small} plus ${m} extra. Write the addition, then think of the subtraction equations that say the same thing.`,
    pool,
    total: 6,
    k: 3,
    noun: "equations",
    lead: [
      variant === "times"
        ? `There are $${m}${times}${a}=${N}$ ${big}, so a correct equation must be true when $n=${N}$.`
        : `There are $${a}+${m}=${N}$ ${big}, so a correct equation must be true when $n=${N}$.`,
    ],
    model: { m, a, N },
  };
}

function trueProductEquations(r: Random): Built {
  const variant = pick(r, ["small-multiplier", "large-multiplier"] as const);
  const slots: { a: number; b: number }[] = [];
  const seen = new Set<number>();
  while (slots.length < 6) {
    const a = r(112, 989);
    const b = variant === "small-multiplier" ? r(2, 5) : r(6, 9);
    if (seen.has(a * b) || a % 10 === 0) continue;
    seen.add(a * b);
    slots.push({ a, b });
  }
  const truth = shuffle(r, [true, true, true, false, false, false]);
  const pool = slots.map(({ a, b }, i) => {
    const p = a * b;
    const [h, t, o] = [Math.floor(a / 100), Math.floor(a / 10) % 10, a % 10];
    const carryless = Number(`${(h * b) % 10}${(t * b) % 10}${(o * b) % 10}`);
    const swapped = Number(
      `${Math.floor(p / 100)}${p % 10}${Math.floor(p / 10) % 10}`,
    );
    const wrong = [p + 10, p - 10, p + 100, p - 100, carryless, swapped].filter(
      (v) => v > 0 && v !== p,
    );
    const shown = truth[i]! ? p : pick(r, wrong);
    return {
      label: `$${a}${times}${b}=${tc(shown)}$`,
      holds: a * b === shown,
      js: `${a}*${b}===${shown}`,
      why: `$${a}${times}${b}=${h * 100}${times}${b}+${t * 10}${times}${b}+${o}${times}${b}=${tc(h * 100 * b)}+${tc(t * 10 * b)}+${tc(o * b)}=${tc(p)}$${a * b === shown ? "." : `, not $${tc(shown)}$.`}`,
    };
  });
  const s = slots[0]!;
  return {
    variant,
    prompt:
      "Each equation states the product of a three-digit number and a one-digit number. Choose the 3 equations whose product is correct.",
    hint: `Check each product yourself instead of trusting the answer shown. Multiply place by place: for ${s.a}, multiply the hundreds, the tens and the ones by ${s.b}, then add the three parts.`,
    pool,
    total: 6,
    k: 3,
    noun: "correct equations",
    model: slots,
  };
}

function prismRangeSelect(r: Random): Built {
  const variant = pick(r, ["range", "exact"] as const);
  for (let attempt = 0; attempt < 200; attempt++) {
    const dims = Array.from(
      { length: 5 },
      () => [r(2, 8), r(2, 8), r(2, 8)] as const,
    );
    const vols = dims.map(([l, w, h]) => l * w * h);
    if (new Set(vols).size < 5) continue;
    const i = r(0, 4);
    let j = r(0, 4);
    while (j === i) j = r(0, 4);
    const sum = vols[i]! + vols[j]!;
    const lo = variant === "range" ? sum - r(3, 14) : sum;
    const hi = variant === "range" ? sum + r(3, 14) : sum;
    const fits = (s: number) =>
      variant === "range" ? s > lo && s < hi : s === lo;
    let count = 0;
    for (let x = 0; x < 5; x++)
      for (let y = x + 1; y < 5; y++) if (fits(vols[x]! + vols[y]!)) count++;
    if (count !== 1) continue;
    const names = ["A", "B", "C", "D", "E"];
    const pool = dims.map(([l, w, h], idx) => ({
      label: `Prism ${names[idx]}: $${l}${times}${w}${times}${h}$ cm`,
      holds: idx === i || idx === j,
      js: `${l}*${w}*${h}`,
      why: `Volume: $${l}${times}${w}${times}${h}=${vols[idx]}$ cubic centimeters.`,
    }));
    return {
      variant,
      prompt:
        variant === "range"
          ? `Five rectangular prisms have the edge lengths shown, in centimeters. Choose the 2 prisms whose volumes added together are greater than ${lo} and less than ${hi} cubic centimeters.`
          : `Five rectangular prisms have the edge lengths shown, in centimeters. Choose the 2 prisms whose volumes added together equal ${lo} cubic centimeters.`,
      hint: "Find the volume of each prism first: length times width times height. Then add pairs of volumes, keeping only the pair whose total meets the condition.",
      pool,
      total: 5,
      k: 2,
      noun: "prisms",
      ordered: true,
      tail: [
        `Together, Prism ${names[Math.min(i, j)]} and Prism ${names[Math.max(i, j)]} have volume $${vols[i]}+${vols[j]}=${sum}$ cubic centimeters${variant === "range" ? `, which is between ${lo} and ${hi}` : `, which equals ${lo}`}. No other pair does.`,
      ],
      model: { dims, vols, lo, hi, variant },
    };
  }
  throw new Error("Need three retry: no unique pair");
}

type Group = { name: string; n: number };
function ratioStatements(r: Random): Built {
  const variant = pick(r, ["three-groups", "two-groups"] as const);
  const contexts = [
    { names: ["red", "blue", "green"], noun: "marbles", intro: "A bag holds" },
    {
      names: ["fiction", "poetry", "history"],
      noun: "books",
      intro: "A shelf holds",
    },
    { names: ["oak", "maple", "pine"], noun: "trees", intro: "A park has" },
    {
      names: ["square", "round", "star"],
      noun: "buttons",
      intro: "A jar holds",
    },
  ];
  const c = pick(r, contexts);
  const count = variant === "three-groups" ? 3 : 2;
  const counts = Array.from({ length: count }, () => r(2, 12));
  if (new Set(counts).size < count) throw new Error("Need three retry");
  const groups: Group[] = counts.map((n, i) => ({
    name: `${c.names[i]} ${c.noun}`,
    n,
  }));
  const all: Group = {
    name: `all the ${c.noun}`,
    n: counts.reduce((x, y) => x + y, 0),
  };
  const specs: [Group, Group][] = [];
  for (const x of groups)
    for (const y of groups) if (x !== y) specs.push([x, y]);
  for (const x of groups) specs.push([x, all], [all, x]);
  const chosen =
    variant === "two-groups" ? specs : shuffle(r, [...specs]).slice(0, 6);
  const cats = chosen.map(([x, y]) => {
    const g = gcd(x.n, y.n);
    const [cx, cy] = [x.n / g, y.n / g];
    const nameX = x === all ? "all the " + c.noun : x.name;
    const claim = (px: number, py: number): Option => {
      const holds = px * y.n === py * x.n;
      return {
        label: `The ratio of ${nameX} to ${y.name} is $${px}:${py}$.`,
        holds,
        js: `${px}*${y.n}===${py}*${x.n}`,
        why: holds
          ? `The counts in this order give $${x.n}:${y.n}$${px === x.n && py === y.n ? "" : `, and $${px}:${py}$ is an equal ratio`}.`
          : `The counts in this order give $${x.n}:${y.n}$${g > 1 ? `, or $${cx}:${cy}$ in simplest form` : ""}, which is not equal to $${px}:${py}$.`,
      };
    };
    const forms = [claim(cx, cy), claim(cx * 2, cy * 2), claim(cy, cx)];
    if (y !== all) forms.push(claim(cx, cx + cy));
    if (x !== all) forms.push(claim(cx + cy, cy));
    return forms.filter(
      (f, i, arr) => arr.findIndex((o) => o.label === f.label) === i,
    );
  });
  const k = variant === "two-groups" ? 3 : 3;
  const options = fromCategories(r, cats, k);
  const listing = groups
    .map((g) => `${g.n} ${g.name}`)
    .reduce(
      (acc, t, i, a) =>
        i === 0 ? t : i === a.length - 1 ? `${acc} and ${t}` : `${acc}, ${t}`,
      "",
    );
  return {
    variant,
    prompt: `${c.intro} ${listing}. A ratio is written in the order its words are stated. Choose the ${k} true statements.`,
    hint: `Write each count and the total. Then read each statement in the order its words give: “${groups[0]!.name} to ${groups[1]!.name}” puts the count of ${groups[0]!.name} first. Dividing or multiplying both numbers by the same amount gives an equal ratio.`,
    pool: options,
    total: options.length,
    k,
    noun: "true statements",
    lead: [`The counts are ${listing}, so there are ${all.n} in all.`],
    model: { groups, all },
  };
}

function trueQuotientEquations(r: Random): Built {
  const variant = pick(r, ["two-digit-divisor", "zero-in-quotient"] as const);
  const slots: { d: number; q: number }[] = [];
  const seen = new Set<number>();
  while (slots.length < 5) {
    const d = r(12, 48);
    const q =
      variant === "two-digit-divisor"
        ? r(21, 280)
        : pick(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]) * 100 + r(1, 9);
    if (seen.has(d * q) || d % 10 === 0) continue;
    seen.add(d * q);
    slots.push({ d, q });
  }
  const truth = shuffle(r, [true, true, false, false, false]);
  const pool = slots.map(({ d, q }, i) => {
    const zeroless = Number(String(q).replace("0", ""));
    const wrong = [
      q + 10,
      q - 10,
      q + 1,
      q - 1,
      zeroless * 10,
      zeroless,
    ].filter((v) => v > 0 && v !== q);
    const shown = truth[i]! ? q : pick(r, wrong);
    return equation("div", d * q, d, shown);
  });
  const s = slots[0]!;
  return {
    variant,
    prompt: "Choose the 2 equations that are true.",
    hint: `Test each quotient by multiplying: for $${tc(s.d * s.q)}\\div${s.d}=\\square$, the quotient times ${s.d} must give back the dividend. Estimate with friendly numbers first to find a wrong place value.`,
    pool,
    total: 5,
    k: 2,
    noun: "true equations",
    model: slots,
  };
}

/* ---------------------------------------------------------------------- */
/* Statistics, rates, percents and number systems                          */
/* ---------------------------------------------------------------------- */

const statBank = [
  {
    setting: "a movie theater",
    statistical: [
      "How many tickets are sold for each showing this week?",
      "How old are the people who come to the Saturday shows?",
      "How much money does each customer spend at the snack counter?",
      "How many minutes do customers wait in line to buy tickets?",
    ],
    single: [
      "How many screens does the theater have?",
      "What time does the first movie start today?",
      "Is the theater open on Sunday?",
      "How many seats are in Theater 3?",
    ],
  },
  {
    setting: "a school library",
    statistical: [
      "How many books does each student check out in a month?",
      "How many minutes do students stay in the library at lunch?",
      "How tall are the students who visit the library?",
      "How many pages are in the books on the fiction shelf?",
    ],
    single: [
      "How many floors does the library have?",
      "What time does the library close on Friday?",
      "How many books did Jada check out today?",
      "Is the library open on Saturdays?",
    ],
  },
  {
    setting: "a community pool",
    statistical: [
      "How many laps do swimmers complete in one visit?",
      "How long does each swimmer stay at the pool on a Saturday?",
      "How many visitors come to the pool each day in July?",
      "How old are the members of the swim team?",
    ],
    single: [
      "How deep is the deep end of the pool?",
      "How many lanes does the pool have?",
      "What time does the pool open on Monday?",
      "How many lifeguards are on duty right now?",
    ],
  },
  {
    setting: "a bakery",
    statistical: [
      "How many loaves of bread are sold each day?",
      "How much does each customer spend on a visit?",
      "How many minutes does each cake take to decorate?",
      "How many muffins are left unsold at closing each night?",
    ],
    single: [
      "How many ovens does the bakery have?",
      "What is the price of one sourdough loaf?",
      "What time does the bakery open on Tuesday?",
      "How many cakes were ordered for Sam's party?",
    ],
  },
];

function statisticalQuestions(r: Random): Built {
  const c = pick(r, statBank);
  const k = r(2, 3);
  const total = 5;
  const pool: Option[] = [
    ...shuffle(r, [...c.statistical])
      .slice(0, k)
      .map((q) => ({
        label: q,
        holds: true,
        why: "Different people or different days give different answers, so collecting data would show a spread of values.",
      })),
    ...shuffle(r, [...c.single])
      .slice(0, total - k)
      .map((q) => ({
        label: q,
        holds: false,
        why: "It has one answer that does not vary, so you can answer it without collecting data about many values.",
      })),
  ];
  return {
    variant: `${k}-of-5`,
    prompt: `A manager at ${c.setting} wants to learn about its customers and daily operation. A statistical question is one that you expect to have different answers for different people, items or times, so you must collect data to answer it. Which ${k} of these questions are statistical?`,
    hint: "Ask of each question: would I get the same answer every time and from everyone, or would the answers vary? Only a question whose answers vary needs a collection of data.",
    pool,
    total,
    k,
    noun: "statistical questions",
    model: { setting: c.setting, k },
  };
}

const speeds: Fr[] = [
  fr(3, 2),
  fr(5, 2),
  fr(7, 2),
  fr(9, 4),
  fr(3, 1),
  fr(4, 1),
  fr(11, 4),
  fr(5, 4),
];
const durations: Fr[] = [
  fr(1, 2),
  fr(3, 4),
  fr(3, 2),
  fr(5, 2),
  fr(5, 4),
  fr(2, 1),
  fr(9, 4),
];
function fractionRateSelect(r: Random): Built {
  const days = ["Monday", "Wednesday", "Friday"];
  const rows: { day: string; s: Fr; t: Fr; d: Fr }[] = [];
  const usedS: string[] = [];
  while (rows.length < 3) {
    const s = pick(r, speeds);
    const t = pick(r, durations);
    const d = fmul(s, t);
    if (usedS.includes(s.join("/")) || (d[1] === 1 && d[0] === 1)) continue;
    usedS.push(s.join("/"));
    rows.push({ day: days[rows.length]!, s, t, d });
  }
  const pool: Option[][] = rows.map(({ day, s, t, d }) => {
    const wrongs = [
      fdiv(t, d),
      fmul(d, t),
      fr(d[0] * t[1] - t[0] * d[1], d[1] * t[1]),
      fr(2 * s[0] + s[1], 2 * s[1]),
    ].filter((w) => w[0] > 0 && !feq(w, s));
    const unique = wrongs.filter(
      (w, i) => wrongs.findIndex((o) => feq(o, w)) === i,
    );
    const form = (rate: Fr): Option => {
      const holds = feq(fmul(rate, t), d);
      return {
        label: `${day}: $${mixed(rate)}$ miles per hour`,
        holds,
        js: `${rate[0]}/${rate[1]}*${t[0]}/${t[1]}===${d[0]}/${d[1]}`,
        why: holds
          ? `$${mixed(d)}\\div${mixed(t)}${mixed(d) === ftex(d) && mixed(t) === ftex(t) ? "" : `=${ftex(d)}\\div${ftex(t)}`}=${mixed(s)}$ miles per hour.`
          : `Distance divided by time gives $${mixed(s)}$ miles per hour, not $${mixed(rate)}$.`,
      };
    };
    return [form(s), ...unique.map(form)];
  });
  // Each day shows one true and one false statement; the order is shuffled.
  const options = pool.flatMap((forms) => [forms[0]!, pick(r, forms.slice(1))]);
  const first = rows[0]!;
  return {
    variant: "three-days",
    prompt: `A hiker walked a trail on three days. ${rows
      .map(
        ({ day, d, t }) =>
          `On ${day} the hiker walked $${mixed(d)}$ miles in $${mixed(t)}$ hours.`,
      )
      .join(
        " ",
      )} Each statement gives the hiker's speed on one day. Choose the 3 statements that are correct.`,
    hint: `A speed in miles per hour is distance divided by time. For ${first.day}, divide $${mixed(first.d)}$ miles by $${mixed(first.t)}$ hours; dividing by a fraction means multiplying by its reciprocal, so first write each mixed number as a fraction.`,
    pool: options,
    total: 6,
    k: 3,
    noun: "correct statements",
    model: rows,
  };
}

function markupSelect(r: Random): Built {
  const variant = pick(r, ["markup", "markdown"] as const);
  const p = pick(r, [10, 20, 25, 30, 40, 50, 60, 75]);
  const sign = variant === "markup" ? 1 : -1;
  const items = shuffle(r, [
    "Backpack",
    "Jacket",
    "Lamp",
    "Helmet",
    "Scooter",
    "Tent",
  ]).slice(0, 5);
  const costs: number[] = [];
  while (costs.length < 5) {
    const c = r(2, 15) * 20;
    if (!costs.includes(c)) costs.push(c);
  }
  const cats = items.map((name, i) => {
    const c = costs[i]!;
    const part = (c * p) / 100;
    const right = c + sign * part;
    const wrongs = [
      part,
      c + sign * p,
      c - sign * part,
      c * (1 + (sign * p) / 10),
    ]
      .filter((v) => v > 0 && v !== right)
      .filter((v, j, a) => a.indexOf(v) === j);
    const form = (s: number): Option => ({
      label: `${name}: cost ${c} dollars, selling price ${s} dollars`,
      holds: s === right,
      js: `${c}*(100${variant === "markup" ? "+" : "-"}${p})/100===${s}`,
      why:
        s === right
          ? `$${p}\\%$ of ${c} is ${part}. ${variant === "markup" ? "Adding" : "Subtracting"} gives ${c} ${variant === "markup" ? "+" : "−"} ${part} = ${right} dollars.`
          : `$${p}\\%$ of ${c} is ${part}, so the price should be ${right} dollars, not ${s}.`,
    });
    return [form(right), ...wrongs.map(form)];
  });
  const options = fromCategories(r, cats, 2);
  return {
    variant,
    prompt: `A store sets each selling price ${p} percent ${variant === "markup" ? "above" : "below"} the item's cost. Which 2 items have the correct selling price?`,
    hint: `Find ${p} percent of the cost first: multiply the cost by $${p}/100$. Then ${variant === "markup" ? "add" : "subtract"} that amount ${variant === "markup" ? "to" : "from"} the cost to get the selling price.`,
    pool: options,
    total: 5,
    k: 2,
    noun: "items",
    model: { p, variant, items, costs },
  };
}

/** Standard numeral for c times 10^e, as a string. */
const standard = (c: number, e: number): string =>
  e >= 0 ? `${c}${"0".repeat(e)}` : `0.${"0".repeat(-e - 1)}${c}`;
const numeral = (s: string): string =>
  s.startsWith("-")
    ? `-${numeral(s.slice(1))}`
    : s.includes(".")
      ? s
      : tc(Number(s));
function sciSelect(r: Random): Built {
  const variant = pick(r, ["positive", "negative", "mixed"] as const);
  const exps =
    variant === "positive"
      ? [3, 4, 5, 6, 7, 8]
      : variant === "negative"
        ? [-2, -3, -4, -5, -6, -7]
        : [-5, -4, -3, 3, 4, 5, 6];
  const pairs: [number, number][] = [];
  while (pairs.length < 6) {
    const c = r(2, 9);
    const e = pick(r, exps);
    if (pairs.some(([pc2, pe]) => pc2 === c && pe === e)) continue;
    if (pairs.some(([, pe]) => pe === e) && pairs.length < 4) continue;
    pairs.push([c, e]);
  }
  const cats = pairs.map(([c, e]) => {
    const right = standard(c, e);
    const wrongs =
      e > 0
        ? [
            standard(c, e + 1),
            e > 1 ? standard(c, e - 1) : String(c * e),
            String(c * e),
          ]
        : [
            standard(c, e - 1),
            standard(c, e + 1 > -1 ? e : e + 1),
            `-${standard(c, -e)}`,
            standard(c, -e),
          ];
    const form = (v: string): Option => {
      const holds = v === right;
      return {
        label: `$${c}${times}10^{${e}}=${numeral(v)}$`,
        holds,
        js: `Math.abs(${c}*10**${e}-(${Number(v)}))<1e-9*Math.abs(${Number(v)})`,
        why: holds
          ? `${e > 0 ? `The positive exponent moves the decimal point ${e} places to the right` : `The negative exponent moves the decimal point ${-e} places to the left`}, giving $${numeral(right)}$.`
          : `The correct numeral is $${numeral(right)}$: ${e > 0 ? `move the decimal point ${e} places to the right` : `move the decimal point ${-e} places to the left, so the number stays positive and small`}.`,
      };
    };
    return [
      form(right),
      ...wrongs
        .filter((w, i) => w !== right && wrongs.indexOf(w) === i)
        .map(form),
    ];
  });
  const options = fromCategories(r, cats, 3);
  const [c0, e0] = pairs[0]!;
  return {
    variant,
    prompt:
      "Each equation writes a number in scientific notation as a standard numeral. Choose the 3 equations that are true.",
    hint: `The exponent of 10 tells how many places the decimal point moves: right for a positive exponent and left for a negative one. For $${c0}${times}10^{${e0}}$, count ${Math.abs(e0)} places, filling empty places with zeros.`,
    pool: options,
    total: 6,
    k: 3,
    noun: "true equations",
    model: pairs,
  };
}

const squareRoot = (n: number) => Math.round(Math.sqrt(n));
const isSquare = (n: number) => squareRoot(n) ** 2 === n;
const cubeRoot = (n: number) => Math.round(Math.cbrt(n));
const isCube = (n: number) => cubeRoot(n) ** 3 === n;
function rationalIrrationalSelect(r: Random): Built {
  const variant = pick(r, ["radicals", "with-pi"] as const);
  if (variant === "radicals") {
    const perfect = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];
    const cubes = [8, 27, 64, 125, 216];
    const nonSquare = [
      2, 3, 5, 6, 7, 10, 11, 12, 15, 18, 20, 21, 24, 26, 28, 30, 35, 40, 45, 50,
      60, 72, 80,
    ];
    const rationalForms = (): Option => {
      const kind = r(0, 2);
      if (kind === 0) {
        const n = pick(r, perfect);
        return {
          label: `$\\sqrt{${n}}$`,
          holds: true,
          js: `${n}`,
          why: `$\\sqrt{${n}}=${squareRoot(n)}$, a whole number, so it is rational.`,
        };
      }
      if (kind === 1) {
        const n = pick(r, cubes);
        return {
          label: `$\\sqrt[3]{${n}}$`,
          holds: true,
          js: `${n}`,
          why: `$\\sqrt[3]{${n}}=${cubeRoot(n)}$ because $${cubeRoot(n)}^{3}=${n}$, so it is rational.`,
        };
      }
      const a = pick(r, [1, 3, 5, 7]);
      const b = pick(r, [2, 4, 8, 9]);
      return {
        label: `$\\sqrt{\\frac{${a * a}}{${b * b}}}$`,
        holds: true,
        js: `${a}/${b}`,
        why: `$\\sqrt{\\frac{${a * a}}{${b * b}}}=\\frac{${a}}{${b}}$, a ratio of integers, so it is rational.`,
      };
    };
    const irrationalForms = (): Option => {
      const kind = r(0, 2);
      if (kind === 0) {
        const n = pick(r, nonSquare);
        return {
          label: `$\\sqrt{${n}}$`,
          holds: false,
          js: `Math.sqrt(${n})`,
          why: `${n} is not a perfect square, so $\\sqrt{${n}}$ is not a ratio of integers: it is irrational.`,
        };
      }
      if (kind === 1) {
        const n = pick(r, [2, 3, 4, 5, 6, 9, 10, 12, 16, 20, 25, 30]);
        return {
          label: `$\\sqrt[3]{${n}}$`,
          holds: isCube(n),
          js: `Math.cbrt(${n})`,
          why: `${n} is not a perfect cube, so $\\sqrt[3]{${n}}$ is irrational.`,
        };
      }
      const a = pick(r, [1, 2, 3, 5]);
      const b = pick(r, [3, 5, 6, 7]);
      const holds = isSquare(a * b);
      return {
        label: `$\\sqrt{\\frac{${a}}{${b}}}$`,
        holds,
        js: `Math.sqrt(${a}/${b})`,
        why: holds
          ? `$\\sqrt{\\frac{${a}}{${b}}}=\\frac{\\sqrt{${a * b}}}{${b}}=\\frac{${squareRoot(a * b)}}{${b}}$, a ratio of integers.`
          : `$\\sqrt{\\frac{${a}}{${b}}}=\\frac{\\sqrt{${a * b}}}{${b}}$ and ${a * b} is not a perfect square, so the value is irrational.`,
      };
    };
    const pool: Option[] = [];
    while (pool.filter((o) => o.holds).length < 2) pool.push(rationalForms());
    while (pool.filter((o) => !o.holds).length < 3)
      pool.push(irrationalForms());
    return {
      variant,
      prompt:
        "A rational number can be written as a ratio of two integers. Which 2 of these numbers are rational?",
      hint: "Simplify each radical when you can. A square root of a perfect square, or a cube root of a perfect cube, is a whole number or a ratio of whole numbers. A root of a number that is not a perfect power cannot be written as a ratio.",
      pool,
      total: 5,
      k: 2,
      noun: "rational numbers",
    };
  }
  const s = pick(r, [2, 3, 5, 6, 7]);
  const t = pick(
    r,
    [2, 3, 5, 7].filter((v) => v !== s),
  );
  const m = pick(r, [2, 3, 4, 5]);
  const a = pick(r, [4, 9, 16, 25]);
  const kk = pick(r, [2, 3, 4]);
  const rat: Option[] = [
    {
      label: `$\\sqrt{${s}}\\cdot\\sqrt{${s * kk * kk}}$`,
      holds: true,
      js: `Math.sqrt(${s})*Math.sqrt(${s * kk * kk})`,
      why: `$\\sqrt{${s}}\\cdot\\sqrt{${s * kk * kk}}=\\sqrt{${s * s * kk * kk}}=${s * kk}$, a whole number, so the value is rational.`,
    },
    {
      label: `$\\left(\\sqrt{${s}}+${m}\\right)\\left(\\sqrt{${s}}-${m}\\right)$`,
      holds: true,
      js: `(Math.sqrt(${s})+${m})*(Math.sqrt(${s})-${m})`,
      why: `The product of a sum and difference is $${s}-${m * m}=${s - m * m}$, a whole number, so the value is rational.`,
    },
    {
      label: `$\\frac{${3 * m}\\pi}{\\pi}$`,
      holds: true,
      js: `${3 * m}`,
      why: `The factors of $\\pi$ cancel, leaving ${3 * m}, so the value is rational.`,
    },
    {
      label: `$\\sqrt{${a}}+\\sqrt{${a * 4}}$`,
      holds: true,
      js: `Math.sqrt(${a})+Math.sqrt(${a * 4})`,
      why: `$\\sqrt{${a}}=${squareRoot(a)}$ and $\\sqrt{${a * 4}}=${squareRoot(a * 4)}$, so the sum is ${squareRoot(a) + squareRoot(a * 4)}, which is rational.`,
    },
  ];
  const irr: Option[] = [
    {
      label: `$\\pi+\\sqrt{${a}}$`,
      holds: false,
      js: `Math.PI+Math.sqrt(${a})`,
      why: `$\\sqrt{${a}}=${squareRoot(a)}$ is rational, and a rational number plus $\\pi$ is irrational.`,
    },
    {
      label: `$\\sqrt{${s}}\\cdot\\sqrt{${t}}$`,
      holds: false,
      js: `Math.sqrt(${s})*Math.sqrt(${t})`,
      why: `$\\sqrt{${s}}\\cdot\\sqrt{${t}}=\\sqrt{${s * t}}$, and ${s * t} is not a perfect square, so the value is irrational.`,
    },
    {
      label: `$${m}\\cdot\\frac{\\pi}{2}$`,
      holds: false,
      js: `${m}*Math.PI/2`,
      why: `A nonzero rational number times $\\pi$ is irrational.`,
    },
    {
      label: `$\\sqrt{${s}}+\\sqrt{${t}}$`,
      holds: false,
      js: `Math.sqrt(${s})+Math.sqrt(${t})`,
      why: `The roots of different non-square numbers cannot cancel, so the sum is irrational.`,
    },
    {
      label: `$${m}\\sqrt{${s}}$`,
      holds: false,
      js: `${m}*Math.sqrt(${s})`,
      why: `A nonzero rational number times the irrational $\\sqrt{${s}}$ is irrational.`,
    },
  ];
  const pool = [...shuffle(r, rat).slice(0, 2), ...shuffle(r, irr).slice(0, 3)];
  return {
    variant,
    prompt:
      "A rational number can be written as a ratio of two integers. Which 2 of these expressions have a rational value?",
    hint: "Simplify each expression first. A product or sum can be rational even when it contains a root or $\\pi$: look for roots that multiply to a perfect square, factors that cancel, or perfect-square roots. The sum of a rational and an irrational number is irrational.",
    pool,
    total: 5,
    k: 2,
    noun: "expressions",
  };
}

function tableInterceptSelect(r: Random): Built {
  const variant = pick(r, ["zero-listed", "zero-missing"] as const);
  const relation = pick(r, ["less", "greater"] as const);
  const m0 = r(-4, 6) || 2;
  let b = 0;
  while (b === 0) b = r(-6, 8);
  const xs =
    variant === "zero-listed"
      ? pick(r, [
          [0, 1, 2],
          [0, 2, 4],
          [0, 1, 3],
        ])
      : pick(r, [
          [1, 2, 3],
          [2, 4, 6],
          [3, 4, 5],
          [1, 3, 5],
        ]);
  const truth = shuffle(r, [true, true, true, false, false, false]);
  const used = new Set<string>();
  const pool: Option[] = [];
  for (let i = 0; pool.length < 6; i++) {
    if (i > 80) throw new Error("Need three retry");
    const idx = pool.length;
    const s = r(-5, 6) || 3;
    const dir = relation === "less" ? -1 : 1;
    const bi = truth[idx]!
      ? b + dir * r(1, 8)
      : r(0, 2) === 0
        ? b
        : b - dir * r(1, 8);
    const ys = xs.map((x) => s * x + bi);
    const show = (v: number) => (v < 0 ? `−${-v}` : `${v}`);
    const label = `$x$: ${xs.join(", ")} and $y$: ${ys.map(show).join(", ")}`;
    if (used.has(label) || ys.some((y) => Math.abs(y) > 60)) continue;
    used.add(label);
    const holds = relation === "less" ? bi < b : bi > b;
    pool.push({
      label,
      holds,
      js: `(${ys[0]})-(${s})*(${xs[0]})${relation === "less" ? "<" : ">"}(${b})`,
      why:
        (xs[0] === 0
          ? `At $x=0$ the table has $y=${bi}$, so the $y$-intercept is ${bi}.`
          : `Each step of 1 in $x$ changes $y$ by ${s}, so going back from $x=${xs[0]}$ to $x=0$ changes $y$ by $${-s * xs[0]}$: $${ys[0]}${-s * xs[0] < 0 ? "-" : "+"}${Math.abs(s * xs[0])}=${bi}$.`) +
        ` ${bi} is ${bi === b ? "equal to" : bi < b ? "less than" : "greater than"} ${b}.`,
    });
  }
  const fn = `y=${m0 === 1 ? "" : m0 === -1 ? "-" : m0}x${b < 0 ? "-" : "+"}${Math.abs(b)}`;
  return {
    variant,
    prompt: `The linear function $${fn}$ has a $y$-intercept of ${b}. Each option lists the $x$ and $y$ values of a table for a linear function. Choose the 3 tables whose $y$-intercept is ${relation === "less" ? "less" : "greater"} than ${b}.`,
    hint: `The $y$-intercept is the value of $y$ when $x=0$. If $x=0$ is not listed, find the change in $y$ for each step in $x$, then move back from the first row to $x=0$. Compare each intercept with ${b}; an equal intercept is not ${relation}.`,
    pool,
    total: 6,
    k: 3,
    noun: "tables",
    model: { m0, b, xs, relation },
  };
}

function quadraticZeros(r: Random): Built {
  const variant = pick(r, ["factored", "standard", "leading"] as const);
  let p = 0;
  let q = 0;
  while (p === 0 || q === 0 || p === q) {
    p = r(-8, 8);
    q = r(-8, 8);
  }
  const lead = variant === "leading" ? pick(r, [2, 3]) : 1;
  const b = -lead * (p + q);
  const c = lead * p * q;
  const f = (x: number) => lead * (x - p) * (x - q);
  const lin = (v: number) => `x${v < 0 ? "+" : "-"}${Math.abs(v)}`;
  const term = (v: number, s: string) =>
    v === 0
      ? ""
      : `${v < 0 ? "-" : "+"}${Math.abs(v) === 1 && s ? "" : Math.abs(v)}${s}`;
  const expr =
    variant === "factored"
      ? `(${lin(p)})(${lin(q)})`
      : `${lead === 1 ? "" : lead}x^{2}${term(b, "x")}${term(c, "")}`;
  const cands = [
    -p,
    -q,
    p + q,
    p * q,
    -(p + q),
    c,
    b,
    p - q,
    0,
    p + 1,
    q - 1,
  ].filter((v) => Number.isInteger(v) && Math.abs(v) <= 40);
  const values = [
    p,
    q,
    ...cands.filter((v, i) => cands.indexOf(v) === i && f(v) !== 0),
  ];
  if (values.length < 5) throw new Error("Need three retry");
  const pool = [
    ...values.slice(0, 2),
    ...shuffle(r, values.slice(2)).slice(0, 3),
  ].map((v): Option => ({
    label: `$x=${v}$`,
    holds: f(v) === 0,
    js: `${f(v)}===0`,
    why:
      variant === "factored"
        ? `At $x=${v}$ the factors are $${v - p}$ and $${v - q}$, with product $${(v - p) * (v - q)}$.`
        : `At $x=${v}$ the expression equals ${f(v)}.`,
  }));
  return {
    variant,
    prompt: `Which 2 values of $x$ make the expression $${expr}$ equal to 0?`,
    hint:
      variant === "factored"
        ? "A product is 0 only when one of its factors is 0. Set each factor equal to 0 and solve, or substitute each value and check."
        : "Substitute each value for $x$ and check whether the expression equals 0, or factor the expression and set each factor equal to 0.",
    pool,
    total: 5,
    k: 2,
    noun: "values of x",
    tail: [`The expression equals 0 only at $x=${p}$ and $x=${q}$.`],
    model: { p, q, lead, expr },
  };
}

/* ---------------------------------------------------------------------- */
/* Geometry and functions                                                  */
/* ---------------------------------------------------------------------- */

function cubePrismStatements(r: Random): Built {
  const n = pick(r, [2, 3, 4]);
  let a = 0;
  let b = 0;
  let c = 0;
  while (a === b || b === c || a === c) {
    a = r(2, 6);
    b = r(2, 6);
    c = r(2, 6);
  }
  const unit = fr(1, n);
  const edge = (count: number) => fr(count, n);
  const N = a * b * c;
  const vol = fr(N, n ** 3);
  const cubeVolume = (s: string, holds: boolean, why: string): Option => ({
    label: `Each small cube has a volume of $${s}$ cubic unit.`,
    holds,
    why,
  });
  const cats: Option[][] = [
    [
      {
        label: `${a} cubes fit along the length.`,
        holds: true,
        why: `The length $${mixed(edge(a))}$ divided by the cube edge $${ftex(unit)}$ is ${a}.`,
      },
      {
        label: `${a * n} cubes fit along the length.`,
        holds: false,
        why: `The length $${mixed(edge(a))}$ divided by the cube edge $${ftex(unit)}$ is ${a}, not ${a * n}.`,
      },
      {
        label: `${a + n} cubes fit along the length.`,
        holds: false,
        why: `The length $${mixed(edge(a))}$ divided by the cube edge $${ftex(unit)}$ is ${a}, not ${a + n}.`,
      },
    ],
    [
      cubeVolume(
        `\\frac{1}{${n ** 3}}`,
        true,
        `The cube has volume $\\frac{1}{${n}}${times}\\frac{1}{${n}}${times}\\frac{1}{${n}}=\\frac{1}{${n ** 3}}$.`,
      ),
      cubeVolume(
        `\\frac{1}{${n}}`,
        false,
        `The cube has volume $\\frac{1}{${n}}${times}\\frac{1}{${n}}${times}\\frac{1}{${n}}=\\frac{1}{${n ** 3}}$, not $\\frac{1}{${n}}$.`,
      ),
      cubeVolume(
        `\\frac{1}{${n * n}}`,
        false,
        `$\\frac{1}{${n * n}}$ is the area of one face. The volume multiplies three edges: $\\frac{1}{${n ** 3}}$.`,
      ),
    ],
    [
      {
        label: `It takes ${N} cubes to fill the prism.`,
        holds: true,
        why: `The prism holds $${a}${times}${b}${times}${c}=${N}$ cubes.`,
      },
      {
        label: `It takes ${a + b + c} cubes to fill the prism.`,
        holds: false,
        why: `Adding ${a}, ${b} and ${c} counts edges, not cubes. The prism holds $${a}${times}${b}${times}${c}=${N}$ cubes.`,
      },
      {
        label: `It takes ${N * n} cubes to fill the prism.`,
        holds: false,
        why: `The prism holds $${a}${times}${b}${times}${c}=${N}$ cubes, not ${N * n}.`,
      },
    ],
    [
      {
        label: `The volume of the prism is $${ftex(vol)}$ cubic units.`,
        holds: true,
        why: `${N} cubes of volume $\\frac{1}{${n ** 3}}$ have volume $\\frac{${N}}{${n ** 3}}=${ftex(vol)}$.`,
      },
      {
        label: `The volume of the prism is $${ftex(fr(N, n))}$ cubic units.`,
        holds: feq(fr(N, n), vol),
        why: `Each cube has volume $\\frac{1}{${n ** 3}}$, so the volume is $${ftex(vol)}$, not $${ftex(fr(N, n))}$.`,
      },
      {
        label: `The volume of the prism is ${N} cubic units.`,
        holds: false,
        why: `${N} is the number of cubes. Each cube has volume $\\frac{1}{${n ** 3}}$, so the volume is $${ftex(vol)}$.`,
      },
    ],
    [
      {
        label: "Multiplying the three edge lengths gives the volume.",
        holds: true,
        why: `$${mixed(edge(a))}${times}${mixed(edge(b))}${times}${mixed(edge(c))}=${ftex(vol)}$, the same volume as counting cubes.`,
      },
      {
        label: "Adding the three edge lengths gives the volume.",
        holds: false,
        why: `Adding edge lengths gives a length, not a volume. Multiply them to get $${ftex(vol)}$ cubic units.`,
      },
    ],
  ];
  const options = fromCategories(r, cats, 2);
  return {
    variant: `edge-1-over-${n}`,
    prompt: `A rectangular prism is $${mixed(edge(a))}$ units long, $${mixed(edge(b))}$ units wide and $${mixed(edge(c))}$ units tall. It is packed with no gaps or overlaps with small cubes whose edges are $${ftex(unit)}$ unit long. Choose the 2 true statements.`,
    hint: `Divide each edge length of the prism by the cube edge $${ftex(unit)}$ to count the cubes along that edge. A cube's volume is its edge multiplied by itself three times, and the prism's volume is the number of cubes times one cube's volume.`,
    pool: options,
    total: 5,
    k: 2,
    noun: "true statements",
    model: { n, a, b, c },
  };
}

const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
function congruenceSelect(r: Random): Built {
  const variant = pick(r, ["aligned", "scrambled"] as const);
  const bag = shuffle(r, [...letters]).slice(0, 6);
  let first = bag.slice(0, 3);
  let second = bag.slice(3, 6);
  if (variant === "aligned") {
    const start = r(0, letters.length - 6);
    first = letters.slice(start, start + 3);
    second = letters.slice(start + 3, start + 6);
    // keep the letters consecutive in the alphabet after removing skipped letters
  }
  const tri = (names: string[]) => `\\triangle ${names.join("")}`;
  const statement = `$${tri(first)}\\cong${tri(second)}$`;
  const pairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];
  const pool: Option[] = [];
  const name = (names: string[], i: number, j: number, flip: boolean) =>
    flip ? `${names[j]}${names[i]}` : `${names[i]}${names[j]}`;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      pool.push({
        label: `$\\angle ${first[i]}\\cong\\angle ${second[j]}$`,
        holds: i === j,
        why:
          i === j
            ? `Vertex ${first[i]} is in the same position as ${second[j]} in the congruence statement, so the angles correspond.`
            : `${first[i]} corresponds to ${second[i]}, not ${second[j]}, so these angles do not correspond.`,
      });
  for (const [i, j] of pairs)
    for (const [x, y] of pairs) {
      const holds = (i === x && j === y) || (i === y && j === x);
      pool.push({
        label: `$\\overline{${name(first, i, j, r(0, 1) === 1)}}\\cong\\overline{${name(second, x, y, r(0, 1) === 1)}}$`,
        holds,
        why: holds
          ? `${first[i]} corresponds to ${second[i]} and ${first[j]} corresponds to ${second[j]}, so these sides correspond.`
          : `Side ${first[i]}${first[j]} corresponds to side ${second[i]}${second[j]}, not to ${second[x]}${second[y]}.`,
      });
    }
  return {
    variant,
    prompt: `The triangles satisfy ${statement}. Choose the 3 statements about corresponding parts that must be true.`,
    hint: `The letters of a congruence statement are listed in matching order: the first letter of the first triangle matches the first letter of the second, and so on. Write the three matching pairs of vertices, then read each statement as a pair of vertices or two pairs.`,
    pool,
    total: 6,
    k: 3,
    noun: "true statements",
    lead: [
      `By position in the statement, ${first.map((l, i) => `${l} matches ${second[i]}`).join(", ")}.`,
    ],
    model: { first, second },
  };
}

function circleEquationSelect(r: Random): Built {
  let h = 0;
  let k = 0;
  while (h === 0 || k === 0 || h === k || h === -k) {
    h = r(-8, 8);
    k = r(-8, 8);
  }
  const rad = r(2, 9);
  const shift = (v: string, c: number) =>
    `(${v}${c < 0 ? "+" : "-"}${Math.abs(c)})^{2}`;
  const eq = `${shift("x", h)}+${shift("y", k)}=${rad * rad}`;
  const pt = (a: number, b: number) => `$\\left(${a},${b}\\right)$`;
  const point = (a: number, b: number): Option => {
    const d2 = (a - h) ** 2 + (b - k) ** 2;
    return {
      label: `The point ${pt(a, b)} is on the circle.`,
      holds: d2 === rad * rad,
      js: `(${a}-(${h}))**2+(${b}-(${k}))**2===${rad * rad}`,
      why: `Substituting gives $(${a - h})^{2}+(${b - k})^{2}=${d2}$, which ${d2 === rad * rad ? "equals" : "is not"} ${rad * rad}.`,
    };
  };
  const center = (a: number, b: number): Option => ({
    label: `The center is the point ${pt(a, b)}.`,
    holds: a === h && b === k,
    why:
      a === h && b === k
        ? `The equation has the form $(x-h)^{2}+(y-k)^{2}=r^{2}$ with $h=${h}$ and $k=${k}$.`
        : `In $(x-h)^{2}+(y-k)^{2}=r^{2}$ the center is $(h,k)=(${h},${k})$: the signs in the equation are opposite to the coordinates.`,
  });
  const cats: Option[][] = [
    [center(h, k), center(-h, -k), center(k, h)],
    [
      {
        label: `The radius is ${rad}.`,
        holds: true,
        why: `The right side is $r^{2}=${rad * rad}$, so $r=${rad}$.`,
      },
      {
        label: `The radius is ${rad * rad}.`,
        holds: false,
        why: `${rad * rad} is $r^{2}$. The radius is its square root, ${rad}.`,
      },
    ],
    [
      {
        label: `The diameter is ${2 * rad}.`,
        holds: true,
        why: `The radius is ${rad}, so the diameter is $2${times}${rad}=${2 * rad}$.`,
      },
      {
        label: `The diameter is ${rad}.`,
        holds: false,
        why: `${rad} is the radius. The diameter is twice the radius, ${2 * rad}.`,
      },
    ],
    [
      point(h + rad, k),
      point(h, k - rad),
      point(h - rad, k),
      point(h + rad, k + rad),
      point(h + rad * rad, k),
    ],
    [
      {
        label: "The origin is inside the circle.",
        holds: h * h + k * k < rad * rad,
        why: `The origin is $\\sqrt{${h * h + k * k}}$ units from the center, and the radius is ${rad}, so it is ${h * h + k * k < rad * rad ? "inside" : "not inside"}.`,
      },
      {
        label: "The origin is outside the circle.",
        holds: h * h + k * k > rad * rad,
        why: `The origin is $\\sqrt{${h * h + k * k}}$ units from the center, and the radius is ${rad}, so it is ${h * h + k * k > rad * rad ? "outside" : "not outside"}.`,
      },
    ],
  ];
  return {
    variant: "circle-center-radius",
    prompt: `A circle in the coordinate plane has the equation $${eq}$. Choose the 2 true statements.`,
    hint: "Compare the equation with $(x-h)^{2}+(y-k)^{2}=r^{2}$, where $(h,k)$ is the center and $r$ is the radius. Read $h$ and $k$ with the opposite sign of what is printed, and take the square root of the number on the right for $r$.",
    pool: fromCategories(r, cats, 2),
    total: 5,
    k: 2,
    noun: "true statements",
    model: { h, k, rad },
  };
}

function cylinderScalingSelect(r: Random): Built {
  type Spec = { kind: "radius" | "height" | "both"; f: Fr; g: Fr };
  const factors: Fr[] = [fr(2, 1), fr(3, 1), fr(1, 2), fr(4, 1)];
  const specs: Spec[] = [];
  for (const f of factors) specs.push({ kind: "radius", f, g: fr(1, 1) });
  for (const f of factors) specs.push({ kind: "height", f: fr(1, 1), g: f });
  specs.push(
    { kind: "both", f: fr(2, 1), g: fr(2, 1) },
    { kind: "both", f: fr(3, 1), g: fr(2, 1) },
    { kind: "both", f: fr(2, 1), g: fr(1, 2) },
  );
  const chosen = shuffle(r, [...specs]).slice(0, 5);
  const cats = chosen.map(({ kind, f, g }) => {
    const right = fmul(fmul(f, f), g);
    const what =
      kind === "radius"
        ? `the radius is multiplied by $${ftex(f)}$`
        : kind === "height"
          ? `the height is multiplied by $${ftex(g)}$`
          : `the radius is multiplied by $${ftex(f)}$ and the height is multiplied by $${ftex(g)}$`;
    const form = (m: Fr): Option => ({
      label: `If ${what}, the volume is multiplied by $${ftex(m)}$.`,
      holds: feq(m, right),
      js: `${m[0]}/${m[1]}===${right[0]}/${right[1]}`,
      why: feq(m, right)
        ? `$V=\\pi r^{2}h$. ${kind === "radius" ? `Multiplying $r$ by $${ftex(f)}$ multiplies $r^{2}$ by $${ftex(fmul(f, f))}$` : kind === "height" ? `Multiplying $h$ by $${ftex(g)}$ multiplies $V$ by $${ftex(g)}$` : `$r^{2}$ is multiplied by $${ftex(fmul(f, f))}$ and $h$ by $${ftex(g)}$, so $V$ is multiplied by $${ftex(right)}$`}.`
        : `$V=\\pi r^{2}h$ is multiplied by $${ftex(right)}$ here, not $${ftex(m)}$.`,
    });
    const wrongs = [
      fmul(f, g),
      fmul(fmul(f, f), fmul(g, g)),
      fmul(f, fmul(g, fr(2, 1))),
      fmul(fmul(f, f), fr(2, 1)),
    ].filter(
      (m, i, a) => !feq(m, right) && a.findIndex((o) => feq(o, m)) === i,
    );
    return [form(right), ...wrongs.map(form)];
  });
  return {
    variant: "radius-height-both",
    prompt:
      "The volume of a cylinder with radius $r$ and height $h$ is $V=\\pi r^{2}h$. Choose the 2 true statements about how the volume changes.",
    hint: "In $V=\\pi r^{2}h$ the radius is squared but the height is not. When a dimension is multiplied by a factor, replace it by the factor times itself in the formula and see what multiplies $V$.",
    pool: fromCategories(r, cats, 2),
    total: 5,
    k: 2,
    noun: "true statements",
    model: chosen,
  };
}

function negativeFractionForms(r: Random): Built {
  const variant = pick(r, ["negative", "positive"] as const);
  const b = r(2, 9);
  let a = r(b + 1, 17);
  while (gcd(a, b) !== 1) a = r(b + 1, 17);
  const negs = (s: string) => (s.match(/-/g) ?? []).length;
  const mk = (tex: string, flip: boolean): Option => {
    const odd = negs(tex) % 2 === 1;
    const wantNegative = variant === "negative";
    const holds = !flip && odd === wantNegative;
    const mag = flip ? `\\frac{${b}}{${a}}` : `\\frac{${a}}{${b}}`;
    return {
      label: `$${tex}$`,
      holds,
      js: `${(odd ? -1 : 1) * (flip ? b / a : a / b)}===${(wantNegative ? -1 : 1) * (a / b)}`,
      why: `It has ${negs(tex) === 0 ? "no negative signs" : negs(tex) === 1 ? "one negative sign" : `${negs(tex)} negative signs`}, so its value is ${odd ? "negative" : "positive"}, with size $${mag}$${flip ? ", the reciprocal of the target size" : ""}.`,
    };
  };
  const fa = `\\frac{${a}}{${b}}`;
  const pool: Option[] = [
    mk(`\\frac{-${a}}{${b}}`, false),
    mk(`\\frac{${a}}{-${b}}`, false),
    ...(variant === "negative" ? [] : [mk(`-${fa}`, false)]),
    mk(`(-1)\\cdot${fa}`, false),
    mk(`-\\frac{-${a}}{${b}}`, false),
    mk(`-\\frac{${a}}{-${b}}`, false),
    mk(`\\frac{-${a}}{-${b}}`, false),
    mk(`(-1)\\cdot\\frac{-${a}}{${b}}`, false),
    ...(variant === "positive" ? [] : [mk(fa, false)]),
    mk(`-\\left(-${fa}\\right)`, false),
    mk(`-\\frac{${b}}{${a}}`, true),
    mk(`\\frac{-${b}}{${a}}`, true),
    mk(`\\frac{${b}}{${a}}`, true),
  ];
  return {
    variant,
    prompt: `Which 3 expressions are equal to $${variant === "negative" ? "-" : ""}\\frac{${a}}{${b}}$?`,
    hint: "Count the negative signs in each expression, in the numerator, the denominator and the front. An odd number of negative signs gives a negative value and an even number gives a positive one. Then check that the fraction is not turned upside down.",
    pool,
    total: 6,
    k: 3,
    noun: "equal expressions",
    model: { a, b, variant },
  };
}

/* ---------------------------------------------------------------------- */
/* Single-choice descriptions                                              */
/* ---------------------------------------------------------------------- */

function circleRadiusDistance(r: Random): Single {
  const variant = pick(r, ["radius", "diameter", "circumference"] as const);
  const mk = (value: number, feedbacks: [number, string][]): Choice[] => [
    { label: `${value} cm`, correct: true },
    ...feedbacks.map(([v, feedback]) => ({ label: `${v} cm`, feedback })),
  ];
  if (variant === "radius") {
    const rad = r(3, 12) * 2;
    return {
      variant,
      prompt: `Point $O$ is the center of a circle with radius ${rad} cm, and point $P$ is on the circle. What is the distance from $O$ to $P$?`,
      hint: "Every point on a circle is the same distance from its center. That distance has a name: the radius.",
      explanation: [
        `A circle is the set of points at one fixed distance, the radius, from its center.`,
        `$P$ is on the circle, so $OP$ equals the radius, ${rad} cm.`,
      ],
      choices: mk(rad, [
        [
          rad * 2,
          `${rad * 2} cm is the diameter, the distance across the circle through the center, not from the center to the circle.`,
        ],
        [
          rad / 2,
          `${rad / 2} cm is half the radius. Every point on the circle is a full radius from the center.`,
        ],
        [
          rad * rad,
          `${rad * rad} is the radius squared, a number used for area, not a distance.`,
        ],
      ]),
      model: { rad },
    };
  }
  if (variant === "diameter") {
    const d = r(4, 15) * 4;
    return {
      variant,
      prompt: `A circle has center $O$ and a diameter of ${d} cm. Point $P$ is on the circle. What is the distance from $O$ to $P$?`,
      hint: "The diameter goes all the way across the circle through the center. The distance from the center to the circle is only part of that way.",
      explanation: [
        `The diameter is twice the radius, so the radius is ${d} ÷ 2 = ${d / 2} cm.`,
        `Every point on the circle is one radius from the center, so $OP=${d / 2}$ cm.`,
      ],
      choices: mk(d / 2, [
        [
          d,
          `${d} cm is the diameter, the whole distance across the circle, not the distance from the center to the circle.`,
        ],
        [
          d * 2,
          `${d * 2} cm doubles the diameter. The distance from the center is half of it.`,
        ],
        [
          d / 4,
          `${d / 4} cm is a quarter of the diameter. The radius is half of the diameter.`,
        ],
      ]),
      model: { d },
    };
  }
  const rad = r(3, 14);
  return {
    variant,
    prompt: `A circle with center $O$ has a circumference of $${2 * rad}\\pi$ cm. Point $P$ is on the circle. What is the distance from $O$ to $P$?`,
    hint: "The circumference of a circle is $2\\pi r$. Use it to find the radius, then think about how far every point on the circle is from the center.",
    explanation: [
      `The circumference is $2\\pi r=${2 * rad}\\pi$, so $r=${rad}$ cm.`,
      `Every point on the circle is one radius from the center, so $OP=${rad}$ cm.`,
    ],
    choices: mk(rad, [
      [
        2 * rad,
        `${2 * rad} is the number multiplying $\\pi$ in the circumference, not the radius. Divide it by 2.`,
      ],
      [
        rad * 2 * rad,
        `${rad * 2 * rad} multiplies the radius and the circumference. A distance from the center is the radius.`,
      ],
      [
        rad + 2,
        `${rad + 2} cm is not related to the circumference $2\\pi r$ by any rule. Solve $2\\pi r=${2 * rad}\\pi$ for $r$.`,
      ],
    ]),
    model: { rad },
  };
}

function parenthesizedProduct(r: Random): Single {
  const variant = pick(r, [
    "times-sum",
    "times-difference",
    "sum-times",
  ] as const);
  const n = r(2, 9);
  const b = r(2, 9);
  const a = variant === "times-difference" ? b + r(3, 12) : r(11, 29);
  const op = variant === "times-difference" ? "-" : "+";
  const word = variant === "times-difference" ? "difference" : "sum";
  const inner = `${a}${op}${b}`;
  const expr =
    variant === "sum-times"
      ? `(${inner})${times}${n}`
      : `${n}${times}(${inner})`;
  const correct = `${n} times as large as the ${word} of ${a} and ${b}`;
  return {
    variant,
    prompt: `Which statement describes the expression $${expr}$ without evaluating it?`,
    hint: `Look at the parentheses first: they make $${inner}$ one number. Then say what the ${n} does to that one number.`,
    explanation: [
      `The parentheses group $${inner}$, the ${word} of ${a} and ${b}, into one number.`,
      `The expression multiplies that number by ${n}, so its value is ${n} times as large as the ${word} of ${a} and ${b}.`,
    ],
    choices: [
      { label: correct, correct: true },
      {
        label: `${n} times ${a}, with ${b} ${variant === "times-difference" ? "taken away" : "added"} afterward`,
        feedback: `That describes $${n}${times}${a}${op}${b}$. In the given expression the parentheses make ${n} multiply the whole ${word}.`,
      },
      {
        label: `${n} ${variant === "times-difference" ? "less" : "more"} than the ${word} of ${a} and ${b}`,
        feedback: `“${n} ${variant === "times-difference" ? "less" : "more"} than” describes ${variant === "times-difference" ? "subtracting" : "adding"} ${n}, not multiplying by ${n}.`,
      },
      {
        label: `the ${word} of ${a} and ${b}, divided into ${n} equal parts`,
        feedback: `Dividing the ${word} into ${n} equal parts would be a division by ${n}. The expression multiplies.`,
      },
    ],
    model: { n, a, b, variant },
  };
}

function slopeSignDescription(r: Random): Single {
  const variant = pick(r, [
    "falls-as-rises",
    "rises-as-rises",
    "rises-as-falls",
    "falls-as-falls",
    "unchanged",
  ] as const);
  const contexts = [
    { x: "time $t$ in minutes", y: "the water level $w$ in a tank", f: "w" },
    {
      x: "the number of tickets $n$ sold",
      y: "the amount $m$ of money collected",
      f: "m",
    },
    {
      x: "the distance $d$ climbed",
      y: "the temperature $T$ of the air",
      f: "T",
    },
    {
      x: "the number of days $d$ used",
      y: "the charge $c$ left on a battery",
      f: "c",
    },
  ] as const;
  const c = pick(r, contexts);
  const answer =
    variant === "falls-as-rises" || variant === "rises-as-falls"
      ? "Negative"
      : variant === "unchanged"
        ? "Zero"
        : "Positive";
  const text: Record<typeof variant, string> = {
    "falls-as-rises": `As ${c.x} increases, ${c.y} decreases.`,
    "rises-as-rises": `As ${c.x} increases, ${c.y} increases.`,
    "rises-as-falls": `As ${c.x} decreases, ${c.y} increases.`,
    "falls-as-falls": `As ${c.x} decreases, ${c.y} decreases.`,
    unchanged: `As ${c.x} increases, ${c.y} stays the same.`,
  };
  const reason: Record<string, string> = {
    Negative:
      "The two quantities move in opposite directions, so the change in output and the change in input have opposite signs and their ratio is negative.",
    Positive:
      "The two quantities move in the same direction, so the change in output and the change in input have the same sign and their ratio is positive.",
    Zero: "The output does not change, so the change in output is 0 and the slope is $0$.",
  };
  const feedback: Record<string, string> = {
    Negative: "The quantities do not move in opposite directions here.",
    Positive: "The quantities do not move in the same direction here.",
    Zero: "The output does change as the input changes, so the slope is not 0.",
    Depends:
      "The slope depends only on how the output changes as the input changes, not on the starting value.",
  };
  const labels = [
    "Positive",
    "Negative",
    "Zero",
    "It depends on the starting value",
  ];
  return {
    variant,
    prompt: `${c.y.charAt(0).toUpperCase() + c.y.slice(1)} is a linear function of ${c.x}. ${text[variant]} What is the sign of the slope of this function?`,
    hint: "The slope is the change in the output divided by the change in the input. Decide the sign of each change, then the sign of their quotient: same signs give a positive quotient and different signs give a negative one.",
    explanation: [
      text[variant],
      reason[answer]!,
      `The slope is ${answer.toLowerCase()}.`,
    ],
    choices: labels.map((label, i) =>
      label === answer
        ? { label, correct: true as const }
        : {
            label,
            feedback: feedback[i === 3 ? "Depends" : label]!,
          },
    ),
    model: { answer },
  };
}

function rotationalSymmetry(r: Random): Single {
  const variant = pick(r, ["which-has", "which-lacks"] as const);
  const has: [string, string][] = [
    ["a rectangle that is not a square", "a half turn (180°)"],
    ["a parallelogram with no right angles", "a half turn (180°)"],
    ["a rhombus that is not a square", "a half turn (180°)"],
    ["a regular pentagon", "a turn of 72°"],
    ["an equilateral triangle", "a turn of 120°"],
    ["a regular hexagon", "a turn of 60°"],
    ["a square", "a quarter turn (90°)"],
  ];
  const lacks = [
    "an isosceles trapezoid",
    "a kite that is not a rhombus",
    "a scalene triangle",
    "an isosceles triangle that is not equilateral",
    "a right triangle with unequal legs",
    "a trapezoid with exactly one pair of parallel sides and unequal legs",
  ];
  const withSym = shuffle(r, [...has]);
  const without = shuffle(r, [...lacks]);
  const noSym = (s: string) =>
    `No turn of less than 360° about any center maps ${s} onto itself, so it has no rotational symmetry.`;
  const sym = (s: string, t: string) =>
    `${s.charAt(0).toUpperCase() + s.slice(1)} maps onto itself after ${t} about its center.`;
  if (variant === "which-has") {
    const [name, turn] = withSym[0]!;
    return {
      variant,
      prompt:
        "A figure has rotational symmetry if a turn of less than 360° about some center maps it onto itself. Which figure has rotational symmetry?",
      hint: "Picture the figure turning about its center. If it lands exactly on its own outline before a full turn, it has rotational symmetry. Reflection symmetry alone does not count.",
      explanation: [
        sym(name, turn),
        ...without.slice(0, 3).map((s) => noSym(s)),
      ],
      choices: [
        { label: name.charAt(0).toUpperCase() + name.slice(1), correct: true },
        ...without.slice(0, 3).map((s) => ({
          label: s.charAt(0).toUpperCase() + s.slice(1),
          feedback: `${noSym(s)} It may have a line of symmetry, but that is a reflection, not a rotation.`,
        })),
      ],
      model: { name },
    };
  }
  const [name] = without as [string];
  return {
    variant,
    prompt:
      "A figure has rotational symmetry if a turn of less than 360° about some center maps it onto itself. Which figure does not have rotational symmetry?",
    hint: "Picture each figure turning about its center. A figure that lands on its own outline before a full turn has rotational symmetry. Look for the one that never does.",
    explanation: [
      noSym(name),
      ...withSym.slice(0, 3).map(([s, t]) => sym(s, t)),
    ],
    choices: [
      { label: name.charAt(0).toUpperCase() + name.slice(1), correct: true },
      ...withSym.slice(0, 3).map(([s, t]) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        feedback: `${sym(s, t)} So it does have rotational symmetry.`,
      })),
    ],
    model: { name },
  };
}

function productFactorSize(r: Random): Single {
  const variant = pick(r, ["greater", "less", "equal"] as const);
  const b = r(3, 9);
  let a = r(1, b - 1);
  while (gcd(a, b) !== 1) a = r(1, b - 1);
  const f = fr(a, b);
  const proper: Fr[] = [fr(1, 2), fr(3, 4), fr(2, 3), fr(5, 8), fr(4, 5)];
  const improper: Fr[] = [
    fr(5, 4),
    fr(3, 2),
    fr(9, 8),
    fr(5, 3),
    fr(7, 4),
    fr(2, 1),
  ];
  const k = r(2, 9);
  const one: Fr = [k, k];
  const show = (g: Fr) => (g[0] === g[1] ? `\\frac{${k}}{${k}}` : ftex(g));
  const term = (g: Fr) => {
    const s = r(0, 1) === 0;
    const fx = ftex(f);
    return s ? `${fx}${times}${show(g)}` : `${show(g)}${times}${fx}`;
  };
  const cmp = (g: Fr) => {
    const m = fmul(f, g);
    return m[0] * f[1] - f[0] * m[1];
  };
  const pickMany = (arr: Fr[], n: number) => shuffle(r, [...arr]).slice(0, n);
  let correctG: Fr;
  let wrongs: { g: Fr; why: string }[];
  const fx = ftex(f);
  if (variant === "greater") {
    correctG = pickMany(improper, 1)[0]!;
    wrongs = [
      ...pickMany(proper, 2).map((g) => ({
        g,
        why: `$${ftex(g)}$ is less than 1, so multiplying $${fx}$ by it gives a product less than $${fx}$.`,
      })),
      {
        g: one,
        why: `Multiplying by 1 leaves $${fx}$ unchanged, so the product is equal to it, not greater.`,
      },
    ];
  } else if (variant === "less") {
    correctG = pickMany(proper, 1)[0]!;
    wrongs = [
      ...pickMany(
        improper.filter((g) => g[0] !== g[1] * 2),
        2,
      ).map((g) => ({
        g,
        why: `$${ftex(g)}$ is greater than 1, so multiplying $${fx}$ by it gives a product greater than $${fx}$.`,
      })),
      {
        g: one,
        why: `Multiplying by 1 leaves $${fx}$ unchanged, so the product is equal to it, not less.`,
      },
    ];
  } else {
    correctG = one;
    wrongs = [
      ...pickMany(improper, 1).map((g) => ({
        g,
        why: `$${ftex(g)}$ is greater than 1, so the product is greater than $${fx}$, not equal to it.`,
      })),
      ...pickMany(proper, 2).map((g) => ({
        g,
        why: `$${ftex(g)}$ is less than 1, so the product is less than $${fx}$, not equal to it.`,
      })),
    ];
  }
  const want =
    variant === "greater"
      ? "greater than"
      : variant === "less"
        ? "less than"
        : "equal to";
  const rightLabel = `$${term(correctG)}$`;
  const choices: Choice[] = [
    { label: rightLabel, correct: true },
    ...wrongs.map(({ g, why }) => ({ label: `$${term(g)}$`, feedback: why })),
  ];
  const sign = cmp(correctG);
  if (
    (variant === "greater" && sign <= 0) ||
    (variant === "less" && sign >= 0) ||
    (variant === "equal" && sign !== 0) ||
    wrongs.some(({ g }) =>
      variant === "greater"
        ? cmp(g) > 0
        : variant === "less"
          ? cmp(g) < 0
          : cmp(g) === 0,
    )
  )
    throw new Error("Need three retry: ordering");
  return {
    variant,
    prompt: `Without multiplying, which product is ${want} $${fx}$?`,
    hint: `Compare the other factor with 1 instead of multiplying. Multiplying by a number greater than 1 makes a number larger, multiplying by 1 leaves it the same, and multiplying by a number between 0 and 1 makes it smaller.`,
    explanation: [
      `The product of $${fx}$ and a number is ${want} $${fx}$ when that number is ${variant === "greater" ? "greater than 1" : variant === "less" ? "between 0 and 1" : "equal to 1"}.`,
      `Only ${rightLabel} has a ${variant === "greater" ? "factor greater than 1" : variant === "less" ? "factor less than 1" : "factor equal to 1"}.`,
    ],
    choices,
    model: { f, correctG },
  };
}

/* ---------------------------------------------------------------------- */

const multiBuilders: Record<string, (r: Random) => Built> = {
  "mcas-true-fact-equations": trueFactEquations,
  "mcas-round-hundred-select": roundSelect,
  "mcas-prime-factor-select": primeFactorSelect,
  "mcas-comparison-equations-select": comparisonEquations,
  "mcas-true-product-equations": trueProductEquations,
  "mcas-prism-range-select": prismRangeSelect,
  "mcas-ratio-statements-select": ratioStatements,
  "mcas-true-quotient-equations": trueQuotientEquations,
  "mcas-cube-prism-statements": cubePrismStatements,
  "mcas-statistical-question-select": statisticalQuestions,
  "mcas-fraction-rate-select": fractionRateSelect,
  "mcas-negative-fraction-forms": negativeFractionForms,
  "mcas-markup-price-select": markupSelect,
  "mcas-rational-irrational-select": rationalIrrationalSelect,
  "mcas-sci-notation-select": sciSelect,
  "mcas-table-intercept-select": tableInterceptSelect,
  "mcas-quadratic-zeros-select": quadraticZeros,
  "mcas-congruence-statement-select": congruenceSelect,
  "mcas-circle-equation-select": circleEquationSelect,
  "mcas-cylinder-scaling-select": cylinderScalingSelect,
};
const singleBuilders: Record<string, (r: Random) => Single> = {
  "mcas-circle-radius-distance": circleRadiusDistance,
  "mcas-parenthesized-product-statement": parenthesizedProduct,
  "mcas-slope-sign-description": slopeSignDescription,
  "mcas-rotational-symmetry": rotationalSymmetry,
  "mcas-product-factor-size": productFactorSize,
};
export const mcasGapTemplateIds = [
  ...Object.keys(multiBuilders),
  ...Object.keys(singleBuilders),
];

export type McasGapCase = {
  variant: string;
  model: unknown;
  /** Multi-select candidates in display order, with their computed truth. */
  options?: Option[];
  problem: GeneratedProblem;
};

/** Private model: the variant and truths are for tests; only the public problem is served. */
export function mcasGapCase(templateId: string, seed: string): McasGapCase {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const template = mcasGapTemplates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown template ${templateId}`);
  const r = random(template.id, seed);
  const multiBuild = multiBuilders[templateId];
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if (multiBuild) {
        const built = multiBuild(r);
        const options = drawOptions(r, built);
        if (leaks(built, options)) continue;
        return {
          variant: built.variant,
          model: built.model,
          options,
          problem: assembleSelect(template, seed, built, options),
        };
      }
      const single = singleBuilders[templateId]!(r);
      const correct = single.choices.find((c) => c.correct)!.label;
      const labels = single.choices.map((c) => c.label);
      if (new Set(labels).size !== labels.length) continue;
      // A direct statement of the radius necessarily quotes the answer.
      if (
        single.variant !== "radius" &&
        (single.prompt.includes(correct) || single.hint.includes(correct))
      )
        continue;
      const draft: Draft = {
        prompt: single.prompt,
        hint: single.hint,
        explanation: single.explanation,
        answer: "",
        choices: single.choices,
        ...(single.figure ? { figure: single.figure } : {}),
      };
      return {
        variant: single.variant,
        model: single.model,
        problem: assemble(template, seed, r, draft),
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Need three"))
        continue;
      throw error;
    }
  }
  throw new Error("Could not generate a valid problem");
}

export const generateMcasGapProblem = (templateId: string, seed: string) =>
  mcasGapCase(templateId, seed).problem;
