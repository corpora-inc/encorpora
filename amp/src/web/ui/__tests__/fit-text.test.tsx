import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FitText } from "../FitText";
import { closeAllPopovers } from "../popover-owner";

const TITLE = "Solving a linear and a nonlinear equation together";

/** jsdom lays nothing out: give the box a width and a line, and the probe
 * the height its words would take at `perLine` characters a line. */
function layOut(perLine: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element, pseudo) =>
      new Proxy(computed(element, pseudo), {
        get: (style, property) =>
          property === "maxHeight"
            ? "16px"
            : typeof Reflect.get(style, property) === "function"
              ? (Reflect.get(style, property) as () => unknown).bind(style)
              : Reflect.get(style, property),
      }),
  );
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const lines = Math.max(
        1,
        Math.ceil((this.textContent ?? "").length / perLine),
      );
      return { height: lines * 16, width: 200 } as DOMRect;
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
  act(() => closeAllPopovers());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("with room, the whole name is plain text: nothing to tap, no hover title", () => {
  layOut(80);
  render(<FitText text={TITLE} label="Skill" />);
  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(document.querySelector("[title]")).toBeNull();
});

test("without room, whole words and an ellipsis; a tap shows the whole name", () => {
  layOut(24);
  render(<FitText text={TITLE} label="Skill" />);
  const button = screen.getByRole("button", { name: TITLE });
  expect(button.textContent).toBe("Solving a linear and a…");
  expect(document.querySelector("[title]")).toBeNull();
  expect(screen.queryByRole("note")).toBeNull();
  fireEvent.click(button);
  expect(screen.getByRole("note", { name: "Skill" }).textContent).toBe(TITLE);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  // The same tap again closes it.
  fireEvent.click(button);
  expect(screen.queryByRole("note")).toBeNull();
});

test("the tap is the name's own: a row that opens something else stays shut", () => {
  layOut(24);
  const open = vi.fn();
  render(
    <div onClick={open}>
      <FitText text={TITLE} label="Skill" />
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: TITLE }));
  expect(open).not.toHaveBeenCalled();
});

test("facts after the words: the reserved ones are measured with them", () => {
  // 24 a line: "Solving a linear and a…" is 23 alone, 28 with "Gr 12".
  layOut(24);
  render(
    <FitText text={TITLE} after={["Gr 12", "45s"]} reserve={1} label="Skill" />,
  );
  expect(screen.getByRole("button", { name: TITLE }).textContent).toBe(
    "Solving a linear…",
  );
  // Both facts are in the line; the box drops what has no room, whole.
  expect(screen.getByText("Gr 12")).toBeTruthy();
  expect(screen.getByText("45s")).toBeTruthy();
});

test("a first word wider than the box shows as far as it goes, and the tap still shows the whole name", () => {
  layOut(5);
  render(<FitText text={TITLE} label="Skill" />);
  const button = screen.getByRole("button", { name: TITLE });
  // The first word and its ellipsis; the box's own clip ends them.
  expect(button.textContent).toBe("Solving…");
  fireEvent.click(button);
  expect(screen.getByRole("note", { name: "Skill" }).textContent).toBe(TITLE);
});

test("a document that lays nothing out shows the whole name", () => {
  render(<FitText text={TITLE} label="Skill" />);
  expect(screen.getByText(TITLE)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
