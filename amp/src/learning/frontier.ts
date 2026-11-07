import type { GradeBand } from "../curriculum/types";
import {
  assertFrontierPolicy,
  DEFAULT_FRONTIER_POLICY,
  type FrontierPolicy,
} from "./frontier-policy";

/** Grade position on one axis: K = 0 … 8, then the high-school courses. */
export const gradeNumber: Record<GradeBand, number> = {
  K: 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "algebra-1": 9,
  geometry: 10,
  "algebra-2": 11,
  precalculus: 12,
};
export const MAX_GRADE = 12;

export type FrontierObservation = {
  templateId: string;
  correct: boolean;
  assisted: boolean;
  /** ISO time of the answer; drives how much the estimate may have moved. */
  createdAt?: string;
  /** Strength of the evidence, 1 when absent. A parent's paper mark without
   * the answer weighs less (src/workbook/results.ts) and never confirms a
   * band on its own. */
  evidenceWeight?: number;
};
/** Curriculum coordinate, uncertainty width, and evidence counts. Overall sd
 * includes a bounded surprise reserve; it is not calibrated confidence. */
export type Estimate = {
  level: number;
  sd: number;
  answered: number;
  independent: number;
};
export type Frontier = {
  /** The grade a learner of this age is typically working in. */
  expected: number;
  /** Steadier working-grade summary for the learner-facing readout. */
  overall: Estimate;
  strands: Record<string, Estimate>;
  /** Responsive pooled prior for local selection, separate from the displayed
   * working grade. Optional for older clients and stored snapshots. */
  adaptive?: Estimate;
  /** Preserve the injected prior when looking up an untouched strand. */
  strandPriorSd?: number;
  /** A scheduling ceiling supported by independent, varied retrieval.
   * This is not mastery credit or a calibrated probability. */
  confirmation?: Record<
    string,
    { level: number; foundationConfirmed: boolean; foundationLevel?: number }
  >;
  unconfirmedCeiling?: number;
};

/** Grades a learner born in `birthYear` should have completed by `now`.
 * US school years begin in August; a child starts kindergarten the fall after
 * turning five, so someone born in 2016 has finished grade 3 by October 2026. */
export function completedGrade(birthYear: number, now = Date.now()): number {
  const date = new Date(now);
  const schoolYear = date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
  return schoolYear - birthYear - 7;
}

const bandStart = { "K–2": 1, "3–5": 4, "6–8": 7, "9–12": 10 } as const;
/** The grade a learner is typically working in now: born 2016 → grade 4. */
export function initialLevel(options: {
  birthYear?: number | null;
  band?: keyof typeof bandStart | null;
  now?: number;
}): number {
  const level =
    options.birthYear != null
      ? completedGrade(options.birthYear, options.now) + 1
      : options.band
        ? bandStart[options.band]
        : 2;
  return Math.min(MAX_GRADE, Math.max(0, level));
}

// A grid posterior over grade level. Grade -1 lets "below kindergarten" be
// expressed; 13 is college-level.
const GRID = Array.from({ length: 141 }, (_, i) => -1 + i / 10);
/** Choice success includes chance guessing. Wrong-choice likelihood is the
 * typed-miss likelihood times a constant, so both carry the same evidence. */
