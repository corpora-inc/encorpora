import assert from "node:assert/strict";
import test from "node:test";
import { termGrowth } from "../src/schools/growth";

test("term growth is the settled pace across the window", () => {
  const days = [0, 30, 60, 90, 120, 150, 180].map((day, index) => ({
    day,
    level: 4 + 0.005 * day,
    sd: day === 0 ? 1.2 : Math.max(0.25, 0.45 - index * 0.03),
  }));
  const figure = termGrowth(days, 180);
  assert.ok(figure);
  assert.ok(Math.abs(figure.mu - 0.9) < 1e-9, String(figure.mu));
  assert.ok(figure.sd > 0 && figure.sd < 1, String(figure.sd));
});

test("one settled day is no growth figure", () => {
  assert.equal(
    termGrowth([{ day: 4, level: 5, sd: 0.4 }], 30),
    null,
  );
  assert.equal(
    termGrowth(
      [
        { day: 1, level: 5, sd: 1.4 },
        { day: 2, level: 5.2, sd: 1.1 },
      ],
      30,
    ),
    null,
  );
  assert.equal(termGrowth([{ day: 0, level: 5, sd: 0.4 }, { day: 10, level: 5.2, sd: 0.4 }], 0), null);
});

test("two settled days recover the line, and a wide day is left out", () => {
  const figure = termGrowth(
    [
      { day: 0, level: 8, sd: 1.5 },
      { day: 10, level: 4, sd: 0.4 },
      { day: 30, level: 4.4, sd: 0.4 },
    ],
    40,
  );
  assert.ok(figure);
  // Slope 0.4/20 = 0.02 grades a day, times 40 days.
  assert.ok(Math.abs(figure.mu - 0.8) < 1e-9, String(figure.mu));
  assert.ok(figure.sd > 0);
});
