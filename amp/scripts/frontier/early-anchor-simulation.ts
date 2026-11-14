/**
 * Early placement: how far the shown level moves on the first answers, and
 * how fast it still reaches a learner who is truly ahead or behind.
 *
 * Synthetic learners have a known working grade (overall, and per area for
 * the uneven profile). Problems come from the production planner
 * (`planMixedPractice`); the estimate comes from `createFrontierState` /
 * `advanceFrontierState` / `readFrontierState` under the policy being
 * compared, so selection follows each policy's own frontier, as it would in
 * production. Correctness is sampled; the problem text is not generated.
 *
 *   npx tsx scripts/frontier/early-anchor-simulation.ts            # full
 *   npx tsx scripts/frontier/early-anchor-simulation.ts --quick
 *   npx tsx scripts/frontier/early-anchor-simulation.ts --policies v4,v5
 *
 * Two truth models, so no candidate wins by sharing the estimator's curve.
 * Both draw each item's true difficulty off its catalog grade by N(0, 0.5²)
 * and give each learner their own slip in [0.03, 0.15] and guess in
 * [0, 0.25] (`synthetic-response.ts`). A learner's level means what the
 * estimator's does: 60% typed success on items of that grade.
 * - `steep`: slope 1.7 a grade, the estimator's former overall curve.
 * - `flat`: slope 1.15, fitted to retained production answers
 *   (docs/adaptive-evidence.md).
 *
 * Markdown goes to stdout; JSON to artifacts/early-anchor/ (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { skills } from "../../src/curriculum/catalog";
import {
  advanceFrontierState,
  createFrontierState,
  initialLevel,
  readFrontierState,
  STRAND_FREEZE,
} from "../../src/learning/frontier";
import {
  DEFAULT_FRONTIER_POLICY,
  LEGACY_FRONTIER_POLICY,
  PREVIOUS_FRONTIER_POLICY,
  type FrontierPolicy,
} from "../../src/learning/frontier-policy";
import { MISSPECIFIED_RESPONSE } from "../../src/learning/synthetic-response";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
} from "../../src/math/contracts";
import { templates } from "../../src/math/engine";
import { guessChanceOf } from "../../src/math/guess-chance";
import { projectSkillEvidence } from "../../src/server/evidence";
import {
  planMixedPractice,
  templateGrade,
} from "../../src/server/mixed-practice";
import type { Outcome } from "../../src/server/repository";

export const EARLY_SEED = 20261113;
const EPOCH = Date.parse("2026-11-13T15:00:00Z");
export const EARLY_CHECKPOINTS = [3, 5, 10, 20, 50, 200] as const;
const ANSWERS = EARLY_CHECKPOINTS[EARLY_CHECKPOINTS.length - 1]!;
/** Two minutes an answer, forty a day: a steady learner. */
const ANSWER_MS = 120_000;
const DAY_ANSWERS = 40;

export const POLICIES: Record<string, FrontierPolicy> = {
  legacy: LEGACY_FRONTIER_POLICY,
  v4: PREVIOUS_FRONTIER_POLICY,
  v5: DEFAULT_FRONTIER_POLICY,
};

/** Where the learner truly is, relative to the grade for their age. */
export const PROFILES = {
  "behind-2": { offset: -2, uneven: false },
  "behind-1": { offset: -1, uneven: false },
  "on-level": { offset: 0, uneven: false },
  "ahead-1": { offset: 1, uneven: false },
  "ahead-2": { offset: 2, uneven: false },
  /** On level overall, one grade apart by area: half +1, half −1. */
  uneven: { offset: 0, uneven: true },
} as const;
export type Profile = keyof typeof PROFILES;
/** A grade-for-age start from a birth year, or the unchosen adult start. */
export const AGES = [
  { id: "grade-1", grade: 1 },
  { id: "grade-2", grade: 2 },
  { id: "grade-4", grade: 4 },
  { id: "grade-6", grade: 6 },
  { id: "grade-8", grade: 8 },
  { id: "adult", grade: null },
] as const;
export const TRUTHS = { steep: 1.7, flat: 1.15 } as const;
/** The scale's anchor: typed success at an item's own grade, and the typed
 * floor. Truth and estimator share the ruler, not the curve. */
const AT_LEVEL = 0.6;
const FLOOR = 0.04;
export type Truth = keyof typeof TRUTHS;

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
const catalog = {
  gradeOf: (id: string) => gradeOf.get(id),
  strandOf: (id: string) => strandOf.get(id) ?? id,
  guessOf: guessChanceOf,
};

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

