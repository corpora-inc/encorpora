import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ProblemLessonView } from "../../../content/problem-lessons";
import { ProblemLesson } from "../../ProblemLesson";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("repeated lesson steps keep their position without duplicate-key errors, including after a lesson update", () => {
  const errors = vi.spyOn(console, "error");
  const repeated = "Subtract the same amount from both sides.";
  const lesson: ProblemLessonView = {
    templateId: "repeated-step-fixture",
    title: "Solve an equation",
    goal: "Keep both sides equal.",
    principle: "",
    watch: "",
    terms: [],
    glossary: [],
    glossaryLexicon: {},
    method: [repeated, "Collect the variable terms.", repeated],
    example: {
      prompt: "Solve the equation.",
      steps: ["Start with the given equation.", repeated, repeated],
      answer: "2",
    },
  };
  const { container, rerender } = render(<ProblemLesson lesson={lesson} />);
  const rows = (selector: string) =>
    [...container.querySelectorAll(selector)].map((row) => row.textContent);
  expect(rows(".lesson-example ol > li")).toEqual(lesson.example.steps);
  expect(rows(".lesson-method > li")).toEqual(lesson.method);

  const updated = {
    ...lesson,
    method: [repeated, repeated],
    example: { ...lesson.example, steps: [repeated, "Check the result."] },
  };
  rerender(<ProblemLesson lesson={updated} />);
  expect(rows(".lesson-example ol > li")).toEqual(updated.example.steps);
  expect(rows(".lesson-method > li")).toEqual(updated.method);
  expect(errors).not.toHaveBeenCalled();
});
