import { expect, test } from "vitest";
import { AppError } from "../../../../lib/AppError";
import {
  TIME_SPAN_DAYS,
  boundedFrom,
  latestFrom,
  localDay,
  tooLong,
} from "../time-range";

const span = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000 +
  1;

test("a start within the limit is sent as it is", () => {
  expect(boundedFrom("2026-07-01", "2026-11-14")).toBe("2026-07-01");
});

test("an unbounded start is clamped to exactly the limit", () => {
  const from = boundedFrom("0001-01-01", "2026-11-14");
  expect(span(from, "2026-11-14")).toBe(TIME_SPAN_DAYS);
  expect(boundedFrom(from, "2026-11-14")).toBe(from);
});

test("the latest stretch stays inside the limit a day either side of today", () => {
  const from = latestFrom("2026-11-14");
  expect(span(from, "2026-11-15")).toBeLessThanOrEqual(TIME_SPAN_DAYS);
  expect(span(from, "2026-11-13")).toBeGreaterThan(TIME_SPAN_DAYS - 4);
});

test("only the too-long error reads as too long", () => {
  const error = (code: string) =>
    new AppError("validation", "x", false, null, code, 400);
  expect(tooLong(error("time_range_too_long"))).toBe(true);
  expect(tooLong(error("invalid_time_range"))).toBe(false);
  expect(tooLong(new Error("time_range_too_long"))).toBe(false);
  expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05");
});

test("a range across a new year names both years", async () => {
  const { dayRange } = await import("../teacher-shared");
  expect(dayRange("2026-07-01", "2026-11-14")).toBe("July 1 to November 14");
  expect(dayRange("2025-10-13", "2026-11-14")).toBe(
    "October 13, 2025 to November 14, 2026",
  );
});