type ResponseCurve = {
  success: Float64Array;
  hit: Float64Array;
  miss: Float64Array;
};
type ResponseModel = (grade: number, guess: number) => ResponseCurve;
const responseModels = new WeakMap<FrontierPolicy["response"], ResponseModel>();
function responseModel(response: FrontierPolicy["response"]): ResponseModel {
  const known = responseModels.get(response);
  if (known) return known;
  const { typedGuess, slip, discrimination, atLevelSuccess } = response;
  const offset =
    Math.log((atLevelSuccess - typedGuess) / (1 - slip - atLevelSuccess)) /
    discrimination;
  // A catalog has few grade and guess pairs, and every answer repeats one.
  const curves = new Map<string, ResponseCurve>();
  const model: ResponseModel = (grade, guess) => {
    const key = `${grade}|${guess}`;
    let curve = curves.get(key);
    if (!curve) {
      const success = Float64Array.from(GRID, (theta) => {
        const p =
          1 / (1 + Math.exp(-discrimination * (theta - grade + offset)));
        return guess + (1 - guess) * (typedGuess + (1 - typedGuess - slip) * p);
      });
      curve = {
        success,
        hit: success.map((p) => Math.log(p)),
        miss: success.map((p) => Math.log(1 - p)),
      };
      curves.set(key, curve);
    }
    return curve;
  };
  responseModels.set(response, model);
  return model;
}
function prior(mean: number, sd: number) {
  return GRID.map((theta) => -(((theta - mean) / sd) ** 2) / 2);
}
function summarize(
  log: number[],
  answered: number,
  independent: number,
  extraVariance = 0,
) {
  const top = Math.max(...log);
  const weights = log.map((value) => Math.exp(value - top));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const level = weights.reduce((sum, w, i) => sum + w * GRID[i]!, 0) / total;
  const variance =
    weights.reduce((sum, w, i) => sum + w * (GRID[i]! - level) ** 2, 0) / total;
  return {
    level: Math.round(level * 100) / 100,
    sd: Math.round(Math.sqrt(variance + extraVariance) * 100) / 100,
    answered,
    independent,
  };
}

// Convolve the posterior with a small time/evidence-dependent drift kernel.
// Overall and strand recency are configured separately in frontier-policy.ts.
const DAY = 86400000;
function blur(log: number[], variance: number) {
  if (variance <= 0) return log;
  const sd = Math.sqrt(variance) * 10; // in grid steps of 0.1 grade
  const radius = Math.ceil(3 * sd);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-(((i - radius) / sd) ** 2) / 2),
  );
  const top = Math.max(...log);
  const weights = log.map((value) => Math.exp(value - top));
  return weights.map((_, i) => {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = Math.min(GRID.length - 1, Math.max(0, i + k));
      sum += weights[j]! * kernel[k + radius]!;
    }
    return Math.log(sum + 1e-300);
  });
}

type Evidence = {
  templateId: string;
  grade: number;
  /** Chance a guess is graded correct: 0 for typed answers, 1/k for k options. */
  guess: number;
  strand: string;
  success: boolean;
  assisted: boolean;
  at: number;
  weight: number;
};
export type FrontierFoldItem = Pick<
  Evidence,
  "grade" | "guess" | "success" | "assisted" | "at" | "weight"
