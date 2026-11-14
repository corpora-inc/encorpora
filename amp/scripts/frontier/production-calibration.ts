/**
 * Coverage of the production frontier estimator's posterior sd.
 *
 * Synthetic learners have a known working grade, overall and per strand.
 * Problems come from the production planner (`planMixedPractice`) and the
 * production estimator (`newLearnerFrontier` / `advanceLearnerFrontier` /
 * `readLearnerFrontier`), the same calls as tests/climb-simulation.fixture.ts.
 * Correctness is sampled; the problem text is not generated.
 *
 *   npx tsx scripts/frontier/production-calibration.ts
 *   npx tsx scripts/frontier/production-calibration.ts --quick --seed 20261110
 *   npx tsx scripts/frontier/production-calibration.ts --growth
 *   npx tsx scripts/frontier/production-calibration.ts --growth --quick
 *
 * `--growth` is the growth-recovery study: misspecified learners, a 180-day
 * term, and irregular practice. Scoring lives in `growth-recovery.ts`.
 *
 * Markdown goes to stdout. JSON goes to artifacts/calibration/ (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import { skills } from "../../src/curriculum/catalog";
import {
  initialLevel,
  productionSuccessProbability,
} from "../../src/learning/frontier";
import { DEFAULT_FRONTIER_POLICY } from "../../src/learning/frontier-policy";
import { reportedSd, reportFrontier } from "../../src/learning/frontier-report";
import { RANGE_SD_MULTIPLIER } from "../../src/learning/level-check";
import {
  formatGrowthStudy,
  summarizeGrowth,
  type GrowthReading,
  type GrowthSeries,
} from "./growth-recovery";
import {
  MISSPECIFIED_RESPONSE,
  misspecifiedSuccessProbability,
} from "../../src/learning/synthetic-response";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
} from "../../src/math/contracts";
import { templates } from "../../src/math/engine";
import { guessChanceOf } from "../../src/math/guess-chance";
import { projectSkillEvidence } from "../../src/server/evidence";
import {
  advanceLearnerFrontier,
  newLearnerFrontier,
  readLearnerFrontier,
} from "../../src/server/learner-frontier";
import {
  planMixedPractice,
  templateGrade,
} from "../../src/server/mixed-practice";
import type { Outcome } from "../../src/server/repository";

export const CALIBRATION_SEED = 20261110;
/** A Monday in the climb fixture, so a birth year maps to the same grade. */
export const CALIBRATION_EPOCH = Date.parse("2026-10-19T12:00:00Z");
export const CHECKPOINTS = [20, 50, 100, 300] as const;
const ANSWERS = CHECKPOINTS[CHECKPOINTS.length - 1]!;
const DAY_MS = 86_400_000;
const FULL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const FULL_OFFSETS = [-2, -1, 0, 1, 2, 3];
const QUICK_GRADES = FULL_GRADES;
const QUICK_OFFSETS = [-2, 0, 1, 3];

export type LearnerModel = "well-specified" | "misspecified";

export type CalibrationPoint = {
  model: LearnerModel;
  learner: string;
  grade: number;
  offset: number;
  rep: number;
  answers: number;
  /** "overall", or a strand id. */
  scope: string;
  mean: number;
  /** Posterior sd from the estimator, before reported-sd calibration. */
  sd: number;
  /** As shown (`reportFrontier`): the display rule's level and the reported
   * width for this estimate's own answer count, as production stores it. */
  shown: number;
  shownSd: number;
  /** This estimate's own answers: an area's, not the learner's total. */
  counted: number;
  truth: number;
};

export type CoverageMetrics = {
  n: number;
  coverage1: number;
  coverage2: number;
  /** Within ±1.64 sd: the range the app draws (`RANGE_SD_MULTIPLIER`). */
  coverageShown: number;
  mae: number;
  rmse: number;
};

export type GrowthMetrics = {
  n: number;
  mae: number;
  rmse: number;
  bias: number;
};

export type ScopeBand = {
  answers: number;
  scope: string;
  posterior: CoverageMetrics;
  reported: CoverageMetrics;
};

