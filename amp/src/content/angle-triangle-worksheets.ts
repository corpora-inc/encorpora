import { createHash } from "node:crypto";
import { angleTrianglePrintCase } from "../math/angle-triangle-practice";

/** Each template's share of a worksheet covers these conditions first. */
const required: Record<string, string[]> = {
  "angle-pair-measure": [
    "straight",
    "right",
    "vertical",
    "linear-pair",
    "full-turn",
  ],
  "angle-equation": ["straight", "right", "vertical", "adjacent", "ask-angle"],
  "triangle-angle-sum": ["numeric", "algebra", "right"],
  "triangle-exterior-angle": ["find-exterior", "find-remote", "algebra"],
  "parallel-lines-angle": ["numeric", "algebra", "supplementary", "equal"],
  "triangle-side-test": ["one-degenerate", "two-degenerate"],
  "triangle-third-side": ["greatest", "least", "count"],
  "triangle-conditions": ["one", "many", "none", "aaa"],
  "cross-section-shape": [
    "rectangle",
    "square",
    "triangle",
    "trapezoid",
    "pyramid",
    "prism",
  ],
  "cross-section-area": [
    "parallel-base",
    "perpendicular-front",
    "through-apex",
    "pyramid-half",
  ],
};

/** Twelve printed exercises per problem type, covering every required case first. */
export function angleTriangleWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const share = 12;
  const pool = Array.from({ length: 512 }, (_, i) =>
    angleTrianglePrintCase(templateId, `${lessonId}:${edition}:geometry:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > share)
    throw new Error(`Worksheet quota exceeds ${share} items for ${templateId}`);
  while (selected.length < share) take(() => true);
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