>;
/** One estimate between answers: everything the next answer depends on. */
export type FrontierFold = {
  log: number[];
  previous: number | null;
  surprise: number;
  uncertainty: number;
  answered: number;
  independent: number;
};
function startFold(log: number[]): FrontierFold {
  return {
    log,
    previous: null,
    surprise: 0,
    uncertainty: 0,
    answered: 0,
    independent: 0,
  };
}
function advanceFold(
  state: FrontierFold,
  item: FrontierFoldItem,
  policy: FrontierPolicy,
  drift: FrontierPolicy["overall"],
  model: ResponseModel,
  reportSurprises = false,
) {
  state.answered += 1;
  if (item.success && !item.assisted && item.weight >= 1)
    state.independent += 1;
  const correct =
    item.assisted && policy.assisted.treatAsFailure ? false : item.success;
  const weight =
    (item.assisted
      ? correct
        ? policy.assisted.correctWeight
        : policy.assisted.incorrectWeight
      : 1) * item.weight;
  // Assisted success provides partial evidence, never independent mastery.
  // An assisted miss can be neutral without losing the recorded attempt.
  if (weight === 0) return;
  const days =
    state.previous === null
      ? 0
      : Math.min(
          policy.maxDriftDays,
          Math.max(0, (item.at - state.previous) / DAY),
        );
  const log = blur(
    state.log,
    (state.previous === null ? 0 : drift.perAnswer * weight) +
      drift.perDay * days +
      state.surprise,
  );
  state.previous = item.at;
  const curve = model(item.grade, item.guess);
  const top = Math.max(...log);
  let total = 0;
  let chance = 0;
  for (let i = 0; i < log.length; i++) {
    const w = Math.exp(log[i]! - top);
    total += w;
    chance += w * curve.success[i]!;
  }
  const expected = chance / total;
  // This is reporting uncertainty, not extra likelihood weight for the
  // next answer. A rare miss calls the summary into question without
  // erasing the learner's established history.
  if (reportSurprises) {
    const u = policy.overallUncertainty;
    state.uncertainty *= u.retentionPerAnswer ** weight;
    const withoutChoiceGuess = (expected - item.guess) / (1 - item.guess);
    if (!correct && withoutChoiceGuess > u.rareMissThreshold)
      state.uncertainty = Math.min(
        u.maxVariance,
        state.uncertainty + u.rareMissVariance * weight,
      );
  }
  state.surprise =
    (correct ? 1 - expected : expected) > policy.surpriseThreshold
      ? correct
        ? drift.surpriseCorrect * weight
        : drift.surpriseIncorrect * weight
      : 0;
  const evidence = correct ? curve.hit : curve.miss;
  for (let i = 0; i < GRID.length; i++)
    log[i] = log[i]! + weight * evidence[i]!;
  state.log = log;
}
function finishFold(
  state: FrontierFold,
  now: number,
  policy: FrontierPolicy,
  drift: FrontierPolicy["overall"],
): Estimate {
  const log =
    state.previous === null
      ? state.log
      : blur(
          state.log,
          drift.perDay *
            Math.min(
              policy.maxDriftDays,
              Math.max(0, (now - state.previous) / DAY),
            ),
        );
  return summarize(log, state.answered, state.independent, state.uncertainty);
}

export type FrontierCatalog = {
  gradeOf: (templateId: string) => number | undefined;
  strandOf: (templateId: string) => string;
  /** Chance that guessing answers the item correctly (`guessChance` in
   * math/guess-chance.ts). Required, so no caller silently scores a 1-in-3
   * pick as a typed answer. */
  guessOf: (templateId: string) => number;
};
function evidenceOf(
  observation: FrontierObservation,
  index: number,
  catalog: FrontierCatalog,
): Evidence | null {
  const grade = catalog.gradeOf(observation.templateId);
  if (grade === undefined) return null;
  return {
    templateId: observation.templateId,
    grade,
    guess: Math.min(0.5, Math.max(0, catalog.guessOf(observation.templateId))),
    strand: catalog.strandOf(observation.templateId),
    success: observation.correct,
    assisted: observation.assisted,
    weight: Math.min(1, Math.max(0, observation.evidenceWeight ?? 1)),
    at: observation.createdAt
      ? Date.parse(observation.createdAt)
      : index * 60000,
  };
}

/** What confirming a strand's band reads from its independent answers. A band
 * selects answers by grade and result, then takes the most recent, so the
 * most recent of each grade and result always contains them. */
export type FrontierConfirmationBucket = {
  grade: number;
  success: boolean;
  items: { templateId: string; at: number; order: number }[];
};
export type FrontierConfirmationState = {
  seen: number;
  /** Independent successes per grade, in the order grades first succeeded. */
  successes: [grade: number, count: number][];
  buckets: FrontierConfirmationBucket[];
};
/** A strand's fold starts from the learner's current pooled estimate, so it is
 * replayed on each read until it has `freezeAfter` answers. By then the start
 * no longer shows in the estimate, and the fold simply continues. */
export type FrontierStrandState =
  | { replay: FrontierFoldItem[]; fold?: undefined }
  | { replay?: undefined; fold: FrontierFold };
