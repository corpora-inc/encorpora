import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LiveRow } from "../../../../schools/live/contracts";
import { LiveRoster, type LiveRosterProps } from "../LiveRoster";
import { DEFAULT_LIVE_SORT, nextSort, type LiveSort } from "../sort";
import { iso, right, row, START, wrong } from "./fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  // The grid measures itself; jsdom lays nothing out.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // The roster takes its form from its width; jsdom lays nothing out, so
  // it reads the window's.
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
});

const now = START + 60_000;
const make = () => [
  row("Cara", { problems: 3, correct: 3, lastAnswerAt: iso(50_000) }),
  row("Abe", { problems: 9, correct: 5, lastAnswerAt: iso(55_000) }),
  row("Bea", { problems: 1, correct: 0, lastAnswerAt: iso(58_000) }),
];

function Roster(
  props: Partial<LiveRosterProps> & { rows: LiveRow[]; sort: LiveSort },
) {
  return (
    <LiveRoster
      startedAt={iso(0)}
      now={now}
      onSortChange={() => undefined}
      showGradeNumbers
      label="Students in this session"
      nameHeader="Student"
      {...props}
    />
  );
}

const order = () =>
  [...document.querySelectorAll<HTMLElement>("[data-live-row]")].map(
    (element) => element.textContent?.match(/Abe|Bea|Cara/)?.[0],
  );

test("rows never reorder when the data changes; only a new sort reorders them", () => {
  const rows = make();
  const sort = nextSort(DEFAULT_LIVE_SORT, "problems");
  const { rerender } = render(<Roster rows={rows} sort={sort} />);
  expect(order()).toEqual(["Abe", "Cara", "Bea"]);
  // Bea answers ten more: still third, her figure changed in place.
  const busier = rows.map((r) =>
    r.name === "Bea"
      ? { ...r, problems: 11, correct: 10, recent: [right, wrong] }
      : r,
  );
  rerender(<Roster rows={busier} sort={sort} />);
  expect(order()).toEqual(["Abe", "Cara", "Bea"]);
  expect(
    document.querySelector("[data-live-row]")!.closest("tr")!.textContent,
  ).toContain("9");
  // The same sort chosen again (a new version) takes a fresh order.
  rerender(
    <Roster rows={busier} sort={{ ...sort, version: sort.version + 1 }} />,
  );
  expect(order()).toEqual(["Bea", "Abe", "Cara"]);
});

test("a student who arrives later joins at the end, without moving anyone", () => {
  const rows = make();
  const sort = nextSort(DEFAULT_LIVE_SORT, "problems");
  const { rerender } = render(<Roster rows={rows} sort={sort} />);
  rerender(
    <Roster
      rows={[row("Aaron", { problems: 40, correct: 40 }), ...rows]}
      sort={sort}
    />,
  );
  const names = [
    ...document.querySelectorAll<HTMLElement>("[data-live-row]"),
  ].map((element) => element.textContent?.match(/Aaron|Abe|Bea|Cara/)?.[0]);
  expect(names).toEqual(["Abe", "Cara", "Bea", "Aaron"]);
});

test("a desktop grid: sortable headers call back with the next sort, and levels follow showGradeNumbers", () => {
  const change = vi.fn();
  const { rerender } = render(
    <Roster rows={make()} sort={DEFAULT_LIVE_SORT} onSortChange={change} />,
  );
  const grid = screen.getByRole("grid", { name: "Students in this session" });
  for (const name of ["Student", "Status", "Problems", "Correct", "Level"])
    expect(within(grid).getByRole("button", { name })).toBeTruthy();
  // Help is one column of four counts, as a tablet's rows draw it: the
  // skill has the room four word-headed columns took.
  for (const header of ["Help", "Skill", "Last active", "Last 5"])
    expect(
      within(grid).getByRole("columnheader", { name: header }),
    ).toBeTruthy();
  fireEvent.click(within(grid).getByRole("button", { name: "Status" }));
  expect(change).toHaveBeenLastCalledWith({
    key: "attention",
    direction: "ascending",
    version: 1,
  });
  fireEvent.click(within(grid).getByRole("button", { name: "Student" }));
  expect(change).toHaveBeenLastCalledWith({
    key: "name",
    direction: "descending",
    version: 1,
  });
  rerender(
    <Roster rows={make()} sort={DEFAULT_LIVE_SORT} showGradeNumbers={false} />,
  );
  expect(
    within(grid).queryByRole("columnheader", { name: "Level" }),
  ).toBeNull();
});

test("marks, words and the last five answers are named for a screen reader", () => {
  render(
    <Roster
      rows={[
        row("Abe", {
          problems: 3,
          correct: 0,
          lastAnswerAt: iso(55_000),
          recent: [wrong, wrong, wrong],
        }),
        row("Bea", { firstSeenAt: null, lastSeenAt: null }),
      ]}
      sort={DEFAULT_LIVE_SORT}
    />,
  );
  expect(screen.getByRole("img", { name: "Needs help" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Not signed in" })).toBeTruthy();
  expect(
    screen.getByRole("img", {
      name: "Last 3 answers, oldest first: wrong, wrong, wrong",
    }),
  ).toBeTruthy();
  expect(screen.getByRole("img", { name: "No answers yet" })).toBeTruthy();
});

test("on a phone: rows of name over detail, a sort menu, and a student's link from the screen", () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  render(
    <Roster
      rows={make()}
      sort={DEFAULT_LIVE_SORT}
      link={({ personId, className, children, name }) => (
        <a
          className={className}
          href={`#${personId}`}
          aria-label={`Open ${name}`}
        >
          {children}
        </a>
      )}
    />,
  );
  expect(screen.queryByRole("grid")).toBeNull();
  const list = screen.getByRole("list", { name: "Students in this session" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByRole("link", { name: "Open Abe" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Sorted: Name, A to Z/ }),
  ).toBeTruthy();
  expect(list.textContent).toContain("56% of 9");
});

test("on a tablet: a segmented sort", () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 768,
  });
  const change = vi.fn();
  render(
    <Roster rows={make()} sort={DEFAULT_LIVE_SORT} onSortChange={change} />,
  );
  const group = screen.getByRole("radiogroup", { name: "Sort students" });
  fireEvent.click(within(group).getByRole("radio", { name: "Needs you" }));
  expect(change).toHaveBeenCalledWith({
    key: "attention",
    direction: "ascending",
    version: 1,
  });
});
