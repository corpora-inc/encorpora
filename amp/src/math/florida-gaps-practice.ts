import type { TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  type Draft,
  type Random,
} from "./distribution-practice";

/**
 * Round-2 problem types for Florida B.E.S.T. benchmarks whose task is not yet
 * practiced. Every template is new and attached to an existing skill; no
 * existing template changes.
 */
export const floridaGapTemplates: readonly TemplateMetadata[] = [
  {
    id: "fl-equation-truth-20",
    version: 1,
    title: "Is the equation true? Within 20",
    skillId: "equality",
    gradeBand: "K–2",
    difficultyOffset: 0,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the true (or false) addition or subtraction equation within 20, including equations with an operation on both sides or the result on the left.",
  },
  {
    id: "fl-equation-truth-100",
    version: 1,
    title: "Is the equation true? Within 100",
    skillId: "equality",
    gradeBand: "K–2",
    difficultyOffset: 0.1,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the true (or false) addition or subtraction equation within 100, such as 27 + 13 = 26 + 14, by finding the value of each side.",
  },
  {
    id: "fl-equation-truth-mult-div",
    version: 1,
    title: "Is the multiplication or division equation true?",
    skillId: "missing-factor",
    gradeBand: "3–5",
    difficultyOffset: 0.1,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the true (or false) multiplication or division equation using facts within 12, with the result on either side.",
  },
  {
    id: "fl-equation-truth-whole",
    version: 1,
    title: "Is the whole-number equation true?",
    skillId: "missing-factor",
    gradeBand: "3–5",
    difficultyOffset: 0.2,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the true (or false) whole-number equation that uses any of the four operations, with multiplication facts within 12.",
  },
  {
    id: "fl-equation-truth-grouped",
    version: 1,
    title: "Is the equation with parentheses true?",
    skillId: "numerical-expressions",
    gradeBand: "3–5",
    difficultyOffset: 0.25,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the true (or false) equation whose sides use parentheses, decimals to tenths and any of the four operations.",
  },
  {
    id: "fl-decimal-tenth-hundredth-step",
    version: 1,
    title: "0.1 or 0.01 more or less than a decimal",
    skillId: "decimal-fractions",
    gradeBand: "3–5",
    difficultyOffset: 0.1,
    description:
      "Enter the decimal that is 0.1 or 0.01 more or less than a decimal with up to two places, including regrouping across a place.",
  },
  {
    id: "fl-decimal-by-tenth-hundredth",
    version: 1,
    title: "Multiply or divide by 0.1 and 0.01",
    skillId: "powers-of-ten",
    gradeBand: "3–5",
    difficultyOffset: 0.2,
    description:
      "Multiply or divide a decimal to tenths by 0.1 or 0.01, or find the missing factor, and see that the digits shift.",
  },
  {
    id: "fl-expression-description-match",
    version: 1,
    title: "Match an expression to a description",
    skillId: "numerical-expressions",
    gradeBand: "3–5",
    difficultyOffset: 0.15,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the numerical expression with parentheses that matches a written description, or the description that matches an expression.",
  },
  {
    id: "fl-two-step-story-equation",
    version: 1,
    title: "Choose the equation for a two-step story",
    skillId: "multi-operation-stories",
    gradeBand: "3–5",
    difficultyOffset: 0.2,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the equation with a variable and two different operations that models a whole-number story.",
  },
  {
    id: "fl-metric-customary-conversion",
    version: 1,
    title: "Convert between customary and metric units",
    skillId: "units-and-precision",
    gradeBand: "6–8",
    difficultyOffset: 0.2,
    description:
      "Convert a length, mass, volume or area between customary and metric units, or money at a stated rate, using a conversion factor given in the problem.",
  },
  {
    id: "fl-integer-multiply-divide",
    version: 1,
    title: "Multiply and divide integers",
    skillId: "signed-multiplication",
    gradeBand: "6–8",
    difficultyOffset: -0.1,
    description:
      "Multiply or divide two integers, including negative factors, zero and a divisor of −1.",
  },
  {
    id: "fl-vector-dot-product",
    version: 1,
    title: "Dot product, perpendicular vectors and projection",
    skillId: "vectors",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    description:
      "Find a dot product, the value that makes two vectors perpendicular, or the scalar projection of one vector on another.",
  },
  {
    id: "fl-vector-angle",
    version: 1,
    title: "Angle and relationship between two vectors",
    skillId: "vectors",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the angle between two vectors from their dot product and lengths, or decide whether they are perpendicular, parallel or neither.",
  },
  {
    id: "fl-even-odd-classify",
    version: 1,
    title: "Classify a function as even, odd or neither",
    skillId: "function-transformations",
    gradeBand: "9–12",
    difficultyOffset: 0.15,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Use f(−x) to decide whether a polynomial function is even, odd or neither, or choose the function that has a stated symmetry.",
  },
  {
    id: "fl-function-arithmetic",
    version: 1,
    title: "Add, subtract, multiply and divide functions",
    skillId: "function-composition",
    gradeBand: "9–12",
    difficultyOffset: 0.15,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the formula for $(f+g)(x)$, $(f-g)(x)$ or $(fg)(x)$, the domain of $(f/g)(x)$, or the value of $(f/g)(a)$.",
  },
  {
    id: "fl-trapezoid-consequences",
    version: 1,
    title: "Trapezoid midsegment, base angles and diagonals",
    skillId: "parallelogram-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.15,
    description:
      "Use the midsegment theorem for a trapezoid and the base-angle and diagonal properties of an isosceles trapezoid to find a length or angle.",
  },
];

type Wrong = { label: string; feedback: string };
type Built = Draft & { variant: string };

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
/** Neg numbers in parentheses, positives bare. */
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);

/* ---------------------------------------------------------------------- */
/* Equation truth                                                          */
/* ---------------------------------------------------------------------- */

type Band = "g1" | "g2" | "g3" | "g4" | "g5";
/** Values are whole numbers, except band g5 where they are tenths. */
const showValue = (band: Band, v: number) =>
  band === "g5"
    ? v % 10 === 0
      ? String(v / 10)
      : (v / 10).toFixed(1)
    : String(v);

const productSet = (() => {
  const s = new Set<number>();
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) s.add(a * b);
  return [...s].sort((x, y) => x - y);
})();

/** One side of an equation with exactly value v, or null when none fits. */
function side(
  r: Random,
  band: Band,
  v: number,
  numeral: boolean,
): string | null {
  const forms: string[] = [];
  const mulDiv = (mult: boolean, div: boolean) => {
    if (mult)
      for (let a = 2; a <= 12; a++)
        if (v % a === 0 && v / a >= 2 && v / a <= 12)
          forms.push(`${a} \\times ${v / a}`);
    if (div && v >= 2)
      for (let b = 2; b <= 12; b++)
        if (v * b <= 144) forms.push(`${v * b} \\div ${b}`);
  };
  if (numeral) forms.push(showValue(band, v));
  if (band === "g1" || band === "g2") {
    const max = band === "g1" ? 20 : 100;
    if (v >= 2) {
      const a = r(1, v - 1);
      forms.push(`${a} + ${v - a}`);
    }
    if (v < max) {
      const b = r(1, max - v);
      forms.push(`${v + b} - ${b}`);
    }
  } else if (band === "g3") {
    mulDiv(productSet.includes(v), v <= 12);
  } else if (band === "g4") {
    mulDiv(productSet.includes(v), true);
    if (v >= 2) {
      const a = r(1, v - 1);
      forms.push(`${a} + ${v - a}`);
    }
    if (v <= 150) {
      const b = r(2, 40);
      forms.push(`${v + b} - ${b}`);
    }
  } else {
    // Tenths. Whole and decimal operands, parentheses and any operation.
    const decimal = (t: number) => showValue("g5", t);
    const c = r(2, 6);
    const b = r(2, 9);
    if (v - 10 * b * c >= 0)
      forms.push(`${decimal(v - 10 * b * c)} + (${b} \\times ${c})`);
    const q = r(1, 9) * 10 + r(0, 1) * 5;
    if (v + q <= 400) forms.push(`${decimal(v + q)} - ${decimal(q)}`);
    if (v % (10 * c) === 0 && v / (10 * c) >= 2) {
      const total = v / (10 * c);
      const a = r(1, total - 1);
      forms.push(`(${a} + ${total - a}) \\times ${c}`);
    }
    if (v >= 10 * 2) {
      const total = (v * c) / 10;
      if (Number.isInteger(total) && total >= 2) {
        const a = r(1, total - 1);
        forms.push(`(${a} + ${total - a}) \\div ${c}`);
      }
    }
    if (v - 5 >= 0 && v % 10 === 5) {
      const w = (v - 5) / 10;
      forms.push(`${w} + 0.5`);
    }
    const sub = r(1, 9);
    if (v + 10 * sub >= 20) {
      const prod = v + 10 * sub;
      if (prod % 10 === 0 && prod / 10 >= 2) {
        const total = prod / 10;
        for (let m = 2; m <= 9; m++)
          if (total % m === 0) {
            forms.push(`${m} \\times ${total / m} - ${sub}`);
            break;
          }
      }
    }
  }
  return forms.length ? pick(r, forms) : null;
}

