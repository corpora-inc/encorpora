import { expect, test } from "vitest";
import { activityShown } from "../OwnRecordScreen";

const record = (weeks: { week: string; minutes: number }[]) =>
  ({ weeks, objectives: [], work: [] }) as never;
const time = (days: { day: string; minutes: number; problems: number }[]) =>
  ({
    range: { from: "2026-10-01", to: "2026-11-14" },
    days,
    skills: [],
  }) as never;

test("this week is one quiet line: minutes, days and problems", () => {
  const shown = activityShown({
    record: record([{ week: "2026-11-09", minutes: 5 }]),
    time: time([
      { day: "2026-11-02", minutes: 30, problems: 20 },
      { day: "2026-11-10", minutes: 4.6, problems: 6 },
    ]),
  });
  expect(shown.week).toBe("5 min · 1 day · 6 problems");
});

test("answers too quick to count as minutes never read “0 min”", () => {
  const shown = activityShown({
    record: record([{ week: "2026-11-09", minutes: 0 }]),
    time: time([{ day: "2026-11-10", minutes: 0.2, problems: 13 }]),
  });
  expect(shown.week).toBe("1 day · 13 problems");
});

test("a week with nothing in it has no line of its own", () => {
  const shown = activityShown({
    record: record([{ week: "2026-11-09", minutes: 0 }]),
    time: time([]),
  });
  expect(shown.week).toBeNull();
});
