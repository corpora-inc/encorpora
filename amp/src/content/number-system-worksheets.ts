import { createHash } from "node:crypto";
import { numberSystemPrintCase } from "../math/number-system-practice";

/** Each worksheet covers every context and condition the type assesses. */
const required: Record<string, string[]> = {
  "greatest-common-factor": ["bare", "sets", "tiles", "divides", "proper"],
  "least-common-multiple": [
    "bare",
    "packs",
    "together",
    "divides",
    "coprime",
    "shared",
  ],
  "gcf-factor-sum": ["prime-gcf", "composite-gcf"],
  "long-division-quotient": [
    "two-digit-quotient",
    "three-digit-quotient",
    "zero-digit",
    "context",
    "bare",
  ],
  "division-remainder-story": ["up", "down", "left"],
  "signed-quantity": [
    "represent-negative",
    "represent-positive",
    "opposite",
    "elevation",
    "temperature",
    "money",
    "yards",
    "floors",
  ],
  "opposite-on-line": [
    "opposite",
    "other-side",
    "double",
    "negative-point",
    "positive-point",
  ],
  "signed-story": [
    "temperature",
    "elevation",
    "account",
    "change",
    "negative-answer",
    "positive-answer",
  ],
  "signed-jumps": [
    "two-jumps",
    "three-jumps",
    "negative-answer",
    "positive-answer",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function numberSystemWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    numberSystemPrintCase(templateId, `${lessonId}:${edition}:number:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Number-system worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Number-system worksheet quota exceeds twelve items");
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
