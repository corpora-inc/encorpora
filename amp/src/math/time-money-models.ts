import { z } from "zod";

/** Analog clocks and money are drawn from exact givens: a clock's hands are
 * placed by its hour and minute (hour hand 30h + m/2 degrees, minute hand 6m),
 * and each coin or bill is one named denomination. */
const label = z.enum(["A", "B", "C"]).optional();
const clock = z
  .object({
    hour: z.number().int().min(1).max(12),
    minute: z.number().int().min(0).max(59),
    label,
  })
  .strict();
export const MONEY = [
  "five",
  "dollar",
  "quarter",
  "dime",
  "nickel",
  "penny",
] as const;
export type MoneyItem = (typeof MONEY)[number];
/** Value of each item in cents. */
export const CENTS: Record<MoneyItem, number> = {
  five: 500,
  dollar: 100,
  quarter: 25,
  dime: 10,
  nickel: 5,
  penny: 1,
};
const labelled = <T extends { label?: string }>(xs: T[]) =>
  xs.length === 1 ||
  (xs.every((x) => x.label) &&
    new Set(xs.map((x) => x.label)).size === xs.length);
export const timeMoneyFigureSchemas = [
  z
    .object({
      kind: z.literal("analog-clocks"),
      clocks: z.array(clock).min(1).max(3),
    })
    .strict()
    .refine((f) => labelled(f.clocks)),
  z
    .object({
      kind: z.literal("money-sets"),
      sets: z
        .array(
          z
            .object({
              items: z.array(z.enum(MONEY)).min(1).max(10),
              label,
            })
            .strict(),
        )
        .min(1)
        .max(3),
    })
    .strict()
    .refine((f) => labelled(f.sets)),
] as const;
export const timeMoneyFigureSchema = z.discriminatedUnion(
  "kind",
  timeMoneyFigureSchemas,
);
export type TimeMoneyFigure = z.infer<typeof timeMoneyFigureSchema>;

/** Hand angles in degrees clockwise from 12. */
export const handAngles = (hour: number, minute: number) => ({
  hour: (hour % 12) * 30 + minute / 2,
  minute: minute * 6,
});

/** Coin radius and bill width in figure units; sizes differ like real ones. */
export const moneySize = (item: MoneyItem) =>
  item === "dollar" || item === "five"
    ? { w: 92, h: 44 }
    : {
        w: 2 * { quarter: 24, nickel: 21, penny: 19.5, dime: 18 }[item],
        h: 2 * { quarter: 24, nickel: 21, penny: 19.5, dime: 18 }[item],
      };
/** Left-to-right rows that wrap within `width`; each item is centred in its box. */
export function moneyLayout(
  items: readonly MoneyItem[],
  width: number,
  gap = 10,
) {
  let x = 0,
    y = 0,
    rowHeight = 0;
  const placed = items.map((item) => {
    const { w, h } = moneySize(item);
    if (x > 0 && x + w > width) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const at = { item, cx: x + w / 2, cy: y, w, h };
    x += w + gap;
    rowHeight = Math.max(rowHeight, 48);
    return at;
  });
  const height = y + Math.max(rowHeight, 48);
  return {
    height,
    items: placed.map((p) => ({ ...p, cy: p.cy + 24 })),
  };
}
