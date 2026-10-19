import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { guessChance, guessChanceOf } from "../src/math/guess-chance";
import { simulatePlacement, type Run } from "./placement-simulation.fixture";

const noGuessing = () => 0;

// `npm run test:placement-sim` (about a minute; CI runs it on main). The
// inner-loop smoke checks live in guessing-placement.test.ts.

/** The old (no guessing) and new (guessing-aware) estimators place the same
 * synthetic learners on the same current catalog in one run. Each learner's
 * answers depend only on the learner and the item (common random numbers), so
 * the per-learner differences after − before measure the estimator change.
 * Bounds come from those differences' own standard error, never from a
 * hand-set constant, so the comparisons stay meaningful as the catalog grows. */
function paired(
  before: readonly Run[],
  after: readonly Run[],
  pick: (run: Run) => number | null,
) {
  const differences: number[] = [];
  before.forEach((run, i) => {
    const a = pick(after[i]!),
      b = pick(run);
    if (a !== null && b !== null) differences.push(a - b);
  });
  const n = differences.length;
  const mean = differences.reduce((sum, d) => sum + d, 0) / n;
  const variance =
    differences.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    n,
    mean: round(mean),
    se: round(se),
    /** One-sided, about 98%: the new estimator is not detectably worse. */
    noWorse: mean <= 2 * se,
    /** One-sided, about 98%: the new estimator is detectably better. */
    better: mean + 2 * se < 0,
  };
}

test("simulated placement: no worse for typed-only learners, better with choice items mixed in", (t) => {
  const typed = templates.filter((template) => guessChance(template) === 0);
  const typedBefore = simulatePlacement({
    catalog: typed,
    guessOf: noGuessing,
  });
  const typedAfter = simulatePlacement({
    catalog: typed,
    guessOf: guessChanceOf,
  });
  // The estimator changes per-learner strand errors by a few hundredths of a
  // grade; 900 paired learners resolve that at two standard errors or more.
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const mixedBefore = simulatePlacement({
    catalog: templates,
    guessOf: noGuessing,
    seeds,
  });
  const mixedAfter = simulatePlacement({
    catalog: templates,
    guessOf: guessChanceOf,
    seeds,
  });
  for (const [name, { runs: _runs, ...means }] of Object.entries({
    typedBefore,
    typedAfter,
    mixedBefore,
    mixedAfter,
  }))
    t.diagnostic(`${name} ${JSON.stringify(means)}`);
  // Typed answers keep full weight: every learner's placement is identical.
  assert.deepEqual(typedAfter.runs, typedBefore.runs);
  // Choice items are a real part of placement in this catalog.
  assert.ok(
    mixedAfter.choiceShare > 0.15,
    JSON.stringify(mixedAfter.choiceShare),
  );
  const compare = (pick: (run: Run) => number | null) =>
    paired(mixedBefore.runs, mixedAfter.runs, pick);
  const choiceStrand = compare((run) => run.choiceStrandError);
  const worst = compare((run) => run.worstOverestimate);
  const strand = compare((run) => run.strandError);
  const toPlace = compare((run) => run.toPlace);
  const overall = compare((run) => run.overallError);
  t.diagnostic(
    `after − before: ${JSON.stringify({ choiceStrand, worst, strand, toPlace, overall })}`,
  );
  // Lucky picks no longer inflate the strands they land in…
  assert.ok(choiceStrand.better, JSON.stringify(choiceStrand));
  assert.ok(worst.better, JSON.stringify(worst));
  assert.ok(strand.better, JSON.stringify(strand));
  // …and placement settles no later, with a pooled level no worse (it is
  // dominated by typed answers).
  assert.ok(toPlace.noWorse, JSON.stringify(toPlace));
  assert.ok(overall.noWorse, JSON.stringify(overall));
});
