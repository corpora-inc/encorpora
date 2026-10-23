import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random } from "./distribution-practice";

export const successivePercentChangeTemplate: TemplateMetadata = {
  id: "successive-percent-change",
  version: 1,
  title: "Apply two percent changes",
  skillId: "percent-change",
  gradeBand: "6–8",
  difficultyOffset: 0.35,
  description:
    "Apply two ordered nonzero percent changes to a price, using the changed price as the second base and rounding only the final amount to cents.",
};

const rateDenominator = 100_000n; // A rate is stored in thousandths of one percent.
const itemNames = ["book", "lamp", "backpack", "coat", "game"] as const;
type Direction = 1 | -1;
type Draft = {
  first: Direction;
  second: Direction;
  firstRate: number;
  secondRate: number;
  startingCents: number;
  tax: boolean;
  variant: string;
};

function draft(r: ReturnType<typeof random>): Draft {
  const variant = r(0, 9);
  const startingCents = r(800, 25_000);
  const integer = () => 1_000 * r(5, 35);
  const decimal = () =>
    [1_250, 2_500, 6_250, 7_500, 12_500, 17_500, 22_500][r(0, 6)]!;
  switch (variant) {
    case 0: {
      const rate = integer();
      return {
        first: 1,
        second: -1,
        firstRate: rate,
        secondRate: rate,
        startingCents,
        tax: false,
        variant: "equal-opposite-after-increase",
      };
    }
    case 1: {
      const rate = decimal();
      return {
        first: -1,
        second: 1,
        firstRate: rate,
        secondRate: rate,
        startingCents,
        tax: false,
        variant: "equal-opposite-after-decrease",
      };
    }
    case 2:
      return {
        first: -1,
        second: -1,
        firstRate: integer(),
        secondRate: integer(),
        startingCents,
        tax: false,
        variant: "two-discounts",
      };
    case 3:
      return {
        first: -1,
        second: 1,
        firstRate: integer(),
        secondRate: 8_875,
        startingCents,
        tax: true,
        variant: "discount-then-tax",
      };
    case 4:
      return {
        first: 1,
        second: 1,
        firstRate: integer(),
        secondRate: decimal(),
        startingCents,
        tax: false,
        variant: "two-increases",
      };
    case 5:
      return {
        first: 1,
        second: -1,
        firstRate: decimal(),
        secondRate: integer(),
        startingCents,
        tax: false,
        variant: "increase-then-decrease",
      };
    case 6:
      return {
        first: -1,
        second: 1,
        firstRate: decimal(),
        secondRate: integer(),
        startingCents,
        tax: false,
        variant: "decrease-then-increase",
      };
    case 7:
      return {
        first: -1,
        second: -1,
        firstRate: decimal(),
        secondRate: integer(),
        startingCents,
        tax: false,
        variant: "decimal-two-discounts",
      };
    case 8:
      return {
        first: 1,
        second: -1,
        firstRate: 20_000,
        secondRate: 25_000,
        startingCents: 10 * r(80, 2_500),
        tax: false,
        variant: "exact-cent",
      };
    default:
      return {
        first: 1,
        second: -1,
        firstRate: 25_000,
        secondRate: 10_000,
        // 1.25 × 0.90 = 1.125; these prices give exactly half a cent.
        startingCents: 1_004 + 8 * r(0, 2_500),
        tax: false,
        variant: "half-cent-tie",
      };
  }
}

function percent(thousandths: number): string {
  const whole = Math.floor(thousandths / 1_000);
  const decimals = String(thousandths % 1_000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : String(whole);
}

/** Exact positive dollars from an integer numerator in fractional cents. */
function dollars(numerator: bigint, centsDenominator: bigint): string {
  const denominator = centsDenominator * 100n;
  const places = denominator.toString().length - 1;
  if (10n ** BigInt(places) !== denominator)
    throw new Error("Money denominator must be a power of ten");
  const whole = numerator / denominator;
  const fraction = (numerator % denominator)
    .toString()
    .padStart(places, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return `${whole}.${fraction}`;
}

export function successivePercentChangeCase(seed: string): {
  problem: GeneratedProblem;
  tags: string[];
  caseKey: string;
} {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = successivePercentChangeTemplate;
  const r = random(meta.id, seed);
  const input = draft(r);
  const m1 = rateDenominator + BigInt(input.first * input.firstRate);
  const m2 = rateDenominator + BigInt(input.second * input.secondRate);
  const originalCents = BigInt(input.startingCents);
  const firstNumerator = originalCents * m1;
  const finalNumerator = firstNumerator * m2;
  const finalDenominator = rateDenominator * rateDenominator;
  const roundedCents =
    (2n * finalNumerator + finalDenominator) / (2n * finalDenominator);
  const original = dollars(originalCents, 1n);
  const firstExact = dollars(firstNumerator, rateDenominator);
  const finalExact = dollars(finalNumerator, finalDenominator);
  const answer = dollars(roundedCents, 1n);
  const firstRate = percent(input.firstRate);
  const secondRate = percent(input.secondRate);
  const firstVerb = input.first === 1 ? "increases" : "decreases";
  const secondVerb = input.second === 1 ? "increases" : "decreases";
  const firstOperator = input.first === 1 ? "+" : "-";
  const secondOperator = input.second === 1 ? "+" : "-";
  const item = itemNames[r(0, itemNames.length - 1)]!;
  const prompt =
    `A ${item} has a starting price of $${original}. ` +
    `First, the price ${firstVerb} by ${firstRate}%. ` +
    `Then, the price ${secondVerb} by ${secondRate}% of the price after the first change. ` +
    (input.tax ? "The second increase is sales tax. " : "") +
    "What is the final price, in dollars? Keep the exact price after the first change; round only the final price to the nearest cent, with halfway amounts rounded up.";
  const hint =
    `The starting price is $${original}. Find ${firstRate}% of that price and ` +
    `${input.first === 1 ? "add" : "subtract"} it to find the price after the first change. ` +
    `Use that new price for the ${secondRate}% change.`;
  const explanation = [
    `First change: $${original} \\times (1 ${firstOperator} ${firstRate}/100) = ${firstExact}$ dollars.`,
    `The second change uses the exact ${firstExact} dollar price after the first change as its base.`,
    `Second change: $${firstExact} \\times (1 ${secondOperator} ${secondRate}/100) = ${finalExact}$ dollars.`,
    `Round only the final ${finalExact} dollars to the nearest cent, with halfway amounts rounded up: ${answer} dollars.`,
  ];
  const remainder = finalNumerator % finalDenominator;
  const tags = [
    ...new Set([
      input.variant,
      `${input.first === 1 ? "increase" : "decrease"}-then-${input.second === 1 ? "increase" : "decrease"}`,
      input.firstRate % 1_000 === 0 && input.secondRate % 1_000 === 0
        ? "integer-rates"
        : "decimal-rate",
      remainder === 0n
        ? "exact-cent"
        : 2n * remainder === finalDenominator
          ? "half-cent-tie"
          : "rounded-cent",
    ]),
  ];
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: meta.version,
      seed,
      skillId: meta.skillId,
      prompt,
      response: {
        kind: "number",
        label: "Final price in dollars (nearest cent)",
      },
    },
    answer,
    hint,
    explanation,
  };
  return {
    problem,
    tags,
    caseKey: JSON.stringify([
      input.startingCents,
      input.first * input.firstRate,
      input.second * input.secondRate,
    ]),
  };
}

export const generateSuccessivePercentChangeProblem = (seed: string) =>
  successivePercentChangeCase(seed).problem;
