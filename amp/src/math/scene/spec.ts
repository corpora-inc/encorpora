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
import { fillRoles, inkRoles, type FillRole, type InkRole } from "./roles";
import { stepsSchema } from "./timeline";
import {
  align,
  base,
  coord,
  dash,
  elementId,
  fill,
  ink,
  label,
  num,
  placement,
  pointSchema,
  px,
  stroke,
} from "./base";
import { componentSchemas } from "./components";
export { fillRoles, inkRoles, type FillRole, type InkRole };
export { pointSchema, elementId };
export type Point = [number, number];
export * from "./components";

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
    place: z.array(placement).max(48).optional(),
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

export type Component = z.infer<(typeof componentSchemas)[number]>;

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
