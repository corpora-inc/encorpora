import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { promptLine } from "../prompt-line";
import { WorkList } from "../teacher-shared";

afterEach(cleanup);

/* Recent work (product grabs 2026-11-17, #17): a complex fraction read
   "Simplify -5/41/6" and the mixed number 3¼ read "31/4". The prompt is
   typeset as practice typesets it, and its plain reading is unambiguous. */

const complex = "Simplify $\\dfrac{-\\frac{5}{4}}{\\frac{1}{6}}$. Give an exact fraction or integer.";
const mixed = "Evaluate $21.8-3\\frac{1}{4}\\times 3$. Enter the answer as a decimal.";

test("plain reading: a complex fraction is bracketed, a mixed number keeps its space", () => {
  expect(promptLine(complex)).toBe(
    "Simplify (-5/4)/(1/6). Give an exact fraction or integer.",
  );
  expect(promptLine(mixed)).toBe(
    "Evaluate 21.8-3 1/4×3. Enter the answer as a decimal.",
  );
  // Simple fractions stay as they were.
  expect(promptLine("Add $\\frac{3}{4}$ and $\\frac{x}{2}$")).toBe(
    "Add 3/4 and x/2",
  );
  expect(promptLine("$\\frac{x+1}{2}$")).toBe("(x+1)/2");
});

const item = (prompt: string) => ({
  id: "w1",
  day: "2026-11-17",
  at: "2026-11-17T16:50:00Z",
  prompt,
  answer: "-15/2",
  response: "-15/2",
  result: "independent" as const,
  review: false,
  skill: "Simplifying complex fractions",
  strand: "fractions",
});

test("Recent work typesets the problem: fractions stacked, a mixed number whole", () => {
  const { container } = render(
    <WorkList work={[item(complex), { ...item(mixed), id: "w2" }]} />,
  );
  const prompts = container.querySelectorAll("[data-work-prompt]");
  expect(prompts).toHaveLength(2);
  // KaTeX draws each fraction with a bar: three in the complex fraction,
  // one in the mixed number, and nothing flattened to "41/6" or "31/4".
  expect(prompts[0]!.querySelectorAll(".mfrac")).toHaveLength(3);
  expect(prompts[1]!.querySelectorAll(".mfrac")).toHaveLength(1);
  for (const prompt of prompts) {
    const math = prompt.querySelector("math")!.textContent!;
    expect(math).not.toMatch(/41\/6|31\/4/);
  }
  expect(prompts[1]!.getAttribute("title")).toContain("3 1/4");
});

