import { createHash } from "node:crypto";
import { functionToolkitPrintCase } from "../math/function-toolkit-practice";

/** Each worksheet covers every form and condition the type assesses. */
const required: Record<string, string[]> = {
  "piecewise-evaluate": [
    "formula",
    "boundary",
    "graph",
    "story",
    "three-pieces",
    "endpoint",
  ],
  "piecewise-reading": ["abs-rule", "graph-rule", "solutions", "open-on-line"],
  "transform-equation": [
    "words",
    "graph",
    "describe",
    "square",
    "abs",
    "sqrt",
    "cube",
  ],
  "transform-point": [
    "vertical",
    "horizontal",
    "reflection",
    "symmetry",
    "compress",
  ],
  "composition-value": ["formula", "table", "graph", "domain", "g-of-f"],
  "composition-expression": ["f-of-g", "g-of-f", "decompose", "inner"],
  "inverse-value": ["formula", "table", "graph", "exp", "sqrt"],
  "inverse-expression": [
    "linear",
    "restricted",
    "point",
    "domain",
    "left-half",
  ],
  "compare-representations": [
    "maximum",
    "minimum",
    "intercept",
    "rate",
    "graph",
    "table",
    "equal",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function functionToolkitWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  // Cases are generated in seed order only as far as the plan needs them.
  type Item = ReturnType<typeof functionToolkitPrintCase>;
  const pool: Item[] = [];
  const at = (i: number) =>
    (pool[i] ??= functionToolkitPrintCase(
      templateId,
      `${lessonId}:${edition}:fn:${i}`,
    ));
  const selected: Item[] = [];
  const used = new Set<string>();
  const take = (predicate: (c: Item) => boolean) => {
    let c: Item | undefined;
    for (let i = 0; i < 512 && !c; i++) {
      const next = at(i);
      if (!used.has(next.caseKey) && predicate(next)) c = next;
    }
    if (!c)
      throw new Error(
        `Function-toolkit worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Function-toolkit worksheet quota exceeds twelve items");
  while (selected.length < 12) take(() => true);
  const order = (c: Item) =>
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
