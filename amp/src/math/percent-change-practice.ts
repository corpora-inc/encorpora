import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
type Q = { n: number; d: number };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const q = (n: number, d = 1): Q => {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d <= 0)
    throw new Error("Invalid exact fraction");
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const num = (a: Q) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
function decimal(a: Q, money = false): string {
  const cents = (a.n * 100) / a.d;
  if (!Number.isSafeInteger(cents))
    throw new Error("Quantity must have exact hundredths");
  const value = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
  return money ? value : value.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
const percent = (a: Q) => (a.d === 3 ? `${num(a)} percent` : `${decimal(a)}%`);
function random(id: string, seed: string) {
  let i = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(2 ** 32 / span) * span;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, i++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= limit);
    return lo + (n % span);
  };
}
export const percentChangeTemplates: readonly TemplateMetadata[] = [
  {
    id: "percent-change-rate",
    title: "Find the percent change",
    description:
      "Compare an increase or decrease with its original positive quantity, including changes in percentage-valued shares.",
  },
  {
    id: "percent-change-final",
    title: "Apply a percent change",
    description:
      "Find the final quantity after one exact percentage increase or decrease.",
  },
  {
    id: "percent-change-original",
    title: "Recover the original quantity",
    description:
      "Undo one percentage increase or decrease using its nonzero multiplier.",
  },
].map((t) => ({
  ...t,
  version: 1,
  skillId: "percent-change",
  gradeBand: "6–8",
}));
export function percentChangePrintCase(
  templateId: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  if (!percentChangeTemplates.some((t) => t.id === templateId))
    throw new Error("Unknown percent-change template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed),
    reverse = templateId === "percent-change-original",
    rateTask = templateId === "percent-change-rate";
  const bucket = r(0, 15);
  let sign = r(0, 1) ? 1 : -1,
    p: Q;
  if (bucket === 0) {
    p = q(0);
    sign = 0;
  } else if (bucket === 1) {
    p = q(reverse ? 50 : 100);
    sign = -1;
  } else if (bucket === 2) {
    p = q([100, 125, 150, 175, 200][r(0, 4)]!);
    sign = 1;
  } else if (bucket <= 4) p = q(r(0, 1) ? 100 : 200, 3);
  else if (bucket <= 8)
    p = [
      q(1, 2),
      q(5, 4),
      q(5, 2),
      q(25, 4),
      q(15, 2),
      q(25, 2),
      q(75, 2),
      q(125, 2),
      q(175, 2),
    ][r(0, 8)]!;
  else p = q(r(1, 99));
  const context = rateTask
    ? ["units", "price", "share"][r(0, 2)]!
    : ["units", "price"][r(0, 1)]!;
  const factor = div(p, q(100)),
    multiplier = add(q(1), q(sign * factor.n, factor.d));
  const maxOriginal = context === "share" ? 10000 : 50000,
    maxFinal = context === "share" ? 10000 : 100000;
  const step = multiplier.d;
  let lo = Math.ceil(10 / step),
    hi = Math.min(
      Math.floor(maxOriginal / step),
      multiplier.n
        ? Math.floor(maxFinal / multiplier.n)
        : Number.MAX_SAFE_INTEGER,
    );
  let cents: number;
  const smallHi = Math.min(hi, Math.floor(99 / step));
  if (smallHi >= lo && r(0, 5) === 0) cents = r(lo, smallHi) * step;
  else {
    const wholeStep = 100 / gcd(100, step),
      wholeLo = Math.ceil(lo / wholeStep),
      wholeHi = Math.floor(hi / wholeStep);
    cents =
      wholeHi >= wholeLo && r(0, 1) === 0
        ? r(wholeLo, wholeHi) * wholeStep * step
        : r(lo, hi) * step;
  }
  const b = q(cents, 100),
    f = mul(b, multiplier),
    delta = mul(b, factor);
  const B = decimal(b, context === "price"),
    F = decimal(f, context === "price"),
    P = percent(p);
  const direction = sign > 0 ? "increase" : sign < 0 ? "decrease" : "unchanged",
    verb = sign > 0 ? "increases" : "decreases",
    operation = sign > 0 ? "+" : "−";
  let prompt: string, answer: Q, hint: string;
  const explanation: string[] = [];
  const instruction =
    " Enter the exact percent without the % sign; use a fraction if needed.";
  if (rateTask) {
    if (context === "share")
      prompt = sign
        ? `The share of a group ${verb} from ${B}% to ${F}%. What is the relative percent ${direction}?`
        : `The share of a group is ${B}% before and after a change. What is the relative percent change?`;
    else {
      const noun = context === "price" ? "A price" : "A quantity",
        before =
          context === "price"
            ? `${B} ${b.n === b.d ? "dollar" : "dollars"}`
            : `${B} ${b.n === b.d ? "unit" : "units"}`,
        after =
          context === "price"
            ? `${F} ${f.n === f.d ? "dollar" : "dollars"}`
            : `${F} ${f.n === f.d ? "unit" : "units"}`;
      prompt = sign
        ? `${noun} ${verb} from ${before} to ${after}. By what percent does it ${direction}?`
        : `${noun} is ${before} before and after a change. What is the percent change?`;
    }
    prompt += instruction;
    answer = p;
    hint =
      "Use the original quantity as the base. Divide the amount of change by that original quantity, then multiply by 100 to express the ratio as a percent.";
    explanation.push(
      `The original ${context === "share" ? "share" : "quantity"}, ${B}${context === "share" ? "%" : ""}, is the base for this change.`,
      `Amount of change: ${sign < 0 ? B : F} − ${sign < 0 ? F : B} = ${decimal(delta)}${context === "share" ? (delta.n === delta.d ? " percentage point" : " percentage points") : ""}.`,
      `Change as a fraction of the original: ${decimal(delta)} ÷ ${B} = ${num(factor)}.`,
      `Convert the ratio to a percent: ${num(factor)} × 100 = ${num(p)}.`,
      sign
        ? `The relative ${direction} is ${P}.`
        : `The quantity is unchanged, so the percent change is 0%.`,
    );
  } else {
    const noun = context === "price" ? "A price" : "A quantity",
      unit = context === "price" ? "dollars" : "units",
      before =
        context === "price"
          ? `${B} ${b.n === b.d ? "dollar" : "dollars"}`
          : `${B} ${b.n === b.d ? "unit" : "units"}`,
      after =
        context === "price"
          ? `${F} ${f.n === f.d ? "dollar" : "dollars"}`
          : `${F} ${f.n === f.d ? "unit" : "units"}`,
      change = sign ? `${verb} by ${P}` : "changes by 0%";
    prompt = reverse
      ? `${noun} ${change} to ${after}. What was the original ${context === "price" ? "price" : "quantity"}, in ${unit}?`
      : `${noun} of ${before} ${change}. What is the final ${context === "price" ? "price" : "quantity"}, in ${unit}?`;
    answer = reverse ? b : f;
    hint = reverse
      ? "The percentage is based on the original quantity. Find the fraction that remains or results after the change, then divide the final quantity by that nonzero fraction."
      : "Find the stated percentage of the original quantity. Add that amount for an increase or subtract it for a decrease; the question asks for the final quantity.";
    explanation.push(
      `Write the percentage as a fraction: ${num(p)} ÷ 100 = ${num(factor)}.`,
      sign
        ? `The final quantity is ${sign > 0 ? "the original plus" : "the original minus"} this fraction of the original: 1 ${operation} ${num(factor)} = ${num(multiplier)}.`
        : "A 0% change leaves the original quantity unchanged; its multiplier is 1.",
    );
    if (reverse) {
      explanation.push(
        `Divide the final quantity by ${num(multiplier)}. Multiply by its reciprocal: ${F} × ${num(q(multiplier.d, multiplier.n))} = ${B}.`,
      );
    } else {
      explanation.push(
        `Amount ${sign < 0 ? "removed" : "added"}: ${B} × ${num(factor)} = ${decimal(delta)}.`,
        sign
          ? `Final quantity: ${B} ${operation} ${decimal(delta)} = ${F}.`
          : `Final quantity: ${B} + 0 = ${F}.`,
      );
    }
  }
  if (!rateTask && !reverse)
    explanation.push(
      `Check using the final multiplier: ${B} × ${num(multiplier)} = ${F}.`,
    );
  else
    explanation.push(
      `Check the change using the original quantity: ${B} × ${num(factor)} = ${decimal(delta)}.`,
      sign
        ? `Apply the change: ${B} ${operation} ${decimal(delta)} = ${F}.`
        : `Apply the change: ${B} + 0 = ${F}.`,
    );
  const tags = [
    direction,
    context,
    p.d === 1 ? "integer-rate" : p.d === 3 ? "repeating-rate" : "decimal-rate",
    b.d === 1 ? "whole-original" : "decimal-original",
    f.d === 1 ? "whole-final" : "decimal-final",
    answer.d === 1 ? "integer-answer" : "fraction-answer",
  ];
  if (b.n < b.d || (f.n > 0 && f.n < f.d)) tags.push("below-one");
  if (p.n > 100 * p.d && sign > 0) tags.push("over-100");
  if (p.n === 100 * p.d) tags.push("exactly-100");
  if (sign < 0 && p.n === 100 * p.d) tags.push("complete-decrease");
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      skillId: "percent-change",
      prompt,
      response: {
        kind: "fraction",
        label: rateTask
          ? "Exact percent (without %)"
          : context === "price"
            ? "Exact price (dollars)"
            : "Exact quantity (units)",
      },
    },
    answer: num(answer),
    hint,
    explanation,
  };
  return { problem, tags, caseKey: JSON.stringify([num(b), num(f)]) };
}
export const generatePercentChangeProblem = (
  templateId: string,
  seed: string,
) => percentChangePrintCase(templateId, seed).problem;
