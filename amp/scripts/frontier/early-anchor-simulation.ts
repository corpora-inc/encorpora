/**
 * Early placement: what a learner is shown on their first answers, and how
 * fast the shown level still reaches a learner who is far from their age.
 *
 * Each synthetic learner answers 200 problems chosen by the production
 * planner (`planMixedPractice`). Both policies read the same answers through
 * the production estimator (`createFrontierState` / `advanceFrontierState` /
 * `readFrontierState`) and the production display path (`reportFrontier`:
 * the shown level and the reported width for each estimate's own answer
 * count). The planner reads the first policy's frontier; at every answer the
 * harness also asks it with the second's and counts any problem that would
 * differ, so "practice is unchanged" is measured, not assumed.
 *
 * Truth is drawn from external norms, not from AMP's data or its demo school:
 * - `population`: a learner's offset from the age start is drawn from
 *   N(0, sd²), sd the national within-grade spread at that start
 *   (`NORMS_PRIOR_SD`), and each area sits N(0, 0.5²) off that.
 * - fixed offsets −4 … +4 grades, and `uneven` (on level, areas alternately
 *   one grade above and below).
 * - the adult default (a chosen start of grade 7), with the same offsets.
 * Answers come from a misspecified curve on the estimator's scale (60% typed
 * success at an item's true grade): each item's true difficulty is off its
 * catalog grade by N(0, 0.5²), each learner has their own slip in
 * [0.03, 0.15] and guess in [0, 0.25], and the slope is 1.7 (`steep`) or 1.15
 * (`flat`) a grade.
 *
 *   npx tsx scripts/frontier/early-anchor-simulation.ts --seed 1 --reps 2
 *   npx tsx scripts/frontier/early-anchor-simulation.ts --quick
 *
 * Markdown to stdout; JSON to artifacts/early-anchor/ (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { skills } from "../../src/curriculum/catalog";
import {
  advanceFrontierState,
  createFrontierState,
  initialLevel,
  overallPriorSd,
  readFrontierState,
  STRAND_FREEZE,
  type Frontier,
} from "../../src/learning/frontier";
import {
  DEFAULT_FRONTIER_POLICY,
  PREVIOUS_FRONTIER_POLICY,
  type FrontierPolicy,
} from "../../src/learning/frontier-policy";
import { reportFrontier } from "../../src/learning/frontier-report";
import { RANGE_SD_MULTIPLIER } from "../../src/learning/level-check";
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

const EPOCH = Date.parse("2026-10-15T15:00:00Z");
export const CHECKPOINTS = [3, 5, 10, 20, 50, 200] as const;
const ANSWERS = CHECKPOINTS[CHECKPOINTS.length - 1]!;
/** Two minutes an answer, forty a day. */
const ANSWER_MS = 120_000;
const DAY_ANSWERS = 40;
/** How far an area sits from the learner's level in the population draw. */
const AREA_SD = 0.5;
/** The scale's anchor: typed success at an item's own grade, and the floor. */
const AT_LEVEL = 0.6;
const FLOOR = 0.04;

export const POLICIES: Record<string, FrontierPolicy> = {
  v4: PREVIOUS_FRONTIER_POLICY,
  v5: DEFAULT_FRONTIER_POLICY,
};
export const AGES = [
  { id: "grade-1", grade: 1 },
  { id: "grade-2", grade: 2 },
  { id: "grade-4", grade: 4 },
  { id: "grade-6", grade: 6 },
  { id: "grade-8", grade: 8 },
  { id: "adult", grade: null },
] as const;
export type Age = (typeof AGES)[number];
export const PROFILES = [
  "population",
  "-4",
  "-3",
  "-2",
  "-1",
  "0",
  "+1",
  "+2",
  "+3",
  "+4",
  "uneven",
] as const;
export type Profile = (typeof PROFILES)[number];
export const TRUTHS = { steep: 1.7, flat: 1.15 } as const;
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

/** One estimate as shown, with the truth it should show. */
export type Shown = {
  level: number;
  sd: number;
  answered: number;
  truth: number;
  /** The estimator's own level and posterior sd, before display. */
  estimate: number;
  posteriorSd: number;
};
export type Reading = { overall: Shown; areas: Shown[] };
export type EarlyRun = {
  truth: Truth;
  age: string;
  profile: Profile;
  rep: number;
  start: number;
  theta: number;
  /** Shown overall level after each answer, per policy; index 0 = none. */
  path: Record<string, number[]>;
  /** The full shown frontier at each checkpoint, per policy. */
  readings: Record<string, Record<number, Reading>>;
  /** Answers at which the second policy's frontier would have served a
   * different problem. */
  practiceDiffers: number;
};