export type EarlyRun = {
  policy: string;
  truth: Truth;
  age: string;
  profile: Profile;
  rep: number;
  start: number;
  /** True overall level. */
  theta: number;
  /** Shown overall level after each answer, index 0 = before any. */
  shown: number[];
  /** Mean absolute area error over the areas answered, at each checkpoint. */
  strandError: Record<number, number>;
};

/** One learner under one policy: `ANSWERS` production problems. */
export function simulateEarly(job: {
  policy: string;
  truth: Truth;
  age: (typeof AGES)[number];
  profile: Profile;
  rep: number;
  seed: number;
  itemOffsets: Record<string, number>;
}): EarlyRun {
  const policy = POLICIES[job.policy];
  if (!policy) throw new Error(`Unknown policy ${job.policy}`);
  const profile = PROFILES[job.profile];
  // The learner is drawn from the seed, never the policy: every policy meets
  // the same person, and the same luck on the same problem.
  const rng = mulberry32(
    mix([
      job.seed,
      AGES.indexOf(job.age),
      Object.keys(PROFILES).indexOf(job.profile),
      job.rep,
      job.truth === "steep" ? 1 : 2,
    ]),
  );
  const slip =
    MISSPECIFIED_RESPONSE.slipMin +
    rng() * (MISSPECIFIED_RESPONSE.slipMax - MISSPECIFIED_RESPONSE.slipMin);
  const guess =
    MISSPECIFIED_RESPONSE.guessMin +
    rng() * (MISSPECIFIED_RESPONSE.guessMax - MISSPECIFIED_RESPONSE.guessMin);
  const strandOffset = new Map<string, number>();
  strandNames.forEach((strand, index) =>
    strandOffset.set(strand, profile.uneven ? (index % 2 ? 1 : -1) : 0),
  );
  const start =
    job.age.grade === null
      ? initialLevel({ adult: true })
      : initialLevel({
          birthYear: birthYearForGrade(job.age.grade, EPOCH),
          now: EPOCH,
        });
  const theta = Math.max(-1, start + profile.offset);
  const state = createFrontierState(start, policy, job.age.grade !== null);
  const attempts: Outcome[] = [];
  const shown = [readFrontierState(state, EPOCH, policy).overall.level];
  const strandError: Record<number, number> = {};
  const wanted = new Set<number>(EARLY_CHECKPOINTS);
  // Per-answer luck is fixed by position, so two policies that ask the same
  // problem at the same point get the same answer.
  const luck = Array.from({ length: ANSWERS }, () => rng());
  const slope = TRUTHS[job.truth];
  for (let index = 0; index < ANSWERS; index++) {
    const at =
      EPOCH +
      Math.floor(index / DAY_ANSWERS) * 86_400_000 +
      (index % DAY_ANSWERS) * ANSWER_MS;
    const frontier = readFrontierState(state, at, policy);
    const [choice] = planMixedPractice({
      templates: webTemplates,
      skills,
      attempts: attempts.slice(-12),
      evidence: projectSkillEvidence(attempts),
      frontier,
      count: 1,
      seed: `early:${job.age.id}:${job.profile}:${job.rep}:${index}`,
      now: at,
      learnerKey: `early:${job.age.id}:${job.profile}:${job.rep}`,
    });
    if (!choice) throw new Error(`No problem at ${index}`);
    const template = choice.template;
    const strand = strandOf.get(template.id) ?? choice.strand;
    const grade = gradeOf.get(template.id)!;
    const truth = theta + (strandOffset.get(strand) ?? 0);
    const itemGuess = Math.max(guess, guessChanceOf(template.id));
    const difficulty = grade + (job.itemOffsets[template.id] ?? 0);
    // On the estimator's scale: a learner at an item's true grade answers it
    // typed 60% of the time, whatever their own slip.
    const anchor = Math.log((AT_LEVEL - FLOOR) / (1 - slip - AT_LEVEL)) / slope;
    const latent = 1 / (1 + Math.exp(-slope * (truth - difficulty + anchor)));
    const typed = FLOOR + (1 - FLOOR - slip) * latent;
    const probability = itemGuess + (1 - itemGuess) * typed;
    const correct = luck[index]! < probability;
    const createdAt = new Date(at).toISOString();
    attempts.push({
      id: `a${index}`,
      problemId: `p${index}`,
      requestId: `r${index}`,
      skillId: template.skillId,
      templateId: template.id,
      response: "",
      correct,
      assisted: false,
      explanation: [],
      answer: "",
      createdAt,
    });
    advanceFrontierState(
      state,
      { templateId: template.id, correct, assisted: false, createdAt },
      catalog,
      policy,
      STRAND_FREEZE,
    );
    const after = readFrontierState(state, at, policy);
    shown.push(after.overall.level);
    if (wanted.has(index + 1)) {
      const errors = Object.entries(after.strands).map(([name, estimate]) =>
        Math.abs(estimate.level - (theta + (strandOffset.get(name) ?? 0))),
      );
      strandError[index + 1] =
        errors.reduce((sum, value) => sum + value, 0) /
        Math.max(1, errors.length);
    }
  }
  return {
    policy: job.policy,
    truth: job.truth,
    age: job.age.id,
    profile: job.profile,
    rep: job.rep,
    start,
    theta,
    shown,
    strandError,
  };
}

