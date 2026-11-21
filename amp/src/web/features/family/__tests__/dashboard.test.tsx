import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { DashboardChild, FamilyChild, FamilyDashboard } from "../api";
import { ChildWeekFacts, FamilyWeekSummary } from "../Dashboard";

afterEach(cleanup);

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
    "No practice yet this week · last practiced Nov 12",
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
