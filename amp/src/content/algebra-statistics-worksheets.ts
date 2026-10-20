import { createHash } from "node:crypto";
import { algebraStatisticsCase } from "../math/algebra-statistics-practice";

/** Each worksheet covers every prompt frame its type assesses. */
const required: Record<string, string[]> = {
  "outlier-center-shift": ["remove", "add", "typo", "high", "low"],
  "skewed-box-compare": ["shape", "measure", "spread"],
  "relative-frequency-percent": [
    "joint",
    "marginal-row",
    "marginal-column",
    "row",
    "column",
  ],
  "conditional-frequency-choice": [
    "interpret",
    "pick",
    "association",
    "associated",
    "not-associated",
  ],
  "regression-coefficient-meaning": [
    "slope",
    "units",
    "meaningful",
    "extrapolation",
  ],
  "regression-line-predict": ["predict", "difference", "solve"],
  "residual-value": ["point", "observed", "table", "above", "below"],
  "correlation-choice": [
    "estimate",
    "strongest",
    "residual-plot",
    "nonlinear",
    "curved",
    "random",
  ],
  "causal-claim-choice": ["conclusion", "lurking", "reverse"],
  "study-design-choice": [
    "design",
    "identify",
    "conclusion",
    "experiment",
    "observational",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function algebraStatisticsWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 256 }, (_, i) =>
    algebraStatisticsCase(templateId, `${lessonId}:${edition}:alg1-stats:${i}`),
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
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Statistics worksheet quota exceeds twelve items");
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