export type ModelReport = {
  bands: ScopeBand[];
  growth: GrowthMetrics;
  points: CalibrationPoint[];
};

export type CalibrationReport = {
  seed: number;
  quick: boolean;
  policy: string;
  checkpoints: readonly number[];
  learners: number;
  models: Record<LearnerModel, ModelReport>;
};

type LearnerJob = {
  id: string;
  model: LearnerModel;
  grade: number;
  offset: number;
  rep: number;
  seed: number;
  itemOffsets: Record<string, number>;
};

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const webTemplates = templates.filter((template) =>
  clientCanDraw(template, {
    responseCapabilities: [...responseCapabilities],
    figureCapabilities: [...figureCapabilities],
  }),
);
const strandNames = [...new Set(skills.map((skill) => skill.strand))].sort();
const gradeOf = new Map(
  webTemplates.map((template) => [template.id, templateGrade(template, nodes)]),
);
const strandOf = new Map(
  webTemplates.map((template) => [
    template.id,
    nodes.get(template.skillId)?.strand ?? template.skillId,
  ]),
);

function mix(parts: readonly number[]) {
  let hash = 2166136261;
  for (const part of parts) {
    hash ^= part | 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number) {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function birthYearForGrade(grade: number, now: number) {
  const date = new Date(now);
  const schoolYear = date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
  return schoolYear - grade - 6;
}

function dayOfAnswer(index: number) {
  return (index / (ANSWERS - 1)) * MISSPECIFIED_RESPONSE.termDays;
}

/** One learner, one model: 300 production problems, read at the checkpoints. */
export function simulateLearner(job: LearnerJob): CalibrationPoint[] {
  const modelCode = job.model === "well-specified" ? 1 : 2;
  const rng = mulberry32(
    mix([job.seed, job.grade, Math.round(job.offset * 10), job.rep, modelCode]),
  );
  const slip =
    MISSPECIFIED_RESPONSE.slipMin +
    rng() * (MISSPECIFIED_RESPONSE.slipMax - MISSPECIFIED_RESPONSE.slipMin);
  const guess =
    MISSPECIFIED_RESPONSE.guessMin +
    rng() * (MISSPECIFIED_RESPONSE.guessMax - MISSPECIFIED_RESPONSE.guessMin);
  const growth =
    job.model === "misspecified"
      ? MISSPECIFIED_RESPONSE.growthMin +
        rng() *
          (MISSPECIFIED_RESPONSE.growthMax - MISSPECIFIED_RESPONSE.growthMin)
      : 0;
  const strandOffset = new Map<string, number>();
  for (const strand of strandNames)
    strandOffset.set(
      strand,
      job.model === "misspecified" ? (rng() - 0.5) * 1.2 : 0,
    );
  const birthYear = birthYearForGrade(job.grade, CALIBRATION_EPOCH);
  const start = initialLevel({ birthYear, now: CALIBRATION_EPOCH });
  if (start !== job.grade)
    throw new Error(
      `Birth year ${birthYear} started at ${start}, not grade ${job.grade}`,
    );
  const theta0 = job.grade + job.offset;
  const state = newLearnerFrontier({
    epoch: 0,
    start,
    fromAge: true,
    strandStarts: {},
  });
  const attempts: Outcome[] = [];
  const points: CalibrationPoint[] = [];
  const wanted = new Set<number>(CHECKPOINTS);
  for (let index = 0; index < ANSWERS; index++) {
    const at = CALIBRATION_EPOCH + dayOfAnswer(index) * DAY_MS;
    const frontier = readLearnerFrontier(state, at);
    const [choice] = planMixedPractice({
      templates: webTemplates,
      skills,
      attempts: attempts.slice(-12),
      evidence: projectSkillEvidence(attempts),
      frontier,
      count: 1,
      seed: `cal:${job.id}:${index}`,
      now: at,
      learnerKey: `cal:${job.id}`,
    });
    if (!choice) throw new Error(`No problem for ${job.id} at ${index}`);
    const template = choice.template;
    const strand = strandOf.get(template.id) ?? choice.strand;
    const grade = gradeOf.get(template.id);
    if (grade === undefined) throw new Error(`No grade for ${template.id}`);
    const day = dayOfAnswer(index);
    const overallTruth =
      theta0 + growth * (day / MISSPECIFIED_RESPONSE.termDays);
    const truth = overallTruth + (strandOffset.get(strand) ?? 0);
    const itemGuess = guessChanceOf(template.id);
    const probability =
      job.model === "well-specified"
        ? productionSuccessProbability(
            truth,
            grade,
            itemGuess,
            DEFAULT_FRONTIER_POLICY.response,
          )
        : misspecifiedSuccessProbability({
            theta: truth,
            catalogGrade: grade,
            itemOffset: job.itemOffsets[template.id] ?? 0,
            slip,
            guess,
          });
    const correct = rng() < probability;
    const createdAt = new Date(at).toISOString();
    attempts.push({
      id: `${job.id}:a${index}`,
      problemId: `${job.id}:p${index}`,
      requestId: `${job.id}:r${index}`,
      skillId: template.skillId,
      templateId: template.id,
      response: "",
      correct,
      assisted: false,
      explanation: [],
      answer: "",
      createdAt,
    });
    advanceLearnerFrontier(state, [
      {
        templateId: template.id,
        correct,
        assisted: false,
        createdAt,
        practiceRevision: 0,
        sequence: String(index + 1),
      },
    ]);
    const answered = index + 1;
    if (!wanted.has(answered)) continue;
    const after = readLearnerFrontier(state, at);
    const base = {
      model: job.model,
      learner: job.id,
      grade: job.grade,
      offset: job.offset,
      rep: job.rep,
      answers: answered,
    };
    const shown = reportFrontier(after);
    points.push({
      ...base,
      scope: "overall",
      mean: after.overall.level,
      sd: after.overall.sd,
      shown: shown.overall.level,
      shownSd: shown.overall.sd,
      counted: after.overall.answered,
      truth: overallTruth,
    });
    for (const [name, estimate] of Object.entries(after.strands))
      points.push({
        ...base,
        scope: name,
        mean: estimate.level,
        sd: estimate.sd,
        shown: shown.strands[name]!.level,
        shownSd: shown.strands[name]!.sd,
        counted: estimate.answered,
        truth: overallTruth + (strandOffset.get(name) ?? 0),
      });
  }
  return points;
}

function itemOffsets(seed: number) {
  const rng = mulberry32(mix([seed, 0x5a17]));
  const offsets: Record<string, number> = {};
  for (const template of webTemplates)
    offsets[template.id] = gaussian(rng) * MISSPECIFIED_RESPONSE.itemSd;
  return offsets;
}

function jobsFor(options: {
  seed: number;
  quick: boolean;
  models: readonly LearnerModel[];
}): LearnerJob[] {
  const shared = itemOffsets(options.seed);
  const jobs: LearnerJob[] = [];
  for (const model of options.models) {
    // The coverage band is ±4 points. A 40-learner draw falls outside it by
    // sampling error, so quick mode keeps the whole misspecified grid the
    // constants were fit on and only shrinks the well-specified grid.
    const shrink = options.quick && model === "well-specified";
    const grades = shrink ? QUICK_GRADES : FULL_GRADES;
    const offsets = shrink ? QUICK_OFFSETS : FULL_OFFSETS;
    const reps = shrink ? [0] : [0, 1];
    for (const rep of reps)
      for (const grade of grades)
        for (const offset of offsets) {
          const id = `${model}:g${grade}:o${offset}:r${rep}`;
          jobs.push({
            id,
            model,
            grade,
            offset,
            rep,
            seed: options.seed,
            itemOffsets: model === "misspecified" ? shared : {},
          });
        }
  }
  return jobs;
}

function metrics(
  points: readonly CalibrationPoint[],
  sdOf: (point: CalibrationPoint) => number,
  centreOf: (point: CalibrationPoint) => number = (point) => point.mean,
): CoverageMetrics {
  let within1 = 0;
  let within2 = 0;
  let withinShown = 0;
  let absolute = 0;
  let squared = 0;
  for (const point of points) {
    const error = Math.abs(centreOf(point) - point.truth);
    const sd = sdOf(point);
    if (error <= sd) within1 += 1;
    if (error <= 2 * sd) within2 += 1;
    if (error <= RANGE_SD_MULTIPLIER * sd) withinShown += 1;
    absolute += error;
    squared += error * error;
  }
  const n = points.length;
  return {
    n,
    coverage1: n ? within1 / n : 0,
    coverage2: n ? within2 / n : 0,
    coverageShown: n ? withinShown / n : 0,
    mae: n ? absolute / n : 0,
    rmse: n ? Math.sqrt(squared / n) : 0,
  };
}

function growthOf(points: readonly CalibrationPoint[]): GrowthMetrics {
  const ends = new Map<
    string,
    { first?: CalibrationPoint; last?: CalibrationPoint }
  >();
  for (const point of points) {
    if (point.scope !== "overall") continue;
    const row = ends.get(point.learner) ?? {};
    if (point.answers === CHECKPOINTS[0]) row.first = point;
    if (point.answers === ANSWERS) row.last = point;
    ends.set(point.learner, row);
  }
  let n = 0;
  let absolute = 0;
  let squared = 0;
  let bias = 0;
  for (const row of ends.values()) {
    if (!row.first || !row.last) continue;
    const reported = row.last.mean - row.first.mean;
    const truth = row.last.truth - row.first.truth;
    const error = reported - truth;
    n += 1;
    absolute += Math.abs(error);
    squared += error * error;
    bias += error;
  }
  return {
    n,
    mae: n ? absolute / n : 0,
    rmse: n ? Math.sqrt(squared / n) : 0,
    bias: n ? bias / n : 0,
  };
}

function bandFor(
  points: CalibrationPoint[],
  answers: number,
  scope: string,
): ScopeBand {
  return {
    answers,
    scope,
    posterior: metrics(points, (point) => point.sd),
    // What production shows and stores: the shown level, and the width
    // `reportFrontier` gives for the estimate's own answer count.
    reported: metrics(
      points,
      (point) => point.shownSd,
      (point) => point.shown,
    ),
  };
}

function modelReport(points: CalibrationPoint[]): ModelReport {
  const bands: ScopeBand[] = [];
  for (const answers of CHECKPOINTS) {
    const at = points.filter((point) => point.answers === answers);
    const overall = at.filter((point) => point.scope === "overall");
    const strands = at.filter((point) => point.scope !== "overall");
    bands.push(bandFor(overall, answers, "overall"));
    bands.push(bandFor(strands, answers, "strands"));
    const names = [...new Set(strands.map((point) => point.scope))].sort();
    for (const scope of names) {
      const rows = strands.filter((point) => point.scope === scope);
      if (rows.length < 15) continue;
      bands.push(bandFor(rows, answers, scope));
    }
  }
  return { bands, growth: growthOf(points), points };
}

function emptyModel(): ModelReport {
  return {
    bands: [],
    growth: { n: 0, mae: 0, rmse: 0, bias: 0 },
    points: [],
  };
}

const GROWTH_QUICK_GRADES = [1, 4, 7, 10];
const GROWTH_QUICK_OFFSETS = [-2, 0, 2];

type GrowthJob = {
  id: string;
  grade: number;
  offset: number;
  rep: number;
  seed: number;
  itemOffsets: Record<string, number>;
};

/**
 * One misspecified learner across a 180-day term. Practice is 2–6 fixed
 * weekdays and 5–40 answers on each of those days. Person parameters are
 * drawn in the same order as `simulateLearner`, then the practice pattern.
 * A day is stored only when the learner answered, which is what a level day is.
 */
export function simulateGrowthLearner(job: GrowthJob): GrowthSeries {
  const rng = mulberry32(
    mix([job.seed, job.grade, Math.round(job.offset * 10), job.rep, 2]),
  );
  const slip =
    MISSPECIFIED_RESPONSE.slipMin +
    rng() * (MISSPECIFIED_RESPONSE.slipMax - MISSPECIFIED_RESPONSE.slipMin);
  const guess =
    MISSPECIFIED_RESPONSE.guessMin +
    rng() * (MISSPECIFIED_RESPONSE.guessMax - MISSPECIFIED_RESPONSE.guessMin);
  const growth =
    MISSPECIFIED_RESPONSE.growthMin +
    rng() * (MISSPECIFIED_RESPONSE.growthMax - MISSPECIFIED_RESPONSE.growthMin);
  const strandOffset = new Map<string, number>();
  for (const strand of strandNames)
    strandOffset.set(strand, (rng() - 0.5) * 1.2);
  const daysPerWeek = 2 + Math.floor(rng() * 5);
  const weekdays = [0, 1, 2, 3, 4, 5, 6];
  for (let index = weekdays.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1));
    const held = weekdays[index]!;
    weekdays[index] = weekdays[swap]!;
    weekdays[swap] = held;
  }
  const practices = new Set(weekdays.slice(0, daysPerWeek));
  const birthYear = birthYearForGrade(job.grade, CALIBRATION_EPOCH);
  const start = initialLevel({ birthYear, now: CALIBRATION_EPOCH });
  if (start !== job.grade)
    throw new Error(
      `Birth year ${birthYear} started at ${start}, not grade ${job.grade}`,
    );
  const theta0 = job.grade + job.offset;
  const state = newLearnerFrontier({
    epoch: 0,
    start,
    fromAge: true,
    strandStarts: {},
  });
  const attempts: Outcome[] = [];
  const days: GrowthReading[] = [];
  let serial = 0;
  const termDays = MISSPECIFIED_RESPONSE.termDays;
  for (let day = 0; day < termDays; day++) {
    if (!practices.has(day % 7)) continue;
    const count = 5 + Math.floor(rng() * 36);
    for (let within = 0; within < count; within++) {
      const at = CALIBRATION_EPOCH + day * DAY_MS + within * 1000;
      const frontier = readLearnerFrontier(state, at);
      const [choice] = planMixedPractice({
        templates: webTemplates,
        skills,
        attempts: attempts.slice(-12),
        evidence: projectSkillEvidence(attempts),
        frontier,
        count: 1,
        seed: `growth:${job.id}:${serial}`,
        now: at,
        learnerKey: `growth:${job.id}`,
      });
      if (!choice) throw new Error(`No problem for ${job.id} on day ${day}`);
      const template = choice.template;
      const strand = strandOf.get(template.id) ?? choice.strand;
      const grade = gradeOf.get(template.id);
      if (grade === undefined) throw new Error(`No grade for ${template.id}`);
      const overallTruth = theta0 + growth * (day / termDays);
      const truth = overallTruth + (strandOffset.get(strand) ?? 0);
      const probability = misspecifiedSuccessProbability({
        theta: truth,
        catalogGrade: grade,
        itemOffset: job.itemOffsets[template.id] ?? 0,
        slip,
        guess,
      });
      const correct = rng() < probability;
      const createdAt = new Date(at).toISOString();
      attempts.push({
        id: `${job.id}:a${serial}`,
        problemId: `${job.id}:p${serial}`,
        requestId: `${job.id}:r${serial}`,
        skillId: template.skillId,
        templateId: template.id,
        response: "",
        correct,
        assisted: false,
        explanation: [],
        answer: "",
        createdAt,
      });
      serial += 1;
      advanceLearnerFrontier(state, [
        {
          templateId: template.id,
          correct,
          assisted: false,
          createdAt,
          practiceRevision: 0,
          sequence: String(serial),
        },
      ]);
    }
    const at = CALIBRATION_EPOCH + day * DAY_MS + count * 1000;
    const after = readLearnerFrontier(state, at);
    days.push({
      day,
      answers: after.overall.answered,
      level: after.overall.level,
      reportedSd: reportedSd(after.overall.sd, {
        answered: after.overall.answered,
      }),
      truth: theta0 + growth * (day / termDays),
    });
  }
  const last = days[days.length - 1];
  return {
    id: job.id,
    grade: job.grade,
    offset: job.offset,
    rep: job.rep,
    answers: last?.answers ?? 0,
    daysPerWeek,
    truth: growth,
    elapsed: termDays,
    days,
  };
}

