import { z } from "zod";
import { base } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { Point } from "../spec";
import { coinKinds, type CoinKind } from "../art";
import { atSchema, shifted } from "./shapes";

/**
 * United States coins as a child holds them: the real obverse of each coin
 * (Lincoln on copper, Jefferson, Roosevelt and Washington on silver), drawn
 * from the United States Mint's own photographs (web/scene/coin-art) at true
 * relative size (one math unit is one millimeter), with ridged (reeded)
 * edges on the dime and the quarter. No obverse states its coin's value, and
 * nothing names the coin on the drawing.
 */
export { coinKinds, type CoinKind };
/** Diameter in millimeters (United States Mint specifications). */
export const coinDiameter: Record<CoinKind, number> = {
  penny: 19.05,
  nickel: 21.21,
  dime: 17.91,
  quarter: 24.26,
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
    const id = `coin.${i}`;
    prims.push({ type: "image", id, center, r, art: k.coin });
    // Letters share one baseline under the row's largest coin.
    const rowCoins = c.coins.slice(row * perRow, (row + 1) * perRow);
    const rowRadius =
      Math.max(...rowCoins.map((q) => coinDiameter[q.coin])) / 2;
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
