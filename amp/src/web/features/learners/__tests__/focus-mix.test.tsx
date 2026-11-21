import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { FocusMix } from "../FocusMix";

afterEach(cleanup);

const skill = (id: string) => ({ id, title: `Skill ${id}` });

test("each reason in plain words, how many, and the skills behind it", () => {
  render(
    <FocusMix
      answered={20}
      label="Last 20 problems"
      mix={[
        { key: "catching-up", count: 7, skills: ["a", "b", "c", "d"].map(skill) },
        { key: "reviewing", count: 11, skills: [skill("e")] },
        { key: "checking-earlier", count: 2, skills: [skill("f"), skill("g")] },
      ]}
      skill={(entry) => <a href={`#${entry.id}`}>{entry.title}</a>}
    />,
  );
  expect(screen.getByRole("heading", { name: "Last 20 problems" })).toBeTruthy();
  const lines = [...document.querySelectorAll("[data-focus]")].map(
    (line) => line.textContent,
  );
  expect(lines).toEqual([
    "Catching up7Skill a, Skill b and 2 more",
    "Reviewing11Skill e",
    "Checking earlier skills2Skill f, Skill g",
  ]);
  // Skills are drawn by the caller (a link that opens the skill).
  expect(screen.getByRole("link", { name: "Skill a" }).getAttribute("href")).toBe(
    "#a",
  );
});

test("nothing before an answer", () => {
  const { container } = render(
    <FocusMix answered={0} label="Last problems" mix={[]} />,
  );
  expect(container.innerHTML).toBe("");
});