function itemOffsets(seed: number) {
  const rng = mulberry32(mix([seed, 0x5a17]));
  const offsets: Record<string, number> = {};
  for (const template of webTemplates)
    offsets[template.id] = gaussian(rng) * MISSPECIFIED_RESPONSE.itemSd;
  return offsets;
}

export function runEarly(options: {
  policies: readonly string[];
  reps: number;
  seed?: number;
  ages?: readonly (typeof AGES)[number][];
  profiles?: readonly Profile[];
  truths?: readonly Truth[];
  onRun?: (run: EarlyRun) => void;
}): EarlyRun[] {
  const seed = options.seed ?? EARLY_SEED;
  const offsets = itemOffsets(seed);
  const runs: EarlyRun[] = [];
  for (const truth of options.truths ?? (Object.keys(TRUTHS) as Truth[]))
    for (const age of options.ages ?? AGES)
      for (const profile of options.profiles ??
        (Object.keys(PROFILES) as Profile[]))
        for (let rep = 0; rep < options.reps; rep++)
          for (const policy of options.policies) {
            const run = simulateEarly({
              policy,
              truth,
              age,
              profile,
              rep,
              seed,
              itemOffsets: offsets,
            });
            runs.push(run);
            options.onRun?.(run);
          }
  return runs;
}

