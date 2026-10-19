import { z } from "zod";
import { base, graphLabel, ink, label, small } from "../base";
import { registerComponent, type Prim } from "../layout";

/** Bars of one whole length, each cut into equal parts with some shaded. */
export const fractionBarSchema = z
  .object({
    ...base,
    type: z.literal("fractionBar"),
    bars: z
      .array(
        z
          .object({
            parts: z.number().int().min(1).max(24),
            shaded: small.max(48),
            /** How many wholes this bar spans (improper fractions). */
            wholes: z.number().int().min(1).max(3).optional(),
            label: graphLabel,
            derivedLabel: z.boolean().optional(),
            color: z.enum(["accent", "warm", "gold"]).optional(),
          })
          .strict()
          .refine((b) => b.shaded <= b.parts * (b.wholes ?? 1)),
      )
      .min(1)
      .max(6),
  })
  .strict();
export type FractionBar = z.infer<typeof fractionBarSchema>;

registerComponent("fractionBar", {
  maxScale: () => 34,
  compile(c) {
    const prims: Prim[] = [];
    const L = 10,
      H = 1.4,
      gap = 0.8;
    // One whole has the same length in every bar, so bars compare directly.
    const wholeW = L / Math.max(...c.bars.map((b) => b.wholes ?? 1));
    for (const [i, b] of c.bars.entries()) {
      const y = -(i + 1) * H - i * gap;
      const wholes = b.wholes ?? 1;
      for (let w = 0; w < wholes; w++)
        for (let p = 0; p < b.parts; p++) {
          const index = w * b.parts + p;
          prims.push({
            type: "rect",
            id: `bar.${i}.part.${index}`,
            at: [w * (wholeW + 0.3) + (p * wholeW) / b.parts, y],
            size: [wholeW / b.parts, H],
            fill: index < b.shaded ? (b.color ?? "accent") : "empty",
            // Cuts between shaded parts show in paper; the whole keeps an ink outline.
            stroke: index < b.shaded ? "paper" : "ink",
            width: 1.5,
            data: { part: index, shaded: index < b.shaded ? 1 : 0 },
          });
        }
      for (let w = 0; w < wholes; w++)
        prims.push({
          type: "rect",
          id: `bar.${i}.whole.${w}`,
          at: [w * (wholeW + 0.3), y],
          size: [wholeW, H],
          fill: "none",
          stroke: "ink",
          width: 2,
        });
      if (b.label !== false) {
        const right = wholes * wholeW + (wholes - 1) * 0.3;
        prims.push({
          type: "text",
          id: `bar.${i}.label`,
          at: [right, y + H / 2],
          text: b.label ?? `${b.shaded}/${b.parts}`,
          derived: b.derivedLabel,
          size: "lg",
          offset: [12, 0],
          align: [-1, 0],
        });
      }
    }
    return prims;
  },
  describe(c, reveal) {
    return c.bars
      .map((b, i) => {
        const whole =
          (b.wholes ?? 1) > 1 ? `${b.wholes} wholes, each` : "A whole";
        const label =
          b.label === false
            ? ""
            : b.derivedLabel && !reveal
              ? " Its fraction is to be found."
              : ` Labeled ${b.label ?? `${b.shaded}/${b.parts}`}.`;
        return `${c.bars.length > 1 ? `Bar ${i + 1}: ` : ""}${whole} cut into ${b.parts} equal parts, ${b.shaded} shaded.${label}`;
      })
      .join(" ");
  },
});
