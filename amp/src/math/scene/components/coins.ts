import { z } from "zod";
import { base } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { FillRole, InkRole, Point } from "../spec";
import { atSchema, shifted } from "./shapes";

/**
 * United States coins drawn without their values, recognizable the way a
 * child learns them: size, color and edge. Diameters are true to scale (one
 * math unit is one millimeter); the penny is copper, the others silver; the
 * dime and the quarter have ridged (reeded) edges, the penny and the nickel
 * smooth ones. Each face carries the same plain emblem, an original star in
 * a ring, so no coin's design is copied and none is named on the drawing.
 */
export const coinKinds = ["penny", "nickel", "dime", "quarter"] as const;
export type CoinKind = (typeof coinKinds)[number];
/** Diameter in millimeters (United States Mint specifications). */
export const coinDiameter: Record<CoinKind, number> = {
  penny: 19.05,
  nickel: 21.21,
  dime: 17.91,
  quarter: 24.26,
};
const reeded: Record<CoinKind, boolean> = {
  penny: false,
  nickel: false,
  dime: true,
  quarter: true,
};
const metal: Record<CoinKind, { fill: FillRole; rim: InkRole }> = {
  penny: { fill: "warm-fill", rim: "warm" },
  nickel: { fill: "empty", rim: "axis" },
  dime: { fill: "empty", rim: "axis" },
  quarter: { fill: "empty", rim: "axis" },
};
export const coinsSchema = z
  .object({
    ...base,
    type: z.literal("coins"),
    at: atSchema.optional(),
    coins: z
      .array(
        z
          .object({
            coin: z.enum(coinKinds),
            /** A letter under the coin, for "which coin is…" choices. */
            label: z
              .string()
              .regex(/^[A-H]$/)
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    /** Coins per row; rows wrap. */
    perRow: z.number().int().min(1).max(8).optional(),
  })
  .strict()
  .refine((c) => {
    const labels = c.coins.flatMap((k) => (k.label ? [k.label] : []));
    return new Set(labels).size === labels.length;
  }, "Coin labels are distinct");
export type Coins = z.infer<typeof coinsSchema>;

const GAP = 6;
/** Five-pointed star of outer radius r at the origin. */
const star = (r: number): Point[] =>
  Array.from({ length: 10 }, (_, i) => {
    const t = Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * 0.42 : r;
    return [Math.cos(t) * q, Math.sin(t) * q];
  });

function draw(c: Coins, s: number): Prim[] {
  const perRow = c.perRow ?? Math.min(c.coins.length, 6);
  const rowHeight =
    Math.max(...c.coins.map((k) => coinDiameter[k.coin])) +
    (c.coins.some((k) => k.label) ? 26 / s + 4 : GAP);
  const prims: Prim[] = [];
  let x = 0;
  c.coins.forEach((k, i) => {
    if (i % perRow === 0) x = 0;
    const d = coinDiameter[k.coin],
      r = d / 2;
    const row = Math.floor(i / perRow);
    const center: Point = [x + r, -row * rowHeight - rowHeight / 2];
    x += d + GAP;
    const { fill, rim } = metal[k.coin];
    const id = `coin.${i}`;
    prims.push({
      type: "circle",
      id,
      center,
      r,
      fill,
      stroke: rim,
      width: 2,
      data: { coin: k.coin, diameter: d },
    });
    if (reeded[k.coin]) {
      // Ridges: short radial strokes all around the edge.
      const n = Math.round(d * 3.4);
      for (let j = 0; j < n; j++) {
        const t = (j / n) * 2 * Math.PI;
        prims.push({
          type: "segment",
          id: `${id}.ridge.${j}`,
          from: [center[0] + Math.cos(t) * (r - 1.1), center[1] + Math.sin(t) * (r - 1.1)],
          to: [center[0] + Math.cos(t) * r, center[1] + Math.sin(t) * r],
          stroke: rim,
          width: 1,
        });
      }
    }
    prims.push(
      {
        type: "circle",
        id: `${id}.ring`,
        center,
        r: r - 2.4,
        fill: "none",
        stroke: rim,
        width: 1,
      },
      {
        type: "polygon",
        id: `${id}.emblem`,
        points: star(r * 0.34).map(([a, b]) => [center[0] + a, center[1] + b]),
        fill: k.coin === "penny" ? "warm" : "paper",
        stroke: rim,
        width: 1,
      },
    );
    // Letters share one baseline under the row's largest coin.
    const rowCoins = c.coins.slice(row * perRow, (row + 1) * perRow);
    const rowRadius = Math.max(...rowCoins.map((q) => coinDiameter[q.coin])) / 2;
    if (k.label)
      prims.push({
        type: "text",
        id: `${id}.label`,
        at: [center[0], center[1] - rowRadius],
        text: k.label,
        font: "sans",
        size: "md",
        bold: true,
        align: [0, -1],
        offset: [0, 6],
      });
  });
  return prims;
}

const looks: Record<CoinKind, string> = {
  penny: "a small copper coin with a smooth edge",
  nickel: "a medium silver coin with a smooth edge",
  dime: "the smallest coin, silver, with a ridged edge",
  quarter: "a large silver coin with a ridged edge",
};

registerComponent("coins", {
  capability: () => "scenes-v2",
  // At most 3.4 px per millimeter: a quarter is 82 px across.
  maxScale: () => 3.4,
  compile(c, ctx) {
    return shifted(draw(c, ctx.s), c.at);
  },
  describe(c) {
    // Describes what the drawing shows, never the coin's name or value.
    const items = c.coins.map((k, i) =>
      k.label
        ? `Coin ${k.label}: ${looks[k.coin]}`
        : `${c.coins.length > 1 ? `Coin ${i + 1}: ` : ""}${looks[k.coin]}`,
    );
    const one = c.coins.length === 1;
    return one
      ? `A coin: ${looks[c.coins[0]!.coin]}. Coins are drawn to scale.`
      : `${c.coins.length} coins, drawn to scale. ${items.map((t) => `${t[0]!.toUpperCase()}${t.slice(1)}.`).join(" ")}`;
  },
});
