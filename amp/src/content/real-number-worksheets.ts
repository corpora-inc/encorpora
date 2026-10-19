import { createHash } from "node:crypto";
import { realNumberPrintCase } from "../math/real-number-practice";

/** Each worksheet covers every form and condition the type assesses. */
const required: Record<string, string[]> = {
  "classify-real-number": [
    "which-irrational",
    "which-rational",
    "answer-root",
    "answer-pi",
    "answer-pattern",
    "answer-square-root",
    "answer-repeating",
  ],
  "repeating-decimal-to-fraction": [
    "period-1",
    "period-2",
    "period-3",
    "delayed",
    "whole-part",
    "reduce",
  ],
  "root-between-integers": ["square", "cube", "smaller", "larger"],
  "root-nearest-tenth": ["round-up", "round-down", "whole-tenth"],
  "compare-irrational-values": [
    "greatest",
    "least",
    "answer-square",
    "answer-cube",
    "answer-fraction",
    "answer-decimal",
  ],
  "solve-square-cube-equation": [
    "square-perfect",
    "square-fraction",
    "square-irrational",
    "cube-positive",
    "cube-negative",
    "cube-irrational",
  ],
  "scientific-to-standard": [
    "positive-exponent",
    "negative-exponent",
    "one-digit",
    "no-zeros-added",
  ],
  "standard-to-scientific": ["large", "small"],
  "scientific-times-larger": [
    "ratio-below-one",
    "ratio-above-one",
    "negative-exponents",
    "decimal-answer",
  ],
  "scientific-operations": [
    "multiply",
    "divide",
    "add",
    "subtract",
    "adjust",
    "no-adjust",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function realNumberWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    realNumberPrintCase(templateId, `${lessonId}:${edition}:real:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Real-number worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Real-number worksheet quota exceeds twelve items");
  while (selected.length < 12) take(() => true);
  const order = (c: (typeof pool)[number]) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          templateId,
          lessonId,
          edition,
          "order",
          c.problem.public.seed,
        ]),
      )
      .digest("hex");
  return selected
    .sort((a, b) => order(a).localeCompare(order(b)))
    .map((c) => c.problem);
}
