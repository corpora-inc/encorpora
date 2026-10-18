import { createHash } from "node:crypto";
import { descriptiveStatisticsPrintCase } from "../math/descriptive-statistics-practice";
/** Select ordinary replayable cases, then shuffle independently of their features. */
export function descriptiveStatisticsWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const pool = Array.from({ length: 512 }, (_, i) =>
    descriptiveStatisticsPrintCase(
      templateId,
      `${lessonId}:${edition}:statistics:${i}`,
    ),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Statistics worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of [
    "all-equal",
    "negative",
    "decimal",
    "whole",
    "repeated",
    "fraction-answer",
    ...Array.from({ length: 5 }, (_, i) => `length-${i + 5}`),
  ])
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  for (const parity of ["even", "odd"])
    while (selected.filter((c) => c.tags.includes(parity)).length < 4)
      take((c) => c.tags.includes(parity));
  if (selected.length > 12)
    throw new Error("Statistics worksheet quota exceeds twelve items");
  while (selected.length < 12) take(() => true);
  return selected
    .sort((a, b) => {
      const key = (c: (typeof pool)[number]) =>
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
      return key(a).localeCompare(key(b));
    })
    .map((c) => c.problem);
}
