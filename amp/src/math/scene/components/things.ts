import { z } from "zod";
import { base, small } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { PathOp } from "../spec";
import { atSchema, shifted } from "./shapes";
import { spoken } from "./format";
import {
  FRAME_CELL,
  framesOf,
  groupsOf,
  rowOf,
  scatterOf,
  thingArt,
  thingKinds,
  thingName,
  thingOps,
  thingStroke,
  type Arrangement,
  type ThingKind,
} from "./things-art";

/**
 * Real things to count: apples, ducks, cars, pencils. Sets are listed in
 * counting order and each set is one kind, so several kinds can share a
 * figure. One math unit is one thing's width.
 *
 * - `row` (the default): one line, at most ten.
 * - `grid`: rows of `perRow` (default five).
 * - `scatter`: a tidy scatter that never overlaps; the same `seed` is always
 *   the same picture.
 * - `groups`: each set stands apart from the next.
 * - `frame`: five- or ten-frame boxes, filled in order; a second frame is
 *   added when the things need it.
 *
 * Parts are `thing.0`, `thing.1`, … in counting order (each with its painted
 * layers below it) and, in a frame, `slot.0`, `slot.1`, …
 */
const thingsShape = z
  .object({
    ...base,
    type: z.literal("things"),
    at: atSchema.optional(),
    sets: z
      .array(
        z
          .object({
            kind: z.enum(thingKinds),
            count: small.min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(24),
    arrange: z.enum(["row", "grid", "scatter", "groups", "frame"]).optional(),
    /** Things in each row of a grid or a group; columns of a scatter. */
    perRow: z.number().int().min(1).max(10).optional(),
    seed: z.string().min(1).max(40).optional(),
    /** Boxes in one frame. */
    frame: z.union([z.literal(5), z.literal(10)]).optional(),
  })
  .strict();
type Shape = z.infer<typeof thingsShape>;

const total = (t: Pick<Shape, "sets">) =>
  t.sets.reduce((sum, set) => sum + set.count, 0);
/** Each thing's kind, in counting order. */
export const thingsInOrder = (t: Pick<Shape, "sets">): ThingKind[] =>
  t.sets.flatMap((set) => Array.from({ length: set.count }, () => set.kind));

export const thingsSchema = thingsShape
  .refine((t) => total(t) <= 24, "At most 24 things")
  .refine(
    (t) => (t.arrange ?? "row") !== "row" || total(t) <= 10,
    "A row holds at most ten things; use a grid",
  )
  .refine(
    (t) => t.arrange !== "frame" || total(t) <= 2 * (t.frame ?? 10),
    "The things fit two frames",
  )
  .refine(
    // Never under 24 px a thing on a 288 px phone stage.
    (t) => arrangement(t).w <= 12 + 1e-9,
    "The arrangement is at most ten things wide",
  );
export type Things = z.infer<typeof thingsSchema>;

function arrangement(t: Shape): Arrangement {
  const count = total(t);
  switch (t.arrange ?? "row") {
    case "grid":
      return rowOf(count, t.perRow ?? 5);
    case "scatter":
      return scatterOf(count, t.seed, t.perRow);
    case "groups":
      return groupsOf(
        t.sets.map((set) => set.count),
        t.perRow ?? 5,
      );
    case "frame": {
      const size = t.frame ?? 10;
      return framesOf(size, count > size ? 2 : 1);
    }
    default:
      return rowOf(count);
  }
}

/** One thing's layers as path primitives, in a box `size` units wide centred on (cx, cy). */
export function thingPrims(
  kind: ThingKind,
  id: string,
  cx: number,
  cy: number,
  size: number,
  pixels: number,
): Prim[] {
  const X = (x: number) => cx + (x / 100 - 0.5) * size,
    Y = (y: number) => cy + (0.5 - y / 100) * size;
  return thingArt[kind].map((layer, j): Prim => {
    const d = thingOps(layer.d).map((op): PathOp => {
      if (op[0] === "Z") return ["Z"];
      const out: number[] = [];
      for (let i = 1; i < op.length; i += 2)
        out.push(X(op[i] as number), Y(op[i + 1] as number));
      return [op[0], ...out] as PathOp;
    });
    return {
      type: "path",
      id: `${id}.${j}`,
      d,
      fill: layer.fill ?? "none",
      ...(layer.stroke
        ? { stroke: layer.stroke, width: thingStroke(pixels, layer.w ?? 1) }
        : { noStroke: true }),
      ...(j === 0 ? { data: { thing: kind } } : {}),
    };
  });
}

registerComponent("things", {
  // Films and every later client draw things; no problem sends one to a
  // client until the wire contract lists this capability (docs/figures.md).
  capability: () => "scenes-v3",
  maxScale: () => 72,
  compile(t, { s }) {
    const a = arrangement(t);
    const prims: Prim[] = [];
    for (const [i, [x, y, w, h]] of (a.cells ?? []).entries())
      prims.push({
        type: "rect",
        id: `slot.${i}`,
        at: [x, -(y + h)],
        size: [w, h],
        fill: "paper",
        stroke: "ink",
        width: 1.5,
        data: { slot: i },
      });
    thingsInOrder(t).forEach((kind, i) => {
      const [x, y] = a.slots[i]!;
      prims.push(...thingPrims(kind, `thing.${i}`, x, -y, 1, s));
    });
    return shifted(prims, t.at);
  },
  describe(t) {
    const count = total(t);
    const sets = t.sets.map(
      (set) => `${spoken(set.count)} ${thingName(set.kind, set.count)}`,
    );
    const list =
      sets.length < 3
        ? sets.join(" and ")
        : `${sets.slice(0, -1).join(", ")} and ${sets.at(-1)}`;
    switch (t.arrange ?? "row") {
      case "frame": {
        const size = t.frame ?? 10,
          frames = count > size ? 2 : 1,
          empty = frames * size - count;
        const name = size === 10 ? "ten-frame" : "five-frame";
        return `${frames === 1 ? `One ${name}` : `Two ${name}s`}, each with ${spoken(size)} places, holding ${list}. ${empty === 0 ? "Every place is full" : `${spoken(empty)} ${empty === 1 ? "place is" : "places are"} empty`}.`;
      }
      case "groups":
        return `${sets.length === 1 ? "One group" : `${spoken(sets.length)} groups`} of things to count: ${list}.`;
      case "scatter":
        return `Things to count, scattered with space between them: ${list}.`;
      case "grid":
        return `Things to count, in rows of ${spoken(Math.min(t.perRow ?? 5, count))}: ${list}.`;
      default:
        return `Things to count, in a row: ${list}.`;
    }
  },
});

/** A frame's cell in thing widths, for callers that draw beside one. */
export const thingsFrameCell = FRAME_CELL;