/** Everything an estimate depends on, in a size bounded by the catalog rather
 * than by how many answers it has seen. */
export type FrontierState = {
  start: number;
  observed: number;
  lastAt: number | null;
  overall: FrontierFold;
  adaptive: FrontierFold;
  strands: Record<string, FrontierStrandState>;
  confirmation: Record<string, FrontierConfirmationState>;
};

export function createFrontierState(
  start: number,
  policy: FrontierPolicy = DEFAULT_FRONTIER_POLICY,
): FrontierState {
  return {
    start,
    observed: 0,
    lastAt: null,
    overall: startFold(prior(start, policy.prior.overallSd)),
    adaptive: startFold(prior(start, policy.prior.overallSd)),
    strands: {},
    confirmation: {},
  };
}

function strandPrior(pooled: Estimate, policy: FrontierPolicy) {
  return prior(pooled.level, Math.max(policy.prior.strandSd, pooled.sd));
}
function replayStrand(
  items: readonly FrontierFoldItem[],
  pooled: Estimate,
  policy: FrontierPolicy,
) {
  const model = responseModel(policy.strandResponse);
  const fold = startFold(strandPrior(pooled, policy));
  for (const item of items)
    advanceFold(fold, item, policy, policy.strand, model);
  return fold;
}

/** When a strand's replay may stop: see `startNoLongerShows`. */
export type FrontierFreeze = {
  from: number;
  every: number;
  atMost: number;
  tolerance: number;
};
export const STRAND_FREEZE: FrontierFreeze = {
  from: 40,
  every: 10,
  atMost: 400,
  tolerance: 0.01,
};
/** Whether a strand's answers have outweighed where it started: its folds from
 * the curriculum's two extremes must agree everywhere, tails included, because
 * a later jump in level draws on the tails. Identical folds stay identical, so
 * this also holds for every answer still to come. */
function startNoLongerShows(
  items: readonly FrontierFoldItem[],
  policy: FrontierPolicy,
  tolerance: number,
) {
  const estimate = (level: number) =>
    ({ level, sd: policy.prior.strandSd }) as Estimate;
  const low = replayStrand(items, estimate(0), policy);
  const high = replayStrand(items, estimate(MAX_GRADE), policy);
  if (low.surprise !== high.surprise) return false;
  const lowTop = Math.max(...low.log);
  const highTop = Math.max(...high.log);
  return low.log.every(
    (value, i) =>
      Math.abs(value - lowTop - (high.log[i]! - highTop)) <= tolerance,
  );
}

/** Folds one more answer in. Without `freeze`, every strand is replayed on each
 * read, which matches estimating the whole history from nothing but grows with
 * it. With `freeze`, a strand's fold continues on its own once its start no
 * longer shows. */
export function advanceFrontierState(
  state: FrontierState,
  observation: FrontierObservation,
  catalog: FrontierCatalog,
  policy: FrontierPolicy = DEFAULT_FRONTIER_POLICY,
  freeze?: FrontierFreeze,
) {
  const item = evidenceOf(observation, state.observed++, catalog);
  if (!item) return;
  state.lastAt = item.at;
  const strandModel = responseModel(policy.strandResponse);
  advanceFold(
    state.overall,
    item,
    policy,
    policy.overall,
    responseModel(policy.response),
    true,
  );
  advanceFold(state.adaptive, item, policy, policy.strand, strandModel);
  const strand = (state.strands[item.strand] ??= { replay: [] });
  if (strand.fold) {
    advanceFold(strand.fold, item, policy, policy.strand, strandModel);
  } else {
    strand.replay.push({
      grade: item.grade,
      guess: item.guess,
      success: item.success,
      assisted: item.assisted,
      at: item.at,
      weight: item.weight,
    });
    const answers = strand.replay.length;
    if (
      freeze &&
      answers >= freeze.from &&
      (answers >= freeze.atMost ||
        (answers % freeze.every === 0 &&
          startNoLongerShows(strand.replay, policy, freeze.tolerance)))
    )
      state.strands[item.strand] = {
        fold: replayStrand(
          strand.replay,
          finishFold(state.adaptive, item.at, policy, policy.strand),
          policy,
        ),
      };
  }
  if (!policy.confirmation.enabled) return;
  const confirmation = (state.confirmation[item.strand] ??= {
    seen: 0,
    successes: [],
    buckets: [],
  });
  if (item.assisted || item.weight < 1) return;
  if (item.success) {
    const known = confirmation.successes.find(([g]) => g === item.grade);
    if (known) known[1] += 1;
    else confirmation.successes.push([item.grade, 1]);
  }
  let bucket = confirmation.buckets.find(
    (b) => b.grade === item.grade && b.success === item.success,
  );
  if (!bucket) {
    bucket = { grade: item.grade, success: item.success, items: [] };
    confirmation.buckets.push(bucket);
  }
  bucket.items.push({
    templateId: item.templateId,
    at: item.at,
    order: confirmation.seen++,
  });
  if (bucket.items.length > policy.confirmation.evidenceWindow)
    bucket.items.shift();
}