const mean = (values: readonly number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : NaN;

/** First answer count after which the shown level stays within `within`. */
export function settledAt(run: EarlyRun, within = 0.5): number | null {
  let last = -1;
  run.shown.forEach((level, index) => {
    if (Math.abs(level - run.theta) > within) last = index;
  });
  return last + 1 > ANSWERS ? null : last + 1;
}

export type EarlySummary = {
  policy: string;
  profile: string;
  n: number;
  /** Mean signed error (shown − true) at each checkpoint. */
  bias: Record<number, number>;
  mae: Record<number, number>;
  /** Share of learners shown a grade or more away from the truth. */
  offByOne: Record<number, number>;
  strandMae: Record<number, number>;
  /** Median answers until the shown level stays within half a grade. */
  settledMedian: number | null;
  /** Mean of |change| in the shown level per answer over answers 1–20. */
  jitter: number;
  /** Mean of the largest |shown − start| over answers 1–5. */
  earlySwing: number;
};

export function summarize(
  runs: readonly EarlyRun[],
  key: (run: EarlyRun) => string,
): EarlySummary[] {
  const groups = new Map<string, EarlyRun[]>();
  for (const run of runs) {
    const id = `${run.policy}|${key(run)}`;
    groups.set(id, [...(groups.get(id) ?? []), run]);
  }
  return [...groups].map(([id, group]) => {
    const [policy, profile] = id.split("|") as [string, string];
    const at = (answers: number, f: (run: EarlyRun) => number) =>
      mean(group.map(f));
    const record = (f: (run: EarlyRun, answers: number) => number) =>
      Object.fromEntries(
        EARLY_CHECKPOINTS.map((answers) => [
          answers,
          at(answers, (run) => f(run, answers)),
        ]),
      );
    const settled = group
      .map((run) => settledAt(run) ?? Infinity)
      .sort((a, b) => a - b);
    const middle = settled[Math.floor(settled.length / 2)]!;
    return {
      policy,
      profile,
      n: group.length,
      bias: record((run, n) => run.shown[n]! - run.theta),
      mae: record((run, n) => Math.abs(run.shown[n]! - run.theta)),
      offByOne: record((run, n) =>
        Math.abs(run.shown[n]! - run.theta) >= 1 ? 1 : 0,
      ),
      strandMae: record((run, n) => run.strandError[n] ?? NaN),
      settledMedian: Number.isFinite(middle) ? middle : null,
      jitter: mean(
        group.map((run) =>
          mean(
            run.shown
              .slice(1, 21)
              .map((level, index) => Math.abs(level - run.shown[index]!)),
          ),
        ),
      ),
      earlySwing: mean(
        group.map((run) =>
          Math.max(
            ...run.shown
              .slice(1, 6)
              .map((level) => Math.abs(level - run.start)),
          ),
        ),
      ),
    };
  });
}

const fixed = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "—";

export function formatEarly(runs: readonly EarlyRun[]) {
  const lines: string[] = [];
  const policies = [...new Set(runs.map((run) => run.policy))];
  const table = (
    title: string,
    rows: EarlySummary[],
    cell: (row: EarlySummary, n: number) => string,
  ) => {
    lines.push(`### ${title}`, "");
    lines.push(
      `| Profile | Policy | ${EARLY_CHECKPOINTS.join(" | ")} |`,
      `|---|---|${EARLY_CHECKPOINTS.map(() => "---:").join("|")}|`,
    );
    const profiles = [...new Set(rows.map((row) => row.profile))];
    for (const profile of profiles)
      for (const policy of policies) {
        const row = rows.find(
          (r) => r.profile === profile && r.policy === policy,
        );
        if (!row) continue;
        lines.push(
          `| ${profile} | ${policy} | ${EARLY_CHECKPOINTS.map((n) => cell(row, n)).join(" | ")} |`,
        );
      }
    lines.push("");
  };
  const byProfile = summarize(runs, (run) => run.profile);
  const all = summarize(runs, () => "all");
  table("Shown − true, mean (grades)", byProfile, (row, n) =>
    fixed(row.bias[n]!),
  );
  table("|Shown − true|, mean (grades)", [...byProfile, ...all], (row, n) =>
    fixed(row.mae[n]!),
  );
  table(
    "Shown a grade or more from the truth (share)",
    [...byProfile, ...all],
    (row, n) => fixed(row.offByOne[n]!),
  );
  table(
    "Area |estimate − true|, mean (grades)",
    [...byProfile, ...all],
    (row, n) => fixed(row.strandMae[n]!),
  );
  lines.push("### Settling and stability", "");
  lines.push(
    "| Profile | Policy | Median answers to stay within ½ grade | Mean step, answers 1–20 | Largest move from start, answers 1–5 |",
    "|---|---|---:|---:|---:|",
  );
  for (const row of [...byProfile, ...all].sort((a, b) =>
    a.profile === b.profile ? 0 : a.profile < b.profile ? -1 : 1,
  ))
    lines.push(
      `| ${row.profile} | ${row.policy} | ${row.settledMedian ?? "> 200"} | ${fixed(row.jitter, 3)} | ${fixed(row.earlySwing)} |`,
    );
  lines.push("");
  lines.push(
    "### By age, all profiles: |shown − true| at 3, 10 and 50 answers",
    "",
  );
  lines.push("| Age | Policy | 3 | 10 | 50 |", "|---|---|---:|---:|---:|");
  for (const row of summarize(runs, (run) => run.age))
    lines.push(
      `| ${row.profile} | ${row.policy} | ${fixed(row.mae[3]!)} | ${fixed(row.mae[10]!)} | ${fixed(row.mae[50]!)} |`,
    );
  lines.push("");
  return lines.join("\n");
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const quick = process.argv.includes("--quick");
  const policies = (argument("--policies") ?? "v4,v5").split(",");
  const reps = Number(argument("--reps") ?? (quick ? 2 : 6));
  const seed = Number(argument("--seed") ?? EARLY_SEED);
  const started = Date.now();
  let done = 0;
  const runs = runEarly({
    policies,
    reps,
    seed,
    onRun: () => {
      done += 1;
      if (done % 20 === 0)
        process.stderr.write(
          `  ${done} runs, ${((Date.now() - started) / 1000).toFixed(0)}s\n`,
        );
    },
  });
  const directory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../artifacts/early-anchor",
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, `early-${quick ? "quick" : "full"}-${seed}.json`),
    JSON.stringify({ seed, reps, policies, runs }),
  );
  process.stdout.write(
    `## Early placement, seed ${seed}, ${reps} reps per cell\n\n${formatEarly(runs)}`,
  );
}
