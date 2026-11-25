import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FocusLine, FocusSkills, type FocusEntry } from "../FocusMix";

afterEach(cleanup);

const skill = (id: string) => ({ id, title: `Skill ${id}` });
const mix: FocusEntry[] = [
  { key: "catching-up", count: 7, skills: ["a", "b", "c", "d"].map(skill) },
  { key: "reviewing", count: 11, skills: [skill("e")] },
  { key: "checking-earlier", count: 2, skills: [skill("f"), skill("g")] },
];
const reasons = () =>
  [...document.querySelectorAll("[data-focus-line] [data-focus]")].map(
    (reason) => `${reason.getAttribute("data-focus")}: ${reason.textContent}`,
  );

test("one line: what is counted, the four reasons each with its count, no skill names", () => {
  const open = vi.fn();
  render(
    <FocusLine
      answered={20}
      label="Last 20 problems"
      openLabel="Pip’s last 20 problems"
      mix={mix}
      onOpen={open}
    />,
  );
  // All four reasons, in one order, whatever their counts: a 0 is a 0.
  expect(reasons()).toEqual([
    "catching-up: Catching up 7",
    "reviewing: Reviewing 11",
    "checking-earlier: Checking earlier 2",
    "new-ground: New ground 0",
  ]);
  expect(
    document
      .querySelector('[data-focus="new-ground"]')!
      .hasAttribute("data-zero"),
  ).toBe(true);
  const line = screen.getByRole("button");
  expect(line.textContent).toContain("Last 20 problems");
  expect(line.textContent).not.toContain("Skill");
  // One control, named in full for a screen reader, opening the skills.
  expect(line.getAttribute("aria-label")).toBe(
    "Pip’s last 20 problems: Catching up 7, Reviewing 11, Checking earlier skills 2, New ground 0. See the skills",
  );
  fireEvent.click(line);
  expect(open).toHaveBeenCalledTimes(1);
});

test("the line is the same shape for every mix; chosen practice joins what is counted", () => {
  const shape = () =>
    [...document.querySelectorAll("[data-focus-line] [data-focus]")].map(
      (reason) => reason.getAttribute("data-focus"),
    );
  const four = ["catching-up", "reviewing", "checking-earlier", "new-ground"];
  const { rerender } = render(
    <FocusLine
      answered={1}
      label="Last problem"
      openLabel="Pip’s last problem"
      mix={[{ key: "new-ground", count: 1, skills: [skill("a")] }]}
      onOpen={() => undefined}
    />,
  );
  expect(shape()).toEqual(four);
  expect(reasons().at(-1)).toBe("new-ground: New ground 1");
  rerender(
    <FocusLine
      answered={20}
      label="Last 20 problems"
      openLabel="Pip’s last 20 problems"
      mix={[...mix, { key: "chosen", count: 3, skills: [skill("h")] }]}
      onOpen={() => undefined}
    />,
  );
  // Someone's choice is not one of AMP's reasons: it is said with the label.
  expect(shape()).toEqual(["chosen", ...four]);
  expect(screen.getByRole("button").textContent).toContain(
    "Last 20 problems · 3 chosen",
  );
  expect(screen.getByRole("button").getAttribute("aria-label")).toContain(
    "New ground 0, Chosen practice 3. See the skills",
  );
});

test("nothing before an answer", () => {
  const { container } = render(
    <FocusLine
      answered={0}
      label="Last problems"
      openLabel="Pip’s last problems"
      mix={[]}
      onOpen={() => undefined}
    />,
  );
  expect(container.innerHTML).toBe("");
});

test("the skills behind them: each reason that has any, its count, and every skill", () => {
  render(
    <FocusSkills
      mix={mix}
      skill={(entry) => <a href={`#${entry.id}`}>{entry.title}</a>}
    />,
  );
  const groups = [
    ...document.querySelectorAll("[data-focus-skills] [data-focus]"),
  ].map((group) => [
    group.querySelector("h3")!.textContent,
    [...group.querySelectorAll("li")].map((row) => row.textContent),
  ]);
  // All four of the first reason's skills: never "and 2 more".
  expect(groups).toEqual([
    ["Catching up7", ["Skill a", "Skill b", "Skill c", "Skill d"]],
    ["Reviewing11", ["Skill e"]],
    ["Checking earlier skills2", ["Skill f", "Skill g"]],
  ]);
  expect(document.body.textContent).not.toMatch(/and \d+ more/);
  // Skills are drawn by the caller (a link that opens the skill).
  expect(
    screen.getByRole("link", { name: "Skill a" }).getAttribute("href"),
  ).toBe("#a");
});
