import { registerComponent, type Prim } from "../layout";
import type { BoxPlot } from "../spec";
import { typeset } from "../type";
import { num, spoken } from "./format";
import { ticks } from "./number-line";

/** Decoration in figure pixels: mark size, stack spacing, panel spacing. */
const STACK = 17,
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
function scaleTicks(
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
function axis(
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
    width: 2,
    obstacle: true,
  });
  for (const { v, labeled, major = labeled } of list) {
    prims.push({
      type: "tick",
      id: `${id}.tick.${v}`,
      at: [v, y],
      dir: [0, 1],
      length: major ? 14 : 8,
      stroke: "ink",
      data: { tick: v },
    });
    if (labels && labeled)
      prims.push({
        type: "text",
        id: `${id}.label.${v}`,
        at: [v, y],
        text: text(v),
        size: "sm",
        offset: [0, 9],
        align: [0, -1],
        data: { "tick-label": v },
      });
  }
}

/** The unit names the scale: under its right end, below the tick labels. */
const unitLabel = (text: string, max: number, y: number, s: number): Prim => ({
  type: "text",
  id: "unit",
  at: [max + 10 / s, y - 30 / s],
  text,
  font: "sans",
  size: "sm",
  align: [1, -1],
});

registerComponent("dotPlot", {
  maxScale: (p) => 40 * (p.denominator ?? 1),
  compile(p, { s }) {
    const d = p.denominator ?? 1,
      kind = p.mark ?? "dot";
    const text = (v: number) => mixed(v, d);
    const list = scaleTicks(p.min, p.max, 1 / d, s, text).map((t) => ({
      ...t,
      // Whole numbers are the major ticks on a fraction scale.
      major: d > 1 ? Number.isInteger(Math.round(t.v * 1e9) / 1e9) : true,
    }));
    const prims: Prim[] = [];
    // Each panel: name line, stacks, axis, tick labels; panels stack downward.
    const height = (values: readonly number[]) =>
      (NAME + FIRST + Math.max(1, tallest(values)) * STACK + LABELS) / s;
    let top = 0,
      lastAxis = 0;
    for (const [g, group] of p.groups.entries()) {
      const axisY = top - height(group.values) + LABELS / s;
      if (group.label)
        prims.push({
          type: "text",
          id: `group.${g}.label`,
          at: [p.min - 10 / s, top - NAME / 2 / s],
          text: group.label,
          font: "sans",
          bold: true,
          align: [-1, 0],
        });
      lastAxis = axisY;
      axis(prims, `axis.${g}`, p.min, p.max, axisY, s, list, text);
      const seen = new Map<number, number>();
      for (const [i, v] of group.values.entries()) {
        const level = seen.get(v) ?? 0;
        seen.set(v, level + 1);
        const y = axisY + (FIRST + level * STACK) / s;
        const data = { mark: kind, value: v, level };
        if (kind === "dot")
          prims.push({
            type: "point",
            id: `group.${g}.mark.${i}`,
            at: [v, y],
            r: MARK,
            color: "accent",
            data,
          });
        else {
          const k = 5.5 / s;
          prims.push(
            {
              type: "segment",
              id: `group.${g}.mark.${i}`,
              from: [v - k, y - k],
              to: [v + k, y + k],
              stroke: "accent",
              width: 3,
              cap: "round",
              data,
            },
            {
              type: "segment",
              id: `group.${g}.mark.${i}.cross`,
              from: [v - k, y + k],
              to: [v + k, y - k],
              stroke: "accent",
              width: 3,
              cap: "round",
            },
          );
        }
      }
      top -= height(group.values) + 12 / s;
    }
    if (p.unit) prims.push(unitLabel(p.unit, p.max, lastAxis, s));
    return prims;
  },
  describe(p) {
    const d = p.denominator ?? 1;
    const counts = (values: readonly number[]) => {
      const m = new Map<number, number>();
      for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
      return [...m]
        .sort((a, b) => a[0] - b[0])
        .map(([v, c]) => `${mixed(v, d).replace("/", " over ")}: ${c}`)
        .join("; ");
    };
    const kind = (p.mark ?? "dot") === "x" ? "Line plot" : "Dot plot";
    return p.groups.length === 1
      ? `${kind} of ${p.groups[0]!.values.length} values${p.unit ? ` in ${p.unit}` : ""}, from ${spoken(p.min)} to ${spoken(p.max)}. ${counts(p.groups[0]!.values)}.`
      : `${p.groups.length} ${kind.toLowerCase()}s${p.unit ? ` of ${p.unit}` : ""} on the same scale. ${p.groups.map((g, i) => `${g.label ?? `Group ${i + 1}`}: ${counts(g.values)}`).join(". ")}.`;
  },
});

