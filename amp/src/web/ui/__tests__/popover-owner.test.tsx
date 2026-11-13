import { afterEach, expect, test } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { closeAllPopovers, usePopover } from "../popover-owner";
afterEach(() => {
  act(() => closeAllPopovers());
  cleanup();
});

/** A trigger and its popover, registered with the layer. */
function Pop({
  name,
  modal = false,
  children,
}: {
  name: string;
  modal?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  usePopover(open, {
    contains: (node) => !!root.current?.contains(node),
    anchor: () => root.current,
    close: () => setOpen(false),
    modal,
  });
  return (
    <div ref={root}>
      <button onClick={() => setOpen((was) => !was)}>{name}</button>
      {open && <div data-open={name}>{children}</div>}
    </div>
  );
}
const openNames = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-open]")].map((element) =>
    element.getAttribute("data-open"),
  );
const press = (element: Element) => {
  fireEvent.pointerDown(element);
  fireEvent.click(element);
};

test("one open at a time: opening one closes the other", () => {
  const { container, getByText } = render(
    <>
      <Pop name="a" />
      <Pop name="b" />
    </>,
  );
  press(getByText("a"));
  expect(openNames(container)).toEqual(["a"]);
  press(getByText("b"));
  expect(openNames(container)).toEqual(["b"]);
  press(getByText("b"));
  expect(openNames(container)).toEqual([]);
});

test("a press outside closes it, even on content that stops propagation", () => {
  const { container, getByText } = render(
    <>
      <Pop name="a" />
      <p onPointerDown={(event) => event.stopPropagation()}>Plain text</p>
      <svg>
        <rect data-testid="shape" />
      </svg>
    </>,
  );
  press(getByText("a"));
  fireEvent.pointerDown(getByText("Plain text"));
  expect(openNames(container)).toEqual([]);
  press(getByText("a"));
  fireEvent.pointerDown(container.querySelector("rect")!);
  expect(openNames(container)).toEqual([]);
});

test("a scroll, a resize, Back and a route change close it", () => {
  const { container, getByText } = render(<Pop name="a" />);
  for (const event of [
    () => fireEvent.scroll(window),
    () => fireEvent(window, new Event("resize")),
    () => fireEvent(window, new PopStateEvent("popstate")),
    () => closeAllPopovers("navigate"),
  ]) {
    press(getByText("a"));
    expect(openNames(container)).toEqual(["a"]);
    act(event);
    expect(openNames(container)).toEqual([]);
  }
});

test("Escape closes only the top one, and nothing beneath sees it", () => {
  let beneath = 0;
  document.addEventListener("keydown", () => beneath++, true);
  const { container, getByText } = render(
    <Pop name="outer" modal>
      <Pop name="inner" />
    </Pop>,
  );
  press(getByText("outer"));
  press(getByText("inner"));
  // Opened from inside it, the inner one keeps the outer.
  expect(openNames(container)).toEqual(["outer", "inner"]);
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(openNames(container)).toEqual(["outer"]);
  expect(beneath).toBe(0);
});

test("a modal dismisses itself: a press outside it is its own to handle", () => {
  const { container, getByText } = render(
    <>
      <Pop name="menu" modal />
      <p>Elsewhere</p>
      <Pop name="tip" />
    </>,
  );
  press(getByText("menu"));
  fireEvent.pointerDown(getByText("Elsewhere"));
  expect(openNames(container)).toEqual(["menu"]);
  // Another opening from elsewhere replaces it.
  press(getByText("tip"));
  expect(openNames(container)).toEqual(["tip"]);
});
