/**
 * How honest the level's likely range is over a learner's first answers.
 *
 * Synthetic learners of known working grade answer problems the production
 * planner (`planMixedPractice`) chooses, and the production estimator
 * (`newLearnerFrontier` / `advanceLearnerFrontier` / `readLearnerFrontier`)
 * reads their level after every answer. Two populations:
 *
 * - children: a birth year puts the start at grades 1–10, and the true
 *   working grade is that grade plus −2…+3 (the production-calibration grid);
 * - adults: no birth year, the unchosen start (middle school), and a true
 *   working grade spread evenly from kindergarten to precalculus.
 *
 * Answers come from the misspecified learner (`synthetic-response.ts`): item
 * difficulty off its catalog grade, the learner's own slip and guessing, and
 * on a multiple-choice item the item's own chance of a lucky pick.
 *
 * For the range a person is shown, it measures coverage (the share of
 * learners whose true level lies inside it, an open end counting as open),
 * its width, how many answers it takes to narrow to about one grade, and the
 * best guess's bias. `before` is the shipped range through sd-cal-v1
 * (level ± 1.64 reported sd, 90% nominal, every learner's prior 2.5 grades);
 * `after` is the reported likely range (`reportedRange`).
 *
 *   npx tsx scripts/frontier/level-interval-study.ts
 *   npx tsx scripts/frontier/level-interval-study.ts --quick
 *   npx tsx scripts/frontier/level-interval-study.ts --json readings.json
 */
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { skills } from "../../src/curriculum/catalog";
import {
  advanceFrontierState,
  createFrontierState,
  initialLevel,
  LIKELY_MASS,
  MAX_GRADE,
  readFrontierState,
  startingSd,
  STRAND_FREEZE,
  type Frontier,
} from "../../src/learning/frontier";
import { DEFAULT_FRONTIER_POLICY } from "../../src/learning/frontier-policy";
import { reportEstimate } from "../../src/learning/frontier-report";
import { shownRange } from "../../src/learning/level-check";
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
  frontierCatalog,
  newLearnerFrontier,
  readLearnerFrontier,
} from "../../src/server/learner-frontier";
import {
  planMixedPractice,
  templateGrade,
} from "../../src/server/mixed-practice";
import type { Outcome } from "../../src/server/repository";

export const STUDY_SEED = 20261115;
export const STUDY_CHECKPOINTS = [1, 2, 3, 5, 10, 20, 30, 50, 100] as const;
const ANSWERS = STUDY_CHECKPOINTS.at(-1)!;
const EPOCH = Date.parse("2026-10-19T12:00:00Z");
/** The shipped range: level ± this × reported sd. */
const BEFORE_Z = 1.64;
const BEFORE_PRIOR_SD = 2.5;
/** "About one grade": the first answer after which the shown range is at
 * most this wide. */
export const NARROW_WIDTH = 1;
/** The top of what the curriculum can measure. A range that reaches it is
 * open: no answer can bound a level above precalculus. */
const TOP = MAX_GRADE;
const BOTTOM = 0;

export type Population = "children" | "adults";
/** before: the shipped range. raw: the reported range's numbers. after:
 * the reported range as a person reads it, in whole grades. */
