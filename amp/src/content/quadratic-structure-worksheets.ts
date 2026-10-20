import { createHash } from "node:crypto";
import { quadraticStructurePrintCase } from "../math/quadratic-structure-practice";

/** Each worksheet covers every form and condition the type assesses. */
const required: Record<string, string[]> = {
  "parabola-vertex": ["vertex-form", "standard", "graph", "up", "down"],
  "parabola-axis": ["factored", "points", "graph", "standard", "fraction"],
  "parabola-shift": ["words", "graph", "describe"],
  "binomial-area-product": ["tiles", "product", "garden", "negative"],
  "structure-meaning": [
    "projectile",
    "fee",
    "growth",
    "constant",
    "coefficient",
  ],
  "structure-rewrite": ["fourth-power", "shifted-square", "perfect-square"],
  "zeros-from-factors": ["factored", "build", "graph"],
  "zero-multiplicity": ["factored", "describe", "graph"],
  "remainder-theorem": ["remainder", "factor-k", "tableau", "factor"],
  "polynomial-quotient": ["words", "tableau", "identity"],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function quadraticStructureWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    quadraticStructurePrintCase(templateId, `${lessonId}:${edition}:quad:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Quadratic-structure worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Quadratic-structure worksheet quota exceeds twelve items");
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