function growthJobsFor(options: { seed: number; quick: boolean }): GrowthJob[] {
  const shared = itemOffsets(options.seed);
  const grades = options.quick ? GROWTH_QUICK_GRADES : FULL_GRADES;
  const offsets = options.quick ? GROWTH_QUICK_OFFSETS : FULL_OFFSETS;
  const reps = options.quick ? [0] : [0, 1];
  const jobs: GrowthJob[] = [];
  for (const rep of reps)
    for (const grade of grades)
      for (const offset of offsets)
        jobs.push({
          id: `misspecified:g${grade}:o${offset}:r${rep}`,
          grade,
          offset,
          rep,
          seed: options.seed,
          itemOffsets: shared,
        });
  return jobs;
}

type GrowthWorkerResponse =
  | { ok: true; series: GrowthSeries; ms: number }
  | { ok: false; error: string; learner: string };

function listenGrowth(
  worker: Worker,
  job: GrowthJob,
): Promise<GrowthWorkerResponse> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      worker.off("message", done);
      reject(error);
    };
    const done = (message: GrowthWorkerResponse) => {
      worker.off("error", fail);
      resolve(message);
    };
    worker.once("error", fail);
    worker.once("message", done);
    worker.postMessage({ kind: "growth", job });
  });
}

async function runGrowthJobs(
  jobs: readonly GrowthJob[],
  concurrency: number,
  quiet: boolean,
): Promise<GrowthSeries[]> {
  if (jobs.length === 0) return [];
  const workers = Math.max(1, Math.min(concurrency, jobs.length));
  if (workers === 1) return jobs.map((job) => simulateGrowthLearner(job));
  const execArgv = process.execArgv.filter(
    (arg) => arg !== "--test" && !arg.startsWith("--test-"),
  );
  const pool = Array.from(
    { length: workers },
    () => new Worker(new URL(import.meta.url), { execArgv }),
  );
  const series: GrowthSeries[] = [];
  let cursor = 0;
  try {
    await Promise.all(
      pool.map(async (worker) => {
        for (;;) {
          const index = cursor;
          cursor += 1;
          const job = jobs[index];
          if (!job) return;
          const response = await listenGrowth(worker, job);
          if (!response.ok)
            throw new Error(`${response.learner}: ${response.error}`);
          series.push(response.series);
          if (!quiet)
            process.stderr.write(
              `  ${response.ms}ms ${job.id} (${index + 1}/${jobs.length})\n`,
            );
        }
      }),
    );
  } finally {
    await Promise.all(pool.map((worker) => worker.terminate()));
  }
  return series;
}

