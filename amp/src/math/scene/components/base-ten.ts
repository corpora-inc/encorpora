import { count } from "../../agreement";
import { z } from "zod";
import { base, fill, label, small } from "../base";
import { registerComponent, type Prim } from "../layout";

/** Hundred flats, ten rods and unit cubes, grouped in labeled columns. */
export const baseTenSchema = z
  .object({
    ...base,
    type: z.literal("baseTen"),
    hundreds: small.max(9),
    tens: small.max(20),
    ones: small.max(20),
    labels: z.boolean().optional(),
  })
  .strict();
export type BaseTen = z.infer<typeof baseTenSchema>;

registerComponent("baseTen", {
  maxScale: (c) => (c.hundreds ? 8 : 12),
  compile(c) {
    const prims: Prim[] = [];
    const cols: { key: string; label: string; n: number; w: number }[] = [];
    if (c.hundreds)
      cols.push({
        key: "hundred",
        label: "Hundreds",
        n: c.hundreds,
        w: Math.min(3, c.hundreds) * 10.6 - 0.6,
      });
    cols.push({
      key: "ten",
      label: "Tens",
      n: c.tens,
      w: Math.max(1, Math.min(10, c.tens) * 1.5 - 0.5),
    });
    cols.push({
      key: "one",
      label: "Ones",
      n: c.ones,
      w: Math.max(1, Math.min(5, c.ones) * 1.5 - 0.5),
    });
    let x = 0;
    for (const col of cols) {
      if (c.labels !== false)
        prims.push({
          type: "text",
          id: `${col.key}.label`,
          at: [x + col.w / 2, 0],
          text: col.label,
          font: "sans",
          size: "sm",
          color: "muted",
          bold: true,
          offset: [0, -8],
          align: [0, 1],
        });
      for (let i = 0; i < col.n; i++) {
        if (col.key === "hundred") {
          const bx = x + (i % 3) * 10.6,
            by = -10 - Math.floor(i / 3) * 10.6;
          prims.push({
            type: "rect",
            id: `hundred.${i}`,
            at: [bx, by],
            size: [10, 10],
            fill: "accent-fill",
            stroke: "accent",
            width: 1.5,
            radius: 2,
            data: { unit: "hundred" },
          });
          for (let j = 1; j < 10; j++) {
            prims.push({
              type: "segment",
              id: `hundred.${i}.v${j}`,
              from: [bx + j, by],
              to: [bx + j, by + 10],
              stroke: "accent",
              width: 0.75,
            });
            prims.push({
              type: "segment",
              id: `hundred.${i}.h${j}`,
              from: [bx, by + j],
              to: [bx + 10, by + j],
              stroke: "accent",
              width: 0.75,
            });
          }
        } else if (col.key === "ten") {
          const bx = x + (i % 10) * 1.5,
            by = -10 - Math.floor(i / 10) * 10.8;
          prims.push({
            type: "rect",
            id: `ten.${i}`,
            at: [bx, by],
            size: [1, 10],
            fill: "accent-fill",
            stroke: "accent",
            width: 1.5,
            radius: 2,
            data: { unit: "ten" },
          });
          for (let j = 1; j < 10; j++)
            prims.push({
              type: "segment",
              id: `ten.${i}.h${j}`,
              from: [bx, by + j],
              to: [bx + 1, by + j],
              stroke: "accent",
              width: 0.75,
            });
        } else {
          const bx = x + (i % 5) * 1.5,
            by = -1 - Math.floor(i / 5) * 1.5;
          prims.push({
            type: "rect",
            id: `one.${i}`,
            at: [bx, by],
            size: [1, 1],
            fill: "accent-fill",
            stroke: "accent",
            width: 1.5,
            radius: 2,
            data: { unit: "one" },
          });
        }
      }
      x += col.w + 3;
    }
    return prims;
  },
  describe(c) {
    // "unit cubes", not "one cubes": "4 one cubes" reads as a count error.
    return `Base-ten model: ${count(c.hundreds, "hundred flat")}, ${count(c.tens, "ten rod")}, and ${count(c.ones, "unit cube")}. A hundred flat has ten rows of ten units; a rod has ten units.`;
  },
});
