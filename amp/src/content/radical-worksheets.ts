import { createHash } from "node:crypto";
import { radicalPrintCase } from "../math/radical-practice";
import type { GeneratedProblem } from "../math/contracts";

const quotas: Record<string, Record<string, number>> = {
  "simplify-square-root": {
    "perfect-square": 2,
    "square-free": 2,
    "extract-square": 4,
    "larger-square-factor": 2,
  },
  "combine-square-roots": {
    "like-roots": 3,
    "unlike-roots": 3,
    "perfect-square-term": 2,
    "rational-result": 1,
    "extract-first": 4,
    subtraction: 3,
    addition: 3,
    "negative-leading": 2,
  },
  "multiply-square-roots": {
    "positive-product": 4,
    "negative-product": 4,
    "rational-product": 1,
    "irrational-product": 4,
    "extract-product": 4,
    "two-negatives": 2,
  },
  "rationalize-radical-denominator": {
    "positive-numerator": 4,
    "negative-numerator": 4,
    "simplify-denominator": 3,
    "square-free-denominator": 3,
    "fraction-coefficient": 6,
    "integer-coefficient": 1,
    "reduce-fraction": 3,
  },
};
export function radicalWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  if (!quotas[templateId])
    throw new Error(`Unknown radical worksheet ${templateId}`);
  const withZero =
    templateId === "simplify-square-root" ||
    templateId === "combine-square-roots";
  const pool: ReturnType<typeof radicalPrintCase>[] = [];
  for (const size of [512, 1024, 2048, 4096]) {
    while (pool.length < size)
      pool.push(
        radicalPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${pool.length}`,
        ),
      );
    const chosen: typeof pool = [],
      used = new Set<string>(),
      remaining = { ...quotas[templateId] };
    const take = (candidate: (typeof pool)[number]) => {
      chosen.push(candidate);
      used.add(candidate.caseKey);
      for (const tag of candidate.tags)
        remaining[tag] = Math.max(0, (remaining[tag] ?? 0) - 1);
    };
    const best = (eligible: (candidate: (typeof pool)[number]) => boolean) => {
      let found: (typeof pool)[number] | undefined,
        score = -1;
      for (const candidate of pool) {
        if (used.has(candidate.caseKey) || !eligible(candidate)) continue;
        const value = candidate.tags.reduce(
          (sum, tag) => sum + ((remaining[tag] ?? 0) > 0 ? 1 : 0),
          0,
        );
        if (value > score) {
          found = candidate;
          score = value;
        }
      }
      return found;
    };
    if (withZero) {
      const zero = best((c) => c.tags.includes("zero"));
      if (!zero) continue;
      take(zero);
      for (let i = 0; i < 3; i++) {
        const distractor = best(
          (c) => c.tags.includes("zero-option") && !c.tags.includes("zero"),
        );
        if (distractor) take(distractor);
      }
      if (chosen.length !== 4) continue;
    }
    while (chosen.length < 12) {
      const candidate = best(
        (c) => !withZero || !c.tags.includes("zero-option"),
      );
      if (!candidate) break;
      take(candidate);
    }
    if (
      chosen.length === 12 &&
      Object.values(remaining).every((n) => n === 0)
    ) {
      const order = (p: GeneratedProblem) =>
        createHash("sha256")
          .update(
            JSON.stringify([
              "radical-sheet-order",
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
  throw new Error(`Cannot fill representative radical worksheet ${templateId}`);
}
