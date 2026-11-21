import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { WeekDots, WeekSummary } from "../WeekSummary";

afterEach(cleanup);

const week = {
  from: "2026-11-16",
  today: "2026-11-18",
  daily: [
    { day: "2026-11-16", minutes: 30, problems: 2 },
    { day: "2026-11-17", minutes: 5, problems: 1 },
    { day: "2026-11-18", minutes: 0, problems: 0 },
  ],
};

test("a learner's week as seven dots: practiced, quiet, ahead", () => {
  render(<WeekDots {...week} />);
  const strip = screen.getByRole("img");
  expect(strip.getAttribute("aria-label")).toBe(
    "Practiced 2 days this week: Mon, Tue",
  );
  const states = [...strip.children].map((dot) =>
    dot.getAttribute("data-state"),
  );
  expect(states).toEqual([
    "practiced",
    "practiced",
    "quiet",
    "ahead",
    "ahead",
    "ahead",
    "ahead",
  ]);
  expect(strip.children[2]!.hasAttribute("data-today")).toBe(true);
});

test("the week's figures, then each day's minutes with its detail", () => {
  render(
    <WeekSummary
      headingId="w"
      facts={[
        { value: "35 min", label: "practice" },
        { value: "3", label: "problems" },
      ]}
      days={week}
    />,
  );
  expect(screen.getByRole("heading", { name: "This week" })).toBeTruthy();
  expect(screen.getByText("35 min")).toBeTruthy();
  const days = screen.getByRole("group", {
    name: "Practice time each day this week",
  }).children;
  // Seven days, Monday first.
  expect(days).toHaveLength(7);
  expect(days[0]!.getAttribute("aria-label")).toMatch(/30 min · 2 problems/);
  expect(days[1]!.getAttribute("aria-label")).toMatch(/5 min · 1 problem$/);
  // Today is the one marked.
  expect(days[2]!.getAttribute("aria-label")).toBe("Today: no practice");
  // A day still ahead keeps its slot but offers nothing: no tip on hover or
  // tap, no focus stop, nothing for a screen reader.
  for (const ahead of [...days].slice(3)) {
    expect(ahead.getAttribute("data-tip")).toBeNull();
    expect(ahead.getAttribute("tabindex")).toBeNull();
    expect(ahead.getAttribute("aria-hidden")).toBe("true");
  }
  for (const past of [...days].slice(0, 3)) {
    expect(past.getAttribute("data-tip")).toBeTruthy();
    expect(past.getAttribute("tabindex")).toBe("0");
  }
});

test("without days, the figures alone; a spread the caller draws", () => {
  render(
    <WeekSummary
      headingId="w"
      heading="The week"
      facts={[{ value: "4", label: "students practiced" }]}
      spread={<p>spread</p>}
    />,
  );
  expect(screen.queryByRole("group")).toBeNull();
  expect(screen.getByText("spread")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "The week" })).toBeTruthy();
});
