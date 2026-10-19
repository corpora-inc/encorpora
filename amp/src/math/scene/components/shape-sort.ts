import { z } from "zod";
import { base } from "../base";
import { registerComponent, type Prim } from "../layout";

export const shapeKinds = ["circle", "square", "triangle"] as const;
/** Mixed shapes to sort and count, five to a row in a fixed order. */
export const shapeSortSchema = z
  .object({
    ...base,
    type: z.literal("shapeSort"),
    shapes: z.array(z.enum(shapeKinds)).min(1).max(20),
  })
  .strict();
export type ShapeSort = z.infer<typeof shapeSortSchema>;

const tone = {
  circle: ["accent", "accent-fill"],
  square: ["warm", "warm-fill"],
  triangle: ["gold", "gold-fill"],
} as const;

registerComponent("shapeSort", {
  // One unit is one cell; a cell is at most 64 pixels.
  maxScale: () => 64,
  compile(c) {
    const prims: Prim[] = [];
    for (const [i, shape] of c.shapes.entries()) {
      const cx = (i % 5) + 0.5,
        cy = -Math.floor(i / 5) - 0.5;
      const [stroke, fill] = tone[shape];
      const common = { stroke, fill, width: 3, data: { shape } } as const;
      if (shape === "circle")
        prims.push({
          type: "circle",
          id: `shape.${i}`,
          center: [cx, cy],
          r: 0.31,
          ...common,
        });
      else if (shape === "square")
        prims.push({
          type: "rect",
          id: `shape.${i}`,
          at: [cx - 0.275, cy - 0.275],
          size: [0.55, 0.55],
          radius: 3,
          ...common,
        });
      else {
        // Equilateral, centered on its centroid.
        const r = 0.35;
        prims.push({
          type: "polygon",
          id: `shape.${i}`,
          points: [90, 210, 330].map((deg) => {
            const t = (deg * Math.PI) / 180;
            return [cx + r * Math.cos(t), cy + r * Math.sin(t) - r * 0.12] as [
              number,
              number,
            ];
          }),
          ...common,
        });
      }
    }
    return prims;
  },
  describe(c) {
    const count = (k: (typeof shapeKinds)[number]) =>
      c.shapes.filter((s) => s === k).length;
    return `${c.shapes.length} shapes in mixed order: ${shapeKinds
      .map((k) => `${count(k)} ${k}${count(k) === 1 ? "" : "s"}`)
      .join(", ")}.`;
  },
});
