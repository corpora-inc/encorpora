import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateFrontier,
  strandEstimate,
  type FrontierObservation,
} from "../src/learning/frontier";
import {
  createFrontierPolicy,
  DEFAULT_FRONTIER_POLICY,
  LEGACY_FRONTIER_POLICY,
  type FrontierPolicy,
  type FrontierParameters,
} from "../src/learning/frontier-policy";

const at = "2026-10-23T12:00:00Z";
const answer = (
  correct: boolean,
  grade = 8,
  assisted = false,
): FrontierObservation => ({
  templateId: String(grade),
  correct,
  assisted,
  createdAt: at,
});
const history = (count: number, rate = 0.8, grade = 8) =>
  Array.from({ length: count }, (_, i) =>
    answer(Math.floor((i + 1) * rate) > Math.floor(i * rate), grade),
  );
const estimate = (
  observations: readonly FrontierObservation[],
  policy: FrontierPolicy = DEFAULT_FRONTIER_POLICY,
  guess = 0.25,
  start = 8,
) =>
  estimateFrontier({
    start,
    observations,
    policy,
    gradeOf: Number,
    strandOf: () => "algebra",
    guessOf: () => guess,
    now: Date.parse(at),
  });

test("two slips have a modest effect after substantial successful practice", () => {
  for (const grade of [4, 6, 8])
    for (const n of [40, 100]) {
      const before = history(n, 0.8, grade);
      const after = [...before, answer(false, grade), answer(false, grade)];
      for (const guess of [0, 0.25]) {
        const a = estimate(
          before,
          DEFAULT_FRONTIER_POLICY,
          guess,
          grade,
        ).overall;
        const b = estimate(
          after,
          DEFAULT_FRONTIER_POLICY,
          guess,
          grade,
        ).overall;
        const oldA = estimate(
          before,
          LEGACY_FRONTIER_POLICY,
          guess,
          grade,
        ).overall;
        const oldB = estimate(
          after,
          LEGACY_FRONTIER_POLICY,
          guess,
          grade,
        ).overall;
        const drop = a.level - b.level;
        assert.ok(
          drop > 0 && drop < 0.5,
          `${grade}/${n}/${guess}: ${a.level} → ${b.level}`,
        );
        assert.ok(drop < (oldA.level - oldB.level) / 2);
        assert.ok(
          b.level >= grade,
          `ordinary slips erased consistent grade-${grade} success`,
        );
      }
    }
});

test("the early estimate remains tentative and can correct a mistaken starting level", () => {
  assert.ok(
    estimate(history(10)).overall.sd > estimate(history(100)).overall.sd * 2,
  );
  const low = estimate(
    Array.from({ length: 12 }, () => answer(false, 2)),
    undefined,
    0,
    8,
  ).overall;
  assert.ok(low.level < 2, JSON.stringify(low));
  const high = estimate(
    Array.from({ length: 16 }, () => answer(true, 10)),
    undefined,
    0,
    2,
  ).overall;
  assert.ok(high.level > 10, JSON.stringify(high));
});

test("sustained difficulty lowers the overall estimate and local practice reacts faster", () => {
  const before = history(100);
  const a = estimate(before);
  const b = estimate([
    ...before,
    ...Array.from({ length: 25 }, () => answer(false)),
  ]);
  assert.ok(a.overall.level - b.overall.level > 0.5);
  assert.ok(a.strands.algebra!.level - b.strands.algebra!.level > 2);
  assert.ok(b.strands.algebra!.level < b.overall.level - 1);
});

test("working grade tolerates errors without awarding the same level to chance guesses", () => {
  const typed = estimate(history(100, 0.6, 6), undefined, 0, 6).overall;
  const choice = estimate(history(100, 0.7, 6), undefined, 0.25, 6).overall;
  assert.ok(Math.abs(typed.level - 6) < 0.3, JSON.stringify(typed));
  assert.ok(Math.abs(choice.level - 6) < 0.3, JSON.stringify(choice));
  assert.ok(
    estimate(history(100, 0.25, 6), undefined, 0.25, 6).overall.level < 4,
  );
});

test("helped answers preserve practice history without promoting independent ability", () => {
  const base = history(40);
  const a = estimate(base);
  const misses = estimate([
    ...base,
    ...Array.from({ length: 5 }, () => answer(false, 8, true)),
  ]);
  assert.deepEqual(
    { ...misses.overall, answered: a.overall.answered },
    a.overall,
  );
  const helped = estimate([
    ...base,
    ...Array.from({ length: 5 }, () => answer(true, 8, true)),
  ]);
  const independent = estimate([
    ...base,
    ...Array.from({ length: 5 }, () => answer(true)),
  ]);
  for (const [x, y, z] of [
    [a.overall, helped.overall, independent.overall],
    [a.strands.algebra!, helped.strands.algebra!, independent.strands.algebra!],
  ]) {
    assert.equal(y.level, x.level);
    assert.ok(z.level > x.level);
    assert.equal(y.independent, x.independent);
    assert.equal(y.answered, x.answered + 5);
  }
  const noHelpCredit = createFrontierPolicy({
    ...DEFAULT_FRONTIER_POLICY,
    version: "test-neutral-help",
    assisted: { ...DEFAULT_FRONTIER_POLICY.assisted, correctWeight: 0 },
  });
  const h = [...base, answer(true, 8, true), answer(false, 8, true)];
  assert.deepEqual(
    { ...estimate(h, noHelpCredit).overall, answered: a.overall.answered },
    a.overall,
  );
});

