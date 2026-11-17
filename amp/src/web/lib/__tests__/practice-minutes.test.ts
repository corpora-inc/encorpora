import { expect, test } from "vitest";
import { practiceMinutes } from "../practice-minutes";

test("real work never reads as none: under a minute is <1 min", () => {
  expect(practiceMinutes(0, 6)).toBe("<1 min");
  expect(practiceMinutes(0.4, 0)).toBe("<1 min");
  expect(practiceMinutes(1, 2)).toBe("1 min");
  expect(practiceMinutes(12.6, 30)).toBe("13 min");
  expect(practiceMinutes(0, 0)).toBeNull();
});
