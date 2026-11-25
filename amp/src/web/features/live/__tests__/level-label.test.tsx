import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { levelText } from "../format";
import { LiveRoster } from "../LiveRoster";
import { DEFAULT_LIVE_SORT } from "../sort";
import { iso, row, START } from "./fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

test("a level is said in the grade words the class map uses, never the decimal", () => {
  expect(levelText(null)).toBe("—");
  // Below and at K, never a negative or "0.x".
  expect(levelText(-0.7)).toBe("K");
  expect(levelText(0)).toBe("K");
  expect(levelText(0.1)).toBe("K");
  expect(levelText(3.6)).toBe("Gr 4");
  expect(levelText(8)).toBe("Gr 8");
  expect(levelText(12.1)).toBe("Precalc");
  expect(levelText(9)).toBe("Alg 1");
});

const rows = [
  row("Ana", { level: 3.6, problems: 1, correct: 1 }),
  row("Ben", { level: 0.1, problems: 1, correct: 1 }),
  row("Cy", { level: -0.7, problems: 1, correct: 1 }),
];

test("the desktop grid's Level column and the phone's line show the words", () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
  const { unmount } = render(
    <LiveRoster
      rows={rows}
      startedAt={iso(0)}
      now={START + 60_000}
      sort={DEFAULT_LIVE_SORT}
      onSortChange={() => undefined}
      showGradeNumbers
      label="Students"
      nameHeader="Student"
    />,
  );
  const grid = screen.getByRole("grid", { name: "Students" });
  const text = within(grid)
    .getAllByRole("row")
    .map((r) => r.textContent);
  expect(text.join("|")).toMatch(/Gr 4/);
  expect(text.join("|")).not.toMatch(/3\.6|0\.1|-0\.7|−0\.7/);
  unmount();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  render(
    <LiveRoster
      rows={rows}
      startedAt={iso(0)}
      now={START + 60_000}
      sort={DEFAULT_LIVE_SORT}
      onSortChange={() => undefined}
      showGradeNumbers
      label="Students"
      nameHeader="Student"
    />,
  );
  const lines = [...document.querySelectorAll("[data-live-row]")].map(
    (r) => r.textContent ?? "",
  );
  expect(lines.some((line) => line.includes("Gr 4"))).toBe(true);
  expect(lines.join("|")).not.toMatch(/\d\.\d/);
});