function valueDomain(r: Random, band: Band): number {
  switch (band) {
    case "g1":
      return r(3, 19);
    case "g2":
      return r(12, 98);
    case "g3":
      return pick(
        r,
        productSet.filter((n) => n <= (r(0, 1) ? 12 : 48) && n >= 4),
      );
    case "g4":
      return r(0, 3) === 0
        ? pick(
            r,
            productSet.filter((n) => n >= 4),
          )
        : r(6, 120);
    default:
      return r(15, 250);
  }
}

type Eq = { text: string; lv: string; rv: string; truth: boolean };

function makeEquation(r: Random, band: Band, truth: boolean): Eq | null {
  const v = valueDomain(r, band);
  const unit = band === "g5" ? 10 : 1;
  const deltas =
    band === "g1"
      ? [1, 2, 3]
      : band === "g2"
        ? [1, 2, 10, 20]
        : band === "g3" || band === "g4"
          ? [1, 2, 3, 4]
          : [1, 2, 5, 10];
  const left = side(r, band, v, false);
  if (!left) return null;
  let rv = v;
  if (!truth) rv = v + pick(r, deltas) * unit * (r(0, 1) ? 1 : -1);
  const cap =
    band === "g1" ? 20 : band === "g2" ? 100 : band === "g5" ? 400 : 150;
  if (rv < 0 || rv > cap) return null;
  const right = side(r, band, rv, true);
  if (!right || right === left) return null;
  const swap = r(0, 1) === 1;
  const text = swap ? `${right} = ${left}` : `${left} = ${right}`;
  return {
    text,
    lv: showValue(band, swap ? rv : v),
    rv: showValue(band, swap ? v : rv),
    truth,
  };
}

function equationTruth(band: Band): (r: Random) => Built {
  return (r) => {
    const wantTrue = r(0, 2) !== 0;
    const make = (truth: boolean, used: Set<string>): Eq => {
      for (let i = 0; i < 80; i++) {
        const eq = makeEquation(r, band, truth);
        if (eq && !used.has(eq.text)) {
          used.add(eq.text);
          return eq;
        }
      }
      throw new Error("Need three distinct equations");
    };
    const used = new Set<string>();
    const correct = make(wantTrue, used);
    const others = [0, 1, 2].map(() => make(!wantTrue, used));
    const all = [correct, ...others];
    const sentence = wantTrue
      ? "Which equation is true?"
      : "Which equation is false?";
    const meaning =
      " An equation is true when its two sides have the same value.";
    const wrongFeedback = (eq: Eq) =>
      wantTrue
        ? `The left side is ${eq.lv} and the right side is ${eq.rv}. The values are different, so this equation is false.`
        : `Both sides of this equation equal ${eq.lv}, so it is true. The question asks for the false equation.`;
    return {
      variant: `${band}-${wantTrue ? "true" : "false"}`,
      prompt: `${sentence}${meaning}`,
      answer: "",
      hint: `Find the value of the left side and the value of the right side of ${tex(others[0]!.text)}. The equal sign says the two values must match.`,
      explanation: [
        ...all.map(
          (eq) =>
            `${tex(eq.text)}: one side is ${eq.lv} and the other is ${eq.rv}, so the sides ${eq.truth ? "match and the equation is true" : "differ and the equation is false"}.`,
        ),
        `The ${wantTrue ? "true" : "false"} equation is ${tex(correct.text)}.`,
      ],
      choices: [
        { label: tex(correct.text), correct: true as const },
        ...others.map((eq) => ({
          label: tex(eq.text),
          feedback: wrongFeedback(eq),
        })),
      ],
    };
  };
}

/* ---------------------------------------------------------------------- */
/* 0.1 or 0.01 more or less                                                */
/* ---------------------------------------------------------------------- */

const twoPlaces = (h: number) =>
  `${Math.floor(h / 100)}.${String(h % 100).padStart(2, "0")}`;
const trimmed = (h: number) =>
  h % 100 === 0
    ? String(h / 100)
    : twoPlaces(h).replace(/0$/, "").replace(/\.$/, "");

