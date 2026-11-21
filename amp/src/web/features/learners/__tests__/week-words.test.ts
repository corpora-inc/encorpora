import { expect, test } from "vitest";
import {
  daysInWords,
  lastPracticed,
  percentRight,
  QUIET_WEEK,
  weekDays,
  weekFigure,
} from "../week-words";

test("when a learner last practiced, in words", () => {
  expect(lastPracticed("2026-11-20", "2026-11-20")).toBe("Today");
  expect(lastPracticed("2026-11-19", "2026-11-20")).toBe("Yesterday");
  expect(lastPracticed("2026-11-12", "2026-11-20")).toBe("Nov 12");
});

test("a week's figure, or null for a quiet week", () => {
  expect(weekFigure(0, 0)).toBeNull();
  expect(weekFigure(12.4, 9)).toEqual({
    value: "12 min",
    label: "9 problems this week",
  });
  expect(weekFigure(0, 1)).toEqual({
    value: "<1 min",
    label: "1 problem this week",
  });
});

test("right answers as a whole percent, none before any problem", () => {
  expect(percentRight(0, 0)).toBeNull();
  expect(percentRight(36, 48)).toBe(75);
  expect(percentRight(2, 3)).toBe(67);
  // Never above every problem.
  expect(percentRight(5, 4)).toBe(100);
});

test("the seven days of a week, the missing ones quiet, the later ones ahead", () => {
  const days = weekDays("2026-11-16", "2026-11-18", [
    { day: "2026-11-16", minutes: 10, problems: 4 },
    { day: "2026-11-18", minutes: 0, problems: 2 },
  ]);
  expect(days.map((day) => day.day)).toEqual([
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ]);
  expect(days[1]).toMatchObject({ minutes: 0, problems: 0, ahead: false });
  expect(days[2]).toMatchObject({ today: true, ahead: false });
  expect(days.slice(3).every((day) => day.ahead)).toBe(true);
  expect(daysInWords(days)).toBe("Practiced 2 days this week: Mon, Wed");
  expect(daysInWords(weekDays("2026-11-16", "2026-11-18", []))).toBe(
    QUIET_WEEK,
  );
});