test("legacy policy replays the former production estimate", () => {
  // Captured before this change; same history, no time drift.
  const a = estimate(history(40), LEGACY_FRONTIER_POLICY).overall;
  const b = estimate(
    [...history(40), answer(false), answer(false)],
    LEGACY_FRONTIER_POLICY,
  ).overall;
  assert.deepEqual(a, { level: 8.86, sd: 0.87, answered: 40, independent: 32 });
  assert.deepEqual(b, { level: 7.58, sd: 0.83, answered: 42, independent: 32 });
});

test("policy injection is immutable, validated, and keeps untouched-strand uncertainty", () => {
  const input: FrontierParameters = structuredClone(DEFAULT_FRONTIER_POLICY);
  input.version = "test-broader-strand-prior";
  input.prior.strandSd = 3;
  const policy = createFrontierPolicy(input);
  input.prior.strandSd = 1;
  assert.ok(
    strandEstimate(estimate(history(40), policy), "unseen").sd >
      strandEstimate(estimate(history(40)), "unseen").sd,
  );
  assert.ok(Object.isFrozen(policy) && Object.isFrozen(policy.response));
  assert.throws(() => estimate([], input));
  for (const bad of [
    { ...input, typo: 1 },
    { ...input, overall: { ...input.overall, perAnswer: -1 } },
    {
      ...input,
      response: { ...input.response, slip: 0.3, atLevelSuccess: 0.8 },
    },
    { ...input, response: { ...input.response, discrimination: Infinity } },
    { ...input, assisted: "credit" },
  ])
    assert.throws(() => createFrontierPolicy(bad));
  const defaultRun = estimateFrontier({
    start: 8,
    observations: history(40),
    gradeOf: Number,
    strandOf: () => "algebra",
    guessOf: () => 0.25,
    now: Date.parse(at),
  });
  assert.deepEqual(defaultRun, estimate(history(40)));
});

test("rare misses widen the reported range without amplifying the next point update", () => {
  const base = history(100);
  const a = estimate(base).overall;
  const b = estimate([...base, answer(false)]).overall;
  assert.ok(b.sd > a.sd + 0.1, `${a.sd} → ${b.sd}`);
  assert.ok(a.level - b.level < 0.3);
  const noReserve = createFrontierPolicy({
    ...DEFAULT_FRONTIER_POLICY,
    version: "test-no-reporting-reserve",
    overallUncertainty: {
      ...DEFAULT_FRONTIER_POLICY.overallUncertainty,
      rareMissVariance: 0,
    },
  });
  const continued = [...base, answer(false), answer(false), answer(true)];
  assert.equal(
    estimate(continued).overall.level,
    estimate(continued, noReserve).overall.level,
  );
  const recovered = estimate([
    ...base,
    answer(false),
    ...history(8, 1),
  ]).overall;
  assert.ok(recovered.sd < b.sd);
});

test("recent hits and misses matter more than the same ten answers a thousand answers ago", () => {
  const old = history(20);
  const middle = history(1000);
  for (const correct of [true, false]) {
    const recent = Array.from({ length: 10 }, () => answer(correct));
    const early = estimate([...old, ...recent, ...middle]).overall.level;
    const late = estimate([...old, ...middle, ...recent]).overall.level;
    const settled = estimate([...old, ...middle]).overall.level;
    assert.ok(
      Math.abs(late - settled) > Math.abs(early - settled) + 0.2,
      JSON.stringify({ correct, early, late, settled }),
    );
    assert.ok(correct ? late > settled : late < settled);
  }
});

test("steadier overall reporting preserves responsive independent area estimates", () => {
  const observations = history(40);
  const a = estimate(observations);
  const b = estimate(observations, LEGACY_FRONTIER_POLICY);
  assert.deepEqual(a.adaptive, b.adaptive);
  assert.deepEqual(a.strands, b.strands);
  assert.deepEqual(strandEstimate(a, "unseen"), strandEstimate(b, "unseen"));
  assert.notEqual(a.overall.level, b.overall.level);
});

test("a first assisted miss cannot move an untouched area, including grid boundaries", () => {
  for (const start of [0, 6, 12]) {
    const base = Array.from({ length: 100 }, () => ({
      ...answer(true, start),
      templateId: "known",
    }));
    const run = (observations: FrontierObservation[]) =>
      estimateFrontier({
        start,
        observations,
        gradeOf: () => start,
        strandOf: (id) => id,
        guessOf: () => 0,
        now: Date.parse(at),
      });
    const before = strandEstimate(run(base), "new");
    const missed = strandEstimate(
      run([...base, { ...answer(false, start, true), templateId: "new" }]),
      "new",
    );
    const helped = strandEstimate(
      run([...base, { ...answer(true, start, true), templateId: "new" }]),
      "new",
    );
    assert.equal(missed.level, before.level);
    assert.equal(missed.sd, before.sd);
    assert.equal(missed.answered, 1);
    assert.equal(missed.independent, 0);
    assert.ok(
      helped.level >= before.level,
      JSON.stringify({ start, before, helped }),
    );
  }
});
