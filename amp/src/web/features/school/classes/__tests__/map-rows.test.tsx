import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LevelRows, fitScale } from "../../../../ui/level-range";

afterEach(cleanup);

// The axis thins its labels as it narrows; jsdom has no layout to observe.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const overall = { level: 4.2, sd: 0.9 };
const areas = [
  {
    id: "fractions",
    label: "Fractions",
    estimate: { level: 4.4, sd: 0.9 },
    estimated: true,
  },
  {
    id: "geometry",
    label: "Geometry",
    estimate: { level: 3.6, sd: 0.8 },
    estimated: true,
  },
];
const scale = fitScale([overall, ...areas.map((area) => area.estimate)], {
  minSpan: 6,
  include: [3.5, 4.5],
});

/* Finding #25 (2026-11-17): the class map's first screen had no grade scale
   (the axis sat under a long stack) and each row ended in an unexplained
   "Starting" or "Not yet". #28: the student sheet said "3.6–8.2". */
test("the class map's rows: the scale first, and a first guess says its range in grade words", () => {
  const { container } = render(
    <LevelRows
      overall={overall}
      overallEstimated
      areas={areas}
      scale={scale}
      grade={[3.5, 4.5]}
      wordRanges
      axisAt="top"
      guesses
    />,
  );
  const axis = container.querySelector("[data-level-axis-at='top']");
  const rows = container.querySelector("ul");
  expect(axis).not.toBeNull();
  // The axis comes before the rows, so it's on the first screen.
  expect(
    axis!.compareDocumentPosition(rows!) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    container.querySelectorAll("[data-level-axis-label]").length,
  ).toBeGreaterThan(2);
  const text = container.textContent ?? "";
  expect(text).not.toMatch(/Starting|Not yet/);
  const ends = [...container.querySelectorAll("[data-guess]")].map(
    (end) => end.textContent,
  );
  expect(ends).toHaveLength(3);
  // Grade words, never the scale's decimals.
  for (const end of ends) expect(end).toMatch(/^(K|Gr \d+)(–(K|Gr \d+))?\+?$/);
});

test("other level views keep their axis under the rows and their words", () => {
  const { container } = render(
    <LevelRows
      overall={overall}
      overallEstimated
      areas={areas}
      scale={scale}
    />,
  );
  expect(
    container.querySelector("[data-level-axis-at='bottom']"),
  ).not.toBeNull();
  expect(container.textContent).toMatch(/Starting/);
});
