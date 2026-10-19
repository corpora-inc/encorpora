import { createHash } from "node:crypto";
import { factoringPrintCase } from "../math/factoring-practice";
/** Select distinct ordinary generated problems and retain their replayable seeds. */
export function factoringWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const pool = Array.from({ length: 512 }, (_, i) =>
    factoringPrintCase(templateId, `${lessonId}:${edition}:factoring:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (tag?: string) => {
    const item = pool.find(
      (c) => !used.has(c.caseKey) && (!tag || c.tags.includes(tag)),
    );
    if (!item)
      throw new Error(
        `Factoring worksheet lacks ${tag}: ${templateId}/${edition}`,
      );
    selected.push(item);
    used.add(item.caseKey);
  };
  const tags =
    templateId === "greatest-monomial-factor"
      ? [
          "coefficient-only",
          "variable-only",
          "combined",
          "negative-leading",
          "degree-1",
          "degree-2",
          "degree-3",
          "two-terms",
          "three-terms",
        ]
      : [
          "square",
          "conjugate",
          "negative-middle",
          "negative-constant",
          "both-negative",
          ...(templateId === "nonmonic-quadratic-factorization"
            ? ["monic-content", "primitive-nonmonic", "negative-leading"]
            : []),
        ];
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag))) take(tag);
  if (selected.length > 12)
    throw new Error("Factoring worksheet quotas exceed twelve questions");
  while (selected.length < 12) take();
  const order = (seed: string) =>
    createHash("sha256")
      .update(JSON.stringify([templateId, lessonId, edition, "order", seed]))
      .digest("hex");
  return selected
    .sort((a, b) =>
      order(a.problem.public.seed).localeCompare(order(b.problem.public.seed)),
    )
    .map((c) => c.problem);
}
