import { createHash } from "node:crypto";
import { twoVariablePrintCase } from "../math/two-variable-practice";

/** Each worksheet covers every form and condition the type assesses. */
const required: Record<string, string[]> = {
  "system-model-value": [
    "tickets",
    "flowers",
    "test",
    "coins",
    "first",
    "second",
  ],
  "constraint-feasible": ["bakery", "jobs"],
  "half-plane-inequality": [
    "slope",
    "standard",
    "axis",
    "system",
    "strict",
    "inclusive",
  ],
  "inequality-solution-point": [
    "slope",
    "standard",
    "strict",
    "inclusive",
    "on-line",
  ],
  "literal-equation-solve": [
    "coefficient",
    "both-sides",
    "grouped",
    "inequality-positive",
    "inequality-negative",
  ],
  "parameter-solution-count": [
    "equation-none",
    "equation-many",
    "coefficient-many",
    "system-none",
  ],
  "equation-step-property": [
    "property",
    "error",
    "grouped",
    "both-sides",
    "fraction",
    "combine",
  ],
  "elimination-equivalent": ["add", "scale", "system", "why"],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function twoVariableWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    twoVariablePrintCase(templateId, `${lessonId}:${edition}:alg1-sys:${i}`),
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
