#!/usr/bin/env node
// The EG-4 budget, with a wall clock on it.
//
//   node bin/dw-bench.mjs            # planBatch and applyResult, 2000 samples
//   node bin/dw-bench.mjs 10000
//
// This file is outside `src/`, deliberately, for the same reason `dw-harness.mjs`
// is: gate EG-1 bans a clock anywhere the engine can reach. `select.test.ts` used
// to carry a test *named* for this budget which measured nothing and could not
// fail — it asserted `warmSkills >= 0` — and deferred the number to a file that
// did not exist. This is that file, and it exits non-zero past the budget.
//
// The learner is warm and the catalog is the harness's seventy-two skills: a
// cold learner against the app's three-skill catalog is the cheapest possible
// case and not the claim. `planBatch` walks every reachable skill once per slot,
// so what matters is how many are reachable.
//
//   plan     `nextExercises(8)` — runs in idle, budgeted at p99 < 5 ms
//   apply    the whole answer path — what the child waits for, p99 < 1 ms

import { applyResult } from "../src/apply.ts";
import { BATCH_SIZE } from "../src/constants.ts";
import { harnessCatalog } from "../src/harness/catalog.ts";
import { simulate } from "../src/harness/simulate.ts";
import { newSession, planBatch, withCursor } from "../src/select.ts";

const SAMPLES = Number(process.argv[2] ?? 2000);
/** `A-16` / EG-4, in milliseconds. */
const BUDGET = { plan: 5, apply: 1 };

const catalog = harnessCatalog();

const percentile = (xs, p) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] ?? 0;
};

function report(name, samples, budget) {
  const p99 = percentile(samples, 99);
  const ok = p99 <= budget;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name.padEnd(6)} n=${String(samples.length).padStart(6)}  ` +
      `p50=${percentile(samples, 50).toFixed(4)}ms  p95=${percentile(samples, 95).toFixed(4)}ms  ` +
      `p99=${p99.toFixed(4)}ms  max=${Math.max(...samples).toFixed(4)}ms  budget ${String(budget)}ms`,
  );
  return ok;
}

// A day-120 learner, produced by the harness rather than hand-built, so the
// number is measured against a state a child can actually be in: warm skills,
// live misconceptions, a full rolling window and a populated fact table.
const transcript = simulate(catalog, "steady-strong", 0, 12345, {
  days: 120,
  cardsPerSession: 24,
  grade: 2,
});
const learner = transcript.finalLearner;

let context = newSession(31, learner.today, learner);
const plans = [];
const applies = [];
for (let i = 0; i < SAMPLES; i++) {
  const started = performance.now();
  const batch = planBatch(catalog, learner, context, BATCH_SIZE);
  plans.push(performance.now() - started);
  context = withCursor(context, batch.cursor);

  const card = batch.cards[i % batch.cards.length];
  if (card === undefined) continue;
  const at = performance.now();
  applyResult(catalog, learner, context, card, { correct: i % 4 !== 3, latencyMs: 6000, revisions: 0 }, batch.cards);
  applies.push(performance.now() - at);
}

console.log(
  `catalog ${String(catalog.skills.length)} skills · learner day ${String(learner.today)}, ` +
    `${String(learner.answered)} cards answered · ${String(Object.keys(learner.skills).length)} skill records`,
);
const ok = [report("plan", plans, BUDGET.plan), report("apply", applies, BUDGET.apply)].every(Boolean);
process.exit(ok ? 0 : 1);
