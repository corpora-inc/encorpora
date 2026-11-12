/**
 * The descriptive statistics behind the practice views: a distribution's n,
 * mean, median and standard deviation; a least-squares line with its 95%
 * confidence band; Pearson's r with a Fisher-z 95% interval; and practice-time
 * quartiles. Pure, so the server computes what the screen shows and a test can
 * check every number against a textbook value.
 */

export type Summary = {
  n: number;
  mean: number;
  median: number;
  /** Sample standard deviation (n − 1); 0 for a single value. */
  sd: number;
};

export function summarize(values: readonly number[]): Summary | null {
  const n = values.length;
  if (!n) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const half = n >> 1;
  const median = n % 2 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2;
  const squares = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return { n, mean, median, sd: n > 1 ? Math.sqrt(squares / (n - 1)) : 0 };
}

/** The standard normal quantile (Acklam's rational approximation, relative
 * error under 1.2e-9). */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`p must be in (0, 1): ${p}`);
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
      a[5]!) *
      q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

/** The two-sided critical value of Student's t: P(|T| > t) = `alpha` with `df`
 * degrees of freedom (Hill 1970, Algorithm 396; exact for df 1 and 2). */
export function tCritical(alpha: number, df: number): number {
  if (!(alpha > 0 && alpha < 1)) throw new RangeError(`alpha: ${alpha}`);
  if (!(df >= 1)) throw new RangeError(`df: ${df}`);
  if (df === 1) return Math.tan((Math.PI / 2) * (1 - alpha));
  if (df === 2) return Math.sqrt(2 / (alpha * (2 - alpha)) - 2);
  const n = df;
  const a = 1 / (n - 0.5);
  const b = 48 / (a * a);
  let c = ((((20700 * a) / b - 98) * a - 16) * a + 96.36) as number;
  const d = ((94.5 / (b + c) - 3) / b + 1) * Math.sqrt((a * Math.PI) / 2) * n;
  let x = d * alpha;
  let y = x ** (2 / n);
  if (y > 0.05 + a) {
    x = normalQuantile(alpha * 0.5);
    y = x * x;
    if (n < 5) c += 0.3 * (n - 4.5) * (x + 0.6);
    c = (((0.05 * d * x - 5) * x - 7) * x - 2) * x + b + c;
    y = (((((0.4 * y + 6.3) * y + 36) * y + 94.5) / c - y - 3) / b + 1) * x;
    y = a * y * y;
    y = y > 0.002 ? Math.exp(y) - 1 : 0.5 * y * y + y;
  } else {
    y =
      ((1 / (((n + 6) / (n * y) - 0.089 * d - 0.822) * (n + 2) * 3) +
        0.5 / (n + 4)) *
        y -
        1) *
        ((n + 1) / (n + 2)) +
      1 / y;
  }
  return Math.sqrt(n * y);
}

export type Point = readonly [x: number, y: number];
export type Fit = {
  n: number;
  slope: number;
  intercept: number;
  /** Pearson's r and its 95% interval (Fisher z). */
  r: number;
  rLow: number;
  rHigh: number;
  /** The fitted line and the 95% confidence band of its mean, sampled across
   * the observed x range. */
  band: { x: number; fit: number; low: number; high: number }[];
};

/** Fewer points than this and a line says nothing: r's interval needs n ≥ 4,
 * and the views ask for more. */
export const FIT_MINIMUM = { students: 12, groups: 5 } as const;

/** Ordinary least squares of y on x, with r and both intervals. Null when the
 * points can't support a line: fewer than `minimum`, or no spread in x or y. */
export function fitLine(
  points: readonly Point[],
  minimum = 4,
  samples = 25,
): Fit | null {
  const n = points.length;
  if (n < Math.max(4, minimum)) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  if (sxx <= 1e-12 || syy <= 1e-12) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  // Fisher z: atanh(r) ± 1.96 / √(n − 3).
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r)));
  const half = normalQuantile(0.975) / Math.sqrt(n - 3);
  const residual = Math.max(0, syy - slope * sxy);
  const s = Math.sqrt(residual / (n - 2));
  const t = tCritical(0.05, n - 2);
  const band = Array.from({ length: samples }, (_, index) => {
    const x = lo + ((hi - lo) * index) / (samples - 1);
    const fit = intercept + slope * x;
    const margin = t * s * Math.sqrt(1 / n + (x - mx) ** 2 / sxx);
    return { x, fit, low: fit - margin, high: fit + margin };
  });
  return {
    n,
    slope,
    intercept,
    r,
    rLow: Math.tanh(z - half),
    rHigh: Math.tanh(z + half),
    band,
  };
}

/** How an r reads, only as far as its interval allows. No causal words. */
export function associationWords(fit: Fit, who: string): string {
  return `${findingWords(fit, who).slice(0, -1)} (${fitWords(fit)}).`;
}
/** The finding alone, one short sentence: what the interval allows saying. */
export function findingWords(fit: Fit, who: string): string {
  if (fit.rLow > 0) return `${who} who practiced more grew more.`;
  if (fit.rHigh < 0) return `${who} who practiced more grew less.`;
  return "No clear association between practice time and growth.";
}
/** The correlation behind the finding: r, its 95% interval and n. */
export const fitWords = (fit: Fit) =>
  `r = ${signed(fit.r)}, 95% CI ${signed(fit.rLow)} to ${signed(fit.rHigh)}, n = ${fit.n.toLocaleString("en-US")}`;
const signed = (value: number) =>
  `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}`;

/** Four groups of near-equal size by `key`, lowest first; ties stay together
 * at a boundary's lower group, so a group can be empty when values pile up. */
export function quartiles<T>(
  items: readonly T[],
  key: (item: T) => number,
): { from: number; to: number; items: T[] }[] {
  const sorted = [...items].sort((a, b) => key(a) - key(b));
  const n = sorted.length;
  const groups: { from: number; to: number; items: T[] }[] = [];
  let start = 0;
  for (let quarter = 1; quarter <= 4; quarter++) {
    let end = quarter === 4 ? n : Math.round((n * quarter) / 4);
    // A tie straddling the cut joins the group below it.
    while (
      end < n &&
      end > start &&
      key(sorted[end]!) === key(sorted[end - 1]!)
    )
      end++;
    const slice = sorted.slice(start, Math.max(start, end));
    groups.push({
      from: slice.length ? key(slice[0]!) : NaN,
      to: slice.length ? key(slice.at(-1)!) : NaN,
      items: slice,
    });
    start = Math.max(start, end);
  }
  return groups;
}
