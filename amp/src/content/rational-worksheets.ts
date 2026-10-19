import { createHash } from "node:crypto";
import { rationalPrintCase } from "../math/rational-practice";
import type { GeneratedProblem } from "../math/contracts";

// Minimum counts per twelve-problem sheet; one problem may satisfy several.
const quotas: Record<string, Record<string, number>> = {
  "signed-fraction-sum": {
    addition: 4,
    subtraction: 4,
    "subtract-negative": 2,
    "both-negative": 2,
    "negative-result": 4,
    "positive-result": 4,
    "reduce-result": 2,
    "coprime-denominators": 3,
    "shared-factor": 3,
  },
  "signed-fraction-product": {
    multiplication: 4,
    division: 4,
    "two-negatives": 2,
    "negative-result": 4,
    "positive-result": 4,
    "reduce-result": 4,
    "integer-result": 1,
  },
  "complex-fraction": {
    "single-over-single": 2,
    "sum-over-single": 2,
    "single-over-sum": 2,
    "sum-over-sum": 2,
    "negative-result": 3,
    "positive-result": 3,
    "whole-number-term": 2,
    "negative-part": 2,
    "reduce-result": 3,
  },
  "rational-power": {
    "square-root": 3,
    "higher-root": 4,
    "negative-exponent": 4,
    "positive-exponent": 4,
    "power-after-root": 4,
    "unit-power": 2,
    "integer-base": 2,
    "fraction-base": 6,
    "integer-result": 1,
    "fraction-result": 6,
  },
};
export function rationalWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  if (!quotas[templateId])
    throw new Error(`Unknown rational worksheet ${templateId}`);
  const pool: ReturnType<typeof rationalPrintCase>[] = [];
  for (const size of [256, 512, 1024, 2048]) {
    while (pool.length < size)
      pool.push(
        rationalPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${pool.length}`,
        ),
      );
    const chosen: typeof pool = [],
      used = new Set<string>(),
      remaining = { ...quotas[templateId] };
    while (chosen.length < 12) {
      let found: (typeof pool)[number] | undefined,
        score = -1;
      for (const candidate of pool) {
        if (used.has(candidate.caseKey)) continue;
        const value = candidate.tags.reduce(
          (sum, tag) => sum + ((remaining[tag] ?? 0) > 0 ? 1 : 0),
          0,
        );
        if (value > score) {
          found = candidate;
          score = value;
        }
      }
      if (!found) break;
      chosen.push(found);
      used.add(found.caseKey);
      for (const tag of found.tags)
        remaining[tag] = Math.max(0, (remaining[tag] ?? 0) - 1);
    }
    if (
      chosen.length === 12 &&
      Object.values(remaining).every((n) => n === 0)
    ) {
      const order = (p: GeneratedProblem) =>
        createHash("sha256")
          .update(
            JSON.stringify([
              "rational-sheet-order",
              templateId,
              lessonId,
              edition,
              p.public.seed,
            ]),
          )
          .digest("hex");
      return chosen
        .map((c) => c.problem)
        .sort((a, b) => order(a).localeCompare(order(b)));
    }
  }
  throw new Error(
    `Cannot fill representative rational worksheet ${templateId}`,
  );
}
