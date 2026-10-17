import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts.js";
export const generatorVersion = 1 as const;
export const extendedTemplates: readonly TemplateMetadata[] = [
  [
    "divide-facts",
    "Division facts",
    "division-facts",
    "3–5",
    "Divide whole numbers into equal groups.",
  ],
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
    "integer-power",
    "Evaluate powers",
    "integer-powers",
    "6–8",
    "Evaluate a whole-number base raised to a nonnegative integer exponent.",
  ],
  [
    "line-slope",
    "Slope through two points",
    "slope",
    "6–8",
    "Find slope as change in y divided by change in x.",
  ],
  [
    "linear-system-x",
    "Solve a linear system",
    "linear-systems",
    "9–12",
    "Find x in a system with a unique integer solution.",
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
  switch (templateId) {
    case "divide-facts": {
      const d = r(2, 12),
        q = r(2, 12),
        n = d * q;
      prompt = `What is ${n} ÷ ${d}?`;
      answer = `${q}`;
      hint = "Ask which number multiplied by the divisor gives the dividend.";
      explanation = [
        `Find the number of groups of ${d} in ${n}.`,
        `${d} × ${q} = ${n}, so ${n} ÷ ${d} = ${q}.`,
      ];
      break;
    }
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
      hint = "A digit’s value is the digit multiplied by its place value.";
      explanation = [
        `The ${names[place]} digit is ${digits[place]}.`,
        `${digits[place]} × ${10 ** place} = ${answer}.`,
      ];
      break;
    }
    case "decimal-addition": {
      const a = r(1, 999),
        b = r(1, 999);
      prompt = `What is ${decimal(a, 2)} + ${decimal(b, 2)}?`;
      answer = decimal(a + b, 2);
      hint = "Align decimal points so you add equal place values.";
      explanation = [
        `The numbers are ${a} hundredths and ${b} hundredths.`,
        `${a} + ${b} = ${a + b} hundredths, or ${decimal(a + b, 2)}.`,
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
      hint = "Rename both fractions using the same positive denominator.";
      explanation = [
        `With denominator ${b * d}, the fractions are ${a * d}/${b * d} and ${c * b}/${b * d}.`,
        `${Math.max(a * d, c * b)} is larger than ${Math.min(a * d, c * b)}, so the larger fraction is ${answer}.`,
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
      hint = "Multiply numerators, multiply denominators, then simplify.";
      explanation = [
        `The numerator product is ${a} × ${c} = ${a * c}.`,
        `The denominator product is ${b} × ${d} = ${b * d}.`,
        `${a * c}/${b * d} = ${answer}.`,
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
      hint = "Multiply by the reciprocal of the nonzero divisor.";
      explanation = [
        `The reciprocal of ${c}/${d} is ${d}/${c}.`,
        `${a}/${b} × ${d}/${c} = ${a * d}/${b * c} = ${answer}.`,
      ];
      break;
    }
    case "ratio-missing": {
      const a = r(1, 8),
        b = r(2, 9),
        scale = r(2, 8);
      prompt = `A paint mix uses ${a} cups of blue for every ${b} cups of white. How many cups of blue are needed for ${b * scale} cups of white at the same ratio?`;
      answer = `${a * scale}`;
      hint =
        "Find the scale factor for white paint and apply it to blue paint.";
      explanation = [
        `${b * scale} ÷ ${b} = ${scale}, so the mix is scaled by ${scale}.`,
        `${a} × ${scale} = ${answer} cups of blue.`,
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
        "Percent means per hundred. Multiply by the fraction with denominator 100.";
      explanation = [
        `${p}% = ${p}/100.`,
        `${p}/100 × ${whole} = ${p * whole}/100 = ${answer}.`,
      ];
      break;
    }
    case "integer-addition": {
      const a = r(-20, 20),
        b = r(-20, 20);
      prompt = `What is (${a}) + (${b})?`;
      answer = `${a + b}`;
      hint =
        "On a number line, adding a positive number moves right and adding a negative number moves left.";
      explanation = [
        `Start at ${a}. Adding ${b} changes the value by ${b}.`,
        `${a} + (${b}) = ${answer}.`,
      ];
      break;
    }
    case "integer-power": {
      const base = r(2, 9),
        exponent = r(0, 5);
      prompt = `What is ${base} raised to the power ${exponent}?`;
      answer = `${base ** exponent}`;
      hint =
        "For a positive exponent, multiply that many copies of the base. A nonzero base to power zero is one.";
      explanation =
        exponent === 0
          ? [`Any nonzero base raised to power zero is 1.`, `${base}^0 = 1.`]
          : [
              `${base}^${exponent} means ${Array(exponent).fill(base).join(" × ")}.`,
              `The product is ${answer}.`,
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
      hint = "Divide the change in y by the corresponding change in x.";
      explanation = [
        `Change in y: ${y1 + dy} − (${y1}) = ${dy}.`,
        `Change in x: ${x1 + dx} − (${x1}) = ${dx}.`,
        `Slope = ${dy}/${dx} = ${answer}.`,
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
      prompt = `Solve for x in the system: ${a}x + ${b}y = ${e}; ${c}x + ${d}y = ${f}.`;
      answer = `${x}`;
      hint =
        "Multiply equations so the y coefficients agree, then subtract to eliminate y.";
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
      hint =
        "Divide the number of favorable counters by the total number of counters.";
      explanation = [
        `There are ${red + blue} counters in total.`,
        `${red} are red, so the probability is ${red}/${red + blue} = ${answer}.`,
      ];
      break;
    }
    case "arithmetic-term": {
      const a = r(-10, 20),
        d = r(-7, 9),
        n = r(3, 12);
      prompt = `An arithmetic sequence has first term ${a} and common difference ${d}. What is term ${n}, with the first term labeled 1?`;
      answer = `${a + (n - 1) * d}`;
      hint = "There are n − 1 equal steps from term 1 to term n.";
      explanation = [
        `There are ${n - 1} steps, each adding ${d}.`,
        `${a} + ${n - 1} × (${d}) = ${answer}.`,
      ];
      break;
    }
    case "function-evaluation": {
      const a = r(1, 5),
        b = r(1, 8),
        c = r(1, 10),
        x = r(-5, 5);
      prompt = `If f(x) = ${a}x² + ${b}x + ${c}, what is f(${x})?`;
      answer = `${a * x * x + b * x + c}`;
      hint =
        "Substitute the input everywhere x appears. Square it before multiplying by the coefficient.";
      explanation = [
        `f(${x}) = ${a} × (${x})² + ${b} × (${x}) + ${c}.`,
        `${a * x * x} + (${b * x}) + ${c} = ${answer}.`,
      ];
      break;
    }
    case "unit-price": {
      const count = r(2, 10),
        price = r(2, 12),
        target = r(2, 12);
      prompt = `${count} identical notebooks cost ${count * price} dollars. At the same unit price, how many dollars do ${target} notebooks cost?`;
      answer = `${target * price}`;
      hint =
        "Find the cost of one notebook before scaling to the requested number.";
      explanation = [
        `One notebook costs ${count * price} ÷ ${count} = ${price} dollars.`,
        `${target} notebooks cost ${target} × ${price} = ${answer} dollars.`,
      ];
      break;
    }
    case "decimal-multiplication": {
      const a = r(1, 99),
        b = r(1, 99);
      prompt = `What is ${decimal(a, 1)} × ${decimal(b, 1)}?`;
      kind = "fraction";
      answer = decimal(a * b, 2);
      hint = "Tenths multiplied by tenths produce hundredths.";
      explanation = [
        `${decimal(a, 1)} = ${a}/10 and ${decimal(b, 1)} = ${b}/10.`,
        `${a * b}/100 = ${decimal(a * b, 2)}.`,
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
      hint = "Evaluate parentheses first, then multiplication, then addition.";
      explanation = [
        `Inside parentheses: ${b} + ${c} = ${b + c}.`,
        `Multiply: ${b + c} × ${d} = ${(b + c) * d}.`,
        `Add: ${a} + ${(b + c) * d} = ${answer}.`,
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
  };
}
