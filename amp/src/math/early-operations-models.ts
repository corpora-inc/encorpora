import { z } from "zod";

/** Public part–whole, equality and change figures for K–2 operations. Each
 * figure holds exactly one unknown, drawn as a box with a question mark and
 * sent as null, so the payload never carries the answer. */
const known = (max: number) => z.number().int().min(0).max(max).nullable();
const oneUnknown = (values: (number | null)[]) =>
  values.filter((v) => v === null).length === 1;

export const earlyOperationsFigureSchemas = [
  z
    .object({
      kind: z.literal("number-bond"),
      whole: known(20),
      parts: z.tuple([known(20), known(20)]),
    })
    .strict()
    .refine((f) => {
      if (!oneUnknown([f.whole, ...f.parts])) return false;
      const [a, b] = f.parts;
      return f.whole === null || ((a ?? 0) <= f.whole && (b ?? 0) <= f.whole);
    }, "A number bond has one unknown and parts no larger than the whole"),
  z
    .object({
      kind: z.literal("bar-model"),
      /** Two bars on one scale: the whole above, its parts below. */
      whole: known(100),
      parts: z.array(known(100)).min(2).max(3),
    })
    .strict()
    .refine(
      (f) =>
        oneUnknown([f.whole, ...f.parts]) &&
        f.parts.every((p) => p === null || p > 0) &&
        (f.whole === null ||
          f.parts.reduce<number>((s, p) => s + (p ?? 0), 0) < f.whole),
      "A bar model has one unknown and positive parts inside the whole",
    ),
  z
    .object({
      kind: z.literal("equal-balance"),
      /** Groups of counters on each pan; null is a closed box. */
      left: z.array(known(20)).min(1).max(2),
      right: z.array(known(20)).min(1).max(2),
    })
    .strict()
    .refine((f) => {
      if (!oneUnknown([...f.left, ...f.right])) return false;
      const sum = (side: (number | null)[]) =>
        side.reduce<number>((s, v) => s + (v ?? 0), 0);
      return sum(f.left) <= 20 && sum(f.right) <= 20;
    }, "A balance has one closed box and at most twenty counters a side"),
  z
    .object({
      kind: z.literal("addend-groups"),
      addends: z.tuple([
        z.number().int().min(1).max(9),
        z.number().int().min(1).max(9),
        z.number().int().min(1).max(9),
      ]),
    })
    .strict()
    .refine((f) => f.addends.reduce((s, a) => s + a, 0) <= 20),
  z
    .object({
      kind: z.literal("change-chain"),
      start: known(100),
      steps: z
        .array(z.object({ op: z.enum(["+", "−"]), value: known(100) }).strict())
        .length(2),
      end: known(100),
    })
    .strict()
    .refine(
      (f) => oneUnknown([f.start, ...f.steps.map((s) => s.value), f.end]),
      "A change chain has one unknown",
    ),
] as const;
export const earlyOperationsFigureSchema = z.discriminatedUnion(
  "kind",
  earlyOperationsFigureSchemas,
);
export type EarlyOperationsFigure = z.infer<typeof earlyOperationsFigureSchema>;
