import { cleanup, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, expect, test } from "vitest";
import { LevelRows, plainLevel, type RowLink } from "../LevelRange";

afterEach(cleanup);

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const scale = { lo: 4, hi: 12 };
const areas = [
  { id: "geometry", label: "Geometry", estimate: { level: 8, sd: 1.2 } },
  { id: "algebra", label: "Algebra", estimate: { level: 9, sd: 0.5 } },
];
/** The page's link: a plain anchor that says which area it opens. */
const rowLink: RowLink = (area, { children, ...props }) => (
  <a href={`?open=area:${area}`} {...props}>
    {children}
  </a>
);

test("plain words name the best guess and the range, kindergarten by name", () => {
  expect(plainLevel({ level: 8, sd: 1.2 })).toBe(
    "Most likely Grade 8 · somewhere between Grade 6 and Geometry",
  );
  expect(plainLevel({ level: 0.2, sd: 0.1 })).toBe("Most likely Kindergarten");
});

test("with a row link, Overall and every area open their own area, 44 px rows with a chevron", () => {
  const { container, getAllByRole } = render(
    <LevelRows
      overall={{ level: 8.5, sd: 1 }}
      areas={areas}
      scale={scale}
      rowLink={rowLink}
    />,
  );
  const links = getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "?open=area:overall",
    "?open=area:geometry",
    "?open=area:algebra",
  ]);
  expect(links[1]!.getAttribute("aria-label")).toBe(
    "Geometry: best guess Grade 8, likely Grade 6 to Geometry. Open its skills",
  );
  for (const link of links) expect(link.querySelector("svg")).not.toBeNull();
  expect(container.querySelector("ul")!.hasAttribute("data-interactive")).toBe(
    true,
  );
});

test("the readout says the focused row's range, and Overall's when none is", () => {
  const { container, getAllByRole } = render(
    <LevelRows
      overall={{ level: 8.5, sd: 1 }}
      areas={areas}
      scale={scale}
      rowLink={rowLink}
    />,
  );
  const readout = () =>
    container.querySelector("[data-level-readout]")!.textContent;
  expect(readout()).toBe(`Overall ${plainLevel({ level: 8.5, sd: 1 })}`);
  act(() => getAllByRole("link")[2]!.focus());
  expect(readout()).toBe(`Algebra ${plainLevel(areas[1]!.estimate)}`);
  act(() => getAllByRole("link")[2]!.blur());
  expect(readout()).toBe(`Overall ${plainLevel({ level: 8.5, sd: 1 })}`);
});

test("a level not measured yet is inert: no link, no readout, the searching bar stays", () => {
  const { container, queryAllByRole } = render(
    <LevelRows
      overall={null}
      areas={[]}
      scale={{ lo: 0, hi: 12 }}
      rowLink={rowLink}
      moving
    />,
  );
  expect(queryAllByRole("link")).toHaveLength(0);
  expect(container.querySelector("[data-level-readout]")).toBeNull();
  expect(container.querySelector("ul")!.hasAttribute("data-interactive")).toBe(
    false,
  );
  expect(
    container.querySelector<HTMLElement>("[data-level-bar]")!.dataset
      .unmeasured,
  ).toBe("true");
});

test("without a row link the rows are read, not opened", () => {
  const { queryAllByRole, container } = render(
    <LevelRows overall={{ level: 8.5, sd: 1 }} areas={areas} scale={scale} />,
  );
  expect(queryAllByRole("link")).toHaveLength(0);
  expect(container.querySelector("[data-level-readout]")).toBeNull();
});
