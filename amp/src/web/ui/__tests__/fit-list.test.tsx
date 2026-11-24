import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fitItems } from "../fit-words";
import { FitList } from "../FitList";

const SKILLS = [
  "Adding within 10",
  "Making 10",
  "Counting objects to 20",
  "Numerals through 20",
  "Ordering numbers through 10",
];

/** jsdom lays nothing out: give the box a width and one line, and the probe
 * the height its words would take at `perLine` characters a line. */
function layOut(perLine: number, lines = 1) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element, pseudo) =>
      new Proxy(computed(element, pseudo), {
        get: (style, property) =>
          property === "maxHeight"
            ? `${16 * lines}px`
            : typeof Reflect.get(style, property) === "function"
              ? (Reflect.get(style, property) as () => unknown).bind(style)
              : Reflect.get(style, property),
      }),
  );
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const length = (this.textContent ?? "").length;
      return {
        height: Math.max(1, Math.ceil(length / perLine)) * 16,
        width: 200,
      } as DOMRect;
    },
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const skills = (count: number) =>
  `${count} ${count === 1 ? "skill" : "skills"}`;
const shown = () =>
  [...document.querySelectorAll("[data-fit-item]")].map(
    (item) => item.textContent,
  );

test("fitItems: every item when all fit, else the most that fit, 0 when none", () => {
  expect(fitItems(5, () => true)).toBe(5);
  expect(fitItems(5, (count) => count <= 3)).toBe(3);
  expect(fitItems(5, (count) => count === 0)).toBe(0);
  expect(fitItems(0, () => true)).toBe(0);
  // The last item may be shorter than the count it replaces.
  expect(fitItems(5, (count) => count <= 2 || count === 5)).toBe(5);
});

test("with room every name shows and nothing counts the rest", () => {
  layOut(200);
  render(<FitList items={SKILLS} all={skills} />);
  expect(shown()).toEqual(SKILLS);
  expect(document.querySelector("[data-fit-more]")).toBeNull();
  expect(document.querySelector("[title]")).toBeNull();
});

test("without room: the first names whole, then how many more", () => {
  // 40 a line: "Adding within 10, Making 10 +3 more" is 35.
  layOut(40);
  render(<FitList items={SKILLS} all={skills} />);
  expect(shown()).toEqual(["Adding within 10", "Making 10"]);
  expect(document.querySelector("[data-fit-more]")?.textContent).toBe(
    "+3 more",
  );
  const list = document.querySelector<HTMLElement>("[data-fit-list]")!;
  expect(list.dataset.fitTotal).toBe("5");
  expect(list.dataset.fitShown).toBe("2");
  // Never part of a name.
  expect(list.textContent).not.toMatch(/…/);
});

test("two lines hold more names than one", () => {
  layOut(40, 2);
  render(<FitList items={SKILLS} lines={2} all={skills} />);
  expect(shown()).toEqual(SKILLS.slice(0, 4));
  expect(document.querySelector("[data-fit-more]")?.textContent).toBe(
    "+1 more",
  );
});

test("when not even the first name fits, the count alone, in the caller's words", () => {
  layOut(12);
  render(<FitList items={SKILLS} all={skills} />);
  expect(shown()).toEqual([]);
  expect(document.querySelector("[data-fit-more]")?.textContent).toBe(
    "5 skills",
  );
});

test("a document that lays nothing out shows every name", () => {
  render(<FitList items={SKILLS} all={skills} data-report-skills="" />);
  expect(shown()).toEqual(SKILLS);
  expect(screen.getByText("Making 10")).toBeTruthy();
  expect(document.querySelector("[data-report-skills]")).toBeTruthy();
});
