import assert from "node:assert/strict";
import test from "node:test";
import {
  GROWTH_CANDIDATES,
  scoreSeries,
  summarizeGrowth,
  type GrowthSeries,
} from "../scripts/frontier/growth-recovery";

const figure = (series: GrowthSeries, id: string) => {
  const scored = scoreSeries(series);
  const index = GROWTH_CANDIDATES.findIndex((candidate) => candidate.id === id);
  return scored[index];
};

/** A learner whose reported level tracks the truth, 0.005 grades a day, and
 * whose estimate is still wide on day 0. */
function line(): GrowthSeries {
  const days = [0, 30, 60, 90, 120, 150, 180].map((day, index) => ({
    day,
    answers: 8 + index * 40,
    level: 4 + 0.005 * day,
    reportedSd: day === 0 ? 1.2 : Math.max(0.25, 0.45 - index * 0.03),
    truth: 4 + 0.005 * day,
  }));
  return {
    id: "line",
    grade: 5,
    offset: 0,
    rep: 0,
    answers: 248,
    daysPerWeek: 4,
    truth: 0.9,
    elapsed: 180,
    days,
  };
}

test("the study names every required growth definition", () => {
  const ids = GROWTH_CANDIDATES.map((candidate) => candidate.id);
  for (const threshold of [20, 40, 60, 100])
    assert.ok(ids.includes(`answers-${threshold}`));
  for (const cut of [0.5, 0.6, 0.7, 0.8]) {
    assert.ok(ids.includes(`settled-${cut}`));
    assert.ok(ids.includes(`scaled-${cut}`));
    assert.ok(ids.includes(`slope-${cut}`));
    assert.ok(ids.includes(`slope-ends-${cut}`));
  }
});

test("answer and settled starts ignore the wide first days", () => {
  const series = line();
  const at20 = figure(series, "answers-20");
  assert.ok(at20);
  assert.equal(at20.startDay, 30);
  assert.equal(at20.startAnswers, 48);
  assert.ok(Math.abs(at20.mu - 0.75) < 1e-9, String(at20.mu));

  const settled = figure(series, "settled-0.5");
  assert.ok(settled);
  assert.equal(settled.startDay, 30);
  assert.ok(Math.abs(settled.mu - 0.75) < 1e-9);

  const at100 = figure(series, "answers-100");
  assert.ok(at100);
  assert.equal(at100.startDay, 90);
  assert.ok(Math.abs(at100.mu - 0.45) < 1e-9, String(at100.mu));
});

test("a pace stretched across the term recovers the whole change", () => {
  const series = line();
  for (const id of ["scaled-0.5", "slope-0.5", "slope-ends-0.5"]) {
    const scored = figure(series, id);
    assert.ok(scored, id);
    assert.ok(Math.abs(scored.mu - 0.9) < 1e-9, `${id} ${scored.mu}`);
    assert.ok(scored.sd > 0);
  }
  const classical = figure(series, "slope-0.5")!;
  const ends = figure(series, "slope-ends-0.5")!;
  assert.ok(
    classical.sd < ends.sd,
    "independent days claim a tighter error than the two endpoints",
  );
});

test("no settled span is no growth figure", () => {
  const series: GrowthSeries = {
    id: "early",
    grade: 4,
    offset: -1,
    rep: 0,
    answers: 12,
    daysPerWeek: 2,
    truth: 0.4,
    elapsed: 180,
    days: [
      { day: 3, answers: 6, level: 3.2, reportedSd: 1.4, truth: 3.1 },
      { day: 10, answers: 12, level: 3.6, reportedSd: 1.1, truth: 3.2 },
    ],
  };
  assert.equal(figure(series, "answers-20"), null);
  assert.equal(figure(series, "settled-0.8"), null);
  assert.equal(figure(series, "scaled-0.6"), null);
  assert.equal(figure(series, "slope-0.5"), null);
  const baseline = figure(series, "first-reading");
  assert.ok(baseline);
  assert.ok(Math.abs(baseline.mu - 0.4) < 1e-9);

  const oneDay: GrowthSeries = { ...series, days: series.days.slice(0, 1) };
  assert.equal(figure(oneDay, "first-reading"), null);
});

test("summary scores bias, MAE, and whether the interval covers", () => {
  const covered = (id: string, answers: number): GrowthSeries => ({
    id,
    grade: 5,
    offset: 0,
    rep: 0,
    answers,
    daysPerWeek: 3,
    truth: 1,
    elapsed: 10,
    days: [
      { day: 0, answers: 20, level: 5, reportedSd: 0.07, truth: 5 },
      { day: 10, answers, level: 6, reportedSd: 0.07, truth: 6 },
    ],
  });
  const missed: GrowthSeries = {
    ...covered("missed", 500),
    days: [
      { day: 0, answers: 20, level: 5, reportedSd: 0.07, truth: 5 },
      { day: 10, answers: 500, level: 8, reportedSd: 0.07, truth: 6 },
    ],
  };
  const summary = summarizeGrowth([
    covered("a", 100),
    covered("c", 100),
    missed,
  ]);
  const row = summary.rows.find((entry) => entry.id === "answers-20")!;
  assert.equal(row.overall.n, 3);
  assert.ok(Math.abs(row.overall.bias! - 2 / 3) < 1e-9);
  assert.ok(Math.abs(row.overall.mae! - 2 / 3) < 1e-9);
  assert.ok(Math.abs(row.overall.coverage! - 2 / 3) < 1e-9);
  assert.equal(row.low.n, 2);
  assert.equal(row.low.bias, 0);
  assert.equal(row.low.coverage, 1);
  assert.equal(row.high.n, 1);
  assert.equal(row.high.coverage, 0);
  assert.ok(row.practiceCorrelation! > 0.9);
  const absent = summary.rows.find((entry) => entry.id === "answers-100")!;
  assert.equal(absent.overall.n, 0);
  assert.equal(absent.overall.bias, null);
});