export async function runGrowthRecovery(
  options: {
    seed?: number;
    quick?: boolean;
    concurrency?: number;
    quiet?: boolean;
  } = {},
) {
  const seed = options.seed ?? CALIBRATION_SEED;
  const quick = options.quick ?? false;
  const jobs = growthJobsFor({ seed, quick });
  const concurrency =
    options.concurrency ?? Math.max(1, Math.min(8, availableParallelism() - 1));
  const started = Date.now();
  const series = await runGrowthJobs(jobs, concurrency, options.quiet ?? false);
  const summary = summarizeGrowth(series);
  if (!options.quiet)
    process.stderr.write(
      `growth ${quick ? "quick" : "full"} seed ${seed}: ${jobs.length} learners in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
    );
  return {
    seed,
    quick,
    termDays: MISSPECIFIED_RESPONSE.termDays,
    summary,
    series,
  };
}

function writeGrowth(report: Awaited<ReturnType<typeof runGrowthRecovery>>) {
  const directory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../artifacts/calibration",
  );
  mkdirSync(directory, { recursive: true });
  const path = join(
    directory,
    report.quick ? "growth-quick.json" : "growth-full.json",
  );
  writeFileSync(
    path,
    JSON.stringify({
      seed: report.seed,
      quick: report.quick,
      termDays: report.termDays,
      summary: report.summary,
    }),
  );
  return path;
}

type WorkerResponse =
  | { ok: true; points: CalibrationPoint[]; ms: number }
  | { ok: false; error: string; learner: string };

function listen(worker: Worker, job: LearnerJob): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      worker.off("message", done);
      reject(error);
    };
    const done = (message: WorkerResponse) => {
      worker.off("error", fail);
      resolve(message);
    };
    worker.once("error", fail);
    worker.once("message", done);
    worker.postMessage({ kind: "run", job });
  });
}

async function runJobs(
  jobs: readonly LearnerJob[],
  concurrency: number,
  quiet: boolean,
): Promise<CalibrationPoint[]> {
  if (jobs.length === 0) return [];
  const workers = Math.max(1, Math.min(concurrency, jobs.length));
  if (workers === 1) return jobs.flatMap((job) => simulateLearner(job));
  const execArgv = process.execArgv.filter(
    (arg) => arg !== "--test" && !arg.startsWith("--test-"),
  );
  const pool = Array.from(
    { length: workers },
    () => new Worker(new URL(import.meta.url), { execArgv }),
  );
  const points: CalibrationPoint[] = [];
  let cursor = 0;
  try {
    await Promise.all(
      pool.map(async (worker) => {
        for (;;) {
          const index = cursor;
          cursor += 1;
          const job = jobs[index];
          if (!job) return;
          const response = await listen(worker, job);
          if (!response.ok)
            throw new Error(`${response.learner}: ${response.error}`);
          points.push(...response.points);
          if (!quiet)
            process.stderr.write(
              `  ${response.ms}ms ${jobs[index]!.id} (${index + 1}/${jobs.length})\n`,
            );
        }
      }),
    );
  } finally {
    await Promise.all(pool.map((worker) => worker.terminate()));
  }
  return points;
}

export async function runProductionCalibration(
  options: {
    seed?: number;
    quick?: boolean;
    models?: readonly LearnerModel[];
    concurrency?: number;
    quiet?: boolean;
  } = {},
): Promise<CalibrationReport> {
  const seed = options.seed ?? CALIBRATION_SEED;
  const quick = options.quick ?? false;
  const models = options.models ?? ["well-specified", "misspecified"];
  const jobs = jobsFor({ seed, quick, models });
  const concurrency =
    options.concurrency ?? Math.max(1, Math.min(8, availableParallelism() - 1));
  const started = Date.now();
  const points = await runJobs(jobs, concurrency, options.quiet ?? false);
  const byModel = new Map<LearnerModel, CalibrationPoint[]>();
  for (const point of points) {
    const list = byModel.get(point.model) ?? [];
    list.push(point);
    byModel.set(point.model, list);
  }
  const report: CalibrationReport = {
    seed,
    quick,
    policy: DEFAULT_FRONTIER_POLICY.version,
    checkpoints: CHECKPOINTS,
    learners: jobs.length,
    models: {
      "well-specified": byModel.has("well-specified")
        ? modelReport(byModel.get("well-specified")!)
        : emptyModel(),
      misspecified: byModel.has("misspecified")
        ? modelReport(byModel.get("misspecified")!)
        : emptyModel(),
    },
  };
  if (!options.quiet)
    process.stderr.write(
      `calibration ${quick ? "quick" : "full"} seed ${seed}: ${jobs.length} learners in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
    );
  return report;
}

