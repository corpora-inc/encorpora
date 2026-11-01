import { isAre } from "./agreement";
import { isSweepId, sweepChoose, sweepVariant } from "./number-domain-axes";
import type { SemanticFigure, TemplateMetadata } from "./contracts";
import { MAX_STACK, stackHeights } from "./data-display-models.js";
import { table } from "./scene/author";
import {
  assemble,
  random,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice";

/**
 * Round-2 problem types for Texas STAAR released items whose task is not yet
 * practiced. Every template is new and attached to an existing skill; no
 * existing template changes. Money is written in words: "$" opens a math span.
 */
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
const scenes = { requiredFigureCapability: "scenes-v1" } as const;
const charts = { requiredFigureCapability: "data-displays-v1" } as const;
const meta = (
  id: string,
  title: string,
  skillId: string,
  gradeBand: TemplateMetadata["gradeBand"],
  difficultyOffset: number,
  description: string,
  extra: Partial<TemplateMetadata> = {},
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

export const staarGapTemplates: readonly TemplateMetadata[] = [
  meta(
    "staar-nested-grouping",
    "Evaluate nested grouping and verbal products",
    "numerical-expressions",
    "3–5",
    0.4,
    "Evaluate whole-number expressions with brackets around parenthesized groups, or a product or difference written in words with a sum or difference inside it.",
  ),
  meta(
    "staar-signed-exponent-order",
    "Order of operations with negatives and exponents",
    "integer-powers",
    "6–8",
    0.35,
    "Evaluate an integer expression that mixes a negative factor, a parenthesized difference, a squared number, products and sums or differences.",
  ),
  meta(
    "staar-number-word-form",
    "Number words and place-value units",
    "decimal-place-value",
    "3–5",
    0.1,
    "Choose the words for a number written in expanded form, or the number named by counts of hundreds, tens and ones, for whole numbers and decimals to thousandths.",
    choice,
  ),
  meta(
    "staar-rename-percent-fraction-decimal",
    "Rename percents, fractions and decimals",
    "percentages",
    "6–8",
    0.05,
    "Choose the decimal for a percent, the decimal or percent for a fraction greater than 1, or the true equality between a decimal and a mixed number.",
    choice,
  ),
  meta(
    "staar-ratio-statements",
    "Write, simplify and use ratios",
    "ratios",
    "6–8",
    0.1,
    "Write a ratio from two counts in simplest form, use a part-to-part ratio with a total, or choose the unit rate with its units in the right order.",
    choice,
  ),
  meta(
    "staar-story-model-choice",
    "Choose or reject the model for a story",
    "multi-operation-stories",
    "3–5",
    0.2,
    "Choose the multiplication equation with an unknown factor for sharing, the addition equation with an unknown part, or the equation or expression that does not fit the story.",
    choice,
  ),
  meta(
    "staar-rate-equation-choice",
    "Equation for a quantity at a steady rate",
    "dependent-variables",
    "6–8",
    0.2,
    "Find the unit rate from a total over many units, then choose the equation that gives the amount for any number of units.",
    choice,
  ),
  meta(
    "staar-order-decimals",
    "Order decimals with unlike places",
    "compare-decimals",
    "3–5",
    0.2,
    "Choose the list of four decimals in order, or the decimal in a stated position when four decimals with different numbers of places are ordered.",
    choice,
  ),
  meta(
    "staar-order-mixed-forms",
    "Order and compare fractions, decimals, percents and roots",
    "approximate-roots",
    "6–8",
    0.3,
    "Order signed fractions and decimals, order a fraction, percent, decimal and square root, or choose the true comparison among signed values and roots.",
    choice,
  ),
  meta(
    "staar-decimal-operations",
    "Decimal operations in money and measurement stories",
    "decimal-algorithms",
    "3–5",
    0.25,
    "Multiply a whole number by a value in hundredths, divide a decimal total by a whole number, subtract a tenths decimal from a whole number, or subtract a unit fraction from a decimal.",
  ),
  meta(
    "staar-salary-percent",
    "Raises and earnings over years",
    "percentages",
    "6–8",
    0.3,
    "Find a percent raise of a salary of tens of thousands, the new salary, or the difference in earnings of two jobs over several years.",
    scenes,
  ),
  meta(
    "staar-measure-chains",
    "Chain perimeter and area with decimal sides",
    "area-perimeter-models",
    "3–5",
    0.3,
    "Find a rectangle's width from its perimeter and length and then its area, a perimeter with decimal sides, or a square's area from its perimeter.",
  ),
  meta(
    "staar-multistep-stories",
    "Two-step whole-number and unit stories",
    "multistep-whole-stories",
    "3–5",
    0.25,
    "Solve two-step stories: add then subtract, share then regroup, multiply then divide into whole servings, multiply then convert units, or convert from a stated unit row.",
  ),
  meta(
    "staar-line-from-points",
    "Slope and intercept from points and equations",
    "slope",
    "6–8",
    0.35,
    "Choose the slope and $y$-intercept of the line through two points, the equation from a fractional slope and a point, or the rate of change from standard form.",
    choice,
  ),
  meta(
    "staar-stem-leaf-combine",
    "Combine values from a stem-and-leaf plot",
    "distribution-plots",
    "3–5",
    0.1,
    "Read a stem-and-leaf plot with its key and add the two greatest values or subtract the second-lowest from the highest.",
    scenes,
  ),
  meta(
    "staar-dot-plot-threshold",
    "Count the dots below or above a value",
    "line-plots",
    "3–5",
    -0.1,
    "Count every dot on a dot plot that lies below, above or at least a stated value.",
    charts,
  ),
  meta(
    "staar-money-vocabulary",
    "Credit and fixed or variable expenses",
    "money-values",
    "3–5",
    0.1,
    "Recognize an example of credit, or tell which listed expense is variable or fixed, with amounts that show how the expense changes.",
    { ...choice, ...scenes },
  ),
  meta(
    "staar-table-rule-choice",
    "Choose the table that fits a rule",
    "related-patterns",
    "3–5",
    0.2,
    "Choose, from four tables of paired values, the one whose every pair follows a stated add or multiply rule.",
    choice,
  ),
  meta(
    "staar-multistep-equations",
    "Solve equations that need distributing or combining first",
    "linear-equations",
    "6–8",
    0.35,
    "Solve a linear equation with a negative coefficient distributed over a group and variables on both sides, like terms on one side, or fractional coefficients.",
  ),
  meta(
    "staar-experiment-probability",
    "Experimental and repeated-draw probability",
    "probability",
    "6–8",
    0.3,
    "Find the experimental probability of one of two outcomes from a frequency table, or the probability of two draws with replacement.",
    scenes,
  ),
  meta(
    "staar-number-sets",
    "Place a number among whole, integer and rational numbers",
    "signed-numbers",
    "6–8",
    0.1,
    "Choose the number that belongs, or does not belong, in a region of nested sets of whole numbers, integers and rational numbers, or say where a quotient belongs.",
    choice,
  ),
];

type Wrong = { label: string; feedback: string };
/** `selects`: the answer is one of the values the prompt lists, so only the hint is checked for leaks. */
type Built = Draft & {
  variant: string;
  selects?: true;
  /** Private data for independent tests; never served. */
  model?: unknown;
};

function choicesFrom(r: Random, correct: string, wrongs: Wrong[]) {
  const seen = new Set([correct]);
  const pool = wrongs.filter((w) => {
    if (seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (pool.length < 3) throw new Error("Need three distinct wrong choices");
  const chosen: Wrong[] = [];
  while (chosen.length < 3)
    chosen.push(pool.splice(r(0, pool.length - 1), 1)[0]!);
  return [{ label: correct, correct: true as const }, ...chosen];
}
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const sign = (r: Random) => (r(0, 1) ? 1 : -1);
const tex = (s: string) => `$${s}$`;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** Negative numbers in parentheses, others bare. */
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const commas = (n: number) => n.toLocaleString("en-US");
/** Exact decimal text of v / 10^places, trailing zeros trimmed. */
function dec(v: number, places: number): string {
  const sgn = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const whole = Math.floor(abs / 10 ** places);
  const frac = String(abs % 10 ** places)
    .padStart(places, "0")
    .replace(/0+$/, "");
  return `${sgn}${whole}${frac ? `.${frac}` : ""}`;
}
/** Decimal text keeping exactly `places` digits (for money-like values). */
function fixed(v: number, places: number): string {
  const sgn = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const whole = Math.floor(abs / 10 ** places);
  const frac = String(abs % 10 ** places).padStart(places, "0");
  return `${sgn}${whole}.${frac}`;
}
const fracTex = (n: number, d: number) => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  const [a, b] = [n / g, d / g];
  return b === 1 ? `${a}` : `${a < 0 ? "-" : ""}\\frac{${Math.abs(a)}}{${b}}`;
};

/* ---------------------------------------------------------------------- */
/* Order of operations                                                     */
/* ---------------------------------------------------------------------- */

function nestedGrouping(r: Random): Built {
  const variant = pick(r, [
    "bracket",
    "bracket-divide",
    "verbal-sum",
    "verbal-difference",
  ]);
  if (variant === "bracket") {
    const a = r(2, 9);
    const b = r(2, 9);
    const c = r(6, 12);
    const d = r(1, c - 2);
    const product = (a + b) * (c - d);
    const e = r(2, 6);
    const f = r(2, 6);
    if (e * f >= product) throw new Error("Need three retry");
    const inner = `(${a}+${b})\\times(${c}-${d})`;
    return {
      variant,
      prompt: `Evaluate $[${inner}]-${e}\\times${f}$.`,
      answer: String(product - e * f),
      hint: `Work from the inside out. Start with the two parenthesized groups, $${a}+${b}$ and $${c}-${d}$, then use the bracket, then multiplication before subtraction.`,
      explanation: [
        `Inside the bracket, find each group: $${a}+${b}=${a + b}$ and $${c}-${d}=${c - d}$.`,
        `Multiply the groups inside the bracket: $${a + b}\\times${c - d}=${product}$.`,
        `Multiply before subtracting: $${e}\\times${f}=${e * f}$.`,
        `Subtract: $${product}-${e * f}=${product - e * f}$.`,
      ],
    };
  }
  if (variant === "bracket-divide") {
    const e = r(2, 6);
    const a = r(3, 20);
    const b = r(2, 9);
    const c = r(2, 9);
    const q = r(2, 9);
    const d = b * c - e * q;
    if (d < 1) throw new Error("Need three retry");
    return {
      variant,
      prompt: `Evaluate $${a}+[(${b}\\times${c})-${d}]\\div${e}$.`,
      answer: String(a + q),
      hint: `The bracket is one group, so finish it before the division. Inside it, do the parentheses $${b}\\times${c}$ first, then subtract $${d}$.`,
      explanation: [
        `Parentheses first: $${b}\\times${c}=${b * c}$.`,
        `Finish the bracket: $${b * c}-${d}=${b * c - d}$.`,
        `Divide before adding: $${b * c - d}\\div${e}=${q}$.`,
        `Add: $${a}+${q}=${a + q}$.`,
      ],
    };
  }
  const big = r(200, 899);
  const b = r(11, 49);
  const c = variant === "verbal-sum" ? r(2, 9) : r(2, 9);
  const word = variant === "verbal-sum" ? "sum" : "difference";
  const inner = variant === "verbal-sum" ? b + c : b - c;
  return {
    variant,
    prompt: `Find the product of ${big} and the ${word} of ${b} and ${c}.`,
    answer: String(big * inner),
    hint: `The words “the ${word} of ${b} and ${c}” name one group. Find that group's value first, then multiply it by ${big}.`,
    explanation: [
      `The ${word} of ${b} and ${c} is $${b}${variant === "verbal-sum" ? "+" : "-"}${c}=${inner}$.`,
      `The product of ${big} and that ${word} is $${big}\\times${inner}=${big * inner}$.`,
    ],
  };
}

function signedExponentOrder(r: Random): Built {
  const variant = pick(r, [
    "negative-factor",
    "square-product",
    "negative-base",
    "square-difference",
  ]);
  if (variant === "negative-factor") {
    const a = r(2, 9);
    const b = r(1, 6);
    const c = b + r(2, 8);
    const d = r(2, 9);
    const e = r(2, 9);
    const diff = b - c;
    const value = -a * diff + d * e;
    return {
      variant,
      prompt: `Evaluate $-${a}\\times(${b}-${c})+${d}\\times${e}$.`,
      answer: String(value),
      hint: `Do the parentheses first. $${b}-${c}$ is a negative number, so the product $-${a}\\times(${b}-${c})$ multiplies two negatives.`,
      explanation: [
        `Parentheses: $${b}-${c}=${diff}$.`,
        `Multiply: $-${a}\\times${par(diff)}=${-a * diff}$, because two negatives make a positive.`,
        `Multiply the other product: $${d}\\times${e}=${d * e}$.`,
        `Add: $${-a * diff}+${d * e}=${value}$.`,
      ],
    };
  }
  if (variant === "square-product") {
    const a = r(20, 60);
    const b = r(2, 6);
    const c = r(2, 5);
    const d = r(2, 15);
    const value = a - b * c * c + d;
    return {
      variant,
      prompt: `Evaluate $${a}-${b}\\times${c}^{2}+${d}$.`,
      answer: String(value),
      hint: `Exponents come before multiplication. Square $${c}$ first, then multiply by $${b}$, then subtract and add from left to right.`,
      explanation: [
        `Exponent: $${c}^{2}=${c * c}$.`,
        `Multiply: $${b}\\times${c * c}=${b * c * c}$.`,
        `Subtract: $${a}-${b * c * c}=${a - b * c * c}$.`,
        `Add: $${a - b * c * c}+${d}=${value}$.`,
      ],
    };
  }
  if (variant === "negative-base") {
    const c = r(2, 7);
    const d = r(2, 9);
    const e = r(3, 12);
    const value = -(c * c) + d * e;
    return {
      variant,
      prompt: `Evaluate $-${c}^{2}+${d}\\times${e}$.`,
      answer: String(value),
      hint: `In $-${c}^{2}$ the exponent applies only to $${c}$. Square $${c}$ first, then take the opposite.`,
      explanation: [
        `The exponent applies to ${c}, not to the minus sign: $-${c}^{2}=-(${c}\\times${c})=-${c * c}$.`,
        `Multiply: $${d}\\times${e}=${d * e}$.`,
        `Add: $-${c * c}+${d * e}=${value}$.`,
      ],
    };
  }
  const a = r(1, 6);
  const b = a + r(2, 6);
  const c = r(2, 8);
  const d = r(2, 8);
  const sq = (a - b) * (a - b);
  const value = sq - c * d;
  return {
    variant,
    prompt: `Evaluate $(${a}-${b})^{2}-${c}\\times${d}$.`,
    answer: String(value),
    hint: `Start inside the parentheses: $${a}-${b}$ is negative. Square that result, then subtract the product.`,
    explanation: [
      `Parentheses: $${a}-${b}=${a - b}$.`,
      `Exponent: $${par(a - b)}^{2}=${sq}$, because a negative times a negative is positive.`,
      `Multiply: $${c}\\times${d}=${c * d}$.`,
      `Subtract: $${sq}-${c * d}=${value}$.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Number words and place-value units                                      */
/* ---------------------------------------------------------------------- */

const smallWords = [
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
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const tensWords = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
function below100(n: number): string {
  if (n < 20) return smallWords[n]!;
  const u = n % 10;
  return `${tensWords[Math.floor(n / 10)]}${u ? `-${smallWords[u]}` : ""}`;
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${smallWords[h]} hundred` : "", rest ? below100(rest) : ""]
    .filter(Boolean)
    .join(" ");
}
/** Words for 1 to 999,999, with a comma after "thousand" when more follows. */
export function numberWords(n: number): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return [
    thousands ? `${below1000(thousands)} thousand` : "",
    rest ? below1000(rest) : "",
  ]
    .filter(Boolean)
    .join(", ");
}
const an = (noun: string) => `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;
const groupText = (n: number) => commas(n);
const groupTex = (n: number) => commas(n).replace(/,/g, "{,}");

function numberWordForm(r: Random): Built {
  const variant = pick(r, ["whole-words", "decimal-words", "place-units"]);
  if (variant === "whole-words") {
    let digits: number[] = [];
    for (let guard = 0; guard < 200; guard++) {
      digits = Array.from({ length: 6 }, () => r(0, 9));
      digits[0] = r(1, 9);
      const nonzero = digits.filter(Boolean).length;
      if (nonzero >= 3 && nonzero <= 5 && digits.includes(0, 1)) break;
    }
    const value = Number(digits.join(""));
    const places = [100000, 10000, 1000, 100, 10, 1];
    const terms = digits
      .map((d, i) => d * places[i]!)
      .filter(Boolean)
      .map(groupTex);
    const cands: { n: number; feedback: string }[] = [];
    const rebuild = (d: number[]) => (d[0] ? Number(d.join("")) : 0);
    digits.forEach((d, j) => {
      if (!d || j === 0) return;
      if (digits[j - 1] === 0) {
        const c = digits.slice();
        c[j - 1] = d;
        c[j] = 0;
        cands.push({
          n: rebuild(c),
          feedback:
            "A term was read one place too large. A digit's place sets its size: check which place each term uses.",
        });
      }
    });
    digits.forEach((d, j) => {
      if (!d || j === 5) return;
      if (digits[j + 1] === 0) {
        const c = digits.slice();
        c[j + 1] = d;
        c[j] = 0;
        cands.push({
          n: rebuild(c),
          feedback:
            "A term was read one place too small. Match each term to the words for its place.",
        });
      }
    });
    const zeroAt = digits.indexOf(0, 1);
    cands.push({
      n: rebuild(digits.filter((_, i) => i !== zeroAt)),
      feedback:
        "A zero holds a place. Leaving out the place with a zero shrinks the number.",
    });
    for (let i = 0; i < 5; i++) {
      if (digits[i] === digits[i + 1]) continue;
      const c = digits.slice();
      [c[i], c[i + 1]] = [c[i + 1]!, c[i]!];
      cands.push({
        n: rebuild(c),
        feedback:
          "Two digits traded places. Read each term from its own place value, left to right.",
      });
    }
    const wrongs: Wrong[] = cands
      .filter((c) => c.n >= 1 && c.n !== value)
      .map((c) => ({ label: numberWords(c.n), feedback: c.feedback }));
    const correct = numberWords(value);
    return {
      variant,
      prompt: `Which shows the number $${terms.join("+")}$ written in words?`,
      answer: "",
      hint: `Say the size of each term in $${terms.join("+")}$ aloud. The terms are in order from the largest place, so read them left to right and say “thousand” after the part in the thousands.`,
      explanation: [
        `Add the terms to get the number: $${terms.join("+")}=${groupTex(value)}$.`,
        `Say the part before the comma as a number of thousands, then the rest.`,
        `In words: ${correct}.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  }
  if (variant === "decimal-words") {
    const w = r(1, 9);
    const t = r(1, 9);
    const h = pick(r, [0, 0, r(1, 9)]);
    const k = r(1, 9);
    const milli = t * 100 + h * 10 + k;
    const terms = [
      `${w}`,
      `0.${t}`,
      ...(h ? [`0.0${h}`] : []),
      `0.00${k}`,
    ].join("+");
    const correct = `${below100(w)} and ${below1000(milli)} thousandths`;
    const wrongs: Wrong[] = [
      {
        label: `${below100(w)} and ${below1000(milli)} hundredths`,
        feedback:
          "The last digit is in the thousandths place, so the whole decimal part is read in thousandths.",
      },
      {
        label: `${below1000(milli)} thousandths`,
        feedback: "The whole-number part is missing. Say it, then “and”.",
      },
      {
        label: `${below100(w)} and ${below1000(milli)} tenths`,
        feedback:
          "Tenths names only the first decimal place. Three decimal places are read in thousandths.",
      },
      {
        label: `${below100(w)} and ${below1000(Number(`${k}${h}${t}`))} thousandths`,
        feedback:
          "The digits are in the wrong order. The tenths digit is read first.",
      },
      ...(h === 0
        ? [
            {
              label: `${below100(w)} and ${below100(t * 10 + k)} hundredths`,
              feedback:
                "The zero in the hundredths place must be kept, so the decimal part is read in thousandths.",
            },
          ]
        : []),
    ];
    return {
      variant,
      prompt: `Which shows $${terms}$ written in words?`,
      answer: "",
      hint: `Add the terms in $${terms}$ to write the decimal. The last digit sits in the thousandths place, so say the whole part, then “and”, then the decimal part with its place name.`,
      explanation: [
        `Add the terms: $${terms}=${w}.${t}${h}${k}$.`,
        `The whole part is ${below100(w)}. The decimal part $0.${t}${h}${k}$ is ${milli} thousandths, said as ${below1000(milli)} thousandths.`,
        `In words: ${correct}.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  }
  const n = r(11, 99);
  const t = r(1, 9);
  const o = r(1, 9);
  const value = 100 * n + 10 * t + o;
  const label = (v: number) => commas(v);
  const unit = (count: number, one: string, many: string) =>
    count === 1 ? one : many;
  const wrongs: Wrong[] = [
    {
      label: label(10 * n + 10 * t + o),
      feedback: `${n} hundreds is ${n * 100}, not ${n * 10}. A hundred is ten tens.`,
    },
    {
      label: label(1000 * n + 10 * t + o),
      feedback: `${n} hundreds is ${n * 100}, not ${n * 1000}. A thousand is ten hundreds.`,
    },
    {
      label: label(100 * n + t + o),
      feedback: `${t} ${unit(t, "ten", "tens")} is ${t * 10}, not ${t}.`,
    },
    {
      label: label(100 * n + 100 * t + o),
      feedback: `${t} ${unit(t, "ten", "tens")} is ${t * 10}, not ${t * 100}.`,
    },
  ];
  return {
    variant,
    prompt: `Which number is ${n} hundreds, ${t} ${unit(t, "ten", "tens")} and ${o} ${unit(o, "one", "ones")}?`,
    answer: "",
    hint: `Change each count into a value: ${n} hundreds is ${n} groups of 100. Then add the values of the tens and the ones.`,
    explanation: [
      `${n} hundreds is $${n}\\times100=${n * 100}$.`,
      `${t} ${unit(t, "ten", "tens")} is $${t}\\times10=${t * 10}$, and ${o} ${unit(o, "one", "ones")} is ${o}.`,
      `Add: $${n * 100}+${t * 10}+${o}=${groupTex(value)}$.`,
    ],
    choices: choicesFrom(r, label(value), wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* Renaming percents, fractions and decimals; ratio statements             */
/* ---------------------------------------------------------------------- */

/** A two-place decimal written as a fraction in lowest terms. */
function decimalToFraction(r: Random): Built {
  // A hundredths decimal that is not already in lowest terms over 100.
  let h = r(2, 98);
  while (h % 10 === 0 || gcd(h, 100) === 1) h = r(2, 98);
  const g = gcd(h, 100);
  const [n, d] = [h / g, 100 / g];
  const shown = dec(h, 2);
  const frac = (a: number, b: number) => tex(`\\frac{${a}}{${b}}`);
  return {
    variant: "decimal-to-fraction",
    prompt: `Which fraction in lowest terms is equal to ${shown}?`,
    answer: "",
    hint: `${shown} has two decimal places, so it is a count of hundredths. Write it over 100, then divide the numerator and the denominator by a number they share.`,
    explanation: [
      `${shown} is ${h} hundredths: $${shown}=\\frac{${h}}{100}$.`,
      `The greatest common factor of ${h} and 100 is ${g}. Divide both by ${g}: $\\frac{${h}}{100}=\\frac{${n}}{${d}}$.`,
      `Check: $${n}\\times${g}=${h}$ and $${d}\\times${g}=100$.`,
    ],
    choices: choicesFrom(r, frac(n, d), [
      {
        label: frac(h, 100),
        feedback: `That is equal to ${shown}, but it is not in lowest terms: ${h} and 100 share the factor ${g}.`,
      },
      {
        label: frac(h, 10),
        feedback: `Two decimal places make hundredths, so the denominator is 100, not 10.`,
      },
      {
        label: frac(n, 100),
        feedback: `The numerator was divided by ${g} but the denominator was not. Divide both by the same number.`,
      },
      {
        label: frac(h, 1000),
        feedback: `Two decimal places make hundredths, so the denominator is 100, not 1000.`,
      },
      {
        label: frac(d, n),
        feedback: `That has the numerator and the denominator swapped, which is a number greater than 1.`,
      },
    ]),
  };
}

function renameForms(r: Random, axes?: Record<string, string>): Built {
  if (axes?.direction === "decimal-to-fraction") return decimalToFraction(r);
  const variant = pick(r, [
    "percent-to-decimal",
    "fraction-to-decimal",
    "fraction-to-percent",
    "decimal-to-mixed",
  ]);
  if (variant === "percent-to-decimal") {
    // Tenths of a percent, so 4.5% and 120% are both exact.
    const tenths = pick(r, [
      r(1, 9) * 10,
      r(11, 99) * 10,
      r(101, 190) * 10,
      r(1, 19) * 10 + 5,
    ]);
    const shown = dec(tenths, 1);
    const correct = dec(tenths, 3);
    return {
      variant,
      prompt: `Which decimal is equal to ${shown}%?`,
      answer: "",
      hint: `Percent means per hundred, so ${shown}% is ${shown} hundredths. Move the decimal point in ${shown} two places to the left.`,
      explanation: [
        `${shown}% means ${shown} per 100, which is $${shown}\\div100$.`,
        `Dividing by 100 moves the decimal point two places left: ${correct}.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: dec(tenths, 2),
          feedback:
            "That moves the decimal point only one place. Dividing by 100 moves it two places.",
        },
        {
          label: dec(tenths, 4),
          feedback:
            "That moves the decimal point three places. Dividing by 100 moves it two.",
        },
        {
          label: dec(tenths, 1),
          feedback:
            "That keeps the percent number. A percent is a number out of 100, so the decimal is smaller.",
        },
        {
          label: dec(tenths * 10, 3),
          feedback: "That moves the decimal point in the wrong direction.",
        },
      ]),
    };
  }
  if (variant === "decimal-to-mixed") {
    const w = r(1, 9);
    const useHundredths = r(0, 2) > 0;
    const h = useHundredths
      ? pick(r, [r(1, 9), r(1, 9), r(11, 99)]) // zero in the tenths place half the time
      : 0;
    const t = useHundredths ? 0 : r(1, 9);
    if (useHundredths && h % 10 === 0) throw new Error("Need three retry");
    const decimal = useHundredths ? dec(w * 100 + h, 2) : dec(w * 10 + t, 1);
    const num = useHundredths ? h : t;
    const den = useHundredths ? 100 : 10;
    const mix = (n: number, d: number, whole = w) =>
      `${whole}\\frac{${n}}{${d}}`;
    const label = (right: string) => tex(`${decimal}=${right}`);
    const correct = label(mix(num, den));
    return {
      variant,
      prompt: `Which equation is true?`,
      answer: "",
      hint: `Split ${decimal} into its whole part and its decimal part. The last digit of the decimal part is in the ${den === 10 ? "tenths" : "hundredths"} place, so the denominator is ${den}.`,
      explanation: [
        `The whole part of ${decimal} is ${w}.`,
        useHundredths
          ? `The decimal part has two places, so it is hundredths: ${h < 10 ? `0.0${h}` : `0.${h}`} is $\\frac{${h}}{100}$.`
          : `The decimal part has one place, so it is tenths: 0.${t} is $\\frac{${t}}{10}$.`,
        `So ${decimal} equals $${mix(num, den)}$.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: label(mix(num, den === 10 ? 100 : 10)),
          feedback: `Use the denominator for the place of the last digit: ${den === 10 ? "one decimal place is tenths" : "two decimal places are hundredths"}.`,
        },
        {
          label:
            den === 10
              ? label(`\\frac{${w * 10 + num}}{100}`)
              : label(mix(num * 10, 100)),
          feedback:
            den === 10
              ? `That is ${w * 10 + num} hundredths, which is a different value from ${decimal}.`
              : `That is ${num * 10} hundredths, which is a different value from ${decimal}.`,
        },
        {
          label: label(`\\frac{${num}}{${den}}`),
          feedback: "The whole part is missing from the fraction.",
        },
        {
          label: label(mix(num, den * 10)),
          feedback: `That denominator is too large: it would need one more decimal place.`,
        },
      ]),
    };
  }
  // Fractions greater than 1 with a denominator whose decimal ends.
  const d = pick(r, [2, 4, 5, 8, 20, 25]);
  const n = d + r(1, 2 * d);
  if (n % d === 0) throw new Error("Need three retry");
  const thousandths = (n * 1000) / d;
  const asDecimal = variant === "fraction-to-decimal";
  const correct = asDecimal ? dec(thousandths, 3) : `${dec(thousandths, 1)}%`;
  const wrongs: Wrong[] = asDecimal
    ? [
        {
          label: dec(thousandths, 2),
          feedback:
            "That moves the decimal point of the quotient one place too far.",
        },
        {
          label: dec(thousandths, 4),
          feedback: "That moves the decimal point the wrong way.",
        },
        {
          label: `${n}.${d}`,
          feedback:
            "A fraction bar means division. The numerator and denominator are not the digits on each side of a decimal point.",
        },
        {
          label: dec((d * 1000) / n > 0 ? Math.round((d * 1000) / n) : 0, 3),
          feedback:
            "That divides the denominator by the numerator. Divide the numerator by the denominator.",
        },
      ]
    : [
        {
          label: `${dec(thousandths, 2)}%`,
          feedback:
            "A percent is the decimal times 100. That shifts the decimal point one place too few.",
        },
        {
          label: `${dec(thousandths, 0)}%`,
          feedback:
            "That shifts the decimal point one place too many. Multiply the decimal by 100.",
        },
        {
          label: `${n}%`,
          feedback:
            "The numerator alone is not the percent. Divide first, then multiply by 100.",
        },
        {
          label: `${dec(thousandths, 3)}%`,
          feedback:
            "That is the decimal value with a percent sign. Multiply the decimal by 100 to get the percent.",
        },
      ];
  return {
    variant,
    prompt: asDecimal
      ? `Which decimal is equal to $\\frac{${n}}{${d}}$?`
      : `Which percent is equal to $\\frac{${n}}{${d}}$?`,
    answer: "",
    hint: asDecimal
      ? `A fraction bar means division. Divide ${n} by ${d}. The fraction is greater than 1, so the decimal is too.`
      : `A fraction bar means division. Divide ${n} by ${d} to get a decimal, then multiply by 100 to write it as a percent. The fraction is greater than 1, so the percent is greater than 100%.`,
    explanation: asDecimal
      ? [
          `$\\frac{${n}}{${d}}=${n}\\div${d}=${dec(thousandths, 3)}$.`,
          `Check: $${dec(thousandths, 3)}\\times${d}=${n}$.`,
        ]
      : [
          `$\\frac{${n}}{${d}}=${n}\\div${d}=${dec(thousandths, 3)}$.`,
          `Multiply by 100 to write the decimal as a percent: ${dec(thousandths, 3)} is ${dec(thousandths, 1)}%.`,
        ],
    choices: choicesFrom(r, correct, wrongs),
  };
}

const ratioContexts: [string, string, string][] = [
  ["A bag has", "red marbles", "blue marbles"],
  ["A class has", "boys", "girls"],
  ["A shelf has", "fiction books", "nonfiction books"],
  ["A shelter has", "cats", "dogs"],
  ["A team has", "wins", "losses"],
  ["A park has", "oak trees", "maple trees"],
];
const rateContexts: [string, string, string, string][] = [
  [
    "students",
    "classrooms",
    "classroom",
    "A school has {a} students in {b} classrooms.",
  ],
  ["pages", "minutes", "minute", "A reader finishes {a} pages in {b} minutes."],
  ["miles", "hours", "hour", "A truck drives {a} miles in {b} hours."],
  ["laps", "minutes", "minute", "A runner completes {a} laps in {b} minutes."],
  ["bottles", "boxes", "box", "A warehouse packs {a} bottles in {b} boxes."],
];

function ratioStatements(r: Random): Built {
  const variant = pick(r, ["simplest", "part-total", "unit-rate"]);
  if (variant === "simplest") {
    const [p, q] = pick(r, [
      [2, 3],
      [3, 4],
      [3, 5],
      [4, 5],
      [5, 7],
      [2, 5],
      [5, 6],
      [4, 7],
    ]) as [number, number];
    const k = r(2, 7);
    const [lead, nameA, nameB] = pick(r, ratioContexts);
    const swap = r(0, 1) === 1;
    const [first, second] = swap ? [nameB, nameA] : [nameA, nameB];
    const [fa, fb] = swap ? [q * k, p * k] : [p * k, q * k];
    const [sp, sq] = swap ? [q, p] : [p, q];
    const label = (x: number, y: number) => tex(`${x}:${y}`);
    return {
      variant,
      prompt: `${lead} ${fa} ${first} and ${fb} ${second}. What is the ratio of ${first} to ${second} in simplest form?`,
      answer: "",
      hint: `Write the ratio in the order asked, ${fa} to ${fb}. Then divide both numbers by a number that goes into each of them, and keep going until no number above 1 does.`,
      explanation: [
        `The ratio of ${first} to ${second} is $${fa}:${fb}$.`,
        `Both numbers can be divided by ${k}: $${fa}\\div${k}=${sp}$ and $${fb}\\div${k}=${sq}$.`,
        `${sp} and ${sq} have no common factor above 1, so the simplest form is $${sp}:${sq}$.`,
      ],
      choices: choicesFrom(r, label(sp, sq), [
        {
          label: label(sq, sp),
          feedback: `That is the ratio of ${second} to ${first}. Keep the order the question uses.`,
        },
        {
          label: label(fa, fb),
          feedback: `That ratio is correct but not in simplest form; divide both numbers by ${k}.`,
        },
        {
          label: label(sp, sp + sq),
          feedback: `That compares ${first} with all of the ${first} and ${second} together. The question asks for ${first} to ${second}.`,
        },
        {
          label: label(fa - fb > 0 ? fa - fb : fb - fa, k),
          feedback: `Subtracting finds how many more, not the ratio. Divide both numbers by a common factor instead.`,
        },
      ]),
    };
  }
  if (variant === "part-total") {
    const [a, b] = pick(r, [
      [2, 3],
      [3, 5],
      [1, 4],
      [3, 4],
      [2, 5],
      [4, 5],
      [3, 7],
    ]) as [number, number];
    const k = r(3, 9);
    const total = k * (a + b);
    const [x, y] = pick(r, [
      ["blue", "white"],
      ["green", "yellow"],
      ["red", "gray"],
    ]) as [string, string];
    const correct = k * a;
    const label = (n: number) => String(n);
    return {
      variant,
      prompt: `A floor uses ${x} tiles and ${y} tiles in the ratio ${a} to ${b}. There are ${total} tiles in all. How many are ${x}?`,
      answer: "",
      hint: `${a} to ${b} compares the two colors. Add ${a} and ${b} to see how many equal parts are in the whole, then find how many tiles one part is.`,
      explanation: [
        `The whole has $${a}+${b}=${a + b}$ equal parts.`,
        `One part is $${total}\\div${a + b}=${k}$ tiles.`,
        `The ${x} tiles are ${a} parts: $${a}\\times${k}=${correct}$.`,
      ],
      choices: choicesFrom(r, label(correct), [
        {
          label: label(k * b),
          feedback: `That is the number of ${y} tiles. The ${x} tiles are ${a} of the parts.`,
        },
        {
          label: label(total - a),
          feedback: `Subtracting ${a} from the total does not use the ratio. Find the size of one part first.`,
        },
        {
          label: label(k),
          feedback: `That is one part. The ${x} tiles are ${a} parts.`,
        },
        {
          label: label(total + k * a),
          feedback: `The ${x} tiles cannot be more than all the tiles. Divide the total by ${a + b}, not by ${b}.`,
        },
      ]),
    };
  }
  const [unitA, unitB, one, story] = pick(r, rateContexts);
  const rate = r(3, 19);
  const b = r(4, 15);
  const a = rate * b;
  return {
    variant,
    prompt: `${story.replace("{a}", String(a)).replace("{b}", String(b))} Which is the unit rate in ${unitA} per ${one}?`,
    answer: "",
    hint: `“${unitA} per ${one}” puts the ${unitA} on top. Divide the ${a} ${unitA} by the ${b} ${unitB}, so the answer is for one ${one}.`,
    explanation: [
      `“Per ${one}” means for one ${one}, so divide the ${unitA} by the ${unitB}.`,
      `$${a}\\div${b}=${rate}$.`,
      `The unit rate is ${rate} ${unitA} per ${one}.`,
    ],
    choices: choicesFrom(r, `${rate} ${unitA} per ${one}`, [
      {
        label: `${rate} ${unitB} per ${unitA.replace(/s$/, "")}`,
        feedback: `The units are swapped. The question asks for ${unitA} for each ${one}.`,
      },
      {
        label: `${b} ${unitA} per ${one}`,
        feedback: `${b} is the number of ${unitB}. Divide the ${unitA} by it.`,
      },
      {
        label: `${a - b} ${unitA} per ${one}`,
        feedback:
          "A rate compares by division. Subtracting does not give an amount for one unit.",
      },
      {
        label: `${a} ${unitA} per ${one}`,
        feedback: `${a} ${unitA} is the amount for all ${b} ${unitB}, not for one.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Choosing models for stories                                             */
/* ---------------------------------------------------------------------- */

type Eq = { label: string; holds: boolean };
/** Build a choice set from equations with known truth at the story's value. */
function equationChoices(
  r: Random,
  want: boolean,
  eqs: Eq[],
): { label: string; correct?: true; feedback?: string }[] {
  const target = eqs.filter((e) => e.holds === want);
  const others = eqs.filter((e) => e.holds !== want);
  if (!target.length || others.length < 3)
    throw new Error("Need three retry equations");
  const correct = target[r(0, target.length - 1)]!;
  return choicesFrom(
    r,
    correct.label,
    others.map((e) => ({
      label: e.label,
      feedback: want
        ? "Put the story's numbers into this one: the two sides are not equal, so it does not match the story."
        : "This one does match the story. The question asks for the one that can not be used.",
    })),
  );
}

function storyModelChoice(r: Random): Built {
  const variant = pick(r, [
    "share-unknown-factor",
    "unknown-part",
    "not-equation",
    "not-expression",
  ]);
  if (variant === "share-unknown-factor") {
    const g = r(3, 9);
    const n = r(3, 12);
    const total = g * n;
    const [thing, who] = pick(r, [
      ["stickers", "friends"],
      ["pencils", "students"],
      ["cookies", "guests"],
    ]) as [string, string];
    const eq = (l: string, rr: string, holds: boolean): Eq => ({
      label: tex(`${l}=${rr}`),
      holds,
    });
    return {
      variant,
      prompt: `${total} ${thing} are shared equally among ${g} ${who}. Let $n$ be the number of ${thing} each of the ${who} gets. Which equation can be used to find $n$?`,
      answer: "",
      hint: `${g} ${who} each get $n$ ${thing}. Think of ${g} equal groups of $n$, and say what that makes in all.`,
      explanation: [
        `Each of the ${g} ${who} gets $n$ ${thing}, so ${g} groups of $n$ make $${g}\\times n$.`,
        `All ${total} ${thing} were shared out, so $${g}\\times n=${total}$.`,
        `Check: $${g}\\times${n}=${total}$.`,
      ],
      choices: equationChoices(r, true, [
        eq(`${g}\\times n`, `${total}`, g * n === total),
        eq(`${g}+n`, `${total}`, g + n === total),
        eq(`${total}\\times${g}`, `n`, total * g === n),
        eq(`n-${g}`, `${total}`, n - g === total),
        eq(`${g}\\div n`, `${total}`, g / n === total),
      ]),
    };
  }
  if (variant === "unknown-part") {
    const a = r(150, 650);
    const b = r(100, 450);
    const f = r(100, 700);
    const t = a + b + f;
    const m2 = (cents: number) => fixed(cents, 2);
    const [x, y, z] = pick(r, [
      ["a notebook", "a pen", "a folder"],
      ["a juice", "a sandwich", "a salad"],
      ["a cap", "a scarf", "a pair of gloves"],
    ]) as [string, string, string];
    const eq = (l: string, rr: string, holds: boolean): Eq => ({
      label: tex(`${l}=${rr}`),
      holds,
    });
    return {
      variant,
      prompt: `Sam buys ${x} for ${m2(a)} dollars and ${y} for ${m2(b)} dollars. He also buys ${z}. He spends ${m2(t)} dollars in all. Let $f$ be the price of ${z} in dollars. Which equation matches the story?`,
      answer: "",
      hint: `The prices of the three things add up to what Sam spends. Write the two known prices, ${m2(a)} and ${m2(b)}, and $f$ on one side, and the total ${m2(t)} on the other.`,
      explanation: [
        `The three prices are added to get the total: ${m2(a)}, ${m2(b)} and $f$.`,
        `The total is ${m2(t)}, so $${m2(a)}+${m2(b)}+f=${m2(t)}$.`,
        `Check: $f=${m2(f)}$ gives $${m2(a)}+${m2(b)}+${m2(f)}=${m2(t)}$.`,
      ],
      choices: equationChoices(r, true, [
        eq(`${m2(a)}+${m2(b)}+f`, `${m2(t)}`, a + b + f === t),
        eq(`${m2(a)}+${m2(b)}-f`, `${m2(t)}`, a + b - f === t),
        eq(`${m2(a)}\\times${m2(b)}\\times f`, `${m2(t)}`, false),
        eq(`f`, `${m2(t)}+${m2(a)}+${m2(b)}`, f === t + a + b),
        eq(`${m2(a)}+${m2(b)}`, `f+${m2(t)}`, a + b === f + t),
      ]),
    };
  }
  const b = r(3, 9);
  const m = r(3, 12);
  const total = b * m;
  const [thing, holder] = pick(r, [
    ["muffins", "boxes"],
    ["gallons of juice", "jugs"],
    ["books", "shelves"],
  ]) as [string, string];
  if (variant === "not-equation") {
    const eq = (l: string, rr: string, holds: boolean): Eq => ({
      label: tex(`${l}=${rr}`),
      holds,
    });
    return {
      variant,
      prompt: `A store puts ${total} ${thing} into ${b} equal ${holder}. Let $m$ be the number of ${thing} in each. Which equation can NOT be used to find $m$?`,
      answer: "",
      hint: `Say each equation in words and compare it with the story: ${b} equal ${holder} with $m$ in each. Two of them are different ways to write the same division or multiplication.`,
      explanation: [
        `${b} ${holder} with $m$ in each hold $${b}\\times m=${total}$, and the same facts give $${total}\\div${b}=m$ and $${total}\\div m=${b}$.`,
        `The equation that can not be used is the one that does not follow from these.`,
        `With $m=${m}$ every other equation is true.`,
      ],
      choices: equationChoices(r, false, [
        eq(`${b}\\times m`, `${total}`, b * m === total),
        eq(`${total}\\div${b}`, `m`, total / b === m),
        eq(`${total}\\div m`, `${b}`, total / m === b),
        eq(`m\\times${b}`, `${total}`, m * b === total),
        eq(`${b}\\div${total}`, `m`, b / total === m),
        eq(`${total}-${b}`, `m`, total - b === m),
        eq(`${total}\\times${b}`, `m`, total * b === m),
      ]),
    };
  }
  const expr = (l: string, holds: boolean): Eq => ({ label: tex(l), holds });
  return {
    variant,
    prompt: `${total} ${thing} are shared equally into ${b} ${holder}. Which expression can NOT be used to find the number of ${thing} in each?`,
    answer: "",
    hint: `Each of the ${b} ${holder} gets an equal share of ${total}, so the expression must give ${total} split into ${b} parts. Check whether each expression divides ${total} by ${b}.`,
    explanation: [
      `Sharing ${total} equally into ${b} ${holder} is $${total}\\div${b}=${m}$.`,
      `$\\frac{${total}}{${b}}$ and $${total}\\times\\frac{1}{${b}}$ also equal ${m}.`,
      `The expression that does not give ${m} can not be used.`,
    ],
    choices: equationChoices(r, false, [
      expr(`${total}\\div${b}`, true),
      expr(`\\frac{${total}}{${b}}`, true),
      expr(`${total}\\times\\frac{1}{${b}}`, true),
      expr(`${b}\\div${total}`, b / total === m),
      expr(`${total}-${b}`, total - b === m),
      expr(`${b}\\times${total}`, b * total === m),
    ]),
  };
}

const rateEquationContexts: [string, string, string, string, string][] = [
  ["A kennel's dogs eat", "pounds of food", "days", "f", "d"],
  ["A pool leaks", "liters of water", "hours", "w", "h"],
  ["A truck uses", "gallons of fuel", "hours", "g", "h"],
  ["A printer uses", "sheets of paper", "minutes", "s", "m"],
];

function rateEquationChoice(r: Random): Built {
  const [lead, thing, unit, y, x] = pick(r, rateEquationContexts);
  const k = pick(r, [25, 40, 50, 60, 75, 120, 150, 250]); // hundredths per unit
  const periods = pick(r, [100, 120, 125, 130, 150, 200, 250, 300]);
  if ((k * periods) % 100 !== 0) throw new Error("Need three retry rate");
  const total = (k * periods) / 100;
  const rate = dec(k, 2);
  const q = (n: number, d: number) => fracTex(n, d);
  const label = (rhs: string) => tex(`${y}=${rhs}`);
  const correct = label(`${rate}${x}`);
  return {
    variant: "rate-from-total",
    prompt: `${lead} ${total} ${thing} over ${periods} ${unit} at a steady rate. Let $${y}$ be the ${thing} used in $${x}$ ${unit}. Which equation gives $${y}$ in terms of $${x}$?`,
    answer: "",
    hint: `First find the amount for one of the ${unit}: divide ${total} by ${periods}. The equation multiplies that amount by the number of ${unit}, $${x}$.`,
    explanation: [
      `The unit rate is $${total}\\div${periods}=${rate}$ ${thing} per ${unit.replace(/s$/, "")}.`,
      `In $${x}$ ${unit}, the amount is the rate times $${x}$: $${y}=${rate}${x}$.`,
    ],
    choices: choicesFrom(r, correct, [
      {
        label: label(`${q(periods, total)}${x}`),
        feedback: `That uses ${unit} per unit of ${thing}, the flipped rate. Divide the ${thing} by the ${unit}.`,
      },
      {
        label: label(`${total}${x}`),
        feedback: `${total} is the amount for all ${periods} ${unit}, not for one.`,
      },
      {
        label: label(`${periods}${x}`),
        feedback: `${periods} is the number of ${unit}. It is not the amount used in one.`,
      },
      {
        label: label(`${x}+${rate}`),
        feedback: `A steady rate means the amount grows by ${rate} each ${unit.replace(/s$/, "")}, so $${x}$ is multiplied by the rate, not added to it.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Ordering and comparing                                                  */
/* ---------------------------------------------------------------------- */

/** A decimal in thousandths with its number of shown places (1 to 3). */
type Dec = { v: number; places: number };
const swapAt = <T>(list: T[], i: number) => {
  const copy = list.slice();
  [copy[i], copy[i + 1]] = [copy[i + 1]!, copy[i]!];
  return copy;
};
const listLabel = (items: string[]) => tex(items.join(",\\ "));

function randomDecimals(r: Random): Dec[] {
  for (let guard = 0; guard < 400; guard++) {
    const items: Dec[] = [];
    while (items.length < 4) {
      const places = r(1, 3);
      const unit = 10 ** (3 - places);
      const digits = r(1, 10 ** places - 1);
      if (digits % 10 === 0) continue;
      const v = digits * unit;
      if (v >= 1000 || items.some((x) => x.v === v)) continue;
      items.push({ v, places });
    }
    // A longer decimal is less than a shorter one in some pair (the usual trap).
    const trap = items.some((x) =>
      items.some((y) => x.places > y.places && x.v < y.v),
    );
    const mixed = new Set(items.map((x) => x.places)).size >= 2;
    if (trap && mixed) return items;
  }
  throw new Error("No decimal set found");
}

function orderDecimals(r: Random): Built {
  const items = randomDecimals(r);
  const sorted = items.slice().sort((a, b) => a.v - b.v);
  const text = (d: Dec) => dec(d.v, 3);
  if (r(0, 1) === 0) {
    const ascending = r(0, 1) === 1;
    const ordered = ascending ? sorted : sorted.slice().reverse();
    const byDigits = items
      .slice()
      .sort(
        (a, b) => Number(text(a).split(".")[1]) - Number(text(b).split(".")[1]),
      );
    const byDigitsOrdered = ascending ? byDigits : byDigits.slice().reverse();
    const key = (list: Dec[]) => list.map(text).join(",");
    const candidates: { list: Dec[]; feedback: string }[] = [
      {
        list: ordered.slice().reverse(),
        feedback: `This is the opposite order. The question asks for ${ascending ? "least to greatest" : "greatest to least"}.`,
      },
      {
        list: byDigitsOrdered,
        feedback:
          "This compares the digits after the decimal point as whole numbers, so a longer decimal looks larger. Compare place by place from the tenths instead.",
      },
      {
        list: swapAt(ordered, 0),
        feedback:
          "The first two numbers are out of order. Compare their tenths digits.",
      },
      {
        list: swapAt(ordered, 1),
        feedback:
          "The middle two numbers are out of order. Compare place by place.",
      },
      {
        list: swapAt(ordered, 2),
        feedback:
          "The last two numbers are out of order. Compare place by place.",
      },
    ].filter((c) => key(c.list) !== key(ordered));
    return {
      variant: ascending ? "list-ascending" : "list-descending",
      prompt: `Which list shows the numbers ${items.map((d) => text(d)).join(", ")} in order from ${ascending ? "least to greatest" : "greatest to least"}?`,
      answer: "",
      hint: `Write each number with three decimal places, such as ${text(items[0]!)} as ${fixed(items[0]!.v, 3)}. Then compare the tenths digits first, then the hundredths, then the thousandths.`,
      explanation: [
        `With three decimal places: ${items.map((d) => fixed(d.v, 3)).join(", ")}.`,
        `Compare from the left: the tenths digit decides first, and ties go to the hundredths.`,
        `${ascending ? "Least to greatest" : "Greatest to least"}: ${ordered.map((d) => fixed(d.v, 3)).join(", ")}, which is ${ordered.map(text).join(", ")}.`,
      ],
      choices: choicesFrom(
        r,
        listLabel(ordered.map(text)),
        candidates.map((c) => ({
          label: listLabel(c.list.map(text)),
          feedback: c.feedback,
        })),
      ),
    };
  }
  const position = r(1, 2) === 1 ? 2 : 3; // second or third from least
  const word = ["", "first", "second", "third", "fourth"][position]!;
  const target = sorted[position - 1]!;
  const unit = pick(r, ["kilograms", "liters", "meters", "miles"]);
  return {
    variant: "kth",
    selects: true,
    prompt: `Four measurements are ${items.map((d) => `${text(d)}`).join(", ")} ${unit}. When they are ordered from least to greatest, which is ${word}?`,
    answer: "",
    hint: `Write each measurement with three decimal places, such as ${text(items[0]!)} as ${fixed(items[0]!.v, 3)}, then compare tenths first. Put them in order from least to greatest and count to the ${word}.`,
    explanation: [
      `With three decimal places: ${items.map((d) => fixed(d.v, 3)).join(", ")}.`,
      `Least to greatest: ${sorted.map((d) => fixed(d.v, 3)).join(", ")}.`,
      `The ${word} is ${text(target)}.`,
    ],
    choices: [
      { label: text(target), correct: true as const },
      ...items
        .filter((d) => d !== target)
        .map((d) => {
          const place = sorted.indexOf(d) + 1;
          return {
            label: text(d),
            feedback: `This is number ${place} from least, not ${position}. Compare the tenths first, then the next places.`,
          };
        }),
    ],
  };
}

type Num = { tex: string; v: number; abs: number };
const numFraction = (n: number, d: number): Num => ({
  tex: fracTex(n, d),
  v: n / d,
  abs: Math.abs(n / d),
});
function signedValue(r: Random): Num {
  const neg = r(0, 1) === 1;
  const kind = r(0, 2);
  let n: Num;
  if (kind === 0) {
    const d = pick(r, [2, 4, 5, 8, 10]);
    const top = r(1, 2 * d);
    n = numFraction(top, d);
  } else {
    const places = r(1, 2);
    const digits = r(1, places === 1 ? 24 : 249);
    if (digits % 10 === 0) return signedValue(r);
    n = {
      tex: dec(digits, places),
      v: digits / 10 ** places,
      abs: digits / 10 ** places,
    };
  }
  if (n.v === 0) return signedValue(r);
  if (neg)
    n = {
      tex: n.tex.startsWith("-") ? n.tex : `-${n.tex}`,
      v: -n.v,
      abs: n.abs,
    };
  return n;
}
const apart = (xs: Num[], gap: number) =>
  xs.every((a, i) => xs.every((b, j) => i === j || Math.abs(a.v - b.v) >= gap));

function orderMixedForms(r: Random): Built {
  const variant = pick(r, ["signed-list", "four-forms", "true-comparison"]);
  if (variant === "signed-list") {
    let items: Num[] = [];
    for (let guard = 0; guard < 500; guard++) {
      items = Array.from({ length: 5 }, () => signedValue(r));
      const negatives = items.filter((x) => x.v < 0).length;
      if (negatives >= 2 && negatives <= 4 && apart(items, 0.04)) break;
      items = [];
    }
    if (!items.length) throw new Error("No signed list found");
    const sorted = items.slice().sort((a, b) => a.v - b.v);
    const key = (xs: Num[]) => xs.map((x) => x.tex).join(",");
    const byAbs = items.slice().sort((a, b) => a.abs - b.abs);
    const negFirstByAbs = [
      ...items.filter((x) => x.v < 0).sort((a, b) => a.abs - b.abs),
      ...items.filter((x) => x.v > 0).sort((a, b) => a.v - b.v),
    ];
    const candidates: { list: Num[]; feedback: string }[] = [
      {
        list: sorted.slice().reverse(),
        feedback:
          "This is the opposite order. The question asks for least to greatest.",
      },
      {
        list: byAbs,
        feedback:
          "This orders the distances from 0 and ignores signs. A negative number is less than every positive number.",
      },
      {
        list: negFirstByAbs,
        feedback:
          "Among negative numbers, the one farther from 0 is the lesser.",
      },
      {
        list: swapAt(sorted, 1),
        feedback:
          "Two neighbors are out of order. Compare their values using the number line.",
      },
      {
        list: swapAt(sorted, 2),
        feedback:
          "Two neighbors are out of order. Compare their values using the number line.",
      },
    ].filter((c) => key(c.list) !== key(sorted));
    const asDec = (x: Num) =>
      Number.isInteger(x.v * 1000)
        ? dec(Math.round(x.v * 1000), 3)
        : String(x.v);
    return {
      variant,
      prompt: `Which list shows the numbers ${items.map((x) => tex(x.tex)).join(", ")} in order from least to greatest?`,
      answer: "",
      hint: `Write every number as a decimal, such as ${tex((items.find((x) => x.tex.includes("frac")) ?? items[0]!).tex)} as ${asDec(items.find((x) => x.tex.includes("frac")) ?? items[0]!)}. Negative numbers are less than positive numbers, and the negative number farther from 0 is the least.`,
      explanation: [
        `As decimals: ${items.map((x) => `${asDec(x)}`).join(", ")}.`,
        `On a number line the least number is farthest to the left. Order: ${sorted.map(asDec).join(", ")}.`,
        `In the original forms: ${sorted.map((x) => tex(x.tex)).join(", ")}.`,
      ],
      choices: choicesFrom(
        r,
        listLabel(sorted.map((x) => x.tex)),
        candidates.map((c) => ({
          label: listLabel(c.list.map((x) => x.tex)),
          feedback: c.feedback,
        })),
      ),
    };
  }
  if (variant === "four-forms") {
    const radicands = [2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
    let items: (Num & { kind: string; raw: number })[] = [];
    for (let guard = 0; guard < 500; guard++) {
      const k = pick(r, radicands);
      const root = {
        tex: `\\sqrt{${k}}`,
        v: Math.sqrt(k),
        abs: Math.sqrt(k),
        kind: "root",
        raw: k,
      };
      const d = pick(r, [2, 4, 5, 8]);
      const f = numFraction(d + r(1, 3 * d), d);
      const pct = r(110, 380);
      const percent = {
        tex: `${pct}\\%`,
        v: pct / 100,
        abs: pct / 100,
        kind: "percent",
        raw: pct,
      };
      const dd = r(11, 39);
      const decimal = {
        tex: dec(dd * 10 + r(0, 9), 2),
        v: 0,
        abs: 0,
        kind: "decimal",
        raw: 0,
      };
      decimal.v = Number(decimal.tex);
      decimal.abs = decimal.v;
      decimal.raw = decimal.v;
      const fraction = { ...f, kind: "fraction", raw: f.v };
      items = [root, percent, decimal, fraction];
      if (apart(items, 0.06) && decimal.v > 1) break;
      items = [];
    }
    if (!items.length) throw new Error("No four-form set found");
    const sorted = items.slice().sort((a, b) => a.v - b.v);
    const key = (xs: Num[]) => xs.map((x) => x.tex).join(",");
    const byRaw = (field: "percent" | "root") =>
      items
        .slice()
        .sort(
          (a, b) =>
            (a.kind === field ? a.raw : a.v) - (b.kind === field ? b.raw : b.v),
        );
    const candidates: { list: Num[]; feedback: string }[] = [
      {
        list: sorted.slice().reverse(),
        feedback:
          "This is the opposite order. The question asks for least to greatest.",
      },
      {
        list: byRaw("percent"),
        feedback:
          "This compares the percent number as if it were a decimal. Rewrite the percent as a decimal first: 250% is 2.5.",
      },
      {
        list: byRaw("root"),
        feedback:
          "This compares the number under the square root. The square root is much smaller than that number.",
      },
      {
        list: swapAt(sorted, 0),
        feedback:
          "The two least numbers are out of order. Write each as a decimal and compare.",
      },
      {
        list: swapAt(sorted, 2),
        feedback:
          "The two greatest numbers are out of order. Write each as a decimal and compare.",
      },
    ].filter((c) => key(c.list) !== key(sorted));
    const approx = (x: Num) =>
      (Math.round(x.v * 100) / 100)
        .toFixed(2)
        .replace(/0$/, "")
        .replace(/\.$/, "");
    return {
      variant,
      prompt: `Which list shows the numbers ${items.map((x) => tex(x.tex)).join(", ")} in order from least to greatest?`,
      answer: "",
      hint: `Write each number as a decimal. A fraction is the numerator divided by the denominator, a percent is divided by 100, and a square root can be estimated between the two whole numbers whose squares are around it, such as ${tex(items[0]!.tex)} near ${approx(items[0]!)}.`,
      explanation: [
        `As decimals (to the nearest hundredth): ${items.map((x) => `${tex(x.tex)} ≈ ${approx(x)}`).join("; ")}.`,
        `Order them from least to greatest: ${sorted.map((x) => approx(x)).join(", ")}.`,
        `In the original forms: ${sorted.map((x) => tex(x.tex)).join(", ")}.`,
      ],
      choices: choicesFrom(
        r,
        listLabel(sorted.map((x) => x.tex)),
        candidates.map((c) => ({
          label: listLabel(c.list.map((x) => x.tex)),
          feedback: c.feedback,
        })),
      ),
    };
  }
  // True comparison among signed decimals, fractions and roots.
  const makeValue = (): Num => {
    const kind = r(0, 2);
    if (kind === 0) {
      const k = pick(r, [2, 3, 5, 6, 7, 10, 11]);
      const sgn = r(0, 3) === 0 ? -1 : 1;
      return {
        tex: `${sgn < 0 ? "-" : ""}\\sqrt{${k}}`,
        v: sgn * Math.sqrt(k),
        abs: Math.sqrt(k),
      };
    }
    return signedValue(r);
  };
  for (let guard = 0; guard < 500; guard++) {
    const pairs = Array.from(
      { length: 4 },
      () => [makeValue(), makeValue()] as [Num, Num],
    );
    if (pairs.some(([a, b]) => Math.abs(a.v - b.v) < 0.05 || a.tex === b.tex))
      continue;
    const truthIndex = r(0, 3);
    const statements = pairs.map(([a, b], i) => {
      const less = a.v < b.v;
      const wantTrue = i === truthIndex;
      const symbol = (less === wantTrue ? "<" : ">") as "<" | ">";
      return { a, b, symbol, wantTrue, text: tex(`${a.tex}${symbol}${b.tex}`) };
    });
    if (new Set(statements.map((s) => s.text)).size < 4) continue;
    const approx = (x: Num) =>
      (Math.round(x.v * 100) / 100)
        .toFixed(2)
        .replace(/0$/, "")
        .replace(/\.$/, "");
    const right = statements[truthIndex]!;
    return {
      variant,
      prompt: `Which comparison is true?`,
      answer: "",
      hint: `Write both numbers of each comparison as decimals. A square root such as ${tex(`\\sqrt{7}`)} is between two whole numbers (here 2 and 3), and a negative number is less than a positive number.`,
      explanation: [
        `Compare each pair as decimals: ${statements.map((s) => `${tex(s.a.tex)} ≈ ${approx(s.a)} and ${tex(s.b.tex)} ≈ ${approx(s.b)}`).join("; ")}.`,
        `The true comparison is ${right.text}, because ${approx(right.a)} is ${right.symbol === "<" ? "less than" : "greater than"} ${approx(right.b)}.`,
      ],
      choices: statements.map((s) => ({
        label: s.text,
        ...(s.wantTrue
          ? { correct: true as const }
          : {
              feedback: `${tex(s.a.tex)} is about ${approx(s.a)} and ${tex(s.b.tex)} is about ${approx(s.b)}, so ${approx(s.a)} ${s.symbol} ${approx(s.b)} is false.`,
            }),
      })),
    };
  }
  throw new Error("No comparison set found");
}

/* ---------------------------------------------------------------------- */
/* Decimal and percent arithmetic in stories                               */
/* ---------------------------------------------------------------------- */

function decimalOperations(r: Random): Built {
  const variant = pick(r, [
    "whole-times-hundredths",
    "total-divided-by-whole",
    "whole-minus-tenths",
    "decimal-minus-unit-fraction",
  ]);
  if (variant === "whole-times-hundredths") {
    const n = r(24, 98);
    const h = pick(r, [r(11, 99), r(11, 99), r(2, 9)]);
    if (h % 10 === 0) throw new Error("Need three retry");
    const total = n * h;
    return {
      variant,
      prompt: `A collector has ${n} tokens. Each token is worth ${dec(h, 2)} dollars. What is the total value of the tokens, in dollars?`,
      answer: dec(total, 2),
      hint: `${dec(h, 2)} is ${h} hundredths. Multiply ${n} by ${h} as whole numbers, then place the decimal point so the answer has two decimal places.`,
      explanation: [
        `Multiply as whole numbers: $${n}\\times${h}=${total}$.`,
        `${dec(h, 2)} has two decimal places, so the answer has two: ${fixed(total, 2)}.`,
        `The tokens are worth ${dec(total, 2)} dollars.`,
      ],
    };
  }
  if (variant === "total-divided-by-whole") {
    const weeks = r(6, 12);
    const q = r(120, 990);
    const total = q * weeks;
    return {
      variant,
      prompt: `Mei saved ${dec(total, 2)} dollars over ${weeks} weeks. She saved the same amount each week. How many dollars did she save each week?`,
      answer: dec(q, 2),
      hint: `Equal amounts each week means dividing the total by the number of weeks. Divide ${dec(total, 2)} by ${weeks}, keeping the decimal point straight up in the quotient.`,
      explanation: [
        `Divide the total by the number of weeks: $${dec(total, 2)}\\div${weeks}$.`,
        `Place the decimal point in the quotient directly above the point in ${dec(total, 2)}.`,
        `The quotient is ${dec(q, 2)}. Check: $${weeks}\\times${dec(q, 2)}=${dec(total, 2)}$.`,
      ],
    };
  }
  if (variant === "whole-minus-tenths") {
    const w = r(5, 12);
    const used = r(11, w * 10 - 30); // tenths
    const other = r(11, w * 10 - used - 1);
    const left = w * 10 - used;
    const answer = left - other;
    if (answer < 1) throw new Error("Need three retry");
    const [a, b] = pick(r, [
      ["Tan", "Ava"],
      ["Lia", "Omar"],
      ["Nora", "Eli"],
    ]) as [string, string];
    return {
      variant,
      prompt: `${a} had ${w} kilograms of sugar and used ${dec(used, 1)} kilograms for baking. ${b} has ${dec(other, 1)} kilograms of sugar. How many more kilograms of sugar does ${a} have now than ${b}?`,
      answer: dec(answer, 1),
      hint: `First find how much sugar ${a} has left: subtract ${dec(used, 1)} from ${w}. Write ${w} as ${w}.0 so the decimal points line up.`,
      explanation: [
        `${a} has $${w}.0-${dec(used, 1)}=${dec(left, 1)}$ kilograms left.`,
        `Compare with ${b}: $${dec(left, 1)}-${dec(other, 1)}=${dec(answer, 1)}$.`,
        `${a} has ${dec(answer, 1)} kilograms more.`,
      ],
    };
  }
  const q = pick(r, [2, 4, 5, 8, 10]);
  const places = r(1, 2);
  const digits = r(2, places === 1 ? 39 : 399);
  if (digits % 10 === 0) throw new Error("Need three retry");
  const thousandths = digits * 10 ** (3 - places);
  const result = thousandths - 1000 / q;
  return {
    variant,
    prompt: `Find $${dec(digits, places)}-\\frac{1}{${q}}$. Write the answer as a decimal.`,
    answer: dec(result, 3),
    hint: `Write $\\frac{1}{${q}}$ as a decimal by dividing 1 by ${q}. Then subtract the two decimals, lining up the decimal points. The result can be negative.`,
    explanation: [
      `$\\frac{1}{${q}}=1\\div${q}=${dec(1000 / q, 3)}$.`,
      `Subtract: $${dec(digits, places)}-${dec(1000 / q, 3)}=${dec(result, 3)}$.`,
    ],
  };
}

function salaryPercent(r: Random): Built {
  const variant = pick(r, ["raise", "new-salary", "years-difference"]);
  if (variant === "years-difference") {
    const a = r(60, 120) * 500;
    const b = a - r(8, 30) * 500;
    const years = r(3, 8);
    const [x, y] = pick(r, [
      ["nurse", "teacher"],
      ["electrician", "bookkeeper"],
      ["pilot", "chef"],
    ]) as [string, string];
    const figure: SemanticFigure = {
      kind: "scene",
      scene: table({
        id: "salaries",
        corner: "Career",
        columns: ["Dollars a year"],
        rows: [
          { label: x, cells: [groupText(a)] },
          { label: y, cells: [groupText(b)] },
        ],
      }).scene(),
    };
    return {
      variant,
      prompt: `The table shows the yearly salaries of two careers. How many more dollars does ${an(x)} earn than ${an(y)} in ${years} years?`,
      figure,
      answer: String((a - b) * years),
      hint: `Find how much more ${an(x)} earns in one year, then use that difference for all ${years} years. You could also find each ${years}-year total first.`,
      explanation: [
        `In one year the difference is $${groupTex(a)}-${groupTex(b)}=${groupTex(a - b)}$ dollars.`,
        `In ${years} years: $${groupTex(a - b)}\\times${years}=${groupTex((a - b) * years)}$ dollars.`,
      ],
    };
  }
  const salary = r(40, 110) * 500;
  const p = r(2, 8);
  const raise = (salary * p) / 100;
  if (variant === "raise")
    return {
      variant,
      prompt: `A worker earns ${commas(salary)} dollars a year and gets a ${p} percent raise. How many dollars is the raise each year?`,
      answer: String(raise),
      hint: `${p} percent means ${p} per 100. Write it as ${dec(p, 2)} and multiply by ${commas(salary)}, or find 1 percent first and take ${p} of it.`,
      explanation: [
        `1 percent of ${commas(salary)} is $${groupTex(salary)}\\div100=${groupTex(salary / 100)}$.`,
        `${p} percent is $${p}\\times${groupTex(salary / 100)}=${groupTex(raise)}$.`,
        `The raise is ${commas(raise)} dollars a year.`,
      ],
    };
  return {
    variant,
    prompt: `A worker earns ${commas(salary)} dollars a year and gets a ${p} percent raise. How many dollars a year does the worker earn after the raise?`,
    answer: String(salary + raise),
    hint: `Find the raise first: ${p} percent of ${commas(salary)}. The new salary is the old salary plus the raise.`,
    explanation: [
      `1 percent of ${commas(salary)} is ${commas(salary / 100)}, so ${p} percent is $${p}\\times${groupTex(salary / 100)}=${groupTex(raise)}$.`,
      `Add the raise: $${groupTex(salary)}+${groupTex(raise)}=${groupTex(salary + raise)}$.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Measurement chains and multi-step stories                               */
/* ---------------------------------------------------------------------- */

function measureChains(r: Random): Built {
  const variant = pick(r, [
    "perimeter-to-area",
    "decimal-perimeter",
    "square-area",
  ]);
  if (variant === "perimeter-to-area") {
    const length = r(6, 20);
    const width = r(3, Math.min(15, length - 1));
    const perimeter = 2 * (length + width);
    const unit = pick(r, ["centimeters", "meters", "feet", "inches"]);
    return {
      variant,
      prompt: `A rectangle has a perimeter of ${perimeter} ${unit} and a length of ${length} ${unit}. What is its area in square ${unit}?`,
      answer: String(length * width),
      hint: `The perimeter is two lengths plus two widths. Subtract the two lengths of ${length} from ${perimeter} to find the two widths together, then split that between them. Area needs the width.`,
      explanation: [
        `Two lengths are $2\\times${length}=${2 * length}$. The two widths make $${perimeter}-${2 * length}=${perimeter - 2 * length}$.`,
        `One width is $${perimeter - 2 * length}\\div2=${width}$ ${unit}.`,
        `Area is length times width: $${length}\\times${width}=${length * width}$ square ${unit}.`,
      ],
    };
  }
  if (variant === "decimal-perimeter") {
    const length = pick(r, [r(21, 99) * 5, r(150, 899)]);
    const width = r(12, length - 5);
    const unit = pick(r, ["feet", "meters"]);
    const total = 2 * (length + width);
    const sign = pick(r, ["sign", "banner", "mat"]);
    return {
      variant,
      prompt: `A rectangular ${sign} is ${dec(length, 2)} ${unit} long and ${dec(width, 2)} ${unit} wide. What is its perimeter in ${unit}?`,
      answer: dec(total, 2),
      hint: `The perimeter is the distance around: two lengths and two widths. Add the length ${dec(length, 2)} and the width ${dec(width, 2)}, keeping the decimal points lined up, and then double the sum.`,
      explanation: [
        `Length plus width: $${dec(length, 2)}+${dec(width, 2)}=${dec(length + width, 2)}$.`,
        `Double it for both pairs of sides: $2\\times${dec(length + width, 2)}=${dec(total, 2)}$.`,
        `The perimeter is ${dec(total, 2)} ${unit}.`,
      ],
    };
  }
  const k = r(8, 28); // side is k / 2, so the perimeter 2k is a whole number
  const unit = pick(r, ["inches", "feet", "meters"]);
  const area = k * k * 25;
  return {
    variant,
    prompt: `A square has a perimeter of ${2 * k} ${unit}. What is its area in square ${unit}?`,
    answer: dec(area, 2),
    hint: `A square has four equal sides. Divide the perimeter ${2 * k} by 4 to find one side, then multiply the side by itself.`,
    explanation: [
      `One side is $${2 * k}\\div4=${dec(k * 5, 1)}$ ${unit}.`,
      `Area is side times side: $${dec(k * 5, 1)}\\times${dec(k * 5, 1)}=${dec(area, 2)}$ square ${unit}.`,
    ],
  };
}

const conversionRows: [string, string, number, string][] = [
  ["miles", "feet", 5280, "mile"],
  ["yards", "feet", 3, "yard"],
  ["pounds", "ounces", 16, "pound"],
  ["gallons", "quarts", 4, "gallon"],
  ["hours", "minutes", 60, "hour"],
  ["feet", "inches", 12, "foot"],
];

function multistepStories(r: Random): Built {
  const variant = pick(r, [
    "add-then-subtract",
    "share-then-regroup",
    "product-then-servings",
    "liters-to-milliliters",
    "conversion-row",
  ]);
  if (variant === "add-then-subtract") {
    const fall = r(200, 499);
    const winter = r(200, 499);
    const spring = r(300, fall + winter - 10);
    const answer = fall + winter - spring;
    return {
      variant,
      prompt: `A school sold ${fall} tickets to the fall play and ${winter} tickets to the winter play. It sold ${spring} tickets to the spring play. How many more tickets did the school sell for the fall and winter plays together than for the spring play?`,
      answer: String(answer),
      hint: `The comparison is between two totals. First add the tickets for the fall and winter plays, then compare that total with the ${spring} for spring.`,
      explanation: [
        `Fall and winter together: $${fall}+${winter}=${fall + winter}$.`,
        `Compare with spring: $${fall + winter}-${spring}=${answer}$.`,
        `The school sold ${answer} more tickets for the fall and winter plays.`,
      ],
    };
  }
  if (variant === "share-then-regroup") {
    const friends = r(3, 9);
    const pile = r(2, 6);
    const piles = r(2, 9);
    const total = friends * pile * piles;
    return {
      variant,
      prompt: `${total} stickers are shared equally among ${friends} friends. Each friend then puts their stickers into piles of ${pile}. How many piles does one friend make?`,
      answer: String(piles),
      hint: `First find how many stickers one friend gets: share ${total} equally among ${friends}. Then divide that one share into piles of ${pile}.`,
      explanation: [
        `Each friend gets $${total}\\div${friends}=${pile * piles}$ stickers.`,
        `Piles of ${pile}: $${pile * piles}\\div${pile}=${piles}$.`,
        `One friend makes ${piles} piles.`,
      ],
    };
  }
  if (variant === "product-then-servings") {
    const pizzas = r(10, 30);
    const slices = r(6, 12);
    const serving = pick(r, [3, 4, 5, 7]);
    const total = pizzas * slices;
    if (total % serving === 0) throw new Error("Need three retry");
    const servings = Math.floor(total / serving);
    return {
      variant,
      prompt: `A cafeteria bakes ${pizzas} pizzas with ${slices} slices each. A serving is ${serving} slices. How many full servings can the cafeteria make?`,
      answer: String(servings),
      hint: `First find how many slices there are in all. Then find how many groups of ${serving} slices can be made; leftover slices are not a full serving.`,
      explanation: [
        `All the slices: $${pizzas}\\times${slices}=${total}$.`,
        `Groups of ${serving}: $${total}\\div${serving}=${servings}$ with ${total - servings * serving} slices left over.`,
        `Only full servings count, so the cafeteria makes ${servings}.`,
      ],
    };
  }
  if (variant === "liters-to-milliliters") {
    const perGlass = pick(r, [25, 35, 45, 15, 65]); // hundredths of a liter
    const glasses = r(8, 24);
    const ml = perGlass * 10 * glasses;
    return {
      variant,
      prompt: `Each glass holds ${dec(perGlass, 2)} liter of juice. A server fills ${glasses} glasses. How many milliliters of juice does the server pour? Use 1 liter = 1,000 milliliters.`,
      answer: String(ml),
      hint: `First find how many liters are in ${glasses} glasses: multiply ${dec(perGlass, 2)} by ${glasses}. Then use the reference, 1 liter = 1,000 milliliters, to change liters to milliliters.`,
      explanation: [
        `Liters poured: $${dec(perGlass, 2)}\\times${glasses}=${dec(perGlass * glasses, 2)}$ liters.`,
        `Milliliters: $${dec(perGlass * glasses, 2)}\\times1000=${groupTex(ml)}$.`,
        `The server pours ${commas(ml)} milliliters.`,
      ],
    };
  }
  const [bigUnit, smallUnit, factor, oneUnit] = pick(r, conversionRows);
  const known = r(2, 6);
  const ask = pick(r, [r(7, 12), r(13, 20)]);
  return {
    variant,
    prompt: `A conversion table shows that ${known} ${bigUnit} = ${commas(known * factor)} ${smallUnit}. How many ${smallUnit} are in ${ask} ${bigUnit}?`,
    answer: String(ask * factor),
    hint: `Use the table row to find how many ${smallUnit} are in 1 ${oneUnit}: divide ${commas(known * factor)} by ${known}. Then multiply by ${ask}.`,
    explanation: [
      `One ${oneUnit} is $${groupTex(known * factor)}\\div${known}=${groupTex(factor)}$ ${smallUnit}.`,
      `${ask} ${bigUnit} is $${ask}\\times${groupTex(factor)}=${groupTex(ask * factor)}$ ${smallUnit}.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Lines                                                                   */
/* ---------------------------------------------------------------------- */

/** Text of y = (p/q)x + b with a signed integer p, positive q and b. */
function lineTex(p: number, q: number, b: number): string {
  const slope =
    q === 1
      ? `${Math.abs(p) === 1 ? "" : Math.abs(p)}`
      : `\\frac{${Math.abs(p)}}{${q}}`;
  return `y=${p < 0 ? "-" : ""}${slope}x${b < 0 ? "-" : "+"}${Math.abs(b)}`;
}

function lineFromPoints(r: Random): Built {
  const variant = pick(r, ["two-points", "slope-and-point", "standard-form"]);
  if (variant === "two-points") {
    const m = pick(r, [-4, -3, -2, 2, 3, 4]);
    const b = pick(r, [-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]);
    const x1 = r(1, 3);
    const x2 = x1 + r(1, 3);
    const [y1, y2] = [m * x1 + b, m * x2 + b];
    const label = (mm: string, bb: number) => tex(`m=${mm},\\ b=${bb}`);
    return {
      variant,
      prompt: `A line passes through the points $(${x1}, ${y1})$ and $(${x2}, ${y2})$. Which gives its slope $m$ and its $y$-intercept $b$?`,
      answer: "",
      hint: `Slope is the change in $y$ divided by the change in $x$, from $(${x1}, ${y1})$ to $(${x2}, ${y2})$. Then put one point into $y=mx+b$ and solve for $b$.`,
      explanation: [
        `Slope: $m=\\frac{${y2}-${par(y1)}}{${x2}-${x1}}=\\frac{${y2 - y1}}{${x2 - x1}}=${m}$.`,
        `Use $(${x1}, ${y1})$ in $y=mx+b$: $${y1}=${m}\\times${x1}+b$, so $b=${y1}-${par(m * x1)}=${b}$.`,
        `The slope is ${m} and the $y$-intercept is ${b}.`,
      ],
      choices: choicesFrom(r, label(String(m), b), [
        {
          label: label(String(-m), b),
          feedback:
            "The sign of the slope is reversed. Subtract the $y$-values and the $x$-values in the same order.",
        },
        {
          label: label(String(m), -b),
          feedback:
            "The sign of the intercept is reversed. Solve $y=mx+b$ for $b$ by subtracting $mx$ from $y$.",
        },
        {
          label: label(fracTex(1, m), b),
          feedback:
            "That is run over rise. Slope is rise over run, the change in $y$ over the change in $x$.",
        },
        {
          label: label(String(m), y1),
          feedback: `The $y$-value ${y1} belongs to $x=${x1}$. The $y$-intercept is the value of $y$ when $x=0$.`,
        },
      ]),
    };
  }
  if (variant === "slope-and-point") {
    const q = pick(r, [2, 3, 4, 5]);
    const p = pick(r, [1, 2, 3]) * (r(0, 2) === 0 ? 1 : -1);
    if (gcd(Math.abs(p), q) !== 1) throw new Error("Need three retry");
    const k = pick(r, [1, 2, 3, -1, -2]);
    const x1 = q * k;
    const y1 = r(-6, 8);
    const b = y1 - p * k;
    if (b === 0) throw new Error("Need three retry");
    const correct = tex(lineTex(p, q, b));
    const onLine = (pp: number, qq: number, bb: number) =>
      pp * x1 + bb * qq === y1 * qq;
    const candidates: { text: string; ok: boolean; feedback: string }[] = [
      {
        text: lineTex(p, q, y1 + p * k),
        ok: onLine(p, q, y1 + p * k),
        feedback:
          "The sign in the intercept is wrong. Subtract $mx$ from $y$: $b=y-mx$.",
      },
      {
        text: lineTex(p, q, y1),
        ok: onLine(p, q, y1),
        feedback: `The $y$-value ${y1} belongs to $x=${x1}$, not to $x=0$. Solve for $b$ with the point.`,
      },
      {
        text: lineTex(q * Math.sign(p), Math.abs(p), b),
        ok: onLine(q * Math.sign(p), Math.abs(p), b),
        feedback:
          "The slope is flipped. Slope is the rise over the run, written as stated.",
      },
      {
        text: lineTex(-p, q, b),
        ok: onLine(-p, q, b),
        feedback: "The sign of the slope is reversed. Use the slope as stated.",
      },
    ];
    return {
      variant,
      prompt: `A line has slope $${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}}$ and passes through $(${x1}, ${y1})$. Which is an equation of the line?`,
      answer: "",
      hint: `Start with $y=mx+b$ and put in the slope. Then use the point $(${x1}, ${y1})$ for $x$ and $y$ and solve for $b$.`,
      explanation: [
        `Write $y=${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}}x+b$.`,
        `Use the point: $${y1}=${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}}\\times${par(x1)}+b$, which is $${y1}=${p * k}+b$.`,
        `So $b=${y1}-${par(p * k)}=${b}$, and the equation is $${lineTex(p, q, b)}$.`,
      ],
      choices: choicesFrom(
        r,
        correct,
        candidates
          .filter((c) => !c.ok)
          .map((c) => ({ label: tex(c.text), feedback: c.feedback })),
      ),
    };
  }
  const A = r(2, 9);
  const B = r(2, 9) * (r(0, 2) === 0 ? -1 : 1);
  const C = r(6, 30);
  const eq = `${A}x${B < 0 ? "-" : "+"}${Math.abs(B)}y=${C}`;
  return {
    variant,
    prompt: `The equation $${eq}$ describes a line. What is the rate of change of $y$ with respect to $x$?`,
    answer: "",
    hint: `The rate of change is the slope. Solve $${eq}$ for $y$: move the $x$ term to the other side, then divide every term by ${B}.`,
    explanation: [
      `Subtract $${A}x$ from both sides: $${B}y=-${A}x+${C}$.`,
      `Divide every term by ${B}: $y=${fracTex(-A, B)}x+${fracTex(C, B)}$.`,
      `The rate of change is the coefficient of $x$, $${fracTex(-A, B)}$.`,
    ],
    choices: choicesFrom(r, tex(fracTex(-A, B)), [
      {
        label: tex(fracTex(A, B)),
        feedback:
          "The sign is wrong. Moving $Ax$ to the other side changes its sign.",
      },
      {
        label: tex(fracTex(-B, A)),
        feedback:
          "That is the reciprocal. Divide by the coefficient of $y$, not the coefficient of $x$.",
      },
      {
        label: tex(fracTex(C, B)),
        feedback:
          "That is the $y$-intercept, the constant term, not the rate of change.",
      },
      {
        label: tex(fracTex(-C, A)),
        feedback:
          "That is related to the $x$-intercept, not the rate of change.",
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Data displays                                                           */
/* ---------------------------------------------------------------------- */

const stemContexts: [string, string][] = [
  ["points scored in a game", "points"],
  ["minutes spent reading", "minutes"],
  ["pages read in a week", "pages"],
  ["laps swum in a practice", "laps"],
];

function stemLeafCombine(r: Random): Built {
  const variant = pick(r, ["sum-two-greatest", "highest-minus-second-lowest"]);
  const [what, unit] = pick(r, stemContexts);
  let values: number[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const stems = r(3, 4);
    const first = r(1, 9 - stems);
    values = [];
    for (let s = 0; s < stems; s++)
      for (let k = r(2, 5); k > 0; k--) values.push((first + s) * 10 + r(0, 9));
    values.sort((a, b) => a - b);
    const n = values.length;
    if (
      n >= 10 &&
      n <= 15 &&
      values[1]! > values[0]! &&
      values[n - 1]! > values[n - 2]! &&
      values[n - 2]! > values[n - 3]!
    )
      break;
    values = [];
  }
  if (!values.length) throw new Error("No stem-and-leaf data found");
  const n = values.length;
  const stemOf = (v: number) => Math.floor(v / 10);
  const rows = [...new Set(values.map(stemOf))].map((s) => ({
    stem: s,
    leaves: values.filter((v) => stemOf(v) === s).map((v) => v % 10),
  }));
  const figure: SemanticFigure = {
    kind: "scene",
    scene: table({
      id: "plot",
      corner: "Stem",
      columns: ["Leaf"],
      rows: rows.map((row) => ({
        label: String(row.stem),
        cells: [row.leaves.join(" ")],
      })),
    }).scene(),
  };
  const key = values[Math.floor(n / 2)]!;
  const keyText = `Key: $${stemOf(key)}\\mid ${key % 10}$ means $${key}$ ${unit}.`;
  const top = values[n - 1]!;
  const second = values[n - 2]!;
  const low2 = values[1]!;
  const lastStem = rows[rows.length - 1]!.stem;
  const firstStem = rows[0]!.stem;
  if (variant === "sum-two-greatest")
    return {
      variant,
      model: { values },
      prompt: `The stem-and-leaf plot shows the ${what} for ${n} students. ${keyText} What is the sum of the two greatest values?`,
      figure,
      answer: String(top + second),
      hint: `The greatest values are in the bottom row, stem ${lastStem}, at the right end. Read the last two leaves with the key $${stemOf(key)}\\mid ${key % 10}$, then add the two values.`,
      explanation: [
        `The two greatest values are at the end of the last row: ${second} and ${top}.`,
        `Add them: $${second}+${top}=${top + second}$.`,
      ],
    };
  return {
    variant,
    model: { values },
    prompt: `The stem-and-leaf plot shows the ${what} for ${n} students. ${keyText} What is the difference between the greatest value and the second-least value?`,
    figure,
    answer: String(top - low2),
    hint: `The greatest value is the last leaf of the bottom row, stem ${lastStem}. The least value is the first leaf of the top row, stem ${firstStem}; the second-least is the next leaf in reading order. Read each leaf with the key $${stemOf(key)}\\mid ${key % 10}$.`,
    explanation: [
      `The greatest value is ${top}. The values in order from the top row begin ${values.slice(0, 2).join(", ")}, so the second-least is ${low2}.`,
      `Subtract: $${top}-${low2}=${top - low2}$.`,
    ],
  };
}

const dotRatingContexts: [
  (n: number) => string,
  string,
  string,
  string,
  number,
  number,
][] = [
  [
    (n) => `The dot plot shows the ratings that ${n} viewers gave a movie.`,
    "viewers",
    "rating",
    "stars",
    1,
    5,
  ],
  [
    (n) => `The dot plot shows the ratings that ${n} customers gave a lunch.`,
    "customers",
    "rating",
    "stars",
    1,
    5,
  ],
  [
    (n) => `The dot plot shows the quiz scores of ${n} students.`,
    "students",
    "score",
    "points",
    0,
    8,
  ],
  [
    (n) => `The dot plot shows the ratings that ${n} riders gave a trail.`,
    "riders",
    "rating",
    "stars",
    1,
    5,
  ],
];

function dotPlotThreshold(r: Random): Built {
  const [intro, people, measure, unit, lo, hi] = pick(r, dotRatingContexts);
  let values: number[] = [];
  let t = lo + 2;
  let mode = "below";
  for (let guard = 0; guard < 500; guard++) {
    const n = r(12, 20);
    values = Array.from({ length: n }, () => r(lo, hi));
    t = r(lo + 2, hi - 1);
    mode = pick(r, ["below", "at least", "above"]);
    const count = values.filter((v) =>
      mode === "below" ? v < t : mode === "at least" ? v >= t : v > t,
    ).length;
    if (
      Math.max(...stackHeights(values).values()) <= MAX_STACK &&
      new Set(values).size >= 4 &&
      count >= 3 &&
      count <= n - 3
    )
      break;
    values = [];
  }
  if (!values.length) throw new Error("No dot plot data found");
  const n = values.length;
  const test = (v: number) =>
    mode === "below" ? v < t : mode === "at least" ? v >= t : v > t;
  const matched = [...new Set(values.filter(test))].sort((a, b) => a - b);
  const count = values.filter(test).length;
  const phrase =
    mode === "below"
      ? `less than ${t}`
      : mode === "at least"
        ? `at least ${t}`
        : `greater than ${t}`;
  const counts = matched.map((v) => values.filter((x) => x === v).length);
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: 1,
    start: Math.max(0, lo - 1),
    end: hi + 1,
    values,
    mark: "dot",
    unit,
  };
  return {
    variant: mode,
    prompt: `${intro(n)} Each dot is one of the ${people}. How many of the ${people} had a ${measure} ${phrase}?`,
    figure,
    answer: String(count),
    hint: `Decide which values count: those ${phrase}. Count the dots above each of those values, not just the values themselves.`,
    explanation: [
      `The values ${phrase} are ${matched.join(", ")}.`,
      `Count the dots above each: ${counts.join(" + ")}.`,
      `The total is ${count}.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Money vocabulary                                                        */
/* ---------------------------------------------------------------------- */

const fixedExpenses: [string, number, number][] = [
  ["Rent", 800, 1300],
  ["Car payment", 220, 420],
  ["Internet service", 45, 85],
  ["Gym membership", 20, 50],
  ["Renter's insurance", 15, 40],
];
const variableExpenses = [
  "Groceries",
  "Electricity",
  "Gas for the car",
  "Eating out",
  "Water bill",
];

function moneyVocabulary(r: Random): Built {
  const variant = pick(r, ["credit", "variable-expense", "fixed-expense"]);
  if (variant === "credit") {
    const who = pick(r, ["Ana", "Ben", "Cora", "Dev"]);
    const [thing] = pick(r, [
      ["a bike"],
      ["a laptop"],
      ["a phone"],
      ["a couch"],
    ]) as [string];
    const price = r(2, 12) * 25;
    const months = r(3, 12);
    const tax = (price * 8) / 100;
    const correct = pick(r, [
      `${who} takes ${thing} that costs ${price} dollars home today and agrees to pay the store back over ${months} months.`,
      `${who} buys ${thing} for ${price} dollars with a credit card and pays the card company back later.`,
    ]);
    return {
      variant,
      prompt: `Which is an example of using credit?`,
      answer: "",
      hint: `Credit means getting something now and paying for it later. Look for the choice where the money is paid after ${who} already has the item.`,
      explanation: [
        `Credit is borrowing: you get ${thing} now and pay for it later.`,
        `${correct.split(".")[0]}. That is using credit.`,
        `The other choices use money ${who} already has, or are a tax or a deposit, not a loan.`,
      ],
      choices: (() => {
        const taxChoice: Wrong = {
          label: `${who} pays ${tax} dollars of sales tax on ${thing} at the register.`,
          feedback:
            "A sales tax is a charge added to a purchase. It is not borrowing.",
        };
        const others: Wrong[] = [
          {
            label: `${who} pays ${price} dollars for ${thing} with money ${who} saved.`,
            feedback:
              "Paying with saved money is paying in full now. Nothing is borrowed.",
          },
          {
            label: `${who} puts ${price} dollars into a savings account.`,
            feedback:
              "Saving puts money away for later. Credit is the opposite: using money now that is paid back later.",
          },
          {
            label: `${who} earns ${price} dollars mowing lawns.`,
            feedback:
              "Earning money is income. Credit is a loan that must be repaid.",
          },
        ];
        return [
          { label: correct, correct: true as const },
          taxChoice,
          ...shuffle(r, others).slice(0, 2),
        ];
      })(),
    };
  }
  const wantVariable = variant === "variable-expense";
  const fixedPicks = shuffle(r, [...fixedExpenses]).slice(
    0,
    wantVariable ? 3 : 1,
  );
  const variablePicks = shuffle(r, [...variableExpenses]).slice(
    0,
    wantVariable ? 1 : 3,
  );
  const months = ["January", "February", "March"];
  const rowsOf = [
    ...fixedPicks.map(([name, lo, hi]) => {
      const amount = Math.round(r(lo, hi) / 5) * 5;
      return { name, amounts: [amount, amount, amount], fixed: true };
    }),
    ...variablePicks.map((name) => {
      const base = r(30, 300);
      const amounts = [base, base + r(5, 40), base - r(5, 25)].map(
        (a) => Math.round(a / 5) * 5,
      );
      if (new Set(amounts).size < 3)
        throw new Error("Need three retry amounts");
      return { name, amounts, fixed: false };
    }),
  ];
  const order = shuffle(r, rowsOf.slice());
  const figure: SemanticFigure = {
    kind: "scene",
    scene: table({
      id: "expenses",
      corner: "Expense",
      columns: months,
      rows: order.map((row) => ({
        label: row.name,
        cells: row.amounts.map(String),
      })),
    }).scene(),
  };
  const target = order.find((row) => row.fixed !== wantVariable)!;
  const word = wantVariable ? "variable" : "fixed";
  return {
    variant,
    model: { rows: order, target, wantVariable },
    prompt: `A family's expenses for three months are shown in dollars. Which expense is ${wantVariable ? "a variable expense, one that changes from month to month" : "a fixed expense, one that stays the same each month"}?`,
    figure,
    answer: "",
    hint: `Compare the three amounts in each row. A fixed expense has the same amount every month, and a variable expense has amounts that differ.`,
    explanation: [
      `${target.name} is ${target.amounts.join(", ")} dollars in the three months, so it is ${wantVariable ? "different each month" : "the same each month"}.`,
      `That makes ${target.name} a ${word} expense.`,
    ],
    choices: choicesFrom(
      r,
      target.name,
      order
        .filter((row) => row !== target)
        .map((row) => ({
          label: row.name,
          feedback: row.fixed
            ? `${row.name} is ${row.amounts[0]} dollars every month, so it is a fixed expense.`
            : `${row.name} changes: ${row.amounts.join(", ")} dollars. It is a variable expense.`,
        })),
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* Tables, equations, probability, number sets                             */
/* ---------------------------------------------------------------------- */

const xSets = [
  [1, 2, 3, 4],
  [2, 4, 6, 8],
  [1, 3, 5, 7],
  [2, 3, 4, 5],
  [3, 4, 5, 6],
];
/** Subtract rule: every output is its input minus k; the inputs all exceed k. */
function subtractRuleChoice(r: Random): Built {
  const k = r(1, 6);
  const step = r(1, 3);
  const first = r(k + 1, k + 6);
  const xs = [0, 1, 2, 3].map((i) => first + i * step);
  const label = (ys: number[]) =>
    tex(
      `\\begin{array}{c|cccc}x&${xs.join("&")}\\\\\\hline y&${ys.join("&")}\\end{array}`,
    );
  const right = xs.map((x) => x - k);
  const oneOff = right.slice();
  const bad = r(0, 3);
  oneOff[bad] = oneOff[bad]! + (r(0, 1) ? 1 : -1) * r(1, 2);
  const added = xs.map((x) => x + k);
  const shifted = right.map((y) => y + 1);
  const wrongK = xs.map((x) => x - (k + (k > 1 ? -1 : 1)));
  const flipped = xs.map((x) => k - x);
  return {
    variant: "subtract",
    prompt: `Which table shows that every pair follows the rule $y=x-${k}$?`,
    answer: "",
    hint: `Try the rule on the first pair. For $x=${xs[0]}$ the rule gives $${xs[0]}-${k}$. Check that value in each table, then check the other pairs: one wrong pair rules a table out.`,
    explanation: [
      `Apply the rule to each input: ${xs.map((x) => `$x=${x}$ gives $y=${x - k}$`).join("; ")}.`,
      `Only one table has outputs ${right.join(", ")} for these inputs.`,
    ],
    choices: choicesFrom(r, label(right), [
      {
        label: label(oneOff),
        feedback: `One output does not follow the rule: for $x=${xs[bad]}$ it should be ${right[bad]}. Every pair must follow the rule.`,
      },
      {
        label: label(added),
        feedback: `These outputs add ${k} to each input. The rule subtracts ${k}.`,
      },
      {
        label: label(shifted),
        feedback:
          "Every output is 1 too large. Check the first pair against the rule.",
      },
      {
        label: label(wrongK),
        feedback: `These outputs subtract a different number. The rule subtracts ${k}.`,
      },
      {
        label: label(flipped),
        feedback: `These outputs subtract each input from ${k}. The rule subtracts ${k} from each input.`,
      },
    ]),
  };
}

function tableRuleChoice(r: Random, axes?: Record<string, string>): Built {
  if (axes?.rule === "subtract") return subtractRuleChoice(r);
  const mul = r(0, 1) === 1;
  const k = r(2, 9);
  const xs = pick(r, xSets);
  const rule = (x: number, kk = k) => (mul ? x * kk : x + kk);
  const label = (ys: number[]) =>
    tex(
      `\\begin{array}{c|cccc}x&${xs.join("&")}\\\\\\hline y&${ys.join("&")}\\end{array}`,
    );
  const right = xs.map((x) => rule(x));
  const oneOff = right.slice();
  const bad = r(0, 3);
  oneOff[bad] = oneOff[bad]! + (r(0, 1) ? 1 : -1) * r(1, 2);
  const otherOp = xs.map((x) => (mul ? x + k : x * k));
  const shifted = right.map((y) => y + 1);
  const wrongK = xs.map((x) => rule(x, k + (k > 2 ? -1 : 1)));
  const sentence = mul
    ? `every output $y$ is ${k} times its input $x$`
    : `every pair follows the rule $y=x+${k}$`;
  return {
    variant: mul ? "multiply" : "add",
    prompt: `Which table shows that ${sentence}?`,
    answer: "",
    hint: `Try the rule on the first pair. For $x=${xs[0]}$ the rule ${mul ? `gives $${k}\\times${xs[0]}$` : `gives $${xs[0]}+${k}$`}. Check that value in each table, then check the other pairs: one wrong pair rules a table out.`,
    explanation: [
      `Apply the rule to each input: ${xs.map((x) => `$x=${x}$ gives $y=${rule(x)}$`).join("; ")}.`,
      `Only one table has outputs ${right.join(", ")} for these inputs.`,
    ],
    choices: choicesFrom(r, label(right), [
      {
        label: label(oneOff),
        feedback: `One output does not follow the rule: for $x=${xs[bad]}$ it should be ${right[bad]}. Every pair must follow the rule.`,
      },
      {
        label: label(otherOp),
        feedback: mul
          ? `These outputs add ${k} to each input. The rule multiplies by ${k}.`
          : `These outputs multiply each input by ${k}. The rule adds ${k}.`,
      },
      {
        label: label(shifted),
        feedback:
          "Every output is 1 too large. Check the first pair against the rule.",
      },
      {
        label: label(wrongK),
        feedback: `These outputs use ${mul ? "a different number to multiply by" : "a different number to add"}. The rule uses ${k}.`,
      },
    ]),
  };
}

const lin = (a: number, v = "x") =>
  `${a < 0 ? "-" : ""}${Math.abs(a) === 1 ? "" : Math.abs(a)}${v}`;
const plus = (n: number) => `${n < 0 ? "-" : "+"}${Math.abs(n)}`;

function multistepEquations(r: Random): Built {
  const variant = pick(r, [
    "distribute-negative",
    "like-terms",
    "fraction-coefficients",
  ]);
  const s0 = () =>
    pick(r, [-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8]);
  if (variant === "distribute-negative") {
    const a = r(2, 6);
    const b = pick(r, [-9, -7, -5, -4, -3, -2, 2, 3, 4, 5, 6, 8]);
    const c = pick(r, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
    if (a + c === 0) throw new Error("Need three retry");
    const s = s0();
    const d = -a * (s + b) - c * s;
    if (d === 0) throw new Error("Need three retry");
    const expanded = `-${a}x${plus(-a * b)}`;
    return {
      variant,
      prompt: `Solve $-${a}(x${plus(b)})=${lin(c)}${plus(d)}$.`,
      answer: String(s),
      hint: `Distribute $-${a}$ to both terms inside the parentheses first, including the sign of the second term. Then collect the $x$ terms on one side.`,
      explanation: [
        `Distribute: $-${a}\\times x=-${a}x$ and $-${a}\\times${par(b)}=${-a * b}$, so the left side is $${expanded}$.`,
        `Subtract $${lin(c)}$ from both sides: $${lin(-a - c)}${plus(-a * b)}=${d}$.`,
        `${a * b > 0 ? "Add" : "Subtract"} $${Math.abs(a * b)}$: $${lin(-a - c)}=${d + a * b}$, so $x=${s}$.`,
        `Check: $-${a}(${s}${plus(b)})=${-a * (s + b)}$ and $${lin(c)}${plus(d)}$ at $x=${s}$ is ${c * s + d}.`,
      ],
    };
  }
  if (variant === "like-terms") {
    const a = r(2, 9);
    const b = pick(r, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 7, 9]);
    if (a + b === 0 || Math.abs(a + b) === 1)
      throw new Error("Need three retry");
    const c = pick(r, [-12, -9, -7, -5, -3, 4, 6, 8, 10, 11]);
    const s = s0();
    const d = (a + b) * s + c;
    return {
      variant,
      prompt: `Solve $${lin(a)}${b < 0 ? "-" : "+"}${Math.abs(b)}x${plus(c)}=${d}$.`,
      answer: String(s),
      hint: `Combine the two $x$ terms first: ${a} $x$ and ${b} $x$ make one term. Then undo the constant ${c} and divide.`,
      explanation: [
        `Combine like terms: $${a}x${plus(b)}x=${a + b}x$.`,
        `The equation is $${lin(a + b)}${plus(c)}=${d}$.`,
        `Subtract ${c} from both sides: $${lin(a + b)}=${d - c}$.`,
        `Divide by ${a + b}: $x=${s}$.`,
      ],
    };
  }
  const m = pick(r, [2, 3, 4, 5, 6]);
  const p = r(1, m + 2);
  const q = r(1, m + 2);
  if (p === q) throw new Error("Need three retry");
  const u = pick(r, [-4, -3, -2, -1, 1, 2, 3, 4]);
  const v = pick(r, [-3, -2, -1, 1, 2, 3]);
  const s = m * u;
  const b = m * v;
  const c = (p * (s + b) - q * s) / m;
  if (!Number.isInteger(c) || c === 0) throw new Error("Need three retry");
  return {
    variant,
    prompt: `Solve $\\frac{${p}}{${m}}(x${plus(b)})=\\frac{${q}}{${m}}x${plus(c)}$.`,
    answer: String(s),
    hint: `Multiply both sides by ${m} to clear the fractions, then distribute ${p} over the parentheses and collect the $x$ terms.`,
    explanation: [
      `Multiply both sides by ${m}: $${p}(x${plus(b)})=${q}x${plus(m * c)}$.`,
      `Distribute: $${p}x${plus(p * b)}=${q}x${plus(m * c)}$.`,
      `Subtract $${q}x$ and ${p * b}: $${lin(p - q)}=${m * c - p * b}$, so $x=${s}$.`,
    ],
  };
}

const reduce = (n: number, d: number) => {
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};

function experimentProbability(r: Random): Built {
  if (r(0, 1) === 0) {
    const trials = pick(r, [40, 50, 60]);
    const colors = shuffle(r, [
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
    ]).slice(0, 4);
    let counts: number[] = [];
    for (let guard = 0; guard < 200; guard++) {
      const cuts = [r(4, trials / 2), r(4, trials / 2), r(4, trials / 2)];
      const last = trials - cuts.reduce((a, b) => a + b, 0);
      counts = [...cuts, last];
      if (last >= 4 && last <= trials / 2 && new Set(counts).size === 4) break;
      counts = [];
    }
    if (!counts.length) throw new Error("Need three retry counts");
    const [i, j] = [r(0, 3), r(0, 3)];
    if (i === j) throw new Error("Need three retry colors");
    const wanted = counts[i]! + counts[j]!;
    const figure: SemanticFigure = {
      kind: "scene",
      scene: table({
        id: "draws",
        corner: "Color",
        columns: ["Times drawn"],
        rows: colors.map((color, idx) => ({
          label: color,
          cells: [String(counts[idx])],
        })),
      }).scene(),
    };
    return {
      variant: "experimental",
      model: { colors, counts, i, j, trials },
      prompt: `A bag has tiles of four colors. A tile is drawn, its color is recorded and it is put back, ${trials} times. The table shows the results. Based on the results, what is the experimental probability of drawing a ${colors[i]} tile or a ${colors[j]} tile? Give a fraction in simplest form.`,
      figure,
      answer: reduce(wanted, trials),
      fraction: true,
      hint: `Experimental probability is the number of times the outcome happened divided by the number of trials, ${trials}. Here two colors count, so add their two counts first.`,
      explanation: [
        `${colors[i]![0]!.toUpperCase()}${colors[i]!.slice(1)} and ${colors[j]} were drawn $${counts[i]}+${counts[j]}=${wanted}$ times.`,
        `Probability: $\\frac{${wanted}}{${trials}}=${fracTex(wanted, trials)}$.`,
      ],
    };
  }
  const n = pick(r, [10, 12, 20]);
  const red = r(2, n - 2);
  const zero = r(1, n - 3);
  const num = red * zero;
  const den = n * n;
  return {
    variant: "with-replacement",
    prompt: `A box holds ${n} cards. ${red} of the cards ${isAre(red)} red and ${zero} of the cards ${isAre(zero)} labeled 0. A card is drawn at random and put back. Then a second card is drawn. What is the probability that the first card is red and the second card is labeled 0? Give a fraction in simplest form.`,
    answer: reduce(num, den),
    fraction: true,
    hint: `The first card is put back, so both draws are from the same ${n} cards. Find the probability of each draw separately, then multiply.`,
    explanation: [
      `First draw, red: $\\frac{${red}}{${n}}$. Second draw, labeled 0: $\\frac{${zero}}{${n}}$.`,
      `The draws do not affect each other, so multiply: $\\frac{${red}}{${n}}\\times\\frac{${zero}}{${n}}=\\frac{${num}}{${den}}=${fracTex(num, den)}$.`,
    ],
  };
}

type SetKind = "whole" | "integer" | "rational";
const kindName: Record<SetKind, string> = {
  whole: "whole numbers",
  integer: "integers that are not whole numbers",
  rational: "rational numbers that are not integers",
};
const setItems: Record<SetKind, { tex: string; value: string }[]> = {
  whole: [
    { tex: "0", value: "0" },
    { tex: "8", value: "8" },
    { tex: "15", value: "15" },
    { tex: "\\frac{24}{3}", value: "8" },
    { tex: "36\\div6", value: "6" },
    { tex: "\\frac{40}{5}", value: "8" },
  ],
  integer: [
    { tex: "-4", value: "-4" },
    { tex: "-12", value: "-12" },
    { tex: "\\frac{-20}{5}", value: "-4" },
    { tex: "-18\\div3", value: "-6" },
    { tex: "-7", value: "-7" },
  ],
  rational: [
    { tex: "\\frac{3}{4}", value: "0.75" },
    { tex: "-2.5", value: "-2.5" },
    { tex: "\\frac{7}{2}", value: "3.5" },
    { tex: "-\\frac{5}{3}", value: "-1.666…" },
    { tex: "0.6", value: "0.6" },
    { tex: "9\\div2", value: "4.5" },
  ],
};

function numberSets(r: Random): Built {
  const variant = pick(r, ["belongs", "not-in-set", "fix-placement"]);
  const kinds: SetKind[] = ["whole", "integer", "rational"];
  const article = `In a diagram of nested sets, the whole numbers are inside the integers, and the integers are inside the rational numbers.`;
  const describe = (kind: SetKind, value: string, text: string) =>
    kind === "whole"
      ? `${tex(text)} equals ${value}, a whole number.`
      : kind === "integer"
        ? `${tex(text)} equals ${value}, a negative integer, so it is not a whole number.`
        : `${tex(text)} equals ${value}, which is not an integer.`;
  if (variant === "fix-placement") {
    const kind = pick(r, kinds);
    const wrongKind = pick(
      r,
      kinds.filter((k) => k !== kind),
    );
    const item = pick(
      r,
      setItems[kind].filter((i) => /div|frac/.test(i.tex)),
    );
    const others = kinds.filter((k) => k !== kind && k !== wrongKind);
    const move = (k: SetKind) => `Move it to the region for ${kindName[k]}.`;
    return {
      variant,
      prompt: `${article} A student put ${tex(item.tex)} in the region for ${kindName[wrongKind]}. Which statement fixes the diagram?`,
      answer: "",
      hint: `Work out the value of ${tex(item.tex)} first. Then decide whether that value is a whole number, a negative integer, or a number that is not an integer.`,
      explanation: [
        `${tex(item.tex)} equals ${item.value}.`,
        describe(kind, item.value, item.tex),
        `So the correct fix is: ${move(kind)}`,
      ],
      choices: choicesFrom(r, move(kind), [
        {
          label: "Leave it where it is.",
          feedback: `${item.value} does not belong in the region for ${kindName[wrongKind]}.`,
        },
        ...others.map((k) => ({
          label: move(k),
          feedback: `${item.value} is not in the region for ${kindName[k]}.`,
        })),
        {
          label: "Remove it, because it is not a rational number.",
          feedback:
            "Every number that can be written as a fraction of integers is rational, and these quotients can be.",
        },
      ]),
    };
  }
  if (variant === "not-in-set") {
    const outside = pick(r, ["whole", "integers"]);
    const targetKinds: SetKind[] =
      outside === "whole" ? ["integer", "rational"] : ["rational"];
    const insideKinds: SetKind[] =
      outside === "whole" ? ["whole"] : ["whole", "integer"];
    const tk = pick(r, targetKinds);
    const correct = pick(r, setItems[tk]);
    const pool = insideKinds.flatMap((k) =>
      setItems[k].map((i) => ({ ...i, kind: k })),
    );
    const wrongs = shuffle(r, pool).slice(0, 3);
    return {
      variant,
      prompt: `${article} Which number does NOT belong in the region for the ${outside === "whole" ? "whole numbers" : "integers"}?`,
      answer: "",
      hint: `Work out the value of each choice. A whole number is 0, 1, 2, … and the integers also include the negatives. The answer is the choice that is outside that set.`,
      explanation: [
        describe(tk, correct.value, correct.tex),
        `${outside === "whole" ? "Whole numbers" : "Integers"} must be ${outside === "whole" ? "0, 1, 2, …" : "whole numbers or their opposites"}, so ${tex(correct.tex)} is outside.`,
      ],
      choices: choicesFrom(
        r,
        tex(correct.tex),
        wrongs.map((w) => ({
          label: tex(w.tex),
          feedback: describe(w.kind, w.value, w.tex),
        })),
      ),
    };
  }
  const target = pick(r, kinds);
  const correct = pick(r, setItems[target]);
  const pool = kinds
    .filter((k) => k !== target)
    .flatMap((k) => setItems[k].map((i) => ({ ...i, kind: k })));
  const wrongs = shuffle(r, pool).slice(0, 3);
  return {
    variant,
    prompt: `${article} Which number belongs in the region for ${kindName[target]}?`,
    answer: "",
    hint: `Work out the value of each choice. Ask first whether it is a whole number, then whether it is an integer, then whether it is a fraction or decimal between integers.`,
    explanation: [
      describe(target, correct.value, correct.tex),
      `So ${tex(correct.tex)} belongs in the region for ${kindName[target]}.`,
    ],
    choices: choicesFrom(
      r,
      tex(correct.tex),
      wrongs.map((w) => ({
        label: tex(w.tex),
        feedback: describe(w.kind, w.value, w.tex),
      })),
    ),
  };
}

/* ---------------------------------------------------------------------- */

const builders: Record<
  string,
  (r: Random, axes?: Record<string, string>) => Built
> = {
  "staar-nested-grouping": nestedGrouping,
  "staar-signed-exponent-order": signedExponentOrder,
  "staar-number-word-form": numberWordForm,
  "staar-rename-percent-fraction-decimal": renameForms,
  "staar-ratio-statements": ratioStatements,
  "staar-story-model-choice": storyModelChoice,
  "staar-rate-equation-choice": rateEquationChoice,
  "staar-order-decimals": orderDecimals,
  "staar-order-mixed-forms": orderMixedForms,
  "staar-decimal-operations": decimalOperations,
  "staar-salary-percent": salaryPercent,
  "staar-measure-chains": measureChains,
  "staar-multistep-stories": multistepStories,
  "staar-line-from-points": lineFromPoints,
  "staar-stem-leaf-combine": stemLeafCombine,
  "staar-dot-plot-threshold": dotPlotThreshold,
  "staar-money-vocabulary": moneyVocabulary,
  "staar-table-rule-choice": tableRuleChoice,
  "staar-multistep-equations": multistepEquations,
  "staar-experiment-probability": experimentProbability,
  "staar-number-sets": numberSets,
};
export const staarGapTemplateIds = Object.keys(builders);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function leaks(draft: Draft, selects?: true): boolean {
  const text = selects ? draft.hint : `${draft.prompt}\n${draft.hint}`;
  const correct = draft.choices
    ? draft.choices.find((c) => c.correct)!.label
    : draft.answer;
  if (correct === "0") return false;
  if (/^-?[\d,.]+$/.test(correct))
    return new RegExp(`(?<![\\d.,])${escape(correct)}(?![\\d]|[.,]\\d)`).test(
      text,
    );
  return text.includes(correct);
}

/** Private model: the variant is for tests; only the public problem is served. */
export function staarGapCase(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const template = staarGapTemplates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!template || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(template.id, seed);
  const axes = isSweepId(templateId)
    ? sweepChoose(templateId, seed)
    : undefined;
  for (let attempt = 0; attempt < 80; attempt++) {
    let draft: Built;
    try {
      draft = build(r, axes);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Need three"))
        continue;
      if (error instanceof Error && error.message.startsWith("No ")) continue;
      throw error;
    }
    if (leaks(draft, draft.selects)) continue;
    return {
      variant: draft.variant,
      model: draft.model,
      problem: {
        ...assemble(template, seed, r, draft),
        ...(axes ? { variant: sweepVariant(draft.variant, axes) } : {}),
      },
    };
  }
  throw new Error("Could not generate a problem without leaking the answer");
}

export function generateStaarGapProblem(templateId: string, seed: string) {
  return staarGapCase(templateId, seed).problem;
}
