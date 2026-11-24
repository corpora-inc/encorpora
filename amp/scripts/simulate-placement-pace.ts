/* How fast a new learner's level and offered problems move in the first
   answers. Runs the real planner and estimator over simulated learners
   (tests/placement-pace.fixture.ts) and prints Markdown.

     npx tsx scripts/simulate-placement-pace.ts [--engine before] [--seeds 20] [--count 60]
     npx tsx scripts/simulate-placement-pace.ts --trace [--count 60]
     npx tsx scripts/simulate-placement-pace.ts --trace --type "always right" --expected 3

   Synthetic regression scenarios, not evidence about real learners. */
import {
  answersToShow,
  answersToWork,
  errorAt,
  gradeCatalog,
  gradeCoverage,
  highestOffered,
  paceEngines,
  paceLearners,
  shareFarAbove,
  simulatePace,
  workingLevel,
  type PaceRun,
} from "../tests/placement-pace.fixture";

const flag = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : (process.argv[at + 1] ?? "");
};
const seeds = Number(flag("seeds") ?? 20);
const count = Number(flag("count") ?? 60);
const tracing = process.argv.includes("--trace");
const engineName = flag("engine") === "before" ? "before" : "after";
const engine = paceEngines[engineName];
const onlyType = flag("type");
const onlyExpected = flag("expected");

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
};
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const fixed = (value: number, digits = 1) => value.toFixed(digits);
const never = (values: (number | null)[]) =>
  values.map((value) => value ?? Infinity);
const show = (value: number) =>
  Number.isFinite(value) ? String(value) : `>${count}`;
const gradeWord = (grade: number) =>
  grade === 0 ? "K" : grade === 9 ? "9 (Alg 1)" : String(grade);

const learners = paceLearners().filter(
  (learner) =>
    (!onlyType || learner.type === onlyType) &&
    (!onlyExpected || learner.expected === Number(onlyExpected)),
);

function trace(run: PaceRun) {
  const { learner } = run;
  console.log(
    `\n### ${learner.type}, expected grade ${gradeWord(learner.expected)}, true level ${learner.level}\n`,
  );
  console.log(
    "| # | Item grade | Area | Skill | Kind | Answer | Level shown | Likely range | Strand estimate ± width before | Ceiling before |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  run.steps.forEach((step, i) =>
    console.log(
      `| ${i + 1} | ${fixed(step.grade)} | ${step.area} | ${step.skillId} | ${
        step.opener ? "opener" : (step.purpose ?? step.reason)
      } | ${step.correct ? "right" : "wrong"} | ${fixed(step.shown, 2)} | ${fixed(step.low)}–${fixed(step.high)} | ${fixed(step.strandLevel, 2)} ± ${fixed(step.strandSd, 2)} | ${step.ceiling ?? "-"} |`,
    ),
  );
}

if (tracing) {
  for (const learner of learners)
    trace(simulatePace(learner, { ...engine, seed: "trace", count }));
} else {
  console.log(
    `Engine: ${engineName} (${engine.frontierPolicy.version}, ${engine.practicePolicy.version}). ${seeds} seeds, ${count} answers each. Medians unless marked; "worst" is the slowest seed.\n`,
  );
  console.log(
    `| Expected | Learner | True level | Answers until work is within one grade (median / worst) | Answers until the level shown is within one grade (median / worst) | Highest grade offered in first 5 | 10 | 20 | 40 | Share of first 20 more than two grades above expected | Error of level shown at 20 | 40 | ${count} | Own-grade skills met by 40 (of catalog) | Areas | Right at least once |`,
  );
  console.log(
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const learner of learners) {
    const runs = Array.from({ length: seeds }, (_, i) =>
      simulatePace(learner, { ...engine, seed: String(i), count }),
    );
    const toWork = never(runs.map((run) => answersToWork(run)));
    const toShow = never(runs.map((run) => answersToShow(run)));
    const top = (first: number) =>
      fixed(median(runs.map((run) => highestOffered(run, first))));
    const coverage = runs.map((run) => gradeCoverage(run, 40));
    const catalog = gradeCatalog(learner.expected);
    console.log(
      `| ${gradeWord(learner.expected)} | ${learner.type} | ${learner.level}${
        workingLevel(learner) !== learner.level
          ? ` (works at ${fixed(workingLevel(learner))})`
          : ""
      } | ${show(median(toWork))} / ${show(Math.max(...toWork))} | ${show(median(toShow))} / ${show(Math.max(...toShow))} | ${top(5)} | ${top(10)} | ${top(20)} | ${top(40)} | ${Math.round(100 * mean(runs.map((run) => shareFarAbove(run, 20))))}% | ${fixed(mean(runs.map((run) => errorAt(run, 20))), 2)} | ${fixed(mean(runs.map((run) => errorAt(run, 40))), 2)} | ${fixed(mean(runs.map((run) => errorAt(run, count))), 2)} | ${fixed(mean(coverage.map((c) => c.skills)))} (of ${catalog.skills}) | ${fixed(mean(coverage.map((c) => c.areas)))} (of ${catalog.areas}) | ${fixed(mean(coverage.map((c) => c.right)))} |`,
    );
  }
}
