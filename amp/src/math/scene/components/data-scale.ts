/** Shared scale drawing for the data plots (dot plots, box plots). */
import type { Prim } from "../layout";
import { typeset } from "../type";
import { num, spoken } from "./format";
import { ticks } from "./number-line";

/** Decoration in figure pixels: mark size, stack spacing, panel spacing. */
export const STACK = 17,
  FIRST = 15,
  MARK = 6.5,
  NAME = 22,
  LABELS = 34;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** "2 1/4", "3/4" or "2": a tick value as a mixed number (math text). */
export function mixed(v: number, d: number) {
  const n = Math.round(v * d),
    whole = Math.floor(n / d),
    rest = n - whole * d;
  if (!rest) return num(whole);
  const g = gcd(rest, d);
  return `${whole ? `${whole} ` : ""}${rest / g}/${d / g}`;
}
/** Tallest stack in a group of values. */
export function tallest(values: readonly number[]) {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}
/** Ticks with labels that fit: every tick when it can, else whole numbers,
 * else a stride of whole numbers. */
export function scaleTicks(
  min: number,
  max: number,
  step: number,
  s: number,
  text: (v: number) => string,
) {
  const values = ticks(min, max, step);
  const widest = Math.max(
    ...values.map((v) => typeset(text(v), "math", "sm").width),
  );
  const stride =
    [1, 2, 4, 5, 10, 20, 50].find((k) => k * step * s >= widest + 8) ?? 100;
  return values.map((v, i) => ({ v, labeled: i % stride === 0 }));
}
export function axis(
  prims: Prim[],
  id: string,
  min: number,
  max: number,
  y: number,
  s: number,
  list: { v: number; labeled: boolean; major?: boolean }[],
  text: (v: number) => string,
  labels = true,
) {
  const pad = 10 / s;
  prims.push({
    type: "segment",
    id,
    from: [min - pad, y],
    to: [max + pad, y],
    stroke: "ink",
    width: 1.5,
    obstacle: true,
  });
  for (const { v, labeled, major = labeled } of list) {
    prims.push({
      type: "tick",
      id: `${id}.tick.${v}`,
      at: [v, y],
      dir: [0, 1],
      length: major ? 10 : 6,
      stroke: "ink",
      width: 1.25,
      data: { tick: v },
    });
    if (labels && labeled)
      prims.push({
        type: "text",
        id: `${id}.label.${v}`,
        at: [v, y],
        text: text(v),
        size: "sm",
        color: "muted",
        offset: [0, 7],
        align: [0, -1],
        data: { "tick-label": v },
      });
  }
}

/** The unit names the scale: under its right end, below the tick labels. */
export const unitLabel = (
  text: string,
  max: number,
  y: number,
  s: number,
): Prim => ({
  type: "text",
  id: "unit",
  at: [max + 10 / s, y - 30 / s],
  text,
  font: "sans",
  size: "sm",
  color: "muted",
  align: [1, -1],
});