export type Variant = "before" | "raw" | "after";
type Job = {
  id: string;
  population: Population;
  start: number;
  birthYear: number | null;
  truth: number;
  seed: number;
  itemOffsets: Record<string, number>;
  /** The reported level's prior width; default `startingSd`. */
  startSd?: number;
  answers: number;
};
type Reading = {
  answered: number;
  level: number;
  low: number;
  high: number;
};
export type StudyLearner = {
  id: string;
  population: Population;
  truth: number;
  readings: Record<"before" | "after", Reading[]>;
  /** Every answer's planned problem was the same for both variants. */
  sameSelection: boolean;
};

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const webTemplates = templates.filter((template) =>
  clientCanDraw(template, {
    responseCapabilities: [...responseCapabilities],
    figureCapabilities: [...figureCapabilities],
  }),
);
const gradeOf = new Map(
  webTemplates.map((template) => [template.id, templateGrade(template, nodes)]),
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
function birthYearForGrade(grade: number) {
  const date = new Date(EPOCH);
  const schoolYear = date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
  return schoolYear - grade - 6;
}

/** sd-cal-v1 as shipped: 0.20 + factor × posterior sd. */
const V1_FACTORS = [
  [20, 0.76],
  [50, 0.83],
  [100, 0.94],
  [300, 0.9],
] as const;
function v1Factor(answered: number) {
  if (answered <= 20) return 0.76;
  for (let index = 1; index < V1_FACTORS.length; index++) {
    const [leftN, leftK] = V1_FACTORS[index - 1]!;
    const [rightN, rightK] = V1_FACTORS[index]!;
    if (answered <= rightN)
      return (
        leftK +
        ((rightK - leftK) * Math.log(answered / leftN)) /
          Math.log(rightN / leftN)
      );
  }
  return 0.9;
}
/** The range as shipped before: level ± 1.64 × sd-cal-v1's reported sd. */
function beforeRange(level: number, sd: number, answered: number) {
  const half = BEFORE_Z * (0.2 + v1Factor(answered) * sd);
  return {
    low: Math.max(0, level - half),
    high: Math.min(13, level + half),
  };
}

/** One learner through `job.answers` problems, read after every answer by the
 * shipped estimator and by the new one. Selection reads only the adaptive
 * estimate, so both see the same problems; `sameSelection` checks it. */
export function simulateStudyLearner(job: Job): StudyLearner {
  const rng = mulberry32(
    mix([job.seed, ...[...job.id].map((c) => c.charCodeAt(0))]),
  );
  const slip =
    MISSPECIFIED_RESPONSE.slipMin +
    rng() * (MISSPECIFIED_RESPONSE.slipMax - MISSPECIFIED_RESPONSE.slipMin);
  const learnerGuess =
    MISSPECIFIED_RESPONSE.guessMin +
    rng() * (MISSPECIFIED_RESPONSE.guessMax - MISSPECIFIED_RESPONSE.guessMin);
  const strandOffset = new Map<string, number>();
  const adult = job.population === "adults";
  const after = newLearnerFrontier({
    epoch: 0,
    start: job.start,
    startSd: job.startSd ?? startingSd({ birthYear: job.birthYear, adult }),
    strandStarts: {},
  });
  const before = createFrontierState(
    job.start,
    DEFAULT_FRONTIER_POLICY,
    BEFORE_PRIOR_SD,
  );
  const attempts: Outcome[] = [];
  const readings: StudyLearner["readings"] = { before: [], after: [] };
  let sameSelection = true;
  for (let index = 0; index < job.answers; index++) {
    const at = EPOCH + index * 30_000;
    const plan = (frontier: Frontier) =>
      planMixedPractice({
        templates: webTemplates,
        skills,
        attempts: attempts.slice(-12),
        evidence: projectSkillEvidence(attempts),
        frontier,
        count: 1,
        seed: `level-study:${job.id}:${index}`,
        now: at,
        learnerKey: `level-study:${job.id}`,
      })[0];
    const choice = plan(readLearnerFrontier(after, at));
    if (!choice) throw new Error(`No problem for ${job.id} at ${index}`);
    // Checking every answer doubles the planner's work; the first few are
    // where a wider prior could matter.
    if (
      index < 5 &&
      plan(readFrontierState(before, at, DEFAULT_FRONTIER_POLICY))?.template
        .id !== choice.template.id
    )
      sameSelection = false;
    const template = choice.template;
    const grade = gradeOf.get(template.id);
    if (grade === undefined) throw new Error(`No grade for ${template.id}`);
    const strand = nodes.get(template.skillId)?.strand ?? template.skillId;
    if (!strandOffset.has(strand))
      strandOffset.set(strand, (rng() - 0.5) * 1.2);
    const itemGuess = guessChanceOf(template.id);
    const probability = misspecifiedSuccessProbability({
      theta: job.truth + strandOffset.get(strand)!,
      catalogGrade: grade,
      itemOffset: job.itemOffsets[template.id] ?? 0,
      slip,
      // A lucky pick among the item's choices, or the learner's own guess.
      guess: 1 - (1 - itemGuess) * (1 - learnerGuess),
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
    const observation = {
      templateId: template.id,
      correct,
      assisted: false,
      createdAt,
      practiceRevision: 0,
      sequence: String(index + 1),
    };
    advanceLearnerFrontier(after, [observation]);
    advanceFrontierState(
      before,
      observation,
      frontierCatalog,
      DEFAULT_FRONTIER_POLICY,
      STRAND_FREEZE,
    );
    const answered = index + 1;
    const now = readLearnerFrontier(after, at).overall;
    const shown = reportEstimate(now);
    readings.after.push({
      answered,
      level: shown.level,
      low: shown.low!,
      high: shown.high!,
    });
    const old = readFrontierState(before, at, DEFAULT_FRONTIER_POLICY).overall;
    readings.before.push({
      answered,
      level: old.level,
      ...beforeRange(old.level, old.sd, answered),
    });
  }
  return {
    id: job.id,
    population: job.population,
    truth: job.truth,
    readings,
    sameSelection,
  };
}

function itemOffsets(seed: number) {
  const rng = mulberry32(mix([seed, 0x5a17]));
  const offsets: Record<string, number> = {};
  for (const template of webTemplates)
    offsets[template.id] = gaussian(rng) * MISSPECIFIED_RESPONSE.itemSd;
  return offsets;
}

export function studyJobs(options: {
  seed: number;
  quick: boolean;
  adultSd?: number;
  answers?: number;
}): Job[] {
  const answers = options.answers ?? ANSWERS;
  const shared = itemOffsets(options.seed);
  const jobs: Job[] = [];
  const reps = options.quick ? [0] : [0, 1];
  for (const rep of reps) {
    for (let grade = 1; grade <= 10; grade++)
      for (const offset of [-2, -1, 0, 1, 2, 3]) {
        const birthYear = birthYearForGrade(grade);
        const start = initialLevel({ birthYear, now: EPOCH });
        if (start !== grade)
          throw new Error(`Birth year ${birthYear} started at ${start}`);
        jobs.push({
          id: `child:g${grade}:o${offset}:r${rep}`,
          population: "children",
          start,
          birthYear,
          truth: Math.max(0, grade + offset),
          seed: options.seed,
          itemOffsets: shared,
          answers,
        });
      }
    // Kindergarten to precalculus in quarter grades.
    for (let quarter = 0; quarter <= 50; quarter++) {
      const truth = quarter / 4;
      jobs.push({
        id: `adult:t${truth}:r${rep}`,
        population: "adults",
        start: initialLevel({ adult: true }),
        birthYear: null,
        truth,
        seed: options.seed,
        itemOffsets: shared,
        startSd: options.adultSd,
        answers,
      });
    }
  }
  return jobs;
}

/** The range as a person reads it. Before: the numbers, drawn as they are.
 * After: whole grades (`shownRange`), an end at the scale's edge open. */
export function shown(variant: Variant, reading: Reading) {
  if (variant !== "after") return { low: reading.low, high: reading.high };
  const range = shownRange({ ...reading, sd: 0 });
  return {
    low: range.openLow ? -Infinity : range.from - 0.5,
    high: range.openHigh ? Infinity : range.to + 0.5,
  };
}
export function covers(variant: Variant, reading: Reading, truth: number) {
  const { low, high } = shown(variant, reading);
  return truth >= low && truth <= high;
}
/** The width a person sees, on the curriculum's scale. */
function shownWidth(variant: Variant, reading: Reading) {
  const { low, high } = shown(variant, reading);
  return Math.min(TOP + 0.5, high) - Math.max(BOTTOM - 0.5, low);
}

export type StudyRow = {
  population: Population;
  variant: Variant;
  answered: number;
  n: number;
  coverage: number;
  width: number;
  bias: number;
  mae: number;
};
export type NarrowRow = {
  population: Population;
  variant: Variant;
  /** Median answers until the range is at most `NARROW_WIDTH` wide; null
   * when fewer than half the learners get there within the study. */
  median: number | null;
  reached: number;
  n: number;
};
export type StudyBand = {
  population: Population;
  variant: Variant;
  answered: number;
  /** True level band: "K–3", "4–8", "9–12". */
  band: string;
  n: number;
  coverage: number;
  bias: number;
};
export type StudyReport = {
  seed: number;
  quick: boolean;
  /** Answers per learner, and the checkpoints read within them. */
  answers: number;
  checkpoints: number[];
  nominal: Record<Variant, number>;
  learners: number;
  sameSelection: boolean;
  rows: StudyRow[];
  narrow: NarrowRow[];
  bands: StudyBand[];
};

const readingsOf = (learner: StudyLearner, variant: Variant) =>
  learner.readings[variant === "before" ? "before" : "after"];
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)]! : NaN;
};
const bandOf = (truth: number) =>
  truth < 3.5 ? "K–3" : truth < 8.5 ? "4–8" : "9–12";

