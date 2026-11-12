import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedBetween,
  gridFor,
  growthOf,
  medianInterval,
  mixtureCdf,
  mixtureDensity,
  mixtureQuantile,
  mixtureStats,
  normalCdf,
  normalPdf,
  random,
  type Normal,
} from "../src/schools/standing-math";
import { standingNormal } from "../src/schools/standing-curve";
import { withinGradeSd } from "../src/schools/norms-prior";
import { referenceMedianInterval } from "./helpers/median-interval-reference";

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );
const area = (density: Float64Array, step: number) =>
  density.reduce((sum, y) => sum + y, 0) * step;

test("Φ matches known values", () => {
  near(normalCdf(0), 0.5, 1e-7);
  near(normalCdf(1.959964), 0.975, 1e-6);
  near(normalCdf(-1), 0.158655, 1e-6);
  near(normalCdf(3), 0.99865, 1e-5);
});

test("one student's curve is their own normal, and it integrates to one", () => {
  const grid = { from: -6, to: 6, step: 0.05 };
  const density = mixtureDensity([{ mu: 0.5, sd: 0.8 }], grid);
  near(area(density, grid.step), 1, 1e-3);
  // At x = 1.3: φ((1.3 − 0.5)/0.8)/0.8.
  const at = Math.round((1.3 - grid.from) / grid.step);
  near(density[at]!, normalPdf(1.3, 0.5, 0.8), 1e-9);
});

test("a class curve is the even mixture of its students' curves", () => {
  const students: Normal[] = [
    { mu: -1, sd: 0.3 },
    { mu: 0, sd: 0.5 },
    { mu: 2, sd: 1 },
  ];
  const grid = { from: -8, to: 8, step: 0.1 };
  const density = mixtureDensity(students, grid);
  near(area(density, grid.step), 1, 1e-3);
  for (const x of [-1, 0.3, 2.5]) {
    const index = Math.round((x - grid.from) / grid.step);
    const expected =
      students.reduce((sum, s) => sum + normalPdf(x, s.mu, s.sd), 0) / 3;
    near(density[index]!, expected, 1e-9);
  }
  // Mean is the mean of μ; variance adds each student's own σ².
  const stats = mixtureStats(students);
  near(stats.mean!, 1 / 3, 1e-12);
  const second = (0.09 + 1 + 0.25 + 0 + 1 + 4) / 3;
  near(stats.sd!, Math.sqrt(second - 1 / 9), 1e-12);
  // The median is where the mixture's CDF crosses one half.
  near(mixtureCdf(students, stats.median!), 0.5, 1e-3);
  // Every student's mass lands somewhere: behind + within + ahead = n.
  const total =
    expectedBetween(students, -Infinity, -0.5) +
    expectedBetween(students, -0.5, 0.5) +
    expectedBetween(students, 0.5, Infinity);
  near(total, 3, 1e-9);
});

test("a school curve of classes weighted by size is the mixture of all students", () => {
  const a: Normal[] = [
    { mu: -0.4, sd: 0.4 },
    { mu: 0.2, sd: 0.6 },
  ];
  const b: Normal[] = [
    { mu: 1.1, sd: 0.3 },
    { mu: 1.5, sd: 0.5 },
    { mu: 2.4, sd: 0.9 },
  ];
  const grid = { from: -5, to: 7, step: 0.1 };
  const school = mixtureDensity([...a, ...b], grid);
  const da = mixtureDensity(a, grid);
  const db = mixtureDensity(b, grid);
  school.forEach((y, index) =>
    near(y, (2 * da[index]! + 3 * db[index]!) / 5, 1e-12),
  );
});

test("the axis spans every student's curve in whole grades, within its limits", () => {
  assert.deepEqual(gridFor([]), { from: -3, to: 3, step: 0.1 });
  assert.deepEqual(gridFor([{ mu: -6.2, sd: 0.4 }]), {
    from: -8,
    to: 3,
    step: 0.1,
  });
  // A grade 5 class: nothing below K (−1 − 5) or past 13.
  assert.deepEqual(gridFor([{ mu: 0, sd: 2.5 }], { limits: [-6, 8] }), {
    from: -6,
    to: 7,
    step: 0.1,
  });
});

