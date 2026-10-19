import { createHash } from "node:crypto";
import { combinatoricsPrintCase } from "../math/combinatorics-practice";

/** Each worksheet covers every context and condition the type assesses. */
const required: Record<string, string[]> = {
  "counting-principle": [
    "repetition",
    "route",
    "lunch",
    "outfit",
    "pizza",
    "stages-2",
    "stages-3",
    "stages-4",
  ],
  "permutation-count": [
    "offices",
    "race",
    "shelf",
    "frames",
    "length-2",
    "length-3",
    "length-4",
  ],
  "combination-count": [
    "committee",
    "toppings",
    "books",
    "handshakes",
    "size-3",
    "size-4",
    "size-5",
  ],
  "combination-probability": [
    "marbles",
    "club",
    "all",
    "none",
    "mixed",
    "reduce",
    "size-4",
  ],
  "independent-events-probability": [
    "both",
    "neither",
    "at-least-one",
    "cube-spinner",
    "cube-coin",
    "spinner-coin",
  ],
  "expected-value": [
    "payout",
    "net",
    "negative",
    "positive",
    "zero-sections",
    "groups-3",
    "fraction-answer",
    "integer-answer",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function combinatoricsWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    combinatoricsPrintCase(templateId, `${lessonId}:${edition}:counting:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Counting worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Counting worksheet quota exceeds twelve items");
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
