import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

type Rational = { n: number; d: number };
function q(n: number, d = 1): Rational {
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
const exact = (v: Rational) => {
  const hundredths = (v.n * 100) / v.d;
  if (!Number.isSafeInteger(hundredths))
    throw new Error("Statistics answer must be exact to hundredths");
  const magnitude = Math.abs(hundredths),
    remainder = magnitude % 100;
  return `${hundredths < 0 ? "-" : ""}${Math.floor(magnitude / 100)}${remainder ? `.${String(remainder).padStart(2, "0").replace(/0$/, "")}` : ""}`;
};
const shown = (v: Rational) => exact(v).replace("-", "−");
/** Values are integer tenths throughout; only text rendering uses a decimal point. */
const decimal = (v: number) =>
  `${v < 0 ? "−" : ""}${Math.floor(Math.abs(v) / 10)}${v % 10 ? `.${Math.abs(v) % 10}` : ""}`;
const operand = (v: number) => (v < 0 ? `(${decimal(v)})` : decimal(v));
const list = (values: number[]) => values.map(decimal).join(", ");
function middle(values: number[]): Rational {
  const k = Math.floor(values.length / 2);
  return values.length % 2
    ? q(values[k]!, 10)
    : q(values[k - 1]! + values[k]!, 20);
}
function medianSteps(values: number[], label: string): string[] {
  const k = Math.floor(values.length / 2);
  return values.length % 2
    ? [
        `${label} has ${values.length} values. Its middle value is in position ${k + 1}: ${decimal(values[k]!)}.`,
      ]
    : [
        `${label} has ${values.length} values. Its middle positions are ${k} and ${k + 1}.`,
        `Find their mean: (${decimal(values[k - 1]!)} + ${operand(values[k]!)}) ÷ 2 = ${shown(q(values[k - 1]! + values[k]!, 10))} ÷ 2 = ${shown(middle(values))}.`,
      ];
}
export const descriptiveStatisticsTemplates: readonly TemplateMetadata[] = [
  {
    id: "median-data",
    version: 1,
    title: "Median of data",
    skillId: "signed-data-summaries",
    gradeBand: "6–8",
    description:
      "Order a finite dataset and find its middle value or the mean of its two middle values.",
  },
  {
    id: "range-data",
    version: 1,
    title: "Range of data",
    skillId: "signed-data-summaries",
    gradeBand: "6–8",
    description:
      "Find the distance between the greatest and least values in a finite dataset.",
  },
  {
    id: "interquartile-range-data",
    version: 1,
    title: "Interquartile range",
    skillId: "signed-data-summaries",
    gradeBand: "6–8",
    description:
      "Find quartiles by the stated median-of-halves convention and subtract the lower quartile from the upper.",
  },
];
function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do
      n = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (n >= limit);
    return lo + (n % span);
  };
}
function unordered(values: number[]): boolean {
  return (
    values.some((v, i) => i > 0 && v < values[i - 1]!) &&
    values.some((v, i) => i > 0 && v > values[i - 1]!)
  );
}
export function descriptiveStatisticsPrintCase(id: string, seed: string) {
  const metadata = descriptiveStatisticsTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown statistics template ${id}`);
  const r = random(id, seed),
    length = r(5, 9),
    whole = r(0, 1) === 0,
    mode = r(0, 15),
    sign = r(0, 3);
  const next = () => {
    const value =
      sign === 0
        ? r(0, whole ? 9 : 99)
        : sign === 1
          ? r(whole ? -9 : -99, -1)
          : r(whole ? -9 : -99, whole ? 9 : 99);
    return whole ? value * 10 : value;
  };
  const values = Array.from({ length }, next);
  if (mode === 0) values.fill(values[0]!);
  else if (mode < 5) values[1] = values[0]!;
  for (let i = values.length - 1; i > 0; i--) {
    const j = r(0, i);
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  if (new Set(values).size > 1 && !unordered(values)) {
    outer: for (let i = 0; i < length; i++)
      for (let j = i + 1; j < length; j++) {
        [values[i], values[j]] = [values[j]!, values[i]!];
        if (unordered(values)) break outer;
        [values[i], values[j]] = [values[j]!, values[i]!];
      }
  }
  const sorted = [...values].sort((a, b) => a - b),
    middleIndex = Math.floor(length / 2);
  const lower = sorted.slice(0, middleIndex),
    upper = sorted.slice(Math.ceil(length / 2));
  const first = middle(lower),
    third = middle(upper);
  const answer =
    id === "median-data"
      ? middle(sorted)
      : id === "range-data"
        ? q(sorted.at(-1)! - sorted[0]!, 10)
        : q(third.n * first.d - first.n * third.d, third.d * first.d);
  const name =
    id === "median-data"
      ? "median"
      : id === "range-data"
        ? "range"
        : "interquartile range";
  const prompt = `Find the ${name} of these data: ${list(values)}.${id === "interquartile-range-data" ? " Order the values; when there is an odd number of values, exclude the overall median from both halves. Each quartile is the median of its half." : ""}`;
  const explanation = [
    `Order from least to greatest, keeping repetitions: ${list(sorted)}.`,
  ];
  if (id === "median-data")
    explanation.push(
      ...medianSteps(sorted, "The ordered dataset"),
      `The median is ${shown(answer)}.`,
    );
  else if (id === "range-data")
    explanation.push(
      `The least value is ${decimal(sorted[0]!)} and the greatest is ${decimal(sorted.at(-1)!)}.`,
      `Subtract least from greatest: ${decimal(sorted.at(-1)!)} − ${operand(sorted[0]!)} = ${shown(answer)}.`,
      `The range is ${shown(answer)}; it cannot be negative.`,
    );
  else
    explanation.push(
      length % 2
        ? `There are ${length} values. Exclude the middle value in position ${middleIndex + 1}, ${decimal(sorted[middleIndex]!)}, from both halves.`
        : `There are ${length} values. Split between positions ${middleIndex} and ${middleIndex + 1}; keep every value in one half.`,
      `Lower half: ${list(lower)}.`,
      ...medianSteps(lower, "The lower half"),
      `The lower quartile is ${shown(first)}.`,
      `Upper half: ${list(upper)}.`,
      ...medianSteps(upper, "The upper half"),
      `The upper quartile is ${shown(third)}.`,
      `Subtract lower from upper: ${shown(third)} − ${first.n < 0 ? `(${shown(first)})` : shown(first)} = ${shown(answer)}.`,
      `The interquartile range is ${shown(answer)}.`,
    );
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt,
      response: { kind: "fraction", label: `Exact ${name}` },
    },
    answer: exact(answer),
    explanation,
    hint:
      id === "median-data"
        ? "Order all values, including repetitions. For an odd count use the middle value; for an even count add the two middle values and divide by 2."
        : id === "range-data"
          ? "Find the greatest and least values. Subtract the least from the greatest; when the least is negative, subtracting it adds its positive opposite."
          : "Order the values and split them into equal halves, excluding the overall middle value for an odd count. Find each half's median, then subtract the lower quartile from the upper.",
  };
  const tags = [
    `length-${length}`,
    length % 2 ? "odd" : "even",
    values.some((v) => v < 0) ? "negative" : "nonnegative",
    values.some((v) => v % 10) ? "decimal" : "whole",
    new Set(values).size < length ? "repeated" : "distinct",
    new Set(values).size === 1 ? "all-equal" : "varied",
    answer.d > 1 ? "fraction-answer" : "integer-answer",
  ];
  return { problem, tags, caseKey: sorted.join(",") };
}
export const generateDescriptiveStatisticsProblem = (
  id: string,
  seed: string,
): GeneratedProblem => descriptiveStatisticsPrintCase(id, seed).problem;
