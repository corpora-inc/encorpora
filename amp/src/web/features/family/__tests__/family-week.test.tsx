import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { queryClient } from "../../../lib/query";
import { childTimeOptions } from "../api";
import { FamilyWeek } from "../FamilyWeek";
import type { FamilyPlace } from "../FamilyFrame";

afterEach(() => {
  cleanup();
  queryClient.clear();
});

const session = { accountId: "amp|parent", token: "t" };
const FROM = "2026-11-16";
const kid = (id: string) => ({
  id,
  name: id,
  capabilities: { readProgress: true },
});
const place = (minutes: number) =>
  ({
    session,
    family: "f1",
    data: {
      children: [kid("pip"), kid("wren")],
      today: {
        date: "2026-11-18",
        week: {
          from: FROM,
          minutes,
          problems: minutes,
          skills: 2,
          objectives: 3,
          working: 2,
          students: 2,
        },
      },
    },
  }) as unknown as FamilyPlace;
const time = (learner: string, days: [string, number][]) =>
  queryClient.setQueryData(
    childTimeOptions(session, "f1", learner, "week", FROM).queryKey,
    {
      days: days.map(([day, minutes]) => ({ day, minutes, problems: 1 })),
    } as never,
  );

test("the week's minutes each day, every child's together, and the skills earned", () => {
  time("pip", [
    ["2026-11-16", 10],
    ["2026-11-17", 5],
  ]);
  time("wren", [["2026-11-16", 20]]);
  render(
    <QueryClientProvider client={queryClient}>
      <FamilyWeek place={place(35)} />
    </QueryClientProvider>,
  );
  expect(screen.getByText(/35 min · 3 skills earned/)).toBeTruthy();
  const days = screen.getByRole("group", {
    name: "Practice time each day this week",
  }).children;
  // Seven days, Monday first: the two children's minutes summed.
  expect(days).toHaveLength(7);
  expect(days[0]!.getAttribute("aria-label")).toMatch(/30 min · 2 problems/);
  expect(days[1]!.getAttribute("aria-label")).toMatch(/5 min/);
  // A quiet day says so; today is the one marked.
  expect(days[3]!.getAttribute("aria-label")).toMatch(/no practice/);
  expect(days[2]!.getAttribute("aria-label")).toMatch(/^Today/);
  // Day initials under the columns, no caption inside the axis.
  expect(days[0]!.textContent).toBe("M");
  expect(screen.queryByText(/Minutes per day/)).toBeNull();
});

test("nothing before the week's first practice", () => {
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <FamilyWeek place={place(0)} />
    </QueryClientProvider>,
  );
  expect(container.textContent).toBe("");
});
