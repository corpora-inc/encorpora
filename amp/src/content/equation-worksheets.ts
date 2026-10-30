import { createHash } from "node:crypto";
import { equationPrintCase } from "../math/equation-practice";

const operators = ["operator:>", "operator:<", "operator:≥", "operator:≤"];
const stories = [
  "gym",
  "savings",
  "taxi",
  "tank",
  "tickets",
  "perimeter",
  "sale",
];
/** Each worksheet covers every form, number system and context the type assesses. */
const required: Record<string, string[]> = {
  "one-step-equation": [
    "add",
    "sub",
    "mul",
    "div",
    "whole",
    "decimal",
    "fraction",
    "commuted",
  ],
  "one-step-equation-story": [
    "stickers",
    "water",
    "muffins",
    "ribbon",
    "tickets",
    "chairs",
    "pencils",
    "rope",
  ],
  "balance-one-step": ["add", "mul"],
  "two-step-equation": [
    "plain",
    "grouped",
    "decimal",
    "constant-first",
    "negative-coefficient",
    "positive-coefficient",
    "negative-solution",
    "positive-solution",
  ],
  "two-step-word-problem": stories,
  "two-step-equation-model": stories,
  "balance-two-step": ["plain", "grouped"],
  "inequality-context-bound": [...operators, "negative"],
  "inequality-from-number-line": [...operators, "negative", "nonnegative"],
  "inequality-number-line-choice": [
    ...operators,
    "verbal",
    "symbolic",
    "negative",
  ],
  "inequality-solution-set": [...operators, "statements", "lists", "negative"],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function equationWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    equationPrintCase(templateId, `${lessonId}:${edition}:equations:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Equation worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Equation worksheet quota exceeds twelve items");
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
