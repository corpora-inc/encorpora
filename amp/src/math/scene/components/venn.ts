import { registerComponent, type Prim } from "../layout";
import { z } from "zod";
import { base, label } from "../base";
import type { Point } from "../base";
import { typeset } from "../type";

/** A value written in a figure (a count, a probability); null is the unknown,
 * drawn as "?". Unknowns carry no value, so a problem payload never holds one. */
export const entry = z.union([label, z.null()]);
export const vennRegions = ["a", "ab", "b", "none"] as const;
/** Two events in a sample space: counts or probabilities by region. */
export const vennSchema = z
  .object({
    ...base,
    type: z.literal("venn"),
    sets: z.tuple([label, label]),
    /** Names the sample space inside its rectangle's corner. */
    universe: label.optional(),
    /** a: first only; ab: both; b: second only; none: neither. */
    regions: z
      .object({ a: entry, ab: entry, b: entry, none: entry })
      .partial()
      .strict()
      .optional(),
    /** Each whole set's total, beside its name. */
    totals: z.tuple([entry, entry]).optional(),
    shade: z.array(z.enum(vennRegions)).max(4).optional(),
  })
  .strict();
export type Venn = z.infer<typeof vennSchema>;

/** Fixed geometry in math units: a 10 × 7 sample-space rectangle holding two
 * equal circles that overlap in a lens. */
const W = 10,
  H = 7,
  R = 2.35,
  CY = 3.05,
  C1 = 3.7,
  C2 = 6.3;
const HALF = (C2 - C1) / 2,
  THETA = Math.acos(HALF / R);
type Region = "a" | "ab" | "b" | "none";
const names: Record<Region, (s: Venn["sets"]) => string> = {
  a: ([a]) => `${a} only`,
  ab: ([a, b]) => `both ${a} and ${b}`,
  b: ([, b]) => `${b} only`,
  none: () => "neither",
};

/** Points along a circle from `from` to `to` radians (either direction). */
function arc(cx: number, from: number, to: number): Point[] {
  const n = 40;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / n;
    return [cx + R * Math.cos(t), CY + R * Math.sin(t)] as Point;
  });
}
/** Exact region outlines, sampled finely: the lens and the two crescents. */
export function vennRegion(region: "a" | "ab" | "b"): Point[] {
  const t = THETA;
  if (region === "ab")
    return [...arc(C1, -t, t), ...arc(C2, Math.PI - t, Math.PI + t)];
  if (region === "a")
    return [
      ...arc(C1, t, 2 * Math.PI - t),
      ...arc(C2, Math.PI + t, Math.PI - t),
    ];
  return [...arc(C2, t - Math.PI, Math.PI - t), ...arc(C1, t, -t)];
}
/** Where each region's value is written. */
export const vennAnchor: Record<Region, Point> = {
  a: [(C1 - R + C2 - R) / 2, CY],
  ab: [(C1 + C2) / 2, CY],
  b: [(C1 + R + C2 + R) / 2, CY],
  none: [W - 0.3, 0.3],
};

registerComponent("venn", {
  maxScale: () => 36,
  compile(c) {
    const shaded = new Set(c.shade ?? []);
    const prims: Prim[] = [
      {
        type: "rect",
        id: "region.none",
        at: [0, 0],
        size: [W, H],
        fill: shaded.has("none") ? "gold-fill" : "paper",
        stroke: "ink",
        width: 2,
        data: { region: "none" },
      },
    ];
    for (const [i, cx] of [C1, C2].entries())
      prims.push({
        type: "circle",
        id: `disc.${i}`,
        center: [cx, CY],
        r: R,
        fill: "paper",
        width: 0.5,
        stroke: "paper",
      });
    for (const region of ["a", "ab", "b"] as const)
      prims.push({
        type: "polygon",
        id: `region.${region}`,
        points: vennRegion(region),
        fill: shaded.has(region) ? "gold-fill" : "none",
        noStroke: true,
        data: { region },
      });
    for (const [i, cx] of [C1, C2].entries())
      prims.push({
        type: "circle",
        id: `set.${i}`,
        center: [cx, CY],
        r: R,
        fill: "none",
        stroke: i ? "warm" : "accent",
        width: 2.5,
      });
    // The sample space is named in the bottom-left corner (neither's count
    // sits bottom-right); each set is named in the top corner on its side,
    // so the names never meet over the overlap at any width.
    if (c.universe)
      prims.push({
        type: "text",
        id: "universe",
        at: [0, 0],
        text: c.universe,
        font: "sans",
        size: "sm",
        color: "muted",
        offset: [8, -6],
        align: [-1, 1],
      });
    for (const [i, name] of c.sets.entries()) {
      const color = i ? "warm" : "accent";
      const at: Point = [i ? W : 0, H];
      const total = c.totals?.[i];
      const shown = total === undefined ? undefined : (total ?? "?");
      // "Soccer: 25" reads as one label.
      const text = shown === undefined ? name : `${name}:`;
      const wName = typeset(text, "sans", "md", true).width;
      const wTotal =
        shown === undefined ? 0 : typeset(shown, "math", "md", true).width;
      prims.push({
        type: "text",
        id: `set.${i}.name`,
        at,
        text,
        font: "sans",
        bold: true,
        color,
        offset: i ? [-8 - (shown === undefined ? 0 : wTotal + 6), 8] : [8, 8],
        align: [i ? 1 : -1, -1],
      });
      if (shown !== undefined)
        prims.push({
          type: "text",
          id: `set.${i}.total`,
          at,
          text: shown,
          derived: total === null,
          bold: true,
          color,
          offset: i ? [-8, 8] : [8 + wName + 6, 8],
          align: [i ? 1 : -1, -1],
        });
    }
    for (const region of ["a", "ab", "b", "none"] as const) {
      const value = c.regions?.[region];
      if (value === undefined) continue;
      prims.push({
        type: "text",
        id: `count.${region}`,
        at: vennAnchor[region],
        text: value ?? "?",
        derived: value === null,
        bold: true,
        align: region === "none" ? [1, 1] : [0, 0],
        data: { count: region },
      });
    }
    return prims;
  },
  describe(c) {
    const [a, b] = c.sets;
    const out = [
      `A Venn diagram${c.universe ? ` of ${c.universe}` : ""} with two overlapping circles, ${a} and ${b}.`,
    ];
    const v = (x: string | null) => (x === null ? "unknown" : x);
    if (c.totals)
      out.push(
        `${a}: ${v(c.totals[0])} in all. ${b}: ${v(c.totals[1])} in all.`,
      );
    const regions = (["a", "ab", "b", "none"] as const).filter(
      (r) => c.regions?.[r] !== undefined,
    );
    if (regions.length)
      out.push(
        `${regions.map((r) => `${names[r](c.sets)}: ${v(c.regions![r]!)}`).join("; ")}.`,
      );
    if (c.shade?.length)
      out.push(`Shaded: ${c.shade.map((r) => names[r](c.sets)).join(", ")}.`);
    return out.join(" ");
  },
});
