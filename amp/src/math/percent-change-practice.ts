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
    const pct = context === "share" ? "%" : "";
    hint = sign
      ? `The original ${B}${pct} is the base. Find the change, ${sign < 0 ? B : F} − ${sign < 0 ? F : B}, then write it as a fraction of ${B}.`
      : `It starts at ${B}${pct} and ends at ${B}${pct}. How much did it change, as a fraction of ${B}${pct}?`;
    explanation.push(
      `A percent change compares the change to the starting amount, called the base.`,
      `The starting ${context === "share" ? "share" : context === "price" ? "price" : "quantity"}, ${B}${pct}, is the base, because the change is measured from where it began.`,
      context === "share"
        ? `Find the change by subtracting the shares: ${sign < 0 ? B : F} − ${sign < 0 ? F : B} = ${decimal(delta)}. This plain gap between two percents is ${decimal(delta)} ${delta.n === delta.d ? "percentage point" : "percentage points"}.`
        : `Find the change by subtracting: ${sign < 0 ? B : F} − ${sign < 0 ? F : B} = ${decimal(delta)}.`,
      `Divide the change by the base to see what part of the base it is: ${decimal(delta)} ÷ ${B} = ${num(factor)}.`,
      `Percent means "out of 100," so multiply by 100: ${num(factor)} × 100 = ${num(p)}.`,
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
      ? sign
        ? `${P} is a percent of the unknown original, not of ${F}. After the change, ${F} is ${num(multiplier)} of the original: solve ${num(multiplier)} × original = ${F}.`
        : `A 0% change leaves the original unchanged. Which original gives ${F} after no change?`
      : sign
        ? `${P} of ${B} is ${num(factor)} × ${B}. Find that amount, then ${sign > 0 ? "add it to" : "subtract it from"} ${B}.`
        : `A 0% change adds nothing to ${B}.`;
    explanation.push(
      `Percent means "out of 100," so ${P} is the fraction ${num(p)} ÷ 100 = ${num(factor)}.`,
      sign
        ? `${reverse ? `The ${P} is a part of the original, not of the final ${F}. ` : ""}The final amount is the original ${sign > 0 ? "plus" : "minus"} ${num(factor)} of it: 1 ${operation} ${num(factor)} = ${num(multiplier)} of the original.`
        : "A 0% change adds or removes nothing, so the final amount equals the original.",
    );
    if (reverse) {
      explanation.push(
        sign
          ? `So the final ${F} is ${num(multiplier)} × the original. Undo that by dividing by ${num(multiplier)}, which is the same as multiplying by its flip, ${num(q(multiplier.d, multiplier.n))}: ${F} × ${num(q(multiplier.d, multiplier.n))} = ${B}.`
          : `So the original is the same as the final amount, ${B}.`,
      );
    } else {
      explanation.push(
        `Amount ${sign < 0 ? "removed" : "added"}: ${B} × ${num(factor)} = ${decimal(delta)}.`,
        sign
          ? `Final ${context === "price" ? "price" : "quantity"}: ${B} ${operation} ${decimal(delta)} = ${F}.`
          : `Final ${context === "price" ? "price" : "quantity"}: ${B} + 0 = ${F}.`,
      );
    }
  }
  if (!rateTask && !reverse)
    explanation.push(
      sign
        ? `Check in one step: multiplying by ${num(multiplier)} does the same thing. ${B} × ${num(multiplier)} = ${F}.`
        : `Check: nothing is added to ${B}, so it stays ${F}.`,
    );
  else
    explanation.push(
      sign
        ? `Check: ${num(factor)} of ${B} is ${B} × ${num(factor)} = ${decimal(delta)}, and ${B} ${operation} ${decimal(delta)} = ${F}.`
        : `Check: nothing is added to ${B}, so it stays ${F}.`,
    );
  const unitOf = (x: Q) =>
    context === "price"
      ? x.n === x.d
        ? " dollar"
        : " dollars"
      : context === "share"
        ? "%"
        : x.n === x.d
          ? " unit"
          : " units";
  explanation.push(
    rateTask
      ? sign
        ? `The ${context === "share" ? "share" : context === "price" ? "price" : "quantity"} ${verb} by ${P} of its starting value.`
        : `Nothing changed, so the percent change is 0%.`
      : reverse
        ? `The original ${context === "price" ? "price" : "quantity"} was ${B}${unitOf(b)}.`
        : `The final ${context === "price" ? "price" : "quantity"} is ${F}${unitOf(f)}.`,
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
