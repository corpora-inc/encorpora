import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemVariant,
  TemplateMetadata,
} from "./contracts.js";
import { exactDecimal, sweepChoose, sweepVariant } from "./number-domain-axes";
import { isAre } from "./agreement.js";
export const generatorVersion = 1 as const;
export const extendedTemplates: readonly TemplateMetadata[] = [
  [
    "place-value-digit",
    "Value of a digit",
    "hundreds-place-value",
    "K–2",
    "Find the value represented by a digit in a three-digit number.",
  ],
  [
    "decimal-addition",
    "Add decimals",
    "decimal-arithmetic",
    "3–5",
    "Add two amounts expressed in hundredths.",
  ],
  [
    "compare-fractions",
    "Compare fractions",
    "fraction-comparison",
    "3–5",
    "Choose the larger of two distinct positive fractions.",
  ],
  [
    "multiply-fractions",
    "Multiply fractions",
    "fraction-multiplication",
    "3–5",
    "Multiply two positive proper fractions.",
  ],
  [
    "divide-fractions",
    "Divide fractions",
    "fraction-division",
    "6–8",
    "Divide a positive fraction by another positive fraction.",
  ],
  [
    "ratio-missing",
    "Equivalent ratios",
    "ratios",
    "6–8",
    "Scale a ratio to find a missing quantity.",
  ],
  [
    "percent-of",
    "Percent of a quantity",
    "percentages",
    "6–8",
    "Find an exact percentage of a whole-number quantity.",
  ],
  [
    "integer-addition",
    "Add signed integers",
    "signed-addition",
    "6–8",
    "Combine positive and negative integer changes.",
  ],
  [
    "line-slope",
    "Slope through two points",
    "slope",
    "6–8",
    "Find slope as change in $y$ divided by change in $x$.",
  ],
  [
    "linear-system-x",
    "Solve a linear system",
    "linear-systems",
    "9–12",
    "Find $x$ in a system with a unique integer solution.",
  ],
  [
    "simple-probability",
    "Probability of one draw",
    "probability",
    "6–8",
    "Find a probability from equally likely objects.",
  ],
  [
    "arithmetic-term",
    "Arithmetic sequences",
    "arithmetic-sequences",
    "6–8",
    "Find a term given the first term and a common difference.",
  ],
  [
    "function-evaluation",
    "Evaluate a function",
    "function-evaluation",
    "9–12",
    "Evaluate a quadratic expression at an integer input.",
  ],
  [
    "unit-price",
    "Proportional cost",
    "proportional-relationships",
    "6–8",
    "Use a constant unit price to find a total cost.",
  ],
  [
    "decimal-multiplication",
    "Multiply decimals",
    "decimal-arithmetic",
    "3–5",
    "Multiply two positive amounts expressed in tenths.",
  ],
  [
    "operation-order",
    "Order of operations",
    "numerical-expressions",
    "3–5",
    "Evaluate an expression with parentheses, multiplication and addition.",
  ],
].map(([id, title, skillId, gradeBand, description]) => ({
  id: id!,
  version: 1,
  title: title!,
  skillId: skillId!,
  gradeBand: gradeBand! as TemplateMetadata["gradeBand"],
  description: description!,
}));
function fraction(n: number, d = 1): string {
  let a = Math.abs(n),
    b = Math.abs(d);
  while (b) [a, b] = [b, a % b];
  const sign = d < 0 ? -1 : 1;
  n = (n / a) * sign;
  d = Math.abs(d) / a;
  return d === 1 ? `${n}` : `${n}/${d}`;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
/** "(−4)" for a negative number written after an operation sign, else "4". */
const signed = (n: number) => (n < 0 ? `(${n})` : `${n}`);
function decimal(n: number, places: number): string {
  return `${Math.floor(n / 10 ** places)}.${String(n % 10 ** places).padStart(places, "0")}`;
}
export function generateExtendedProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = extendedTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  let counter = 0;
  const r = (lo: number, hi: number) => {
    const range = hi - lo + 1,
      ceiling = Math.floor(0x100000000 / range) * range;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= ceiling);
    return lo + (n % range);
  };
  let prompt = "",
    answer = "",
    hint = "";
  let explanation: string[] = [];
  let kind: "number" | "fraction" = "number";
  let variant: ProblemVariant | undefined;
  switch (templateId) {
    case "place-value-digit": {
      const h = r(1, 9),
        t = r(1, 9),
        o = r(1, 9),
        place = r(0, 2),
        digits = [o, t, h],
        names = ["ones", "tens", "hundreds"];
      const n = 100 * h + 10 * t + o;
      prompt = `In ${n}, what value does the digit in the ${names[place]} place represent?`;
      answer = `${digits[place]! * 10 ** place}`;
      hint = `Find the ${names[place]} digit of ${n}: the ${["last", "middle", "first"][place]} digit. Its value is that many ${names[place]}.`;
      const placeValue = [1, 10, 100][place]!;
      explanation = [
        `Each place in a number has a value: ones, then tens, then hundreds, from right to left.`,
        `In ${n}, the ${names[place]} place is the ${["last", "middle", "first"][place]} digit, which is ${digits[place]}.`,
        place === 0
          ? `A digit in the ones place counts single ones, so it means ${digits[place]}.`
          : `A digit in the ${names[place]} place counts groups of ${placeValue}, so it means ${digits[place]} × ${placeValue} = ${answer}.`,
        `The digit in the ${names[place]} place represents ${answer}.`,
      ];
      break;
    }
    case "decimal-addition": {
      const a = r(1, 999),
        b = r(1, 999);
      prompt = `What is ${decimal(a, 2)} + ${decimal(b, 2)}?`;
      answer = decimal(a + b, 2);
      hint = `Line up the decimal points of ${decimal(a, 2)} and ${decimal(b, 2)} so hundredths sit under hundredths. Add from the hundredths, regrouping as with whole numbers.`;
      explanation = [
        `Hundredths are the second place after the decimal point. Both numbers have two places, so both count hundredths.`,
        `${decimal(a, 2)} is ${a} hundredths, and ${decimal(b, 2)} is ${b} hundredths.`,
        `Line up the decimal points so each place adds to the same place. Adding the hundredths is like adding whole numbers: ${a} + ${b} = ${a + b}.`,
        `${a + b} hundredths is ${decimal(a + b, 2)}.`,
        `So ${decimal(a, 2)} + ${decimal(b, 2)} = ${answer}.`,
      ];
      break;
    }
    case "compare-fractions": {
      const b = r(2, 12),
        d = r(2, 12),
        a = r(1, b - 1);
      let c = r(1, d - 1);
      if (a * d === c * b) c++;
      prompt = `Which fraction is larger: ${a}/${b} or ${c}/${d}? Enter that fraction.`;
      kind = "fraction";
      answer = a * d > c * b ? fraction(a, b) : fraction(c, d);
      const common = lcm(b, d),
        left = (a * common) / b,
        right = (c * common) / d;
      hint =
        b === d
          ? `${a}/${b} and ${c}/${d} count pieces of the same size. Compare the numerators.`
          : a === c
            ? `${a}/${b} and ${c}/${d} have the same number of pieces. Which denominator makes larger pieces?`
            : `Rename ${a}/${b} and ${c}/${d} with the common denominator ${common}. Then compare the numerators.`;
      explanation =
        b === d
          ? [
              `The bottom number, the denominator, tells the size of each piece. Both fractions use pieces of size 1/${b}.`,
              `With equal pieces, more pieces means more. Compare the top numbers, the numerators: ${a} and ${c}.`,
              `${Math.max(a, c)} is greater than ${Math.min(a, c)}, so ${answer} is the larger fraction.`,
            ]
          : [
              `The bottom number, the denominator, tells the size of each piece. Pieces of size 1/${b} and 1/${d} are different, so the top numbers cannot be compared yet.`,
              `${common} is a multiple of both ${b} and ${d}, so rename both fractions with pieces of size 1/${common}.`,
              `${a}/${b} = ${left}/${common} and ${c}/${d} = ${right}/${common}.`,
              `Now the pieces are equal, so more pieces means more: ${Math.max(left, right)} is greater than ${Math.min(left, right)}.`,
              `The larger fraction is ${answer}.`,
            ];
      break;
    }
    case "multiply-fractions": {
      const b = r(2, 12),
        d = r(2, 12),
        a = r(1, b - 1),
        c = r(1, d - 1);
      prompt = `What is ${a}/${b} × ${c}/${d}?`;
      kind = "fraction";
      answer = fraction(a * c, b * d);
      const g = Math.max(gcd(a, d), gcd(c, b));
      hint = `Multiply the numerators, ${a} × ${c}, and the denominators, ${b} × ${d}.${g > 1 ? ` Cancel first to keep the numbers small: ${gcd(a, d) > 1 ? `${a} and ${d}` : `${c} and ${b}`} share a factor of ${g}.` : " Then simplify."}`;
      explanation = [
        `${a}/${b} × ${c}/${d} means ${a}/${b} of ${c}/${d}: a part of a part.`,
        `Multiply the top numbers, the numerators, to count the parts you take: ${a} × ${c} = ${a * c}.`,
        `Multiply the bottom numbers, the denominators, to find the new piece size: ${b} × ${d} = ${b * d}, so each piece is 1/${b * d} of the whole.`,
        answer === `${a * c}/${b * d}`
          ? `That gives ${a * c}/${b * d}, which is already in simplest form.`
          : `That gives ${a * c}/${b * d}. Divide the top and bottom by the same number to simplify it: ${answer}.`,
        `So ${a}/${b} × ${c}/${d} = ${answer}.`,
      ];
      break;
    }
    case "divide-fractions": {
      const b = r(2, 12),
        d = r(2, 12),
        a = r(1, b - 1),
        c = r(1, d - 1);
      prompt = `What is ${a}/${b} ÷ ${c}/${d}?`;
      kind = "fraction";
      answer = fraction(a * d, b * c);
      hint = `Dividing by ${c}/${d} is the same as multiplying by its reciprocal, ${d}/${c}. Rewrite it as ${a}/${b} × ${d}/${c}.`;
      explanation = [
        `${a}/${b} ÷ ${c}/${d} asks how many groups of ${c}/${d} fit in ${a}/${b}.`,
        `The reciprocal of a fraction flips it upside down: the reciprocal of ${c}/${d} is ${d}/${c}.`,
        `Dividing by a fraction gives the same answer as multiplying by its reciprocal, so rewrite it as ${a}/${b} × ${d}/${c}.`,
        `Multiply tops and bottoms: ${a} × ${d} = ${a * d} and ${b} × ${c} = ${b * c}, giving ${a * d}/${b * c}${answer === `${a * d}/${b * c}` ? "" : `, which simplifies to ${answer}`}.`,
        `So ${a}/${b} ÷ ${c}/${d} = ${answer}.`,
      ];
      break;
    }
    case "ratio-missing": {
      const axes = sweepChoose("ratio-missing", seed);
      if (axes["scale-factor"] === "decimal") {
        // The white paint is not a whole multiple of the ratio's white: the
        // scale factor and the answer are exact decimals.
        const b = [2, 4, 5, 8][r(0, 3)]!;
        // The blue amount shares no factor with the white, so the answer is
        // whole only when the white target is a multiple of it.
        let a = r(2, 9);
        while (a % 2 === 0 && b !== 5) a = r(2, 9);
        while (b === 5 && a % 5 === 0) a = r(2, 9);
        let white = r(b + 1, 6 * b);
        while (white % b === 0) white = r(b + 1, 6 * b);
        const factor = exactDecimal(white, b);
        answer = exactDecimal(a * white, b);
        prompt = `A paint mix uses ${a} cups of blue for every ${b} cups of white. How many cups of blue are needed for ${white} cups of white at the same ratio? Give the answer as a decimal.`;
        hint = `${white} cups of white is how many times ${b} cups? That factor is not a whole number, so write it as a decimal. Scale the ${a} cups of blue by that same factor.`;
        explanation = [
          `A ratio keeps the same mix: ${a} cups of blue go with every ${b} cups of white.`,
          `Find how many times bigger the new batch is: ${white} ÷ ${b} = ${factor}. This number is the scale factor.`,
          `Blue must grow by the same scale factor so the color stays the same: ${a} × ${factor} = ${answer}.`,
          `You need ${answer} cups of blue.`,
        ];
        variant = sweepVariant("decimal-scale", axes);
        break;
      }
      variant = sweepVariant("whole-scale", axes);
      const a = r(1, 8),
        b = r(2, 9),
        scale = r(2, 8);
      prompt = `A paint mix uses ${a} cups of blue for every ${b} cups of white. How many cups of blue are needed for ${b * scale} cups of white at the same ratio?`;
      answer = `${a * scale}`;
      hint = `${b * scale} cups of white is how many times ${b} cups? Scale the ${a} cups of blue by that same factor.`;
      explanation = [
        `A ratio keeps the same mix: ${a === 1 ? "1 cup" : `${a} cups`} of blue ${a === 1 ? "goes" : "go"} with every ${b} cups of white.`,
        `Find how many batches of white you have: ${b * scale} ÷ ${b} = ${scale}. The new mix is ${scale} times as big.`,
        `Blue must grow ${scale} times too, so the color stays the same: ${a} × ${scale} = ${answer}.`,
        `You need ${answer} cups of blue.`,
      ];
      break;
    }
    case "percent-of": {
      const p = r(1, 95),
        whole = r(2, 200);
      prompt = `What is ${p}% of ${whole}?`;
      kind = "fraction";
      answer = fraction(p * whole, 100);
      hint =
        p === 50
          ? `50% is one half. Find half of ${whole}.`
          : p === 25
            ? `25% is one quarter. Split ${whole} into 4 equal parts.`
            : p % 10 === 0
              ? `10% of ${whole} is ${whole} ÷ 10. ${p}% is ${p / 10} times that.`
              : `${p}% means ${p} per hundred, so find ${p}/100 × ${whole}.`;
      explanation = [
        `Percent means "out of 100", so ${p}% is ${p}/100.`,
        `"Of" means multiply: ${p}% of ${whole} is ${p}/100 × ${whole}.`,
        `Multiply the top numbers: ${p} × ${whole} = ${p * whole}, so you get ${p * whole}/100${answer === `${p * whole}/100` ? "" : `, which simplifies to ${answer}`}.`,
        answer.includes("/")
          ? `${p}% of ${whole} is ${answer}, which is ${(p * whole) / 100} as a decimal.`
          : `${p}% of ${whole} is ${answer}.`,
      ];
      break;
    }
    case "integer-addition": {
      const a = r(-20, 20),
        b = r(-20, 20);
      prompt = `What is (${a}) + (${b})?`;
      answer = `${a + b}`;
      hint = b
        ? `Start at ${a} on the number line. Adding ${b} moves ${Math.abs(b)} ${b > 0 ? "right" : "left"}.`
        : `Adding 0 does not move you on the number line from ${a}.`;
      explanation = [
        `On a number line, adding a positive number moves right, and adding a negative number moves left.`,
        `Start at ${a}.`,
        b === 0
          ? `Adding 0 does not move you at all.`
          : `${b} is ${b > 0 ? "positive" : "negative"}, so move ${Math.abs(b)} ${Math.abs(b) === 1 ? "step" : "steps"} ${b > 0 ? "right" : "left"} and land on ${answer}.`,
        `So ${signed(a)} + ${signed(b)} = ${answer}.`,
      ];
      break;
    }
    case "line-slope": {
      const x1 = r(-8, 8),
        y1 = r(-8, 8),
        dx = r(1, 8),
        dy = r(-8, 8);
      prompt = `What is the slope of the line through (${x1}, ${y1}) and (${x1 + dx}, ${y1 + dy})?`;
      kind = "fraction";
      answer = fraction(dy, dx);
      hint = `Slope is the change in $y$ over the change in $x$. Subtract in the same order for both: (${y1 + dy} − ${y1 < 0 ? `(${y1})` : y1}) ÷ (${x1 + dx} − ${x1 < 0 ? `(${x1})` : x1}).`;
      explanation = [
        `Slope measures steepness: how much $y$ changes for each step in $x$. It is the change in $y$ divided by the change in $x$.`,
        `Change in $y$, second point minus first: ${y1 + dy} − ${signed(y1)} = ${dy}.`,
        `Change in $x$, in the same order: ${x1 + dx} − ${signed(x1)} = ${dx}.`,
        `Slope = ${dy} ÷ ${dx}${answer === `${dy}/${dx}` || answer === `${dy}` ? "" : `, which simplifies to ${answer}`}${dy === 0 ? ". The line is flat" : ""}.`,
        `The slope of the line is ${answer}.`,
      ];
      break;
    }
    case "linear-system-x": {
      const a = r(1, 5),
        b = r(1, 5),
        c = r(1, 5);
      let d = r(1, 5);
      if (a * d === b * c) d++;
      const x = r(-8, 8),
        y = r(-8, 8),
        e = a * x + b * y,
        f = c * x + d * y;
      prompt = `Solve for $x$ in the system: ${a}x + ${b}y = ${e}; ${c}x + ${d}y = ${f}.`;
      answer = `${x}`;
      hint =
        b === d
          ? `Both equations have $${b}y$. Subtract one equation from the other to remove $y$.`
          : `To remove $y$, make its coefficients match: multiply the first equation by ${d} and the second by ${b}, then subtract.`;
      explanation = [
        `Multiply the first equation by ${d} and the second by ${b}.`,
        `Subtract: (${a * d} − ${b * c})x = ${e * d} − (${b * f}).`,
        `${a * d - b * c}x = ${e * d - b * f}, so x = ${answer}.`,
      ];
      break;
    }
    case "simple-probability": {
      const red = r(1, 12),
        blue = r(1, 12);
      prompt = `A bag contains ${red} red counters and ${blue} blue counters. Each counter is equally likely to be drawn. What is the probability of drawing a red counter in one draw?`;
      kind = "fraction";
      answer = fraction(red, red + blue);
      hint = `${red} of the counters ${isAre(red)} red, out of ${red} + ${blue} in all. Probability = red counters ÷ all counters.`;
      explanation = [
        `Probability measures how likely something is. With equally likely outcomes, it is the favorable outcomes divided by all outcomes.`,
        `All outcomes: the bag holds ${red} + ${blue} = ${red + blue} counters, and any one can be drawn.`,
        `Favorable outcomes: ${red} of them ${isAre(red)} red.`,
        `So the probability is ${red}/${red + blue}${answer === `${red}/${red + blue}` ? "" : `, which simplifies to ${answer}`}.`,
        `The probability of drawing a red counter is ${answer}.`,
      ];
      break;
    }
    case "arithmetic-term": {
      const a = r(-10, 20),
        d = r(-7, 9),
        n = r(3, 12);
      prompt = `An arithmetic sequence has first term ${a} and common difference ${d}. What is term ${n}, with the first term labeled 1?`;
      answer = `${a + (n - 1) * d}`;
      hint = `From term 1 to term ${n}, count the steps: one fewer than ${n}. Start at ${a} and ${d < 0 ? `subtract ${-d}` : `add ${d}`} for each step.`;
      explanation = [
        `In an arithmetic sequence, each term is the one before plus the same number, the common difference.`,
        `Going from term 1 to term ${n} takes ${n} − 1 = ${n - 1} steps.`,
        d === 0
          ? `The common difference is 0, so every step adds nothing.`
          : `Each step ${d > 0 ? `adds ${d}` : `subtracts ${-d}`}, so ${n - 1} steps change the value by ${n - 1} × ${signed(d)} = ${(n - 1) * d}.`,
        `Start at the first term: ${a} + ${signed((n - 1) * d)} = ${answer}.`,
        `Term ${n} is ${answer}.`,
      ];
      break;
    }
    case "function-evaluation": {
      const a = r(1, 5),
        b = r(1, 8),
        c = r(1, 10),
        x = r(-5, 5);
      prompt = `If f(x) = ${a}x² + ${b}x + ${c}, what is $f(${x})$?`;
      answer = `${a * x * x + b * x + c}`;
      hint = `Replace every $x$ with (${x}): f(${x}) = ${a}(${x})² + ${b}(${x}) + ${c}. Square first${x < 0 ? `; (${x})² is positive` : ""}.`;
      explanation = [
        `f(${x}) = ${a} × (${x})² + ${b} × (${x}) + ${c}.`,
        `${a * x * x} + (${b * x}) + ${c} = ${answer}.`,
      ];
      break;
    }
    case "unit-price": {
      const count = r(2, 10),
        price = r(2, 12),
        asked = r(2, 12),
        // Asking about the same count as given repeats the given total.
        target = asked === count ? (asked === 12 ? 2 : asked + 1) : asked;
      prompt = `${count} identical notebooks cost ${count * price} dollars. At the same unit price, how many dollars do ${target} notebooks cost?`;
      answer = `${target * price}`;
      hint = `First find the cost of one notebook: ${count * price} dollars shared among ${count} notebooks. Then scale to ${target}.`;
      explanation = [
        `The unit price is the cost of one notebook. Every notebook costs the same.`,
        `Share the total cost among the notebooks: ${count * price} ÷ ${count} = ${price}, so one notebook costs ${price} dollars.`,
        `${target} notebooks cost ${target} times as much as one: ${target} × ${price} = ${answer}.`,
        `${target} notebooks cost ${answer} dollars.`,
      ];
      break;
    }
    case "decimal-multiplication": {
      const a = r(1, 99),
        b = r(1, 99);
      prompt = `What is ${decimal(a, 1)} × ${decimal(b, 1)}?`;
      kind = "fraction";
      answer = decimal(a * b, 2);
      hint = `For ${decimal(a, 1)} × ${decimal(b, 1)}, multiply ${a} × ${b} as whole numbers. Tenths times tenths make hundredths, so the product has two decimal places.`;
      explanation = [
        `Tenths are the first place after the decimal point. ${decimal(a, 1)} is ${a} tenths, or ${a}/10, and ${decimal(b, 1)} is ${b} tenths, or ${b}/10.`,
        `Multiply the whole numbers first: ${a} × ${b} = ${a * b}.`,
        `Tenths times tenths make hundredths, because 1/10 × 1/10 = 1/100. So the answer is ${a * b} hundredths.`,
        `${a * b} hundredths has two decimal places: ${decimal(a * b, 2)}.`,
        `So ${decimal(a, 1)} × ${decimal(b, 1)} = ${answer}.`,
      ];
      break;
    }
    case "operation-order": {
      const a = r(1, 12),
        b = r(1, 9),
        c = r(1, 9),
        d = r(2, 8);
      prompt = `Evaluate ${a} + (${b} + ${c}) × ${d}.`;
      answer = `${a + (b + c) * d}`;
      hint = `Work inside the parentheses first: ${b} + ${c}. Then multiply by ${d} before adding ${a}.`;
      explanation = [
        `The order of operations is a shared rule: parentheses first, then multiplying, then adding.`,
        `Parentheses group numbers to work out first: ${b} + ${c} = ${b + c}.`,
        `Multiply next, before any adding: ${b + c} × ${d} = ${(b + c) * d}.`,
        `Add last: ${a} + ${(b + c) * d} = ${answer}.`,
        `The expression equals ${answer}.`,
      ];
      break;
    }
    default:
      throw new Error("Template has no generator");
  }
  const id = createHash("sha256")
    .update(JSON.stringify([templateId, generatorVersion, seed]))
    .digest("hex");
  return {
    public: {
      id,
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: meta.skillId,
      response: {
        kind,
        label:
          kind === "fraction"
            ? "Answer (fraction, decimal, or whole number)"
            : "Answer",
      },
    },
    answer,
    hint,
    explanation,
    ...(variant ? { variant } : {}),
  };
}