function decimalStep(r: Random): Built {
  const variant = ["tenth", "hundredth", "regroup", "whole"][r(0, 3)]!;
  const more = r(0, 1) === 1;
  const stepH =
    variant === "tenth" ? 10 : variant === "hundredth" ? 1 : r(0, 1) ? 10 : 1;
  let whole = r(1, 8);
  let d1 = r(1, 8);
  let d2 = r(1, 8);
  if (variant === "tenth" && r(0, 1)) d2 = 0;
  if (variant === "regroup") {
    if (stepH === 10) d1 = more ? 9 : 0;
    else d2 = more ? 9 : 0;
  }
  if (variant === "whole") {
    d1 = 0;
    d2 = 0;
    whole = r(1, 9);
  }
  const base = whole * 100 + d1 * 10 + d2;
  const answerH = more ? base + stepH : base - stepH;
  const stepText = stepH === 10 ? "0.1" : "0.01";
  const shownBase =
    base % 100 === 0
      ? String(base / 100)
      : variant === "tenth" && d2 === 0
        ? (base / 100).toFixed(1)
        : twoPlaces(base);
  const place = stepH === 10 ? "tenths" : "hundredths";
  return {
    variant: `${variant}-${more ? "more" : "less"}`,
    prompt: `What number is ${stepText} ${more ? "more" : "less"} than ${shownBase}? Enter it as a decimal.`,
    answer: trimmed(answerH),
    hint: `${stepText} is 1 ${place.slice(0, -1)}. Find the ${place} digit of ${shownBase} and change it by 1. If that digit is ${more ? "9" : "0"}, regroup with the next place to the left.`,
    explanation: [
      `${stepText} is 1 ${place.slice(0, -1)}, so ${more ? "add" : "subtract"} 1 in the ${place} place of ${shownBase}.`,
      `Regroup with the next place to the left if the ${place} digit cannot ${more ? "increase" : "decrease"}.`,
      `${shownBase} ${more ? "+" : "-"} ${stepText} = ${trimmed(answerH)}.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Multiply or divide by 0.1 and 0.01                                      */
/* ---------------------------------------------------------------------- */

/** Thousandths as a trimmed decimal. */
const fromThousandths = (n: number) => {
  const whole = Math.floor(n / 1000);
  const frac = String(n % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
};

function decimalByTenth(r: Random): Built {
  const variant = [
    "times-0.1",
    "times-0.01",
    "div-0.1",
    "div-0.01",
    "missing-factor",
  ][r(0, 4)]!;
  const t = r(0, 3) === 0 ? r(2, 90) * 10 : r(11, 999);
  const d = fromThousandths(t * 100);
  if (variant === "times-0.1")
    return {
      variant,
      prompt: `Find $${d}\\times0.1$.`,
      answer: fromThousandths(t * 10),
      hint: `Multiplying by 0.1 takes one tenth of ${d}. Think about how the digits move one place when you divide by 10.`,
      explanation: [
        "0.1 is one tenth, so multiplying by 0.1 is the same as dividing by 10.",
        "Each digit of the number moves one place to the right.",
        `$${d}\\times0.1=${fromThousandths(t * 10)}$.`,
      ],
    };
  if (variant === "times-0.01")
    return {
      variant,
      prompt: `Find $${d}\\times0.01$.`,
      answer: fromThousandths(t),
      hint: `Multiplying by 0.01 takes one hundredth of ${d}. Think about how the digits move when you divide by 100.`,
      explanation: [
        "0.01 is one hundredth, so multiplying by 0.01 is the same as dividing by 100.",
        "Each digit moves two places to the right.",
        `$${d}\\times0.01=${fromThousandths(t)}$.`,
      ],
    };
  if (variant === "div-0.1")
    return {
      variant,
      prompt: `Find $${d}\\div0.1$.`,
      answer: fromThousandths(t * 1000),
      hint: `Ask how many tenths fit in ${d}. There are 10 tenths in every 1, so each digit changes place value by a factor of 10.`,
      explanation: [
        "There are 10 tenths in 1, so dividing by 0.1 is the same as multiplying by 10.",
        "Each digit moves one place to the left.",
        `$${d}\\div0.1=${fromThousandths(t * 1000)}$.`,
      ],
    };
  if (variant === "div-0.01")
    return {
      variant,
      prompt: `Find $${d}\\div0.01$.`,
      answer: fromThousandths(t * 10000),
      hint: `Ask how many hundredths fit in ${d}. There are 100 hundredths in every 1, so each digit changes place value by a factor of 100.`,
      explanation: [
        "There are 100 hundredths in 1, so dividing by 0.01 is the same as multiplying by 100.",
        "Each digit moves two places to the left.",
        `$${d}\\div0.01=${fromThousandths(t * 10000)}$.`,
      ],
    };
  const small = r(0, 1) === 1; // 0.01 or 0.1
  const factor = small ? "0.01" : "0.1";
  const result = small ? fromThousandths(t) : fromThousandths(t * 10);
  const unknown = fromThousandths(t * 100);
  return {
    variant,
    prompt: `What number times ${factor} equals ${result}?`,
    answer: unknown,
    hint: `Multiplying by ${factor} divides a number by ${small ? "100" : "10"}. Undo that to find the number you started with.`,
    explanation: [
      `Multiplying by ${factor} is the same as dividing by ${small ? "100" : "10"}.`,
      `To undo it, multiply ${result} by ${small ? "100" : "10"}: the digits move ${small ? "two places" : "one place"} to the left.`,
      `${unknown} $\\times$ ${factor} = ${result}.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Match an expression to a description                                    */
/* ---------------------------------------------------------------------- */

type Form = {
  desc: (a: string, b: string, c: string) => string;
  expr: (a: string, b: string, c: string) => string;
  wrongs: {
    expr: (a: string, b: string, c: string) => string;
    desc: (a: string, b: string, c: string) => string;
    why: string;
  }[];
};

const forms: Form[] = [
  {
    desc: (a, b, c) => `Add ${a} and ${b}, then multiply the sum by ${c}.`,
    expr: (a, b, c) => `(${a} + ${b}) \\times ${c}`,
    wrongs: [
      {
        expr: (a, b, c) => `${a} + ${b} \\times ${c}`,
        desc: (a, b, c) => `Multiply ${b} by ${c}, then add ${a}.`,
        why: "Without parentheses, multiplication happens before addition, so only the second number is multiplied.",
      },
      {
        expr: (a, b, c) => `(${a} \\times ${b}) + ${c}`,
        desc: (a, b, c) => `Multiply ${a} by ${b}, then add ${c}.`,
        why: "This multiplies the first two numbers and then adds, so the addition does not come first.",
      },
      {
        expr: (a, b, c) => `(${a} - ${b}) \\times ${c}`,
        desc: (a, b, c) =>
          `Subtract ${b} from ${a}, then multiply the difference by ${c}.`,
        why: "This subtracts instead of adding.",
      },
    ],
  },
  {
    desc: (a, b, c) =>
      `Subtract ${b} from ${a}, then divide the difference by ${c}.`,
    expr: (a, b, c) => `(${a} - ${b}) \\div ${c}`,
    wrongs: [
      {
        expr: (a, b, c) => `${a} - ${b} \\div ${c}`,
        desc: (a, b, c) =>
          `Divide ${b} by ${c}, then subtract the quotient from ${a}.`,
        why: "Without parentheses, division happens before subtraction, so only the second number is divided.",
      },
      {
        expr: (a, b, c) => `(${b} - ${a}) \\div ${c}`,
        desc: (a, b, c) =>
          `Subtract ${a} from ${b}, then divide the difference by ${c}.`,
        why: "This subtracts in the opposite order.",
      },
      {
        expr: (a, b, c) => `(${a} \\div ${c}) - ${b}`,
        desc: (a, b, c) => `Divide ${a} by ${c}, then subtract ${b}.`,
        why: "This divides first, but the description subtracts first.",
      },
    ],
  },
  {
    desc: (a, b, c) => `Multiply ${a} by the sum of ${b} and ${c}.`,
    expr: (a, b, c) => `${a} \\times (${b} + ${c})`,
    wrongs: [
      {
        expr: (a, b, c) => `${a} \\times ${b} + ${c}`,
        desc: (a, b, c) => `Multiply ${a} by ${b}, then add ${c}.`,
        why: "This adds the last number after multiplying, so the last number is not multiplied.",
      },
      {
        expr: (a, b, c) => `(${a} + ${b}) \\times ${c}`,
        desc: (a, b, c) => `Multiply the sum of ${a} and ${b} by ${c}.`,
        why: "This adds the first two numbers instead of the last two.",
      },
      {
        expr: (a, b, c) => `${a} + ${b} + ${c}`,
        desc: (a, b, c) => `Find the sum of ${a}, ${b} and ${c}.`,
        why: "This only adds. The description multiplies.",
      },
    ],
  },
  {
    desc: (a, b, c) => `Divide ${a} by ${b}, then add ${c}.`,
    expr: (a, b, c) => `${a} \\div ${b} + ${c}`,
    wrongs: [
      {
        expr: (a, b, c) => `${a} \\div (${b} + ${c})`,
        desc: (a, b, c) => `Divide ${a} by the sum of ${b} and ${c}.`,
        why: "The parentheses make the addition happen first.",
      },
      {
        expr: (a, b, c) => `(${a} + ${c}) \\div ${b}`,
        desc: (a, b, c) => `Add ${a} and ${c}, then divide the sum by ${b}.`,
        why: "This adds before dividing.",
      },
      {
        expr: (a, b, c) => `${a} \\div ${b} - ${c}`,
        desc: (a, b, c) => `Divide ${a} by ${b}, then subtract ${c}.`,
        why: "This subtracts instead of adding.",
      },
    ],
  },
  {
    desc: (a, b, c) => `Subtract ${c} from the product of ${a} and ${b}.`,
    expr: (a, b, c) => `${a} \\times ${b} - ${c}`,
    wrongs: [
      {
        expr: (a, b, c) => `${a} \\times (${b} - ${c})`,
        desc: (a, b, c) => `Multiply ${a} by the difference of ${b} and ${c}.`,
        why: "The parentheses make the subtraction happen before the multiplication.",
      },
      {
        expr: (a, b, c) => `${c} - ${a} \\times ${b}`,
        desc: (a, b, c) => `Subtract the product of ${a} and ${b} from ${c}.`,
        why: "This subtracts in the opposite order.",
      },
      {
        expr: (a, b, c) => `(${a} - ${c}) \\times ${b}`,
        desc: (a, b, c) =>
          `Subtract ${c} from ${a}, then multiply the difference by ${b}.`,
        why: "This subtracts before multiplying.",
      },
    ],
  },
  {
    desc: (a, b) => `Double the sum of ${a} and ${b}.`,
    expr: (a, b) => `2 \\times (${a} + ${b})`,
    wrongs: [
      {
        expr: (a, b) => `2 \\times ${a} + ${b}`,
        desc: (a, b) => `Add ${b} to double ${a}.`,
        why: "This doubles only the first number.",
      },
      {
        expr: (a, b) => `2 + (${a} + ${b})`,
        desc: (a, b) => `Add 2 to the sum of ${a} and ${b}.`,
        why: "This adds 2 instead of doubling.",
      },
      {
        expr: (a, b) => `(${a} + ${b}) \\div 2`,
        desc: (a, b) => `Half the sum of ${a} and ${b}.`,
        why: "This halves the sum instead of doubling it.",
      },
    ],
  },
];

function expressionMatch(r: Random): Built {
  const form = pick(r, forms);
  const dec = r(0, 2) === 0;
  const digits = [2, 3, 4, 5, 6, 7, 8, 9];
  const take = () => String(digits.splice(r(0, digits.length - 1), 1)[0]!);
  const a = dec ? `${r(1, 9)}.${r(1, 9)}` : take();
  const b = take();
  const c = take();
  const toDesc = r(0, 1) === 1;
  const expr = tex(form.expr(a, b, c));
  const desc = form.desc(a, b, c);
  const wrongs = form.wrongs;
  if (toDesc) {
    return {
      variant: "expression-to-description",
      prompt: `Which description matches the expression ${expr}?`,
      answer: "",
      hint: `Read ${expr} in order. Find the operation inside the parentheses (or the one that is done first) and say it first.`,
      explanation: [
        `In ${expr}, do the operations in the order the parentheses and operation rules require.`,
        `That order is described by: "${desc}"`,
      ],
      choices: [
        { label: desc, correct: true as const },
        ...wrongs.map((w) => ({
          label: w.desc(a, b, c),
          feedback: `That description matches a different expression. ${w.why}`,
        })),
      ],
    };
  }
  return {
    variant: "description-to-expression",
    prompt: `Which expression matches this description? "${desc}"`,
    answer: "",
    hint: `In "${desc}", underline the operation the description says to do first, and put it in parentheses.`,
    explanation: [
      `Write each step of the description in order: "${desc}"`,
      `The step that happens first goes inside parentheses.`,
      `The matching expression is ${expr}.`,
    ],
    choices: [
      { label: expr, correct: true as const },
      ...wrongs.map((w) => ({
        label: tex(w.expr(a, b, c)),
        feedback: `That expression does something else. ${w.why}`,
      })),
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Two-step story equations                                                */
/* ---------------------------------------------------------------------- */

type StoryKind = "plus" | "minus" | "gain-each" | "lose-each" | "share-plus";
const storyForms: Record<
  StoryKind,
  {
    eq: (v: string, g: number, e: number, t: number) => string;
    says: (g: number, e: number) => string;
  }
> = {
  plus: {
    eq: (v, g, e, t) => `${g}${v} + ${e} = ${t}`,
    says: (g, e) => `${g} equal groups, then ${e} more added`,
  },
  minus: {
    eq: (v, g, e, t) => `${g}${v} - ${e} = ${t}`,
    says: (g, e) => `${g} equal groups, then ${e} taken away`,
  },
  "gain-each": {
    eq: (v, g, e, t) => `${g}(${v} + ${e}) = ${t}`,
    says: (g, e) => `${e} added to each of ${g} equal groups`,
  },
  "lose-each": {
    eq: (v, g, e, t) => `${g}(${v} - ${e}) = ${t}`,
    says: (g, e) => `${e} taken from each of ${g} equal groups`,
  },
  "share-plus": {
    eq: (v, g, e, t) => `${v} \\div ${g} + ${e} = ${t}`,
    says: (g, e) =>
      `a total shared equally into ${g} groups, then ${e} more added to each`,
  },
};

function storyEquation(r: Random): Built {
  const kinds = Object.keys(storyForms) as StoryKind[];
  const kind = pick(r, kinds);
  const v = pick(r, ["n", "x", "p", "b"]);
  const g = r(3, 9);
  const e = r(2, 8);
  let n = r(4, 12);
  if (kind === "lose-each") n = e + r(1, 6);
  let t = 0;
  let story = "";
  switch (kind) {
    case "plus":
      t = g * n + e;
      story = `A school buys ${g} boxes of markers with the same number of markers in each box. It also has ${e} loose markers. In all there are ${t} markers. Let $${v}$ be the number of markers in one box.`;
      break;
    case "minus":
      t = g * n - e;
      story = `A store puts ${g} equal rows of books on a shelf. Then ${e} books are sold, and ${t} books are left. Let $${v}$ be the number of books in one row.`;
      break;
    case "gain-each":
      t = g * (n + e);
      story = `${g} friends each have the same number of cards. Each friend gets ${e} more cards, and together they now have ${t} cards. Let $${v}$ be the number of cards each friend had at first.`;
      break;
    case "lose-each":
      t = g * (n - e);
      story = `${g} teams each have the same number of players. Each team sends ${e} players to a game, and ${t} players are left in all. Let $${v}$ be the number of players on one team at first.`;
      break;
    default:
      t = n + e;
      story = `A teacher shares $${v}$ stickers equally among ${g} students and then gives each student ${e} more. Each student now has ${t} stickers.`;
      // For this story the unknown is the total, which must divide evenly.
      break;
  }
  // Share-plus: n students each end with n_each + e; total = g * n_each.
  const correct = tex(storyForms[kind].eq(v, g, e, t));
  const wrongs: Wrong[] = kinds
    .filter((k) => k !== kind)
    .map((k) => ({
      label: tex(storyForms[k].eq(v, g, e, t)),
      feedback: `That equation says ${storyForms[k].says(g, e)}. Compare it with the order of the steps in the story.`,
    }));
  // Solving a distractor must not give the story's own answer.
  const rootOf: Record<StoryKind, number> = {
    plus: (t - e) / g,
    minus: (t + e) / g,
    "gain-each": t / g - e,
    "lose-each": t / g + e,
    "share-plus": g * (t - e),
  };
  const solution = rootOf[kind];
  if (
    kinds.some((k) => k !== kind && rootOf[k] === solution) ||
    t - g - e === solution
  )
    throw new Error("Need three distractors with different solutions");
  wrongs.push({
    label: tex(`${g} + ${v} + ${e} = ${t}`),
    feedback:
      "That adds the number of groups instead of multiplying by it. Equal groups mean multiplication.",
  });
  return {
    variant: kind,
    prompt: `${story} Which equation matches the story?`,
    answer: "",
    hint: `Decide which operation joins the ${g} groups to the unknown $${v}$, and whether the ${e} is added or taken away before or after that. Then write the steps in the same order as the story.`,
    explanation: [
      `Name the steps of the story in order: ${storyForms[kind].says(g, e)}.`,
      `Write those steps with $${v}$ as the unknown and ${t} as the result.`,
      `The equation is ${correct}.`,
    ],
    choices: choicesFrom(r, correct, wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* Customary and metric conversion                                         */
/* ---------------------------------------------------------------------- */

type Factor = {
  from: string; // customary unit, singular
  fromPlural: string;
  to: string;
  toPlural: string;
  hundredths: number; // 1 from = hundredths/100 to
  thing: string;
  verb: string; // "is" sentence builder
  kind: "length" | "mass" | "volume" | "area" | "money";
};
const factors: Factor[] = [
  {
    from: "inch",
    fromPlural: "inches",
    to: "centimeter",
    toPlural: "centimeters",
    hundredths: 254,
    thing: "A ribbon",
    verb: "is {q} {u} long",
    kind: "length",
  },
  {
    from: "mile",
    fromPlural: "miles",
    to: "kilometer",
    toPlural: "kilometers",
    hundredths: 160,
    thing: "A hiking trail",
    verb: "is {q} {u} long",
    kind: "length",
  },
  {
    from: "yard",
    fromPlural: "yards",
    to: "meter",
    toPlural: "meters",
    hundredths: 90,
    thing: "A fence",
    verb: "is {q} {u} long",
    kind: "length",
  },
  {
    from: "pound",
    fromPlural: "pounds",
    to: "kilogram",
    toPlural: "kilograms",
    hundredths: 45,
    thing: "A bag of rice",
    verb: "weighs {q} {u}",
    kind: "mass",
  },
  {
    from: "ounce",
    fromPlural: "ounces",
    to: "gram",
    toPlural: "grams",
    hundredths: 2800,
    thing: "A package",
    verb: "weighs {q} {u}",
    kind: "mass",
  },
  {
    from: "gallon",
    fromPlural: "gallons",
    to: "liter",
    toPlural: "liters",
    hundredths: 380,
    thing: "A tank",
    verb: "holds {q} {u}",
    kind: "volume",
  },
  {
    from: "quart",
    fromPlural: "quarts",
    to: "liter",
    toPlural: "liters",
    hundredths: 95,
    thing: "A bottle",
    verb: "holds {q} {u}",
    kind: "volume",
  },
  {
    from: "square inch",
    fromPlural: "square inches",
    to: "square centimeter",
    toPlural: "square centimeters",
    hundredths: 645,
    thing: "A card",
    verb: "has an area of {q} {u}",
    kind: "area",
  },
  {
    from: "square mile",
    fromPlural: "square miles",
    to: "square kilometer",
    toPlural: "square kilometers",
    hundredths: 260,
    thing: "A park",
    verb: "has an area of {q} {u}",
    kind: "area",
  },
  {
    from: "US dollar",
    fromPlural: "US dollars",
    to: "peso",
    toPlural: "pesos",
    hundredths: 1800,
    thing: "A toy",
    verb: "costs {q} {u}",
    kind: "money",
  },
];
const decimalHundredths = (h: number) =>
  h % 100 === 0 ? String(h / 100) : (h / 100).toFixed(2).replace(/0$/, "");

function metricConversion(r: Random): Built {
  const f = pick(r, factors);
  const forward = r(0, 2) !== 0; // customary -> metric more often
  const m = r(2, 40);
  const factorText = `1 ${f.from} = ${decimalHundredths(f.hundredths)} ${f.hundredths === 100 ? f.to : f.toPlural}`;
  const converted = m * f.hundredths; // hundredths of the target unit
  const given = forward ? String(m) : decimalHundredths(converted);
  const askUnit = forward ? f.toPlural : f.fromPlural;
  const givenUnit = forward ? f.fromPlural : f.toPlural;
  const answer = forward ? decimalHundredths(converted) : String(m);
  const sentence = `${f.thing} ${f.verb.replace("{q}", given).replace("{u}", givenUnit)}.`;
  return {
    variant: `${f.kind}-${forward ? "to-metric" : "to-customary"}`,
    prompt: `${sentence} Use ${factorText}. How many ${askUnit} is that? Enter the number.`,
    answer,
    hint: forward
      ? `${factorText} means each ${f.from} is worth ${decimalHundredths(f.hundredths)} ${f.toPlural}. Decide whether to multiply or divide to turn ${givenUnit} into ${askUnit}.`
      : `${factorText} means each ${f.from} is worth ${decimalHundredths(f.hundredths)} ${f.toPlural}. Ask how many of those equal ${given} ${givenUnit}, and decide whether to multiply or divide.`,
    explanation: forward
      ? [
          `${factorText}, so each ${f.from} becomes ${decimalHundredths(f.hundredths)} ${f.toPlural}.`,
          `There are ${m} ${f.fromPlural}, so multiply: ${m} $\\times$ ${decimalHundredths(f.hundredths)} = ${answer}.`,
          `The answer is ${answer} ${f.toPlural}.`,
        ]
      : [
          `${factorText}, so each ${f.from} is ${decimalHundredths(f.hundredths)} ${f.toPlural}.`,
          `To find how many ${f.fromPlural} make ${given} ${f.toPlural}, divide: ${given} $\\div$ ${decimalHundredths(f.hundredths)} = ${answer}.`,
          `The answer is ${answer} ${f.fromPlural}.`,
        ],
  };
}

/* ---------------------------------------------------------------------- */
/* Integer multiplication and division                                     */
/* ---------------------------------------------------------------------- */

function integerMulDiv(r: Random): Built {
  const variant = [
    "unlike-product",
    "negative-product",
    "unlike-quotient",
    "negative-quotient",
    "zero",
    "by-negative-one",
  ][r(0, 5)]!;
  const m = r(2, 12);
  const n = r(2, 12);
  const s = sign(r);
  let a = 0;
  let b = 0;
  let op: "times" | "div" = "times";
  if (variant === "unlike-product") {
    a = m * s;
    b = -n * s;
  } else if (variant === "negative-product") {
    a = -m;
    b = -n;
  } else if (variant === "unlike-quotient") {
    op = "div";
    a = m * n * s;
    b = -n * s;
  } else if (variant === "negative-quotient") {
    op = "div";
    a = -m * n;
    b = -n;
  } else if (variant === "zero") {
    op = r(0, 1) ? "times" : "div";
    a = 0;
    b = n * s;
    if (op === "times" && r(0, 1)) [a, b] = [b, a];
  } else {
    op = "div";
    a = m * s;
    b = -1;
  }
  const value = (op === "times" ? a * b : a / b) + 0;
  const sym = op === "times" ? "\\times" : "\\div";
  const exprText = `${par(a)} ${sym} ${par(b)}`;
  const absText = `${Math.abs(a)} ${sym} ${Math.abs(b)}`;
  const sameSigns = a < 0 === b < 0;
  const zeroCase = a === 0 || b === 0;
  return {
    variant,
    prompt: `Find $${exprText}$.`,
    answer: String(value),
    hint: zeroCase
      ? `One of the numbers in $${exprText}$ is 0. Think about what multiplying by 0, or 0 divided by a nonzero number, gives.`
      : `First work with the numbers without their signs: $${absText}$. Then decide the sign from whether the two signs in $${exprText}$ are the same or different.`,
    explanation: zeroCase
      ? [
          `${op === "times" ? "Any number times 0 is 0" : "0 divided by any nonzero number is 0"}.`,
          `$${exprText}=0$.`,
        ]
      : [
          `Without signs, $${absText}=${Math.abs(value)}$.`,
          `The signs are ${sameSigns ? "the same" : "different"}, so the result is ${sameSigns ? "positive" : "negative"}.`,
          `$${exprText}=${value}$.`,
        ],
  };
}

/* ---------------------------------------------------------------------- */
/* Vectors                                                                 */
/* ---------------------------------------------------------------------- */

const vec = (a: number, b: number) => `\\langle ${a}, ${b}\\rangle`;
const pyth: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [5, 12, 13],
  [12, 5, 13],
  [6, 8, 10],
  [8, 6, 10],
];

function vectorDot(r: Random): Built {
  const variant = ["dot", "perpendicular-k", "scalar-projection"][r(0, 2)]!;
  if (variant === "dot") {
    const a = r(-6, 9);
    const b = r(-6, 9);
    const c = r(-6, 9);
    const d = r(-6, 9);
    const answer = a * c + b * d;
    return {
      variant,
      prompt: `Let $\\mathbf{u}=${vec(a, b)}$ and $\\mathbf{v}=${vec(c, d)}$. Find the dot product $\\mathbf{u}\\cdot\\mathbf{v}$.`,
      answer: String(answer),
      hint: `The dot product multiplies matching components and adds. Multiply the first components ${a} and ${c}, then the second components ${b} and ${d}.`,
      explanation: [
        "Multiply the first components and the second components: " +
          `$(${a})(${c})=${a * c}$ and $(${b})(${d})=${b * d}$.`,
        `Add the products: $${a * c}+(${b * d})=${answer}$.`,
      ],
    };
  }
  if (variant === "perpendicular-k") {
    const b = r(1, 6) * sign(r);
    const c = r(1, 4);
    const m = r(1, 4) * sign(r);
    const d = c * m;
    const k = -b * m;
    const u = `\\langle k, ${b}\\rangle`;
    return {
      variant,
      prompt: `The vectors $\\mathbf{u}=${u}$ and $\\mathbf{v}=${vec(c, d)}$ are perpendicular. Find $k$.`,
      answer: String(k),
      hint: `Two vectors are perpendicular exactly when their dot product is 0. Write $\\mathbf{u}\\cdot\\mathbf{v}$ using the components of $${u}$ and $${vec(c, d)}$ and set it equal to 0.`,
      explanation: [
        `Perpendicular vectors have dot product 0: $${c}k+(${b})(${d})=0$.`,
        `$${c}k=${-b * d}$, so $k=${k}$.`,
      ],
    };
  }
  const [p, q, len] = pick(r, pyth);
  const v: [number, number] = [p * sign(r), q * sign(r)];
  let u: [number, number] = [0, 0];
  for (let i = 0; i < 200; i++) {
    const ux = r(-9, 9);
    const uy = r(-9, 9);
    const dot = ux * v[0] + uy * v[1];
    if (dot !== 0 && dot % len === 0) {
      u = [ux, uy];
      break;
    }
  }
  if (u[0] === 0 && u[1] === 0) {
    u = [v[0], v[1]];
  }
  const dot = u[0] * v[0] + u[1] * v[1];
  return {
    variant,
    prompt: `Let $\\mathbf{u}=${vec(u[0], u[1])}$ and $\\mathbf{v}=${vec(v[0], v[1])}$. Find the scalar projection of $\\mathbf{u}$ on $\\mathbf{v}$, which is $\\dfrac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{v}|}$.`,
    answer: String(dot / len),
    hint: `Find $\\mathbf{u}\\cdot\\mathbf{v}$ first, using ${u[0]} and ${v[0]} for the first components. Then find the length $|\\mathbf{v}|$ with the Pythagorean theorem.`,
    explanation: [
      `Dot product: $(${u[0]})(${v[0]})+(${u[1]})(${v[1]})=${dot}$.`,
      `Length of $\\mathbf{v}$: $\\sqrt{(${v[0]})^2+(${v[1]})^2}=\\sqrt{${p * p + q * q}}=${len}$.`,
      `Divide: $${dot}\\div${len}=${dot / len}$.`,
    ],
  };
}

const dirs: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const cosText: Record<number, string> = {
  0: "1",
  45: "\\frac{\\sqrt{2}}{2}",
  90: "0",
  135: "-\\frac{\\sqrt{2}}{2}",
  180: "-1",
};

function vectorAngle(r: Random): Built {
  const variant = r(0, 1) ? "angle" : "relationship";
  if (variant === "angle") {
    const i = r(0, 7);
    const j = r(0, 7);
    const k1 = r(1, 4);
    const k2 = r(1, 4);
    const u = [dirs[i]![0] * k1, dirs[i]![1] * k1] as const;
    const v = [dirs[j]![0] * k2, dirs[j]![1] * k2] as const;
    const step = Math.abs(i - j);
    const theta = Math.min(step, 8 - step) * 45;
    const dot = u[0] * v[0] + u[1] * v[1];
    const len = (k: number, diag: boolean) =>
      diag ? (k === 1 ? "\\sqrt{2}" : `${k}\\sqrt{2}`) : String(k);
    const lu = len(k1, i % 2 === 1);
    const lv = len(k2, j % 2 === 1);
    const label = (d: number) => tex(`${d}^\\circ`);
    const wrongs: Wrong[] = [0, 45, 90, 135, 180]
      .filter((d) => d !== theta)
      .map((d) => ({
        label: label(d),
        feedback:
          d === 180 - theta
            ? "That is the supplementary angle. It comes from using the wrong sign of the dot product."
            : `$\\cos ${d}^\\circ=${cosText[d]}$, which does not equal $\\cos\\theta$ for these vectors.`,
      }));
    return {
      variant,
      prompt: `Find the angle $\\theta$ between $\\mathbf{u}=${vec(u[0], u[1])}$ and $\\mathbf{v}=${vec(v[0], v[1])}$, with $0^\\circ\\le\\theta\\le180^\\circ$.`,
      answer: "",
      hint: `Use $\\cos\\theta=\\dfrac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{u}||\\mathbf{v}|}$. Start with the dot product of $${vec(u[0], u[1])}$ and $${vec(v[0], v[1])}$.`,
      explanation: [
        `Dot product: $(${u[0]})(${v[0]})+(${u[1]})(${v[1]})=${dot}$.`,
        `Lengths: $|\\mathbf{u}|=${lu}$ and $|\\mathbf{v}|=${lv}$.`,
        `$\\cos\\theta=\\dfrac{${dot}}{${lu}\\cdot${lv}}=${cosText[theta]}$, so $\\theta=${theta}^\\circ$.`,
      ],
      choices: choicesFrom(r, label(theta), wrongs),
    };
  }
  const kind = pick(r, [
    "perpendicular",
    "same",
    "opposite",
    "neither",
  ] as const);
  let u: [number, number];
  let v: [number, number];
  if (kind === "neither") {
    do {
      u = [r(-5, 5), r(-5, 5)];
      v = [r(-5, 5), r(-5, 5)];
    } while (
      (u[0] === 0 && u[1] === 0) ||
      (v[0] === 0 && v[1] === 0) ||
      u[0] * v[1] - u[1] * v[0] === 0 ||
      u[0] * v[0] + u[1] * v[1] === 0
    );
  } else {
    const a = r(1, 5);
    const b = r(1, 5) * sign(r);
    const m = r(1, 3);
    const n = r(1, 3);
    u = [a * m, b * m];
    if (kind === "perpendicular") v = [-b * n, a * n];
    else if (kind === "same") v = [a * n, b * n];
    else v = [-a * n, -b * n];
  }
  const dot = u[0] * v[0] + u[1] * v[1];
  const cross = u[0] * v[1] - u[1] * v[0];
  const labels = {
    perpendicular: "The vectors are perpendicular.",
    same: "The vectors are parallel and point in the same direction.",
    opposite: "The vectors are parallel and point in opposite directions.",
    neither: "The vectors are neither perpendicular nor parallel.",
  };
  const why: Record<keyof typeof labels, string> = {
    perpendicular: "Their dot product is 0, so they are perpendicular.",
    same: "One vector is a positive multiple of the other, so the angle is $0^\\circ$.",
    opposite:
      "One vector is a negative multiple of the other, so the angle is $180^\\circ$.",
    neither:
      "The dot product is not 0, and neither vector is a multiple of the other.",
  };
  const wrongs: Wrong[] = (Object.keys(labels) as (keyof typeof labels)[])
    .filter((k) => k !== kind)
    .map((k) => ({
      label: labels[k],
      feedback: `That does not fit: for these vectors the dot product is ${dot} and the cross-check $u_{1}v_{2}-u_{2}v_{1}$ is ${cross}. ${why[kind]}`,
    }));
  return {
    variant: `relationship-${kind}`,
    prompt: `Which statement describes $\\mathbf{u}=${vec(u[0], u[1])}$ and $\\mathbf{v}=${vec(v[0], v[1])}$?`,
    answer: "",
    hint: `Find the dot product of $${vec(u[0], u[1])}$ and $${vec(v[0], v[1])}$. A dot product of 0 means perpendicular. If it is not 0, check whether one vector is a multiple of the other.`,
    explanation: [
      `Dot product: $(${u[0]})(${v[0]})+(${u[1]})(${v[1]})=${dot}$.`,
      `Check for a multiple: $u_{1}v_{2}-u_{2}v_{1}=(${u[0]})(${v[1]})-(${u[1]})(${v[0]})=${cross}$.`,
      why[kind]!,
    ],
    choices: choicesFrom(r, labels[kind], wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* Polynomials, even and odd                                               */
/* ---------------------------------------------------------------------- */

/** Coefficients by exponent: c[i] multiplies x^i. */
type Poly = number[];
function polyText(c: Poly, v = "x"): string {
  const parts: string[] = [];
  for (let i = c.length - 1; i >= 0; i--) {
    const k = c[i]!;
    if (k === 0) continue;
    const body =
      i === 0
        ? String(Math.abs(k))
        : `${Math.abs(k) === 1 ? "" : Math.abs(k)}${v}${i === 1 ? "" : `^{${i}}`}`;
    if (parts.length === 0) parts.push(`${k < 0 ? "-" : ""}${body}`);
    else parts.push(`${k < 0 ? "-" : "+"} ${body}`);
  }
  return parts.length ? parts.join(" ") : "0";
}
const polyAdd = (a: Poly, b: Poly): Poly =>
  Array.from(
    { length: Math.max(a.length, b.length) },
    (_, i) => (a[i] ?? 0) + (b[i] ?? 0),
  );
const polyNeg = (a: Poly): Poly => a.map((k) => -k);
const polyMul = (a: Poly, b: Poly): Poly => {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return out;
};
const polyEval = (a: Poly, x: number) =>
  a.reduce((s, k, i) => s + k * x ** i, 0);
const polyAt = (a: Poly) => a.map((k, i) => (i % 2 ? -k : k));
const trim = (a: Poly): Poly => {
  const out = [...a];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
};

type Parity = "even" | "odd" | "neither";
function parity(c: Poly): Parity {
  const idx = c.map((k, i) => (k !== 0 ? i : -1)).filter((i) => i >= 0);
  if (idx.every((i) => i % 2 === 0)) return "even";
  if (idx.every((i) => i % 2 === 1)) return "odd";
  return "neither";
}
function randomParity(r: Random, want: Parity): Poly {
  const nz = () => r(1, 6) * sign(r);
  for (let tries = 0; tries < 200; tries++) {
    const c: Poly = [0, 0, 0, 0, 0, 0];
    if (want === "even") {
      c[0] = r(0, 1) ? nz() : 0;
      c[2] = nz();
      if (r(0, 1)) c[4] = nz();
    } else if (want === "odd") {
      c[1] = nz();
      if (r(0, 1)) c[3] = nz();
      if (r(0, 2) === 0) c[5] = nz();
    } else {
      c[r(0, 1)] = nz();
      c[2 + r(0, 1)] = nz();
      if (r(0, 1)) c[4 + r(0, 1)] = nz();
    }
    const t = trim(c);
    if (parity(t) === want && t.some((k) => k !== 0)) return t;
  }
  throw new Error("No polynomial found");
}

const parityName: Record<Parity, string> = {
  even: "even",
  odd: "odd",
  neither: "neither even nor odd",
};

function evenOdd(r: Random): Built {
  if (r(0, 1)) {
    const want = pick(r, ["even", "odd", "neither"] as Parity[]);
    const others = (["even", "odd", "neither"] as Parity[]).filter(
      (p) => p !== want,
    );
    const correct = randomParity(r, want);
    const pool: Wrong[] = [];
    for (let i = 0; i < 12; i++) {
      const p = others[r(0, 1)]!;
      const c = randomParity(r, p);
      const fx = polyText(c);
      const fneg = polyText(polyAt(c));
      pool.push({
        label: tex(`f(x)=${fx}`),
        feedback: `$f(-x)=${fneg}$, which makes $f$ ${parityName[p]}. The question asks for ${parityName[want]}.`,
      });
    }
    const label = tex(`f(x)=${polyText(correct)}`);
    const choices = choicesFrom(r, label, pool);
    return {
      variant: `choose-${want}`,
      prompt: `Which function is ${parityName[want]}?`,
      answer: "",
      hint: `A term $kx^n$ becomes $k(-x)^n$ when $x$ is replaced by $-x$. Its sign changes when $n$ is odd and stays when $n$ is even. ${want === "even" ? "Every term of an even function keeps its sign." : want === "odd" ? "Every term of an odd function changes sign." : "A function that is neither has some terms that change sign and some that do not."}`,
      explanation: [
        `A function is even when $f(-x)=f(x)$, odd when $f(-x)=-f(x)$, and neither otherwise.`,
        `For ${label}, $f(-x)=${polyText(polyAt(correct))}$, which is ${parityName[want]}.`,
        `The other three functions have a different relationship between $f(-x)$ and $f(x)$.`,
      ],
      choices,
    };
  }
  const want = pick(r, ["even", "odd", "neither"] as Parity[]);
  const c = randomParity(r, want);
  const fneg = polyAt(c);
  const fx = polyText(c);
  const fnegText = polyText(fneg);
  const statement = (p: Parity, text: string) =>
    tex(`f(-x)=${text}`) +
    (p === "even"
      ? ", so $f$ is even"
      : p === "odd"
        ? ", so $f$ is odd"
        : ", so $f$ is neither even nor odd");
  const correct = statement(want, fnegText);
  const wrongs: Wrong[] = (["even", "odd", "neither"] as Parity[])
    .filter((p) => p !== want)
    .map((p) => ({
      label: statement(p, fnegText),
      feedback: `$f(-x)=${fnegText}$ is correct here, but compare it with $f(x)$ and $-f(x)$: that makes $f$ ${parityName[want]}, not ${parityName[p]}.`,
    }));
  wrongs.push(
    want === "even"
      ? {
          label: statement("odd", polyText(polyNeg(c))),
          feedback:
            "Replacing $x$ by $-x$ does not negate the whole function. Even powers keep their sign.",
        }
      : {
          label: statement("even", fx),
          feedback:
            "An odd power changes sign when $x$ becomes $-x$, so $f(-x)$ is not equal to $f(x)$ term by term.",
        },
  );
  return {
    variant: `classify-${want}`,
    prompt: `Let $f(x)=${fx}$. Which statement correctly finds $f(-x)$ and classifies $f$?`,
    answer: "",
    hint: `Replace every $x$ in $f(x)=${fx}$ by $-x$. A term $kx^n$ becomes $k(-x)^n$, whose sign depends on whether $n$ is even or odd.`,
    explanation: [
      `Replace $x$ by $-x$: $f(-x)=${fnegText}$.`,
      `Compare with $f(x)=${fx}$ and with $-f(x)=${polyText(polyNeg(c))}$.`,
      `$f(-x)$ ${want === "even" ? "equals $f(x)$" : want === "odd" ? "equals $-f(x)$" : "equals neither"}, so $f$ is ${parityName[want]}.`,
    ],
    choices: choicesFrom(r, correct, wrongs),
  };
}
/* ---------------------------------------------------------------------- */
/* Arithmetic of functions                                                 */
/* ---------------------------------------------------------------------- */

const frac = (n: number, d: number): string => {
  const g = gcd(n, d) || 1;
  const nn = (n / g) * (d < 0 ? -1 : 1);
  const dd = Math.abs(d / g);
  return dd === 1
    ? String(nn)
    : `${nn < 0 ? "-" : ""}\\frac{${Math.abs(nn)}}{${dd}}`;
};

function functionArithmetic(r: Random): Built {
  const variant = ["sum", "difference", "product", "domain", "value"][r(0, 4)]!;
  const nz = (lo: number, hi: number) => {
    const v = r(lo, hi);
    return v === 0 ? 1 : v;
  };
  const quad = (): Poly => [r(-6, 6), nz(-5, 5), nz(1, 4) * sign(r)];
  const lin = (): Poly => [r(-7, 7), nz(1, 5) * sign(r)];
  const fTex = (c: Poly) => polyText(c);
  const header = (f: Poly, g: Poly) =>
    `Let $f(x)=${fTex(f)}$ and $g(x)=${fTex(g)}$.`;
  if (variant === "sum" || variant === "difference") {
    const f = quad();
    const g = r(0, 1) ? quad() : lin();
    const diff = variant === "difference";
    const correct = diff ? polyAdd(f, polyNeg(g)) : polyAdd(f, g);
    const label = (c: Poly) => tex(fTex(trim(c)));
    const wrongs: Wrong[] = [];
    const push = (c: Poly, feedback: string) =>
      wrongs.push({ label: label(c), feedback });
    if (diff) {
      push(
        polyAdd(f, g),
        "That adds $g$. The difference subtracts every term of $g$.",
      );
      push(
        polyAdd(
          f,
          g.map((k, i) => (i === g.length - 1 ? -k : k)),
        ),
        "Subtract the whole expression $g(x)$: the sign of every term in $g$ changes, not only the first term written.",
      );
      push(
        polyAdd(g, polyNeg(f)),
        "That is $g(x)-f(x)$. The order matters in a difference.",
      );
      push(
        polyMul(f, g),
        "That multiplies the functions instead of subtracting.",
      );
    } else {
      push(
        polyAdd(f, polyNeg(g)),
        "That subtracts $g$. The sum adds like terms.",
      );
      push(polyMul(f, g), "That multiplies the functions instead of adding.");
      push(
        polyAdd(
          f,
          g.map((k, i) => (i === 1 ? 0 : k)),
        ),
        "The $x$ term of $g$ is missing. Add every pair of like terms.",
      );
      push(
        polyAdd(
          f,
          g.map((k, i) => (i === 0 ? -k : k)),
        ),
        "The constant terms are added like the others, not subtracted.",
      );
    }
    return {
      variant,
      prompt: `${header(f, g)} Which expression is $(${diff ? "f-g" : "f+g"})(x)$?`,
      answer: "",
      hint: `$(${diff ? "f-g" : "f+g"})(x)$ means $f(x)${diff ? "-" : "+"}g(x)$, here $(${fTex(f)})${diff ? "-" : "+"}(${fTex(g)})$. ${diff ? "Keep $g(x)$ in parentheses so the minus sign reaches every term." : "Line up like terms with the same power of $x$."}`,
      explanation: [
        `$(${diff ? "f-g" : "f+g"})(x)=f(x)${diff ? "-" : "+"}g(x)=(${fTex(f)})${diff ? "-" : "+"}(${fTex(g)})$.`,
        diff
          ? "Change the sign of every term in $g(x)$, then combine like terms."
          : "Combine like terms.",
        `The result is ${label(correct)}.`,
      ],
      choices: choicesFrom(r, label(correct), wrongs),
    };
  }
  if (variant === "product") {
    const f = lin();
    const g = lin();
    const correct = polyMul(f, g);
    const label = (c: Poly) => tex(fTex(trim(c)));
    const wrongs: Wrong[] = [
      {
        label: label([f[0]! * g[0]!, 0, f[1]! * g[1]!]),
        feedback:
          "That multiplies only the first terms and the last terms. Every term of $f$ multiplies every term of $g$, so the middle term is missing.",
      },
      {
        label: label(polyAdd(f, g)),
        feedback: "That adds the functions instead of multiplying them.",
      },
      {
        label: label([
          f[0]! * g[0]!,
          f[0]! * g[1]! + f[1]! * g[0]! + 1,
          f[1]! * g[1]!,
        ]),
        feedback:
          "Check the middle term: add the two cross products $f_{0}g_{1}$ and $f_{1}g_{0}$ exactly.",
      },
      {
        label: label([
          f[0]! * g[0]!,
          f[0]! * g[1]! - f[1]! * g[0]!,
          f[1]! * g[1]!,
        ]),
        feedback: "Both cross products are added to make the middle term.",
      },
    ];
    return {
      variant,
      prompt: `${header(f, g)} Which expression is $(fg)(x)$?`,
      answer: "",
      hint: `$(fg)(x)=f(x)\\cdot g(x)$. Multiply every term of $(${fTex(f)})$ by every term of $(${fTex(g)})$, then combine like terms.`,
      explanation: [
        `$(fg)(x)=(${fTex(f)})(${fTex(g)})$.`,
        "Multiply each term of the first factor by each term of the second.",
        `Combine like terms to get ${label(correct)}.`,
      ],
      choices: choicesFrom(r, label(correct), wrongs),
    };
  }
  if (variant === "domain") {
    const two = r(0, 1) === 1;
    const p = r(1, 6);
    let q = r(1, 6);
    if (two && q === p) q = (p % 6) + 1;
    const g: Poly = two ? polyMul([-p, 1], [q, 1]) : [-p, 1];
    let s = r(-6, 6);
    while ([p, -p, q, -q].includes(s)) s = r(-6, 6);
    const f: Poly = [-s, 1];
    const lab = (xs: number[]) =>
      tex(xs.map((x) => `x\\ne ${x}`).join("\\text{ and }"));
    const correct = lab(two ? [p, -q] : [p]);
    const wrongs: Wrong[] = [
      {
        label: lab(two ? [-p, q] : [-p]),
        feedback:
          "Solve $g(x)=0$ carefully: the excluded value makes a factor equal 0, so the sign of each number is reversed from the factor.",
      },
      {
        label: lab([s]),
        feedback:
          "That excludes the zero of $f$, the numerator. A quotient is undefined only where the denominator $g(x)$ is 0.",
      },
      {
        label: two ? lab([p]) : tex("\\text{all real numbers}"),
        feedback: two
          ? "$g$ has two zeros. Exclude both of them."
          : "$g(x)$ is 0 at one value of $x$, and the quotient is undefined there.",
      },
      {
        label: tex("\\text{all real numbers}"),
        feedback:
          "The quotient is undefined where $g(x)=0$, so some values must be excluded.",
      },
      {
        label: lab(two ? [-q] : [p + 1]),
        feedback: "Set $g(x)=0$ and solve for every solution.",
      },
    ];
    return {
      variant: two ? "domain-two-zeros" : "domain-one-zero",
      prompt: `${header(f, g)} What is the domain of $\\left(\\dfrac{f}{g}\\right)(x)$?`,
      answer: "",
      hint: `$\\dfrac{f(x)}{g(x)}$ is undefined where $g(x)=0$. Set $${fTex(g)}=0$ and solve.`,
      explanation: [
        `$\\left(\\frac{f}{g}\\right)(x)=\\frac{f(x)}{g(x)}$ is defined when $g(x)\\ne0$.`,
        two
          ? `Factor $${fTex(g)}=(x-${p})(x+${q})$, so $g(x)=0$ at $x=${p}$ and $x=${-q}$.`
          : `$${fTex(g)}=0$ at $x=${p}$.`,
        `The domain is all real numbers except those values: ${correct}.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  }
  const f = lin();
  const g = quad();
  let a = r(-4, 4);
  while (polyEval(g, a) === 0) a = r(-4, 4);
  const fa = polyEval(f, a);
  const ga = polyEval(g, a);
  const correct = tex(frac(fa, ga));
  const cand: [string, string][] = [
    [
      frac(ga, fa === 0 ? 1 : fa),
      "That divides $g(a)$ by $f(a)$, the reverse of $\\frac{f}{g}$.",
    ],
    [frac(fa - ga, 1), "That subtracts the values instead of dividing."],
    [frac(fa * ga, 1), "That multiplies the values instead of dividing."],
    [frac(fa + ga, 1), "That adds the values instead of dividing."],
  ];
  const wrongs: Wrong[] = cand.map(([n, f2]) => ({
    label: tex(n),
    feedback: f2,
  }));
  return {
    variant,
    prompt: `${header(f, g)} What is $\\left(\\dfrac{f}{g}\\right)(${a})$?`,
    answer: "",
    hint: `$\\left(\\frac{f}{g}\\right)(${a})=\\dfrac{f(${a})}{g(${a})}$. Evaluate the top and bottom functions at $x=${a}$ separately.`,
    explanation: [
      `$f(${a})=${fa}$ and $g(${a})=${ga}$.`,
      `$\\left(\\frac{f}{g}\\right)(${a})=\\frac{${fa}}{${ga}}$, which is ${correct}.`,
    ],
    choices: choicesFrom(r, correct, wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* Trapezoids                                                              */
/* ---------------------------------------------------------------------- */

function trapezoid(r: Random): Built {
  const variant = [
    "midsegment",
    "midsegment-base",
    "midsegment-algebra",
    "base-angle",
    "leg-angle",
    "diagonal",
  ][r(0, 5)]!;
  const setup = "In trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$";
  if (variant === "midsegment") {
    const b1 = r(4, 30);
    const b2 = b1 + 2 * r(1, 10);
    return {
      variant,
      prompt: `${setup}, $AB=${b1}$ and $DC=${b2}$. $\\overline{MN}$ joins the midpoints of the legs $\\overline{AD}$ and $\\overline{BC}$. Find $MN$.`,
      answer: String((b1 + b2) / 2),
      hint: `The segment joining the midpoints of the legs is parallel to the bases. Its length uses both bases: think of the average of ${b1} and ${b2}.`,
      explanation: [
        "The midsegment of a trapezoid is parallel to the bases and its length is the average of the base lengths.",
        `$MN=\\frac{${b1}+${b2}}{2}=\\frac{${b1 + b2}}{2}=${(b1 + b2) / 2}$.`,
      ],
    };
  }
  if (variant === "midsegment-base") {
    const b1 = r(4, 24);
    const m = b1 + r(2, 12);
    return {
      variant,
      prompt: `${setup} and $AB=${b1}$. The midsegment $\\overline{MN}$ joins the midpoints of the legs and $MN=${m}$. Find $DC$.`,
      answer: String(2 * m - b1),
      hint: `The midsegment is the average of the two bases. Write $${m}=\\frac{${b1}+DC}{2}$ and solve for $DC$.`,
      explanation: [
        `$MN=\\frac{AB+DC}{2}$, so $${m}=\\frac{${b1}+DC}{2}$.`,
        `Multiply both sides by 2: $${2 * m}=${b1}+DC$.`,
        `$DC=${2 * m}-${b1}=${2 * m - b1}$.`,
      ],
    };
  }
  if (variant === "midsegment-algebra") {
    const x = r(2, 9);
    const p1 = r(1, 4);
    const p2 = r(1, 4);
    let q1 = r(1, 8);
    const q2 = r(1, 8);
    if ((p1 * x + q1 + p2 * x + q2) % 2) q1 += 1;
    const m = (p1 * x + q1 + p2 * x + q2) / 2;
    const top = polyText([q1, p1]);
    const bottom = polyText([q2, p2]);
    const coefficient = p1 + p2;
    const constant = q1 + q2;
    return {
      variant,
      prompt: `${setup}, $AB=${top}$ and $DC=${bottom}$. The midsegment joining the midpoints of the legs has length ${m}. Find $AB$.`,
      answer: String(p1 * x + q1),
      hint: `Set the average of the two bases equal to ${m}: $\\frac{(${top})+(${bottom})}{2}=${m}$. Solve for $x$ first, then substitute into the expression for $AB$.`,
      explanation: [
        `The midsegment is the average of the bases: $\\frac{(${top})+(${bottom})}{2}=${m}$.`,
        `Combine: $\\frac{${coefficient}x+${constant}}{2}=${m}$, so $${coefficient}x+${constant}=${2 * m}$ and $x=${x}$.`,
        `$AB=${top}$ with $x=${x}$ is ${p1 * x + q1}.`,
      ],
    };
  }
  const iso =
    "In isosceles trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{AD}\\cong\\overline{BC}$";
  if (variant === "base-angle") {
    const x = r(5, 20);
    const m1 = r(2, 4);
    const m2 = m1 + r(1, 2);
    const k1 = r(1, 12);
    const k2 = k1 - (m2 - m1) * x;
    const angle = m1 * x + k1;
    if (angle < 40 || angle > 120) return trapezoid(r);
    return {
      variant,
      prompt: `${iso}. The measure of $\\angle D$ is $(${polyText([k1, m1])})^\\circ$ and the measure of $\\angle C$ is $(${polyText([k2, m2])})^\\circ$. Find the measure of $\\angle C$ in degrees.`,
      answer: String(angle),
      hint: `$\\angle D$ and $\\angle C$ are the two angles on the same base $\\overline{DC}$. Think about what the equal legs say about $(${polyText([k1, m1])})^\\circ$ and $(${polyText([k2, m2])})^\\circ$, then write an equation in $x$.`,
      explanation: [
        "The base angles of an isosceles trapezoid are congruent: the two angles on the same base have equal measure.",
        `$\\angle C$ and $\\angle D$ are both on base $\\overline{DC}$, so $${polyText([k2, m2])}=${polyText([k1, m1])}$ and $x=${x}$.`,
        `$m\\angle C=${polyText([k2, m2])}$ with $x=${x}$ is $${angle}^\\circ$.`,
      ],
    };
  }
  if (variant === "leg-angle") {
    const d = r(50, 80);
    return {
      variant,
      prompt: `${iso}. The measure of $\\angle D$ is $${d}^\\circ$. Find the measure of $\\angle A$ in degrees.`,
      answer: String(180 - d),
      hint: `Leg $\\overline{AD}$ is a transversal of the parallel lines $AB$ and $DC$. Decide how $\\angle A$ and the $${d}^\\circ$ angle $\\angle D$ are related.`,
      explanation: [
        "$\\overline{AB}\\parallel\\overline{DC}$, so $\\angle A$ and $\\angle D$ are consecutive interior angles along the leg $\\overline{AD}$. They are supplementary.",
        `$m\\angle A=180^\\circ-${d}^\\circ=${180 - d}^\\circ$.`,
      ],
    };
  }
  const x = r(3, 12);
  const m1 = r(2, 4);
  const k1 = r(1, 6);
  const m2 = 1;
  const k2 = m1 * x - k1 - m2 * x;
  if (k2 < 1) return trapezoid(r);
  return {
    variant,
    prompt: `${iso}. Its diagonals have lengths $AC=${polyText([-k1, m1])}$ and $BD=${polyText([k2, m2])}$. Find $AC$.`,
    answer: String(m1 * x - k1),
    hint: `The diagonals of an isosceles trapezoid are congruent. Set $${polyText([-k1, m1])}=${polyText([k2, m2])}$, solve for $x$, then substitute into $AC$.`,
    explanation: [
      "The diagonals of an isosceles trapezoid are congruent, so $AC=BD$.",
      `$${polyText([-k1, m1])}=${polyText([k2, m2])}$ gives $x=${x}$.`,
      `$AC=${polyText([-k1, m1])}$ with $x=${x}$ is ${m1 * x - k1}.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */

const builders: Record<string, (r: Random) => Built> = {
  "fl-equation-truth-20": equationTruth("g1"),
  "fl-equation-truth-100": equationTruth("g2"),
  "fl-equation-truth-mult-div": equationTruth("g3"),
  "fl-equation-truth-whole": equationTruth("g4"),
  "fl-equation-truth-grouped": equationTruth("g5"),
  "fl-decimal-tenth-hundredth-step": decimalStep,
  "fl-decimal-by-tenth-hundredth": decimalByTenth,
  "fl-expression-description-match": expressionMatch,
  "fl-two-step-story-equation": storyEquation,
  "fl-metric-customary-conversion": metricConversion,
  "fl-integer-multiply-divide": integerMulDiv,
  "fl-vector-dot-product": vectorDot,
  "fl-vector-angle": vectorAngle,
  "fl-even-odd-classify": evenOdd,
  "fl-function-arithmetic": functionArithmetic,
  "fl-trapezoid-consequences": trapezoid,
};
export const floridaGapTemplateIds = Object.keys(builders);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function leaks(draft: Draft): boolean {
  const text = `${draft.prompt}\n${draft.hint}`;
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
export function floridaGapCase(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = floridaGapTemplates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    let draft: Built;
    try {
      draft = build(r);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith("Need three") ||
          error.message.startsWith("No polynomial"))
      )
        continue;
      throw error;
    }
    if (leaks(draft)) continue;
    return { variant: draft.variant, problem: assemble(meta, seed, r, draft) };
  }
  throw new Error("Could not generate a problem without leaking the answer");
}

export function generateFloridaGapProblem(templateId: string, seed: string) {
  return floridaGapCase(templateId, seed).problem;
}
