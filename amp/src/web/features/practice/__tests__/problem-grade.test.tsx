import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { CurriculumDetailsFixture } from "../../curriculum/CurriculumDetails";
import { ProblemGrade } from "../ProblemGrade";
import { nextGradeStep } from "../problem-grade";

/* Practice shows each problem's grade and which way the engine moved in that
   problem's area: up, back, or no arrow on the first problem there. */

afterEach(cleanup);

test("a step compares the grade with the last problem in the same area", () => {
  const first = nextGradeStep(undefined, "p1", 3);
  expect(first.step).toBeNull();
  const up = nextGradeStep(first, "p2", 5);
  expect(up.step).toBe("up");
  const back = nextGradeStep(up, "p3", 4);
  expect(back.step).toBe("down");
  expect(nextGradeStep(back, "p4", 4).step).toBeNull();
  // The same problem drawn twice is one step, not two.
  expect(nextGradeStep(up, "p2", 5)).toBe(up);
});

function grade(problemId: string, strand: string, band: string, shown = true) {
  return (
    <CurriculumDetailsFixture shown={shown}>
      <span className="workspace-topic">
        <ProblemGrade
          learnerId="learner-a"
          strand={strand}
          problemId={problemId}
          band={band}
        />
      </span>
    </CurriculumDetailsFixture>
  );
}

test("areas keep their own trails; a change of area is not a step", () => {
  const { container, rerender } = render(grade("a1", "number", "3"));
  const badge = () => container.querySelector("[data-problem-grade]");
  expect(badge()?.textContent).toContain("Gr 3");
  expect(badge()?.getAttribute("data-step")).toBeNull();
  rerender(grade("a2", "number", "6"));
  expect(badge()?.getAttribute("data-step")).toBe("up");
  expect(badge()?.textContent).toContain("Grade 6, a step up");
  // Another area at a lower grade: its first problem, no arrow.
  rerender(grade("b1", "geometry", "2"));
  expect(badge()?.getAttribute("data-step")).toBeNull();
  // Back in the first area, below its last problem: a step back.
  rerender(grade("a3", "number", "5"));
  expect(badge()?.getAttribute("data-step")).toBe("down");
});

test("no grade where grade levels are hidden", () => {
  const { container } = render(grade("c1", "data", "4", false));
  expect(container.querySelector("[data-problem-grade]")).toBeNull();
});
