import { z } from "zod";

/** Whole-number line plots. Missing counts mean zero; order is immaterial. */
export type LinePlotBuildResponse = {
  kind: "line-plot-build";
  label: string;
  axis: { min: number; max: number; unit: string };
  maxPerValue: number;
  marker: "x";
  /** Public number of measurements, for the running count, never a submit gate. */
  measurementCount?: number;
};
export type LinePlotBuildAnswer = { counts: Record<string, number> };
export const linePlotBuildResponseSchema: z.ZodType<LinePlotBuildResponse> = z
  .object({
    kind: z.literal("line-plot-build"),
    label: z.string().trim().min(1).max(200),
    axis: z
      .object({
        min: z.number().int().min(0).max(100),
        max: z.number().int().min(1).max(107),
        unit: z.string().trim().min(1).max(30),
      })
      .strict(),
    maxPerValue: z.number().int().min(1).max(6),
    marker: z.literal("x"),
    measurementCount: z.number().int().min(1).max(48).optional(),
  })
  .strict()
  .refine(
    (r) => r.axis.max - r.axis.min >= 4 && r.axis.max - r.axis.min <= 7,
    "A line plot has 5 to 8 consecutive whole-number columns",
  );

/** Private context used only to explain a wrong ruler reading. */
export const linePlotContextSchema = z
  .object({
    object: z.string().trim().min(1).max(60),
    readings: z
      .array(
        z
          .object({
            start: z.number().int().min(0).max(3),
            end: z.number().finite().min(1).max(24),
          })
          .strict()
          .refine((r) => r.end > r.start),
      )
      .min(4)
      .max(6)
      .optional(),
  })
  .strict();
export type LinePlotContext = z.infer<typeof linePlotContextSchema>;

export function linePlotValues(response: LinePlotBuildResponse): number[] {
  return Array.from(
    { length: response.axis.max - response.axis.min + 1 },
    (_, i) => response.axis.min + i,
  );
}

/** Reject rather than clamp foreign columns, fractions, negative or excessive counts. */
export function normalizeLinePlotBuild(
  response: LinePlotBuildResponse,
  raw: string,
): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).join() !== "counts"
    )
      return null;
    const counts = (value as LinePlotBuildAnswer).counts;
    if (!counts || typeof counts !== "object" || Array.isArray(counts))
      return null;
    const allowed = linePlotValues(response).map(String);
    if (
      Object.entries(counts).some(
        ([key, count]) =>
          !allowed.includes(key) ||
          !Number.isInteger(count) ||
          count < 0 ||
          count > response.maxPerValue,
      )
    )
      return null;
    return JSON.stringify({
      counts: Object.fromEntries(
        allowed
          .filter((key) => (counts[key] ?? 0) > 0)
          .map((key) => [key, counts[key]]),
      ),
    });
  } catch {
    return null;
  }
}

export function linePlotCounts(
  response: LinePlotBuildResponse,
  raw: string,
): Record<string, number> {
  const normalized = normalizeLinePlotBuild(response, raw);
  return normalized === null
    ? {}
    : (JSON.parse(normalized) as LinePlotBuildAnswer).counts;
}
export function gradeLinePlotBuild(
  response: LinePlotBuildResponse,
  key: string,
  raw: string,
): boolean {
  const answer = normalizeLinePlotBuild(response, raw);
  return answer !== null && answer === normalizeLinePlotBuild(response, key);
}
export function linePlotBuildAnswerText(
  response: LinePlotBuildResponse,
  raw: string,
): string {
  const counts = linePlotCounts(response, raw);
  return (
    Object.entries(counts)
      .map(
        ([value, count]) =>
          `${count} ${count === 1 ? "$X$" : "$X$s"} above ${value} ${response.axis.unit}`,
      )
      .join("; ") || "No $X$s placed"
  );
}
export type LinePlotDiagnosis = {
  tag: "shift" | "dedupe" | "total" | "end-mark" | "recount";
  message: string;
};
export function diagnoseLinePlotBuild(
  response: LinePlotBuildResponse,
  key: string,
  raw: string,
  context?: LinePlotContext,
): LinePlotDiagnosis | null {
  if (gradeLinePlotBuild(response, key, raw)) return null;
  const expected = linePlotCounts(response, key),
    actual = linePlotCounts(response, raw);
  const values = linePlotValues(response);
  const same = (candidate: Record<string, number>) =>
    values.every((v) => (actual[v] ?? 0) === (candidate[v] ?? 0));
  const example = Number(Object.keys(expected)[0]);
  for (const delta of [-1, 1]) {
    const moved = Object.fromEntries(
      Object.entries(expected).map(([v, c]) => [Number(v) + delta, c]),
    );
    if (
      Object.keys(moved).every((v) => values.includes(Number(v))) &&
      same(moved)
    )
      return {
        tag: "shift",
        message: `You put each $X$ one number too far ${delta > 0 ? "right" : "left"}. An $X$ for ${example} goes right above ${example}.`,
      };
  }
  const repeat = Object.entries(expected).find(([, c]) => c > 1);
  if (
    repeat &&
    same(Object.fromEntries(Object.keys(expected).map((v) => [v, 1])))
  )
    return {
      tag: "dedupe",
      message: `You dropped the repeated measurements. There were ${repeat[1]} measurements of ${repeat[0]} ${response.axis.unit}, so ${repeat[0]} needs ${repeat[1]} $X$s.`,
    };
  const n = Object.values(expected).reduce((a, b) => a + b, 0);
  const m = Object.values(actual).reduce((a, b) => a + b, 0);
  if (n !== m)
    return {
      tag: "total",
      message: `There were ${n} measurements but you placed ${m} $X$s. Every measurement gets exactly one $X$.`,
    };
  // Match reading every end mark, or just one nonzero-start object's end mark.
  const readings = context?.readings;
  if (readings) {
    const tally = (numbers: number[]) => {
      const counts: Record<string, number> = {};
      numbers.forEach((v) => {
        counts[v] = (counts[v] ?? 0) + 1;
      });
      return counts;
    };
    const first = readings.findIndex((r) => r.start > 0);
    const mistaken = readings.findIndex(
      (r, i) =>
        r.start > 0 &&
        same(
          tally(
            readings.map((item, j) =>
              Math.round(item.end - (j === i ? 0 : item.start)),
            ),
          ),
        ),
    );
    const index =
      first >= 0 && same(tally(readings.map((r) => Math.round(r.end))))
        ? first
        : mistaken;
    if (index >= 0)
      return {
        tag: "end-mark",
        message: `Object ${index + 1}, the ${context.object}, starts at ${readings[index]!.start}, not 0. Count units from ${readings[index]!.start}.`,
      };
  }
  return {
    tag: "recount",
    message:
      "Recount one measurement at a time. Put its $X$ directly above its number, including each repeated measurement.",
  };
}
