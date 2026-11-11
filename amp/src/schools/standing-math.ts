/**
 * Where a group stands, with its uncertainty: each student is a normal curve
 * N(μ, σ²) on the axis "grades from their own", a group is the even mixture of
 * its students' curves, and a group's median carries a 95% interval from
 * resampling the students and drawing each from their own curve.
 *
 * Pure numbers only, so the maths is tested on known inputs
 * (`tests/schools-standing-math.test.ts`) and the server does one query and
 * then this pass. Everything is deterministic for a given seed: the same class
 * shows the same band on every refresh.
 */

export type Normal = { mu: number; sd: number };

/** No student's curve is drawn narrower than this, in grades. The estimator's
 * grid is a tenth of a grade, so anything tighter is resolution, not evidence. */
export const SD_FLOOR = 0.1;
const sdOf = (student: Normal) => Math.max(SD_FLOOR, student.sd);

const SQRT_2PI = Math.sqrt(2 * Math.PI);
export const normalPdf = (x: number, mu: number, sd: number) => {
  const z = (x - mu) / sd;
  return Math.exp(-0.5 * z * z) / (sd * SQRT_2PI);
};
/** Φ(z), to about 1e-7 (Abramowitz and Stegun 7.1.26). */
export function normalCdf(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** An evenly spaced axis: `from`, `from + step`, … `to`. */
export type Grid = { from: number; to: number; step: number };
export const gridPoints = ({ from, to, step }: Grid) =>
  Math.round((to - from) / step) + 1;

/**
 * The axis a set of curves needs: every student's μ ± 2.5σ, in whole grades,
 * never narrower than three grades either side of their own and never past
 * `limits` (the curriculum's real ends). Nothing is cut off and nothing is
 * padded with empty grades.
 */
export function gridFor(
  students: readonly Normal[],
  {
    step = 0.1,
    least = 3,
    limits = [-14, 14] as const,
  }: {
    step?: number;
    least?: number;
    limits?: readonly [number, number];
  } = {},
): Grid {
  let low = -least;
  let high = least;
  for (const student of students) {
    const reach = 2.5 * sdOf(student);
    low = Math.min(low, student.mu - reach);
    high = Math.max(high, student.mu + reach);
  }
  return {
    from: Math.max(limits[0], Math.floor(low)),
    to: Math.min(limits[1], Math.ceil(high)),
    step,
  };
}

/**
 * (1/n) Σ N(x; μᵢ, σᵢ²) at each grid point. Each student touches only the
 * points within 6σ of their μ, so ten thousand students cost a few million
 * multiplications. An empty group is all zeros.
 */
export function mixtureDensity(
  students: readonly Normal[],
  grid: Grid,
): Float64Array {
  const count = gridPoints(grid);
  const density = new Float64Array(count);
  if (!students.length) return density;
  const weight = 1 / students.length;
  for (const student of students) {
    const sd = sdOf(student);
    const first = Math.max(
      0,
      Math.ceil((student.mu - 6 * sd - grid.from) / grid.step),
    );
    const last = Math.min(
      count - 1,
      Math.floor((student.mu + 6 * sd - grid.from) / grid.step),
    );
    const scale = weight / (sd * SQRT_2PI);
    for (let index = first; index <= last; index++) {
      const z = (grid.from + index * grid.step - student.mu) / sd;
      density[index]! += scale * Math.exp(-0.5 * z * z);
    }
  }
  return density;
}

/** A mixture of a few distinct curves, each with a weight that sums to one
 * across them: the same as `mixtureDensity` over the students they stand for. */
export function weightedDensity(
  parts: readonly (Normal & { weight: number })[],
  grid: Grid,
): Float64Array {
  const density = new Float64Array(gridPoints(grid));
  for (const part of parts) {
    const one = mixtureDensity([part], grid);
    one.forEach((value, index) => (density[index]! += part.weight * value));
  }
  return density;
}

/** The mixture's CDF at x: the expected share of students below x. */
export const mixtureCdf = (students: readonly Normal[], x: number) =>
  students.length
    ? students.reduce(
        (sum, student) => sum + normalCdf((x - student.mu) / sdOf(student)),
        0,
      ) / students.length
    : Number.NaN;

/** The mixture's p-quantile, by bisection to a thousandth of a grade. */
export function mixtureQuantile(students: readonly Normal[], p: number) {
  if (!students.length) return null;
  let low = Math.min(...students.map((s) => s.mu - 8 * sdOf(s)));
  let high = Math.max(...students.map((s) => s.mu + 8 * sdOf(s)));
  while (high - low > 1e-3) {
    const middle = (low + high) / 2;
    if (mixtureCdf(students, middle) < p) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** The summary a curve is read by: the mixture's own median, mean and sd. */
export function mixtureStats(students: readonly Normal[]) {
  const n = students.length;
  if (!n) return { n, median: null, mean: null, sd: null };
  let mean = 0;
  for (const student of students) mean += student.mu;
  mean /= n;
  // Var = E[σ² + μ²] − mean²: the spread of the curve as drawn, which is the
  // spread between students plus each one's own uncertainty.
  let second = 0;
  for (const student of students) {
    const sd = sdOf(student);
    second += sd * sd + student.mu * student.mu;
  }
  const variance = Math.max(0, second / n - mean * mean);
  return {
    n,
    median: mixtureQuantile(students, 0.5),
    mean,
    sd: Math.sqrt(variance),
  };
}

/** The expected number of students in [from, to): their curves' mass there,
 * so a student near an edge counts partly on each side. */
export const expectedBetween = (
  students: readonly Normal[],
  from: number,
  to: number,
) =>
  students.reduce(
    (sum, student) =>
      sum +
      normalCdf((to - student.mu) / sdOf(student)) -
      normalCdf((from - student.mu) / sdOf(student)),
    0,
  );

/** A small, fast, seedable generator (mulberry32). */
export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A stable seed from an id, so a group's band is the same on every read. */
export function seedOf(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}
/** Standard normal draws, two at a time (Box–Muller). */
function gaussian(next: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u = 1 - next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** The k-th smallest of `values[0..length)`, in place (Hoare's selection). */
function select(values: Float64Array, length: number, k: number) {
  let low = 0;
  let high = length - 1;
  while (low < high) {
    const pivot = values[(low + high) >> 1]!;
    let i = low;
    let j = high;
    while (i <= j) {
      while (values[i]! < pivot) i++;
      while (values[j]! > pivot) j--;
      if (i <= j) {
        const swap = values[i]!;
        values[i] = values[j]!;
        values[j] = swap;
        i++;
        j--;
      }
    }
    if (k <= j) high = j;
    else if (k >= i) low = i;
    else return values[k]!;
  }
  return values[k]!;
}
const medianInPlace = (values: Float64Array, length: number) => {
  const upper = select(values, length, length >> 1);
  if (length % 2) return upper;
  // The lower middle is the largest value left of the upper one.
  let lower = -Infinity;
  for (let index = 0; index < length >> 1; index++)
    if (values[index]! > lower) lower = values[index]!;
  return (lower + upper) / 2;
};
const quantileOfSorted = (sorted: Float64Array, p: number) => {
  const at = p * (sorted.length - 1);
  const below = Math.floor(at);
  const above = Math.min(sorted.length - 1, below + 1);
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (at - below);
};

/** Draws per interval: a thousand for a class, fewer for a big group, whose
 * median moves little between draws; at most a few million normal draws. */
export const drawsFor = (n: number) =>
  Math.max(200, Math.min(1000, Math.floor(100_000 / Math.max(1, n))));

/**
 * The group's median with a 95% interval: the middle 95% of many draws'
 * medians. The point is the median of the students' μ. One student gives
 * μ ± 1.96σ in either mode.
 *
 * - `posterior` (where a class's median sits): each draw takes one value from
 *   every student's own curve. The interval is for these students' true
 *   median, so it is wide while we know little about them and narrows as
 *   answers come in.
 * - `bootstrap` (growth): each draw also resamples the students with
 *   replacement, so a small group's figure carries the chance in who is in it.
 */
export function medianInterval(
  students: readonly Normal[],
  {
    seed = 1,
    draws = drawsFor(students.length),
    level = 0.95,
    mode = "posterior",
  }: {
    seed?: number;
    draws?: number;
    level?: number;
    mode?: "posterior" | "bootstrap";
  } = {},
) {
  const n = students.length;
  if (!n) return null;
  // Sorted first, so the same students give the same draws in any order.
  const sorted = [...students].sort((a, b) => a.mu - b.mu || a.sd - b.sd);
  const mus = Float64Array.from(sorted, (student) => student.mu);
  const sds = Float64Array.from(sorted, sdOf);
  const point = medianInPlace(Float64Array.from(mus), n);
  const next = random(seed);
  const normal = gaussian(next);
  const sample = new Float64Array(n);
  const medians = new Float64Array(draws);
  for (let draw = 0; draw < draws; draw++) {
    for (let index = 0; index < n; index++) {
      const pick = mode === "bootstrap" ? Math.floor(next() * n) : index;
      sample[index] = mus[pick]! + sds[pick]! * normal();
    }
    medians[draw] = medianInPlace(sample, n);
  }
  medians.sort();
  const tail = (1 - level) / 2;
  return {
    median: point,
    low: quantileOfSorted(medians, tail),
    high: quantileOfSorted(medians, 1 - tail),
  };
}

/** One student's growth over a span: the change in μ, with both readings'
 * uncertainty, σ = √(σ_start² + σ_end²). */
export const growthOf = (start: Normal, end: Normal): Normal => ({
  mu: end.mu - start.mu,
  sd: Math.hypot(sdOf(start), sdOf(end)),
});