export function summarizeStudy(
  learners: readonly StudyLearner[],
  options: { seed: number; quick: boolean },
): StudyReport {
  const answers = Math.min(...learners.map((l) => l.readings.after.length));
  const checkpoints = STUDY_CHECKPOINTS.filter((n) => n <= answers);
  const rows: StudyRow[] = [];
  const narrow: NarrowRow[] = [];
  const bands: StudyBand[] = [];
  for (const population of ["children", "adults"] as const)
    for (const variant of ["before", "raw", "after"] as const) {
      const group = learners.filter((l) => l.population === population);
      for (const answered of checkpoints) {
        const at = group.map((l) => ({
          truth: l.truth,
          reading: readingsOf(l, variant)[answered - 1]!,
        }));
        const n = at.length;
        const errors = at.map(({ truth, reading }) => reading.level - truth);
        rows.push({
          population,
          variant,
          answered,
          n,
          coverage:
            at.filter(({ truth, reading }) => covers(variant, reading, truth))
              .length / n,
          width: median(at.map(({ reading }) => shownWidth(variant, reading))),
          bias: errors.reduce((s, e) => s + e, 0) / n,
          mae: errors.reduce((s, e) => s + Math.abs(e), 0) / n,
        });
        for (const band of ["K–3", "4–8", "9–12"]) {
          const inBand = at.filter(({ truth }) => bandOf(truth) === band);
          if (!inBand.length) continue;
          bands.push({
            population,
            variant,
            answered,
            band,
            n: inBand.length,
            coverage:
              inBand.filter(({ truth, reading }) =>
                covers(variant, reading, truth),
              ).length / inBand.length,
            bias:
              inBand.reduce(
                (s, { truth, reading }) => s + reading.level - truth,
                0,
              ) / inBand.length,
          });
        }
      }
      const firsts = group.map(
        (l) =>
          readingsOf(l, variant).find(
            (r) => shownWidth(variant, r) <= NARROW_WIDTH,
          )?.answered ?? Infinity,
      );
      const reached = firsts.filter(Number.isFinite).length;
      const mid = median(firsts);
      narrow.push({
        population,
        variant,
        median: Number.isFinite(mid) ? mid : null,
        reached,
        n: group.length,
      });
    }
  return {
    seed: options.seed,
    quick: options.quick,
    nominal: { before: 0.9, raw: LIKELY_MASS, after: LIKELY_MASS },
    answers,
    checkpoints,
    learners: learners.length,
    sameSelection: learners.every((l) => l.sameSelection),
    rows,
    narrow,
    bands,
  };
}

