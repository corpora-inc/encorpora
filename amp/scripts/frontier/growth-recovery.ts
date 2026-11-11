/**
 * Which definition of "growth this term" recovers a misspecified learner's
 * true ability change.
 *
 * The production calibration harness simulates the learners and the practice
 * pattern (`production-calibration.ts --growth`). This file only scores the
 * stored daily readings, so the comparison can be tested without the planner.
 *
 * The target is the learner's true ability change from the morning of the
 * term to the morning it ends (`series.truth`), not the change since the
 * estimate happened to settle. A learner with no figure is missing, not zero.
 *
 * Families:
 * - answers: latest level minus the first day with at least N answers
 * - settled: latest level minus the first day whose reported sd is at most c
 * - scaled: that same change, stretched from the settled span onto the term
 * - slope: weighted least-squares pace of the reported level on settled days
 *   (weights 1/sd²), times the term's elapsed days. `slope` uses the
 *   independent-observation standard error. `slope-ends` keeps that pace and
 *   uses the two-endpoint standard error, scaled the same way, because
 *   successive level days are one cumulative estimate.
 */
export const GROWTH_Z = 1.96;

export type GrowthReading = {
  /** Calendar days since the term started. */
  day: number;
  answers: number;
  level: number;
  /** sd-cal-v1 reported sd, the width stored on a level day. */
  reportedSd: number;
  /** True ability that day. */
  truth: number;
};

export type GrowthSeries = {
  id: string;
  grade: number;
  offset: number;
  rep: number;
  answers: number;
  daysPerWeek: number;
  /** True ability change across the term. */
  truth: number;
  /** Elapsed days of the term, the multiplier on a daily pace. */
  elapsed: number;
  days: GrowthReading[];
};

export type GrowthFigure = {
  mu: number;
  sd: number;
  startDay: number;
  startAnswers: number;
};

export type CandidateFamily =
  | "baseline"
  | "answers"
  | "settled"
  | "scaled"
  | "slope"
  | "slope-ends";

export type CandidateScore = GrowthFigure & {
  id: string;
  label: string;
  family: CandidateFamily;
};

type Scored = CandidateScore | null;

const ANSWER_THRESHOLDS = [20, 40, 60, 100] as const;
const SD_CUTS = [0.5, 0.6, 0.7, 0.8] as const;

function hypot(a: number, b: number) {
  return Math.hypot(a, b);
}

function endpoint(
  series: GrowthSeries,
  start: number,
): GrowthFigure | null {
  const days = series.days;
  const first = days[start];
  const last = days[days.length - 1];
  if (!first || !last || last.day <= first.day) return null;
  if (!(first.reportedSd > 0) || !(last.reportedSd > 0)) return null;
  return {
    mu: last.level - first.level,
    sd: hypot(first.reportedSd, last.reportedSd),
    startDay: first.day,
    startAnswers: first.answers,
  };
}

function firstWhere(
  days: readonly GrowthReading[],
  test: (day: GrowthReading) => boolean,
) {
  return days.findIndex(test);
}

/** Stretch a settled change onto the whole term at a constant pace. */
function scale(series: GrowthSeries, start: number): GrowthFigure | null {
  const figure = endpoint(series, start);
  if (!figure) return null;
  const span = series.days[series.days.length - 1]!.day - figure.startDay;
  if (span <= 0 || series.elapsed <= 0) return null;
  const factor = series.elapsed / span;
  return { ...figure, mu: figure.mu * factor, sd: figure.sd * factor };
}

/**
 * Weighted least squares of level on day. The classical standard error treats
 * each day as an independent observation with variance sd², so σ² = 1 and
 * se(slope) = 1/√Sxx.
 */
function weightedSlope(
  points: readonly GrowthReading[],
): { slope: number; se: number } | null {
  if (points.length < 2) return null;
  let weight = 0;
  let wx = 0;
  let wy = 0;
  const weights: number[] = [];
  for (const point of points) {
    if (!(point.reportedSd > 0)) return null;
    const w = 1 / (point.reportedSd * point.reportedSd);
    weights.push(w);
    weight += w;
    wx += w * point.day;
    wy += w * point.level;
  }
  if (!(weight > 0)) return null;
  const xMean = wx / weight;
  const yMean = wy / weight;
  let sxx = 0;
  let sxy = 0;
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!;
    const dx = point.day - xMean;
    sxx += weights[index]! * dx * dx;
    sxy += weights[index]! * dx * (point.level - yMean);
  }
  if (!(sxx > 0)) return null;
  return { slope: sxy / sxx, se: Math.sqrt(1 / sxx) };
}

