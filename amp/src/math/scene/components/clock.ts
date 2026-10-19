import { z } from "zod";
import { base } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { Point } from "../spec";

/** An analog clock face. */
export const clockSchema = z
  .object({
    ...base,
    type: z.literal("clock"),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    numbers: z.boolean().optional(),
    hands: z.boolean().optional(),
  })
  .strict();
export type Clock = z.infer<typeof clockSchema>;

registerComponent("clock", {
  maxScale: () => 112,
  compile(c) {
    const prims: Prim[] = [];
    const at = (deg: number, r: number): Point => {
      const t = (deg * Math.PI) / 180;
      return [Math.sin(t) * r, Math.cos(t) * r];
    };
    prims.push({
      type: "circle",
      id: "face",
      center: [0, 0],
      r: 1,
      fill: "empty",
      stroke: "ink",
      width: 3,
    });
    for (let m = 0; m < 60; m++)
      prims.push({
        type: "segment",
        id: `tick.${m}`,
        from: at(m * 6, m % 5 ? 0.93 : 0.89),
        to: at(m * 6, 0.98),
        stroke: "ink",
        width: m % 5 ? 1 : 2,
      });
    if (c.numbers !== false)
      for (let n = 1; n <= 12; n++)
        prims.push({
          type: "text",
          id: `number.${n}`,
          at: at(n * 30, 0.755),
          text: String(n),
          font: "sans",
          size: "lg",
        });
    if (c.hands !== false) {
      const hour = (c.hour % 12) * 30 + c.minute * 0.5;
      prims.push({
        type: "segment",
        id: "hand.hour",
        from: [0, 0],
        to: at(hour, 0.44),
        stroke: "ink",
        width: 7,
        cap: "round",
        data: { hand: "hour" },
      });
      prims.push({
        type: "segment",
        id: "hand.minute",
        from: [0, 0],
        to: at(c.minute * 6, 0.6),
        stroke: "accent",
        width: 4,
        cap: "round",
        data: { hand: "minute" },
      });
      prims.push({
        type: "circle",
        id: "pin",
        center: [0, 0],
        r: 0.05,
        fill: "ink",
      });
    }
    return prims;
  },
  describe(c) {
    const h = c.hour % 12 === 0 ? 12 : c.hour % 12;
    return c.hands === false
      ? "A clock face with no hands."
      : `Clock showing ${h}:${String(c.minute).padStart(2, "0")}. The shorter hand shows the hour; the longer hand shows minutes.`;
  },
});