function percent(value: number) {
  return (value * 100).toFixed(1);
}

function metricRow(band: ScopeBand, metrics: CoverageMetrics) {
  return `| ${band.answers} | ${band.scope} | ${metrics.n} | ${percent(metrics.coverage1)} | ${percent(metrics.coverageShown)} | ${percent(metrics.coverage2)} | ${metrics.mae.toFixed(3)} | ${metrics.rmse.toFixed(3)} |`;
}

function formatModel(name: string, model: ModelReport) {
  const summary = model.bands.filter(
    (band) => band.scope === "overall" || band.scope === "strands",
  );
  const lines = [
    `## ${name}`,
    "",
    "### Posterior sd",
    "",
    "| answers | scope | n | ±1σ % | ±1.64σ % | ±2σ % | MAE | RMSE |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summary.map((band) => metricRow(band, band.posterior)),
    "",
    "### As shown (shown level, reported sd for own answers)",
    "",
    "| answers | scope | n | ±1σ % | ±1.64σ % | ±2σ % | MAE | RMSE |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summary.map((band) => metricRow(band, band.reported)),
    "",
    `Growth (estimate at ${ANSWERS} minus estimate at ${CHECKPOINTS[0]}, against true Δθ): n=${model.growth.n}, MAE ${model.growth.mae.toFixed(3)}, RMSE ${model.growth.rmse.toFixed(3)}, bias ${model.growth.bias.toFixed(3)}.`,
    "",
  ];
  const strands = model.bands.filter(
    (band) => band.scope !== "overall" && band.scope !== "strands",
  );
  if (strands.length) {
    lines.push(
      "| answers | strand | n | posterior ±1σ % | reported ±1σ % | posterior ±2σ % | reported ±2σ % |",
      "| ---: | --- | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const band of strands)
      lines.push(
        `| ${band.answers} | ${band.scope} | ${band.posterior.n} | ${percent(band.posterior.coverage1)} | ${percent(band.reported.coverage1)} | ${percent(band.posterior.coverage2)} | ${percent(band.reported.coverage2)} |`,
      );
    lines.push("");
  }
  return lines.join("\n");
}

export function formatCalibration(report: CalibrationReport) {
  const header = [
    `# Production frontier coverage (seed ${report.seed}, ${report.quick ? "quick" : "full"})`,
    "",
    `Policy \`${report.policy}\`. Reported sd is sd-cal-v1. ${report.learners} learners, checkpoints ${report.checkpoints.join(", ")}.`,
    "",
  ];
  return (
    header.join("\n") +
    (Object.entries(report.models) as [LearnerModel, ModelReport][])
      .filter(([, model]) => model.points.length > 0)
      .map(([name, model]) => formatModel(name, model))
      .join("\n")
  );
}

export function writeCalibration(report: CalibrationReport) {
  const directory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../artifacts/calibration",
  );
  mkdirSync(directory, { recursive: true });
  const path = join(
    directory,
    report.quick ? "production-quick.json" : "production-full.json",
  );
  writeFileSync(path, JSON.stringify(report));
  return path;
}