test("a new learner's curve is wide and honest, and narrows with answers", () => {
  // Never opened practice: the age-expected grade at the national spread.
  const fresh = standingNormal({
    grade: 5,
    level: null,
    sd: null,
    birthYear: null,
  })!;
  assert.deepEqual(fresh, { mu: 0, sd: withinGradeSd(5) });
  assert.ok(fresh.sd >= 1.5);
  // Opened practice: the stored starting guess and its stored sd.
  const started = standingNormal({
    grade: 5,
    level: 4.6,
    sd: 2.5,
    birthYear: 2015,
  })!;
  near(started.mu, -0.4, 1e-9);
  assert.equal(started.sd, 2.5);
  // No roster grade: nothing to stand against.
  assert.equal(
    standingNormal({ grade: null, level: 4, sd: 1, birthYear: null }),
    null,
  );
  // A class of new learners has a low, flat curve; answered, a tall one.
  const grid = { from: -8, to: 8, step: 0.1 };
  const peak = (students: Normal[]) =>
    Math.max(...mixtureDensity(students, grid));
  const wide = Array.from({ length: 20 }, () => fresh);
  const next = random(7);
  const known = Array.from({ length: 20 }, () => ({
    mu: (next() - 0.5) * 2,
    sd: 0.3,
  }));
  assert.ok(peak(wide) < 0.3);
  assert.ok(peak(known) > 2 * peak(wide));
});

test("norms give a within-grade spread that widens with grade", () => {
  assert.equal(withinGradeSd(0), 0.7);
  assert.equal(withinGradeSd(5), 1.9);
  assert.equal(withinGradeSd(11), 4);
  for (let grade = 1; grade <= 12; grade++)
    assert.ok(withinGradeSd(grade) >= withinGradeSd(grade - 1));
});

test("one student's median interval is their own μ ± 1.96σ", () => {
  const interval = medianInterval([{ mu: 0.4, sd: 0.5 }], {
    seed: 3,
    draws: 20_000,
  })!;
  assert.equal(interval.median, 0.4);
  near(interval.low, 0.4 - 1.96 * 0.5, 0.03);
  near(interval.high, 0.4 + 1.96 * 0.5, 0.03);
});

test("a median interval is the same for the same students in any order", () => {
  const students: Normal[] = Array.from({ length: 25 }, (_, index) => ({
    mu: Math.sin(index) * 2,
    sd: 0.3 + (index % 4) / 10,
  }));
  const forward = medianInterval(students, { seed: 11 });
  const backward = medianInterval([...students].reverse(), { seed: 11 });
  assert.deepEqual(forward, backward);
});

test("the point is the median of the students' estimates", () => {
  const odd = medianInterval(
    [3, 1, 2].map((mu) => ({ mu, sd: 0.2 })),
    { seed: 1 },
  )!;
  assert.equal(odd.median, 2);
  const even = medianInterval(
    [4, 1, 3, 2].map((mu) => ({ mu, sd: 0.2 })),
    { seed: 1 },
  )!;
  assert.equal(even.median, 2.5);
  // Long random lists agree with sorting.
  const next = random(99);
  for (let trial = 0; trial < 30; trial++) {
    const length = 1 + Math.floor(next() * 60);
    const mus = Array.from({ length }, () => next() * 10 - 5);
    const sorted = [...mus].sort((a, b) => a - b);
    const expected =
      length % 2
        ? sorted[length >> 1]!
        : (sorted[length / 2 - 1]! + sorted[length / 2]!) / 2;
    const got = medianInterval(
      mus.map((mu) => ({ mu, sd: 0.1 })),
      { draws: 200 },
    )!;
    near(got.median, expected, 1e-12);
  }
});

