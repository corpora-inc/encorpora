import { z } from "zod";
import { graph } from "./scene/author";

export type TrendPoint = [number, number];
export type TrendLine = { m: number; b: number };
export interface TrendLineFitResponse {
  kind: "trend-line-fit";
  label: string;
  grid: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    xStep: number;
    yStep: number;
    yTick: number;
    xLabel: string;
    yLabel: string;
  };
  data: TrendPoint[];
  guessChance: 0.05;
}
const coordinate = z.number().int().min(-1000).max(1000);
const point = z.tuple([coordinate, coordinate]);
export const trendLineFitResponseSchema: z.ZodType<TrendLineFitResponse> = z
  .object({
    kind: z.literal("trend-line-fit"),
    label: z.string().trim().min(1).max(200),
    grid: z
      .object({
        xMin: coordinate,
        xMax: coordinate,
        yMin: coordinate,
        yMax: coordinate,
        xStep: z.number().int().min(1).max(10),
        yStep: z.number().int().min(1).max(10),
        yTick: z.number().int().min(1).max(20),
        xLabel: z.string().min(1).max(40),
        yLabel: z.string().min(1).max(40),
      })
      .strict(),
    data: z.array(point).min(9).max(12),
    /** Conservative uniform-lattice guessing estimate, audited independently.
     * It is a nonzero upper bound, not a claim that drawn answers are unguessable. */
    guessChance: z.literal(0.05),
  })
  .strict()
  .refine((r) => {
    const g = r.grid;
    return (
      g.xMax > g.xMin &&
      g.yMax > g.yMin &&
      (g.xMax - g.xMin) / g.xStep <= 20 &&
      (g.yMax - g.yMin) / g.yStep <= 160 &&
      (g.xMax - g.xMin) % g.xStep === 0 &&
      (g.yMax - g.yMin) % g.yStep === 0 &&
      g.yTick % g.yStep === 0 &&
      r.data.every((p) => onTrendGrid(g, p)) &&
      new Set(r.data.map((p) => p.join())).size === r.data.length &&
      new Set(r.data.map(([x]) => x)).size >= 8
    );
  }, "A scatter plot needs distinct data on a bounded lattice");
export function onTrendGrid(
  g: TrendLineFitResponse["grid"],
  [x, y]: TrendPoint,
) {
  return (
    Number.isSafeInteger(x) &&
    Number.isSafeInteger(y) &&
    x >= g.xMin &&
    x <= g.xMax &&
    y >= g.yMin &&
    y <= g.yMax &&
    (x - g.xMin) % g.xStep === 0 &&
    (y - g.yMin) % g.yStep === 0
  );
}
/** Two distinct horizontal coordinates define y = mx + b. Swapping handles
 * preserves the same canonical answer, including on retried API attempts. */
export function normalizeTrendLine(
  r: TrendLineFitResponse,
  raw: string,
): string | null {
  if (typeof raw !== "string" || raw.length > 100) return null;
  try {
    const parsed = z.tuple([point, point]).safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const points = parsed.data;
    if (
      points[0][0] === points[1][0] ||
      !points.every((p) => onTrendGrid(r.grid, p))
    )
      return null;
    return JSON.stringify(points.sort((a, b) => a[0] - b[0]));
  } catch {
    return null;
  }
}
export function trendPoints(
  r: TrendLineFitResponse,
  raw: string,
): [TrendPoint, TrendPoint] | null {
  const normalized = normalizeTrendLine(r, raw);
  return normalized === null ? null : JSON.parse(normalized);
}
export function throughTrendPoints([a, b]: readonly TrendPoint[]): TrendLine {
  const m = (b![1] - a![1]) / (b![0] - a![0]);
  return { m, b: a![1] - m * a![0] };
}
export function trendStatistics(data: readonly TrendPoint[]) {
  const n = data.length;
  const x = data.reduce((s, p) => s + p[0], 0) / n;
  const y = data.reduce((s, p) => s + p[1], 0) / n;
  const varianceX = data.reduce((s, p) => s + (p[0] - x) ** 2, 0) / n;
  const m =
    data.reduce((s, p) => s + (p[0] - x) * (p[1] - y), 0) / (n * varianceX);
  const line = { m, b: y - m * x };
  const mse = data.reduce((s, p) => s + (p[1] - m * p[0] - line.b) ** 2, 0) / n;
  return { x, y, varianceX, line, mse };
}
/** Informal-fit rule, v1 (immutable for stored evidence):
 * MSE(student) <= 1.6 * MSE(least squares), with the same slope sign and
 * 0.65 <= student slope / LS slope <= 1.5. The MSE is the mean of squared
 * VERTICAL distances, not perpendicular distances. There is no exact-key
 * comparison or requirement to hit particular dots. This allows the usual
 * hand-fit error while excluding flat, reversed and excessive slopes.
 * The identity below evaluates MSE above its minimum without cancellation. */
