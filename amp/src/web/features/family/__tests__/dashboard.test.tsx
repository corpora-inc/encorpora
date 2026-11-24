import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryClient, sessionOptions } from "../../../lib/query";
import type { DashboardChild, FamilyChild, FamilyDashboard } from "../api";
import {
  ChildDashboard,
  ChildWeekFacts,
  FamilyWeekSummary,
  FocusSheet,
} from "../Dashboard";

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
  queryClient.clear();
  vi.unstubAllGlobals();
});

const FROM = "2026-11-16";
const TODAY = "2026-11-18";
const board = (
  id: string,
  daily: [string, number, number][],
  correct: number,
  lastPracticed: string | null = daily.length ? daily.at(-1)![0] : null,
): DashboardChild =>
  ({
    id,
    name: id,
    gradeLevelShown: true,
    week: {
      days: daily.filter(([, minutes]) => minutes > 0).length,
      minutes: daily.reduce((sum, [, minutes]) => sum + minutes, 0),
      problems: daily.reduce((sum, [, , problems]) => sum + problems, 0),
      correct,
      independent: correct,
      lastPracticed,
    },
    daily: daily.map(([day, minutes, problems]) => ({ day, minutes, problems })),
    level: null,
    areas: [],
    focus: { answered: 0, mix: [] },
  }) as DashboardChild;
const dashboard = (children: DashboardChild[]): FamilyDashboard => ({
  familyId: "f1",
  today: TODAY,
  week: { from: FROM, to: TODAY },
  join: null,
  children,
});
const child = (lastPracticed: string | null) =>
  ({
    id: "pip",
    name: "Pip",
    week: { minutes: 0, problems: 0, lastPracticed },
  }) as unknown as FamilyChild;

test("the family's week: every child's minutes each day, and the week's figures", () => {
  render(
    <FamilyWeekSummary
      objectives={3}
      dashboard={dashboard([
        board("pip", [["2026-11-16", 10, 4], ["2026-11-17", 5, 2]], 4),
        board("wren", [["2026-11-16", 20, 6]], 5),
      ])}
    />,
  );
  const facts = [...document.querySelectorAll("[data-week-facts] > div")].map(
    (fact) => fact.textContent,
  );
  expect(facts).toEqual([
    "practice35 min",
    "problems12",
    "right75%",
    "skills earned3",
  ]);
  const days = screen.getByRole("group", {
    name: "Practice time each day this week",
  }).children;
  // The two children's minutes summed, Monday first.
  expect(days[0]!.getAttribute("aria-label")).toMatch(/30 min · 10 problems/);
  expect(days[1]!.getAttribute("aria-label")).toMatch(/5 min · 2 problems/);
  expect(days[2]!.getAttribute("aria-label")).toBe("Today: no practice");
});

test("one day of practice is a fact, not a one-bar chart", () => {
  render(
    <FamilyWeekSummary
      objectives={0}
      dashboard={dashboard([board("pip", [["2026-11-17", 12, 4]], 2)])}
    />,
  );
  expect(screen.getByText("12 min")).toBeTruthy();
  expect(screen.queryByRole("group")).toBeNull();
  expect(screen.queryByText("skills earned")).toBeNull();
});

test("nothing before the week's first practice", () => {
  const { container } = render(
    <FamilyWeekSummary objectives={0} dashboard={dashboard([board("pip", [], 0)])} />,
  );
  expect(container.innerHTML).toBe("");
});

test("a child's row figures: the week's dots, minutes, problems, percent right", () => {
  render(
    <ChildWeekFacts
      child={child("2026-11-17")}
      board={board("pip", [["2026-11-16", 10, 4], ["2026-11-17", 5, 4]], 6)}
      today={TODAY}
      from={FROM}
    />,
  );
  expect(document.querySelector("[data-week-figures]")!.textContent).toBe(
    "15 min · 8 problems · 75% right",
  );
  expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
    "Practiced 2 days this week: Mon, Tue",
  );
});

test("a quiet week says when they last practiced; a new child, not started", () => {
  const { rerender } = render(
    <ChildWeekFacts
      child={child("2026-11-12")}
      board={board("pip", [], 0, "2026-11-12")}
      today={TODAY}
      from={FROM}
    />,
  );
  expect(document.querySelector("[data-week-quiet]")!.textContent).toBe(
    "Last practiced Nov 12",
  );
  rerender(
    <ChildWeekFacts
      child={child(null)}
      board={board("pip", [], 0, null)}
      today={TODAY}
      from={FROM}
    />,
  );
  expect(screen.getByText("Not started")).toBeTruthy();
});

/** A family's Today, as far as a child's block and its sheet need it. */
async function onToday(body: React.ReactNode) {
  queryClient.setQueryData(sessionOptions.queryKey, {
    accountId: "amp|parent",
    token: "synthetic",
  });
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/$",
    component: () => <main>{body}</main>,
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: ["/family/f1"] }),
  });
  await act(async () => {
    await router.load();
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("main");
  return router;
}

test("a child's last problems are one line; the skills behind them open in a sheet over Today, every one", async () => {
  const skill = (id: string) => ({ id, title: `Skill ${id}` });
  const pip = {
    ...board("pip", [["2026-11-17", 12, 20]], 14),
    name: "Pip",
    level: { level: 3.4, low: 3, high: 4, answered: 40 },
    focus: {
      answered: 20,
      mix: [
        {
          key: "catching-up",
          count: 7,
          skills: ["a", "b", "c", "d"].map(skill),
        },
        { key: "reviewing", count: 11, skills: [skill("e")] },
        { key: "new-ground", count: 2, skills: [skill("f")] },
      ],
    },
  } as DashboardChild;
  const kid = child("2026-11-17");
  const router = await onToday(
    <>
      <ChildDashboard child={kid} board={pip} />
      <FocusSheet dashboard={dashboard([pip])} children={[kid]} />
    </>,
  );
  // On the page: the counts, and no skill's name.
  const line = screen.getByRole("button", { name: /^Pip’s last 20 problems/ });
  expect(line.textContent).toBe(
    "Last 20 problemsCatching up 7Reviewing 11Checking earlier 0New ground 2",
  );
  expect(document.querySelector("main")!.textContent).not.toContain("Skill ");
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => {
    fireEvent.click(line);
  });
  const sheet = await screen.findByRole("dialog", {
    name: "Pip’s last 20 problems",
  });
  // Every skill, each a link that opens it: never "and 2 more".
  expect(
    within(sheet)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["a", "b", "c", "d", "e", "f"].map((id) => `Skill ${id}`));
  expect(
    within(sheet)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(["Catching up7", "Reviewing11", "New ground2"]);
  expect(sheet.textContent).not.toMatch(/and \d+ more/);
  // The sheet is the history entry's: Back closes it to Today.
  expect(router.history.location.pathname).toBe("/family/f1");
  await act(async () => {
    router.history.back();
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("before a first answer a child keeps their one line, with nothing to open", async () => {
  await onToday(
    <ChildDashboard child={child(null)} board={board("pip", [], 0, null)} />,
  );
  expect(document.querySelector("[data-child-not-started]")!.textContent).toBe(
    "AMP finds Pip’s level in a few minutes of practice.",
  );
  expect(document.querySelector("[data-focus-line]")).toBeNull();
});
