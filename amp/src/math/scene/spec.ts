import { z } from "zod";

/**
 * Scene spec: plain, serializable figure data. A generator emits it, zod
 * validates it, and one layout engine turns it into screen SVG, print SVG and
 * an accessible description. Geometry is in math coordinates (y up); sizes of
 * marks, ticks and labels are in figure pixels and never scale with the data.
 *
 * Two layers share one element list: math-aware components (`numberLine`,
 * `graph`, `areaModel`, …) compile to primitives (`segment`, `text`, …).
 * Every element may carry an `id`; compiled parts get `id.part` names, which
 * timelines, hints and tests address.
 */
const num = z.number().finite();
const coord = num.min(-1e6).max(1e6);
export const pointSchema = z.tuple([coord, coord]);
export type Point = z.infer<typeof pointSchema>;
const px = num.min(-400).max(400);
export const elementId = z
  .string()
  .regex(/^[a-zA-Z][\w-]{0,31}$/, "Element ids are short words");

import { fillRoles, inkRoles, type FillRole, type InkRole } from "./roles";
import { stepsSchema } from "./timeline";
export { fillRoles, inkRoles, type FillRole, type InkRole };
const ink = z.enum(inkRoles);
const fill = z.enum(fillRoles);
const dash = z.enum(["solid", "dash", "dot"]);
const width = num.min(0.5).max(12);
const label = z.string().min(1).max(60);

const base = { id: elementId.optional() };
const stroke = {
  stroke: ink.optional(),
  width: width.optional(),
  dash: dash.optional(),
};
/** Where a label's box sits relative to its anchor: -1 left/top edge on the
 * anchor, 0 centered, 1 right/bottom edge on the anchor. */
const side = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
const align = z.tuple([side, side]);
const placement = z.tuple([px, px, side, side]);

export const textSchema = z
  .object({
    ...base,
    type: z.literal("text"),
    at: pointSchema,
    text: label,
    /** `math`: KaTeX fonts, italic variables, stacked `a/b`, `x^2`. */
    font: z.enum(["math", "sans"]).optional(),
    size: z.enum(["sm", "md", "lg"]).optional(),
    bold: z.boolean().optional(),
    color: ink.optional(),
    align: align.optional(),
    offset: z.tuple([px, px]).optional(),
    /** Candidate [dx, dy, ax, ay] placements; the first clear one is used. */
    place: z.array(placement).max(12).optional(),
    /** Dropped, rather than drawn over another label, when crowded. */
    optional: z.boolean().optional(),
    /** A value the learner is asked to find: drawn as "?" unless revealed. */
    derived: z.boolean().optional(),
    /** Paint a paper backing so the label reads over grid lines. */
    halo: z.boolean().optional(),
  })
  .strict();
const segmentSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("segment"),
    from: pointSchema,
    to: pointSchema,
    arrow: z.enum(["start", "end", "both"]).optional(),
  })
  .strict();
const polylineSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("polyline"),
    points: z.array(pointSchema).min(2).max(2000),
    closed: z.boolean().optional(),
    fill: fill.optional(),
    opacity: num.min(0).max(1).optional(),
  })
  .strict();
const polygonSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("polygon"),
    points: z.array(pointSchema).min(3).max(2000),
    fill: fill.optional(),
    opacity: num.min(0).max(1).optional(),
  })
  .strict();
const pathOp = z.union([
  z.tuple([z.literal("M"), coord, coord]),
  z.tuple([z.literal("L"), coord, coord]),
  z.tuple([z.literal("Q"), coord, coord, coord, coord]),
  z.tuple([z.literal("C"), coord, coord, coord, coord, coord, coord]),
  z.tuple([z.literal("Z")]),
]);
export type PathOp = z.infer<typeof pathOp>;
const pathSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("path"),
    d: z.array(pathOp).min(2).max(2000),
    fill: fill.optional(),
    opacity: num.min(0).max(1).optional(),
  })
  .strict();
const arcSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("arc"),
    center: pointSchema,
    r: num.positive().max(1e6),
    /** Degrees, counterclockwise from the positive x direction. */
    from: num,
    to: num,
    arrow: z.enum(["start", "end", "both"]).optional(),
    /** Fill the sector (angle marks). */
    fill: fill.optional(),
  })
  .strict();
const circleSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("circle"),
    center: pointSchema,
    r: num.positive().max(1e6),
    fill: fill.optional(),
    opacity: num.min(0).max(1).optional(),
  })
  .strict();
const rectSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("rect"),
    /** Lower-left corner and size, in math units. */
    at: pointSchema,
    size: z.tuple([num.positive().max(1e6), num.positive().max(1e6)]),
    fill: fill.optional(),
    radius: num.min(0).max(40).optional(),
    opacity: num.min(0).max(1).optional(),
  })
  .strict();
const markSchema = z
  .object({
    ...base,
    type: z.literal("point"),
    at: pointSchema,
    r: num.min(1).max(20).optional(),
    shape: z.enum(["dot", "open", "square"]).optional(),
    color: ink.optional(),
  })
  .strict();
const tickSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("tick"),
    at: pointSchema,
    /** Screen direction of the tick, e.g. [0, 1] is vertical. */
    dir: z.tuple([num, num]),
    length: num.min(1).max(60),
  })
  .strict();
const braceSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("brace"),
    from: pointSchema,
    to: pointSchema,
    /** Pixels from the measured span; the brace bulges to the left of from→to. */
    gap: num.min(0).max(60).optional(),
    label: label.optional(),
    derived: z.boolean().optional(),
  })
  .strict();
const arrowSchema = z
  .object({
    ...base,
    ...stroke,
    type: z.literal("arrow"),
    from: pointSchema,
    to: pointSchema,
    /** Pixels of bow to the left of from→to (a hop); 0 is straight. */
    bend: px.optional(),
  })
  .strict();

export const primitiveSchemas = [
  textSchema,
  segmentSchema,
  polylineSchema,
  polygonSchema,
  pathSchema,
  arcSchema,
  circleSchema,
  rectSchema,
  markSchema,
  tickSchema,
  braceSchema,
  arrowSchema,
] as const;
export type Primitive = z.infer<(typeof primitiveSchemas)[number]>;

// ---------------------------------------------------------------- components
const small = z.number().int().min(0);
const color = ink.optional();