type WorkerRequest = { kind: "run"; job: Job };
type WorkerResponse =
  | { ok: true; learner: StudyLearner }
  | { ok: false; id: string; error: string };

async function runJobs(jobs: readonly Job[], concurrency: number) {
  const workers = Math.max(1, Math.min(concurrency, jobs.length));
  if (workers === 1) return jobs.map((job) => simulateStudyLearner(job));
  const execArgv = process.execArgv.filter(
    (arg) => arg !== "--test" && !arg.startsWith("--test-"),
  );
  const pool = Array.from(
    { length: workers },
    () => new Worker(new URL(import.meta.url), { execArgv }),
  );
  const learners: StudyLearner[] = [];
  let cursor = 0;
  try {
    await Promise.all(
      pool.map(async (worker) => {
        for (;;) {
          const job = jobs[cursor++];
          if (!job) return;
          const response = await new Promise<WorkerResponse>(
            (resolve, reject) => {
              worker.once("error", reject);
              worker.once("message", (message: WorkerResponse) => {
                worker.off("error", reject);
                resolve(message);
              });
              worker.postMessage({ kind: "run", job } satisfies WorkerRequest);
            },
          );
          if (!response.ok)
            throw new Error(`${response.id}: ${response.error}`);
          learners.push(response.learner);
        }
      }),
    );
  } finally {
    await Promise.all(pool.map((worker) => worker.terminate()));
  }
  return learners.sort((a, b) => a.id.localeCompare(b.id));
}