export const TREND_MSE_FACTOR = 1.6;
export function acceptsTrendLine(
  data: readonly TrendPoint[],
  line: TrendLine,
): boolean {
  const s = trendStatistics(data);
  const ratio = line.m / s.line.m;
  const extra =
    (line.m - s.line.m) ** 2 * s.varianceX + (line.m * s.x + line.b - s.y) ** 2;
  return (
    Number.isFinite(extra) &&
    s.mse > 0 &&
    ratio >= 0.65 &&
    ratio <= 1.5 &&
    extra <= (TREND_MSE_FACTOR - 1) * s.mse + 1e-9
  );
}
export function gradeTrendLine(r: TrendLineFitResponse, raw: string): boolean {
  const points = trendPoints(r, raw);
  return (
    points !== null && acceptsTrendLine(r.data, throughTrendPoints(points))
  );
}
/** Deterministic, neutral starting line; it is not a submitted answer until
 * the learner moves a handle. Both handles have a whole-step margin. */
export function initialTrendPoints(
  r: TrendLineFitResponse,
): [TrendPoint, TrendPoint] {
  const g = r.grid;
  const y = g.yMin + Math.round((g.yMax - g.yMin) / (2 * g.yStep)) * g.yStep;
  return [
    [g.xMin + g.xStep, y],
    [g.xMax - g.xStep, y],
  ];
}
export function trendLineAnswerText(
  r: TrendLineFitResponse,
  raw: string,
): string {
  const p = trendPoints(r, raw);
  return p
    ? `a line through $(${p[0].join(", ")})$ and $(${p[1].join(", ")})$`
    : "No line fitted";
}
export function trendLineFeedback(
  r: TrendLineFitResponse,
  raw: string,
): string[] {
  const p = trendPoints(r, raw);
  if (!p || gradeTrendLine(r, raw)) return [];
  const l = throughTrendPoints(p),
    s = trendStatistics(r.data);
  const residuals = r.data.map(([x, y]) => y - l.m * x - l.b);
  const above = residuals.filter((v) => v > 1e-9).length;
  const below = residuals.filter((v) => v < -1e-9).length;
  if (above <= 1 || below <= 1)
    return [
      `Your line sits ${above <= 1 ? "above" : "below"} almost every point. Move it through the middle of the cloud.`,
    ];
  if (l.m * s.line.m <= 0)
    return [
      "Your line tilts the wrong way. Follow the direction the dots take from left to right.",
    ];
  if (Math.abs(l.b) < 1e-9 && Math.abs(s.line.b) > 2 * r.grid.yTick)
    return [
      "A trend line does not have to pass through (0, 0). Fit the whole cloud.",
    ];
  const ends = [r.data[0]!, r.data.at(-1)!];
  if (ends.every(([x, y]) => Math.abs(y - l.m * x - l.b) < 1e-9))
    return [
      "Connecting the first and last dots misses the rest of this cloud. Fit all the dots together.",
    ];
  if (l.m / s.line.m < 0.65 || l.m / s.line.m > 1.5)
    return [
      `Your line is too ${l.m / s.line.m < 0.65 ? "flat" : "steep"}. Follow the dots at both ends as well as the middle.`,
    ];
  return [
    "The points are farther from your line than they need to be. Move it closer to the middle and follow the cloud's tilt.",
  ];
}
/** Name the main visible mismatch in a submitted line, with one adjustment.
 * Squared error separates tilt from displacement at the cloud's center. */
export function trendLineDiagnosis(
  r: TrendLineFitResponse,
  raw: string,
): string | null {
  const points = trendPoints(r, raw);
  if (!points || gradeTrendLine(r, raw)) return null;
  const line = throughTrendPoints(points);
  const stats = trendStatistics(r.data);
  if (line.m * stats.line.m <= 0) {
    const direction = stats.line.m > 0 ? "rise" : "fall";
    const student = line.m === 0 ? "is flat" : line.m > 0 ? "rises" : "falls";
    return `Your line ${student}, but the dots ${direction} to the right.`;
  }
  const offset = line.m * stats.x + line.b - stats.y;
  const tiltError = (line.m - stats.line.m) ** 2 * stats.varianceX;
  const ratio = line.m / stats.line.m;
  if (ratio < 0.65 || ratio > 1.5 || tiltError >= offset ** 2)
    return ratio < 1
      ? "Your line is too shallow; make it steeper."
      : "Your line is too steep; make it flatter.";
  return offset > 0
    ? "Your line sits too high; move it down."
    : "Your line sits too low; move it up.";
}
/** Static scatter surface for practice, lessons and print. No answer in its
 * public version; optional lines and distances belong only to worked examples. */
export function trendLineScene(
  r: TrendLineFitResponse,
  options: {
    width?: number;
    line?: TrendLine;
    distances?: boolean;
    card?: boolean;
  } = {},
) {
  const g = r.grid;
  let plot = graph({
    x: [g.xMin, g.xMax],
    y: [g.yMin, g.yMax],
    grid: [g.xStep, g.yTick],
    tick: [g.xStep, g.yTick],
    axisNames: [g.xLabel, g.yLabel],
    aspect: (0.72 * (g.xMax - g.xMin)) / (g.yMax - g.yMin),
  })
    .id("trend")
    .scatter(r.data);
  if (options.line) {
    const l = options.line;
    if (options.distances)
      for (const [x, y] of r.data)
        plot = plot.segment([x, y], [x, l.m * x + l.b], {
          color: "warm",
          dash: "dot",
        });
    plot = plot.line(
      {
        through: [
          [g.xMin, l.m * g.xMin + l.b],
          [g.xMax, l.m * g.xMax + l.b],
        ],
      },
      { color: "accent" },
    );
  }
  return plot.scene({
    width: options.width ?? (options.card ? 280 : 420),
    maxHeight: options.card ? 300 : 400,
  });
}