function shownReading(
  frontier: Frontier,
  theta: number,
  areaTruth: (strand: string) => number,
): Reading {
  const shown = reportFrontier(frontier);
  return {
    overall: {
      level: shown.overall.level,
      sd: shown.overall.sd,
      answered: shown.overall.answered,
      truth: theta,
      estimate: frontier.overall.level,
      posteriorSd: frontier.overall.sd,
    },
    areas: Object.entries(shown.strands).map(([strand, estimate]) => ({
      level: estimate.level,
      sd: estimate.sd,
      answered: estimate.answered,
      truth: areaTruth(strand),
      estimate: frontier.strands[strand]!.level,
      posteriorSd: frontier.strands[strand]!.sd,
    })),
  };
}

/** One learner: `ANSWERS` production problems, read under every policy. */
export function simulateEarly(job: {
  policies: readonly string[];
  truth: Truth;
  age: Age;
  profile: Profile;
  rep: number;
  seed: number;
  itemOffsets: Record<string, number>;
}): EarlyRun {
  const policies = job.policies.map((id) => {
    const policy = POLICIES[id];
    if (!policy) throw new Error(`Unknown policy ${id}`);
    return [id, policy] as const;
  });
  const rng = mulberry32(
    mix([
      job.seed,
      AGES.indexOf(job.age),
      PROFILES.indexOf(job.profile),
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
  const fromAge = job.age.grade !== null;
  const start = fromAge
    ? initialLevel({
        birthYear: birthYearForGrade(job.age.grade!, EPOCH),
        now: EPOCH,
      })
    : initialLevel({ adult: true });
  const spread = overallPriorSd(start, DEFAULT_FRONTIER_POLICY, fromAge);
  const offset =
    job.profile === "population"
      ? gaussian(rng) * spread
      : job.profile === "uneven"
        ? 0
        : Number(job.profile);
  const theta = Math.max(-1, Math.min(13, start + offset));
  const areaOffset = new Map<string, number>();
  strandNames.forEach((strand, index) =>
    areaOffset.set(
      strand,
      job.profile === "uneven"
        ? index % 2
          ? 1
          : -1
        : job.profile === "population"
          ? gaussian(rng) * AREA_SD
          : 0,
    ),
  );
  const areaTruth = (strand: string) =>
    Math.max(-1, Math.min(13, theta + (areaOffset.get(strand) ?? 0)));
  const states = new Map(
    policies.map(([id, policy]) => [
      id,
      createFrontierState(start, policy, fromAge),
    ]),
  );
  const path: Record<string, number[]> = {};
  const readings: Record<string, Record<number, Reading>> = {};
  for (const [id, policy] of policies) {
    path[id] = [
      reportFrontier(readFrontierState(states.get(id)!, EPOCH, policy)).overall
        .level,
    ];
    readings[id] = {};
  }
  const wanted = new Set<number>(CHECKPOINTS);
  const luck = Array.from({ length: ANSWERS }, () => rng());
  const slope = TRUTHS[job.truth];
  const anchor = Math.log((AT_LEVEL - FLOOR) / (1 - slip - AT_LEVEL)) / slope;
  const attempts: Outcome[] = [];
  let practiceDiffers = 0;
  for (let index = 0; index < ANSWERS; index++) {
    const at =
      EPOCH +
      Math.floor(index / DAY_ANSWERS) * 86_400_000 +
      (index % DAY_ANSWERS) * ANSWER_MS;
    const plan = (frontier: Frontier) =>
      planMixedPractice({
        templates: webTemplates,
        skills,
        attempts: attempts.slice(-12),
        evidence: projectSkillEvidence(attempts),
        frontier,
        count: 1,
        seed: `early:${job.age.id}:${job.profile}:${job.rep}:${index}`,
        now: at,
        learnerKey: `early:${job.age.id}:${job.profile}:${job.rep}`,
      })[0];
    const frontiers = policies.map(([id, policy]) =>
      readFrontierState(states.get(id)!, at, policy),
    );
    const choice = plan(frontiers[0]!);
    if (!choice) throw new Error(`No problem at ${index}`);
    for (const other of frontiers.slice(1))
      if (plan(other)?.template.id !== choice.template.id) practiceDiffers += 1;
    const template = choice.template;
    const strand = strandOf.get(template.id) ?? choice.strand;
    const grade = gradeOf.get(template.id)!;
    const itemGuess = Math.max(guess, guessChanceOf(template.id));
    const difficulty = grade + (job.itemOffsets[template.id] ?? 0);
    const latent =
      1 / (1 + Math.exp(-slope * (areaTruth(strand) - difficulty + anchor)));
    const typed = FLOOR + (1 - FLOOR - slip) * latent;
    const correct = luck[index]! < itemGuess + (1 - itemGuess) * typed;
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
    for (const [id, policy] of policies) {
      const state = states.get(id)!;
      advanceFrontierState(
        state,
        { templateId: template.id, correct, assisted: false, createdAt },
        catalog,
        policy,
        STRAND_FREEZE,
      );
      const after = readFrontierState(state, at, policy);
      path[id]!.push(reportFrontier(after).overall.level);
      if (wanted.has(index + 1))
        readings[id]![index + 1] = shownReading(after, theta, areaTruth);
    }
  }
  return {
    truth: job.truth,
    age: job.age.id,
    profile: job.profile,
    rep: job.rep,
    start,
    theta,
    path,
    readings,
    practiceDiffers,
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
  seed: number;
  ages?: readonly Age[];
  profiles?: readonly Profile[];
  truths?: readonly Truth[];
  onRun?: (run: EarlyRun) => void;
}): EarlyRun[] {
  const offsets = itemOffsets(options.seed);
  const runs: EarlyRun[] = [];
  for (const truth of options.truths ?? (Object.keys(TRUTHS) as Truth[]))
    for (const age of options.ages ?? AGES)
      for (const profile of options.profiles ?? PROFILES)
        for (let rep = 0; rep < options.reps; rep++) {
          const run = simulateEarly({
            policies: options.policies,
            truth,
            age,
            profile,
            rep,
            seed: options.seed,
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
const fixed = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "—";
const percent = (value: number) =>
  Number.isFinite(value) ? `${Math.round(value * 100)}%` : "—";

/** First answer count after which the shown level stays within `within`. */
export function settledAt(run: EarlyRun, policy: string, within: number) {
  const path = run.path[policy]!;
  let last = -1;
  path.forEach((level, index) => {
    if (Math.abs(level - run.theta) > within) last = index;
  });
  return last + 1 > ANSWERS ? null : last + 1;
}

const inside = (shown: Shown, k: number) =>
  Math.abs(shown.level - shown.truth) <= k * shown.sd;

export function formatEarly(runs: readonly EarlyRun[]) {
  const policies = Object.keys(runs[0]?.path ?? {});
  const lines: string[] = [];
  const children = runs.filter((run) => run.age !== "adult");
  const adults = runs.filter((run) => run.age === "adult");
  const table = (
    title: string,
    groups: [string, readonly EarlyRun[]][],
    cell: (run: EarlyRun, policy: string, n: number) => number,
    show: (value: number) => string = (value) => fixed(value),
  ) => {
    lines.push(`### ${title}`, "");
    lines.push(
      `| Learners | n | Policy | ${CHECKPOINTS.join(" | ")} |`,
      `|---|---:|---|${CHECKPOINTS.map(() => "---:").join("|")}|`,
    );
    for (const [label, group] of groups)
      for (const policy of policies)
        lines.push(
          `| ${label} | ${group.length} | ${policy} | ${CHECKPOINTS.map((n) =>
            show(mean(group.map((run) => cell(run, policy, n)))),
          ).join(" | ")} |`,
        );
    lines.push("");
  };
  const by = (pool: readonly EarlyRun[], profile: Profile) =>
    pool.filter((run) => run.profile === profile);
  const groups: [string, readonly EarlyRun[]][] = [
    ["Children, drawn from national norms", by(children, "population")],
    ...PROFILES.filter((p) => p !== "population").map(
      (p) =>
        [
          p === "uneven" ? "Children, uneven areas" : `Children, ${p}`,
          by(children, p),
        ] as [string, readonly EarlyRun[]],
    ),
    ["Adults (chosen start), all offsets", adults],
  ];
  const overall = (run: EarlyRun, policy: string, n: number) =>
    run.readings[policy]![n]!.overall;
  table(
    "Shown overall level: mean |shown − true| (grades)",
    groups,
    (run, policy, n) => Math.abs(overall(run, policy, n).level - run.theta),
  );
  table(
    "Shown overall level: mean shown − true (grades)",
    groups,
    (run, policy, n) => overall(run, policy, n).level - run.theta,
  );
  table(
    "Shown overall level a grade or more from the truth (share)",
    groups,
    (run, policy, n) =>
      Math.abs(overall(run, policy, n).level - run.theta) >= 1 ? 1 : 0,
    percent,
  );
  const onLevel = [...by(children, "population"), ...by(children, "0")].filter(
    (run) => Math.abs(run.theta - run.start) < 0.5,
  );
  table(
    "Children truly within half a grade of their age: shown a grade or more above it (share)",
    [["Population draws and on-level", onLevel]],
    (run, policy, n) =>
      overall(run, policy, n).level - run.start >= 1 ? 1 : 0,
    percent,
  );
  const envelope = (
    pool: readonly EarlyRun[],
    pick: (reading: Reading) => Shown[],
    k: number,
  ) =>
    CHECKPOINTS.map((n) =>
      policies.map((policy) => {
        const shown = pool.flatMap((run) => pick(run.readings[policy]![n]!));
        return [
          shown.filter((s) => inside(s, k)).length / shown.length,
          shown.length,
        ];
      }),
    );
  lines.push(
    `### Shown range (±${RANGE_SD_MULTIPLIER} reported sd) covers the truth (target about 90%)`,
    "",
    `| Estimate | Learners | Policy | ${CHECKPOINTS.join(" | ")} |`,
    `|---|---|---|${CHECKPOINTS.map(() => "---:").join("|")}|`,
  );
  for (const [label, pool] of [
    ["Children, norms draws", by(children, "population")],
    ["Children, all profiles", children],
    ["Adults", adults],
  ] as [string, readonly EarlyRun[]][])
    for (const [what, pick] of [
      ["Overall", (r: Reading) => [r.overall]],
      ["Areas (own answer counts)", (r: Reading) => r.areas],
    ] as [string, (r: Reading) => Shown[]][]) {
      const cover = envelope(pool, pick, RANGE_SD_MULTIPLIER);
      policies.forEach((policy, p) =>
        lines.push(
          `| ${what} | ${label} | ${policy} | ${cover
            .map((row) => percent(row[p]![0]!))
            .join(" | ")} |`,
        ),
      );
    }
  lines.push("");
  lines.push(
    "### Far from their age: answers until the shown level stays within 0.75 of the truth",
    "",
    "| Learners | Policy | Median | 75th percentile |",
    "|---|---|---:|---:|",
  );
  for (const profile of ["-4", "-3", "-2", "+2", "+3", "+4"] as Profile[])
    for (const policy of policies) {
      const settled = by(children, profile)
        .map((run) => settledAt(run, policy, 0.75) ?? Infinity)
        .sort((a, b) => a - b);
      const q = (x: number) => {
        const v = settled[Math.floor(x * (settled.length - 1))]!;
        return Number.isFinite(v) ? String(v) : "> 200";
      };
      lines.push(
        `| Children, ${profile} | ${policy} | ${q(0.5)} | ${q(0.75)} |`,
      );
    }
  lines.push("");
  table(
    "Areas: mean |shown − true| (grades)",
    [
      ["Children, norms draws", by(children, "population")],
      ["Children, uneven areas", by(children, "uneven")],
    ],
    (run, policy, n) =>
      mean(
        run.readings[policy]![n]!.areas.map((a) => Math.abs(a.level - a.truth)),
      ),
  );
  const differs = runs.reduce((sum, run) => sum + run.practiceDiffers, 0);
  lines.push(
    `Practice: ${differs} of ${runs.length * ANSWERS} problems would have differed between ${policies.join(" and ")}.`,
    "",
  );
  return lines.join("\n");
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const quick = process.argv.includes("--quick");
  const policies = (argument("--policies") ?? "v5,v4").split(",");
  const reps = Number(argument("--reps") ?? (quick ? 1 : 4));
  const seed = Number(argument("--seed") ?? 1);
  const started = Date.now();
  let done = 0;
  const runs = runEarly({
    policies,
    reps,
    seed,
    onRun: () => {
      done += 1;
      if (done % 25 === 0)
        process.stderr.write(
          `  ${done} learners, ${((Date.now() - started) / 1000).toFixed(0)}s\n`,
        );
    },
  });
  const directory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../artifacts/early-anchor",
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, `early-seed${seed}-reps${reps}.json`),
    JSON.stringify({ seed, reps, policies, runs }),
  );
  process.stdout.write(
    `## Early placement, seed ${seed}, ${reps} reps per cell\n\n${formatEarly(runs)}`,
  );
}
