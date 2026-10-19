import { createHash } from "node:crypto";
import { linearFunctionPrintCase } from "../math/linear-function-practice";

/** Each worksheet covers every form and condition the type assesses. */
const required: Record<string, string[]> = {
  "graph-domain-range": [
    "line",
    "parabola",
    "abs",
    "domain",
    "range",
    "closed-open",
    "open-closed",
  ],
  "context-domain-range": ["count", "time", "domain", "range"],
  "function-relation-test": [
    "pairs-is",
    "pairs-not",
    "equation-is",
    "equation-not",
  ],
  "average-rate-formula": [
    "quadratic",
    "exponential",
    "height",
    "values",
    "fraction",
  ],
  "average-rate-display": ["graph", "table", "context", "T", "P"],
  "linear-model-value": ["fee-rate", "two-plans", "perimeter", "budget"],
  "linear-model-equation": ["words", "graph", "table", "F", "H", "L"],
  "formula-isolate": ["geometry", "science", "finance", "lines"],
  "formula-value": [
    "perimeter",
    "temperature",
    "trapezoid",
    "speed",
    "interest",
  ],
  "solution-point-choice": ["standard", "slope", "quadratic", "absolute"],
  "solution-coordinate": ["find-y", "find-x", "parabola", "fraction"],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function linearFunctionWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    linearFunctionPrintCase(templateId, `${lessonId}:${edition}:alg1:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Algebra 1 worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Algebra 1 worksheet quota exceeds twelve items");
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
