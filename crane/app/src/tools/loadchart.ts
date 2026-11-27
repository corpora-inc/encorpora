/**
 * Load chart reading, deterministic. A chart lists rated capacities by
 * radius (rows) and boom length (columns) for each configuration. Between
 * listed values the chart's own rules apply; the defaults here are the
 * conservative ones most charts state: use the next longer radius, and the
 * lower of the two adjacent boom lengths. A null cell is not rated.
 *
 * Problems are generated from a seed, so practice is unlimited and every key
 * is exact.
 */
import { createRng, randInt, type Rng } from "../practice/engine.ts";

export interface ChartConfig {
  id: string;
  label: string;
  boomLengthsFt: number[];
  radiiFt: number[];
  /** [radiusIndex][boomIndex], pounds; null = not rated. */
  capacitiesLb: (number | null)[][];
}

export interface Chart {
  id: string;
  title: string;
  fictional: boolean;
  rules: { betweenRadii: "next-longer"; betweenBoomLengths: "lower-of-adjacent" };
  configurations: ChartConfig[];
}

export type Reading =
  | { ok: true; capacityLb: number; radiusUsedFt: number; boomUsedFt: number[]; note: "exact" | "next-radius" | "lower-boom" | "both" }
  | { ok: false; reason: "radius-out-of-range" | "boom-out-of-range" | "not-rated" };

/** Rated capacity at a radius and boom length under the chart's rules. */
export function readChart(config: ChartConfig, boomFt: number, radiusFt: number): Reading {
  const r = config.radiiFt.findIndex((x) => x >= radiusFt);
  if (r < 0 || radiusFt <= 0) return { ok: false, reason: "radius-out-of-range" };
  const lengths = config.boomLengthsFt;
  if (boomFt < lengths[0]! || boomFt > lengths[lengths.length - 1]!) return { ok: false, reason: "boom-out-of-range" };
  const exact = lengths.indexOf(boomFt);
  const cols = exact >= 0 ? [exact] : [lengths.findIndex((x) => x > boomFt) - 1, lengths.findIndex((x) => x > boomFt)];
  const row = config.capacitiesLb[r]!;
  const values = cols.map((c) => row[c] ?? null);
  if (values.some((v) => v === null)) return { ok: false, reason: "not-rated" };
  const capacityLb = Math.min(...(values as number[]));
  const nextRadius = config.radiiFt[r] !== radiusFt;
  const between = cols.length > 1;
  return {
    ok: true,
    capacityLb,
    radiusUsedFt: config.radiiFt[r]!,
    boomUsedFt: cols.map((c) => lengths[c]!),
    note: nextRadius && between ? "both" : nextRadius ? "next-radius" : between ? "lower-boom" : "exact",
  };
}

export interface Deductions {
  hookBlockLb: number;
  riggingLb: number;
  otherLb: number;
}

export interface Problem {
  seed: string;
  configId: string;
  boomFt: number;
  radiusFt: number;
  loadLb: number;
  deductions: Deductions;
  /** Gross rated capacity from the chart. */
  grossLb: number;
  /** Gross minus deductions: what is left for the load itself. */
  netLb: number;
  canLift: boolean;
}

function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[randInt(rng, xs.length)]!;
}

/** A solvable problem: the cell (or the cells the rules use) is rated. */
export function generateProblem(chart: Chart, seed: string): Problem {
  const rng = createRng(`${chart.id}:${seed}`);
  for (let attempt = 0; attempt < 200; attempt++) {
    const config = pick(rng, chart.configurations);
    const li = randInt(rng, config.boomLengthsFt.length);
    const lengths = config.boomLengthsFt;
    // Half the time, a boom length between two listed lengths.
    const boomFt =
      li < lengths.length - 1 && rng.next() < 0.5 ? lengths[li]! + Math.max(1, Math.floor((lengths[li + 1]! - lengths[li]!) / 2)) : lengths[li]!;
    const ri = randInt(rng, config.radiiFt.length);
    const radii = config.radiiFt;
    const radiusFt = ri > 0 && rng.next() < 0.5 ? radii[ri - 1]! + Math.max(1, Math.floor((radii[ri]! - radii[ri - 1]!) / 2)) : radii[ri]!;
    const reading = readChart(config, boomFt, radiusFt);
    if (!reading.ok) continue;
    const deductions: Deductions = {
      hookBlockLb: pick(rng, [450, 600, 850, 1200]),
      riggingLb: pick(rng, [75, 120, 200, 350]),
      otherLb: pick(rng, [0, 0, 150, 300]),
    };
    const netLb = reading.capacityLb - deductions.hookBlockLb - deductions.riggingLb - deductions.otherLb;
    if (netLb <= 0) continue;
    // Loads near the line, on either side, make the decision matter.
    const loadLb = Math.max(100, Math.round((netLb * (0.8 + rng.next() * 0.35)) / 50) * 50);
    return { seed, configId: config.id, boomFt, radiusFt, loadLb, deductions, grossLb: reading.capacityLb, netLb, canLift: loadLb <= netLb };
  }
  throw new Error(`Chart ${chart.id} has no rated cells`);
}

/** FIXTURE chart (fictional) until crane/content/tools/loadcharts lands. */
export const FIXTURE_CHART: Chart = {
  id: "fx-30",
  title: "FX-30 telescopic crane (fictional sample chart)",
  fictional: true,
  rules: { betweenRadii: "next-longer", betweenBoomLengths: "lower-of-adjacent" },
  configurations: [
    {
      id: "outriggers-full",
      label: "Outriggers fully extended, 360°",
      boomLengthsFt: [32, 45, 60, 75, 90],
      radiiFt: [10, 15, 20, 25, 30, 40, 50, 60, 70],
      capacitiesLb: [
        [60000, 52000, 41000, null, null],
        [45200, 41800, 35600, 29400, null],
        [33800, 32100, 28900, 25200, 21600],
        [25600, 25000, 23500, 21200, 18700],
        [null, 19800, 19100, 17600, 15900],
        [null, 12600, 12900, 12300, 11400],
        [null, null, 8700, 8900, 8500],
        [null, null, 6100, 6400, 6300],
        [null, null, null, 4600, 4700],
      ],
    },
    {
      id: "outriggers-mid",
      label: "Outriggers mid extension, 360°",
      boomLengthsFt: [32, 45, 60, 75, 90],
      radiiFt: [10, 15, 20, 25, 30, 40, 50, 60, 70],
      capacitiesLb: [
        [48000, 43000, 36000, null, null],
        [31500, 30200, 27800, 23900, null],
        [21700, 21300, 20600, 18800, 16400],
        [15800, 15600, 15100, 14300, 13100],
        [null, 11900, 11600, 11100, 10400],
        [null, 7200, 7100, 6900, 6600],
        [null, null, 4600, 4600, 4500],
        [null, null, 3000, 3100, 3100],
        [null, null, null, 2000, 2100],
      ],
    },
  ],
};
