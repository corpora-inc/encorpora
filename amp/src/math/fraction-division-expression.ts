import type { TemplateMetadata } from "./contracts";
import { assemble, random } from "./distribution-practice";

type Variant = "unit" | "proper" | "improper";
export const fractionDivisionExpressionTemplate: TemplateMetadata = {
  id: "fraction-division-expression",
  title: "Read a fraction as division",
  skillId: "fraction-as-division",
  version: 1,
  gradeBand: "3–5",
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the division expression named by a unit, proper, or modest improper fraction.",
};

type Expression = {
  left: number;
  operation: "divide" | "multiply";
  right: number;
  feedback: string;
};
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
function valueKey({ left, operation, right }: Expression): string {
  const numerator = operation === "divide" ? left : left * right;
  const denominator = operation === "divide" ? right : 1;
  const common = gcd(Math.abs(numerator), denominator);
  return `${numerator / common}/${denominator / common}`;
}
const expressionLabel = ({ left, operation, right }: Expression): string =>
  `$${left} ${operation === "divide" ? "\\div" : "\\times"} ${right}$`;

/** One recognition family; seeded ranges vary within a conservative template level. */
export function fractionDivisionExpressionCase(seed: string) {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = fractionDivisionExpressionTemplate;
  const r = random(meta.id, seed);
  const slot = r(0, 9);
  const variant: Variant = slot < 2 ? "unit" : slot < 8 ? "proper" : "improper";
  const denominator = r(
    variant === "unit" ? 2 : 3,
    variant === "improper" ? 9 : 12,
  );
  const numerator =
    variant === "unit"
      ? 1
      : variant === "proper"
        ? r(2, denominator - 1)
        : r(denominator + 1, 2 * denominator - 1);
  const correct: Expression = {
    left: numerator,
    operation: "divide",
    right: denominator,
    feedback: "",
  };
  const alternatives: Expression[] = [
    {
      left: denominator,
      operation: "divide",
      right: numerator,
      feedback: `You put the bottom number first. In a fraction, the top number is the total being shared and the bottom number counts the equal shares, so ${numerator} is divided by ${denominator}, not ${denominator} by ${numerator}.`,
    },
    {
      left: numerator,
      operation: "multiply",
      right: denominator,
      feedback: `You multiplied. The fraction bar means divide: ${numerator} shared equally into ${denominator} parts is ${numerator} ÷ ${denominator}.`,
    },
    {
      left: numerator,
      operation: "divide",
      right: denominator + 1,
      feedback: `This divides by ${denominator + 1}. The bottom number is ${denominator}, so the total is split into ${denominator} equal shares, not ${denominator + 1}.`,
    },
    {
      left: numerator + 1,
      operation: "divide",
      right: denominator,
      feedback: `This shares ${numerator + 1} wholes. The top number is ${numerator}, so the total being shared is ${numerator}; one more whole makes each share bigger.`,
    },
  ];
  const seen = new Set([valueKey(correct)]);
  const wrong = alternatives.filter((expression) => {
    const key = valueKey(expression);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (wrong.length < 3)
    throw new Error("Insufficient distinct fraction expressions");
  return {
    numerator,
    denominator,
    variant,
    problem: assemble(meta, seed, r, {
      prompt: `Which expression has the same value as $\\frac{${numerator}}{${denominator}}$?`,
      answer: "",
      hint: `For $\\frac{${numerator}}{${denominator}}$, imagine sharing ${numerator} whole unit${numerator === 1 ? "" : "s"} equally among ${denominator} people. Identify the total and the share count before choosing.`,
      explanation: [
        `A fraction bar also means "divided by": the top number is shared equally into the number of parts on the bottom.`,
        `Picture ${numerator} whole unit${numerator === 1 ? "" : "s"} shared equally among ${denominator} people. Each person gets $\\frac{${numerator}}{${denominator}}$ of a unit.`,
        `The total being shared is ${numerator}, and the number of shares is ${denominator}, so the division is ${expressionLabel(correct)}.`,
        `Check: ${denominator} shares of $\\frac{${numerator}}{${denominator}}$ make ${numerator} whole unit${numerator === 1 ? "" : "s"}, the whole total.`,
        `So ${expressionLabel(correct)} has the same value as $\\frac{${numerator}}{${denominator}}$.`,
      ],
      choices: [
        { label: expressionLabel(correct), correct: true },
        ...wrong.slice(0, 3).map((expression) => ({
          label: expressionLabel(expression),
          feedback: expression.feedback,
        })),
      ],
    }),
  };
}