function strandConfirmation(
  state: FrontierConfirmationState,
  start: number,
  policy: FrontierPolicy,
) {
  const c = policy.confirmation;
  const supports = (grade: number, spaced: boolean, foundation = false) => {
    // Success on harder material supports a working band. A harder miss
    // does not refute easier knowledge; foundation checks need direct work
    // near that foundation, not inferred mastery from downstream answers.
    const relevant = state.buckets
      .filter(
        (b) =>
          b.grade >= grade - c.gradeTolerance &&
          (foundation
            ? b.grade <= grade + c.foundationReach
            : b.success || b.grade <= grade + c.gradeTolerance),
      )
      .flatMap((b) => b.items.map((item) => ({ ...item, success: b.success })))
      .sort((x, y) => x.order - y.order)
      .slice(-c.evidenceWindow);
    const successes = relevant.filter((e) => e.success);
    const times = successes.map((e) => e.at).sort((a, b) => a - b);
    const separated =
      successes.length > 0 &&
      times.at(-1)! - times[0]! >= c.separationHours * 3600000;
    const varied =
      new Set(successes.map((e) => e.templateId)).size >= c.distinctFamilies;
    // Small catalogs can demonstrate a band through more separated
    // retrievals of their one available family, without a permanent gate.
    if (
      successes.length < c.independentSuccesses ||
      successes.length / relevant.length < c.minimumSuccessRate ||
      (!varied &&
        !(
          separated &&
          successes.length >=
            c.independentSuccesses * c.singleFamilySuccessMultiplier
        ))
    )
      return false;
    return !spaced || separated;
  };
  const baseline = Math.min(MAX_GRADE, start + c.sameSessionRise);
  // Provisional placement advances gradually within a session; spacing
  // strengthens a demonstrated band without imposing a time or age gate.
  const higherSuccesses = state.successes.reduce(
    (sum, [grade, count]) =>
      grade >= baseline - c.gradeTolerance ? sum + count : sum,
    0,
  );
  const provisional =
    baseline + Math.floor(higherSuccesses / c.provisionalSuccessesPerGrade);
  let level = baseline;
  for (const [grade] of state.successes)
    if (grade > level && supports(grade, false))
      level = Math.min(
        MAX_GRADE,
        Math.max(
          level,
          supports(grade, true) ? grade : Math.min(grade, provisional),
        ),
      );
  return { level, foundationConfirmed: supports(start, true, true) };
}

/** The estimate at `now`. Reading changes nothing, so a state can be read at any
 * time and advanced afterward. */