const gaussianFrom = (next: () => number) => () => {
  const u = 1 - next();
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * Coverage of where a class's median sits. With calibrated sds a student's
 * true position is their estimate plus N(0, σ²): draw each class's truths that
 * way and count how often the 95% interval holds the median of the truths.
 */
test("a class median's 95% band holds the class's true median about 95% of the time", () => {
  const next = random(2026);
  const gauss = gaussianFrom(next);
  const run = (n: number, sd: () => number, trials: number) => {
    let covered = 0;
    let width = 0;
    for (let trial = 0; trial < trials; trial++) {
      const students = Array.from({ length: n }, () => ({
        mu: 1.2 * gauss(),
        sd: sd(),
      }));
      const truths = students
        .map((student) => student.mu + student.sd * gauss())
        .sort((a, b) => a - b);
      const truth =
        n % 2 ? truths[n >> 1]! : (truths[n / 2 - 1]! + truths[n / 2]!) / 2;
      const interval = medianInterval(students, {
        seed: trial + 1,
        draws: 400,
      })!;
      if (interval.low <= truth && truth <= interval.high) covered++;
      width += interval.high - interval.low;
    }
    return { coverage: covered / trials, width: width / trials };
  };
  const within = (name: string, value: number) =>
    assert.ok(value >= 0.92 && value <= 0.98, `${name} ${value}`);
  // A typical class, mostly well measured.
  const settled = run(25, () => 0.3 + next() * 0.3, 600);
  within("settled", settled.coverage);
  // A new class: every student a wide starting guess. Still 95%, far wider.
  const fresh = run(25, () => 2.4, 600);
  within("fresh", fresh.coverage);
  assert.ok(fresh.width > 3 * settled.width);
  // A small class, and a class of one.
  within("small", run(5, () => 0.4, 600).coverage);
  within("one", run(1, () => 0.5, 600).coverage);
});

/**
 * Coverage of a group's median growth. Each student's measured growth is
 * their true growth plus N(0, σ²), true growth drawn from a population with a
 * known median. The bootstrap interval holds that median at least 95% of the
 * time, and close to 95% when growth is well measured.
 */
test("median growth's bootstrap interval covers the population median", () => {
  const next = random(11);
  const gauss = gaussianFrom(next);
  const run = (n: number, spread: number, sd: number, trials: number) => {
    let covered = 0;
    for (let trial = 0; trial < trials; trial++) {
      const centre = 0.5 + 0.3 * gauss();
      const gains = Array.from({ length: n }, () => ({
        mu: centre + spread * gauss() + sd * gauss(),
        sd,
      }));
      const interval = medianInterval(gains, {
        seed: trial + 1,
        draws: 400,
        mode: "bootstrap",
      })!;
      if (interval.low <= centre && centre <= interval.high) covered++;
    }
    return covered / trials;
  };
  const precise = run(30, 0.4, 0.05, 600);
  assert.ok(precise >= 0.92 && precise <= 0.985, `precise ${precise}`);
  const noisy = run(20, 0.3, 0.5, 600);
  assert.ok(noisy >= 0.94, `noisy ${noisy}`);
});

test("growth adds both readings' uncertainty", () => {
  const gain = growthOf({ mu: 4.4, sd: 0.3 }, { mu: 5.1, sd: 0.4 });
  near(gain.mu, 0.7, 1e-12);
  near(gain.sd, 0.5, 1e-12);
});

test("a mixture quantile inverts its CDF", () => {
  const students: Normal[] = [
    { mu: 0, sd: 1 },
    { mu: 3, sd: 0.5 },
  ];
  for (const p of [0.1, 0.5, 0.9])
    near(mixtureCdf(students, mixtureQuantile(students, p)!), p, 1e-3);
});

test("a big bootstrap reads its seed's kept stream and gives exactly the drawn numbers", () => {
  const next = random(20261112);
  // Sizes either side of what's kept, a district's schools among them, and
  // seeds interleaved so streams are made, grown and dropped between calls.
  const cases: { n: number; seed: number; draws?: number }[] = [];
  for (const n of [40, 300, 700, 834, 830, 1100, 1310, 20, 2500])
    for (const seed of [1, 7, 1, 99])
      cases.push({ n, seed }, { n, seed, draws: 250 });
  for (const { n, seed, draws } of cases) {
    const students: Normal[] = Array.from({ length: n }, (_, index) => ({
      // Ties included: flat students all at zero.
      mu: index % 9 === 0 ? 0 : next() * 2 - 0.5,
      sd: [0.12, 0.3, 0.35, 0.6][index % 4]!,
    }));
    const options = { seed, mode: "bootstrap" as const, draws };
    assert.deepEqual(
      medianInterval(students, options),
      referenceMedianInterval(students, options),
      `${n} students, seed ${seed}, ${draws ?? "default"} draws`,
    );
  }
});