function slopeFigure(
  series: GrowthSeries,
  cut: number,
  ends: boolean,
): GrowthFigure | null {
  const settled = series.days.filter((day) => day.reportedSd <= cut);
  const fit = weightedSlope(settled);
  const first = settled[0];
  const last = series.days[series.days.length - 1];
  if (!fit || !first || !last || series.elapsed <= 0) return null;
  const span = last.day - first.day;
  if (span <= 0) return null;
  const sd = ends
    ? hypot(first.reportedSd, last.reportedSd) * (series.elapsed / span)
    : fit.se * series.elapsed;
  if (!(sd > 0)) return null;
  return {
    mu: fit.slope * series.elapsed,
    sd,
    startDay: first.day,
    startAnswers: first.answers,
  };
}

export type Candidate = {
  id: string;
  label: string;
  family: CandidateFamily;
  score: (series: GrowthSeries) => GrowthFigure | null;
};

function answersCandidate(threshold: number): Candidate {
  return {
    id: `answers-${threshold}`,
    label: `latest − first day with ≥ ${threshold} answers`,
    family: "answers",
    score: (series) => {
      const start = firstWhere(series.days, (day) => day.answers >= threshold);
      return start < 0 ? null : endpoint(series, start);
    },
  };
}

function settledCandidate(cut: number): Candidate {
  return {
    id: `settled-${cut}`,
    label: `latest − first day with reported sd ≤ ${cut.toFixed(1)}`,
    family: "settled",
    score: (series) => {
      const start = firstWhere(series.days, (day) => day.reportedSd <= cut);
      return start < 0 ? null : endpoint(series, start);
    },
  };
}

function scaledCandidate(cut: number): Candidate {
  return {
    id: `scaled-${cut}`,
    label: `settled pace (sd ≤ ${cut.toFixed(1)}) stretched across the term`,
    family: "scaled",
    score: (series) => {
      const start = firstWhere(series.days, (day) => day.reportedSd <= cut);
      return start < 0 ? null : scale(series, start);
    },
  };
}

function slopeCandidate(cut: number, ends: boolean): Candidate {
  const se = ends ? "endpoint SE" : "classical SE";
  return {
    id: `${ends ? "slope-ends" : "slope"}-${cut}`,
    label: `WLS pace on days with sd ≤ ${cut.toFixed(1)}, × elapsed days, ${se}`,
    family: ends ? "slope-ends" : "slope",
    score: (series) => slopeFigure(series, cut, ends),
  };
}

export const GROWTH_CANDIDATES: readonly Candidate[] = [
  {
    id: "first-reading",
    label: "latest − first stored day",
    family: "baseline",
    score: (series) => (series.days.length ? endpoint(series, 0) : null),
  },
  ...ANSWER_THRESHOLDS.map(answersCandidate),
  ...SD_CUTS.map(settledCandidate),
  ...SD_CUTS.map(scaledCandidate),
  ...SD_CUTS.map((cut) => slopeCandidate(cut, false)),
  ...SD_CUTS.map((cut) => slopeCandidate(cut, true)),
];

export function scoreSeries(series: GrowthSeries): Scored[] {
  return GROWTH_CANDIDATES.map((candidate) => {
    const figure = candidate.score(series);
    if (!figure || !Number.isFinite(figure.mu) || !Number.isFinite(figure.sd))
      return null;
    return {
      ...figure,
      id: candidate.id,
      label: candidate.label,
      family: candidate.family,
    };
  });
}

export type SplitMetrics = {
  /** Learners in the split. */
  learners: number;
  /** Learners with a figure. */
  n: number;
  bias: number | null;
  mae: number | null;
  /** Share of figures whose 95% interval contains the true growth. */
  coverage: number | null;
  /** Median half-width of those intervals. */
  half: number | null;
};

export type GrowthRow = {
  id: string;
  label: string;
  family: CandidateFamily;
  overall: SplitMetrics;
  low: SplitMetrics;
  high: SplitMetrics;
  /** Correlation of the figure with total answers. Negative is the convergence signature. */
  practiceCorrelation: number | null;
  medianStartAnswers: number | null;
  medianStartDay: number | null;
};

export type GrowthSummary = {
  learners: number;
  truthMean: number;
  answerMedian: number;
  rows: GrowthRow[];
};

