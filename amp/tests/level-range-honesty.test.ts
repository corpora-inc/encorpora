import assert from "node:assert/strict";
import test from "node:test";
import {
  ADULT_START_SD,
  estimateFrontier,
  initialLevel,
  LIKELY_MASS,
  startingSd,
  type FrontierObservation,
} from "../src/learning/frontier";
import { reportEstimate } from "../src/learning/frontier-report";
import { levelRange, shownRange } from "../src/learning/level-check";
import { runLevelIntervalStudy } from "../scripts/frontier/level-interval-study";

/** One strand of grade-`grade` typed items, answered in order. */
function overall(
  answers: readonly boolean[],
  options: { start: number; startSd?: number; grade: number },
) {
  const observations: FrontierObservation[] = answers.map((correct, i) => ({
    templateId: `item-${i}`,
    correct,
    assisted: false,
    createdAt: new Date(Date.UTC(2026, 10, 15, 16, i)).toISOString(),
  }));
  return reportEstimate(
    estimateFrontier({
      start: options.start,
      startSd: options.startSd,
      observations,
      gradeOf: () => options.grade,
      strandOf: () => "numbers",
      guessOf: () => 0,
    }).overall,
  );
}

test("an adult without a birth year starts from a nearly flat prior; a child from their age", () => {
  assert.equal(startingSd({ adult: true }), ADULT_START_SD);
  assert.equal(startingSd({ band: "algebra-2" }), ADULT_START_SD);
  assert.equal(startingSd({ birthYear: 2016 }), undefined);
  assert.equal(startingSd({ band: "3–5" }), undefined);
  // A practice profile set to a level ("practice at grade 4") is placed by
  // that choice, as an age places a child, though its learner is an adult's.
  assert.equal(
    startingSd({ adult: true, simulation: true, band: "3–5" }),
    undefined,
  );
});

test("one right answer from an adult leaves the top open (founder, 2026-11-15)", () => {
  const start = initialLevel({ adult: true });
  const startSd = startingSd({ adult: true });
  const right = overall([true], { start, startSd, grade: start });
  const shown = shownRange(right);
  assert.equal(shown.openHigh, true, JSON.stringify(right));
  // It still says something: the bottom rises off kindergarten.
  assert.ok(shown.from >= 4, JSON.stringify(right));
  // Its numbers reach past Algebra 2: nothing caps them below the top.
  assert.ok(levelRange(right)[1] > 12, JSON.stringify(right));
  // One wrong answer opens the bottom instead.
  const wrong = shownRange(overall([false], { start, startSd, grade: start }));
  assert.equal(wrong.openLow, true);
  assert.equal(wrong.openHigh, false);
});

test("a child's age bounds the top where an adult's guess cannot", () => {
  const right = overall([true], { start: 3, grade: 3 });
  assert.equal(shownRange(right).openHigh, false, JSON.stringify(right));
  // Many right answers at the top of the curriculum open it for anyone.
  const strong = overall(Array<boolean>(12).fill(true), {
    start: 3,
    grade: 12,
  });
  assert.equal(shownRange(strong).openHigh, true, JSON.stringify(strong));
});

/**
 * The study in miniature (scripts/frontier/level-interval-study.ts): every
 * other learner of the quick grid, 30 answers each, the production planner
 * and estimator, misspecified answers with guessing. Pooled over its
 * checkpoints (1–30 answers) and both populations there are 1,680 readings,
 * so the bands are about three standard errors wide. Coverage before this
 * change, on the same learners: adults 54–73% of a range that promised 90%.
 */
test(
  "the likely range holds the truth as often as it says, without bias",
  { timeout: 300_000 },
  async () => {
    const report = await runLevelIntervalStudy({
      quick: true,
      sample: 2,
      answers: 30,
    });
    assert.ok(report.sameSelection, "the range changed which problems come");
    const pooled = (variant: "raw" | "after", population?: string) => {
      const rows = report.rows.filter(
        (r) =>
          r.variant === variant && (!population || r.population === population),
      );
      const n = rows.reduce((sum, r) => sum + r.n, 0);
      return rows.reduce((sum, r) => sum + r.coverage * r.n, 0) / n;
    };
    const raw = pooled("raw");
    assert.ok(
      Math.abs(raw - LIKELY_MASS) <= 0.06,
      `likely range held the truth ${(raw * 100).toFixed(1)}% of the time`,
    );
    for (const population of ["children", "adults"]) {
      const coverage = pooled("raw", population);
      assert.ok(
        coverage >= LIKELY_MASS - 0.1,
        `${population}: ${(coverage * 100).toFixed(1)}%`,
      );
      // In whole grades the range only widens, so it never says less.
      const shown = pooled("after", population);
      assert.ok(
        shown >= LIKELY_MASS - 0.04,
        `${population} shown: ${(shown * 100).toFixed(1)}%`,
      );
    }
    for (const row of report.rows.filter((r) => r.variant === "after")) {
      const limit = row.answered <= 3 ? 0.8 : 0.5;
      assert.ok(
        Math.abs(row.bias) <= limit,
        `${row.population} at ${row.answered}: bias ${row.bias.toFixed(2)}`,
      );
    }
  },
);
