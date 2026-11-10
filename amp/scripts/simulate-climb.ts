/* How fast practice reaches a learner's level from a wrong (or right)
   starting guess. Runs the real planner, estimator and grader over simulated
   learners (tests/climb-simulation.fixture.ts) and prints a Markdown table.

     npx tsx scripts/simulate-climb.ts [seeds=8] [problems=100]
     npx tsx scripts/simulate-climb.ts --trace <case 0–5> [problems=100]

   Synthetic regression scenarios, not evidence about real learners. */
import {
  answersToEstimate,
  answersToServe,
  climbCases,
  nearLevel,
  simulateClimb,
  type ClimbRun,
} from "../tests/climb-simulation.fixture";

const traced = process.argv.indexOf("--trace");
const numbers = process.argv
  .slice(2)
  .filter((arg, i) => !arg.startsWith("--") && i + 2 !== traced + 1)
  .map(Number);
const seeds = traced > 0 ? 1 : (numbers[0] ?? 8);
const count = (traced > 0 ? numbers[0] : numbers[1]) ?? 100;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
};
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const fixed = (value: number) => value.toFixed(1);
const never = (values: (number | null)[]) =>
  values.map((value) => value ?? Infinity);
const show = (value: number) =>
  Number.isFinite(value) ? String(value) : `>${count}`;
const share = (runs: ClimbRun[], from: number, to: number) =>
  `${Math.round(
    100 *
      mean(
        runs.flatMap((run) =>
          run.steps
            .slice(from - 1, to)
            .map((step) => (nearLevel(step) ? 1 : 0)),
        ),
      ),
  )}%`;
const servedGrade = (runs: ClimbRun[], from: number, to: number) =>
  fixed(
    mean(
      runs.flatMap((run) =>
        run.steps.slice(from - 1, to).map((step) => step.grade),
      ),
    ),
  );

const climbingShare = (runs: ClimbRun[], from: number, to: number) =>
  `${Math.round(
    100 *
      mean(
        runs.flatMap((run) =>
          run.steps.slice(from - 1, to).map((step) => (step.climbing ? 1 : 0)),
        ),
      ),
  )}%`;
const right = (runs: ClimbRun[], from: number, to: number) =>
  `${Math.round(
    100 *
      mean(
        runs.flatMap((run) =>
          run.steps.slice(from - 1, to).map((step) => (step.correct ? 1 : 0)),
        ),
      ),
  )}%`;

if (traced < 0) {
  console.log(
    `| Case | Start | First estimate within ±0.5 (median / worst) | Estimate holds ±0.5 for 10 (median / worst) | Problems to work near level (median / worst) | Near level, problems 1–10 | 11–20 | 21–40 | ${count - 19}–${count} | Mean grade served 11–20 | Estimate after 15 | after ${count} | Right in first 20 | Right in ${count - 19}–${count} | Climbing in ${count - 19}–${count} |`,
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const { name, learner } of climbCases) {
    const runs = Array.from({ length: seeds }, (_, i) =>
      simulateClimb(learner, { seed: `${name}:${i}`, count }),
    );
    const toEstimate = never(
      runs.map((run) => answersToEstimate(run, learner.level)),
    );
    const toServe = never(runs.map((run) => answersToServe(run)));
    const firstWithin = never(
      runs.map((run) => answersToEstimate(run, learner.level, 0.5, 1)),
    );
    console.log(
      `| ${name} | ${runs[0]!.start} | ${show(median(firstWithin))} / ${show(Math.max(...firstWithin))} | ${show(median(toEstimate))} / ${show(Math.max(...toEstimate))} | ${show(median(toServe))} / ${show(Math.max(...toServe))} | ${share(runs, 1, 10)} | ${share(runs, 11, 20)} | ${share(runs, 21, 40)} | ${share(runs, count - 19, count)} | ${servedGrade(runs, 11, 20)} | ${fixed(mean(runs.map((run) => run.steps[14]!.level)))} | ${fixed(mean(runs.map((run) => run.steps.at(-1)!.level)))} | ${right(runs, 1, 20)} | ${right(runs, count - 19, count)} | ${climbingShare(runs, count - 19, count)} |`,
    );
  }
}

// `--trace <case>`: one learner's problems, one line each.
if (traced > 0) {
  const { name, learner } = climbCases[Number(process.argv[traced + 1])]!;
  const run = simulateClimb(learner, { seed: `${name}:0`, count });
  console.log(`\n${name} (start ${run.start})`);
  run.steps.forEach((step, i) =>
    console.log(
      `${String(i + 1).padStart(3)} ${step.grade.toFixed(1).padStart(5)} ${step.correct ? "right" : "wrong"} gap ${step.gap.toFixed(1).padStart(5)} ${step.reason.padEnd(12)} ${(step.purpose ?? "").padEnd(10)} ${step.strand.padEnd(12)} strand ${step.strandLevel.toFixed(2)} ceiling ${step.ceiling ?? "-"} → overall ${step.level.toFixed(2)} ±${step.sd.toFixed(2)} ${step.templateId}`,
    ),
  );
}
