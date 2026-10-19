import { z } from "zod";
import { base, small } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { FillRole } from "../spec";

/** One or two ten-frames filled in order by groups of counters. */
export const tenFrameSchema = z
  .object({
    ...base,
    type: z.literal("tenFrame"),
    frames: z.union([z.literal(1), z.literal(2)]),
    groups: z
      .array(
        z
          .object({
            count: small.max(20),
            shape: z.enum(["dot", "square"]).optional(),
            color: z.enum(["accent", "warm", "gold", "ink"]).optional(),
          })
          .strict(),
      )
      .max(3),
  })
  .strict()
  .refine(
    (f) => f.groups.reduce((s, g) => s + g.count, 0) <= f.frames * 10,
    "Counters fit the frames",
  );
export type TenFrame = z.infer<typeof tenFrameSchema>;

registerComponent("tenFrame", {
  maxScale: () => 50,
  compile(c) {
    const prims: Prim[] = [];
    const slots = c.frames * 10;
    const fills: { shape: "dot" | "square"; color: string }[] =
      c.groups.flatMap((g, gi) =>
        Array.from({ length: g.count }, () => ({
          shape: g.shape ?? (gi === 0 ? "dot" : "square"),
          color: g.color ?? (["accent", "warm", "gold"][gi] as string),
        })),
      );
    for (let i = 0; i < slots; i++) {
      const frame = Math.floor(i / 10),
        within = i % 10;
      const x = within % 5,
        y = -(frame * 2.4 + Math.floor(within / 5)) - 1;
      prims.push({
        type: "rect",
        id: `slot.${i}`,
        at: [x, y],
        size: [1, 1],
        fill: "paper",
        stroke: "ink",
        width: 1.5,
        data: { slot: i },
      });
      const f = fills[i];
      if (!f) continue;
      const group = c.groups.findIndex(
        (_, gi) =>
          i < c.groups.slice(0, gi + 1).reduce((a, g) => a + g.count, 0),
      );
      prims.push(
        f.shape === "dot"
          ? {
              type: "circle",
              id: `counter.${i}`,
              center: [x + 0.5, y + 0.5],
              r: 0.3,
              fill: f.color as FillRole,
              stroke: "paper",
              width: 1,
              data: { counter: group === 0 ? "first" : "second" },
            }
          : {
              type: "rect",
              id: `counter.${i}`,
              at: [x + 0.24, y + 0.24],
              size: [0.52, 0.52],
              radius: 2,
              fill: f.color as FillRole,
              data: { counter: group === 0 ? "first" : "second" },
            },
      );
    }
    return prims;
  },
  describe(c) {
    const kinds = c.groups.map(
      (g, gi) =>
        `${g.count} ${(g.shape ?? (gi === 0 ? "dot" : "square")) === "dot" ? "round" : "square"} counter${g.count === 1 ? "" : "s"}`,
    );
    return `${c.frames === 1 ? "One ten-frame" : "Two ten-frames"}, each with ten places. ${kinds.join(" and ") || "No counters"}. Other places are empty.`;
  },
});
