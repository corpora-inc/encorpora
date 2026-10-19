import { z } from "zod";

/** Public figures for measurable attributes. Lengths and placements are in
 * whole or half units of one shared unit length, so every drawing is exact. */
const label = z.enum(["A", "B", "C"]);
const half = z
  .number()
  .min(0)
  .max(14)
  .refine((x) => Number.isInteger(x * 2), "Half-unit positions only");
export const attributeFigureSchemas = [
  z
    .object({
      kind: z.literal("length-rods"),
      rods: z
        .array(
          z
            .object({
              label,
              length: z.number().int().min(1).max(12),
              /** Left end, in units from the shared left edge. */
              start: half,
            })
            .strict(),
        )
        .min(2)
        .max(3),
    })
    .strict()
    .refine(
      (f) =>
        new Set(f.rods.map((r) => r.label)).size === f.rods.length &&
        f.rods.every((r) => r.start + r.length <= 14),
    ),
  z
    .object({
      kind: z.literal("unit-measure"),
      unit: z.enum(["cube", "clip"]),
      panels: z
        .array(
          z
            .object({
              label: label.optional(),
              /** The measured object's length, in units. */
              length: z.number().int().min(2).max(10),
              /** Left end of each one-unit-long unit, in units. */
              placements: z.array(half).min(1).max(12),
            })
            .strict()
            .refine((p) =>
              p.placements.every((x, i) => i === 0 || x > p.placements[i - 1]!),
            ),
        )
        .min(1)
        .max(3),
    })
    .strict()
    .refine(
      (f) =>
        f.panels.length === 1 ||
        (f.panels.every((p) => p.label) &&
          new Set(f.panels.map((p) => p.label)).size === f.panels.length),
    ),
  z
    .object({
      kind: z.literal("balance"),
      /** The beam drops on the heavier side. */
      tilt: z.enum(["left", "right", "level"]),
      left: z
        .object({
          shape: z.enum(["box", "ball", "bag"]),
          /** Drawn size, 1–3; deliberately independent of mass. */
          size: z.number().int().min(1).max(3),
          label: label.optional(),
        })
        .strict(),
      right: z.union([
        z
          .object({
            shape: z.enum(["box", "ball", "bag"]),
            size: z.number().int().min(1).max(3),
            label: label.optional(),
          })
          .strict(),
        z
          .object({
            /** Labelled standard masses, in grams. */
            grams: z.array(z.number().int().positive().max(1000)).min(1).max(6),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("pour"),
      /** Water from full jar A, poured into empty jar B, fills this many
       * eighths of B; 8 is exactly full and 9 means some spilled over. */
      eighths: z.number().int().min(1).max(9),
    })
    .strict(),
  z
    .object({
      kind: z.literal("liquid-scale"),
      unit: z.literal("L"),
      max: z.number().int().min(4).max(40),
      /** Liters between neighbouring ticks; labels every `labelEvery` ticks. */
      step: z.number().int().min(1).max(5),
      labelEvery: z.number().int().min(1).max(10),
      level: z.number().int().min(1),
    })
    .strict()
    .refine(
      (f) =>
        f.max % f.step === 0 &&
        (f.max / f.step) % f.labelEvery === 0 &&
        f.level < f.max &&
        f.level % f.step === 0,
    ),
] as const;
export const attributeFigureSchema = z.discriminatedUnion(
  "kind",
  attributeFigureSchemas,
);
export type AttributeFigure = z.infer<typeof attributeFigureSchema>;
