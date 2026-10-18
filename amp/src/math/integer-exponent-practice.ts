import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

export const integerExponentTemplates: readonly TemplateMetadata[] = [
  [
    "negative-integer-power",
    "Evaluate a negative power",
    "Evaluate a nonzero rational base raised to a negative integer exponent.",
  ],
  [
    "product-of-powers-exponent",
    "Multiply powers with the same base",
    "Combine integer exponents in a product with a shared nonzero base.",
  ],
  [
    "quotient-of-powers-exponent",
    "Divide powers with the same base",
    "Combine integer exponents in a quotient with a shared nonzero base.",
  ],
  [
    "power-of-power-exponent",
    "Raise a power to a power",
    "Combine nested integer powers of a nonzero base.",
  ],
].map(([id, title, description]) => ({
  id: id!,
  title: title!,
  description: description!,
  version: 1,
  skillId: "exponent-laws",
  gradeBand: "6–8",
}));

const signed = (n: number) => String(n).replace("-", "−");
const operand = (n: number) => (n < 0 ? `(${signed(n)})` : signed(n));
const power = (base: string, n: number) => `${base}^${operand(n)}`;
function fraction(n: number, d: number): string {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return d === a ? String(n / a) : `${n / a}/${d / a}`;
}
function baseText(n: number, d: number): string {
  return d === 1 ? operand(n) : `(${signed(n)} / ${d})`;
}
function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return lo + (value % span);
  };
}
export function integerExponentPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[] } {
  const metadata = integerExponentTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown integer-exponent template ${id}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed),
    tags: string[] = [];
  let prompt: string, answer: string, hint: string, explanation: string[];
  if (id === "negative-integer-power") {
    let n: number, d: number;
    do {
      n = r(1, 5) * (r(0, 1) ? -1 : 1);
      d = r(1, 5);
    } while (Math.abs(n) === d);
    const reduced = fraction(n, d).split("/").map(Number);
    n = reduced[0]!;
    d = reduced[1] ?? 1;
    const magnitude = r(1, 4),
      base = baseText(n, d),
      reciprocal = baseText(n < 0 ? -d : d, Math.abs(n));
    answer = fraction(d ** magnitude, n ** magnitude);
    prompt = `Evaluate ${power(base, -magnitude)}. Give an exact fraction or whole number.`;
    hint =
      "A negative exponent means take a reciprocal: exchange the numerator and denominator, then use the positive exponent.";
    const positivePower = fraction(n ** magnitude, d ** magnitude).replace(
      "-",
      "−",
    );
    explanation = [
      `The base is nonzero. The exponent ${signed(-magnitude)} means the reciprocal of the ${magnitude === 1 ? "first" : magnitude === 2 ? "second" : magnitude === 3 ? "third" : "fourth"} power.`,
      `Take the reciprocal and make the exponent positive: ${power(base, -magnitude)} = ${power(reciprocal, magnitude)}.`,
      `Raise the numerator and denominator to that power: ${power(reciprocal, magnitude)} = ${answer.replace("-", "−")}.`,
      n < 0
        ? `The base is negative. ${magnitude % 2 ? "An odd" : "An even"} number of negative factors gives a ${magnitude % 2 ? "negative" : "positive"} result.`
        : "The reciprocal of a positive number is positive.",
      `Check the reciprocal: ${answer.replace("-", "−")} × ${positivePower.startsWith("−") ? `(${positivePower})` : positivePower} = 1.`,
    ];
    tags.push(
      n < 0 ? "negative-base" : "positive-base",
      d === 1 ? "integer-base" : "fraction-base",
      magnitude % 2 ? "odd" : "even",
    );
  } else {
    const a = r(-6, 6),
      b = r(-6, 6),
      left = power("x", a),
      right = power("x", b);
    const operation =
      id === "product-of-powers-exponent"
        ? "product"
        : id === "quotient-of-powers-exponent"
          ? "quotient"
          : "power";
    const result =
      operation === "product"
        ? a + b
        : operation === "quotient"
          ? a - b
          : a * b;
    const expression =
      operation === "product"
        ? `${left} × ${right}`
        : operation === "quotient"
          ? `${left} ÷ ${right}`
          : power(`(${left})`, b);
    prompt = `For every nonzero real x, ${expression} = x^k. What is k?`;
    answer = String(result);
    hint =
      operation === "product"
        ? "The base stays x. Add the two exponents, retaining each sign."
        : operation === "quotient"
          ? "The base stays x. Subtract the denominator's exponent from the numerator's exponent; subtracting a negative means adding."
          : "Multiply the inner exponent by the outer exponent. Do not add them.";
    const calculation = `${signed(a)} ${operation === "product" ? "+" : operation === "quotient" ? "−" : "×"} ${operand(b)} = ${signed(result)}`;
    explanation = [
      "The letter x represents the same nonzero real number throughout. The letter k is the exponent to find.",
      operation === "product"
        ? "For powers with the same base, multiplication adds the exponents. This rule also includes zero exponents and reciprocal factors from negative exponents."
        : operation === "quotient"
          ? "Dividing by a power is multiplying by its reciprocal. Negate the denominator's exponent, then add; this is subtraction of exponents."
          : "Raising a power to an integer power multiplies the exponents. A negative outer exponent takes the reciprocal; a zero outer exponent gives 1.",
      `Calculate the exponent: ${calculation}.`,
      `Therefore ${expression} = ${power("x", result)}, so k = ${signed(result)}.`,
      ...(result === 0
        ? [
            "The result is x^0 = 1 because x is nonzero. The requested exponent is 0, not the value 1.",
          ]
        : result < 0
          ? [
              `The negative exponent represents a reciprocal: ${power("x", result)} = 1 / ${power("x", -result)}.`,
            ]
          : []),
    ];
    tags.push(
      result < 0
        ? "negative-result"
        : result === 0
          ? "zero-result"
          : "positive-result",
      a === 0 || b === 0 ? "zero-input" : "nonzero-input",
      a < 0 && b < 0
        ? "both-negative"
        : a < 0 || b < 0
          ? "one-negative"
          : "nonnegative-inputs",
    );
  }
  return {
    tags,
    problem: {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([id, 1, seed]))
          .digest("hex"),
        templateId: id,
        templateVersion: 1,
        seed,
        prompt,
        skillId: metadata.skillId,
        response: {
          kind: id === "negative-integer-power" ? "fraction" : "number",
          label: id === "negative-integer-power" ? "Exact value" : "Exponent k",
        },
      },
      answer,
      hint,
      explanation,
    },
  };
}
export function generateIntegerExponentProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return integerExponentPrintCase(id, seed).problem;
}
