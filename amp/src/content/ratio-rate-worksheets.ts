import { createHash } from "node:crypto";
import { ratioRatePrintCase } from "../math/ratio-rate-practice";

/** Each worksheet covers every context and condition the type assesses. */
const required: Record<string, string[]> = {
  "unit-rate": [
    "printer",
    "car",
    "wage",
    "price",
    "baker",
    "pace",
    "pencils",
    "decimal-rate",
    "fraction-rate",
  ],
  "better-buy": [
    "bars",
    "juice",
    "pencils",
    "cereal",
    "bulk-better",
    "small-better",
    "same",
    "winner-A",
    "winner-B",
  ],
  "ratio-table-missing": [
    "flour",
    "beads",
    "laps",
    "tickets",
    "paint",
    "missing-top",
    "missing-bottom",
    "via-simplest",
    "whole-multiple",
    "columns-3",
    "columns-4",
    "simplest-hidden",
  ],
  "double-number-line-missing": [
    "train",
    "grapes",
    "reading",
    "rice",
    "find-top",
    "find-bottom",
    "scale-up",
    "scale-down",
    "through-one",
    "whole-factor",
  ],
  "fraction-unit-rate": [
    "walk",
    "recipe",
    "cheese",
    "lawn",
    "unit-fraction-time",
    "nonunit-fraction-time",
    "whole-answer",
    "fraction-answer",
  ],
  "story-operation-choice": [
    "equal-groups",
    "array",
    "length",
    "volume",
    "product",
    "size",
    "groups",
  ],
  "multiplication-division-story": [
    "equal-groups",
    "array",
    "length",
    "volume",
    "product",
    "size",
    "groups",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function ratioRateWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    ratioRatePrintCase(templateId, `${lessonId}:${edition}:ratio-rate:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Ratio and rate worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Ratio and rate worksheet quota exceeds twelve items");
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
