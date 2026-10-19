import { registerComponent, type Prim } from "../layout";
import type { Bars } from "../spec";
import { num } from "./format";

/** One math unit is one category slot; heights share one linear scale. */
const plotHeight = (b: Bars) => Math.max(2.4, b.categories.length * 0.42);

registerComponent("bars", {
  maxScale: () => 56,
  compile(b) {
    const prims: Prim[] = [];
    const n = b.categories.length,
      H = plotHeight(b),
      max = Math.max(...b.series.flatMap((s) => s.values));
    const two = b.series.length === 2,
      w = two ? 0.36 : 0.62,
      gap = two ? 0.04 : 0;
    for (const [k, s] of b.series.entries())
      for (const [i, v] of s.values.entries()) {
        const x =
          i + 0.5 - (two ? w + gap / 2 : w / 2) + (two ? k * (w + gap) : 0);
        const h = (v / max) * H;
        if (h > 0)
          prims.push({
            type: "rect",
            id: `series.${k}.bar.${i}`,
            at: [x, 0],
            size: [w, h],
            fill: s.color ?? (k === 0 ? "accent" : "warm"),
            data: { series: k, bar: i, value: v },
          });
        if (b.valueLabels !== false)
          prims.push({
            type: "text",
            id: `series.${k}.value.${i}`,
            at: [x + w / 2, h],
            text: num(v),
            size: "sm",
            color: "ink",
            place: [
              [0, -4, 0, 1],
              [0, -21, 0, 1],
              [0, -38, 0, 1],
            ],
          });
      }
    prims.push({
      type: "segment",
      id: "baseline",
      from: [0, 0],
      to: [n, 0],
      stroke: "axis",
      width: 2,
    });
    for (const [i, c] of b.categories.entries())
      prims.push({
        type: "text",
        id: `category.${i}`,
        at: [i + 0.5, 0],
        text: c,
        size: "sm",
        offset: [0, 6],
        align: [0, -1],
      });
    let below = 30;
    if (b.axisName) {
      prims.push({
        type: "text",
        id: "axis-name",
        at: [n / 2, 0],
        text: b.axisName,
        font: "sans",
        size: "sm",
        offset: [0, below],
        align: [0, -1],
      });
      below += 22;
    }
    if (two)
      for (const [k, s] of b.series.entries())
        if (s.label)
          prims.push({
            type: "text",
            id: `legend.${k}`,
            at: [k === 0 ? 0 : n, 0],
            text: s.label,
            font: "sans",
            size: "sm",
            bold: true,
            color: s.color ?? (k === 0 ? "accent" : "warm"),
            offset: [0, below],
            align: [k === 0 ? -1 : 1, -1],
          });
    return prims;
  },
  describe(b) {
    const series = b.series.map(
      (s, k) =>
        `${b.series.length > 1 ? `${s.label ?? `Series ${k + 1}`}: ` : ""}${s.values
          .map((v, i) => `${b.categories[i]} ${num(v)}`)
          .join(", ")}.`,
    );
    return `A bar chart${b.axisName ? ` by ${b.axisName.toLowerCase()}` : ""}. ${series.join(" ")}`;
  },
});
