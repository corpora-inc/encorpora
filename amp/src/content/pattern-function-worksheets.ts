import { createHash } from "node:crypto";
import { patternFunctionPrintCase } from "../math/pattern-function-practice";

/** Each worksheet covers every form and condition the type assesses. */
const required: Record<string, string[]> = {
  "rule-pattern-term": ["add", "subtract", "multiply", "near", "far"],
  "rule-pattern-feature": [
    "parity",
    "multiple",
    "ones",
    "constant-odd",
    "constant-even",
    "alternate",
  ],
  "related-patterns-relationship": ["factor", "extend", "factor-2", "factor-5"],
  "dependent-variable-equation": [
    "car",
    "pay",
    "printer",
    "tickets",
    "ages",
    "greenhouse",
  ],
  "dependent-variable-value": [
    "printer",
    "car",
    "tickets",
    "pay",
    "ages",
    "evaluate",
    "solve",
  ],
  "compare-function-rates": [
    "table-equation",
    "graph-equation",
    "table-graph",
    "graph-words",
    "table-words",
    "negative-rate",
    "half-rate",
    "split-winner",
    "same-winner",
  ],
  "linear-function-choice": [
    "find-linear",
    "find-nonlinear",
    "constant",
    "factored",
    "divided",
    "reversed",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function patternFunctionWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    patternFunctionPrintCase(templateId, `${lessonId}:${edition}:pattern:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Pattern worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Pattern worksheet quota exceeds twelve items");
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
