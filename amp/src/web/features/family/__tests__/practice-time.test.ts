import { expect, test } from "vitest";
import { practiceMinutes } from "../../../lib/practice-minutes";
import { practiceTime } from "../ChildActivity";

/* Practice time (product grabs 2026-11-17, #18): Today said "1 min" and the
   child page "0.7 min · 14 problems" for the same 40 seconds. One formatter,
   on exact minutes, everywhere a family reads it. */

test("40 seconds and 14 problems read the same on Today and the child page", () => {
  const exact = 40 / 60;
  // Today's card and the family's week.
  expect(practiceMinutes(exact, 14)).toBe("<1 min");
  // The child page's Practice time.
  expect(
    practiceTime({ date: "2026-11-17", minutes: exact, problems: 14 }),
  ).toBe("<1 min · 14 problems");
  expect(practiceTime({ date: "2026-11-17", minutes: 12.4, problems: 1 })).toBe(
    "12 min · 1 problem",
  );
  // A week (no problem count) and a quiet day.
  expect(practiceTime({ date: "2026-11-16", minutes: exact })).toBe("<1 min");
  expect(
    practiceTime({ date: "2026-11-15", minutes: 0, problems: 0 }),
  ).toBeNull();
});