const BOX = 44,
  ROW = 86,
  CAP = 14;
registerComponent("boxPlot", {
  maxScale: (b) => 48 / b.step,
  compile(b, { s }) {
    const prims: Prim[] = [];
    const n = b.groups.length;
    // The axis is at y = 0; groups sit above it, the first at the top.
    const center = (g: number) => ((n - 1 - g) * ROW + 30 + BOX / 2) / s;
    const list = scaleTicks(b.min, b.max, b.step, s, num);
    // Label every other tick when labels would crowd, as the scale is read
    // from labeled ticks two steps apart.
    axis(prims, "axis", b.min, b.max, 0, s, list, num);
    if (b.unit) prims.push(unitLabel(b.unit, b.max, 0, s));
    for (const [g, group] of b.groups.entries()) {
      const [lo, q1, med, q3, hi] = group.summary;
      const y = center(g),
        h = BOX / 2 / s,
        cap = CAP / s;
      if (group.label)
        prims.push({
          type: "text",
          id: `group.${g}.label`,
          at: [b.min - 10 / s, y + h + 14 / s],
          text: group.label,
          font: "sans",
          bold: true,
          align: [-1, 0],
        });
      const whisker = (id: string, a: number, c: number) =>
        prims.push({
          type: "segment",
          id: `group.${g}.${id}`,
          from: [a, y],
          to: [c, y],
          stroke: "accent",
          width: 2.5,
        });
      whisker("whisker.low", lo, q1);
      whisker("whisker.high", q3, hi);
      for (const [k, v] of [lo, hi].entries())
        prims.push({
          type: "segment",
          id: `group.${g}.end.${k}`,
          from: [v, y - cap],
          to: [v, y + cap],
          stroke: "accent",
          width: 2.5,
          data: { summary: k === 0 ? "min" : "max", value: v },
        });
      prims.push(
        {
          type: "rect",
          id: `group.${g}.box`,
          at: [q1, y - h],
          size: [Math.max(q3 - q1, 1e-6), 2 * h],
          fill: "accent-fill",
          stroke: "accent",
          width: 2.5,
          data: { q1, q3 },
        },
        {
          type: "segment",
          id: `group.${g}.median`,
          from: [med, y - h],
          to: [med, y + h],
          stroke: "warm",
          width: 3.5,
          data: { summary: "median", value: med },
        },
      );
    }
    return prims;
  },
  describe(b) {
    const five = (g: BoxPlot["groups"][number]) =>
      `minimum ${spoken(g.summary[0])}, lower quartile ${spoken(g.summary[1])}, median ${spoken(g.summary[2])}, upper quartile ${spoken(g.summary[3])}, maximum ${spoken(g.summary[4])}`;
    return b.groups.length === 1
      ? `Box plot${b.unit ? ` of ${b.unit}` : ""}: ${five(b.groups[0]!)}.`
      : `${b.groups.length} box plots${b.unit ? ` of ${b.unit}` : ""} on the same scale. ${b.groups.map((g, i) => `${g.label ?? `Group ${i + 1}`}: ${five(g)}`).join(". ")}.`;
  },
});
