import { createHash } from "node:crypto";
import { transformationPrintCase } from "../math/transformation-practice";

/** Each worksheet covers every shape, motion and case the type assesses. */
const required: Record<string, string[]> = {
  "coordinate-side-length": [
    "rectangle",
    "triangle",
    "quadrilateral",
    "hexagon",
    "horizontal",
    "vertical",
    "crosses-axis",
    "same-side",
  ],
  "coordinate-rectangle-measure": [
    "area",
    "perimeter",
    "crosses-axis",
    "same-side",
  ],
  "coordinate-distance": [
    "crosses-axis",
    "one-quadrant",
    "hypotenuse-5",
    "hypotenuse-13",
    "hypotenuse-17",
  ],
  "coordinate-distance-exact": [
    "whole",
    "prime-root",
    "simplify",
    "crosses-axis",
    "one-quadrant",
  ],
  "transformation-image": [
    "translate",
    "reflect-x",
    "reflect-y",
    "rotate-90",
    "rotate-180",
    "rotate-270",
  ],
  "identify-rigid-motion": [
    "translate",
    "reflect-x",
    "reflect-y",
    "rotate-90",
    "rotate-180",
    "rotate-270",
  ],
  "dilation-image": ["enlarge", "reduce", "whole-factor", "fraction-factor"],
  "dilation-scale-factor": [
    "enlarge",
    "reduce",
    "whole-factor",
    "fraction-factor",
  ],
  "similar-triangles-side": [
    "larger",
    "smaller",
    "whole-factor",
    "fraction-factor",
  ],
  "scale-drawing": [
    "to-actual",
    "to-drawing",
    "rectangle",
    "drawing-area",
    "map",
    "plan",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function transformationWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    transformationPrintCase(templateId, `${lessonId}:${edition}:geometry:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Geometry worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Geometry worksheet quota exceeds twelve items");
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