if (!isMainThread) {
  parentPort!.on(
    "message",
    (
      message:
        { kind: "run"; job: LearnerJob } | { kind: "growth"; job: GrowthJob },
    ) => {
      try {
        const started = Date.now();
        if (message.kind === "growth") {
          const response: GrowthWorkerResponse = {
            ok: true,
            series: simulateGrowthLearner(message.job),
            ms: Date.now() - started,
          };
          parentPort!.postMessage(response);
          return;
        }
        const response: WorkerResponse = {
          ok: true,
          points: simulateLearner(message.job),
          ms: Date.now() - started,
        };
        parentPort!.postMessage(response);
      } catch (error) {
        const response: WorkerResponse = {
          ok: false,
          learner: message.job.id,
          error:
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error),
        };
        parentPort!.postMessage(response);
      }
    },
  );
} else if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  let quick = false;
  let growth = false;
  let seed = CALIBRATION_SEED;
  let models: LearnerModel[] = ["well-specified", "misspecified"];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--quick") quick = true;
    else if (arg === "--growth") growth = true;
    else if (arg === "--seed") seed = Number(args[++index]);
    else if (arg === "--model") {
      const name = args[++index];
      if (name !== "well-specified" && name !== "misspecified")
        throw new Error("--model must be well-specified or misspecified");
      models = [name];
    } else throw new Error(`Unknown argument ${arg}`);
  }
  if (!Number.isInteger(seed)) throw new Error("--seed must be an integer");
  const run = growth
    ? runGrowthRecovery({ seed, quick }).then((report) => {
        process.stdout.write(
          formatGrowthStudy(report.summary, {
            seed: report.seed,
            quick: report.quick,
            termDays: report.termDays,
          }),
        );
        return writeGrowth(report);
      })
    : runProductionCalibration({ seed, quick, models }).then((report) => {
        process.stdout.write(formatCalibration(report));
        return writeCalibration(report);
      });
  run
    .then((path) => {
      process.stderr.write(`wrote ${path}\n`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
