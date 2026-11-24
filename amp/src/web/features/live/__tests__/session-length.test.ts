import { expect, test } from "vitest";
import { sessionLength, sessionMinutes } from "../format";

const START = "2026-11-23T14:00:00.000Z";
const after = (seconds: number) =>
  new Date(Date.parse(START) + seconds * 1000).toISOString();

test("a session under a minute never reads “0 min”", () => {
  for (const seconds of [0, 1, 12, 29])
    expect(sessionLength(START, after(seconds))).toBe("under a minute");
  // The long form says the same words.
  expect(sessionLength(START, after(12), "long")).toBe("under a minute");
  // A clock that ran backwards is no length, not a negative one.
  expect(sessionLength(START, after(-90))).toBe("under a minute");
  expect(sessionMinutes(START, after(-90))).toBe(0);
});

test("minutes are whole, rounded, and the same from an instant or a clock", () => {
  expect(sessionLength(START, after(30))).toBe("1 min");
  expect(sessionLength(START, after(89))).toBe("1 min");
  expect(sessionLength(START, after(90))).toBe("2 min");
  expect(sessionLength(START, after(25 * 60))).toBe("25 min");
  expect(sessionLength(START, after(4 * 3600))).toBe("240 min");
  expect(sessionLength(START, Date.parse(after(25 * 60)))).toBe("25 min");
});

test("the long form spells the unit out for a sentence", () => {
  expect(sessionLength(START, after(60), "long")).toBe("1 minute");
  expect(sessionLength(START, after(12 * 60), "long")).toBe("12 minutes");
});

test("every place that names a session's length says it with the one function", async () => {
  const { readFile } = await import("node:fs/promises");
  const places = [
    "src/web/features/live/SessionControl.tsx",
    "src/web/features/school/classes/SessionList.tsx",
    "src/web/features/school/classes/SessionReportScreen.tsx",
    "src/web/features/family/PastSessions.tsx",
  ];
  for (const place of places) {
    const source = await readFile(place, "utf8");
    expect(source, place).toContain("sessionLength(");
    // No second wording of its own.
    expect(source, place).not.toMatch(/under a minute/);
  }
});
