import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AreaRows, checkedWords, gradeSpan, type AreaRow } from "../AreaRows";

afterEach(cleanup);

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const level = (at: number, answered = 40) => ({
  level: at,
  low: at - 0.8,
  high: at + 0.8,
  answered,
});
const checked = (notAsked: number) => ({
  from: 3,
  to: 4,
  skills: 10,
  strong: 5,
  earned: 3,
  tried: 0,
  notAsked,
});
const areas: AreaRow[] = [
  { area: "number", title: "Number & operations", level: level(4.7), checked: checked(2) },
  { area: "algebra", title: "Algebra", level: level(4.5, 3), checked: checked(0) },
  { area: "geometry", title: "Geometry", level: null, checked: null },
  { area: "measurement", title: "Measurement", level: level(6), checked: checked(0) },
  { area: "data", title: "Data & probability", level: level(5.3), checked: checked(0) },
];

test("five rows in the area's hue, each with its action", () => {
  render(
    <AreaRows
      areas={areas}
      overall={level(4.8, 500)}
      numbers={false}
      label="Wren's math areas"
      action={(row) =>
        row.checked?.notAsked ? <button type="button">{row.checked.notAsked} not asked</button> : null
      }
      caption="Levels from 500 answers."
    />,
  );
  const rows = screen.getByRole("list", { name: "Wren's math areas" }).children;
  expect([...rows].map((row) => row.getAttribute("data-strand"))).toEqual([
    "number",
    "algebra",
    "geometry",
    "measurement",
    "data",
  ]);
  expect(screen.getByRole("button", { name: "2 not asked" })).toBeTruthy();
  expect(screen.getByText("Levels from 500 answers.")).toBeTruthy();
  // An area with no answers says so; few answers draw an estimate.
  expect(rows[2]!.querySelector("[data-level-not-started]")).toBeTruthy();
  expect(rows[1]!.querySelector("[data-estimated]")).toBeTruthy();
  expect(rows[0]!.querySelector("[data-estimated]")).toBeNull();
});

test("the checked bar: one part per standing, as wide as its share", () => {
  render(
    <AreaRows areas={areas} overall={null} numbers={false} label="areas" />,
  );
  const bar = document.querySelector("[data-checked-bar]")!;
  const parts = [...bar.querySelectorAll("[data-standing]")].map((part) => [
    part.getAttribute("data-standing"),
    (part as HTMLElement).style.getPropertyValue("--share"),
  ]);
  // No empty part for a standing with no skills (tried: 0).
  expect(parts).toEqual([
    ["strong", "0.5"],
    ["earned", "0.3"],
    ["notAsked", "0.2"],
  ]);
  expect(bar.getAttribute("aria-label")).toBe(
    "10 skills below: 5 strong, 3 earned, 0 tried, 2 not asked yet",
  );
});

test("grade names only with the learner's numbers on; the bars draw either way", () => {
  const { rerender } = render(
    <AreaRows areas={areas} overall={level(4.8)} numbers={false} label="areas" />,
  );
  expect(document.body.textContent).not.toMatch(/Gr \d/);
  expect(document.querySelectorAll("[data-level-bar]")).toHaveLength(4);
  expect(document.querySelector("[data-level-axis-label]")).toBeNull();
  rerender(
    <AreaRows areas={areas} overall={level(4.8)} numbers label="areas" />,
  );
  expect(screen.getAllByText("Gr 3–4").length).toBe(4);
  expect(document.querySelector("[data-level-axis-label]")).toBeTruthy();
  expect(document.querySelectorAll("[data-level-bar]")).toHaveLength(4);
});

test("no checked column when nothing lies below the level", () => {
  render(
    <AreaRows
      areas={areas.map((row) => ({ ...row, checked: null }))}
      overall={level(0.5)}
      numbers={false}
      label="areas"
      checkedHead="Checked below"
    />,
  );
  expect(document.querySelector("[data-checking]")).toBeNull();
  expect(screen.queryByText("Checked below")).toBeNull();
});

test("grade spans in short words", () => {
  expect(gradeSpan(3, 4)).toBe("Gr 3–4");
  expect(gradeSpan(0, 1)).toBe("K–Gr 1");
  expect(gradeSpan(8, 9)).toBe("Gr 8–Alg 1");
  expect(gradeSpan(2, 2)).toBe("Gr 2");
  expect(checkedWords(checked(1), true)).toBe(
    "10 skills in Gr 3–4: 5 strong, 3 earned, 0 tried, 1 not asked yet",
  );
});
