import test from "node:test";
import assert from "node:assert/strict";
import {
  associationWords,
  fitLine,
  normalQuantile,
  quartiles,
  summarize,
  tCritical,
  type Point,
} from "../src/schools/practice-stats.js";
import {
  heatColor,
  heatPosition,
  heatStops,
  heatTicks,
} from "../src/web/features/school/heat-scale.js";

const close = (actual: number, expected: number, tolerance = 1e-4) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

test("a distribution's n, mean, median and sample sd", () => {
  assert.equal(summarize([]), null);
  assert.deepEqual(summarize([7]), { n: 1, mean: 7, median: 7, sd: 0 });
  const even = summarize([4, 1, 3, 2])!;
  assert.equal(even.median, 2.5);
  assert.equal(even.mean, 2.5);
  close(even.sd, Math.sqrt(5 / 3));
  const odd = summarize([2, 4, 4, 4, 5, 5, 7, 9])!;
  close(odd.sd, 2.13809, 1e-5);
});

test("normal and t critical values match the tables", () => {
  close(normalQuantile(0.975), 1.959964, 1e-6);
  close(normalQuantile(0.005), -2.575829, 1e-6);
  const table: [number, number][] = [
    [1, 12.706205],
    [2, 4.302653],
    [3, 3.182446],
    [4, 2.776445],
    [5, 2.570582],
    [9, 2.262157],
    [10, 2.228139],
    [30, 2.042272],
    [100, 1.983972],
    [10_000, 1.960201],
  ];
  for (const [df, value] of table) close(tCritical(0.05, df), value, 2e-4);
  close(tCritical(0.01, 10), 3.169273, 2e-4);
});

// Anscombe's first quartet: the textbook regression.
const anscombe: Point[] = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5].map(
  (x, index) =>
    [
      x,
      [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68][
        index
      ]!,
    ] as const,
);

test("least squares, r with its Fisher interval, and the 95% band", () => {
  const fit = fitLine(anscombe, 4, 11)!;
  assert.equal(fit.n, 11);
  close(fit.slope, 0.500091);
  close(fit.intercept, 3.000091);
  close(fit.r, 0.816421);
  close(fit.rLow, 0.424391);
  close(fit.rHigh, 0.950693);
  // Samples run 4 … 14 in steps of 1: x = 9 is the mean, where the band is
  // narrowest; x = 4 is the low end.
  const atMean = fit.band.find((row) => row.x === 9)!;
  close(atMean.fit, 7.500909);
  close(atMean.high - atMean.fit, 0.843445, 2e-4);
  const atLow = fit.band[0]!;
  assert.equal(atLow.x, 4);
  close(atLow.high - atLow.fit, 1.577941, 3e-4);
  assert.ok(atLow.high - atLow.low > atMean.high - atMean.low);
});

test("no line from too few points or no spread", () => {
  assert.equal(fitLine(anscombe.slice(0, 3)), null);
  assert.equal(fitLine(anscombe, 12), null);
  assert.equal(
    fitLine([
      [5, 1],
      [5, 2],
      [5, 3],
      [5, 4],
    ]),
    null,
  );
  assert.equal(
    fitLine([
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
    ]),
    null,
  );
});

test("an association is worded only as far as its interval allows", () => {
  const up = fitLine(anscombe)!;
  assert.equal(
    associationWords(up, "Learners"),
    "Learners who practiced more grew more (r = 0.82, 95% CI 0.42 to 0.95, n = 11).",
  );
  const down = fitLine(anscombe.map(([x, y]) => [x, -y] as const))!;
  assert.match(associationWords(down, "Classes"), /^Classes who practiced more grew less \(r = −0\.82/);
  const flat = fitLine([
    [1, 2],
    [2, 1],
    [3, 3],
    [4, 1],
    [5, 2],
    [6, 3],
  ])!;
  assert.match(associationWords(flat, "Learners"), /^No clear association/);
  assert.doesNotMatch(
    [up, down, flat].map((fit) => associationWords(fit, "Learners")).join(" "),
    /because|caus|effect|led to|drives/i,
  );
});

test("quartiles split near-evenly and keep ties together", () => {
  const groups = quartiles([8, 1, 7, 2, 6, 3, 5, 4], (value) => value);
  assert.deepEqual(
    groups.map((group) => group.items),
    [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ],
  );
  assert.deepEqual(
    groups.map(({ from, to }) => [from, to]),
    [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ],
  );
  const tied = quartiles([0, 0, 0, 0, 0, 1, 2, 3], (value) => value);
  assert.deepEqual(tied[0]!.items, [0, 0, 0, 0, 0]);
  assert.equal(
    tied.reduce((sum, group) => sum + group.items.length, 0),
    8,
  );
});

test("the heat scale: cold at zero, neutral at the target, hot at twice it", () => {
  assert.equal(heatPosition(0, 60), -1);
  assert.equal(heatPosition(30, 60), -0.5);
  assert.equal(heatPosition(60, 60), 0);
  assert.equal(heatPosition(90, 60), 0.5);
  assert.equal(heatPosition(120, 60), 1);
  assert.equal(heatPosition(600, 60), 1);
  assert.equal(heatPosition(-5, 60), -1);
  assert.equal(heatPosition(30, null), null);
  assert.equal(heatPosition(30, 0), null);
  assert.equal(heatPosition(Number.NaN, 60), null);

  assert.equal(heatColor(null), undefined);
  assert.equal(heatColor(-1), "var(--color-heat-0)");
  assert.equal(heatColor(0), "var(--color-heat-4)");
  assert.equal(heatColor(1), "var(--color-heat-8)");
  // Each stop is a quarter of the target: 45 of 60 minutes is stop 3, and
  // 50 is a third of the way from it to the neutral midpoint.
  assert.equal(heatColor(heatPosition(45, 60)), "var(--color-heat-3)");
  assert.equal(
    heatColor(heatPosition(50, 60)),
    "color-mix(in oklab, var(--color-heat-4) 33.3%, var(--color-heat-3))",
  );
  // Continuous and monotone: every minute moves the colour toward hot.
  let last = -Infinity;
  for (let minutes = 0; minutes <= 130; minutes++) {
    const { from, mix } = heatStops(heatPosition(minutes, 60)!);
    const along = from + mix;
    assert.ok(along >= last, `${minutes} min went backward`);
    if (minutes > 0 && minutes <= 120) assert.ok(along > last);
    last = along;
  }
  assert.deepEqual(heatTicks(60), [0, 30, 60, 90, 120]);
});
