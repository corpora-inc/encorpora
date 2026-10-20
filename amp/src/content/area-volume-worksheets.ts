import { createHash } from "node:crypto";
import { areaVolumePrintCase } from "../math/area-volume-practice";

/** Each worksheet covers every shape, solid and condition the type assesses. */
const required: Record<string, string[]> = {
  "triangle-area-base-height": [
    "acute",
    "right",
    "obtuse",
    "extra-sides",
    "base-height-only",
  ],
  "polygon-area-decompose": [
    "parallelogram",
    "trapezoid",
    "right-trapezoid",
    "pentagon",
    "total-height",
  ],
  "net-surface-area": [
    "rectangular-prism",
    "triangular-prism",
    "square-pyramid",
    "right-triangle",
    "isosceles-triangle",
  ],
  "unit-fraction-cube-packing": [
    "count",
    "volume",
    "edge-1/2",
    "edge-1/3",
    "edge-1/4",
    "fraction-volume",
  ],
  "fraction-edge-volume": [
    "volume",
    "missing-length",
    "missing-width",
    "missing-height",
  ],
  "composite-area": [
    "L-shape",
    "T-shape",
    "U-shape",
    "cut-corner",
    "two-hidden",
  ],
  "composite-face-prism-volume": ["L-shape", "T-shape"],
  "composite-face-prism-surface-area": ["L-shape", "T-shape"],
  "cylinder-volume": [
    "exact",
    "approximate",
    "missing-height",
    "diameter",
    "fraction-coefficient",
  ],
  "cone-sphere-volume": [
    "cone",
    "sphere",
    "hemisphere",
    "approximate",
    "diameter",
  ],
};

/** Select ordinary replayable cases, then shuffle independently of their features. */
export function areaVolumeWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  const tags = required[templateId];
  if (!tags) throw new Error(`No worksheet plan for ${templateId}`);
  const pool = Array.from({ length: 512 }, (_, i) =>
    areaVolumePrintCase(templateId, `${lessonId}:${edition}:measure:${i}`),
  );
  const selected: typeof pool = [];
  const used = new Set<string>();
  const take = (predicate: (c: (typeof pool)[number]) => boolean) => {
    const c = pool.find((c) => !used.has(c.caseKey) && predicate(c));
    if (!c)
      throw new Error(
        `Area and volume worksheet lacks a required case: ${templateId}/${edition}`,
      );
    selected.push(c);
    used.add(c.caseKey);
  };
  for (const tag of tags)
    if (!selected.some((c) => c.tags.includes(tag)))
      take((c) => c.tags.includes(tag));
  if (selected.length > 12)
    throw new Error("Area and volume worksheet quota exceeds twelve items");
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
