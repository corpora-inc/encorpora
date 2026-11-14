import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LevelBar } from "../LevelBar";
import { LevelRangeStart, LevelRows, WHOLE_SCALE } from "../LevelRange";

afterEach(cleanup);

// The axis thins its labels as it narrows; jsdom has no layout to observe.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const bar = (root: ParentNode) =>
  root.querySelector<HTMLElement>("[data-level-bar]")!;
const range = (root: ParentNode) =>
  bar(root).querySelector<HTMLElement>("[class*=range]")!;

test("before the first answer the hero names no grade: the whole scale, a “?” on the dot", () => {
  const { container, getByRole } = render(<LevelRangeStart heading={1} />);
  expect(getByRole("heading", { level: 1 }).textContent).toBe("Where you are");
  // The range spans the whole axis, kindergarten to precalculus.
  expect(bar(container).dataset.unmeasured).toBe("true");
  expect(range(container).style.left).toMatch(/^0(\.0+)?%$/);
  expect(range(container).style.width).toMatch(/^100(\.0+)?%$/);
  expect(container.querySelector("[data-level-mark]")?.textContent).toBe("?");
  const labels = [...container.querySelectorAll("[data-level-axis-label]")].map(
    (label) => label.textContent,
  );
  expect(labels[0]).toBe("K");
  expect(labels.at(-1)).toBe("Precalc");
  expect(labels).toHaveLength(13);
  // The words promise and sell; none names a grade.
  const words = [...container.querySelectorAll("p")]
    .map((p) => p.textContent)
    .join(" ");
  expect(words).toContain("We’ll find your level in a few minutes.");
  expect(words).toContain("AMP makes every minute count.");
  expect(words).not.toMatch(/grade|gr \d|algebra|geometry|precalc/i);
  expect(getByRole("img").getAttribute("aria-label")).toMatch(
    /not measured yet/i,
  );
});

test("read by a parent, it names the child and never speaks to them", () => {
  const { container } = render(<LevelRangeStart who="Maya" />);
  const words = container.textContent ?? "";
  expect(words).toContain(
    "We’ll find Maya’s level in a few minutes of practice.",
  );
  expect(words).not.toMatch(/Just start answering/);
});

test("the hero's dot searches; a column of rows stays still", () => {
  const hero = render(<LevelRangeStart />).container;
  expect(bar(hero).className).toMatch(/moving/);
  cleanup();
  const rows = render(
    <LevelRows overall={null} areas={[]} scale={WHOLE_SCALE} />,
  ).container;
  expect(bar(rows).className).not.toMatch(/moving/);
  expect(rows.textContent).toContain("Not yet");
  expect(rows.querySelector("li")?.getAttribute("aria-label")).toMatch(
    /^Overall: Level not measured yet/,
  );
});

test("the motion lives only where the reader allows motion", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/web/ui/level-range/LevelRange.module.css"),
    "utf8",
  );
  const allowed = css.indexOf("@media (prefers-reduced-motion: no-preference)");
  expect(allowed).toBeGreaterThan(-1);
  // Every animation that uses the search and the breath is inside that
  // block: under reduced motion the full range and the "?" stand still.
  const block = css.slice(allowed, css.indexOf("@keyframes level-search"));
  for (const name of ["level-search", "level-breathe"]) {
    const uses = [...css.matchAll(new RegExp(`animation:[^;]*${name}`, "g"))];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) expect(block.includes(use[0])).toBe(true);
  }
});

test("the first answer turns the same bar into the estimate: same element, same size", () => {
  const { container, rerender } = render(
    <LevelBar estimate={null} scale={WHOLE_SCALE} size="large" moving />,
  );
  const before = bar(container);
  const dot = before.querySelector("[data-level-dot]");
  rerender(
    <LevelBar
      estimate={{ level: 6, sd: 1 }}
      scale={WHOLE_SCALE}
      size="large"
      moving
    />,
  );
  const after = bar(container);
  // One element throughout, so its range and dot glide (CSS transitions on
  // left and width) instead of remounting; the size class never changes.
  expect(after).toBe(before);
  expect(after.querySelector("[data-level-dot]")).toBe(dot);
  expect(after.dataset.unmeasured).toBeUndefined();
  expect(after.className).not.toMatch(/moving/);
  expect(after.className).toMatch(/large/);
  expect(after.querySelector("[data-level-mark]")).toBeNull();
  expect(Number.parseFloat(range(container).style.width)).toBeLessThan(100);
});

test("the hero takes the first estimate in place: the same bar, the words in one cell", () => {
  const { container, rerender } = render(<LevelRangeStart heading={1} />);
  const before = bar(container);
  const cell = container.querySelector("[class*=heroWords]")!;
  rerender(
    <LevelRangeStart
      heading={1}
      found={{ estimate: { level: 7, sd: 1.2 }, answered: 1 }}
    />,
  );
  const after = bar(container);
  expect(after).toBe(before);
  expect(after.dataset.unmeasured).toBeUndefined();
  expect(container.querySelector("[class*=heroWords]")).toBe(cell);
  // The words before stay, hidden, holding the cell; what was found shows.
  const sets = cell.querySelectorAll("[class*=heroWordsSet]");
  expect(sets).toHaveLength(2);
  expect(sets[0]!.getAttribute("aria-hidden")).toBe("true");
  expect(sets[1]!.textContent).toMatch(/^Best guess Grade 7, likely/);
  expect(sets[1]!.textContent).toContain("1 problem answered.");
});

test("one predicate decides measured, for every reader", async () => {
  const { measured } = await import("../../../../learning/level-check");
  expect(measured(null)).toBe(false);
  expect(measured(undefined)).toBe(false);
  expect(measured({ answered: 0 })).toBe(false);
  expect(measured({ answered: 1 })).toBe(true);
  // A level from a server that never sends the count stored none unanswered.
  expect(measured({})).toBe(true);
});

test("among measured learners, one not started is a pill, never a bar", () => {
  const { container } = render(
    <LevelRows
      overall={null}
      areas={[]}
      scale={{ lo: 3, hi: 7 }}
      notStarted="Not started"
    />,
  );
  expect(container.querySelector("[data-level-bar]")).toBeNull();
  const pill = container.querySelector("[data-level-not-started]")!;
  expect(pill.textContent).toBe("?Not started");
  expect(container.querySelector("li")?.getAttribute("aria-label")).toBe(
    "Overall: Not started",
  );
  // The row keeps a bar's height: the pill sits in the bar's own box.
  expect(pill.className).toMatch(/bar/);
});