function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function correlation(xs: readonly number[], ys: readonly number[]) {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  let sx = 0;
  let sy = 0;
  for (let index = 0; index < n; index++) {
    sx += xs[index]!;
    sy += ys[index]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let index = 0; index < n; index++) {
    const dx = xs[index]! - mx;
    const dy = ys[index]! - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

function metricsOf(
  figures: readonly (GrowthFigure | null)[],
  truths: readonly number[],
): SplitMetrics {
  let bias = 0;
  let absolute = 0;
  let covered = 0;
  let n = 0;
  const halves: number[] = [];
  for (let index = 0; index < figures.length; index++) {
    const figure = figures[index];
    if (!figure) continue;
    const error = figure.mu - truths[index]!;
    const half = GROWTH_Z * figure.sd;
    n += 1;
    bias += error;
    absolute += Math.abs(error);
    if (Math.abs(error) <= half) covered += 1;
    halves.push(half);
  }
  return {
    learners: figures.length,
    n,
    bias: n ? bias / n : null,
    mae: n ? absolute / n : null,
    coverage: n ? covered / n : null,
    half: median(halves),
  };
}

export function summarizeGrowth(series: readonly GrowthSeries[]): GrowthSummary {
  const truths = series.map((row) => row.truth);
  const answers = series.map((row) => row.answers);
  const answerMedian = median(answers) ?? 0;
  const low = series.map((row) => row.answers <= answerMedian);
  const scores = series.map(scoreSeries);
  const rows: GrowthRow[] = GROWTH_CANDIDATES.map((candidate, index) => {
    const figures = scores.map((row) => row[index] ?? null);
    const pick = (wanted: boolean) => {
      const chosenFigures: (GrowthFigure | null)[] = [];
      const chosenTruths: number[] = [];
      for (let row = 0; row < series.length; row++) {
        if (low[row] !== wanted) continue;
        chosenFigures.push(figures[row] ?? null);
        chosenTruths.push(truths[row]!);
      }
      return metricsOf(chosenFigures, chosenTruths);
    };
    const xs: number[] = [];
    const ys: number[] = [];
    const starts: number[] = [];
    const startDays: number[] = [];
    for (let row = 0; row < series.length; row++) {
      const figure = figures[row];
      if (!figure) continue;
      xs.push(answers[row]!);
      ys.push(figure.mu);
      starts.push(figure.startAnswers);
      startDays.push(figure.startDay);
    }
    return {
      id: candidate.id,
      label: candidate.label,
      family: candidate.family,
      overall: metricsOf(figures, truths),
      low: pick(true),
      high: pick(false),
      practiceCorrelation: correlation(xs, ys),
      medianStartAnswers: median(starts),
      medianStartDay: median(startDays),
    };
  });
  const truthMean = truths.length
    ? truths.reduce((sum, value) => sum + value, 0) / truths.length
    : 0;
  return { learners: series.length, truthMean, answerMedian, rows };
}

function num(value: number | null, digits: number) {
  return value === null ? "—" : value.toFixed(digits);
}

function pct(value: number | null) {
  return value === null ? "—" : (value * 100).toFixed(1);
}

function rowLine(row: GrowthRow) {
  const cells = [row.overall, row.low, row.high].flatMap((split) => [
    String(split.n),
    num(split.bias, 3),
    num(split.mae, 3),
    pct(split.coverage),
  ]);
  return `| ${row.label} | ${cells.join(" | ")} | ${num(row.overall.half, 2)} | ${num(row.practiceCorrelation, 2)} | ${num(row.medianStartDay, 0)} | ${num(row.medianStartAnswers, 0)} |`;
}

export function formatGrowthStudy(
  summary: GrowthSummary,
  options: { seed: number; quick: boolean; termDays: number },
) {
  const lines = [
    `# Growth recovery (seed ${options.seed}, ${options.quick ? "quick" : "full"})`,
    "",
    `${summary.learners} misspecified learners. True growth is Uniform(0, 1.5) grades over ${options.termDays} days (mean ${summary.truthMean.toFixed(3)} here). Practice is 2–6 days a week and 5–40 answers a day. Starts are −2 to +3 grades from the age prior. Low and high practice split at the median answer count, ${Math.round(summary.answerMedian)}.`,
    "",
    "The target is the true change across the whole term. No figure is a miss, not a zero. Coverage is the share of figures whose ±1.96 se interval contains that target. Half-width is the median of those 1.96 se. r is the correlation of the figure with how many answers the learner gave; a negative r is the convergence signature.",
    "",
    "| definition | n | bias | MAE | 95% | n low | bias low | MAE low | 95% low | n high | bias high | MAE high | 95% high | half-width | r | start day | start answers |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summary.rows.map(rowLine),
    "",
  ];
  return lines.join("\n");
}
