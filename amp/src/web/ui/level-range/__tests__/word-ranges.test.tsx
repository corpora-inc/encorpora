import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LevelRows, likelyInWords, rangeWords } from "../LevelRange";

afterEach(cleanup);

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

test("D-2: a parent reads a range in grade words, never the scale's decimals", () => {
  expect(rangeWords([0, 0.6])).toBe("K–Gr 1");
  expect(rangeWords([7.2, 11])).toBe("Gr 7–Alg 2");
  expect(rangeWords([3.2, 3.4])).toBe("Gr 3");
  expect(likelyInWords([0, 1.6])).toBe("Likely Kindergarten to Grade 2");
  expect(likelyInWords([8.7, 11])).toBe("Likely Algebra 1 to Algebra 2");
  // A range that reaches precalculus is open: no answer bounds it above.
  expect(rangeWords([6.4, 12.6])).toBe("Gr 6+");
  expect(likelyInWords([6.4, 11.6])).toBe("Likely Grade 6 and above");
  expect(likelyInWords([0, 12.4])).toBe(
    "Likely anywhere from Kindergarten to Precalculus",
  );
});

test("D-2: rows show short grade words with wordRanges, decimals without", () => {
  const overall = { level: 0.3, sd: 0.2 };
  const areas = [
    { id: "numbers", label: "Numbers", estimate: { level: 9.8, sd: 0.7 } },
  ];
  const scale = { lo: 0, hi: 12 };
  const words = render(
    <LevelRows overall={overall} areas={areas} scale={scale} wordRanges />,
  ).container.textContent!;
  expect(words).toContain("K");
  expect(words).toContain("Alg 1–Alg 2");
  expect(words).not.toMatch(/\d\.\d/);
  cleanup();
  const decimals = render(
    <LevelRows overall={overall} areas={areas} scale={scale} />,
  ).container.textContent!;
  expect(decimals).toMatch(/\d\.\d–\d+\.\d/);
});