/** A number line with ticks, marks, intervals and hops. */
export const numberLineSchema = z
  .object({
    ...base,
    type: z.literal("numberLine"),
    min: coord,
    max: coord,
    /** Tick spacing. A denominator ticks every 1/d and labels fractions. */
    step: num.positive().optional(),
    denominator: z.number().int().min(2).max(16).optional(),
    labels: z
      .union([z.enum(["auto", "ends", "none"]), z.array(coord).max(40)])
      .optional(),
    marks: z
      .array(
        z
          .object({
            at: coord,
            label: z.union([z.boolean(), label]).optional(),
            open: z.boolean().optional(),
            color,
            derived: z.boolean().optional(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    hops: z
      .array(
        z
          .object({
            from: coord,
            by: coord.refine((n) => n !== 0, "A hop moves"),
            /** Text above the hop; defaults to the signed change. */
            label: z.union([label, z.literal(false)]).optional(),
            /** The landing value: shown, masked as the unknown, or omitted. */
            landing: z.enum(["shown", "derived", "none"]).optional(),
            color,
          })
          .strict(),
      )
      .max(12)
      .optional(),
    intervals: z
      .array(
        z
          .object({
            from: coord.nullable(),
            to: coord.nullable(),
            open: z.tuple([z.boolean(), z.boolean()]).optional(),
            color,
          })
          .strict(),
      )
      .max(4)
      .optional(),
  })
  .strict()
  .refine((f) => f.max > f.min, "max exceeds min")
  .refine(
    (f) =>
      (f.max - f.min) / (f.denominator ? 1 / f.denominator : (f.step ?? 1)) <=
      200,
    "At most 200 ticks",
  );

/** Exact function families. Each knows its own zeros, vertex, intercepts and
 * asymptotes, so those can be drawn and named without sampling error. */
const coefficients = z.array(coord).min(1).max(7);
export const fnSchema = z.discriminatedUnion("f", [
  /** c[0] + c[1]x + c[2]x² + … */
  z.object({ f: z.literal("poly"), c: coefficients }).strict(),
  z
    .object({ f: z.literal("rational"), num: coefficients, den: coefficients })
    .strict(),
  /** a·bˣ⁻ʰ + k */
  z
    .object({
      f: z.literal("exp"),
      a: coord,
      b: num.positive().refine((b) => b !== 1),
      h: coord.optional(),
      k: coord.optional(),
    })
    .strict(),
  /** a·log_b(x − h) + k */
  z
    .object({
      f: z.literal("log"),
      a: coord,
      base: num.positive().refine((b) => b !== 1),
      h: coord.optional(),
      k: coord.optional(),
    })
    .strict(),
  /** a·trig(b(x − h)) + k */
  z
    .object({
      f: z.enum(["sin", "cos", "tan"]),
      a: coord,
      b: coord.refine((b) => b !== 0),
      h: coord.optional(),
      k: coord.optional(),
    })
    .strict(),
  /** a·|x − h| + k and a·√(x − h) + k */
  z
    .object({
      f: z.enum(["abs", "sqrt"]),
      a: coord,
      h: coord.optional(),
      k: coord.optional(),
    })
    .strict(),
]);
export type Fn = z.infer<typeof fnSchema>;
/** a·x + b·y = c, or slope-intercept, or vertical. */
export const lineSpecSchema = z.union([
  z.object({ m: coord, b: coord }).strict(),
  z.object({ x: coord }).strict(),
  z.object({ a: coord, b: coord, c: coord }).strict(),
  z.object({ through: z.tuple([pointSchema, pointSchema]) }).strict(),
]);
export type LineSpec = z.infer<typeof lineSpecSchema>;
const endStyle = z.enum(["open", "closed", "arrow", "none"]);
export const featureNames = [
  "zeros",
  "vertex",
  "yint",
  "asymptotes",
  "holes",
] as const;
const graphLabel = z.union([label, z.literal(false)]).optional();
/** A coordinate plane and everything drawn on it: the function-graph figure. */
export const graphSchema = z
  .object({
    ...base,
    type: z.literal("graph"),
    x: z.tuple([coord, coord]),
    y: z.tuple([coord, coord]),
    /** Gridline spacing (false: no grid) and tick-label spacing; a pair sets
     * x and y separately, as data plots with unlike units need. */
    grid: z
      .union([
        num.positive(),
        z.tuple([num.positive(), num.positive()]),
        z.literal(false),
      ])
      .optional(),
    tick: z
      .union([num.positive(), z.tuple([num.positive(), num.positive()])])
      .optional(),
    /** Ratio of a y unit to an x unit on screen; 1 keeps circles round. */
    aspect: num.min(0.05).max(20).optional(),
    labels: z.enum(["auto", "all", "ends", "none"]).optional(),
    axisNames: z.tuple([label, label]).optional(),
    points: z
      .array(
        z
          .object({
            x: coord,
            y: coord,
            label: graphLabel,
            open: z.boolean().optional(),
            color,
            derived: z.boolean().optional(),
          })
          .strict(),
      )
      .max(60)
      .optional(),
    lines: z
      .array(
        z
          .object({
            line: lineSpecSchema,
            dash: dash.optional(),
            color,
            label: graphLabel,
          })
          .strict(),
      )
      .max(6)
      .optional(),
    curves: z
      .array(
        z
          .object({
            fn: fnSchema,
            domain: z.tuple([coord, coord]).optional(),
            ends: z.tuple([endStyle, endStyle]).optional(),
            dash: dash.optional(),
            color,
            label: graphLabel,
            features: z.array(z.enum(featureNames)).max(5).optional(),
            /** Coordinates beside feature points; masked unless revealed. */
            featureLabels: z.enum(["shown", "derived"]).optional(),
          })
          .strict(),
      )
      .max(8)
      .optional(),
    /** Intersections of half-planes a·x + b·y (op) c: a solution set. */
    regions: z
      .array(
        z
          .object({
            halfPlanes: z
              .array(
                z
                  .object({
                    a: coord,
                    b: coord,
                    c: coord,
                    op: z.enum(["<", "<=", ">", ">="]),
                    boundary: z.boolean().optional(),
                  })
                  .strict()
                  .refine((h) => h.a !== 0 || h.b !== 0),
              )
              .min(1)
              .max(6),
            color: z.enum(["accent", "warm", "gold"]).optional(),
          })
          .strict(),
      )
      .max(4)
      .optional(),
    /** The part of the plane above or below a drawn curve. */
    curveRegions: z
      .array(
        z
          .object({
            curve: small.max(7),
            side: z.enum(["above", "below"]),
            color: z.enum(["accent", "warm", "gold"]).optional(),
          })
          .strict(),
      )
      .max(4)
      .optional(),
    circles: z
      .array(
        z
          .object({
            center: pointSchema,
            r: num.positive(),
            showCenter: z.boolean().optional(),
            radius: z.boolean().optional(),
            dash: dash.optional(),
            color,
          })
          .strict(),
      )
      .max(4)
      .optional(),
    segments: z
      .array(
        z
          .object({
            from: pointSchema,
            to: pointSchema,
            dash: dash.optional(),
            arrow: z.boolean().optional(),
            color,
          })
          .strict(),
      )
      .max(20)
      .optional(),
    /** Run and rise between two points of a line. */
    slopeTriangles: z
      .array(
        z
          .object({
            from: pointSchema,
            to: pointSchema,
            labels: z.enum(["shown", "derived", "none"]).optional(),
            color,
          })
          .strict(),
      )
      .max(4)
      .optional(),
    /** The line through two points of a curve. */
    secants: z
      .array(
        z
          .object({
            curve: small.max(7),
            x: z.tuple([coord, coord]),
            color,
          })
          .strict(),
      )
      .max(3)
      .optional(),
    /** Scatter points with an optional fitted line and residual sticks. */
    scatter: z
      .object({
        points: z.array(pointSchema).min(1).max(200),
        fit: z.object({ m: coord, b: coord }).strict().optional(),
        residuals: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((g) => g.x[1] > g.x[0] && g.y[1] > g.y[0], "Ranges increase")
  .refine(
    (g) =>
      g.grid === false ||
      ((g.x[1] - g.x[0]) / axisStep(g.grid, 0, 1) <= 60 &&
        (g.y[1] - g.y[0]) / axisStep(g.grid, 1, 1) <= 60),
    "At most 60 gridlines per axis",
  );
/** One axis's spacing from a shared or per-axis setting. */
export function axisStep<T>(
  value: number | readonly [number, number] | undefined | T,
  axis: 0 | 1,
  fallback: number,
): number {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value[axis] as number;
  return fallback;
}

/** A rectangle partitioned by place value or by terms: an area model. */
export const areaModelSchema = z
  .object({
    ...base,
    type: z.literal("areaModel"),
    across: z.array(num.positive().max(1e5)).min(1).max(4),
    down: z.array(num.positive().max(1e5)).min(1).max(4),
    /** Side labels, defaulting to the part values. */
    acrossLabels: z.array(label).max(4).optional(),
    downLabels: z.array(label).max(4).optional(),
    /** Region products: the learner's work, so masked by default. */
    products: z.enum(["shown", "derived", "none"]).optional(),
    scale: z.enum(["auto", "proportional", "schematic"]).optional(),
    unitGrid: z.boolean().optional(),
  })
  .strict()
  .refine(
    (f) =>
      (!f.acrossLabels || f.acrossLabels.length === f.across.length) &&
      (!f.downLabels || f.downLabels.length === f.down.length),
  );

/** Rows × columns of unit squares or dots, optionally split into regions. */
export const arraySchema = z
  .object({
    ...base,
    type: z.literal("array"),
    rows: z.number().int().min(1).max(20),
    columns: z.number().int().min(1).max(20),
    shape: z.enum(["square", "dot"]).optional(),
    splitAfterRow: z.number().int().min(1).optional(),
    splitAfterColumn: z.number().int().min(1).optional(),
    regionLabels: z.boolean().optional(),
  })
  .strict()
  .refine(
    (f) =>
      (f.splitAfterRow === undefined || f.splitAfterRow < f.rows) &&
      (f.splitAfterColumn === undefined || f.splitAfterColumn < f.columns),
  );

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

/** Hundred flats, ten rods and unit cubes, grouped in labeled columns. */
export const baseTenSchema = z
  .object({
    ...base,
    type: z.literal("baseTen"),
    hundreds: small.max(9),
    tens: small.max(20),
    ones: small.max(20),
    labels: z.boolean().optional(),
  })
  .strict();

/** Bars of one whole length, each cut into equal parts with some shaded. */
export const fractionBarSchema = z
  .object({
    ...base,
    type: z.literal("fractionBar"),
    bars: z
      .array(
        z
          .object({
            parts: z.number().int().min(1).max(24),
            shaded: small.max(48),
            /** How many wholes this bar spans (improper fractions). */
            wholes: z.number().int().min(1).max(3).optional(),
            label: graphLabel,
            derivedLabel: z.boolean().optional(),
            color: z.enum(["accent", "warm", "gold"]).optional(),
          })
          .strict()
          .refine((b) => b.shaded <= b.parts * (b.wholes ?? 1)),
      )
      .min(1)
      .max(6),
  })
  .strict();

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

const tableCell = z.union([
  num.min(-1e6).max(1e6),
  z.string().min(1).max(16),
  z.null(),
]);
/** A table of short entries: header row, labeled rows and, with `sums`, a
 * total column and a total row. A derived cell is the one to find: it is null
 * in the data, drawn as "?", and when revealed computed from the sums. */
export const tableSchema = z
  .object({
    ...base,
    type: z.literal("table"),
    /** A heading over the body columns ("Has a curfew"). */
    title: label.max(32).optional(),
    columns: z.array(z.string().min(1).max(16)).min(1).max(6),
    rows: z
      .array(
        z
          .object({
            label: z.string().min(1).max(18),
            cells: z.array(tableCell).min(1).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    sums: z.boolean().optional(),
    derived: z
      .array(z.tuple([small.max(7), small.max(5)]))
      .max(4)
      .optional(),
    /** A heading over the row labels ("x", "n"). */
    corner: z.string().min(1).max(16).optional(),
    /** Headings and row labels are mathematics (x, f(x), a_n, 2^x), set
     * like the numbers rather than as bold words. */
    math: z.boolean().optional(),
    /** The change between consecutive rows of a body column (+3, ×2), drawn
     * as bowed arrows in a gutter to that column's right. */
    steps: z
      .array(
        z
          .object({
            column: small.max(5),
            labels: z.array(z.union([label, z.literal(false)])).max(7),
            color,
          })
          .strict(),
      )
      .max(3)
      .optional(),
    /** Rows (a conditional distribution) or body columns to tint. */
    highlight: z
      .object({
        rows: z.array(small.max(7)).max(8).optional(),
        columns: z.array(small.max(5)).max(6).optional(),
        color: z.enum(["accent", "warm", "gold"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (t) => t.rows.every((r) => r.cells.length === t.columns.length),
    "Every row has one cell per column",
  )
  .refine(
    (t) =>
      (t.steps ?? []).every(
        (s) =>
          s.column < t.columns.length && s.labels.length === t.rows.length - 1,
      ),
    "A step labels each gap between rows of a real column",
  )
  .refine(
    (t) =>
      (t.derived ?? []).every(
        ([r, c]) => r < t.rows.length && t.rows[r]!.cells[c] === null,
      ),
    "A derived cell is an empty cell of the table",
  )
  .refine(
    (t) => !t.derived?.length || (t.sums && completeTable(t) !== null),
    "Derived cells follow from the sums",
  )
  .refine((t) => !t.sums || completeTable(t) !== null, "Totals add up");
/** Fill a summed table's numeric blanks from its row and column totals; null
 * when it is inconsistent or the blanks are not determined. */
export function completeTable(t: {
  rows: { cells: (number | string | null)[] }[];
}): number[][] | null {
  const g = t.rows.map((r) =>
    r.cells.map((v) => (typeof v === "number" ? v : null)),
  );
  if (t.rows.some((r) => r.cells.some((v) => typeof v === "string")))
    return null;
  const n = g.length,
    m = g[0]!.length;
  const lines = [
    ...g.map((_, i) => Array.from({ length: m }, (_, j) => [i, j] as const)),
    ...Array.from({ length: m }, (_, j) =>
      Array.from({ length: n }, (_, i) => [i, j] as const),
    ),
  ];
  for (let changed = true; changed;) {
    changed = false;
    for (const line of lines) {
      const open = line.filter(([i, j]) => g[i]![j] === null);
      if (open.length !== 1) continue;
      const [oi, oj] = open[0]!;
      const last = line.at(-1)!;
      const parts = line
        .slice(0, -1)
        .filter(([i, j]) => !(i === oi && j === oj))
        .reduce((a, [i, j]) => a + g[i]![j]!, 0);
      g[oi]![oj] =
        oi === last[0] && oj === last[1]
          ? parts
          : g[last[0]]![last[1]]! - parts;
      changed = true;
    }
  }
  if (g.some((row) => row.some((v) => v === null))) return null;
  const full = g as number[][];
  for (const line of lines) {
    const values = line.map(([i, j]) => full[i]![j]!);
    const total = values.pop()!;
    if (Math.abs(values.reduce((a, b) => a + b, 0) - total) > 1e-9) return null;
  }
  return full;
}

const direction = num.min(-720).max(720);
const pointName = z.string().regex(/^[A-Z]$/);
/** A protractor centered on a vertex, unit radius. Outer numbers count from
 * 0 on the left, inner numbers from 0 on the right. Rays are directions in
 * degrees (counterclockwise from the right) within the half turn. */
export const protractorSchema = z
  .object({
    ...base,
    type: z.literal("protractor"),
    rays: z.tuple([num.min(0).max(180), num.min(0).max(180)]),
    /** End of the first ray, the vertex, end of the second ray. */
    labels: z.tuple([pointName, pointName, pointName]).optional(),
  })
  .strict()
  .refine((p) => p.rays[0] !== p.rays[1], "Two distinct rays");

/** Rays from one vertex, drawn to their true directions, with angle marks
 * between chosen pairs. A right angle is marked with a square. */
export const angleSchema = z
  .object({
    ...base,
    type: z.literal("angle"),
    rays: z.array(direction).min(2).max(4),
    /** Ray length in math units. */
    length: num.positive().max(10).optional(),
    /** Arrowheads at the ray ends: rays go on forever. */
    arrows: z.boolean().optional(),
    labels: z
      .object({
        vertex: pointName,
        ends: z.array(pointName).min(2).max(4),
      })
      .strict()
      .optional(),
    /** Marks counterclockwise from ray `from` to ray `to`. */
    marks: z
      .array(
        z
          .object({
            from: z.number().int().min(0).max(3),
            to: z.number().int().min(0).max(3),
            /** Write the measure in degrees beside the mark. */
            measure: z.boolean().optional(),
            /** The measure is the unknown: drawn as "?" unless revealed. */
            derived: z.boolean().optional(),
            color,
          })
          .strict(),
      )
      .max(3)
      .optional(),
  })
  .strict()
  .refine(
    (a) =>
      (!a.labels || a.labels.ends.length === a.rays.length) &&
      (a.marks ?? []).every(
        (m) =>
          m.from < a.rays.length && m.to < a.rays.length && m.from !== m.to,
      ),
    "Labels and marks name existing rays",
  );

/** Vertical bars over categories: one series, or two side by side. Heights
 * share one linear scale, so growth reads directly. */
export const barsSchema = z
  .object({
    ...base,
    type: z.literal("bars"),
    categories: z.array(label).min(1).max(12),
    series: z
      .array(
        z
          .object({
            values: z.array(num.min(0).max(1e9)).min(1).max(12),
            label: label.optional(),
            color: z.enum(["accent", "warm", "gold"]).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(2),
    /** Value labels on top of the bars (default true). */
    valueLabels: z.boolean().optional(),
    /** Caption under the category labels. */
    axisName: label.optional(),
  })
  .strict()
  .refine(
    (b) => b.series.every((s) => s.values.length === b.categories.length),
    "One value per category",
  )
  .refine(
    (b) => b.series.some((s) => s.values.some((v) => v > 0)),
    "Some bar has height",
  );

export const componentSchemas = [
  protractorSchema,
  angleSchema,
  numberLineSchema,
  graphSchema,
  areaModelSchema,
  arraySchema,
  tenFrameSchema,
  baseTenSchema,
  fractionBarSchema,
  clockSchema,
  tableSchema,
  barsSchema,
] as const;
export type Component = z.infer<(typeof componentSchemas)[number]>;
export type NumberLine = z.infer<typeof numberLineSchema>;
export type Graph = z.infer<typeof graphSchema>;
export type AreaModel = z.infer<typeof areaModelSchema>;
export type ArrayModel = z.infer<typeof arraySchema>;
export type TenFrame = z.infer<typeof tenFrameSchema>;
export type BaseTen = z.infer<typeof baseTenSchema>;
export type FractionBar = z.infer<typeof fractionBarSchema>;
export type Clock = z.infer<typeof clockSchema>;
export type Table = z.infer<typeof tableSchema>;
export type Bars = z.infer<typeof barsSchema>;
export type Protractor = z.infer<typeof protractorSchema>;
export type Angle = z.infer<typeof angleSchema>;

/** A component or primitive, placed by an optional math-unit offset. */
export const elementSchema = z.union([
  ...componentSchemas,
  ...primitiveSchemas,
]);
export type Element = Component | Primitive;

export const sceneSchema = z
  .object({
    v: z.literal(1),
    /** Accessible name; the description is derived from the elements. */
    title: z.string().min(1).max(200).optional(),
    /** Extra sentences appended to the derived description. */
    note: z.string().min(1).max(400).optional(),
    /** Target width and height ceiling in figure pixels. */
    width: z.number().int().min(160).max(720).optional(),
    maxHeight: z.number().int().min(80).max(720).optional(),
    elements: z.array(elementSchema).min(1).max(64),
    /** A walkthrough over the elements (docs/figures.md, "Timelines"). A
     * problem figure shows the start frame; hints and lessons play it. */
    steps: stepsSchema.optional(),
  })
  .strict()
  .refine((scene) => {
    const ids = scene.elements.flatMap((e) => (e.id ? [e.id] : []));
    return new Set(ids).size === ids.length;
  }, "Element ids are unique");
export type Scene = z.infer<typeof sceneSchema>;