export function readFrontierState(
  state: FrontierState,
  now: number,
  policy: FrontierPolicy = DEFAULT_FRONTIER_POLICY,
): Frontier {
  const overall = finishFold(state.overall, now, policy, policy.overall);
  // Local selection retains its responsive evidence model. A steadier overall
  // readout must not hide a weak area or slow progress in a stronger one.
  const adaptive = finishFold(state.adaptive, now, policy, policy.strand);
  const strands: Record<string, Estimate> = {};
  for (const [name, strand] of Object.entries(state.strands))
    strands[name] = finishFold(
      strand.fold ?? replayStrand(strand.replay, adaptive, policy),
      now,
      policy,
      policy.strand,
    );
  const confirmation: NonNullable<Frontier["confirmation"]> = {};
  if (policy.confirmation.enabled)
    for (const [name, strand] of Object.entries(state.confirmation))
      confirmation[name] = strandConfirmation(strand, state.start, policy);
  return {
    expected: state.start,
    overall,
    adaptive,
    strands,
    strandPriorSd: policy.prior.strandSd,
    ...(policy.confirmation.enabled
      ? {
          confirmation,
          unconfirmedCeiling: state.start + policy.confirmation.sameSessionRise,
        }
      : {}),
  };
}

/** Bayesian estimate of each strand's grade level from the attempt history,
 * allowing the level to change over time. Deterministic for a given history
 * and time. */
export function estimateFrontier(
  options: FrontierCatalog & {
    start: number;
    observations: readonly FrontierObservation[];
    now?: number;
    /** Validated, immutable parameters for reproducible estimator comparisons. */
    policy?: FrontierPolicy;
  },
): Frontier {
  const policy = options.policy ?? DEFAULT_FRONTIER_POLICY;
  assertFrontierPolicy(policy);
  const state = createFrontierState(options.start, policy);
  for (const observation of options.observations)
    advanceFrontierState(state, observation, options, policy);
  return readFrontierState(state, options.now ?? state.lastAt ?? 0, policy);
}

/** The overall estimate after each of `counts` answers, as of `now`: the same
 * numbers as estimating each prefix alone, from one pass over the history. */
export function overallTrend(
  options: FrontierCatalog & {
    start: number;
    observations: readonly FrontierObservation[];
    now: number;
  },
  counts: readonly number[],
  policy: FrontierPolicy = DEFAULT_FRONTIER_POLICY,
) {
  const model = responseModel(policy.response);
  const fold = startFold(prior(options.start, policy.prior.overallSd));
  const read = new Map<number, Estimate>();
  const wanted = new Set(counts);
  const note = (answered: number) => {
    if (wanted.has(answered))
      read.set(answered, finishFold(fold, options.now, policy, policy.overall));
  };
  note(0);
  options.observations.forEach((observation, index) => {
    const item = evidenceOf(observation, index, options);
    if (item) advanceFold(fold, item, policy, policy.overall, model, true);
    note(index + 1);
  });
  return counts.map((answered) => {
    const { level, sd } = read.get(answered)!;
    return { answered, level, sd };
  });
}

/** A strand's estimate; untouched strands inherit the overall level with the
 * wider uncertainty of a strand that has no evidence of its own. */
export function strandEstimate(frontier: Frontier, strand: string): Estimate {
  if (frontier.strands[strand]) return frontier.strands[strand]!;
  const pooled = frontier.adaptive ?? frontier.overall;
  // Match fold's bounded prior exactly. Otherwise merely recording a neutral
  // assisted attempt could move a previously untouched area's estimate.
  return summarize(
    prior(
      pooled.level,
      Math.max(
        frontier.strandPriorSd ?? DEFAULT_FRONTIER_POLICY.prior.strandSd,
        pooled.sd,
      ),
    ),
    0,
    0,
  );
}
export function strandLevel(frontier: Frontier, strand: string): number {
  return strandEstimate(frontier, strand).level;
}
/** The grade to aim the next problem at: above the estimate while it is
 * uncertain (to learn the most), settling just below it (about 80% success). */
export function targetGrade(estimate: Estimate): number {
  return estimate.level - 0.5 + 0.3 * estimate.sd;
}