export async function runLevelIntervalStudy(
  options: {
    seed?: number;
    quick?: boolean;
    concurrency?: number;
    adultSd?: number;
    answers?: number;
    /** Every `sample`th learner of the grid. */
    sample?: number;
    /** Where to write every learner's readings, for a fit. */
    json?: string;
  } = {},
): Promise<StudyReport> {
  const seed = options.seed ?? STUDY_SEED;
  const quick = options.quick ?? false;
  const jobs = studyJobs({
    seed,
    quick,
    adultSd: options.adultSd,
    answers: options.answers,
  }).filter((_, index) => index % (options.sample ?? 1) === 0);
  const learners = await runJobs(
    jobs,
    options.concurrency ?? Math.max(1, Math.min(8, availableParallelism() - 1)),
  );
  if (options.json) writeFileSync(options.json, JSON.stringify(learners));
  return summarizeStudy(learners, { seed, quick });
}

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const signed = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
export function formatStudy(report: StudyReport) {
  const variants = ["before", "raw", "after"] as const;
  const row = (population: Population, variant: Variant, answered: number) =>
    report.rows.find(
      (r) =>
        r.population === population &&
        r.variant === variant &&
        r.answered === answered,
    )!;
  const lines = [
    `Level range study, seed ${report.seed}${report.quick ? " (quick)" : ""}: ${report.learners} learners, misspecified answers. Nominal coverage: before ${pct(report.nominal.before)}, after ${pct(report.nominal.after)}. Same problems both ways: ${report.sameSelection ? "yes" : "NO"}.`,
    "",
    "before: level ± 1.64 × sd-cal-v1 sd. raw: the reported range's numbers. after: that range in whole grades, as shown.",
    "",
    "| population | answers | coverage before / raw / after | width before / raw / after | bias before / after | MAE before / after |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  for (const population of ["children", "adults"] as const)
    for (const answered of report.checkpoints) {
      const r = variants.map((v) => row(population, v, answered));
      lines.push(
        `| ${population} | ${answered} | ${r.map((x) => pct(x.coverage)).join(" / ")} | ${r.map((x) => x.width.toFixed(2)).join(" / ")} | ${signed(r[0]!.bias)} / ${signed(r[2]!.bias)} | ${r[0]!.mae.toFixed(2)} / ${r[2]!.mae.toFixed(2)} |`,
      );
    }
  lines.push(
    "",
    `Answers until the range is at most ${NARROW_WIDTH} grade wide (median, learners reaching it within ${report.answers}):`,
    "",
    "| population | before | raw | after |",
    "|---|---:|---:|---:|",
  );
  for (const population of ["children", "adults"] as const) {
    const cell = (variant: Variant) => {
      const narrow = report.narrow.find(
        (r) => r.population === population && r.variant === variant,
      )!;
      return `${narrow.median ?? `>${report.answers}`} (${narrow.reached}/${narrow.n})`;
    };
    lines.push(
      `| ${population} | ${variants.map((v) => cell(v)).join(" | ")} |`,
    );
  }
  lines.push(
    "",
    "By true level (coverage before / after, bias before / after):",
    "",
    "| population | answers | true level | n | coverage | bias |",
    "|---|---:|---|---:|---:|---:|",
  );
  for (const population of ["children", "adults"] as const)
    for (const answered of new Set(
      [1, 5, 20, report.answers].filter((n) => n <= report.answers),
    ))
      for (const band of ["K–3", "4–8", "9–12"]) {
        const at = (variant: Variant) =>
          report.bands.find(
            (r) =>
              r.population === population &&
              r.variant === variant &&
              r.answered === answered &&
              r.band === band,
          );
        const b = at("before"),
          a = at("after");
        if (!a || !b) continue;
        lines.push(
          `| ${population} | ${answered} | ${band} | ${a.n} | ${pct(b.coverage)} / ${pct(a.coverage)} | ${signed(b.bias)} / ${signed(a.bias)} |`,
        );
      }
  return lines.join("\n");
}

if (!isMainThread && parentPort) {
  const port = parentPort;
  port.on("message", (request: WorkerRequest) => {
    try {
      port.postMessage({
        ok: true,
        learner: simulateStudyLearner(request.job),
      } satisfies WorkerResponse);
    } catch (error) {
      port.postMessage({
        ok: false,
        id: request.job.id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies WorkerResponse);
    }
  });
} else if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const quick = process.argv.includes("--quick");
  const at = process.argv.indexOf("--adult-sd");
  const adultSd = at > 0 ? Number(process.argv[at + 1]) : undefined;
  const jsonAt = process.argv.indexOf("--json");
  const json = jsonAt > 0 ? process.argv[jsonAt + 1] : undefined;
  const started = Date.now();
  const report = await runLevelIntervalStudy({ quick, adultSd, json });
  process.stdout.write(`${formatStudy(report)}\n`);
  process.stderr.write(
    `${report.learners} learners in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
  );
}
